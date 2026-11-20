import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Filtros = {
  usuarioId?: string;
  acao?: string;
  de?: string;
  ate?: string;
};

@Injectable()
export class AtividadesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(empresaCodigo: string, filtros: Filtros) {
    const empresa = String(empresaCodigo || '').trim();
    if (!empresa) throw new BadRequestException('Selecione a empresa antes de consultar as atividades.');

    const where: Prisma.AtividadeWhereInput = { empresaCodigo: empresa };
    const usuario = String(filtros.usuarioId || '').trim();
    if (usuario) {
      const id = Number(usuario);
      if (!Number.isInteger(id) || id <= 0) throw new BadRequestException('Usuário inválido.');
      where.usuarioId = id;
    }

    const acao = String(filtros.acao || '').trim();
    if (acao) where.acao = { contains: acao.slice(0, 80), mode: 'insensitive' };

    const de = this.data(filtros.de, 'Data inicial');
    const ate = this.data(filtros.ate, 'Data final');
    if (de && ate && de > ate) throw new BadRequestException('A data inicial não pode ser maior que a data final.');
    if (de || ate) {
      where.criadoEm = {
        ...(de ? { gte: new Date(`${de}T00:00:00.000Z`) } : {}),
        ...(ate ? { lte: new Date(`${ate}T23:59:59.999Z`) } : {}),
      };
    }

    const rows = await this.prisma.atividade.findMany({
      where,
      orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
      take: 400,
    });

    return rows.map((row) => ({
      id: row.id,
      empresaCodigo: row.empresaCodigo,
      usuarioId: row.usuarioId,
      login: row.login,
      acao: row.acao,
      caminho: row.caminho,
      metodo: row.metodo,
      objeto: row.objeto || '',
      criadoEm: row.criadoEm.toISOString(),
    }));
  }

  private data(valor: string | undefined, campo: string) {
    const texto = String(valor || '').trim();
    if (!texto) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) throw new BadRequestException(`${campo} inválida. Use AAAA-MM-DD.`);
    return texto;
  }
}
