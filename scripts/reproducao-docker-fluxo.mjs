/**
 * Reprodução com Docker: sobe API/front em portas alternativas e roda fluxo mínimo.
 * Postgres do compose em 5433 (já existente da prova anterior) ou sobe se preciso.
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const destA = path.resolve('C:\\Users\\ramon\\OneDrive\\Desktop\\imagens tcc\\respostas2')
const destB = path.resolve('C:\\Users\\ramon\\OneDrive\\Desktop\\resposta e imagens')
const API_PORT = 3011
const WEB_PORT = 5183
const DB_URL = 'postgresql://erp:erp@127.0.0.1:5433/erp?schema=public'
const JWT = 'repro-local-ficticio-nao-usar-em-prod'
const linhas = []
const require = createRequire(path.join(root, 'backend', 'package.json'))

function log(msg) {
  linhas.push(msg)
  console.log(msg)
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function waitHttp(url, tentativas = 40) {
  for (let i = 0; i < tentativas; i += 1) {
    try {
      const r = await fetch(url)
      if (r.ok || r.status < 500) return true
    } catch {
      // retry
    }
    await sleep(1000)
  }
  return false
}

function startProc(cmd, args, env, cwd) {
  const child = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', () => {})
  child.stderr.on('data', () => {})
  return child
}

async function main() {
  log(`=== reproducao fluxo ${new Date().toISOString()} ===`)
  log(`API :${API_PORT} | front :${WEB_PORT} | DB 5433`)

  // Garante container
  try {
    const { execSync } = await import('node:child_process')
    const ps = execSync('docker ps --format "{{.Names}} {{.Ports}}"', { encoding: 'utf8' })
    if (!ps.includes('5433')) {
      log('WARN: container 5433 não visto; tentando compose no projeto')
      execSync('docker compose up -d', { cwd: root, stdio: 'inherit' })
    } else {
      log('OK Postgres Docker em 5433')
    }
  } catch (e) {
    log(`WARN docker: ${e.message}`)
  }

  const backendEnv = {
    DATABASE_URL: DB_URL,
    JWT_SECRET: JWT,
    PORT: String(API_PORT),
    CORS_ORIGINS: `http://127.0.0.1:${WEB_PORT},http://localhost:${WEB_PORT}`,
  }
  const frontEnv = {
    VITE_API_URL: `http://127.0.0.1:${API_PORT}`,
    VITE_PUBLIC_APP_URL: 'https://exemplo-empresa.com.br',
  }

  const apiProc = startProc('npm', ['run', 'start:dev'], backendEnv, path.join(root, 'backend'))
  const webProc = startProc('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(WEB_PORT)], frontEnv, path.join(root, 'frontend'))

  const apiOk = await waitHttp(`http://127.0.0.1:${API_PORT}/health`, 60)
  const webOk = await waitHttp(`http://127.0.0.1:${WEB_PORT}/`, 60)
  log(`API health: ${apiOk ? 'ok' : 'FALHOU'}`)
  log(`Front: ${webOk ? 'ok' : 'FALHOU'}`)

  let fluxoOk = false
  if (apiOk) {
    const login = await fetch(`http://127.0.0.1:${API_PORT}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin', password: 'admin123' }),
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))
    const token = login.body.access_token || login.body.token
    log(`Login admin: ${login.status}${token ? ' (token ok)' : ''}`)

    const chamado = await fetch(`http://127.0.0.1:${API_PORT}/chamados`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'Vazamento',
        nome: 'Cliente Repro Fluxo',
        telefone: '(42) 95555-1212',
        cep: '84600000',
        logradouro: 'Rua Repro',
        numero: '1',
        bairro: 'Centro',
        cidade: 'União da Vitória',
        uf: 'PR',
        descricao: 'Chamado do teste de reprodução Docker',
        aceite: true,
        website: '',
        startedAt: Date.now() - 10000,
        origem: 'site',
      }),
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))
    log(`Abrir chamado: ${chamado.status} numero=${chamado.body?.numero || '-'}`)

    // Encerrar: pega uma ordem CONCLUIDA ou cria fluxo mínimo em OS existente
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Empresa-Codigo': '01',
    }
    // Prepara CONCLUIDA no Postgres Docker (seed pode não ter uma pronta) e encerra via API real
    process.env.DATABASE_URL = DB_URL
    const { PrismaClient, OrdemSituacao } = require('@prisma/client')
    const prisma = new PrismaClient()
    try {
      let alvoDb = await prisma.ordemServico.findFirst({
        where: { empresaCodigo: '01', situacao: OrdemSituacao.CONCLUIDA },
      })
      if (!alvoDb) {
        const cliente = await prisma.cliente.findFirst({
          where: { empresaCodigo: '01' },
          include: { enderecos: true },
        })
        const agg = await prisma.ordemServico.aggregate({ where: { empresaCodigo: '01' }, _max: { numero: true } })
        alvoDb = await prisma.ordemServico.create({
          data: {
            empresaCodigo: '01',
            numero: (agg._max.numero || 0) + 1,
            clienteId: cliente.id,
            enderecoId: cliente.enderecos?.[0]?.id,
            situacao: OrdemSituacao.CONCLUIDA,
            dataAbertura: new Date(),
            vistoria: 'Vistoria repro Docker',
            servicos: 'Serviço repro Docker',
            tipo: 'EMERGENCIA',
            origem: 'TELEFONE',
            maoDeObra: 50,
            material: 0,
            taxaVistoria: 0,
            deslocamento: 0,
          },
        })
        log(`Preparou OS CONCLUIDA ${alvoDb.numero} no Docker`)
      } else {
        log(`Usando OS CONCLUIDA ${alvoDb.numero} no Docker`)
      }

      const enc = await fetch(`http://127.0.0.1:${API_PORT}/ordens/${alvoDb.id}/encerrar`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          formaPagamento: 'PIX',
          parcelas: 1,
          dataVencimento: new Date().toISOString().slice(0, 10),
          entradaValor: 0,
        }),
      }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))
      log(`Encerrar OS ${alvoDb.numero}: ${enc.status}`)
      fluxoOk = Boolean(token && chamado.body?.numero && enc.status < 400)
    } finally {
      await prisma.$disconnect()
    }
  }

  log(`Fluxo mínimo: ${fluxoOk ? 'OK' : 'PARCIAL/FALHOU'}`)
  log(`Front acessível: ${webOk ? 'sim' : 'não'}`)

  try {
    apiProc.kill()
  } catch {
    // ignore
  }
  try {
    webProc.kill()
  } catch {
    // ignore
  }

  const out = `${linhas.join('\n')}\n`
  fs.mkdirSync(destA, { recursive: true })
  fs.mkdirSync(destB, { recursive: true })
  fs.writeFileSync(path.join(destA, 'reproducao_fluxo.txt'), out, 'utf8')
  fs.writeFileSync(path.join(destB, 'reproducao_fluxo.txt'), out, 'utf8')

  // atualiza reproducao.md
  const md = `# B7 — Reprodutibilidade (fluxo com portas alternativas)

Data: ${new Date().toISOString().slice(0, 10)}. Docker ligado. Sem Supabase.

## Portas
- Postgres Docker: \`5433\`
- API repro: \`3011\`
- Frontend repro: \`5183\`

## Resultado
\`\`\`
${linhas.join('\n')}
\`\`\`
`
  fs.writeFileSync(path.join(destA, 'reproducao.md'), md, 'utf8')
  fs.writeFileSync(path.join(destB, 'reproducao.md'), md, 'utf8')
  process.exit(fluxoOk && apiOk ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
