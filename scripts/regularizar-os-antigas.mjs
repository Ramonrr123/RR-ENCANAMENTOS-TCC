/**
 * Regulariza OS 7, 8, 9 e 11 do seed antigo pelo fluxo real de encerramento.
 * 1) volta para CONCLUIDA com vistoria/serviços/valores
 * 2) apaga títulos OS-000N
 * 3) POST /ordens/:id/encerrar (gera títulos)
 * 4) restaura datas históricas (garantia/preventiva do TCC)
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envText = fs.readFileSync(path.join(root, 'backend', '.env'), 'utf8')
for (const line of envText.split(/\r?\n/)) {
  if (!line.startsWith('DATABASE_URL=')) continue
  let v = line.slice('DATABASE_URL='.length).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  process.env.DATABASE_URL = v
}
const require = createRequire(path.join(root, 'backend', 'package.json'))
const { PrismaClient, OrdemSituacao } = require('@prisma/client')
const prisma = new PrismaClient()
const API = 'http://127.0.0.1:3001'
const EMPRESA = '01'

function lerCaptura() {
  const texto = fs.readFileSync(path.join(root, '.env.captura'), 'utf8')
  const map = {}
  for (const line of texto.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    map[t.slice(0, eq).trim()] = v
  }
  return map
}

function addDays(d, n) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n, 12, 0, 0))
}
function addMonths(d, n) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate(), 12, 0, 0))
  return x
}
function hojeUtc() {
  const n = new Date()
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 12, 0, 0))
}
function iso(d) {
  return d.toISOString().slice(0, 10)
}

async function loginAdmin() {
  const cred = lerCaptura()
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cred.CAPTURA_ADMIN_EMAIL, password: cred.CAPTURA_ADMIN_SENHA }),
  })
  const body = await r.json().catch(() => ({}))
  const token = body.access_token || body.token
  if (!token) throw new Error(`login admin falhou status=${r.status}`)
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Empresa-Codigo': EMPRESA,
  }
}

async function regularizar(numero, datas, headers) {
  const ordem = await prisma.ordemServico.findFirst({
    where: { empresaCodigo: EMPRESA, numero },
    include: { cliente: true },
  })
  if (!ordem) {
    console.log(`SKIP OS ${numero}: não encontrada`)
    return
  }
  const doc = `OS-${String(numero).padStart(4, '0')}`
  await prisma.financeiroTitulo.deleteMany({
    where: { empresaCodigo: EMPRESA, OR: [{ numeroDocumento: doc }, { numeroDocumento: { startsWith: `${doc}-` } }] },
  })

  await prisma.ordemServico.update({
    where: { id: ordem.id },
    data: {
      situacao: OrdemSituacao.CONCLUIDA,
      dataEncerramento: null,
      garantiaAte: null,
      garantiaDias: null,
      preventivaEm: null,
      entradaValor: null,
      vistoria: ordem.vistoria?.trim() || `Vistoria seed OS ${numero}`,
      servicos: ordem.servicos?.trim() || `Serviços seed OS ${numero}`,
      taxaVistoria: Number(ordem.taxaVistoria) || 0,
      maoDeObra: Number(ordem.maoDeObra) || 250,
      material: Number(ordem.material) || 80,
      deslocamento: Number(ordem.deslocamento) || 0,
    },
  })

  const enc = await fetch(`${API}/ordens/${ordem.id}/encerrar`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      formaPagamento: 'PIX',
      parcelas: 1,
      dataVencimento: iso(addDays(hojeUtc(), 15)),
      entradaValor: 0,
      garantiaDias: 90,
      preventivaMeses: 6,
      usarQuintoDiaUtil: false,
    }),
  })
  const body = await enc.json().catch(() => ({}))
  if (enc.status >= 400) throw new Error(`encerrar OS ${numero}: ${enc.status} ${JSON.stringify(body)}`)

  await prisma.ordemServico.update({
    where: { id: ordem.id },
    data: {
      dataAbertura: datas.dataAbertura,
      dataEncerramento: datas.dataEncerramento,
      garantiaAte: datas.garantiaAte,
      garantiaDias: 90,
      preventivaEm: datas.preventivaEm,
      preventivaStatus: datas.preventivaStatus,
    },
  })

  const titulos = await prisma.financeiroTitulo.count({
    where: { empresaCodigo: EMPRESA, numeroDocumento: doc },
  })
  console.log(`OK OS ${numero}: títulos=${titulos}, enc=${iso(datas.dataEncerramento)}, garantia=${iso(datas.garantiaAte)}`)
}

async function main() {
  const health = await fetch(`${API}/health`).then((r) => r.json()).catch((e) => ({ error: e.message }))
  if (health.status !== 'ok') throw new Error(`API indisponível: ${JSON.stringify(health)}`)
  const headers = await loginAdmin()
  const hoje = hojeUtc()
  const encGarantia = addDays(hoje, -30)
  const encGarantiaVencida = addDays(hoje, -120)
  const encPrevAtrasada = addDays(addMonths(hoje, -6), -8)
  const encVisita = addDays(addMonths(hoje, -6), 20)

  await regularizar(7, {
    dataAbertura: addDays(encGarantia, -5),
    dataEncerramento: encGarantia,
    garantiaAte: addDays(encGarantia, 90),
    preventivaEm: addMonths(encGarantia, 6),
    preventivaStatus: 'a_contatar',
  }, headers)

  await regularizar(8, {
    dataAbertura: addDays(encPrevAtrasada, -3),
    dataEncerramento: encPrevAtrasada,
    garantiaAte: addDays(encPrevAtrasada, 90),
    preventivaEm: addMonths(encPrevAtrasada, 6),
    preventivaStatus: 'contatado',
  }, headers)

  await regularizar(9, {
    dataAbertura: addDays(encVisita, -2),
    dataEncerramento: encVisita,
    garantiaAte: addDays(encVisita, 90),
    preventivaEm: addMonths(encVisita, 6),
    preventivaStatus: 'agendada',
  }, headers)

  await regularizar(11, {
    dataAbertura: addDays(encGarantiaVencida, -4),
    dataEncerramento: encGarantiaVencida,
    garantiaAte: addDays(encGarantiaVencida, 90),
    preventivaEm: addMonths(encGarantiaVencida, 6),
    preventivaStatus: 'a_contatar',
  }, headers)

  console.log('regularizar-os-antigas — concluído')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
