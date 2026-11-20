ALTER TABLE "ordens_servico" ADD COLUMN IF NOT EXISTS "preventivaStatus" TEXT;

UPDATE "ordens_servico" SET "preventivaStatus" = 'a_contatar' WHERE "preventivaStatus" IS NULL;

ALTER TABLE "ordens_servico" ALTER COLUMN "preventivaStatus" SET DEFAULT 'a_contatar';
