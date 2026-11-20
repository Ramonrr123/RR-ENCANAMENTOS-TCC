-- CreateTable
CREATE TABLE "atividades" (
    "id" SERIAL NOT NULL,
    "empresaCodigo" TEXT NOT NULL,
    "usuarioId" INTEGER,
    "login" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "metodo" TEXT NOT NULL,
    "objeto" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atividades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "atividades_empresaCodigo_criadoEm_idx" ON "atividades"("empresaCodigo", "criadoEm");

ALTER TABLE "atividades" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE "atividades" FROM anon, authenticated';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_app') THEN
    EXECUTE 'GRANT ALL PRIVILEGES ON TABLE "atividades" TO erp_app';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO erp_app';
    EXECUTE 'CREATE POLICY erp_app_all ON "atividades" FOR ALL TO erp_app USING (true) WITH CHECK (true)';
  END IF;
END $$;
