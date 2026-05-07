#!/usr/bin/env bash
# =====================================================================
# Deploy script — gestao-pacotes na VPS (story 3.12)
# =====================================================================
# Rodar dentro da VPS, como user deploy:
#   ./infra/scripts/deploy-vps.sh           # update normal
#   ./infra/scripts/deploy-vps.sh first-deploy   # primeira vez (inclui SSL)
# =====================================================================

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/gestao-pacotes}"
COMPOSE_FILE="$DEPLOY_DIR/infra/docker/docker-compose.prod.yml"
ENV_FILE="$DEPLOY_DIR/.env.prod"
COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"

cd "$DEPLOY_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ Falta $ENV_FILE — copie de .env.prod.example e preencha"
  exit 1
fi

# Carrega DOMAIN da env file
DOMAIN="$(grep -E '^DOMAIN=' "$ENV_FILE" | cut -d= -f2-)"
if [[ -z "$DOMAIN" || "$DOMAIN" == "app.exemplo.com.br" ]]; then
  echo "❌ DOMAIN inválido em $ENV_FILE"
  exit 1
fi

echo "📦 Pull do código..."
git pull origin main

echo "🔨 Build das imagens..."
$COMPOSE build --pull

if [[ "${1:-}" == "first-deploy" ]]; then
  echo ""
  echo "🚀 PRIMEIRO DEPLOY — sequência especial:"
  echo ""

  echo "1️⃣  Subindo postgres + redis primeiro..."
  $COMPOSE up -d postgres redis
  sleep 10

  echo "2️⃣  Rodando prisma migrate deploy (via container worker — tem CLI nos node_modules)..."
  $COMPOSE run --rm --entrypoint "" worker sh -c 'cd /app && npx prisma migrate deploy'

  echo "3️⃣  Subindo Nginx em modo HTTP-only (pra Let's Encrypt validar)..."
  # Cria certificado fake temporário pra Nginx subir, depois sobrescreve com real
  mkdir -p ./certbot-tmp/conf/live/$DOMAIN
  $COMPOSE up -d app worker

  echo "4️⃣  Iniciando Nginx (HTTP)..."
  $COMPOSE up -d nginx
  sleep 5

  echo "5️⃣  Solicitando certificado Let's Encrypt..."
  $COMPOSE run --rm --entrypoint "" certbot \
    certbot certonly --webroot -w /var/www/certbot \
    -d "$DOMAIN" \
    --email admin@"$DOMAIN" \
    --agree-tos --no-eff-email --non-interactive

  echo "6️⃣  Reload Nginx com SSL..."
  $COMPOSE exec nginx nginx -s reload

  echo "7️⃣  Subindo certbot pra renovação automática..."
  $COMPOSE up -d certbot

  echo ""
  echo "✅ FIRST DEPLOY OK!"
  echo "Acesse: https://$DOMAIN"

else
  echo "🔄 Deploy normal (update)..."
  $COMPOSE up -d --build

  echo "🗃️  Migrações pendentes..."
  $COMPOSE exec app sh -c 'cd /app && npx prisma migrate deploy' || true

  echo ""
  echo "✅ DEPLOY OK!"
fi

echo ""
$COMPOSE ps
