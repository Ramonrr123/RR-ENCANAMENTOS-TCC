CREATE TABLE "ordem_agendamentos" (
    "id" SERIAL NOT NULL,
    "empresaCodigo" TEXT NOT NULL,
    "ordemId" INTEGER NOT NULL,
    "funcionarioId" INTEGER NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ordem_agendamentos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ordem_agendamentos_ordemId_key" ON "ordem_agendamentos"("ordemId");
CREATE INDEX "ordem_agendamentos_funcionarioId_inicio_idx" ON "ordem_agendamentos"("funcionarioId", "inicio");
CREATE INDEX "ordem_agendamentos_empresaCodigo_inicio_idx" ON "ordem_agendamentos"("empresaCodigo", "inicio");

ALTER TABLE "ordem_agendamentos" ADD CONSTRAINT "ordem_agendamentos_ordemId_fkey" FOREIGN KEY ("ordemId") REFERENCES "ordens_servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ordem_agendamentos" ADD CONSTRAINT "ordem_agendamentos_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "crm_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ordem_agendamentos" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE "ordem_agendamentos" FROM anon, authenticated';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_app') THEN
    EXECUTE 'GRANT ALL PRIVILEGES ON TABLE "ordem_agendamentos" TO erp_app';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO erp_app';
    EXECUTE 'CREATE POLICY erp_app_all ON "ordem_agendamentos" FOR ALL TO erp_app USING (true) WITH CHECK (true)';
  END IF;
END $$;
