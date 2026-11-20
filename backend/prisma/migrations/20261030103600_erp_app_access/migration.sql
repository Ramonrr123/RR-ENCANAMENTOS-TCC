-- Papel erp_app existe no Supabase; no Postgres local de teste o app usa o próprio usuário da DATABASE_URL.
DO $$
DECLARE
  tabela text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_app') THEN
    RAISE NOTICE 'role erp_app ausente — pulando grants/policies locais';
    RETURN;
  END IF;

  IF to_regclass('public.crm_usuarios') IS NULL THEN
    RAISE NOTICE 'tabelas ainda não criadas — pulando policies erp_app';
    RETURN;
  END IF;

  EXECUTE 'GRANT USAGE, CREATE ON SCHEMA public TO erp_app';
  EXECUTE 'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO erp_app';
  EXECUTE 'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO erp_app';
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO erp_app';
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO erp_app';

  FOREACH tabela IN ARRAY ARRAY[
    'crm_usuarios',
    'crm_sessoes',
    'crm_usuario_preferencias_pdf',
    'crm_grupos_usuarios',
    'crm_telas',
    'crm_permissoes_telas',
    'crm_permissoes_telas_usuario',
    'crm_empresas',
    'crm_usuarios_empresas',
    'financeiro_titulos',
    'produtos',
    'estoque_movimentos'
  ]
  LOOP
    IF to_regclass(format('public.%I', tabela)) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format(
      'CREATE POLICY erp_app_all ON %I FOR ALL TO erp_app USING (true) WITH CHECK (true)',
      tabela
    );
  END LOOP;
END $$;
