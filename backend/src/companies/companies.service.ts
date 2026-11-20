import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async findByUser(userId: number) {
    const userCompanies = await this.prisma.crmUsuariosEmpresas.findMany({
      where: {
        userId: userId,
      },
      include: {
        company: true,
      },
    });

    return userCompanies.map((uc) => ({
      id: uc.company.id,
      codigo: uc.company.codigo,
      nome: uc.company.nome,
      ativo: uc.company.ativo,
    }));
  }

  async addCompanyToUser(userId: number, companyId: number) {
    try {
      await this.prisma.crmUsuariosEmpresas.upsert({
        where: { userId_companyId: { userId, companyId } },
        create: { userId, companyId },
        update: {},
      });
      return { success: true };
    } catch (error) {
      console.error('Erro ao associar empresa ao usuário:', error);
      throw error;
    }
  }

  async removeCompanyFromUser(userId: number, companyId: number) {
    try {
      await this.prisma.crmUsuariosEmpresas.deleteMany({
        where: { userId, companyId },
      });
      return { success: true };
    } catch (error) {
      console.error('Erro ao remover empresa do usuário:', error);
      throw error;
    }
  }

  async findAll(includeInactive = false) {
    const where = includeInactive ? {} : { ativo: true };

    const companies = await this.prisma.crmEmpresas.findMany({
      where,
      orderBy: {
        nome: 'asc',
      },
    });

    return companies.map((company) => ({
      id: company.id,
      codigo: company.codigo,
      nome: company.nome,
      ativo: company.ativo,
    }));
  }

  async create(data: { codigo?: string; nome?: string; ativo?: boolean }) {
    const codigo = String(data.codigo || '').trim();
    const nome = String(data.nome || '').trim();
    if (!codigo || !nome) {
      throw new BadRequestException('Código e nome são obrigatórios');
    }
    try {
      return await this.prisma.crmEmpresas.create({
        data: { codigo, nome, ativo: data.ativo !== false },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Já existe uma empresa com este código');
      }
      throw error;
    }
  }

  async update(id: number, data: { codigo?: string; nome?: string; ativo?: boolean }) {
    const existing = await this.prisma.crmEmpresas.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Empresa não encontrada');
    try {
      return await this.prisma.crmEmpresas.update({
        where: { id },
        data: {
          ...(data.codigo !== undefined ? { codigo: String(data.codigo).trim() } : {}),
          ...(data.nome !== undefined ? { nome: String(data.nome).trim() } : {}),
          ...(data.ativo !== undefined ? { ativo: Boolean(data.ativo) } : {}),
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Já existe uma empresa com este código');
      }
      throw error;
    }
  }

  async remove(id: number) {
    const existing = await this.prisma.crmEmpresas.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Empresa não encontrada');
    await this.prisma.crmEmpresas.delete({ where: { id } });
    return { success: true };
  }

  async replaceUserCompanies(userId: number, companyIds: number[]) {
    const desired = Array.from(new Set((companyIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id))));
    const current = await this.prisma.crmUsuariosEmpresas.findMany({ where: { userId } });
    const currentIds = new Set(current.map((row) => row.companyId));
    const desiredIds = new Set(desired);

    for (const companyId of desired) {
      if (!currentIds.has(companyId)) {
        await this.addCompanyToUser(userId, companyId);
      }
    }
    for (const companyId of currentIds) {
      if (!desiredIds.has(companyId)) {
        await this.removeCompanyFromUser(userId, companyId);
      }
    }
    return this.findByUser(userId);
  }
}
