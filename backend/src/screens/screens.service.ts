import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class ScreensService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const screens = await this.prisma.crmTelas.findMany({
      orderBy: [
        { order: 'asc' },
        { label: 'asc' },
      ],
      include: {
        parent: {
          select: {
            screenId: true,
            label: true,
          },
        },
      },
    });

    return screens.map((screen) => ({
      screenId: screen.screenId,
      id: screen.screenId,
      label: screen.label,
      parentId: screen.parentId,
      parent: screen.parent ? {
        screenId: screen.parent.screenId,
      } : null,
      moduleId: screen.moduleId,
      order: screen.order,
    }));
  }

  async sync(screensData: any[]) {
    if (!Array.isArray(screensData) || screensData.length === 0) {
      return { message: 'No screens to sync', count: 0 };
    }

    let syncedCount = 0;

    for (const screenData of screensData) {
      const { screenId, label, parentId, moduleId, order } = screenData;

      if (!screenId || !label) {
        continue;
      }

      try {
        // Verificar se a tela já existe
        const existing = await this.prisma.crmTelas.findUnique({
          where: { screenId },
        });

        // Se parentId foi fornecido, buscar o id da tela pai pelo screenId
        let parentTelaId: string | null = null;
        if (parentId) {
          const parentTela = await this.prisma.crmTelas.findUnique({
            where: { screenId: parentId },
            select: { id: true },
          });
          if (parentTela) {
            parentTelaId = parentTela.id;
          }
        }

        if (existing) {
          // Atualizar tela existente
          await this.prisma.crmTelas.update({
            where: { screenId },
            data: {
              label,
              parentId: parentTelaId,
              moduleId: moduleId || null,
              order: order || 0,
            },
          });
        } else {
          // Criar nova tela
          await this.prisma.crmTelas.create({
            data: {
              id: randomUUID(),
              screenId,
              label,
              parentId: parentTelaId,
              moduleId: moduleId || null,
              order: order || 0,
            },
          });
        }

        syncedCount++;
      } catch (error) {
        console.error(`Erro ao sincronizar tela ${screenId}:`, error);
      }
    }

    return { message: 'Screens synced', count: syncedCount };
  }
}
