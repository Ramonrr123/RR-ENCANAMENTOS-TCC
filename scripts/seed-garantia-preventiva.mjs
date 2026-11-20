/**
 * Seed local das ordens fictícias de garantia/preventiva.
 * Ajusta a data de encerramento de cada cenário; garantiaAte e preventivaEm
 * saem da mesma conta do encerrar (90 dias / 6 meses).
 *
 * Uso: node scripts/seed-garantia-preventiva.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import {
  adicionarDias,
  adicionarMeses,
  datasDoEncerramento,
  GARANTIA_DIAS,
  hoje,
  ymd,
} from './lib/datas-encerramento.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const require = createRequire(path.join(ROOT, 'backend', 'package.json'))
const { PrismaClient, OrdemOrigem, OrdemSituacao, OrdemTipo, TipoPessoa } = require('@prisma/client')

const EMPRESA = '01'

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

const ref = hoje()

/** Cenários: só se mexe no encerramento; as outras datas vêm da regra. */
const CENARIOS = [
  {
    chave: 'garantia_vigente',
    nome: 'Cliente Fictício Garantia TCC',
    telefone: '(42) 90000-0101',
    logradouro: 'Rua Fictícia da Garantia, 100',
    cidade: 'Porto União',
    servicos: 'Troca fictícia de registro e reparo de vazamento',
    status: 'a_contatar',
    // encerrada há 30 dias → garantia ainda válida (~60 dias restantes)
    encerramento: adicionarDias(ref, -30),
  },
  {
    chave: 'garantia_vencida',
    nome: 'Cliente Fictício Garantia Vencida',
    telefone: '(42) 90000-0104',
    logradouro: 'Rua Fictícia Garantia Vencida, 22',
    cidade: 'Porto União',
    servicos: 'Reparo fictício com garantia já vencida',
    status: 'a_contatar',
    // encerrada há 120 dias → garantia vencida há 30 dias; preventiva ainda longe
    encerramento: adicionarDias(ref, -120),
  },
  {
    chave: 'preventiva_a_vencer',
    nome: 'Cliente Fictício Visita Agendada',
    telefone: '(42) 90000-0103',
    logradouro: 'Travessa Fictícia Agendada, 7',
    cidade: 'União da Vitória',
    servicos: 'Revisão fictícia de aquecedor',
    status: 'agendada',
    // preventiva ~20 dias à frente (garantia já vencida pela regra 90d vs 6m)
    encerramento: adicionarDias(adicionarMeses(ref, -6), 20),
  },
  {
    chave: 'preventiva_atrasada',
    nome: 'Cliente Fictício Preventiva Atrasada',
    telefone: '(42) 90000-0102',
    logradouro: 'Avenida Fictícia da Preventiva, 50',
    cidade: 'Porto União',
    servicos: 'Limpeza fictícia de caixa d água',
    status: 'contatado',
    // preventiva ~8 dias atrasada
    encerramento: adicionarDias(adicionarMeses(ref, -6), -8),
  },
]

const prisma = new PrismaClient()

async function upsertCenario(cenario) {
  const { garantiaAte, preventivaEm } = datasDoEncerramento(cenario.encerramento)
  const abertura = adicionarDias(cenario.encerramento, -10)

  let cliente = await prisma.cliente.findFirst({
    where: { empresaCodigo: EMPRESA, nome: cenario.nome },
  })
  if (!cliente) {
    cliente = await prisma.cliente.create({
      data: {
        empresaCodigo: EMPRESA,
        nome: cenario.nome,
        telefone: cenario.telefone,
        endereco: cenario.logradouro,
        cidade: cenario.cidade,
        tipoPessoa: TipoPessoa.FISICA,
      },
    })
  } else {
    cliente = await prisma.cliente.update({
      where: { id: cliente.id },
      data: {
        telefone: cenario.telefone,
        endereco: cenario.logradouro,
        cidade: cenario.cidade,
      },
    })
  }

  let endereco = await prisma.clienteEndereco.findFirst({
    where: { clienteId: cliente.id, logradouro: cenario.logradouro },
  })
  if (!endereco) {
    endereco = await prisma.clienteEndereco.create({
      data: {
        clienteId: cliente.id,
        apelido: 'Principal',
        logradouro: cenario.logradouro,
        cidade: cenario.cidade,
        principal: true,
      },
    })
  } else {
    endereco = await prisma.clienteEndereco.update({
      where: { id: endereco.id },
      data: { cidade: cenario.cidade, principal: true },
    })
  }

  let ordem = await prisma.ordemServico.findFirst({
    where: {
      empresaCodigo: EMPRESA,
      clienteId: cliente.id,
      situacao: OrdemSituacao.ENCERRADA,
      servicos: cenario.servicos,
    },
  })

  const dadosOrdem = {
    situacao: OrdemSituacao.ENCERRADA,
    servicos: cenario.servicos,
    dataAbertura: abertura,
    dataEncerramento: cenario.encerramento,
    garantiaAte,
    garantiaDias: GARANTIA_DIAS,
    preventivaEm,
    preventivaStatus: cenario.status,
    enderecoId: endereco.id,
    tipo: OrdemTipo.EMERGENCIA,
    origem: OrdemOrigem.WHATSAPP,
  }

  if (!ordem) {
    const max = await prisma.ordemServico.aggregate({
      where: { empresaCodigo: EMPRESA },
      _max: { numero: true },
    })
    ordem = await prisma.ordemServico.create({
      data: {
        empresaCodigo: EMPRESA,
        numero: (max._max.numero ?? 0) + 1,
        clienteId: cliente.id,
        ...dadosOrdem,
      },
    })
  } else {
    ordem = await prisma.ordemServico.update({
      where: { id: ordem.id },
      data: dadosOrdem,
    })
  }

  return {
    chave: cenario.chave,
    cliente: cenario.nome,
    numero: ordem.numero,
    encerramento: ymd(cenario.encerramento),
    garantiaAte: ymd(garantiaAte),
    preventivaEm: ymd(preventivaEm),
  }
}

async function upsertChamadoGarantia() {
  const nome = 'Morador Fictício do Chamado'
  const existente = await prisma.chamado.findFirst({
    where: { empresaCodigo: EMPRESA, nome },
  })
  if (existente) return { numero: existente.numero, acao: 'ja_existe' }
  const max = await prisma.chamado.aggregate({
    where: { empresaCodigo: EMPRESA },
    _max: { numero: true },
  })
  const criado = await prisma.chamado.create({
    data: {
      empresaCodigo: EMPRESA,
      numero: (max._max.numero ?? 0) + 1,
      nome,
      telefone: '(42) 90000-0199',
      whatsapp: 'celular',
      cep: '89400000',
      logradouro: 'Rua Fictícia da Garantia',
      numeroEndereco: '100',
      bairro: 'Centro',
      cidade: 'Porto União',
      uf: 'SC',
      tipo: 'Vazamento',
      descricao: 'Vazamento fictício no endereço com garantia em vigor.',
      status: 'ABERTO',
    },
  })
  return { numero: criado.numero, acao: 'criado' }
}

try {
  const resultados = []
  for (const cenario of CENARIOS) {
    resultados.push(await upsertCenario(cenario))
  }
  const chamado = await upsertChamadoGarantia()
  console.log(JSON.stringify({ ok: true, ordens: resultados, chamado }, null, 2))
} catch (erro) {
  console.error('FALHA', String(erro.message || erro))
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
