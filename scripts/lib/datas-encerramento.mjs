/** Mesma conta de `encerrar` em backend/src/ordens/ordens.service.ts */
export const GARANTIA_DIAS = 90
export const PREVENTIVA_MESES = 6

export function hoje() {
  const agora = new Date()
  return new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate(), 12))
}

export function adicionarDias(data, dias) {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate() + dias, 12))
}

export function adicionarMeses(data, meses) {
  const ano = data.getUTCFullYear()
  const mes = data.getUTCMonth() + meses
  const dia = data.getUTCDate()
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0, 12)).getUTCDate()
  return new Date(Date.UTC(ano, mes, Math.min(dia, ultimoDia), 12))
}

export function datasDoEncerramento(encerramento, garantiaDias = GARANTIA_DIAS, preventivaMeses = PREVENTIVA_MESES) {
  return {
    garantiaAte: adicionarDias(encerramento, garantiaDias),
    preventivaEm: adicionarMeses(encerramento, preventivaMeses),
  }
}

export function ymd(data) {
  return data.toISOString().slice(0, 10)
}

export function parseYmd(valor) {
  const texto = valor instanceof Date ? ymd(valor) : String(valor).slice(0, 10)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto)
  if (!match) throw new Error(`Data inválida: ${texto}`)
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12))
}
