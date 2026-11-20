import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  FinanceiroStatus,
  FinanceiroTipo,
  OrdemFotoMomento,
  OrdemOrigem,
  OrdemSituacao,
  OrdemTipo,
  Prisma,
  TipoPessoa,
} from '@prisma/client';
import { EstoqueService } from '../estoque/estoque.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClienteDto, EnderecoClienteDto, UpdateClienteDto } from './dto/cliente.dto';
import {
  CancelarOrdemDto,
  CreateFotoDto,
  CreateOrdemDto,
  EncerrarOrdemDto,
  FiltroOrdens,
  MaterialLojaDto,
  OrdemPecaDto,
  UpdateOrdemDto,
} from './dto/ordem.dto';

const INCLUDE = {
  cliente: true,
  enderecoServico: true,
  funcionario: { select: { id: true, nome: true, especialidade: true } },
  pecas: { include: { produto: true }, orderBy: { id: 'asc' as const } },
  fotos: { orderBy: { id: 'asc' as const } },
  materiaisLoja: { orderBy: { id: 'asc' as const } },
} satisfies Prisma.OrdemServicoInclude;

const CLIENTE_INCLUDE = {
  enderecos: { orderBy: { id: 'asc' as const } },
} satisfies Prisma.ClienteInclude;

type OrdemRow = Prisma.OrdemServicoGetPayload<{ include: typeof INCLUDE }>;
type ClienteRow = Prisma.ClienteGetPayload<{ include: typeof CLIENTE_INCLUDE }>;

const SITUACOES = ['ABERTA', 'AGENDADA', 'EM_ANDAMENTO', 'EM_EXECUCAO', 'CONCLUIDA', 'CANCELADA', 'ENCERRADA'];
const TIPOS = ['EMERGENCIA', 'PREVENTIVA', 'OBRA'];

@Injectable()
export class OrdensService {
  constructor(
    private prisma: PrismaService,
    private estoque: EstoqueService,
  ) {}

  async findClientes(empresaCodigo: string) {
    const empresa = this.empresa(empresaCodigo);
    const rows = await this.prisma.cliente.findMany({
      where: { empresaCodigo: empresa },
      include: CLIENTE_INCLUDE,
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.toCliente(row));
  }

  async createCliente(empresaCodigo: string, dto: CreateClienteDto) {
    const empresa = this.empresa(empresaCodigo);
    const criado = await this.prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.create({
        data: {
          empresaCodigo: empresa,
          nome: dto.nome.trim(),
          telefone: this.texto(dto.telefone),
          endereco: null,
          cidade: null,
          tipoPessoa: dto.tipoPessoa === 'JURIDICA' ? TipoPessoa.JURIDICA : TipoPessoa.FISICA,
        },
      });
      await this.gravarEnderecos(tx, cliente.id, dto.enderecos, {
        endereco: dto.endereco,
        cidade: dto.cidade,
      });
      return tx.cliente.findFirst({ where: { id: cliente.id }, include: CLIENTE_INCLUDE });
    });
    if (!criado) throw new NotFoundException('Cliente não encontrado.');
    return this.toCliente(criado);
  }

  async updateCliente(empresaCodigo: string, id: number, dto: UpdateClienteDto) {
    const empresa = this.empresa(empresaCodigo);
    const atualizado = await this.prisma.$transaction(async (tx) => {
      const atual = await tx.cliente.findFirst({ where: { id, empresaCodigo: empresa } });
      if (!atual) throw new NotFoundException('Cliente não encontrado.');
      await tx.cliente.update({
        where: { id: atual.id },
        data: {
          nome: dto.nome?.trim() || atual.nome,
          telefone: dto.telefone !== undefined ? this.texto(dto.telefone) : atual.telefone,
          tipoPessoa:
            dto.tipoPessoa === 'JURIDICA'
              ? TipoPessoa.JURIDICA
              : dto.tipoPessoa === 'FISICA'
                ? TipoPessoa.FISICA
                : atual.tipoPessoa,
        },
      });
      const legado =
        dto.enderecos === undefined && (dto.endereco !== undefined || dto.cidade !== undefined)
          ? { endereco: dto.endereco, cidade: dto.cidade }
          : undefined;
      await this.gravarEnderecos(tx, atual.id, dto.enderecos, legado);
      return tx.cliente.findFirst({ where: { id: atual.id }, include: CLIENTE_INCLUDE });
    });
    if (!atualizado) throw new NotFoundException('Cliente não encontrado.');
    return this.toCliente(atualizado);
  }

  async removeClientes(empresaCodigo: string, ids: number[]) {
    const empresa = this.empresa(empresaCodigo);
    const unicos = this.ids(ids, 'Selecione ao menos um cliente.');
    const rows = await this.prisma.cliente.findMany({
      where: { empresaCodigo: empresa, id: { in: unicos } },
    });
    if (rows.length === 0) return { count: 0 };
    const comOrdem = await this.prisma.ordemServico.findMany({
      where: { empresaCodigo: empresa, clienteId: { in: rows.map((row) => row.id) } },
      select: { clienteId: true },
    });
    if (comOrdem.length > 0) {
      const bloqueados = new Set(comOrdem.map((row) => row.clienteId));
      const nomes = rows.filter((row) => bloqueados.has(row.id)).map((row) => row.nome);
      throw new BadRequestException(`Cliente com ordem de serviço não pode ser excluído: ${nomes.join(', ')}.`);
    }
    const result = await this.prisma.cliente.deleteMany({
      where: { empresaCodigo: empresa, id: { in: rows.map((row) => row.id) } },
    });
    return { count: result.count };
  }

  async historicoCliente(empresaCodigo: string, id: number, enderecoId: string | undefined, admin: boolean) {
    const empresa = this.empresa(empresaCodigo);
    const cliente = await this.prisma.cliente.findFirst({ where: { id, empresaCodigo: empresa } });
    if (!cliente) throw new NotFoundException('Cliente não encontrado.');
    let enderecoFiltro: number | undefined;
    if (enderecoId && enderecoId.trim()) {
      const numero = Number(enderecoId);
      if (!Number.isInteger(numero) || numero < 1) throw new BadRequestException('Endereço inválido.');
      const endereco = await this.prisma.clienteEndereco.findFirst({ where: { id: numero, clienteId: cliente.id } });
      if (!endereco) throw new BadRequestException('Endereço não pertence a este cliente.');
      enderecoFiltro = numero;
    }
    const rows = await this.prisma.ordemServico.findMany({
      where: {
        empresaCodigo: empresa,
        clienteId: cliente.id,
        ...(enderecoFiltro ? { enderecoId: enderecoFiltro } : {}),
      },
      include: { enderecoServico: true, cliente: true },
      orderBy: [{ dataAbertura: 'desc' }, { numero: 'desc' }],
    });
    return rows.map((row) => {
      const item: Record<string, unknown> = {
        numero: row.numero,
        situacao: this.situacaoExibida(row.situacao),
        dataAbertura: this.formatarData(row.dataAbertura) || '',
        dataEncerramento: this.formatarData(row.dataEncerramento),
        garantiaAte: this.formatarData(row.garantiaAte),
        enderecoId: row.enderecoId,
        endereco: this.textoEndereco(row.enderecoServico, row.cliente.endereco, row.cliente.cidade),
      };
      if (admin) {
        item.total = this.somar(
          this.num(row.taxaVistoria),
          this.num(row.maoDeObra),
          this.num(row.deslocamento),
          this.num(row.material),
        );
      }
      return item;
    });
  }

  async findFuncionarios(empresaCodigo: string) {
    const empresa = this.empresa(empresaCodigo);
    const rows = await this.prisma.crmUsuariosEmpresas.findMany({
      where: { company: { codigo: empresa }, user: { status: 'ATIVO' } },
      include: { user: { select: { id: true, nome: true, especialidade: true } } },
      orderBy: { user: { nome: 'asc' } },
    });
    return rows.map((row) => ({
      id: row.user.id,
      nome: row.user.nome,
      especialidade: row.user.especialidade,
    }));
  }

  async findAll(empresaCodigo: string, admin: boolean, filtro: FiltroOrdens) {
    const empresa = this.empresa(empresaCodigo);
    const where = this.whereOrdens(empresa, filtro);
    const rows = await this.prisma.ordemServico.findMany({
      where,
      include: INCLUDE,
      orderBy: [{ numero: 'desc' }, { id: 'desc' }],
    });
    return rows.map((row) => this.toOrdem(row, admin));
  }

  async garantiaVigente(
    empresaCodigo: string,
    filtro: {
      enderecoId?: string;
      chamadoId?: string;
      logradouro?: string;
      numero?: string;
      cidade?: string;
      excetoId?: string;
    },
  ) {
    const empresa = this.empresa(empresaCodigo);
    const enderecoId = this.inteiroFiltro(filtro.enderecoId, 'Endereço inválido.');
    const chamadoId = this.inteiroFiltro(filtro.chamadoId, 'Chamado inválido.');
    const excetoId = this.inteiroFiltro(filtro.excetoId, 'Ordem inválida.');
    const logradouro = this.limpo(filtro.logradouro) || '';
    const numero = this.limpo(filtro.numero) || '';
    const cidade = this.limpo(filtro.cidade) || '';
    if (!enderecoId && !chamadoId && !logradouro) {
      throw new BadRequestException('Informe o endereço ou o chamado.');
    }

    const enderecoIds: number[] = [];
    const textos: Array<{ logradouro: string; numero: string; cidade: string }> = [];

    if (enderecoId) {
      const endereco = await this.prisma.clienteEndereco.findFirst({
        where: { id: enderecoId, cliente: { empresaCodigo: empresa } },
      });
      if (!endereco) return [];
      enderecoIds.push(endereco.id);
      textos.push({ logradouro: endereco.logradouro, numero: '', cidade: endereco.cidade || '' });
    }

    if (chamadoId) {
      const chamado = await this.prisma.chamado.findFirst({
        where: { id: chamadoId, empresaCodigo: empresa },
      });
      if (!chamado) return [];
      textos.push({
        logradouro: chamado.logradouro,
        numero: chamado.numeroEndereco,
        cidade: chamado.cidade,
      });
      if (chamado.ordemId) {
        const vinculada = await this.prisma.ordemServico.findFirst({
          where: { id: chamado.ordemId, empresaCodigo: empresa },
          select: { enderecoId: true },
        });
        if (vinculada?.enderecoId) enderecoIds.push(vinculada.enderecoId);
      }
    }

    if (logradouro) textos.push({ logradouro, numero, cidade });

    const rows = await this.prisma.ordemServico.findMany({
      where: {
        empresaCodigo: empresa,
        situacao: OrdemSituacao.ENCERRADA,
        garantiaAte: { gte: this.inicioHoje() },
        ...(excetoId ? { id: { not: excetoId } } : {}),
      },
      include: { enderecoServico: true, cliente: true },
      orderBy: [{ garantiaAte: 'asc' }, { numero: 'asc' }],
    });

    return rows.filter((row) => this.garantiaNoEndereco(row, enderecoIds, textos)).map((row) => ({
      id: row.id,
      numero: row.numero,
      servicos: (row.servicos || row.descricaoProblema || row.vistoria || '').trim(),
      garantiaAte: this.formatarData(row.garantiaAte),
    }));
  }

  async listarPreventivas(
    empresaCodigo: string,
    admin: boolean,
    filtro: { de?: string; ate?: string; q?: string },
  ) {
    if (!admin) throw new ForbiddenException('Somente o administrador pode consultar preventivas.');
    const empresa = this.empresa(empresaCodigo);
    const limite = this.somarDiasUtc(this.inicioHoje(), 60);
    const de = this.limpo(filtro.de);
    const ate = this.limpo(filtro.ate);
    const inicio = de ? this.diaUtc(de) : undefined;
    const fimInformado = ate ? this.diaUtc(ate) : undefined;
    const fim = fimInformado && fimInformado < limite ? fimInformado : limite;
    if (inicio && inicio > fim) return [];
    const termo = this.limpo(filtro.q);
    const rows = await this.prisma.ordemServico.findMany({
      where: {
        empresaCodigo: empresa,
        situacao: OrdemSituacao.ENCERRADA,
        preventivaEm: {
          not: null,
          lte: fim,
          ...(inicio ? { gte: inicio } : {}),
        },
        ...(termo
          ? {
              OR: [
                { cliente: { nome: { contains: termo, mode: 'insensitive' as const } } },
                { cliente: { telefone: { contains: termo, mode: 'insensitive' as const } } },
                { enderecoServico: { logradouro: { contains: termo, mode: 'insensitive' as const } } },
                { cliente: { endereco: { contains: termo, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      },
      include: { cliente: true, enderecoServico: true },
      orderBy: [{ preventivaEm: 'asc' }, { numero: 'asc' }],
    });
    const abertas = rows.length
      ? await this.prisma.ordemServico.findMany({
          where: {
            empresaCodigo: empresa,
            clienteId: { in: [...new Set(rows.map((row) => row.clienteId))] },
            situacao: { in: [OrdemSituacao.ABERTA, OrdemSituacao.AGENDADA, OrdemSituacao.EM_ANDAMENTO, OrdemSituacao.EM_EXECUCAO] },
          },
          select: { id: true, clienteId: true, enderecoId: true },
          orderBy: { numero: 'desc' },
        })
      : [];
    return rows.map((row) => {
      const aberta =
        abertas.find((item) => item.clienteId === row.clienteId && item.enderecoId && item.enderecoId === row.enderecoId) ||
        abertas.find((item) => item.clienteId === row.clienteId);
      const status = this.statusPreventiva(row.preventivaStatus);
      return {
        id: row.id,
        numero: row.numero,
        clienteId: row.clienteId,
        cliente: row.cliente.nome,
        telefone: row.cliente.telefone || '',
        enderecoId: row.enderecoId,
        endereco: this.textoEndereco(row.enderecoServico, row.cliente.endereco, row.cliente.cidade),
        preventivaEm: this.formatarData(row.preventivaEm),
        status,
        ordemAbertaId: aberta?.id ?? null,
      };
    });
  }

  async listarGarantias(
    empresaCodigo: string,
    admin: boolean,
    filtro: { de?: string; ate?: string; q?: string; vencidas?: boolean },
  ) {
    if (!admin) throw new ForbiddenException('Somente o administrador pode consultar garantias.');
    const empresa = this.empresa(empresaCodigo);
    const hoje = this.inicioHoje();
    const termo = this.limpo(filtro.q);
    const de = this.limpo(filtro.de);
    const ate = this.limpo(filtro.ate);
    const inicioFiltro = de ? this.diaUtc(de) : undefined;
    const fimFiltro = ate ? this.diaUtc(ate) : undefined;
    const ha90 = this.somarDiasUtc(hoje, -90);
    const whereGarantia = filtro.vencidas
      ? { lt: hoje, gte: ha90 }
      : { gte: hoje };
    const rows = await this.prisma.ordemServico.findMany({
      where: {
        empresaCodigo: empresa,
        situacao: OrdemSituacao.ENCERRADA,
        garantiaAte: { not: null, ...whereGarantia },
        ...(inicioFiltro || fimFiltro
          ? {
              dataEncerramento: {
                ...(inicioFiltro ? { gte: inicioFiltro } : {}),
                ...(fimFiltro ? { lte: fimFiltro } : {}),
              },
            }
          : {}),
        ...(termo
          ? {
              OR: [
                { cliente: { nome: { contains: termo, mode: 'insensitive' as const } } },
                { enderecoServico: { logradouro: { contains: termo, mode: 'insensitive' as const } } },
                { cliente: { endereco: { contains: termo, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      },
      include: { cliente: true, enderecoServico: true },
      orderBy: [{ garantiaAte: 'asc' }, { numero: 'asc' }],
    });
    const abertas = rows.length
      ? await this.prisma.ordemServico.findMany({
          where: {
            empresaCodigo: empresa,
            clienteId: { in: [...new Set(rows.map((row) => row.clienteId))] },
            situacao: { in: [OrdemSituacao.ABERTA, OrdemSituacao.AGENDADA, OrdemSituacao.EM_ANDAMENTO, OrdemSituacao.EM_EXECUCAO] },
          },
          select: { id: true, clienteId: true, enderecoId: true },
          orderBy: { numero: 'desc' },
        })
      : [];
    return rows.map((row) => {
      const aberta =
        abertas.find((item) => item.clienteId === row.clienteId && item.enderecoId && item.enderecoId === row.enderecoId) ||
        abertas.find((item) => item.clienteId === row.clienteId);
      const garantiaAte = row.garantiaAte
        ? new Date(Date.UTC(row.garantiaAte.getUTCFullYear(), row.garantiaAte.getUTCMonth(), row.garantiaAte.getUTCDate()))
        : hoje;
      const diasRestantes = Math.round((garantiaAte.getTime() - hoje.getTime()) / 86400000);
      return {
        id: row.id,
        numero: row.numero,
        clienteId: row.clienteId,
        cliente: row.cliente.nome,
        telefone: row.cliente.telefone || '',
        enderecoId: row.enderecoId,
        endereco: this.textoEndereco(row.enderecoServico, row.cliente.endereco, row.cliente.cidade),
        servicos: row.servicos || '',
        dataEncerramento: this.formatarData(row.dataEncerramento),
        garantiaAte: this.formatarData(row.garantiaAte),
        diasRestantes,
        ordemAbertaId: aberta?.id ?? null,
      };
    });
  }

  async atualizarPreventivaStatus(empresaCodigo: string, id: number, status: string, admin: boolean) {
    if (!admin) throw new ForbiddenException('Somente o administrador pode alterar preventivas.');
    if (!this.statusPreventivaValido(status)) throw new BadRequestException('Status de preventiva inválido.');
    const empresa = this.empresa(empresaCodigo);
    const atual = await this.prisma.ordemServico.findFirst({
      where: { id, empresaCodigo: empresa },
      select: { id: true },
    });
    if (!atual) throw new NotFoundException('Ordem não encontrada.');
    await this.prisma.ordemServico.update({
      where: { id: atual.id },
      data: { preventivaStatus: status },
    });
    return { id: atual.id, status };
  }

  async findOne(empresaCodigo: string, id: number, admin: boolean) {
    const row = await this.carregar(empresaCodigo, id);
    return this.toOrdem(row, admin);
  }

  async create(empresaCodigo: string, dto: CreateOrdemDto, admin: boolean) {
    const empresa = this.empresa(empresaCodigo);
    const criada = await this.prisma.$transaction(async (tx) => {
      await this.exigirCliente(tx, empresa, dto.clienteId);
      if (dto.enderecoId) await this.exigirEndereco(tx, dto.clienteId, dto.enderecoId);
      if (dto.funcionarioId) await this.exigirFuncionario(tx, empresa, dto.funcionarioId);
      const pecas = dto.pecas ?? [];
      const materiais = this.validarMateriais(dto.materiaisLoja ?? []);
      await this.garantirPecas(tx, empresa, pecas);
      const numero = await this.proximoNumero(tx, empresa);
      const ordem = await tx.ordemServico.create({
        data: {
          empresaCodigo: empresa,
          numero,
          clienteId: dto.clienteId,
          enderecoId: dto.enderecoId ?? null,
          funcionarioId: dto.funcionarioId ?? null,
          tipo: dto.tipo as OrdemTipo,
          origem: dto.origem as OrdemOrigem,
          descricaoProblema: this.texto(dto.descricaoProblema),
          situacao: this.situacaoGravada(dto.situacao),
          vistoria: this.texto(dto.vistoria),
          servicos: this.texto(dto.servicos),
          taxaVistoria: this.dinheiro(admin ? (dto.taxaVistoria ?? 0) : 0),
          maoDeObra: this.dinheiro(admin ? (dto.maoDeObra ?? 0) : 0),
          deslocamento: this.dinheiro(admin ? (dto.deslocamento ?? 0) : 0),
          material: this.dinheiro(admin ? (dto.material ?? 0) : 0),
          dataAbertura: this.data(dto.dataAbertura),
          assinatura: this.texto(dto.assinatura),
        },
      });
      if (pecas.length > 0) await this.gravarPecas(tx, ordem.id, pecas);
      if (materiais.length > 0) await this.gravarMateriais(tx, ordem.id, materiais);
      const completa = await tx.ordemServico.findFirst({ where: { id: ordem.id }, include: INCLUDE });
      if (!completa) throw new NotFoundException('Ordem não encontrada.');
      return completa;
    });
    return this.toOrdem(criada, admin);
  }

  async update(empresaCodigo: string, id: number, dto: UpdateOrdemDto, admin: boolean) {
    const empresa = this.empresa(empresaCodigo);
    const atual = await this.carregar(empresa, id);

    if (atual.situacao === OrdemSituacao.CANCELADA) {
      throw new BadRequestException('Ordem cancelada não pode ser alterada.');
    }
    if (atual.situacao === OrdemSituacao.ENCERRADA || atual.situacao === OrdemSituacao.CONCLUIDA) {
      if (!this.soAssinatura(dto)) {
        throw new BadRequestException('Ordem concluída ou encerrada só aceita a assinatura.');
      }
      const atualizada = await this.prisma.ordemServico.update({
        where: { id: atual.id },
        data: { assinatura: this.texto(dto.assinatura) },
        include: INCLUDE,
      });
      return this.toOrdem(atualizada, admin);
    }

    const atualizada = await this.prisma.$transaction(async (tx) => {
      const clienteId = dto.clienteId ?? atual.clienteId;
      if (dto.clienteId) await this.exigirCliente(tx, empresa, dto.clienteId);
      const enderecoId = dto.enderecoId === undefined ? atual.enderecoId : dto.enderecoId;
      if (enderecoId) await this.exigirEndereco(tx, clienteId, enderecoId);
      const funcionarioId = dto.funcionarioId === undefined ? atual.funcionarioId : dto.funcionarioId;
      if (funcionarioId) await this.exigirFuncionario(tx, empresa, funcionarioId);
      if (dto.pecas) {
        await this.garantirPecas(tx, empresa, dto.pecas);
        await tx.ordemPeca.deleteMany({ where: { ordemId: atual.id } });
        if (dto.pecas.length > 0) await this.gravarPecas(tx, atual.id, dto.pecas);
      }
      if (dto.materiaisLoja) {
        const materiais = this.validarMateriais(dto.materiaisLoja);
        await tx.ordemMaterialLoja.deleteMany({ where: { ordemId: atual.id } });
        if (materiais.length > 0) await this.gravarMateriais(tx, atual.id, materiais);
      }
      return tx.ordemServico.update({
        where: { id: atual.id },
        data: {
          clienteId,
          enderecoId,
          funcionarioId,
          tipo: dto.tipo ? (dto.tipo as OrdemTipo) : atual.tipo,
          origem: dto.origem ? (dto.origem as OrdemOrigem) : atual.origem,
          descricaoProblema: dto.descricaoProblema !== undefined ? this.texto(dto.descricaoProblema) : atual.descricaoProblema,
          situacao: dto.situacao ? this.situacaoGravada(dto.situacao) : atual.situacao,
          vistoria: dto.vistoria !== undefined ? this.texto(dto.vistoria) : atual.vistoria,
          servicos: dto.servicos !== undefined ? this.texto(dto.servicos) : atual.servicos,
          taxaVistoria: admin && dto.taxaVistoria !== undefined ? this.dinheiro(dto.taxaVistoria) : atual.taxaVistoria,
          maoDeObra: admin && dto.maoDeObra !== undefined ? this.dinheiro(dto.maoDeObra) : atual.maoDeObra,
          deslocamento: admin && dto.deslocamento !== undefined ? this.dinheiro(dto.deslocamento) : atual.deslocamento,
          material: admin && dto.material !== undefined ? this.dinheiro(dto.material) : atual.material,
          dataAbertura: dto.dataAbertura ? this.data(dto.dataAbertura) : atual.dataAbertura,
          assinatura: dto.assinatura !== undefined ? this.texto(dto.assinatura) : atual.assinatura,
        },
        include: INCLUDE,
      });
    });
    return this.toOrdem(atualizada, admin);
  }

  async removeMany(empresaCodigo: string, ids: number[]) {
    const empresa = this.empresa(empresaCodigo);
    const unicos = this.ids(ids, 'Selecione ao menos uma ordem.');
    try {
      const count = await this.prisma.$transaction(async (tx) => {
        const rows = await tx.ordemServico.findMany({
          where: { empresaCodigo: empresa, id: { in: unicos } },
        });
        const protegidas = rows.filter(
          (row) => row.situacao === OrdemSituacao.ENCERRADA || row.situacao === OrdemSituacao.CANCELADA,
        );
        if (protegidas.length > 0) {
          const lista = protegidas.map((row) => String(row.numero).padStart(4, '0')).join(', ');
          throw new BadRequestException(`Ordem encerrada ou cancelada não pode ser excluída: ${lista}.`);
        }
        const result = await tx.ordemServico.deleteMany({
          where: { empresaCodigo: empresa, id: { in: rows.map((row) => row.id) } },
        });
        return result.count;
      });
      return { count };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('Ordem com saída de estoque não pode ser excluída.');
      }
      throw error;
    }
  }

  async concluir(empresaCodigo: string, id: number, admin: boolean) {
    const empresa = this.empresa(empresaCodigo);
    const ordem = await this.carregar(empresa, id);
    if (ordem.situacao !== OrdemSituacao.EM_ANDAMENTO && ordem.situacao !== OrdemSituacao.EM_EXECUCAO) {
      throw new BadRequestException('Só é possível concluir uma ordem em andamento.');
    }
    if (!ordem.vistoria?.trim() || !ordem.servicos?.trim()) {
      throw new BadRequestException('Preencha a vistoria e os serviços antes de concluir.');
    }
    const atualizada = await this.prisma.ordemServico.update({
      where: { id: ordem.id },
      data: { situacao: OrdemSituacao.CONCLUIDA },
      include: INCLUDE,
    });
    return this.toOrdem(atualizada, admin);
  }

  async cancelar(empresaCodigo: string, id: number, dto: CancelarOrdemDto, admin: boolean) {
    const empresa = this.empresa(empresaCodigo);
    const motivo = dto.motivo.trim();
    if (motivo.length < 3) throw new BadRequestException('Informe o motivo do cancelamento.');
    const atualizada = await this.prisma.$transaction(async (tx) => {
      const ordem = await tx.ordemServico.findFirst({ where: { id, empresaCodigo: empresa } });
      if (!ordem) throw new NotFoundException('Ordem não encontrada.');
      if (ordem.situacao === OrdemSituacao.ENCERRADA) {
        throw new BadRequestException('Ordem encerrada não pode ser cancelada.');
      }
      if (ordem.situacao === OrdemSituacao.CANCELADA) {
        throw new BadRequestException('Ordem já cancelada.');
      }
      return tx.ordemServico.update({
        where: { id: ordem.id },
        data: { situacao: OrdemSituacao.CANCELADA, motivoCancelamento: motivo },
        include: INCLUDE,
      });
    });
    return this.toOrdem(atualizada, admin);
  }

  async adicionarFoto(empresaCodigo: string, id: number, dto: CreateFotoDto, admin: boolean) {
    const empresa = this.empresa(empresaCodigo);
    const url = dto.url.trim();
    if (!url) throw new BadRequestException('Informe a foto.');
    const ordem = await this.prisma.ordemServico.findFirst({ where: { id, empresaCodigo: empresa } });
    if (!ordem) throw new NotFoundException('Ordem não encontrada.');
    await this.prisma.ordemFoto.create({
      data: {
        ordemId: ordem.id,
        momento: dto.momento as OrdemFotoMomento,
        url,
      },
    });
    return this.findOne(empresa, ordem.id, admin);
  }

  async encerrar(empresaCodigo: string, id: number, dto: EncerrarOrdemDto, admin: boolean) {
    if (!admin) throw new ForbiddenException('Somente o administrador pode encerrar a ordem.');
    const empresa = this.empresa(empresaCodigo);
    const resultado = await this.prisma.$transaction(
      async (tx) => {
        const bloqueio = await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM "ordens_servico"
          WHERE id = ${id} AND "empresaCodigo" = ${empresa}
          FOR UPDATE
        `;
        if (bloqueio.length === 0) throw new NotFoundException('Ordem não encontrada.');

        const ordem = await tx.ordemServico.findFirst({
          where: { id, empresaCodigo: empresa },
          include: INCLUDE,
        });
        if (!ordem) throw new NotFoundException('Ordem não encontrada.');
        if (ordem.situacao === OrdemSituacao.ENCERRADA) {
          throw new BadRequestException('Ordem encerrada não pode ser encerrada de novo.');
        }
        if (ordem.situacao !== OrdemSituacao.CONCLUIDA) {
          throw new BadRequestException('A ordem precisa estar concluída para ser encerrada.');
        }
        if (!ordem.vistoria?.trim() || !ordem.servicos?.trim()) {
          throw new BadRequestException('Preencha a vistoria e os serviços antes de encerrar.');
        }

        const valor = this.somar(
          this.num(ordem.taxaVistoria),
          this.num(ordem.maoDeObra),
          this.num(ordem.deslocamento),
          this.num(ordem.material),
        );
        if (valor < 0) throw new BadRequestException('O total da ordem ficou negativo.');

        const totalCentavos = this.centavos(valor);
        const entradaCentavos = this.centavos(dto.entradaValor ?? 0);
        if (entradaCentavos < 0) {
          throw new BadRequestException('A entrada não pode ser negativa.');
        }
        if (entradaCentavos > totalCentavos) {
          throw new BadRequestException('A entrada não pode ser maior que o total da ordem.');
        }
        const saldoCentavos = totalCentavos - entradaCentavos;
        const parcelas = dto.parcelas;
        const valoresParcelas = saldoCentavos >= 1 ? this.parcelasDe(saldoCentavos / 100, parcelas) : [];
        if (valoresParcelas.some((parcela) => parcela < 0.01)) {
          throw new BadRequestException('O valor da ordem não cobre o número de parcelas.');
        }
        const registraEntrada = entradaCentavos >= 1;
        const parcelaEntrada: string | null = saldoCentavos >= 1 ? 'ENTRADA' : null;

        const hoje = this.hoje();
        const garantiaDias = dto.garantiaDias ?? 90;
        const preventivaMeses = dto.preventivaMeses ?? 6;
        const garantiaAte = this.adicionarDias(hoje, garantiaDias);
        const preventivaEm = this.adicionarMeses(hoje, preventivaMeses);
        const documento = `OS-${String(ordem.numero).padStart(4, '0')}`;
        const pessoa = ordem.cliente.nome.trim();
        const vencimentoBase = this.data(dto.dataVencimento);
        const quinto = dto.usarQuintoDiaUtil !== false;
        const titulosPrevistos = (registraEntrada ? 1 : 0) + valoresParcelas.length;
        const marcadores: Array<string | null> = [];
        if (registraEntrada) marcadores.push(parcelaEntrada);
        for (let indice = 0; indice < valoresParcelas.length; indice += 1) {
          marcadores.push(valoresParcelas.length > 1 ? `${indice + 1}/${valoresParcelas.length}` : null);
        }
        for (const parcela of marcadores) {
          const existente = await tx.financeiroTitulo.findFirst({
            where: {
              empresaCodigo: empresa,
              tipo: FinanceiroTipo.RECEBER,
              pessoa: { equals: pessoa, mode: 'insensitive' },
              numeroDocumento: documento,
              parcela,
            },
          });
          if (existente) {
            throw new BadRequestException('Já existe um título com este documento para a mesma pessoa.');
          }
        }

        const pecas = [...ordem.pecas].sort((a, b) => a.id - b.id);
        let custoCentavos = 0;
        for (const peca of pecas) {
          const custo = await this.estoque.registrarSaida(tx, empresa, {
            produtoId: peca.produtoId,
            quantidade: this.qtd(peca.quantidade),
            data: hoje,
            motivo: 'Uso em serviço',
            documento,
            ordemId: ordem.id,
          });
          await tx.ordemPeca.update({
            where: { id: peca.id },
            data: { custoUnitario: this.dinheiro(custo) },
          });
          custoCentavos += Math.round(this.qtd(peca.quantidade) * this.centavos(custo));
        }
        const margem = (totalCentavos - custoCentavos) / 100;

        if (registraEntrada) {
          await tx.financeiroTitulo.create({
            data: {
              empresaCodigo: empresa,
              tipo: FinanceiroTipo.RECEBER,
              pessoa,
              numeroDocumento: documento,
              tipoDocumento: 'Recibo',
              planoContas: 'Serviço de encanamento',
              formaPagamento: dto.formaPagamento.trim(),
              valor: this.dinheiro(entradaCentavos / 100),
              dataEmissao: hoje,
              dataCompetencia: hoje,
              dataVencimento: hoje,
              parcela: parcelaEntrada,
              desconto: this.dinheiro(0),
              juros: this.dinheiro(0),
              multa: this.dinheiro(0),
              valorBaixado: this.dinheiro(entradaCentavos / 100),
              dataBaixa: hoje,
              observacao: `Entrada recebida no encerramento da ordem ${ordem.numero}.`,
              status: FinanceiroStatus.PAGO,
            },
          });
        }

        for (let indice = 0; indice < valoresParcelas.length; indice += 1) {
          const vencimento = this.vencimentoParcela(vencimentoBase, indice, quinto);
          await tx.financeiroTitulo.create({
            data: {
              empresaCodigo: empresa,
              tipo: FinanceiroTipo.RECEBER,
              pessoa,
              numeroDocumento: documento,
              tipoDocumento: 'Recibo',
              planoContas: 'Serviço de encanamento',
              formaPagamento: dto.formaPagamento.trim(),
              valor: this.dinheiro(valoresParcelas[indice]),
              dataEmissao: hoje,
              dataCompetencia: vencimento,
              dataVencimento: vencimento,
              parcela: valoresParcelas.length > 1 ? `${indice + 1}/${valoresParcelas.length}` : null,
              desconto: this.dinheiro(0),
              juros: this.dinheiro(0),
              multa: this.dinheiro(0),
              valorBaixado: this.dinheiro(0),
              observacao: `Gerado no encerramento da ordem ${ordem.numero}.`,
              status: FinanceiroStatus.ABERTO,
            },
          });
        }

        const atualizada = await tx.ordemServico.update({
          where: { id: ordem.id },
          data: {
            situacao: OrdemSituacao.ENCERRADA,
            dataEncerramento: hoje,
            garantiaAte,
            garantiaDias,
            preventivaEm,
            entradaValor: dto.entradaValor !== undefined ? this.dinheiro(dto.entradaValor) : null,
            margem: this.dinheiro(margem),
          },
          include: INCLUDE,
        });
        return { ordem: atualizada, titulos: titulosPrevistos };
      },
      { timeout: 20000 },
    );

    return { ...this.toOrdem(resultado.ordem, true), titulos: resultado.titulos };
  }

  private whereOrdens(empresa: string, filtro: FiltroOrdens): Prisma.OrdemServicoWhereInput {
    const where: Prisma.OrdemServicoWhereInput = { empresaCodigo: empresa };
    const situacao = this.limpo(filtro.situacao)?.toUpperCase();
    if (situacao) {
      if (!SITUACOES.includes(situacao)) throw new BadRequestException('Situação inválida.');
      if (situacao === 'EM_ANDAMENTO' || situacao === 'EM_EXECUCAO') {
        where.situacao = { in: [OrdemSituacao.EM_ANDAMENTO, OrdemSituacao.EM_EXECUCAO] };
      } else {
        where.situacao = situacao as OrdemSituacao;
      }
    }
    const tipo = this.limpo(filtro.tipo)?.toUpperCase();
    if (tipo) {
      if (!TIPOS.includes(tipo)) throw new BadRequestException('Tipo de ordem inválido.');
      where.tipo = tipo as OrdemTipo;
    }
    const clienteId = this.inteiroFiltro(filtro.clienteId, 'Cliente inválido.');
    if (clienteId) where.clienteId = clienteId;
    const funcionarioId = this.inteiroFiltro(filtro.funcionarioId, 'Funcionário inválido.');
    if (funcionarioId) where.funcionarioId = funcionarioId;
    const de = this.limpo(filtro.de);
    const ate = this.limpo(filtro.ate);
    if (de || ate) {
      const dataAbertura: Prisma.DateTimeFilter = {};
      if (de) dataAbertura.gte = this.data(de);
      if (ate) dataAbertura.lte = this.data(ate);
      where.dataAbertura = dataAbertura;
    }
    return where;
  }

  private async carregar(empresaCodigo: string, id: number) {
    const empresa = this.empresa(empresaCodigo);
    const row = await this.prisma.ordemServico.findFirst({
      where: { id, empresaCodigo: empresa },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException('Ordem não encontrada.');
    return row;
  }

  private async proximoNumero(tx: Prisma.TransactionClient, empresa: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock((hashtext(${`ordem-servico:${empresa}`}))::bigint)`;
    const agg = await tx.ordemServico.aggregate({
      where: { empresaCodigo: empresa },
      _max: { numero: true },
    });
    return (agg._max.numero ?? 0) + 1;
  }

  private async exigirCliente(tx: Prisma.TransactionClient, empresa: string, id: number) {
    const cliente = await tx.cliente.findFirst({ where: { id, empresaCodigo: empresa } });
    if (!cliente) throw new NotFoundException('Cliente não encontrado.');
    return cliente;
  }

  private async exigirEndereco(tx: Prisma.TransactionClient, clienteId: number, enderecoId: number) {
    const endereco = await tx.clienteEndereco.findFirst({ where: { id: enderecoId, clienteId } });
    if (!endereco) throw new BadRequestException('Endereço não pertence a este cliente.');
    return endereco;
  }

  private async exigirFuncionario(tx: Prisma.TransactionClient, empresa: string, funcionarioId: number) {
    const vinculo = await tx.crmUsuariosEmpresas.findFirst({
      where: {
        userId: funcionarioId,
        company: { codigo: empresa },
        user: { status: 'ATIVO' },
      },
    });
    if (!vinculo) throw new BadRequestException('O funcionário precisa ser um usuário ativo da empresa.');
  }

  private async garantirPecas(tx: Prisma.TransactionClient, empresa: string, pecas: OrdemPecaDto[]) {
    if (pecas.length === 0) return;
    const ids = [...new Set(pecas.map((peca) => peca.produtoId))];
    const produtos = await tx.produto.findMany({
      where: { empresaCodigo: empresa, id: { in: ids } },
      select: { id: true },
    });
    if (produtos.length !== ids.length) throw new NotFoundException('Peça não encontrada nesta empresa.');
  }

  private validarMateriais(materiais: MaterialLojaDto[]) {
    return materiais.map((item) => {
      const retirada = this.qtd(item.quantidadeRetirada);
      const usada = this.qtd(item.quantidadeUsada);
      const devolvida = this.qtd(item.quantidadeDevolvida);
      if (retirada <= 0) throw new BadRequestException('Informe a quantidade retirada na loja.');
      if (Math.round((usada + devolvida) * 1000) > Math.round(retirada * 1000)) {
        throw new BadRequestException('A quantidade usada mais a devolvida não pode passar da retirada.');
      }
      const descricao = item.descricao.trim();
      if (descricao.length < 2) throw new BadRequestException('Informe o material retirado na loja.');
      return { descricao, quantidadeRetirada: retirada, quantidadeUsada: usada, quantidadeDevolvida: devolvida };
    });
  }

  private async gravarMateriais(
    tx: Prisma.TransactionClient,
    ordemId: number,
    materiais: Array<{ descricao: string; quantidadeRetirada: number; quantidadeUsada: number; quantidadeDevolvida: number }>,
  ) {
    await tx.ordemMaterialLoja.createMany({
      data: materiais.map((item) => ({
        ordemId,
        descricao: item.descricao,
        quantidadeRetirada: this.quantidade(item.quantidadeRetirada),
        quantidadeUsada: this.quantidade(item.quantidadeUsada),
        quantidadeDevolvida: this.quantidade(item.quantidadeDevolvida),
      })),
    });
  }

  private async gravarPecas(tx: Prisma.TransactionClient, ordemId: number, pecas: OrdemPecaDto[]) {
    await tx.ordemPeca.createMany({
      data: pecas.map((peca) => ({
        ordemId,
        produtoId: peca.produtoId,
        quantidade: this.quantidade(peca.quantidade),
      })),
    });
  }

  private async gravarEnderecos(
    tx: Prisma.TransactionClient,
    clienteId: number,
    enderecos: EnderecoClienteDto[] | undefined,
    legado?: { endereco?: string | null; cidade?: string | null },
  ) {
    if (!enderecos) {
      if (!legado) return;
      const principal = await tx.clienteEndereco.findFirst({
        where: { clienteId, principal: true },
        orderBy: { id: 'asc' },
      });
      const logradouro = legado.endereco !== undefined ? this.texto(legado.endereco) : principal?.logradouro ?? null;
      const cidade = legado.cidade !== undefined ? this.texto(legado.cidade) : principal?.cidade ?? null;
      if (logradouro) {
        if (principal) {
          await tx.clienteEndereco.update({
            where: { id: principal.id },
            data: { logradouro, cidade },
          });
        } else {
          await tx.clienteEndereco.create({
            data: { clienteId, apelido: 'Principal', logradouro, cidade, principal: true },
          });
        }
      }
      await tx.cliente.update({
        where: { id: clienteId },
        data: { endereco: logradouro, cidade },
      });
      return;
    }

    if (enderecos.length === 0) {
      const emUso = await tx.ordemServico.count({ where: { clienteId, enderecoId: { not: null } } });
      if (emUso > 0) throw new BadRequestException('Há ordem usando um endereço deste cliente.');
      await tx.clienteEndereco.deleteMany({ where: { clienteId } });
      await tx.cliente.update({ where: { id: clienteId }, data: { endereco: null, cidade: null } });
      return;
    }

    const principalIndex = enderecos.findIndex((item) => item.principal);
    const indicePrincipal = principalIndex >= 0 ? principalIndex : 0;
    const normalizados = enderecos.map((item, indice) => ({
      id: item.id,
      apelido: this.texto(item.apelido),
      logradouro: item.logradouro.trim(),
      numero: this.texto(item.numero) || '',
      bairro: this.texto(item.bairro) || '',
      cep: this.formatarCep(item.cep),
      cidade: this.texto(item.cidade),
      uf: (this.texto(item.uf) || '').toUpperCase().slice(0, 2),
      principal: indice === indicePrincipal,
    }));
    if (normalizados.some((item) => !item.logradouro)) {
      throw new BadRequestException('Informe o logradouro do endereço.');
    }

    const existentes = await tx.clienteEndereco.findMany({ where: { clienteId } });
    const mantidos: number[] = [];
    for (const item of normalizados) {
      if (item.id) {
        const atual = existentes.find((row) => row.id === item.id);
        if (!atual) throw new BadRequestException('Endereço não pertence a este cliente.');
        await tx.clienteEndereco.update({
          where: { id: item.id },
          data: {
            apelido: item.apelido,
            logradouro: item.logradouro,
            numero: item.numero,
            bairro: item.bairro,
            cep: item.cep,
            cidade: item.cidade,
            uf: item.uf,
            principal: item.principal,
          },
        });
        mantidos.push(item.id);
      } else {
        const criado = await tx.clienteEndereco.create({
          data: {
            clienteId,
            apelido: item.apelido,
            logradouro: item.logradouro,
            numero: item.numero,
            bairro: item.bairro,
            cep: item.cep,
            cidade: item.cidade,
            uf: item.uf,
            principal: item.principal,
          },
        });
        mantidos.push(criado.id);
      }
    }
    for (const row of existentes) {
      if (mantidos.includes(row.id)) continue;
      const uso = await tx.ordemServico.count({ where: { enderecoId: row.id } });
      if (uso > 0) throw new BadRequestException('Endereço usado em ordem de serviço não pode ser removido.');
      await tx.clienteEndereco.delete({ where: { id: row.id } });
    }
    const principal = normalizados[indicePrincipal];
    await tx.cliente.update({
      where: { id: clienteId },
      data: { endereco: principal.logradouro, cidade: principal.cidade },
    });
  }

  private situacaoGravada(valor?: string) {
    if (!valor || valor === 'ABERTA') return OrdemSituacao.ABERTA;
    if (valor === 'AGENDADA') return OrdemSituacao.AGENDADA;
    if (valor === 'EM_ANDAMENTO' || valor === 'EM_EXECUCAO') return OrdemSituacao.EM_ANDAMENTO;
    throw new BadRequestException('Situação inválida para esta gravação.');
  }

  private situacaoExibida(situacao: OrdemSituacao) {
    if (situacao === OrdemSituacao.EM_EXECUCAO) return 'EM_ANDAMENTO';
    return situacao;
  }

  private soAssinatura(dto: UpdateOrdemDto) {
    const campos = Object.entries(dto).filter(([, valor]) => valor !== undefined);
    return campos.length > 0 && campos.every(([campo]) => campo === 'assinatura');
  }

  private toCliente(row: ClienteRow) {
    const principal = row.enderecos.find((endereco) => endereco.principal) || row.enderecos[0];
    return {
      id: row.id,
      nome: row.nome,
      telefone: row.telefone || '',
      endereco: principal?.logradouro || row.endereco || '',
      cidade: principal?.cidade || row.cidade || '',
      tipoPessoa: row.tipoPessoa,
      enderecos: row.enderecos.map((endereco) => ({
        id: endereco.id,
        apelido: endereco.apelido || '',
        logradouro: endereco.logradouro,
        numero: endereco.numero || '',
        bairro: endereco.bairro || '',
        cep: this.formatarCep(endereco.cep),
        cidade: endereco.cidade || '',
        uf: endereco.uf || '',
        principal: endereco.principal,
      })),
    };
  }

  private formatarCep(valor: string | null | undefined) {
    const digitos = String(valor || '').replace(/\D/g, '').slice(0, 8);
    if (!digitos) return '';
    if (digitos.length !== 8) return digitos;
    return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
  }

  private statusPreventiva(valor: string | null) {
    return this.statusPreventivaValido(valor) ? valor : 'a_contatar';
  }

  private statusPreventivaValido(valor: string | null | undefined): valor is 'a_contatar' | 'contatado' | 'agendada' {
    return valor === 'a_contatar' || valor === 'contatado' || valor === 'agendada';
  }

  private garantiaNoEndereco(
    row: {
      enderecoId: number | null;
      enderecoServico: { logradouro: string; cidade: string | null } | null;
      cliente: { endereco: string | null; cidade: string | null };
    },
    enderecoIds: number[],
    textos: Array<{ logradouro: string; numero: string; cidade: string }>,
  ) {
    if (row.enderecoId && enderecoIds.includes(row.enderecoId)) return true;
    const armazenado = this.normalizarEndereco(row.enderecoServico?.logradouro || row.cliente.endereco || '');
    const cidadeArmazenada = this.normalizarEndereco(row.enderecoServico?.cidade || row.cliente.cidade || '');
    return textos.some((texto) => {
      const rua = this.normalizarEndereco(texto.logradouro);
      const cidade = this.normalizarEndereco(texto.cidade);
      if (rua.length < 8 || armazenado.length < 8) return false;
      if (cidade && cidadeArmazenada && !cidadeArmazenada.includes(cidade) && !cidade.includes(cidadeArmazenada)) return false;
      const numero = texto.numero.replace(/\D/g, '');
      if (numero) return (armazenado.includes(rua) || rua.includes(armazenado)) && this.temNumero(armazenado, numero);
      return armazenado === rua;
    });
  }

  private normalizarEndereco(valor: string) {
    return valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private temNumero(texto: string, numero: string) {
    return texto.split(' ').includes(numero);
  }

  private inicioHoje() {
    const agora = new Date();
    return new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
  }

  private somarDiasUtc(data: Date, dias: number) {
    return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate() + dias));
  }

  private diaUtc(valor: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
    if (!match) throw new BadRequestException('Data inválida.');
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }

  private textoEndereco(
    endereco: { logradouro: string; cidade: string | null } | null | undefined,
    legado: string | null,
    cidadeLegado: string | null,
  ) {
    if (endereco) {
      return [endereco.logradouro, endereco.cidade].filter(Boolean).join(', ');
    }
    return [legado, cidadeLegado].filter(Boolean).join(', ');
  }

  private toOrdem(row: OrdemRow, admin: boolean) {
    const taxaVistoria = this.num(row.taxaVistoria);
    const maoDeObra = this.num(row.maoDeObra);
    const deslocamento = this.num(row.deslocamento);
    const material = this.num(row.material);
    const base = {
      id: row.id,
      numero: row.numero,
      clienteId: row.clienteId,
      cliente: row.cliente.nome,
      telefone: row.cliente.telefone || '',
      tipoPessoa: row.cliente.tipoPessoa,
      enderecoId: row.enderecoId,
      endereco: row.enderecoServico?.logradouro || row.cliente.endereco || '',
      cidade: row.enderecoServico?.cidade || row.cliente.cidade || '',
      funcionarioId: row.funcionarioId,
      funcionario: row.funcionario?.nome || '',
      especialidade: row.funcionario?.especialidade || null,
      tipo: row.tipo,
      origem: row.origem,
      descricaoProblema: row.descricaoProblema || '',
      situacao: this.situacaoExibida(row.situacao),
      vistoria: row.vistoria || '',
      servicos: row.servicos || '',
      dataAbertura: this.formatarData(row.dataAbertura) || '',
      dataEncerramento: this.formatarData(row.dataEncerramento),
      garantiaAte: this.formatarData(row.garantiaAte),
      garantiaDias: row.garantiaDias,
      preventivaEm: this.formatarData(row.preventivaEm),
      motivoCancelamento: row.motivoCancelamento || '',
      assinatura: row.assinatura || '',
      fotos: row.fotos.map((foto) => ({
        id: foto.id,
        momento: foto.momento,
        url: foto.url,
      })),
      materiaisLoja: row.materiaisLoja.map((item) => ({
        id: item.id,
        descricao: item.descricao,
        quantidadeRetirada: this.qtd(item.quantidadeRetirada),
        quantidadeUsada: this.qtd(item.quantidadeUsada),
        quantidadeDevolvida: this.qtd(item.quantidadeDevolvida),
      })),
      pecas: row.pecas.map((peca) => {
        const publica = {
          id: peca.id,
          produtoId: peca.produtoId,
          codigo: peca.produto.codigo,
          descricao: peca.produto.descricao,
          unidade: peca.produto.unidade,
          quantidade: this.qtd(peca.quantidade),
        };
        if (!admin) return publica;
        return {
          ...publica,
          custoUnitario: peca.custoUnitario == null ? null : this.num(peca.custoUnitario),
        };
      }),
    };
    if (!admin) return base;
    return {
      ...base,
      taxaVistoria,
      maoDeObra,
      deslocamento,
      material,
      total: this.somar(taxaVistoria, maoDeObra, deslocamento, material),
      entradaValor: row.entradaValor == null ? null : this.num(row.entradaValor),
      margem: row.margem == null ? null : this.num(row.margem),
    };
  }

  private parcelasDe(valor: number, parcelas: number) {
    const centavos = Math.round(this.num(valor) * 100);
    const base = Math.floor(centavos / parcelas);
    const resto = centavos - base * parcelas;
    return Array.from({ length: parcelas }, (_, indice) => (base + (indice === parcelas - 1 ? resto : 0)) / 100);
  }

  private somar(...valores: number[]) {
    const centavos = valores.reduce((total, valor) => total + Math.round(this.num(valor) * 100), 0);
    return centavos / 100;
  }

  private empresa(codigo: string | undefined) {
    const empresa = String(codigo || '').trim();
    if (!empresa) throw new BadRequestException('Selecione a empresa antes de usar a ordem de serviço.');
    return empresa;
  }

  private ids(ids: number[], vazio: string) {
    const unicos = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
    if (unicos.length === 0) throw new BadRequestException(vazio);
    return unicos;
  }

  private texto(valor: string | null | undefined) {
    const texto = String(valor || '').trim();
    return texto || null;
  }

  private limpo(valor: string | undefined) {
    const texto = String(valor || '').trim();
    return texto || undefined;
  }

  private inteiroFiltro(valor: string | undefined, mensagem: string) {
    const texto = this.limpo(valor);
    if (!texto) return undefined;
    const numero = Number(texto);
    if (!Number.isInteger(numero) || numero < 1) throw new BadRequestException(mensagem);
    return numero;
  }

  private dinheiro(valor: number) {
    return new Prisma.Decimal(this.num(valor).toFixed(2));
  }

  private quantidade(valor: number) {
    const quantidade = this.qtd(valor);
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      throw new BadRequestException('Informe uma quantidade maior que zero.');
    }
    return new Prisma.Decimal(quantidade.toFixed(3));
  }

  private num(valor: Prisma.Decimal | number | null | undefined) {
    return Math.round((Number(valor ?? 0) + Number.EPSILON) * 100) / 100;
  }

  private centavos(valor: number) {
    return Math.round(this.num(valor) * 100);
  }

  private qtd(valor: Prisma.Decimal | number | null | undefined) {
    return Math.round((Number(valor ?? 0) + Number.EPSILON) * 1000) / 1000;
  }

  private data(valor: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
    if (!match) throw new BadRequestException('Data inválida.');
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  }

  private adicionarMeses(data: Date, meses: number) {
    const ano = data.getUTCFullYear();
    const mes = data.getUTCMonth() + meses;
    const dia = data.getUTCDate();
    const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0, 12)).getUTCDate();
    return new Date(Date.UTC(ano, mes, Math.min(dia, ultimoDia), 12));
  }

  private adicionarDias(data: Date, dias: number) {
    return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate() + dias, 12));
  }

  private quintoDiaUtil(ano: number, mes: number) {
    let dia = 1;
    let uteis = 0;
    while (dia < 40) {
      const data = new Date(Date.UTC(ano, mes, dia, 12));
      const semana = data.getUTCDay();
      if (semana !== 0 && semana !== 6) uteis += 1;
      if (uteis === 5) return data;
      dia += 1;
    }
    throw new BadRequestException('Não foi possível calcular o quinto dia útil.');
  }

  private vencimentoParcela(base: Date, indice: number, quinto: boolean) {
    if (!quinto) return this.adicionarMeses(base, indice);
    const referencia = this.adicionarMeses(base, 1 + indice);
    return this.quintoDiaUtil(referencia.getUTCFullYear(), referencia.getUTCMonth());
  }

  private hoje() {
    const agora = new Date();
    return new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate(), 12));
  }

  private formatarData(data: Date | null) {
    if (!data) return null;
    return data.toISOString().slice(0, 10);
  }
}
