import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CampoDataBr } from '@/components/CampoDataBr'
import { FiltrosColapsaveis } from '@/components/FiltrosColapsaveis'
import { CabecalhoModulo, IconeOrdem } from '@/components/icones/IconesErp'
import { formatarDataCurta } from '@/lib/reciboServico'
import { api } from '@/services/api'

type StatusPreventiva = 'a_contatar' | 'contatado' | 'agendada'

type Preventiva = {
  id: number
  numero: number
  clienteId: number
  cliente: string
  telefone: string
  enderecoId: number | null
  endereco: string
  preventivaEm: string | null
  status: StatusPreventiva
  ordemAbertaId: number | null
}

const STATUS: Record<StatusPreventiva, string> = {
  a_contatar: 'A contatar',
  contatado: 'Contatado',
  agendada: 'Agendada',
}

const campo = 'h-11 w-full min-w-0 rounded-md border border-[#eee] bg-white px-3 text-sm text-[#333]'
const card = 'rounded-md border border-[#ddd] bg-white p-4'

export function PreventivasModulo({
  onAbrirOrdem,
  filtroInicial,
  onFiltroConsumido,
}: {
  onAbrirOrdem: (alvo: { clienteId: number; enderecoId: number | null; ordemAbertaId: number | null }) => void
  filtroInicial?: 'vencer' | 'vencidas' | null
  onFiltroConsumido?: () => void
}) {
  const [lista, setLista] = useState<Preventiva[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [salvandoId, setSalvandoId] = useState<number | null>(null)
  const [filtroAtivo, setFiltroAtivo] = useState<'vencer' | 'vencidas' | null>(filtroInicial || null)

  async function carregar(filtro = { de, ate, q: busca }) {
    setCarregando(true)
    const resposta = await api.getPreventivas({
      de: filtro.de || undefined,
      ate: filtro.ate || undefined,
      q: filtro.q.trim() || undefined,
    })
    setCarregando(false)
    if (resposta.error) {
      toast.error(resposta.error)
      setLista([])
      return
    }
    setLista(Array.isArray(resposta.data) ? resposta.data : [])
  }

  useEffect(() => {
    void carregar({ de: '', ate: '', q: '' })
  }, [])

  useEffect(() => {
    if (!filtroInicial) return
    setFiltroAtivo(filtroInicial)
    onFiltroConsumido?.()
  }, [filtroInicial, onFiltroConsumido])

  const listaFiltrada = (() => {
    if (filtroAtivo !== 'vencer' && filtroAtivo !== 'vencidas') return lista
    const hoje = new Date()
    const inicio = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
    return lista.filter((item) => {
      if (!item.preventivaEm) return false
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(item.preventivaEm)
      if (!m) return false
      const dia = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
      return filtroAtivo === 'vencidas' ? dia < inicio : dia >= inicio
    })
  })()

  async function mudarStatus(item: Preventiva, status: StatusPreventiva) {
    const anterior = item.status
    setLista((atual) => atual.map((linha) => (linha.id === item.id ? { ...linha, status } : linha)))
    setSalvandoId(item.id)
    const resposta = await api.atualizarPreventiva(item.id, status)
    setSalvandoId(null)
    if (resposta.error) {
      setLista((atual) => atual.map((linha) => (linha.id === item.id ? { ...linha, status: anterior } : linha)))
      toast.error(resposta.error)
    }
  }

  return (
    <div
      data-ds="ant-mobile-preventivas"
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f5f5f9]"
    >
      <div className="shrink-0 space-y-3 border-b border-[#eee] bg-white px-[15px] py-4">
        <CabecalhoModulo icone={IconeOrdem} titulo="Preventivas" />
        <FiltrosColapsaveis>
          <form
            className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault()
              void carregar()
            }}
          >
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar cliente, telefone ou endereço"
              className={`${campo} sm:col-span-2 lg:col-span-2`}
            />
            <CampoDataBr aria-label="De" value={de} onChange={setDe} className={campo} />
            <CampoDataBr aria-label="Até" value={ate} onChange={setAte} className={campo} />
            <button
              type="submit"
              className="h-11 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground sm:col-span-2 lg:col-span-1"
            >
              Filtrar
            </button>
          </form>
        </FiltrosColapsaveis>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <div className="space-y-3 px-[15px] py-4 md:hidden">
          {carregando ? (
            <p className="text-sm text-[#888]">Carregando preventivas...</p>
          ) : listaFiltrada.length === 0 ? (
            <p className="text-sm text-[#888]">Nenhuma preventiva neste período</p>
          ) : (
            listaFiltrada.map((item) => (
              <article key={item.id} className={`${card} space-y-3`}>
                <div className="min-w-0 space-y-1">
                  <p className="break-words text-[15px] font-medium leading-snug text-[#333]">{item.cliente}</p>
                  <p className="text-xs text-[#888]">{item.telefone || 'Sem telefone'}</p>
                  <p className="break-words text-sm text-[#333]">{item.endereco || 'Sem endereço'}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-[#eee] pt-3">
                  <div className="min-w-0">
                    <p className="text-[11px] text-[#888]">Data</p>
                    <p className="mt-1 text-sm font-medium text-[#333]">
                      {item.preventivaEm ? formatarDataCurta(item.preventivaEm) : '—'}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-[#888]">Status</p>
                    <select
                      aria-label={`Status de ${item.cliente}`}
                      value={item.status}
                      disabled={salvandoId === item.id}
                      onChange={(event) => void mudarStatus(item, event.target.value as StatusPreventiva)}
                      className="mt-1 h-11 w-full rounded-md border border-[#eee] bg-white px-2 text-sm text-[#333]"
                    >
                      {Object.entries(STATUS).map(([valor, rotulo]) => (
                        <option key={valor} value={valor}>
                          {rotulo}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onAbrirOrdem({
                      clienteId: item.clienteId,
                      enderecoId: item.enderecoId,
                      ordemAbertaId: item.ordemAbertaId,
                    })
                  }
                  className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                >
                  {item.ordemAbertaId ? 'Abrir ordem' : 'Nova ordem'}
                </button>
              </article>
            ))
          )}
        </div>

        <div className="hidden md:block">
          <table className="w-full border-collapse bg-white">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr>
                <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">Cliente</th>
                <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">Telefone</th>
                <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">Endereço</th>
                <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">Data</th>
                <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">Ordem</th>
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {carregando ? 'Carregando preventivas...' : 'Nenhuma preventiva neste período'}
                  </td>
                </tr>
              ) : (
                listaFiltrada.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-accent/50">
                    <td className="px-4 py-3 text-sm font-medium">{item.cliente}</td>
                    <td className="px-4 py-3 text-sm">{item.telefone || '—'}</td>
                    <td className="px-4 py-3 text-sm">{item.endereco || '—'}</td>
                    <td className="px-4 py-3 text-sm">{item.preventivaEm ? formatarDataCurta(item.preventivaEm) : '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      <select
                        aria-label={`Status de ${item.cliente}`}
                        value={item.status}
                        disabled={salvandoId === item.id}
                        onChange={(event) => void mudarStatus(item, event.target.value as StatusPreventiva)}
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                      >
                        {Object.entries(STATUS).map(([valor, rotulo]) => (
                          <option key={valor} value={valor}>
                            {rotulo}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        type="button"
                        onClick={() =>
                          onAbrirOrdem({
                            clienteId: item.clienteId,
                            enderecoId: item.enderecoId,
                            ordemAbertaId: item.ordemAbertaId,
                          })
                        }
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        {item.ordemAbertaId ? 'Abrir ordem' : 'Nova ordem'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
