-- Migração aditiva: solicitações de titulares (área de privacidade).
-- Sem DROP.

CREATE TYPE "SolicitacaoTitularTipo" AS ENUM (
  'ACESSO',
  'CORRECAO',
  'ANONIMIZACAO',
  'ELIMINACAO',
  'INFORMACAO',
  'RETIRADA_CONSENTIMENTO',
  'OUTRO'
);

CREATE TYPE "SolicitacaoTitularCanal" AS ENUM (
  'WHATSAPP',
  'SITE',
  'PRESENCIAL',
  'OUTRO'
);

CREATE TYPE "SolicitacaoTitularStatus" AS ENUM (
  'ABERTA',
  'EM_ANALISE',
  'ATENDIDA',
  'RECUSADA'
);

CREATE TABLE "solicitacoes_titular" (
  "id" SERIAL PRIMARY KEY,
  "empresaCodigo" TEXT NOT NULL,
  "tipo" "SolicitacaoTitularTipo" NOT NULL,
  "solicitanteNome" TEXT NOT NULL,
  "solicitanteTelefone" TEXT,
  "chamadoNumero" INTEGER,
  "descricao" TEXT NOT NULL,
  "canal" "SolicitacaoTitularCanal" NOT NULL DEFAULT 'OUTRO',
  "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "prazoEm" TIMESTAMP(3) NOT NULL,
  "status" "SolicitacaoTitularStatus" NOT NULL DEFAULT 'ABERTA',
  "resposta" TEXT,
  "concluidoEm" TIMESTAMP(3),
  "responsavelId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "solicitacoes_titular_empresa_status_idx"
  ON "solicitacoes_titular" ("empresaCodigo", "status");

CREATE INDEX "solicitacoes_titular_empresa_prazo_idx"
  ON "solicitacoes_titular" ("empresaCodigo", "prazoEm");
