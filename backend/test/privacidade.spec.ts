import 'reflect-metadata'
import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { MAPA_DADOS_PESSOAIS } from '../src/privacidade/mapa-dados'
import {
  ANULAR_IP_APOS_DIAS,
  CLIENTE_ANON_PREFIXO,
  DADO_REMOVIDO,
  FOTO_REMOVIDA,
  TEXTO_REMOVIDO,
} from '../src/privacidade/constantes'

const api = 'http://127.0.0.1:3001'
const root = path.resolve(__dirname, '../..')
const prisma = new PrismaClient()

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

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'X-Empresa-Codigo': '01',
    'Content-Type': 'application/json',
  }
}

describe('privacidade / mapa de dados', () => {
  it('cada modelo.campo do mapa existe no schema Prisma', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Prisma } = require('@prisma/client') as { Prisma: { dmmf: { datamodel: { models: Array<{ name: string; fields: Array<{ name: string }> }> } } } }
    const models = new Map(
      Prisma.dmmf.datamodel.models.map((m) => [m.name, new Set(m.fields.map((f) => f.name))]),
    )
    for (const linha of MAPA_DADOS_PESSOAIS) {
      const campos = models.get(linha.modelo)
      expect(campos).toBeTruthy()
      expect(campos?.has(linha.campo)).toBe(true)
    }
  })
})

describe('privacidade / politica publica', () => {
  it('GET /privacidade/politica sem auth', async () => {
    const r = await fetch(`${api}/privacidade/politica`)
    expect(r.status).toBe(200)
    const body = await r.json()
    expect(body.versao).toBeTruthy()
    expect(body.contatoVariavel).toBe('VITE_PRIVACY_CONTACT')
  })
})

describe('privacidade / permissoes', () => {
  it('funcionario recebe 403 nas rotas internas', async () => {
    const cred = lerCaptura()
    const email = cred.CAPTURA_FUNC_EMAIL || 'captura.teste'
    const senha = cred.CAPTURA_FUNC_SENHA || 'func123'
    const r = await login(email, senha)
    expect([200, 201]).toContain(r.status)
    const h = headers(r.token)
    for (const rota of ['/privacidade/solicitacoes', '/privacidade/mapa', '/privacidade/alertas', '/privacidade/titular?q=teste']) {
      const res = await fetch(`${api}${rota}`, { headers: h })
      expect([401, 403]).toContain(res.status)
    }
  })

  it('admin acessa solicitacoes e mapa', async () => {
    const cred = lerCaptura()
    const r = await login(cred.CAPTURA_ADMIN_EMAIL, cred.CAPTURA_ADMIN_SENHA)
    const h = headers(r.token)
    const sol = await fetch(`${api}/privacidade/solicitacoes`, { headers: h })
    expect(sol.status).toBe(200)
    const mapa = await fetch(`${api}/privacidade/mapa`, { headers: h })
    expect(mapa.status).toBe(200)
    const body = await mapa.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(5)
  })
})

describe('privacidade / anonimizacao titular', () => {
  it('anonimiza titular ficticio e preserva numeros/valores', async () => {
    const cred = lerCaptura()
    const r = await login(cred.CAPTURA_ADMIN_EMAIL, cred.CAPTURA_ADMIN_SENHA)
    const h = headers(r.token)

    const sufixo = Date.now()
    const cliente = await prisma.cliente.create({
      data: {
        empresaCodigo: '01',
        nome: `Titular LGPD ${sufixo}`,
        telefone: `11999${String(sufixo).slice(-6)}`,
        endereco: 'Rua Ficticia 100',
        cidade: 'Porto Uniao',
      },
    })
    const endereco = await prisma.clienteEndereco.create({
      data: {
        clienteId: cliente.id,
        logradouro: 'Rua Ficticia 100',
        cidade: 'Porto Uniao',
        apelido: 'Casa',
        principal: true,
      },
    })
    const maxOrdem = await prisma.ordemServico.aggregate({
      where: { empresaCodigo: '01' },
      _max: { numero: true },
    })
    const numeroOrdem = (maxOrdem._max.numero || 9000) + 1
    const ordem = await prisma.ordemServico.create({
      data: {
        empresaCodigo: '01',
        numero: numeroOrdem,
        clienteId: cliente.id,
        enderecoId: endereco.id,
        situacao: 'ENCERRADA',
        dataAbertura: new Date('2020-01-10'),
        dataEncerramento: new Date('2020-01-15'),
        descricaoProblema: 'Vazamento ficticio com nome da pessoa',
        assinatura: 'data:image/png;base64,AAA',
        taxaVistoria: 10,
        maoDeObra: 50,
        deslocamento: 0,
        material: 0,
      },
    })
    await prisma.ordemFoto.create({
      data: { ordemId: ordem.id, momento: 'ANTES', url: 'data:image/png;base64,BBB' },
    })
    const maxChamado = await prisma.chamado.aggregate({
      where: { empresaCodigo: '01' },
      _max: { numero: true },
    })
    const numeroChamado = (maxChamado._max.numero || 9000) + 1
    const chamado = await prisma.chamado.create({
      data: {
        empresaCodigo: '01',
        numero: numeroChamado,
        nome: cliente.nome,
        telefone: cliente.telefone!,
        whatsapp: 'celular',
        cep: '84600-000',
        logradouro: 'Rua Ficticia',
        numeroEndereco: '100',
        bairro: 'Centro',
        cidade: 'Porto Uniao',
        uf: 'SC',
        tipo: 'vazamento',
        descricao: 'Descricao com dado pessoal ficticio',
        origem: 'site',
        ipOrigem: '203.0.113.10',
        ordemId: ordem.id,
        aceiteEm: new Date(),
        avisoVersao: '2026-11-13-v3',
      },
    })
    await prisma.chamadoNota.create({
      data: { chamadoId: chamado.id, texto: 'Nota com telefone 11999990000', autor: 'admin' },
    })
    await prisma.chamadoFoto.create({
      data: { chamadoId: chamado.id, situacao: 'ANTES', url: 'data:image/png;base64,CCC' },
    })
    const titulo = await prisma.financeiroTitulo.create({
      data: {
        empresaCodigo: '01',
        tipo: 'RECEBER',
        pessoa: cliente.nome,
        numeroDocumento: `LGPD-${sufixo}`,
        tipoDocumento: 'RECIBO',
        planoContas: 'SERVICOS',
        formaPagamento: 'PIX',
        valor: 60,
        dataEmissao: new Date('2020-01-15'),
        dataVencimento: new Date('2020-02-15'),
        status: 'ABERTO',
        parcela: '1/1',
      },
    })

    const somaAntes = await prisma.financeiroTitulo.aggregate({
      where: { empresaCodigo: '01', tipo: 'RECEBER' },
      _sum: { valor: true },
    })

    const res = await fetch(`${api}/privacidade/titular/${cliente.id}/anonimizar`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ confirmacao: 'ANONIMIZAR' }),
    })
    expect([200, 201]).toContain(res.status)
    const body = await res.json()
    expect(body.ok).toBe(true)

    const clienteDepois = await prisma.cliente.findUnique({ where: { id: cliente.id } })
    expect(clienteDepois?.nome).toBe(DADO_REMOVIDO)
    expect(clienteDepois?.telefone).toBe(DADO_REMOVIDO)
    expect(clienteDepois?.endereco).toBe(DADO_REMOVIDO)

    const endDepois = await prisma.clienteEndereco.findUnique({ where: { id: endereco.id } })
    expect(endDepois?.logradouro).toBe(DADO_REMOVIDO)

    const chamadoDepois = await prisma.chamado.findUnique({
      where: { id: chamado.id },
      include: { fotos: true, notas: true },
    })
    expect(chamadoDepois?.nome).toBe(DADO_REMOVIDO)
    expect(chamadoDepois?.telefone).toBe(DADO_REMOVIDO)
    expect(chamadoDepois?.descricao).toBe(TEXTO_REMOVIDO)
    expect(chamadoDepois?.ipOrigem).toBeNull()
    expect(chamadoDepois?.numero).toBe(numeroChamado)
    expect(chamadoDepois?.fotos[0]?.url).toBe(FOTO_REMOVIDA)
    expect(chamadoDepois?.notas[0]?.texto).toBe(TEXTO_REMOVIDO)

    const ordemDepois = await prisma.ordemServico.findUnique({
      where: { id: ordem.id },
      include: { fotos: true },
    })
    expect(ordemDepois?.numero).toBe(numeroOrdem)
    expect(ordemDepois?.assinatura).toBeNull()
    expect(ordemDepois?.descricaoProblema).toBe(TEXTO_REMOVIDO)
    expect(Number(ordemDepois?.taxaVistoria)).toBe(10)
    expect(Number(ordemDepois?.maoDeObra)).toBe(50)
    expect(ordemDepois?.fotos[0]?.url).toBe(FOTO_REMOVIDA)

    const tituloDepois = await prisma.financeiroTitulo.findUnique({ where: { id: titulo.id } })
    expect(tituloDepois?.pessoa).toBe(`${CLIENTE_ANON_PREFIXO}${cliente.id}`)
    expect(Number(tituloDepois?.valor)).toBe(60)

    const somaDepois = await prisma.financeiroTitulo.aggregate({
      where: { empresaCodigo: '01', tipo: 'RECEBER' },
      _sum: { valor: true },
    })
    expect(Number(somaDepois._sum.valor)).toBe(Number(somaAntes._sum.valor))

    // idempotente
    const res2 = await fetch(`${api}/privacidade/titular/${cliente.id}/anonimizar`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ confirmacao: 'ANONIMIZAR' }),
    })
    expect([200, 201]).toContain(res2.status)
  })
})

describe('privacidade / busca titular por nome', () => {
  it('busca por nome conta so chamados do titular (nao contains solto)', async () => {
    const cred = lerCaptura()
    const r = await login(cred.CAPTURA_ADMIN_EMAIL, cred.CAPTURA_ADMIN_SENHA)
    const h = headers(r.token)
    const sufixo = Date.now()
    const nome = `Maria Contagem ${sufixo}`
    const telefone = `(42) 988${String(sufixo).slice(-6)}`
    const cliente = await prisma.cliente.create({
      data: {
        empresaCodigo: '01',
        nome,
        telefone,
        endereco: 'Rua Contagem 1',
        cidade: 'Porto Uniao',
      },
    })
    const maxOrdem = await prisma.ordemServico.aggregate({
      where: { empresaCodigo: '01' },
      _max: { numero: true },
    })
    const ordem = await prisma.ordemServico.create({
      data: {
        empresaCodigo: '01',
        numero: (maxOrdem._max.numero || 9400) + 1,
        clienteId: cliente.id,
        situacao: 'ENCERRADA',
        dataAbertura: new Date('2022-01-01'),
        dataEncerramento: new Date('2022-01-02'),
        taxaVistoria: 0,
        maoDeObra: 10,
        deslocamento: 0,
        material: 0,
      },
    })
    const maxChamado = await prisma.chamado.aggregate({
      where: { empresaCodigo: '01' },
      _max: { numero: true },
    })
    const n1 = (maxChamado._max.numero || 9500) + 1
    await prisma.chamado.create({
      data: {
        empresaCodigo: '01',
        numero: n1,
        nome,
        telefone,
        whatsapp: 'celular',
        cep: '84600-000',
        logradouro: 'Rua Contagem',
        numeroEndereco: '1',
        bairro: 'Centro',
        cidade: 'Porto Uniao',
        uf: 'SC',
        tipo: 'outro',
        descricao: 'chamado ligado a OS do titular',
        origem: 'site',
        ordemId: ordem.id,
      },
    })
    // chamado com nome parecido, sem ligacao com este cliente
    await prisma.chamado.create({
      data: {
        empresaCodigo: '01',
        numero: n1 + 1,
        nome: `${nome} Extra`,
        telefone: '(42) 90000-9999',
        whatsapp: 'celular',
        cep: '84600-000',
        logradouro: 'Rua Outra',
        numeroEndereco: '2',
        bairro: 'Centro',
        cidade: 'Porto Uniao',
        uf: 'SC',
        tipo: 'outro',
        descricao: 'chamado alheio que contains o nome',
        origem: 'site',
      },
    })

    const porNome = await fetch(`${api}/privacidade/titular?q=${encodeURIComponent(nome)}`, { headers: h })
    expect(porNome.status).toBe(200)
    const dados = await porNome.json()
    expect(dados.cliente.id).toBe(cliente.id)
    expect(dados.chamados).toHaveLength(1)
    expect(dados.chamados[0].numero).toBe(n1)

    const porId = await fetch(`${api}/privacidade/titular?q=${cliente.id}`, { headers: h })
    const dadosId = await porId.json()
    expect(dadosId.chamados).toHaveLength(1)
    expect(dadosId.chamados[0].numero).toBe(n1)
  })
})

describe('privacidade / busca titular por id', () => {
  it('busca por id do cliente nao inclui chamado com o mesmo numero', async () => {
    const cred = lerCaptura()
    const r = await login(cred.CAPTURA_ADMIN_EMAIL, cred.CAPTURA_ADMIN_SENHA)
    const h = headers(r.token)

    const sufixo = Date.now()
    const cliente = await prisma.cliente.create({
      data: {
        empresaCodigo: '01',
        nome: `Busca Id ${sufixo}`,
        telefone: `11977${String(sufixo).slice(-6)}`,
        endereco: 'Rua Id 1',
        cidade: 'Porto Uniao',
      },
    })
    const maxOrdem = await prisma.ordemServico.aggregate({
      where: { empresaCodigo: '01' },
      _max: { numero: true },
    })
    const ordem = await prisma.ordemServico.create({
      data: {
        empresaCodigo: '01',
        numero: (maxOrdem._max.numero || 9200) + 1,
        clienteId: cliente.id,
        situacao: 'ENCERRADA',
        dataAbertura: new Date('2021-01-01'),
        dataEncerramento: new Date('2021-01-02'),
        taxaVistoria: 0,
        maoDeObra: 10,
        deslocamento: 0,
        material: 0,
      },
    })
    const maxChamado = await prisma.chamado.aggregate({
      where: { empresaCodigo: '01' },
      _max: { numero: true },
    })
    const numeroProprio = (maxChamado._max.numero || 9300) + 1
    await prisma.chamado.create({
      data: {
        empresaCodigo: '01',
        numero: numeroProprio,
        nome: cliente.nome,
        telefone: cliente.telefone!,
        whatsapp: 'celular',
        cep: '84600-000',
        logradouro: 'Rua Id',
        numeroEndereco: '1',
        bairro: 'Centro',
        cidade: 'Porto Uniao',
        uf: 'SC',
        tipo: 'outro',
        descricao: 'chamado do titular',
        origem: 'site',
        ordemId: ordem.id,
      },
    })
    // chamado alheio com numero == cliente.id (o bug antigo misturava os dois)
    const alheioExiste = await prisma.chamado.findFirst({
      where: { empresaCodigo: '01', numero: cliente.id },
    })
    if (!alheioExiste) {
      await prisma.chamado.create({
        data: {
          empresaCodigo: '01',
          numero: cliente.id,
          nome: 'Outro Cliente Alheio',
          telefone: '11900001111',
          whatsapp: 'celular',
          cep: '84600-000',
          logradouro: 'Rua Outra',
          numeroEndereco: '9',
          bairro: 'Centro',
          cidade: 'Porto Uniao',
          uf: 'SC',
          tipo: 'outro',
          descricao: 'chamado alheio com numero igual ao id do cliente',
          origem: 'site',
        },
      })
    }

    const porNome = await fetch(`${api}/privacidade/titular?q=${encodeURIComponent(cliente.nome)}`, { headers: h })
    expect(porNome.status).toBe(200)
    const dadosNome = await porNome.json()
    expect(dadosNome.cliente.id).toBe(cliente.id)
    expect(dadosNome.chamados).toHaveLength(1)
    expect(dadosNome.chamados[0].numero).toBe(numeroProprio)

    const porId = await fetch(`${api}/privacidade/titular?q=${cliente.id}`, { headers: h })
    expect(porId.status).toBe(200)
    const dadosId = await porId.json()
    expect(dadosId.cliente.id).toBe(cliente.id)
    expect(dadosId.chamados).toHaveLength(1)
    expect(dadosId.chamados[0].numero).toBe(numeroProprio)
    expect(dadosId.chamados.map((c: { numero: number }) => c.numero)).not.toContain(
      dadosId.chamados.length > 1 ? -1 : cliente.id === numeroProprio ? -1 : cliente.id,
    )
    // se existir chamado com numero == cliente.id, ele nao deve aparecer
    expect(dadosId.chamados.every((c: { numero: number }) => c.numero === numeroProprio)).toBe(true)
  })
})

describe('privacidade / IP antigo', () => {
  it('anula IP antigo e preserva recente', async () => {
    const antigo = new Date(Date.now() - (ANULAR_IP_APOS_DIAS + 5) * 86400000)
    const recente = new Date()
    const maxChamado = await prisma.chamado.aggregate({
      where: { empresaCodigo: '01' },
      _max: { numero: true },
    })
    const n1 = (maxChamado._max.numero || 9100) + 1
    const n2 = n1 + 1
    const cAntigo = await prisma.chamado.create({
      data: {
        empresaCodigo: '01',
        numero: n1,
        nome: 'IP Antigo',
        telefone: '11988887777',
        whatsapp: 'celular',
        cep: '84600-000',
        logradouro: 'Rua A',
        numeroEndereco: '1',
        bairro: 'Centro',
        cidade: 'Porto Uniao',
        uf: 'SC',
        tipo: 'outro',
        descricao: 'teste ip antigo',
        origem: 'site',
        ipOrigem: '198.51.100.10',
        createdAt: antigo,
        updatedAt: antigo,
      },
    })
    const cRecente = await prisma.chamado.create({
      data: {
        empresaCodigo: '01',
        numero: n2,
        nome: 'IP Recente',
        telefone: '11988886666',
        whatsapp: 'celular',
        cep: '84600-000',
        logradouro: 'Rua B',
        numeroEndereco: '2',
        bairro: 'Centro',
        cidade: 'Porto Uniao',
        uf: 'SC',
        tipo: 'outro',
        descricao: 'teste ip recente',
        origem: 'site',
        ipOrigem: '198.51.100.20',
        createdAt: recente,
        updatedAt: recente,
      },
    })

    const { PrivacidadeService } = await import('../src/privacidade/privacidade.service')
    const service = new PrivacidadeService(prisma as any)
    await service.anularIps({ dryRun: false })

    const a = await prisma.chamado.findUnique({ where: { id: cAntigo.id } })
    const b = await prisma.chamado.findUnique({ where: { id: cRecente.id } })
    expect(a?.ipOrigem).toBeNull()
    expect(b?.ipOrigem).toBe('198.51.100.20')
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})
