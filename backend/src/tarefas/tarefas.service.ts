import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTarefaDto, UpdateTarefaDto } from './dto/tarefa.dto';

@Injectable()
export class TarefasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(empresaCodigo: string) {
    const empresa = this.empresa(empresaCodigo);
    const rows = await this.prisma.tarefa.findMany({
      where: { empresaCodigo: empresa },
      include: { chamado: { select: { numero: true } } },
      orderBy: [{ prazo: 'asc' }, { id: 'desc' }],
    });
    return rows.map((row) => this.toTarefa(row));
  }

  async criar(empresaCodigo: string, dto: CreateTarefaDto) {
    const empresa = this.empresa(empresaCodigo);
    const criada = await this.prisma.tarefa.create({
      data: {
        empresaCodigo: empresa,
        titulo: dto.titulo.trim(),
        descricao: dto.descricao?.trim() || '',
        prazo: this.data(dto.prazo),
        prioridade: dto.prioridade,
        status: dto.status,
        responsaveis: this.nomes(dto.responsaveis),
      },
    });
    return this.toTarefa(criada);
  }

  async atualizar(empresaCodigo: string, id: number, dto: UpdateTarefaDto) {
    const empresa = this.empresa(empresaCodigo);
    const atual = await this.prisma.tarefa.findFirst({ where: { id, empresaCodigo: empresa } });
    if (!atual) throw new NotFoundException('Tarefa não encontrada.');
    const atualizada = await this.prisma.tarefa.update({
      where: { id: atual.id },
      data: {
        titulo: dto.titulo?.trim() || atual.titulo,
        descricao: dto.descricao !== undefined ? dto.descricao.trim() : atual.descricao,
        prazo: dto.prazo !== undefined ? this.data(dto.prazo) : atual.prazo,
        prioridade: dto.prioridade || atual.prioridade,
        status: dto.status || atual.status,
        responsaveis: dto.responsaveis ? this.nomes(dto.responsaveis) : atual.responsaveis,
      },
    });
    return this.toTarefa(atualizada);
  }

  async remover(empresaCodigo: string, ids: number[]) {
    const empresa = this.empresa(empresaCodigo);
    const unicos = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
    if (unicos.length === 0) throw new BadRequestException('Selecione ao menos uma tarefa.');
    const resultado = await this.prisma.tarefa.deleteMany({
      where: { empresaCodigo: empresa, id: { in: unicos } },
    });
    return { count: resultado.count };
  }

  private empresa(codigo: string | undefined) {
    const empresa = String(codigo || '').trim();
    if (!empresa) throw new BadRequestException('Selecione a empresa antes de usar as tarefas.');
    return empresa;
  }

  private nomes(lista: string[]) {
    const nomes = [...new Set(lista.map((nome) => nome.trim()).filter((nome) => nome.length > 0))];
    if (nomes.length < 1 || nomes.length > 5) {
      throw new BadRequestException('Informe de 1 a 5 responsáveis.');
    }
    return nomes;
  }

  private data(valor?: string | null) {
    if (!valor) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
    if (!match) throw new BadRequestException('Data inválida.');
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }

  private formatar(data: Date | null) {
    if (!data) return '';
    const ano = data.getUTCFullYear();
    const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(data.getUTCDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  private toTarefa(row: {
    id: number;
    titulo: string;
    descricao: string;
    prazo: Date | null;
    prioridade: string;
    status: string;
    responsaveis: string[];
    canal?: string | null;
    horario?: string | null;
    chamadoId?: number | null;
    chamado?: { numero: number } | null;
  }) {
    return {
      id: row.id,
      titulo: row.titulo,
      descricao: row.descricao,
      prazo: this.formatar(row.prazo),
      prioridade: row.prioridade,
      status: row.status,
      responsaveis: row.responsaveis,
      canal: row.canal ?? null,
      horario: row.horario ?? null,
      chamadoId: row.chamadoId ?? null,
      chamadoNumero: row.chamado?.numero ?? null,
    };
  }
}
