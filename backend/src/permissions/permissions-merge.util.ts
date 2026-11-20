/** Mescla permissões do grupo com exceções individuais do usuário. */
export function mergeGroupAndUserScreenPermissions(
  groupPermissions: Record<string, boolean>,
  userOverrides: Array<{ screenSlug: string; hasPermission: boolean }>,
): Record<string, boolean> {
  const merged = { ...groupPermissions };
  for (const row of userOverrides) {
    if (!row.screenSlug) continue;
    merged[row.screenSlug] = row.hasPermission;
  }
  return merged;
}
