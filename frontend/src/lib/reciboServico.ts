export const EMPRESA_RECIBO = {
  nome: 'RR Encanamentos',
  responsavel: 'RICARDO ROCHA',
  cnpj: '32.710.190/0001-27',
  endereco: 'João Fernandes de Aquino, 92',
  bairroCidade: 'São Pedro- Porto União',
  cidade: 'Porto União',
}

export type OrdemServico = {
  id: string
  numero: number
  cliente: string
  whatsapp: string
  endereco: string
  cidade: string
  data: string
  servicos: string[]
  vistoria: string
  maoDeObra: number
  material: number
  taxaVistoria: number
  deslocamento: number
  total: number
  assinatura: string
}

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
const DEZ_A_19 = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

function grupo(valor: number) {
  if (valor === 0) return ''
  if (valor === 100) return 'cem'
  const centena = Math.floor(valor / 100)
  const dezena = Math.floor((valor % 100) / 10)
  const unidade = valor % 10
  const partes: string[] = []
  if (centena) partes.push(CENTENAS[centena])
  if (dezena === 1) partes.push(DEZ_A_19[unidade])
  else {
    if (dezena) partes.push(DEZENAS[dezena])
    if (unidade) partes.push(UNIDADES[unidade])
  }
  return partes.join(' e ')
}

function inteiroPorExtenso(valor: number) {
  if (valor === 0) return 'zero'
  const milhoes = Math.floor(valor / 1_000_000)
  const milhares = Math.floor((valor % 1_000_000) / 1000)
  const resto = valor % 1000
  const partes: string[] = []
  if (milhoes === 1) partes.push('um milhão')
  else if (milhoes > 1) partes.push(`${grupo(milhoes)} milhões`)
  if (milhares === 1) partes.push('mil')
  else if (milhares > 1) partes.push(`${grupo(milhares)} mil`)
  if (resto) partes.push(grupo(resto))
  return partes.join(' e ')
}

export function valorPorExtenso(valor: number) {
  const centavosTotal = Math.round(Math.abs(valor) * 100)
  const reais = Math.floor(centavosTotal / 100)
  const centavos = centavosTotal % 100
  const usaDe = reais > 0 && reais % 1_000_000 === 0
  let reaisTexto = 'zero real'
  if (reais === 1) reaisTexto = 'um real'
  else if (reais > 1) reaisTexto = `${inteiroPorExtenso(reais)}${usaDe ? ' de' : ''} reais`
  if (centavos === 0) return reaisTexto
  const centavosTexto = centavos === 1 ? 'um centavo' : `${grupo(centavos)} centavos`
  if (reais === 0) return centavosTexto
  return `${reaisTexto} e ${centavosTexto}`
}

export function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function parseMoeda(valor: string) {
  const limpo = valor.trim().replace(/\s/g, '').replace(/R\$/gi, '')
  if (!limpo) return 0
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  const numero = Number(normalizado)
  return Number.isFinite(numero) ? numero : 0
}

export function moedaCampo(valor: number) {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Digita centavos e exibe R$ 0,00 (mantém o input estável no mobile). */
export function mascararMoedaDigitada(valor: string) {
  const digitos = valor.replace(/\D/g, '').slice(0, 15)
  if (!digitos) return ''
  return formatarMoeda(Number(digitos) / 100)
}

export function dataRecibo(iso: string, cidade: string) {
  const [ano, mes, dia] = iso.split('-').map(Number)
  if (!ano || !mes || !dia) return cidade || EMPRESA_RECIBO.cidade
  return `${cidade.trim() || EMPRESA_RECIBO.cidade}, ${dia} de ${MESES[mes - 1]} de ${ano}.`
}

export function formatarDataCurta(iso: string) {
  const [ano, mes, dia] = iso.split('-')
  if (!ano || !mes || !dia) return '-'
  return `${dia}/${mes}/${ano}`
}

export function hojeISO() {
  const data = new Date()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mes}-${dia}`
}

export function whatsappDestino(telefone: string) {
  let digitos = telefone.replace(/\D/g, '')
  if (digitos.startsWith('00')) digitos = digitos.slice(2)
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`
  return digitos.length >= 12 ? digitos : ''
}
