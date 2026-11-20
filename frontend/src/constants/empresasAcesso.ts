/** Neste ERP qualquer empresa cadastrada pode ser vinculada ao usuário. */
export function filtrarEmpresasAcessoUsuario<T extends { codigo?: string | null }>(
  companies: T[],
): T[] {
  return [...companies].sort((a, b) =>
    String(a.codigo || '').localeCompare(String(b.codigo || ''), 'pt-BR'),
  )
}
