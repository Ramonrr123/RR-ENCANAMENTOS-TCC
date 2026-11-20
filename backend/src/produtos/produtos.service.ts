import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProdutoDto, UpdateProdutoDto } from './dto/produto.dto';

@Injectable()
export class ProdutosService {
  constructor(private prisma: PrismaService) {}

  async findAll(empresaCodigo: string, admin: boolean) {
    const empresa = this.empresa(empresaCodigo);
    const rows = await this.prisma.produto.findMany({
      where: { empresaCodigo: empresa },
      orderBy: [{ descricao: 'asc' }, { codigo: 'asc' }],
    });
    return rows.map((row) => this.toResponse(row, admin));
  }

  async create(empresaCodigo: string, dto: CreateProdutoDto, admin: boolean) {
    this.exigirAdminParaValores(admin, dto);
    if (admin && typeof dto.preco !== 'number') {
      throw new BadRequestException('Preço é obrigatório.');
    }
    const empresa = this.empresa(empresaCodigo);
    const codigo = this.codigo(dto.codigo);
    await this.garantirCodigoLivre(empresa, codigo, null);
    try {
      const criado = await this.prisma.produto.create({
        data: {
          empresaCodigo: empresa,
          codigo,
          descricao: dto.descricao.trim(),
          unidade: dto.unidade.trim(),
          categoria: dto.categoria.trim(),
          preco: this.decimal(admin ? dto.preco ?? 0 : 0, 2),
          custo: this.decimal(admin ? dto.custo ?? 0 : 0, 2),
          estoque: this.decimal(dto.estoque ?? 0, 3),
          estoqueMinimo: this.decimal(dto.estoqueMinimo ?? 0, 3),
          observacao: this.texto(dto.observacao),
          ferramenta: dto.ferramenta === true || dto.categoria.trim().toLowerCase() === 'ferramenta',
          ativo: dto.ativo !== false,
        },
      });
      return this.toResponse(criado, admin);
    } catch (error) {
      this.tratarDuplicado(error);
      throw error;
    }
  }

  async update(empresaCodigo: string, id: number, dto: UpdateProdutoDto, admin: boolean) {
    this.exigirAdminParaValores(admin, dto);
    const empresa = this.empresa(empresaCodigo);
    const atual = await this.prisma.produto.findFirst({ where: { id, empresaCodigo: empresa } });
    if (!atual) throw new NotFoundException('Produto não encontrado.');

    const codigo = dto.codigo !== undefined ? this.codigo(dto.codigo) : atual.codigo;
    await this.garantirCodigoLivre(empresa, codigo, atual.id);

    try {
      const atualizado = await this.prisma.produto.update({
        where: { id: atual.id },
        data: {
          codigo,
          descricao: dto.descricao?.trim() || atual.descricao,
          unidade: dto.unidade?.trim() || atual.unidade,
          categoria: dto.categoria?.trim() || atual.categoria,
          preco: admin && dto.preco !== undefined ? this.decimal(dto.preco, 2) : atual.preco,
          custo: admin && dto.custo !== undefined ? this.decimal(dto.custo, 2) : atual.custo,
          estoque: dto.estoque !== undefined ? this.decimal(dto.estoque, 3) : atual.estoque,
          estoqueMinimo: dto.estoqueMinimo !== undefined ? this.decimal(dto.estoqueMinimo, 3) : atual.estoqueMinimo,
          observacao: dto.observacao !== undefined ? this.texto(dto.observacao) : atual.observacao,
          ferramenta: dto.ferramenta !== undefined
            ? dto.ferramenta || (dto.categoria ?? atual.categoria).trim().toLowerCase() === 'ferramenta'
            : (dto.categoria ?? atual.categoria).trim().toLowerCase() === 'ferramenta' || atual.ferramenta,
          ativo: dto.ativo !== undefined ? dto.ativo : atual.ativo,
        },
      });
      return this.toResponse(atualizado, admin);
    } catch (error) {
      this.tratarDuplicado(error);
      throw error;
    }
  }

  async removeMany(empresaCodigo: string, ids: number[]) {
    const empresa = this.empresa(empresaCodigo);
    const unicos = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
    if (unicos.length === 0) throw new BadRequestException('Selecione ao menos um produto.');
    try {
      const result = await this.prisma.produto.deleteMany({
        where: { empresaCodigo: empresa, id: { in: unicos } },
      });
      return { count: result.count };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('Peça com movimento de estoque ou lançada em ordem de serviço não pode ser excluída.');
      }
      throw error;
    }
  }

  private async garantirCodigoLivre(empresaCodigo: string, codigo: string, ignorarId: number | null) {
    const existente = await this.prisma.produto.findFirst({
      where: {
        empresaCodigo,
        codigo: { equals: codigo, mode: 'insensitive' },
        ...(ignorarId ? { id: { not: ignorarId } } : {}),
      },
    });
    if (existente) throw new ConflictException('Já existe um produto com este código.');
  }

  private tratarDuplicado(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Já existe um produto com este código.');
    }
  }

  private exigirAdminParaValores(admin: boolean, dto: { preco?: number; custo?: number }) {
    if (admin) return;
    if (dto.preco !== undefined || dto.custo !== undefined) {
      throw new ForbiddenException('Somente o administrador pode informar preço e custo.');
    }
  }

  private toResponse(
    row: {
      id: number;
      codigo: string;
      descricao: string;
      unidade: string;
      categoria: string;
      preco: Prisma.Decimal;
      custo: Prisma.Decimal;
      estoque: Prisma.Decimal;
      estoqueMinimo: Prisma.Decimal;
      observacao: string | null;
      ferramenta: boolean;
      ativo: boolean;
    },
    admin: boolean,
  ) {
    const base = {
      id: row.id,
      codigo: row.codigo,
      descricao: row.descricao,
      unidade: row.unidade,
      categoria: row.categoria,
      estoque: this.num(row.estoque),
      estoqueMinimo: this.num(row.estoqueMinimo),
      observacao: row.observacao || '',
      ferramenta: row.ferramenta,
      ativo: row.ativo,
    };
    if (!admin) return base;
    return {
      ...base,
      preco: this.num(row.preco),
      custo: this.num(row.custo),
    };
  }

  private empresa(codigo: string | undefined) {
    const empresa = String(codigo || '').trim();
    if (!empresa) throw new BadRequestException('Selecione a empresa antes de cadastrar produtos.');
    return empresa;
  }

  private codigo(valor: string) {
    const codigo = String(valor || '').trim();
    if (!codigo) throw new BadRequestException('Código é obrigatório.');
    return codigo;
  }

  private texto(valor: string | null | undefined) {
    const texto = String(valor || '').trim();
    return texto || null;
  }

  private decimal(valor: number, casas: number) {
    const fator = 10 ** casas;
    const arredondado = Math.round((Number(valor) + Number.EPSILON) * fator) / fator;
    return new Prisma.Decimal(arredondado.toFixed(casas));
  }

  private num(valor: Prisma.Decimal | number | null | undefined) {
    return Number(valor ?? 0);
  }
}
