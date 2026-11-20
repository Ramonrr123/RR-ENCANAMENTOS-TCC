import { randomInt } from 'crypto';
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ChamadoStatus, OrdemOrigem, OrdemSituacao, OrdemTipo, Prisma, TipoPessoa } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AVISO_VERSAO_PRIVACIDADE } from '../privacidade/constantes';
import { AbrirChamadoDto, normalizarOrigemChamado, TIPOS_CHAMADO } from './dto/chamado-publico.dto';
import { TarefaChamadoDto } from './dto/chamado.dto';

const EMPRESA_PUBLICA = '01';
const AVISO_VERSAO = AVISO_VERSAO_PRIVACIDADE;
const DADO_REMOVIDO = 'Dado removido';
/** TODO-juridico: proposta operacional — 5 anos após o encerramento do atendimento. Confirmar prazo legal. */
export const RETENCAO_ANOS_APOS_ENCERRAMENTO = 5;
const MAX_FALHAS = 5;
const BLOQUEIO_MS = 15 * 60 * 1000;
const MAX_ABERTURAS_HORA = 5;
const MIN_PREENCHIMENTO_MS = 3000;
const ALFABETO_SENHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const hashDecoy = bcrypt.hash('senha-que-nao-existe', 10);

@Injectable()
export class ChamadosService {
  constructor(private readonly prisma: PrismaService) {}

  async abrirPublico(dto: AbrirChamadoDto, ip: string) {
    // TODO-juridico: aceiteEm é o relógio do servidor no momento do envio, não um termo assinado.
    // O texto (avisoVersao) descreve a prática do sistema. Não define base legal nem encarregado.
    if ((dto.website || '').trim()) {
      throw new BadRequestException('Não foi possível abrir o chamado.');
    }
    if (!Number.isFinite(dto.startedAt) || Date.now() - dto.startedAt < MIN_PREENCHIMENTO_MS) {
      throw new BadRequestException('Aguarde alguns segundos e envie o chamado de novo.');
    }
    if (dto.aceite !== true) {
      throw new BadRequestException('É preciso aceitar o aviso de privacidade.');
    }
    const dados = this.dadosPublicos(dto);
    const telefone = this.telefoneDe(dados.telefone);
    if (telefone.whatsapp === 'invalido') {
      throw new BadRequestException('Informe um telefone com DDD. Celular tem 11 dígitos; fixo tem 10.');
    }
    const ipOrigem = ip.slice(0, 64) || 'desconhecido';
    const canalOrigem = normalizarOrigemChamado(dto.origem);
    const desde = new Date(Date.now() - 60 * 60 * 1000);
    const abertosNaHora = await this.prisma.chamado.count({
      where: { ipOrigem, createdAt: { gte: desde } },
    });
    if (abertosNaHora >= MAX_ABERTURAS_HORA) {
      throw new BadRequestException('Muitos chamados neste acesso. Tente novamente mais tarde.');
    }
    const senha = this.senhaPublica();
    const senhaHash = await bcrypt.hash(senha, 10);
    const criado = await this.prisma.$transaction(async (tx) => {
      const numero = await this.proximoNumero(tx, EMPRESA_PUBLICA);
      return tx.chamado.create({
        data: {
          empresaCodigo: EMPRESA_PUBLICA,
          numero,
          nome: dados.nome,
          telefone: telefone.exibicao,
          whatsapp: telefone.whatsapp,
          cep: dados.cep,
          logradouro: dados.logradouro,
          numeroEndereco: dados.numero,
          bairro: dados.bairro,
          cidade: dados.cidade,
          uf: dados.uf,
          tipo: dados.tipo,
          descricao: dados.descricao,
          origem: canalOrigem,
          senhaHash,
          aceiteEm: new Date(),
          avisoVersao: AVISO_VERSAO,
          ipOrigem,
          notas: { create: { texto: 'Chamado aberto pelo link público.', autor: 'Cliente' } },
        },
      });
    });
    return { numero: criado.numero, senha, whatsapp: telefone.whatsapp };
  }

  async consultarPublico(numero: number, senha: string, ip: string) {
    const agora = new Date();
    const origem = ip.slice(0, 64) || 'desconhecido';
    const [row, bloqueioIp] = await Promise.all([
      this.prisma.chamado.findFirst({
        where: { empresaCodigo: EMPRESA_PUBLICA, numero },
        select: {
          id: true,
          numero: true,
          tipo: true,
          cidade: true,
          uf: true,
          status: true,
          senhaHash: true,
          tentativasErradas: true,
          bloqueadoAte: true,
          createdAt: true,
          updatedAt: true,
          notas: { select: { texto: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
          ordem: { select: { situacao: true, createdAt: true, updatedAt: true, dataEncerramento: true } },
        },
      }),
      this.prisma.acessoBloqueio.findUnique({ where: { chave: this.chaveIp(origem) } }),
    ]);
    const senhaInformada = senha.trim().toUpperCase();
    const confereHash = await bcrypt.compare(senhaInformada, row?.senhaHash || (await hashDecoy));
    const confere = Boolean(row?.senhaHash) && confereHash;
    const ipBloqueado = this.bloqueioAtivo(bloqueioIp?.bloqueadoAte, agora);
    const numeroBloqueado = this.bloqueioAtivo(row?.bloqueadoAte, agora);
    if (ipBloqueado || numeroBloqueado || !confere) {
      if (!ipBloqueado && !numeroBloqueado) {
        await this.somarFalhaIp(origem, bloqueioIp);
        if (row) await this.somarFalhaChamado(row);
      }
      throw new UnauthorizedException('Número ou senha incorretos.');
    }
    await this.prisma.chamado.update({
      where: { id: row!.id },
      data: { tentativasErradas: 0, bloqueadoAte: null },
    });
    await this.prisma.acessoBloqueio.updateMany({
      where: { chave: this.chaveIp(origem) },
      data: { tentativasErradas: 0, bloqueadoAte: null },
    });
    return this.andamento(row!);
  }

  async listar(empresaCodigo: string, filtro?: { origem?: string }) {
    const empresa = this.empresa(empresaCodigo);
    const origemRaw = String(filtro?.origem || '').trim().toLowerCase();
    const filtrarOrigem = origemRaw && origemRaw !== 'todas';
    const rows = await this.prisma.chamado.findMany({
      where: {
        empresaCodigo: empresa,
        ...(filtrarOrigem ? { origem: normalizarOrigemChamado(origemRaw) } : {}),
      },
      include: { ordem: { select: { id: true, numero: true } }, notas: { select: { id: true } } },
      orderBy: [{ numero: 'desc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      numero: row.numero,
      nome: row.nome,
      telefone: row.telefone,
      tipo: row.tipo,
      descricao: row.descricao,
      status: row.status,
      whatsapp: row.whatsapp,
      origem: row.origem || 'site',
      createdAt: row.createdAt.toISOString(),
      ordemId: row.ordem?.id ?? null,
      ordemNumero: row.ordem?.numero ?? null,
      notas: row.notas.length,
    }));
  }

  async contagemOrigem30Dias(empresaCodigo: string) {
    const empresa = this.empresa(empresaCodigo);
    const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const grupos = await this.prisma.chamado.groupBy({
      by: ['origem'],
      where: { empresaCodigo: empresa, createdAt: { gte: desde } },
      _count: { _all: true },
    });
    const mapa = Object.fromEntries(grupos.map((g) => [g.origem || 'site', g._count._all]));
    return {
      whatsapp: Number(mapa.whatsapp || 0),
      site: Number(mapa.site || 0),
      indicacao: Number(mapa.indicacao || 0),
      outro: Number(mapa.outro || 0),
      dias: 30,
    };
  }

  async detalhe(empresaCodigo: string, id: number) {
    return this.apresentar(await this.carregar(empresaCodigo, id));
  }

  async atualizarStatus(empresaCodigo: string, id: number, status: ChamadoStatus) {
    const atual = await this.carregar(empresaCodigo, id);
    if (atual.status === status) return this.apresentar(atual);
    const texto =
      status === ChamadoStatus.RESOLVIDO
        ? 'Atendimento concluído.'
        : status === ChamadoStatus.EM_ATENDIMENTO
          ? 'Chamado em atendimento.'
          : null;
    const salvo = await this.prisma.chamado.update({
      where: { id: atual.id },
      data: {
        status,
        ...(texto ? { notas: { create: { texto, autor: 'Equipe' } } } : {}),
      },
      include: this.include(),
    });
    return this.apresentar(salvo);
  }

  async adicionarNota(empresaCodigo: string, id: number, texto: string, usuarioId?: number) {
    const atual = await this.carregar(empresaCodigo, id);
    const autor = await this.nomeAutor(usuarioId);
    await this.prisma.chamadoNota.create({
      data: { chamadoId: atual.id, texto: texto.trim(), autor },
    });
    return this.detalhe(empresaCodigo, id);
  }

  async criarTarefa(empresaCodigo: string, id: number, dto: TarefaChamadoDto, usuarioId?: number) {
    const empresa = this.empresa(empresaCodigo);
    const atual = await this.carregar(empresa, id);
    const responsaveis = [...new Set(dto.responsaveis.map((nome) => nome.trim()).filter(Boolean))];
    if (responsaveis.length < 1 || responsaveis.length > 5) {
      throw new BadRequestException('Informe de 1 a 5 responsáveis.');
    }
    const titulo = dto.titulo.trim();
    const descricao = dto.descricao?.trim() || '';
    const autor = await this.nomeAutor(usuarioId);
    await this.prisma.tarefa.create({
      data: {
        empresaCodigo: empresa,
        titulo,
        descricao,
        prazo: this.dataPrazo(dto.prazo),
        prioridade: dto.prioridade,
        status: dto.status,
        responsaveis,
        chamadoId: atual.id,
      },
    });
    await this.prisma.chamadoNota.create({
      data: {
        chamadoId: atual.id,
        autor,
        texto: `Tarefa vinculada: ${titulo}`,
      },
    });
    return this.detalhe(empresa, id);
  }

  async adicionarFoto(empresaCodigo: string, id: number, situacao: string, url: string) {
    const atual = await this.carregar(empresaCodigo, id);
    if (!url.startsWith('data:image/')) throw new BadRequestException('Envie uma imagem.');
    await this.prisma.chamadoFoto.create({
      data: { chamadoId: atual.id, situacao, url },
    });
    await this.prisma.chamadoNota.create({
      data: { chamadoId: atual.id, autor: 'Equipe', texto: `Foto anexada: ${situacao}.` },
    });
    return this.detalhe(empresaCodigo, id);
  }

  async anonimizar(empresaCodigo: string, id: number, usuarioId?: number) {
    // TODO-juridico: a descrição do chamado / descricaoProblema pode ainda citar dados pessoais.
    // Cliente compartilhado com outras OS também é anonimizado. Confirmar o alcance com o jurídico.
    // Não apaga ordem, peças, margem, títulos financeiros nem notas fiscais de estoque.
    const atual = await this.carregar(empresaCodigo, id);
    const autor = await this.nomeAutor(usuarioId);
    const salvo = await this.prisma.$transaction(async (tx) => {
      await this.anonimizarVinculos(tx, atual.id);
      const jaAnonimo =
        atual.nome === DADO_REMOVIDO && atual.telefone === DADO_REMOVIDO && atual.logradouro === DADO_REMOVIDO;
      return tx.chamado.update({
        where: { id: atual.id },
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
          ...(jaAnonimo
            ? {}
            : { notas: { create: { texto: 'Dados pessoais anonimizados a pedido.', autor } } }),
        },
        include: this.include(),
      });
    });
    return this.apresentar(salvo);
  }

  /** Substitui dados pessoais do chamado, do cliente ligado à OS e do endereço da OS. */
  async anonimizarVinculos(tx: Prisma.TransactionClient, chamadoId: number) {
    const chamado = await tx.chamado.findFirst({
      where: { id: chamadoId },
      select: {
        id: true,
        ordemId: true,
        ordem: {
          select: {
            id: true,
            clienteId: true,
            enderecoId: true,
            descricaoProblema: true,
          },
        },
      },
    });
    if (!chamado?.ordem) return;

    const { ordem } = chamado;
    await tx.cliente.update({
      where: { id: ordem.clienteId },
      data: {
        nome: DADO_REMOVIDO,
        telefone: DADO_REMOVIDO,
        endereco: DADO_REMOVIDO,
        cidade: DADO_REMOVIDO,
      },
    });
    await tx.clienteEndereco.updateMany({
      where: { clienteId: ordem.clienteId },
      data: {
        logradouro: DADO_REMOVIDO,
        cidade: DADO_REMOVIDO,
      },
    });
    if (ordem.descricaoProblema) {
      const limpa = ordem.descricaoProblema
        .split('\n')
        .map((linha) => (/^CEP\s+\d{5}-?\d{3}\s*$/i.test(linha.trim()) ? `CEP ${DADO_REMOVIDO}` : linha))
        .join('\n');
      if (limpa !== ordem.descricaoProblema) {
        await tx.ordemServico.update({
          where: { id: ordem.id },
          data: { descricaoProblema: limpa },
        });
      }
    }
  }

  async gerarOrdem(empresaCodigo: string, id: number, usuarioId?: number) {
    const empresa = this.empresa(empresaCodigo);
    const autor = await this.nomeAutor(usuarioId);
    const criada = await this.prisma.$transaction(async (tx) => {
      const chamado = await tx.chamado.findFirst({ where: { id, empresaCodigo: empresa } });
      if (!chamado) throw new NotFoundException('Chamado não encontrado.');
      if (chamado.ordemId) throw new BadRequestException('Este chamado já tem ordem de serviço.');

      const logradouro = chamado.logradouro;
      const numeroEndereco = chamado.numeroEndereco || '';
      const bairro = chamado.bairro || '';
      const cep = this.formatarCep(chamado.cep);
      const cidade = chamado.cidade;
      const uf = chamado.uf || '';
      const enderecoCompleto = [logradouro, numeroEndereco, bairro, cep ? `CEP ${cep}` : '', cidade, uf]
        .filter(Boolean)
        .join(', ');
      const existentes = await tx.cliente.findMany({
        where: { empresaCodigo: empresa, telefone: { not: null } },
        select: { id: true, telefone: true },
      });
      const digitos = this.soDigitos(chamado.telefone);
      const achado = existentes.find((cliente) => this.soDigitos(cliente.telefone) === digitos);
      let clienteId = achado?.id;
      if (!clienteId) {
        const novo = await tx.cliente.create({
          data: {
            empresaCodigo: empresa,
            nome: chamado.nome,
            telefone: chamado.telefone,
            endereco: enderecoCompleto,
            cidade: uf ? `${cidade} - ${uf}` : cidade,
            tipoPessoa: TipoPessoa.FISICA,
          },
        });
        clienteId = novo.id;
      }
      const enderecoSalvo = await tx.clienteEndereco.create({
        data: {
          clienteId,
          apelido: `Chamado ${String(chamado.numero).padStart(4, '0')}`,
          logradouro,
          numero: numeroEndereco,
          bairro,
          cep,
          cidade,
          uf,
          principal: false,
        },
      });
      const aviso =
        chamado.whatsapp === 'celular'
          ? 'Contato no formato de celular usado pelo WhatsApp.'
          : 'Linha fixa. O WhatsApp não atende este número.';
      const numero = await this.proximoNumeroOrdem(tx, empresa);
      const ordem = await tx.ordemServico.create({
        data: {
          empresaCodigo: empresa,
          numero,
          clienteId,
          enderecoId: enderecoSalvo.id,
          tipo: OrdemTipo.EMERGENCIA,
          origem: chamado.whatsapp === 'celular' ? OrdemOrigem.WHATSAPP : OrdemOrigem.TELEFONE,
          descricaoProblema: [
            `Chamado ${String(chamado.numero).padStart(4, '0')}: ${chamado.tipo}`,
            chamado.descricao,
            `Endereço: ${enderecoCompleto}`,
            aviso,
          ].join('\n'),
          situacao: OrdemSituacao.ABERTA,
          dataAbertura: this.hoje(),
        },
      });
      return tx.chamado.update({
        where: { id: chamado.id },
        data: {
          ordemId: ordem.id,
          status: ChamadoStatus.EM_ATENDIMENTO,
          notas: {
            create: {
              texto: `Ordem OS ${String(ordem.numero).padStart(4, '0')} gerada a partir deste chamado.`,
              autor,
            },
          },
        },
        include: this.include(),
      });
    });
    return this.apresentar(criada);
  }

  private include() {
    return {
      ordem: { select: { id: true, numero: true, situacao: true } },
      notas: { orderBy: { createdAt: 'asc' as const } },
      tarefas: { orderBy: { createdAt: 'asc' as const } },
      fotos: { orderBy: { createdAt: 'asc' as const } },
    };
  }

  private async carregar(empresaCodigo: string, id: number) {
    const empresa = this.empresa(empresaCodigo);
    const row = await this.prisma.chamado.findFirst({
      where: { id, empresaCodigo: empresa },
      include: this.include(),
    });
    if (!row) throw new NotFoundException('Chamado não encontrado.');
    return row;
  }

  /** Monta link wa.me para o atendente abrir o WhatsApp dele. Sem senha. */
  linkResponderWhatsapp(chamado: { nome: string; telefone: string; numero: number }) {
    if (String(chamado.nome || '').trim() === DADO_REMOVIDO) return null;
    if (String(chamado.telefone || '').trim() === DADO_REMOVIDO) return null;
    const digitos = this.soDigitos(chamado.telefone);
    if (digitos.length !== 10 && digitos.length !== 11) return null;
    const primeiroNome = String(chamado.nome || '')
      .trim()
      .split(/\s+/)[0] || 'cliente';
    const texto = `Olá, ${primeiroNome}! Recebemos o seu chamado número ${chamado.numero}. Vamos entrar em contato para combinar o atendimento.`;
    return `https://wa.me/55${digitos}?text=${encodeURIComponent(texto)}`;
  }

  private apresentar(row: {
    id: number;
    numero: number;
    nome: string;
    telefone: string;
    whatsapp: string;
    cep: string;
    logradouro: string;
    numeroEndereco: string;
    bairro: string;
    cidade: string;
    uf: string;
    tipo: string;
    descricao: string;
    status: ChamadoStatus;
    origem?: string | null;
    createdAt: Date;
    ordem: { id: number; numero: number; situacao: string } | null;
    notas: { id: number; texto: string; autor: string; createdAt: Date }[];
    tarefas: {
      id: number;
      titulo: string;
      descricao: string;
      canal: string | null;
      horario: string | null;
      prazo: Date | null;
      prioridade: string;
      status: string;
      responsaveis: string[];
      createdAt: Date;
    }[];
    fotos: { id: number; situacao: string; url: string; createdAt: Date }[];
  }) {
    const linkWhatsapp = this.linkResponderWhatsapp(row);
    return {
      id: row.id,
      numero: row.numero,
      nome: row.nome,
      telefone: row.telefone,
      whatsapp: row.whatsapp,
      origem: row.origem || 'site',
      linkWhatsapp,
      cep: row.cep,
      logradouro: row.logradouro,
      numeroEndereco: row.numeroEndereco,
      bairro: row.bairro,
      cidade: row.cidade,
      uf: row.uf,
      tipo: row.tipo,
      descricao: row.descricao,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      ordem: row.ordem ? { id: row.ordem.id, numero: row.ordem.numero, situacao: row.ordem.situacao } : null,
      notas: row.notas.map((nota) => ({
        id: nota.id,
        texto: nota.texto,
        autor: nota.autor,
        createdAt: nota.createdAt.toISOString(),
      })),
      tarefas: row.tarefas.map((tarefa) => ({
        id: tarefa.id,
        titulo: tarefa.titulo,
        descricao: tarefa.descricao,
        canal: tarefa.canal,
        horario: tarefa.horario,
        prazo: tarefa.prazo ? tarefa.prazo.toISOString().slice(0, 10) : '',
        prioridade: tarefa.prioridade,
        status: tarefa.status,
        responsaveis: tarefa.responsaveis,
        createdAt: tarefa.createdAt.toISOString(),
      })),
      fotos: row.fotos.map((foto) => ({
        id: foto.id,
        situacao: foto.situacao,
        url: foto.url,
        createdAt: foto.createdAt.toISOString(),
      })),
    };
  }

  private andamento(row: {
    numero: number;
    tipo: string;
    cidade: string;
    uf: string;
    status: ChamadoStatus;
    createdAt: Date;
    updatedAt: Date;
    notas: { texto: string; createdAt: Date }[];
    ordem: { situacao: OrdemSituacao; createdAt: Date; updatedAt: Date; dataEncerramento: Date | null } | null;
  }) {
    const eventos: { quando: Date; texto: string }[] = [{ quando: row.createdAt, texto: 'Chamado aberto' }];
    for (const nota of row.notas) {
      if (nota.texto.startsWith('Ordem OS')) eventos.push({ quando: nota.createdAt, texto: 'Ordem de serviço gerada' });
      else if (nota.texto.startsWith('Chamado em atendimento')) eventos.push({ quando: nota.createdAt, texto: 'Chamado em atendimento' });
      else if (nota.texto.startsWith('Atendimento concluído') || nota.texto.startsWith('Chamado resolvido')) {
        eventos.push({ quando: nota.createdAt, texto: 'Atendimento concluído' });
      }
    }
    const situacao = row.ordem?.situacao;
    const emExecucao = situacao === OrdemSituacao.EM_ANDAMENTO || situacao === OrdemSituacao.EM_EXECUCAO;
    const concluido =
      row.status === ChamadoStatus.RESOLVIDO || situacao === OrdemSituacao.CONCLUIDA || situacao === OrdemSituacao.ENCERRADA;
    if (emExecucao && !eventos.some((evento) => evento.texto === 'Atendimento em execução')) {
      eventos.push({ quando: row.ordem!.updatedAt, texto: 'Atendimento em execução' });
    }
    if (concluido && !eventos.some((evento) => evento.texto === 'Atendimento concluído')) {
      eventos.push({ quando: row.ordem?.dataEncerramento ?? row.updatedAt, texto: 'Atendimento concluído' });
    }
    if (situacao === OrdemSituacao.CANCELADA) {
      eventos.push({ quando: row.ordem!.updatedAt, texto: 'Atendimento cancelado' });
    }
    const textos = new Set(eventos.map((evento) => evento.texto));
    let etapa = 0;
    if (textos.has('Chamado em atendimento') || textos.has('Ordem de serviço gerada') || row.status !== ChamadoStatus.ABERTO || row.ordem) {
      etapa = 1;
    }
    if (textos.has('Atendimento em execução') || emExecucao) etapa = 2;
    if (concluido) etapa = 3;
    eventos.sort((a, b) => b.quando.getTime() - a.quando.getTime());
    return {
      numero: row.numero,
      tipo: row.tipo,
      cidade: row.cidade,
      uf: row.uf,
      etapa,
      cancelado: situacao === OrdemSituacao.CANCELADA,
      eventos: eventos.map((evento) => ({ quando: evento.quando.toISOString(), texto: evento.texto })),
    };
  }

  private async nomeAutor(usuarioId?: number) {
    if (!usuarioId) return 'Equipe';
    const usuario = await this.prisma.crmUsuarios.findUnique({ where: { id: usuarioId }, select: { nome: true } });
    return usuario?.nome?.trim() || 'Equipe';
  }

  private async proximoNumero(tx: Prisma.TransactionClient, empresa: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock((hashtext(${`chamado:${empresa}`}))::bigint)`;
    const agg = await tx.chamado.aggregate({ where: { empresaCodigo: empresa }, _max: { numero: true } });
    return (agg._max.numero ?? 0) + 1;
  }

  private async proximoNumeroOrdem(tx: Prisma.TransactionClient, empresa: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock((hashtext(${`ordem-servico:${empresa}`}))::bigint)`;
    const agg = await tx.ordemServico.aggregate({ where: { empresaCodigo: empresa }, _max: { numero: true } });
    return (agg._max.numero ?? 0) + 1;
  }

  private empresa(codigo: string | undefined) {
    const empresa = String(codigo || '').trim();
    if (!empresa) throw new BadRequestException('Selecione a empresa antes de abrir os chamados.');
    return empresa;
  }

  private soDigitos(valor: string | null | undefined) {
    const digitos = String(valor || '').replace(/\D/g, '');
    if (digitos.startsWith('55') && digitos.length > 11) return digitos.slice(2);
    return digitos;
  }

  private formatarCep(valor: string | null | undefined) {
    const digitos = String(valor || '').replace(/\D/g, '').slice(0, 8);
    if (digitos.length !== 8) return digitos;
    return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
  }

  private telefoneDe(valor: string) {
    const digitos = this.soDigitos(valor);
    const celular = digitos.length === 11 && digitos[2] === '9';
    const fixo = digitos.length === 10;
    const whatsapp = celular ? 'celular' : fixo ? 'fixo' : 'invalido';
    const exibicao = celular
      ? `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`
      : fixo
        ? `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`
        : digitos;
    return { digitos, whatsapp, exibicao };
  }

  private dadosPublicos(dto: AbrirChamadoDto) {
    const cep = this.textoPublico(dto.cep, 8, 9).replace(/\D/g, '');
    if (cep.length !== 8) throw new BadRequestException('Informe o CEP com 8 números.');
    const uf = this.textoPublico(dto.uf, 2, 2).toUpperCase();
    if (!/^[A-Z]{2}$/.test(uf)) throw new BadRequestException('Informe a UF com 2 letras.');
    if (!TIPOS_CHAMADO.includes(dto.tipo)) throw new BadRequestException('Revise os dados do chamado.');
    return {
      tipo: dto.tipo,
      nome: this.textoPublico(dto.nome, 2, 120),
      telefone: this.textoPublico(dto.telefone, 10, 20),
      cep,
      logradouro: this.textoPublico(dto.logradouro, 3, 160),
      numero: this.textoPublico(dto.numero, 1, 20),
      bairro: this.textoPublico(dto.bairro, 0, 80),
      cidade: this.textoPublico(dto.cidade, 2, 80),
      uf,
      descricao: this.textoPublico(dto.descricao, 10, 800),
    };
  }

  private textoPublico(valor: string, min: number, max: number) {
    const texto = String(valor || '').trim();
    if (/[<>]/.test(texto)) throw new BadRequestException('O texto não pode conter tags HTML.');
    if (texto.length < min || texto.length > max) throw new BadRequestException('Revise os dados do chamado.');
    return texto;
  }

  private senhaPublica() {
    let senha = '';
    for (let i = 0; i < 8; i += 1) senha += ALFABETO_SENHA[randomInt(ALFABETO_SENHA.length)];
    return senha;
  }

  private chaveIp(ip: string) {
    return `consulta-ip:${ip}`;
  }

  private bloqueioAtivo(bloqueadoAte: Date | null | undefined, agora: Date) {
    return Boolean(bloqueadoAte && bloqueadoAte > agora);
  }

  private proximaFalha(atual: { tentativasErradas: number; bloqueadoAte: Date | null } | null) {
    const agora = new Date();
    const expirado = Boolean(atual?.bloqueadoAte && atual.bloqueadoAte <= agora);
    const falhas = (expirado ? 0 : atual?.tentativasErradas ?? 0) + 1;
    return {
      tentativasErradas: falhas,
      bloqueadoAte: falhas >= MAX_FALHAS ? new Date(agora.getTime() + BLOQUEIO_MS) : null,
    };
  }

  private async somarFalhaIp(
    ip: string,
    atual: { tentativasErradas: number; bloqueadoAte: Date | null } | null,
  ) {
    const chave = this.chaveIp(ip);
    const data = this.proximaFalha(atual);
    await this.prisma.acessoBloqueio.upsert({
      where: { chave },
      create: { chave, ...data },
      update: data,
    });
  }

  private async somarFalhaChamado(row: { id: number; tentativasErradas: number; bloqueadoAte: Date | null }) {
    const data = this.proximaFalha(row);
    await this.prisma.chamado.update({ where: { id: row.id }, data });
  }

  private hoje() {
    const agora = new Date();
    return new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate(), 12));
  }

  private dataPrazo(valor: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
    if (!match) throw new BadRequestException('Data inválida.');
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }
}
