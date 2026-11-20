-- Controles de consulta, aceite de privacidade e limite de abertura pública.
-- Não apaga linhas nem colunas.

ALTER TABLE "chamados" ADD COLUMN IF NOT EXISTS "tentativasErradas" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "chamados" ADD COLUMN IF NOT EXISTS "bloqueadoAte" TIMESTAMP(3);
ALTER TABLE "chamados" ADD COLUMN IF NOT EXISTS "aceiteEm" TIMESTAMP(3);
ALTER TABLE "chamados" ADD COLUMN IF NOT EXISTS "avisoVersao" TEXT;
ALTER TABLE "chamados" ADD COLUMN IF NOT EXISTS "ipOrigem" TEXT;

CREATE INDEX IF NOT EXISTS "chamados_ipOrigem_createdAt_idx" ON "chamados"("ipOrigem", "createdAt");

CREATE TABLE IF NOT EXISTS "acesso_bloqueios" (
    "id" SERIAL NOT NULL,
    "chave" TEXT NOT NULL,
    "tentativasErradas" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoAte" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acesso_bloqueios_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "acesso_bloqueios_chave_key" ON "acesso_bloqueios"("chave");
