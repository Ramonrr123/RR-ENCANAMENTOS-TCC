import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { resolveIsAdmin } from './admin-access.util';

export type UserGroupSpecialFlags = {
  podeAprovarOrcamentos: boolean;
  podeVerTabelaPreco: boolean;
  podePrecificarOrcamentoRepresentante: boolean;
  podeLiberarVisualizacaoRepresentante: boolean;
  podeVisualizarProdutos: boolean;
};

export function mapUserSpecialPermissions(user: {
  isAdmin?: boolean | null;
  grupoUsuario?: {
    name?: string | null;
    label?: string | null;
    podeAprovarOrcamentos?: boolean;
    podeVerTabelaPreco?: boolean;
    podePrecificarOrcamentoRepresentante?: boolean;
    podeLiberarVisualizacaoRepresentante?: boolean;
    podeVisualizarProdutos?: boolean;
  } | null;
}): UserGroupSpecialFlags {
  if (resolveIsAdmin(user)) {
    return {
      podeAprovarOrcamentos: true,
      podeVerTabelaPreco: true,
      podePrecificarOrcamentoRepresentante: true,
      podeLiberarVisualizacaoRepresentante: true,
      podeVisualizarProdutos: true,
    };
  }
  const g = user.grupoUsuario;
  return {
    podeAprovarOrcamentos: Boolean(g?.podeAprovarOrcamentos),
    podeVerTabelaPreco: Boolean(g?.podeVerTabelaPreco),
    podePrecificarOrcamentoRepresentante: Boolean(g?.podePrecificarOrcamentoRepresentante),
    podeLiberarVisualizacaoRepresentante: Boolean(g?.podeLiberarVisualizacaoRepresentante),
    podeVisualizarProdutos: Boolean(g?.podeVisualizarProdutos),
  };
}

const groupSpecialSelect = {
  name: true,
  label: true,
  podeAprovarOrcamentos: true,
  podeVerTabelaPreco: true,
  podePrecificarOrcamentoRepresentante: true,
  podeLiberarVisualizacaoRepresentante: true,
  podeVisualizarProdutos: true,
} as const;

export async function userCanLiberarVisualizacaoRepresentante(
  prisma: PrismaService,
  usuarioId?: number,
): Promise<boolean> {
  if (!usuarioId) return false;
  const user = await prisma.crmUsuarios.findUnique({
    where: { id: usuarioId },
    select: {
      isAdmin: true,
      grupoUsuario: { select: groupSpecialSelect },
    },
  });
  if (!user) return false;
  return mapUserSpecialPermissions(user).podeLiberarVisualizacaoRepresentante;
}

export async function userCanPrecificarOrcRepresentante(
  prisma: PrismaService,
  usuarioId?: number,
): Promise<boolean> {
  if (!usuarioId) return false;
  const user = await prisma.crmUsuarios.findUnique({
    where: { id: usuarioId },
    select: {
      isAdmin: true,
      grupoUsuario: { select: groupSpecialSelect },
    },
  });
  if (!user) return false;
  return mapUserSpecialPermissions(user).podePrecificarOrcamentoRepresentante;
}

export async function assertCanPrecificarOrcRepresentante(
  prisma: PrismaService,
  usuarioId?: number,
): Promise<void> {
  if (!usuarioId) {
    throw new ForbiddenException('Sessão inválida.');
  }
  const user = await prisma.crmUsuarios.findUnique({
    where: { id: usuarioId },
    select: {
      isAdmin: true,
      grupoUsuario: { select: groupSpecialSelect },
    },
  });
  if (!user) {
    throw new ForbiddenException('Usuário não encontrado.');
  }
  const flags = mapUserSpecialPermissions(user);
  if (!flags.podePrecificarOrcamentoRepresentante) {
    throw new ForbiddenException('Você não tem permissão para precificar orçamentos representante.');
  }
}
