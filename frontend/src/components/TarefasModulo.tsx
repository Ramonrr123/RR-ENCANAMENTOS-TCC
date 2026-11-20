import { useEffect, useMemo, useRef, useState } from 'react'
import { HiChevronDown, HiChevronUp, HiMicrophone, HiPencil, HiPlus, HiSearch, HiTrash } from 'react-icons/hi'
import { toast } from 'sonner'
import { FiltrosColapsaveis } from '@/components/FiltrosColapsaveis'
import { CabecalhoModal, CabecalhoModulo, IconeTarefas } from '@/components/icones/IconesErp'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { api } from '@/services/api'

const campo = 'h-11 w-full min-w-0 rounded-md border border-[#eee] bg-white px-3 text-sm text-[#333]'
const card = 'rounded-md border border-[#ddd] bg-white p-4'

type Status = 'pendente' | 'andamento' | 'concluida'
type Prioridade = 'baixa' | 'media' | 'alta'
type Coluna = 'titulo' | 'descricao' | 'prazo' | 'prioridade' | 'status'

type Tarefa = {
  id: string
  titulo: string
  descricao: string
  prazo: string
  prioridade: Prioridade
  status: Status
  responsaveis: string[]
  chamadoNumero?: number | null
}

const STORAGE_KEY = 'erp_tarefas'
const PAGE_SIZE = 16

const STATUS: Record<Status, { label: string; classe: string }> = {
  pendente: { label: 'Pendente', classe: 'bg-gray-100 text-gray-800' },
  andamento: { label: 'Em andamento', classe: 'bg-amber-100 text-amber-800' },
  concluida: { label: 'Concluída', classe: 'bg-emerald-100 text-emerald-800' },
}

const PRIORIDADE: Record<Prioridade, { label: string; classe: string }> = {
  alta: { label: 'Alta', classe: 'bg-red-100 text-red-700' },
  media: { label: 'Média', classe: 'bg-amber-100 text-amber-800' },
  baixa: { label: 'Baixa', classe: 'bg-slate-100 text-slate-600' },
}

type ReconhecimentoFala = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function criarReconhecimento(): ReconhecimentoFala | null {
  const navegador = window as Window & {
    SpeechRecognition?: new () => ReconhecimentoFala
    webkitSpeechRecognition?: new () => ReconhecimentoFala
  }
  const Construtor = navegador.SpeechRecognition || navegador.webkitSpeechRecognition
  return Construtor ? new Construtor() : null
}

const LIMITE_RESPONSAVEIS = 5

const FORM_VAZIO = {
  titulo: '',
  descricao: '',
  prazo: '',
  prioridade: 'media' as Prioridade,
  status: 'pendente' as Status,
  responsaveis: [] as string[],
}

function nomeDaSessao() {
  try {
    const usuario = JSON.parse(localStorage.getItem('user') || '{}') as { nome?: string }
    return typeof usuario.nome === 'string' ? usuario.nome.trim() : ''
  } catch {
    return ''
  }
}

function normalizar(tarefa: Partial<Tarefa> & { id: string | number }): Tarefa {
  return {
    id: String(tarefa.id),
    titulo: tarefa.titulo || '',
    descricao: tarefa.descricao || '',
    prazo: String(tarefa.prazo || '').slice(0, 10),
    prioridade: tarefa.prioridade || 'media',
    status: tarefa.status || 'pendente',
    responsaveis: Array.isArray(tarefa.responsaveis)
      ? tarefa.responsaveis.filter((nome) => typeof nome === 'string' && nome.trim())
      : [],
    chamadoNumero: typeof (tarefa as { chamadoNumero?: unknown }).chamadoNumero === 'number' ? (tarefa as { chamadoNumero: number }).chamadoNumero : null,
  }
}

function carregar(): Tarefa[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const lista = raw ? JSON.parse(raw) : []
    if (!Array.isArray(lista)) return []
    return lista.map((tarefa) => ({
      ...tarefa,
      responsaveis: Array.isArray(tarefa?.responsaveis) ? tarefa.responsaveis.filter((nome: unknown) => typeof nome === 'string' && nome.trim()) : [],
    }))
  } catch {
    return []
  }
}

function formatarPrazo(prazo: string) {
  if (!prazo) return '-'
  const [ano, mes, dia] = prazo.split('-')
  return `${dia}/${mes}/${ano}`
}

function prazoVencido(tarefa: Tarefa) {
  if (!tarefa.prazo || tarefa.status === 'concluida') return false
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return new Date(`${tarefa.prazo}T00:00:00`) < hoje
}

export function TarefasModulo() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [busca, setBusca] = useState('')
  const [selecionadas, setSelecionadas] = useState<string[]>([])
  const [pagina, setPagina] = useState(0)
  const tarefaSelecionada = selecionadas.length === 1 ? tarefas.find((tarefa) => tarefa.id === selecionadas[0]) || null : null
  const [ordenacao, setOrdenacao] = useState<{ coluna: Coluna; direcao: 'asc' | 'desc' }>({
    coluna: 'prazo',
    direcao: 'asc',
  })
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Tarefa | null>(null)
  const [form, setForm] = useState(FORM_VAZIO)
  const [ouvindo, setOuvindo] = useState(false)
  const [avisoFala, setAvisoFala] = useState('')
  const [pessoas, setPessoas] = useState<Array<{ id: number; nome: string }>>([])
  const [acoesAberto, setAcoesAberto] = useState(false)
  const isMobile = useIsMobile()
  const reconhecimentoRef = useRef<ReconhecimentoFala | null>(null)
  const descricaoBaseRef = useRef('')

  function pararEscuta() {
    reconhecimentoRef.current?.stop()
    reconhecimentoRef.current = null
    setOuvindo(false)
  }

  function alternarEscuta() {
    if (reconhecimentoRef.current) {
      pararEscuta()
      return
    }
    const reconhecimento = criarReconhecimento()
    if (!reconhecimento) {
      setAvisoFala('Este navegador não escuta a fala. Use Chrome ou Edge.')
      return
    }
    descricaoBaseRef.current = form.descricao.trim()
    reconhecimento.lang = 'pt-BR'
    reconhecimento.continuous = true
    reconhecimento.interimResults = true
    reconhecimento.onresult = (event) => {
      let finalizado = ''
      let parcial = ''
      for (let i = 0; i < event.results.length; i += 1) {
        const trecho = event.results[i]
        const texto = trecho[0]?.transcript || ''
        if (trecho.isFinal) finalizado += texto
        else parcial += texto
      }
      const falado = `${finalizado}${parcial}`.replace(/\s+/g, ' ').trim()
      const base = descricaoBaseRef.current
      const descricao = [base, falado].filter(Boolean).join(' ')
      setForm((atual) => ({ ...atual, descricao }))
    }
    reconhecimento.onerror = (event) => {
      if (event.error === 'not-allowed') setAvisoFala('Permita o microfone para ditar a descrição.')
      else if (event.error !== 'aborted' && event.error !== 'no-speech') setAvisoFala('Não foi possível escutar. Tente de novo.')
      setOuvindo(false)
      reconhecimentoRef.current = null
    }
    reconhecimento.onend = () => {
      setOuvindo(false)
      reconhecimentoRef.current = null
    }
    reconhecimentoRef.current = reconhecimento
    setAvisoFala('')
    setOuvindo(true)
    try {
      reconhecimento.start()
    } catch {
      setOuvindo(false)
      reconhecimentoRef.current = null
      setAvisoFala('Não foi possível ligar o microfone.')
    }
  }

  useEffect(() => {
    let ativo = true
    void (async () => {
      const resposta = await api.getTarefas()
      if (!ativo) return
      if (resposta.error || !Array.isArray(resposta.data)) {
        toast.error(resposta.error || 'Não foi possível carregar as tarefas.')
        return
      }
      let lista = resposta.data.map((tarefa) => normalizar(tarefa))
      const locais = carregar().filter(
        (local) => local.titulo.trim() && !lista.some((tarefa) => tarefa.titulo === local.titulo && tarefa.prazo === local.prazo),
      )
      for (const local of locais) {
        const criada = await api.createTarefa({
          titulo: local.titulo.trim(),
          descricao: local.descricao.trim(),
          prazo: local.prazo || null,
          prioridade: local.prioridade,
          status: local.status,
          responsaveis: local.responsaveis.length ? local.responsaveis : [nomeDaSessao() || 'Administrador'],
        })
        if (criada.data) lista = [normalizar(criada.data), ...lista]
      }
      if (locais.length) localStorage.removeItem(STORAGE_KEY)
      if (ativo) setTarefas(lista)
    })()
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    void api.getUsers({ status: 'ATIVO' }).then((resposta) => {
      const bruto = resposta.data as
        | { data?: Array<{ id: number; nome?: string; status?: string }> }
        | Array<{ id: number; nome?: string; status?: string }>
        | undefined
      const lista = Array.isArray(bruto) ? bruto : Array.isArray(bruto?.data) ? bruto.data : []
      const ativas = lista
        .filter((pessoa) => pessoa.nome && (!pessoa.status || pessoa.status.toUpperCase() === 'ATIVO'))
        .map((pessoa) => ({ id: pessoa.id, nome: pessoa.nome!.trim() }))
      if (ativas.length > 0) {
        setPessoas(ativas)
        return
      }
      const nome = nomeDaSessao()
      setPessoas(nome ? [{ id: 0, nome }] : [])
    })
  }, [])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const lista = termo
      ? tarefas.filter((tarefa) => {
          const texto = [
            tarefa.titulo,
            tarefa.descricao,
            formatarPrazo(tarefa.prazo),
            PRIORIDADE[tarefa.prioridade].label,
            STATUS[tarefa.status].label,
            ...(tarefa.responsaveis || []),
            tarefa.chamadoNumero ? `chamado ${tarefa.chamadoNumero}` : '',
          ]
            .join(' ')
            .toLowerCase()
          return texto.includes(termo)
        })
      : [...tarefas]

    const pesoStatus: Record<Status, number> = { pendente: 0, andamento: 1, concluida: 2 }
    const pesoPrioridade: Record<Prioridade, number> = { alta: 0, media: 1, baixa: 2 }

    lista.sort((a, b) => {
      let resultado = 0
      if (ordenacao.coluna === 'prazo') resultado = (a.prazo || '9999').localeCompare(b.prazo || '9999')
      else if (ordenacao.coluna === 'status') resultado = pesoStatus[a.status] - pesoStatus[b.status]
      else if (ordenacao.coluna === 'prioridade') resultado = pesoPrioridade[a.prioridade] - pesoPrioridade[b.prioridade]
      else resultado = a[ordenacao.coluna].localeCompare(b[ordenacao.coluna], 'pt-BR')
      return ordenacao.direcao === 'asc' ? resultado : -resultado
    })
    return lista
  }, [tarefas, busca, ordenacao])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE))
  const paginaAtual = Math.min(pagina, totalPaginas - 1)
  const visiveis = filtradas.slice(paginaAtual * PAGE_SIZE, paginaAtual * PAGE_SIZE + PAGE_SIZE)

  function ordenar(coluna: Coluna) {
    setOrdenacao((atual) =>
      atual.coluna === coluna
        ? { coluna, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' }
        : { coluna, direcao: 'asc' },
    )
  }

  function abrirNova() {
    setEditando(null)
    setForm(FORM_VAZIO)
    setModalAberto(true)
  }

  function abrirEdicao(tarefa: Tarefa) {
    setEditando(tarefa)
    setForm({
      titulo: tarefa.titulo,
      descricao: tarefa.descricao,
      prazo: tarefa.prazo,
      prioridade: tarefa.prioridade,
      status: tarefa.status,
      responsaveis: tarefa.responsaveis || [],
    })
    setModalAberto(true)
  }

  function fecharModal() {
    pararEscuta()
    setAvisoFala('')
    setModalAberto(false)
    setEditando(null)
    setForm(FORM_VAZIO)
  }

  useEffect(() => () => reconhecimentoRef.current?.stop(), [])

  async function salvar() {
    pararEscuta()
    const titulo = form.titulo.trim()
    if (!titulo || form.responsaveis.length === 0 || form.responsaveis.length > LIMITE_RESPONSAVEIS) return
    const corpo = {
      titulo,
      descricao: form.descricao.trim(),
      prazo: form.prazo || null,
      prioridade: form.prioridade,
      status: form.status,
      responsaveis: form.responsaveis,
    }
    const resposta = editando ? await api.updateTarefa(Number(editando.id), corpo) : await api.createTarefa(corpo)
    if (resposta.error || !resposta.data) {
      toast.error(resposta.error || 'Não foi possível salvar a tarefa.')
      return
    }
    const salva = normalizar(resposta.data)
    setTarefas((lista) => (editando ? lista.map((tarefa) => (tarefa.id === editando.id ? salva : tarefa)) : [salva, ...lista]))
    if (!editando) setPagina(0)
    fecharModal()
  }

  async function excluirSelecionadas() {
    if (selecionadas.length === 0) return
    const resposta = await api.deleteTarefas(selecionadas.map(Number))
    if (resposta.error) {
      toast.error(resposta.error)
      return
    }
    setTarefas((lista) => lista.filter((tarefa) => !selecionadas.includes(tarefa.id)))
    setSelecionadas([])
  }

  function alternarSelecao(id: string) {
    setSelecionadas((lista) => (lista.includes(id) ? lista.filter((item) => item !== id) : [...lista, id]))
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

  async function atualizarStatus(tarefa: Tarefa, status: Status) {
    const anterior = tarefa.status
    setTarefas((lista) => lista.map((item) => (item.id === tarefa.id ? { ...item, status } : item)))
    const resposta = await api.updateTarefa(Number(tarefa.id), { status })
    if (!resposta.error) return
    toast.error(resposta.error)
    setTarefas((lista) => lista.map((item) => (item.id === tarefa.id ? { ...item, status: anterior } : item)))
  }

  return (
    <div
      data-ds="ant-mobile-tarefas"
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f5f5f9]"
    >
      <div className="shrink-0 space-y-3 border-b border-[#eee] bg-white px-[15px] py-4">
        <CabecalhoModulo
          icone={IconeTarefas}
          titulo="Tarefas"
          acoes={
            <>
              <button
                type="button"
                onClick={abrirNova}
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
                  onClick={() => void excluirSelecionadas()}
                  disabled={selecionadas.length === 0}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <HiTrash className="h-4 w-4" />
                  Excluir
                </button>
              )}
            </>
          }
        />
        <FiltrosColapsaveis>
          <div className="relative min-w-0">
            <HiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#888]" />
            <input
              value={busca}
              onChange={(event) => {
                setBusca(event.target.value)
                setPagina(0)
              }}
              placeholder="Buscar..."
              className={`${campo} pl-9 sm:w-64`}
            />
          </div>
        </FiltrosColapsaveis>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <div className="space-y-3 px-[15px] py-4 md:hidden">
          {visiveis.length === 0 ? (
            <p className="text-sm text-[#888]">Nenhuma tarefa encontrada</p>
          ) : (
            visiveis.map((tarefa) => (
              <article key={tarefa.id} className={`${card} space-y-3`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selecionadas.includes(tarefa.id)}
                    onChange={() => alternarSelecao(tarefa.id)}
                    className="mt-1 h-4 w-4 cursor-pointer rounded"
                    aria-label={`Selecionar ${tarefa.titulo}`}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="break-words text-[15px] font-medium leading-snug text-[#333]">{tarefa.titulo}</p>
                    <p className={`text-xs ${prazoVencido(tarefa) ? 'font-medium text-red-600' : 'text-[#888]'}`}>
                      Prazo: {formatarPrazo(tarefa.prazo)}
                    </p>
                    {tarefa.responsaveis?.length ? (
                      <p className="break-words text-xs text-[#666]">{tarefa.responsaveis.join(', ')}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => abrirEdicao(tarefa)}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#eee] bg-white text-primary"
                    aria-label="Editar tarefa"
                  >
                    <HiPencil className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-[#eee] pt-3">
                  <div className="min-w-0">
                    <p className="text-[11px] text-[#888]">Prioridade</p>
                    <span className={`mt-1 inline-flex rounded px-2 py-1 text-xs font-medium ${PRIORIDADE[tarefa.prioridade].classe}`}>
                      {PRIORIDADE[tarefa.prioridade].label}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-[#888]">Status</p>
                    <select
                      value={tarefa.status}
                      onChange={(event) => void atualizarStatus(tarefa, event.target.value as Status)}
                      className={`mt-1 h-11 w-full rounded-md border border-[#eee] px-2 text-sm font-medium ${STATUS[tarefa.status].classe}`}
                    >
                      <option value="pendente">Pendente</option>
                      <option value="andamento">Em andamento</option>
                      <option value="concluida">Concluída</option>
                    </select>
                  </div>
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
                <th className="w-10 border-b px-2 py-2 text-left text-xs font-medium text-muted-foreground">Editar</th>
                <Cabecalho coluna="titulo" label="Título" />
                <Cabecalho coluna="descricao" label="Descrição" className="hidden lg:table-cell" />
                <th className="hidden border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground lg:table-cell">Responsáveis</th>
                <Cabecalho coluna="prazo" label="Prazo" />
                <Cabecalho coluna="prioridade" label="Prioridade" />
                <Cabecalho coluna="status" label="Status" />
                <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">Vínculo</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhuma tarefa encontrada
                  </td>
                </tr>
              ) : (
                visiveis.map((tarefa) => (
                  <tr key={tarefa.id} className="border-b hover:bg-accent/50">
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selecionadas.includes(tarefa.id)}
                        onChange={() => alternarSelecao(tarefa.id)}
                        className="cursor-pointer rounded"
                      />
                    </td>
                    <td className="px-2 py-2 sm:px-4">
                      <button type="button" onClick={() => abrirEdicao(tarefa)} title="Editar tarefa" aria-label="Editar tarefa">
                        <HiPencil className="h-4 w-4 text-primary" />
                      </button>
                    </td>
                    <td className="px-2 py-2 text-sm font-medium sm:px-4">{tarefa.titulo}</td>
                    <td className="hidden max-w-xs truncate px-4 py-2 text-sm text-muted-foreground lg:table-cell">
                      {tarefa.descricao || '-'}
                    </td>
                    <td className="hidden px-4 py-2 text-sm lg:table-cell">
                      {tarefa.responsaveis?.length ? tarefa.responsaveis.join(', ') : '-'}
                    </td>
                    <td className={`whitespace-nowrap px-2 py-2 text-sm sm:px-4 ${prazoVencido(tarefa) ? 'font-medium text-red-600' : ''}`}>
                      {formatarPrazo(tarefa.prazo)}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded px-2 py-1 text-xs font-medium ${PRIORIDADE[tarefa.prioridade].classe}`}>
                        {PRIORIDADE[tarefa.prioridade].label}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={tarefa.status}
                        onChange={(event) => void atualizarStatus(tarefa, event.target.value as Status)}
                        className={`max-w-[7.5rem] rounded border-0 px-2 py-1 text-xs font-medium ${STATUS[tarefa.status].classe}`}
                      >
                        <option value="pendente">Pendente</option>
                        <option value="andamento">Em andamento</option>
                        <option value="concluida">Concluída</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-sm text-muted-foreground">
                      {tarefa.chamadoNumero ? `Chamado #${tarefa.chamadoNumero}` : '-'}
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
            ? `Página ${paginaAtual + 1} de ${totalPaginas} • Total: ${filtradas.length} tarefa${filtradas.length === 1 ? '' : 's'}`
            : 'Nenhuma tarefa encontrada'}
        </div>
        {filtradas.length > PAGE_SIZE && (
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
            <SheetTitle>Ações da tarefa</SheetTitle>
            <SheetDescription>
              {selecionadas.length === 0
                ? 'Selecione tarefas na lista para editar ou excluir.'
                : `${selecionadas.length} selecionada${selecionadas.length === 1 ? '' : 's'}.`}
            </SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setAcoesAberto(false)
                abrirNova()
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1d4ed8] px-3 py-3 text-sm font-medium text-white"
            >
              <HiPlus className="h-4 w-4" />
              Nova tarefa
            </button>
            <button
              type="button"
              disabled={!tarefaSelecionada}
              onClick={() => {
                if (!tarefaSelecionada) return
                setAcoesAberto(false)
                abrirEdicao(tarefaSelecionada)
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#dbeafe] px-3 py-3 text-sm font-medium text-[#1e3a8a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <HiPencil className="h-4 w-4" />
              Editar
            </button>
            <button
              type="button"
              disabled={selecionadas.length === 0}
              onClick={() => {
                setAcoesAberto(false)
                void excluirSelecionadas()
              }}
              className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#fde8e8] px-3 py-3 text-sm font-medium text-[#b42318] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <HiTrash className="h-4 w-4" />
              Excluir
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-background p-4 shadow-xl sm:p-6">
            <CabecalhoModal
              icone={IconeTarefas}
              titulo={editando ? 'Editar tarefa' : 'Nova tarefa'}
              onFechar={fecharModal}
            />
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Título <span className="text-destructive">*</span>
                </label>
                <input
                  value={form.titulo}
                  onChange={(event) => setForm({ ...form, titulo: event.target.value })}
                  className="w-full rounded-md border bg-background px-4 py-2 text-sm"
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="text-sm font-medium">Descrição</label>
                  <button
                    type="button"
                    onClick={alternarEscuta}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${ouvindo ? 'border-destructive text-destructive' : 'hover:bg-accent'}`}
                  >
                    <HiMicrophone className="h-4 w-4" />
                    {ouvindo ? 'Ouvindo…' : 'Falar'}
                  </button>
                </div>
                <textarea
                  value={form.descricao}
                  onChange={(event) => setForm({ ...form, descricao: event.target.value })}
                  rows={3}
                  className="w-full rounded-md border bg-background px-4 py-2 text-sm"
                />
                {avisoFala && <p className="mt-1 text-xs text-destructive">{avisoFala}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">Prazo</label>
                  <input
                    type="date"
                    value={form.prazo}
                    onChange={(event) => setForm({ ...form, prazo: event.target.value })}
                    className="w-full rounded-md border bg-background px-4 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Prioridade</label>
                  <select
                    value={form.prioridade}
                    onChange={(event) => setForm({ ...form, prioridade: event.target.value as Prioridade })}
                    className="w-full rounded-md border bg-background px-4 py-2 text-sm"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Responsáveis <span className="text-destructive">*</span>
                </label>
                {form.responsaveis.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {form.responsaveis.map((nome) => (
                      <span key={nome} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
                        {nome}
                        <button
                          type="button"
                          aria-label={`Remover ${nome}`}
                          onClick={() => setForm({ ...form, responsaveis: form.responsaveis.filter((atual) => atual !== nome) })}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <select
                  value=""
                  disabled={form.responsaveis.length >= LIMITE_RESPONSAVEIS}
                  onChange={(event) => {
                    const nome = event.target.value
                    if (!nome || form.responsaveis.includes(nome) || form.responsaveis.length >= LIMITE_RESPONSAVEIS) return
                    setForm({ ...form, responsaveis: [...form.responsaveis, nome] })
                  }}
                  className="w-full rounded-md border bg-background px-4 py-2 text-sm"
                >
                  <option value="">Adicionar responsável...</option>
                  {pessoas
                    .filter((pessoa) => !form.responsaveis.includes(pessoa.nome))
                    .map((pessoa) => (
                      <option key={pessoa.id} value={pessoa.nome}>{pessoa.nome}</option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">Pelo menos um responsável, no máximo 5.</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Status</label>
                <select
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value as Status })}
                  className="w-full rounded-md border bg-background px-4 py-2 text-sm"
                >
                  <option value="pendente">Pendente</option>
                  <option value="andamento">Em andamento</option>
                  <option value="concluida">Concluída</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={fecharModal}
                className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void salvar()}
                disabled={!form.titulo.trim() || form.responsaveis.length === 0}
                className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
