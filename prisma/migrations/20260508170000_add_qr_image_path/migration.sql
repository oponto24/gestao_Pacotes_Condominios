-- Story 4.2: adiciona qr_image_path ao Pacote
-- qr_token e qr_consumido_em já existem desde initial_schema (20260506200212).
-- Apenas qr_image_path é novo.

ALTER TABLE "pacote" ADD COLUMN "qr_image_path" VARCHAR(500);
