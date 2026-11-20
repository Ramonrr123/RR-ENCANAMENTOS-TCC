-- Additive: origem do chamado público (resposta rápida WhatsApp / site / etc.)
ALTER TABLE "chamados" ADD COLUMN IF NOT EXISTS "origem" TEXT NOT NULL DEFAULT 'site';

CREATE INDEX IF NOT EXISTS "chamados_empresaCodigo_origem_idx" ON "chamados"("empresaCodigo", "origem");
