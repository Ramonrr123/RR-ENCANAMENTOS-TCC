export type AuthRequestUser = {
  userId?: number;
  id?: number;
  sub?: number;
  sid?: string | null;
  /** Lido de crm_usuarios em JwtStrategy.validate. O token só traz sub, login, e-mail e sessão. */
  isAdmin?: boolean;
};

/** ID do usuário autenticado (JWT strategy retorna `userId`, não `id`). */
export function getSessionUserId(req?: { user?: AuthRequestUser }): number | undefined {
  const u = req?.user;
  if (!u) return undefined;
  const id = u.userId ?? u.id ?? u.sub;
  return typeof id === 'number' && Number.isFinite(id) ? id : undefined;
}

/** Proprietário: isAdmin veio do banco na validação do JWT, não do corpo da requisição. */
export function isSessionAdmin(req?: { user?: AuthRequestUser }): boolean {
  return req?.user?.isAdmin === true;
}
