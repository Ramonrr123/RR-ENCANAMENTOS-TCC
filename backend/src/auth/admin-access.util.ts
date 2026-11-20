export function isAdministradoresGroup(
  grupo?: { name?: string | null; label?: string | null } | null,
): boolean {
  if (!grupo) return false
  const name = String(grupo.name || '')
    .trim()
    .toLowerCase()
  const label = String(grupo.label || '')
    .trim()
    .toLowerCase()
  return name === 'administradores' || label === 'administradores'
}

export function resolveIsAdmin(user: {
  isAdmin?: boolean | null
  grupoUsuario?: { name?: string | null; label?: string | null } | null
}): boolean {
  return Boolean(user.isAdmin) || isAdministradoresGroup(user.grupoUsuario)
}
