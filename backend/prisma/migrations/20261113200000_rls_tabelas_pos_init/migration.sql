-- RLS aditiva para tabelas criadas após a versão inicial sem política erp_app_all.
-- Sem DROP. Idempotente via IF NOT EXISTS / DO blocks.

ALTER TABLE IF EXISTS "solicitacoes_titular" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "chamado_fotos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "acesso_bloqueios" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.solicitacoes_titular') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'solicitacoes_titular' AND policyname = 'erp_app_all'
     ) THEN
    EXECUTE 'CREATE POLICY erp_app_all ON "solicitacoes_titular" FOR ALL TO erp_app USING (true) WITH CHECK (true)';
  END IF;

  IF to_regclass('public.chamado_fotos') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'chamado_fotos' AND policyname = 'erp_app_all'
     ) THEN
    EXECUTE 'CREATE POLICY erp_app_all ON "chamado_fotos" FOR ALL TO erp_app USING (true) WITH CHECK (true)';
  END IF;

  IF to_regclass('public.acesso_bloqueios') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'acesso_bloqueios' AND policyname = 'erp_app_all'
     ) THEN
    EXECUTE 'CREATE POLICY erp_app_all ON "acesso_bloqueios" FOR ALL TO erp_app USING (true) WITH CHECK (true)';
  END IF;
END $$;
