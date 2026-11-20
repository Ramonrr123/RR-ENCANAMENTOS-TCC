import { useEffect, useRef, useState } from 'react'
import { HiCheck, HiPhotograph } from 'react-icons/hi'
import { api, persistUserStorage } from '@/services/api'
import { filtrarEmpresasAcessoUsuario } from '@/constants/empresasAcesso'
import { CabecalhoModulo, IconePerfil } from '@/components/icones/IconesErp'

type AccessProfileProps = {
  isAdmin: boolean
  showToast: (message: string, type?: 'success' | 'error') => void
  onUpdated: (user: any) => void
}

type Company = { id: number; codigo: string; nome: string }

const campo = 'mt-1 h-11 w-full min-w-0 rounded-md border border-[#eee] bg-white px-3 text-sm text-[#333]'
const card = 'rounded-md border border-[#ddd] bg-white p-4'

export function AccessProfile({ isAdmin, showToast, onUpdated }: AccessProfileProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [nome, setNome] = useState('')
  const [login, setLogin] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [grupoUsuarioId, setGrupoUsuarioId] = useState('')
  const [groups, setGroups] = useState<Array<{ id: string; label: string }>>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([])
  const [savedCompanies, setSavedCompanies] = useState<number[]>([])
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [fotoNome, setFotoNome] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const [me, groupRes, companyRes] = await Promise.all([
        api.getProfile(),
        api.getGroups(),
        api.getCompanies(true),
      ])
      if (me.data) {
        const data = me.data as any
        setProfile(data)
        setNome(data.nome || '')
        setLogin(data.login || '')
        setEmail(data.email || '')
        setGrupoUsuarioId(data.grupoUsuarioId || '')
        setProfileImage(data.profileImage || null)
        const linked = await api.getUserCompanies(data.id)
        const ids = Array.isArray(linked.data) ? (linked.data as Company[]).map((company) => company.id) : []
        setSelectedCompanies(ids)
        setSavedCompanies(ids)
      }
      if (Array.isArray(groupRes.data)) setGroups(groupRes.data as Array<{ id: string; label: string }>)
      if (Array.isArray(companyRes.data)) {
        setCompanies(filtrarEmpresasAcessoUsuario(companyRes.data as Company[]))
      }
      setLoading(false)
    })()
  }, [])

  async function onImage(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      showToast('Imagem muito grande. Limite de 5MB.', 'error')
      return
    }
    const src = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('leitura'))
      reader.onload = () => resolve(String(reader.result || ''))
      reader.readAsDataURL(file)
    })
    setProfileImage(src)
    setFotoNome(file.name)
  }

  async function save() {
    if (!profile) return
    if (password && password.length < 6) {
      showToast('A senha deve ter no mínimo 6 caracteres.', 'error')
      return
    }
    if (password !== confirmPassword) {
      showToast('As senhas não coincidem.', 'error')
      return
    }
    setSaving(true)
    try {
      if (selectedCompanies.slice().sort().join(',') !== savedCompanies.slice().sort().join(',')) {
        const companiesRes = await api.updateUserCompanies(profile.id, selectedCompanies)
        if (companiesRes.error) {
          showToast(companiesRes.error, 'error')
          return
        }
        setSavedCompanies([...selectedCompanies])
      }
      const updateData: Record<string, unknown> = {}
      if (nome !== profile.nome) updateData.nome = nome
      if (email !== (profile.email || '')) updateData.email = email
      if (login !== profile.login) updateData.login = login
      if (password) updateData.password = password
      if (isAdmin && grupoUsuarioId !== (profile.grupoUsuarioId || '')) updateData.grupoUsuarioId = grupoUsuarioId || null
      if (profileImage && profileImage !== profile.profileImage) updateData.profileImage = profileImage
      const response = await api.updateProfile(updateData)
      if (response.error) {
        showToast(response.error, 'error')
        return
      }
      const updated = response.data as any
      persistUserStorage(updated)
      setProfile(updated)
      setPassword('')
      setConfirmPassword('')
      setFotoNome('')
      onUpdated(updated)
      showToast('Perfil atualizado.', 'success')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f5f5f9] p-6">
        <p className="text-sm text-[#888]">Carregando perfil...</p>
      </div>
    )
  }

  return (
    <div
      data-ds="ant-mobile-perfil"
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f5f5f9]"
    >
      <div className="shrink-0 border-b border-[#eee] bg-white px-[15px] py-4">
        <CabecalhoModulo icone={IconePerfil} titulo="Perfil de acesso" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <div className="mx-auto w-full max-w-4xl space-y-3 px-[15px] py-4">
          <section className={`${card} space-y-3`}>
            <div className="flex min-w-0 items-center gap-3">
              {profileImage ? (
                <img src={profileImage} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#f0f0f0] text-lg font-bold text-[#333]">
                  {(nome || 'U').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-medium text-[#333]">Foto do perfil</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void onImage(file)
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex h-11 w-full min-w-0 items-center justify-center gap-2 rounded-md border border-[#eee] bg-white px-3 text-sm font-medium text-[#333]"
                >
                  <HiPhotograph className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{fotoNome || 'Escolher foto'}</span>
                </button>
              </div>
            </div>
          </section>

          <section className={`${card} space-y-3`}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="min-w-0 text-sm font-medium text-[#333]">
                Nome
                <input value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />
              </label>
              <label className="min-w-0 text-sm font-medium text-[#333]">
                Login
                <input value={login} onChange={(e) => setLogin(e.target.value)} className={campo} />
              </label>
              <label className="min-w-0 text-sm font-medium text-[#333]">
                E-mail
                <input value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
              </label>
              <label className="min-w-0 text-sm font-medium text-[#333]">
                Grupo de usuário
                <select
                  value={grupoUsuarioId}
                  disabled={!isAdmin}
                  onChange={(e) => setGrupoUsuarioId(e.target.value)}
                  className={`${campo} disabled:opacity-70`}
                >
                  <option value="">Selecione um grupo</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>{group.label}</option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 text-sm font-medium text-[#333]">
                Nova senha
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Deixe em branco para manter"
                  className={campo}
                />
              </label>
              <label className="min-w-0 text-sm font-medium text-[#333]">
                Confirmar senha
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={campo}
                />
              </label>
            </div>
          </section>

          <section className={`${card} space-y-3`}>
            <h3 className="text-sm font-medium text-[#333]">Empresas</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {companies.length === 0 ? (
                <p className="text-sm text-[#888]">Nenhuma empresa disponível.</p>
              ) : (
                companies.map((company) => {
                  const selected = selectedCompanies.includes(company.id)
                  return (
                    <button
                      key={company.id}
                      type="button"
                      onClick={() =>
                        setSelectedCompanies((prev) =>
                          selected ? prev.filter((id) => id !== company.id) : [...prev, company.id],
                        )
                      }
                      className={`min-w-0 rounded-md border p-3 text-left ${
                        selected ? 'border-primary bg-primary/10' : 'border-[#eee] bg-white'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[#333]">
                        {selected ? <HiCheck className="h-4 w-4 shrink-0 text-primary" /> : null}
                        <span className="truncate">{company.codigo}</span>
                      </div>
                      <p className="mt-1 break-words text-sm text-[#666]">{company.nome}</p>
                    </button>
                  )
                })
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="shrink-0 border-t border-[#eee] bg-white px-[15px] py-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50 sm:w-auto sm:min-w-[160px]"
        >
          {saving ? 'Salvando...' : 'Salvar perfil'}
        </button>
      </div>
    </div>
  )
}
