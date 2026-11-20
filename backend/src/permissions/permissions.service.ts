import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';
import { mergeGroupAndUserScreenPermissions } from './permissions-merge.util';
import { resolveIsAdmin } from '../auth/admin-access.util';

function normalizePermissionsInput(permissions: unknown): { screenId: string; hasPermission: boolean }[] {
  if (Array.isArray(permissions)) {
    return permissions
      .filter((p) => p && (typeof p.screenId === 'string' || typeof p.id === 'string'))
      .map((p) => ({
        screenId: p.screenId || p.id,
        hasPermission: Boolean(p.hasPermission),
      }));
  }
  if (permissions && typeof permissions === 'object') {
    return Object.entries(permissions as Record<string, boolean>)
      .filter(([screenId]) => screenId && typeof screenId === 'string')
      .map(([screenId, hasPermission]) => ({
        screenId,
        hasPermission: Boolean(hasPermission),
      }));
  }
  return [];
}

@Injectable()
export class PermissionsService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    void this.ensureUserPermissionsSchema().catch((err) => {
      this.logger.warn(
        `[Permissions] schema usuario: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  private async ensureUserPermissionsSchema(): Promise<void> {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS crm_permissoes_telas_usuario (
        id              TEXT         PRIMARY KEY,
        usuario_id      INTEGER      NOT NULL REFERENCES crm_usuarios(id) ON DELETE CASCADE,
        screen_id       TEXT         NOT NULL REFERENCES crm_telas(id) ON DELETE CASCADE,
        has_permission  BOOLEAN      NOT NULL DEFAULT true,
        created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
        UNIQUE (usuario_id, screen_id)
      )`);
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS idx_perm_telas_usuario ON crm_permissoes_telas_usuario (usuario_id)`,
    );
  }

  private async resolveScreenIdsBySlug(screenSlugs: string[]): Promise<Map<string, string>> {
    const unique = Array.from(new Set(screenSlugs));
    const screenBySlug = new Map<string, string>();
    if (unique.length === 0) return screenBySlug;

    const existingScreens = await this.prisma.crmTelas.findMany({
      where: { screenId: { in: unique } },
      select: { id: true, screenId: true },
    });
    existingScreens.forEach((s) => screenBySlug.set(s.screenId, s.id));

    const missingSlugs = unique.filter((slug) => !screenBySlug.has(slug));
    for (const slug of missingSlugs) {
      try {
        const created = await this.prisma.crmTelas.create({
          data: { id: randomUUID(), screenId: slug, label: slug, order: 0 },
          select: { id: true, screenId: true },
        });
        screenBySlug.set(created.screenId, created.id);
      } catch (error) {
        console.error(`PermissionsService - Erro ao criar tela "${slug}":`, error);
      }
    }

    const unresolved = unique.filter((slug) => !screenBySlug.has(slug));
    if (unresolved.length > 0) {
      throw new Error(
        `As seguintes telas não possuem registro em crm_telas: ${unresolved.join(', ')}.`,
      );
    }
    return screenBySlug;
  }

  /** Grupo + exceções do usuário (mesma regra do login). */
  async getEffectivePermissionMapForUser(usuarioId: number): Promise<Record<string, boolean>> {
    const user = await this.prisma.crmUsuarios.findUnique({
      where: { id: usuarioId },
      select: {
        isAdmin: true,
        grupoUsuarioId: true,
        grupoUsuario: { select: { name: true, label: true } },
      },
    });
    if (!user || resolveIsAdmin(user)) return {};

    let permissions: Record<string, boolean> = {};
    if (user.grupoUsuarioId) {
      const permissionsRecords = await this.prisma.crmPermissoesTelas.findMany({
        where: { userGroupId: user.grupoUsuarioId },
        include: { screen: { select: { screenId: true } } },
      });
      permissionsRecords.forEach((perm) => {
        if (perm.screen?.screenId) {
          permissions[perm.screen.screenId] = perm.hasPermission;
        }
      });
    }

    const userOverrides = await this.prisma.crmPermissoesTelasUsuario.findMany({
      where: { usuarioId },
      include: { screen: { select: { screenId: true } } },
    });

    const merged = mergeGroupAndUserScreenPermissions(
      permissions,
      userOverrides
        .filter((row) => row.screen?.screenId)
        .map((row) => ({
          screenSlug: row.screen!.screenId,
          hasPermission: row.hasPermission,
        })),
    );
    if (merged['medicoes-assistente'] === undefined) {
      merged['medicoes-assistente'] =
        Boolean(merged['medicoes']) && !Boolean(merged['medicoes-representante']);
    }
    return merged;
  }

  async listEffectiveForUser(usuarioId: number) {
    const map = await this.getEffectivePermissionMapForUser(usuarioId);
    return Object.entries(map).map(([screenId, hasPermission]) => ({
      id: screenId,
      screenId,
      hasPermission,
    }));
  }

  async findByGroup(groupId: string) {
    const records = await this.prisma.crmPermissoesTelas.findMany({
      where: { userGroupId: groupId },
      include: {
        screen: {
          select: {
            screenId: true,
          },
        },
      },
    });

    // Normalizar formato para o frontend sempre usando o slug da tela (screen.screenId)
    return records.map((perm) => ({
      id: perm.screen?.screenId || perm.screenId,
      screenId: perm.screen?.screenId || perm.screenId,
      hasPermission: perm.hasPermission,
    }));
  }

  async update(updatePermissionsDto: any) {
    const { userGroupId, permissions } = updatePermissionsDto;

    if (!userGroupId) {
      throw new Error('userGroupId é obrigatório');
    }

    const normalizedPermissions = normalizePermissionsInput(permissions);

    if (!normalizedPermissions.length) {
      await this.prisma.crmPermissoesTelas.deleteMany({
        where: { userGroupId },
      });
      return { count: 0 };
    }

    const screenBySlug = await this.resolveScreenIdsBySlug(
      normalizedPermissions.map((p) => p.screenId),
    );

    await this.prisma.crmPermissoesTelas.deleteMany({
      where: { userGroupId },
    });

    const createData = normalizedPermissions.map((perm) => ({
      id: randomUUID(),
      userGroupId,
      screenId: screenBySlug.get(perm.screenId)!,
      hasPermission: perm.hasPermission,
    }));

    return this.prisma.crmPermissoesTelas.createMany({
      data: createData,
    });
  }

  async findByUser(usuarioId: number) {
    const records = await this.prisma.crmPermissoesTelasUsuario.findMany({
      where: { usuarioId },
      include: {
        screen: { select: { screenId: true } },
      },
    });
    return records.map((perm) => ({
      id: perm.screen?.screenId || perm.screenId,
      screenId: perm.screen?.screenId || perm.screenId,
      hasPermission: perm.hasPermission,
    }));
  }

  /** Substitui as exceções individuais do usuário (não altera o grupo). */
  async updateUser(usuarioId: number, permissions: Record<string, boolean>) {
    if (!usuarioId) {
      throw new Error('usuarioId é obrigatório');
    }
    const normalizedPermissions = normalizePermissionsInput(permissions);
    await this.prisma.crmPermissoesTelasUsuario.deleteMany({
      where: { usuarioId },
    });
    if (!normalizedPermissions.length) {
      return { count: 0 };
    }
    const screenBySlug = await this.resolveScreenIdsBySlug(
      normalizedPermissions.map((p) => p.screenId),
    );
    const createData = normalizedPermissions.map((perm) => ({
      id: randomUUID(),
      usuarioId,
      screenId: screenBySlug.get(perm.screenId)!,
      hasPermission: perm.hasPermission,
    }));
    try {
      return await this.prisma.crmPermissoesTelasUsuario.createMany({ data: createData });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (/crm_permissoes_telas_usuario|does not exist|relation/i.test(msg)) {
        throw new Error(
          'Tabela crm_permissoes_telas_usuario ausente. Execute backend/prisma/scripts/add_crm_permissoes_telas_usuario.sql no banco.',
        );
      }
      throw error;
    }
  }
}
