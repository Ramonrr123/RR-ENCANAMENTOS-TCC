import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CampoDataBr } from '@/components/CampoDataBr'
import { FiltrosColapsaveis } from '@/components/FiltrosColapsaveis'
import { CabecalhoModulo, IconeOrdem } from '@/components/icones/IconesErp'
import { formatarDataCurta } from '@/lib/reciboServico'
import { api } from '@/services/api'

type Garantia = {
  id: number
  numero: number
  clienteId: number
  cliente: string
  telefone: string
  enderecoId: number | null
  endereco: string
  servicos: string
  dataEncerramento: string | null
  garantiaAte: string | null
  diasRestantes: number
  ordemAbertaId: number | null
}

const campo = 'h-11 w-full min-w-0 rounded-md border border-[#eee] bg-white px-3 text-sm text-[#333]'
const card = 'rounded-md border border-[#ddd] bg-white p-4'

export function GarantiasModulo({
  onAbrirOrdem,
  abaInicial,
  onAbaConsumida,
}: {
  onAbrirOrdem: (alvo: { clienteId: number; enderecoId: number | null; ordemAbertaId: number | null }) => void
  abaInicial?: 'vigentes' | 'vencidas' | null
  onAbaConsumida?: () => void
}) {
  const [aba, setAba] = useState<'vigentes' | 'vencidas'>(abaInicial || 'vigentes')
  const [lista, setLista] = useState<Garantia[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  useEffect(() => {
    if (!abaInicial) return
    setAba(abaInicial)
    onAbaConsumida?.()
  }, [abaInicial, onAbaConsumida])

  async function carregar(filtro = { de, ate, q: busca, aba }) {
    setCarregando(true)
    const resposta = await api.getGarantias({
      de: filtro.de || undefined,
      ate: filtro.ate || undefined,
      q: filtro.q.trim() || undefined,
      vencidas: filtro.aba === 'vencidas',
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
    void carregar({ de: '', ate: '', q: '', aba })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba])

  return (
    <div
      data-ds="ant-mobile-garantias"
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f5f5f9]"
    >
      <div className="shrink-0 space-y-3 border-b border-[#eee] bg-white px-[15px] py-4">
        <CabecalhoModulo icone={IconeOrdem} titulo="Garantias" />

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAba('vigentes')}
            className={`h-11 rounded-md px-3 text-sm font-medium ${
              aba === 'vigentes' ? 'bg-primary text-primary-foreground' : 'border border-[#eee] bg-white text-[#333]'
            }`}
          >
            Vigentes
          </button>
          <button
            type="button"
            onClick={() => setAba('vencidas')}
            className={`h-11 rounded-md px-3 text-sm font-medium ${
              aba === 'vencidas' ? 'bg-primary text-primary-foreground' : 'border border-[#eee] bg-white text-[#333]'
            }`}
          >
            Vencidas (90 dias)
          </button>
        </div>

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
              placeholder="Buscar cliente ou endereço"
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
            <p className="text-sm text-[#888]">Carregando garantias...</p>
          ) : lista.length === 0 ? (
            <p className="text-sm text-[#888]">Nenhuma garantia nesta lista.</p>
          ) : (
            lista.map((item) => (
              <article key={item.id} className={`${card} space-y-3`}>
                <div className="min-w-0 space-y-1">
                  <p className="break-words text-[15px] font-medium leading-snug text-[#333]">{item.cliente}</p>
                  <p className="text-xs text-[#888]">{item.telefone || 'Sem telefone'}</p>
                  <p className="break-words text-sm text-[#333]">{item.endereco || 'Sem endereço'}</p>
                  {item.servicos ? (
                    <p className="break-words text-sm text-[#666]">{item.servicos}</p>
                  ) : null}
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-[#eee] pt-3">
                  <div className="min-w-0">
                    <p className="text-[11px] text-[#888]">OS</p>
                    <p className="mt-1 text-sm font-medium text-[#333]">
                      {String(item.numero).padStart(4, '0')}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-[#888]">Garantia até</p>
                    <p className="mt-1 text-sm font-medium text-[#333]">
                      {item.garantiaAte ? formatarDataCurta(item.garantiaAte) : '—'}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-[#888]">Dias</p>
                    <p className="mt-1 text-sm font-medium tabular-nums text-[#333]">{item.diasRestantes}</p>
                  </div>
                </div>
                {aba === 'vigentes' ? (
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
                    Nova ordem
                  </button>
                ) : (
                  <p className="text-center text-xs text-[#888]">Consulta</p>
                )}
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
                <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">OS</th>
                <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">Serviço</th>
                <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">Garantia até</th>
                <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">Dias</th>
                <th className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">Ação</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              ) : lista.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhuma garantia nesta lista.
                  </td>
                </tr>
              ) : (
                lista.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-accent/50">
                    <td className="px-4 py-3 text-sm font-medium">{item.cliente}</td>
                    <td className="px-4 py-3 text-sm">{item.telefone || '—'}</td>
                    <td className="px-4 py-3 text-sm">{item.endereco || '—'}</td>
                    <td className="px-4 py-3 text-sm">OS {String(item.numero).padStart(4, '0')}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-sm">{item.servicos || '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      {item.garantiaAte ? formatarDataCurta(item.garantiaAte) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums">{item.diasRestantes}</td>
                    <td className="px-4 py-3 text-sm">
                      {aba === 'vigentes' ? (
                        <button
                          type="button"
                          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                          onClick={() =>
                            onAbrirOrdem({
                              clienteId: item.clienteId,
                              enderecoId: item.enderecoId,
                              ordemAbertaId: item.ordemAbertaId,
                            })
                          }
                        >
                          Nova ordem
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Consulta</span>
                      )}
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
