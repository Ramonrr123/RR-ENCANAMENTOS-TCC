import { useEffect, useState } from 'react'
import { CampoDataBr } from '@/components/CampoDataBr'
import { FiltrosColapsaveis } from '@/components/FiltrosColapsaveis'
import { CabecalhoModulo, IconeReceber } from '@/components/icones/IconesErp'
import { api } from '@/services/api'

function dinheiro(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataBr(iso: string | null | undefined) {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]}`
}

function rotuloSituacao(valor: string) {
  const mapa: Record<string, string> = {
    em_dia: 'Em dia',
    vencida: 'Vencida',
    quitada: 'Quitada',
  }
  return mapa[String(valor || '').toLowerCase()] || valor
}

function classeSituacao(valor: string) {
  const s = String(valor || '').toLowerCase()
  if (s === 'vencida') return 'text-red-600'
  if (s === 'quitada') return 'text-emerald-700'
  return 'text-[#888]'
}

function fundoCardSituacao(valor: string) {
  const s = String(valor || '').toLowerCase()
  if (s === 'vencida') return 'border-red-200 bg-red-50'
  if (s === 'quitada') return 'border-emerald-200 bg-emerald-50'
  return 'border-[#ddd] bg-white'
}

function rotuloStatusParcela(status: string, vencimento: string | null) {
  const s = String(status || '').toUpperCase()
  if (s === 'PAGO' || s === 'CANCELADO') return 'Quitada'
  if (s === 'ABERTO' || s === 'PAGO_PARCIAL') {
    if (vencimento && vencimento < new Date().toISOString().slice(0, 10)) return 'Vencida'
    return 'Em dia'
  }
  return status
}

function fundoParcela(statusParcela: string) {
  const s = String(statusParcela || '').toLowerCase()
  if (s === 'vencida') return 'border-red-200 bg-red-50'
  if (s === 'quitada') return 'border-emerald-200 bg-emerald-50'
  return 'border-[#eee] bg-white'
}

const campo =
  'h-11 w-full min-w-0 rounded-md border border-[#eee] bg-white px-3 text-sm text-[#333]'
const card = 'rounded-md border border-[#ddd] bg-white p-4'

export function ControleRecebimentosModulo({ showToast }: { showToast: (msg: string, tipo?: 'success' | 'error') => void }) {
  const [carregando, setCarregando] = useState(true)
  const [situacao, setSituacao] = useState('todas')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [totais, setTotais] = useState({ aReceber: 0, recebidoMes: 0, vencido: 0 })
  const [linhas, setLinhas] = useState<
    Array<{
      ordemId: number
      numero: number
      cliente: string
      total: number
      entrada: number
      saldo: number
      situacao: string
      parcelas: Array<{ parcela?: string | null; valor: number; vencimento: string | null; status: string }>
    }>
  >([])

  async function carregar() {
    setCarregando(true)
    const resposta = await api.getControleRecebimentos({
      de: de || undefined,
      ate: ate || undefined,
      situacao: situacao === 'todas' ? undefined : situacao,
    })
    setCarregando(false)
    if (resposta.error) {
      showToast(resposta.error, 'error')
      setLinhas([])
      return
    }
    setTotais(resposta.data?.totais || { aReceber: 0, recebidoMes: 0, vencido: 0 })
    setLinhas(Array.isArray(resposta.data?.linhas) ? resposta.data!.linhas : [])
  }

  useEffect(() => {
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      data-ds="ant-mobile-financeiro"
      className="h-full min-h-0 overflow-y-auto overscroll-y-contain bg-[#f5f5f9] [-webkit-overflow-scrolling:touch]"
    >
      <div className="space-y-4 border-b border-[#eee] bg-white px-[15px] py-4">
        <CabecalhoModulo icone={IconeReceber} titulo="Controle de recebimentos" />

        <FiltrosColapsaveis>
          <form
            className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault()
              void carregar()
            }}
          >
            <select
              aria-label="Situação"
              value={situacao}
              onChange={(e) => setSituacao(e.target.value)}
              className={campo}
            >
              <option value="todas">Todas</option>
              <option value="em_dia">Em dia</option>
              <option value="vencida">Vencida</option>
              <option value="quitada">Quitada</option>
            </select>
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

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className={card}>
            <p className="text-xs text-[#888]">Total a receber</p>
            <p className="mt-2 text-lg font-semibold tabular-nums text-[#333]">{dinheiro(totais.aReceber)}</p>
          </div>
          <div className={card}>
            <p className="text-xs text-[#888]">Recebido no mês</p>
            <p className="mt-2 text-lg font-semibold tabular-nums text-[#333]">{dinheiro(totais.recebidoMes)}</p>
          </div>
          <div className={card}>
            <p className="text-xs text-[#888]">Vencido</p>
            <p className="mt-2 text-lg font-semibold tabular-nums text-red-600">{dinheiro(totais.vencido)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-[15px] py-4 pb-8">
        {carregando ? (
          <p className="text-sm text-[#888]">Carregando...</p>
        ) : linhas.length === 0 ? (
          <p className="text-sm text-[#888]">Nenhuma ordem neste filtro.</p>
        ) : (
          linhas.map((linha) => (
            <article
              key={linha.ordemId}
              className={`rounded-md border p-4 space-y-4 ${fundoCardSituacao(linha.situacao)}`}
            >
              <div className="min-w-0 space-y-1">
                <h3 className="break-words text-[15px] font-medium leading-snug text-[#333]">
                  OS {String(linha.numero).padStart(4, '0')} — {linha.cliente}
                </h3>
                <p className={`text-xs ${classeSituacao(linha.situacao)}`}>{rotuloSituacao(linha.situacao)}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-[#eee] pt-3">
                <div className="min-w-0">
                  <p className="text-[11px] text-[#888]">Total</p>
                  <p className="mt-1 break-all text-sm font-medium tabular-nums text-[#333]">{dinheiro(linha.total)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-[#888]">Entrada</p>
                  <p className="mt-1 break-all text-sm font-medium tabular-nums text-[#333]">{dinheiro(linha.entrada)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-[#888]">Saldo</p>
                  <p className="mt-1 break-all text-sm font-semibold tabular-nums text-[#333]">{dinheiro(linha.saldo)}</p>
                </div>
              </div>

              <ul className="space-y-2 border-t border-[#eee] pt-3">
                {linha.parcelas.map((parcela, indice) => {
                  const ehEntrada = String(parcela.parcela || '').toUpperCase() === 'ENTRADA'
                  const rotulo = ehEntrada ? 'Entrada' : `Parcela ${parcela.parcela || indice + 1}`
                  const status = rotuloStatusParcela(parcela.status, parcela.vencimento)
                  return (
                    <li
                      key={`${linha.ordemId}-${indice}`}
                      className={`flex min-h-11 flex-col justify-center gap-0.5 rounded-md border px-3 py-2 ${fundoParcela(status)}`}
                    >
                      <span className="text-sm font-medium text-[#333]">
                        {rotulo}: {dinheiro(parcela.valor)}
                      </span>
                      <span className="text-xs text-[#888]">
                        venc. {dataBr(parcela.vencimento)} · {status}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </article>
          ))
        )}
      </div>
    </div>
  )
}
