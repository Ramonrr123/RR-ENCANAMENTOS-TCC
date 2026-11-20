import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    try {
      // Buscar todos os grupos
      const groups = await this.prisma.crmGruposUsuarios.findMany({
        select: {
          id: true,
          name: true,
          label: true,
          description: true,
          podeAprovarOrcamentos: true,
          podeVerTabelaPreco: true,
          podePrecificarOrcamentoRepresentante: true,
          podeLiberarVisualizacaoRepresentante: true,
          podeVisualizarProdutos: true,
        },
        orderBy: {
          label: 'asc',
        },
      });

      // Contar usuários por grupo
      const groupsWithUsers = await Promise.all(
        groups.map(async (group) => {
          const userCount = await this.prisma.crmUsuarios.count({
            where: {
              grupoUsuarioId: group.id,
            },
          });

          return {
            id: group.id,
            name: group.name,
            label: group.label,
            description: group.description,
            users: userCount,
            podeAprovarOrcamentos: group.podeAprovarOrcamentos,
            podeVerTabelaPreco: group.podeVerTabelaPreco,
            podePrecificarOrcamentoRepresentante: group.podePrecificarOrcamentoRepresentante,
            podeLiberarVisualizacaoRepresentante: group.podeLiberarVisualizacaoRepresentante,
            podeVisualizarProdutos: group.podeVisualizarProdutos,
          };
        })
      );

      return groupsWithUsers;
    } catch (error) {
      console.error('Erro ao buscar grupos:', error);
      return [];
    }
  }

  async findOne(id: string) {
    try {
      const group = await this.prisma.crmGruposUsuarios.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          label: true,
          description: true,
          podeAprovarOrcamentos: true,
          podeVerTabelaPreco: true,
          podePrecificarOrcamentoRepresentante: true,
          podeLiberarVisualizacaoRepresentante: true,
          podeVisualizarProdutos: true,
        },
      });

      return group;
    } catch (error) {
      console.error('Erro ao buscar grupo:', error);
      return null;
    }
  }

  async create(createGroupDto: any) {
    const name = String(createGroupDto?.name ?? '')
      .trim()
      .toLowerCase();
    const label = String(createGroupDto?.label ?? '').trim();
    const descriptionRaw = createGroupDto?.description;
    const description =
      descriptionRaw != null && String(descriptionRaw).trim() !== ''
        ? String(descriptionRaw).trim()
        : null;

    if (!name || !label) {
      throw new BadRequestException('Nome e nome de exibição são obrigatórios');
    }

    const duplicate = await this.prisma.crmGruposUsuarios.findUnique({
      where: { name },
    });
    if (duplicate) {
      throw new ConflictException('Já existe um grupo com este identificador');
    }

    const id = randomUUID();
    const group = await this.prisma.crmGruposUsuarios.create({
      data: {
        id,
        name,
        label,
        description,
        podeAprovarOrcamentos: false,
        podeVerTabelaPreco: false,
        podePrecificarOrcamentoRepresentante: false,
        podeLiberarVisualizacaoRepresentante: false,
        podeVisualizarProdutos: false,
      },
      select: {
        id: true,
        name: true,
        label: true,
        description: true,
        podeAprovarOrcamentos: true,
        podeVerTabelaPreco: true,
        podePrecificarOrcamentoRepresentante: true,
        podeLiberarVisualizacaoRepresentante: true,
        podeVisualizarProdutos: true,
      },
    });

    return {
      ...group,
      users: 0,
    };
  }

  async update(id: string, updateGroupDto: any) {
    const existing = await this.prisma.crmGruposUsuarios.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Grupo não encontrado');
    }

    const data: {
      label?: string;
      description?: string | null;
      podeAprovarOrcamentos?: boolean;
      podeVerTabelaPreco?: boolean;
      podePrecificarOrcamentoRepresentante?: boolean;
      podeLiberarVisualizacaoRepresentante?: boolean;
      podeVisualizarProdutos?: boolean;
    } = {};

    if (updateGroupDto.label !== undefined) {
      data.label = String(updateGroupDto.label).trim();
    }
    if (updateGroupDto.description !== undefined) {
      const d = updateGroupDto.description;
      data.description = d === null || d === '' ? null : String(d).trim();
    }
    if (updateGroupDto.podeAprovarOrcamentos !== undefined) {
      data.podeAprovarOrcamentos = Boolean(updateGroupDto.podeAprovarOrcamentos);
    }
    if (updateGroupDto.podeVerTabelaPreco !== undefined) {
      data.podeVerTabelaPreco = Boolean(updateGroupDto.podeVerTabelaPreco);
    }
    if (updateGroupDto.podePrecificarOrcamentoRepresentante !== undefined) {
      data.podePrecificarOrcamentoRepresentante = Boolean(
        updateGroupDto.podePrecificarOrcamentoRepresentante,
      );
    }
    if (updateGroupDto.podeLiberarVisualizacaoRepresentante !== undefined) {
      data.podeLiberarVisualizacaoRepresentante = Boolean(
        updateGroupDto.podeLiberarVisualizacaoRepresentante,
      );
    }
    if (updateGroupDto.podeVisualizarProdutos !== undefined) {
      data.podeVisualizarProdutos = Boolean(updateGroupDto.podeVisualizarProdutos);
    }

    if (Object.keys(data).length === 0) {
      const userCount = await this.prisma.crmUsuarios.count({
        where: { grupoUsuarioId: id },
      });
      return {
        id: existing.id,
        name: existing.name,
        label: existing.label,
        description: existing.description,
        podeAprovarOrcamentos: existing.podeAprovarOrcamentos,
        podeVerTabelaPreco: existing.podeVerTabelaPreco,
        podePrecificarOrcamentoRepresentante: existing.podePrecificarOrcamentoRepresentante,
        podeLiberarVisualizacaoRepresentante: existing.podeLiberarVisualizacaoRepresentante,
        podeVisualizarProdutos: existing.podeVisualizarProdutos,
        users: userCount,
      };
    }

    const updated = await this.prisma.crmGruposUsuarios.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        label: true,
        description: true,
        podeAprovarOrcamentos: true,
        podeVerTabelaPreco: true,
        podePrecificarOrcamentoRepresentante: true,
        podeLiberarVisualizacaoRepresentante: true,
        podeVisualizarProdutos: true,
      },
    });

    const userCount = await this.prisma.crmUsuarios.count({
      where: { grupoUsuarioId: id },
    });

    return {
      ...updated,
      users: userCount,
    };
  }

  async remove(id: string) {
    const existing = await this.prisma.crmGruposUsuarios.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Grupo não encontrado');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.crmUsuarios.updateMany({
        where: { grupoUsuarioId: id },
        data: { grupoUsuarioId: null },
      });
      await tx.crmGruposUsuarios.delete({ where: { id } });
    });

    return { id };
  }
}
