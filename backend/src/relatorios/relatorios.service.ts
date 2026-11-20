import { BadRequestException, Injectable, StreamableFile } from '@nestjs/common';
import { OrdemSituacao, Prisma } from '@prisma/client';
import { FinanceiroService } from '../financeiro/financeiro.service';
import { PrismaService } from '../prisma/prisma.service';

const SITUACOES = new Set<string>(Object.values(OrdemSituacao));

type LinhaOrdem = {
  numero: number;
  cliente: string;
  situacao: string;
  dataAbertura: string;
  dataEncerramento: string | null;
  garantiaAte: string | null;
  total: number;
  entrada: number;
  saldoParcelado: number;
  taxa: number;
  maoDeObra: number;
  deslocamento: number;
  material: number;
};

@Injectable()
export class RelatoriosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeiro: FinanceiroService,
  ) {}

  async ordens(empresaCodigo: string, query: { de?: string; ate?: string; situacao?: string; format?: string }) {
    const empresa = this.empresa(empresaCodigo);
    const de = this.data(query.de, 'Data inicial');
    const ate = this.data(query.ate, 'Data final');
    if (de && ate && de > ate) throw new BadRequestException('A data inicial não pode ser maior que a data final.');
    const situacao = String(query.situacao || '').trim();
    if (situacao && !SITUACOES.has(situacao)) throw new BadRequestException('Situação da ordem inválida.');

    const rows = await this.prisma.ordemServico.findMany({
      where: {
        empresaCodigo: empresa,
        ...(situacao
          ? {
              situacao:
                situacao === OrdemSituacao.EM_ANDAMENTO || situacao === OrdemSituacao.EM_EXECUCAO
                  ? { in: [OrdemSituacao.EM_ANDAMENTO, OrdemSituacao.EM_EXECUCAO] }
                  : (situacao as OrdemSituacao),
            }
          : {}),
        ...(de || ate
          ? {
              dataAbertura: {
                ...(de ? { gte: this.meioDia(de) } : {}),
                ...(ate ? { lte: this.meioDia(ate) } : {}),
              },
            }
          : {}),
      },
      include: { cliente: { select: { nome: true } } },
      orderBy: [{ dataAbertura: 'desc' }, { numero: 'desc' }],
    });

    const linhas: LinhaOrdem[] = rows.map((row) => {
      const taxa = this.dinheiro(row.taxaVistoria);
      const maoDeObra = this.dinheiro(row.maoDeObra);
      const deslocamento = this.dinheiro(row.deslocamento);
      const material = this.dinheiro(row.material);
      const total = this.dinheiro(taxa + maoDeObra + deslocamento + material);
      const entrada = row.entradaValor == null ? 0 : this.dinheiro(row.entradaValor);
      const saldoParcelado = (Math.round(total * 100) - Math.round(entrada * 100)) / 100;
      return {
        numero: row.numero,
        cliente: row.cliente.nome,
        situacao: row.situacao,
        dataAbertura: this.formatarData(row.dataAbertura),
        dataEncerramento: row.dataEncerramento ? this.formatarData(row.dataEncerramento) : null,
        garantiaAte: row.garantiaAte ? this.formatarData(row.garantiaAte) : null,
        total,
        entrada,
        saldoParcelado,
        taxa,
        maoDeObra,
        deslocamento,
        material,
      };
    });

    const corpo = { de, ate, situacao: situacao || null, linhas };
    if (this.csv(query.format)) {
      const texto = [
        'numero;cliente;situacao;dataAbertura;dataEncerramento;garantiaAte;total;entrada;saldoParcelado;taxa;maoDeObra;deslocamento;material',
        ...linhas.map((linha) =>
          [
            linha.numero,
            this.campo(linha.cliente),
            linha.situacao,
            linha.dataAbertura,
            linha.dataEncerramento || '',
            linha.garantiaAte || '',
            this.decimal(linha.total),
            this.decimal(linha.entrada),
            this.decimal(linha.saldoParcelado),
            this.decimal(linha.taxa),
            this.decimal(linha.maoDeObra),
            this.decimal(linha.deslocamento),
            this.decimal(linha.material),
          ].join(';'),
        ),
      ].join('\r\n');
      return this.arquivo('relatorio-ordens.csv', texto);
    }
    return corpo;
  }

  async estoque(empresaCodigo: string, format?: string) {
    const empresa = this.empresa(empresaCodigo);
    const rows = await this.prisma.produto.findMany({
      where: { empresaCodigo: empresa },
      orderBy: [{ codigo: 'asc' }],
      select: { codigo: true, descricao: true, unidade: true, estoque: true },
    });
    const linhas = rows.map((row) => ({
      codigo: row.codigo,
      descricao: row.descricao,
      unidade: row.unidade,
      estoque: this.quantidade(row.estoque),
    }));
    if (this.csv(format)) {
      const texto = [
        'codigo;descricao;unidade;estoque',
        ...linhas.map((linha) =>
          [this.campo(linha.codigo), this.campo(linha.descricao), this.campo(linha.unidade), this.decimal(linha.estoque, 3)].join(';'),
        ),
      ].join('\r\n');
      return this.arquivo('relatorio-estoque.csv', texto);
    }
    return { linhas };
  }

  async fluxoCaixa(empresaCodigo: string, de: string, ate: string, format?: string) {
    const relatorio = await this.financeiro.fluxoCaixa(empresaCodigo, de, ate);
    if (!this.csv(format)) return relatorio;
    const linhas = [
      ...relatorio.meses.map((mes) => {
        const nome = 'mes' in mes && mes.mes ? mes.mes : '';
        return [
          nome,
          this.decimal(mes.entradasPrevistas),
          this.decimal(mes.saidasPrevistas),
          this.decimal(mes.entradasRealizadas),
          this.decimal(mes.saidasRealizadas),
        ].join(';');
      }),
      [
        'Total',
        this.decimal(relatorio.totais.entradasPrevistas),
        this.decimal(relatorio.totais.saidasPrevistas),
        this.decimal(relatorio.totais.entradasRealizadas),
        this.decimal(relatorio.totais.saidasRealizadas),
      ].join(';'),
    ];
    const texto = ['mês;entradas previstas;saídas previstas;entradas realizadas;saídas realizadas', ...linhas].join('\r\n');
    return this.arquivo('relatorio-fluxo-caixa.csv', texto);
  }

  private arquivo(nome: string, texto: string) {
    return new StreamableFile(Buffer.from(`\uFEFF${texto}`, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${nome}"`,
    });
  }

  private csv(format?: string) {
    return String(format || '').trim().toLowerCase() === 'csv';
  }

  private empresa(codigo: string | undefined) {
    const empresa = String(codigo || '').trim();
    if (!empresa) throw new BadRequestException('Selecione a empresa antes de emitir o relatório.');
    return empresa;
  }

  private data(valor: string | undefined, campo: string) {
    const texto = String(valor || '').trim();
    if (!texto) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) throw new BadRequestException(`${campo} inválida. Use AAAA-MM-DD.`);
    return texto;
  }

  private meioDia(valor: string) {
    const [ano, mes, dia] = valor.split('-').map(Number);
    return new Date(Date.UTC(ano, mes - 1, dia, 12));
  }

  private formatarData(data: Date) {
    return data.toISOString().slice(0, 10);
  }

  private dinheiro(valor: Prisma.Decimal | number) {
    return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
  }

  private quantidade(valor: Prisma.Decimal | number) {
    return Math.round((Number(valor) + Number.EPSILON) * 1000) / 1000;
  }

  private decimal(valor: number, casas = 2) {
    return valor.toFixed(casas).replace('.', ',');
  }

  private campo(valor: string) {
    if (/[;"\r\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`;
    return valor;
  }
}
