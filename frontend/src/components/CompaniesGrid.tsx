import { useEffect, useState } from 'react'
import { HiPencil, HiPlus, HiTrash } from 'react-icons/hi'
import { api } from '@/services/api'
import { useIsMobile } from '@/hooks/use-mobile'
import { CabecalhoModal, CabecalhoModulo, IconeEmpresas } from '@/components/icones/IconesErp'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface Company {
  id: number
  codigo: string
  nome: string
  ativo: boolean
}

interface CompaniesGridProps {
  showToast: (message: string, type?: 'success' | 'error') => void
}

const campo = 'h-11 w-full min-w-0 rounded-md border border-[#eee] bg-white px-3 text-sm text-[#333]'
const card = 'rounded-md border border-[#ddd] bg-white p-4'

export function CompaniesGrid({ showToast }: CompaniesGridProps) {
  const isMobile = useIsMobile()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize] = useState(16)
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([])
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [acoesAberto, setAcoesAberto] = useState(false)
  const [formData, setFormData] = useState({
    codigo: '',
    nome: '',
    ativo: true,
  })

  useEffect(() => {
    loadCompanies()
  }, [])

  const loadCompanies = async () => {
    setLoading(true)
    try {
      const response = await api.getCompanies(true)
      if (response.data) {
        setCompanies(response.data as Company[])
      } else if (response.error) {
        showToast(`Erro ao carregar empresas: ${response.error}`, 'error')
        setCompanies([])
      }
    } catch {
      showToast('Erro ao carregar empresas', 'error')
      setCompanies([])
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(companies.length / pageSize))
  const startIndex = currentPage * pageSize
  const endIndex = startIndex + pageSize
  const paginatedCompanies = companies.slice(startIndex, endIndex)
  const canGoPrevious = currentPage > 0
  const canGoNext = currentPage < totalPages - 1
  const empresaSelecionada =
    selectedCompanies.length === 1
      ? companies.find((company) => company.id === selectedCompanies[0]) || null
      : null

  const handlePreviousPage = () => {
    if (canGoPrevious) setCurrentPage((prev) => prev - 1)
  }

  const handleNextPage = () => {
    if (canGoNext) setCurrentPage((prev) => prev + 1)
  }

  const handleGoToPage = (page: number) => {
    if (page >= 0 && page < totalPages) setCurrentPage(page)
  }

  const handleToggleCompany = (companyId: number) => {
    setSelectedCompanies((prev) =>
      prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId],
    )
  }

  const handleEditCompany = (company: Company) => {
    setEditingCompany(company)
    setFormData({
      codigo: company.codigo,
      nome: company.nome,
      ativo: company.ativo,
    })
    setShowCreateModal(true)
  }

  const handleCreateCompany = () => {
    setEditingCompany(null)
    setFormData({
      codigo: '',
      nome: '',
      ativo: true,
    })
    setShowCreateModal(true)
  }

  const handleCloseModal = () => {
    setShowCreateModal(false)
    setEditingCompany(null)
  }

  const handleSaveCompany = async () => {
    if (!formData.codigo.trim() || !formData.nome.trim()) {
      showToast('Código e Nome são obrigatórios', 'error')
      return
    }

    setIsSaving(true)
    try {
      let response
      if (editingCompany) {
        response = await api.updateCompany(editingCompany.id, {
          codigo: formData.codigo.trim(),
          nome: formData.nome.trim(),
          ativo: formData.ativo,
        })
        if (response.data) showToast('Empresa atualizada com sucesso!', 'success')
        else if (response.error) showToast(`Erro ao atualizar empresa: ${response.error}`, 'error')
      } else {
        response = await api.createCompany({
          codigo: formData.codigo.trim(),
          nome: formData.nome.trim(),
          ativo: formData.ativo,
        })
        if (response.data) showToast('Empresa criada com sucesso!', 'success')
        else if (response.error) showToast(`Erro ao criar empresa: ${response.error}`, 'error')
      }

      if (response.data) {
        handleCloseModal()
        loadCompanies()
      }
    } catch {
      showToast('Erro ao salvar empresa', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteCompanies = async () => {
    if (selectedCompanies.length === 0) {
      showToast('Selecione pelo menos uma empresa para excluir', 'error')
      return
    }

    if (!confirm(`Tem certeza que deseja excluir ${selectedCompanies.length} empresa(s)?`)) {
      return
    }

    try {
      for (const id of selectedCompanies) {
        await api.deleteCompany(id)
      }
      showToast(`${selectedCompanies.length} empresa(s) excluída(s) com sucesso!`, 'success')
      setSelectedCompanies([])
      loadCompanies()
    } catch {
      showToast('Erro ao excluir empresas', 'error')
    }
  }

  const getStatusColor = (ativo: boolean) =>
    ativo
      ? 'bg-green-100 text-green-800'
      : 'bg-gray-100 text-gray-800'

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f5f5f9] p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-sm text-[#888]">Carregando empresas...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      data-ds="ant-mobile-empresas"
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f5f5f9]"
    >
      <div className="shrink-0 border-b border-[#eee] bg-white px-[15px] py-4">
        <CabecalhoModulo
          icone={IconeEmpresas}
          titulo="Empresas"
          acoes={
            <>
              <button
                type="button"
                onClick={handleCreateCompany}
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
                <button
                  type="button"
                  onClick={() => void handleDeleteCompanies()}
                  disabled={selectedCompanies.length === 0}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <HiTrash className="h-4 w-4" />
                  Excluir{selectedCompanies.length > 0 ? ` (${selectedCompanies.length})` : ''}
                </button>
              )}
            </>
          }
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
          <div className="space-y-3 px-[15px] py-4 md:hidden">
            {paginatedCompanies.length === 0 ? (
              <p className="text-sm text-[#888]">Nenhuma empresa cadastrada</p>
            ) : (
              paginatedCompanies.map((company) => (
                <article key={company.id} className={`${card} space-y-3`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedCompanies.includes(company.id)}
                      onChange={() => handleToggleCompany(company.id)}
                      className="mt-1 h-4 w-4 cursor-pointer rounded"
                      aria-label={`Selecionar ${company.nome}`}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="break-words text-[15px] font-medium leading-snug text-[#333]">
                        {company.nome}
                      </p>
                      <p className="break-words text-xs text-[#888]">
                        Código {company.codigo} · ID {company.id}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleEditCompany(company)}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#eee] bg-white text-primary"
                      aria-label="Editar empresa"
                    >
                      <HiPencil className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="border-t border-[#eee] pt-3">
                    <span className={`inline-flex whitespace-nowrap rounded px-2 py-1 text-xs font-medium ${getStatusColor(company.ativo)}`}>
                      {company.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="hidden md:block">
            <table className="w-full border-collapse bg-white">
              <thead className="sticky top-0 z-10 bg-muted">
                <tr>
                  <th className="w-12 border-b px-2 py-2" />
                  <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">Editar</th>
                  <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">ID</th>
                  <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">Código</th>
                  <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">Nome</th>
                  <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCompanies.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma empresa cadastrada
                    </td>
                  </tr>
                ) : (
                  paginatedCompanies.map((company) => (
                    <tr key={company.id} className="border-b hover:bg-accent/50">
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedCompanies.includes(company.id)}
                          onChange={() => handleToggleCompany(company.id)}
                          className="cursor-pointer rounded"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => handleEditCompany(company)}
                          aria-label="Editar empresa"
                        >
                          <HiPencil className="h-4 w-4 text-primary" />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm">{company.id}</td>
                      <td className="px-4 py-3 text-sm font-medium">{company.codigo}</td>
                      <td className="break-words px-4 py-3 text-sm">{company.nome}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex whitespace-nowrap rounded px-2 py-1 text-xs font-medium ${getStatusColor(company.ativo)}`}>
                          {company.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="relative flex shrink-0 flex-col items-start justify-between gap-2 border-t border-[#eee] bg-white px-4 py-2 sm:flex-row sm:items-center">
          <div className="shrink-0 text-xs text-[#888] sm:text-sm">
            {companies.length > 0 ? (
              <>
                <span className="hidden sm:inline">
                  Página {currentPage + 1} de {totalPages} • Total: {companies.length} empresa
                  {companies.length !== 1 ? 's' : ''}
                </span>
                <span className="sm:hidden">
                  Pág. {currentPage + 1}/{totalPages} ({companies.length})
                </span>
              </>
            ) : (
              'Nenhuma empresa encontrada'
            )}
          </div>
          {companies.length > 0 && totalPages > 1 && (
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
                  if (totalPages <= maxPages) pageNum = i
                  else if (currentPage < Math.floor(maxPages / 2)) pageNum = i
                  else if (currentPage > totalPages - Math.ceil(maxPages / 2))
                    pageNum = totalPages - maxPages + i
                  else pageNum = currentPage - Math.floor(maxPages / 2) + i

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
      </div>

      <Sheet open={acoesAberto} onOpenChange={setAcoesAberto}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-4 pb-8 pt-4 sm:mx-auto sm:max-w-lg">
          <SheetHeader className="mb-4 space-y-1 pr-8 text-left">
            <SheetTitle>Ações da empresa</SheetTitle>
            <SheetDescription>
              {selectedCompanies.length === 0
                ? 'Selecione empresas na lista para editar ou excluir.'
                : `${selectedCompanies.length} selecionada${selectedCompanies.length === 1 ? '' : 's'}.`}
            </SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setAcoesAberto(false)
                handleCreateCompany()
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1d4ed8] px-3 py-3 text-sm font-medium text-white"
            >
              <HiPlus className="h-4 w-4" />
              Criar
            </button>
            <button
              type="button"
              disabled={!empresaSelecionada}
              onClick={() => {
                if (!empresaSelecionada) return
                setAcoesAberto(false)
                handleEditCompany(empresaSelecionada)
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#dbeafe] px-3 py-3 text-sm font-medium text-[#1e3a8a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <HiPencil className="h-4 w-4" />
              Editar
            </button>
            <button
              type="button"
              disabled={selectedCompanies.length === 0}
              onClick={() => {
                setAcoesAberto(false)
                void handleDeleteCompanies()
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-background p-4 shadow-xl sm:p-6">
            <CabecalhoModal
              icone={IconeEmpresas}
              titulo={editingCompany ? 'Editar empresa' : 'Criar empresa'}
              onFechar={handleCloseModal}
            />

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Código <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  placeholder="Ex: 01.12"
                  className={campo}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Nome <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: LAVRASUL - SÃO PAULO"
                  className={campo}
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm">Empresa ativa</span>
              </label>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={handleCloseModal}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-md border border-[#d0d5dd] text-sm font-medium hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSaveCompany()}
                disabled={isSaving}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? 'Salvando...' : editingCompany ? 'Atualizar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
