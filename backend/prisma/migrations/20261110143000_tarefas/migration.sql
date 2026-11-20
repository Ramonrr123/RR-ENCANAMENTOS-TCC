CREATE TABLE "tarefas" (
    "id" SERIAL NOT NULL,
    "empresaCodigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "prazo" DATE,
    "prioridade" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "responsaveis" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tarefas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tarefas_empresaCodigo_prazo_idx" ON "tarefas"("empresaCodigo", "prazo");

ALTER TABLE "tarefas" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_app') THEN
    EXECUTE 'GRANT ALL PRIVILEGES ON TABLE "tarefas" TO erp_app';
    EXECUTE 'GRANT ALL PRIVILEGES ON SEQUENCE "tarefas_id_seq" TO erp_app';
    EXECUTE 'CREATE POLICY erp_app_all ON "tarefas" FOR ALL TO erp_app USING (true) WITH CHECK (true)';
  END IF;
END $$;
