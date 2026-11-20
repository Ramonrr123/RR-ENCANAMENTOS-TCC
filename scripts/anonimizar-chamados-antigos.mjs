/**
 * Anonimiza chamados encerrados além da retenção proposta (5 anos após o encerramento),
 * sem atividade recente. Não apaga OS, títulos, valores, margens, peças nem NFs de estoque.
 *
 * Uso (somente localhost):
 *   node scripts/anonimizar-chamados-antigos.mjs --dry-run
 *   node scripts/anonimizar-chamados-antigos.mjs --execute
 *
 * TODO-juridico: confirmar o prazo de 5 anos com o responsável legal.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const require = createRequire(path.join(ROOT, 'backend', 'package.json'))
const { PrismaClient } = require('@prisma/client')
const DADO_REMOVIDO = 'Dado removido'
const RETENCAO_ANOS = 5
const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const execute = args.has('--execute')

if (dryRun === execute) {
  console.error('Informe exatamente um modo: --dry-run ou --execute')
  process.exit(1)
}

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

function dataLimite() {
  const limite = new Date()
  limite.setFullYear(limite.getFullYear() - RETENCAO_ANOS)
  return limite
}

function encerradoEm(chamado) {
  if (chamado.ordem?.dataEncerramento) return chamado.ordem.dataEncerramento
  if (chamado.status === 'RESOLVIDO') return chamado.updatedAt
  const situacao = chamado.ordem?.situacao
  if (situacao === 'ENCERRADA' || situacao === 'CONCLUIDA' || situacao === 'CANCELADA') {
    return chamado.ordem.updatedAt
  }
  return null
}

function semAtividadeRecente(chamado, limite) {
  if (chamado.updatedAt > limite) return false
  if (chamado.ordem && chamado.ordem.updatedAt > limite) return false
  return true
}

async function anonimizarUm(prisma, chamado, aplicar) {
  const ordem = chamado.ordem
  const resumo = {
    chamadoId: chamado.id,
    numero: chamado.numero,
    ordemId: ordem?.id ?? null,
    ordemNumero: ordem?.numero ?? null,
    clienteId: ordem?.clienteId ?? null,
  }
  if (!aplicar) return resumo

  await prisma.$transaction(async (tx) => {
    await tx.chamado.update({
      where: { id: chamado.id },
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
        notas: {
          create: {
            texto: 'Dados pessoais anonimizados por retenção (script).',
            autor: 'Sistema',
          },
        },
      },
    })
    if (!ordem) return
    await tx.cliente.update({
      where: { id: ordem.clienteId },
      data: {
        nome: DADO_REMOVIDO,
        telefone: DADO_REMOVIDO,
        endereco: DADO_REMOVIDO,
        cidade: DADO_REMOVIDO,
      },
    })
    await tx.clienteEndereco.updateMany({
      where: { clienteId: ordem.clienteId },
      data: { logradouro: DADO_REMOVIDO, cidade: DADO_REMOVIDO },
    })
    if (ordem.descricaoProblema) {
      const limpa = ordem.descricaoProblema
        .split('\n')
        .map((linha) => (/^CEP\s+\d{5}-?\d{3}\s*$/i.test(linha.trim()) ? `CEP ${DADO_REMOVIDO}` : linha))
        .join('\n')
      if (limpa !== ordem.descricaoProblema) {
        await tx.ordemServico.update({
          where: { id: ordem.id },
          data: { descricaoProblema: limpa },
        })
      }
    }
  })
  return resumo
}

carregarEnv()
exigirLocalhost(process.env.DATABASE_URL)

const prisma = new PrismaClient()
const limite = dataLimite()

try {
  const candidatos = await prisma.chamado.findMany({
    where: {
      nome: { not: DADO_REMOVIDO },
      OR: [
        { status: 'RESOLVIDO' },
        { ordem: { situacao: { in: ['ENCERRADA', 'CONCLUIDA', 'CANCELADA'] } } },
      ],
    },
    select: {
      id: true,
      numero: true,
      status: true,
      updatedAt: true,
      ordem: {
        select: {
          id: true,
          numero: true,
          clienteId: true,
          situacao: true,
          dataEncerramento: true,
          updatedAt: true,
          descricaoProblema: true,
        },
      },
    },
    orderBy: { numero: 'asc' },
  })

  const elegiveis = candidatos.filter((chamado) => {
    const fim = encerradoEm(chamado)
    if (!fim || fim > limite) return false
    return semAtividadeRecente(chamado, limite)
  })

  const resultados = []
  for (const chamado of elegiveis) {
    resultados.push(await anonimizarUm(prisma, chamado, execute))
  }

  console.log(
    JSON.stringify(
      {
        modo: execute ? 'execute' : 'dry-run',
        retencaoAnos: RETENCAO_ANOS,
        limite: limite.toISOString().slice(0, 10),
        candidatos: candidatos.length,
        elegiveis: elegiveis.length,
        itens: resultados,
      },
      null,
      2,
    ),
  )
} finally {
  await prisma.$disconnect()
}
