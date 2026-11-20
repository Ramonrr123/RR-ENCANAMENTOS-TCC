import { BadRequestException, ForbiddenException, Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { mapUserSpecialPermissions } from './user-special-permissions.util';
import { resolveIsAdmin } from './admin-access.util';
import { PermissionsService } from '../permissions/permissions.service';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const SESSAO_HORAS = 8;
const EM_USO_MS = 45_000;
const MAX_FALHAS_LOGIN = 5;
const BLOQUEIO_LOGIN_MS = 15 * 60 * 1000;

export type SessaoMeta = {
  ip?: string;
  userAgent?: string;
  empresaCodigo?: string | null;
};

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private permissionsService: PermissionsService,
  ) {}

  async onModuleInit() {
    await this.ensureGruposUsuariosSchema();
    await this.ensureSessoesSchema();
  }

  /** Coluna exigida pelo Prisma após merge main — evita 500 no login se o SQL ainda não rodou. */
  private async ensureGruposUsuariosSchema(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "crm_grupos_usuarios"
        ADD COLUMN IF NOT EXISTS "podePrecificarOrcamentoRepresentante" BOOLEAN NOT NULL DEFAULT false
      `);
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "crm_grupos_usuarios"
        ADD COLUMN IF NOT EXISTS "podeLiberarVisualizacaoRepresentante" BOOLEAN NOT NULL DEFAULT false
      `);
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "crm_grupos_usuarios"
        ADD COLUMN IF NOT EXISTS "podeVisualizarProdutos" BOOLEAN NOT NULL DEFAULT false
      `);
    } catch (err: any) {
      this.logger.warn(`ensureGruposUsuariosSchema: ${err?.message}`);
    }
  }

  private async ensureSessoesSchema(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "crm_sessoes" (
          "id" TEXT PRIMARY KEY,
          "usuarioId" INTEGER NOT NULL REFERENCES "crm_usuarios"(id) ON DELETE CASCADE,
          "empresaCodigo" TEXT,
          "ip" TEXT,
          "userAgent" TEXT,
          "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "expiraEm" TIMESTAMP(3) NOT NULL,
          "ultimoPing" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "ativo" BOOLEAN NOT NULL DEFAULT true,
          "encerradoEm" TIMESTAMP(3),
          "encerradoPorId" INTEGER REFERENCES "crm_usuarios"(id) ON DELETE SET NULL
        )
      `);
      await this.prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "crm_sessoes_ativo_ultimoPing_idx" ON "crm_sessoes" ("ativo", "ultimoPing")`,
      );
      await this.prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "crm_sessoes_usuarioId_idx" ON "crm_sessoes" ("usuarioId")`,
      );
    } catch (err: any) {
      this.logger.warn(`ensureSessoesSchema: ${err?.message}`);
    }
  }

  async changePassword(userId: number, senhaAtual: string, novaSenha: string) {
    if (!senhaAtual || !novaSenha) {
      throw new BadRequestException('Informe a senha atual e a nova senha');
    }
    if (novaSenha.length < 6) {
      throw new BadRequestException('A nova senha deve ter pelo menos 6 caracteres');
    }
    if (novaSenha === senhaAtual) {
      throw new BadRequestException('A nova senha deve ser diferente da senha atual');
    }

    const user = await this.prisma.crmUsuarios.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });
    if (!user) throw new UnauthorizedException('Usuário não encontrado');

    // 400 e não 401: o frontend encerra a sessão em qualquer 401
    const ok = await bcrypt.compare(senhaAtual, user.password);
    if (!ok) throw new BadRequestException('Senha atual incorreta');

    const password = await bcrypt.hash(novaSenha, 10);
    await this.prisma.crmUsuarios.update({ where: { id: userId }, data: { password } });
    return { ok: true };
  }

  async login(email: string, password: string, meta?: SessaoMeta) {
    // Buscar usuário por email ou login
    const user = await this.prisma.crmUsuarios.findFirst({
      where: {
        OR: [
          { email: email },
          { login: email },
        ],
      },
      include: {
        grupoUsuario: {
          select: {
            id: true,
            name: true,
            label: true,
            podeAprovarOrcamentos: true,
            podeVerTabelaPreco: true,
            podePrecificarOrcamentoRepresentante: true,
            podeLiberarVisualizacaoRepresentante: true,
            podeVisualizarProdutos: true,
          },
        },
      },
    });

    if (!user) {
      await bcrypt.compare(password, await this.hashDecoy());
      throw new UnauthorizedException('E-mail ou senha incorretos');
    }

    if (await this.loginBloqueado(user.id)) {
      await bcrypt.compare(password, user.password);
      throw new UnauthorizedException('E-mail ou senha incorretos');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.registrarFalhaLogin(user.id);
      throw new UnauthorizedException('E-mail ou senha incorretos');
    }
    await this.limparFalhaLogin(user.id);

    // Verificar se o usuário está ativo
    if (user.status !== 'ATIVO') {
      throw new UnauthorizedException('Usuário inativo');
    }

    // Buscar empresas associadas ao usuário
    const userCompanies = await this.prisma.crmUsuariosEmpresas.findMany({
      where: { userId: user.id },
      include: { company: true },
    });

    const companies = userCompanies.map(uc => ({
      id: uc.company.id,
      codigo: uc.company.codigo,
      nome: uc.company.nome,
    }));

    const sid = await this.abrirSessao(user.id, meta);
    const access_token = this.assinarToken(user.id, user.login, user.email, sid);

    const isAdmin = resolveIsAdmin(user);
    const permissions = isAdmin
      ? {}
      : await this.permissionsService.getEffectivePermissionMapForUser(user.id);

    const specialPermissions = mapUserSpecialPermissions({ ...user, isAdmin });

    return {
      access_token,
      user: {
        id: user.id,
        login: user.login,
        nome: user.nome,
        email: user.email,
        isAdmin,
        grupoUsuarioId: user.grupoUsuarioId,
        grupoUsuario: user.grupoUsuario ? {
          id: user.grupoUsuario.id,
          name: user.grupoUsuario.name,
          label: user.grupoUsuario.label,
        } : null,
        ...specialPermissions,
        /** Data URL ou caminho — usado no header/sidebar */
        profileImage: user.profileImage ?? null,
        companies,
      },
      permissions, // Incluir permissões na resposta
    };
  }

  private decoyHash: Promise<string> | null = null;

  private hashDecoy() {
    this.decoyHash ??= bcrypt.hash('credencial-inexistente', 10);
    return this.decoyHash;
  }

  private chaveLogin(usuarioId: number) {
    return `login:${usuarioId}`;
  }

  private async loginBloqueado(usuarioId: number) {
    const row = await this.prisma.acessoBloqueio.findUnique({ where: { chave: this.chaveLogin(usuarioId) } });
    return Boolean(row?.bloqueadoAte && row.bloqueadoAte > new Date());
  }

  private async registrarFalhaLogin(usuarioId: number) {
    const chave = this.chaveLogin(usuarioId);
    const atual = await this.prisma.acessoBloqueio.findUnique({ where: { chave } });
    const agora = new Date();
    const expirado = Boolean(atual?.bloqueadoAte && atual.bloqueadoAte <= agora);
    const falhas = (expirado ? 0 : atual?.tentativasErradas ?? 0) + 1;
    const data = {
      tentativasErradas: falhas,
      bloqueadoAte: falhas >= MAX_FALHAS_LOGIN ? new Date(agora.getTime() + BLOQUEIO_LOGIN_MS) : null,
    };
    await this.prisma.acessoBloqueio.upsert({
      where: { chave },
      create: { chave, ...data },
      update: data,
    });
  }

  private async limparFalhaLogin(usuarioId: number) {
    await this.prisma.acessoBloqueio.updateMany({
      where: { chave: this.chaveLogin(usuarioId) },
      data: { tentativasErradas: 0, bloqueadoAte: null },
    });
  }

  private assinarToken(userId: number, login: string, email: string | null, sid: string) {
    return this.jwtService.sign({
      sub: userId,
      username: login,
      email,
      sid,
    });
  }

  private async abrirSessao(usuarioId: number, meta?: SessaoMeta) {
    const agora = new Date();
    const id = randomUUID();
    await this.prisma.crmSessoes.create({
      data: {
        id,
        usuarioId,
        empresaCodigo: meta?.empresaCodigo || null,
        ip: meta?.ip || null,
        userAgent: meta?.userAgent || null,
        criadoEm: agora,
        expiraEm: new Date(agora.getTime() + SESSAO_HORAS * 60 * 60 * 1000),
        ultimoPing: agora,
        ativo: true,
      },
    });
    return id;
  }

  async heartbeat(userId: number, sid: string | null | undefined, meta?: SessaoMeta) {
    const agora = new Date();
    if (sid) {
      const sessao = await this.prisma.crmSessoes.findUnique({ where: { id: sid } });
      if (!sessao || !sessao.ativo || sessao.usuarioId !== userId || sessao.expiraEm < agora) {
        throw new UnauthorizedException('Sessão encerrada');
      }
      await this.prisma.crmSessoes.update({
        where: { id: sid },
        data: {
          ultimoPing: agora,
          ip: meta?.ip || sessao.ip,
          userAgent: meta?.userAgent || sessao.userAgent,
          empresaCodigo: meta?.empresaCodigo ?? sessao.empresaCodigo,
        },
      });
      return { ok: true as const };
    }

    const user = await this.prisma.crmUsuarios.findUnique({
      where: { id: userId },
      select: { id: true, login: true, email: true, status: true },
    });
    if (!user || user.status !== 'ATIVO') {
      throw new UnauthorizedException('Usuário inativo ou não encontrado');
    }
    const novaSid = await this.abrirSessao(userId, meta);
    return {
      ok: true as const,
      access_token: this.assinarToken(user.id, user.login, user.email, novaSid),
    };
  }

  async encerrarPropria(userId: number, sid?: string | null) {
    if (!sid) return { ok: true };
    await this.prisma.crmSessoes.updateMany({
      where: { id: sid, usuarioId: userId, ativo: true },
      data: { ativo: false, encerradoEm: new Date(), encerradoPorId: userId },
    });
    return { ok: true };
  }

  async listarSessoes(actorUserId: number, busca?: string, situacao?: string) {
    const actor = await this.prisma.crmUsuarios.findUnique({
      where: { id: actorUserId },
      select: { isAdmin: true, grupoUsuario: { select: { name: true, label: true } } },
    });
    if (!actor || !resolveIsAdmin(actor)) {
      throw new ForbiddenException('Somente administradores podem ver as sessões em uso.');
    }

    const agora = new Date();
    const limiteUso = new Date(agora.getTime() - EM_USO_MS);
    const filtro = (situacao || 'em_uso').trim();
    const where: any = {};

    if (filtro === 'encerradas') {
      where.ativo = false;
      where.encerradoEm = { gte: new Date(agora.getTime() - 12 * 60 * 60 * 1000) };
    } else {
      where.ativo = true;
      where.expiraEm = { gt: agora };
      if (filtro === 'em_uso') {
        where.ultimoPing = { gte: limiteUso };
      }
    }

    const termo = (busca || '').trim();
    if (termo) {
      where.usuario = {
        OR: [
          { nome: { contains: termo, mode: 'insensitive' } },
          { login: { contains: termo, mode: 'insensitive' } },
        ],
      };
    }

    const [rows, emUso, abertas] = await Promise.all([
      this.prisma.crmSessoes.findMany({
        where,
        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              login: true,
              grupoUsuario: { select: { label: true } },
            },
          },
        },
        orderBy: { ultimoPing: 'desc' },
        take: 200,
      }),
      this.prisma.crmSessoes.count({
        where: { ativo: true, expiraEm: { gt: agora }, ultimoPing: { gte: limiteUso } },
      }),
      this.prisma.crmSessoes.count({
        where: { ativo: true, expiraEm: { gt: agora } },
      }),
    ]);

    const codigos = Array.from(
      new Set(rows.map((row) => row.empresaCodigo).filter((codigo): codigo is string => Boolean(codigo))),
    );
    const empresas = codigos.length
      ? await this.prisma.crmEmpresas.findMany({
          where: { codigo: { in: codigos } },
          select: { codigo: true, nome: true },
        })
      : [];
    const empresaPorCodigo = new Map(empresas.map((empresa) => [empresa.codigo, empresa.nome]));

    return {
      emUso,
      abertas,
      sessoes: rows.map((row) => ({
        id: row.id,
        usuarioId: row.usuarioId,
        nome: row.usuario?.nome || '',
        login: row.usuario?.login || '',
        grupo: row.usuario?.grupoUsuario?.label || '',
        empresaCodigo: row.empresaCodigo,
        empresaNome: row.empresaCodigo ? empresaPorCodigo.get(row.empresaCodigo) || row.empresaCodigo : '',
        ip: row.ip,
        criadoEm: row.criadoEm,
        expiraEm: row.expiraEm,
        ultimoPing: row.ultimoPing,
        ativo: row.ativo,
        emUso: row.ativo && row.ultimoPing >= limiteUso && row.expiraEm > agora,
        encerradoEm: row.encerradoEm,
      })),
    };
  }

  async encerrarSessoes(actorUserId: number, ids: string[]) {
    const actor = await this.prisma.crmUsuarios.findUnique({
      where: { id: actorUserId },
      select: { isAdmin: true, grupoUsuario: { select: { name: true, label: true } } },
    });
    if (!actor || !resolveIsAdmin(actor)) {
      throw new ForbiddenException('Somente administradores podem encerrar sessões.');
    }
    const unicos = Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.trim())));
    if (!unicos.length) return { count: 0 };
    const result = await this.prisma.crmSessoes.updateMany({
      where: { id: { in: unicos }, ativo: true },
      data: { ativo: false, encerradoEm: new Date(), encerradoPorId: actorUserId },
    });
    return { count: result.count };
  }
}
