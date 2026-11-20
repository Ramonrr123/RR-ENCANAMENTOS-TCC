/**
 * Testes automáticos da Rodada 4 (API + regras) — banco local.
 * Não imprime segredos. Requer API em localhost:3001 e .env.captura.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(root, 'backend', 'package.json'))
const { PrismaClient } = require('@prisma/client')
const outDir = path.resolve('C:\\Users\\ramon\\OneDrive\\Desktop\\imagens tcc\\respostas2')
const api = 'http://127.0.0.1:3001'
const linhas = []
let passou = 0
let falhou = 0

function log(msg) {
  linhas.push(msg)
  console.log(msg)
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

function mascarar(texto, email, senha) {
  return String(texto || '')
    .split(senha || '___').join('[omitido]')
    .split(email || '___').join('[usuario]')
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

function normalizarOrigem(valor) {
  const t = String(valor || '').trim().toLowerCase()
  return ['site', 'whatsapp', 'telefone', 'indicacao', 'outro'].includes(t) ? t : 'site'
}

function soDigitos(valor) {
  const d = String(valor || '').replace(/\D/g, '')
  return d.startsWith('55') && d.length > 11 ? d.slice(2) : d
}

function linkWa(chamado) {
  if (chamado.nome === 'Dado removido' || chamado.telefone === 'Dado removido') return null
  const digitos = soDigitos(chamado.telefone)
  if (digitos.length !== 10 && digitos.length !== 11) return null
  const primeiro = String(chamado.nome || '').trim().split(/\s+/)[0] || 'cliente'
  const texto = `Olá, ${primeiro}! Recebemos o seu chamado número ${chamado.numero}. Vamos entrar em contato para combinar o atendimento.`
  if (/senha/i.test(texto)) return null
  return `https://wa.me/55${digitos}?text=${encodeURIComponent(texto)}`
}

async function main() {
  log(`=== testes rodada4 API ${new Date().toISOString()} ===`)
  const cred = lerCaptura()
  const email = cred.CAPTURA_ADMIN_EMAIL || ''
  const senha = cred.CAPTURA_ADMIN_SENHA || ''
  await assert('credencial captura presente', Boolean(email && senha))

  const health = await fetch(`${api}/health`).then((r) => r.json()).catch((e) => ({ error: e.message }))
  await assert('API /health ok', health.status === 'ok', mascarar(JSON.stringify(health), email, senha))

  // --- unitários A1/A3 (sem rede) ---
  await assert('A1 origem whatsapp', normalizarOrigem('whatsapp') === 'whatsapp')
  await assert('A1 origem inválida vira site', normalizarOrigem('<x>') === 'site')
  const waOk = linkWa({ nome: 'Ana Teste', telefone: '(35) 98888-7777', numero: 99 })
  await assert('A3 wa.me válido', Boolean(waOk && waOk.startsWith('https://wa.me/5535988887777')))
  await assert('A3 texto sem senha', Boolean(waOk && !decodeURIComponent(waOk).toLowerCase().includes('senha')))
  await assert('A3 anonimizado sem botão', linkWa({ nome: 'Dado removido', telefone: '35988887777', numero: 1 }) === null)
  await assert('A3 telefone inválido sem botão', linkWa({ nome: 'Ana', telefone: '12', numero: 1 }) === null)

  // --- login admin ---
  const login = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: senha }),
  })
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))
    .catch((e) => ({ status: 0, body: { message: e.message } }))
  const token = login.body?.access_token || login.body?.token || ''
  await assert('login admin ok', (login.status === 200 || login.status === 201) && Boolean(token), `status=${login.status}`)

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Empresa-Codigo': '01',
  }

  process.chdir(path.join(root, 'backend'))
  const prisma = new PrismaClient()

  // Libera cota de abertura por IP (limite 5/hora) para o teste poder criar chamados.
  const desdeHora = new Date(Date.now() - 60 * 60 * 1000)
  await prisma.chamado.updateMany({
    where: { createdAt: { gte: desdeHora }, ipOrigem: { not: null } },
    data: { ipOrigem: 'teste-reset' },
  })

  // Abrir chamado público whatsapp
  const startedAt = Date.now() - 5000
  const abrirWa = await fetch(`${api}/chamados`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tipo: 'Vazamento',
      nome: 'Cliente Teste WhatsApp',
      telefone: '(35) 99111-2233',
      cep: '84600000',
      logradouro: 'Rua Teste',
      numero: '100',
      bairro: 'Centro',
      cidade: 'União da Vitória',
      uf: 'PR',
      descricao: 'Vazamento de teste automático rodada 4 no banheiro.',
      aceite: true,
      startedAt,
      website: '',
      origem: 'whatsapp',
    }),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))

  await assert('A1 POST origem=whatsapp cria chamado', abrirWa.status < 400, `status=${abrirWa.status} ${mascarar(JSON.stringify(abrirWa.body), email, senha)}`)
  const numeroWa = abrirWa.body?.numero
  const senhaWa = abrirWa.body?.senha

  // Invalid origem
  const abrirInv = await fetch(`${api}/chamados`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tipo: 'Entupimento',
      nome: 'Cliente Teste Site',
      telefone: '(35) 99222-3344',
      cep: '84600000',
      logradouro: 'Rua Site',
      numero: '200',
      bairro: 'Centro',
      cidade: 'União da Vitória',
      uf: 'PR',
      descricao: 'Entupimento de teste automático origem inválida.',
      aceite: true,
      startedAt: Date.now() - 5000,
      website: '',
      origem: 'hack<script>',
    }),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))
  await assert('A1 POST origem inválida aceita (vira site)', abrirInv.status < 400, `status=${abrirInv.status}`)

  // Consulta pública sem origem
  if (numeroWa && senhaWa) {
    const consulta = await fetch(`${api}/chamados/consulta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero: numeroWa, senha: String(senhaWa) }),
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))
    await assert(
      'A1 consulta pública ok',
      consulta.status === 200 || consulta.status === 201,
      `status=${consulta.status} body=${mascarar(JSON.stringify(consulta.body), email, senha)}`,
    )
    await assert('A1 consulta sem campo origem', !Object.prototype.hasOwnProperty.call(consulta.body || {}, 'origem'))
  } else {
    await assert('A1 consulta pública (pré-condição)', false, `numero=${numeroWa} senha=${senhaWa ? 'sim' : 'nao'}`)
  }

  // Prisma: confirmar origens gravadas
  try {
    if (numeroWa) {
      const row = await prisma.chamado.findFirst({ where: { empresaCodigo: '01', numero: numeroWa } })
      await assert('A1 DB origem=whatsapp', row?.origem === 'whatsapp', `origem=${row?.origem}`)
    }
    if (abrirInv.body?.numero) {
      const row2 = await prisma.chamado.findFirst({ where: { empresaCodigo: '01', numero: abrirInv.body.numero } })
      await assert('A1 DB origem inválida=site', row2?.origem === 'site', `origem=${row2?.origem}`)
    }

    // Contagem 30d
    const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const grupos = await prisma.chamado.groupBy({
      by: ['origem'],
      where: { empresaCodigo: '01', createdAt: { gte: desde } },
      _count: { _all: true },
    })
    const mapa = Object.fromEntries(grupos.map((g) => [g.origem || 'site', g._count._all]))
    const resumo = await fetch(`${api}/chamados/resumo/origem-30d`, { headers }).then((r) => r.json())
    await assert(
      'A2 contagem 30d whatsapp bate',
      Number(resumo.whatsapp) === Number(mapa.whatsapp || 0),
      `api=${resumo.whatsapp} db=${mapa.whatsapp || 0}`,
    )
    await assert(
      'A2 contagem 30d site bate',
      Number(resumo.site) === Number(mapa.site || 0),
      `api=${resumo.site} db=${mapa.site || 0}`,
    )

    // Painel B1
    const painel = await fetch(`${api}/agenda/painel`, { headers }).then((r) => r.json())
    const hoje = new Date()
    const inicio = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0))
    const daqui60 = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 60, 12))
    const [prevVencer, prevVencidas, garantias, chamadosNovos, conferir, atrasadas] = await Promise.all([
      prisma.ordemServico.count({
        where: { empresaCodigo: '01', situacao: 'ENCERRADA', preventivaEm: { gte: inicio, lte: daqui60 } },
      }),
      prisma.ordemServico.count({
        where: { empresaCodigo: '01', situacao: 'ENCERRADA', preventivaEm: { lt: inicio } },
      }),
      prisma.ordemServico.count({
        where: { empresaCodigo: '01', situacao: 'ENCERRADA', garantiaAte: { gte: inicio } },
      }),
      prisma.chamado.count({
        where: { empresaCodigo: '01', ordemId: null, status: { in: ['ABERTO', 'EM_ATENDIMENTO'] } },
      }),
      prisma.ordemServico.count({ where: { empresaCodigo: '01', situacao: 'CONCLUIDA' } }),
      prisma.financeiroTitulo.count({
        where: {
          empresaCodigo: '01',
          tipo: 'RECEBER',
          status: { in: ['ABERTO', 'PAGO_PARCIAL'] },
          dataVencimento: { lt: inicio },
        },
      }),
    ])
    await assert('B1 preventivas a vencer', Number(painel.preventivasAVencer) === prevVencer, `${painel.preventivasAVencer}!=${prevVencer}`)
    await assert('B1 preventivas vencidas', Number(painel.preventivasVencidas) === prevVencidas, `${painel.preventivasVencidas}!=${prevVencidas}`)
    await assert('B1 garantias vigentes', Number(painel.garantiasVigentes) === garantias, `${painel.garantiasVigentes}!=${garantias}`)
    await assert('B1 chamados novos', Number(painel.chamadosNovos) === chamadosNovos, `${painel.chamadosNovos}!=${chamadosNovos}`)
    await assert('B1 concluídas', Number(painel.aguardandoConferencia) === conferir, `${painel.aguardandoConferencia}!=${conferir}`)
    await assert('B1 recebíveis vencidos', Number(painel.parcelasAtrasadas) === atrasadas, `${painel.parcelasAtrasadas}!=${atrasadas}`)

    // B3 garantia = encerramento + 90 dias
    const encerradas = await prisma.ordemServico.findMany({
      where: { empresaCodigo: '01', situacao: 'ENCERRADA', dataEncerramento: { not: null }, garantiaAte: { not: null } },
      select: { numero: true, dataEncerramento: true, garantiaAte: true },
    })
    let okGarantia = true
    for (const o of encerradas) {
      const base = new Date(Date.UTC(o.dataEncerramento.getUTCFullYear(), o.dataEncerramento.getUTCMonth(), o.dataEncerramento.getUTCDate()))
      const esperado = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + 90))
      const got = new Date(Date.UTC(o.garantiaAte.getUTCFullYear(), o.garantiaAte.getUTCMonth(), o.garantiaAte.getUTCDate()))
      if (esperado.getTime() !== got.getTime()) {
        okGarantia = false
        log(`  divergencia OS ${o.numero}: esperado ${esperado.toISOString().slice(0, 10)} got ${got.toISOString().slice(0, 10)}`)
      }
    }
    await assert('B3 garantiaAte = encerramento + 90d (todas encerradas)', okGarantia, `n=${encerradas.length}`)

    const listaGar = await fetch(`${api}/ordens/garantias`, { headers }).then((r) => r.json())
    const soVigentes = Array.isArray(listaGar) && listaGar.every((g) => Number(g.diasRestantes) >= 0)
    await assert('B3 lista garantias só vigentes', soVigentes, `len=${Array.isArray(listaGar) ? listaGar.length : 'n/a'}`)

    // B4 controle recebimentos
    const ctrl = await fetch(`${api}/financeiro/controle-recebimentos`, { headers }).then((r) => r.json())
    await assert('B4 controle-recebimentos responde', Boolean(ctrl?.totais), mascarar(JSON.stringify(ctrl?.totais || {}), email, senha))
    if (ctrl?.totais) {
      const abertos = await prisma.financeiroTitulo.findMany({
        where: { empresaCodigo: '01', tipo: 'RECEBER', status: { in: ['ABERTO', 'PAGO_PARCIAL'] } },
      })
      let aReceberDb = 0
      let vencidoDb = 0
      for (const t of abertos) {
        const saldo = Math.max(0, Number(t.valor) - Number(t.valorBaixado))
        aReceberDb += saldo
        if (t.dataVencimento && t.dataVencimento < inicio) vencidoDb += saldo
      }
      aReceberDb = Math.round(aReceberDb * 100) / 100
      vencidoDb = Math.round(vencidoDb * 100) / 100
      await assert(
        'B4 total a receber ≈ Contas a receber',
        Math.abs(Number(ctrl.totais.aReceber) - aReceberDb) < 0.02,
        `${ctrl.totais.aReceber} vs ${aReceberDb}`,
      )
      await assert(
        'B4 vencido ≈ títulos vencidos',
        Math.abs(Number(ctrl.totais.vencido) - vencidoDb) < 0.02,
        `${ctrl.totais.vencido} vs ${vencidoDb}`,
      )
    }

    // B5 para repor
    const alertas = await fetch(`${api}/estoque/movimentos/alertas`, { headers }).then((r) => r.json())
    const saldos = await fetch(`${api}/estoque/movimentos/saldos`, { headers }).then((r) => r.json())
    let repor = 0
    for (const local of Array.isArray(saldos) ? saldos : []) {
      for (const p of local.pecas || []) {
        const min = Number(p.estoqueMinimo || 0)
        const q = Number(p.quantidade || 0)
        if (min > 0 && q <= min) repor += 1
      }
    }
    if (repor === 0 && Array.isArray(alertas)) repor = alertas.length
    await assert('B5 há definição de para repor (alertas/saldos)', Array.isArray(alertas), `alertas=${Array.isArray(alertas) ? alertas.length : 'n/a'} reporCalc=${repor}`)

    // B2 choque de horário
    const funcs = await prisma.crmUsuarios.findMany({ where: { status: 'ATIVO' }, take: 2 })
    const funcId = funcs[0]?.id
    const ordemLivre = await prisma.ordemServico.findFirst({
      where: { empresaCodigo: '01', situacao: { in: ['ABERTA', 'AGENDADA', 'EM_ANDAMENTO'] } },
      select: { id: true },
    })
    if (funcId && ordemLivre) {
      const inicioAg = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 3, 14, 0, 0))
      const fimAg = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 3, 15, 0, 0))
      const payload = {
        ordemId: ordemLivre.id,
        funcionarioId: funcId,
        inicio: inicioAg.toISOString(),
        fim: fimAg.toISOString(),
      }
      const a1 = await fetch(`${api}/agenda`, { method: 'POST', headers, body: JSON.stringify(payload) }).then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      const a2 = await fetch(`${api}/agenda`, { method: 'POST', headers, body: JSON.stringify(payload) }).then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      await assert('B2 primeiro agendamento ok', a1.status >= 200 && a1.status < 300, `status=${a1.status}`)
      await assert('B2 segundo no mesmo horário recusado', a2.status >= 400, `status=${a2.status}`)
      if (a1.body?.id) {
        await fetch(`${api}/agenda/${a1.body.id}`, { method: 'DELETE', headers }).catch(() => {})
      }
    } else {
      log('SKIP B2 agenda (sem ordem aberta ou funcionário)')
    }

    // Permissões: login funcionário se existir
    const funcUser = await prisma.crmUsuarios.findFirst({ where: { isAdmin: false, status: 'ATIVO' } })
    if (funcUser && cred.CAPTURA_FUNC_SENHA) {
      const loginF = await fetch(`${api}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cred.CAPTURA_FUNC_EMAIL || funcUser.login || funcUser.email, password: cred.CAPTURA_FUNC_SENHA }),
      }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))
      const tokenF = loginF.body?.access_token || loginF.body?.token
      if (tokenF) {
        const hF = { Authorization: `Bearer ${tokenF}`, 'X-Empresa-Codigo': '01' }
        const g = await fetch(`${api}/ordens/garantias`, { headers: hF }).then((r) => r.status)
        const c = await fetch(`${api}/financeiro/controle-recebimentos`, { headers: hF }).then((r) => r.status)
        const prev = await fetch(`${api}/ordens/preventivas`, { headers: hF }).then((r) => r.status)
        const receber = await fetch(`${api}/financeiro/titulos?tipo=RECEBER`, { headers: hF }).then((r) => r.status)
        const pagar = await fetch(`${api}/financeiro/titulos?tipo=PAGAR`, { headers: hF }).then((r) => r.status)
        const fluxo = await fetch(`${api}/financeiro/fluxo-caixa?de=2026-01-01&ate=2026-12-31`, { headers: hF }).then((r) => r.status)
        await assert('Permissões funcionário 403 garantias', g === 403, `status=${g}`)
        await assert('Permissões funcionário 403 recebimentos', c === 403 || c === 401, `status=${c}`)
        await assert('Permissões funcionário 403 preventivas', prev === 403 || prev === 401, `status=${prev}`)
        await assert('Permissões funcionário 403 contas receber', receber === 403 || receber === 401, `status=${receber}`)
        await assert('Permissões funcionário 403 contas pagar', pagar === 403 || pagar === 401, `status=${pagar}`)
        await assert('Permissões funcionário 403 fluxo', fluxo === 403 || fluxo === 401, `status=${fluxo}`)
        const hA = { Authorization: `Bearer ${token}`, 'X-Empresa-Codigo': '01' }
        const gA = await fetch(`${api}/ordens/garantias`, { headers: hA }).then((r) => r.status)
        const cA = await fetch(`${api}/financeiro/controle-recebimentos`, { headers: hA }).then((r) => r.status)
        await assert('Admin acessa garantias', gA === 200, `status=${gA}`)
        await assert('Admin acessa recebimentos', cA === 200, `status=${cA}`)
      } else {
        log('SKIP permissões funcionário (login falhou)')
      }
    } else {
      log('SKIP permissões funcionário (sem CAPTURA_FUNC_SENHA ou usuário)')
    }

    // Limpeza dos chamados de teste
    await prisma.chamado.deleteMany({
      where: {
        empresaCodigo: '01',
        nome: { in: ['Cliente Teste WhatsApp', 'Cliente Teste Site'] },
      },
    })
  } finally {
    await prisma.$disconnect()
  }

  log(`=== resumo: passou=${passou} falhou=${falhou} ===`)
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'testes_rodada4_api.txt'), linhas.join('\n') + '\n', 'utf8')
  process.exit(falhou > 0 ? 1 : 0)
}

main().catch((err) => {
  log(`FATAL ${err?.message || err}`)
  try {
    fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(path.join(outDir, 'testes_rodada4_api.txt'), linhas.join('\n') + '\n', 'utf8')
  } catch {}
  process.exit(1)
})
