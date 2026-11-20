CREATE TABLE "chamado_fotos" (
    "id" SERIAL NOT NULL,
    "chamadoId" INTEGER NOT NULL,
    "situacao" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chamado_fotos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chamado_fotos_chamadoId_idx" ON "chamado_fotos"("chamadoId");

ALTER TABLE "chamado_fotos" ADD CONSTRAINT "chamado_fotos_chamadoId_fkey" FOREIGN KEY ("chamadoId") REFERENCES "chamados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
