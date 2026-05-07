#!/usr/bin/env bash
# =====================================================================
# apply-rls.sh — Aplica RLS policies da Dara + seta senha do webhook_worker
# =====================================================================
# Idempotente: pode rodar várias vezes sem efeito colateral.
# Prisma NÃO aplica `rls_policies.sql` automaticamente — esta é a forma
# canônica de aplicar a camada 2 do multi-tenancy híbrido.
# =====================================================================
set -euo pipefail

# IMPORTANTE: não rodar `set -x` — vazaria a senha em logs/CI

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/infra/docker/docker-compose.yml"
RLS_FILE="$PROJECT_ROOT/prisma/migrations/20260506200212_initial_schema/rls_policies.sql"

# Carrega .env.local (gitignored) se existir
if [[ -f "$PROJECT_ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.env.local"
  set +a
fi

if [[ -z "${WEBHOOK_WORKER_DB_PASSWORD:-}" ]]; then
  echo "❌ WEBHOOK_WORKER_DB_PASSWORD não está setada. Gere com: openssl rand -hex 32"
  exit 1
fi

if [[ -z "${APP_RUNTIME_DB_PASSWORD:-}" ]]; then
  echo "❌ APP_RUNTIME_DB_PASSWORD não está setada. Gere com: openssl rand -hex 32"
  exit 1
fi

if [[ ! -f "$RLS_FILE" ]]; then
  echo "❌ Arquivo RLS não encontrado: $RLS_FILE"
  exit 1
fi

# Verifica se o container postgres está rodando
if ! docker compose -f "$COMPOSE_FILE" ps postgres --format '{{.Status}}' | grep -q 'Up'; then
  echo "❌ Container postgres não está rodando."
  echo "   Rode antes: docker compose -f infra/docker/docker-compose.yml --env-file .env.local up -d postgres"
  exit 1
fi

echo "→ Aplicando RLS policies + role webhook_worker..."
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U app -d gestao_pacotes -v ON_ERROR_STOP=1 < "$RLS_FILE"

echo "→ Setando senhas das roles (não logadas por segurança)..."
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U app -d gestao_pacotes -v ON_ERROR_STOP=1 -c \
  "ALTER ROLE webhook_worker WITH PASSWORD '${WEBHOOK_WORKER_DB_PASSWORD}'; ALTER ROLE app_runtime WITH PASSWORD '${APP_RUNTIME_DB_PASSWORD}';" \
  > /dev/null 2>&1

echo "✅ RLS aplicado com sucesso."
echo ""
echo "Validação rápida:"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U app -d gestao_pacotes -tAc \
  "SELECT count(*) AS rls_tables FROM pg_tables WHERE rowsecurity=true AND schemaname='public';" \
  | xargs -I {} echo "  Tabelas com RLS: {} (esperado: 8)"

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U app -d gestao_pacotes -tAc \
  "SELECT rolname FROM pg_roles WHERE rolname='webhook_worker' AND rolbypassrls=true AND rolcanlogin=true;" \
  | xargs -I {} echo "  Role webhook_worker (BYPASSRLS+LOGIN): {}"

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U app -d gestao_pacotes -tAc \
  "SELECT rolname FROM pg_roles WHERE rolname='app_runtime' AND rolsuper=false AND rolbypassrls=false AND rolcanlogin=true;" \
  | xargs -I {} echo "  Role app_runtime (NOSUPERUSER+NOBYPASSRLS+LOGIN): {}"
