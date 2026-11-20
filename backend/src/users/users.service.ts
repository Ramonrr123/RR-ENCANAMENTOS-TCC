import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { mapUserSpecialPermissions } from '../auth/user-special-permissions.util';
import { isAdministradoresGroup, resolveIsAdmin } from '../auth/admin-access.util';
import { loadSessionScope } from '../auth/session-scope.util';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private especialidadeDe(valor: unknown) {
    if (valor === undefined) return undefined;
    if (valor === null || String(valor).trim() === '') return null;
    const texto = String(valor).trim().toUpperCase();
    if (texto === 'ENCANADOR' || texto === 'PEDREIRO' || texto === 'PINTOR' || texto === 'ELETRICISTA') {
      return texto;
    }
    throw new BadRequestException('Especialidade inválida.');
  }

  private async assertAdminCanSetUserGroup(actorUserId?: number) {
    const scope = await loadSessionScope(this.prisma, actorUserId);
    if (!scope?.isAdmin) {
      throw new ForbiddenException('Somente administradores podem alterar o grupo de usuário.');
    }
  }

  private async isAdminFromGroupId(grupoUsuarioId: string | null | undefined): Promise<boolean> {
    if (!grupoUsuarioId) return false;
    const grupo = await this.prisma.crmGruposUsuarios.findUnique({
      where: { id: grupoUsuarioId },
      select: { name: true, label: true },
    });
    return isAdministradoresGroup(grupo);
  }

  async findAll(query?: string) {
    try {
      // Parse query params
      const params = new URLSearchParams(query || '');
      const skip = params.get('skip') ? parseInt(params.get('skip')!, 10) : 0;
      // Para combos/filtros (ex.: responsáveis de obras) precisamos de todos os usuários ativos.
      // Se `take` não vier na query, usa um valor alto, mas seguro.
      const take = params.get('take') ? parseInt(params.get('take')!, 10) : 500;
      const search = params.get('search');
      const rawStatus = params.get('status');
      const grupoUsuarioId = params.get('grupoUsuarioId') || undefined;

      // Construir where clause
      const where: any = {};

      if (search) {
        where.OR = [
          { nome: { contains: search } },
          { login: { contains: search } },
          { email: { contains: search } },
        ];
      }

      if (rawStatus) {
        const s = rawStatus.toString().trim().toUpperCase();
        if (s === 'ATIVO' || s === 'DESLIGADO') {
          where.status = s as any;
        }
      }

      if (grupoUsuarioId) {
        where.grupoUsuarioId = grupoUsuarioId;
      }

      // Buscar usuários
      const users = await this.prisma.crmUsuarios.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          login: true,
          nome: true,
          cpfCnpj: true,
          email: true,
          status: true,
          dataSaida: true,
          isAdmin: true,
          especialidade: true,
          grupoUsuario: {
            select: {
              id: true,
              label: true,
              name: true,
            },
          },
        },
        orderBy: {
          nome: 'asc',
        },
      });

      // Buscar total
      const total = await this.prisma.crmUsuarios.count({ where });

      // Mapear para o formato esperado pelo frontend
      const data = users.map((user) => ({
        id: user.id,
        login: user.login,
        nome: user.nome,
        cpfCnpj: user.cpfCnpj,
        email: user.email,
        status: user.status,
        isAdmin: user.isAdmin,
        especialidade: user.especialidade,
        dataSaida: user.dataSaida,
        grupoUsuario: user.grupoUsuario ?? null,
      }));

      return {
        data,
        total,
        hasMore: skip + take < total,
        skip,
        take,
      };
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      const params = new URLSearchParams(query || '');
      const skip = params.get('skip') ? parseInt(params.get('skip')!, 10) : 0;
      const take = params.get('take') ? parseInt(params.get('take')!, 10) : 16;
      return {
        data: [],
        total: 0,
        hasMore: false,
        skip,
        take,
      };
    }
  }

  async findOne(id: number) {
    try {
      const user = await this.prisma.crmUsuarios.findUnique({
        where: { id },
        include: {
          grupoUsuario: { select: { id: true, name: true, label: true } },
          empresas: {
            include: {
              company: { select: { id: true, codigo: true, nome: true } },
            },
          },
        },
      });

      if (!user) return null;

      return {
        id: user.id,
        login: user.login,
        nome: user.nome,
        email: user.email,
        status: user.status,
        isAdmin: user.isAdmin,
        especialidade: user.especialidade,
        grupoUsuarioId: user.grupoUsuarioId,
        grupoUsuario: user.grupoUsuario ?? null,
        profileImage: user.profileImage,
        companies: user.empresas.map((ue) => ({
          id: ue.company.id,
          codigo: ue.company.codigo,
          nome: ue.company.nome,
        })),
      };
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      return null;
    }
  }

  async findMe(userId: number) {
    try {
      const user = await this.prisma.crmUsuarios.findUnique({
        where: { id: userId },
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
          empresas: {
            include: {
              company: {
                select: {
                  id: true,
                  codigo: true,
                  nome: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      // Mapear empresas
      const companies = user.empresas.map((ue) => ({
        id: ue.company.id,
        codigo: ue.company.codigo,
        nome: ue.company.nome,
      }));

      const isAdmin = resolveIsAdmin(user);
      return {
        id: user.id,
        login: user.login,
        nome: user.nome,
        email: user.email,
        isAdmin,
        especialidade: user.especialidade,
        grupoUsuarioId: user.grupoUsuarioId,
        grupoUsuario: user.grupoUsuario
          ? {
              id: user.grupoUsuario.id,
              name: user.grupoUsuario.name,
              label: user.grupoUsuario.label,
            }
          : null,
        ...mapUserSpecialPermissions({ ...user, isAdmin }),
        profileImage: user.profileImage,
        companies,
      };
    } catch (error) {
      console.error('Erro ao buscar usuário atual:', error);
      throw error;
    }
  }

  async create(createUserDto: any, actorUserId?: number) {
    try {
      if (!createUserDto.password || createUserDto.password.trim() === '') {
        throw new Error('Senha é obrigatória');
      }

      const scope = await loadSessionScope(this.prisma, actorUserId);
      if (createUserDto.grupoUsuarioId) {
        await this.assertAdminCanSetUserGroup(actorUserId);
      }
      if (createUserDto.isAdmin && !scope?.isAdmin) {
        throw new ForbiddenException('Somente administradores podem criar usuários administradores.');
      }

      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
      const grupoUsuarioId = createUserDto.grupoUsuarioId || null;
      const isAdmin = scope?.isAdmin
        ? (grupoUsuarioId
            ? await this.isAdminFromGroupId(grupoUsuarioId)
            : Boolean(createUserDto.isAdmin))
        : false;

      const user = await this.prisma.crmUsuarios.create({
        data: {
          login: createUserDto.login,
          nome: createUserDto.nome,
          email: createUserDto.email || null,
          password: hashedPassword,
          status: createUserDto.status ?? 'ATIVO',
          isAdmin,
          grupoUsuarioId,
          especialidade: this.especialidadeDe(createUserDto.especialidade) ?? null,
        },
        include: {
          grupoUsuario: { select: { id: true, name: true, label: true } },
        },
      });

      return {
        id: user.id,
        login: user.login,
        nome: user.nome,
        email: user.email,
        status: user.status,
        isAdmin: resolveIsAdmin(user),
        especialidade: user.especialidade,
        grupoUsuarioId: user.grupoUsuarioId,
        grupoUsuario: user.grupoUsuario ?? null,
      };
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      throw error;
    }
  }

  async update(id: number, updateUserDto: any, actorUserId?: number) {
    try {
      const scope = await loadSessionScope(this.prisma, actorUserId);
      if (!scope) {
        throw new ForbiddenException('Sessão inválida.');
      }
      if (!scope.isAdmin && scope.userId !== id) {
        throw new ForbiddenException('Você não pode alterar outro usuário.');
      }

      const updateData: any = {};

      // Atualizar campos básicos se fornecidos
      if (updateUserDto.nome !== undefined) {
        updateData.nome = updateUserDto.nome;
      }
      if (updateUserDto.email !== undefined) {
        updateData.email = updateUserDto.email;
      }
      if (updateUserDto.login !== undefined) {
        updateData.login = updateUserDto.login;
      }
      if (updateUserDto.grupoUsuarioId !== undefined && scope.isAdmin) {
        updateData.grupoUsuarioId = updateUserDto.grupoUsuarioId || null;
        updateData.isAdmin = await this.isAdminFromGroupId(updateUserDto.grupoUsuarioId || null);
      } else if (updateUserDto.grupoUsuarioId !== undefined && !scope.isAdmin) {
        throw new ForbiddenException('Somente administradores podem alterar o grupo de usuário.');
      }
      if (updateUserDto.profileImage !== undefined) {
        updateData.profileImage = updateUserDto.profileImage;
      }
      if (updateUserDto.status !== undefined) {
        if (!scope.isAdmin) {
          throw new ForbiddenException('Somente administradores podem alterar o status do usuário.');
        }
        updateData.status = updateUserDto.status;
      }
      if (updateUserDto.especialidade !== undefined) {
        updateData.especialidade = this.especialidadeDe(updateUserDto.especialidade);
      }

      // Atualizar senha se fornecida
      if (updateUserDto.password && updateUserDto.password.trim() !== '') {
        const hashedPassword = await bcrypt.hash(updateUserDto.password, 10);
        updateData.password = hashedPassword;
      }

      // Atualizar usuário
      const updatedUser = await this.prisma.crmUsuarios.update({
        where: { id },
        data: updateData,
        include: {
          grupoUsuario: {
            select: {
              id: true,
              name: true,
              label: true,
            },
          },
          empresas: {
            include: {
              company: {
                select: {
                  id: true,
                  codigo: true,
                  nome: true,
                },
              },
            },
          },
        },
      });

      // Mapear empresas
      const companies = updatedUser.empresas.map((ue) => ({
        id: ue.company.id,
        codigo: ue.company.codigo,
        nome: ue.company.nome,
      }));

      return {
        id: updatedUser.id,
        login: updatedUser.login,
        nome: updatedUser.nome,
        email: updatedUser.email,
        isAdmin: resolveIsAdmin(updatedUser),
        especialidade: updatedUser.especialidade,
        grupoUsuarioId: updatedUser.grupoUsuarioId,
        grupoUsuario: updatedUser.grupoUsuario
          ? {
              id: updatedUser.grupoUsuario.id,
              name: updatedUser.grupoUsuario.name,
              label: updatedUser.grupoUsuario.label,
            }
          : null,
        profileImage: updatedUser.profileImage,
        companies,
      };
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      throw error;
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.crmUsuarios.delete({ where: { id } });
      return { id };
    } catch (error) {
      console.error('Erro ao remover usuário:', error);
      throw error;
    }
  }

  async deleteMany(ids: number[]) {
    try {
      const result = await this.prisma.crmUsuarios.deleteMany({
        where: { id: { in: ids } },
      });
      return { count: result.count };
    } catch (error) {
      console.error('Erro ao remover usuários:', error);
      throw error;
    }
  }

  async getPreferences(userId: number) {
    // TODO: Implementar busca de preferências do usuário
    // Retornar objeto com estrutura básica
    return {
      theme: 'dark',
      language: 'pt-BR',
      notifications: true,
    };
  }

  private defaultPdfSectionsPrefs() {
    return {
      secaoObs: `OBS.1: FERRAGENS (FECHADURAS, DOBRADIÇAS, PARAFUSOS, CHAPAS E BARRAS DE AÇO) NÃO INCLUSAS NO PREÇO DO MATERIAL.
OBS.2: TODOS OS ITENS DESTE ORÇAMENTO SÃO PARA AMBIENTES INTERNOS, PORTANTO NÃO PODEM SER EXPOSTOS A AÇÕES CLIMÁTICAS.
OBS.3: O FRETE ESTÁ SUJEITO A ALTERAÇÃO DE VALOR.
OBS.4: AUMENTOS DE IMPOSTOS, MUDANÇAS DE ALÍQUOTAS, BEM COMO NOVOS IMPOSTOS OU TAXAS QUE VENHAM A SER CRIADOS E QUE AFETEM O PRODUTO OU OPERAÇÃO, SERÃO ACRESCENTADOS AO PREÇO NA DATA DA ENTREGA.`,
      secaoClausulas: `a) Fornecedor: Compensados e Laminados Lavrasul S/A - CNPJ nr. 83.187.930/0013-67 e Inscr.Est nr. 250.268.450. - Av. Senador Ivo d'Aquino, 385 - CEP 89460-000 - Canoinhas, Sta. Catarina.
b) A medição e instalação dos produtos na obra são de responsabilidade da empresa instaladora contratada pelo comprador.
c) Ferragens não inclusas. Devem ser fornecidas pelo COMPRADOR à LAVRASUL em até 30 dias antes da confirmação do embarque, caso o cliente opte pela usinagem e instalação na fábrica. Neste caso serão entregues devidamente instaladas. Ferragens devem ter cantos arredondados com raio de 15/16 mm. Deve ser observado o peso suportado pela dobradiça levando-se em consideração o núcleo da folha de porta seguindo norma ABNT NBR 7178.
d) Folha de porta, Marco e Alizares estão isentos de IPI. OBS: Caso haja alteração da legislação vigente, haverá repasse ao Comprador.
e) ICMS, PIS + Cofins, inclusos.
f) O pedido estará sujeito a aprovação do crédito e cadastro.
g) O Comprador terá que armazenar os produtos em local adequado, conforme manual do fabricante enviado junto com a nota fiscal.
h) Produtos com garantia contra defeitos de fabricação, nos termos do código do consumidor, a partir da data da emissão da nota fiscal, desde que seguidos os procedimentos recomendados no manual do fabricante, enviado junto com a nota fiscal.
i) As mercadorias deverão ser conferidas na ocasião do recebimento. Quando houver avaria, falta, ou qualquer outra ocorrência, a mesma deverá ser comunicada por escrito ou anotada no canhoto da nota fiscal. Caso este comunicado não seja feito, a Lavrasul reserva-se ao direito de não aceitar reclamações.
j) Empresa participante do Programa Setorial da Qualidade de Portas de Madeira para Edificações (PSQ-PME) da Associação Brasileira da Indústria de Madeira Processada Mecanicamente (ABIMCI).
j) Descrição das medidas desse orçamento: (a) altura (l) largura (e) espessura.`,
      entrega: {
        Entrega:
          '45 a 60 dias após liberação do pedido, recebimento das ferragens ou medição - o que ocorrer por último.',
        Pagamento: '28 dias contados a partir da data da emissão da NF - Sujeito à análise de crédito.',
        Validade: '7 dias úteis',
        Frete: 'FOB (Cliente)',
      },
      isCustom: false,
    };
  }

  private normalizePdfSecaoObs(value: string): string {
    const lines = String(value || '').split('\n');
    const obsoleteLine = (line: string) =>
      line
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .includes('se houver alteracao na medida da largura do marco');

    if (!lines.some(obsoleteLine)) return value;

    let sequence = 0;
    return lines
      .filter((line) => !obsoleteLine(line))
      .map((line) => {
        if (!/^\s*OBS\.\s*\d+\s*:/i.test(line)) return line;
        sequence += 1;
        return line.replace(/^\s*OBS\.\s*\d+\s*:/i, `OBS.${sequence}:`);
      })
      .join('\n')
      .trim();
  }

  private mapPdfSectionsPrefsRow(row: {
    secaoObs: string | null;
    secaoClausulas: string | null;
    entregaEntrega: string | null;
    entregaPagamento: string | null;
    entregaValidade: string | null;
    entregaFrete: string | null;
  }) {
    const defaults = this.defaultPdfSectionsPrefs();
    return {
      secaoObs: this.normalizePdfSecaoObs(row.secaoObs ?? defaults.secaoObs),
      secaoClausulas: row.secaoClausulas ?? defaults.secaoClausulas,
      entrega: {
        Entrega: row.entregaEntrega ?? defaults.entrega.Entrega,
        Pagamento: row.entregaPagamento ?? defaults.entrega.Pagamento,
        Validade: row.entregaValidade ?? defaults.entrega.Validade,
        Frete: row.entregaFrete ?? defaults.entrega.Frete,
      },
      isCustom: true,
    };
  }

  async getPdfSectionsPrefs(userId: number) {
    const row = await this.prisma.crmUsuarioPreferenciasPdf.findUnique({
      where: { usuarioId: userId },
    });
    if (!row) {
      return this.defaultPdfSectionsPrefs();
    }
    return this.mapPdfSectionsPrefsRow(row);
  }

  async savePdfSectionsPrefs(userId: number, body: any) {
    const entrega = body?.entrega ?? {};
    const data = {
      secaoObs:
        body?.secaoObs != null
          ? this.normalizePdfSecaoObs(String(body.secaoObs))
          : null,
      secaoClausulas: body?.secaoClausulas != null ? String(body.secaoClausulas) : null,
      entregaEntrega: entrega?.Entrega != null ? String(entrega.Entrega) : null,
      entregaPagamento: entrega?.Pagamento != null ? String(entrega.Pagamento) : null,
      entregaValidade: entrega?.Validade != null ? String(entrega.Validade) : null,
      entregaFrete: entrega?.Frete != null ? String(entrega.Frete) : null,
    };

    const row = await this.prisma.crmUsuarioPreferenciasPdf.upsert({
      where: { usuarioId: userId },
      create: { usuarioId: userId, ...data },
      update: data,
    });

    return this.mapPdfSectionsPrefsRow(row);
  }

  async resetPdfSectionsPrefs(userId: number) {
    await this.prisma.crmUsuarioPreferenciasPdf.deleteMany({
      where: { usuarioId: userId },
    });
    return this.defaultPdfSectionsPrefs();
  }

  private emailContactsReady = false;

  private async ensureEmailContactsTable() {
    if (this.emailContactsReady) return;
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS crm_usuario_contatos_email (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        tag TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await this.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS crm_usuario_contatos_email_usuario_id_idx
      ON crm_usuario_contatos_email (usuario_id)
    `);
    await this.prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS crm_usuario_contatos_email_usuario_email_idx
      ON crm_usuario_contatos_email (usuario_id, email)
    `);
    await this.prisma.$executeRawUnsafe(`
      ALTER TABLE crm_usuario_contatos_email
      ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP
    `);
    this.emailContactsReady = true;
  }

  private normalizeContactEmail(value: any): string {
    return String(value || '').trim().toLowerCase();
  }

  private normalizeContactTag(value: any): string {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  private assertValidContactEmail(email: string) {
    if (!email || !email.includes('@') || email.length < 5) {
      throw new BadRequestException('Informe um e-mail válido.');
    }
  }

  async listEmailContacts(userId: number) {
    await this.ensureEmailContactsTable();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, email, tag, last_used_at as "lastUsedAt"
      FROM crm_usuario_contatos_email
      WHERE usuario_id = $1
      ORDER BY last_used_at DESC NULLS LAST, tag ASC, email ASC
      `,
      userId,
    );
    return rows.map((row) => ({
      id: Number(row.id),
      email: String(row.email || ''),
      tag: String(row.tag || ''),
      lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt).toISOString() : null,
    }));
  }

  async createEmailContact(userId: number, body: { email?: string; tag?: string }) {
    await this.ensureEmailContactsTable();
    const email = this.normalizeContactEmail(body?.email);
    const tag = this.normalizeContactTag(body?.tag);
    this.assertValidContactEmail(email);
    if (!tag) {
      throw new BadRequestException('Informe uma tag para identificar o e-mail (ex.: Financeiro Lavrasul).');
    }
    const existing = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM crm_usuario_contatos_email WHERE usuario_id = $1 AND email = $2 LIMIT 1`,
      userId,
      email,
    );
    if (existing[0]) {
      throw new BadRequestException('Este e-mail já está salvo nos seus contatos.');
    }
    const created = await this.prisma.$queryRawUnsafe<any[]>(
      `
      INSERT INTO crm_usuario_contatos_email (usuario_id, email, tag)
      VALUES ($1, $2, $3)
      RETURNING id, email, tag
      `,
      userId,
      email,
      tag,
    );
    return {
      id: Number(created[0].id),
      email: String(created[0].email),
      tag: String(created[0].tag || ''),
    };
  }

  async updateEmailContact(
    userId: number,
    contactId: number,
    body: { email?: string; tag?: string },
  ) {
    await this.ensureEmailContactsTable();
    const current = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, email, tag FROM crm_usuario_contatos_email WHERE id = $1 AND usuario_id = $2 LIMIT 1`,
      contactId,
      userId,
    );
    if (!current[0]) {
      throw new BadRequestException('Contato não encontrado.');
    }
    const email =
      body?.email !== undefined
        ? this.normalizeContactEmail(body.email)
        : String(current[0].email);
    const tag =
      body?.tag !== undefined ? this.normalizeContactTag(body.tag) : String(current[0].tag || '');
    this.assertValidContactEmail(email);
    if (!tag) {
      throw new BadRequestException('Informe uma tag para identificar o e-mail.');
    }
    const dup = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM crm_usuario_contatos_email WHERE usuario_id = $1 AND email = $2 AND id <> $3 LIMIT 1`,
      userId,
      email,
      contactId,
    );
    if (dup[0]) {
      throw new BadRequestException('Este e-mail já está salvo nos seus contatos.');
    }
    const updated = await this.prisma.$queryRawUnsafe<any[]>(
      `
      UPDATE crm_usuario_contatos_email
      SET email = $1, tag = $2, updated_at = NOW()
      WHERE id = $3 AND usuario_id = $4
      RETURNING id, email, tag
      `,
      email,
      tag,
      contactId,
      userId,
    );
    return {
      id: Number(updated[0].id),
      email: String(updated[0].email),
      tag: String(updated[0].tag || ''),
    };
  }

  async deleteEmailContact(userId: number, contactId: number) {
    await this.ensureEmailContactsTable();
    const result = await this.prisma.$executeRawUnsafe(
      `DELETE FROM crm_usuario_contatos_email WHERE id = $1 AND usuario_id = $2`,
      contactId,
      userId,
    );
    if (!result) {
      throw new BadRequestException('Contato não encontrado.');
    }
    return { success: true };
  }

  async findEmailContactForUser(userId: number, contactId: number) {
    const found = await this.findEmailContactsForUser(userId, [contactId]);
    return found[0] || null;
  }

  async findEmailContactsForUser(userId: number, contactIds: number[]) {
    await this.ensureEmailContactsTable();
    const ids = [...new Set(contactIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
    if (!ids.length) return [];
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, email, tag
      FROM crm_usuario_contatos_email
      WHERE usuario_id = $1 AND id IN (${ids.join(',')})
      `,
      userId,
    );
    const byId = new Map(rows.map((row) => [Number(row.id), row]));
    return ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((row) => ({
        id: Number(row.id),
        email: String(row.email || ''),
        tag: String(row.tag || ''),
      }));
  }

  async markEmailContactsUsed(userId: number, contactIds: number[]) {
    await this.ensureEmailContactsTable();
    const ids = [...new Set(contactIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
    if (!ids.length) return;
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE crm_usuario_contatos_email
      SET last_used_at = NOW(), updated_at = NOW()
      WHERE usuario_id = $1 AND id IN (${ids.join(',')})
      `,
      userId,
    );
  }
}
