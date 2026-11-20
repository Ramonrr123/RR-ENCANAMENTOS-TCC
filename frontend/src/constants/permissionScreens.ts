export type PermissionScreen = {
  id: string
  label: string
  parent: string | null
}

/** Telas do menu deste ERP. Sem os módulos de negócio do CRM. */
export const MENU_PERMISSION_SCREENS: PermissionScreen[] = [
  { id: 'inicio', label: 'Início', parent: null },
  { id: 'financeiro', label: 'Financeiro', parent: null },
  { id: 'financeiro-pagar', label: '  - Contas a pagar', parent: 'financeiro' },
  { id: 'financeiro-receber', label: '  - Contas a receber', parent: 'financeiro' },
  { id: 'financeiro-fluxo', label: '  - Fluxo de caixa', parent: 'financeiro' },
  { id: 'produtos', label: 'Produtos', parent: null },
  { id: 'estoque', label: 'Estoque', parent: null },
  { id: 'chamados', label: 'Chamados', parent: null },
  { id: 'ordem-servico', label: 'Ordem de Serviço', parent: null },
  { id: 'tarefas', label: 'Tarefas', parent: null },
  { id: 'calendario', label: 'Calendário', parent: null },
  { id: 'acesso', label: 'Acesso', parent: null },
  { id: 'acesso-usuarios', label: '  - Usuários', parent: 'acesso' },
  { id: 'acesso-permissoes', label: '  - Permissões de usuário', parent: 'acesso' },
  { id: 'acesso-perfil', label: '  - Perfil de acesso', parent: 'acesso' },
  { id: 'acesso-empresas', label: '  - Empresas', parent: 'acesso' },
  { id: 'acesso-atividades', label: '  - Atividades', parent: 'acesso' },
]

export function mergePermissionScreens(
  fromDb: Array<{ id: string; label?: string; parent?: string | null }> | null | undefined,
): PermissionScreen[] {
  const db = fromDb || []
  if (db.length === 0) return MENU_PERMISSION_SCREENS

  const dbById = new Map(db.map((s) => [s.id, s]))
  const merged = MENU_PERMISSION_SCREENS.map((s) => {
    const from = dbById.get(s.id)
    return from
      ? { id: from.id, label: from.label || s.label, parent: from.parent ?? s.parent }
      : s
  })
  const onlyDb = db.filter((s) => !MENU_PERMISSION_SCREENS.some((m) => m.id === s.id))
  return [
    ...merged,
    ...onlyDb.map((s) => ({
      id: s.id,
      label: s.label || s.id,
      parent: s.parent ?? null,
    })),
  ]
}

export function screensSyncPayload() {
  const ordered = [...MENU_PERMISSION_SCREENS].sort((a, b) => {
    if (!a.parent && b.parent) return -1
    if (a.parent && !b.parent) return 1
    return 0
  })
  return ordered.map((screen, index) => ({
    screenId: screen.id,
    label: screen.label.trim(),
    parentId: screen.parent,
    moduleId: screen.parent || screen.id,
    order: index + 1,
  }))
}
