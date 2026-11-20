import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FinanceiroStatus, FinanceiroTipo, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTituloDto, UpdateTituloDto } from './dto/titulo.dto';

type StatusInformado = 'ABERTO' | 'PAGO_PARCIAL' | 'PAGO' | 'CANCELADO';

@Injectable()
export class FinanceiroService {
  constructor(private prisma: PrismaService) {}

  async findAll(empresaCodigo: string, tipo: string) {
    const empresa = this.empresa(empresaCodigo);
    const tipoTitulo = this.tipo(tipo);
    const rows = await this.prisma.financeiroTitulo.findMany({
      where: { empresaCodigo: empresa, tipo: tipoTitulo },
      orderBy: [{ dataVencimento: 'asc' }, { id: 'desc' }],
    });
    return rows.map((row) => this.toResponse(row));
  }

  async controleRecebimentos(
    empresaCodigo: string,
    filtro: { de?: string; ate?: string; situacao?: string },
  ) {
    const empresa = this.empresa(empresaCodigo);
    const hoje = this.hoje();
    const inicioMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
    const fimMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 1));
    const de = String(filtro.de || '').trim();
    const ate = String(filtro.ate || '').trim();
    const situacaoFiltro = String(filtro.situacao || '').trim().toLowerCase();

    const titulos = await this.prisma.financeiroTitulo.findMany({
      where: {
        empresaCodigo: empresa,
        tipo: FinanceiroTipo.RECEBER,
        numeroDocumento: { startsWith: 'OS-' },
        ...(de || ate
          ? {
              OR: [
                {
                  dataVencimento: {
                    ...(de ? { gte: this.dataCalendario(de, 'Data inicial') } : {}),
                    ...(ate ? { lte: this.dataCalendario(ate, 'Data final') } : {}),
                  },
                },
                {
                  dataBaixa: {
                    ...(de ? { gte: this.dataCalendario(de, 'Data inicial') } : {}),
                    ...(ate ? { lte: this.dataCalendario(ate, 'Data final') } : {}),
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ dataVencimento: 'asc' }, { id: 'asc' }],
    });

    const numeros = [
      ...new Set(
        titulos
          .map((t) => {
            const m = /^OS-(\d+)/i.exec(String(t.numeroDocumento || ''));
            return m ? Number(m[1]) : null;
          })
          .filter((n): n is number => Number.isFinite(n as number)),
      ),
    ];
    const ordens = numeros.length
      ? await this.prisma.ordemServico.findMany({
          where: { empresaCodigo: empresa, numero: { in: numeros } },
          select: {
            id: true,
            numero: true,
            taxaVistoria: true,
            maoDeObra: true,
            deslocamento: true,
            material: true,
            entradaValor: true,
            cliente: { select: { nome: true } },
          },
        })
      : [];
    const ordemPorNumero = new Map(ordens.map((o) => [o.numero, o]));

    const porOrdem = new Map<
      number,
      {
        ordemId: number
        numero: number
        cliente: string
        total: number
        entrada: number
        saldo: number
        situacao: string
        parcelas: Array<{
          parcela: string | null
          valor: number
          vencimento: string | null
          status: string
        }>
      }
    >();

    let aReceber = 0;
    let recebidoMes = 0;
    let vencido = 0;

    for (const row of titulos) {
      const m = /^OS-(\d+)/i.exec(String(row.numeroDocumento || ''));
      if (!m) continue;
      const numero = Number(m[1]);
      const ordem = ordemPorNumero.get(numero);
      if (!ordem) continue;
      const valor = this.num(row.valor);
      const baixado = this.num(row.valorBaixado);
      const saldo = this.arredondar(Math.max(0, valor - baixado));
      const aberto = row.status === FinanceiroStatus.ABERTO || row.status === FinanceiroStatus.PAGO_PARCIAL;
      const ehEntrada =
        String(row.parcela || '').toUpperCase() === 'ENTRADA' ||
        String(row.observacao || '').toLowerCase().startsWith('entrada recebida no encerramento');
      if (aberto) aReceber = this.arredondar(aReceber + saldo);
      if (row.dataBaixa && row.dataBaixa >= inicioMes && row.dataBaixa < fimMes && baixado > 0) {
        recebidoMes = this.arredondar(recebidoMes + baixado);
      }
      if (aberto && row.dataVencimento && row.dataVencimento < hoje) {
        vencido = this.arredondar(vencido + saldo);
      }

      const totalOrdem = this.arredondar(
        this.num(ordem.taxaVistoria) + this.num(ordem.maoDeObra) + this.num(ordem.deslocamento) + this.num(ordem.material),
      );
      const atual = porOrdem.get(ordem.id) || {
        ordemId: ordem.id,
        numero: ordem.numero,
        cliente: ordem.cliente.nome,
        total: totalOrdem,
        entrada: this.num(ordem.entradaValor),
        saldo: 0,
        situacao: 'quitada',
        parcelas: [],
      };
      atual.parcelas.push({
        parcela: ehEntrada ? 'ENTRADA' : row.parcela || null,
        valor,
        vencimento: this.formatarData(row.dataVencimento),
        status: String(row.status),
      });
      atual.saldo = this.arredondar(atual.saldo + saldo);
      porOrdem.set(ordem.id, atual);
    }

    const linhas = [...porOrdem.values()]
      .map((linha) => {
        const temAberto = linha.parcelas.some((p) => p.status === 'ABERTO' || p.status === 'PAGO_PARCIAL');
        const temVencida = linha.parcelas.some((p) => {
          if (p.status !== 'ABERTO' && p.status !== 'PAGO_PARCIAL') return false;
          if (!p.vencimento) return false;
          return p.vencimento < (this.formatarData(hoje) || '');
        });
        linha.situacao = !temAberto ? 'quitada' : temVencida ? 'vencida' : 'em_dia';
        return linha;
      })
      .filter((linha) => {
        if (!situacaoFiltro || situacaoFiltro === 'todas') return true;
        return linha.situacao === situacaoFiltro;
      });

    return {
      totais: { aReceber, recebidoMes, vencido },
      linhas,
    };
  }

  async create(empresaCodigo: string, dto: CreateTituloDto) {
    const empresa = this.empresa(empresaCodigo);
    const tipoTitulo = this.tipo(dto.tipo);
    const parcelas = dto.parcelas ?? 1;
    const valores = this.valores(dto);
    const vencimentoBase = this.dataObrigatoria(dto.dataVencimento, 'Data de vencimento');
    const pessoa = dto.pessoa.trim();
    const numeroDocumento = this.texto(dto.numeroDocumento);

    if (parcelas > 1 && (valores.baixado > 0 || valores.desconto > 0 || valores.juros > 0 || valores.multa > 0)) {
      throw new BadRequestException('Baixa, juros, multa e desconto são lançados em cada parcela, depois de gerar o parcelamento.');
    }

    for (let indice = 0; indice < parcelas; indice += 1) {
      const parcela = parcelas > 1 ? `${indice + 1}/${parcelas}` : null;
      await this.garantirDocumentoUnico(empresa, tipoTitulo, pessoa, numeroDocumento, parcela, null);
    }

    const centavos = Math.round(valores.valor * 100);
    const base = Math.floor(centavos / parcelas);
    const resto = centavos - base * parcelas;

    const criados = await this.prisma.$transaction(async (tx) => {
      const lista = [];
      for (let indice = 0; indice < parcelas; indice += 1) {
        const centavosParcela = base + (indice === parcelas - 1 ? resto : 0);
        const valorParcela = centavosParcela / 100;
        const vencimento = this.adicionarMeses(vencimentoBase, indice);
        const totais = this.fecharTotais({
          valor: valorParcela,
          desconto: parcelas === 1 ? valores.desconto : 0,
          juros: parcelas === 1 ? valores.juros : 0,
          multa: parcelas === 1 ? valores.multa : 0,
          baixado: parcelas === 1 ? valores.baixado : 0,
          statusInformado: parcelas === 1 ? dto.status : undefined,
        });
        lista.push(
          await tx.financeiroTitulo.create({
            data: {
              empresaCodigo: empresa,
              tipo: tipoTitulo,
              pessoa,
              numeroDocumento,
              tipoDocumento: dto.tipoDocumento.trim(),
              planoContas: dto.planoContas.trim(),
              formaPagamento: dto.formaPagamento.trim(),
              valor: this.decimal(valorParcela),
              dataEmissao: this.dataOpcional(dto.dataEmissao),
              dataCompetencia: this.dataOpcional(dto.dataCompetencia) ?? vencimento,
              dataVencimento: vencimento,
              parcela: parcelas > 1 ? `${indice + 1}/${parcelas}` : this.texto(undefined),
              contaBancaria: this.texto(dto.contaBancaria),
              desconto: this.decimal(totais.desconto),
              juros: this.decimal(totais.juros),
              multa: this.decimal(totais.multa),
              valorBaixado: this.decimal(totais.baixado),
              dataBaixa: totais.baixado > 0 ? this.dataOpcional(dto.dataBaixa) ?? this.hoje() : null,
              codigoBarras: this.texto(dto.codigoBarras),
              observacao: this.texto(dto.observacao),
              status: totais.status,
            },
          }),
        );
      }
      return lista;
    });

    return criados.map((row) => this.toResponse(row));
  }

  async update(empresaCodigo: string, id: number, dto: UpdateTituloDto) {
    const empresa = this.empresa(empresaCodigo);
    const atual = await this.prisma.financeiroTitulo.findFirst({
      where: { id, empresaCodigo: empresa },
    });
    if (!atual) throw new NotFoundException('Título não encontrado.');

    const pessoa = dto.pessoa?.trim() || atual.pessoa;
    const numeroDocumento = dto.numeroDocumento !== undefined ? this.texto(dto.numeroDocumento) : atual.numeroDocumento;
    const parcela = dto.parcela !== undefined ? this.texto(dto.parcela) : atual.parcela;
    await this.garantirDocumentoUnico(empresa, atual.tipo, pessoa, numeroDocumento, parcela, atual.id);

    const valores = this.fecharTotais({
      valor: dto.valor ?? this.num(atual.valor),
      desconto: dto.desconto ?? this.num(atual.desconto),
      juros: dto.juros ?? this.num(atual.juros),
      multa: dto.multa ?? this.num(atual.multa),
      baixado: dto.valorBaixado ?? this.num(atual.valorBaixado),
      statusInformado: dto.status,
    });

    const atualizado = await this.prisma.financeiroTitulo.update({
      where: { id: atual.id },
      data: {
        pessoa,
        numeroDocumento,
        tipoDocumento: dto.tipoDocumento?.trim() || atual.tipoDocumento,
        planoContas: dto.planoContas?.trim() || atual.planoContas,
        formaPagamento: dto.formaPagamento?.trim() || atual.formaPagamento,
        valor: this.decimal(valores.valor),
        dataEmissao: dto.dataEmissao !== undefined ? this.dataOpcional(dto.dataEmissao) : atual.dataEmissao,
        dataCompetencia:
          dto.dataCompetencia !== undefined ? this.dataOpcional(dto.dataCompetencia) : atual.dataCompetencia,
        dataVencimento: dto.dataVencimento
          ? this.dataObrigatoria(dto.dataVencimento, 'Data de vencimento')
          : atual.dataVencimento,
        parcela,
        contaBancaria: dto.contaBancaria !== undefined ? this.texto(dto.contaBancaria) : atual.contaBancaria,
        desconto: this.decimal(valores.desconto),
        juros: this.decimal(valores.juros),
        multa: this.decimal(valores.multa),
        valorBaixado: this.decimal(valores.baixado),
        dataBaixa:
          valores.baixado > 0
            ? dto.dataBaixa
              ? this.dataObrigatoria(dto.dataBaixa, 'Data da baixa')
              : atual.dataBaixa ?? this.hoje()
            : null,
        codigoBarras: dto.codigoBarras !== undefined ? this.texto(dto.codigoBarras) : atual.codigoBarras,
        observacao: dto.observacao !== undefined ? this.texto(dto.observacao) : atual.observacao,
        status: valores.status,
      },
    });

    return this.toResponse(atualizado);
  }

  async removeMany(empresaCodigo: string, ids: number[]) {
    const empresa = this.empresa(empresaCodigo);
    const unicos = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
    if (unicos.length === 0) throw new BadRequestException('Selecione ao menos um título.');

    const rows = await this.prisma.financeiroTitulo.findMany({
      where: { empresaCodigo: empresa, id: { in: unicos } },
    });
    const comBaixa = rows.filter((row) => this.num(row.valorBaixado) > 0);
    if (comBaixa.length > 0) {
      const lista = comBaixa.map((row) => `${row.pessoa}${row.numeroDocumento ? ` (${row.numeroDocumento})` : ''}`).join(', ');
      throw new BadRequestException(`Título com pagamento lançado não pode ser excluído: ${lista}. Estorne a baixa ou cancele o título.`);
    }

    const result = await this.prisma.financeiroTitulo.deleteMany({
      where: { empresaCodigo: empresa, id: { in: rows.map((row) => row.id) }, valorBaixado: 0 },
    });
    return { count: result.count };
  }

  async devedores(empresaCodigo: string) {
    const empresa = this.empresa(empresaCodigo);
    const hoje = this.hoje();
    const hojeTexto = this.formatarData(hoje) || '';
    const rows = await this.prisma.financeiroTitulo.findMany({
      where: {
        empresaCodigo: empresa,
        tipo: FinanceiroTipo.RECEBER,
        status: { in: [FinanceiroStatus.ABERTO, FinanceiroStatus.PAGO_PARCIAL] },
        dataVencimento: { lt: hoje },
      },
      orderBy: [{ pessoa: 'asc' }, { dataVencimento: 'asc' }, { id: 'asc' }],
    });

    const grupos = new Map<
      string,
      {
        nome: string;
        quantidade: number;
        saldo: number;
        parcelas: Array<{
          id: number;
          numeroDocumento: string;
          parcela: string;
          dataVencimento: string;
          valor: number;
          valorBaixado: number;
          saldo: number;
          diasAtraso: number;
        }>;
      }
    >();

    for (const row of rows) {
      const valor = this.num(row.valor);
      const valorBaixado = this.num(row.valorBaixado);
      const saldo = this.arredondar(Math.max(0, valor - valorBaixado));
      const dataVencimento = this.formatarData(row.dataVencimento) || '';
      const atual = grupos.get(row.pessoa) || { nome: row.pessoa, quantidade: 0, saldo: 0, parcelas: [] };
      atual.quantidade += 1;
      atual.saldo = this.arredondar(atual.saldo + saldo);
      atual.parcelas.push({
        id: row.id,
        numeroDocumento: row.numeroDocumento || '',
        parcela: row.parcela || '',
        dataVencimento,
        valor,
        valorBaixado,
        saldo,
        diasAtraso: this.diasAtraso(dataVencimento, hojeTexto),
      });
      grupos.set(row.pessoa, atual);
    }

    const pessoas = [...grupos.values()];
    return {
      hoje: hojeTexto,
      quantidade: pessoas.reduce((soma, pessoa) => soma + pessoa.quantidade, 0),
      saldo: this.arredondar(pessoas.reduce((soma, pessoa) => soma + pessoa.saldo, 0)),
      pessoas,
    };
  }

  async fluxoCaixa(empresaCodigo: string, deInformada: string, ateInformada: string) {
    const empresa = this.empresa(empresaCodigo);
    const de = String(deInformada || '').trim();
    const ate = String(ateInformada || '').trim();
    const inicio = this.dataCalendario(de, 'Data inicial');
    const fim = this.dataCalendario(ate, 'Data final');
    if (de > ate) throw new BadRequestException('A data inicial não pode ser maior que a data final.');

    const meses = this.mesesDoIntervalo(de, ate);
    const centavos = new Map(
      meses.map((mes) => [
        mes,
        { entradasPrevistas: 0, saidasPrevistas: 0, entradasRealizadas: 0, saidasRealizadas: 0 },
      ]),
    );

    const margemInicio = new Date(inicio.getTime() - 24 * 60 * 60 * 1000);
    const margemFim = new Date(fim.getTime() + 24 * 60 * 60 * 1000);
    const rows = await this.prisma.financeiroTitulo.findMany({
      where: {
        empresaCodigo: empresa,
        OR: [
          {
            dataVencimento: { gte: margemInicio, lte: margemFim },
            status: { in: [FinanceiroStatus.ABERTO, FinanceiroStatus.PAGO_PARCIAL] },
          },
          {
            dataBaixa: { gte: margemInicio, lte: margemFim },
            valorBaixado: { gt: 0 },
          },
        ],
      },
      select: {
        tipo: true,
        valor: true,
        desconto: true,
        juros: true,
        multa: true,
        valorBaixado: true,
        dataVencimento: true,
        dataBaixa: true,
        status: true,
      },
    });

    let titulos = 0;
    for (const row of rows) {
      let entrou = false;
      const vencimento = this.formatarData(row.dataVencimento);
      const abertoOuParcial = row.status === FinanceiroStatus.ABERTO || row.status === FinanceiroStatus.PAGO_PARCIAL;
      if (vencimento && vencimento >= de && vencimento <= ate && abertoOuParcial && row.status !== FinanceiroStatus.CANCELADO) {
        const saldo = this.saldoAberto(row);
        if (saldo > 0) {
          this.somarFluxo(centavos, vencimento.slice(0, 7), row.tipo, 'previsto', saldo);
          entrou = true;
        }
      }

      const baixa = this.formatarData(row.dataBaixa);
      const baixado = this.num(row.valorBaixado);
      if (baixa && baixa >= de && baixa <= ate && baixado > 0) {
        this.somarFluxo(centavos, baixa.slice(0, 7), row.tipo, 'realizado', baixado);
        entrou = true;
      }
      if (entrou) titulos += 1;
    }

    const lista = meses.map((mes) => this.fecharMes(mes, centavos.get(mes)!));
    const totais = lista.reduce(
      (soma, mes) => ({
        entradasPrevistas: soma.entradasPrevistas + this.centavos(mes.entradasPrevistas),
        saidasPrevistas: soma.saidasPrevistas + this.centavos(mes.saidasPrevistas),
        entradasRealizadas: soma.entradasRealizadas + this.centavos(mes.entradasRealizadas),
        saidasRealizadas: soma.saidasRealizadas + this.centavos(mes.saidasRealizadas),
      }),
      { entradasPrevistas: 0, saidasPrevistas: 0, entradasRealizadas: 0, saidasRealizadas: 0 },
    );

    return {
      de,
      ate,
      titulos,
      meses: lista,
      totais: this.fecharMes('total', totais),
    };
  }

  private saldoAberto(row: {
    valor: Prisma.Decimal;
    desconto: Prisma.Decimal;
    juros: Prisma.Decimal;
    multa: Prisma.Decimal;
    valorBaixado: Prisma.Decimal;
  }) {
    const total = this.arredondar(this.num(row.valor) + this.num(row.juros) + this.num(row.multa) - this.num(row.desconto));
    return this.arredondar(Math.max(0, total - this.num(row.valorBaixado)));
  }

  private somarFluxo(
    centavos: Map<string, { entradasPrevistas: number; saidasPrevistas: number; entradasRealizadas: number; saidasRealizadas: number }>,
    mes: string,
    tipo: FinanceiroTipo,
    coluna: 'previsto' | 'realizado',
    valor: number,
  ) {
    const balde = centavos.get(mes);
    if (!balde) return;
    const receber = tipo === FinanceiroTipo.RECEBER;
    if (coluna === 'previsto') {
      if (receber) balde.entradasPrevistas += this.centavos(valor);
      else balde.saidasPrevistas += this.centavos(valor);
      return;
    }
    if (receber) balde.entradasRealizadas += this.centavos(valor);
    else balde.saidasRealizadas += this.centavos(valor);
  }

  private fecharMes(
    mes: string,
    centavos: { entradasPrevistas: number; saidasPrevistas: number; entradasRealizadas: number; saidasRealizadas: number },
  ) {
    const entradasPrevistas = this.deCentavos(centavos.entradasPrevistas);
    const saidasPrevistas = this.deCentavos(centavos.saidasPrevistas);
    const entradasRealizadas = this.deCentavos(centavos.entradasRealizadas);
    const saidasRealizadas = this.deCentavos(centavos.saidasRealizadas);
    const fechado = {
      entradasPrevistas,
      saidasPrevistas,
      saldoPrevisto: this.arredondar(entradasPrevistas - saidasPrevistas),
      entradasRealizadas,
      saidasRealizadas,
      saldoRealizado: this.arredondar(entradasRealizadas - saidasRealizadas),
    };
    return mes === 'total' ? fechado : { mes, ...fechado };
  }

  private mesesDoIntervalo(de: string, ate: string) {
    let ano = Number(de.slice(0, 4));
    let mes = Number(de.slice(5, 7));
    const anoFim = Number(ate.slice(0, 4));
    const mesFim = Number(ate.slice(5, 7));
    const meses: string[] = [];
    while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
      meses.push(`${ano}-${String(mes).padStart(2, '0')}`);
      if (meses.length > 120) throw new BadRequestException('Informe um intervalo de até 120 meses.');
      mes += 1;
      if (mes > 12) {
        mes = 1;
        ano += 1;
      }
    }
    return meses;
  }

  private dataCalendario(valor: string, campo: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor || '').trim());
    if (!match) throw new BadRequestException(`${campo} inválida. Use AAAA-MM-DD.`);
    const ano = Number(match[1]);
    const mes = Number(match[2]);
    const dia = Number(match[3]);
    const data = new Date(Date.UTC(ano, mes - 1, dia, 12));
    if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) {
      throw new BadRequestException(`${campo} inválida. Use AAAA-MM-DD.`);
    }
    return data;
  }

  private centavos(valor: number) {
    return Math.round((Number(valor) + Number.EPSILON) * 100);
  }

  private deCentavos(centavos: number) {
    return this.arredondar(centavos / 100);
  }

  private async garantirDocumentoUnico(
    empresaCodigo: string,
    tipo: FinanceiroTipo,
    pessoa: string,
    numeroDocumento: string | null,
    parcela: string | null,
    ignorarId: number | null,
  ) {
    if (!numeroDocumento) return;
    const existente = await this.prisma.financeiroTitulo.findFirst({
      where: {
        empresaCodigo,
        tipo,
        pessoa: { equals: pessoa, mode: 'insensitive' },
        numeroDocumento,
        parcela,
        ...(ignorarId ? { id: { not: ignorarId } } : {}),
      },
    });
    if (existente) {
      throw new BadRequestException('Já existe um título com este documento para a mesma pessoa.');
    }
  }

  private valores(dto: CreateTituloDto) {
    return this.fecharTotais({
      valor: dto.valor,
      desconto: dto.desconto ?? 0,
      juros: dto.juros ?? 0,
      multa: dto.multa ?? 0,
      baixado: dto.valorBaixado ?? 0,
      statusInformado: dto.status,
    });
  }

  private fecharTotais(input: {
    valor: number;
    desconto: number;
    juros: number;
    multa: number;
    baixado: number;
    statusInformado?: StatusInformado;
  }) {
    const valor = this.arredondar(input.valor);
    const desconto = this.arredondar(input.desconto);
    const juros = this.arredondar(input.juros);
    const multa = this.arredondar(input.multa);
    const baixado = this.arredondar(input.baixado);
    const total = this.arredondar(valor + juros + multa - desconto);
    if (desconto > valor) throw new BadRequestException('O desconto não pode ser maior que o valor do título.');
    if (total < 0) throw new BadRequestException('O total do título ficou negativo.');
    if (baixado > total + 0.001) throw new BadRequestException('O valor baixado não pode ser maior que o total do título.');
    if (input.statusInformado === 'CANCELADO' && baixado > 0) {
      throw new BadRequestException('Estorne a baixa antes de cancelar o título.');
    }

    let status: FinanceiroStatus = FinanceiroStatus.ABERTO;
    if (input.statusInformado === 'CANCELADO') status = FinanceiroStatus.CANCELADO;
    else if (baixado <= 0) status = FinanceiroStatus.ABERTO;
    else if (baixado + 0.009 >= total) status = FinanceiroStatus.PAGO;
    else status = FinanceiroStatus.PAGO_PARCIAL;

    return { valor, desconto, juros, multa, baixado, total, status };
  }

  private toResponse(row: {
    id: number;
    tipo: FinanceiroTipo;
    pessoa: string;
    numeroDocumento: string | null;
    tipoDocumento: string;
    planoContas: string;
    formaPagamento: string;
    valor: Prisma.Decimal;
    dataEmissao: Date | null;
    dataCompetencia: Date | null;
    dataVencimento: Date;
    parcela: string | null;
    contaBancaria: string | null;
    desconto: Prisma.Decimal;
    juros: Prisma.Decimal;
    multa: Prisma.Decimal;
    valorBaixado: Prisma.Decimal;
    dataBaixa: Date | null;
    codigoBarras: string | null;
    observacao: string | null;
    status: FinanceiroStatus;
  }) {
    const valor = this.num(row.valor);
    const desconto = this.num(row.desconto);
    const juros = this.num(row.juros);
    const multa = this.num(row.multa);
    const valorBaixado = this.num(row.valorBaixado);
    const total = this.arredondar(valor + juros + multa - desconto);
    return {
      id: row.id,
      tipo: row.tipo,
      pessoa: row.pessoa,
      numeroDocumento: row.numeroDocumento || '',
      tipoDocumento: row.tipoDocumento,
      planoContas: row.planoContas,
      formaPagamento: row.formaPagamento,
      valor,
      dataEmissao: this.formatarData(row.dataEmissao),
      dataCompetencia: this.formatarData(row.dataCompetencia),
      dataVencimento: this.formatarData(row.dataVencimento) || '',
      parcela: row.parcela || '',
      contaBancaria: row.contaBancaria || '',
      desconto,
      juros,
      multa,
      valorBaixado,
      dataBaixa: this.formatarData(row.dataBaixa),
      codigoBarras: row.codigoBarras || '',
      observacao: row.observacao || '',
      status: row.status,
      total,
      saldo: this.arredondar(Math.max(0, total - valorBaixado)),
    };
  }

  private empresa(codigo: string | undefined) {
    const empresa = String(codigo || '').trim();
    if (!empresa) throw new BadRequestException('Selecione a empresa antes de usar o financeiro.');
    return empresa;
  }

  private tipo(valor: string) {
    if (valor === 'PAGAR') return FinanceiroTipo.PAGAR;
    if (valor === 'RECEBER') return FinanceiroTipo.RECEBER;
    throw new BadRequestException('Tipo de título inválido.');
  }

  private texto(valor: string | null | undefined) {
    const texto = String(valor || '').trim();
    return texto || null;
  }

  private decimal(valor: number) {
    return new Prisma.Decimal(this.arredondar(valor).toFixed(2));
  }

  private num(valor: Prisma.Decimal | number | null | undefined) {
    return this.arredondar(Number(valor ?? 0));
  }

  private arredondar(valor: number) {
    return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
  }

  private dataObrigatoria(valor: string, campo: string) {
    const data = this.dataOpcional(valor);
    if (!data) throw new BadRequestException(`${campo} é obrigatória.`);
    return data;
  }

  private dataOpcional(valor?: string | null) {
    if (!valor) return null;
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

  private diasAtraso(vencimento: string, hoje: string) {
    const inicio = Date.parse(`${vencimento}T00:00:00Z`);
    const fim = Date.parse(`${hoje}T00:00:00Z`);
    if (!Number.isFinite(inicio) || !Number.isFinite(fim)) return 0;
    return Math.max(0, Math.round((fim - inicio) / 86400000));
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
