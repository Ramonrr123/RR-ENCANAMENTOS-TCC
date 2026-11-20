CREATE TYPE "ChamadoStatus" AS ENUM ('ABERTO', 'EM_ATENDIMENTO', 'RESOLVIDO');

CREATE TABLE "chamados" (
    "id" SERIAL NOT NULL,
    "empresaCodigo" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numeroEndereco" TEXT NOT NULL,
    "bairro" TEXT NOT NULL DEFAULT '',
    "cidade" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "status" "ChamadoStatus" NOT NULL DEFAULT 'ABERTO',
    "ordemId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chamados_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chamado_notas" (
    "id" SERIAL NOT NULL,
    "chamadoId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chamado_notas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chamados_ordemId_key" ON "chamados"("ordemId");
CREATE UNIQUE INDEX "chamados_empresaCodigo_numero_key" ON "chamados"("empresaCodigo", "numero");
CREATE INDEX "chamados_empresaCodigo_status_idx" ON "chamados"("empresaCodigo", "status");
CREATE INDEX "chamado_notas_chamadoId_idx" ON "chamado_notas"("chamadoId");

ALTER TABLE "chamados" ADD CONSTRAINT "chamados_ordemId_fkey" FOREIGN KEY ("ordemId") REFERENCES "ordens_servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chamado_notas" ADD CONSTRAINT "chamado_notas_chamadoId_fkey" FOREIGN KEY ("chamadoId") REFERENCES "chamados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chamados" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chamado_notas" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_app') THEN
    EXECUTE 'GRANT ALL PRIVILEGES ON TABLE "chamados" TO erp_app';
    EXECUTE 'GRANT ALL PRIVILEGES ON TABLE "chamado_notas" TO erp_app';
    EXECUTE 'GRANT ALL PRIVILEGES ON SEQUENCE "chamados_id_seq" TO erp_app';
    EXECUTE 'GRANT ALL PRIVILEGES ON SEQUENCE "chamado_notas_id_seq" TO erp_app';
    EXECUTE 'CREATE POLICY erp_app_all ON "chamados" FOR ALL TO erp_app USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY erp_app_all ON "chamado_notas" FOR ALL TO erp_app USING (true) WITH CHECK (true)';
  END IF;
END $$;
