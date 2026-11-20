/**
 * Mede latência da API local. Sem segredos. Gera desempenho.csv/.md
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const api = 'http://127.0.0.1:3001'
const destA = path.resolve('C:\\Users\\ramon\\OneDrive\\Desktop\\imagens tcc\\respostas2')
const destB = path.resolve('C:\\Users\\ramon\\OneDrive\\Desktop\\resposta e imagens')
const N = 30

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

function pct(arr, p) {
  const s = [...arr].sort((a, b) => a - b)
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))
  return s[i]
}

async function medir(nome, fn, n = N) {
  const amostras = []
  for (let i = 0; i < n; i += 1) {
    const t0 = Date.now()
    await fn()
    amostras.push(Date.now() - t0)
  }
  return {
    nome,
    n,
    p50: pct(amostras, 50),
    p95: pct(amostras, 95),
    media: Math.round(amostras.reduce((a, b) => a + b, 0) / amostras.length),
  }
}

async function main() {
  const cred = lerCaptura()
  const loginBody = () =>
    fetch(`${api}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cred.CAPTURA_ADMIN_EMAIL, password: cred.CAPTURA_ADMIN_SENHA }),
    }).then((r) => r.json())

  const login0 = await loginBody()
  const token = login0.access_token || login0.token
  if (!token) throw new Error('login admin falhou')
  const headers = { Authorization: `Bearer ${token}`, 'X-Empresa-Codigo': '01', 'Content-Type': 'application/json' }
  const get = (url) => fetch(`${api}${url}`, { headers }).then((r) => r.json().catch(() => ({})))

  const lista = await get('/ordens')
  const itens = Array.isArray(lista) ? lista : lista?.itens || lista?.data || []
  const concluida = itens.find((o) => String(o.situacao || '').toUpperCase() === 'CONCLUIDA')
  const encerrada = itens.find((o) => String(o.situacao || '').toUpperCase() === 'ENCERRADA')

  const resultados = [
    await medir('POST /auth/login', async () => {
      await loginBody()
    }),
    await medir('GET /ordens (lista)', () => get('/ordens')),
    await medir('GET /agenda/painel', () => get('/agenda/painel')),
    await medir('GET /ordens/garantias', () => get('/ordens/garantias')),
    await medir('GET /financeiro/controle-recebimentos', () => get('/financeiro/controle-recebimentos')),
    await medir('GET /estoque/movimentos/saldos', () => get('/estoque/movimentos/saldos')),
    await medir('GET /relatorios/ordens', () => get('/relatorios/ordens')),
    await medir('GET /relatorios/estoque', () => get('/relatorios/estoque')),
    await medir('GET /relatorios/fluxo-caixa', () => get('/relatorios/fluxo-caixa?de=2026-01-01&ate=2026-12-31')),
  ]

  // Encerramento: mede validação (ordem já encerrada ou tentativa controlada) — latência do endpoint
  if (encerrada?.id) {
    resultados.push(
      await medir('POST /ordens/:id/encerrar (já encerrada)', async () => {
        await fetch(`${api}/ordens/${encerrada.id}/encerrar`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            formaPagamento: 'PIX',
            parcelas: 1,
            dataVencimento: new Date().toISOString().slice(0, 10),
            entradaValor: 0,
          }),
        }).then((r) => r.json().catch(() => ({})))
      }),
    )
  } else if (concluida?.id) {
    resultados.push(
      await medir('GET /ordens/:id (pré-encerramento)', () => get(`/ordens/${concluida.id}`)),
    )
  }

  const linhasCsv = ['condicao,operacao,n,p50_ms,p95_ms,media_ms']
  for (const r of resultados) linhasCsv.push(`A_seed_demo,${r.nome},${r.n},${r.p50},${r.p95},${r.media}`)

  const md = [
    '# Desempenho (banco local)',
    '',
    `Gerado em ${new Date().toISOString()} — Postgres local, ${N} repetições por operação, sem Supabase.`,
    '',
    '| Operação | n | p50 (ms) | p95 (ms) | média (ms) |',
    '|----------|---|----------|----------|------------|',
    ...resultados.map((r) => `| ${r.nome} | ${r.n} | ${r.p50} | ${r.p95} | ${r.media} |`),
    '',
    'Notas: login usa as credenciais de `.env.captura` (não impressas). Encerramento mede a resposta do endpoint em ordem já encerrada (erro esperado) para não alterar dados.',
    '',
  ].join('\n')

  for (const dest of [destA, destB]) {
    fs.mkdirSync(dest, { recursive: true })
    fs.writeFileSync(path.join(dest, 'desempenho.csv'), linhasCsv.join('\n') + '\n', 'utf8')
    fs.writeFileSync(path.join(dest, 'desempenho.md'), md, 'utf8')
  }
  console.log(linhasCsv.join('\n'))
  console.log('OK desempenho.csv e desempenho.md')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
