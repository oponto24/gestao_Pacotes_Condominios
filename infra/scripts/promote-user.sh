#!/usr/bin/env bash
# =====================================================================
# promote-user.sh — Cria condomínio fixture e promove user a admin (DEV ONLY)
# =====================================================================
# Uso:
#   ./infra/scripts/promote-user.sh <email>
#
# Idempotente: criar/atualizar fixture sem efeito colateral em re-runs.
# =====================================================================
set -euo pipefail

EMAIL="${1:-}"
if [[ -z "$EMAIL" ]]; then
  echo "❌ Uso: $0 <email>"
  echo "   Exemplo: $0 oponto24@gmail.com"
  exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/infra/docker/docker-compose.yml"

if ! docker compose -f "$COMPOSE_FILE" ps postgres --format '{{.Status}}' | grep -q 'Up'; then
  echo "❌ Container postgres não está rodando."
  exit 1
fi

CONDO_NAME='Edifício Teste 1.6'

echo "→ Criando/garantindo condomínio fixture: $CONDO_NAME"
CONDO_ID=$(docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U app -d gestao_pacotes -tAc "
    INSERT INTO condominio (nome, endereco, cep, cidade, estado, contato_nome, contato_telefone, updated_at)
    VALUES ('$CONDO_NAME', 'Rua Teste 1.6', '01000-000', 'São Paulo', 'SP', 'Admin Teste', '11999999999', now())
    ON CONFLICT (cnpj) DO NOTHING;
    SELECT id FROM condominio WHERE nome = '$CONDO_NAME' LIMIT 1;
  " | tail -1 | tr -d '[:space:]')

if [[ -z "$CONDO_ID" ]]; then
  echo "❌ Falha ao criar/encontrar condomínio fixture"
  exit 1
fi
echo "  Condomínio fixture id: $CONDO_ID"

echo "→ Promovendo $EMAIL a admin do condomínio fixture..."
ROWS=$(docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U app -d gestao_pacotes -tAc "
    UPDATE \"user\"
    SET condominio_id = '$CONDO_ID'::uuid, role = 'admin', updated_at = now()
    WHERE email = '$EMAIL'
    RETURNING email;
  " | tail -1 | tr -d '[:space:]')

if [[ -z "$ROWS" ]]; then
  echo "❌ User '$EMAIL' não encontrado. Cadastre-se primeiro via Clerk em http://localhost:3000"
  exit 1
fi

echo "✅ $EMAIL agora é admin do condomínio '$CONDO_NAME'"
echo ""
echo "Validação:"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U app -d gestao_pacotes -c "
    SELECT u.email, u.role, c.nome AS condominio
    FROM \"user\" u LEFT JOIN condominio c ON u.condominio_id = c.id
    WHERE u.email = '$EMAIL';
  "

echo ""
echo "Próximo passo: abra http://localhost:3000/api/me no browser (logado como $EMAIL)"
