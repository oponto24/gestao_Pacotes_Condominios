-- Story 10.1: refactor UserRole enum + adicionar Condominio.tem_administracao
--
-- 1. Adiciona flag tem_administracao no condomínio (default false preserva fluxo atual)
-- 2. Renomeia enum value 'admin' para 'admin_master' (Postgres 13+ suporta RENAME VALUE)
-- 3. Adiciona novo valor 'admin_funcionario' ao enum
--
-- Postgres 16 confirmado em prod (infra/docker/docker-compose.prod.yml).
-- Forward-only — Prisma não suporta rollback automático de enum changes.
-- Backup do banco recomendado antes do prisma migrate deploy em prod.

ALTER TABLE "condominio" ADD COLUMN "tem_administracao" BOOLEAN NOT NULL DEFAULT false;

ALTER TYPE "UserRole" RENAME VALUE 'admin' TO 'admin_master';

ALTER TYPE "UserRole" ADD VALUE 'admin_funcionario';
