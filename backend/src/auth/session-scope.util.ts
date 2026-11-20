import { PrismaService } from '../prisma/prisma.service';
import { resolveIsAdmin } from './admin-access.util';

export type SessionScope = {
  userId: number;
  isAdmin: boolean;
  nome: string;
  login: string;
  grupoUsuario: { id: string; name: string; label: string } | null;
};

export async function loadSessionScope(
  prisma: PrismaService,
  sessionUserId?: number,
): Promise<SessionScope | null> {
  if (sessionUserId == null || !Number.isFinite(sessionUserId)) return null;

  const user = await prisma.crmUsuarios.findUnique({
    where: { id: sessionUserId },
    select: {
      id: true,
      isAdmin: true,
      nome: true,
      login: true,
      grupoUsuario: { select: { id: true, name: true, label: true } },
    },
  });
  if (!user) return null;

  return {
    userId: user.id,
    isAdmin: resolveIsAdmin(user),
    nome: user.nome ?? '',
    login: user.login ?? '',
    grupoUsuario: user.grupoUsuario ?? null,
  };
}

/** Admin vê todos os clientes; os demais só aqueles em que são o responsável. */
export function scopeLimitsToResponsavel(scope: SessionScope | null): scope is SessionScope {
  return scope != null && !scope.isAdmin;
}
