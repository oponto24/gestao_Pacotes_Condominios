-- Story 11.1 (Epic 11): cria entidade Bloco + FK em Unidade
-- Mantém unidade.bloco string como legacy pra rollback seguro.

-- 1. Cria tabela bloco
CREATE TABLE "bloco" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "condominio_id" UUID NOT NULL,
  "nome" VARCHAR(50) NOT NULL,
  "descricao" VARCHAR(500),
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bloco_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bloco_condominio_id_nome_key" ON "bloco"("condominio_id", "nome");
CREATE INDEX "bloco_condominio_id_idx" ON "bloco"("condominio_id");

ALTER TABLE "bloco" ADD CONSTRAINT "bloco_condominio_id_fkey"
  FOREIGN KEY ("condominio_id") REFERENCES "condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Adiciona bloco_id em unidade (FK opcional)
ALTER TABLE "unidade" ADD COLUMN "bloco_id" UUID;

CREATE INDEX "unidade_bloco_id_idx" ON "unidade"("bloco_id");

ALTER TABLE "unidade" ADD CONSTRAINT "unidade_bloco_id_fkey"
  FOREIGN KEY ("bloco_id") REFERENCES "bloco"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Backfill: cria bloco pra cada (condominio_id, bloco) distinto NÃO-NULL
INSERT INTO "bloco" ("id", "condominio_id", "nome", "ordem", "ativo", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  u."condominio_id",
  u."bloco",
  ROW_NUMBER() OVER (PARTITION BY u."condominio_id" ORDER BY u."bloco")::int - 1,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "condominio_id", "bloco"
  FROM "unidade"
  WHERE "bloco" IS NOT NULL AND "bloco" <> ''
) u
ON CONFLICT ("condominio_id", "nome") DO NOTHING;

-- 4. Vincula unidade.bloco_id pra cada match (condominio_id, nome)
UPDATE "unidade" u
SET "bloco_id" = b."id"
FROM "bloco" b
WHERE b."condominio_id" = u."condominio_id"
  AND b."nome" = u."bloco"
  AND u."bloco_id" IS NULL;
