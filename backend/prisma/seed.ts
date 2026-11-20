/**
 * Seed idempotente da simulação do TCC.
 *
 * Conteúdo esperado (empresa 01):
 * - 5 usuários (1 administrador + 4 funcionários)
 * - ~155 produtos de encanamento/consumo/ferramenta
 * - Estoque nos locais VEICULO e DEPOSITO
 * - Clientes e ordens fictícias (garantia vigente, preventiva atrasada, visita agendada, abertas)
 *
 * Pode rodar várias vezes: upserts por chave natural (login, codigo, numero, nome marcado).
 * Senhas de demonstração só para ambiente local — troque em qualquer ambiente real.
 */
import { PrismaClient, UserStatus, OrdemSituacao, Especialidade } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const EMPRESA = '01';

type ProdutoSeed = {
  codigo: string;
  descricao: string;
  unidade: string;
  categoria: string;
  preco: number;
  custo: number;
  estoque: number;
  observacao?: string | null;
  estoqueMinimo: number;
  ferramenta: boolean;
};

/** Mesma conta de `adicionarDias` / `adicionarMeses` em ordens.service.ts (encerrar). */
function addDays(base: Date, days: number): Date {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + days, 12));
}

function addMonths(base: Date, months: number): Date {
  const ano = base.getUTCFullYear();
  const mes = base.getUTCMonth() + months;
  const dia = base.getUTCDate();
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0, 12)).getUTCDate();
  return new Date(Date.UTC(ano, mes, Math.min(dia, ultimoDia), 12));
}

function hojeUtc() {
  const agora = new Date();
  return new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate(), 12));
}

function loadProdutos(): ProdutoSeed[] {
  const file = path.join(__dirname, 'seed-produtos.json');
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw) as ProdutoSeed[];
}

async function ensureTelas() {
  const telas = [
    { screenId: 'inicio', label: 'Início', parentId: null, moduleId: 'inicio', order: 1 },
    { screenId: 'financeiro', label: 'Financeiro', parentId: null, moduleId: 'financeiro', order: 2 },
    { screenId: 'financeiro-pagar', label: '  - Contas a pagar', parentId: 'financeiro', moduleId: 'financeiro', order: 3 },
    { screenId: 'financeiro-receber', label: '  - Contas a receber', parentId: 'financeiro', moduleId: 'financeiro', order: 4 },
    { screenId: 'financeiro-fluxo', label: '  - Fluxo de caixa', parentId: 'financeiro', moduleId: 'financeiro', order: 5 },
    { screenId: 'produtos', label: 'Produtos', parentId: null, moduleId: 'produtos', order: 6 },
    { screenId: 'estoque', label: 'Estoque', parentId: null, moduleId: 'estoque', order: 7 },
    { screenId: 'chamados', label: 'Chamados', parentId: null, moduleId: 'chamados', order: 8 },
    { screenId: 'ordem-servico', label: 'Ordem de Serviço', parentId: null, moduleId: 'ordem-servico', order: 9 },
    { screenId: 'tarefas', label: 'Tarefas', parentId: null, moduleId: 'tarefas', order: 10 },
    { screenId: 'calendario', label: 'Calendário', parentId: null, moduleId: 'calendario', order: 11 },
    { screenId: 'acesso', label: 'Acesso', parentId: null, moduleId: 'acesso', order: 12 },
    { screenId: 'acesso-usuarios', label: '  - Usuários', parentId: 'acesso', moduleId: 'acesso', order: 13 },
    { screenId: 'acesso-permissoes', label: '  - Permissões de usuário', parentId: 'acesso', moduleId: 'acesso', order: 14 },
    { screenId: 'acesso-perfil', label: '  - Perfil de acesso', parentId: 'acesso', moduleId: 'acesso', order: 15 },
    { screenId: 'acesso-empresas', label: '  - Empresas', parentId: 'acesso', moduleId: 'acesso', order: 16 },
    { screenId: 'acesso-atividades', label: '  - Atividades', parentId: 'acesso', moduleId: 'acesso', order: 17 },
  ];

  for (const t of telas) {
    await prisma.crmTelas.upsert({
      where: { screenId: t.screenId },
      update: { label: t.label, parentId: t.parentId, moduleId: t.moduleId, order: t.order },
      create: {
        id: t.screenId,
        screenId: t.screenId,
        label: t.label,
        parentId: t.parentId,
        moduleId: t.moduleId,
        order: t.order,
      },
    });
  }
}

async function upsertUsuario(params: {
  login: string;
  nome: string;
  email: string | null;
  passwordHash: string;
  isAdmin: boolean;
  grupoUsuarioId: string | null;
  especialidade?: Especialidade | null;
  companyId: number;
}) {
  const user = await prisma.crmUsuarios.upsert({
    where: { login: params.login },
    update: {
      nome: params.nome,
      email: params.email,
      password: params.passwordHash,
      status: UserStatus.ATIVO,
      isAdmin: params.isAdmin,
      grupoUsuarioId: params.grupoUsuarioId,
      especialidade: params.especialidade ?? null,
    },
    create: {
      login: params.login,
      nome: params.nome,
      email: params.email,
      password: params.passwordHash,
      status: UserStatus.ATIVO,
      isAdmin: params.isAdmin,
      grupoUsuarioId: params.grupoUsuarioId,
      especialidade: params.especialidade ?? null,
    },
  });

  await prisma.crmUsuariosEmpresas.upsert({
    where: { userId_companyId: { userId: user.id, companyId: params.companyId } },
    update: {},
    create: { userId: user.id, companyId: params.companyId },
  });

  return user;
}

async function ensureCliente(nome: string, telefone: string, endereco: string, cidade: string) {
  const existing = await prisma.cliente.findFirst({
    where: { empresaCodigo: EMPRESA, nome },
  });
  const cliente =
    existing ??
    (await prisma.cliente.create({
      data: {
        empresaCodigo: EMPRESA,
        nome,
        telefone,
        endereco,
        cidade,
      },
    }));

  if (existing) {
    await prisma.cliente.update({
      where: { id: existing.id },
      data: { telefone, endereco, cidade },
    });
  }

  let end = await prisma.clienteEndereco.findFirst({
    where: { clienteId: cliente.id, principal: true },
  });
  if (!end) {
    end = await prisma.clienteEndereco.create({
      data: {
        clienteId: cliente.id,
        apelido: 'Principal',
        logradouro: endereco,
        cidade,
        principal: true,
      },
    });
  } else {
    end = await prisma.clienteEndereco.update({
      where: { id: end.id },
      data: { logradouro: endereco, cidade },
    });
  }

  return { cliente, endereco: end };
}

async function ensureOrdem(params: {
  numero: number;
  clienteId: number;
  enderecoId: number;
  situacao: OrdemSituacao;
  dataAbertura: Date;
  dataEncerramento?: Date | null;
  servicos: string;
  vistoria?: string;
  funcionarioId?: number | null;
  preventivaStatus?: string | null;
  maoDeObra?: number;
  material?: number;
  gerarTituloEncerramento?: boolean;
  clienteNome?: string;
}) {
  const garantiaAte = params.dataEncerramento ? addDays(params.dataEncerramento, 90) : null;
  const preventivaEm = params.dataEncerramento ? addMonths(params.dataEncerramento, 6) : null;
  const garantiaDias = params.dataEncerramento ? 90 : null;
  const maoDeObra = params.maoDeObra ?? 250;
  const material = params.material ?? 80;

  const ordem = await prisma.ordemServico.upsert({
    where: { empresaCodigo_numero: { empresaCodigo: EMPRESA, numero: params.numero } },
    update: {
      clienteId: params.clienteId,
      enderecoId: params.enderecoId,
      situacao: params.situacao,
      dataAbertura: params.dataAbertura,
      dataEncerramento: params.dataEncerramento ?? null,
      garantiaAte,
      garantiaDias,
      preventivaEm,
      preventivaStatus: params.preventivaStatus ?? (params.dataEncerramento ? 'a_contatar' : null),
      vistoria: params.vistoria ?? `Vistoria seed OS ${params.numero}`,
      servicos: params.servicos,
      funcionarioId: params.funcionarioId ?? null,
      maoDeObra,
      material,
      entradaValor: params.gerarTituloEncerramento ? 0 : undefined,
    },
    create: {
      empresaCodigo: EMPRESA,
      numero: params.numero,
      clienteId: params.clienteId,
      enderecoId: params.enderecoId,
      situacao: params.situacao,
      dataAbertura: params.dataAbertura,
      dataEncerramento: params.dataEncerramento ?? null,
      garantiaAte,
      garantiaDias,
      preventivaEm,
      preventivaStatus: params.preventivaStatus ?? (params.dataEncerramento ? 'a_contatar' : null),
      vistoria: params.vistoria ?? `Vistoria seed OS ${params.numero}`,
      servicos: params.servicos,
      funcionarioId: params.funcionarioId ?? null,
      maoDeObra,
      material,
      entradaValor: params.gerarTituloEncerramento ? 0 : null,
    },
  });

  // Espelha o título único gerado pelo encerrar (parcela nula) quando o seed não pode chamar a API.
  if (params.gerarTituloEncerramento && params.clienteNome && params.dataEncerramento) {
    const doc = `OS-${String(params.numero).padStart(4, '0')}`;
    const total = maoDeObra + material;
    await prisma.financeiroTitulo.deleteMany({
      where: { empresaCodigo: EMPRESA, numeroDocumento: doc },
    });
    await prisma.financeiroTitulo.create({
      data: {
        empresaCodigo: EMPRESA,
        tipo: 'RECEBER',
        pessoa: params.clienteNome.trim(),
        numeroDocumento: doc,
        tipoDocumento: 'Recibo',
        planoContas: 'Serviço de encanamento',
        formaPagamento: 'PIX',
        valor: total,
        dataEmissao: params.dataEncerramento,
        dataCompetencia: params.dataEncerramento,
        dataVencimento: addDays(params.dataEncerramento, 15),
        parcela: null,
        desconto: 0,
        juros: 0,
        multa: 0,
        valorBaixado: 0,
        observacao: `Gerado no encerramento da ordem ${params.numero}.`,
        status: 'ABERTO',
      },
    });
  }

  return ordem;
}

async function main() {
  console.log('Seed TCC — início (idempotente)');

  const groupAdmin = await prisma.crmGruposUsuarios.upsert({
    where: { name: 'administradores' },
    update: {
      label: 'Administradores',
      description: 'Acesso completo ao cadastro de usuários e permissões',
    },
    create: {
      id: randomUUID(),
      name: 'administradores',
      label: 'Administradores',
      description: 'Acesso completo ao cadastro de usuários e permissões',
    },
  });

  const groupFunc = await prisma.crmGruposUsuarios.upsert({
    where: { name: 'funcionarios' },
    update: {
      label: 'Funcionários',
      description: 'Acesso operacional sem administração de acesso',
    },
    create: {
      id: randomUUID(),
      name: 'funcionarios',
      label: 'Funcionários',
      description: 'Acesso operacional sem administração de acesso',
    },
  });

  const company = await prisma.crmEmpresas.upsert({
    where: { codigo: EMPRESA },
    update: { nome: 'Matriz', ativo: true },
    create: { codigo: EMPRESA, nome: 'Matriz', ativo: true },
  });

  await ensureTelas();

  const senhaAdmin = await bcrypt.hash('admin123', 10);
  const senhaFunc = await bcrypt.hash('func123', 10);

  const admin = await upsertUsuario({
    login: 'admin',
    nome: 'Administrador',
    email: 'admin@erp.local',
    passwordHash: senhaAdmin,
    isAdmin: true,
    grupoUsuarioId: groupAdmin.id,
    companyId: company.id,
  });

  const func1 = await upsertUsuario({
    login: 'encanador.tcc',
    nome: 'Funcionário Encanador TCC',
    email: 'encanador.tcc@erp.local',
    passwordHash: senhaFunc,
    isAdmin: false,
    grupoUsuarioId: groupFunc.id,
    especialidade: Especialidade.ENCANADOR,
    companyId: company.id,
  });

  // Usuário de captura/e2e (login por CAPTURA_FUNC_EMAIL=captura.teste)
  await upsertUsuario({
    login: 'captura.teste',
    nome: 'Funcionário Captura Teste',
    email: 'captura.teste@erp.local',
    passwordHash: senhaFunc,
    isAdmin: false,
    grupoUsuarioId: groupFunc.id,
    especialidade: Especialidade.ENCANADOR,
    companyId: company.id,
  });

  await upsertUsuario({
    login: 'pedreiro.tcc',
    nome: 'Funcionário Pedreiro TCC',
    email: 'pedreiro.tcc@erp.local',
    passwordHash: senhaFunc,
    isAdmin: false,
    grupoUsuarioId: groupFunc.id,
    especialidade: Especialidade.PEDREIRO,
    companyId: company.id,
  });

  await upsertUsuario({
    login: 'pintor.tcc',
    nome: 'Funcionário Pintor TCC',
    email: 'pintor.tcc@erp.local',
    passwordHash: senhaFunc,
    isAdmin: false,
    grupoUsuarioId: groupFunc.id,
    especialidade: Especialidade.PINTOR,
    companyId: company.id,
  });

  await upsertUsuario({
    login: 'eletricista.tcc',
    nome: 'Funcionário Eletricista TCC',
    email: 'eletricista.tcc@erp.local',
    passwordHash: senhaFunc,
    isAdmin: false,
    grupoUsuarioId: groupFunc.id,
    especialidade: Especialidade.ELETRICISTA,
    companyId: company.id,
  });

  const localDeposito = await prisma.estoqueLocal.upsert({
    where: { empresaCodigo_codigo: { empresaCodigo: EMPRESA, codigo: 'DEPOSITO' } },
    update: { nome: 'Depósito' },
    create: { empresaCodigo: EMPRESA, codigo: 'DEPOSITO', nome: 'Depósito' },
  });

  const localVeiculo = await prisma.estoqueLocal.upsert({
    where: { empresaCodigo_codigo: { empresaCodigo: EMPRESA, codigo: 'VEICULO' } },
    update: { nome: 'Veículo' },
    create: { empresaCodigo: EMPRESA, codigo: 'VEICULO', nome: 'Veículo' },
  });

  const produtos = loadProdutos();
  for (const p of produtos) {
    const total = Number(p.estoque) || 0;
    // Ferramentas e estoques inteiros: partilha em unidades (evita 0,8 no veículo).
    const inteiro = Boolean(p.ferramenta) || Number.isInteger(total);
    const qDeposito = inteiro ? Math.floor(total * 0.6) : Math.floor(total * 0.6 * 1000) / 1000;
    const qVeiculo = inteiro ? total - qDeposito : Math.round((total - qDeposito) * 1000) / 1000;

    const produto = await prisma.produto.upsert({
      where: { empresaCodigo_codigo: { empresaCodigo: EMPRESA, codigo: p.codigo } },
      update: {
        descricao: p.descricao,
        unidade: p.unidade,
        categoria: p.categoria,
        preco: p.preco,
        custo: p.custo,
        estoque: total,
        estoqueMinimo: p.estoqueMinimo,
        observacao: p.observacao ?? null,
        ferramenta: Boolean(p.ferramenta),
        ativo: true,
      },
      create: {
        empresaCodigo: EMPRESA,
        codigo: p.codigo,
        descricao: p.descricao,
        unidade: p.unidade,
        categoria: p.categoria,
        preco: p.preco,
        custo: p.custo,
        estoque: total,
        estoqueMinimo: p.estoqueMinimo,
        observacao: p.observacao ?? null,
        ferramenta: Boolean(p.ferramenta),
        ativo: true,
      },
    });

    await prisma.estoqueSaldo.upsert({
      where: { produtoId_localId: { produtoId: produto.id, localId: localDeposito.id } },
      update: { quantidade: qDeposito },
      create: { produtoId: produto.id, localId: localDeposito.id, quantidade: qDeposito },
    });

    await prisma.estoqueSaldo.upsert({
      where: { produtoId_localId: { produtoId: produto.id, localId: localVeiculo.id } },
      update: { quantidade: qVeiculo },
      create: { produtoId: produto.id, localId: localVeiculo.id, quantidade: qVeiculo },
    });
  }

  const cGarantia = await ensureCliente(
    'Cliente Fictício Garantia TCC',
    '(42) 90000-0101',
    'Rua Fictícia da Garantia, 100',
    'Porto União',
  );
  const cPrevAtrasada = await ensureCliente(
    'Cliente Fictício Preventiva Atrasada',
    '(42) 90000-0102',
    'Avenida Fictícia da Preventiva, 50',
    'Porto União',
  );
  const cVisita = await ensureCliente(
    'Cliente Fictício Visita Agendada',
    '(42) 90000-0103',
    'Travessa Fictícia Agendada, 7',
    'União da Vitória',
  );
  const cGarantiaVencida = await ensureCliente(
    'Cliente Fictício Garantia Vencida',
    '(42) 90000-0104',
    'Rua Fictícia Garantia Vencida, 22',
    'Porto União',
  );
  const cAberto = await ensureCliente(
    'Cliente Fictício Ordem Aberta',
    '(42) 90000-0010',
    'Rua do Hidrômetro, 100',
    'Porto União',
  );

  // Só se mexe no encerramento; garantiaAte (+90d) e preventivaEm (+6m) vêm de ensureOrdem.
  const hoje = hojeUtc();
  const encGarantia = addDays(hoje, -30); // garantia vigente (~60 dias restantes)
  const encGarantiaVencida = addDays(hoje, -120); // garantia vencida (~30 dias)
  const encPrevAtrasada = addDays(addMonths(hoje, -6), -8); // preventiva atrasada ~8 dias
  const encVisita = addDays(addMonths(hoje, -6), 20); // preventiva a vencer ~20 dias

  // OS 7/8/9/11: no seed sem API, grava título no mesmo formato do encerrar.
  // Com API no ar, preferir `node scripts/regularizar-os-antigas.mjs` (fluxo real POST /encerrar).
  await ensureOrdem({
    numero: 7,
    clienteId: cGarantia.cliente.id,
    enderecoId: cGarantia.endereco.id,
    situacao: OrdemSituacao.ENCERRADA,
    dataAbertura: addDays(encGarantia, -5),
    dataEncerramento: encGarantia,
    vistoria: 'Vistoria fictícia — registro com vazamento',
    servicos: 'Troca fictícia de registro e reparo de vazamento',
    funcionarioId: func1.id,
    preventivaStatus: 'a_contatar',
    gerarTituloEncerramento: true,
    clienteNome: cGarantia.cliente.nome,
  });

  await ensureOrdem({
    numero: 8,
    clienteId: cPrevAtrasada.cliente.id,
    enderecoId: cPrevAtrasada.endereco.id,
    situacao: OrdemSituacao.ENCERRADA,
    dataAbertura: addDays(encPrevAtrasada, -3),
    dataEncerramento: encPrevAtrasada,
    vistoria: 'Vistoria fictícia — caixa d água',
    servicos: 'Limpeza fictícia de caixa d água',
    funcionarioId: func1.id,
    preventivaStatus: 'contatado',
    gerarTituloEncerramento: true,
    clienteNome: cPrevAtrasada.cliente.nome,
  });

  await ensureOrdem({
    numero: 9,
    clienteId: cVisita.cliente.id,
    enderecoId: cVisita.endereco.id,
    situacao: OrdemSituacao.ENCERRADA,
    dataAbertura: addDays(encVisita, -2),
    dataEncerramento: encVisita,
    vistoria: 'Vistoria fictícia — aquecedor',
    servicos: 'Revisão fictícia de aquecedor',
    funcionarioId: func1.id,
    preventivaStatus: 'agendada',
    gerarTituloEncerramento: true,
    clienteNome: cVisita.cliente.nome,
  });

  await ensureOrdem({
    numero: 11,
    clienteId: cGarantiaVencida.cliente.id,
    enderecoId: cGarantiaVencida.endereco.id,
    situacao: OrdemSituacao.ENCERRADA,
    dataAbertura: addDays(encGarantiaVencida, -4),
    dataEncerramento: encGarantiaVencida,
    vistoria: 'Vistoria fictícia — garantia vencida',
    servicos: 'Reparo fictício com garantia já vencida',
    funcionarioId: func1.id,
    preventivaStatus: 'a_contatar',
    gerarTituloEncerramento: true,
    clienteNome: cGarantiaVencida.cliente.nome,
  });

  await ensureOrdem({
    numero: 10,
    clienteId: cAberto.cliente.id,
    enderecoId: cAberto.endereco.id,
    situacao: OrdemSituacao.ABERTA,
    dataAbertura: hoje,
    dataEncerramento: null,
    servicos: 'Vistoria de vazamento (seed TCC).',
    funcionarioId: func1.id,
  });

  const usuarios = await prisma.crmUsuarios.count({
    where: { login: { in: ['admin', 'encanador.tcc', 'pedreiro.tcc', 'pintor.tcc', 'eletricista.tcc'] } },
  });
  const qProdutos = await prisma.produto.count({ where: { empresaCodigo: EMPRESA } });
  const qSaldos = await prisma.estoqueSaldo.count({
    where: { local: { empresaCodigo: EMPRESA } },
  });

  console.log('Seed TCC — concluído');
  console.log(`Usuários da simulação: ${usuarios} (esperado 5)`);
  console.log(`Produtos empresa ${EMPRESA}: ${qProdutos} (esperado ~155)`);
  console.log(`Saldos de estoque: ${qSaldos} (dois locais por produto)`);
  console.log('Logins demo: admin e *.tcc (senhas só no seed local / .env.captura — não impressas aqui)');
  console.log(`Admin id=${admin.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
