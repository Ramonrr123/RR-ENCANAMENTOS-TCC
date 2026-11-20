import { useEffect, useState } from 'react'
import { ExportarRelatorio } from '@/components/ExportarRelatorio'
import { CabecalhoModulo, IconeFluxo } from '@/components/icones/IconesErp'
import { api, type FluxoCaixaMes, type FluxoCaixaRelatorio } from '@/services/api'

function moeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataBr(valor: string) {
  const [ano, mes, dia] = valor.split('-')
  if (!ano || !mes || !dia) return valor
  return `${dia}/${mes}/${ano}`
}

function rotuloMes(mes: string) {
  const [ano, numero] = mes.split('-')
  const data = new Date(Date.UTC(Number(ano), Number(numero) - 1, 1, 12))
  const texto = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function intervaloPadrao() {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth()
  const ultimo = new Date(ano, mes + 1, 0).getDate()
  return {
    de: `${ano}-${String(mes + 1).padStart(2, '0')}-01`,
    ate: `${ano}-${String(mes + 1).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`,
  }
}

function classeSaldo(valor: number) {
  if (valor < 0) return 'text-red-600'
  return 'text-[#333]'
}

function mesesEntre(de: string, ate: string) {
  const meses: FluxoCaixaMes[] = []
  let ano = Number(de.slice(0, 4))
  let mes = Number(de.slice(5, 7))
  const anoFim = Number(ate.slice(0, 4))
  const mesFim = Number(ate.slice(5, 7))
  while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
    meses.push({
      mes: `${ano}-${String(mes).padStart(2, '0')}`,
      entradasPrevistas: 0,
      saidasPrevistas: 0,
      saldoPrevisto: 0,
      entradasRealizadas: 0,
      saidasRealizadas: 0,
      saldoRealizado: 0,
    })
    mes += 1
    if (mes > 12) {
      mes = 1
      ano += 1
    }
    if (meses.length > 120) break
  }
  return meses
}

function relatorioVazio(de: string, ate: string): FluxoCaixaRelatorio {
  const meses = mesesEntre(de, ate)
  return {
    de,
    ate,
    titulos: 0,
    meses,
    totais: {
      entradasPrevistas: 0,
      saidasPrevistas: 0,
      saldoPrevisto: 0,
      entradasRealizadas: 0,
      saidasRealizadas: 0,
      saldoRealizado: 0,
    },
  }
}

const campo = 'h-11 w-full min-w-0 rounded-md border border-[#eee] bg-white px-3 text-sm text-[#333]'
const card = 'rounded-md border border-[#ddd] bg-white p-4'

export function FluxoCaixa({
  showToast,
}: {
  showToast: (message: string, type?: 'success' | 'error') => void
}) {
  const inicial = intervaloPadrao()
  const [de, setDe] = useState(inicial.de)
  const [ate, setAte] = useState(inicial.ate)
  const [relatorio, setRelatorio] = useState<FluxoCaixaRelatorio | null>(null)
  const [carregando, setCarregando] = useState(true)

  async function carregar(inicio = de, fim = ate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) {
      showToast('Informe as datas no formato AAAA-MM-DD.', 'error')
      return
    }
    if (inicio > fim) {
      showToast('A data inicial não pode ser maior que a data final.', 'error')
      return
    }
    setCarregando(true)
    const response = await api.getFluxoCaixa(inicio, fim)
    if (response.data) setRelatorio(response.data)
    else if (!response.error) setRelatorio(relatorioVazio(inicio, fim))
    else {
      setRelatorio(null)
      showToast(response.error, 'error')
    }
    setCarregando(false)
  }

  useEffect(() => {
    void carregar(inicial.de, inicial.ate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const semTitulos = Boolean(relatorio && relatorio.titulos === 0)

  return (
    <div
      data-ds="ant-mobile-financeiro"
      className="h-full min-h-0 overflow-y-auto overscroll-y-contain bg-[#f5f5f9] [-webkit-overflow-scrolling:touch]"
    >
      <div className="space-y-4 border-b border-[#eee] bg-white px-[15px] py-4">
        <CabecalhoModulo
          icone={IconeFluxo}
          titulo="Fluxo de caixa"
          acoes={<ExportarRelatorio tipo="fluxo" de={de} ate={ate} showToast={showToast} />}
        />
        <form
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault()
            void carregar()
          }}
        >
          <input type="date" value={de} onChange={(event) => setDe(event.target.value)} aria-label="De" className={campo} />
          <input type="date" value={ate} onChange={(event) => setAte(event.target.value)} aria-label="Até" className={campo} />
          <button type="submit" className="h-11 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
            Consultar
          </button>
        </form>
      </div>

      {relatorio ? (
        <div className="grid grid-cols-1 gap-2 border-b border-[#eee] bg-white px-[15px] py-4 sm:grid-cols-3">
          <div className={card}>
            <p className="text-xs text-[#888]">Entradas realizadas</p>
            <p className="mt-2 text-lg font-semibold tabular-nums text-[#333]">{moeda(relatorio.totais.entradasRealizadas)}</p>
            <p className="mt-1 text-xs text-[#888]">Previstas {moeda(relatorio.totais.entradasPrevistas)}</p>
          </div>
          <div className={card}>
            <p className="text-xs text-[#888]">Saídas realizadas</p>
            <p className="mt-2 text-lg font-semibold tabular-nums text-[#333]">{moeda(relatorio.totais.saidasRealizadas)}</p>
            <p className="mt-1 text-xs text-[#888]">Previstas {moeda(relatorio.totais.saidasPrevistas)}</p>
          </div>
          <div className={card}>
            <p className="text-xs text-[#888]">Saldo realizado</p>
            <p className={`mt-2 text-lg font-semibold tabular-nums ${classeSaldo(relatorio.totais.saldoRealizado)}`}>
              {moeda(relatorio.totais.saldoRealizado)}
            </p>
            <p className={`mt-1 text-xs ${classeSaldo(relatorio.totais.saldoPrevisto)}`}>
              Previsto {moeda(relatorio.totais.saldoPrevisto)}
            </p>
          </div>
        </div>
      ) : null}

      <div className="px-[15px] py-4 pb-8">
        {semTitulos ? (
          <p className="text-sm text-[#888]">Nenhum título registrado neste período.</p>
        ) : relatorio ? (
          <p className="mb-4 text-sm text-[#888]">
            {dataBr(relatorio.de)} a {dataBr(relatorio.ate)} · {relatorio.titulos}{' '}
            {relatorio.titulos === 1 ? 'título entrou' : 'títulos entraram'} na soma.
          </p>
        ) : null}

        {/* Mobile cards */}
        <div className="space-y-3 pb-2 lg:hidden">
          {carregando ? (
            <p className="text-sm text-[#888]">Carregando fluxo de caixa...</p>
          ) : !relatorio ? (
            <p className="text-sm text-[#888]">Não foi possível consultar o fluxo de caixa.</p>
          ) : (
            <>
              {relatorio.meses.map((mes) => (
                <article key={mes.mes} className={`${card} space-y-3`}>
                  <h3 className="text-[15px] font-medium text-[#333]">{rotuloMes(mes.mes)}</h3>
                  <div className="grid grid-cols-2 gap-3 border-t border-[#eee] pt-3">
                    <div className="min-w-0">
                      <p className="text-[11px] text-[#888]">Entradas</p>
                      <p className="mt-1 break-all text-sm font-medium tabular-nums text-[#333]">{moeda(mes.entradasRealizadas)}</p>
                      <p className="mt-0.5 text-[11px] text-[#888]">Prev. {moeda(mes.entradasPrevistas)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] text-[#888]">Saídas</p>
                      <p className="mt-1 break-all text-sm font-medium tabular-nums text-[#333]">{moeda(mes.saidasRealizadas)}</p>
                      <p className="mt-0.5 text-[11px] text-[#888]">Prev. {moeda(mes.saidasPrevistas)}</p>
                    </div>
                  </div>
                  <div className="border-t border-[#eee] pt-3">
                    <p className="text-[11px] text-[#888]">Saldo realizado</p>
                    <p className={`mt-1 text-base font-semibold tabular-nums ${classeSaldo(mes.saldoRealizado)}`}>
                      {moeda(mes.saldoRealizado)}
                    </p>
                    <p className={`mt-0.5 text-xs ${classeSaldo(mes.saldoPrevisto)}`}>
                      Previsto {moeda(mes.saldoPrevisto)}
                    </p>
                  </div>
                </article>
              ))}
              <article className={`${card} space-y-2 border-[#ddd] bg-white`}>
                <h3 className="text-[15px] font-semibold text-[#333]">Total</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] text-[#888]">Entradas</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums">{moeda(relatorio.totais.entradasRealizadas)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#888]">Saídas</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums">{moeda(relatorio.totais.saidasRealizadas)}</p>
                  </div>
                </div>
                <p className={`text-base font-semibold tabular-nums ${classeSaldo(relatorio.totais.saldoRealizado)}`}>
                  Saldo {moeda(relatorio.totais.saldoRealizado)}
                </p>
              </article>
            </>
          )}
        </div>

        {/* Desktop table */}
        <table className="mt-0 hidden w-full border-collapse lg:table lg:min-w-[980px]">
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              <th className="border-b border-[#eee] px-4 py-2 text-left text-xs font-medium text-[#888]">Mês</th>
              <th className="border-b border-[#eee] px-4 py-2 text-right text-xs font-medium text-[#888]">Entradas previstas</th>
              <th className="border-b border-[#eee] px-4 py-2 text-right text-xs font-medium text-[#888]">Saídas previstas</th>
              <th className="border-b border-[#eee] px-4 py-2 text-right text-xs font-medium text-[#888]">Saldo previsto</th>
              <th className="border-b border-[#eee] px-4 py-2 text-right text-xs font-medium text-[#888]">Entradas realizadas</th>
              <th className="border-b border-[#eee] px-4 py-2 text-right text-xs font-medium text-[#888]">Saídas realizadas</th>
              <th className="border-b border-[#eee] px-4 py-2 text-right text-xs font-medium text-[#888]">Saldo realizado</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {carregando ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[#888]">
                  Carregando fluxo de caixa...
                </td>
              </tr>
            ) : !relatorio ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[#888]">
                  Não foi possível consultar o fluxo de caixa.
                </td>
              </tr>
            ) : (
              relatorio.meses.map((mes) => <Linha key={mes.mes} mes={mes} />)
            )}
          </tbody>
          {relatorio && !carregando ? (
            <tfoot>
              <Linha
                mes={{
                  mes: 'Total',
                  ...relatorio.totais,
                }}
                total
              />
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  )
}

function Linha({ mes, total = false }: { mes: FluxoCaixaMes; total?: boolean }) {
  const classe = total ? 'border-t border-[#eee] bg-[#f5f5f9] font-semibold' : 'border-b border-[#eee]'
  return (
    <tr className={classe}>
      <td className="whitespace-nowrap px-2 py-2 text-sm text-[#333] sm:px-4">{total ? 'Total' : rotuloMes(mes.mes)}</td>
      <td className="px-4 py-2 text-right text-sm tabular-nums text-[#333]">{moeda(mes.entradasPrevistas)}</td>
      <td className="px-4 py-2 text-right text-sm tabular-nums text-[#333]">{moeda(mes.saidasPrevistas)}</td>
      <td className={`px-4 py-2 text-right text-sm tabular-nums ${classeSaldo(mes.saldoPrevisto)}`}>{moeda(mes.saldoPrevisto)}</td>
      <td className="px-4 py-2 text-right text-sm tabular-nums text-[#333]">{moeda(mes.entradasRealizadas)}</td>
      <td className="px-4 py-2 text-right text-sm tabular-nums text-[#333]">{moeda(mes.saidasRealizadas)}</td>
      <td className={`px-4 py-2 text-right text-sm tabular-nums ${classeSaldo(mes.saldoRealizado)}`}>{moeda(mes.saldoRealizado)}</td>
    </tr>
  )
}
