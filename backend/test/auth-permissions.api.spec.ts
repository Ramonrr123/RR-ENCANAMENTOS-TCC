/**
 * Testes de API (auth / permissions / financeiro / estoque / ordens)
 * via HTTP na API local — cobrem o contrato, não instrumentam o Nest em profundidade.
 */
import fs from 'node:fs'
import path from 'node:path'

const api = 'http://127.0.0.1:3001'
const root = path.resolve(__dirname, '../..')

function lerCaptura() {
  const texto = fs.readFileSync(path.join(root, '.env.captura'), 'utf8')
  const map: Record<string, string> = {}
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

async function login(email: string, password: string) {
  const r = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = await r.json().catch(() => ({}))
  return { status: r.status, token: body.access_token || body.token || '' }
}

describe('auth', () => {
  it('admin faz login', async () => {
    const cred = lerCaptura()
    const r = await login(cred.CAPTURA_ADMIN_EMAIL, cred.CAPTURA_ADMIN_SENHA)
    expect([200, 201]).toContain(r.status)
    expect(r.token).toBeTruthy()
  })
})

describe('permissions', () => {
  it('funcionário recebe 403 em rotas administrativas', async () => {
    const cred = lerCaptura()
    const email = cred.CAPTURA_FUNC_EMAIL || 'captura.teste'
    const senha = cred.CAPTURA_FUNC_SENHA || 'func123'
    const r = await login(email, senha)
    expect([200, 201]).toContain(r.status)
    const headers = {
      Authorization: `Bearer ${r.token}`,
      'X-Empresa-Codigo': '01',
    }
    const rotas = [
      '/ordens/garantias',
      '/financeiro/controle-recebimentos',
      '/ordens/preventivas',
      '/financeiro/titulos?tipo=RECEBER',
      '/financeiro/titulos?tipo=PAGAR',
      '/financeiro/fluxo-caixa?de=2026-01-01&ate=2026-12-31',
    ]
    for (const rota of rotas) {
      const res = await fetch(`${api}${rota}`, { headers })
      expect([401, 403]).toContain(res.status)
    }
  })
})

describe('ordens', () => {
  it('lista garantias vigentes para admin', async () => {
    const cred = lerCaptura()
    const r = await login(cred.CAPTURA_ADMIN_EMAIL, cred.CAPTURA_ADMIN_SENHA)
    const res = await fetch(`${api}/ordens/garantias`, {
      headers: { Authorization: `Bearer ${r.token}`, 'X-Empresa-Codigo': '01' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body) || Array.isArray(body?.itens) || Array.isArray(body?.data)).toBe(true)
  })
})

describe('financeiro', () => {
  it('controle-recebimentos responde para admin', async () => {
    const cred = lerCaptura()
    const r = await login(cred.CAPTURA_ADMIN_EMAIL, cred.CAPTURA_ADMIN_SENHA)
    const res = await fetch(`${api}/financeiro/controle-recebimentos`, {
      headers: { Authorization: `Bearer ${r.token}`, 'X-Empresa-Codigo': '01' },
    })
    expect(res.status).toBe(200)
  })
})

describe('estoque', () => {
  it('saldos responde para admin', async () => {
    const cred = lerCaptura()
    const r = await login(cred.CAPTURA_ADMIN_EMAIL, cred.CAPTURA_ADMIN_SENHA)
    const res = await fetch(`${api}/estoque/movimentos/saldos`, {
      headers: { Authorization: `Bearer ${r.token}`, 'X-Empresa-Codigo': '01' },
    })
    expect([200, 404]).toContain(res.status)
  })
})
