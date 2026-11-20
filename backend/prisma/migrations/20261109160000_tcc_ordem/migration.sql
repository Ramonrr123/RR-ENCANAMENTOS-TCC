-- Especialidade do usuário
CREATE TYPE "Especialidade" AS ENUM ('ENCANADOR', 'PEDREIRO', 'PINTOR', 'ELETRICISTA');

ALTER TABLE "crm_usuarios" ADD COLUMN "especialidade" "Especialidade";

-- Pessoa e endereços do cliente
CREATE TYPE "TipoPessoa" AS ENUM ('FISICA', 'JURIDICA');

ALTER TABLE "clientes" ADD COLUMN "tipoPessoa" "TipoPessoa" NOT NULL DEFAULT 'FISICA';

CREATE TABLE "cliente_enderecos" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "apelido" TEXT,
    "logradouro" TEXT NOT NULL,
    "cidade" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cliente_enderecos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cliente_enderecos_clienteId_idx" ON "cliente_enderecos"("clienteId");

ALTER TABLE "cliente_enderecos" ADD CONSTRAINT "cliente_enderecos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "cliente_enderecos" ("clienteId", "apelido", "logradouro", "cidade", "principal", "updatedAt")
SELECT "id", 'Principal', "endereco", "cidade", true, CURRENT_TIMESTAMP
FROM "clientes"
WHERE "endereco" IS NOT NULL AND btrim("endereco") <> '';

-- Situações novas da ordem. EM_EXECUCAO permanece para ordem antiga.
ALTER TYPE "OrdemSituacao" ADD VALUE 'AGENDADA';
ALTER TYPE "OrdemSituacao" ADD VALUE 'EM_ANDAMENTO';
ALTER TYPE "OrdemSituacao" ADD VALUE 'CONCLUIDA';
ALTER TYPE "OrdemSituacao" ADD VALUE 'CANCELADA';

CREATE TYPE "OrdemTipo" AS ENUM ('EMERGENCIA', 'PREVENTIVA', 'OBRA');
CREATE TYPE "OrdemOrigem" AS ENUM ('WHATSAPP', 'TELEFONE', 'INDICACAO');
CREATE TYPE "OrdemFotoMomento" AS ENUM ('ANTES', 'DEPOIS');

ALTER TABLE "ordens_servico" ADD COLUMN "tipo" "OrdemTipo";
ALTER TABLE "ordens_servico" ADD COLUMN "origem" "OrdemOrigem";
ALTER TABLE "ordens_servico" ADD COLUMN "descricaoProblema" TEXT;
ALTER TABLE "ordens_servico" ADD COLUMN "enderecoId" INTEGER;
ALTER TABLE "ordens_servico" ADD COLUMN "funcionarioId" INTEGER;
ALTER TABLE "ordens_servico" ADD COLUMN "entradaValor" DECIMAL(14,2);
ALTER TABLE "ordens_servico" ADD COLUMN "margem" DECIMAL(14,2);
ALTER TABLE "ordens_servico" ADD COLUMN "garantiaDias" INTEGER;
ALTER TABLE "ordens_servico" ADD COLUMN "preventivaEm" DATE;
ALTER TABLE "ordens_servico" ADD COLUMN "motivoCancelamento" TEXT;

CREATE INDEX "ordens_servico_enderecoId_idx" ON "ordens_servico"("enderecoId");
CREATE INDEX "ordens_servico_funcionarioId_idx" ON "ordens_servico"("funcionarioId");

ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_enderecoId_fkey" FOREIGN KEY ("enderecoId") REFERENCES "cliente_enderecos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "crm_usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ordem_fotos" (
    "id" SERIAL NOT NULL,
    "ordemId" INTEGER NOT NULL,
    "momento" "OrdemFotoMomento" NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ordem_fotos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ordem_fotos_ordemId_idx" ON "ordem_fotos"("ordemId");

ALTER TABLE "ordem_fotos" ADD CONSTRAINT "ordem_fotos_ordemId_fkey" FOREIGN KEY ("ordemId") REFERENCES "ordens_servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cliente_enderecos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ordem_fotos" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE "cliente_enderecos", "ordem_fotos" FROM anon, authenticated';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_app') THEN
    EXECUTE 'GRANT ALL PRIVILEGES ON TABLE "cliente_enderecos", "ordem_fotos" TO erp_app';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO erp_app';
    EXECUTE 'CREATE POLICY erp_app_all ON "cliente_enderecos" FOR ALL TO erp_app USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY erp_app_all ON "ordem_fotos" FOR ALL TO erp_app USING (true) WITH CHECK (true)';
  END IF;
END $$;
