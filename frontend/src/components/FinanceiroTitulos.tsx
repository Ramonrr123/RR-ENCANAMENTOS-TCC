import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { HiChevronDown, HiChevronUp, HiPencil, HiPlus, HiRefresh, HiSearch, HiTrash } from 'react-icons/hi'
import { FiltrosColapsaveis } from '@/components/FiltrosColapsaveis'
import { CabecalhoModal, CabecalhoModulo, IconePagar, IconeReceber } from '@/components/icones/IconesErp'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { formatarMoeda, mascararMoedaDigitada, parseMoeda } from '@/lib/reciboServico'
import { api } from '@/services/api'

type TipoTitulo = 'PAGAR' | 'RECEBER'
type Status = 'ABERTO' | 'PAGO_PARCIAL' | 'PAGO' | 'CANCELADO'
type FiltroStatus = 'todos' | 'aberto' | 'vencido' | 'pago' | 'cancelado'
type Coluna = 'pessoa' | 'numeroDocumento' | 'planoContas' | 'dataVencimento' | 'valor' | 'saldo' | 'status'

export type TituloFinanceiro = {
  id: number
  pessoa: string
  numeroDocumento: string
  tipoDocumento: string
  planoContas: string
  formaPagamento: string
  valor: number
  dataEmissao: string | null
  dataCompetencia: string | null
  dataVencimento: string
  parcela: string
  contaBancaria: string
  desconto: number
  juros: number
  multa: number
  valorBaixado: number
  dataBaixa: string | null
  codigoBarras: string
  observacao: string
  status: Status
  total: number
  saldo: number
}

type Formulario = {
  pessoa: string
  numeroDocumento: string
  tipoDocumento: string
  planoContas: string
  formaPagamento: string
  valor: string
  dataEmissao: string
  dataCompetencia: string
  dataVencimento: string
  parcela: string
  parcelas: string
  contaBancaria: string
  desconto: string
  juros: string
  multa: string
  valorBaixado: string
  dataBaixa: string
  codigoBarras: string
  observacao: string
  cancelado: boolean
}

const PAGE_SIZE = 16

const TIPOS_DOCUMENTO = ['Boleto', 'Duplicata', 'Nota fiscal', 'Recibo', 'Cupom', 'Outros']
const FORMAS = ['Boleto', 'PIX', 'Transferência', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Cheque']
const PLANOS_PAGAR = [
  'Compra de material',
  'Combustível',
  'Salário',
  'Diária',
  'Aluguel',
  'Material',
  'Mão de obra de terceiros',
  'Energia',
  'Água',
  'Telefone e internet',
  'Impostos e taxas',
  'Manutenção',
  'Frete',
  'Outras despesas',
]
const PLANOS_RECEBER = [
  'Serviço de encanamento',
  'Venda de material',
  'Mão de obra',
  'Visita técnica',
  'Locação de equipamento',
  'Outras receitas',
]

const STATUS: Record<Status, { label: string; classe: string }> = {
  ABERTO: { label: 'Aberto', classe: 'bg-sky-100 text-sky-800' },
  PAGO_PARCIAL: { label: 'Pago parcial', classe: 'bg-amber-100 text-amber-800' },
  PAGO: { label: 'Pago', classe: 'bg-emerald-100 text-emerald-800' },
  CANCELADO: { label: 'Cancelado', classe: 'bg-slate-200 text-slate-600' },
}

const FORM_VAZIO: Formulario = {
  pessoa: '',
  numeroDocumento: '',
  tipoDocumento: 'Boleto',
  planoContas: '',
  formaPagamento: 'PIX',
  valor: '',
  dataEmissao: '',
  dataCompetencia: '',
  dataVencimento: '',
  parcela: '',
  parcelas: '1',
  contaBancaria: '',
  desconto: '',
  juros: '',
  multa: '',
  valorBaixado: '',
  dataBaixa: '',
  codigoBarras: '',
  observacao: '',
  cancelado: false,
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

function dataBr(valor: string | null | undefined) {
  if (!valor) return '-'
  const [ano, mes, dia] = valor.split('-')
  if (!ano || !mes || !dia) return valor
  return `${dia}/${mes}/${ano}`
}

function Campo({
  label,
  obrigatorio,
  children,
}: {
  label: string
  obrigatorio?: boolean
  children: ReactNode
}) {
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

function hojeIso() {
  const data = new Date()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mes}-${dia}`
}

function vencido(titulo: TituloFinanceiro) {
  if (titulo.status === 'PAGO' || titulo.status === 'CANCELADO') return false
  return titulo.dataVencimento < hojeIso()
}

function rotuloStatus(titulo: TituloFinanceiro) {
  if (vencido(titulo) && titulo.status === 'ABERTO') return { label: 'Vencido', classe: 'bg-red-100 text-red-700' }
  if (vencido(titulo) && titulo.status === 'PAGO_PARCIAL') return { label: 'Parcial vencido', classe: 'bg-red-100 text-red-700' }
  return STATUS[titulo.status]
}

export function FinanceiroTitulos({
  tipo,
  showToast,
  filtroInicial = null,
  onFiltroConsumido,
}: {
  tipo: TipoTitulo
  showToast: (message: string, type?: 'success' | 'error') => void
  filtroInicial?: FiltroStatus | null
  onFiltroConsumido?: () => void
}) {
  const pagar = tipo === 'PAGAR'
  const planos = pagar ? PLANOS_PAGAR : PLANOS_RECEBER
  const pessoaLabel = pagar ? 'Fornecedor' : 'Cliente'
  const baixaLabel = pagar ? 'Valor pago' : 'Valor recebido'
  const [titulos, setTitulos] = useState<TituloFinanceiro[]>([])
  const [listaVersao, setListaVersao] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroStatus>(filtroInicial || 'todos')
  const [selecionados, setSelecionados] = useState<number[]>([])
  const [pagina, setPagina] = useState(0)
  const [ordenacao, setOrdenacao] = useState<{ coluna: Coluna; direcao: 'asc' | 'desc' }>({
    coluna: 'dataVencimento',
    direcao: 'asc',
  })
  const [modalAberto, setModalAberto] = useState(false)
  const [acoesAberto, setAcoesAberto] = useState(false)
  const [editando, setEditando] = useState<TituloFinanceiro | null>(null)
  const [form, setForm] = useState<Formulario>(FORM_VAZIO)
  const isMobile = useIsMobile()
  const empresa = empresaSelecionada()
  const tituloSelecionado =
    selecionados.length === 1 ? titulos.find((titulo) => titulo.id === selecionados[0]) || null : null
  const rotuloNovo = pagar ? 'Nova conta' : 'Novo recebimento'
  const rotuloAcoes = pagar ? 'Ações da conta' : 'Ações do recebimento'

  async function carregar() {
    setCarregando(true)
    const response = await api.getTitulos(tipo)
    if (response.data) setTitulos(response.data as TituloFinanceiro[])
    else {
      setTitulos([])
      if (response.error) showToast(response.error, 'error')
    }
    setCarregando(false)
    setListaVersao((atual) => atual + 1)
  }

  useEffect(() => {
    void carregar()
    // Recarrega ao trocar a rotina.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo])

  useEffect(() => {
    if (!filtroInicial) return
    setFiltro(filtroInicial)
    setPagina(0)
    onFiltroConsumido?.()
  }, [filtroInicial])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const lista = titulos.filter((titulo) => {
      if (filtro === 'vencido' && !vencido(titulo)) return false
      if (filtro === 'aberto' && (titulo.status === 'PAGO' || titulo.status === 'CANCELADO' || vencido(titulo))) return false
      if (filtro === 'pago' && titulo.status !== 'PAGO' && titulo.status !== 'PAGO_PARCIAL') return false
      if (filtro === 'cancelado' && titulo.status !== 'CANCELADO') return false
      if (!termo) return true
      return [titulo.pessoa, titulo.numeroDocumento, titulo.planoContas, titulo.tipoDocumento, titulo.formaPagamento, titulo.parcela]
        .join(' ')
        .toLowerCase()
        .includes(termo)
    })
    const peso: Record<Status, number> = { ABERTO: 0, PAGO_PARCIAL: 1, PAGO: 2, CANCELADO: 3 }
    lista.sort((a, b) => {
      let resultado = 0
      if (ordenacao.coluna === 'valor' || ordenacao.coluna === 'saldo') resultado = a[ordenacao.coluna] - b[ordenacao.coluna]
      else if (ordenacao.coluna === 'status') resultado = peso[a.status] - peso[b.status]
      else resultado = String(a[ordenacao.coluna] || '').localeCompare(String(b[ordenacao.coluna] || ''), 'pt-BR')
      return ordenacao.direcao === 'asc' ? resultado : -resultado
    })
    return lista
  }, [titulos, busca, filtro, ordenacao])

  const resumo = useMemo(() => {
    const abertos = titulos.filter((titulo) => titulo.status === 'ABERTO' || titulo.status === 'PAGO_PARCIAL')
    return {
      quantidade: abertos.length,
      vencidos: abertos.filter((titulo) => vencido(titulo)).length,
      saldo: abertos.reduce((soma, titulo) => soma + titulo.saldo, 0),
    }
  }, [titulos])

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
    setForm({ ...FORM_VAZIO, planoContas: planos[0], dataEmissao: hojeIso(), dataVencimento: hojeIso(), dataCompetencia: hojeIso() })
    setModalAberto(true)
  }

  function abrirEdicao(titulo: TituloFinanceiro) {
    setEditando(titulo)
    setForm({
      pessoa: titulo.pessoa,
      numeroDocumento: titulo.numeroDocumento,
      tipoDocumento: titulo.tipoDocumento,
      planoContas: titulo.planoContas,
      formaPagamento: titulo.formaPagamento,
      valor: formatarMoeda(titulo.valor),
      dataEmissao: titulo.dataEmissao || '',
      dataCompetencia: titulo.dataCompetencia || '',
      dataVencimento: titulo.dataVencimento,
      parcela: titulo.parcela,
      parcelas: '1',
      contaBancaria: titulo.contaBancaria,
      desconto: titulo.desconto ? formatarMoeda(titulo.desconto) : '',
      juros: titulo.juros ? formatarMoeda(titulo.juros) : '',
      multa: titulo.multa ? formatarMoeda(titulo.multa) : '',
      valorBaixado: titulo.valorBaixado ? formatarMoeda(titulo.valorBaixado) : '',
      dataBaixa: titulo.dataBaixa || '',
      codigoBarras: titulo.codigoBarras,
      observacao: titulo.observacao,
      cancelado: titulo.status === 'CANCELADO',
    })
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setEditando(null)
    setForm(FORM_VAZIO)
  }

  function payload() {
    const valor = Math.round((parseMoeda(form.valor) + Number.EPSILON) * 100) / 100
    const desconto = Math.round((parseMoeda(form.desconto) + Number.EPSILON) * 100) / 100
    const juros = Math.round((parseMoeda(form.juros) + Number.EPSILON) * 100) / 100
    const multa = Math.round((parseMoeda(form.multa) + Number.EPSILON) * 100) / 100
    const valorBaixado = Math.round((parseMoeda(form.valorBaixado) + Number.EPSILON) * 100) / 100
    const parcelas = Math.max(1, Number(form.parcelas) || 1)
    return {
      valor,
      desconto,
      juros,
      multa,
      valorBaixado,
      parcelas,
      body: {
        tipo,
        pessoa: form.pessoa.trim(),
        numeroDocumento: form.numeroDocumento.trim(),
        tipoDocumento: form.tipoDocumento,
        planoContas: form.planoContas.trim(),
        formaPagamento: form.formaPagamento,
        valor,
        dataVencimento: form.dataVencimento,
        dataEmissao: form.dataEmissao || undefined,
        dataCompetencia: form.dataCompetencia || undefined,
        contaBancaria: form.contaBancaria.trim(),
        desconto,
        juros,
        multa,
        valorBaixado,
        dataBaixa: form.dataBaixa || undefined,
        codigoBarras: form.codigoBarras.trim(),
        observacao: form.observacao.trim(),
        status: form.cancelado ? 'CANCELADO' : 'ABERTO',
        ...(editando ? { parcela: form.parcela.trim() } : { parcelas }),
      },
    }
  }

  async function salvar() {
    if (!empresa) {
      showToast('Selecione a empresa antes de lançar o título.', 'error')
      return
    }
    const dados = payload()
    if (dados.body.pessoa.length < 2) {
      showToast(`${pessoaLabel} é obrigatório.`, 'error')
      return
    }
    if (!dados.body.tipoDocumento || !dados.body.planoContas || !dados.body.formaPagamento) {
      showToast('Tipo de documento, plano de contas e forma de pagamento são obrigatórios.', 'error')
      return
    }
    if (!Number.isFinite(dados.valor) || dados.valor <= 0) {
      showToast('Informe um valor maior que zero.', 'error')
      return
    }
    if (!dados.body.dataVencimento) {
      showToast('Data de vencimento é obrigatória.', 'error')
      return
    }
    if ([dados.desconto, dados.juros, dados.multa, dados.valorBaixado].some((item) => Number.isNaN(item) || item < 0)) {
      showToast('Desconto, juros, multa e baixa precisam ser valores válidos.', 'error')
      return
    }
    if (!editando && (dados.parcelas < 1 || dados.parcelas > 60)) {
      showToast('O parcelamento aceita de 1 a 60 parcelas.', 'error')
      return
    }

    const body = { ...dados.body } as Record<string, unknown>
    if (editando) delete body.tipo
    setSalvando(true)
    const response = editando ? await api.updateTitulo(editando.id, body) : await api.createTitulo(body)
    setSalvando(false)
    if (response.error) {
      showToast(response.error, 'error')
      return
    }
    showToast(editando ? 'Título atualizado.' : dados.parcelas > 1 ? `${dados.parcelas} parcelas lançadas.` : 'Título lançado.', 'success')
    fecharModal()
    setPagina(0)
    await carregar()
  }

  async function excluirSelecionados() {
    if (selecionados.length === 0) return
    const response = await api.deleteTitulos(selecionados)
    if (response.error) {
      showToast(response.error, 'error')
      return
    }
    showToast('Títulos excluídos.', 'success')
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

  const card = 'rounded-md border border-[#ddd] bg-white p-4'
  const campo = 'h-11 w-full min-w-0 rounded-md border border-[#eee] bg-white px-3 text-sm text-[#333]'

  return (
    <div
      data-ds="ant-mobile-financeiro"
      className="h-full min-h-0 overflow-y-auto overscroll-y-contain bg-[#f5f5f9] [-webkit-overflow-scrolling:touch]"
    >
      <div className="space-y-4 border-b border-[#eee] bg-white px-[15px] py-4">
        <CabecalhoModulo
          icone={pagar ? IconePagar : IconeReceber}
          titulo={pagar ? 'Contas a pagar' : 'Contas a receber'}
          acoes={
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
                    disabled={!tituloSelecionado}
                    onClick={() => tituloSelecionado && abrirEdicao(tituloSelecionado)}
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
          }
        />
        <FiltrosColapsaveis conteudoClassName="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative min-w-0">
            <HiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#888]" />
            <input
              value={busca}
              onChange={(event) => {
                setBusca(event.target.value)
                setPagina(0)
              }}
              placeholder="Buscar pessoa, documento..."
              className={`${campo} pl-9`}
            />
          </div>
          <select
            value={filtro}
            onChange={(event) => {
              setFiltro(event.target.value as FiltroStatus)
              setPagina(0)
            }}
            className={campo}
          >
            <option value="todos">Todos</option>
            <option value="aberto">Em aberto</option>
            <option value="vencido">Vencidos</option>
            <option value="pago">Pagos</option>
            <option value="cancelado">Cancelados</option>
          </select>
        </FiltrosColapsaveis>
      </div>

      {!pagar ? <SecaoEmAtraso versao={listaVersao} showToast={showToast} /> : null}

      <div className="grid grid-cols-1 gap-2 border-b border-[#eee] bg-white px-[15px] py-4 sm:grid-cols-3">
        <div className={card}>
          <p className="text-xs text-[#888]">Em aberto</p>
          <p className="mt-2 text-lg font-semibold text-[#333]">{resumo.quantidade}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-[#888]">Vencidos</p>
          <p className="mt-2 text-lg font-semibold text-red-600">{resumo.vencidos}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-[#888]">{pagar ? 'Saldo a pagar' : 'Saldo a receber'}</p>
          <p className="mt-2 text-lg font-semibold tabular-nums text-[#333]">{moeda(resumo.saldo)}</p>
        </div>
      </div>

      <div>
        {/* Mobile: lista em cards (Ant) */}
        <div className="space-y-3 px-[15px] py-4 md:hidden">
          {carregando ? (
            <p className="text-sm text-[#888]">Carregando títulos...</p>
          ) : visiveis.length === 0 ? (
            <p className="text-sm text-[#888]">Nenhum título encontrado</p>
          ) : (
            visiveis.map((titulo) => {
              const status = rotuloStatus(titulo)
              return (
                <article key={titulo.id} className={`${card} space-y-3`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selecionados.includes(titulo.id)}
                      onChange={() =>
                        setSelecionados((lista) =>
                          lista.includes(titulo.id) ? lista.filter((id) => id !== titulo.id) : [...lista, titulo.id],
                        )
                      }
                      className="mt-1 h-5 w-5 shrink-0 cursor-pointer rounded"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="break-words text-[15px] font-medium leading-snug text-[#333]">{titulo.pessoa}</p>
                      <p className={`text-xs ${vencido(titulo) ? 'font-medium text-red-600' : 'text-[#888]'}`}>
                        venc. {dataBr(titulo.dataVencimento)}
                        {titulo.parcela ? ` · Parcela ${titulo.parcela}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => abrirEdicao(titulo)}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#eee] bg-white"
                      aria-label="Editar título"
                    >
                      <HiPencil className="h-4 w-4 text-primary" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-[#eee] pt-3">
                    <div className="min-w-0">
                      <p className="text-[11px] text-[#888]">Saldo</p>
                      <p className="mt-1 break-all text-sm font-semibold tabular-nums text-[#333]">{moeda(titulo.saldo)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] text-[#888]">Status</p>
                      <span className={`mt-1 inline-flex rounded px-2 py-1 text-xs font-medium ${status.classe}`}>{status.label}</span>
                    </div>
                  </div>
                  {titulo.numeroDocumento || titulo.planoContas ? (
                    <p className="break-words text-xs text-[#888]">
                      {[titulo.numeroDocumento, titulo.tipoDocumento, titulo.planoContas].filter(Boolean).join(' · ')}
                    </p>
                  ) : null}
                </article>
              )
            })
          )}
        </div>

        {/* Desktop: tabela */}
        <table className="hidden w-full border-collapse md:table md:min-w-[920px]">
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              <th className="w-12 border-b border-[#eee] px-2 py-2" />
              <th className="w-16 border-b border-[#eee] px-4 py-2 text-left text-xs font-medium text-[#888]">Editar</th>
              <Cabecalho coluna="pessoa" label={pessoaLabel} />
              <Cabecalho coluna="numeroDocumento" label="Documento" className="hidden lg:table-cell" />
              <Cabecalho coluna="planoContas" label="Plano de contas" className="hidden lg:table-cell" />
              <Cabecalho coluna="dataVencimento" label="Vencimento" />
              <Cabecalho coluna="valor" label="Valor" />
              <Cabecalho coluna="saldo" label="Saldo" />
              <Cabecalho coluna="status" label="Status" />
            </tr>
          </thead>
          <tbody className="bg-white">
            {carregando ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[#888]">
                  Carregando títulos...
                </td>
              </tr>
            ) : visiveis.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[#888]">
                  {pagar ? (
                    <IconePagar className="mx-auto mb-2 block h-8 w-8 text-[#888]" />
                  ) : (
                    <IconeReceber className="mx-auto mb-2 block h-8 w-8 text-[#888]" />
                  )}
                  Nenhum título encontrado
                </td>
              </tr>
            ) : (
              visiveis.map((titulo) => {
                const status = rotuloStatus(titulo)
                return (
                  <tr key={titulo.id} className="border-b border-[#eee] hover:bg-[#f5f5f9]">
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selecionados.includes(titulo.id)}
                        onChange={() =>
                          setSelecionados((lista) =>
                            lista.includes(titulo.id) ? lista.filter((id) => id !== titulo.id) : [...lista, titulo.id],
                          )
                        }
                        className="cursor-pointer rounded"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <button type="button" onClick={() => abrirEdicao(titulo)} title="Editar título" aria-label="Editar título">
                        <HiPencil className="h-4 w-4 text-primary" />
                      </button>
                    </td>
                    <td className="px-2 py-2 text-sm sm:px-4">
                      <div className="line-clamp-2 text-[#333]">{titulo.pessoa}</div>
                      {titulo.parcela ? <div className="text-xs text-[#888]">Parcela {titulo.parcela}</div> : null}
                    </td>
                    <td className="hidden px-4 py-2 text-sm lg:table-cell">
                      <div className="text-[#333]">{titulo.numeroDocumento || '-'}</div>
                      <div className="text-xs text-[#888]">{titulo.tipoDocumento}</div>
                    </td>
                    <td className="hidden px-4 py-2 text-sm text-[#333] lg:table-cell">{titulo.planoContas}</td>
                    <td className={`whitespace-nowrap px-4 py-2 text-sm ${vencido(titulo) ? 'font-medium text-red-600' : 'text-[#333]'}`}>
                      {dataBr(titulo.dataVencimento)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-sm text-[#333]">{moeda(titulo.total)}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-sm text-[#333] sm:px-4">{moeda(titulo.saldo)}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded px-2 py-1 text-xs font-medium ${status.classe}`}>{status.label}</span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 border-t border-[#eee] bg-white px-[15px] py-3 pb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-[#888]">
          {filtrados.length > 0
            ? `Página ${paginaAtual + 1} de ${totalPaginas} • Total: ${filtrados.length} título${filtrados.length === 1 ? '' : 's'}`
            : 'Nenhum título encontrado'}
        </div>
        {filtrados.length > PAGE_SIZE && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPagina((atual) => Math.max(0, atual - 1))}
              disabled={paginaAtual === 0}
              className="h-11 rounded-md border border-[#eee] bg-white px-3 text-sm text-[#333] disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPagina((atual) => Math.min(totalPaginas - 1, atual + 1))}
              disabled={paginaAtual >= totalPaginas - 1}
              className="h-11 rounded-md border border-[#eee] bg-white px-3 text-sm text-[#333] disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        )}
      </div>

      <Sheet open={acoesAberto} onOpenChange={setAcoesAberto}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-4 pb-8 pt-4 sm:mx-auto sm:max-w-lg">
          <SheetHeader className="mb-4 space-y-1 pr-8 text-left">
            <SheetTitle>{rotuloAcoes}</SheetTitle>
            <SheetDescription>
              {selecionados.length === 0
                ? 'Selecione títulos na lista para editar ou excluir.'
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
              <HiPlus className="h-4 w-4" />
              {rotuloNovo}
            </button>
            <button
              type="button"
              disabled={!tituloSelecionado}
              onClick={() => {
                if (!tituloSelecionado) return
                setAcoesAberto(false)
                abrirEdicao(tituloSelecionado)
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
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg bg-background p-4 shadow-xl sm:p-6">
            <CabecalhoModal
              icone={pagar ? IconePagar : IconeReceber}
              titulo={editando ? 'Editar título' : pagar ? 'Nova conta a pagar' : 'Nova conta a receber'}
              descricao={pagar ? 'Fornecedor, valor e vencimento.' : 'Cliente, valor e vencimento.'}
              onFechar={fecharModal}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Campo label={pessoaLabel} obrigatorio>
                <input value={form.pessoa} onChange={(event) => setForm({ ...form, pessoa: event.target.value })} className={inputClass} />
              </Campo>
              <Campo label="Número do documento">
                <input
                  value={form.numeroDocumento}
                  onChange={(event) => setForm({ ...form, numeroDocumento: event.target.value })}
                  className={inputClass}
                  placeholder="NF, boleto ou duplicata"
                />
              </Campo>
              <Campo label="Tipo de documento" obrigatorio>
                <select value={form.tipoDocumento} onChange={(event) => setForm({ ...form, tipoDocumento: event.target.value })} className={inputClass}>
                  {TIPOS_DOCUMENTO.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Plano de contas" obrigatorio>
                <select value={form.planoContas} onChange={(event) => setForm({ ...form, planoContas: event.target.value })} className={inputClass}>
                  <option value="">Selecione</option>
                  {form.planoContas && !planos.includes(form.planoContas) ? <option>{form.planoContas}</option> : null}
                  {planos.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Campo>
              <Campo label={pagar ? 'Forma de pagamento' : 'Forma de recebimento'} obrigatorio>
                <select value={form.formaPagamento} onChange={(event) => setForm({ ...form, formaPagamento: event.target.value })} className={inputClass}>
                  {FORMAS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Valor" obrigatorio>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="R$ 0,00"
                  value={form.valor}
                  onChange={(event) => setForm((atual) => ({ ...atual, valor: mascararMoedaDigitada(event.target.value) }))}
                  className={inputClass}
                />
              </Campo>
              <Campo label="Data de emissão">
                <input type="date" value={form.dataEmissao} onChange={(event) => setForm({ ...form, dataEmissao: event.target.value })} className={inputClass} />
              </Campo>
              <Campo label="Data de competência">
                <input
                  type="date"
                  value={form.dataCompetencia}
                  onChange={(event) => setForm({ ...form, dataCompetencia: event.target.value })}
                  className={inputClass}
                />
              </Campo>
              <Campo label="Data de vencimento" obrigatorio>
                <input
                  type="date"
                  value={form.dataVencimento}
                  onChange={(event) => setForm({ ...form, dataVencimento: event.target.value })}
                  className={inputClass}
                />
              </Campo>
              {editando ? (
                <Campo label="Parcela">
                  <input value={form.parcela} onChange={(event) => setForm({ ...form, parcela: event.target.value })} className={inputClass} placeholder="1/3" />
                </Campo>
              ) : (
                <Campo label="Parcelas">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={form.parcelas}
                    onChange={(event) => setForm({ ...form, parcelas: event.target.value })}
                    className={inputClass}
                  />
                </Campo>
              )}
              <Campo label={pagar ? 'Conta prevista' : 'Conta de recebimento'}>
                <input
                  value={form.contaBancaria}
                  onChange={(event) => setForm({ ...form, contaBancaria: event.target.value })}
                  className={inputClass}
                  placeholder="Banco, agência ou caixa"
                />
              </Campo>
              <Campo label="Desconto">
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="R$ 0,00"
                  value={form.desconto}
                  onChange={(event) => setForm((atual) => ({ ...atual, desconto: mascararMoedaDigitada(event.target.value) }))}
                  className={inputClass}
                  disabled={!editando && Number(form.parcelas) > 1}
                />
              </Campo>
              <Campo label="Juros">
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="R$ 0,00"
                  value={form.juros}
                  onChange={(event) => setForm((atual) => ({ ...atual, juros: mascararMoedaDigitada(event.target.value) }))}
                  className={inputClass}
                  disabled={!editando && Number(form.parcelas) > 1}
                />
              </Campo>
              <Campo label="Multa">
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="R$ 0,00"
                  value={form.multa}
                  onChange={(event) => setForm((atual) => ({ ...atual, multa: mascararMoedaDigitada(event.target.value) }))}
                  className={inputClass}
                  disabled={!editando && Number(form.parcelas) > 1}
                />
              </Campo>
              <Campo label={baixaLabel}>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="R$ 0,00"
                  value={form.valorBaixado}
                  onChange={(event) => setForm((atual) => ({ ...atual, valorBaixado: mascararMoedaDigitada(event.target.value) }))}
                  className={inputClass}
                  disabled={!editando && Number(form.parcelas) > 1}
                />
              </Campo>
              <Campo label={pagar ? 'Data do pagamento' : 'Data do recebimento'}>
                <input
                  type="date"
                  value={form.dataBaixa}
                  onChange={(event) => setForm({ ...form, dataBaixa: event.target.value })}
                  className={inputClass}
                  disabled={!editando && Number(form.parcelas) > 1}
                />
              </Campo>
              {pagar ? (
                <Campo label="Código de barras">
                  <input value={form.codigoBarras} onChange={(event) => setForm({ ...form, codigoBarras: event.target.value })} className={inputClass} />
                </Campo>
              ) : null}
              <Campo label="Observação">
                <input value={form.observacao} onChange={(event) => setForm({ ...form, observacao: event.target.value })} className={inputClass} />
              </Campo>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.cancelado}
                onChange={(event) => setForm({ ...form, cancelado: event.target.checked })}
              />
              Cancelar este título
            </label>
            <p className="mt-3 text-xs text-muted-foreground">
              Obrigatórios: {pessoaLabel.toLowerCase()}, valor, vencimento, tipo de documento, plano de contas e forma de {pagar ? 'pagamento' : 'recebimento'}. O status pago é calculado pela baixa. Título com baixa não pode ser excluído.
              {!editando ? ' Mais de uma parcela divide o valor e avança o vencimento mês a mês.' : ''}
            </p>
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

type ParcelaAtraso = {
  id: number
  numeroDocumento: string
  parcela: string
  dataVencimento: string
  saldo: number
  diasAtraso: number
}

type PessoaAtraso = {
  nome: string
  quantidade: number
  saldo: number
  parcelas: ParcelaAtraso[]
}

function SecaoEmAtraso({
  versao,
  showToast,
}: {
  versao: number
  showToast: (message: string, type?: 'success' | 'error') => void
}) {
  const [pessoas, setPessoas] = useState<PessoaAtraso[]>([])
  const [saldo, setSaldo] = useState(0)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    void api.getDevedores().then((response) => {
      if (!ativo) return
      if (response.data) {
        const dados = response.data as { pessoas?: PessoaAtraso[]; saldo?: number }
        setPessoas(Array.isArray(dados.pessoas) ? dados.pessoas : [])
        setSaldo(Number(dados.saldo) || 0)
      } else {
        setPessoas([])
        setSaldo(0)
        if (response.error) showToast(response.error, 'error')
      }
      setCarregando(false)
    })
    return () => {
      ativo = false
    }
  }, [versao])

  return (
    <section className="space-y-3 border-b border-[#eee] bg-white px-[15px] py-4">
      <div className="space-y-1">
        <h3 className="text-[15px] font-medium text-red-700">Em atraso</h3>
        <p className="text-sm text-[#888]">Parcelas a receber vencidas, agrupadas por cliente.</p>
        <p className="text-sm font-semibold text-red-700">
          {pessoas.length === 0 ? 'Nenhum saldo vencido' : moeda(saldo)}
        </p>
      </div>
      {carregando ? (
        <p className="text-sm text-[#888]">Carregando devedores...</p>
      ) : pessoas.length === 0 ? (
        <p className="text-sm text-[#888]">Nenhum título em atraso.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {pessoas.map((pessoa) => (
            <article key={pessoa.nome} className="space-y-3 rounded-md border border-[#ddd] bg-white p-4">
              <div className="min-w-0 space-y-1">
                <p className="break-words text-[15px] font-medium text-[#333]">{pessoa.nome}</p>
                <p className="text-xs text-[#888]">
                  {pessoa.quantidade} parcela{pessoa.quantidade === 1 ? '' : 's'}
                </p>
                <p className="text-sm font-semibold tabular-nums text-[#333]">{moeda(pessoa.saldo)}</p>
              </div>
              <ul className="space-y-2 border-t border-[#eee] pt-3">
                {pessoa.parcelas.map((parcela) => (
                  <li key={parcela.id} className="flex min-h-11 flex-col justify-center gap-0.5 border-b border-[#eee] pb-2 last:border-b-0 last:pb-0">
                    <span className="break-words text-sm text-[#333]">
                      {dataBr(parcela.dataVencimento)}
                      {parcela.parcela ? ` · ${parcela.parcela}` : ''}
                      {parcela.numeroDocumento ? ` · ${parcela.numeroDocumento}` : ''}
                    </span>
                    <span className="text-xs text-[#888]">
                      {parcela.diasAtraso} dia{parcela.diasAtraso === 1 ? '' : 's'} · {moeda(parcela.saldo)}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
