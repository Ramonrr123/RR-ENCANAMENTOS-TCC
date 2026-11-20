import { useEffect, useMemo, useState } from 'react'
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi'

export type FeriadoTipo = 'nacional' | 'facultativo'

export type Feriado = {
  data: string
  nome: string
  tipo: FeriadoTipo
}

type StatusTarefa = 'pendente' | 'andamento' | 'concluida'
type PrioridadeTarefa = 'baixa' | 'media' | 'alta'

type TarefaAgenda = {
  id: string
  titulo: string
  descricao: string
  prazo: string
  prioridade: PrioridadeTarefa
  status: StatusTarefa
}

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const SEMANA_CURTA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const STATUS: Record<StatusTarefa, { label: string; classe: string }> = {
  pendente: { label: 'Pendente', classe: 'bg-slate-100 text-slate-700' },
  andamento: { label: 'Em andamento', classe: 'bg-amber-100 text-amber-800' },
  concluida: { label: 'Concluída', classe: 'bg-emerald-100 text-emerald-800' },
}

const PRIORIDADE: Record<PrioridadeTarefa, string> = {
  alta: 'bg-red-500',
  media: 'bg-amber-400',
  baixa: 'bg-slate-400',
}

function chave(data: Date) {
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mes}-${dia}`
}

function somarDias(data: Date, dias: number) {
  const proxima = new Date(data)
  proxima.setDate(proxima.getDate() + dias)
  return proxima
}

function dataDeChave(id: string) {
  const [ano, mes, dia] = id.split('-').map(Number)
  return new Date(ano, (mes || 1) - 1, dia || 1)
}

function diaPrazo(prazo: string) {
  const iso = String(prazo || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const br = String(prazo || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  return ''
}

function formatarDia(data: string) {
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

function dataPorExtenso(data: Date) {
  const semana = SEMANA[data.getDay()].toLowerCase()
  return `${semana}, ${data.getDate()} de ${MESES[data.getMonth()].toLowerCase()} de ${data.getFullYear()}`
}

/** Domingo de Páscoa no calendário gregoriano. */
function pascoa(ano: number) {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(ano, mes - 1, dia)
}

export function feriadosDoAno(ano: number): Feriado[] {
  const pascoaData = pascoa(ano)
  const lista: Feriado[] = [
    { data: `${ano}-01-01`, nome: 'Confraternização Universal', tipo: 'nacional' },
    { data: chave(somarDias(pascoaData, -48)), nome: 'Carnaval', tipo: 'facultativo' },
    { data: chave(somarDias(pascoaData, -47)), nome: 'Carnaval', tipo: 'facultativo' },
    { data: chave(somarDias(pascoaData, -2)), nome: 'Sexta-feira Santa', tipo: 'nacional' },
    { data: `${ano}-04-21`, nome: 'Tiradentes', tipo: 'nacional' },
    { data: `${ano}-05-01`, nome: 'Dia do Trabalho', tipo: 'nacional' },
    { data: chave(somarDias(pascoaData, 60)), nome: 'Corpus Christi', tipo: 'facultativo' },
    { data: `${ano}-09-07`, nome: 'Independência do Brasil', tipo: 'nacional' },
    { data: `${ano}-10-12`, nome: 'Nossa Senhora Aparecida', tipo: 'nacional' },
    { data: `${ano}-10-28`, nome: 'Dia do Servidor Público', tipo: 'facultativo' },
    { data: `${ano}-11-02`, nome: 'Finados', tipo: 'nacional' },
    { data: `${ano}-11-15`, nome: 'Proclamação da República', tipo: 'nacional' },
    { data: `${ano}-12-25`, nome: 'Natal', tipo: 'nacional' },
  ]
  if (ano >= 2024) {
    lista.push({ data: `${ano}-11-20`, nome: 'Consciência Negra', tipo: 'nacional' })
  }
  return lista.sort((a, b) => a.data.localeCompare(b.data))
}

function lerTarefas(): TarefaAgenda[] {
  try {
    const raw = localStorage.getItem('erp_tarefas')
    const lista = raw ? JSON.parse(raw) : []
    if (!Array.isArray(lista)) return []
    return lista
      .map((tarefa) => ({
        id: String(tarefa?.id || ''),
        titulo: String(tarefa?.titulo || '').trim(),
        descricao: String(tarefa?.descricao || '').trim(),
        prazo: diaPrazo(tarefa?.prazo),
        prioridade: (tarefa?.prioridade || 'media') as PrioridadeTarefa,
        status: (tarefa?.status || 'pendente') as StatusTarefa,
      }))
      .filter((tarefa) => tarefa.id && tarefa.titulo && tarefa.prazo)
  } catch {
    return []
  }
}

export function CalendarioAnual() {
  const hojeData = new Date()
  const hoje = chave(hojeData)
  const [mesVisivel, setMesVisivel] = useState(() => new Date(hojeData.getFullYear(), hojeData.getMonth(), 1))
  const [selecionado, setSelecionado] = useState(hoje)
  const [tarefas, setTarefas] = useState<TarefaAgenda[]>(() => lerTarefas())

  useEffect(() => {
    const atualizar = () => setTarefas(lerTarefas())
    window.addEventListener('focus', atualizar)
    window.addEventListener('storage', atualizar)
    return () => {
      window.removeEventListener('focus', atualizar)
      window.removeEventListener('storage', atualizar)
    }
  }, [])

  const ano = mesVisivel.getFullYear()
  const mes = mesVisivel.getMonth()
  const feriados = useMemo(() => {
    const mapa = new Map<string, Feriado>()
    feriadosDoAno(ano).forEach((feriado) => mapa.set(feriado.data, feriado))
    if (mes === 0) feriadosDoAno(ano - 1).forEach((feriado) => mapa.set(feriado.data, feriado))
    if (mes === 11) feriadosDoAno(ano + 1).forEach((feriado) => mapa.set(feriado.data, feriado))
    return mapa
  }, [ano, mes])

  const porDia = useMemo(() => {
    const mapa = new Map<string, TarefaAgenda[]>()
    tarefas.forEach((tarefa) => {
      const lista = mapa.get(tarefa.prazo) || []
      lista.push(tarefa)
      mapa.set(tarefa.prazo, lista)
    })
    mapa.forEach((lista) => lista.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR')))
    return mapa
  }, [tarefas])

  const primeiro = new Date(ano, mes, 1)
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const inicio = primeiro.getDay()
  const celulas: Array<number | null> = [...Array(inicio).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => i + 1)]
  while (celulas.length % 7 !== 0) celulas.push(null)
  const semanas = celulas.length / 7

  const diaSelecionado = dataDeChave(selecionado)
  const feriadoSelecionado = feriados.get(selecionado)
  const tarefasDoDia = porDia.get(selecionado) || []
  const atrasadas = useMemo(
    () =>
      tarefas
        .filter((tarefa) => tarefa.status !== 'concluida' && tarefa.prazo < hoje)
        .sort((a, b) => a.prazo.localeCompare(b.prazo) || a.titulo.localeCompare(b.titulo, 'pt-BR')),
    [tarefas, hoje],
  )

  function irParaHoje() {
    const agora = new Date()
    setMesVisivel(new Date(agora.getFullYear(), agora.getMonth(), 1))
    setSelecionado(chave(agora))
  }

  function abrirDia(data: string) {
    const dia = dataDeChave(data)
    setMesVisivel(new Date(dia.getFullYear(), dia.getMonth(), 1))
    setSelecionado(data)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hoje</p>
          <h2 className="text-xl font-semibold capitalize">{dataPorExtenso(hojeData)}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMesVisivel(new Date(ano, mes - 1, 1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-card hover:bg-accent"
            aria-label="Mês anterior"
          >
            <HiChevronLeft className="h-5 w-5" />
          </button>
          <h3 className="min-w-44 text-center text-lg font-semibold">
            {MESES[mes]} {ano}
          </h3>
          <button
            type="button"
            onClick={() => setMesVisivel(new Date(ano, mes + 1, 1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-card hover:bg-accent"
            aria-label="Próximo mês"
          >
            <HiChevronRight className="h-5 w-5" />
          </button>
          <button type="button" onClick={irParaHoje} className="rounded-md border bg-card px-3 py-2 text-sm font-medium hover:bg-accent">
            Hoje
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card">
          <div className="grid grid-cols-7 border-b text-center text-xs font-medium text-muted-foreground">
            {SEMANA_CURTA.map((dia, indice) => (
              <span key={dia} className={`px-1 py-2 ${indice === 0 ? 'text-red-500' : ''}`}>
                {dia}
              </span>
            ))}
          </div>
          <div className="grid min-h-0 flex-1" style={{ gridTemplateRows: `repeat(${semanas}, minmax(0, 1fr))` }}>
            {Array.from({ length: semanas }, (_, semana) => (
              <div key={semana} className="grid min-h-0 grid-cols-7">
                {celulas.slice(semana * 7, semana * 7 + 7).map((dia, indice) => {
                  if (!dia) return <div key={`${semana}-vazio-${indice}`} className="border-b border-r bg-muted/30" />
                  const id = chave(new Date(ano, mes, dia))
                  const feriado = feriados.get(id)
                  const doDia = porDia.get(id) || []
                  const ehHoje = id === hoje
                  const ehSelecionado = id === selecionado
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => abrirDia(id)}
                      className={`flex min-h-0 flex-col gap-1 overflow-hidden border-b border-r p-1.5 text-left hover:bg-accent/60 ${ehSelecionado ? 'bg-accent' : ''}`}
                    >
                      <span className="flex items-center justify-between gap-1">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${ehHoje ? 'bg-primary font-semibold text-primary-foreground' : new Date(ano, mes, dia).getDay() === 0 ? 'text-red-500' : ''}`}
                        >
                          {dia}
                        </span>
                        {doDia.length > 0 && (
                          <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary">{doDia.length}</span>
                        )}
                      </span>
                      {feriado && <span className="truncate text-[10px] font-medium text-red-600">{feriado.nome}</span>}
                      <span className="flex min-h-0 flex-col gap-0.5">
                        {doDia.slice(0, feriado ? 2 : 3).map((tarefa) => (
                          <span key={tarefa.id} className="flex items-center gap-1 truncate rounded bg-background px-1 py-0.5 text-[10px]">
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORIDADE[tarefa.prioridade] || PRIORIDADE.media}`} />
                            <span className={tarefa.status === 'concluida' ? 'truncate line-through opacity-70' : 'truncate'}>{tarefa.titulo}</span>
                          </span>
                        ))}
                        {doDia.length > (feriado ? 2 : 3) && (
                          <span className="text-[10px] text-muted-foreground">+{doDia.length - (feriado ? 2 : 3)}</span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-4">
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {selecionado === hoje ? 'Dia de hoje' : SEMANA[diaSelecionado.getDay()]}
            </p>
            <h3 className="text-lg font-semibold">{formatarDia(selecionado)}</h3>
            {feriadoSelecionado && (
              <p className="mt-1 text-sm text-red-600">
                {feriadoSelecionado.nome}
                <span className="text-muted-foreground">
                  {' '}
                  · {feriadoSelecionado.tipo === 'nacional' ? 'feriado nacional' : 'ponto facultativo'}
                </span>
              </p>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            {tarefasDoDia.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">Nenhuma tarefa agendada para este dia.</p>
            ) : (
              <ul className="space-y-2">
                {tarefasDoDia.map((tarefa) => (
                  <li key={tarefa.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${tarefa.status === 'concluida' ? 'line-through opacity-70' : ''}`}>{tarefa.titulo}</p>
                      <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${PRIORIDADE[tarefa.prioridade] || PRIORIDADE.media}`} />
                    </div>
                    {tarefa.descricao && <p className="mt-1 text-xs text-muted-foreground">{tarefa.descricao}</p>}
                    <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS[tarefa.status]?.classe || STATUS.pendente.classe}`}>
                      {STATUS[tarefa.status]?.label || 'Pendente'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          </section>

          <section className="flex max-h-64 min-h-36 flex-col overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold">Tarefas atrasadas</h3>
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">{atrasadas.length}</span>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3">
              {atrasadas.length === 0 ? (
                <p className="px-1 py-4 text-center text-sm text-muted-foreground">Nenhuma tarefa atrasada.</p>
              ) : (
                <ul className="space-y-2">
                  {atrasadas.map((tarefa) => (
                    <li key={tarefa.id}>
                      <button
                        type="button"
                        onClick={() => abrirDia(tarefa.prazo)}
                        className="w-full rounded-lg border px-3 py-2 text-left hover:bg-accent"
                      >
                        <p className="text-sm font-medium">{tarefa.titulo}</p>
                        <p className="mt-0.5 text-xs text-red-600">Prazo {formatarDia(tarefa.prazo)}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
