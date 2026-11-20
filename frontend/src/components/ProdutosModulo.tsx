import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { HiChevronDown, HiChevronUp, HiPencil, HiRefresh, HiSearch, HiTrash } from 'react-icons/hi'
import { FiltrosColapsaveis } from '@/components/FiltrosColapsaveis'
import { CabecalhoModal, CabecalhoModulo, IconeProdutos } from '@/components/icones/IconesErp'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { formatarMoeda, mascararMoedaDigitada, parseMoeda } from '@/lib/reciboServico'
import { api } from '@/services/api'

type Produto = {
  id: number
  codigo: string
  descricao: string
  unidade: string
  categoria: string
  preco?: number
  custo?: number
  estoque: number
  estoqueMinimo?: number
  observacao: string
  ferramenta?: boolean
  ativo: boolean
}

type Formulario = {
  codigo: string
  descricao: string
  unidade: string
  categoria: string
  preco: string
  custo: string
  estoque: string
  estoqueMinimo: string
  observacao: string
  ferramenta: boolean
  ativo: boolean
}

type Coluna = 'codigo' | 'descricao' | 'unidade' | 'estoque' | 'preco' | 'ativo'
type Filtro = 'todos' | 'ativos' | 'inativos' | 'ferramentas'

const PAGE_SIZE = 16
const UNIDADES = ['UN', 'MT', 'CM', 'CX', 'KG', 'PC', 'RL', 'JG', 'PAR', 'SC']
const CATEGORIAS = ['Peça', 'Material', 'Ferramenta', 'Serviço', 'Outros']

const FORM_VAZIO: Formulario = {
  codigo: '',
  descricao: '',
  unidade: 'UN',
  categoria: 'Material',
  preco: '',
  custo: '',
  estoque: '0',
  estoqueMinimo: '0',
  observacao: '',
  ferramenta: false,
  ativo: true,
}

function empresaSelecionada() {
  try {
    const raw = localStorage.getItem('selectedCompany')
    if (!raw) return null
    const company = JSON.parse(raw) as { codigo?: string; nome?: string }
    return company.codigo ? company : null
  } catch {
    return null
  }
}

function moeda(valor: number) {
  return formatarMoeda(valor)
}

function quantidade(valor: number) {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

function numero(valor: string) {
  const texto = valor.trim().replace(',', '.')
  if (!texto) return 0
  const n = Number(texto)
  return Number.isFinite(n) ? n : NaN
}

function Campo({ label, obrigatorio, children }: { label: string; obrigatorio?: boolean; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium">
        {label}
        {obrigatorio ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
    </label>
  )
}

const inputClass = 'w-full rounded-md border bg-background px-3 py-2 text-sm'

export function ProdutosModulo({
  showToast,
  isAdmin,
}: {
  showToast: (message: string, type?: 'success' | 'error') => void
  isAdmin: boolean
}) {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [selecionados, setSelecionados] = useState<number[]>([])
  const [pagina, setPagina] = useState(0)
  const [ordenacao, setOrdenacao] = useState<{ coluna: Coluna; direcao: 'asc' | 'desc' }>({
    coluna: 'descricao',
    direcao: 'asc',
  })
  const [modalAberto, setModalAberto] = useState(false)
  const [acoesAberto, setAcoesAberto] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [form, setForm] = useState<Formulario>(FORM_VAZIO)
  const isMobile = useIsMobile()
  const empresa = empresaSelecionada()
  const produtoSelecionado =
    selecionados.length === 1 ? produtos.find((produto) => produto.id === selecionados[0]) || null : null

  async function carregar() {
    setCarregando(true)
    const response = await api.getProdutos()
    if (response.data) setProdutos(response.data as Produto[])
    else {
      setProdutos([])
      if (response.error) showToast(response.error, 'error')
    }
    setCarregando(false)
  }

  useEffect(() => {
    void carregar()
  }, [])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const lista = produtos.filter((produto) => {
      if (filtro === 'ativos' && !produto.ativo) return false
      if (filtro === 'inativos' && produto.ativo) return false
      if (filtro === 'ferramentas' && !produto.ferramenta) return false
      if (!termo) return true
      return [produto.codigo, produto.descricao, produto.unidade, produto.categoria, produto.observacao, produto.ferramenta ? 'ferramenta' : '']
        .join(' ')
        .toLowerCase()
        .includes(termo)
    })
    lista.sort((a, b) => {
      let resultado = 0
      if (ordenacao.coluna === 'preco' || ordenacao.coluna === 'estoque') resultado = (a[ordenacao.coluna] || 0) - (b[ordenacao.coluna] || 0)
      else if (ordenacao.coluna === 'ativo') resultado = Number(b.ativo) - Number(a.ativo)
      else resultado = String(a[ordenacao.coluna] || '').localeCompare(String(b[ordenacao.coluna] || ''), 'pt-BR')
      return ordenacao.direcao === 'asc' ? resultado : -resultado
    })
    return lista
  }, [produtos, busca, filtro, ordenacao])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const paginaAtual = Math.min(pagina, totalPaginas - 1)
  const visiveis = filtrados.slice(paginaAtual * PAGE_SIZE, paginaAtual * PAGE_SIZE + PAGE_SIZE)
  function ordenar(coluna: Coluna) {
    setOrdenacao((atual) =>
      atual.coluna === coluna ? { coluna, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' } : { coluna, direcao: 'asc' },
    )
  }

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_VAZIO)
    setModalAberto(true)
  }

  function abrirEdicao(produto: Produto) {
    setEditando(produto)
    setForm({
      codigo: produto.codigo,
      descricao: produto.descricao,
      unidade: produto.unidade,
      categoria: produto.categoria,
      preco: isAdmin && produto.preco != null ? formatarMoeda(produto.preco) : '',
      custo: isAdmin && produto.custo != null ? formatarMoeda(produto.custo) : '',
      estoque: String(produto.estoque),
      estoqueMinimo: String(produto.estoqueMinimo ?? 0),
      observacao: produto.observacao,
      ferramenta: Boolean(produto.ferramenta) || produto.categoria === 'Ferramenta',
      ativo: produto.ativo,
    })
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setEditando(null)
    setForm(FORM_VAZIO)
  }

  async function salvar() {
    if (!empresa) {
      showToast('Selecione a empresa antes de cadastrar o produto.', 'error')
      return
    }
    const codigo = form.codigo.trim()
    const descricao = form.descricao.trim()
    const preco = parseMoeda(form.preco)
    const custo = parseMoeda(form.custo)
    const estoque = numero(form.estoque)
    const estoqueMinimo = numero(form.estoqueMinimo || '0')
    if (!codigo) {
      showToast('Código é obrigatório.', 'error')
      return
    }
    if (descricao.length < 2) {
      showToast('Descrição é obrigatória.', 'error')
      return
    }
    if (!form.unidade || !form.categoria) {
      showToast('Unidade e categoria são obrigatórias.', 'error')
      return
    }
    if (!Number.isFinite(estoque) || estoque < 0) {
      showToast('Estoque precisa ser um valor válido.', 'error')
      return
    }
    if (isAdmin && (form.preco.trim() === '' || preco < 0 || custo < 0)) {
      showToast('Preço e custo precisam ser valores válidos.', 'error')
      return
    }

    const body = {
      codigo,
      descricao,
      unidade: form.unidade,
      categoria: form.categoria,
      estoque: Math.round(estoque * 1000) / 1000,
      estoqueMinimo: Number.isFinite(estoqueMinimo) && estoqueMinimo > 0 ? Math.round(estoqueMinimo * 1000) / 1000 : 0,
      observacao: form.observacao.trim(),
      ferramenta: form.ferramenta || form.categoria === 'Ferramenta',
      ativo: form.ativo,
      ...(isAdmin
        ? {
            preco: Math.round(preco * 100) / 100,
            custo: Math.round(custo * 100) / 100,
          }
        : {}),
    }

    setSalvando(true)
    const response = editando ? await api.updateProduto(editando.id, body) : await api.createProduto(body)
    setSalvando(false)
    if (response.error) {
      showToast(response.error, 'error')
      return
    }
    showToast(editando ? 'Produto atualizado.' : 'Produto cadastrado.', 'success')
    fecharModal()
    setPagina(0)
    await carregar()
  }

  async function excluirSelecionados() {
    if (selecionados.length === 0) return
    const response = await api.deleteProdutos(selecionados)
    if (response.error) {
      showToast(response.error, 'error')
      return
    }
    showToast('Produtos excluídos.', 'success')
    setSelecionados([])
    await carregar()
  }

  function Cabecalho({ coluna, label, className = '' }: { coluna: Coluna; label: string; className?: string }) {
    const ativa = ordenacao.coluna === coluna
    return (
      <th
        className={`cursor-pointer border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-accent/50 ${ativa ? 'bg-primary/10' : ''} ${className}`}
        onClick={() => ordenar(coluna)}
      >
        <div className="flex items-center gap-1">
          <span>{label}</span>
          <span className="flex flex-col">
            <HiChevronUp className={`h-2 w-2 ${ativa && ordenacao.direcao === 'asc' ? 'text-foreground' : ''}`} />
            <HiChevronDown className={`-mt-1 h-2 w-2 ${ativa && ordenacao.direcao === 'desc' ? 'text-foreground' : ''}`} />
          </span>
        </div>
      </th>
    )
  }

  const colunasTabela = isAdmin ? 8 : 7

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-3 sm:px-6 sm:py-4">
        <CabecalhoModulo
          icone={IconeProdutos}
          titulo="Produtos"
          acoes={(
            <>
              <button
                type="button"
                onClick={abrirNovo}
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
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
                    disabled={!produtoSelecionado}
                    onClick={() => produtoSelecionado && abrirEdicao(produtoSelecionado)}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#d0d5dd] bg-white px-3 text-sm font-medium text-[#333] hover:bg-[#f8f9fb] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <HiPencil className="h-4 w-4" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void carregar()}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#d0d5dd] bg-white px-3 text-sm font-medium text-[#333] hover:bg-[#f8f9fb]"
                  >
                    <HiRefresh className="h-4 w-4" />
                    Atualizar
                  </button>
                  <button
                    type="button"
                    disabled={selecionados.length === 0}
                    onClick={() => void excluirSelecionados()}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <HiTrash className="h-4 w-4" />
                    Excluir
                  </button>
                </>
              )}
            </>
          )}
        />
        <div className="mt-3">
          <FiltrosColapsaveis conteudoClassName="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-0 sm:w-64">
              <HiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca}
                onChange={(event) => {
                  setBusca(event.target.value)
                  setPagina(0)
                }}
                placeholder="Buscar código ou descrição..."
                className="h-11 w-full rounded-md border bg-background pl-9 pr-3 text-sm sm:h-10"
              />
            </div>
            <select
              value={filtro}
              onChange={(event) => {
                setFiltro(event.target.value as Filtro)
                setPagina(0)
              }}
              className="h-11 w-full rounded-md border bg-background px-3 text-sm sm:h-10 sm:w-auto"
            >
              <option value="todos">Todos</option>
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
              <option value="ferramentas">Ferramentas</option>
            </select>
          </FiltrosColapsaveis>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse md:min-w-[860px]">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              <th className="w-12 border-b px-2 py-2" />
              <th className="w-16 border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">Editar</th>
              <Cabecalho coluna="codigo" label="Código" className="hidden sm:table-cell" />
              <Cabecalho coluna="descricao" label="Descrição" />
              <Cabecalho coluna="unidade" label="Unidade" className="hidden md:table-cell" />
              <Cabecalho coluna="estoque" label="Estoque" className="text-right" />
              {isAdmin ? <Cabecalho coluna="preco" label="Preço" className="hidden text-right md:table-cell" /> : null}
              <Cabecalho coluna="ativo" label="Status" />
            </tr>
          </thead>
          <tbody className="bg-background">
            {carregando ? (
              <tr>
                <td colSpan={colunasTabela} className="px-4 py-8 text-center text-muted-foreground">
                  Carregando produtos...
                </td>
              </tr>
            ) : visiveis.length === 0 ? (
              <tr>
                <td colSpan={colunasTabela} className="px-4 py-8 text-center text-muted-foreground">
                  <IconeProdutos className="mx-auto mb-2 block h-8 w-8 text-muted-foreground" />
                  Nenhum produto encontrado
                </td>
              </tr>
            ) : (
              visiveis.map((produto) => (
                <tr key={produto.id} className="border-b hover:bg-accent/50">
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selecionados.includes(produto.id)}
                      onChange={() =>
                        setSelecionados((lista) =>
                          lista.includes(produto.id) ? lista.filter((id) => id !== produto.id) : [...lista, produto.id],
                        )
                      }
                      className="cursor-pointer rounded"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <button type="button" onClick={() => abrirEdicao(produto)} title="Editar produto" aria-label="Editar produto">
                      <HiPencil className="h-4 w-4 text-primary" />
                    </button>
                  </td>
                  <td className="hidden whitespace-nowrap px-2 py-2 text-sm font-medium sm:table-cell sm:px-4">{produto.codigo}</td>
                  <td className="px-2 py-2 text-sm sm:px-4">
                    <div className="line-clamp-2">{produto.descricao}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="sm:hidden">{produto.codigo} · </span>
                      {produto.categoria}
                      {produto.ferramenta ? ' · Ferramenta' : ''}
                    </div>
                  </td>
                  <td className="hidden px-4 py-2 text-sm md:table-cell">{produto.unidade}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right text-sm sm:px-4">{quantidade(produto.estoque)}</td>
                  {isAdmin ? <td className="hidden px-4 py-2 text-right text-sm md:table-cell">{moeda(produto.preco || 0)}</td> : null}
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-1 text-xs font-medium ${produto.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                      {produto.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t bg-background px-4 py-2">
        <div className="text-sm text-muted-foreground">
          {filtrados.length > 0
            ? `Página ${paginaAtual + 1} de ${totalPaginas} • Total: ${filtrados.length} produto${filtrados.length === 1 ? '' : 's'}`
            : 'Nenhum produto encontrado'}
        </div>
        {filtrados.length > PAGE_SIZE && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPagina((atual) => Math.max(0, atual - 1))}
              disabled={paginaAtual === 0}
              className="rounded-md border px-3 py-1 text-sm hover:bg-accent disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPagina((atual) => Math.min(totalPaginas - 1, atual + 1))}
              disabled={paginaAtual >= totalPaginas - 1}
              className="rounded-md border px-3 py-1 text-sm hover:bg-accent disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        )}
      </div>

      <Sheet open={acoesAberto} onOpenChange={setAcoesAberto}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-4 pb-8 pt-4 sm:mx-auto sm:max-w-lg">
          <SheetHeader className="mb-4 space-y-1 pr-8 text-left">
            <SheetTitle>Ações do produto</SheetTitle>
            <SheetDescription>
              {selecionados.length === 0
                ? 'Selecione produtos na lista para editar ou excluir.'
                : `${selecionados.length} selecionado${selecionados.length === 1 ? '' : 's'}.`}
            </SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setAcoesAberto(false)
                abrirNovo()
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1d4ed8] px-3 py-3 text-sm font-medium text-white"
            >
              Criar produto
            </button>
            <button
              type="button"
              disabled={!produtoSelecionado}
              onClick={() => {
                if (!produtoSelecionado) return
                setAcoesAberto(false)
                abrirEdicao(produtoSelecionado)
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
                void carregar()
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#eef2f6] px-3 py-3 text-sm font-medium text-[#334155]"
            >
              <HiRefresh className="h-4 w-4" />
              Atualizar
            </button>
            <button
              type="button"
              disabled={selecionados.length === 0}
              onClick={() => {
                setAcoesAberto(false)
                void excluirSelecionados()
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#fde8e8] px-3 py-3 text-sm font-medium text-[#b42318] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <HiTrash className="h-4 w-4" />
              Excluir
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-background p-4 shadow-xl sm:p-6">
            <CabecalhoModal
              icone={IconeProdutos}
              titulo={editando ? 'Editar produto' : 'Novo produto'}
              descricao="Código, categoria e os dados da peça."
              onFechar={fecharModal}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Campo label="Código" obrigatorio>
                <input value={form.codigo} onChange={(event) => setForm({ ...form, codigo: event.target.value })} className={inputClass} />
              </Campo>
              <Campo label="Categoria" obrigatorio>
                <select
                  value={form.categoria}
                  onChange={(event) => setForm({
                    ...form,
                    categoria: event.target.value,
                    ferramenta: event.target.value === 'Ferramenta' ? true : form.ferramenta,
                  })}
                  className={inputClass}
                >
                  {form.categoria && !CATEGORIAS.includes(form.categoria) ? <option>{form.categoria}</option> : null}
                  {CATEGORIAS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Campo>
              <div className="md:col-span-2">
                <Campo label="Descrição" obrigatorio>
                  <input value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} className={inputClass} />
                </Campo>
              </div>
              <Campo label="Unidade" obrigatorio>
                <select value={form.unidade} onChange={(event) => setForm({ ...form, unidade: event.target.value })} className={inputClass}>
                  {form.unidade && !UNIDADES.includes(form.unidade) ? <option>{form.unidade}</option> : null}
                  {UNIDADES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Campo>
              {isAdmin ? (
                <Campo label="Preço de venda" obrigatorio>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="R$ 0,00"
                    value={form.preco}
                    onChange={(event) => setForm((atual) => ({ ...atual, preco: mascararMoedaDigitada(event.target.value) }))}
                    className={inputClass}
                  />
                </Campo>
              ) : null}
              {isAdmin ? (
                <Campo label="Custo">
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="R$ 0,00"
                    value={form.custo}
                    onChange={(event) => setForm((atual) => ({ ...atual, custo: mascararMoedaDigitada(event.target.value) }))}
                    className={inputClass}
                  />
                </Campo>
              ) : null}
              <Campo label="Estoque">
                <input type="number" step="0.001" value={form.estoque} onChange={(event) => setForm({ ...form, estoque: event.target.value })} className={inputClass} />
              </Campo>
              <Campo label="Estoque mínimo">
                <input type="number" min="0" step="0.001" value={form.estoqueMinimo} onChange={(event) => setForm({ ...form, estoqueMinimo: event.target.value })} className={inputClass} />
              </Campo>
              <div className="md:col-span-2">
                <Campo label="Observação">
                  <input value={form.observacao} onChange={(event) => setForm({ ...form, observacao: event.target.value })} className={inputClass} />
                </Campo>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.ferramenta || form.categoria === 'Ferramenta'}
                  onChange={(event) => setForm({
                    ...form,
                    ferramenta: event.target.checked,
                    categoria: event.target.checked ? 'Ferramenta' : form.categoria === 'Ferramenta' ? 'Material' : form.categoria,
                  })}
                />
                Ferramenta
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.ativo} onChange={(event) => setForm({ ...form, ativo: event.target.checked })} />
                Produto ativo
              </label>
            </div>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={fecharModal} className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void salvar()}
                disabled={salvando}
                className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
