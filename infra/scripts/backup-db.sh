#!/usr/bin/env bash
# =====================================================================
# Backup pg_dump diário — gestao-pacotes
# =====================================================================
# Roda no host da VPS (não dentro de container). Cron sugerido:
#   0 3 * * * /opt/gestao-pacotes/infra/scripts/backup-db.sh >> /var/log/gestao-pacotes-backup.log 2>&1
#
# Retenção:
#   - Diário: 7 últimos
#   - Semanal: 4 últimos (capturados aos domingos)
#   - Mensal: 3 últimos (capturado dia 1)
#
# Storage offsite (S3/R2) é TODO — por ora local na VPS.
# =====================================================================

set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/gestao-pacotes}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-docker-postgres-1}"
POSTGRES_USER="${POSTGRES_USER:-app}"
POSTGRES_DB="${POSTGRES_DB:-gestao_pacotes}"

TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
DAY_OF_WEEK="$(date -u +%u)"  # 1=mon … 7=sun
DAY_OF_MONTH="$(date -u +%d)"

DAILY_DIR="$BACKUP_ROOT/daily"
WEEKLY_DIR="$BACKUP_ROOT/weekly"
MONTHLY_DIR="$BACKUP_ROOT/monthly"

mkdir -p "$DAILY_DIR" "$WEEKLY_DIR" "$MONTHLY_DIR"

DAILY_FILE="$DAILY_DIR/backup_${TIMESTAMP}.sql.gz"

echo "[$(date -u +%FT%TZ)] Iniciando backup → $DAILY_FILE"

# pg_dump dentro do container postgres → pipe direto pra gzip no host
# --no-owner / --no-privileges: portabilidade (restore em qualquer cluster)
# --clean / --if-exists: gera DROP IF EXISTS antes de CREATE (restore limpo)
docker exec -i "$POSTGRES_CONTAINER" \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    --no-owner --no-privileges --clean --if-exists \
  | gzip -9 > "$DAILY_FILE"

SIZE="$(stat -c %s "$DAILY_FILE" 2>/dev/null || stat -f %z "$DAILY_FILE")"
echo "[$(date -u +%FT%TZ)] Backup OK ($SIZE bytes)"

# Cópia semanal aos domingos
if [[ "$DAY_OF_WEEK" == "7" ]]; then
  WEEKLY_FILE="$WEEKLY_DIR/backup_${TIMESTAMP}.sql.gz"
  cp "$DAILY_FILE" "$WEEKLY_FILE"
  echo "[$(date -u +%FT%TZ)] Cópia semanal → $WEEKLY_FILE"
fi

# Cópia mensal dia 01
if [[ "$DAY_OF_MONTH" == "01" ]]; then
  MONTHLY_FILE="$MONTHLY_DIR/backup_${TIMESTAMP}.sql.gz"
  cp "$DAILY_FILE" "$MONTHLY_FILE"
  echo "[$(date -u +%FT%TZ)] Cópia mensal → $MONTHLY_FILE"
fi

# Retenção: remove o que excede limite (mantém os mais recentes)
prune_dir() {
  local dir="$1"
  local keep="$2"
  ls -1t "$dir"/backup_*.sql.gz 2>/dev/null \
    | tail -n +"$((keep + 1))" \
    | xargs -r rm -v
}

echo "[$(date -u +%FT%TZ)] Aplicando retenção…"
prune_dir "$DAILY_DIR" 7
prune_dir "$WEEKLY_DIR" 4
prune_dir "$MONTHLY_DIR" 3

echo "[$(date -u +%FT%TZ)] Backup concluído"
