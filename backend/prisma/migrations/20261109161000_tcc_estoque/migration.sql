ALTER TABLE "produtos" ADD COLUMN "estoqueMinimo" DECIMAL(14,3) NOT NULL DEFAULT 0;

ALTER TABLE "estoque_movimentos" ADD COLUMN "localId" INTEGER;
ALTER TABLE "estoque_movimentos" ADD COLUMN "usuarioId" INTEGER;

CREATE TABLE "estoque_locais" (
    "id" SERIAL NOT NULL,
    "empresaCodigo" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    CONSTRAINT "estoque_locais_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "estoque_locais_empresaCodigo_codigo_key" ON "estoque_locais"("empresaCodigo", "codigo");

CREATE TABLE "estoque_saldos" (
    "id" SERIAL NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "localId" INTEGER NOT NULL,
    "quantidade" DECIMAL(14,3) NOT NULL DEFAULT 0,
    CONSTRAINT "estoque_saldos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "estoque_saldos_produtoId_localId_key" ON "estoque_saldos"("produtoId", "localId");

ALTER TABLE "estoque_movimentos" ADD CONSTRAINT "estoque_movimentos_localId_fkey" FOREIGN KEY ("localId") REFERENCES "estoque_locais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "estoque_movimentos" ADD CONSTRAINT "estoque_movimentos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "crm_usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "estoque_saldos" ADD CONSTRAINT "estoque_saldos_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "estoque_saldos" ADD CONSTRAINT "estoque_saldos_localId_fkey" FOREIGN KEY ("localId") REFERENCES "estoque_locais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "estoque_locais" ("empresaCodigo", "codigo", "nome")
SELECT DISTINCT "empresaCodigo", 'VEICULO', 'Veículo' FROM "produtos"
UNION
SELECT DISTINCT "empresaCodigo", 'DEPOSITO', 'Depósito' FROM "produtos";

INSERT INTO "estoque_saldos" ("produtoId", "localId", "quantidade")
SELECT p."id", l."id", p."estoque"
FROM "produtos" p
JOIN "estoque_locais" l ON l."empresaCodigo" = p."empresaCodigo" AND l."codigo" = 'VEICULO';

INSERT INTO "estoque_saldos" ("produtoId", "localId", "quantidade")
SELECT p."id", l."id", 0
FROM "produtos" p
JOIN "estoque_locais" l ON l."empresaCodigo" = p."empresaCodigo" AND l."codigo" = 'DEPOSITO';

ALTER TABLE "estoque_locais" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "estoque_saldos" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE "estoque_locais", "estoque_saldos" FROM anon, authenticated';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_app') THEN
    EXECUTE 'GRANT ALL PRIVILEGES ON TABLE "estoque_locais", "estoque_saldos" TO erp_app';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO erp_app';
    EXECUTE 'CREATE POLICY erp_app_all ON "estoque_locais" FOR ALL TO erp_app USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY erp_app_all ON "estoque_saldos" FOR ALL TO erp_app USING (true) WITH CHECK (true)';
  END IF;
END $$;
