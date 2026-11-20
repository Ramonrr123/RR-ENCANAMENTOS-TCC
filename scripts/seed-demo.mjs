/**
 * Seed de demonstração fictício e idempotente (rodada 4).
 * Ordens 101–106: cria/atualiza como CONCLUIDA e chama o fluxo real POST /ordens/:id/encerrar.
 * OS 107 permanece CONCLUIDA (aguardando conferência).
 * Uso: npm run seed:demo  (banco local + API em 127.0.0.1:3001)
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
const bcrypt = require('bcrypt')
const { PrismaClient, OrdemSituacao } = require('@prisma/client')
const prisma = new PrismaClient()
const EMPRESA = '01'
const API = 'http://127.0.0.1:3001'

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

function utc(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}
function addDays(d, n) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n, 12, 0, 0))
}
function hojeUtc() {
  const n = new Date()
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 12, 0, 0))
}
function isoDia(d) {
  return d.toISOString().slice(0, 10)
}

async function ensureCliente(nome, telefone, logradouro, cidade) {
  let cliente = await prisma.cliente.findFirst({ where: { empresaCodigo: EMPRESA, nome } })
  if (!cliente) {
    cliente = await prisma.cliente.create({
      data: { empresaCodigo: EMPRESA, nome, telefone, endereco: logradouro, cidade, tipoPessoa: 'FISICA' },
    })
  } else {
    cliente = await prisma.cliente.update({
      where: { id: cliente.id },
      data: { telefone, endereco: logradouro, cidade },
    })
  }
  let end = await prisma.clienteEndereco.findFirst({ where: { clienteId: cliente.id, principal: true } })
  if (!end) {
    end = await prisma.clienteEndereco.create({
      data: { clienteId: cliente.id, apelido: 'Principal', logradouro, cidade, principal: true },
    })
  } else {
    end = await prisma.clienteEndereco.update({
      where: { id: end.id },
      data: { logradouro, cidade },
    })
  }
  return { cliente, endereco: end }
}

async function limparTitulosOs(numero) {
  const doc = `OS-${String(numero).padStart(4, '0')}`
  await prisma.financeiroTitulo.deleteMany({
    where: {
      empresaCodigo: EMPRESA,
      OR: [{ numeroDocumento: doc }, { numeroDocumento: { startsWith: `${doc}-` } }],
    },
  })
}

async function prepararOrdem(params) {
  await limparTitulosOs(params.numero)
  return prisma.ordemServico.upsert({
    where: { empresaCodigo_numero: { empresaCodigo: EMPRESA, numero: params.numero } },
    update: {
      clienteId: params.clienteId,
      enderecoId: params.enderecoId,
      situacao: params.situacao,
      dataAbertura: params.dataAbertura,
      dataEncerramento: null,
      garantiaAte: null,
      garantiaDias: null,
      preventivaEm: null,
      preventivaStatus: null,
      entradaValor: null,
      vistoria: params.vistoria,
      servicos: params.servicos,
      funcionarioId: params.funcionarioId ?? null,
      taxaVistoria: params.taxaVistoria ?? 0,
      maoDeObra: params.maoDeObra ?? 0,
      deslocamento: params.deslocamento ?? 0,
      material: params.material ?? 0,
    },
    create: {
      empresaCodigo: EMPRESA,
      numero: params.numero,
      clienteId: params.clienteId,
      enderecoId: params.enderecoId,
      situacao: params.situacao,
      dataAbertura: params.dataAbertura,
      vistoria: params.vistoria,
      servicos: params.servicos,
      funcionarioId: params.funcionarioId ?? null,
      taxaVistoria: params.taxaVistoria ?? 0,
      maoDeObra: params.maoDeObra ?? 0,
      deslocamento: params.deslocamento ?? 0,
      material: params.material ?? 0,
    },
  })
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
  if (!token) throw new Error(`Login admin falhou (status ${r.status}). API precisa estar em ${API}.`)
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Empresa-Codigo': EMPRESA,
  }
}

async function encerrarViaApi(headers, ordemId, dto) {
  const r = await fetch(`${API}/ordens/${ordemId}/encerrar`, {
    method: 'POST',
    headers,
    body: JSON.stringify(dto),
  })
  const body = await r.json().catch(() => ({}))
  if (r.status >= 400) {
    throw new Error(`encerrar OS id=${ordemId} falhou ${r.status}: ${JSON.stringify(body)}`)
  }
  return body
}

async function ensureChamado(params) {
  const existente = await prisma.chamado.findFirst({
    where: { empresaCodigo: EMPRESA, nome: params.nome, origem: params.origem },
  })
  if (existente) {
    return prisma.chamado.update({
      where: { id: existente.id },
      data: {
        telefone: params.telefone,
        whatsapp: 'celular',
        status: 'ABERTO',
        ordemId: null,
        descricao: params.descricao,
      },
    })
  }
  const agg = await prisma.chamado.aggregate({ where: { empresaCodigo: EMPRESA }, _max: { numero: true } })
  const numero = (agg._max.numero || 0) + 1
  return prisma.chamado.create({
    data: {
      empresaCodigo: EMPRESA,
      numero,
      nome: params.nome,
      telefone: params.telefone,
      whatsapp: 'celular',
      cep: '84600000',
      logradouro: 'Rua Demo',
      numeroEndereco: '10',
      bairro: 'Centro',
      cidade: 'União da Vitória',
      uf: 'PR',
      tipo: 'Vazamento',
      descricao: params.descricao,
      status: 'ABERTO',
      origem: params.origem,
      senhaHash: await bcrypt.hash('DEMOSEED1', 10),
      aceiteEm: new Date(),
      avisoVersao: '2026-11-12-v2',
    },
  })
}

async function main() {
  console.log('seed:demo — início')
  const health = await fetch(`${API}/health`).then((r) => r.json()).catch((e) => ({ error: e.message }))
  if (health.status !== 'ok') throw new Error(`API indisponível em ${API}: ${JSON.stringify(health)}`)

  const hoje = hojeUtc()
  const headers = await loginAdmin()
  const groupFunc = await prisma.crmGruposUsuarios.findFirst({ where: { name: 'funcionarios' } })
  const company = await prisma.crmEmpresas.findFirst({ where: { codigo: EMPRESA } })
  if (!groupFunc || !company) throw new Error('Rode o seed principal antes (grupos/empresa).')

  const senhaFunc = await bcrypt.hash('func123', 10)
  let captura = await prisma.crmUsuarios.findFirst({
    where: { OR: [{ login: 'captura.teste' }, { email: 'captura.teste@erp.local' }] },
  })
  if (!captura) {
    captura = await prisma.crmUsuarios.create({
      data: {
        login: 'captura.teste',
        nome: 'Funcionário Captura Teste',
        email: 'captura.teste@erp.local',
        password: senhaFunc,
        isAdmin: false,
        status: 'ATIVO',
        grupoUsuarioId: groupFunc.id,
      },
    })
  } else {
    captura = await prisma.crmUsuarios.update({
      where: { id: captura.id },
      data: { password: senhaFunc, isAdmin: false, status: 'ATIVO', grupoUsuarioId: groupFunc.id },
    })
  }
  await prisma.crmUsuariosEmpresas.upsert({
    where: { userId_companyId: { userId: captura.id, companyId: company.id } },
    update: {},
    create: { userId: captura.id, companyId: company.id },
  })

  const func = await prisma.crmUsuarios.findFirst({ where: { login: 'encanador.tcc' } })

  // Ferramentas: inteiras; "para repor" só com saldo < mínimo
  const ferramentas = await prisma.produto.findMany({
    where: {
      empresaCodigo: EMPRESA,
      OR: [
        { ferramenta: true },
        { descricao: { contains: 'Maçarico', mode: 'insensitive' } },
        { descricao: { contains: 'Desentupidor', mode: 'insensitive' } },
      ],
    },
  })
  const deposito = await prisma.estoqueLocal.findFirst({ where: { empresaCodigo: EMPRESA, codigo: 'DEPOSITO' } })
  const veiculo = await prisma.estoqueLocal.findFirst({ where: { empresaCodigo: EMPRESA, codigo: 'VEICULO' } })
  for (const p of ferramentas) {
    await prisma.produto.update({
      where: { id: p.id },
      data: { ferramenta: true, estoque: 2, estoqueMinimo: 1 },
    })
    if (deposito) {
      await prisma.estoqueSaldo.upsert({
        where: { produtoId_localId: { produtoId: p.id, localId: deposito.id } },
        update: { quantidade: 1 },
        create: { produtoId: p.id, localId: deposito.id, quantidade: 1 },
      })
    }
    if (veiculo) {
      await prisma.estoqueSaldo.upsert({
        where: { produtoId_localId: { produtoId: p.id, localId: veiculo.id } },
        update: { quantidade: 1 },
        create: { produtoId: p.id, localId: veiculo.id, quantidade: 1 },
      })
    }
  }
  if (ferramentas[0]) {
    await prisma.produto.update({ where: { id: ferramentas[0].id }, data: { estoque: 0, estoqueMinimo: 1 } })
    await prisma.estoqueSaldo.updateMany({
      where: { produtoId: ferramentas[0].id },
      data: { quantidade: 0 },
    })
  }

  const cA = await ensureCliente('Cliente Demo Recebimento A', '(42) 99111-0101', 'Rua Demo A, 1', 'União da Vitória')
  const cB = await ensureCliente('Cliente Demo Recebimento B', '(42) 99111-0102', 'Rua Demo B, 2', 'Porto União')
  const cC = await ensureCliente('Cliente Demo Recebimento C', '(42) 99111-0103', 'Rua Demo C, 3', 'União da Vitória')
  const cG = await ensureCliente('Cliente Demo Garantia Vigente', '(42) 99111-0201', 'Rua Demo G, 10', 'União da Vitória')
  const cPv = await ensureCliente('Cliente Demo Preventiva Vencer', '(42) 99111-0202', 'Rua Demo PV, 11', 'Porto União')
  const cPx = await ensureCliente('Cliente Demo Preventiva Vencida', '(42) 99111-0203', 'Rua Demo PX, 12', 'União da Vitória')
  const cConc = await ensureCliente('Cliente Demo Concluida', '(42) 99111-0301', 'Rua Demo Conc, 5', 'União da Vitória')

  // OS 101: total 120 = entrada 20 + 3 parcelas (fluxo real)
  const os101 = await prepararOrdem({
    numero: 101,
    clienteId: cA.cliente.id,
    enderecoId: cA.endereco.id,
    situacao: OrdemSituacao.CONCLUIDA,
    dataAbertura: addDays(hoje, -40),
    vistoria: 'Vistoria ok — reparo hidráulico',
    servicos: 'Troca de registro e reaperto',
    funcionarioId: func?.id,
    taxaVistoria: 20,
    maoDeObra: 100,
  })
  await encerrarViaApi(headers, os101.id, {
    formaPagamento: 'PIX',
    parcelas: 3,
    dataVencimento: isoDia(addDays(hoje, 10)),
    entradaValor: 20,
    garantiaDias: 90,
    preventivaMeses: 6,
    usarQuintoDiaUtil: false,
  })

  // OS 102: parcelas em dia (sem entrada)
  const os102 = await prepararOrdem({
    numero: 102,
    clienteId: cB.cliente.id,
    enderecoId: cB.endereco.id,
    situacao: OrdemSituacao.CONCLUIDA,
    dataAbertura: addDays(hoje, -20),
    vistoria: 'Vistoria — desentupimento',
    servicos: 'Desentupimento de ramal',
    funcionarioId: func?.id,
    maoDeObra: 90,
  })
  await encerrarViaApi(headers, os102.id, {
    formaPagamento: 'Boleto',
    parcelas: 2,
    dataVencimento: isoDia(addDays(hoje, 15)),
    entradaValor: 0,
    garantiaDias: 90,
    preventivaMeses: 6,
    usarQuintoDiaUtil: false,
  })

  // OS 103: parcela vencida
  const os103 = await prepararOrdem({
    numero: 103,
    clienteId: cC.cliente.id,
    enderecoId: cC.endereco.id,
    situacao: OrdemSituacao.CONCLUIDA,
    dataAbertura: addDays(hoje, -50),
    vistoria: 'Vistoria — vazamento',
    servicos: 'Reparo de vazamento no ramal',
    funcionarioId: func?.id,
    maoDeObra: 80,
  })
  await encerrarViaApi(headers, os103.id, {
    formaPagamento: 'Boleto',
    parcelas: 2,
    dataVencimento: isoDia(addDays(hoje, 20)),
    entradaValor: 0,
    garantiaDias: 90,
    preventivaMeses: 6,
    usarQuintoDiaUtil: false,
  })
  const tit103 = await prisma.financeiroTitulo.findMany({
    where: { empresaCodigo: EMPRESA, numeroDocumento: 'OS-0103', status: 'ABERTO' },
    orderBy: { id: 'asc' },
  })
  if (tit103[0]) {
    await prisma.financeiroTitulo.update({
      where: { id: tit103[0].id },
      data: { dataVencimento: addDays(hoje, -10) },
    })
  }

  // OS 104: garantia vigente
  const os104 = await prepararOrdem({
    numero: 104,
    clienteId: cG.cliente.id,
    enderecoId: cG.endereco.id,
    situacao: OrdemSituacao.CONCLUIDA,
    dataAbertura: addDays(hoje, -25),
    vistoria: 'Vistoria — instalação',
    servicos: 'Instalação de torneira',
    funcionarioId: func?.id,
    maoDeObra: 70,
  })
  await encerrarViaApi(headers, os104.id, {
    formaPagamento: 'PIX',
    parcelas: 1,
    dataVencimento: isoDia(addDays(hoje, 5)),
    entradaValor: 0,
    garantiaDias: 90,
    preventivaMeses: 6,
    usarQuintoDiaUtil: false,
  })

  // OS 105: preventiva a vencer (~20 dias)
  const os105 = await prepararOrdem({
    numero: 105,
    clienteId: cPv.cliente.id,
    enderecoId: cPv.endereco.id,
    situacao: OrdemSituacao.CONCLUIDA,
    dataAbertura: addDays(hoje, -200),
    vistoria: 'Vistoria preventiva',
    servicos: 'Manutenção preventiva programada',
    funcionarioId: func?.id,
    maoDeObra: 60,
  })
  await encerrarViaApi(headers, os105.id, {
    formaPagamento: 'PIX',
    parcelas: 1,
    dataVencimento: isoDia(addDays(hoje, 5)),
    entradaValor: 0,
    garantiaDias: 90,
    preventivaMeses: 6,
    usarQuintoDiaUtil: false,
  })
  await prisma.ordemServico.update({
    where: { id: os105.id },
    data: { preventivaEm: addDays(hoje, 20), preventivaStatus: 'a_contatar' },
  })

  // OS 106: preventiva vencida
  const os106 = await prepararOrdem({
    numero: 106,
    clienteId: cPx.cliente.id,
    enderecoId: cPx.endereco.id,
    situacao: OrdemSituacao.CONCLUIDA,
    dataAbertura: addDays(hoje, -220),
    vistoria: 'Vistoria preventiva atrasada',
    servicos: 'Manutenção preventiva atrasada',
    funcionarioId: func?.id,
    maoDeObra: 55,
  })
  await encerrarViaApi(headers, os106.id, {
    formaPagamento: 'PIX',
    parcelas: 1,
    dataVencimento: isoDia(addDays(hoje, 5)),
    entradaValor: 0,
    garantiaDias: 90,
    preventivaMeses: 6,
    usarQuintoDiaUtil: false,
  })
  await prisma.ordemServico.update({
    where: { id: os106.id },
    data: { preventivaEm: addDays(hoje, -8), preventivaStatus: 'contatado' },
  })

  // OS 107: concluída aguardando conferência (sem encerrar)
  await prepararOrdem({
    numero: 107,
    clienteId: cConc.cliente.id,
    enderecoId: cConc.endereco.id,
    situacao: OrdemSituacao.CONCLUIDA,
    dataAbertura: addDays(hoje, -2),
    vistoria: 'Vistoria concluída — aguarda conferência',
    servicos: 'Serviço concluído aguardando conferência',
    funcionarioId: func?.id,
    maoDeObra: 50,
  })

  await ensureChamado({
    nome: 'Cliente Demo Chamado Site',
    telefone: '(42) 98888-1001',
    origem: 'site',
    descricao: 'Chamado de demonstração via site',
  })
  await ensureChamado({
    nome: 'Cliente Demo Chamado WhatsApp',
    telefone: '(42) 98888-1002',
    origem: 'whatsapp',
    descricao: 'Chamado de demonstração via WhatsApp',
  })

  // --- LGPD: solicitações + titular + retenção vencida ---
  const titular = await ensureCliente(
    'Maria Titular Demo LGPD',
    '(42) 98888-3010',
    'Rua das Hortênsias 210',
    'Porto União',
  )
  const maxChamado = await prisma.chamado.aggregate({ where: { empresaCodigo: EMPRESA }, _max: { numero: true } })
  const numChamadoTitular = Math.max(maxChamado._max.numero || 200, 200) + 1
  const telTitular = '(42) 98888-3010'
  let chamadoTitular = await prisma.chamado.findFirst({
    where: {
      empresaCodigo: EMPRESA,
      OR: [{ telefone: telTitular }, { telefone: '42988883010' }, { nome: titular.cliente.nome }],
    },
    orderBy: { id: 'desc' },
  })
  if (!chamadoTitular) {
    chamadoTitular = await prisma.chamado.create({
      data: {
        empresaCodigo: EMPRESA,
        numero: numChamadoTitular,
        nome: titular.cliente.nome,
        telefone: telTitular,
        whatsapp: 'celular',
        cep: '84600-000',
        logradouro: 'Rua das Hortênsias',
        numeroEndereco: '210',
        bairro: 'Centro',
        cidade: 'Porto União',
        uf: 'SC',
        tipo: 'vazamento',
        descricao: 'Chamado fictício do titular LGPD para exportação e anonimização.',
        origem: 'site',
        aceiteEm: new Date(),
        avisoVersao: '2026-11-13-v3',
        ipOrigem: '203.0.113.50',
      },
    })
  } else {
    chamadoTitular = await prisma.chamado.update({
      where: { id: chamadoTitular.id },
      data: {
        nome: titular.cliente.nome,
        telefone: telTitular,
        descricao: 'Chamado fictício do titular LGPD para exportação e anonimização.',
        aceiteEm: new Date(),
        avisoVersao: '2026-11-13-v3',
      },
    })
  }
  // evita segundo chamado órfão com o mesmo nome/telefone
  await prisma.chamado.updateMany({
    where: {
      empresaCodigo: EMPRESA,
      id: { not: chamadoTitular.id },
      OR: [{ telefone: telTitular }, { telefone: '42988883010' }, { nome: titular.cliente.nome }],
      ordemId: null,
    },
    data: { nome: 'Chamado LGPD legado', telefone: '(42) 90000-0000' },
  })
  const osTitular = await prepararOrdem({
    numero: 201,
    clienteId: titular.cliente.id,
    enderecoId: titular.endereco.id,
    situacao: OrdemSituacao.CONCLUIDA,
    dataAbertura: addDays(hoje, -40),
    vistoria: 'Vistoria titular LGPD',
    servicos: 'Serviço titular LGPD',
    funcionarioId: func?.id,
    maoDeObra: 80,
  })
  await encerrarViaApi(headers, osTitular.id, {
    formaPagamento: 'PIX',
    parcelas: 2,
    dataVencimento: isoDia(addDays(hoje, 10)),
    entradaValor: 20,
    garantiaDias: 90,
    preventivaMeses: 6,
    usarQuintoDiaUtil: false,
  })
  // ordemId é unique: libera vínculo antigo e liga o chamado do titular
  await prisma.chamado.updateMany({
    where: { ordemId: osTitular.id, id: { not: chamadoTitular.id } },
    data: { ordemId: null },
  })
  chamadoTitular = await prisma.chamado.update({
    where: { id: chamadoTitular.id },
    data: { ordemId: osTitular.id, nome: titular.cliente.nome, telefone: telTitular },
  })

  const agora = new Date()
  const solicitacoesSeed = [
    {
      chave: 'lgpd-vencida',
      tipo: 'ACESSO',
      solicitanteNome: 'Ana Pedido Vencido',
      status: 'ABERTA',
      descricao: 'Pedido fictício de acesso — prazo vencido para destaque na lista.',
      recebidoEm: addDays(hoje, -30),
      prazoEm: addDays(hoje, -10),
      canal: 'SITE',
    },
    {
      chave: 'lgpd-analise',
      tipo: 'CORRECAO',
      solicitanteNome: 'Bruno Pedido Análise',
      status: 'EM_ANALISE',
      descricao: 'Pedido fictício de correção em análise.',
      recebidoEm: addDays(hoje, -3),
      prazoEm: addDays(hoje, 12),
      canal: 'WHATSAPP',
    },
    {
      chave: 'lgpd-atendida',
      tipo: 'INFORMACAO',
      solicitanteNome: 'Carla Pedido Atendido',
      status: 'ATENDIDA',
      descricao: 'Pedido fictício de informação já atendido.',
      recebidoEm: addDays(hoje, -20),
      prazoEm: addDays(hoje, -5),
      canal: 'PRESENCIAL',
      concluidoEm: addDays(hoje, -4),
      resposta: 'Informação enviada (fictício).',
    },
  ]
  for (const s of solicitacoesSeed) {
    const existente = await prisma.solicitacaoTitular.findFirst({
      where: { empresaCodigo: EMPRESA, solicitanteNome: s.solicitanteNome },
    })
    if (existente) {
      await prisma.solicitacaoTitular.update({
        where: { id: existente.id },
        data: {
          tipo: s.tipo,
          status: s.status,
          descricao: s.descricao,
          recebidoEm: s.recebidoEm,
          prazoEm: s.prazoEm,
          canal: s.canal,
          concluidoEm: s.concluidoEm || null,
          resposta: s.resposta || null,
          chamadoNumero: chamadoTitular.numero,
        },
      })
    } else {
      await prisma.solicitacaoTitular.create({
        data: {
          empresaCodigo: EMPRESA,
          tipo: s.tipo,
          solicitanteNome: s.solicitanteNome,
          solicitanteTelefone: '(42) 98888-3000',
          chamadoNumero: chamadoTitular.numero,
          descricao: s.descricao,
          canal: s.canal,
          recebidoEm: s.recebidoEm,
          prazoEm: s.prazoEm,
          status: s.status,
          concluidoEm: s.concluidoEm || null,
          resposta: s.resposta || null,
        },
      })
    }
  }

  // Retenção: titular + OS encerrada há mais de 5 anos
  const antigo = await ensureCliente(
    'Cliente Retencao Antiga LGPD',
    '(42) 98888-3099',
    'Rua Antiga 50',
    'Porto União',
  )
  const encAntigo = utc(2018, 6, 15)
  const osAntiga = await prepararOrdem({
    numero: 202,
    clienteId: antigo.cliente.id,
    enderecoId: antigo.endereco.id,
    situacao: OrdemSituacao.ENCERRADA,
    dataAbertura: utc(2018, 6, 1),
    dataEncerramento: encAntigo,
    vistoria: 'OS antiga para retenção',
    servicos: 'Serviço encerrado em 2018',
    funcionarioId: func?.id,
    maoDeObra: 40,
  })
  await prisma.ordemServico.update({
    where: { id: osAntiga.id },
    data: { situacao: OrdemSituacao.ENCERRADA, dataEncerramento: encAntigo },
  })
  const maxChamado2 = await prisma.chamado.aggregate({ where: { empresaCodigo: EMPRESA }, _max: { numero: true } })
  const numChamadoAntigo = (maxChamado2._max.numero || 300) + 1
  const chamadoAntigo = await prisma.chamado.findFirst({
    where: { empresaCodigo: EMPRESA, telefone: '42988883099' },
  })
  if (!chamadoAntigo) {
    await prisma.chamado.create({
      data: {
        empresaCodigo: EMPRESA,
        numero: numChamadoAntigo,
        nome: antigo.cliente.nome,
        telefone: '42988883099',
        whatsapp: 'celular',
        cep: '84600-000',
        logradouro: 'Rua Antiga',
        numeroEndereco: '50',
        bairro: 'Centro',
        cidade: 'Porto União',
        uf: 'SC',
        tipo: 'outro',
        descricao: 'Chamado antigo fictício (mais de 5 anos após encerramento).',
        origem: 'telefone',
        ordemId: osAntiga.id,
        aceiteEm: null,
        avisoVersao: null,
        createdAt: utc(2018, 6, 1),
      },
    })
  }

  const entrada101 = await prisma.financeiroTitulo.findFirst({
    where: { empresaCodigo: EMPRESA, numeroDocumento: 'OS-0101', parcela: 'ENTRADA' },
  })
  console.log('seed:demo — ok', {
    capturaTesteId: captura.id,
    osEncerradas: [101, 102, 103, 104, 105, 106],
    os101EntradaParcela: entrada101?.parcela || null,
    os101EntradaValor: entrada101 ? Number(entrada101.valor) : null,
    ferramentaAbaixoMinimo: ferramentas[0]?.descricao || null,
    titularLgpd: titular.cliente.nome,
    osTitular: 201,
    osRetencaoAntiga: 202,
    solicitacoesLgpd: 3,
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
