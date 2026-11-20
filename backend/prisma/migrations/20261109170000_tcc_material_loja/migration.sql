CREATE TABLE "ordem_materiais_loja" (
    "id" SERIAL NOT NULL,
    "ordemId" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidadeRetirada" DECIMAL(14,3) NOT NULL,
    "quantidadeUsada" DECIMAL(14,3) NOT NULL,
    "quantidadeDevolvida" DECIMAL(14,3) NOT NULL,
    CONSTRAINT "ordem_materiais_loja_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ordem_materiais_loja_ordemId_idx" ON "ordem_materiais_loja"("ordemId");

ALTER TABLE "ordem_materiais_loja" ADD CONSTRAINT "ordem_materiais_loja_ordemId_fkey" FOREIGN KEY ("ordemId") REFERENCES "ordens_servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ordem_materiais_loja" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE "ordem_materiais_loja" FROM anon, authenticated';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_app') THEN
    EXECUTE 'GRANT ALL PRIVILEGES ON TABLE "ordem_materiais_loja" TO erp_app';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO erp_app';
    EXECUTE 'CREATE POLICY erp_app_all ON "ordem_materiais_loja" FOR ALL TO erp_app USING (true) WITH CHECK (true)';
  END IF;
END $$;
