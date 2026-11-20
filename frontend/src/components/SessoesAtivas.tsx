import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Building2, LogOut, Radio, RefreshCw, Search, Users, WifiOff } from 'lucide-react'
import { api } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { FiltrosColapsaveis } from '@/components/FiltrosColapsaveis'
import { CabecalhoModulo, IconeSessoes } from '@/components/icones/IconesErp'

type Sessao = {
  id: string
  usuarioId: number
  nome: string
  login: string
  grupo: string
  empresaCodigo: string | null
  empresaNome: string
  ip: string | null
  criadoEm: string
  expiraEm: string
  ultimoPing: string
  ativo: boolean
  emUso: boolean
}

type Situacao = 'em_uso' | 'abertas' | 'encerradas'

type Props = {
  showToast: (message: string, type?: 'success' | 'error') => void
}

const TINTAS = [
  'bg-sky-500/15 text-sky-700',
  'bg-violet-500/15 text-violet-700',
  'bg-emerald-500/15 text-emerald-700',
  'bg-amber-500/15 text-amber-800',
  'bg-rose-500/15 text-rose-700',
  'bg-cyan-500/15 text-cyan-800',
]

const campo = 'h-11 w-full min-w-0 rounded-md border border-[#eee] bg-white pl-9 pr-3 text-sm text-[#333]'
const card = 'rounded-md border border-[#ddd] bg-white p-4'

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length >= 2) return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase()
  return (partes[0] || '?').slice(0, 2).toUpperCase()
}

function tinta(nome: string) {
  let hash = 0
  for (let i = 0; i < nome.length; i += 1) hash = (hash + nome.charCodeAt(i)) % TINTAS.length
  return TINTAS[hash]
}

function formatarHora(iso?: string | null) {
  if (!iso) return '—'
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return '—'
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function haQuanto(iso: string | null | undefined, agora: number) {
  if (!iso) return '—'
  const segundos = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 1000))
  if (segundos < 15) return 'agora'
  if (segundos < 60) return `há ${segundos}s`
  const minutos = Math.round(segundos / 60)
  if (minutos < 60) return `há ${minutos} min`
  return `há ${Math.round(minutos / 60)} h`
}

function idLogado() {
  try {
    const bruto = localStorage.getItem('user')
    if (!bruto) return null
    const id = Number(JSON.parse(bruto)?.id)
    return Number.isFinite(id) ? id : null
  } catch {
    return null
  }
}

function BadgeSituacao({ sessao }: { sessao: Sessao }) {
  if (sessao.emUso) {
    return (
      <span className="inline-flex whitespace-nowrap items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-500/20">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Em uso
      </span>
    )
  }
  if (sessao.ativo) {
    return (
      <span className="inline-flex whitespace-nowrap items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-500/20">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Ausente
      </span>
    )
  }
  return (
    <span className="inline-flex whitespace-nowrap items-center gap-1.5 rounded-full bg-[#f0f0f0] px-2 py-1 text-xs font-medium text-[#666] ring-1 ring-[#ddd]">
      Encerrada
    </span>
  )
}

export function SessoesAtivas({ showToast }: Props) {
  const [situacao, setSituacao] = useState<Situacao>('em_uso')
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [emUso, setEmUso] = useState(0)
  const [abertas, setAbertas] = useState(0)
  const [sessoes, setSessoes] = useState<Sessao[]>([])
  const [selecionadas, setSelecionadas] = useState<string[]>([])
  const [carregando, setCarregando] = useState(true)
  const [encerrando, setEncerrando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())
  const [atualizadoEm, setAtualizadoEm] = useState<number | null>(null)
  const toastRef = useRef(showToast)
  toastRef.current = showToast
  const meuId = idLogado()

  useEffect(() => {
    const id = window.setTimeout(() => setBuscaAplicada(busca.trim()), 280)
    return () => window.clearTimeout(id)
  }, [busca])

  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const carregar = useCallback(async () => {
    const res = await api.listarSessoes({ situacao, busca: buscaAplicada })
    if (res.error) {
      toastRef.current(res.error, 'error')
      setCarregando(false)
      return
    }
    const data = res.data
    setEmUso(data?.emUso ?? 0)
    setAbertas(data?.abertas ?? 0)
    setSessoes(data?.sessoes ?? [])
    setSelecionadas((atual) =>
      atual.filter((id) => (data?.sessoes ?? []).some((sessao) => sessao.id === id && sessao.ativo)),
    )
    setAtualizadoEm(Date.now())
    setCarregando(false)
  }, [situacao, buscaAplicada])

  useEffect(() => {
    setCarregando(true)
    void carregar()
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      void carregar()
    }, 5000)
    return () => window.clearInterval(id)
  }, [carregar])

  const abertasNaLista = sessoes.filter((sessao) => sessao.ativo)
  const todasMarcadas = abertasNaLista.length > 0 && abertasNaLista.every((sessao) => selecionadas.includes(sessao.id))
  const incluiMinha = useMemo(
    () => sessoes.some((sessao) => selecionadas.includes(sessao.id) && sessao.usuarioId === meuId),
    [sessoes, selecionadas, meuId],
  )

  const alternarTodas = () => {
    setConfirmar(false)
    setSelecionadas(todasMarcadas ? [] : abertasNaLista.map((sessao) => sessao.id))
  }

  const alternarUma = (id: string) => {
    setConfirmar(false)
    setSelecionadas((atual) => (atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]))
  }

  const encerrar = async () => {
    if (!selecionadas.length) return
    setEncerrando(true)
    const res = await api.encerrarSessoes(selecionadas)
    setEncerrando(false)
    setConfirmar(false)
    if (res.error) {
      toastRef.current(res.error, 'error')
      return
    }
    const quantidade = res.data?.count ?? 0
    toastRef.current(
      quantidade === 1
        ? '1 sessão encerrada. O acesso cai na próxima ação.'
        : quantidade > 1
          ? `${quantidade} sessões encerradas. O acesso cai na próxima ação.`
          : 'Nenhuma sessão aberta nessa seleção.',
      'success',
    )
    setSelecionadas([])
    await carregar()
  }

  const cartoes: Array<{ id: Situacao; titulo: string; valor: number; ponto: string }> = [
    { id: 'em_uso', titulo: 'Em uso agora', valor: emUso, ponto: 'bg-emerald-500' },
    { id: 'abertas', titulo: 'Sessões abertas', valor: abertas, ponto: 'bg-amber-500' },
    {
      id: 'encerradas',
      titulo: 'Encerradas',
      valor: situacao === 'encerradas' ? sessoes.length : 0,
      ponto: 'bg-[#bbb]',
    },
  ]

  return (
    <div
      data-ds="ant-mobile-sessoes"
      className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#f5f5f9]"
    >
      <div className="shrink-0 space-y-3 border-b border-[#eee] bg-white px-[15px] py-4">
        <CabecalhoModulo
          icone={IconeSessoes}
          titulo="Sessões em uso"
          acoes={
            <div className="flex items-center gap-2 text-xs text-[#666]">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <div className="inline-flex items-center gap-1.5 rounded-md border border-[#eee] bg-white px-2.5 py-1.5">
                <Radio className="h-3.5 w-3.5 text-primary" />
                <span className="whitespace-nowrap">
                  {atualizadoEm ? `Atualizado ${haQuanto(new Date(atualizadoEm).toISOString(), agora)}` : 'Aguardando'}
                </span>
              </div>
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {cartoes.map((cartao) => {
            const ativo = situacao === cartao.id
            const valor = cartao.id === 'encerradas' && situacao !== 'encerradas' ? '—' : cartao.valor
            return (
              <button
                key={cartao.id}
                type="button"
                onClick={() => {
                  setConfirmar(false)
                  setSelecionadas([])
                  setSituacao(cartao.id)
                }}
                className={cn(
                  card,
                  'text-left transition',
                  ativo ? 'border-primary ring-2 ring-primary/15' : 'hover:border-primary/30',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-[#888]">{cartao.titulo}</span>
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', cartao.ponto, ativo && cartao.id === 'em_uso' && 'animate-pulse')} />
                </div>
                <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-[#333]">{valor}</div>
              </button>
            )
          })}
        </div>

        <FiltrosColapsaveis conteudoClassName="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#888]" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou login"
              className={campo}
            />
          </div>
          <button
            type="button"
            onClick={() => void carregar()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#d0d5dd] bg-white px-4 text-sm font-medium text-[#333]"
          >
            <RefreshCw className={cn('h-4 w-4', carregando && 'animate-spin')} />
            Atualizar
          </button>
          <span className="text-xs text-[#888] sm:ml-auto">
            {carregando && sessoes.length === 0
              ? 'Carregando…'
              : `${sessoes.length} ${sessoes.length === 1 ? 'registro' : 'registros'}`}
          </span>
        </FiltrosColapsaveis>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-[15px] py-4 pb-28 [-webkit-overflow-scrolling:touch]">
        <div className="space-y-3 md:hidden">
          {situacao !== 'encerradas' && abertasNaLista.length > 0 && (
            <label className={`${card} flex items-center gap-3`}>
              <Checkbox checked={todasMarcadas} onCheckedChange={alternarTodas} aria-label="Selecionar todas" />
              <span className="text-sm text-[#333]">Selecionar todas</span>
            </label>
          )}

          {carregando && sessoes.length === 0 &&
            Array.from({ length: 3 }).map((_, indice) => (
              <div key={`sk-m-${indice}`} className={`${card} h-28 animate-pulse bg-[#eee]`} />
            ))}

          {!carregando && sessoes.length === 0 && (
            <div className={`${card} flex flex-col items-center py-10 text-center`}>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f0f0f0] text-[#888]">
                {situacao === 'em_uso' ? <WifiOff className="h-5 w-5" /> : <Users className="h-5 w-5" />}
              </div>
              <p className="font-medium text-[#333]">
                {situacao === 'em_uso' ? 'Ninguém em uso neste instante' : 'Nenhuma sessão nesse filtro'}
              </p>
            </div>
          )}

          {sessoes.map((sessao) => {
            const marcada = selecionadas.includes(sessao.id)
            const eu = sessao.usuarioId === meuId
            const nome = sessao.nome || sessao.login || 'Usuário'
            return (
              <article
                key={sessao.id}
                className={cn(card, 'space-y-3', marcada && 'border-primary/40 bg-primary/5')}
              >
                <div className="flex items-start gap-3">
                  {sessao.ativo ? (
                    <Checkbox
                      checked={marcada}
                      onCheckedChange={() => alternarUma(sessao.id)}
                      aria-label={`Selecionar ${nome}`}
                      className="mt-1"
                    />
                  ) : (
                    <span className="mt-1 h-4 w-4 shrink-0" />
                  )}
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold', tinta(nome))}>
                    {iniciais(nome)}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-words text-[15px] font-medium leading-snug text-[#333]">{nome}</p>
                      {eu && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Você
                        </span>
                      )}
                    </div>
                    <p className="break-words text-xs text-[#888]">{sessao.login}</p>
                  </div>
                  <BadgeSituacao sessao={sessao} />
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-[#eee] pt-3">
                  <div className="min-w-0">
                    <p className="text-[11px] text-[#888]">Empresa</p>
                    <div className="mt-1 flex items-start gap-1.5">
                      <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#888]" />
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium text-[#333]">{sessao.empresaCodigo || '—'}</p>
                        <p className="break-words text-xs text-[#666]">{sessao.empresaNome || 'Sem empresa'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-[#888]">Sinal</p>
                    <p className="mt-1 text-sm font-medium text-[#333]">{haQuanto(sessao.ultimoPing, agora)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-[#888]">Início</p>
                    <p className="mt-1 break-words text-sm text-[#333]">{formatarHora(sessao.criadoEm)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-[#888]">Grupo</p>
                    <p className="mt-1 break-words text-sm text-[#333]">{sessao.grupo || 'Sem grupo'}</p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        <div className="hidden overflow-hidden rounded-md border border-[#ddd] bg-white md:block">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b bg-muted text-left">
              <tr>
                <th className="w-12 px-4 py-3">
                  {situacao !== 'encerradas' && (
                    <Checkbox
                      checked={todasMarcadas}
                      onCheckedChange={alternarTodas}
                      aria-label="Selecionar todas"
                      disabled={abertasNaLista.length === 0}
                    />
                  )}
                </th>
                <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Usuário</th>
                <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Empresa</th>
                <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Grupo</th>
                <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">IP</th>
                <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Início</th>
                <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Expira</th>
                <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Sinal</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Situação</th>
              </tr>
            </thead>
            <tbody>
              {carregando && sessoes.length === 0 &&
                Array.from({ length: 5 }).map((_, indice) => (
                  <tr key={`sk-${indice}`} className="border-b last:border-0">
                    <td colSpan={9} className="px-4 py-3">
                      <div className="h-10 animate-pulse rounded-lg bg-muted" />
                    </td>
                  </tr>
                ))}

              {!carregando && sessoes.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-muted-foreground">
                    {situacao === 'em_uso' ? 'Ninguém em uso neste instante' : 'Nenhuma sessão nesse filtro'}
                  </td>
                </tr>
              )}

              {sessoes.map((sessao) => {
                const marcada = selecionadas.includes(sessao.id)
                const eu = sessao.usuarioId === meuId
                const nome = sessao.nome || sessao.login || 'Usuário'
                return (
                  <tr
                    key={sessao.id}
                    className={cn(
                      'border-b transition-colors last:border-0',
                      marcada ? 'bg-primary/5' : 'hover:bg-muted/40',
                    )}
                  >
                    <td className="px-4 py-3">
                      {sessao.ativo && (
                        <Checkbox
                          checked={marcada}
                          onCheckedChange={() => alternarUma(sessao.id)}
                          aria-label={`Selecionar ${nome}`}
                        />
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold', tinta(nome))}>
                          {iniciais(nome)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="break-words font-medium">{nome}</span>
                            {eu && (
                              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                Você
                              </span>
                            )}
                          </div>
                          <div className="break-words text-xs text-muted-foreground">{sessao.login}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-2">
                        <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="break-words font-medium">{sessao.empresaCodigo || '—'}</div>
                          <div className="break-words text-xs text-muted-foreground">{sessao.empresaNome || 'Sem empresa'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex break-words rounded-full border bg-background px-2 py-0.5 text-xs">
                        {sessao.grupo || 'Sem grupo'}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{sessao.ip || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{formatarHora(sessao.criadoEm)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{formatarHora(sessao.expiraEm)}</td>
                    <td className="whitespace-nowrap px-3 py-3">{haQuanto(sessao.ultimoPing, agora)}</td>
                    <td className="px-4 py-3">
                      <BadgeSituacao sessao={sessao} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selecionadas.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
          <div className="pointer-events-auto flex w-full max-w-3xl flex-col gap-3 rounded-2xl border border-[#ddd] bg-white/95 px-4 py-3 shadow-xl backdrop-blur sm:flex-row sm:flex-wrap sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="break-words text-sm font-medium text-[#333]">
                {selecionadas.length === 1 ? '1 sessão selecionada' : `${selecionadas.length} sessões selecionadas`}
              </div>
              <div className="break-words text-xs text-[#888]">
                {incluiMinha
                  ? 'Inclui a sua sessão. Você vai sair do sistema.'
                  : confirmar
                    ? 'A pessoa perde o acesso na próxima ação.'
                    : 'O lugar fica livre assim que a sessão cair.'}
              </div>
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setConfirmar(false)
                  setSelecionadas([])
                }}
              >
                Limpar
              </Button>
              {confirmar ? (
                <Button type="button" variant="destructive" disabled={encerrando} onClick={() => void encerrar()}>
                  <LogOut className="h-4 w-4" />
                  {encerrando ? 'Encerrando…' : 'Encerrar agora'}
                </Button>
              ) : (
                <Button type="button" variant="destructive" onClick={() => setConfirmar(true)}>
                  <LogOut className="h-4 w-4" />
                  Encerrar
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
