import { useEffect, useMemo, useState } from 'react'
import { HiChevronDown, HiChevronUp, HiPencil } from 'react-icons/hi'
import { FiltrosColapsaveis } from '@/components/FiltrosColapsaveis'
import { CabecalhoModulo, IconeChamado } from '@/components/icones/IconesErp'
import { api, type ChamadoDetalhe, type ChamadoResumo } from '@/services/api'

const STATUS = {
  ABERTO: 'Aberto',
  EM_ATENDIMENTO: 'Em atendimento',
  RESOLVIDO: 'Resolvido',
} as const

function numero(valor: number) {
  return String(valor).padStart(4, '0')
}

function dataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function diasAberto(iso: string) {
  const inicio = new Date(iso)
  const agora = new Date()
  const dias = Math.max(0, Math.floor((agora.getTime() - inicio.getTime()) / 86400000))
  return dias === 1 ? '1 dia' : `${dias} dias`
}

const PAGE_SIZE = 16
const SITUACOES_FOTO = ['Chegada', 'Vazamento', 'Entupimento', 'Sem água', "Caixa d'água", 'Aquecedor', 'Durante o reparo', 'Peça trocada', 'Depois do reparo', 'Conclusão'] as const
type Coluna = 'cliente' | 'descricao' | 'aberto' | 'status'
type Prioridade = 'baixa' | 'media' | 'alta'
type StatusTarefa = 'pendente' | 'andamento' | 'concluida'

const STATUS_TAREFA: Record<StatusTarefa, { label: string; classe: string }> = {
  pendente: { label: 'Pendente', classe: 'bg-gray-100 text-gray-800' },
  andamento: { label: 'Em andamento', classe: 'bg-amber-100 text-amber-800' },
  concluida: { label: 'Concluída', classe: 'bg-emerald-100 text-emerald-800' },
}

const PRIORIDADE: Record<Prioridade, { label: string; classe: string }> = {
  alta: { label: 'Alta', classe: 'bg-red-100 text-red-700' },
  media: { label: 'Média', classe: 'bg-amber-100 text-amber-800' },
  baixa: { label: 'Baixa', classe: 'bg-slate-100 text-slate-600' },
}

const STATUS_CLASSE: Record<ChamadoResumo['status'], string> = {
  ABERTO: 'bg-amber-100 text-amber-800',
  EM_ATENDIMENTO: 'bg-sky-100 text-sky-800',
  RESOLVIDO: 'bg-emerald-100 text-emerald-800',
}

function hojeCampo() {
  const data = new Date()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mes}-${dia}`
}

function cep(valor: string) {
  const digitos = valor.replace(/\D/g, '')
  return digitos.length === 8 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : valor
}

export function ChamadosModulo({
  onAbrirOrdem,
  filtroInicial,
  onFiltroConsumido,
}: {
  onAbrirOrdem?: (ordemId: number) => void
  filtroInicial?: 'novos' | null
  onFiltroConsumido?: () => void
}) {
  const [lista, setLista] = useState<ChamadoResumo[]>([])
  const [selecionado, setSelecionado] = useState<ChamadoDetalhe | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [somenteNovos, setSomenteNovos] = useState(filtroInicial === 'novos')
  const [gerandoId, setGerandoId] = useState<number | null>(null)
  const [nota, setNota] = useState('')
  const [salvandoNota, setSalvandoNota] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [busca, setBusca] = useState('')
  const [tarefaAberta, setTarefaAberta] = useState(false)
  const [tituloTarefa, setTituloTarefa] = useState('')
  const [descricaoTarefa, setDescricaoTarefa] = useState('')
  const [responsaveisTarefa, setResponsaveisTarefa] = useState<string[]>([])
  const [pessoa, setPessoa] = useState('')
  const [prazoTarefa, setPrazoTarefa] = useState(hojeCampo())
  const [prioridadeTarefa, setPrioridadeTarefa] = useState<Prioridade>('media')
  const [statusTarefa, setStatusTarefa] = useState<StatusTarefa>('pendente')
  const [salvandoTarefa, setSalvandoTarefa] = useState(false)
  const [funcionarios, setFuncionarios] = useState<{ id: number; nome: string }[]>([])
  const [situacaoFoto, setSituacaoFoto] = useState<(typeof SITUACOES_FOTO)[number]>('Chegada')
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [garantias, setGarantias] = useState<Array<{ id: number; numero: number; servicos: string; garantiaAte: string | null }>>([])
  const [anonimizando, setAnonimizando] = useState(false)
  const [pagina, setPagina] = useState(0)
  const [ordenacao, setOrdenacao] = useState<{ coluna: Coluna; direcao: 'asc' | 'desc' }>({ coluna: 'aberto', direcao: 'desc' })
  const [filtroOrigem, setFiltroOrigem] = useState('todas')

  const rotuloOrigem: Record<string, string> = {
    site: 'Site',
    whatsapp: 'WhatsApp',
    telefone: 'Telefone',
    indicacao: 'Indicação',
    outro: 'Outro',
  }

  async function carregarLista(origem = filtroOrigem) {
    setCarregando(true)
    const resposta = await api.listarChamados({ origem })
    setCarregando(false)
    if (resposta.error || !resposta.data) {
      setErro(resposta.error || 'Não foi possível carregar os chamados.')
      return
    }
    setErro('')
    setLista(resposta.data)
  }

  useEffect(() => {
    void carregarLista()
    void api.getFuncionariosOrdem().then((resposta) => {
      const pessoas = Array.isArray(resposta.data) ? resposta.data : []
      setFuncionarios(pessoas.filter((item) => item && typeof item.nome === 'string').map((item) => ({ id: Number(item.id), nome: String(item.nome) })))
    })
  }, [])

  useEffect(() => {
    if (filtroInicial !== 'novos') return
    setSomenteNovos(true)
    onFiltroConsumido?.()
  }, [filtroInicial, onFiltroConsumido])

  useEffect(() => {
    if (!selecionado) {
      setGarantias([])
      return
    }
    let ativo = true
    void api.garantiaVigente({ chamadoId: selecionado.id }).then((resposta) => {
      if (ativo) setGarantias(Array.isArray(resposta.data) ? resposta.data : [])
    })
    return () => {
      ativo = false
    }
  }, [selecionado?.id])

  async function abrir(id: number) {
    setErro('')
    const resposta = await api.detalheChamado(id)
    if (resposta.error || !resposta.data) {
      setErro(resposta.error || 'Não foi possível abrir o chamado.')
      return
    }
    setSelecionado(resposta.data)
    setNota('')
  }

  async function mudarStatus(status: ChamadoDetalhe['status']) {
    if (!selecionado) return
    const resposta = await api.atualizarChamado(selecionado.id, status)
    if (resposta.error || !resposta.data) {
      setErro(resposta.error || 'Não foi possível atualizar o status.')
      return
    }
    setSelecionado(resposta.data)
    void carregarLista()
  }

  async function anonimizar() {
    if (!selecionado) return
    const confirma = window.confirm(
      'O nome, o telefone e o endereço deste chamado serão substituídos por "Dado removido". Se houver ordem vinculada, o nome, telefone e endereço do cliente (e a cópia desses dados na ordem) também serão anonimizados. Números da OS, títulos financeiros, valores, margens, peças e notas fiscais de estoque permanecem. Deseja continuar?',
    )
    if (!confirma) return
    setAnonimizando(true)
    setErro('')
    const resposta = await api.anonimizarChamado(selecionado.id)
    setAnonimizando(false)
    if (resposta.error || !resposta.data) {
      setErro(resposta.error || 'Não foi possível anonimizar os dados.')
      return
    }
    setSelecionado(resposta.data)
    setLista((itens) => itens.map((item) => (
      item.id === resposta.data!.id ? { ...item, nome: resposta.data!.nome, telefone: resposta.data!.telefone } : item
    )))
  }

  async function gerarOrdem(id?: number) {
    const chamadoId = id ?? selecionado?.id
    if (!chamadoId) return
    setGerandoId(chamadoId)
    setErro('')
    const resposta = await api.gerarOrdemChamado(chamadoId)
    setGerandoId(null)
    if (resposta.error || !resposta.data) {
      setErro(resposta.error || 'Não foi possível gerar a ordem.')
      return
    }
    if (selecionado?.id === chamadoId) setSelecionado(resposta.data)
    setLista((itens) => itens.map((item) => (
      item.id === chamadoId
        ? { ...item, status: resposta.data!.status, ordemId: resposta.data!.ordem?.id ?? item.ordemId, ordemNumero: resposta.data!.ordem?.numero ?? item.ordemNumero }
        : item
    )))
  }

  async function adicionarNota() {
    if (!selecionado || nota.trim().length < 2) return
    setSalvandoNota(true)
    const resposta = await api.notaChamado(selecionado.id, nota.trim())
    setSalvandoNota(false)
    if (resposta.error || !resposta.data) {
      setErro(resposta.error || 'Não foi possível gravar a nota.')
      return
    }
    setSelecionado(resposta.data)
    setNota('')
    void carregarLista()
  }

  async function salvarTarefa() {
    if (!selecionado || tituloTarefa.trim().length < 2 || responsaveisTarefa.length === 0) return
    setSalvandoTarefa(true)
    const resposta = await api.tarefaChamado(selecionado.id, {
      titulo: tituloTarefa.trim(),
      descricao: descricaoTarefa.trim(),
      responsaveis: responsaveisTarefa,
      prazo: prazoTarefa,
      prioridade: prioridadeTarefa,
      status: statusTarefa,
    })
    setSalvandoTarefa(false)
    if (resposta.error || !resposta.data) {
      setErro(resposta.error || 'Não foi possível criar a tarefa.')
      return
    }
    setSelecionado(resposta.data)
    setTituloTarefa('')
    setDescricaoTarefa('')
    setResponsaveisTarefa([])
    setPrioridadeTarefa('media')
    setStatusTarefa('pendente')
    setTarefaAberta(false)
  }

  async function mudarStatusTarefa(tarefaId: number, status: StatusTarefa) {
    if (!selecionado) return
    const anterior = selecionado.tarefas.find((tarefa) => tarefa.id === tarefaId)?.status
    setSelecionado({
      ...selecionado,
      tarefas: selecionado.tarefas.map((tarefa) => (tarefa.id === tarefaId ? { ...tarefa, status } : tarefa)),
    })
    const resposta = await api.updateTarefa(tarefaId, { status })
    if (resposta.error) {
      setErro(resposta.error)
      setSelecionado({
        ...selecionado,
        tarefas: selecionado.tarefas.map((tarefa) => (tarefa.id === tarefaId ? { ...tarefa, status: anterior || tarefa.status } : tarefa)),
      })
    }
  }

  async function anexarFoto(arquivo: File) {
    if (!selecionado) return
    setEnviandoFoto(true)
    setErro('')
    const url = await fotoReduzida(arquivo)
    if (!url.startsWith('data:image/')) {
      setEnviandoFoto(false)
      setErro('Não foi possível ler a foto.')
      return
    }
    const resposta = await api.fotoChamado(selecionado.id, { situacao: situacaoFoto, url })
    setEnviandoFoto(false)
    if (resposta.error || !resposta.data) {
      setErro(resposta.error || 'Não foi possível anexar a foto.')
      return
    }
    setSelecionado(resposta.data)
  }

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    let itens = termo
      ? lista.filter((chamado) => `${chamado.numero} ${chamado.nome} ${chamado.telefone} ${chamado.tipo} ${chamado.descricao}`.toLowerCase().includes(termo))
      : [...lista]
    if (somenteNovos) {
      itens = itens.filter(
        (chamado) =>
          !chamado.ordemId &&
          (chamado.status === 'ABERTO' || chamado.status === 'EM_ATENDIMENTO'),
      )
    }
    const peso: Record<ChamadoResumo['status'], number> = { ABERTO: 0, EM_ATENDIMENTO: 1, RESOLVIDO: 2 }
    itens.sort((a, b) => {
      let resultado = 0
      if (ordenacao.coluna === 'cliente') resultado = a.nome.localeCompare(b.nome, 'pt-BR')
      else if (ordenacao.coluna === 'descricao') resultado = a.descricao.localeCompare(b.descricao, 'pt-BR')
      else if (ordenacao.coluna === 'status') resultado = peso[a.status] - peso[b.status]
      else resultado = a.createdAt.localeCompare(b.createdAt)
      return ordenacao.direcao === 'asc' ? resultado : -resultado
    })
    return itens
  }, [lista, busca, ordenacao, somenteNovos])

  async function copiarLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/chamado`)
    setLinkCopiado(true)
    window.setTimeout(() => setLinkCopiado(false), 2000)
  }

  if (selecionado) {
    const endereco = `${selecionado.logradouro}, ${selecionado.numeroEndereco}${selecionado.bairro ? ` - ${selecionado.bairro}` : ''}`
    const eventos = [
      ...selecionado.notas.map((item) => ({
        id: `nota-${item.id}`,
        quando: item.createdAt,
        titulo: item.texto.startsWith('Chamado aberto') ? 'Chamado aberto' : item.texto.startsWith('Tarefa vinculada') ? 'Tarefa vinculada' : item.texto.startsWith('Foto anexada') ? 'Foto anexada' : 'Nota',
        etiqueta: item.texto.startsWith('Chamado aberto') ? (selecionado.whatsapp === 'celular' ? 'WhatsApp' : 'Telefone') : undefined,
        vinculo: item.texto.startsWith('Tarefa vinculada'),
        autor: item.autor,
        texto: item.texto.startsWith('Chamado aberto') ? selecionado.descricao : item.texto,
      })),
    ].sort((a, b) => a.quando.localeCompare(b.quando))
    return (
      <div className="h-full space-y-4 overflow-y-auto p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={() => { setSelecionado(null); void carregarLista() }} className="w-fit text-sm text-muted-foreground hover:text-foreground">
            ← Voltar
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Status do chamado"
              value={selecionado.status}
              onChange={(evento) => void mudarStatus(evento.target.value as ChamadoDetalhe['status'])}
              className="rounded-full border bg-card px-3 py-2 text-sm"
            >
              {Object.entries(STATUS).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>{rotulo}</option>
              ))}
            </select>
            <button type="button" onClick={() => void anonimizar()} disabled={anonimizando} className="rounded-full border px-4 py-2 text-sm disabled:opacity-60">
              {anonimizando ? 'Anonimizando...' : 'Anonimizar dados'}
            </button>
            {selecionado.linkWhatsapp ? (
              <a
                href={selecionado.linkWhatsapp}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
              >
                Responder no WhatsApp
              </a>
            ) : null}
            {selecionado.ordem ? (
              <button type="button" onClick={() => onAbrirOrdem?.(selecionado.ordem!.id)} className="rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary underline">
                OS {numero(selecionado.ordem.numero)}
              </button>
            ) : (
              <button type="button" onClick={() => void gerarOrdem()} disabled={gerandoId === selecionado.id} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                {gerandoId === selecionado.id ? 'Gerando...' : 'Gerar ordem OS'}
              </button>
            )}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">Chamados <span className="text-foreground">/ Chamado #{selecionado.numero}</span></p>

        <section className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Origem do chamado</p>
          <p className="mt-1 text-sm">{rotuloOrigem[selecionado.origem || 'site'] || 'Site'}</p>
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <div className="flex gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
              {selecionado.nome.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{selecionado.nome} · {selecionado.telefone}</p>
              <h2 className="mt-1 text-lg font-semibold leading-snug">{selecionado.tipo}. {selecionado.descricao}</h2>
              <p className="mt-2 text-sm text-muted-foreground">#{selecionado.numero}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Cartao rotulo="Dias em aberto" valor={diasAberto(selecionado.createdAt)} />
          <Cartao rotulo="Aberto em" valor={dataHora(selecionado.createdAt)} />
          <Cartao rotulo="Origem" valor={rotuloOrigem[selecionado.origem || 'site'] || 'Site'} />
          <Cartao rotulo="Contato" valor={selecionado.telefone === 'Dado removido' ? 'Dado removido' : selecionado.whatsapp === 'celular' ? 'Celular / WhatsApp' : 'Linha fixa'} />
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <h3 className="text-sm font-semibold">Dados do atendimento</h3>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Dado termo="Cliente" valor={selecionado.nome} />
            <Dado termo="Telefone" valor={selecionado.telefone} />
            <Dado termo="Endereço" valor={`${endereco}, ${selecionado.cidade} - ${selecionado.uf}`} />
            <Dado termo="CEP" valor={cep(selecionado.cep)} />
          </dl>
          {garantias.length > 0 && (
            <div id="aviso-garantia" role="status" className="mt-4 rounded-md border-2 border-amber-400 bg-amber-50 px-3 py-3 text-sm text-amber-950">
              <p className="font-semibold">Garantia em vigor neste endereço</p>
              <ul className="mt-2 space-y-1">
                {garantias.map((item) => (
                  <li key={item.id}>
                    OS {String(item.numero).padStart(4, '0')} — {item.servicos || 'Serviço não descrito'} — garantia até {item.garantiaAte ? item.garantiaAte.split('-').reverse().join('/') : '-'}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs">Aviso apenas. O chamado continua disponível para atendimento.</p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold">Registro</h3>
              <p className="mt-1 text-sm text-muted-foreground">A nota fica no histórico. A tarefa entra na lista de tarefas, vinculada a este chamado.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setTarefaAberta(false)} className="rounded-lg border bg-background px-3 py-2 text-sm">Adicionar nota</button>
              <button type="button" onClick={() => setTarefaAberta(true)} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Adicionar tarefa</button>
            </div>
          </div>
          {!tarefaAberta ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={nota}
                onChange={(evento) => setNota(evento.target.value)}
                placeholder="Escreva uma nota"
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              />
              <button type="button" onClick={() => void adicionarNota()} disabled={salvandoNota || nota.trim().length < 2} className="shrink-0 rounded-xl border px-4 py-2 text-sm disabled:opacity-50">
                {salvandoNota ? 'Salvando...' : 'Salvar nota'}
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="titulo-tarefa">Título</label>
                <input id="titulo-tarefa" value={tituloTarefa} onChange={(evento) => setTituloTarefa(evento.target.value)} className="w-full rounded-md border bg-background px-4 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="descricao-tarefa">Descrição</label>
                <textarea id="descricao-tarefa" value={descricaoTarefa} onChange={(evento) => setDescricaoTarefa(evento.target.value)} rows={3} placeholder="O que foi feito e qual o próximo passo?" className="w-full rounded-md border bg-background px-4 py-2 text-sm" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-medium">
                  Prazo
                  <input type="date" value={prazoTarefa} onChange={(evento) => setPrazoTarefa(evento.target.value)} className="mt-2 w-full rounded-md border bg-background px-4 py-2 text-sm font-normal" />
                </label>
                <label className="text-sm font-medium">
                  Prioridade
                  <select value={prioridadeTarefa} onChange={(evento) => setPrioridadeTarefa(evento.target.value as Prioridade)} className="mt-2 w-full rounded-md border bg-background px-4 py-2 text-sm font-normal">
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                  </select>
                </label>
                <label className="text-sm font-medium">
                  Status
                  <select value={statusTarefa} onChange={(evento) => setStatusTarefa(evento.target.value as StatusTarefa)} className="mt-2 w-full rounded-md border bg-background px-4 py-2 text-sm font-normal">
                    <option value="pendente">Pendente</option>
                    <option value="andamento">Em andamento</option>
                    <option value="concluida">Concluída</option>
                  </select>
                </label>
              </div>
              <div>
                <p className="text-sm font-medium">Responsáveis</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {responsaveisTarefa.map((nome) => (
                    <button key={nome} type="button" onClick={() => setResponsaveisTarefa((lista) => lista.filter((item) => item !== nome))} className="rounded-full bg-muted px-3 py-1 text-sm">
                      {nome} ×
                    </button>
                  ))}
                </div>
                <select
                  value={pessoa}
                  onChange={(evento) => {
                    const nome = evento.target.value
                    setPessoa('')
                    if (!nome || responsaveisTarefa.includes(nome) || responsaveisTarefa.length >= 5) return
                    setResponsaveisTarefa((lista) => [...lista, nome])
                  }}
                  className="mt-2 w-full rounded-md border bg-background px-4 py-2 text-sm"
                >
                  <option value="">Adicionar responsável...</option>
                  {funcionarios.filter((item) => !responsaveisTarefa.includes(item.nome)).map((item) => (
                    <option key={item.id} value={item.nome}>{item.nome}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setTarefaAberta(false)} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">Cancelar</button>
                <button type="button" onClick={() => void salvarTarefa()} disabled={salvandoTarefa || tituloTarefa.trim().length < 2 || responsaveisTarefa.length === 0} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
                  {salvandoTarefa ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-lg border bg-background">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Tarefas vinculadas</h3>
            <p className="mt-1 text-sm text-muted-foreground">Chamado #{selecionado.numero}</p>
          </div>
          <div className="overflow-auto">
            <table className="w-full border-collapse">
              <thead className="bg-muted">
                <tr>
                  <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">Título</th>
                  <th className="hidden border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground lg:table-cell">Descrição</th>
                  <th className="hidden border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground lg:table-cell">Responsáveis</th>
                  <th className="hidden border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground sm:table-cell">Prazo</th>
                  <th className="hidden border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground sm:table-cell">Prioridade</th>
                  <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {selecionado.tarefas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma tarefa vinculada a este chamado.</td>
                  </tr>
                ) : selecionado.tarefas.map((tarefa) => {
                  const prioridade = (tarefa.prioridade || 'media') as Prioridade
                  const status = (tarefa.status || 'pendente') as StatusTarefa
                  return (
                    <tr key={tarefa.id} className="border-b hover:bg-accent/50">
                      <td className="px-4 py-2 text-sm">{tarefa.titulo}</td>
                      <td className="hidden max-w-xs truncate px-4 py-2 text-sm text-muted-foreground lg:table-cell">{tarefa.descricao || '-'}</td>
                      <td className="hidden px-4 py-2 text-sm lg:table-cell">{tarefa.responsaveis.length ? tarefa.responsaveis.join(', ') : '-'}</td>
                      <td className="hidden whitespace-nowrap px-4 py-2 text-sm sm:table-cell">{tarefa.prazo ? tarefa.prazo.split('-').reverse().join('/') : '-'}</td>
                      <td className="hidden px-4 py-2 sm:table-cell">
                        <span className={`rounded px-2 py-1 text-xs font-medium ${PRIORIDADE[prioridade].classe}`}>{PRIORIDADE[prioridade].label}</span>
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={status}
                          onChange={(evento) => void mudarStatusTarefa(tarefa.id, evento.target.value as StatusTarefa)}
                          className={`max-w-[7.5rem] rounded border-0 px-2 py-1 text-xs font-medium ${STATUS_TAREFA[status].classe}`}
                        >
                          <option value="pendente">Pendente</option>
                          <option value="andamento">Em andamento</option>
                          <option value="concluida">Concluída</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border bg-background p-4">
          <h3 className="text-sm font-semibold">Fotos</h3>
          <p className="mt-1 text-sm text-muted-foreground">Tire a foto da situação encontrada. Pode anexar em qualquer etapa do chamado.</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="text-sm font-medium">
              Situação
              <select value={situacaoFoto} onChange={(evento) => setSituacaoFoto(evento.target.value as (typeof SITUACOES_FOTO)[number])} className="mt-2 block w-full rounded-md border bg-background px-4 py-2 text-sm font-normal sm:w-56">
                {SITUACOES_FOTO.map((situacao) => <option key={situacao} value={situacao}>{situacao}</option>)}
              </select>
            </label>
            <label className="inline-flex cursor-pointer items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              {enviandoFoto ? 'Enviando...' : 'Tirar foto'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                disabled={enviandoFoto}
                className="sr-only"
                onChange={(evento) => {
                  const arquivo = evento.target.files?.[0]
                  evento.target.value = ''
                  if (arquivo) void anexarFoto(arquivo)
                }}
              />
            </label>
          </div>
          {(selecionado.fotos || []).length > 0 && (
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(selecionado.fotos || []).map((foto) => (
                <li key={foto.id} className="overflow-hidden rounded-md border">
                  <img src={foto.url} alt={foto.situacao} className="h-28 w-full object-cover" />
                  <p className="px-2 py-1 text-xs">{foto.situacao}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <h3 className="text-sm font-semibold">Linha do tempo</h3>
          <p className="mt-1 text-sm text-muted-foreground">{eventos.length} {eventos.length === 1 ? 'evento' : 'eventos'}</p>
          <ol className="relative mt-4 ml-2 border-l border-slate-200">
            {eventos.map((evento) => (
              <li key={evento.id} className="relative pb-5 pl-6">
                <span className={`absolute -left-1.5 top-1.5 h-3 w-3 rounded-full ${evento.vinculo ? 'bg-violet-500' : 'bg-sky-500'}`} />
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{evento.titulo}</p>
                  {evento.etiqueta && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{evento.etiqueta}</span>}
                  {evento.vinculo && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">Vinculada</span>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{dataHora(evento.quando)}</p>
                <div className={`mt-2 rounded-xl border p-4 ${evento.vinculo ? 'border-violet-100 bg-violet-50/60' : 'bg-background'}`}>
                  <p className="text-sm font-medium">{evento.autor}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{evento.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {erro && <p className="text-sm text-destructive" role="alert">{erro}</p>}
      </div>
    )
  }

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const paginaAtual = Math.min(pagina, totalPaginas - 1)
  const visiveis = filtrados.slice(paginaAtual * PAGE_SIZE, paginaAtual * PAGE_SIZE + PAGE_SIZE)

  function ordenar(coluna: Coluna) {
    setOrdenacao((atual) => atual.coluna === coluna ? { coluna, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' } : { coluna, direcao: 'asc' })
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

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-3 sm:px-6 sm:py-4">
        <CabecalhoModulo
          icone={IconeChamado}
          titulo="Chamados"
          acoes={
            <button type="button" onClick={() => void copiarLink()} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
              {linkCopiado ? 'Link copiado' : 'Copiar link'}
            </button>
          }
        />
        <div className="mt-3">
          <FiltrosColapsaveis conteudoClassName="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <input
              value={busca}
              onChange={(evento) => {
                setBusca(evento.target.value)
                setPagina(0)
              }}
              placeholder="Buscar..."
              className="h-11 w-full rounded-md border bg-background px-3 text-sm sm:h-10 sm:w-56"
            />
            <select
              aria-label="Filtrar por origem"
              value={filtroOrigem}
              onChange={(evento) => {
                const valor = evento.target.value
                setFiltroOrigem(valor)
                setPagina(0)
                void carregarLista(valor)
              }}
              className="h-11 w-full rounded-md border bg-background px-3 text-sm sm:h-10 sm:w-auto"
            >
              <option value="todas">Todas as origens</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="site">Site</option>
              <option value="telefone">Telefone</option>
              <option value="indicacao">Indicação</option>
              <option value="outro">Outro</option>
            </select>
          </FiltrosColapsaveis>
        </div>
        {erro && <p className="mt-3 text-sm text-destructive" role="alert">{erro}</p>}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              <th className="w-10 border-b px-2 py-2 text-left text-xs font-medium text-muted-foreground">Editar</th>
              <Cabecalho coluna="cliente" label="Cliente" />
              <Cabecalho coluna="descricao" label="Descrição" className="hidden lg:table-cell" />
              <th className="hidden border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground lg:table-cell">Telefone</th>
              <Cabecalho coluna="aberto" label="Aberto em" className="hidden sm:table-cell" />
              <Cabecalho coluna="status" label="Status" />
              <th className="hidden border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground md:table-cell">Origem</th>
              <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">OS</th>
            </tr>
          </thead>
          <tbody className="bg-background">
            {carregando ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Carregando chamados...</td></tr>
            ) : visiveis.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <IconeChamado className="h-8 w-8 text-muted-foreground" />
                    Nenhum chamado encontrado
                  </div>
                </td>
              </tr>
            ) : visiveis.map((chamado) => (
              <tr key={chamado.id} className="border-b hover:bg-accent/50">
                <td className="px-2 py-2 sm:px-4">
                  <button type="button" onClick={() => void abrir(chamado.id)} title="Abrir chamado" aria-label="Abrir chamado">
                    <HiPencil className="h-4 w-4 text-primary" />
                  </button>
                </td>
                <td className="px-2 py-2 text-sm sm:px-4">
                  <div>{chamado.nome}</div>
                  <div className="text-xs text-muted-foreground sm:hidden">#{chamado.numero}</div>
                </td>
                <td className="hidden max-w-xs truncate px-4 py-2 text-sm text-muted-foreground lg:table-cell">{chamado.descricao || '-'}</td>
                <td className="hidden px-4 py-2 text-sm lg:table-cell">{chamado.telefone}</td>
                <td className="hidden whitespace-nowrap px-2 py-2 text-sm sm:table-cell sm:px-4">{dataHora(chamado.createdAt)}</td>
                <td className="px-4 py-2">
                  <select
                    value={chamado.status}
                    onChange={(evento) => {
                      const status = evento.target.value as ChamadoResumo['status']
                      const anterior = chamado.status
                      setLista((itens) => itens.map((item) => (item.id === chamado.id ? { ...item, status } : item)))
                      void api.atualizarChamado(chamado.id, status).then((resposta) => {
                        if (!resposta.error) return
                        setErro(resposta.error)
                        setLista((itens) => itens.map((item) => (item.id === chamado.id ? { ...item, status: anterior } : item)))
                      })
                    }}
                    className={`max-w-[8.5rem] rounded border-0 px-2 py-1 text-xs font-medium ${STATUS_CLASSE[chamado.status]}`}
                  >
                    {Object.entries(STATUS).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
                  </select>
                </td>
                <td className="hidden px-4 py-2 text-sm md:table-cell">{rotuloOrigem[chamado.origem || 'site'] || 'Site'}</td>
                <td className="px-4 py-2 text-sm">
                  {chamado.ordemId && chamado.ordemNumero ? (
                    <button type="button" onClick={() => onAbrirOrdem?.(chamado.ordemId!)} className="font-medium text-primary underline">
                      OS {numero(chamado.ordemNumero)}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={gerandoId === chamado.id}
                      onClick={() => void gerarOrdem(chamado.id)}
                      className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {gerandoId === chamado.id ? 'Gerando...' : 'Gerar OS'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t bg-background px-4 py-2">
        <div className="text-sm text-muted-foreground">
          {filtrados.length > 0
            ? `Página ${paginaAtual + 1} de ${totalPaginas} • Total: ${filtrados.length} chamado${filtrados.length === 1 ? '' : 's'}`
            : 'Nenhum chamado encontrado'}
        </div>
        {filtrados.length > PAGE_SIZE && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPagina((atual) => Math.max(0, atual - 1))} disabled={paginaAtual === 0} className="rounded-md border px-3 py-1 text-sm hover:bg-accent disabled:opacity-50">Anterior</button>
            <button type="button" onClick={() => setPagina((atual) => Math.min(totalPaginas - 1, atual + 1))} disabled={paginaAtual >= totalPaginas - 1} className="rounded-md border px-3 py-1 text-sm hover:bg-accent disabled:opacity-50">Próxima</button>
          </div>
        )}
      </div>
    </div>
  )
}

async function fotoReduzida(arquivo: File) {
  const bitmap = await createImageBitmap(arquivo)
  const limite = 1280
  const escala = Math.min(1, limite / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * escala))
  canvas.height = Math.max(1, Math.round(bitmap.height * escala))
  const contexto = canvas.getContext('2d')
  if (!contexto) return ''
  contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.72)
}

function Cartao({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="mt-2 text-sm font-semibold">{valor}</p>
    </div>
  )
}

function Dado({ termo, valor }: { termo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{termo}</dt>
      <dd className="mt-1 text-sm">{valor}</dd>
    </div>
  )
}
