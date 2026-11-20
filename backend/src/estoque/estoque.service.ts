import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstoqueMovimentoTipo, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMovimentoDto, UpdateMovimentoDto } from './dto/movimento.dto';

type Efeito = { produtoId: number; tipo: EstoqueMovimentoTipo; quantidade: number };

@Injectable()
export class EstoqueService {
  constructor(private prisma: PrismaService) {}

  async findAll(empresaCodigo: string) {
    const empresa = this.empresa(empresaCodigo);
    const rows = await this.prisma.estoqueMovimento.findMany({
      where: { empresaCodigo: empresa },
      include: { produto: true, local: true, usuario: { select: { nome: true } } },
      orderBy: [{ data: 'desc' }, { id: 'desc' }],
    });
    return rows.map((row) => this.toResponse(row));
  }

  async create(empresaCodigo: string, dto: CreateMovimentoDto, usuarioId?: number) {
    const empresa = this.empresa(empresaCodigo);
    const efeito: Efeito = {
      produtoId: dto.produtoId,
      tipo: this.tipo(dto.tipo),
      quantidade: this.quantidade(dto.quantidade),
    };
    const criado = await this.prisma.$transaction(async (tx) => {
      await this.aplicarSaldo(tx, empresa, null, efeito);
      const local = await this.localPorCodigo(tx, empresa, dto.localCodigo || (efeito.tipo === EstoqueMovimentoTipo.ENTRADA ? 'DEPOSITO' : 'VEICULO'));
      const sinal = efeito.tipo === EstoqueMovimentoTipo.ENTRADA ? 1 : -1;
      await this.moverLocal(tx, efeito.produtoId, local.id, efeito.quantidade * sinal);
      return tx.estoqueMovimento.create({
        data: {
          empresaCodigo: empresa,
          produtoId: efeito.produtoId,
          tipo: efeito.tipo,
          quantidade: this.decimal(efeito.quantidade),
          data: this.data(dto.data),
          motivo: dto.motivo.trim(),
          documento: this.texto(dto.documento),
          observacao: this.texto(dto.observacao),
          localId: local.id,
          usuarioId: usuarioId ?? null,
        },
        include: { produto: true, local: true, usuario: { select: { nome: true } } },
      });
    });
    return this.toResponse(criado);
  }

  async update(empresaCodigo: string, id: number, dto: UpdateMovimentoDto) {
    const empresa = this.empresa(empresaCodigo);
    const atual = await this.prisma.estoqueMovimento.findFirst({
      where: { id, empresaCodigo: empresa },
      include: { produto: true },
    });
    if (!atual) throw new NotFoundException('Movimentação não encontrada.');
    if (atual.ordemId) {
      throw new BadRequestException('Saída gerada pelo encerramento da ordem não pode ser alterada por aqui.');
    }

    const anterior: Efeito = {
      produtoId: atual.produtoId,
      tipo: atual.tipo,
      quantidade: this.num(atual.quantidade),
    };
    const novo: Efeito = {
      produtoId: dto.produtoId ?? atual.produtoId,
      tipo: dto.tipo ? this.tipo(dto.tipo) : atual.tipo,
      quantidade: dto.quantidade !== undefined ? this.quantidade(dto.quantidade) : anterior.quantidade,
    };

    const atualizado = await this.prisma.$transaction(async (tx) => {
      await this.aplicarSaldo(tx, empresa, anterior, novo);
      return tx.estoqueMovimento.update({
        where: { id: atual.id },
        data: {
          produtoId: novo.produtoId,
          tipo: novo.tipo,
          quantidade: this.decimal(novo.quantidade),
          data: dto.data ? this.data(dto.data) : atual.data,
          motivo: dto.motivo?.trim() || atual.motivo,
          documento: dto.documento !== undefined ? this.texto(dto.documento) : atual.documento,
          observacao: dto.observacao !== undefined ? this.texto(dto.observacao) : atual.observacao,
        },
        include: { produto: true },
      });
    });
    return this.toResponse(atualizado);
  }

  async removeMany(empresaCodigo: string, ids: number[]) {
    const empresa = this.empresa(empresaCodigo);
    const unicos = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
    if (unicos.length === 0) throw new BadRequestException('Selecione ao menos uma movimentação.');

    const rows = await this.prisma.estoqueMovimento.findMany({
      where: { empresaCodigo: empresa, id: { in: unicos } },
    });
    if (rows.length === 0) return { count: 0 };
    if (rows.some((row) => row.ordemId)) {
      throw new BadRequestException('Saída gerada pelo encerramento da ordem não pode ser excluída por aqui.');
    }

    const ordem = [...rows].sort((a, b) => {
      if (a.tipo === b.tipo) return a.id - b.id;
      return a.tipo === EstoqueMovimentoTipo.SAIDA ? -1 : 1;
    });

    await this.prisma.$transaction(async (tx) => {
      for (const row of ordem) {
        await this.aplicarSaldo(
          tx,
          empresa,
          { produtoId: row.produtoId, tipo: row.tipo, quantidade: this.num(row.quantidade) },
          null,
        );
      }
      await tx.estoqueMovimento.deleteMany({
        where: { empresaCodigo: empresa, id: { in: rows.map((row) => row.id) } },
      });
    });
    return { count: rows.length };
  }

  async registrarSaida(
    tx: Prisma.TransactionClient,
    empresaCodigo: string,
    input: {
      produtoId: number;
      quantidade: number;
      data: Date;
      motivo: string;
      documento?: string | null;
      observacao?: string | null;
      ordemId?: number | null;
    },
  ) {
    const empresa = this.empresa(empresaCodigo);
    const quantidade = this.quantidade(input.quantidade);
    const local = await this.localPorCodigo(tx, empresa, 'VEICULO');
    await this.moverLocal(tx, input.produtoId, local.id, -quantidade);
    await this.aplicarSaldo(tx, empresa, null, {
      produtoId: input.produtoId,
      tipo: EstoqueMovimentoTipo.SAIDA,
      quantidade,
    });
    const produto = await tx.produto.findFirst({
      where: { id: input.produtoId, empresaCodigo: empresa },
      select: { custo: true },
    });
    if (!produto) throw new NotFoundException('Peça não encontrada nesta empresa.');
    await tx.estoqueMovimento.create({
      data: {
        empresaCodigo: empresa,
        produtoId: input.produtoId,
        tipo: EstoqueMovimentoTipo.SAIDA,
        quantidade: this.decimal(quantidade),
        data: input.data,
        motivo: input.motivo.trim(),
        documento: this.texto(input.documento),
        observacao: this.texto(input.observacao),
        ordemId: input.ordemId ?? null,
        localId: local.id,
      },
    });
    return Math.round((Number(produto.custo) + Number.EPSILON) * 100) / 100;
  }

  private async aplicarSaldo(
    tx: Prisma.TransactionClient,
    empresaCodigo: string,
    anterior: Efeito | null,
    novo: Efeito | null,
  ) {
    const ids = [...new Set([anterior?.produtoId, novo?.produtoId].filter((id): id is number => Boolean(id)))].sort(
      (a, b) => a - b,
    );
    for (const id of ids) {
      await tx.$queryRaw`SELECT id FROM "produtos" WHERE "empresaCodigo" = ${empresaCodigo} AND id = ${id} FOR UPDATE`;
    }
    const produtos = await tx.produto.findMany({
      where: { empresaCodigo, id: { in: ids } },
    });
    if (produtos.length !== ids.length) throw new NotFoundException('Peça não encontrada nesta empresa.');

    const saldos = new Map(produtos.map((produto) => [produto.id, this.num(produto.estoque)]));
    const nomes = new Map(produtos.map((produto) => [produto.id, `${produto.codigo} - ${produto.descricao}`]));

    if (anterior) {
      const atual = saldos.get(anterior.produtoId) ?? 0;
      saldos.set(anterior.produtoId, this.arredondar(atual + this.delta(anterior, true)));
    }
    if (novo) {
      const atual = saldos.get(novo.produtoId) ?? 0;
      saldos.set(novo.produtoId, this.arredondar(atual + this.delta(novo, false)));
    }

    for (const [produtoId, saldo] of saldos) {
      if (saldo < -0.0001) {
        throw new BadRequestException(`Saldo insuficiente para a peça ${nomes.get(produtoId)}.`);
      }
      await tx.produto.update({
        where: { id: produtoId },
        data: { estoque: this.decimal(Math.max(0, saldo)) },
      });
    }
  }

  private delta(efeito: Efeito, estorno: boolean) {
    const sinal = efeito.tipo === EstoqueMovimentoTipo.ENTRADA ? 1 : -1;
    return this.arredondar(efeito.quantidade * sinal * (estorno ? -1 : 1));
  }

  private toResponse(row: {
    id: number;
    produtoId: number;
    tipo: EstoqueMovimentoTipo;
    quantidade: Prisma.Decimal;
    data: Date;
    motivo: string;
    documento: string | null;
    observacao: string | null;
    produto: { codigo: string; descricao: string; unidade: string; estoque: Prisma.Decimal };
    local?: { nome: string } | null;
    usuario?: { nome: string } | null;
    ordemId?: number | null;
  }) {
    return {
      id: row.id,
      produtoId: row.produtoId,
      tipo: row.tipo,
      quantidade: this.num(row.quantidade),
      data: row.data.toISOString().slice(0, 10),
      motivo: row.motivo,
      documento: row.documento || '',
      observacao: row.observacao || '',
      codigo: row.produto.codigo,
      descricao: row.produto.descricao,
      unidade: row.produto.unidade,
      saldo: this.num(row.produto.estoque),
      local: 'local' in row && row.local ? row.local.nome : '',
      usuario: 'usuario' in row && row.usuario ? row.usuario.nome : '',
      ordemId: 'ordemId' in row ? row.ordemId ?? null : null,
    };
  }

  async saldos(empresaCodigo: string, localCodigo?: string) {
    const empresa = this.empresa(empresaCodigo);
    await this.prisma.$transaction((tx) => this.garantirLocais(tx, empresa));
    const locais = await this.prisma.estoqueLocal.findMany({
      where: { empresaCodigo: empresa, ...(localCodigo ? { codigo: localCodigo } : {}) },
      include: { saldos: { include: { produto: true } } },
      orderBy: { codigo: 'asc' },
    });
    return locais.map((local) => ({
      id: local.id,
      codigo: local.codigo,
      nome: local.nome,
      pecas: local.saldos.map((saldo) => ({
        produtoId: saldo.produtoId,
        codigo: saldo.produto.codigo,
        descricao: saldo.produto.descricao,
        unidade: saldo.produto.unidade,
        quantidade: this.num(saldo.quantidade),
        estoqueMinimo: this.num(saldo.produto.estoqueMinimo),
      })),
    }));
  }

  async alertas(empresaCodigo: string) {
    const empresa = this.empresa(empresaCodigo);
    const produtos = await this.prisma.produto.findMany({
      where: { empresaCodigo: empresa, ativo: true, estoqueMinimo: { gt: 0 } },
      orderBy: { descricao: 'asc' },
    });
    return produtos
      .filter((produto) => this.num(produto.estoque) < this.num(produto.estoqueMinimo))
      .map((produto) => ({
        id: produto.id,
        codigo: produto.codigo,
        descricao: produto.descricao,
        estoque: this.num(produto.estoque),
        estoqueMinimo: this.num(produto.estoqueMinimo),
      }));
  }

  async transferir(empresaCodigo: string, dto: { produtoId: number; deLocalId: number; paraLocalId: number; quantidade: number; motivo: string }, usuarioId?: number) {
    const empresa = this.empresa(empresaCodigo);
    if (dto.deLocalId === dto.paraLocalId) throw new BadRequestException('Escolha locais diferentes.');
    const quantidade = this.quantidade(dto.quantidade);
    if (!dto.motivo?.trim()) throw new BadRequestException('Informe o motivo da transferência.');
    await this.prisma.$transaction(async (tx) => {
      await this.moverLocal(tx, dto.produtoId, dto.deLocalId, -quantidade);
      await this.moverLocal(tx, dto.produtoId, dto.paraLocalId, quantidade);
      const hoje = this.data(new Date().toISOString().slice(0, 10));
      await tx.estoqueMovimento.create({
        data: {
          empresaCodigo: empresa,
          produtoId: dto.produtoId,
          tipo: EstoqueMovimentoTipo.SAIDA,
          quantidade: this.decimal(quantidade),
          data: hoje,
          motivo: dto.motivo.trim(),
          observacao: `Transferência do local ${dto.deLocalId} para ${dto.paraLocalId}`,
          localId: dto.deLocalId,
          usuarioId: usuarioId ?? null,
        },
      });
      await tx.estoqueMovimento.create({
        data: {
          empresaCodigo: empresa,
          produtoId: dto.produtoId,
          tipo: EstoqueMovimentoTipo.ENTRADA,
          quantidade: this.decimal(quantidade),
          data: hoje,
          motivo: dto.motivo.trim(),
          observacao: `Transferência do local ${dto.deLocalId} para ${dto.paraLocalId}`,
          localId: dto.paraLocalId,
          usuarioId: usuarioId ?? null,
        },
      });
    });
    return { ok: true };
  }

  async ajuste(empresaCodigo: string, dto: { produtoId: number; localId: number; quantidadeContada: number; motivo: string }, usuarioId?: number) {
    const empresa = this.empresa(empresaCodigo);
    if (!dto.motivo?.trim()) throw new BadRequestException('Informe o motivo da contagem.');
    const contada = this.arredondar(Number(dto.quantidadeContada));
    if (!Number.isFinite(contada) || contada < 0) throw new BadRequestException('Informe a quantidade contada.');
    await this.prisma.$transaction(async (tx) => {
      const saldo = await tx.estoqueSaldo.findUnique({ where: { produtoId_localId: { produtoId: dto.produtoId, localId: dto.localId } } });
      const atual = this.num(saldo?.quantidade);
      const diferenca = this.arredondar(contada - atual);
      if (Math.abs(diferenca) < 0.0001) return;
      const tipo = diferenca > 0 ? EstoqueMovimentoTipo.ENTRADA : EstoqueMovimentoTipo.SAIDA;
      await this.moverLocal(tx, dto.produtoId, dto.localId, diferenca);
      await this.aplicarSaldo(tx, empresa, null, {
        produtoId: dto.produtoId,
        tipo,
        quantidade: Math.abs(diferenca),
      });
      await tx.estoqueMovimento.create({
        data: {
          empresaCodigo: empresa,
          produtoId: dto.produtoId,
          tipo,
          quantidade: this.decimal(Math.abs(diferenca)),
          data: this.data(new Date().toISOString().slice(0, 10)),
          motivo: dto.motivo.trim(),
          observacao: `Contagem física: ${contada}`,
          localId: dto.localId,
          usuarioId: usuarioId ?? null,
        },
      });
    });
    return { ok: true };
  }

  private async garantirLocais(tx: Prisma.TransactionClient, empresa: string) {
    await this.localPorCodigo(tx, empresa, 'VEICULO');
    await this.localPorCodigo(tx, empresa, 'DEPOSITO');
  }

  private async localPorCodigo(tx: Prisma.TransactionClient, empresa: string, codigo: 'VEICULO' | 'DEPOSITO') {
    const existente = await tx.estoqueLocal.findFirst({ where: { empresaCodigo: empresa, codigo } });
    if (existente) return existente;
    return tx.estoqueLocal.create({
      data: { empresaCodigo: empresa, codigo, nome: codigo === 'VEICULO' ? 'Veículo' : 'Depósito' },
    });
  }

  private async moverLocal(tx: Prisma.TransactionClient, produtoId: number, localId: number, delta: number) {
    const produto = await tx.produto.findFirst({ where: { id: produtoId }, select: { descricao: true } });
    const saldo = await tx.estoqueSaldo.findUnique({ where: { produtoId_localId: { produtoId, localId } } });
    const proximo = this.arredondar(this.num(saldo?.quantidade) + delta);
    if (proximo < -0.0001) {
      throw new BadRequestException(`Saldo insuficiente para a peça ${produto?.descricao || produtoId}.`);
    }
    if (saldo) {
      await tx.estoqueSaldo.update({ where: { id: saldo.id }, data: { quantidade: this.decimal(Math.max(0, proximo)) } });
      return;
    }
    await tx.estoqueSaldo.create({ data: { produtoId, localId, quantidade: this.decimal(Math.max(0, proximo)) } });
  }

  private empresa(codigo: string | undefined) {
    const empresa = String(codigo || '').trim();
    if (!empresa) throw new BadRequestException('Selecione a empresa antes de movimentar o estoque.');
    return empresa;
  }

  private tipo(valor: string) {
    if (valor === 'ENTRADA') return EstoqueMovimentoTipo.ENTRADA;
    if (valor === 'SAIDA') return EstoqueMovimentoTipo.SAIDA;
    throw new BadRequestException('Tipo de movimentação inválido.');
  }

  private quantidade(valor: number) {
    const quantidade = this.arredondar(Number(valor));
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      throw new BadRequestException('Informe uma quantidade maior que zero.');
    }
    return quantidade;
  }

  private data(valor: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
    if (!match) throw new BadRequestException('Data inválida.');
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  }

  private texto(valor: string | null | undefined) {
    const texto = String(valor || '').trim();
    return texto || null;
  }

  private decimal(valor: number) {
    return new Prisma.Decimal(this.arredondar(valor).toFixed(3));
  }

  private num(valor: Prisma.Decimal | number | null | undefined) {
    return this.arredondar(Number(valor ?? 0));
  }

  private arredondar(valor: number) {
    return Math.round((Number(valor) + Number.EPSILON) * 1000) / 1000;
  }
}
