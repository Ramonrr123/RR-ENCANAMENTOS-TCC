import { useEffect, useMemo, useState } from 'react'
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi'
import { CabecalhoModal, IconeCalendario } from '@/components/icones/IconesErp'
import { feriadosDoAno } from '@/components/CalendarioAnual'
import { api } from '@/services/api'

type Item = {
  id: number
  ordemId: number
  numero: number
  cliente: string
  funcionarioId: number
  funcionario: string
  inicio: string
  fim: string
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const CORES = [
  'bg-emerald-100 text-emerald-800',
  'bg-sky-100 text-sky-800',
  'bg-rose-100 text-rose-800',
  'bg-amber-100 text-amber-900',
  'bg-violet-100 text-violet-800',
]
const HORA_INICIO = 7
const HORA_FIM = 19
const ALTURA_HORA = 52

function chave(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

function grade(ano: number, mes: number) {
  const primeiro = new Date(ano, mes, 1)
  const offset = (primeiro.getDay() + 6) % 7
  const inicio = new Date(ano, mes, 1 - offset)
  return Array.from({ length: 42 }, (_, indice) => {
    const data = new Date(inicio)
    data.setDate(inicio.getDate() + indice)
    return data
  })
}

function inicioSemana(data: Date) {
  const base = new Date(data.getFullYear(), data.getMonth(), data.getDate())
  const offset = (base.getDay() + 6) % 7
  base.setDate(base.getDate() - offset)
  return base
}

function diasDaSemana(segunda: Date) {
  return Array.from({ length: 7 }, (_, indice) => {
    const dia = new Date(segunda)
    dia.setDate(segunda.getDate() + indice)
    return dia
  })
}

function hora(valor: string) {
  return new Date(valor).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function minutosDoDia(valor: string) {
  const data = new Date(valor)
  return data.getHours() * 60 + data.getMinutes()
}

function tituloDia(id: string) {
  const [ano, mes, dia] = id.split('-').map(Number)
  return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
}

function rotuloSemana(segunda: Date) {
  const domingo = new Date(segunda)
  domingo.setDate(segunda.getDate() + 6)
  const mesmoMes = segunda.getMonth() === domingo.getMonth()
  const inicio = `${segunda.getDate()}${mesmoMes ? '' : ` ${MESES[segunda.getMonth()].slice(0, 3)}`}`
  const fim = `${domingo.getDate()} ${MESES[domingo.getMonth()]} ${domingo.getFullYear()}`
  return `${inicio} – ${fim}`
}

export function AgendaModulo({ isAdmin, showToast }: { isAdmin: boolean; showToast: (message: string, type?: 'success' | 'error') => void }) {
  const hoje = new Date()
  const [visao, setVisao] = useState<'mes' | 'semana'>('mes')
  const [mesVisivel, setMesVisivel] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const [semanaVisivel, setSemanaVisivel] = useState(() => inicioSemana(hoje))
  const [selecionado, setSelecionado] = useState(chave(hoje))
  const [itens, setItens] = useState<Item[]>([])
  const [ordens, setOrdens] = useState<Array<{ id: number; numero: number; cliente: string }>>([])
  const [usuarios, setUsuarios] = useState<Array<{ id: number; nome: string }>>([])
  const [form, setForm] = useState({ ordemId: '', funcionarioId: '', inicio: '', fim: '' })
  const [arrastando, setArrastando] = useState<number | null>(null)
  const [modalAberto, setModalAberto] = useState(false)

  const ano = mesVisivel.getFullYear()
  const mes = mesVisivel.getMonth()
  const feriados = useMemo(() => {
    const mapa = new Map<string, string>()
    const anos = mes === 0 ? [ano - 1, ano] : mes === 11 ? [ano, ano + 1] : [ano]
    const semanaAnos = [semanaVisivel.getFullYear(), new Date(semanaVisivel.getFullYear(), semanaVisivel.getMonth(), semanaVisivel.getDate() + 6).getFullYear()]
    ;[...new Set([...anos, ...semanaAnos])].forEach((atual) => feriadosDoAno(atual).forEach((feriado) => mapa.set(feriado.data, feriado.nome)))
    return mapa
  }, [ano, mes, semanaVisivel])

  const celulas = useMemo(() => grade(ano, mes), [ano, mes])
  const diasSemana = useMemo(() => diasDaSemana(semanaVisivel), [semanaVisivel])
  const horasGrade = useMemo(() => Array.from({ length: HORA_FIM - HORA_INICIO }, (_, indice) => HORA_INICIO + indice), [])

  async function carregar() {
    let inicio: Date
    let fim: Date
    if (visao === 'semana') {
      const ultimo = diasDaSemana(semanaVisivel)[6]
      inicio = new Date(semanaVisivel.getFullYear(), semanaVisivel.getMonth(), semanaVisivel.getDate(), 0, 0, 0)
      fim = new Date(ultimo.getFullYear(), ultimo.getMonth(), ultimo.getDate(), 23, 59, 59)
    } else {
      const dias = grade(ano, mes)
      inicio = new Date(dias[0].getFullYear(), dias[0].getMonth(), dias[0].getDate(), 0, 0, 0)
      const ultimo = dias[dias.length - 1]
      fim = new Date(ultimo.getFullYear(), ultimo.getMonth(), ultimo.getDate(), 23, 59, 59)
    }
    const [agenda, lista, pessoas] = await Promise.all([
      api.getAgenda(inicio.toISOString(), fim.toISOString()),
      api.getOrdens(),
      isAdmin ? api.getUsers({ status: 'ATIVO' }) : Promise.resolve({ data: [], error: undefined }),
    ])
    if (agenda.error) showToast(agenda.error, 'error')
    setItens((agenda.data as Item[]) || [])
    setOrdens((lista.data as Array<{ id: number; numero: number; cliente: string }>) || [])
    const pessoasBrutas = pessoas.data as { data?: Array<{ id: number; nome: string }> } | Array<{ id: number; nome: string }> | undefined
    setUsuarios(Array.isArray(pessoasBrutas) ? pessoasBrutas : pessoasBrutas?.data || [])
  }

  useEffect(() => {
    void carregar()
  }, [ano, mes, visao, semanaVisivel])

  function abrirAgendamento() {
    setForm({
      ordemId: '',
      funcionarioId: '',
      inicio: `${selecionado}T08:00`,
      fim: `${selecionado}T09:00`,
    })
    setModalAberto(true)
  }

  async function agendar() {
    const resposta = await api.criarAgendamento({
      ordemId: Number(form.ordemId),
      funcionarioId: Number(form.funcionarioId),
      inicio: new Date(form.inicio).toISOString(),
      fim: new Date(form.fim).toISOString(),
    })
    if (resposta.error) {
      showToast(resposta.error, 'error')
      return
    }
    showToast('Atendimento agendado.')
    setModalAberto(false)
    await carregar()
  }

  async function moverPara(item: Item, dia: Date) {
    if (dia.getDay() === 0) {
      showToast('A empresa não agenda aos domingos.', 'error')
      return
    }
    const inicio = new Date(item.inicio)
    const fim = new Date(item.fim)
    const duracao = fim.getTime() - inicio.getTime()
    inicio.setFullYear(dia.getFullYear(), dia.getMonth(), dia.getDate())
    const resposta = await api.atualizarAgendamento(item.id, {
      ordemId: item.ordemId,
      funcionarioId: item.funcionarioId,
      inicio: inicio.toISOString(),
      fim: new Date(inicio.getTime() + duracao).toISOString(),
    })
    if (resposta.error) {
      showToast(resposta.error, 'error')
      return
    }
    await carregar()
  }

  const doDia = itens.filter((item) => chave(new Date(item.inicio)) === selecionado)
  const hojeId = chave(hoje)
  const funcionariosSemana = useMemo(() => {
    const mapa = new Map<number, string>()
    itens.forEach((item) => mapa.set(item.funcionarioId, item.funcionario))
    usuarios.forEach((usuario) => {
      if (!mapa.has(usuario.id)) mapa.set(usuario.id, usuario.nome)
    })
    return [...mapa.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [itens, usuarios])

  function irHoje() {
    setMesVisivel(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
    setSemanaVisivel(inicioSemana(hoje))
    setSelecionado(hojeId)
  }

  function navegarAnterior() {
    if (visao === 'semana') {
      const nova = new Date(semanaVisivel)
      nova.setDate(semanaVisivel.getDate() - 7)
      setSemanaVisivel(nova)
      setMesVisivel(new Date(nova.getFullYear(), nova.getMonth(), 1))
      return
    }
    setMesVisivel(new Date(ano, mes - 1, 1))
  }

  function navegarProximo() {
    if (visao === 'semana') {
      const nova = new Date(semanaVisivel)
      nova.setDate(semanaVisivel.getDate() + 7)
      setSemanaVisivel(nova)
      setMesVisivel(new Date(nova.getFullYear(), nova.getMonth(), 1))
      return
    }
    setMesVisivel(new Date(ano, mes + 1, 1))
  }

  function blocoSemana(item: Item) {
    const inicioMin = minutosDoDia(item.inicio)
    const fimMin = minutosDoDia(item.fim)
    const base = HORA_INICIO * 60
    const teto = HORA_FIM * 60
    const topo = Math.max(0, ((Math.max(inicioMin, base) - base) / 60) * ALTURA_HORA)
    const altura = Math.max(24, ((Math.min(fimMin, teto) - Math.max(inicioMin, base)) / 60) * ALTURA_HORA)
    return { topo, altura }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 md:flex-row">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-1">
            <button type="button" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted" onClick={navegarAnterior} aria-label={visao === 'semana' ? 'Semana anterior' : 'Mês anterior'}>
              <HiChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="min-w-0 flex-1 text-base font-semibold sm:truncate sm:text-center">
              {visao === 'semana' ? rotuloSemana(semanaVisivel) : `${MESES[mes]} ${ano}`}
            </h2>
            <button type="button" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted" onClick={navegarProximo} aria-label={visao === 'semana' ? 'Próxima semana' : 'Próximo mês'}>
              <HiChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Visão da agenda">
              <button
                type="button"
                className={`rounded px-3 py-1.5 text-sm ${visao === 'mes' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                onClick={() => setVisao('mes')}
              >
                Mensal
              </button>
              <button
                type="button"
                className={`rounded px-3 py-1.5 text-sm ${visao === 'semana' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                onClick={() => {
                  setSemanaVisivel(inicioSemana(new Date(selecionado + 'T12:00:00')))
                  setVisao('semana')
                }}
              >
                Semanal
              </button>
            </div>
            <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={irHoje}>
              Hoje
            </button>
            {isAdmin ? (
              <button type="button" className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground" onClick={abrirAgendamento}>
                Agendar
              </button>
            ) : null}
          </div>
        </div>

        {visao === 'mes' ? (
          <>
            <div className="grid grid-cols-7 border-y text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {SEMANA.map((dia) => (
                <span key={dia} className="px-2 py-2">{dia}</span>
              ))}
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
              {celulas.map((dia) => {
                const id = chave(dia)
                const feriado = feriados.get(id)
                const compromissos = itens.filter((item) => chave(new Date(item.inicio)) === id)
                const fora = dia.getMonth() !== mes
                const ehHoje = id === hojeId
                const visiveis = compromissos.slice(0, feriado ? 2 : 3)
                const ocultos = compromissos.length - visiveis.length
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelecionado(id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      const item = itens.find((atual) => atual.id === arrastando)
                      if (item) void moverPara(item, dia)
                      setArrastando(null)
                    }}
                    className={`flex min-h-14 flex-col border-b border-r p-1 text-left hover:bg-muted/40 sm:min-h-24 sm:p-1.5 ${selecionado === id ? 'bg-muted/50' : ''}`}
                  >
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] sm:h-7 sm:w-7 sm:text-xs ${ehHoje ? 'bg-primary font-semibold text-primary-foreground' : fora ? 'text-muted-foreground/50' : ''}`}>
                      {dia.getDate()}
                    </span>
                    {feriado ? <span className="mt-1 hidden truncate rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 sm:block">{feriado}</span> : null}
                    {feriado ? <span className="mt-1 h-1.5 w-1.5 rounded-full bg-rose-500 sm:hidden" /> : null}
                    {visiveis.map((item) => (
                      <span
                        key={item.id}
                        draggable={isAdmin}
                        onDragStart={(event) => {
                          event.stopPropagation()
                          setArrastando(item.id)
                        }}
                        className={`mt-1 hidden truncate rounded px-1.5 py-0.5 text-[10px] font-medium sm:block ${CORES[item.id % CORES.length]}`}
                      >
                        {hora(item.inicio)} {item.cliente}
                      </span>
                    ))}
                    {compromissos.length > 0 ? (
                      <span className="mt-1 flex gap-0.5 sm:hidden">
                        {compromissos.slice(0, 3).map((item) => (
                          <span key={item.id} className={`h-1.5 w-1.5 rounded-full ${CORES[item.id % CORES.length].split(' ')[0]}`} />
                        ))}
                      </span>
                    ) : null}
                    {ocultos > 0 ? <span className="mt-0.5 hidden px-1 text-[10px] text-muted-foreground sm:block">mais {ocultos}</span> : null}
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            {funcionariosSemana.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nenhum funcionário com agenda nesta semana.</p>
            ) : (
              <div className="min-w-[960px]">
                <div className="sticky top-0 z-20 grid border-b bg-card" style={{ gridTemplateColumns: `140px repeat(7, minmax(120px, 1fr))` }}>
                  <div className="border-r px-2 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Funcionário</div>
                  {diasSemana.map((dia) => {
                    const id = chave(dia)
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelecionado(id)}
                        className={`border-r px-2 py-2 text-left hover:bg-muted/40 ${selecionado === id ? 'bg-muted/50' : ''}`}
                      >
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{SEMANA[(dia.getDay() + 6) % 7]}</p>
                        <p className={`text-sm ${id === hojeId ? 'font-semibold text-primary' : ''}`}>{dia.getDate()}</p>
                        {feriados.get(id) ? <p className="truncate text-[10px] text-rose-600">{feriados.get(id)}</p> : null}
                      </button>
                    )
                  })}
                </div>
                {funcionariosSemana.map((pessoa) => (
                  <div key={pessoa.id} className="grid border-b" style={{ gridTemplateColumns: `140px repeat(7, minmax(120px, 1fr))` }}>
                    <div className="sticky left-0 z-10 border-r bg-card px-2 py-3 text-sm font-medium">{pessoa.nome}</div>
                    {diasSemana.map((dia) => {
                      const id = chave(dia)
                      const doFuncionario = itens
                        .filter((item) => item.funcionarioId === pessoa.id && chave(new Date(item.inicio)) === id)
                        .sort((a, b) => a.inicio.localeCompare(b.inicio))
                      return (
                        <div
                          key={`${pessoa.id}-${id}`}
                          className={`relative border-r ${selecionado === id ? 'bg-muted/30' : ''}`}
                          style={{ height: (HORA_FIM - HORA_INICIO) * ALTURA_HORA }}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => {
                            const item = itens.find((atual) => atual.id === arrastando)
                            if (item) void moverPara(item, dia)
                            setArrastando(null)
                          }}
                          onClick={() => setSelecionado(id)}
                        >
                          {horasGrade.map((horaGrade) => (
                            <div
                              key={`${pessoa.id}-${id}-${horaGrade}`}
                              className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border/60 text-[9px] text-muted-foreground/70"
                              style={{ top: (horaGrade - HORA_INICIO) * ALTURA_HORA }}
                            >
                              <span className="ml-1">{String(horaGrade).padStart(2, '0')}:00</span>
                            </div>
                          ))}
                          {doFuncionario.map((item) => {
                            const bloco = blocoSemana(item)
                            return (
                              <div
                                key={item.id}
                                draggable={isAdmin}
                                onDragStart={(event) => {
                                  event.stopPropagation()
                                  setArrastando(item.id)
                                }}
                                title={`${hora(item.inicio)}–${hora(item.fim)} ${item.cliente}`}
                                className={`absolute inset-x-1 overflow-hidden rounded px-1.5 py-1 text-[10px] font-medium shadow-sm ${CORES[item.id % CORES.length]}`}
                                style={{ top: bloco.topo, height: bloco.altura, zIndex: 1 }}
                              >
                                <p className="truncate">{hora(item.inicio)} {item.cliente}</p>
                                <p className="truncate opacity-80">até {hora(item.fim)}</p>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <aside className="flex w-full shrink-0 flex-col overflow-auto rounded-xl border bg-card p-4 md:w-72">
        <h3 className="text-base font-semibold">{tituloDia(selecionado)}</h3>
        {feriados.get(selecionado) ? <p className="mt-1 text-sm text-rose-600">{feriados.get(selecionado)}</p> : null}
        {doDia.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhum atendimento neste dia.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {doDia.map((item) => (
              <li key={item.id} className="rounded-lg border px-3 py-2 text-sm">
                <p className="font-medium">{hora(item.inicio)} {item.cliente}</p>
                <p className="text-xs text-muted-foreground">
                  {String(item.numero).padStart(4, '0')} · até {hora(item.fim)} · {item.funcionario}
                </p>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {modalAberto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModalAberto(false)}>
          <form
            className="w-full max-w-md rounded-xl bg-card p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => { event.preventDefault(); void agendar() }}
          >
            <CabecalhoModal
              icone={IconeCalendario}
              titulo="Novo agendamento"
              descricao="Escolha a ordem, o funcionário e o horário."
              onFechar={() => setModalAberto(false)}
            />
            <div className="grid gap-3">
              <select className="rounded-md border bg-background px-3 py-2 text-sm" value={form.ordemId} onChange={(event) => setForm({ ...form, ordemId: event.target.value })} required>
                <option value="">Ordem</option>
                {ordens.map((ordem) => <option key={ordem.id} value={ordem.id}>{String(ordem.numero).padStart(4, '0')} {ordem.cliente}</option>)}
              </select>
              <select className="rounded-md border bg-background px-3 py-2 text-sm" value={form.funcionarioId} onChange={(event) => setForm({ ...form, funcionarioId: event.target.value })} required>
                <option value="">Funcionário</option>
                {usuarios.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nome}</option>)}
              </select>
              <input className="rounded-md border bg-background px-3 py-2 text-sm" type="datetime-local" value={form.inicio} onChange={(event) => setForm({ ...form, inicio: event.target.value })} required />
              <input className="rounded-md border bg-background px-3 py-2 text-sm" type="datetime-local" value={form.fim} onChange={(event) => setForm({ ...form, fim: event.target.value })} required />
              <button type="submit" className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Agendar</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}
