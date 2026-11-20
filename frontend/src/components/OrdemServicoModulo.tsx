import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { pdf } from '@react-pdf/renderer'
import { FaWhatsapp } from 'react-icons/fa'
import { HiChevronDown, HiChevronUp, HiDownload, HiPencil, HiPlus, HiRefresh, HiTrash } from 'react-icons/hi'
import { toast } from 'sonner'
import { ReciboServicoPdf } from '@/components/ReciboServicoPDF'
import { abrirUrlExterna, baixarArquivo, compartilharArquivoComTexto } from '@/lib/baixarArquivo'
import {
  formatarDataCurta,
  formatarMoeda,
  hojeISO,
  mascararMoedaDigitada,
  parseMoeda,
  whatsappDestino,
  type OrdemServico,
} from '@/lib/reciboServico'
import { ExportarRelatorio } from '@/components/ExportarRelatorio'
import { FiltrosColapsaveis } from '@/components/FiltrosColapsaveis'
import { CabecalhoModal, CabecalhoModulo, IconeAssinatura, IconeOrdem } from '@/components/icones/IconesErp'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { api } from '@/services/api'

const PAGE_SIZE = 16
const FORMAS = ['Boleto', 'PIX', 'Transferência', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Cheque']

type Situacao = 'ABERTA' | 'AGENDADA' | 'EM_ANDAMENTO' | 'EM_EXECUCAO' | 'CONCLUIDA' | 'ENCERRADA' | 'CANCELADA'
type Coluna = 'numero' | 'cliente' | 'data' | 'situacao' | 'total'

type EnderecoApi = {
  id?: number
  apelido: string
  logradouro: string
  numero?: string
  bairro?: string
  cep?: string
  cidade: string
  uf?: string
  principal: boolean
}

function mascararCep(valor: string) {
  const digitos = valor.replace(/\D/g, '').slice(0, 8)
  if (digitos.length <= 5) return digitos
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`
}

function extrairCep(logradouro: string, cep?: string | null) {
  if (cep && String(cep).replace(/\D/g, '').length >= 8) return mascararCep(String(cep))
  const m = /CEP\s*([0-9]{5}-?[0-9]{3})/i.exec(logradouro || '')
  return m ? mascararCep(m[1]) : ''
}

function rotuloEndereco(item: EnderecoApi) {
  const partes = [
    item.apelido ? `${item.apelido} —` : null,
    item.logradouro,
    item.numero,
    item.bairro,
    item.cep ? `CEP ${item.cep}` : null,
    item.cidade,
    item.uf,
    item.principal ? '(principal)' : null,
  ].filter(Boolean)
  return partes.join(' ')
}

function normalizarEnderecos(lista: EnderecoApi[] | undefined): EnderecoApi[] {
  return (lista || []).map((item) => ({
    ...item,
    apelido: item.apelido || '',
    logradouro: item.logradouro || '',
    numero: item.numero || '',
    bairro: item.bairro || '',
    cep: extrairCep(item.logradouro || '', item.cep),
    cidade: item.cidade || '',
    uf: item.uf || '',
    principal: Boolean(item.principal),
  }))
}

function atualizarEndereco(
  lista: EnderecoApi[],
  indice: number,
  patch: Partial<EnderecoApi>,
) {
  return lista.map((linha, posicao) => (posicao === indice ? { ...linha, ...patch } : linha))
}

type ClienteApi = {
  id: number
  nome: string
  telefone: string
  endereco: string
  cidade: string
  tipoPessoa?: 'FISICA' | 'JURIDICA'
  enderecos?: EnderecoApi[]
}

type ProdutoApi = {
  id: number
  codigo: string
  descricao: string
  unidade: string
  estoque: number
  ativo: boolean
}

type PecaApi = {
  id: number
  produtoId: number
  codigo: string
  descricao: string
  unidade: string
  quantidade: number
  custoUnitario: number | null
}

type OrdemApi = {
  id: number
  numero: number
  clienteId: number
  cliente: string
  telefone: string
  endereco: string
  cidade: string
  situacao: Situacao
  tipo?: 'EMERGENCIA' | 'PREVENTIVA' | 'OBRA'
  origem?: 'WHATSAPP' | 'TELEFONE' | 'INDICACAO'
  descricaoProblema?: string
  funcionarioId?: number | null
  funcionario?: string
  enderecoId?: number | null
  fotos?: Array<{ id: number; momento: 'ANTES' | 'DEPOIS'; url: string }>
  materiaisLoja?: Array<{ id: number; descricao: string; quantidadeRetirada: number; quantidadeUsada: number; quantidadeDevolvida: number }>
  margem?: number | null
  preventivaEm?: string | null
  vistoria: string
  servicos: string
  taxaVistoria: number
  maoDeObra: number
  deslocamento: number
  material: number
  total: number
  entradaValor?: number | null
  dataAbertura: string
  dataEncerramento: string | null
  garantiaAte: string | null
  assinatura: string
  pecas: PecaApi[]
  titulos?: number
}

type PecaForm = {
  produtoId: string
  quantidade: string
  custoUnitario: number | null
  rotulo: string
}

type Formulario = {
  clienteId: number | null
  clienteOriginal: string
  cliente: string
  whatsapp: string
  endereco: string
  cidade: string
  data: string
  situacao: 'ABERTA' | 'AGENDADA' | 'EM_ANDAMENTO' | 'EM_EXECUCAO'
  tipo: 'EMERGENCIA' | 'PREVENTIVA' | 'OBRA'
  origem: 'WHATSAPP' | 'TELEFONE' | 'INDICACAO'
  descricaoProblema: string
  funcionarioId: string
  enderecoId: string
  tipoPessoa: 'FISICA' | 'JURIDICA'
  enderecos: EnderecoApi[]
  materiaisLoja: Array<{ descricao: string; quantidadeRetirada: string; quantidadeUsada: string; quantidadeDevolvida: string }>
  vistoria: string
  servicos: string
  taxaVistoria: string
  maoDeObra: string
  deslocamento: string
  material: string
  assinatura: string
  pecas: PecaForm[]
}

const SITUACAO: Record<Situacao, string> = {
  ABERTA: 'Aberta',
  AGENDADA: 'Agendada',
  EM_ANDAMENTO: 'Em andamento',
  EM_EXECUCAO: 'Em andamento',
  CONCLUIDA: 'Concluída',
  ENCERRADA: 'Encerrada',
  CANCELADA: 'Cancelada',
}

const FORM_VAZIO = (): Formulario => ({
  clienteId: null,
  clienteOriginal: '',
  cliente: '',
  whatsapp: '',
  endereco: '',
  cidade: 'Porto União',
  data: hojeISO(),
  situacao: 'ABERTA',
  tipo: 'EMERGENCIA',
  origem: 'WHATSAPP',
  descricaoProblema: '',
  funcionarioId: '',
  enderecoId: '',
  tipoPessoa: 'FISICA',
  enderecos: [],
  materiaisLoja: [],
  vistoria: '',
  servicos: '',
  taxaVistoria: '',
  maoDeObra: '',
  deslocamento: '',
  material: '',
  assinatura: '',
  pecas: [],
})

function assetsRecibo() {
  const base = window.location.origin
  return {
    logo: `${base}/logo-recibo.png`,
    marca: `${base}/marca-dagua-rr.png`,
    assinaturaEmpresa: `${base}/assinatura-ricardo.png`,
  }
}

function parseQuantidade(valor: string) {
  const limpo = valor.trim().replace(/\s/g, '')
  if (!limpo) return Number.NaN
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  const numero = Number(normalizado)
  return Number.isFinite(numero) ? numero : Number.NaN
}

function dinheiro(valor: string) {
  return Math.round((parseMoeda(valor) + Number.EPSILON) * 100) / 100
}

function centavosMoeda(valor: number) {
  return Math.round((Number(valor) || 0) * 100)
}

function saldoParcelado(total: number, entrada: number) {
  return (centavosMoeda(total) - centavosMoeda(entrada)) / 100
}

function entradaDa(ordem: { entradaValor?: number | null }) {
  return ordem.entradaValor == null ? 0 : ordem.entradaValor
}

function quantidadeCampo(valor: number) {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

function reciboDe(ordem: OrdemApi): OrdemServico {
  return {
    id: String(ordem.id),
    numero: ordem.numero,
    cliente: ordem.cliente,
    whatsapp: ordem.telefone,
    endereco: ordem.endereco,
    cidade: ordem.cidade,
    data: ordem.dataAbertura,
    servicos: ordem.servicos
      .split('\n')
      .map((linha) => linha.trim())
      .filter(Boolean),
    vistoria: ordem.vistoria,
    maoDeObra: ordem.maoDeObra,
    material: ordem.material,
    taxaVistoria: ordem.taxaVistoria,
    deslocamento: ordem.deslocamento,
    total: ordem.total,
    assinatura: ordem.assinatura,
  }
}

function pecaDoForm(peca: PecaApi): PecaForm {
  return {
    produtoId: String(peca.produtoId),
    quantidade: quantidadeCampo(peca.quantidade),
    custoUnitario: peca.custoUnitario,
    rotulo: `${peca.codigo} - ${peca.descricao}`,
  }
}

export function OrdemServicoModulo({
  isAdmin = true,
  ordemInicialId = null,
  onOrdemConsumida,
  situacaoInicial = null,
  onSituacaoConsumida,
  prefill = null,
  onPrefillConsumido,
}: {
  isAdmin?: boolean
  ordemInicialId?: number | null
  onOrdemConsumida?: () => void
  situacaoInicial?: string | null
  onSituacaoConsumida?: () => void
  prefill?: { clienteId: number; enderecoId: number | null } | null
  onPrefillConsumido?: () => void
}) {
  const [ordens, setOrdens] = useState<OrdemApi[]>([])
  const [clientes, setClientes] = useState<ClienteApi[]>([])
  const [produtos, setProdutos] = useState<ProdutoApi[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [encerrando, setEncerrando] = useState(false)
  const [busca, setBusca] = useState('')
  const [selecionadas, setSelecionadas] = useState<number[]>([])
  const [pagina, setPagina] = useState(0)
  const [ordenacao, setOrdenacao] = useState<{ coluna: Coluna; direcao: 'asc' | 'desc' }>({
    coluna: 'numero',
    direcao: 'desc',
  })
  const [modalAberto, setModalAberto] = useState(false)
  const [acoesAberto, setAcoesAberto] = useState(false)
  const isMobile = useIsMobile()
  const [editando, setEditando] = useState<OrdemApi | null>(null)
  const [form, setForm] = useState<Formulario>(FORM_VAZIO)
  const [assinandoId, setAssinandoId] = useState<number | 'form' | null>(null)
  const [gerandoId, setGerandoId] = useState<number | null>(null)
  const [encerrarAlvo, setEncerrarAlvo] = useState<OrdemApi | null>(null)
  const [encerrarForm, setEncerrarForm] = useState({
    formaPagamento: 'PIX',
    parcelas: '1',
    dataVencimento: hojeISO(),
    entrada: '',
    entradaRecebida: false,
    garantiaDias: '90',
    preventivaMeses: '6',
    usarQuintoDiaUtil: true,
  })
  const [funcionarios, setFuncionarios] = useState<Array<{ id: number; nome: string; especialidade: string | null }>>([])
  const [filtros, setFiltros] = useState({ situacao: situacaoInicial || '', de: '', ate: '', funcionarioId: '', tipo: '' })
  const [historico, setHistorico] = useState<Array<{ numero: number; situacao: string; dataAbertura: string; dataEncerramento?: string | null; garantiaAte: string | null; endereco: string }>>([])
  const [garantias, setGarantias] = useState<Array<{ id: number; numero: number; servicos: string; garantiaAte: string | null }>>([])
  const [motivoCancelamento, setMotivoCancelamento] = useState('')
  const [cancelando, setCancelando] = useState(false)

  async function carregar(silencioso = false) {
    if (!silencioso) setCarregando(true)
    try {
      const [ordensResp, clientesResp, produtosResp, funcionariosResp] = await Promise.all([
        api.getOrdens({
          situacao: filtros.situacao || undefined,
          de: filtros.de || undefined,
          ate: filtros.ate || undefined,
          funcionarioId: filtros.funcionarioId || undefined,
          tipo: filtros.tipo || undefined,
        }),
        api.getClientes(),
        api.getProdutos(),
        api.getFuncionariosOrdem(),
      ])
      if (ordensResp.error) toast.error(ordensResp.error)
      if (clientesResp.error) toast.error(clientesResp.error)
      if (produtosResp.error) toast.error(produtosResp.error)
      if (Array.isArray(ordensResp.data)) setOrdens(ordensResp.data as OrdemApi[])
      if (Array.isArray(clientesResp.data)) setClientes(clientesResp.data as ClienteApi[])
      if (Array.isArray(produtosResp.data)) setProdutos(produtosResp.data as ProdutoApi[])
      if (Array.isArray(funcionariosResp.data)) setFuncionarios(funcionariosResp.data as Array<{ id: number; nome: string; especialidade: string | null }>)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregar()
  }, [filtros.situacao, filtros.de, filtros.ate, filtros.funcionarioId, filtros.tipo])

  useEffect(() => {
    if (!form.clienteId) {
      setHistorico([])
      return
    }
    void api.historicoCliente(form.clienteId, form.enderecoId ? Number(form.enderecoId) : undefined).then((resposta) => {
      setHistorico((resposta.data as typeof historico) || [])
    })
  }, [form.clienteId, form.enderecoId, modalAberto])

  useEffect(() => {
    if (!modalAberto || !form.clienteId) {
      setGarantias([])
      return
    }
    const enderecoId = form.enderecoId ? Number(form.enderecoId) : undefined
    const texto = form.endereco.trim()
    if (!enderecoId && texto.length < 8) {
      setGarantias([])
      return
    }
    let cancelado = false
    const timer = window.setTimeout(() => {
      void api.garantiaVigente({
        enderecoId,
        logradouro: enderecoId ? undefined : texto,
        cidade: enderecoId ? undefined : form.cidade,
        excetoId: editando?.id,
      }).then((resposta) => {
        if (!cancelado) setGarantias(Array.isArray(resposta.data) ? resposta.data : [])
      })
    }, enderecoId ? 0 : 400)
    return () => {
      cancelado = true
      window.clearTimeout(timer)
    }
  }, [modalAberto, form.clienteId, form.enderecoId, form.endereco, form.cidade, editando?.id])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const lista = termo
      ? ordens.filter((ordem) => {
          const texto = [
            String(ordem.numero),
            ordem.cliente,
            ordem.endereco,
            ordem.telefone,
            ordem.vistoria,
            SITUACAO[ordem.situacao],
            formatarDataCurta(ordem.dataAbertura),
          ]
            .join(' ')
            .toLowerCase()
          return texto.includes(termo)
        })
      : [...ordens]
    lista.sort((a, b) => {
      let resultado = 0
      if (ordenacao.coluna === 'numero' || ordenacao.coluna === 'total') resultado = a[ordenacao.coluna] - b[ordenacao.coluna]
      else if (ordenacao.coluna === 'data') resultado = a.dataAbertura.localeCompare(b.dataAbertura)
      else if (ordenacao.coluna === 'situacao') resultado = SITUACAO[a.situacao].localeCompare(SITUACAO[b.situacao], 'pt-BR')
      else resultado = a.cliente.localeCompare(b.cliente, 'pt-BR')
      return ordenacao.direcao === 'asc' ? resultado : -resultado
    })
    return lista
  }, [ordens, busca, ordenacao])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE))
  const paginaAtual = Math.min(pagina, totalPaginas - 1)
  const visiveis = filtradas.slice(paginaAtual * PAGE_SIZE, paginaAtual * PAGE_SIZE + PAGE_SIZE)
  const ordemAssinando = typeof assinandoId === 'number' ? ordens.find((ordem) => ordem.id === assinandoId) ?? null : null
  const encerrada = editando?.situacao === 'ENCERRADA' || editando?.situacao === 'CANCELADA' || editando?.situacao === 'CONCLUIDA'
  const totalForm =
    (Math.round((dinheiro(form.taxaVistoria) + Number.EPSILON) * 100) +
      Math.round((dinheiro(form.maoDeObra) + Number.EPSILON) * 100) +
      Math.round((dinheiro(form.deslocamento) + Number.EPSILON) * 100) +
      Math.round((dinheiro(form.material) + Number.EPSILON) * 100)) /
    100
  const entradaFicha = editando?.entradaValor == null ? 0 : editando.entradaValor
  const saldoFicha = saldoParcelado(totalForm, entradaFicha)
  const entradaEncerrar = dinheiro(encerrarForm.entrada)
  const saldoEncerrar = encerrarAlvo ? saldoParcelado(encerrarAlvo.total || 0, entradaEncerrar) : 0

  function ordenar(coluna: Coluna) {
    setOrdenacao((atual) =>
      atual.coluna === coluna ? { coluna, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' } : { coluna, direcao: 'asc' },
    )
  }

  const ordemAbertaRef = useRef<number | null>(null)
  const prefillRef = useRef<string | null>(null)

  useEffect(() => {
    if (!ordemInicialId || carregando || ordemAbertaRef.current === ordemInicialId) return
    const ordem = ordens.find((item) => item.id === ordemInicialId)
    if (!ordem) return
    ordemAbertaRef.current = ordemInicialId
    abrirEdicao(ordem)
    onOrdemConsumida?.()
  }, [ordemInicialId, carregando, ordens])

  useEffect(() => {
    if (!situacaoInicial) return
    setFiltros((atual) => ({ ...atual, situacao: situacaoInicial }))
    setPagina(0)
    onSituacaoConsumida?.()
  }, [situacaoInicial])

  useEffect(() => {
    if (!prefill) {
      prefillRef.current = null
      return
    }
    if (carregando) return
    const chave = `${prefill.clienteId}:${prefill.enderecoId ?? ''}`
    if (prefillRef.current === chave) return
    const cliente = clientes.find((item) => item.id === prefill.clienteId)
    if (!cliente) return
    prefillRef.current = chave
    const enderecos = normalizarEnderecos(cliente.enderecos)
    const endereco = enderecos.find((item) => item.id === prefill.enderecoId) || enderecos.find((item) => item.principal) || enderecos[0]
    setEditando(null)
    setForm({
      ...FORM_VAZIO(),
      clienteId: cliente.id,
      clienteOriginal: cliente.nome,
      cliente: cliente.nome,
      whatsapp: cliente.telefone,
      endereco: endereco?.logradouro || cliente.endereco,
      cidade: endereco?.cidade || cliente.cidade || 'Porto União',
      tipoPessoa: cliente.tipoPessoa || 'FISICA',
      enderecos,
      enderecoId: endereco?.id ? String(endereco.id) : '',
      tipo: 'PREVENTIVA',
      origem: 'TELEFONE',
    })
    setModalAberto(true)
    onPrefillConsumido?.()
  }, [prefill, carregando, clientes])

  function abrirNova() {
    setEditando(null)
    setForm(FORM_VAZIO())
    setModalAberto(true)
  }

  function abrirEdicao(ordem: OrdemApi) {
    setEditando(ordem)
    setForm({
      clienteId: ordem.clienteId,
      clienteOriginal: ordem.cliente,
      cliente: ordem.cliente,
      whatsapp: ordem.telefone,
      endereco: ordem.endereco,
      cidade: ordem.cidade || 'Porto União',
      data: ordem.dataAbertura,
      situacao: ordem.situacao === 'ENCERRADA' || ordem.situacao === 'CONCLUIDA' || ordem.situacao === 'CANCELADA' ? 'ABERTA' : ordem.situacao,
      tipo: ordem.tipo || 'EMERGENCIA',
      origem: ordem.origem || 'WHATSAPP',
      descricaoProblema: ordem.descricaoProblema || '',
      funcionarioId: ordem.funcionarioId ? String(ordem.funcionarioId) : '',
      enderecoId: ordem.enderecoId ? String(ordem.enderecoId) : '',
      tipoPessoa: clientes.find((cliente) => cliente.id === ordem.clienteId)?.tipoPessoa || 'FISICA',
      enderecos: normalizarEnderecos(clientes.find((cliente) => cliente.id === ordem.clienteId)?.enderecos),
      materiaisLoja: (ordem.materiaisLoja || []).map((item) => ({
        descricao: item.descricao,
        quantidadeRetirada: quantidadeCampo(item.quantidadeRetirada),
        quantidadeUsada: quantidadeCampo(item.quantidadeUsada),
        quantidadeDevolvida: quantidadeCampo(item.quantidadeDevolvida),
      })),
      vistoria: ordem.vistoria,
      servicos: ordem.servicos,
      taxaVistoria: ordem.taxaVistoria ? formatarMoeda(ordem.taxaVistoria) : '',
      maoDeObra: ordem.maoDeObra ? formatarMoeda(ordem.maoDeObra) : '',
      deslocamento: ordem.deslocamento ? formatarMoeda(ordem.deslocamento) : '',
      material: ordem.material ? formatarMoeda(ordem.material) : '',
      assinatura: ordem.assinatura,
      pecas: ordem.pecas.map(pecaDoForm),
    })
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setEditando(null)
  }

  function alterarCliente(nome: string) {
    const existente = clientes.find((cliente) => cliente.nome === nome)
    setForm((atual) => ({
      ...atual,
      cliente: nome,
      clienteId: existente?.id ?? (atual.cliente === nome ? atual.clienteId : null),
      ...(existente
        ? {
            whatsapp: existente.telefone,
            endereco: existente.endereco,
            cidade: existente.cidade || 'Porto União',
            tipoPessoa: existente.tipoPessoa || 'FISICA',
            enderecos: normalizarEnderecos(existente.enderecos),
            enderecoId: existente.enderecos?.find((item) => item.principal)?.id
              ? String(existente.enderecos.find((item) => item.principal)?.id)
              : '',
          }
        : {}),
    }))
  }

  async function persistir(): Promise<OrdemApi | null> {
    const nome = form.cliente.trim()
    if (nome.length < 2) {
      toast.error('Informe o nome do cliente.')
      return null
    }
    if (!form.data) {
      toast.error('Informe a data de abertura.')
      return null
    }
    const pecas: { produtoId: number; quantidade: number }[] = []
    for (const linha of form.pecas) {
      if (!linha.produtoId && !linha.quantidade.trim()) continue
      if (!linha.produtoId) {
        toast.error('Selecione a peça.')
        return null
      }
      const quantidade = Math.round((parseQuantidade(linha.quantidade) + Number.EPSILON) * 1000) / 1000
      if (!Number.isFinite(quantidade) || quantidade <= 0) {
        toast.error('Informe a quantidade da peça.')
        return null
      }
      pecas.push({ produtoId: Number(linha.produtoId), quantidade })
    }
    const materiaisLoja: Array<{ descricao: string; quantidadeRetirada: number; quantidadeUsada: number; quantidadeDevolvida: number }> = []
    for (const linha of form.materiaisLoja) {
      if (!linha.descricao.trim() && !linha.quantidadeRetirada.trim()) continue
      const retirada = parseQuantidade(linha.quantidadeRetirada)
      const usada = parseQuantidade(linha.quantidadeUsada || '0')
      const devolvida = parseQuantidade(linha.quantidadeDevolvida || '0')
      if (linha.descricao.trim().length < 2 || !Number.isFinite(retirada) || retirada <= 0) {
        toast.error('Informe o material da loja e a quantidade retirada.')
        return null
      }
      materiaisLoja.push({
        descricao: linha.descricao.trim(),
        quantidadeRetirada: retirada,
        quantidadeUsada: Number.isFinite(usada) ? usada : 0,
        quantidadeDevolvida: Number.isFinite(devolvida) ? devolvida : 0,
      })
    }

    setSalvando(true)
    try {
      const enderecos = form.enderecos
        .map((item, indice) => ({
          ...(item.id ? { id: item.id } : {}),
          apelido: item.apelido,
          logradouro: item.logradouro.trim() || (indice === 0 ? form.endereco.trim() : ''),
          numero: (item.numero || '').trim(),
          bairro: (item.bairro || '').trim(),
          cep: mascararCep(item.cep || extrairCep(item.logradouro, item.cep)),
          cidade: item.cidade.trim() || form.cidade.trim(),
          uf: (item.uf || '').trim().toUpperCase().slice(0, 2),
          principal: item.principal || String(item.id || '') === form.enderecoId,
        }))
        .filter((item) => item.logradouro)
      if (enderecos.length > 0 && !enderecos.some((item) => item.principal)) enderecos[0].principal = true
      const payloadCliente = {
        nome,
        telefone: form.whatsapp.trim(),
        endereco: form.endereco.trim(),
        cidade: form.cidade.trim(),
        tipoPessoa: form.tipoPessoa,
        ...(enderecos.length > 0 ? { enderecos } : {}),
      }
      const mesmo =
        form.clienteId != null && nome.toLowerCase() === form.clienteOriginal.trim().toLowerCase()
      let clienteId = form.clienteId
      let clienteGravado: ClienteApi | null = null
      if (mesmo && clienteId != null) {
        const atualizado = await api.updateCliente(clienteId, payloadCliente)
        if (atualizado.error || !atualizado.data) {
          toast.error(atualizado.error || 'Não foi possível gravar o cliente.')
          return null
        }
        clienteGravado = atualizado.data as ClienteApi
      } else {
        const existente = clientes.find((cliente) => cliente.nome.trim().toLowerCase() === nome.toLowerCase())
        if (existente) {
          clienteId = existente.id
          const atualizado = await api.updateCliente(clienteId, payloadCliente)
          if (atualizado.error || !atualizado.data) {
            toast.error(atualizado.error || 'Não foi possível gravar o cliente.')
            return null
          }
          clienteGravado = atualizado.data as ClienteApi
        } else {
          const criado = await api.createCliente(payloadCliente)
          if (criado.error || !criado.data?.id) {
            toast.error(criado.error || 'Não foi possível gravar o cliente.')
            return null
          }
          clienteId = criado.data.id as number
          clienteGravado = criado.data as ClienteApi
        }
      }
      if (!clienteId) {
        toast.error('Não foi possível gravar o cliente.')
        return null
      }
      const enderecosSalvos = clienteGravado?.enderecos || []
      const enderecoEscolhido = form.enderecoId
        ? Number(form.enderecoId)
        : enderecosSalvos.find((item) => item.principal)?.id || enderecosSalvos[0]?.id || null

      const corpo = {
        clienteId,
        situacao: form.situacao,
        tipo: form.tipo,
        origem: form.origem,
        descricaoProblema: form.descricaoProblema,
        funcionarioId: form.funcionarioId ? Number(form.funcionarioId) : null,
        enderecoId: enderecoEscolhido,
        vistoria: form.vistoria,
        servicos: form.servicos,
        ...(isAdmin
          ? {
              taxaVistoria: dinheiro(form.taxaVistoria),
              maoDeObra: dinheiro(form.maoDeObra),
              deslocamento: dinheiro(form.deslocamento),
              material: dinheiro(form.material),
            }
          : {}),
        dataAbertura: form.data,
        assinatura: form.assinatura,
        pecas,
        materiaisLoja,
      }
      const atual = editando
      const resposta = atual ? await api.updateOrdem(atual.id, corpo) : await api.createOrdem(corpo)
      if (resposta.error || !resposta.data) {
        toast.error(resposta.error || 'Não foi possível salvar a ordem.')
        return null
      }
      const salva = resposta.data as OrdemApi
      setEditando(salva)
      setForm((atual) => ({
        ...atual,
        clienteId: salva.clienteId,
        clienteOriginal: salva.cliente,
        assinatura: salva.assinatura,
        pecas: salva.pecas.map(pecaDoForm),
      }))
      if (!atual) setPagina(0)
      toast.success(atual ? 'Ordem atualizada.' : 'Ordem lançada.')
      await carregar(true)
      return salva
    } finally {
      setSalvando(false)
    }
  }

  async function salvar() {
    const salva = await persistir()
    if (salva) fecharModal()
  }

  async function encerrarPelaFicha() {
    const salva = await persistir()
    if (salva) abrirEncerrar(salva)
  }

  function emExecucao(situacao: Situacao) {
    return situacao === 'EM_ANDAMENTO' || situacao === 'EM_EXECUCAO'
  }

  function acionarLinha(ordem: OrdemApi) {
    if (emExecucao(ordem.situacao)) {
      void api.concluirOrdem(ordem.id).then((resposta) => {
        if (resposta.error) toast.error(resposta.error)
        else {
          toast.success('Execução concluída. A ordem aguarda a conferência.')
          void carregar(true)
        }
      })
      return
    }
    if (ordem.situacao === 'CONCLUIDA' && isAdmin) abrirEncerrar(ordem)
  }

  async function concluirPelaFicha() {
    const salva = await persistir()
    if (!salva) return
    if (!emExecucao(salva.situacao)) {
      toast.error('Marque a ordem como em andamento antes de concluir.')
      return
    }
    const resposta = await api.concluirOrdem(salva.id)
    if (resposta.error) {
      toast.error(resposta.error)
      return
    }
    toast.success('Execução concluída. A ordem aguarda a conferência.')
    fecharModal()
    await carregar(true)
  }

  async function excluirSelecionadas() {
    if (selecionadas.length === 0) return
    const resposta = await api.deleteOrdens(selecionadas)
    if (resposta.error) {
      toast.error(resposta.error)
      return
    }
    setSelecionadas([])
    toast.success(selecionadas.length === 1 ? 'Ordem excluída.' : 'Ordens excluídas.')
    await carregar(true)
  }

  function abrirEncerrar(ordem: OrdemApi) {
    if (ordem.situacao === 'ENCERRADA') return
    if (!ordem.vistoria.trim() || !ordem.servicos.trim()) {
      toast.error('Preencha a vistoria e os serviços antes de encerrar.')
      return
    }
    setEncerrarForm({
      formaPagamento: 'PIX',
      parcelas: '1',
      dataVencimento: hojeISO(),
      entrada: '',
      entradaRecebida: false,
      garantiaDias: '90',
      preventivaMeses: '6',
      usarQuintoDiaUtil: true,
    })
    setEncerrarAlvo(ordem)
  }

  async function confirmarEncerrar() {
    if (!encerrarAlvo) return
    const parcelas = Number(encerrarForm.parcelas)
    if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 60) {
      toast.error('O parcelamento aceita de 1 a 60 parcelas.')
      return
    }
    if (!encerrarForm.dataVencimento) {
      toast.error('Informe o primeiro vencimento.')
      return
    }
    setEncerrando(true)
    try {
      const entrada = dinheiro(encerrarForm.entrada)
      const garantiaDias = Number(encerrarForm.garantiaDias)
      const preventivaMeses = Number(encerrarForm.preventivaMeses)
      const resposta = await api.encerrarOrdem(encerrarAlvo.id, {
        formaPagamento: encerrarForm.formaPagamento,
        parcelas,
        dataVencimento: encerrarForm.dataVencimento,
        entradaValor: entrada > 0 ? entrada : undefined,
        entradaRecebida: encerrarForm.entradaRecebida,
        garantiaDias: Number.isInteger(garantiaDias) ? garantiaDias : 90,
        preventivaMeses: Number.isInteger(preventivaMeses) ? preventivaMeses : 6,
        usarQuintoDiaUtil: encerrarForm.usarQuintoDiaUtil,
      })
      if (resposta.error || !resposta.data) {
        toast.error(resposta.error || 'Não foi possível encerrar a ordem.')
        return
      }
      const titulos = Number((resposta.data as OrdemApi).titulos || 0)
      toast.success(
        titulos > 0
          ? 'Ordem encerrada. O contas a receber foi gerado.'
          : 'Ordem encerrada. Não houve valor para lançar no contas a receber.',
      )
      setEncerrarAlvo(null)
      fecharModal()
      await carregar(true)
    } finally {
      setEncerrando(false)
    }
  }

  async function guardarAssinatura(dataUrl: string) {
    if (assinandoId === 'form') {
      setForm((atual) => ({ ...atual, assinatura: dataUrl }))
      setAssinandoId(null)
      if (editando?.situacao === 'ENCERRADA') {
        const resposta = await api.updateOrdem(editando.id, { assinatura: dataUrl })
        if (resposta.error || !resposta.data) {
          toast.error(resposta.error || 'Não foi possível salvar a assinatura.')
          return
        }
        setOrdens((lista) => lista.map((ordem) => (ordem.id === editando.id ? (resposta.data as OrdemApi) : ordem)))
        toast.success('Assinatura do cliente salva.')
      }
      return
    }
    if (typeof assinandoId !== 'number') return
    const resposta = await api.updateOrdem(assinandoId, { assinatura: dataUrl })
    if (resposta.error || !resposta.data) {
      toast.error(resposta.error || 'Não foi possível salvar a assinatura.')
      return
    }
    const salva = resposta.data as OrdemApi
    setOrdens((lista) => lista.map((ordem) => (ordem.id === assinandoId ? salva : ordem)))
    if (editando?.id === assinandoId) setForm((atual) => ({ ...atual, assinatura: dataUrl }))
    setAssinandoId(null)
    toast.success('Assinatura do cliente salva.')
  }

  async function blobDaOrdem(ordem: OrdemApi) {
    const assets = assetsRecibo()
    const recibo = reciboDe(ordem)
    return pdf(
      <ReciboServicoPdf ordem={recibo} logo={assets.logo} marca={assets.marca} assinaturaEmpresa={assets.assinaturaEmpresa} />,
    ).toBlob()
  }

  async function baixarPdf(ordem: OrdemApi) {
    setGerandoId(ordem.id)
    try {
      const blob = await blobDaOrdem(ordem)
      const nome = `recibo-${String(ordem.numero).padStart(4, '0')}.pdf`
      const resultado = await baixarArquivo(blob, nome)
      if (resultado === 'aborted') return
      if (resultado === 'shared') toast.success('PDF pronto para salvar ou compartilhar.')
      else toast.success('PDF gerado. Se não baixou sozinho, use Salvar/Compartilhar na tela aberta.')
    } catch {
      toast.error('Não foi possível gerar o PDF.')
    } finally {
      setGerandoId(null)
    }
  }

  async function enviarWhatsApp(ordem: OrdemApi) {
    if (!ordem.assinatura) {
      toast.error('Peça a assinatura do cliente antes de enviar.')
      setAssinandoId(ordem.id)
      return
    }
    setGerandoId(ordem.id)
    try {
      const blob = await blobDaOrdem(ordem)
      const nome = `recibo-${String(ordem.numero).padStart(4, '0')}.pdf`
      const texto = `Olá, ${ordem.cliente}. Segue o recibo de prestação de serviço da RR Encanamentos, no valor de ${formatarMoeda(ordem.total)}.`
      const compartilhado = await compartilharArquivoComTexto(blob, nome, texto)
      if (compartilhado === 'aborted') return
      if (compartilhado === 'shared') {
        toast.success('Escolha o WhatsApp na lista para enviar o recibo.')
        return
      }

      await baixarArquivo(blob, nome)
      const destino = whatsappDestino(ordem.telefone)
      const mensagem = `${texto}\n\nO PDF foi baixado neste aparelho. Anexe o arquivo nesta conversa.`
      const whats = destino
        ? `https://wa.me/${destino}?text=${encodeURIComponent(mensagem)}`
        : `https://wa.me/?text=${encodeURIComponent(mensagem)}`
      abrirUrlExterna(whats)
      toast.success('Abrindo WhatsApp. Anexe o PDF na conversa.')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      toast.error('Não foi possível preparar o envio.')
    } finally {
      setGerandoId(null)
    }
  }

  async function cancelarOrdemAtual() {
    if (!editando) return
    if (motivoCancelamento.trim().length < 3) {
      toast.error('Informe o motivo do cancelamento.')
      return
    }
    setCancelando(true)
    try {
      const resposta = await api.cancelarOrdem(editando.id, motivoCancelamento.trim())
      if (resposta.error) {
        toast.error(resposta.error)
        return
      }
      toast.success('Ordem cancelada.')
      setMotivoCancelamento('')
      fecharModal()
      await carregar(true)
    } finally {
      setCancelando(false)
    }
  }

  async function anexarFoto(momento: 'ANTES' | 'DEPOIS', arquivo: File) {
    if (!editando) {
      toast.error('Salve a ordem antes de anexar a foto.')
      return
    }
    const url = await fotoReduzida(arquivo)
    const resposta = await api.adicionarFotoOrdem(editando.id, { momento, url })
    if (resposta.error || !resposta.data) {
      toast.error(resposta.error || 'Não foi possível anexar a foto.')
      return
    }
    setEditando(resposta.data as OrdemApi)
    toast.success(momento === 'ANTES' ? 'Foto de antes anexada.' : 'Foto de depois anexada.')
  }

  const ordemSelecionada =
    selecionadas.length === 1 ? ordens.find((ordem) => ordem.id === selecionadas[0]) || null : null
  const toastRelatorio = (message: string, type?: 'success' | 'error') =>
    type === 'error' ? toast.error(message) : toast.success(message)

  function Cabecalho(coluna: Coluna, label: string, extra = '') {
    const ativa = ordenacao.coluna === coluna
    return (
      <th
        className={`cursor-pointer border-b px-2 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-accent/50 sm:px-4 ${ativa ? 'bg-primary/10' : ''} ${extra}`}
        onClick={() => ordenar(coluna)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <span className="flex flex-col">
            <HiChevronUp className="h-2 w-2" />
            <HiChevronDown className="-mt-1 h-2 w-2" />
          </span>
        </span>
      </th>
    )
  }

  return (
    <div
      data-ds="ant-mobile-ordem"
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f5f5f9]"
    >
      <div className="shrink-0 space-y-3 border-b border-[#eee] bg-white px-[15px] py-4">
        <CabecalhoModulo
          icone={IconeOrdem}
          titulo="Ordem de Serviço"
          acoes={
            <>
              <button
                type="button"
                onClick={abrirNova}
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
                    disabled={!ordemSelecionada}
                    onClick={() => ordemSelecionada && abrirEdicao(ordemSelecionada)}
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
                  {isAdmin ? (
                    <ExportarRelatorio
                      tipo="ordens"
                      de={filtros.de}
                      ate={filtros.ate}
                      situacao={filtros.situacao}
                      showToast={toastRelatorio}
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void excluirSelecionadas()}
                    disabled={selecionadas.length === 0}
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
        <FiltrosColapsaveis conteudoClassName="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <input
            value={busca}
            onChange={(event) => {
              setBusca(event.target.value)
              setPagina(0)
            }}
            placeholder="Buscar..."
            className="h-11 w-full rounded-md border border-[#eee] bg-white px-3 text-sm text-[#333] sm:col-span-2 lg:col-span-2"
          />
          <select className="h-11 w-full rounded-md border border-[#eee] bg-white px-3 text-sm text-[#333]" value={filtros.situacao} onChange={(event) => setFiltros({ ...filtros, situacao: event.target.value })}>
            <option value="">Situação</option>
            <option value="ABERTA">Aberta</option>
            <option value="AGENDADA">Agendada</option>
            <option value="EM_ANDAMENTO">Em andamento</option>
            <option value="CONCLUIDA">Concluída</option>
            <option value="ENCERRADA">Encerrada</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
          <select className="h-11 w-full rounded-md border border-[#eee] bg-white px-3 text-sm text-[#333]" value={filtros.tipo} onChange={(event) => setFiltros({ ...filtros, tipo: event.target.value })}>
            <option value="">Tipo</option>
            <option value="EMERGENCIA">Emergência</option>
            <option value="PREVENTIVA">Preventiva</option>
            <option value="OBRA">Obra</option>
          </select>
          <select className="h-11 w-full rounded-md border border-[#eee] bg-white px-3 text-sm text-[#333]" value={filtros.funcionarioId} onChange={(event) => setFiltros({ ...filtros, funcionarioId: event.target.value })}>
            <option value="">Funcionário</option>
            {funcionarios.map((pessoa) => <option key={pessoa.id} value={pessoa.id}>{pessoa.nome}</option>)}
          </select>
          <input type="date" className="h-11 w-full rounded-md border border-[#eee] bg-white px-3 text-sm text-[#333]" value={filtros.de} onChange={(event) => setFiltros({ ...filtros, de: event.target.value })} />
          <input type="date" className="h-11 w-full rounded-md border border-[#eee] bg-white px-3 text-sm text-[#333]" value={filtros.ate} onChange={(event) => setFiltros({ ...filtros, ate: event.target.value })} />
        </FiltrosColapsaveis>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <div className="space-y-3 px-[15px] py-4 md:hidden">
          {carregando ? (
            <p className="text-sm text-[#888]">Carregando ordens...</p>
          ) : visiveis.length === 0 ? (
            <p className="text-sm text-[#888]">Nenhuma ordem encontrada</p>
          ) : (
            visiveis.map((ordem) => {
              const podeAcao = emExecucao(ordem.situacao) || (ordem.situacao === 'CONCLUIDA' && isAdmin)
              const rotuloAcao = emExecucao(ordem.situacao) ? 'Concluir' : 'Encerrar'
              return (
                <article key={ordem.id} className="space-y-3 rounded-md border border-[#ddd] bg-white p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selecionadas.includes(ordem.id)}
                      onChange={() =>
                        setSelecionadas((lista) =>
                          lista.includes(ordem.id) ? lista.filter((id) => id !== ordem.id) : [...lista, ordem.id],
                        )
                      }
                      className="mt-1 h-5 w-5 shrink-0 cursor-pointer rounded"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-[15px] font-medium leading-snug text-[#333]">
                        OS {String(ordem.numero).padStart(4, '0')}
                      </p>
                      <p className="break-words text-sm text-[#333]">{ordem.cliente}</p>
                      <p className="text-xs text-[#888]">{formatarDataCurta(ordem.dataAbertura)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => abrirEdicao(ordem)}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#eee] bg-white"
                      aria-label="Editar ordem"
                    >
                      <HiPencil className="h-4 w-4 text-primary" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t border-[#eee] pt-3">
                    <span className="inline-flex rounded px-2 py-1 text-xs font-medium bg-[#eef2f6] text-[#334155]">
                      {SITUACAO[ordem.situacao]}
                    </span>
                    {isAdmin ? (
                      <span className="text-sm font-semibold tabular-nums text-[#333]">
                        {formatarMoeda(ordem.total || 0)}
                      </span>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {podeAcao ? (
                      <button
                        type="button"
                        onClick={() => acionarLinha(ordem)}
                        disabled={encerrando}
                        className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                      >
                        {rotuloAcao}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAssinandoId(ordem.id)}
                        className={`inline-flex min-h-11 items-center justify-center rounded-md px-3 text-sm font-medium ${ordem.assinatura ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
                      >
                        {ordem.assinatura ? 'Assinada' : 'Assinar'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void baixarPdf(ordem)}
                      disabled={gerandoId === ordem.id}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-[#eee] bg-white px-3 text-sm font-medium text-[#333]"
                    >
                      <HiDownload className="h-4 w-4 text-primary" />
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => void enviarWhatsApp(ordem)}
                      disabled={gerandoId === ordem.id}
                      className="col-span-2 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-[#eee] bg-white px-3 text-sm font-medium text-[#333]"
                    >
                      <FaWhatsapp className="h-4 w-4 text-[#25D366]" />
                      WhatsApp
                    </button>
                  </div>
                </article>
              )
            })
          )}
        </div>

        <div className="hidden md:block">
          <table className="w-full border-collapse bg-white">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr>
                <th className="w-12 border-b px-2 py-2" />
                <th className="w-16 border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">Editar</th>
                {Cabecalho('numero', 'Nº')}
                {Cabecalho('cliente', 'Cliente')}
                {Cabecalho('data', 'Data')}
                {Cabecalho('situacao', 'Situação')}
                {isAdmin ? Cabecalho('total', 'Total') : null}
                <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">Assinatura</th>
                <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">PDF</th>
                <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">WhatsApp</th>
                <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">Encerrar</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">
                    {carregando ? 'Carregando ordens...' : 'Nenhuma ordem encontrada'}
                  </td>
                </tr>
              ) : (
                visiveis.map((ordem) => (
                  <tr key={ordem.id} className="border-b hover:bg-accent/50">
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selecionadas.includes(ordem.id)}
                        onChange={() =>
                          setSelecionadas((lista) =>
                            lista.includes(ordem.id) ? lista.filter((id) => id !== ordem.id) : [...lista, ordem.id],
                          )
                        }
                        className="cursor-pointer rounded"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <button type="button" onClick={() => abrirEdicao(ordem)} title="Editar ordem" aria-label="Editar ordem">
                        <HiPencil className="h-4 w-4 text-primary" />
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-sm">{String(ordem.numero).padStart(4, '0')}</td>
                    <td className="px-4 py-2 text-sm">{ordem.cliente}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-sm">{formatarDataCurta(ordem.dataAbertura)}</td>
                    <td className="px-4 py-2 text-sm">
                      <div>{SITUACAO[ordem.situacao]}</div>
                      {ordem.garantiaAte ? (
                        <div className="text-xs text-muted-foreground">Garantia {formatarDataCurta(ordem.garantiaAte)}</div>
                      ) : null}
                    </td>
                    {isAdmin ? (
                      <td className="px-4 py-2 text-sm">
                        <div className="whitespace-nowrap">{formatarMoeda(ordem.total || 0)}</div>
                        <div className="whitespace-nowrap text-xs text-muted-foreground">Entrada {formatarMoeda(entradaDa(ordem))}</div>
                        <div className="whitespace-nowrap text-xs text-muted-foreground">Saldo parcelado {formatarMoeda(saldoParcelado(ordem.total || 0, entradaDa(ordem)))}</div>
                      </td>
                    ) : null}
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => setAssinandoId(ordem.id)}
                        className={`rounded px-2 py-1 text-xs font-medium ${ordem.assinatura ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
                      >
                        {ordem.assinatura ? 'Assinada' : 'Assinar'}
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      <button type="button" onClick={() => void baixarPdf(ordem)} disabled={gerandoId === ordem.id} title="Baixar PDF" aria-label="Baixar PDF">
                        <HiDownload className="h-4 w-4 text-primary" />
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      <button type="button" onClick={() => void enviarWhatsApp(ordem)} disabled={gerandoId === ordem.id} title="Enviar no WhatsApp" aria-label="Enviar no WhatsApp">
                        <FaWhatsapp className="h-4 w-4 text-[#25D366]" />
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => acionarLinha(ordem)}
                        disabled={ordem.situacao === 'ENCERRADA' || ordem.situacao === 'CANCELADA' || encerrando}
                        className={`rounded px-2 py-1 text-xs font-medium ${ordem.situacao === 'ENCERRADA' ? 'bg-emerald-100 text-emerald-800' : 'bg-primary text-primary-foreground hover:bg-primary/90'} disabled:cursor-not-allowed`}
                      >
                        {ordem.situacao === 'ENCERRADA' ? 'Encerrada' : ordem.situacao === 'CONCLUIDA' ? 'Encerrar' : ordem.situacao === 'EM_ANDAMENTO' || ordem.situacao === 'EM_EXECUCAO' ? 'Concluir' : SITUACAO[ordem.situacao]}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-[#eee] bg-white px-4 py-2">
        <div className="text-sm text-[#888]">
          {filtradas.length > 0
            ? `Página ${paginaAtual + 1} de ${totalPaginas} • Total: ${filtradas.length} ordem${filtradas.length === 1 ? '' : 's'}`
            : 'Nenhuma ordem encontrada'}
        </div>
        {filtradas.length > PAGE_SIZE && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPagina((atual) => Math.max(0, atual - 1))} disabled={paginaAtual === 0} className="h-11 rounded-md border border-[#eee] bg-white px-3 text-sm text-[#333] disabled:opacity-50">
              Anterior
            </button>
            <button type="button" onClick={() => setPagina((atual) => Math.min(totalPaginas - 1, atual + 1))} disabled={paginaAtual >= totalPaginas - 1} className="h-11 rounded-md border border-[#eee] bg-white px-3 text-sm text-[#333] disabled:opacity-50">
              Próxima
            </button>
          </div>
        )}
      </div>

      <Sheet open={acoesAberto} onOpenChange={setAcoesAberto}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-4 pb-8 pt-4 sm:mx-auto sm:max-w-lg">
          <SheetHeader className="mb-4 pr-8 text-left">
            <SheetTitle>Ações da ordem</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setAcoesAberto(false)
                abrirNova()
              }}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1d4ed8] px-3 py-3 text-sm font-medium text-white"
            >
              <HiPlus className="h-4 w-4" />
              Nova ordem
            </button>
            <button
              type="button"
              disabled={!ordemSelecionada}
              onClick={() => {
                if (!ordemSelecionada) return
                setAcoesAberto(false)
                abrirEdicao(ordemSelecionada)
              }}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#dbeafe] px-3 py-3 text-sm font-medium text-[#1e3a8a] disabled:cursor-not-allowed disabled:opacity-50"
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
            <button
              type="button"
              disabled={selecionadas.length === 0}
              onClick={() => {
                setAcoesAberto(false)
                void excluirSelecionadas()
              }}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#fde8e8] px-3 py-3 text-sm font-medium text-[#b42318] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <HiTrash className="h-4 w-4" />
              Excluir
            </button>
            {isAdmin ? (
              <ExportarRelatorio
                tipo="ordens"
                de={filtros.de}
                ate={filtros.ate}
                situacao={filtros.situacao}
                showToast={toastRelatorio}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-3 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-background p-4 shadow-xl sm:p-6">
            <CabecalhoModal
              icone={IconeOrdem}
              titulo={editando ? `Ordem ${String(editando.numero).padStart(4, '0')}` : 'Nova ordem'}
              descricao="Cliente, endereço e o serviço."
              onFechar={fecharModal}
            />
            <div className="space-y-4">
              <Campo label="Cliente" obrigatorio>
                <input
                  value={form.cliente}
                  onChange={(event) => alterarCliente(event.target.value)}
                  list="clientes-ordem"
                  disabled={encerrada}
                  className={campoClasse}
                />
                <datalist id="clientes-ordem">
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.nome} />
                  ))}
                </datalist>
              </Campo>
              <Campo label="Tipo de pessoa">
                <select value={form.tipoPessoa} onChange={(event) => setForm({ ...form, tipoPessoa: event.target.value as Formulario['tipoPessoa'] })} disabled={encerrada} className={campoClasse}>
                  <option value="FISICA">Pessoa física</option>
                  <option value="JURIDICA">Prédio ou empresa</option>
                </select>
              </Campo>
              <Campo label="WhatsApp do cliente">
                <input value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} placeholder="(42) 99999-0000" disabled={encerrada} className={campoClasse} />
              </Campo>
              <Campo label="Endereço do serviço">
                {form.enderecos.length > 0 ? (
                  <select
                    value={form.enderecoId}
                    disabled={encerrada}
                    onChange={(event) => {
                      const escolhido = form.enderecos.find((item) => String(item.id || '') === event.target.value)
                      setForm({
                        ...form,
                        enderecoId: event.target.value,
                        endereco: escolhido?.logradouro || form.endereco,
                        cidade: escolhido?.cidade || form.cidade,
                      })
                    }}
                    className={campoClasse}
                  >
                    <option value="">Selecione</option>
                    {form.enderecos.map((item) => (
                      <option key={item.id || item.logradouro} value={item.id || ''}>
                        {rotuloEndereco(item)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input value={form.endereco} onChange={(event) => setForm({ ...form, endereco: event.target.value })} placeholder="Rua, número" disabled={encerrada} className={campoClasse} />
                )}
              </Campo>
              {garantias.length > 0 && (
                <div id="aviso-garantia" role="status" className="rounded-md border-2 border-amber-400 bg-amber-50 px-3 py-3 text-sm text-amber-950">
                  <p className="font-semibold">Garantia em vigor neste endereço</p>
                  <ul className="mt-2 space-y-1">
                    {garantias.map((item) => (
                      <li key={item.id}>
                        OS {String(item.numero).padStart(4, '0')} — {item.servicos || 'Serviço não descrito'} — garantia até {formatarDataCurta(item.garantiaAte || '')}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs">Aviso apenas. A ordem pode ser salva normalmente.</p>
                </div>
              )}
              {!encerrada && (
                <div className="space-y-3">
                  {form.enderecos.map((item, indice) => (
                    <div
                      key={`${item.id || 'novo'}-${indice}`}
                      className="space-y-3 rounded-md border border-[#eee] bg-[#fafafa] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-[#333]">
                          Endereço {indice + 1}
                          {item.principal ? ' (principal)' : ''}
                        </p>
                        <button
                          type="button"
                          className="inline-flex h-11 shrink-0 items-center justify-center rounded-md border border-[#eee] bg-white px-3 text-sm text-[#b42318]"
                          onClick={() =>
                            setForm((atual) => ({
                              ...atual,
                              enderecos: atual.enderecos.filter((_, posicao) => posicao !== indice),
                            }))
                          }
                        >
                          Remover
                        </button>
                      </div>
                      <Campo label="CEP" obrigatorio>
                        <input
                          value={item.cep || ''}
                          inputMode="numeric"
                          placeholder="00000-000"
                          className={campoClasse}
                          onChange={(event) =>
                            setForm((atual) => ({
                              ...atual,
                              enderecos: atualizarEndereco(atual.enderecos, indice, {
                                cep: mascararCep(event.target.value),
                              }),
                            }))
                          }
                        />
                      </Campo>
                      <Campo label="Apelido">
                        <input
                          value={item.apelido}
                          placeholder="Ex.: Casa, Trabalho"
                          className={campoClasse}
                          onChange={(event) =>
                            setForm((atual) => ({
                              ...atual,
                              enderecos: atualizarEndereco(atual.enderecos, indice, {
                                apelido: event.target.value,
                              }),
                            }))
                          }
                        />
                      </Campo>
                      <Campo label="Logradouro" obrigatorio>
                        <input
                          value={item.logradouro}
                          placeholder="Rua, avenida..."
                          className={campoClasse}
                          onChange={(event) =>
                            setForm((atual) => ({
                              ...atual,
                              enderecos: atualizarEndereco(atual.enderecos, indice, {
                                logradouro: event.target.value,
                              }),
                            }))
                          }
                        />
                      </Campo>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Campo label="Número">
                          <input
                            value={item.numero || ''}
                            placeholder="Nº"
                            className={campoClasse}
                            onChange={(event) =>
                              setForm((atual) => ({
                                ...atual,
                                enderecos: atualizarEndereco(atual.enderecos, indice, {
                                  numero: event.target.value,
                                }),
                              }))
                            }
                          />
                        </Campo>
                        <Campo label="Bairro">
                          <input
                            value={item.bairro || ''}
                            placeholder="Bairro"
                            className={campoClasse}
                            onChange={(event) =>
                              setForm((atual) => ({
                                ...atual,
                                enderecos: atualizarEndereco(atual.enderecos, indice, {
                                  bairro: event.target.value,
                                }),
                              }))
                            }
                          />
                        </Campo>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_5rem]">
                        <Campo label="Cidade" obrigatorio>
                          <input
                            value={item.cidade}
                            placeholder="Cidade"
                            className={campoClasse}
                            onChange={(event) =>
                              setForm((atual) => ({
                                ...atual,
                                enderecos: atualizarEndereco(atual.enderecos, indice, {
                                  cidade: event.target.value,
                                }),
                              }))
                            }
                          />
                        </Campo>
                        <Campo label="UF">
                          <input
                            value={item.uf || ''}
                            placeholder="UF"
                            maxLength={2}
                            className={campoClasse}
                            onChange={(event) =>
                              setForm((atual) => ({
                                ...atual,
                                enderecos: atualizarEndereco(atual.enderecos, indice, {
                                  uf: event.target.value.toUpperCase().slice(0, 2),
                                }),
                              }))
                            }
                          />
                        </Campo>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="inline-flex h-11 w-full items-center justify-center rounded-md border border-[#eee] bg-white px-3 text-sm font-medium text-[#333] hover:bg-accent sm:w-auto"
                    onClick={() =>
                      setForm((atual) => ({
                        ...atual,
                        enderecos: [
                          ...atual.enderecos,
                          {
                            apelido: '',
                            logradouro: atual.endereco,
                            numero: '',
                            bairro: '',
                            cep: '',
                            cidade: atual.cidade,
                            uf: '',
                            principal: atual.enderecos.length === 0,
                          },
                        ],
                      }))
                    }
                  >
                    Outro endereço
                  </button>
                </div>
              )}
              {historico.length > 0 && (
                <div className="rounded-md border p-3 text-sm">
                  <p className="mb-2 font-medium">Histórico deste cliente</p>
                  <ul className="space-y-1 text-muted-foreground">
                    {historico.slice(0, 6).map((item) => {
                      const encerrada = item.situacao === 'ENCERRADA'
                      const dataRef = encerrada
                        ? item.dataEncerramento || item.dataAbertura
                        : item.dataAbertura
                      const rotuloData = encerrada ? 'Encerrada' : (SITUACAO[item.situacao as Situacao] || item.situacao)
                      return (
                      <li key={`${item.numero}-${item.dataAbertura}`}>
                        {String(item.numero).padStart(4, '0')} · {rotuloData} · {formatarDataCurta(dataRef)}
                        {item.garantiaAte ? ` · garantia até ${formatarDataCurta(item.garantiaAte)}` : ''}
                        {item.endereco ? ` · ${item.endereco}` : ''}
                      </li>
                      )
                    })}
                  </ul>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Campo label="Cidade do recibo">
                  <input value={form.cidade} onChange={(event) => setForm({ ...form, cidade: event.target.value })} disabled={encerrada} className={campoClasse} />
                </Campo>
                <Campo label="Data de abertura">
                  <input type="date" value={form.data} onChange={(event) => setForm({ ...form, data: event.target.value })} disabled={encerrada} className={campoClasse} />
                </Campo>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Campo label="Situação">
                  {encerrada ? (
                    <p className="rounded-md border px-3 py-2 text-sm">{editando ? SITUACAO[editando.situacao] : 'Encerrada'}</p>
                  ) : (
                    <select
                      value={form.situacao}
                      onChange={(event) => setForm({ ...form, situacao: event.target.value as Formulario['situacao'] })}
                      className={campoClasse}
                    >
                      <option value="ABERTA">Aberta</option>
                      <option value="AGENDADA">Agendada</option>
                      <option value="EM_ANDAMENTO">Em andamento</option>
                    </select>
                  )}
                </Campo>
                {isAdmin ? (
                  <Campo label="Total do recibo">
                    <p className="rounded-md border px-3 py-2 text-sm">{formatarMoeda(totalForm)}</p>
                  </Campo>
                ) : <div />}
              </div>
              {isAdmin && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Campo label="Entrada">
                    <p className="rounded-md border px-3 py-2 text-sm">{formatarMoeda(entradaFicha)}</p>
                  </Campo>
                  <Campo label="Saldo parcelado">
                    <p className="rounded-md border px-3 py-2 text-sm">{formatarMoeda(saldoFicha)}</p>
                  </Campo>
                </div>
              )}
              {encerrada && (
                <p className="text-sm text-muted-foreground">
                  Encerrada em {formatarDataCurta(editando?.dataEncerramento || '')}. Garantia até {formatarDataCurta(editando?.garantiaAte || '')}.
                  {editando?.preventivaEm ? ` Próxima preventiva em ${formatarDataCurta(editando.preventivaEm)}.` : ''}
                  {isAdmin && editando?.margem != null ? ` Margem ${formatarMoeda(editando.margem)}.` : ''}
                </p>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Campo label="Tipo">
                  <select value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value as Formulario['tipo'] })} disabled={encerrada} className={campoClasse}>
                    <option value="EMERGENCIA">Emergência</option>
                    <option value="PREVENTIVA">Preventiva</option>
                    <option value="OBRA">Obra</option>
                  </select>
                </Campo>
                <Campo label="Origem do chamado">
                  <select value={form.origem} onChange={(event) => setForm({ ...form, origem: event.target.value as Formulario['origem'] })} disabled={encerrada} className={campoClasse}>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="TELEFONE">Telefone</option>
                    <option value="INDICACAO">Indicação</option>
                  </select>
                </Campo>
              </div>
              <Campo label="Funcionário">
                <select value={form.funcionarioId} onChange={(event) => setForm({ ...form, funcionarioId: event.target.value })} disabled={encerrada} className={campoClasse}>
                  <option value="">Não atribuído</option>
                  {funcionarios.map((pessoa) => (
                    <option key={pessoa.id} value={pessoa.id}>
                      {pessoa.nome}{pessoa.especialidade ? ` · ${pessoa.especialidade.toLowerCase()}` : ''}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Problema descrito no chamado">
                <textarea value={form.descricaoProblema} onChange={(event) => setForm({ ...form, descricaoProblema: event.target.value })} rows={2} disabled={encerrada} className={campoClasse} />
              </Campo>
              <Campo label="Vistoria">
                <textarea value={form.vistoria} onChange={(event) => setForm({ ...form, vistoria: event.target.value })} rows={3} disabled={encerrada} className={campoClasse} />
              </Campo>
              <Campo label="Serviços">
                <textarea
                  value={form.servicos}
                  onChange={(event) => setForm({ ...form, servicos: event.target.value })}
                  rows={4}
                  placeholder={'Um serviço por linha\nTroca de registro e reparo de vazamento'}
                  disabled={encerrada}
                  className={campoClasse}
                />
              </Campo>
              {isAdmin && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Campo label="Taxa de vistoria">
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={form.taxaVistoria}
                    onChange={(event) => setForm((atual) => ({ ...atual, taxaVistoria: mascararMoedaDigitada(event.target.value) }))}
                    placeholder="R$ 0,00"
                    disabled={encerrada}
                    className={campoClasse}
                  />
                </Campo>
                <Campo label="Mão de obra">
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={form.maoDeObra}
                    onChange={(event) => setForm((atual) => ({ ...atual, maoDeObra: mascararMoedaDigitada(event.target.value) }))}
                    placeholder="R$ 0,00"
                    disabled={encerrada}
                    className={campoClasse}
                  />
                </Campo>
                <Campo label="Deslocamento">
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={form.deslocamento}
                    onChange={(event) => setForm((atual) => ({ ...atual, deslocamento: mascararMoedaDigitada(event.target.value) }))}
                    placeholder="R$ 0,00"
                    disabled={encerrada}
                    className={campoClasse}
                  />
                </Campo>
                <Campo label="Material">
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={form.material}
                    onChange={(event) => setForm((atual) => ({ ...atual, material: mascararMoedaDigitada(event.target.value) }))}
                    placeholder="R$ 0,00"
                    disabled={encerrada}
                    className={campoClasse}
                  />
                </Campo>
              </div>
              )}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Peças do veículo</span>
                  {!encerrada && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((atual) => ({
                          ...atual,
                          pecas: [...atual.pecas, { produtoId: '', quantidade: '1', custoUnitario: null, rotulo: '' }],
                        }))
                      }
                      className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
                    >
                      Adicionar peça
                    </button>
                  )}
                </div>
                {form.pecas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma peça nesta ordem.</p>
                ) : (
                  form.pecas.map((linha, indice) => (
                    <div key={`${linha.produtoId}-${indice}`} className="grid grid-cols-[1fr_7rem_auto] items-center gap-2">
                      <select
                        value={linha.produtoId}
                        disabled={encerrada}
                        onChange={(event) => {
                          const produtoId = event.target.value
                          const produto = produtos.find((item) => String(item.id) === produtoId)
                          setForm((atual) => ({
                            ...atual,
                            pecas: atual.pecas.map((peca, posicao) =>
                              posicao === indice
                                ? { ...peca, produtoId, rotulo: produto ? `${produto.codigo} - ${produto.descricao}` : peca.rotulo }
                                : peca,
                            ),
                          }))
                        }}
                        className={campoClasse}
                      >
                        <option value="">Selecione a peça</option>
                        {linha.produtoId && !produtos.some((produto) => String(produto.id) === linha.produtoId) ? (
                          <option value={linha.produtoId}>{linha.rotulo || `Peça ${linha.produtoId}`}</option>
                        ) : null}
                        {produtos.map((produto) => (
                          <option key={produto.id} value={produto.id}>
                            {produto.codigo} - {produto.descricao} ({quantidadeCampo(produto.estoque)} {produto.unidade})
                          </option>
                        ))}
                      </select>
                      <input
                        value={linha.quantidade}
                        disabled={encerrada}
                        onChange={(event) =>
                          setForm((atual) => ({
                            ...atual,
                            pecas: atual.pecas.map((peca, posicao) =>
                              posicao === indice ? { ...peca, quantidade: event.target.value } : peca,
                            ),
                          }))
                        }
                        placeholder="Qtd"
                        className={campoClasse}
                      />
                      {encerrada ? (
                        <span className="text-xs text-muted-foreground">
                          {linha.custoUnitario == null ? '' : formatarMoeda(linha.custoUnitario)}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setForm((atual) => ({ ...atual, pecas: atual.pecas.filter((_, posicao) => posicao !== indice) }))
                          }
                          className="rounded-md border px-2 py-2 text-sm hover:bg-accent"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Material retirado na loja</span>
                  {!encerrada && (
                    <button type="button" className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent" onClick={() => setForm((atual) => ({ ...atual, materiaisLoja: [...atual.materiaisLoja, { descricao: '', quantidadeRetirada: '1', quantidadeUsada: '1', quantidadeDevolvida: '0' }] }))}>Adicionar</button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Esse material não altera o estoque do veículo.</p>
                {form.materiaisLoja.map((linha, indice) => (
                  <div key={`loja-${indice}`} className="space-y-3 rounded-md border border-[#eee] bg-[#fafafa] p-3">
                    <Campo label="Descrição">
                      <input
                        value={linha.descricao}
                        disabled={encerrada}
                        placeholder="Descrição"
                        className={campoClasse}
                        onChange={(event) =>
                          setForm((atual) => ({
                            ...atual,
                            materiaisLoja: atual.materiaisLoja.map((item, posicao) =>
                              posicao === indice ? { ...item, descricao: event.target.value } : item,
                            ),
                          }))
                        }
                      />
                    </Campo>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Campo label="Retirada">
                        <input
                          value={linha.quantidadeRetirada}
                          disabled={encerrada}
                          placeholder="0"
                          className={campoClasse}
                          onChange={(event) =>
                            setForm((atual) => ({
                              ...atual,
                              materiaisLoja: atual.materiaisLoja.map((item, posicao) =>
                                posicao === indice ? { ...item, quantidadeRetirada: event.target.value } : item,
                              ),
                            }))
                          }
                        />
                      </Campo>
                      <Campo label="Usada">
                        <input
                          value={linha.quantidadeUsada}
                          disabled={encerrada}
                          placeholder="0"
                          className={campoClasse}
                          onChange={(event) =>
                            setForm((atual) => ({
                              ...atual,
                              materiaisLoja: atual.materiaisLoja.map((item, posicao) =>
                                posicao === indice ? { ...item, quantidadeUsada: event.target.value } : item,
                              ),
                            }))
                          }
                        />
                      </Campo>
                      <Campo label="Devolvida">
                        <input
                          value={linha.quantidadeDevolvida}
                          disabled={encerrada}
                          placeholder="0"
                          className={campoClasse}
                          onChange={(event) =>
                            setForm((atual) => ({
                              ...atual,
                              materiaisLoja: atual.materiaisLoja.map((item, posicao) =>
                                posicao === indice ? { ...item, quantidadeDevolvida: event.target.value } : item,
                              ),
                            }))
                          }
                        />
                      </Campo>
                    </div>
                    {!encerrada && (
                      <button
                        type="button"
                        className="inline-flex h-11 w-full items-center justify-center rounded-md border border-[#eee] bg-white px-3 text-sm text-[#b42318] sm:w-auto"
                        onClick={() =>
                          setForm((atual) => ({
                            ...atual,
                            materiaisLoja: atual.materiaisLoja.filter((_, posicao) => posicao !== indice),
                          }))
                        }
                      >
                        Remover
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {editando && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Fotos</p>
                  <div className="flex flex-wrap gap-2">
                    {(editando.fotos || []).map((foto) => (
                      <a key={foto.id} href={foto.url} target="_blank" rel="noreferrer" className="block">
                        <img src={foto.url} alt={foto.momento === 'ANTES' ? 'Antes' : 'Depois'} className="h-20 w-20 rounded object-cover" />
                      </a>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="rounded-md border px-3 py-2 text-sm">
                      Foto de antes
                      <input type="file" accept="image/*" className="mt-1 block w-full text-xs" onChange={(event) => { const arquivo = event.target.files?.[0]; if (arquivo) void anexarFoto('ANTES', arquivo) }} />
                    </label>
                    <label className="rounded-md border px-3 py-2 text-sm">
                      Foto de depois
                      <input type="file" accept="image/*" className="mt-1 block w-full text-xs" onChange={(event) => { const arquivo = event.target.files?.[0]; if (arquivo) void anexarFoto('DEPOIS', arquivo) }} />
                    </label>
                  </div>
                </div>
              )}
              {editando && editando.situacao !== 'ENCERRADA' && editando.situacao !== 'CANCELADA' && (
                <div className="space-y-2 rounded-md border p-3">
                  <Campo label="Motivo do cancelamento">
                    <input value={motivoCancelamento} onChange={(event) => setMotivoCancelamento(event.target.value)} className={campoClasse} placeholder="Obrigatório para cancelar" />
                  </Campo>
                  <button type="button" onClick={() => void cancelarOrdemAtual()} disabled={cancelando} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
                    Cancelar esta ordem
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="text-sm">
                  <p className="font-medium">Assinatura do cliente</p>
                  <p className="text-muted-foreground">{form.assinatura ? 'Assinatura pronta para o PDF.' : 'Ainda não assinada.'}</p>
                </div>
                <button type="button" onClick={() => setAssinandoId('form')} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
                  {form.assinatura ? 'Assinar de novo' : 'Coletar assinatura'}
                </button>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button type="button" onClick={fecharModal} className="min-w-[7rem] flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">
                {encerrada ? 'Fechar' : 'Cancelar'}
              </button>
              {!encerrada && (form.situacao === 'EM_ANDAMENTO' || form.situacao === 'EM_EXECUCAO') && (
                <button
                  type="button"
                  onClick={() => void concluirPelaFicha()}
                  disabled={salvando || !form.cliente.trim()}
                  className="min-w-[7rem] flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Concluir
                </button>
              )}
              {!encerrada && isAdmin && (
                <button
                  type="button"
                  onClick={() => void encerrarPelaFicha()}
                  disabled={salvando || !form.cliente.trim()}
                  className="min-w-[7rem] flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
                >
                  Encerrar
                </button>
              )}
              {!encerrada && (
                <button
                  type="button"
                  onClick={() => void salvar()}
                  disabled={salvando || !form.cliente.trim()}
                  className="min-w-[7rem] flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Salvar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {encerrarAlvo && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg bg-background p-4 shadow-xl sm:p-6">
            <CabecalhoModal
              icone={IconeOrdem}
              titulo={`Encerrar ordem ${String(encerrarAlvo.numero).padStart(4, '0')}`}
              descricao="Pagamento, garantia e a saída das peças."
              onFechar={encerrando ? undefined : () => setEncerrarAlvo(null)}
            />
            <p className="mb-2 text-sm text-muted-foreground">
              A garantia padrão é de 90 dias e a próxima preventiva, de 6 meses. As peças do veículo saem do estoque. O material da loja fica só registrado.
            </p>
            <div className="mb-4 space-y-1 text-sm">
              <p className="font-medium">Total: {formatarMoeda(encerrarAlvo.total)}</p>
              <p>Entrada: {formatarMoeda(entradaEncerrar)}</p>
              <p>Saldo parcelado: {formatarMoeda(saldoEncerrar)}</p>
            </div>
            <div className="space-y-4">
              <Campo label="Forma de pagamento">
                <select
                  value={encerrarForm.formaPagamento}
                  onChange={(event) => setEncerrarForm({ ...encerrarForm, formaPagamento: event.target.value })}
                  className={campoClasse}
                >
                  {FORMAS.map((forma) => (
                    <option key={forma} value={forma}>
                      {forma}
                    </option>
                  ))}
                </select>
              </Campo>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Campo label="Parcelas">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={encerrarForm.parcelas}
                    onChange={(event) => setEncerrarForm({ ...encerrarForm, parcelas: event.target.value })}
                    className={campoClasse}
                  />
                </Campo>
                <Campo label="Primeiro vencimento">
                  <input
                    type="date"
                    value={encerrarForm.dataVencimento}
                    onChange={(event) => setEncerrarForm({ ...encerrarForm, dataVencimento: event.target.value })}
                    className={campoClasse}
                  />
                </Campo>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Campo label="Entrada">
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={encerrarForm.entrada}
                    onChange={(event) => setEncerrarForm((atual) => ({ ...atual, entrada: mascararMoedaDigitada(event.target.value) }))}
                    placeholder="R$ 0,00"
                    className={campoClasse}
                  />
                </Campo>
                <Campo label="Garantia (dias)">
                  <input type="number" min={1} value={encerrarForm.garantiaDias} onChange={(event) => setEncerrarForm({ ...encerrarForm, garantiaDias: event.target.value })} className={campoClasse} />
                </Campo>
                <Campo label="Preventiva (meses)">
                  <input type="number" min={0} value={encerrarForm.preventivaMeses} onChange={(event) => setEncerrarForm({ ...encerrarForm, preventivaMeses: event.target.value })} className={campoClasse} />
                </Campo>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={encerrarForm.entradaRecebida} onChange={(event) => setEncerrarForm({ ...encerrarForm, entradaRecebida: event.target.checked })} />
                Entrada já recebida
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={encerrarForm.usarQuintoDiaUtil} onChange={(event) => setEncerrarForm({ ...encerrarForm, usarQuintoDiaUtil: event.target.checked })} />
                Vencer no quinto dia útil
              </label>
            </div>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={() => setEncerrarAlvo(null)} disabled={encerrando} className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmarEncerrar()}
                disabled={encerrando}
                className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {encerrando ? 'Encerrando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {assinandoId && (
        <AssinaturaCliente
          nome={assinandoId === 'form' ? form.cliente || 'cliente' : ordemAssinando?.cliente || 'cliente'}
          onClose={() => setAssinandoId(null)}
          onSave={(dataUrl) => void guardarAssinatura(dataUrl)}
        />
      )}
    </div>
  )
}

const campoClasse = 'w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-70'

async function fotoReduzida(arquivo: File) {
  const bitmap = await createImageBitmap(arquivo)
  const limite = 1280
  const escala = Math.min(1, limite / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * escala))
  canvas.height = Math.max(1, Math.round(bitmap.height * escala))
  const contexto = canvas.getContext('2d')
  if (!contexto) return arquivo.type.startsWith('image/') ? URL.createObjectURL(arquivo) : ''
  contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.72)
}

function Campo({ label, obrigatorio, children }: { label: string; obrigatorio?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium">
        {label}
        {obrigatorio ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
    </label>
  )
}

function AssinaturaCliente({ nome, onClose, onSave }: { nome: string; onClose: () => void; onSave: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const desenhando = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const quadro = requestAnimationFrame(() => preparar(canvas))
    return () => cancelAnimationFrame(quadro)
  }, [])

  function preparar(canvas: HTMLCanvasElement) {
    const proporcao = 2
    const retangulo = canvas.getBoundingClientRect()
    canvas.width = retangulo.width * proporcao
    canvas.height = retangulo.height * proporcao
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(proporcao, 0, 0, proporcao, 0, 0)
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111111'
  }

  function ponto(event: PointerEvent<HTMLCanvasElement>) {
    const retangulo = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - retangulo.left, y: event.clientY - retangulo.top }
  }

  function iniciar(event: PointerEvent<HTMLCanvasElement>) {
    desenhando.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    const ctx = event.currentTarget.getContext('2d')
    if (!ctx) return
    const posicao = ponto(event)
    ctx.beginPath()
    ctx.moveTo(posicao.x, posicao.y)
  }

  function mover(event: PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return
    const ctx = event.currentTarget.getContext('2d')
    if (!ctx) return
    const posicao = ponto(event)
    ctx.lineTo(posicao.x, posicao.y)
    ctx.stroke()
  }

  function limpar() {
    const canvas = canvasRef.current
    if (!canvas) return
    preparar(canvas)
  }

  function salvar() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    const temTraço = pixels.some((valor, indice) => indice % 4 === 3 && valor > 0)
    if (!temTraço) {
      toast.error('Peça para o cliente assinar no quadro.')
      return
    }
    onSave(canvas.toDataURL('image/png'))
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-lg bg-background p-4 shadow-xl sm:p-6">
        <CabecalhoModal
          icone={IconeAssinatura}
          titulo="Assinatura do cliente"
          descricao={`Entregue o aparelho para ${nome} assinar.`}
          onFechar={onClose}
        />
        <canvas
          ref={canvasRef}
          className="h-48 w-full touch-none rounded-md border bg-white"
          onPointerDown={iniciar}
          onPointerMove={mover}
          onPointerUp={() => {
            desenhando.current = false
          }}
          onPointerLeave={() => {
            desenhando.current = false
          }}
        />
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={limpar} className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">
            Limpar
          </button>
          <button type="button" onClick={salvar} className="flex-1 rounded-md bg-[#e10600] px-4 py-2 text-sm font-medium text-white hover:bg-[#b00012]">
            Salvar assinatura
          </button>
        </div>
      </div>
    </div>
  )
}
