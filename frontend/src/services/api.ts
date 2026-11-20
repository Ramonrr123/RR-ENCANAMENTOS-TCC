import { resolveIsAdmin } from '@/lib/admin-access'

const getApiUrl = () => {
  const fallback = import.meta.env.PROD ? '/api' : 'http://127.0.0.1:3001'
  const url = import.meta.env.VITE_API_URL || fallback
  return url.replace(/\/+$/, '')
}

const API_URL = getApiUrl()

function compactUserForStorage(user: any) {
  if (!user || typeof user !== 'object') return user
  const next = { ...user } as Record<string, any>
  const p = next.profileImage
  if (typeof p === 'string' && p.startsWith('data:image/')) {
    delete next.profileImage
  }
  return next
}

function withEffectiveAdmin(user: any) {
  if (!user || typeof user !== 'object') return user
  return { ...user, isAdmin: resolveIsAdmin(user) }
}

export type PermissionsOwner = {
  userId: number
  grupoUsuarioId: string | null
  isAdmin: boolean
}

export function clearAuthSession(): void {
  localStorage.removeItem('access_token')
  localStorage.removeItem('user')
  localStorage.removeItem('permissions')
  localStorage.removeItem('permissionsOwner')
  localStorage.removeItem('selectedCompany')
}

export function savePermissionsForUser(
  user: { id: number; grupoUsuarioId?: string | null; isAdmin?: boolean },
  permissions: Record<string, boolean>,
): void {
  localStorage.setItem('permissions', JSON.stringify(permissions ?? {}))
  const owner: PermissionsOwner = {
    userId: user.id,
    grupoUsuarioId: user.grupoUsuarioId ?? null,
    isAdmin: !!user.isAdmin,
  }
  localStorage.setItem('permissionsOwner', JSON.stringify(owner))
}

export function permissionsBelongToUser(
  user: { id: number; grupoUsuarioId?: string | null; isAdmin?: boolean } | null,
): boolean {
  if (!user) return false
  try {
    const ownerStr = localStorage.getItem('permissionsOwner')
    if (!ownerStr) return false
    const owner = JSON.parse(ownerStr) as PermissionsOwner
    if (owner.userId !== user.id || !!owner.isAdmin !== !!user.isAdmin) return false
    return (owner.grupoUsuarioId ?? null) === (user.grupoUsuarioId ?? null)
  } catch {
    return false
  }
}

export function persistUserStorage(user: any): boolean {
  const normalized = withEffectiveAdmin(user)
  try {
    localStorage.setItem('user', JSON.stringify(normalized))
    return true
  } catch {
    try {
      localStorage.setItem('user', JSON.stringify(compactUserForStorage(normalized)))
      return true
    } catch {
      return false
    }
  }
}

interface ApiResponse<T> {
  data?: T
  error?: string
  status?: number
}

export type FluxoCaixaMes = {
  mes: string
  entradasPrevistas: number
  saidasPrevistas: number
  saldoPrevisto: number
  entradasRealizadas: number
  saidasRealizadas: number
  saldoRealizado: number
}

export type FluxoCaixaRelatorio = {
  de: string
  ate: string
  titulos: number
  meses: FluxoCaixaMes[]
  totais: Omit<FluxoCaixaMes, 'mes'>
}

class ApiService {
  private getAuthToken(): string | null {
    return localStorage.getItem('access_token')
  }

  private getSelectedCompanyCode(): string | null {
    try {
      const raw = localStorage.getItem('selectedCompany')
      if (!raw) return null
      return (JSON.parse(raw) as { codigo?: string }).codigo || null
    } catch {
      return null
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const token = this.getAuthToken()
    if (token === 'preview-local') return { data: null as T }
    const empcod = this.getSelectedCompanyCode()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    }
    if (token) headers.Authorization = `Bearer ${token}`
    if (empcod) headers['X-Empresa-Codigo'] = empcod

    try {
      const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
      const response = await fetch(`${API_URL}${normalizedEndpoint}`, { ...options, headers })

      if (!response.ok) {
        let errorData: any
        try {
          const text = await response.text()
          errorData = text ? JSON.parse(text) : { message: response.statusText }
        } catch {
          errorData = { message: response.statusText }
        }
        let errorMessage = errorData.message || response.statusText
        if (Array.isArray(errorMessage)) errorMessage = errorMessage.join(', ')
        if (response.status >= 500) {
          errorMessage =
            typeof errorMessage === 'string' && errorMessage.trim() && response.status === 503
              ? errorMessage
              : 'O banco de dados está indisponível no momento. Tente novamente em breve.'
        }
        if (
          response.status === 401 &&
          !window.location.pathname.includes('/login') &&
          localStorage.getItem('access_token') !== 'preview-local'
        ) {
          clearAuthSession()
          window.location.href = '/login'
        }
        return { error: errorMessage || `Erro ${response.status}`, status: response.status }
      }

      const text = await response.text()
      if (!text || text.trim() === '') return { data: null as T }
      try {
        return { data: JSON.parse(text) }
      } catch {
        return { error: 'Resposta inválida do servidor' }
      }
    } catch (error) {
      const semServidor = error instanceof TypeError
      return {
        error: semServidor
          ? 'Não foi possível falar com o servidor. Verifique a internet e tente de novo.'
          : error instanceof Error
            ? error.message
            : 'Erro desconhecido',
      }
    }
  }

  async changePassword(senhaAtual: string, novaSenha: string) {
    return this.request<{ ok: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ senhaAtual, novaSenha }),
    })
  }

  async login(email: string, password: string) {
    clearAuthSession()
    const response = await this.request<{ access_token: string; user: any; permissions?: Record<string, boolean> }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    )
    if (response.data?.access_token) {
      localStorage.setItem('access_token', response.data.access_token)
      persistUserStorage(response.data.user)
      const permissionsRaw = response.data.permissions ?? {}
      const permissions =
        permissionsRaw && typeof permissionsRaw === 'object' && !Array.isArray(permissionsRaw)
          ? Object.fromEntries(Object.entries(permissionsRaw as Record<string, boolean>).filter(([, v]) => Boolean(v)))
          : {}
      savePermissionsForUser(response.data.user, permissions)
    }
    return response
  }

  logout() {
    clearAuthSession()
  }

  async heartbeat() {
    return this.request<{ ok: boolean; access_token?: string }>('/auth/heartbeat', { method: 'POST' })
  }

  async encerrarMinhaSessao() {
    return this.request<{ ok: boolean }>('/auth/logout', { method: 'POST' })
  }

  async listarSessoes(filtros?: { busca?: string; situacao?: string }) {
    const params = new URLSearchParams()
    if (filtros?.busca) params.set('busca', filtros.busca)
    if (filtros?.situacao) params.set('situacao', filtros.situacao)
    const query = params.toString()
    return this.request<{ emUso: number; abertas: number; sessoes: any[] }>(
      `/auth/sessions${query ? `?${query}` : ''}`,
    )
  }

  async encerrarSessoes(ids: string[]) {
    return this.request<{ count: number }>('/auth/sessions/encerrar', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  }

  async getUsers(filters?: { search?: string; status?: string; grupoUsuarioId?: string }) {
    const params = new URLSearchParams()
    if (filters?.search) params.append('search', filters.search)
    if (filters?.status) params.append('status', filters.status)
    if (filters?.grupoUsuarioId) params.append('grupoUsuarioId', filters.grupoUsuarioId)
    const query = params.toString()
    return this.request(`/users${query ? `?${query}` : ''}`)
  }

  async getUser(id: number) {
    return this.request(`/users/${id}`)
  }

  async createUser(userData: any) {
    return this.request('/users', { method: 'POST', body: JSON.stringify(userData) })
  }

  async updateUser(id: number, userData: any) {
    return this.request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(userData) })
  }

  async deleteUser(id: number) {
    return this.request(`/users/${id}`, { method: 'DELETE' })
  }

  async deleteUsers(ids: number[]) {
    return this.request('/users/delete-many', { method: 'POST', body: JSON.stringify({ ids }) })
  }

  async getGroups() {
    return this.request('/groups')
  }

  async getGroup(id: string) {
    return this.request(`/groups/${id}`)
  }

  async createGroup(groupData: { name: string; label: string; description?: string }) {
    return this.request('/groups', { method: 'POST', body: JSON.stringify(groupData) })
  }

  async updateGroup(id: string, groupData: { name?: string; label?: string; description?: string }) {
    return this.request(`/groups/${id}`, { method: 'PATCH', body: JSON.stringify(groupData) })
  }

  async deleteGroup(id: string) {
    return this.request(`/groups/${id}`, { method: 'DELETE' })
  }

  async getProfile() {
    return this.request('/users/me')
  }

  async updateProfile(profileData: any) {
    return this.request('/users/me', { method: 'PATCH', body: JSON.stringify(profileData) })
  }

  async getGroupPermissions(groupId: string) {
    return this.request(`/permissions/group/${groupId}`)
  }

  async getMyPermissions() {
    return this.request<Array<{ id?: string; screenId?: string; hasPermission: boolean }>>('/permissions/me')
  }

  async updatePermissions(groupId: string, permissions: Record<string, boolean>) {
    return this.request('/permissions', {
      method: 'POST',
      body: JSON.stringify({ userGroupId: groupId, permissions }),
    })
  }

  async getUserPermissions(userId: number) {
    return this.request<Array<{ screenId: string; hasPermission: boolean }>>(`/permissions/user/${userId}`)
  }

  async updateUserPermissions(userId: number, permissions: Record<string, boolean>) {
    return this.request('/permissions/user', {
      method: 'POST',
      body: JSON.stringify({ usuarioId: userId, permissions }),
    })
  }

  async getScreens() {
    return this.request('/screens')
  }

  async syncScreens(screensData: Array<{
    screenId: string
    label: string
    parentId?: string | null
    moduleId?: string
    order?: number
  }>) {
    return this.request('/screens/sync', { method: 'POST', body: JSON.stringify(screensData) })
  }

  async getCompanies(includeInactive?: boolean) {
    const params = new URLSearchParams()
    if (includeInactive) params.append('includeInactive', 'true')
    const query = params.toString()
    return this.request(`/companies${query ? `?${query}` : ''}`)
  }

  async getUserCompanies(userId: number) {
    return this.request(`/companies/user/${userId}`)
  }

  async createCompany(data: { codigo: string; nome: string; ativo?: boolean }) {
    return this.request('/companies', { method: 'POST', body: JSON.stringify(data) })
  }

  async updateCompany(id: number, data: { codigo?: string; nome?: string; ativo?: boolean }) {
    return this.request(`/companies/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
  }

  async deleteCompany(id: number) {
    return this.request(`/companies/${id}`, { method: 'DELETE' })
  }

  async updateUserCompanies(userId: number, companyIds: number[]) {
    return this.request(`/companies/user/${userId}/companies`, {
      method: 'POST',
      body: JSON.stringify({ companyIds }),
    })
  }

  async addCompanyToUser(userId: number, companyId: number) {
    return this.request(`/companies/user/${userId}/company/${companyId}`, { method: 'POST' })
  }

  async removeCompanyFromUser(userId: number, companyId: number) {
    return this.request(`/companies/user/${userId}/company/${companyId}`, { method: 'DELETE' })
  }

  async getTitulos(tipo: 'PAGAR' | 'RECEBER') {
    return this.request<any[]>(`/financeiro/titulos?tipo=${tipo}`)
  }

  async createTitulo(data: Record<string, unknown>) {
    return this.request<any[]>('/financeiro/titulos', { method: 'POST', body: JSON.stringify(data) })
  }

  async updateTitulo(id: number, data: Record<string, unknown>) {
    return this.request(`/financeiro/titulos/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
  }

  async deleteTitulos(ids: number[]) {
    return this.request<{ count: number }>('/financeiro/titulos/delete-many', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  }

  async getFluxoCaixa(de: string, ate: string) {
    const query = new URLSearchParams({ de, ate })
    return this.request<FluxoCaixaRelatorio>(`/financeiro/fluxo-caixa?${query}`)
  }

  async getProdutos() {
    return this.request<any[]>('/produtos')
  }

  async createProduto(data: Record<string, unknown>) {
    return this.request('/produtos', { method: 'POST', body: JSON.stringify(data) })
  }

  async updateProduto(id: number, data: Record<string, unknown>) {
    return this.request(`/produtos/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
  }

  async deleteProdutos(ids: number[]) {
    return this.request<{ count: number }>('/produtos/delete-many', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  }

  async getMovimentosEstoque() {
    return this.request<any[]>('/estoque/movimentos')
  }

  async getSaldosEstoque(local?: string) {
    const consulta = local ? `?local=${encodeURIComponent(local)}` : ''
    return this.request<any[]>(`/estoque/movimentos/saldos${consulta}`)
  }

  async getAlertasEstoque() {
    return this.request<any[]>('/estoque/movimentos/alertas')
  }

  async transferirEstoque(data: { produtoId: number; deLocalId: number; paraLocalId: number; quantidade: number; motivo: string }) {
    return this.request('/estoque/movimentos/transferir', { method: 'POST', body: JSON.stringify(data) })
  }

  async ajustarEstoque(data: { produtoId: number; localId: number; quantidadeContada: number; motivo: string }) {
    return this.request('/estoque/movimentos/ajuste', { method: 'POST', body: JSON.stringify(data) })
  }

  async createMovimentoEstoque(data: Record<string, unknown>) {
    return this.request('/estoque/movimentos', { method: 'POST', body: JSON.stringify(data) })
  }

  async updateMovimentoEstoque(id: number, data: Record<string, unknown>) {
    return this.request(`/estoque/movimentos/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
  }

  async deleteMovimentosEstoque(ids: number[]) {
    return this.request<{ count: number }>('/estoque/movimentos/delete-many', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  }

  async getTarefas() {
    return this.request<any[]>('/tarefas')
  }

  async createTarefa(data: Record<string, unknown>) {
    return this.request<any>('/tarefas', { method: 'POST', body: JSON.stringify(data) })
  }

  async updateTarefa(id: number, data: Record<string, unknown>) {
    return this.request<any>(`/tarefas/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
  }

  async deleteTarefas(ids: number[]) {
    return this.request<{ count: number }>('/tarefas/delete-many', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  }

  async getClientes() {
    return this.request<any[]>('/ordens/clientes')
  }

  async createCliente(data: Record<string, unknown>) {
    return this.request<any>('/ordens/clientes', { method: 'POST', body: JSON.stringify(data) })
  }

  async updateCliente(id: number, data: Record<string, unknown>) {
    return this.request<any>(`/ordens/clientes/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
  }

  async deleteClientes(ids: number[]) {
    return this.request<{ count: number }>('/ordens/clientes/delete-many', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  }

  async getOrdens(filtros?: {
    situacao?: string
    de?: string
    ate?: string
    funcionarioId?: string
    clienteId?: string
    tipo?: string
  }) {
    const params = new URLSearchParams()
    if (filtros?.situacao) params.set('situacao', filtros.situacao)
    if (filtros?.de) params.set('de', filtros.de)
    if (filtros?.ate) params.set('ate', filtros.ate)
    if (filtros?.funcionarioId) params.set('funcionarioId', filtros.funcionarioId)
    if (filtros?.clienteId) params.set('clienteId', filtros.clienteId)
    if (filtros?.tipo) params.set('tipo', filtros.tipo)
    const consulta = params.toString()
    return this.request<any[]>(`/ordens${consulta ? `?${consulta}` : ''}`)
  }

  async getFuncionariosOrdem() {
    return this.request<any[]>('/ordens/funcionarios')
  }

  async garantiaVigente(filtro: {
    enderecoId?: number
    chamadoId?: number
    logradouro?: string
    numero?: string
    cidade?: string
    excetoId?: number
  }) {
    const params = new URLSearchParams()
    if (filtro.enderecoId) params.set('enderecoId', String(filtro.enderecoId))
    if (filtro.chamadoId) params.set('chamadoId', String(filtro.chamadoId))
    if (filtro.logradouro) params.set('logradouro', filtro.logradouro)
    if (filtro.numero) params.set('numero', filtro.numero)
    if (filtro.cidade) params.set('cidade', filtro.cidade)
    if (filtro.excetoId) params.set('excetoId', String(filtro.excetoId))
    return this.request<Array<{ id: number; numero: number; servicos: string; garantiaAte: string | null }>>(
      `/ordens/garantia?${params.toString()}`,
    )
  }

  async getPreventivas(filtro?: { de?: string; ate?: string; q?: string }) {
    const params = new URLSearchParams()
    if (filtro?.de) params.set('de', filtro.de)
    if (filtro?.ate) params.set('ate', filtro.ate)
    if (filtro?.q) params.set('q', filtro.q)
    const consulta = params.toString()
    return this.request<
      Array<{
        id: number
        numero: number
        clienteId: number
        cliente: string
        telefone: string
        enderecoId: number | null
        endereco: string
        preventivaEm: string | null
        status: 'a_contatar' | 'contatado' | 'agendada'
        ordemAbertaId: number | null
      }>
    >(`/ordens/preventivas${consulta ? `?${consulta}` : ''}`)
  }

  async atualizarPreventiva(id: number, status: 'a_contatar' | 'contatado' | 'agendada') {
    return this.request<{ id: number; status: string }>(`/ordens/preventivas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  }

  async historicoCliente(id: number, enderecoId?: number) {
    const consulta = enderecoId ? `?enderecoId=${enderecoId}` : ''
    return this.request<any[]>(`/ordens/clientes/${id}/historico${consulta}`)
  }

  async getAgenda(de: string, ate: string) {
    return this.request<any[]>(`/agenda?de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`)
  }

  async getPainel() {
    return this.request<any>('/agenda/painel')
  }

  async criarAgendamento(data: { ordemId: number; funcionarioId: number; inicio: string; fim: string }) {
    return this.request<any>('/agenda', { method: 'POST', body: JSON.stringify(data) })
  }

  async atualizarAgendamento(id: number, data: { ordemId: number; funcionarioId: number; inicio: string; fim: string }) {
    return this.request<any>(`/agenda/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
  }

  async createOrdem(data: Record<string, unknown>) {
    return this.request<any>('/ordens', { method: 'POST', body: JSON.stringify(data) })
  }

  async updateOrdem(id: number, data: Record<string, unknown>) {
    return this.request<any>(`/ordens/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
  }

  async deleteOrdens(ids: number[]) {
    return this.request<{ count: number }>('/ordens/delete-many', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  }

  async encerrarOrdem(id: number, data: Record<string, unknown>) {
    return this.request<any>(`/ordens/${id}/encerrar`, { method: 'POST', body: JSON.stringify(data) })
  }

  async concluirOrdem(id: number) {
    return this.request<any>(`/ordens/${id}/concluir`, { method: 'POST', body: JSON.stringify({}) })
  }

  async cancelarOrdem(id: number, motivo: string) {
    return this.request<any>(`/ordens/${id}/cancelar`, { method: 'POST', body: JSON.stringify({ motivo }) })
  }

  async adicionarFotoOrdem(id: number, data: { momento: 'ANTES' | 'DEPOIS'; url: string }) {
    return this.request<any>(`/ordens/${id}/fotos`, { method: 'POST', body: JSON.stringify(data) })
  }

  async getDevedores() {
    return this.request<{
      hoje: string
      quantidade: number
      saldo: number
      pessoas: Array<{
        nome: string
        quantidade: number
        saldo: number
        parcelas: Array<{
          id: number
          numeroDocumento: string
          parcela: string
          dataVencimento: string
          valor: number
          valorBaixado: number
          saldo: number
          diasAtraso: number
        }>
      }>
    }>('/financeiro/devedores')
  }

  async getAtividades(filtros?: { usuarioId?: string; acao?: string; de?: string; ate?: string }) {
    const query = new URLSearchParams()
    if (filtros?.usuarioId) query.set('usuarioId', filtros.usuarioId)
    if (filtros?.acao) query.set('acao', filtros.acao)
    if (filtros?.de) query.set('de', filtros.de)
    if (filtros?.ate) query.set('ate', filtros.ate)
    const texto = query.toString()
    return this.request<
      Array<{
        id: number
        usuarioId: number | null
        login: string
        acao: string
        caminho: string
        metodo: string
        objeto: string
        criadoEm: string
      }>
    >(`/atividades${texto ? `?${texto}` : ''}`)
  }

  async getRelatorioOrdens(filtros?: { de?: string; ate?: string; situacao?: string }) {
    const query = new URLSearchParams()
    if (filtros?.de) query.set('de', filtros.de)
    if (filtros?.ate) query.set('ate', filtros.ate)
    if (filtros?.situacao) query.set('situacao', filtros.situacao)
    const texto = query.toString()
    return this.request<{
      de: string | null
      ate: string | null
      situacao: string | null
      linhas: Array<{
        numero: number
        cliente: string
        situacao: string
        dataAbertura: string
        dataEncerramento: string | null
        garantiaAte: string | null
        total: number
        entrada: number
        saldoParcelado: number
        taxa: number
        maoDeObra: number
        deslocamento: number
        material: number
      }>
    }>(`/relatorios/ordens${texto ? `?${texto}` : ''}`)
  }

  async getRelatorioEstoque() {
    return this.request<{
      linhas: Array<{ codigo: string; descricao: string; unidade: string; estoque: number }>
    }>('/relatorios/estoque')
  }

  async baixarCsv(endpoint: string, nome: string) {
    const token = this.getAuthToken()
    if (token === 'preview-local') return { error: 'Exportação indisponível na pré-visualização.' }
    const empcod = this.getSelectedCompanyCode()
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    if (empcod) headers['X-Empresa-Codigo'] = empcod
    const caminho = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    try {
      const response = await fetch(`${API_URL}${caminho}`, { headers })
      if (!response.ok) {
        let errorMessage = response.statusText
        try {
          const text = await response.text()
          const data = text ? JSON.parse(text) : null
          if (data?.message) errorMessage = Array.isArray(data.message) ? data.message.join(', ') : data.message
        } catch {
          /* o corpo de erro pode não ser JSON */
        }
        return { error: errorMessage || `Erro ${response.status}`, status: response.status }
      }
      const blob = await response.blob()
      const { baixarArquivo } = await import('@/lib/baixarArquivo')
      const resultado = await baixarArquivo(blob, nome)
      if (resultado === 'aborted') return { error: 'Download cancelado' }
      return { data: { ok: true as const } }
    } catch (error) {
      const semServidor = error instanceof TypeError
      return {
        error: semServidor
          ? 'Não foi possível falar com o servidor. Verifique a internet e tente de novo.'
          : error instanceof Error
            ? error.message
            : 'Erro desconhecido',
      }
    }
  }

  listarChamados(filtro?: { origem?: string }) {
    const query = new URLSearchParams()
    if (filtro?.origem && filtro.origem !== 'todas') query.set('origem', filtro.origem)
    const texto = query.toString()
    return this.request<ChamadoResumo[]>(`/chamados${texto ? `?${texto}` : ''}`)
  }

  getChamadosOrigem30d() {
    return this.request<{ whatsapp: number; site: number; indicacao: number; outro: number; dias: number }>(
      '/chamados/resumo/origem-30d',
    )
  }

  getGarantias(filtro?: { de?: string; ate?: string; q?: string; vencidas?: boolean }) {
    const query = new URLSearchParams()
    if (filtro?.de) query.set('de', filtro.de)
    if (filtro?.ate) query.set('ate', filtro.ate)
    if (filtro?.q) query.set('q', filtro.q)
    if (filtro?.vencidas) query.set('vencidas', '1')
    const texto = query.toString()
    return this.request<
      Array<{
        id: number
        numero: number
        clienteId: number
        cliente: string
        telefone: string
        enderecoId: number | null
        endereco: string
        servicos: string
        dataEncerramento: string | null
        garantiaAte: string | null
        diasRestantes: number
        ordemAbertaId: number | null
      }>
    >(`/ordens/garantias${texto ? `?${texto}` : ''}`)
  }

  getControleRecebimentos(filtro?: { de?: string; ate?: string; situacao?: string }) {
    const query = new URLSearchParams()
    if (filtro?.de) query.set('de', filtro.de)
    if (filtro?.ate) query.set('ate', filtro.ate)
    if (filtro?.situacao) query.set('situacao', filtro.situacao)
    const texto = query.toString()
    return this.request<{
      totais: { aReceber: number; recebidoMes: number; vencido: number }
      linhas: Array<{
        ordemId: number
        numero: number
        cliente: string
        total: number
        entrada: number
        saldo: number
        situacao: string
        parcelas: Array<{ valor: number; vencimento: string | null; status: string }>
      }>
    }>(`/financeiro/controle-recebimentos${texto ? `?${texto}` : ''}`)
  }

  detalheChamado(id: number) {
    return this.request<ChamadoDetalhe>(`/chamados/${id}`)
  }

  atualizarChamado(id: number, status: ChamadoResumo['status']) {
    return this.request<ChamadoDetalhe>(`/chamados/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
  }

  notaChamado(id: number, texto: string) {
    return this.request<ChamadoDetalhe>(`/chamados/${id}/notas`, { method: 'POST', body: JSON.stringify({ texto }) })
  }

  tarefaChamado(id: number, tarefa: { titulo: string; descricao: string; responsaveis: string[]; prazo: string; prioridade: string; status: string }) {
    return this.request<ChamadoDetalhe>(`/chamados/${id}/tarefas`, { method: 'POST', body: JSON.stringify(tarefa) })
  }

  fotoChamado(id: number, foto: { situacao: string; url: string }) {
    return this.request<ChamadoDetalhe>(`/chamados/${id}/fotos`, { method: 'POST', body: JSON.stringify(foto) })
  }

  gerarOrdemChamado(id: number) {
    return this.request<ChamadoDetalhe>(`/chamados/${id}/ordem`, { method: 'POST' })
  }

  anonimizarChamado(id: number) {
    return this.request<ChamadoDetalhe>(`/chamados/${id}/anonimizar`, { method: 'POST' })
  }
}

export type ChamadoResumo = {
  id: number
  numero: number
  nome: string
  telefone: string
  tipo: string
  descricao: string
  status: 'ABERTO' | 'EM_ATENDIMENTO' | 'RESOLVIDO'
  whatsapp: string
  origem?: string
  createdAt: string
  ordemId: number | null
  ordemNumero: number | null
  notas: number
}

export type ChamadoDetalhe = {
  id: number
  numero: number
  nome: string
  telefone: string
  whatsapp: string
  origem?: string
  linkWhatsapp?: string | null
  cep: string
  logradouro: string
  numeroEndereco: string
  bairro: string
  cidade: string
  uf: string
  tipo: string
  descricao: string
  status: ChamadoResumo['status']
  createdAt: string
  ordem: { id: number; numero: number; situacao: string } | null
  notas: { id: number; texto: string; autor: string; createdAt: string }[]
  tarefas: {
    id: number
    titulo: string
    descricao: string
    canal: string | null
    horario: string | null
    prazo: string
    prioridade: string
    status: string
    responsaveis: string[]
    createdAt: string
  }[]
  fotos: { id: number; situacao: string; url: string; createdAt: string }[]
}

export const api = new ApiService()
