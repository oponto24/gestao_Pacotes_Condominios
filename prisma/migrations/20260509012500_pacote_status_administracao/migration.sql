-- Story 10.2: adiciona status aguardando_organizacao + em_administracao no enum PacoteStatus
-- Postgres ALTER TYPE ADD VALUE precisa rodar fora de transacao — Prisma trata automaticamente.

ALTER TYPE "PacoteStatus" ADD VALUE 'aguardando_organizacao';
ALTER TYPE "PacoteStatus" ADD VALUE 'em_administracao';
