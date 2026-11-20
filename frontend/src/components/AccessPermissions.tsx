import { useEffect, useMemo, useState } from 'react'
import { HiPencil, HiPlus, HiX } from 'react-icons/hi'
import { api } from '@/services/api'
import { MENU_PERMISSION_SCREENS, mergePermissionScreens, screensSyncPayload } from '@/constants/permissionScreens'
import { CabecalhoModal, CabecalhoModulo, IconePermissoes } from '@/components/icones/IconesErp'
import { isAdministradoresGroup } from '@/lib/admin-access'

type GroupRow = {
  id: string
  name?: string
  label: string
  description: string
  users: number
}

type AccessPermissionsProps = {
  showToast: (message: string, type?: 'success' | 'error') => void
}

const card = 'rounded-md border border-[#ddd] bg-white p-4'
const campo = 'mt-1 h-11 w-full min-w-0 rounded-md border border-[#eee] bg-white px-3 text-sm text-[#333]'

export function AccessPermissions({ showToast }: AccessPermissionsProps) {
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [screensFromDb, setScreensFromDb] = useState<Array<{ id: string; label?: string; parent?: string | null }>>([])
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [editingGroupData, setEditingGroupData] = useState<GroupRow | null>(null)
  const [groupForm, setGroupForm] = useState({ name: '', label: '', description: '' })
  const [saving, setSaving] = useState(false)

  const screens = useMemo(() => mergePermissionScreens(screensFromDb), [screensFromDb])

  const loadScreens = async () => {
    const response = await api.getScreens()
    if (response.data && Array.isArray(response.data)) {
      setScreensFromDb(
        (response.data as Array<{ screenId: string; label: string; parent?: { screenId: string } | null; parentId: string | null }>).map(
          (screen) => ({
            id: screen.screenId,
            label: screen.label,
            parent: screen.parent?.screenId || screen.parentId,
          }),
        ),
      )
    }
  }

  const syncScreens = async () => {
    await api.syncScreens(screensSyncPayload())
    await loadScreens()
  }

  const loadGroups = async () => {
    setLoading(true)
    try {
      const response = await api.getGroups()
      if (response.data && Array.isArray(response.data)) {
        setGroups(
          (response.data as GroupRow[]).map((group) => ({
            id: group.id,
            name: group.name || group.id,
            label: group.label,
            description: group.description || '',
            users: group.users || 0,
          })),
        )
      } else if (response.error) {
        showToast(response.error, 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void (async () => {
      await syncScreens()
      await loadGroups()
    })()
  }, [])

  useEffect(() => {
    if (!editingGroup) return
    void (async () => {
      const response = await api.getGroupPermissions(editingGroup)
      const map: Record<string, boolean> = {}
      if (Array.isArray(response.data)) {
        for (const row of response.data as Array<{ screenId?: string; id?: string; hasPermission: boolean }>) {
          const key = row.screenId || row.id
          if (key) map[key] = Boolean(row.hasPermission)
        }
      }
      setPermissions(map)
    })()
  }, [editingGroup])

  const current = groups.find((group) => group.id === editingGroup)

  function abrirNovoGrupo() {
    setEditingGroupData(null)
    setGroupForm({ name: '', label: '', description: '' })
    setShowGroupModal(true)
  }

  if (editingGroup && current) {
    return (
      <div
        data-ds="ant-mobile-permissoes-editar"
        className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f5f5f9]"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-[#eee] bg-white px-[15px] py-4">
          <button
            type="button"
            onClick={() => setEditingGroup(null)}
            className="inline-flex h-10 items-center rounded-md border border-[#d0d5dd] bg-white px-3 text-sm text-[#333] hover:bg-[#f8f9fb]"
          >
            Voltar
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-[#333] sm:text-xl">
              {current.label}
            </h2>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain px-[15px] py-4 [-webkit-overflow-scrolling:touch]">
          {screens.map((screen) => (
            <label
              key={screen.id}
              className={`${card} flex items-center gap-3 ${screen.parent ? 'ml-3' : ''}`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0"
                checked={Boolean(permissions[screen.id])}
                onChange={() => setPermissions((prev) => ({ ...prev, [screen.id]: !prev[screen.id] }))}
              />
              <span className={`min-w-0 break-words text-sm text-[#333] ${screen.parent ? '' : 'font-medium'}`}>
                {screen.label}
              </span>
            </label>
          ))}
        </div>
        <div className="flex shrink-0 gap-2 border-t border-[#eee] bg-white px-[15px] py-3">
          <button
            type="button"
            onClick={() => setEditingGroup(null)}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-md border border-[#d0d5dd] bg-white text-sm font-medium text-[#333]"
          >
            Cancelar
          </button>
          <button
            type="button"
            className="inline-flex h-11 flex-1 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={async () => {
              const merged: Record<string, boolean> = {}
              for (const screen of MENU_PERMISSION_SCREENS) merged[screen.id] = Boolean(permissions[screen.id])
              const response = await api.updatePermissions(editingGroup, merged)
              if (response.error) {
                showToast(response.error, 'error')
                return
              }
              showToast(`Permissões de ${current.label} salvas.`, 'success')
              setEditingGroup(null)
            }}
          >
            Salvar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      data-ds="ant-mobile-permissoes"
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f5f5f9]"
    >
      <div className="shrink-0 border-b border-[#eee] bg-white px-[15px] py-4">
        <CabecalhoModulo
          icone={IconePermissoes}
          titulo="Permissões de usuário"
          acoes={
            <button
              type="button"
              onClick={abrirNovoGrupo}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <HiPlus className="h-4 w-4" />
              Criar
            </button>
          }
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-[15px] py-4 [-webkit-overflow-scrolling:touch]">
        {loading ? (
          <p className="text-sm text-[#888]">Carregando grupos...</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-[#888]">Nenhum grupo cadastrado.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <article key={group.id} className={`${card} space-y-3`}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="break-words text-[15px] font-medium leading-snug text-[#333]">{group.label}</p>
                    <p className="text-xs text-[#888]">
                      {group.users} usuário{group.users === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      title="Editar grupo"
                      aria-label="Editar grupo"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-[#eee] bg-white text-primary"
                      onClick={() => {
                        setEditingGroupData(group)
                        setGroupForm({ name: group.name || '', label: group.label, description: group.description || '' })
                        setShowGroupModal(true)
                      }}
                    >
                      <HiPencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Excluir grupo"
                      aria-label="Excluir grupo"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-[#eee] bg-white text-[#b42318]"
                      onClick={async () => {
                        if (group.users > 0) {
                          showToast(`O grupo "${group.label}" ainda tem ${group.users} usuário(s).`, 'error')
                          return
                        }
                        if (!confirm(`Excluir o grupo "${group.label}"?`)) return
                        const response = await api.deleteGroup(group.id)
                        if (response.error) showToast(response.error, 'error')
                        else {
                          showToast('Grupo excluído.', 'success')
                          await loadGroups()
                        }
                      }}
                    >
                      <HiX className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {isAdministradoresGroup(group) ? (
                  <p className="rounded-md border border-[#eee] bg-[#f5f5f9] px-3 py-2.5 text-center text-sm text-[#666]">
                    Acesso total ao sistema (grupo Administradores)
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingGroup(group.id)}
                    className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Editar permissões
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-background p-4 shadow-xl sm:p-6">
            <CabecalhoModal
              icone={IconePermissoes}
              titulo={editingGroupData ? 'Editar grupo' : 'Criar grupo'}
              onFechar={() => setShowGroupModal(false)}
            />
            <div className="space-y-4">
              <label className="block text-sm font-medium text-[#333]">
                Identificador
                <input
                  value={groupForm.name}
                  onChange={(e) => setGroupForm((prev) => ({ ...prev, name: e.target.value }))}
                  disabled={Boolean(editingGroupData)}
                  className={`${campo} disabled:opacity-70`}
                />
              </label>
              <label className="block text-sm font-medium text-[#333]">
                Nome de exibição
                <input
                  value={groupForm.label}
                  onChange={(e) => setGroupForm((prev) => ({ ...prev, label: e.target.value }))}
                  className={campo}
                />
              </label>
              <button
                type="button"
                disabled={saving || !groupForm.name.trim() || !groupForm.label.trim()}
                className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                onClick={async () => {
                  setSaving(true)
                  try {
                    const response = editingGroupData
                      ? await api.updateGroup(editingGroupData.id, {
                          label: groupForm.label.trim(),
                          description: groupForm.description.trim(),
                        })
                      : await api.createGroup({
                          name: groupForm.name.trim(),
                          label: groupForm.label.trim(),
                          description: groupForm.description.trim() || undefined,
                        })
                    if (response.error) showToast(response.error, 'error')
                    else {
                      showToast(editingGroupData ? 'Grupo atualizado.' : 'Grupo criado.', 'success')
                      setShowGroupModal(false)
                      await loadGroups()
                    }
                  } finally {
                    setSaving(false)
                  }
                }}
              >
                {saving ? 'Salvando...' : editingGroupData ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
