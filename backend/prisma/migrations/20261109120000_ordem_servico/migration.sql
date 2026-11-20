-- CreateEnum
CREATE TYPE "OrdemSituacao" AS ENUM ('ABERTA', 'EM_EXECUCAO', 'ENCERRADA');

-- CreateTable
CREATE TABLE "clientes" (
    "id" SERIAL NOT NULL,
    "empresaCodigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "endereco" TEXT,
    "cidade" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordens_servico" (
    "id" SERIAL NOT NULL,
    "empresaCodigo" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "situacao" "OrdemSituacao" NOT NULL DEFAULT 'ABERTA',
    "vistoria" TEXT,
    "servicos" TEXT,
    "taxaVistoria" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "maoDeObra" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "deslocamento" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "material" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dataAbertura" DATE NOT NULL,
    "dataEncerramento" DATE,
    "garantiaAte" DATE,
    "assinatura" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordens_servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordem_pecas" (
    "id" SERIAL NOT NULL,
    "ordemId" INTEGER NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "quantidade" DECIMAL(14,3) NOT NULL,
    "custoUnitario" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordem_pecas_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "estoque_movimentos" ADD COLUMN "ordemId" INTEGER;

-- CreateIndex
CREATE INDEX "clientes_empresaCodigo_nome_idx" ON "clientes"("empresaCodigo", "nome");

-- CreateIndex
CREATE INDEX "ordens_servico_empresaCodigo_situacao_idx" ON "ordens_servico"("empresaCodigo", "situacao");

-- CreateIndex
CREATE INDEX "ordens_servico_clienteId_idx" ON "ordens_servico"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "ordens_servico_empresaCodigo_numero_key" ON "ordens_servico"("empresaCodigo", "numero");

-- CreateIndex
CREATE INDEX "ordem_pecas_ordemId_idx" ON "ordem_pecas"("ordemId");

-- CreateIndex
CREATE INDEX "ordem_pecas_produtoId_idx" ON "ordem_pecas"("produtoId");

-- CreateIndex
CREATE INDEX "estoque_movimentos_ordemId_idx" ON "estoque_movimentos"("ordemId");

-- AddForeignKey
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordem_pecas" ADD CONSTRAINT "ordem_pecas_ordemId_fkey" FOREIGN KEY ("ordemId") REFERENCES "ordens_servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordem_pecas" ADD CONSTRAINT "ordem_pecas_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estoque_movimentos" ADD CONSTRAINT "estoque_movimentos_ordemId_fkey" FOREIGN KEY ("ordemId") REFERENCES "ordens_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- O Data API do Supabase não lê estas tabelas. A API entra pelo papel erp_app.
ALTER TABLE "clientes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ordens_servico" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ordem_pecas" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE "clientes", "ordens_servico", "ordem_pecas" FROM anon, authenticated';
  END IF;
END $$;

DO $$
DECLARE
  tabela text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_app') THEN
    EXECUTE 'GRANT ALL PRIVILEGES ON TABLE "clientes", "ordens_servico", "ordem_pecas" TO erp_app';
    EXECUTE 'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO erp_app';
    FOREACH tabela IN ARRAY ARRAY['clientes', 'ordens_servico', 'ordem_pecas']
    LOOP
      EXECUTE format(
        'CREATE POLICY erp_app_all ON %I FOR ALL TO erp_app USING (true) WITH CHECK (true)',
        tabela
      );
    END LOOP;
  END IF;
END $$;
