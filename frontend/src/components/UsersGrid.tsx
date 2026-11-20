import { useEffect, useMemo, useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { HiPencil, HiChevronUp, HiChevronDown, HiPlus, HiSearch, HiTrash, HiX, HiUser, HiRefresh } from 'react-icons/hi'
import { HiCheck } from 'react-icons/hi2'
import { api } from '@/services/api'
import { filtrarEmpresasAcessoUsuario } from '@/constants/empresasAcesso'
import { useIsMobile } from '@/hooks/use-mobile'
import { ShellCardBackground } from '@/components/ShellCardBackground'
import { UsuariosRelatorioPDF, type UsuarioRelatorioRow } from '@/components/UsuariosRelatorioPDF'
import { mergePermissionScreens } from '@/constants/permissionScreens'
import { FiltrosColapsaveis } from '@/components/FiltrosColapsaveis'
import { CabecalhoModal, CabecalhoModulo, IconeUsuarios } from '@/components/icones/IconesErp'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const campo = 'h-11 w-full min-w-0 rounded-md border border-[#eee] bg-white px-3 text-sm text-[#333]'
const card = 'rounded-md border border-[#ddd] bg-white p-4'

interface User {
  id: number
  login: string
  nome: string
  cpfCnpj: string | null
  grupoUsuario: string | null
  status: string
  dataSaida: string | null
}

interface UsersGridProps {
  showToast: (message: string, type?: 'success' | 'error') => void
  canEditUserGroup?: boolean
}

export function UsersGrid({ showToast, canEditUserGroup = false }: UsersGridProps) {
  const isMobile = useIsMobile()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize] = useState(16) // Tamanho fixo de 16 registros por página
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  const [searchValue, setSearchValue] = useState<string>('')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [groups, setGroups] = useState<{ id: string; name: string; label: string }[]>([])
  const [availableCompanies, setAvailableCompanies] = useState<{ id: number; codigo: string; nome: string }[]>([])
  const [userCompanies, setUserCompanies] = useState<number[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [acoesAberto, setAcoesAberto] = useState(false)
  const [formData, setFormData] = useState({
    login: '',
    nome: '',
    email: '',
    password: '',
    cpfCnpj: '',
    status: 'Ativo' as 'Ativo' | 'Desligado',
    grupoUsuarioId: '',
    especialidade: '',
  })
  const [userExtraPermissions, setUserExtraPermissions] = useState<Record<string, boolean>>({})
  const [permissionScreensFromDb, setPermissionScreensFromDb] = useState<
    Array<{ id: string; label?: string; parent?: string | null }>
  >([])
  const [permissionScreenFilter, setPermissionScreenFilter] = useState('')

  const permissionScreens = useMemo(
    () => mergePermissionScreens(permissionScreensFromDb),
    [permissionScreensFromDb],
  )

  const filteredPermissionScreens = useMemo(() => {
    const term = permissionScreenFilter.trim().toLowerCase()
    if (!term) return permissionScreens
    return permissionScreens.filter(
      (s) => s.id.toLowerCase().includes(term) || s.label.toLowerCase().includes(term),
    )
  }, [permissionScreens, permissionScreenFilter])

  useEffect(() => {
    loadUsers()
    loadGroups()
    loadAvailableCompanies()
    void loadPermissionScreens()
  }, [])

  const loadPermissionScreens = async () => {
    try {
      const response = await api.getScreens()
      if (response.data && Array.isArray(response.data)) {
        setPermissionScreensFromDb(response.data as Array<{ id: string; label?: string; parent?: string | null }>)
      }
    } catch {
      setPermissionScreensFromDb([])
    }
  }
  
  useEffect(() => {
    if (showCreateModal) {
      if (editingUser?.id) {
        loadUserCompanies(editingUser.id)
      } else {
        setUserCompanies([])
      }
    }
  }, [showCreateModal, editingUser?.id])

  const loadGroups = async () => {
    try {
      const response = await api.getGroups()
      if (response.data) {
        setGroups(response.data as any[])
      }
    } catch (error) {
      console.warn('Grupos não disponíveis:', error)
      setGroups([])
    }
  }

  const loadAvailableCompanies = async () => {
    try {
      const response = await api.getCompanies(true) // Incluir inativas
      if (response.data) {
        const companies = response.data as { id: number; codigo: string; nome: string }[]
        setAvailableCompanies(filtrarEmpresasAcessoUsuario(companies))
      }
    } catch (error) {
      console.error('Erro ao carregar empresas:', error)
      setAvailableCompanies([])
    }
  }

  const loadUserCompanies = async (userId?: number) => {
    const targetUserId = userId || editingUser?.id
    if (!targetUserId) return
    
    try {
      const response = await api.getUserCompanies(targetUserId)
      if (response.data) {
        const companies = response.data as any[]
        const companyIds = companies.map((c: any) => c.id)
        setUserCompanies(companyIds)
      } else {
        setUserCompanies([])
      }
    } catch (error) {
      console.error('Erro ao carregar empresas do usuário:', error)
      setUserCompanies([])
    }
  }

  const loadUsers = async () => {
    setLoading(true)
    try {
      const response = await api.getUsers()
      if (response.data) {
        // O backend retorna { data: [], total: 0, hasMore: false, skip: 0, take: 16 }
        const usersData = (response.data as any)?.data || (Array.isArray(response.data) ? response.data : [])
        const mappedUsers = usersData.map((user: any) => ({
          id: user.id,
          login: user.login || '',
          nome: user.nome || '',
          cpfCnpj: user.cpfCnpj || null,
          grupoUsuario: user.grupoUsuario?.label || user.grupoUsuario || null,
          status: user.status || 'Ativo',
          dataSaida: user.dataSaida || null
        }))
        setUsers(mappedUsers)
        setCurrentPage(0) // Resetar para primeira página ao carregar
      } else if (response.error) {
        showToast(`Erro ao carregar usuários: ${response.error}`, 'error')
        setUsers([])
      }
    } catch (error) {
      showToast('Erro ao carregar usuários', 'error')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const statusUpper = status.toUpperCase()
    if (statusUpper === 'ATIVO') return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    if (statusUpper === 'DESLIGADO') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
  }

  const handleToggleUser = (userId: number) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleEditUser = async (user: User) => {
    try {
      const response = await api.getUser(user.id)
      if (response.data) {
        const userData = response.data as any
        setEditingUser(user)
        // Converter status de maiúsculas (ATIVO/DESLIGADO) para formato do formulário (Ativo/Desligado)
        const status = userData.status || 'ATIVO'
        const statusFormatted = status === 'ATIVO' ? 'Ativo' : status === 'DESLIGADO' ? 'Desligado' : 'Ativo'
        setFormData({
          login: userData.login || '',
          nome: userData.nome || '',
          email: userData.email || '',
          password: '', // Não preencher senha ao editar
          cpfCnpj: userData.cpfCnpj || '',
          status: statusFormatted as 'Ativo' | 'Desligado',
          grupoUsuarioId: userData.grupoUsuarioId || userData.grupoUsuario?.id || '',
          especialidade: userData.especialidade || '',
        })
        const extra: Record<string, boolean> = {}
        try {
          const permRes = await api.getUserPermissions(user.id)
          const rows = (permRes.data as { screenId?: string; id?: string; hasPermission: boolean }[]) || []
          for (const row of rows) {
            const key = row.screenId || row.id
            if (key && row.hasPermission) extra[key] = true
          }
        } catch {
          /* permissões extras opcionais */
        }
        setUserExtraPermissions(extra)
        setShowCreateModal(true)
      } else if (response.error) {
        showToast(`Erro ao carregar usuário: ${response.error}`, 'error')
      }
    } catch (error) {
      showToast('Erro ao carregar dados do usuário', 'error')
    }
  }

  const handleSaveUser = async () => {
    if (!formData.login.trim() || !formData.nome.trim()) {
      showToast('Login e Nome são obrigatórios', 'error')
      return
    }

    if (!editingUser && !formData.password.trim()) {
      showToast('Senha é obrigatória para novos usuários', 'error')
      return
    }

    setIsSaving(true)
    try {
      const userData: any = {
        login: formData.login.trim(),
        nome: formData.nome.trim(),
        email: formData.email.trim() || undefined,
        status: formData.status.toUpperCase() as 'ATIVO' | 'DESLIGADO',
        especialidade: formData.especialidade || null,
      }
      if (canEditUserGroup) {
        userData.grupoUsuarioId = formData.grupoUsuarioId || undefined
      }

      // Só incluir senha se estiver criando ou se foi preenchida ao editar
      if (!editingUser || formData.password.trim()) {
        userData.password = formData.password.trim()
      }

      let response
      let userId: number
      
      if (editingUser) {
        userId = editingUser.id
        response = await api.updateUser(userId, userData)
        if (response.data) {
          showToast('Usuário atualizado com sucesso!', 'success')
        } else if (response.error) {
          showToast(`Erro ao atualizar: ${response.error}`, 'error')
          return
        }
      } else {
        response = await api.createUser(userData)
        if (response.data) {
          const newUser = response.data as any
          userId = newUser.id
          showToast('Usuário criado com sucesso!', 'success')
        } else if (response.error) {
          showToast(`Erro ao criar: ${response.error}`, 'error')
          return
        } else {
          setIsSaving(false)
          return
        }
      }

      // Salvar empresas relacionadas
      if (userId) {
        try {
          // Obter empresas atuais do usuário
          const currentCompaniesResponse = await api.getUserCompanies(userId)
          const currentCompanies = currentCompaniesResponse.data as any[] || []
          const currentCompanyIds = currentCompanies.map((c: any) => c.id)
          
          // Empresas para adicionar
          const companiesToAdd = userCompanies.filter(id => !currentCompanyIds.includes(id))
          // Empresas para remover
          const companiesToRemove = currentCompanyIds.filter(id => !userCompanies.includes(id))
          
          // Adicionar novas empresas
          for (const companyId of companiesToAdd) {
            await api.addCompanyToUser(userId, companyId)
          }
          
          // Remover empresas desmarcadas
          for (const companyId of companiesToRemove) {
            await api.removeCompanyFromUser(userId, companyId)
          }
        } catch (error) {
          console.error('Erro ao salvar empresas do usuário:', error)
          // Não mostrar erro para o usuário, pois o usuário já foi criado/atualizado
        }

        if (editingUser) {
          const grants: Record<string, boolean> = {}
          for (const [screenId, allowed] of Object.entries(userExtraPermissions)) {
            if (allowed) grants[screenId] = true
          }
          const permRes = await api.updateUserPermissions(userId, grants)
          if (permRes.error) {
            console.error('Erro ao salvar permissões individuais:', permRes.error)
            showToast(`Usuário salvo, mas falhou ao gravar telas extras: ${permRes.error}`, 'error')
          } else if (Object.keys(grants).length > 0) {
            showToast('Telas extras do usuário gravadas.', 'success')
          }
        }
      }

      setEditingUser(null)
      setShowCreateModal(false)
      setUserCompanies([])
      setFormData({
        login: '',
        nome: '',
        email: '',
        password: '',
        cpfCnpj: '',
        status: 'Ativo',
        grupoUsuarioId: '',
        especialidade: '',
      })
      setUserExtraPermissions({})
      setPermissionScreenFilter('')
      loadUsers()
    } catch (error) {
      showToast(editingUser ? 'Erro ao atualizar usuário' : 'Erro ao criar usuário', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCloseModal = () => {
    setShowCreateModal(false)
    setEditingUser(null)
    setUserCompanies([])
    setUserExtraPermissions({})
    setPermissionScreenFilter('')
    setFormData({
      login: '',
      nome: '',
      email: '',
      password: '',
      cpfCnpj: '',
      status: 'Ativo',
      grupoUsuarioId: '',
      especialidade: '',
    })
  }

  const handleDeleteUsers = async () => {
    if (selectedUsers.length === 0) {
      showToast('Selecione pelo menos um usuário para excluir', 'error')
      return
    }
    
    try {
      const response = await api.deleteUsers(selectedUsers)
      if (response.error) {
        showToast(`Erro ao excluir: ${response.error}`, 'error')
      } else {
        showToast(`${selectedUsers.length} usuário(s) excluído(s) com sucesso!`, 'success')
        setSelectedUsers([])
        loadUsers()
      }
    } catch (error) {
      showToast('Erro ao excluir usuários', 'error')
    }
  }


  const [filterColumn, setFilterColumn] = useState<string | null>(null)

  const handleColumnFilterClick = (columnId: string) => {
    setFilterColumn(columnId)
    setSearchValue('')
  }

  const filteredUsers = users.filter(user => {
    if (!searchValue) return true
    const value = searchValue.toLowerCase()
    if (!filterColumn) {
      return (
        user.login.toLowerCase().includes(value) ||
        user.nome.toLowerCase().includes(value) ||
        (user.cpfCnpj || '').toLowerCase().includes(value) ||
        (user.grupoUsuario || '').toLowerCase().includes(value) ||
        user.status.toLowerCase().includes(value)
      )
    }
    switch (filterColumn) {
      case 'id':
        return user.id.toString().includes(value)
      case 'login':
        return user.login.toLowerCase().includes(value)
      case 'nome':
        return user.nome.toLowerCase().includes(value)
      case 'cpfCnpj':
        return (user.cpfCnpj || '').toLowerCase().includes(value)
      case 'grupoUsuario':
        return (user.grupoUsuario || '').toLowerCase().includes(value)
      case 'status':
        return user.status.toLowerCase().includes(value)
      case 'dataSaida':
        return (user.dataSaida || '').includes(value)
      default:
        return true
    }
  })
  const usuarioSelecionado = selectedUsers.length === 1 ? users.find((user) => user.id === selectedUsers[0]) || null : null

  function abrirNovoUsuario() {
    setEditingUser(null)
    setFormData({
      login: '',
      nome: '',
      email: '',
      password: '',
      cpfCnpj: '',
      status: 'Ativo',
      grupoUsuarioId: '',
      especialidade: '',
    })
    setShowCreateModal(true)
  }

  const isUserActive = (status: string) => status.toUpperCase() === 'ATIVO'

  const getEmpresaLabel = () => {
    try {
      const raw = localStorage.getItem('selectedCompany')
      if (!raw) return ''
      const company = JSON.parse(raw) as { codigo?: string; nome?: string }
      if (company.codigo && company.nome) return `${company.codigo} - ${company.nome}`
      return company.nome || company.codigo || ''
    } catch {
      return ''
    }
  }

  const buildReportRows = (): UsuarioRelatorioRow[] =>
    filteredUsers.map((user) => ({
      nome: user.nome || '',
      login: user.login || '',
      ativo: isUserActive(user.status),
      grupo: user.grupoUsuario || '',
    }))

  const reportFileStamp = () => new Date().toISOString().slice(0, 10)

  const downloadBlob = async (blob: Blob, filename: string) => {
    const { baixarArquivo } = await import('@/lib/baixarArquivo')
    return baixarArquivo(blob, filename)
  }

  const csvEscape = (value: string) => {
    const v = value.replace(/"/g, '""')
    return /[;"\n\r]/.test(v) ? `"${v}"` : v
  }

  const handleExportPdf = async () => {
    const rows = buildReportRows()
    if (rows.length === 0) {
      showToast('Não há usuários para exportar', 'error')
      return
    }
    setExportingPdf(true)
    try {
      const blob = await pdf(
        <UsuariosRelatorioPDF
          rows={rows}
          geradoEm={new Date().toISOString()}
          empresaLabel={getEmpresaLabel()}
        />,
      ).toBlob()
      const resultado = await downloadBlob(blob, `relatorio-usuarios-${reportFileStamp()}.pdf`)
      if (resultado === 'aborted') return
      showToast(
        resultado === 'shared' ? 'PDF pronto para salvar ou compartilhar.' : 'Relatório PDF gerado.',
        'success',
      )
    } catch (error) {
      console.error('Erro ao gerar PDF de usuários:', error)
      showToast('Erro ao gerar PDF', 'error')
    } finally {
      setExportingPdf(false)
    }
  }

  const handleExportCsv = async () => {
    const rows = buildReportRows()
    if (rows.length === 0) {
      showToast('Não há usuários para exportar', 'error')
      return
    }
    setExportingCsv(true)
    try {
      const header = ['Nome', 'Login', 'Está Ativo', 'Grupo']
      const lines = [
        header.join(';'),
        ...rows.map((row) =>
          [
            csvEscape(row.nome),
            csvEscape(row.login),
            row.ativo ? 'Sim' : 'Não',
            csvEscape(row.grupo),
          ].join(';'),
        ),
      ]
      const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
        type: 'text/csv;charset=utf-8;',
      })
      const resultado = await downloadBlob(blob, `relatorio-usuarios-${reportFileStamp()}.csv`)
      if (resultado === 'aborted') return
      showToast(
        resultado === 'shared' ? 'CSV pronto para salvar ou compartilhar.' : 'Relatório CSV gerado.',
        'success',
      )
    } catch (error) {
      console.error('Erro ao gerar CSV de usuários:', error)
      showToast('Erro ao gerar CSV', 'error')
    } finally {
      setExportingCsv(false)
    }
  }

  // Paginação client-side
  const totalPages = Math.ceil(filteredUsers.length / pageSize)
  const startIndex = currentPage * pageSize
  const endIndex = startIndex + pageSize
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex)
  const canGoPrevious = currentPage > 0
  const canGoNext = currentPage < totalPages - 1

  const handlePreviousPage = () => {
    if (canGoPrevious) {
      setCurrentPage(prev => prev - 1)
    }
  }

  const handleNextPage = () => {
    if (canGoNext) {
      setCurrentPage(prev => prev + 1)
    }
  }

  const handleGoToPage = (page: number) => {
    if (page >= 0 && page < totalPages) {
      setCurrentPage(page)
    }
  }

  // Resetar página quando filtrar
  useEffect(() => {
    setCurrentPage(0)
  }, [filterColumn, searchValue])

  const getSearchPlaceholder = () => {
    if (!filterColumn) return 'Buscar...'
    const placeholders: Record<string, string> = {
      'id': 'Buscar por ID...',
      'login': 'Buscar por Login...',
      'nome': 'Buscar por Nome...',
      'cpfCnpj': 'Buscar por CPF/CNPJ...',
      'grupoUsuario': 'Buscar por Grupo...',
      'status': 'Buscar por Status...',
      'dataSaida': 'Buscar por Data...'
    }
    return placeholders[filterColumn] || 'Buscar...'
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col bg-[#f5f5f9]">
        <div className="border-b border-[#eee] bg-white px-[15px] py-4">
          <CabecalhoModulo icone={IconeUsuarios} titulo="Usuários" />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
            <p className="text-muted-foreground">Carregando usuários...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div data-ds="ant-mobile-usuarios" className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f5f5f9]">
      <div className="shrink-0 space-y-3 border-b border-[#eee] bg-white px-[15px] py-4">
        <CabecalhoModulo
          icone={IconeUsuarios}
          titulo="Usuários"
          acoes={
            <>
              <button
                type="button"
                onClick={abrirNovoUsuario}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <HiPlus className="h-4 w-4" />
                Criar
              </button>
              {isMobile ? (
                <button
                  type="button"
                  onClick={() => setAcoesAberto(true)}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-[#d0d5dd] bg-white px-4 text-sm font-medium text-[#333] hover:bg-[#f8f9fb]"
                >
                  Ações
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void handleExportPdf()}
                    disabled={exportingPdf || filteredUsers.length === 0}
                    className="inline-flex h-10 items-center justify-center rounded-md border border-[#d0d5dd] bg-white px-3 text-sm font-medium text-[#333] hover:bg-[#f8f9fb] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {exportingPdf ? 'Gerando PDF...' : 'Exportar PDF'}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    disabled={exportingCsv || filteredUsers.length === 0}
                    className="inline-flex h-10 items-center justify-center rounded-md border border-[#d0d5dd] bg-white px-3 text-sm font-medium text-[#333] hover:bg-[#f8f9fb] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {exportingCsv ? 'Gerando CSV...' : 'Exportar CSV'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteUsers()}
                    disabled={selectedUsers.length === 0}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <HiTrash className="h-4 w-4" />
                    Excluir
                  </button>
                </>
              )}
            </>
          }
        />
        <FiltrosColapsaveis>
          <div className="relative min-w-0">
            <HiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#888]" />
            <input
              type="text"
              placeholder={getSearchPlaceholder()}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className={`${campo} pl-9 sm:w-72`}
            />
          </div>
          {filterColumn ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs text-primary">
                Filtrando: {filterColumn === 'id' ? 'ID' : filterColumn === 'login' ? 'Login' : filterColumn === 'nome' ? 'Nome Completo' : filterColumn === 'cpfCnpj' ? 'CPF/CNPJ' : filterColumn === 'grupoUsuario' ? 'Grupo de Usuário' : filterColumn === 'status' ? 'Status' : filterColumn === 'dataSaida' ? 'Data da Saída' : filterColumn}
              </span>
              <button
                type="button"
                onClick={() => {
                  setFilterColumn(null)
                  setSearchValue('')
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#eee] bg-white"
                aria-label="Limpar filtro"
              >
                <HiX className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </FiltrosColapsaveis>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          id="table"
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
        >
        <div className="space-y-3 px-[15px] py-4 md:hidden">
          {paginatedUsers.length === 0 ? (
            <p className="text-sm text-[#888]">Nenhum usuário encontrado</p>
          ) : (
            paginatedUsers.map((user) => (
              <article key={user.id} className={`${card} space-y-3`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={() => handleToggleUser(user.id)}
                    className="mt-1 h-4 w-4 cursor-pointer rounded"
                    aria-label={`Selecionar ${user.nome}`}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="break-words text-[15px] font-medium leading-snug text-[#333]">{user.nome}</p>
                    <p className="break-words text-xs text-[#888]">{user.login}</p>
                    <p className="text-xs text-[#666]">{user.grupoUsuario || 'Sem grupo'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleEditUser(user)}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#eee] bg-white text-primary"
                    aria-label="Editar usuário"
                  >
                    <HiPencil className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between border-t border-[#eee] pt-3">
                  <span className={`rounded px-2 py-1 text-xs font-medium ${getStatusColor(user.status)}`}>
                    {user.status}
                  </span>
                  <span className="text-xs text-[#888]">ID {user.id}</span>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="hidden md:block">
        <table className="w-full border-collapse bg-white">
          <thead className="bg-muted sticky z-10" style={{ top: filterColumn ? '48px' : '0' }}>
            <tr>
              <th className="border-b px-2 py-2 text-center text-xs font-medium text-muted-foreground w-12">
              </th>
              <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                Editar
              </th>
              <th
                className={`hidden border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:bg-accent/50 transition sm:table-cell ${
                  filterColumn === 'id' ? 'bg-primary/20' : ''
                }`}
                onClick={() => handleColumnFilterClick('id')}
              >
                <div className="flex items-center gap-1">
                  <span>ID</span>
                  <div className="flex flex-col">
                    <HiChevronUp className="h-2 w-2" />
                    <HiChevronDown className="h-2 w-2 -mt-1" />
                  </div>
                </div>
              </th>
              <th 
                className={`border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:bg-accent/50 transition ${
                  filterColumn === 'login' ? 'bg-primary/20' : ''
                }`}
                onClick={() => handleColumnFilterClick('login')}
              >
                <div className="flex items-center gap-1">
                  <span>Login</span>
                  <div className="flex flex-col">
                    <HiChevronUp className="h-2 w-2" />
                    <HiChevronDown className="h-2 w-2 -mt-1" />
                  </div>
                </div>
              </th>
              <th 
                className={`border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:bg-accent/50 transition ${
                  filterColumn === 'nome' ? 'bg-primary/20' : ''
                }`}
                onClick={() => handleColumnFilterClick('nome')}
              >
                <div className="flex items-center gap-1">
                  <span className="sm:hidden">Nome</span>
                  <span className="hidden sm:inline">Nome Completo</span>
                  <div className="flex flex-col">
                    <HiChevronUp className="h-2 w-2" />
                    <HiChevronDown className="h-2 w-2 -mt-1" />
                  </div>
                </div>
              </th>
              <th
                className={`hidden border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:bg-accent/50 transition md:table-cell ${
                  filterColumn === 'cpfCnpj' ? 'bg-primary/20' : ''
                }`}
                onClick={() => handleColumnFilterClick('cpfCnpj')}
              >
                <div className="flex items-center gap-1">
                  <span>CPF/CNPJ</span>
                  <div className="flex flex-col">
                    <HiChevronUp className="h-2 w-2" />
                    <HiChevronDown className="h-2 w-2 -mt-1" />
                  </div>
                </div>
              </th>
              <th
                className={`hidden border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:bg-accent/50 transition md:table-cell ${
                  filterColumn === 'grupoUsuario' ? 'bg-primary/20' : ''
                }`}
                onClick={() => handleColumnFilterClick('grupoUsuario')}
              >
                <div className="flex items-center gap-1">
                  <span>Grupo de Usuário</span>
                  <div className="flex flex-col">
                    <HiChevronUp className="h-2 w-2" />
                    <HiChevronDown className="h-2 w-2 -mt-1" />
                  </div>
                </div>
              </th>
              <th 
                className={`border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:bg-accent/50 transition ${
                  filterColumn === 'status' ? 'bg-primary/20' : ''
                }`}
                onClick={() => handleColumnFilterClick('status')}
              >
                <div className="flex items-center gap-1">
                  <span>Status</span>
                  <div className="flex flex-col">
                    <HiChevronUp className="h-2 w-2" />
                    <HiChevronDown className="h-2 w-2 -mt-1" />
                  </div>
                </div>
              </th>
              <th
                className={`hidden border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:bg-accent/50 transition lg:table-cell ${
                  filterColumn === 'dataSaida' ? 'bg-primary/20' : ''
                }`}
                onClick={() => handleColumnFilterClick('dataSaida')}
              >
                <div className="flex items-center gap-1">
                  <span>Data da Saída</span>
                  <div className="flex flex-col">
                    <HiChevronUp className="h-2 w-2" />
                    <HiChevronDown className="h-2 w-2 -mt-1" />
                  </div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-background">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <IconeUsuarios className="h-8 w-8 text-muted-foreground" />
                    <span>{loading ? 'Carregando...' : filteredUsers.length === 0 ? 'Nenhum usuário encontrado' : 'Nenhum usuário nesta página'}</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedUsers.map((user) => (
                <tr key={user.id} className="hover:bg-accent/50 border-b">
                  <td className="px-2 py-2 text-center">
                    <input 
                      type="checkbox" 
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => handleToggleUser(user.id)}
                      className="rounded cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <HiPencil 
                      className="h-4 w-4 text-primary cursor-pointer hover:text-primary/80 transition" 
                      onClick={() => handleEditUser(user)}
                      title="Editar usuário"
                    />
                  </td>
                  <td className="hidden px-4 py-2 text-sm sm:table-cell">{user.id}</td>
                  <td className="px-4 py-2">
                    <span className="text-sm">{user.login}</span>
                  </td>
                  <td className="px-4 py-2 text-sm">{user.nome}</td>
                  <td className="hidden px-4 py-2 text-sm md:table-cell">{user.cpfCnpj || '-'}</td>
                  <td className="hidden px-4 py-2 text-sm md:table-cell">{user.grupoUsuario || '-'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(user.status)}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="hidden px-4 py-2 text-sm lg:table-cell">{user.dataSaida || '-'}</td>
                </tr>
              ))
            )}
            </tbody>
          </table>
        </div>
        </div>

        {!loading && (
          <div className="relative flex shrink-0 flex-col items-start justify-between gap-2 border-t border-[#eee] bg-white px-4 py-2 sm:flex-row sm:items-center">
            <div className="shrink-0 text-xs text-[#888] sm:text-sm">
              {filteredUsers.length > 0
                ? (
                  <>
                    <span className="hidden sm:inline">Página {currentPage + 1} de {totalPages} • Total: {filteredUsers.length} usuário{filteredUsers.length !== 1 ? 's' : ''}</span>
                    <span className="sm:hidden">Pág. {currentPage + 1}/{totalPages} ({filteredUsers.length})</span>
                  </>
                )
                : 'Nenhum usuário encontrado'}
            </div>
            {filteredUsers.length > 0 && totalPages > 1 && (
              <div className="flex w-full items-center justify-center gap-1 sm:absolute sm:left-1/2 sm:w-auto sm:-translate-x-1/2 sm:gap-2">
                <button
                  type="button"
                  onClick={handlePreviousPage}
                  disabled={!canGoPrevious}
                  className="h-8 rounded-md border bg-background px-2 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-sm"
                >
                  <span className="hidden sm:inline">Anterior</span>
                  <span className="sm:hidden">‹</span>
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(isMobile ? 3 : 5, totalPages) }, (_, i) => {
                    let pageNum: number
                    const maxPages = isMobile ? 3 : 5
                    if (totalPages <= maxPages) {
                      pageNum = i
                    } else if (currentPage < Math.floor(maxPages / 2)) {
                      pageNum = i
                    } else if (currentPage > totalPages - Math.ceil(maxPages / 2)) {
                      pageNum = totalPages - maxPages + i
                    } else {
                      pageNum = currentPage - Math.floor(maxPages / 2) + i
                    }
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => handleGoToPage(pageNum)}
                        className={`h-8 rounded-md border px-2 text-xs transition sm:px-3 sm:text-sm ${
                          currentPage === pageNum
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background hover:bg-accent'
                        }`}
                      >
                        {pageNum + 1}
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={!canGoNext}
                  className="h-8 rounded-md border bg-background px-2 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-sm"
                >
                  <span className="hidden sm:inline">Próxima</span>
                  <span className="sm:hidden">›</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Sheet open={acoesAberto} onOpenChange={setAcoesAberto}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-4 pb-8 pt-4 sm:mx-auto sm:max-w-lg">
          <SheetHeader className="mb-4 space-y-1 pr-8 text-left">
            <SheetTitle>Ações do usuário</SheetTitle>
            <SheetDescription>
              {selectedUsers.length === 0
                ? 'Selecione usuários na lista para editar ou excluir.'
                : `${selectedUsers.length} selecionado${selectedUsers.length === 1 ? '' : 's'}.`}
            </SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setAcoesAberto(false)
                abrirNovoUsuario()
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1d4ed8] px-3 py-3 text-sm font-medium text-white"
            >
              <HiPlus className="h-4 w-4" />
              Criar
            </button>
            <button
              type="button"
              disabled={!usuarioSelecionado}
              onClick={() => {
                if (!usuarioSelecionado) return
                setAcoesAberto(false)
                void handleEditUser(usuarioSelecionado)
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#dbeafe] px-3 py-3 text-sm font-medium text-[#1e3a8a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <HiPencil className="h-4 w-4" />
              Editar
            </button>
            <button
              type="button"
              onClick={() => {
                setAcoesAberto(false)
                void handleExportPdf()
              }}
              disabled={exportingPdf || filteredUsers.length === 0}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#eef2f6] px-3 py-3 text-sm font-medium text-[#334155] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exportingPdf ? 'Gerando PDF...' : 'Exportar PDF'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAcoesAberto(false)
                handleExportCsv()
              }}
              disabled={exportingCsv || filteredUsers.length === 0}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#eef2f6] px-3 py-3 text-sm font-medium text-[#334155] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exportingCsv ? 'Gerando CSV...' : 'Exportar CSV'}
            </button>
            <button
              type="button"
              disabled={selectedUsers.length === 0}
              onClick={() => {
                setAcoesAberto(false)
                void handleDeleteUsers()
              }}
              className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#fde8e8] px-3 py-3 text-sm font-medium text-[#b42318] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <HiTrash className="h-4 w-4" />
              Excluir
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-7">
          <div className="relative my-auto flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border/50 bg-white p-4 text-foreground shadow-2xl dark:bg-background sm:p-9">
            <CabecalhoModal
              icone={IconeUsuarios}
              titulo={editingUser ? 'Editar usuário' : 'Criar usuário'}
              acoes={<div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-all hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <HiX className="h-4 w-4" />
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveUser}
                  disabled={isSaving || !formData.login.trim() || !formData.nome.trim() || (!editingUser && !formData.password.trim())}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <HiRefresh className="h-4 w-4" />
                  {isSaving ? (editingUser ? 'Atualizando...' : 'Salvando...') : (editingUser ? 'Atualizar' : 'Salvar')}
                </button>
              </div>}
            />

            <div className="flex-1 overflow-y-auto pr-1 space-y-6">
              <div className="relative overflow-hidden rounded-2xl border border-border/60 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.1)]">
                <ShellCardBackground />
                <div className="relative z-10 space-y-6 p-6 [&_input:not(:disabled)]:!bg-white [&_select:not(:disabled)]:!bg-white [&_input:disabled]:!bg-muted/90 [&_input:disabled]:text-muted-foreground">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <HiUser className="h-5 w-5 text-primary" />
                  <span>Dados do Usuário</span>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-foreground">
                        Login <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Login"
                        value={formData.login}
                        onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                        className="w-full px-4 py-2 border border-border rounded-md bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                        disabled={!!editingUser}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-foreground">
                        Nome Completo <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Nome completo"
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        className="w-full px-4 py-2 border border-border rounded-md bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium mb-2 text-foreground">Especialidade</label>
                      <select
                        value={formData.especialidade}
                        onChange={(e) => setFormData({ ...formData, especialidade: e.target.value })}
                        className="w-full px-4 py-2 border border-border rounded-md bg-white text-foreground"
                      >
                        <option value="">Não informada</option>
                        <option value="ENCANADOR">Encanador</option>
                        <option value="PEDREIRO">Pedreiro</option>
                        <option value="PINTOR">Pintor</option>
                        <option value="ELETRICISTA">Eletricista</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-foreground">
                        Email
                      </label>
                      <input
                        type="email"
                        placeholder="email@exemplo.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-2 border border-border rounded-md bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-foreground">
                        {editingUser ? 'Nova Senha (deixe em branco para manter)' : 'Senha'} {!editingUser && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type="password"
                        placeholder="Senha"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-4 py-2 border border-border rounded-md bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-foreground">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Ativo' | 'Desligado' })}
                        className="w-full px-4 py-2 border border-border rounded-md bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      >
                        <option value="Ativo">Ativo</option>
                        <option value="Desligado">Desligado</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-foreground">
                        Grupo de Usuário
                      </label>
                      <select
                        value={formData.grupoUsuarioId}
                        onChange={(e) => setFormData({ ...formData, grupoUsuarioId: e.target.value })}
                        disabled={!canEditUserGroup}
                        className="w-full px-4 py-2 border border-border rounded-md bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <option value="">Selecione um grupo...</option>
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.label || group.name}
                          </option>
                        ))}
                      </select>
                      {!canEditUserGroup ? (
                        <p className="text-xs text-muted-foreground mt-1">
                          Somente administradores podem alterar o grupo de usuário.
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {editingUser ? (
                    <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Telas extras (só este usuário)</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Marque as telas que este usuário deve ter além (ou independente) do grupo. Não altera o
                          perfil dos demais usuários do mesmo grupo.
                        </p>
                      </div>
                      <div className="relative">
                        <HiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="search"
                          value={permissionScreenFilter}
                          onChange={(e) => setPermissionScreenFilter(e.target.value)}
                          placeholder="Buscar tela..."
                          className="h-10 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm dark:bg-card"
                        />
                      </div>
                      <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border bg-white/90 p-2 dark:bg-card">
                        {filteredPermissionScreens.length === 0 ? (
                          <p className="px-2 py-4 text-center text-sm text-muted-foreground">Nenhuma tela encontrada.</p>
                        ) : (
                          filteredPermissionScreens.map((screen) => {
                            const isParent = !screen.parent
                            return (
                              <label
                                key={screen.id}
                                className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 ${
                                  isParent ? 'font-medium' : 'pl-5'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-border"
                                  checked={Boolean(userExtraPermissions[screen.id])}
                                  onChange={() =>
                                    setUserExtraPermissions((prev) => ({
                                      ...prev,
                                      [screen.id]: !prev[screen.id],
                                    }))
                                  }
                                />
                                <span className="text-sm text-foreground select-none">{screen.label}</span>
                              </label>
                            )
                          })
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
                </div>
              </div>

              {/* Seção Empresas */}
              <div className="relative overflow-hidden rounded-2xl border border-border/60 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.1)]">
                <ShellCardBackground />
                <div className="relative z-10 space-y-4 p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <HiCheck className="h-5 w-5 text-primary" />
                  <span>Empresas Disponíveis</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Clique nas empresas para relacioná-las a este usuário. Se relacionar apenas uma, o acesso será direto. Se relacionar mais de uma, será solicitada a seleção ao fazer login.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                  {availableCompanies.map((company) => {
                    const isSelected = userCompanies.includes(company.id)
                    return (
                      <div
                        key={company.id}
                        onClick={() => {
                          if (isSelected) {
                            setUserCompanies(userCompanies.filter((id) => id !== company.id))
                          } else {
                            setUserCompanies([...userCompanies, company.id])
                          }
                        }}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all bg-white/90 dark:bg-card ${
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-md'
                            : 'border-border hover:border-primary/50 hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                  <HiCheck className="h-3 w-3 text-primary-foreground" />
                                </div>
                              )}
                              <span className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                                {company.codigo}
                              </span>
                            </div>
                            <p className={`text-sm ${isSelected ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                              {company.nome}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {availableCompanies.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Nenhuma empresa disponível
                  </div>
                )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

