import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { HiChevronDown, HiChevronUp, HiPencil, HiPlus, HiRefresh, HiSearch, HiTrash } from 'react-icons/hi'
import { ExportarRelatorio } from '@/components/ExportarRelatorio'
import { FiltrosColapsaveis } from '@/components/FiltrosColapsaveis'
import { CabecalhoModal, CabecalhoModulo, IconeEstoque } from '@/components/icones/IconesErp'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { api } from '@/services/api'

type TipoMovimento = 'ENTRADA' | 'SAIDA'
type Filtro = 'todos' | 'ENTRADA' | 'SAIDA'
type Coluna = 'data' | 'tipo' | 'codigo' | 'descricao' | 'quantidade' | 'motivo' | 'saldo'

type Produto = {
  id: number
  codigo: string
  descricao: string
  unidade: string
  estoque: number
  ativo: boolean
}

type Movimento = {
  id: number
  produtoId: number
  tipo: TipoMovimento
  quantidade: number
  data: string
  motivo: string
  documento: string
  observacao: string
  codigo: string
  descricao: string
  unidade: string
  saldo: number
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

type Formulario = {
  produtoId: string
  quantidade: string
  data: string
  motivo: string
  documento: string
  observacao: string
}

const PAGE_SIZE = 16
const MOTIVOS: Record<TipoMovimento, string[]> = {
  ENTRADA: ['Compra', 'Devolução de cliente', 'Ajuste de inventário', 'Saldo inicial'],
  SAIDA: ['Uso em serviço', 'Venda', 'Perda ou quebra', 'Ajuste de inventário', 'Devolução ao fornecedor'],
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

function hojeIso() {
  const data = new Date()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mes}-${dia}`
}

function dataBr(valor: string) {
  const [ano, mes, dia] = valor.split('-')
  if (!ano || !mes || !dia) return valor
  return `${dia}/${mes}/${ano}`
}

function quantidade(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 0 })
}

function numero(valor: string) {
  const texto = valor.trim().replace(',', '.')
  if (!texto) return NaN
  const n = Number(texto)
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : NaN
}

export function EstoqueModulo({
  showToast,
  isAdmin = false,
  focoReposicao,
  onFocoConsumido,
}: {
  showToast: (message: string, type?: 'success' | 'error') => void
  isAdmin?: boolean
  focoReposicao?: 'repor' | null
  onFocoConsumido?: () => void
}) {
  const [movimentos, setMovimentos] = useState<Movimento[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [alertas, setAlertas] = useState<Array<{ id: number; descricao: string; estoque: number; estoqueMinimo: number }>>([])
  const [saldos, setSaldos] = useState<
    Array<{
      id: number
      codigo?: string
      nome: string
      pecas: Array<{ produtoId: number; descricao: string; quantidade: number; estoqueMinimo?: number }>
    }>
  >([])
  const [mostrarRepor, setMostrarRepor] = useState(false)
  const [movimentoLocal, setMovimentoLocal] = useState({ produtoId: '', deLocalId: '', paraLocalId: '', localId: '', quantidade: '', motivo: 'Transferência' })
  const [acaoLocal, setAcaoLocal] = useState<'transferir' | 'ajustar' | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [selecionados, setSelecionados] = useState<number[]>([])
  const [pagina, setPagina] = useState(0)
  const [ordenacao, setOrdenacao] = useState<{ coluna: Coluna; direcao: 'asc' | 'desc' }>({
    coluna: 'data',
    direcao: 'desc',
  })
  const [modalAberto, setModalAberto] = useState(false)
  const [acoesAberto, setAcoesAberto] = useState(false)
  const isMobile = useIsMobile()
  const [tipoModal, setTipoModal] = useState<TipoMovimento>('ENTRADA')
  const [editando, setEditando] = useState<Movimento | null>(null)
  const [form, setForm] = useState<Formulario>({
    produtoId: '',
    quantidade: '',
    data: hojeIso(),
    motivo: MOTIVOS.ENTRADA[0],
    documento: '',
    observacao: '',
  })
  const empresa = empresaSelecionada()

  useEffect(() => {
    if (focoReposicao === 'repor') {
      setMostrarRepor(true)
      onFocoConsumido?.()
    }
  }, [focoReposicao, onFocoConsumido])

  const paraRepor = useMemo(() => {
    const linhas: Array<{ produto: string; local: string; saldo: number; minimo: number; falta: number }> = []
    for (const local of saldos) {
      for (const peca of local.pecas || []) {
        const minimo = Number(peca.estoqueMinimo || 0)
        const saldo = Number(peca.quantidade || 0)
        if (minimo > 0 && saldo < minimo) {
          linhas.push({
            produto: peca.descricao,
            local: local.nome,
            saldo,
            minimo,
            falta: Math.max(0, minimo - saldo),
          })
        }
      }
    }
    if (linhas.length === 0) {
      for (const item of alertas) {
        linhas.push({
          produto: item.descricao,
          local: 'Geral',
          saldo: item.estoque,
          minimo: item.estoqueMinimo,
          falta: Math.max(0, item.estoqueMinimo - item.estoque),
        })
      }
    }
    return linhas
  }, [saldos, alertas])

  async function carregar() {
    setCarregando(true)
    const [movimentosRes, produtosRes, alertasRes, saldosRes] = await Promise.all([
      api.getMovimentosEstoque(),
      api.getProdutos(),
      api.getAlertasEstoque(),
      api.getSaldosEstoque(),
    ])
    if (movimentosRes.error) showToast(movimentosRes.error, 'error')
    if (produtosRes.error) showToast(produtosRes.error, 'error')
    if (alertasRes.error) showToast(alertasRes.error, 'error')
    if (saldosRes.error) showToast(saldosRes.error, 'error')
    setMovimentos((movimentosRes.data as Movimento[]) || [])
    setProdutos((produtosRes.data as Produto[]) || [])
    setAlertas((alertasRes.data as typeof alertas) || [])
    setSaldos((saldosRes.data as typeof saldos) || [])
    setCarregando(false)
  }

  useEffect(() => {
    void carregar()
  }, [])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const lista = movimentos.filter((movimento) => {
      if (filtro !== 'todos' && movimento.tipo !== filtro) return false
      if (!termo) return true
      return [movimento.codigo, movimento.descricao, movimento.motivo, movimento.documento, movimento.observacao]
        .join(' ')
        .toLowerCase()
        .includes(termo)
    })
    lista.sort((a, b) => {
      let resultado = 0
      if (ordenacao.coluna === 'quantidade' || ordenacao.coluna === 'saldo') resultado = a[ordenacao.coluna] - b[ordenacao.coluna]
      else resultado = String(a[ordenacao.coluna] || '').localeCompare(String(b[ordenacao.coluna] || ''), 'pt-BR')
      return ordenacao.direcao === 'asc' ? resultado : -resultado
    })
    return lista
  }, [movimentos, busca, filtro, ordenacao])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const paginaAtual = Math.min(pagina, totalPaginas - 1)
  const visiveis = filtrados.slice(paginaAtual * PAGE_SIZE, paginaAtual * PAGE_SIZE + PAGE_SIZE)
  const pecaSelecionada = produtos.find((produto) => String(produto.id) === form.produtoId)
  const pecasDisponiveis = produtos.filter((produto) => produto.ativo || String(produto.id) === form.produtoId)
  const movimentoSelecionado =
    selecionados.length === 1 ? movimentos.find((movimento) => movimento.id === selecionados[0]) || null : null

  function ordenar(coluna: Coluna) {
    setOrdenacao((atual) =>
      atual.coluna === coluna ? { coluna, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' } : { coluna, direcao: 'asc' },
    )
  }

  function abrirNovo(tipo: TipoMovimento) {
    setEditando(null)
    setTipoModal(tipo)
    setForm({
      produtoId: '',
      quantidade: '',
      data: hojeIso(),
      motivo: MOTIVOS[tipo][0],
      documento: '',
      observacao: '',
    })
    setModalAberto(true)
  }

  function abrirEdicao(movimento: Movimento) {
    setEditando(movimento)
    setTipoModal(movimento.tipo)
    setForm({
      produtoId: String(movimento.produtoId),
      quantidade: String(movimento.quantidade),
      data: movimento.data,
      motivo: movimento.motivo,
      documento: movimento.documento,
      observacao: movimento.observacao,
    })
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setEditando(null)
  }

  async function salvar() {
    if (!empresa) {
      showToast('Selecione a empresa antes de movimentar o estoque.', 'error')
      return
    }
    const produtoId = Number(form.produtoId)
    const qtd = numero(form.quantidade)
    if (!produtoId) {
      showToast('Selecione a peça.', 'error')
      return
    }
    if (!Number.isFinite(qtd) || qtd <= 0) {
      showToast('Informe uma quantidade maior que zero.', 'error')
      return
    }
    if (!form.data) {
      showToast('Data é obrigatória.', 'error')
      return
    }
    if (form.motivo.trim().length < 2) {
      showToast('Motivo é obrigatório.', 'error')
      return
    }
    if (tipoModal === 'SAIDA' && pecaSelecionada) {
      const saldoConsiderado = editando && editando.produtoId === produtoId && editando.tipo === 'SAIDA'
        ? pecaSelecionada.estoque + editando.quantidade
        : pecaSelecionada.estoque
      if (qtd > saldoConsiderado + 0.0001) {
        showToast(`Saldo insuficiente. Disponível: ${quantidade(Math.max(0, saldoConsiderado))} ${pecaSelecionada.unidade}.`, 'error')
        return
      }
    }

    const body = {
      produtoId,
      tipo: tipoModal,
      quantidade: qtd,
      data: form.data,
      motivo: form.motivo.trim(),
      documento: form.documento.trim(),
      observacao: form.observacao.trim(),
    }
    setSalvando(true)
    const response = editando ? await api.updateMovimentoEstoque(editando.id, body) : await api.createMovimentoEstoque(body)
    setSalvando(false)
    if (response.error) {
      showToast(response.error, 'error')
      return
    }
    showToast(editando ? 'Movimentação atualizada.' : tipoModal === 'ENTRADA' ? 'Entrada lançada.' : 'Saída lançada.', 'success')
    fecharModal()
    setPagina(0)
    await carregar()
  }

  async function estornarSelecionados() {
    if (selecionados.length === 0) return
    const response = await api.deleteMovimentosEstoque(selecionados)
    if (response.error) {
      showToast(response.error, 'error')
      return
    }
    showToast('Movimentação estornada e saldo atualizado.', 'success')
    setSelecionados([])
    await carregar()
  }

  function Cabecalho({ coluna, label, className = '' }: { coluna: Coluna; label: string; className?: string }) {
    const ativa = ordenacao.coluna === coluna
    return (
      <th
        className={`cursor-pointer border-b px-2 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-accent/50 sm:px-4 ${ativa ? 'bg-primary/10' : ''} ${className}`}
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

  const motivos = MOTIVOS[tipoModal].includes(form.motivo) || !form.motivo ? MOTIVOS[tipoModal] : [form.motivo, ...MOTIVOS[tipoModal]]

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-3 sm:px-6 sm:py-4">
        <CabecalhoModulo
          icone={IconeEstoque}
          titulo="Estoque"
          acoes={
            isAdmin ? (
              <>
                <button
                  type="button"
                  onClick={() => abrirNovo('ENTRADA')}
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
                      onClick={() => abrirNovo('SAIDA')}
                      className="erp-verde inline-flex h-10 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium"
                    >
                      <HiPlus className="h-4 w-4" />
                      Nova saída
                    </button>
                    <button
                      type="button"
                      onClick={() => setAcaoLocal((atual) => (atual === 'transferir' ? null : 'transferir'))}
                      className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                    >
                      Transferir
                    </button>
                    <button
                      type="button"
                      onClick={() => setAcaoLocal((atual) => (atual === 'ajustar' ? null : 'ajustar'))}
                      className="erp-laranja inline-flex h-10 items-center justify-center rounded-md px-3 text-sm font-medium text-white"
                    >
                      Ajustar
                    </button>
                    <ExportarRelatorio tipo="estoque" showToast={showToast} />
                    <button
                      type="button"
                      disabled={!movimentoSelecionado}
                      onClick={() => movimentoSelecionado && abrirEdicao(movimentoSelecionado)}
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
                      onClick={() => void estornarSelecionados()}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <HiTrash className="h-4 w-4" />
                      Estornar
                    </button>
                  </>
                )}
              </>
            ) : undefined
          }
        />
        <div className="mt-3">
          <FiltrosColapsaveis conteudoClassName="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative min-w-0">
              <HiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca}
                onChange={(event) => {
                  setBusca(event.target.value)
                  setPagina(0)
                }}
                placeholder="Buscar peça, motivo..."
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
              <option value="todos">Todas</option>
              <option value="ENTRADA">Entradas</option>
              <option value="SAIDA">Saídas</option>
            </select>
          </FiltrosColapsaveis>
        </div>
        {alertas.length > 0 && (
          <p className="mt-3 text-sm text-amber-800">
            Estoque no mínimo: {alertas.map((item) => `${item.descricao} (${quantidade(item.estoque)})`).join(', ')}
          </p>
        )}
        {(mostrarRepor || paraRepor.length > 0) && isAdmin ? (
          <section id="estoque-para-repor" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-amber-950">Para repor</h3>
              <button type="button" className="text-xs underline" onClick={() => setMostrarRepor((v) => !v)}>
                {mostrarRepor ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            {mostrarRepor || focoReposicao === 'repor' ? (
              paraRepor.length === 0 ? (
                <p className="text-sm text-amber-900">Nenhuma peça abaixo do mínimo.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-amber-900/80">
                      <th className="py-1">Produto</th>
                      <th className="py-1">Local</th>
                      <th className="py-1">Saldo</th>
                      <th className="py-1">Mínimo</th>
                      <th className="py-1">Falta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paraRepor.map((linha, indice) => (
                      <tr key={`${linha.produto}-${linha.local}-${indice}`} className="border-t border-amber-200/80">
                        <td className="py-1">{linha.produto}</td>
                        <td className="py-1">{linha.local}</td>
                        <td className="py-1 tabular-nums">{quantidade(linha.saldo)}</td>
                        <td className="py-1 tabular-nums">{quantidade(linha.minimo)}</td>
                        <td className="py-1 tabular-nums">{quantidade(linha.falta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : (
              <p className="text-sm text-amber-900">{paraRepor.length} item(ns) abaixo do mínimo.</p>
            )}
          </section>
        ) : null}
        {isAdmin && acaoLocal && (
          <form
            className="mt-3 flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              const quantidadeInformada = numero(movimentoLocal.quantidade)
              if (!movimentoLocal.produtoId || !Number.isFinite(quantidadeInformada) || quantidadeInformada <= 0) {
                showToast('Informe a peça e a quantidade.', 'error')
                return
              }
              if (acaoLocal === 'transferir' && (!movimentoLocal.deLocalId || !movimentoLocal.paraLocalId)) {
                showToast('Escolha a origem e o destino.', 'error')
                return
              }
              if (acaoLocal === 'ajustar' && !movimentoLocal.localId) {
                showToast('Escolha o local da contagem.', 'error')
                return
              }
              const pedido = acaoLocal === 'transferir'
                ? api.transferirEstoque({
                    produtoId: Number(movimentoLocal.produtoId),
                    deLocalId: Number(movimentoLocal.deLocalId),
                    paraLocalId: Number(movimentoLocal.paraLocalId),
                    quantidade: quantidadeInformada,
                    motivo: 'Transferência',
                  })
                : api.ajustarEstoque({
                    produtoId: Number(movimentoLocal.produtoId),
                    localId: Number(movimentoLocal.localId),
                    quantidadeContada: quantidadeInformada,
                    motivo: 'Contagem',
                  })
              void pedido.then((resposta) => {
                if (resposta.error) showToast(resposta.error, 'error')
                else {
                  showToast(acaoLocal === 'transferir' ? 'Transferência registrada.' : 'Contagem registrada.', 'success')
                  setAcaoLocal(null)
                  void carregar()
                }
              })
            }}
          >
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={movimentoLocal.produtoId} onChange={(event) => setMovimentoLocal({ ...movimentoLocal, produtoId: event.target.value })} required>
              <option value="">Peça</option>
              {produtos.map((produto) => <option key={produto.id} value={produto.id}>{produto.descricao}</option>)}
            </select>
            {acaoLocal === 'transferir' ? (
              <>
                <select className="h-9 rounded-md border bg-background px-2 text-sm" value={movimentoLocal.deLocalId} onChange={(event) => setMovimentoLocal({ ...movimentoLocal, deLocalId: event.target.value })}>
                  <option value="">De</option>
                  {saldos.map((local) => <option key={local.id} value={local.id}>{local.nome}</option>)}
                </select>
                <select className="h-9 rounded-md border bg-background px-2 text-sm" value={movimentoLocal.paraLocalId} onChange={(event) => setMovimentoLocal({ ...movimentoLocal, paraLocalId: event.target.value })}>
                  <option value="">Para</option>
                  {saldos.map((local) => <option key={`para-${local.id}`} value={local.id}>{local.nome}</option>)}
                </select>
              </>
            ) : (
              <select className="h-9 rounded-md border bg-background px-2 text-sm" value={movimentoLocal.localId} onChange={(event) => setMovimentoLocal({ ...movimentoLocal, localId: event.target.value })}>
                <option value="">Local</option>
                {saldos.map((local) => <option key={`ajuste-${local.id}`} value={local.id}>{local.nome}</option>)}
              </select>
            )}
            <input className="h-9 w-28 rounded-md border bg-background px-2 text-sm" value={movimentoLocal.quantidade} onChange={(event) => setMovimentoLocal({ ...movimentoLocal, quantidade: event.target.value })} placeholder="Quantidade" required />
            <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
              {acaoLocal === 'transferir' ? 'Confirmar transferência' : 'Confirmar contagem'}
            </button>
          </form>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse md:min-w-[980px]">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              <th className="w-12 border-b px-2 py-2" />
              <th className="w-16 border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">Editar</th>
              <Cabecalho coluna="data" label="Data" className="hidden sm:table-cell" />
              <Cabecalho coluna="tipo" label="Tipo" />
              <Cabecalho coluna="codigo" label="Código" className="hidden md:table-cell" />
              <Cabecalho coluna="descricao" label="Peça" />
              <Cabecalho coluna="quantidade" label="Quantidade" />
              <Cabecalho coluna="motivo" label="Motivo" className="hidden md:table-cell" />
              <Cabecalho coluna="saldo" label="Saldo atual" className="hidden md:table-cell" />
            </tr>
          </thead>
          <tbody className="bg-background">
            {carregando ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  Carregando movimentações...
                </td>
              </tr>
            ) : visiveis.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  <IconeEstoque className="mx-auto mb-2 block h-8 w-8 text-muted-foreground" />
                  Nenhuma movimentação encontrada
                </td>
              </tr>
            ) : (
              visiveis.map((movimento) => (
                <tr key={movimento.id} className="border-b hover:bg-accent/50">
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selecionados.includes(movimento.id)}
                      onChange={() =>
                        setSelecionados((lista) =>
                          lista.includes(movimento.id) ? lista.filter((id) => id !== movimento.id) : [...lista, movimento.id],
                        )
                      }
                      className="cursor-pointer rounded"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <button type="button" onClick={() => abrirEdicao(movimento)} title="Editar movimentação" aria-label="Editar movimentação">
                      <HiPencil className="h-4 w-4 text-primary" />
                    </button>
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-2 text-sm sm:table-cell">{dataBr(movimento.data)}</td>
                  <td className="px-2 py-2 sm:px-4">
                    <span className={`rounded px-2 py-1 text-xs font-medium ${movimento.tipo === 'ENTRADA' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                      {movimento.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}
                    </span>
                  </td>
                  <td className="hidden whitespace-nowrap px-2 py-2 text-sm font-medium md:table-cell sm:px-4">{movimento.codigo}</td>
                  <td className="px-2 py-2 text-sm sm:px-4">
                    <div className="line-clamp-2">{movimento.descricao}</div>
                    <div className="text-xs text-muted-foreground md:hidden">{movimento.codigo}</div>
                  </td>
                  <td className={`whitespace-nowrap px-2 py-2 text-sm font-medium sm:px-4 ${movimento.tipo === 'ENTRADA' ? 'text-emerald-700' : 'text-red-600'}`}>
                    {movimento.tipo === 'ENTRADA' ? '+' : '-'}
                    {quantidade(movimento.quantidade)} {movimento.unidade}
                  </td>
                  <td className="hidden px-4 py-2 text-sm md:table-cell">
                    <div>{movimento.motivo}</div>
                    {movimento.documento ? <div className="text-xs text-muted-foreground">{movimento.documento}</div> : null}
                  </td>
                  <td className="hidden px-4 py-2 text-sm md:table-cell">
                    {quantidade(movimento.saldo)} {movimento.unidade}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-background px-3 py-2">
        <div className="text-xs text-muted-foreground sm:text-sm">
          {filtrados.length > 0
            ? `Página ${paginaAtual + 1} de ${totalPaginas} • Total: ${filtrados.length} movimentaç${filtrados.length === 1 ? 'ão' : 'ões'}`
            : 'Nenhuma movimentação encontrada'}
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

      {isAdmin ? (
        <Sheet open={acoesAberto} onOpenChange={setAcoesAberto}>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-4 pb-8 pt-4 sm:mx-auto sm:max-w-lg">
            <SheetHeader className="mb-4 pr-8 text-left">
              <SheetTitle>Ações do estoque</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setAcoesAberto(false)
                  abrirNovo('ENTRADA')
                }}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1d4ed8] px-3 py-3 text-sm font-medium text-white"
              >
                <HiPlus className="h-4 w-4" />
                Nova entrada
              </button>
              <button
                type="button"
                onClick={() => {
                  setAcoesAberto(false)
                  abrirNovo('SAIDA')
                }}
                className="erp-verde inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium"
              >
                <HiPlus className="h-4 w-4" />
                Nova saída
              </button>
              <button
                type="button"
                onClick={() => {
                  setAcoesAberto(false)
                  setAcaoLocal('transferir')
                }}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#dbeafe] px-3 py-3 text-sm font-medium text-[#1e3a8a]"
              >
                Transferir
              </button>
              <button
                type="button"
                onClick={() => {
                  setAcoesAberto(false)
                  setAcaoLocal('ajustar')
                }}
                className="erp-laranja inline-flex min-h-11 w-full items-center justify-center rounded-xl px-3 py-3 text-sm font-medium text-white"
              >
                Ajustar
              </button>
              <button
                type="button"
                disabled={!movimentoSelecionado}
                onClick={() => {
                  if (!movimentoSelecionado) return
                  setAcoesAberto(false)
                  abrirEdicao(movimentoSelecionado)
                }}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#e0e7ff] px-3 py-3 text-sm font-medium text-[#3730a3] disabled:cursor-not-allowed disabled:opacity-50"
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
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#eef2f6] px-3 py-3 text-sm font-medium text-[#334155]"
              >
                <HiRefresh className="h-4 w-4" />
                Atualizar
              </button>
              <ExportarRelatorio
                tipo="estoque"
                showToast={showToast}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-3 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              />
              <button
                type="button"
                disabled={selecionados.length === 0}
                onClick={() => {
                  setAcoesAberto(false)
                  void estornarSelecionados()
                }}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#fde8e8] px-3 py-3 text-sm font-medium text-[#b42318] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <HiTrash className="h-4 w-4" />
                Estornar
              </button>
            </div>
          </SheetContent>
        </Sheet>
      ) : null}

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-lg bg-background p-4 shadow-xl sm:p-6">
            <CabecalhoModal
              icone={IconeEstoque}
              titulo={`${editando ? 'Editar' : 'Nova'} ${tipoModal === 'ENTRADA' ? 'entrada' : 'saída'}`}
              descricao={tipoModal === 'ENTRADA' ? 'Peça que entrou no depósito.' : 'Peça que saiu do estoque.'}
              onFechar={fecharModal}
            />
            <div className="grid gap-4">
              <Campo label="Peça" obrigatorio>
                <select value={form.produtoId} onChange={(event) => setForm({ ...form, produtoId: event.target.value })} className={inputClass}>
                  <option value="">Selecione</option>
                  {pecasDisponiveis.map((produto) => (
                    <option key={produto.id} value={produto.id}>
                      {produto.codigo} - {produto.descricao} ({quantidade(produto.estoque)} {produto.unidade})
                    </option>
                  ))}
                </select>
              </Campo>
              <div className="grid gap-4 md:grid-cols-2">
                <Campo label="Quantidade" obrigatorio>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={form.quantidade}
                    onChange={(event) => setForm({ ...form, quantidade: event.target.value })}
                    className={inputClass}
                  />
                </Campo>
                <Campo label="Data" obrigatorio>
                  <input type="date" value={form.data} onChange={(event) => setForm({ ...form, data: event.target.value })} className={inputClass} />
                </Campo>
              </div>
              <Campo label="Motivo" obrigatorio>
                <select value={form.motivo} onChange={(event) => setForm({ ...form, motivo: event.target.value })} className={inputClass}>
                  {motivos.map((motivo) => (
                    <option key={motivo}>{motivo}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Documento">
                <input
                  value={form.documento}
                  onChange={(event) => setForm({ ...form, documento: event.target.value })}
                  className={inputClass}
                  placeholder="Nota, pedido ou ordem de serviço"
                />
              </Campo>
              <Campo label="Observação">
                <input value={form.observacao} onChange={(event) => setForm({ ...form, observacao: event.target.value })} className={inputClass} />
              </Campo>
            </div>
            {pecaSelecionada ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Saldo atual: {quantidade(pecaSelecionada.estoque)} {pecaSelecionada.unidade}. A {tipoModal === 'ENTRADA' ? 'entrada soma' : 'saída baixa'} esse saldo.
              </p>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">A peça precisa estar cadastrada em Produtos.</p>
            )}
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
