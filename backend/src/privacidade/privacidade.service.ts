import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  FinanceiroTipo,
  Prisma,
  SolicitacaoTitularCanal,
  SolicitacaoTitularStatus,
  SolicitacaoTitularTipo,
} from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import {
  ANULAR_IP_APOS_DIAS,
  AVISO_VERSAO_PRIVACIDADE,
  CLIENTE_ANON_PREFIXO,
  DADO_REMOVIDO,
  FOTO_REMOVIDA,
  LIMPAR_BLOQUEIOS_EXPIRADOS_DIAS,
  PRAZO_RESPOSTA_SOLICITACAO_DIAS,
  RETENCAO_ANOS_APOS_ENCERRAMENTO,
  TEXTO_REMOVIDO,
} from './constantes'
import { MAPA_DADOS_PESSOAIS } from './mapa-dados'
import {
  AnonimizarTitularDto,
  AtualizarSolicitacaoDto,
  CriarSolicitacaoDto,
} from './dto/privacidade.dto'

@Injectable()
export class PrivacidadeService {
  private exportacoesPorUsuario = new Map<number, number>()

  constructor(private readonly prisma: PrismaService) {}

  politicaPublica() {
    return {
      versao: AVISO_VERSAO_PRIVACIDADE,
      atualizadaEm: '2026-11-13',
      // TODO-juridico: confirmar contato, base legal e encarregado com o controlador.
      contatoVariavel: 'VITE_PRIVACY_CONTACT',
      retencaoAnos: RETENCAO_ANOS_APOS_ENCERRAMENTO,
    }
  }

  mapaDados() {
    return MAPA_DADOS_PESSOAIS
  }

  async alertasPainel(empresaCodigo: string) {
    const empresa = this.empresa(empresaCodigo)
    const agora = new Date()
    const solicitacoesVencidas = await this.prisma.solicitacaoTitular.count({
      where: {
        empresaCodigo: empresa,
        status: { in: [SolicitacaoTitularStatus.ABERTA, SolicitacaoTitularStatus.EM_ANALISE] },
        prazoEm: { lt: agora },
      },
    })
    const retencao = await this.listarRetencaoVencidos(empresa, true)
    return {
      solicitacoesVencidas,
      registrosRetencaoVencidos: retencao.total,
    }
  }

  async listarSolicitacoes(
    empresaCodigo: string,
    filtro: { status?: string; tipo?: string },
  ) {
    const empresa = this.empresa(empresaCodigo)
    const agora = new Date()
    const rows = await this.prisma.solicitacaoTitular.findMany({
      where: {
        empresaCodigo: empresa,
        ...(filtro.status ? { status: filtro.status as SolicitacaoTitularStatus } : {}),
        ...(filtro.tipo ? { tipo: filtro.tipo as SolicitacaoTitularTipo } : {}),
      },
      orderBy: [{ prazoEm: 'asc' }, { id: 'desc' }],
    })
    return rows.map((row) => ({
      ...this.apresentarSolicitacao(row),
      vencida:
        (row.status === SolicitacaoTitularStatus.ABERTA ||
          row.status === SolicitacaoTitularStatus.EM_ANALISE) &&
        row.prazoEm < agora,
    }))
  }

  async criarSolicitacao(
    empresaCodigo: string,
    dto: CriarSolicitacaoDto,
    usuarioId?: number,
    login?: string,
  ) {
    const empresa = this.empresa(empresaCodigo)
    const recebidoEm = new Date()
    const prazoEm = new Date(recebidoEm.getTime() + PRAZO_RESPOSTA_SOLICITACAO_DIAS * 86400000)
    const criada = await this.prisma.solicitacaoTitular.create({
      data: {
        empresaCodigo: empresa,
        tipo: dto.tipo as SolicitacaoTitularTipo,
        solicitanteNome: dto.solicitanteNome.trim(),
        solicitanteTelefone: dto.solicitanteTelefone?.trim() || null,
        chamadoNumero: dto.chamadoNumero ?? null,
        descricao: dto.descricao.trim(),
        canal: dto.canal as SolicitacaoTitularCanal,
        recebidoEm,
        prazoEm,
        status: SolicitacaoTitularStatus.ABERTA,
        responsavelId: usuarioId ?? null,
      },
    })
    await this.registrarAtividade(empresa, usuarioId, login, 'POST /privacidade/solicitacoes', String(criada.id))
    return this.apresentarSolicitacao(criada)
  }

  async atualizarSolicitacao(
    empresaCodigo: string,
    id: number,
    dto: AtualizarSolicitacaoDto,
    usuarioId?: number,
    login?: string,
  ) {
    const empresa = this.empresa(empresaCodigo)
    const atual = await this.prisma.solicitacaoTitular.findFirst({ where: { id, empresaCodigo: empresa } })
    if (!atual) throw new NotFoundException('Solicitação não encontrada.')
    const status = (dto.status as SolicitacaoTitularStatus) || atual.status
    const concluido =
      status === SolicitacaoTitularStatus.ATENDIDA || status === SolicitacaoTitularStatus.RECUSADA
    const salva = await this.prisma.solicitacaoTitular.update({
      where: { id },
      data: {
        status,
        resposta: dto.resposta !== undefined ? dto.resposta.trim() : atual.resposta,
        responsavelId: dto.responsavelId ?? atual.responsavelId,
        concluidoEm: concluido ? new Date() : null,
      },
    })
    await this.registrarAtividade(
      empresa,
      usuarioId,
      login,
      'PATCH /privacidade/solicitacoes',
      String(id),
    )
    return this.apresentarSolicitacao(salva)
  }

  async buscarTitular(empresaCodigo: string, q?: string, chamadoNumero?: number) {
    const empresa = this.empresa(empresaCodigo)
    const termo = String(q || '').trim()
    if (!termo && !chamadoNumero) throw new BadRequestException('Informe nome, telefone ou número do chamado.')

    let clienteId: number | null = null
    let chamadoIds: number[] = []

    if (chamadoNumero) {
      const chamado = await this.prisma.chamado.findFirst({
        where: { empresaCodigo: empresa, numero: chamadoNumero },
        include: { ordem: { select: { clienteId: true } } },
      })
      if (chamado) {
        chamadoIds = [chamado.id]
        clienteId = chamado.ordem?.clienteId ?? null
      }
    }

    if (termo) {
      const idNumerico = /^\d+$/.test(termo) ? Number(termo) : null
      // Busca só por id do cliente: não misturar com chamado.numero == id (evita "Chamados: 2" fantasma).
      if (idNumerico) {
        const porId = await this.prisma.cliente.findFirst({
          where: { id: idNumerico, empresaCodigo: empresa },
        })
        if (porId) {
          clienteId = porId.id
        } else if (!chamadoNumero) {
          // número puro sem cliente: interpreta como número do chamado
          const porChamado = await this.prisma.chamado.findFirst({
            where: { empresaCodigo: empresa, numero: idNumerico },
            include: { ordem: { select: { clienteId: true } } },
          })
          if (porChamado) {
            chamadoIds = [porChamado.id]
            clienteId = porChamado.ordem?.clienteId ?? null
          }
        }
      } else {
        const clientes = await this.prisma.cliente.findMany({
          where: {
            empresaCodigo: empresa,
            OR: [
              { nome: { contains: termo, mode: 'insensitive' } },
              { telefone: { contains: termo } },
            ],
          },
          take: 20,
        })
        if (clientes[0]) clienteId = clientes[0].id
        const chamados = await this.prisma.chamado.findMany({
          where: {
            empresaCodigo: empresa,
            OR: [
              { nome: { contains: termo, mode: 'insensitive' } },
              { telefone: { contains: termo } },
            ],
          },
          take: 50,
        })
        chamadoIds = [...new Set([...chamadoIds, ...chamados.map((c) => c.id)])]
      }
    }

    const cliente = clienteId
      ? await this.prisma.cliente.findFirst({
          where: { id: clienteId, empresaCodigo: empresa },
          include: { enderecos: true, ordens: { select: { id: true, numero: true, situacao: true, dataEncerramento: true, assinatura: true } } },
        })
      : null

    const ordensIds = cliente?.ordens.map((o) => o.id) || []
    // Com cliente resolvido: só chamados daquele titular (OS ligada ou chamado sem OS com telefone/nome exatos).
    // Não misturar "contains" do termo da busca — isso inflava "Chamados: 2" na busca por nome.
    const orCliente: Prisma.ChamadoWhereInput[] = []
    if (cliente) {
      if (ordensIds.length) orCliente.push({ ordemId: { in: ordensIds } })
      if (cliente.telefone && cliente.telefone !== DADO_REMOVIDO) {
        orCliente.push({ ordemId: null, telefone: cliente.telefone })
      }
      if (cliente.nome && cliente.nome !== DADO_REMOVIDO) {
        orCliente.push({ ordemId: null, nome: cliente.nome })
      }
    }
    const filtroChamados: Prisma.ChamadoWhereInput = cliente
      ? orCliente.length
        ? { empresaCodigo: empresa, OR: orCliente }
        : { empresaCodigo: empresa, id: -1 }
      : chamadoIds.length
        ? { empresaCodigo: empresa, id: { in: chamadoIds } }
        : { empresaCodigo: empresa, id: -1 }
    const chamadosBrutos = await this.prisma.chamado.findMany({
      where: filtroChamados,
      include: { fotos: { select: { id: true, situacao: true, url: true } }, notas: { select: { id: true, texto: true, autor: true } } },
    })
    const vistos = new Set<number>()
    const chamados = chamadosBrutos.filter((c) => {
      if (vistos.has(c.id)) return false
      vistos.add(c.id)
      return true
    })

    const titulos = cliente
      ? await this.prisma.financeiroTitulo.findMany({
          where: {
            empresaCodigo: empresa,
            tipo: FinanceiroTipo.RECEBER,
            OR: [
              { pessoa: { equals: cliente.nome, mode: 'insensitive' } },
              { pessoa: { equals: `${CLIENTE_ANON_PREFIXO}${cliente.id}`, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            numeroDocumento: true,
            valor: true,
            dataVencimento: true,
            status: true,
            parcela: true,
          },
        })
      : []

    const fotosOrdem = ordensIds.length
      ? await this.prisma.ordemFoto.findMany({
          where: { ordemId: { in: ordensIds } },
          select: { id: true, ordemId: true, momento: true, url: true },
        })
      : []

    return {
      cliente: cliente
        ? {
            id: cliente.id,
            nome: cliente.nome,
            telefone: cliente.telefone,
            endereco: cliente.endereco,
            cidade: cliente.cidade,
            enderecos: cliente.enderecos,
            ordens: cliente.ordens,
          }
        : null,
      chamados: chamados.map((c) => ({
        id: c.id,
        numero: c.numero,
        nome: c.nome,
        telefone: c.telefone,
        cidade: c.cidade,
        status: c.status,
        origem: c.origem,
        ipOrigem: c.ipOrigem,
        fotos: c.fotos.map((f) => ({ id: f.id, situacao: f.situacao, removida: f.url === FOTO_REMOVIDA || !f.url.startsWith('data:') })),
        notas: c.notas.length,
      })),
      titulos: titulos.map((t) => ({
        id: t.id,
        numeroDocumento: t.numeroDocumento,
        valor: Number(t.valor),
        dataVencimento: t.dataVencimento?.toISOString().slice(0, 10) || null,
        status: t.status,
        parcela: t.parcela,
      })),
      fotosOrdem: fotosOrdem.map((f) => ({
        id: f.id,
        ordemId: f.ordemId,
        momento: f.momento,
        removida: f.url === FOTO_REMOVIDA || !f.url.startsWith('data:'),
      })),
    }
  }

  async exportarTitular(
    empresaCodigo: string,
    usuarioId: number,
    q?: string,
    chamadoNumero?: number,
  ) {
    const agora = Date.now()
    const ultima = this.exportacoesPorUsuario.get(usuarioId) || 0
    if (agora - ultima < 60_000) {
      throw new BadRequestException('Aguarde um minuto entre exportações.')
    }
    this.exportacoesPorUsuario.set(usuarioId, agora)
    const dados = await this.buscarTitular(empresaCodigo, q, chamadoNumero)
    // Sem senhas, hashes, tokens ou notas internas
    return {
      geradoEm: new Date().toISOString(),
      formato: 'json',
      dados,
      csv: this.paraCsv(dados),
    }
  }

  async anonimizarTitular(
    empresaCodigo: string,
    clienteId: number,
    dto: AnonimizarTitularDto,
    usuarioId?: number,
    login?: string,
  ) {
    if (String(dto.confirmacao || '').trim().toUpperCase() !== 'ANONIMIZAR') {
      throw new BadRequestException('Confirme digitando ANONIMIZAR.')
    }
    const empresa = this.empresa(empresaCodigo)
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, empresaCodigo: empresa },
      include: { enderecos: true, ordens: true },
    })
    if (!cliente) throw new NotFoundException('Cliente não encontrado.')

    await this.prisma.$transaction(async (tx) => {
      await tx.cliente.update({
        where: { id: cliente.id },
        data: {
          nome: DADO_REMOVIDO,
          telefone: DADO_REMOVIDO,
          endereco: DADO_REMOVIDO,
          cidade: DADO_REMOVIDO,
        },
      })
      await tx.clienteEndereco.updateMany({
        where: { clienteId: cliente.id },
        data: {
          logradouro: DADO_REMOVIDO,
          numero: DADO_REMOVIDO,
          bairro: DADO_REMOVIDO,
          cep: DADO_REMOVIDO,
          cidade: DADO_REMOVIDO,
          uf: '',
          apelido: DADO_REMOVIDO,
        },
      })

      const ordensIds = cliente.ordens.map((o) => o.id)
      if (ordensIds.length) {
        await tx.ordemServico.updateMany({
          where: { id: { in: ordensIds } },
          data: {
            assinatura: null,
            descricaoProblema: TEXTO_REMOVIDO,
            vistoria: TEXTO_REMOVIDO,
            servicos: TEXTO_REMOVIDO,
          },
        })
        await tx.ordemFoto.updateMany({
          where: { ordemId: { in: ordensIds } },
          data: { url: FOTO_REMOVIDA },
        })
      }

      const chamados = await tx.chamado.findMany({
        where: {
          empresaCodigo: empresa,
          OR: [
            { ordemId: { in: ordensIds } },
            { telefone: cliente.telefone || '__nunca__' },
            { nome: cliente.nome },
          ],
        },
      })
      for (const chamado of chamados) {
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
            descricao: TEXTO_REMOVIDO,
            ipOrigem: null,
          },
        })
        await tx.chamadoFoto.updateMany({
          where: { chamadoId: chamado.id },
          data: { url: FOTO_REMOVIDA },
        })
        await tx.chamadoNota.updateMany({
          where: { chamadoId: chamado.id },
          data: { texto: TEXTO_REMOVIDO },
        })
      }

      await tx.financeiroTitulo.updateMany({
        where: {
          empresaCodigo: empresa,
          pessoa: { equals: cliente.nome, mode: 'insensitive' },
        },
        data: { pessoa: `${CLIENTE_ANON_PREFIXO}${cliente.id}` },
      })
    })

    if (dto.solicitacaoId) {
      await this.prisma.solicitacaoTitular.updateMany({
        where: { id: dto.solicitacaoId, empresaCodigo: empresa },
        data: {
          status: SolicitacaoTitularStatus.ATENDIDA,
          concluidoEm: new Date(),
          resposta: `Titular #${clienteId} anonimizado.`,
        },
      })
    }

    await this.registrarAtividade(
      empresa,
      usuarioId,
      login,
      'POST /privacidade/titular/anonimizar',
      `cliente:${clienteId}`,
    )
    return { ok: true, clienteId }
  }

  async relatorioFuncionarioDesligado(empresaCodigo: string, usuarioId: number) {
    const empresa = this.empresa(empresaCodigo)
    const user = await this.prisma.crmUsuarios.findFirst({ where: { id: usuarioId } })
    if (!user) throw new NotFoundException('Usuário não encontrado.')
    // TODO-juridico: definir se login/sessões de funcionários desligados devem ser apagados ou só relatados.
    const sessoes = await this.prisma.crmSessoes.count({ where: { usuarioId } })
    const atividades = await this.prisma.atividade.count({
      where: { empresaCodigo: empresa, usuarioId },
    })
    return {
      modo: 'relatorio',
      usuarioId,
      login: user.login,
      email: user.email,
      cpfCnpj: user.cpfCnpj ? '[informado]' : null,
      sessoes,
      atividades,
      observacao: 'Nada foi apagado. Login e sessões permanecem.',
    }
  }

  async consentimentos(empresaCodigo: string) {
    const empresa = this.empresa(empresaCodigo)
    const comAceite = await this.prisma.chamado.groupBy({
      by: ['avisoVersao'],
      where: { empresaCodigo: empresa, aceiteEm: { not: null } },
      _count: { _all: true },
    })
    const semAceite = await this.prisma.chamado.findMany({
      where: { empresaCodigo: empresa, aceiteEm: null },
      select: { numero: true, createdAt: true, origem: true },
      orderBy: { numero: 'asc' },
      take: 200,
    })
    return {
      porVersao: comAceite.map((g) => ({
        avisoVersao: g.avisoVersao || '(sem versão)',
        quantidade: g._count._all,
      })),
      semAceite: semAceite.map((c) => ({
        numero: c.numero,
        data: c.createdAt.toISOString().slice(0, 10),
        origem: c.origem,
      })),
    }
  }

  async listarRetencaoVencidos(empresaCodigo: string, simular = true) {
    const empresa = this.empresa(empresaCodigo)
    const limite = new Date()
    limite.setUTCFullYear(limite.getUTCFullYear() - RETENCAO_ANOS_APOS_ENCERRAMENTO)
    const ordens = await this.prisma.ordemServico.findMany({
      where: {
        empresaCodigo: empresa,
        situacao: { in: ['ENCERRADA', 'CANCELADA'] },
        dataEncerramento: { lte: limite },
        cliente: { nome: { not: DADO_REMOVIDO } },
      },
      select: {
        id: true,
        numero: true,
        dataEncerramento: true,
        clienteId: true,
        cliente: { select: { nome: true } },
      },
      take: 200,
    })
    return {
      simular,
      prazoAnos: RETENCAO_ANOS_APOS_ENCERRAMENTO,
      total: ordens.length,
      itens: ordens.map((o) => ({
        ordemId: o.id,
        numero: o.numero,
        dataEncerramento: o.dataEncerramento?.toISOString().slice(0, 10) || null,
        clienteId: o.clienteId,
        // não expõe nome completo na lista de retenção além do necessário para admin — usa só id
      })),
    }
  }

  async anonimizarVencidos(empresaCodigo: string, usuarioId?: number, login?: string) {
    const lista = await this.listarRetencaoVencidos(empresaCodigo, false)
    const ids = [...new Set(lista.itens.map((i) => i.clienteId))]
    for (const clienteId of ids) {
      await this.anonimizarTitular(
        empresaCodigo,
        clienteId,
        { confirmacao: 'ANONIMIZAR' },
        usuarioId,
        login,
      )
    }
    await this.registrarAtividade(
      this.empresa(empresaCodigo),
      usuarioId,
      login,
      'POST /privacidade/retencao/anonimizar',
      `qtd:${ids.length}`,
    )
    return { anonimizados: ids.length }
  }

  async anularIps(opcoes: { dryRun: boolean }) {
    const limite = new Date(Date.now() - ANULAR_IP_APOS_DIAS * 86400000)
    const chamados = await this.prisma.chamado.findMany({
      where: { ipOrigem: { not: null }, createdAt: { lte: limite } },
      select: { id: true, numero: true, createdAt: true, ipOrigem: true },
    })
    const sessoes = await this.prisma.crmSessoes.findMany({
      where: {
        OR: [{ ip: { not: null } }, { userAgent: { not: null } }],
        criadoEm: { lte: limite },
      },
      select: { id: true, criadoEm: true },
    })
    const bloqueiosLimite = new Date(Date.now() - LIMPAR_BLOQUEIOS_EXPIRADOS_DIAS * 86400000)
    const bloqueios = await this.prisma.acessoBloqueio.findMany({
      where: {
        OR: [{ bloqueadoAte: null }, { bloqueadoAte: { lte: bloqueiosLimite } }],
        updatedAt: { lte: bloqueiosLimite },
      },
      select: { id: true, chave: true },
    })

    if (!opcoes.dryRun) {
      await this.prisma.chamado.updateMany({
        where: { id: { in: chamados.map((c) => c.id) } },
        data: { ipOrigem: null },
      })
      await this.prisma.crmSessoes.updateMany({
        where: { id: { in: sessoes.map((s) => s.id) } },
        data: { ip: null, userAgent: null },
      })
      await this.prisma.acessoBloqueio.deleteMany({
        where: { id: { in: bloqueios.map((b) => b.id) } },
      })
    }

    return {
      dryRun: opcoes.dryRun,
      chamadosIp: chamados.length,
      sessoes: sessoes.length,
      bloqueiosRemovidos: bloqueios.length,
      amostraChamados: chamados.slice(0, 10).map((c) => ({ numero: c.numero, createdAt: c.createdAt })),
    }
  }

  private paraCsv(dados: Awaited<ReturnType<PrivacidadeService['buscarTitular']>>) {
    const linhas = ['tipo,id,campo,valor']
    if (dados.cliente) {
      linhas.push(`cliente,${dados.cliente.id},nome,${this.csv(dados.cliente.nome)}`)
      linhas.push(`cliente,${dados.cliente.id},telefone,${this.csv(dados.cliente.telefone || '')}`)
    }
    for (const c of dados.chamados) {
      linhas.push(`chamado,${c.numero},nome,${this.csv(c.nome)}`)
      linhas.push(`chamado,${c.numero},telefone,${this.csv(c.telefone)}`)
    }
    for (const t of dados.titulos) {
      linhas.push(`titulo,${t.id},valor,${t.valor}`)
      linhas.push(`titulo,${t.id},vencimento,${t.dataVencimento || ''}`)
    }
    return linhas.join('\n')
  }

  private csv(v: string) {
    return `"${String(v).replace(/"/g, '""')}"`
  }

  private apresentarSolicitacao(row: {
    id: number
    tipo: SolicitacaoTitularTipo
    solicitanteNome: string
    solicitanteTelefone: string | null
    chamadoNumero: number | null
    descricao: string
    canal: SolicitacaoTitularCanal
    recebidoEm: Date
    prazoEm: Date
    status: SolicitacaoTitularStatus
    resposta: string | null
    concluidoEm: Date | null
    responsavelId: number | null
  }) {
    return {
      id: row.id,
      tipo: row.tipo,
      solicitanteNome: row.solicitanteNome,
      solicitanteTelefone: row.solicitanteTelefone,
      chamadoNumero: row.chamadoNumero,
      descricao: row.descricao,
      canal: row.canal,
      recebidoEm: row.recebidoEm.toISOString(),
      prazoEm: row.prazoEm.toISOString(),
      status: row.status,
      resposta: row.resposta,
      concluidoEm: row.concluidoEm?.toISOString() || null,
      responsavelId: row.responsavelId,
      prazoDias: PRAZO_RESPOSTA_SOLICITACAO_DIAS,
    }
  }

  private async registrarAtividade(
    empresa: string,
    usuarioId: number | undefined,
    login: string | undefined,
    acao: string,
    objeto: string,
  ) {
    await this.prisma.atividade.create({
      data: {
        empresaCodigo: empresa,
        usuarioId: usuarioId ?? null,
        login: login || 'sistema',
        acao,
        caminho: acao.replace(/^(GET|POST|PATCH|DELETE)\s+/, ''),
        metodo: acao.split(' ')[0] || 'POST',
        objeto,
      },
    })
  }

  private empresa(codigo: string) {
    const c = String(codigo || '').trim()
    if (!c) throw new BadRequestException('Empresa obrigatória.')
    return c
  }
}
