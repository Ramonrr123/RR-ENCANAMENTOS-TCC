import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type AgendamentoDto = { ordemId: number; funcionarioId: number; inicio: string; fim: string };

@Injectable()
export class AgendaService {
  constructor(private prisma: PrismaService) {}

  async listar(empresaCodigo: string, de: string, ate: string, funcionarioId: number | undefined, admin: boolean, usuarioId?: number) {
    const empresa = this.empresa(empresaCodigo);
    const proprio = admin ? funcionarioId : usuarioId;
    if (!admin && !proprio) throw new ForbiddenException('Não foi possível identificar o funcionário.');
    const rows = await this.prisma.ordemAgendamento.findMany({
      where: {
        empresaCodigo: empresa,
        ...(proprio ? { funcionarioId: proprio } : {}),
        inicio: { lt: this.data(ate) },
        fim: { gt: this.data(de) },
      },
      include: { ordem: { include: { cliente: true } }, funcionario: { select: { id: true, nome: true } } },
      orderBy: { inicio: 'asc' },
    });
    return rows.map((row) => this.toItem(row));
  }

  async criar(empresaCodigo: string, dto: AgendamentoDto) {
    const empresa = this.empresa(empresaCodigo);
    const inicio = this.data(dto.inicio);
    const fim = this.data(dto.fim);
    this.validarIntervalo(inicio, fim);
    await this.exigirOrdem(empresa, dto.ordemId);
    await this.exigirLivre(empresa, dto.funcionarioId, inicio, fim, null);
    const criado = await this.prisma.ordemAgendamento.create({
      data: { empresaCodigo: empresa, ordemId: dto.ordemId, funcionarioId: dto.funcionarioId, inicio, fim },
      include: { ordem: { include: { cliente: true } }, funcionario: { select: { id: true, nome: true } } },
    });
    return this.toItem(criado);
  }

  async atualizar(empresaCodigo: string, id: number, dto: AgendamentoDto) {
    const empresa = this.empresa(empresaCodigo);
    const atual = await this.prisma.ordemAgendamento.findFirst({ where: { id, empresaCodigo: empresa } });
    if (!atual) throw new NotFoundException('Agendamento não encontrado.');
    const inicio = this.data(dto.inicio);
    const fim = this.data(dto.fim);
    this.validarIntervalo(inicio, fim);
    await this.exigirLivre(empresa, dto.funcionarioId, inicio, fim, atual.id);
    const salvo = await this.prisma.ordemAgendamento.update({
      where: { id: atual.id },
      data: { funcionarioId: dto.funcionarioId, inicio, fim },
      include: { ordem: { include: { cliente: true } }, funcionario: { select: { id: true, nome: true } } },
    });
    return this.toItem(salvo);
  }

  async remover(empresaCodigo: string, id: number) {
    const empresa = this.empresa(empresaCodigo);
    const atual = await this.prisma.ordemAgendamento.findFirst({ where: { id, empresaCodigo: empresa } });
    if (!atual) throw new NotFoundException('Agendamento não encontrado.');
    await this.prisma.ordemAgendamento.delete({ where: { id: atual.id } });
    return { ok: true };
  }

  async painel(empresaCodigo: string, admin = true, usuarioId?: number) {
    const empresa = this.empresa(empresaCodigo);
    const hoje = new Date();
    const inicio = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0));
    const fim = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1, 0));
    const daqui7 = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 7, 12));
    const daqui30 = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 30, 12));
    const daqui60 = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 60, 12));
    const filtroFuncionario = admin ? {} : { funcionarioId: usuarioId ?? 0 };
    const [
      hojeCount,
      abertas,
      agendadas,
      emAndamento,
      conferir,
      atrasadas,
      aVencer,
      produtosMinimo,
      preventivas,
      preventivasVencer,
      preventivasVencidas,
      garantiasVigentes,
      chamadosNovos,
    ] = await Promise.all([
      this.prisma.ordemAgendamento.count({
        where: { empresaCodigo: empresa, inicio: { gte: inicio, lt: fim }, ...filtroFuncionario },
      }),
      this.prisma.ordemServico.count({
        where: {
          empresaCodigo: empresa,
          situacao: admin ? 'ABERTA' : { in: ['ABERTA', 'EM_ANDAMENTO', 'EM_EXECUCAO'] },
          ...filtroFuncionario,
        },
      }),
      this.prisma.ordemServico.count({ where: { empresaCodigo: empresa, situacao: 'AGENDADA', ...filtroFuncionario } }),
      this.prisma.ordemServico.count({
        where: { empresaCodigo: empresa, situacao: { in: ['EM_ANDAMENTO', 'EM_EXECUCAO'] }, ...filtroFuncionario },
      }),
      this.prisma.ordemServico.count({ where: { empresaCodigo: empresa, situacao: 'CONCLUIDA', ...filtroFuncionario } }),
      this.prisma.financeiroTitulo.count({
        where: {
          empresaCodigo: empresa,
          tipo: 'RECEBER',
          status: { in: ['ABERTO', 'PAGO_PARCIAL'] },
          dataVencimento: { lt: inicio },
        },
      }),
      this.prisma.financeiroTitulo.count({
        where: { empresaCodigo: empresa, tipo: 'RECEBER', status: 'ABERTO', dataVencimento: { gte: inicio, lte: daqui7 } },
      }),
      this.prisma.produto.findMany({
        where: { empresaCodigo: empresa, ativo: true, estoqueMinimo: { gt: 0 } },
        select: { estoque: true, estoqueMinimo: true },
      }),
      this.prisma.ordemServico.count({
        where: { empresaCodigo: empresa, situacao: 'ENCERRADA', preventivaEm: { gte: inicio, lte: daqui30 } },
      }),
      this.prisma.ordemServico.count({
        where: { empresaCodigo: empresa, situacao: 'ENCERRADA', preventivaEm: { gte: inicio, lte: daqui60 } },
      }),
      this.prisma.ordemServico.count({
        where: { empresaCodigo: empresa, situacao: 'ENCERRADA', preventivaEm: { lt: inicio } },
      }),
      this.prisma.ordemServico.count({
        where: { empresaCodigo: empresa, situacao: 'ENCERRADA', garantiaAte: { gte: inicio } },
      }),
      this.prisma.chamado.count({
        where: { empresaCodigo: empresa, ordemId: null, status: { in: ['ABERTO', 'EM_ATENDIMENTO'] } },
      }),
    ]);
    const estoqueBaixo = produtosMinimo.filter((item) => Number(item.estoque) < Number(item.estoqueMinimo)).length;
    return {
      agendamentosHoje: hojeCount,
      ordensAbertas: abertas,
      ordensAgendadas: agendadas,
      ordensEmAndamento: emAndamento,
      aguardandoConferencia: conferir,
      estoqueBaixo,
      parcelasAtrasadas: admin ? atrasadas : 0,
      parcelasSeteDias: admin ? aVencer : 0,
      preventivas,
      preventivasAVencer: admin ? preventivasVencer : 0,
      preventivasVencidas: admin ? preventivasVencidas : 0,
      garantiasVigentes: admin ? garantiasVigentes : 0,
      chamadosNovos: admin ? chamadosNovos : 0,
      financeiro: admin,
    };
  }

  private async exigirLivre(empresa: string, funcionarioId: number, inicio: Date, fim: Date, ignorarId: number | null) {
    const choque = await this.prisma.ordemAgendamento.findFirst({
      where: {
        empresaCodigo: empresa,
        funcionarioId,
        ...(ignorarId ? { id: { not: ignorarId } } : {}),
        inicio: { lt: fim },
        fim: { gt: inicio },
      },
    });
    if (choque) throw new BadRequestException('Esse funcionário já tem um atendimento nesse horário.');
  }

  private async exigirOrdem(empresa: string, ordemId: number) {
    const ordem = await this.prisma.ordemServico.findFirst({ where: { id: ordemId, empresaCodigo: empresa } });
    if (!ordem) throw new NotFoundException('Ordem não encontrada nesta empresa.');
  }

  private validarIntervalo(inicio: Date, fim: Date) {
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || fim.getTime() - inicio.getTime() < 15 * 60 * 1000) {
      throw new BadRequestException('O atendimento precisa durar pelo menos 15 minutos.');
    }
  }

  private data(valor: string) {
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) throw new BadRequestException('Data ou hora inválida.');
    return data;
  }

  private empresa(codigo: string | undefined) {
    const empresa = String(codigo || '').trim();
    if (!empresa) throw new BadRequestException('Selecione a empresa antes de usar a agenda.');
    return empresa;
  }

  private toItem(row: {
    id: number;
    ordemId: number;
    funcionarioId: number;
    inicio: Date;
    fim: Date;
    ordem: { numero: number; cliente: { nome: string } };
    funcionario: { id: number; nome: string };
  }) {
    return {
      id: row.id,
      ordemId: row.ordemId,
      numero: row.ordem.numero,
      cliente: row.ordem.cliente.nome,
      funcionarioId: row.funcionarioId,
      funcionario: row.funcionario.nome,
      inicio: row.inicio.toISOString(),
      fim: row.fim.toISOString(),
    };
  }
}
