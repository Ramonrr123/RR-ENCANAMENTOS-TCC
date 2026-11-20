/**
 * Testes de segurança (banco local). Sem segredos. Saída: testes_seguranca.txt
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const api = 'http://127.0.0.1:3001'
const destA = path.resolve('C:\\Users\\ramon\\OneDrive\\Desktop\\imagens tcc\\respostas2')
const destB = path.resolve('C:\\Users\\ramon\\OneDrive\\Desktop\\resposta e imagens')
const linhas = []
let passou = 0
let falhou = 0

const envText = fs.readFileSync(path.join(root, 'backend', '.env'), 'utf8')
for (const line of envText.split(/\r?\n/)) {
  if (!line.startsWith('DATABASE_URL=')) continue
  let v = line.slice('DATABASE_URL='.length).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  process.env.DATABASE_URL = v
}
const require = createRequire(path.join(root, 'backend', 'package.json'))
const bcrypt = require('bcrypt')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function log(msg) {
  linhas.push(msg)
  console.log(msg)
}

async function assert(nome, cond, detalhe = '') {
  if (cond) {
    passou += 1
    log(`PASS ${nome}`)
  } else {
    falhou += 1
    log(`FAIL ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  }
}

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

function payloadChamado(extra = {}) {
  return {
    tipo: 'Vazamento',
    nome: 'Cliente Seguranca Teste',
    telefone: '(42) 98877-6655',
    cep: '84600000',
    logradouro: 'Rua Segura',
    numero: '10',
    bairro: 'Centro',
    cidade: 'União da Vitória',
    uf: 'PR',
    descricao: 'Chamado fictício para teste de segurança',
    aceite: true,
    website: '',
    startedAt: Date.now() - 10000,
    origem: 'site',
    ...extra,
  }
}

async function limparCotaIp() {
  const desde = new Date(Date.now() - 60 * 60 * 1000)
  await prisma.chamado.updateMany({
    where: { createdAt: { gte: desde }, ipOrigem: { not: null } },
    data: { ipOrigem: 'teste-reset-seg' },
  })
  await prisma.acessoBloqueio.deleteMany({
    where: { OR: [{ chave: { startsWith: 'consulta-ip:' } }, { chave: { startsWith: 'login:' } }] },
  })
}

async function main() {
  log(`=== testes_seguranca ${new Date().toISOString()} ===`)
  log('Referência: banco local, sem Supabase, sem impressão de segredos.')

  const health = await fetch(`${api}/health`)
  const helmet = health.headers.get('x-content-type-options')
  await assert('Helmet X-Content-Type-Options=nosniff', String(helmet || '').toLowerCase() === 'nosniff', `got=${helmet}`)

  const html = await fetch(`${api}/chamados`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payloadChamado({ nome: 'Ana <b>Silva</b>' })),
  }).then(async (r) => ({ status: r.status }))
  await assert('Abertura rejeita HTML no nome', html.status >= 400, `status=${html.status}`)

  const honeypot = await fetch(`${api}/chamados`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payloadChamado({ website: 'http://spam.invalid', nome: 'Bot Ficticio' })),
  }).then(async (r) => ({ status: r.status }))
  await assert('Honeypot website bloqueia abertura', honeypot.status >= 400, `status=${honeypot.status}`)

  const rapido = await fetch(`${api}/chamados`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payloadChamado({ startedAt: Date.now(), nome: 'Envio Rapido' })),
  }).then(async (r) => ({ status: r.status }))
  await assert('Espera de 3s na abertura', rapido.status >= 400, `status=${rapido.status}`)

  await limparCotaIp()

  // Senha nova de 8 caracteres
  const aberto = await fetch(`${api}/chamados`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payloadChamado({ nome: 'Cliente Senha Nova' })),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))
  const senhaNova = String(aberto.body?.senha || '')
  await assert('Abertura cria chamado', aberto.status < 400 && Boolean(aberto.body?.numero), `status=${aberto.status}`)
  await assert('Senha nova tem 8 caracteres', senhaNova.length === 8, `len=${senhaNova.length}`)
  await assert(
    'Senha nova só no alfabeto permitido',
    /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(senhaNova),
    'formato inválido',
  )

  const numeroOk = Number(aberto.body?.numero)

  // Bloqueio após 5 erros por número
  await prisma.chamado.update({
    where: { id: (await prisma.chamado.findFirst({ where: { numero: numeroOk } })).id },
    data: { tentativasErradas: 0, bloqueadoAte: null },
  })
  let status5 = 0
  for (let i = 0; i < 5; i += 1) {
    status5 = await fetch(`${api}/chamados/consulta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero: numeroOk, senha: 'ERRADAXX' }),
    }).then((r) => r.status)
  }
  const rowNum = await prisma.chamado.findFirst({ where: { numero: numeroOk } })
  await assert('5 erros por número → 401', status5 === 401, `status=${status5}`)
  await assert('5 erros por número → tentativasErradas=5', rowNum?.tentativasErradas === 5, `t=${rowNum?.tentativasErradas}`)
  await assert('5 erros por número → bloqueadoAte preenchido', Boolean(rowNum?.bloqueadoAte), 'bloqueadoAte vazio')

  // Limpa bloqueio do número e do IP para o próximo teste
  await prisma.chamado.update({
    where: { id: rowNum.id },
    data: { tentativasErradas: 0, bloqueadoAte: null },
  })
  await prisma.acessoBloqueio.deleteMany({ where: { chave: { startsWith: 'consulta-ip:' } } })

  // Bloqueio por IP (números inexistentes)
  let statusIp = 0
  for (let i = 0; i < 5; i += 1) {
    statusIp = await fetch(`${api}/chamados/consulta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero: 900000 + i, senha: 'ERRADAXX' }),
    }).then((r) => r.status)
  }
  const bloqueiosIp = await prisma.acessoBloqueio.findMany({
    where: { chave: { startsWith: 'consulta-ip:' }, bloqueadoAte: { gt: new Date() } },
  })
  await assert('5 erros por IP → 401', statusIp === 401, `status=${statusIp}`)
  await assert('5 erros por IP → acesso_bloqueios ativo', bloqueiosIp.length >= 1, `n=${bloqueiosIp.length}`)

  await prisma.acessoBloqueio.deleteMany({ where: { chave: { startsWith: 'consulta-ip:' } } })

  // Senha antiga de 6 números
  const hash6 = await bcrypt.hash('012345', 10)
  await prisma.chamado.update({
    where: { id: rowNum.id },
    data: { senhaHash: hash6, tentativasErradas: 0, bloqueadoAte: null },
  })
  const consulta6 = await fetch(`${api}/chamados/consulta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numero: numeroOk, senha: '012345' }),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))
  await assert('Senha antiga de 6 números ainda consulta', consulta6.status === 200 || consulta6.status === 201, `status=${consulta6.status}`)

  // Limite de 5 chamados por hora
  await limparCotaIp()
  let ultimoStatus = 0
  let msgLimite = ''
  for (let i = 0; i < 6; i += 1) {
    const r = await fetch(`${api}/chamados`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadChamado({ nome: `Cliente Limite Hora ${i}`, telefone: `(42) 97777-00${10 + i}` })),
    })
    const body = await r.json().catch(() => ({}))
    ultimoStatus = r.status
    msgLimite = String(body.message || body.error || '')
  }
  await assert('6º chamado na hora é recusado', ultimoStatus >= 400, `status=${ultimoStatus}`)
  await assert(
    'Mensagem de limite por IP/hora',
    /Muitos chamados neste acesso/i.test(msgLimite),
    `msg=${msgLimite.slice(0, 80)}`,
  )
  await limparCotaIp()

  // Bloqueio de login após 5 erros (usuário de teste)
  const cred = lerCaptura()
  const funcLogin = cred.CAPTURA_FUNC_EMAIL || 'captura.teste'
  const funcUser = await prisma.crmUsuarios.findFirst({
    where: { OR: [{ login: funcLogin }, { email: funcLogin }] },
  })
  if (funcUser) {
    await prisma.acessoBloqueio.deleteMany({ where: { chave: `login:${funcUser.id}` } })
    let statusLogin = 0
    for (let i = 0; i < 5; i += 1) {
      statusLogin = await fetch(`${api}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: funcLogin, password: 'senha-errada-xyz' }),
      }).then((r) => r.status)
    }
    const bloqLogin = await prisma.acessoBloqueio.findUnique({ where: { chave: `login:${funcUser.id}` } })
    await assert('5 erros de login → falha', statusLogin === 401 || statusLogin === 403, `status=${statusLogin}`)
    await assert('5 erros de login → bloqueio ativo', Boolean(bloqLogin?.bloqueadoAte), 'sem bloqueio')
    // limpa para não travar o usuário de captura
    await prisma.acessoBloqueio.deleteMany({ where: { chave: `login:${funcUser.id}` } })
  } else {
    await assert('Usuário captura.teste presente', false, 'não encontrado')
  }

  const cors = await fetch(`${api}/health`, { headers: { Origin: 'https://site-nao-autorizado.invalid' } })
  const allow = cors.headers.get('access-control-allow-origin')
  await assert('CORS não libera origem estranha', !allow, `allow=${allow}`)

  log(`=== resumo: passou=${passou} falhou=${falhou} ===`)
  const out = `${linhas.join('\n')}\n`
  fs.mkdirSync(destA, { recursive: true })
  fs.mkdirSync(destB, { recursive: true })
  fs.writeFileSync(path.join(destA, 'testes_seguranca.txt'), out, 'utf8')
  fs.writeFileSync(path.join(destB, 'testes_seguranca.txt'), out, 'utf8')
  await prisma.$disconnect()
  process.exit(falhou ? 1 : 0)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
