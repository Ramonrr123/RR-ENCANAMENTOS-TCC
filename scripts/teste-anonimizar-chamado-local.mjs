/**
 * Cria chamado+cliente+OS fictícios no Postgres local, anonimiza e confere campos.
 * Uso: node scripts/teste-anonimizar-chamado-local.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const require = createRequire(path.join(ROOT, 'backend', 'package.json'))
const { PrismaClient, OrdemOrigem, OrdemSituacao, OrdemTipo, TipoPessoa } = require('@prisma/client')
const DADO_REMOVIDO = 'Dado removido'
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

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

carregarEnv()
exigirLocalhost(process.env.DATABASE_URL)

const prisma = new PrismaClient()
const marca = `TCC-ANON-${Date.now()}`

try {
  const resultado = await prisma.$transaction(async (tx) => {
    const maxChamado = await tx.chamado.aggregate({ where: { empresaCodigo: EMPRESA }, _max: { numero: true } })
    const maxOrdem = await tx.ordemServico.aggregate({ where: { empresaCodigo: EMPRESA }, _max: { numero: true } })
    const numeroChamado = (maxChamado._max.numero ?? 0) + 1
    const numeroOrdem = (maxOrdem._max.numero ?? 0) + 1

    const cliente = await tx.cliente.create({
      data: {
        empresaCodigo: EMPRESA,
        nome: `Cliente Fictício ${marca}`,
        telefone: '(11) 98888-7777',
        endereco: 'Rua Fictícia 100, Centro',
        cidade: 'São Paulo - SP',
        tipoPessoa: TipoPessoa.FISICA,
      },
    })
    const endereco = await tx.clienteEndereco.create({
      data: {
        clienteId: cliente.id,
        apelido: `Chamado teste ${marca}`,
        logradouro: 'Rua Fictícia 100, Centro · CEP 01001-000',
        cidade: 'São Paulo - SP',
        principal: false,
      },
    })
    const ordem = await tx.ordemServico.create({
      data: {
        empresaCodigo: EMPRESA,
        numero: numeroOrdem,
        clienteId: cliente.id,
        enderecoId: endereco.id,
        tipo: OrdemTipo.EMERGENCIA,
        origem: OrdemOrigem.WHATSAPP,
        descricaoProblema: `Chamado teste\nVazamento fictício ${marca}\nCEP 01001-000\nContato no formato de celular usado pelo WhatsApp.`,
        situacao: OrdemSituacao.ABERTA,
        dataAbertura: new Date(),
        maoDeObra: 150,
        margem: 40,
      },
    })
    const pecaProduto = await tx.produto.findFirst({
      where: { empresaCodigo: EMPRESA, ativo: true },
      select: { id: true },
    })
    if (pecaProduto) {
      await tx.ordemPeca.create({
        data: {
          ordemId: ordem.id,
          produtoId: pecaProduto.id,
          quantidade: 1,
          custoUnitario: 10,
        },
      })
    }
    const titulo = await tx.financeiroTitulo.create({
      data: {
        empresaCodigo: EMPRESA,
        tipo: 'RECEBER',
        pessoa: `Cliente Fictício ${marca}`,
        numeroDocumento: `NF-TESTE-${marca}`,
        tipoDocumento: 'Recibo',
        planoContas: 'Serviço de encanamento',
        formaPagamento: 'PIX',
        valor: 150,
        dataVencimento: new Date(),
        observacao: `Título fictício ${marca}`,
        status: 'ABERTO',
      },
    })
    const chamado = await tx.chamado.create({
      data: {
        empresaCodigo: EMPRESA,
        numero: numeroChamado,
        nome: `Morador Fictício ${marca}`,
        telefone: '(11) 98888-7777',
        whatsapp: 'celular',
        cep: '01001-000',
        logradouro: 'Rua Fictícia',
        numeroEndereco: '100',
        bairro: 'Centro',
        cidade: 'São Paulo',
        uf: 'SP',
        tipo: 'Vazamento',
        descricao: `Descrição fictícia do problema ${marca}`,
        ordemId: ordem.id,
        avisoVersao: '2026-11-12-v2',
      },
    })
    return { chamado, ordem, cliente, endereco, titulo, temPeca: Boolean(pecaProduto) }
  })

  // Replica a lógica de anonimizar (mesmo conjunto de campos do serviço).
  await prisma.$transaction(async (tx) => {
    await tx.chamado.update({
      where: { id: resultado.chamado.id },
      data: {
        nome: DADO_REMOVIDO,
        telefone: DADO_REMOVIDO,
        whatsapp: 'removido',
        cep: DADO_REMOVIDO,
        logradouro: DADO_REMOVIDO,
        numeroEndereco: DADO_REMOVIDO,
        bairro: DADO_REMOVIDO,
        cidade: DADO_REMOVIDO,
        uf: DADO_REMOVIDO,
      },
    })
    await tx.cliente.update({
      where: { id: resultado.cliente.id },
      data: {
        nome: DADO_REMOVIDO,
        telefone: DADO_REMOVIDO,
        endereco: DADO_REMOVIDO,
        cidade: DADO_REMOVIDO,
      },
    })
    await tx.clienteEndereco.updateMany({
      where: { clienteId: resultado.cliente.id },
      data: { logradouro: DADO_REMOVIDO, cidade: DADO_REMOVIDO },
    })
    const ordem = await tx.ordemServico.findUnique({ where: { id: resultado.ordem.id } })
    const limpa = (ordem.descricaoProblema || '')
      .split('\n')
      .map((linha) => (/^CEP\s+\d{5}-?\d{3}\s*$/i.test(linha.trim()) ? `CEP ${DADO_REMOVIDO}` : linha))
      .join('\n')
    await tx.ordemServico.update({
      where: { id: resultado.ordem.id },
      data: { descricaoProblema: limpa },
    })
  })

  const chamado = await prisma.chamado.findUnique({ where: { id: resultado.chamado.id } })
  const cliente = await prisma.cliente.findUnique({ where: { id: resultado.cliente.id } })
  const endereco = await prisma.clienteEndereco.findUnique({ where: { id: resultado.endereco.id } })
  const ordem = await prisma.ordemServico.findUnique({
    where: { id: resultado.ordem.id },
    include: { pecas: true },
  })
  const titulo = await prisma.financeiroTitulo.findUnique({ where: { id: resultado.titulo.id } })

  assert(chamado.nome === DADO_REMOVIDO, 'chamado.nome')
  assert(chamado.telefone === DADO_REMOVIDO, 'chamado.telefone')
  assert(chamado.logradouro === DADO_REMOVIDO, 'chamado.logradouro')
  assert(chamado.numero === resultado.chamado.numero, 'número do chamado preservado')
  assert(cliente.nome === DADO_REMOVIDO, 'cliente.nome')
  assert(cliente.telefone === DADO_REMOVIDO, 'cliente.telefone')
  assert(cliente.endereco === DADO_REMOVIDO, 'cliente.endereco')
  assert(endereco.logradouro === DADO_REMOVIDO, 'endereco.logradouro')
  assert(ordem.numero === resultado.ordem.numero, 'número da OS preservado')
  assert(String(ordem.maoDeObra) === '150', 'mão de obra preservada')
  assert(String(ordem.margem) === '40', 'margem preservada')
  assert(ordem.descricaoProblema.includes(`CEP ${DADO_REMOVIDO}`), 'CEP anonimizado na OS')
  assert(titulo.observacao.includes(marca), 'observação do título preservada')
  assert(titulo.numeroDocumento.includes(marca), 'número do documento do título preservado')
  assert(String(titulo.valor) === '150', 'valor do título preservado')
  if (resultado.temPeca) assert(ordem.pecas.length === 1, 'peça preservada')

  console.log(
    JSON.stringify(
      {
        ok: true,
        chamadoNumero: chamado.numero,
        ordemNumero: ordem.numero,
        tituloId: titulo.id,
        pecas: ordem.pecas.length,
      },
      null,
      2,
    ),
  )
} finally {
  await prisma.$disconnect()
}
