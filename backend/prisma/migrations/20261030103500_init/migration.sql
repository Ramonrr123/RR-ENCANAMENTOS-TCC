-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ATIVO', 'DESLIGADO');

-- CreateEnum
CREATE TYPE "FinanceiroTipo" AS ENUM ('PAGAR', 'RECEBER');

-- CreateEnum
CREATE TYPE "FinanceiroStatus" AS ENUM ('ABERTO', 'PAGO_PARCIAL', 'PAGO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstoqueMovimentoTipo" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateTable
CREATE TABLE "crm_usuarios" (
    "id" SERIAL NOT NULL,
    "login" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "cpfCnpj" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ATIVO',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "grupoUsuarioId" TEXT,
    "dataSaida" TIMESTAMP(3),
    "profileImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_sessoes" (
    "id" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "empresaCodigo" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "ultimoPing" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "encerradoEm" TIMESTAMP(3),
    "encerradoPorId" INTEGER,

    CONSTRAINT "crm_sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_usuario_preferencias_pdf" (
    "usuarioId" INTEGER NOT NULL,
    "secaoObs" TEXT,
    "secaoClausulas" TEXT,
    "entregaEntrega" TEXT,
    "entregaPagamento" TEXT,
    "entregaValidade" TEXT,
    "entregaFrete" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_usuario_preferencias_pdf_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateTable
CREATE TABLE "crm_grupos_usuarios" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "podeAprovarOrcamentos" BOOLEAN NOT NULL DEFAULT false,
    "podeVerTabelaPreco" BOOLEAN NOT NULL DEFAULT false,
    "podePrecificarOrcamentoRepresentante" BOOLEAN NOT NULL DEFAULT false,
    "podeLiberarVisualizacaoRepresentante" BOOLEAN NOT NULL DEFAULT false,
    "podeVisualizarProdutos" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "crm_grupos_usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_telas" (
    "id" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "parentId" TEXT,
    "moduleId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_telas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_permissoes_telas" (
    "id" TEXT NOT NULL,
    "userGroupId" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "hasPermission" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_permissoes_telas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_permissoes_telas_usuario" (
    "id" TEXT NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "screen_id" TEXT NOT NULL,
    "has_permission" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_permissoes_telas_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_empresas" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_usuarios_empresas" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_usuarios_empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financeiro_titulos" (
    "id" SERIAL NOT NULL,
    "empresaCodigo" TEXT NOT NULL,
    "tipo" "FinanceiroTipo" NOT NULL,
    "pessoa" TEXT NOT NULL,
    "numeroDocumento" TEXT,
    "tipoDocumento" TEXT NOT NULL,
    "planoContas" TEXT NOT NULL,
    "formaPagamento" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "dataEmissao" DATE,
    "dataCompetencia" DATE,
    "dataVencimento" DATE NOT NULL,
    "parcela" TEXT,
    "contaBancaria" TEXT,
    "desconto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "juros" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "multa" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valorBaixado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dataBaixa" DATE,
    "codigoBarras" TEXT,
    "observacao" TEXT,
    "status" "FinanceiroStatus" NOT NULL DEFAULT 'ABERTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financeiro_titulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" SERIAL NOT NULL,
    "empresaCodigo" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "preco" DECIMAL(14,2) NOT NULL,
    "custo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "estoque" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estoque_movimentos" (
    "id" SERIAL NOT NULL,
    "empresaCodigo" TEXT NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "tipo" "EstoqueMovimentoTipo" NOT NULL,
    "quantidade" DECIMAL(14,3) NOT NULL,
    "data" DATE NOT NULL,
    "motivo" TEXT NOT NULL,
    "documento" TEXT,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estoque_movimentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_usuarios_login_key" ON "crm_usuarios"("login");

-- CreateIndex
CREATE UNIQUE INDEX "crm_usuarios_email_key" ON "crm_usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "crm_usuarios_cpfCnpj_key" ON "crm_usuarios"("cpfCnpj");

-- CreateIndex
CREATE INDEX "crm_sessoes_ativo_ultimoPing_idx" ON "crm_sessoes"("ativo", "ultimoPing");

-- CreateIndex
CREATE INDEX "crm_sessoes_usuarioId_idx" ON "crm_sessoes"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "crm_grupos_usuarios_name_key" ON "crm_grupos_usuarios"("name");

-- CreateIndex
CREATE UNIQUE INDEX "crm_telas_screenId_key" ON "crm_telas"("screenId");

-- CreateIndex
CREATE UNIQUE INDEX "crm_permissoes_telas_userGroupId_screenId_key" ON "crm_permissoes_telas"("userGroupId", "screenId");

-- CreateIndex
CREATE INDEX "idx_perm_telas_usuario" ON "crm_permissoes_telas_usuario"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_permissoes_telas_usuario_usuario_id_screen_id_key" ON "crm_permissoes_telas_usuario"("usuario_id", "screen_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_empresas_codigo_key" ON "crm_empresas"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "crm_usuarios_empresas_userId_companyId_key" ON "crm_usuarios_empresas"("userId", "companyId");

-- CreateIndex
CREATE INDEX "financeiro_titulos_empresaCodigo_tipo_dataVencimento_idx" ON "financeiro_titulos"("empresaCodigo", "tipo", "dataVencimento");

-- CreateIndex
CREATE INDEX "produtos_empresaCodigo_descricao_idx" ON "produtos"("empresaCodigo", "descricao");

-- CreateIndex
CREATE UNIQUE INDEX "produtos_empresaCodigo_codigo_key" ON "produtos"("empresaCodigo", "codigo");

-- CreateIndex
CREATE INDEX "estoque_movimentos_empresaCodigo_data_idx" ON "estoque_movimentos"("empresaCodigo", "data");

-- CreateIndex
CREATE INDEX "estoque_movimentos_produtoId_idx" ON "estoque_movimentos"("produtoId");

-- AddForeignKey
ALTER TABLE "crm_usuarios" ADD CONSTRAINT "crm_usuarios_grupoUsuarioId_fkey" FOREIGN KEY ("grupoUsuarioId") REFERENCES "crm_grupos_usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_sessoes" ADD CONSTRAINT "crm_sessoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "crm_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_sessoes" ADD CONSTRAINT "crm_sessoes_encerradoPorId_fkey" FOREIGN KEY ("encerradoPorId") REFERENCES "crm_usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_usuario_preferencias_pdf" ADD CONSTRAINT "crm_usuario_preferencias_pdf_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "crm_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_telas" ADD CONSTRAINT "crm_telas_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "crm_telas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_permissoes_telas" ADD CONSTRAINT "crm_permissoes_telas_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "crm_telas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_permissoes_telas" ADD CONSTRAINT "crm_permissoes_telas_userGroupId_fkey" FOREIGN KEY ("userGroupId") REFERENCES "crm_grupos_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_permissoes_telas_usuario" ADD CONSTRAINT "crm_permissoes_telas_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "crm_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_permissoes_telas_usuario" ADD CONSTRAINT "crm_permissoes_telas_usuario_screen_id_fkey" FOREIGN KEY ("screen_id") REFERENCES "crm_telas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_usuarios_empresas" ADD CONSTRAINT "crm_usuarios_empresas_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "crm_empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_usuarios_empresas" ADD CONSTRAINT "crm_usuarios_empresas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "crm_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estoque_movimentos" ADD CONSTRAINT "estoque_movimentos_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- O Data API do Supabase não lê estas tabelas. A API entra pelo papel erp_app.
ALTER TABLE "crm_usuarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_sessoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_usuario_preferencias_pdf" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_grupos_usuarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_telas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_permissoes_telas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_permissoes_telas_usuario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_empresas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_usuarios_empresas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financeiro_titulos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "produtos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "estoque_movimentos" ENABLE ROW LEVEL SECURITY;

-- Roles Supabase: só revoga se existirem (Postgres local de teste não as cria).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE $sql$
      REVOKE ALL ON TABLE
        "crm_usuarios",
        "crm_sessoes",
        "crm_usuario_preferencias_pdf",
        "crm_grupos_usuarios",
        "crm_telas",
        "crm_permissoes_telas",
        "crm_permissoes_telas_usuario",
        "crm_empresas",
        "crm_usuarios_empresas",
        "financeiro_titulos",
        "produtos",
        "estoque_movimentos"
      FROM anon, authenticated
    $sql$;
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';
  END IF;
END $$;
