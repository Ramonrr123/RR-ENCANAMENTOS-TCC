/**
 * Confere que toda ordem seed de garantia/preventiva segue a regra do encerrar:
 * garantiaAte = encerramento + 90d e preventivaEm = encerramento + 6 meses.
 *
 * Uso: node scripts/checar-datas-seed.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import {
  datasDoEncerramento,
  parseYmd,
  ymd,
} from './lib/datas-encerramento.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const require = createRequire(path.join(ROOT, 'backend', 'package.json'))
const { PrismaClient } = require('@prisma/client')

const EMPRESA = '01'
const NOMES = [
  'Cliente Fictício Garantia TCC',
  'Cliente Fictício Garantia Vencida',
  'Cliente Fictício Visita Agendada',
  'Cliente Fictício Preventiva Atrasada',
]

function carregarEnv() {
  for (const rel of ['.env', 'backend/.env']) {
    const arquivo = path.join(ROOT, rel)
    if (!fs.existsSync(arquivo)) continue
    for (const linha of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
      const i = linha.indexOf('=')
      if (i < 1 || linha.trimStart().startsWith('#')) continue
      const chave = linha.slice(0, i).trim()
      const valor = linha.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!(chave in process.env)) process.env[chave] = valor
    }
  }
}

function exigirLocalhost(url) {
  if (!url) throw new Error('DATABASE_URL ausente.')
  if (/supabase/i.test(url)) throw new Error('Recusado: DATABASE_URL aponta para Supabase.')
  const host = (url.match(/@([^/:]+)/) || [])[1] || ''
  if (!/^(localhost|127\.0\.0\.1)$/i.test(host)) {
    throw new Error(`Recusado: host do banco não é localhost (obtido: ${host || 'desconhecido'}).`)
  }
}

carregarEnv()
exigirLocalhost(process.env.DATABASE_URL)

const prisma = new PrismaClient()

try {
  const ordens = await prisma.ordemServico.findMany({
    where: {
      empresaCodigo: EMPRESA,
      cliente: { nome: { in: NOMES } },
      dataEncerramento: { not: null },
      garantiaAte: { not: null },
      preventivaEm: { not: null },
    },
    include: { cliente: { select: { nome: true } } },
    orderBy: { numero: 'asc' },
  })

  if (ordens.length === 0) {
    throw new Error('Nenhuma ordem seed com as duas datas encontrada.')
  }

  const falhas = []
  const ok = []

  for (const ordem of ordens) {
    const encerramento = parseYmd(ordem.dataEncerramento)
    const esperado = datasDoEncerramento(encerramento)
    const garantiaOk = ymd(ordem.garantiaAte) === ymd(esperado.garantiaAte)
    const preventivaOk = ymd(ordem.preventivaEm) === ymd(esperado.preventivaEm)
    const linha = {
      numero: ordem.numero,
      cliente: ordem.cliente.nome,
      encerramento: ymd(encerramento),
      garantiaAte: ymd(ordem.garantiaAte),
      preventivaEm: ymd(ordem.preventivaEm),
      esperadoGarantiaAte: ymd(esperado.garantiaAte),
      esperadoPreventivaEm: ymd(esperado.preventivaEm),
    }
    if (!garantiaOk || !preventivaOk) falhas.push(linha)
    else ok.push(linha)
  }

  if (falhas.length) {
    console.error(JSON.stringify({ ok: false, conferidas: ordens.length, falhas }, null, 2))
    process.exitCode = 1
  } else {
    console.log(JSON.stringify({ ok: true, conferidas: ok.length, ordens: ok }, null, 2))
  }
} catch (erro) {
  console.error('FALHA', String(erro.message || erro))
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
