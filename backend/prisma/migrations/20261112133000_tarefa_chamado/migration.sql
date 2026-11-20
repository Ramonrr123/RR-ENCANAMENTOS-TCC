ALTER TABLE "tarefas" ADD COLUMN "chamadoId" INTEGER;
ALTER TABLE "tarefas" ADD COLUMN "canal" TEXT;
ALTER TABLE "tarefas" ADD COLUMN "horario" TEXT;

CREATE INDEX "tarefas_chamadoId_idx" ON "tarefas"("chamadoId");

ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_chamadoId_fkey" FOREIGN KEY ("chamadoId") REFERENCES "chamados"("id") ON DELETE SET NULL ON UPDATE CASCADE;
