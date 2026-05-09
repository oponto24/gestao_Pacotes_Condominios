-- Decisão produto 2026-05-09: lembretes 24h pra pacote não retirado.
-- Worker cron envia template QR a cada 24h.
-- Se morador responde no WhatsApp, pausa e admin reagenda.

ALTER TABLE "pacote"
  ADD COLUMN "ultimo_lembrete_em" TIMESTAMP(3),
  ADD COLUMN "proximo_lembrete_em" TIMESTAMP(3),
  ADD COLUMN "lembretes_pausados" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lembretes_pausados_em" TIMESTAMP(3),
  ADD COLUMN "lembretes_pausados_motivo" VARCHAR(500);

-- Indice pra cron query rapida (busca pacotes com proximo_lembrete_em <= now)
CREATE INDEX "pacote_proximo_lembrete_em_idx"
  ON "pacote"("proximo_lembrete_em")
  WHERE "lembretes_pausados" = false AND "status" = 'aguardando_retirada';
