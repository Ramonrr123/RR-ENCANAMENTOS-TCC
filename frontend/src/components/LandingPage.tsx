import { useEffect, useMemo, useState } from 'react'
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSun, Snowflake, Sun } from 'lucide-react'
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi'
import { feriadosDoAno, type Feriado } from '@/components/CalendarioAnual'
import { IconeCalendario, IconeTarefas } from '@/components/icones/IconesErp'
import { api } from '@/services/api'
import WavesBackground from '@/components/WavesBackground'

type PainelExtras = {
  situacao?: string
  filtro?: string
  /** Usado pelos cartões: vencido, repor, vencer, vencidas, vigentes */
}

type PainelResumo = {
  ordensAbertas: number
  ordensAgendadas: number
  ordensEmAndamento: number
  aguardandoConferencia: number
  parcelasAtrasadas: number
  estoqueBaixo: number
  preventivasAVencer?: number
  preventivasVencidas?: number
  garantiasVigentes?: number
  chamadosNovos?: number
}

type AlertasPrivacidade = {
  solicitacoesVencidas: number
  registrosRetencaoVencidos: number
}

type LandingPageProps = {
  nome?: string
  isAdmin?: boolean
  onOpen: (id: string, extras?: PainelExtras) => void
}

type TarefaHoje = {
  id: string
  titulo: string
  prioridade: 'baixa' | 'media' | 'alta'
  status: 'pendente' | 'andamento' | 'concluida'
  prazo: string
  quando: string
}

type DiaClima = {
  data: string
  codigo: number
  max: number
  min: number
  noticias: string[]
}

type HoraClima = {
  iso: string
  codigo: number
  prob: number
  precip: number
  temp: number
}

type Clima = {
  cidade: string
  temperatura: number
  sensacao: number
  umidade: number
  vento: number
  codigo: number
  descricao: string
  dias: DiaClima[]
  atualizado: string
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const PRIORIDADE: Record<TarefaHoje['prioridade'], string> = {
  alta: 'bg-red-100 text-red-700',
  media: 'bg-amber-100 text-amber-800',
  baixa: 'bg-slate-100 text-slate-600',
}

function chave(data: Date) {
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mes}-${dia}`
}

function diaPrazo(prazo: string) {
  const iso = String(prazo || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const br = String(prazo || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  return ''
}

function lerTarefasDoCard(lista: Array<{ id?: string | number; titulo?: string; prazo?: string; prioridade?: TarefaHoje['prioridade']; status?: TarefaHoje['status'] }>): TarefaHoje[] {
  try {
    if (!Array.isArray(lista)) return []
    const hoje = chave(new Date())
    const tarefas: TarefaHoje[] = lista
      .filter((tarefa) => tarefa && tarefa.titulo && tarefa.status !== 'concluida')
      .map((tarefa) => {
        const prazo = diaPrazo(tarefa.prazo || '')
        let quando = 'Sem prazo'
        if (prazo === hoje) quando = 'Hoje'
        else if (prazo && prazo < hoje) quando = 'Atrasada'
        else if (prazo) quando = `${prazo.slice(8, 10)}/${prazo.slice(5, 7)}`
        return {
          id: String(tarefa.id),
          titulo: String(tarefa.titulo),
          prioridade: tarefa.prioridade || 'media',
          status: tarefa.status || 'pendente',
          prazo,
          quando,
        }
      })
    tarefas.sort((a, b) => {
      const peso = (tarefa: TarefaHoje) => (tarefa.prazo === hoje ? 0 : tarefa.prazo && tarefa.prazo < hoje ? 1 : 2)
      const ordem = peso(a) - peso(b)
      if (ordem !== 0) return ordem
      return (a.prazo || '9999-99-99').localeCompare(b.prazo || '9999-99-99')
    })
    return tarefas
  } catch {
    return []
  }
}

function horaLocal(iso: string) {
  return `${Number(iso.slice(11, 13))}h`
}

function temChuva(codigo: number) {
  return (codigo >= 51 && codigo <= 67) || (codigo >= 80 && codigo <= 82) || codigo >= 95
}

function movimentoClima(codigo: number) {
  if (codigo === 0 || codigo <= 2) return 'animate-clima-sol'
  if (temChuva(codigo)) return 'animate-clima-chuva'
  return 'animate-clima-nuvem'
}

function noticiasDoDia(data: string, horas: HoraClima[], agora: Date) {
  const doDia = horas.filter((hora) => hora.iso.startsWith(data))
  const futuras = data === chave(agora) ? doDia.filter((hora) => new Date(hora.iso).getTime() >= agora.getTime() - 30 * 60 * 1000) : doDia
  const base = futuras.length ? futuras : doDia
  const frases: string[] = []
  const chuvosas = base.filter((hora) => hora.prob >= 40 || hora.precip >= 0.5 || hora.codigo >= 80)
  if (chuvosas.length) {
    const inicio = chuvosas[0]
    const pico = chuvosas.reduce((melhor, hora) => (hora.prob > melhor.prob ? hora : melhor))
    const tempestade = chuvosas.find((hora) => hora.codigo >= 95)
    if (tempestade) frases.push(`Tempestade prevista às ${horaLocal(tempestade.iso)}`)
    frases.push(`Chuva prevista às ${horaLocal(inicio.iso)}`)
    if (pico.prob >= 40) frases.push(`${Math.round(pico.prob)}% de chuva às ${horaLocal(pico.iso)}`)
  } else {
    frases.push('Sem chuva prevista')
  }
  if (base.length) {
    const quente = base.reduce((melhor, hora) => (hora.temp > melhor.temp ? hora : melhor))
    frases.push(`Máxima de ${Math.round(quente.temp)}° às ${horaLocal(quente.iso)}`)
  }
  return [...new Set(frases)].slice(0, 3)
}

function NoticiaDoDia({ frases, atraso }: { frases: string[]; atraso: number }) {
  const [indice, setIndice] = useState(0)
  useEffect(() => {
    if (frases.length <= 1) return
    let intervalo = 0
    const inicio = window.setTimeout(() => {
      setIndice((atual) => (atual + 1) % frases.length)
      intervalo = window.setInterval(() => {
        setIndice((atual) => (atual + 1) % frases.length)
      }, 3600)
    }, 2400 + atraso)
    return () => {
      window.clearTimeout(inicio)
      window.clearInterval(intervalo)
    }
  }, [frases, atraso])
  const texto = frases[indice] || ''
  return (
    <p key={texto} className="animate-clima-noticia mt-1 hidden min-h-[2rem] text-[10px] leading-tight text-foreground/80 sm:block">
      {texto}
    </p>
  )
}

function descricaoClima(codigo: number) {
  if (codigo === 0) return 'Céu limpo'
  if (codigo <= 2) return 'Parcialmente nublado'
  if (codigo === 3) return 'Nublado'
  if (codigo === 45 || codigo === 48) return 'Neblina'
  if (codigo >= 51 && codigo <= 67) return 'Chuva'
  if (codigo >= 71 && codigo <= 77) return 'Neve'
  if (codigo >= 80 && codigo <= 82) return 'Pancadas de chuva'
  if (codigo >= 95) return 'Tempestade'
  return 'Tempo instável'
}

function IconeClima({ codigo, className }: { codigo: number; className?: string }) {
  const classe = className || 'h-5 w-5'
  if (codigo === 0) return <Sun className={classe} />
  if (codigo <= 2) return <CloudSun className={classe} />
  if (codigo === 3 || codigo === 45 || codigo === 48) return codigo >= 45 ? <CloudFog className={classe} /> : <Cloud className={classe} />
  if (codigo >= 71 && codigo <= 77) return <Snowflake className={classe} />
  if (codigo >= 95) return <CloudLightning className={classe} />
  return <CloudRain className={classe} />
}

function diasAte(data: string) {
  const alvo = new Date(`${data}T00:00:00`)
  const agora = new Date()
  agora.setHours(0, 0, 0, 0)
  const diff = Math.round((alvo.getTime() - agora.getTime()) / 86400000)
  if (diff === 0) return 'hoje'
  if (diff === 1) return 'amanhã'
  return `em ${diff} dias`
}

export function LandingPage({ nome, isAdmin = false, onOpen }: LandingPageProps) {
  const hojeData = new Date()
  const hoje = chave(hojeData)
  const [mesVisivel, setMesVisivel] = useState(() => new Date(hojeData.getFullYear(), hojeData.getMonth(), 1))
  const [tarefas, setTarefas] = useState<TarefaHoje[]>([])
  const [painel, setPainel] = useState<PainelResumo | null>(null)
  const [alertasPrivacidade, setAlertasPrivacidade] = useState<AlertasPrivacidade>({
    solicitacoesVencidas: 0,
    registrosRetencaoVencidos: 0,
  })
  const [clima, setClima] = useState<Clima | null>(null)
  const [climaErro, setClimaErro] = useState('')
  const [localizando, setLocalizando] = useState(true)

  useEffect(() => {
    let ativo = true
    const atualizar = () => {
      void api.getTarefas().then((resposta) => {
        if (!ativo || !Array.isArray(resposta.data)) return
        setTarefas(lerTarefasDoCard(resposta.data))
      })
      if (!isAdmin) return
      void api.getPainel().then((resposta) => {
        if (!ativo || !resposta.data || typeof resposta.data !== 'object') return
        const dados = resposta.data as Partial<PainelResumo>
        setPainel({
          ordensAbertas: Number(dados.ordensAbertas || 0),
          ordensAgendadas: Number(dados.ordensAgendadas || 0),
          ordensEmAndamento: Number(dados.ordensEmAndamento || 0),
          aguardandoConferencia: Number(dados.aguardandoConferencia || 0),
          parcelasAtrasadas: Number(dados.parcelasAtrasadas || 0),
          estoqueBaixo: Number(dados.estoqueBaixo || 0),
          preventivasAVencer: Number(dados.preventivasAVencer || 0),
          preventivasVencidas: Number(dados.preventivasVencidas || 0),
          garantiasVigentes: Number(dados.garantiasVigentes || 0),
          chamadosNovos: Number(dados.chamadosNovos || 0),
        })
      })
      void api.request('/privacidade/alertas').then((resposta) => {
        if (!ativo || !resposta.data || typeof resposta.data !== 'object') return
        const dados = resposta.data as Partial<AlertasPrivacidade>
        setAlertasPrivacidade({
          solicitacoesVencidas: Number(dados.solicitacoesVencidas || 0),
          registrosRetencaoVencidos: Number(dados.registrosRetencaoVencidos || 0),
        })
      })
    }
    atualizar()
    window.addEventListener('focus', atualizar)
    document.addEventListener('visibilitychange', atualizar)
    return () => {
      ativo = false
      window.removeEventListener('focus', atualizar)
      document.removeEventListener('visibilitychange', atualizar)
    }
  }, [isAdmin])

  useEffect(() => {
    let cancelado = false

    async function montar(latitude: number, longitude: number) {
      const [previsaoRes, lugarRes] = await Promise.all([
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,precipitation,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=6`,
        ),
        fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt`),
      ])
      if (!previsaoRes.ok) throw new Error('clima')
      const previsao = await previsaoRes.json()
      const lugar = lugarRes.ok ? await lugarRes.json() : {}
      if (cancelado) return
      const cidadeNome = lugar.city || lugar.locality || lugar.principalSubdivision || 'Sua região'
      const uf = String(lugar.principalSubdivisionCode || '').replace('BR-', '')
      const horas: HoraClima[] = (previsao.hourly?.time || []).map((iso: string, indice: number) => ({
        iso,
        codigo: Number(previsao.hourly.weather_code?.[indice] ?? 0),
        prob: Number(previsao.hourly.precipitation_probability?.[indice] ?? 0),
        precip: Number(previsao.hourly.precipitation?.[indice] ?? 0),
        temp: Number(previsao.hourly.temperature_2m?.[indice] ?? 0),
      }))
      const agora = new Date()
      const dias: DiaClima[] = (previsao.daily?.time || []).slice(0, 5).map((data: string, indice: number) => ({
        data,
        codigo: previsao.daily.weather_code[indice],
        max: previsao.daily.temperature_2m_max[indice],
        min: previsao.daily.temperature_2m_min[indice],
        noticias: noticiasDoDia(data, horas, agora),
      }))
      setClima({
        cidade: uf && uf.length <= 3 ? `${cidadeNome}, ${uf}` : cidadeNome,
        temperatura: Math.round(previsao.current.temperature_2m),
        sensacao: Math.round(previsao.current.apparent_temperature),
        umidade: Math.round(previsao.current.relative_humidity_2m),
        vento: Math.round(previsao.current.wind_speed_10m),
        codigo: previsao.current.weather_code,
        descricao: descricaoClima(previsao.current.weather_code),
        dias,
        atualizado: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      })
      setClimaErro('')
      setLocalizando(false)
    }

    async function porIp() {
      const lugarRes = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=pt')
      if (!lugarRes.ok) throw new Error('local')
      const lugar = await lugarRes.json()
      if (typeof lugar.latitude !== 'number' || typeof lugar.longitude !== 'number') throw new Error('local')
      await montar(lugar.latitude, lugar.longitude)
    }

    if (!navigator.geolocation) {
      porIp().catch(() => {
        if (!cancelado) {
          setClimaErro('Não foi possível obter a previsão.')
          setLocalizando(false)
        }
      })
      return () => {
        cancelado = true
      }
    }

    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        montar(posicao.coords.latitude, posicao.coords.longitude).catch(() => {
          if (!cancelado) {
            setClimaErro('Não foi possível obter a previsão.')
            setLocalizando(false)
          }
        })
      },
      () => {
        porIp().catch(() => {
          if (!cancelado) {
            setClimaErro('Permita a localização para ver a previsão da sua região.')
            setLocalizando(false)
          }
        })
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    )

    return () => {
      cancelado = true
    }
  }, [])

  const ano = mesVisivel.getFullYear()
  const mes = mesVisivel.getMonth()
  const feriados = useMemo(() => {
    const mapa = new Map<string, Feriado>()
    ;[...feriadosDoAno(ano), ...feriadosDoAno(ano + 1)].forEach((feriado) => {
      if (!mapa.has(feriado.data)) mapa.set(feriado.data, feriado)
    })
    return mapa
  }, [ano])

  const proximos = useMemo(() => {
    return [...feriados.values()].filter((feriado) => feriado.data >= hoje).slice(0, 3)
  }, [feriados, hoje])

  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const inicioSemana = new Date(ano, mes, 1).getDay()
  const celulas = [...Array(inicioSemana).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => i + 1)]
  while (celulas.length < 42) celulas.push(null)

  let uteis = 0
  let naoUteis = 0
  let facultativos = 0
  let uteisRestantes = 0
  for (let dia = 1; dia <= diasNoMes; dia += 1) {
    const data = new Date(ano, mes, dia)
    const id = chave(data)
    const feriado = feriados.get(id)
    const fimDeSemana = data.getDay() === 0 || data.getDay() === 6
    if (feriado?.tipo === 'facultativo' && !fimDeSemana) facultativos += 1
    else if (fimDeSemana || feriado?.tipo === 'nacional') naoUteis += 1
    else {
      uteis += 1
      if (id >= hoje) uteisRestantes += 1
    }
  }

  const tarefasVisiveis = tarefas.slice(0, 8)
  const tarefasOcultas = tarefas.length - tarefasVisiveis.length
  const cardsPainel = [
    {
      id: 'abertas',
      titulo: 'Ordens abertas',
      valor: painel?.ordensAbertas ?? 0,
      acao: () => onOpen('ordem-servico', { situacao: 'ABERTA' }),
    },
    {
      id: 'agendadas',
      titulo: 'Agendadas',
      valor: painel?.ordensAgendadas ?? 0,
      acao: () => onOpen('ordem-servico', { situacao: 'AGENDADA' }),
    },
    {
      id: 'andamento',
      titulo: 'Em andamento',
      valor: painel?.ordensEmAndamento ?? 0,
      acao: () => onOpen('ordem-servico', { situacao: 'EM_ANDAMENTO' }),
    },
    {
      id: 'concluidas',
      titulo: 'Concluídas (conferência)',
      valor: painel?.aguardandoConferencia ?? 0,
      acao: () => onOpen('ordem-servico', { situacao: 'CONCLUIDA' }),
    },
    {
      id: 'receber',
      titulo: 'Recebíveis vencidos',
      valor: painel?.parcelasAtrasadas ?? 0,
      acao: () => onOpen('receber', { filtro: 'vencido' }),
    },
    {
      id: 'estoque',
      titulo: 'Abaixo do estoque mínimo',
      valor: painel?.estoqueBaixo ?? 0,
      acao: () => onOpen('estoque', { filtro: 'repor' }),
    },
    {
      id: 'prev-vencer',
      titulo: 'Preventivas a vencer (60 dias)',
      valor: painel?.preventivasAVencer ?? 0,
      acao: () => onOpen('preventivas', { filtro: 'vencer' }),
    },
    {
      id: 'prev-vencidas',
      titulo: 'Preventivas vencidas',
      valor: painel?.preventivasVencidas ?? 0,
      acao: () => onOpen('preventivas', { filtro: 'vencidas' }),
    },
    {
      id: 'garantias',
      titulo: 'Garantias vigentes',
      valor: painel?.garantiasVigentes ?? 0,
      acao: () => onOpen('garantias', { filtro: 'vigentes' }),
    },
    {
      id: 'chamados-novos',
      titulo: 'Chamados novos',
      valor: painel?.chamadosNovos ?? 0,
      acao: () => onOpen('chamados', { filtro: 'novos' }),
    },
    {
      id: 'privacidade-solicitacoes',
      titulo: 'Solicitações de titular vencidas',
      valor: alertasPrivacidade.solicitacoesVencidas,
      acao: () => onOpen('privacidade', { filtro: 'solicitacoes' }),
    },
    {
      id: 'privacidade-retencao',
      titulo: 'Retenção vencida (não anonimizados)',
      valor: alertasPrivacidade.registrosRetencaoVencidos,
      acao: () => onOpen('privacidade', { filtro: 'retencao' }),
    },
  ]

  /* Home mobile: Ant Design Mobile — fill_body #f5f5f9, cards #fff, spacing 8/16/24, h 15, list 44 */
  const card =
    'relative isolate shrink-0 rounded-md border border-[#ddd] bg-white p-4 shadow-none'
  const tituloSecao = 'text-[15px] font-medium leading-none text-[#333]'
  const textoAux = 'text-xs text-[#888]'

  return (
    <div
      data-ds="ant-mobile-home"
      className="h-full min-h-0 overflow-y-auto overscroll-y-contain bg-[#f5f5f9] lg:flex lg:flex-col lg:overflow-hidden lg:bg-background"
    >
      <div className="relative isolate h-28 shrink-0 overflow-hidden md:h-36">
        <WavesBackground saudacao={false} />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-[15px] pt-4 text-white md:left-6 md:right-auto md:max-w-[70%] md:px-0 md:pt-5">
          <p className="text-xs text-white/80">Olá</p>
          {nome ? <p className="text-[17px] font-semibold leading-tight md:text-xl">{nome}</p> : null}
        </div>
      </div>

      <div className="relative z-0 flex flex-col gap-4 px-[15px] py-4 pb-8 lg:min-h-0 lg:flex-1 lg:gap-4 lg:overflow-hidden lg:bg-background lg:px-3 lg:pb-3">
        {isAdmin ? (
          <section className={card} aria-label="Painel do administrador">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className={tituloSecao}>Painel operacional</h2>
              <span className={textoAux}>Toque no cartão para abrir a lista</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {cardsPainel.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-painel-card={item.id}
                  onClick={item.acao}
                  className="min-h-11 rounded-md border border-[#eee] bg-white px-3 py-3 text-left transition hover:border-primary/40 active:bg-[#f5f5f9]"
                >
                  <p className="text-xs leading-tight text-[#888]">{item.titulo}</p>
                  <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[#333]" data-painel-valor>
                    {item.valor}
                  </p>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <div className="flex flex-col gap-4 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)] lg:grid-rows-[minmax(0,1fr)]">
          <div className="flex flex-col gap-4 lg:min-h-0">
            <section className={card}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className={`inline-flex min-w-0 items-center gap-2 ${tituloSecao}`}>
                  <IconeCalendario className="h-5 w-5 shrink-0 text-primary" />
                  <span className="truncate">
                    {MESES[mes]} de {ano}
                  </span>
                </h2>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMesVisivel(new Date(ano, mes - 1, 1))}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-[#eee] bg-white text-[#333] active:bg-[#f5f5f9] sm:h-9 sm:w-9"
                    aria-label="Mês anterior"
                  >
                    <HiChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMesVisivel(new Date(hojeData.getFullYear(), hojeData.getMonth(), 1))}
                    className="h-11 rounded-md border border-[#eee] bg-white px-3 text-xs font-medium text-[#333] active:bg-[#f5f5f9] sm:h-9"
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => setMesVisivel(new Date(ano, mes + 1, 1))}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-[#eee] bg-white text-[#333] active:bg-[#f5f5f9] sm:h-9 sm:w-9"
                    aria-label="Próximo mês"
                  >
                    <HiChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[#888] sm:gap-2 sm:text-xs">
                {SEMANA.map((dia) => (
                  <span key={dia} className="pb-1 font-medium">
                    <span className="sm:hidden">{dia.slice(0, 1)}</span>
                    <span className="hidden sm:inline">{dia}</span>
                  </span>
                ))}
                {celulas.map((dia, indice) => {
                  if (!dia) return <span key={`vazio-${indice}`} className="aspect-square min-h-8 sm:h-9 sm:aspect-auto" />
                  const data = new Date(ano, mes, dia)
                  const id = chave(data)
                  const feriado = feriados.get(id)
                  const fimDeSemana = data.getDay() === 0 || data.getDay() === 6
                  const ehHoje = id === hoje
                  const classe = ehHoje
                    ? 'border-blue-500 bg-blue-50 font-semibold text-blue-700'
                    : feriado
                      ? feriado.tipo === 'nacional'
                        ? 'border-red-100 bg-red-100 text-red-600'
                        : 'border-amber-200 bg-amber-100 text-amber-900'
                      : fimDeSemana
                        ? 'border-[#eee] bg-white text-[#888]'
                        : 'border-[#eee] bg-white text-[#333]'
                  return (
                    <div
                      key={id}
                      title={feriado?.nome}
                      className={`flex aspect-square min-h-8 items-center justify-center rounded-md border text-xs sm:aspect-auto sm:h-9 ${classe}`}
                    >
                      {dia}
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#888]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-300" /> Dia útil
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-200" /> Fim de semana
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-400" /> Feriado nacional
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" /> Hoje
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-400" /> Ponto facultativo
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-md border border-[#eee] bg-white px-2.5 py-1.5 text-xs text-[#333]">
                  <strong>{uteis}</strong> Dias úteis
                </span>
                <span className="rounded-md border border-[#eee] bg-white px-2.5 py-1.5 text-xs text-[#333]">
                  <strong>{naoUteis}</strong> Não úteis
                </span>
                <span className="rounded-md border border-[#eee] bg-white px-2.5 py-1.5 text-xs text-[#333]">
                  <strong>{facultativos}</strong> Facultativos
                </span>
                <span className="rounded-md border border-[#eee] bg-white px-2.5 py-1.5 text-xs text-[#333]">
                  <strong>{uteisRestantes}</strong> Dias úteis restantes
                </span>
              </div>
            </section>

            <section className={`${card} lg:min-h-0 lg:flex-1 lg:overflow-auto`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className={`inline-flex min-w-0 items-center gap-2 ${tituloSecao}`}>
                  <IconeCalendario className="h-4 w-4 shrink-0 text-primary" /> Próximos feriados
                </h2>
                <span className={`shrink-0 ${textoAux}`}>A partir de hoje</span>
              </div>
              <ul>
                {proximos.map((feriado) => {
                  const data = new Date(`${feriado.data}T12:00:00`)
                  return (
                    <li
                      key={`${feriado.data}-${feriado.nome}`}
                      className="flex min-h-11 flex-col justify-center gap-1 border-t border-[#eee] py-3 text-sm first:border-t-0 sm:flex-row sm:items-center sm:gap-2 sm:py-2"
                    >
                      <span className="shrink-0 text-xs text-[#888]">
                        {data.getDate()} {MESES_CURTOS[data.getMonth()]} · {SEMANA[data.getDay()]}
                      </span>
                      <span className="font-medium text-[#333] sm:min-w-0 sm:flex-1 sm:truncate">{feriado.nome}</span>
                      <span className="flex items-center justify-between gap-2 sm:contents">
                        <span className="text-xs text-[#888]">{diasAte(feriado.data)}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] ${
                            feriado.tipo === 'nacional' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {feriado.tipo === 'nacional' ? 'Feriado nacional' : 'Ponto facultativo'}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          </div>

          <div className="flex flex-col gap-4 lg:min-h-0">
            <section className={card}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className={tituloSecao}>Clima</h2>
                  <p className={`mt-1 truncate ${textoAux}`}>
                    {clima
                      ? `${clima.cidade} · atualizado às ${clima.atualizado}`
                      : localizando
                        ? 'Buscando a localização do aparelho...'
                        : climaErro}
                  </p>
                </div>
                {clima ? <IconeClima codigo={clima.codigo} className="h-8 w-8 shrink-0 text-sky-500" /> : null}
              </div>
              {clima ? (
                <>
                  <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-3xl font-semibold leading-none text-[#333]">{clima.temperatura}°</p>
                      <p className={`mt-1.5 ${textoAux}`}>{clima.descricao}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-[#888] sm:text-right">
                      <span>
                        Umidade
                        <br />
                        <strong className="text-sm text-[#333]">{clima.umidade}%</strong>
                      </span>
                      <span>
                        Sensação
                        <br />
                        <strong className="text-sm text-[#333]">{clima.sensacao}°</strong>
                      </span>
                      <span>
                        Vento
                        <br />
                        <strong className="text-sm text-[#333]">{clima.vento} km/h</strong>
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-5 gap-2">
                    {clima.dias.map((dia, indice) => {
                      const data = new Date(`${dia.data}T12:00:00`)
                      return (
                        <div key={dia.data} className="min-w-0 rounded-md border border-[#eee] bg-white px-1 py-2 text-center">
                          <p className="text-[10px] text-[#888]">
                            {dia.data === hoje ? 'Hoje' : SEMANA[data.getDay()]}
                          </p>
                          <IconeClima
                            codigo={dia.codigo}
                            className={`mx-auto my-0.5 h-4 w-4 text-sky-500 ${movimentoClima(dia.codigo)}`}
                          />
                          <p className="text-xs font-medium text-[#333]">{Math.round(dia.max)}°</p>
                          <p className="text-[10px] text-[#888]">{Math.round(dia.min)}°</p>
                          <NoticiaDoDia frases={dia.noticias} atraso={indice * 700} />
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : null}
            </section>

            <section className={`${card} flex flex-col lg:min-h-0 lg:flex-1 lg:overflow-hidden`}>
              <div className="mb-2 flex min-h-11 items-center justify-between gap-2">
                <h2 className={`inline-flex items-center gap-2 ${tituloSecao}`}>
                  <IconeTarefas className="h-4 w-4 text-primary" /> Tarefas para hoje
                </h2>
                <button
                  type="button"
                  onClick={() => onOpen('tarefas')}
                  className="min-h-11 px-1 text-sm font-medium text-primary hover:underline"
                >
                  Abrir
                </button>
              </div>
              {tarefasVisiveis.length === 0 ? (
                <p className="text-sm text-[#888]">Nenhuma tarefa em aberto.</p>
              ) : (
                <ul className="space-y-2 lg:min-h-0 lg:flex-1 lg:overflow-auto">
                  {tarefasVisiveis.map((tarefa) => (
                    <li key={tarefa.id}>
                      <button
                        type="button"
                        onClick={() => onOpen('tarefas')}
                        className="flex min-h-11 w-full items-center gap-2 rounded-md border border-[#eee] bg-white px-3 text-left text-[#333] active:bg-[#f5f5f9]"
                      >
                        <span
                          className={`w-16 shrink-0 text-xs ${
                            tarefa.quando === 'Atrasada' ? 'font-medium text-red-600' : 'text-[#888]'
                          }`}
                        >
                          {tarefa.quando}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-[#333]">{tarefa.titulo}</span>
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            PRIORIDADE[tarefa.prioridade] || PRIORIDADE.media
                          }`}
                        >
                          {tarefa.prioridade === 'alta' ? 'Alta' : tarefa.prioridade === 'baixa' ? 'Baixa' : 'Média'}
                        </span>
                      </button>
                    </li>
                  ))}
                  {tarefasOcultas > 0 ? (
                    <li className="text-xs text-[#888]">e mais {tarefasOcultas}</li>
                  ) : null}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
