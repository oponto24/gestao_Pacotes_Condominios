#!/usr/bin/env bash
# =====================================================================
# Restore de backup pg_dump — gestao-pacotes
# =====================================================================
# Uso:
#   ./infra/scripts/restore-db.sh /var/backups/gestao-pacotes/daily/backup_20260510_030000.sql.gz
#
# CUIDADO: o dump foi criado com --clean --if-exists. Restore APAGA todos
# os dados atuais antes de recriar. Confirme antes de rodar em prod.
# =====================================================================

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Uso: $0 <caminho-do-backup.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-docker-postgres-1}"
POSTGRES_USER="${POSTGRES_USER:-app}"
POSTGRES_DB="${POSTGRES_DB:-gestao_pacotes}"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "❌ Backup não encontrado: $BACKUP_FILE"
  exit 1
fi

echo "⚠️  ATENÇÃO: Vai restaurar $BACKUP_FILE."
echo "    Apaga TODOS os dados atuais do banco $POSTGRES_DB."
read -p "    Continuar? [yes/NO]: " confirm
if [[ "$confirm" != "yes" ]]; then
  echo "Abortado."
  exit 1
fi

echo "Restaurando…"
gunzip -c "$BACKUP_FILE" \
  | docker exec -i "$POSTGRES_CONTAINER" \
      psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "✅ Restore concluído. Verifique a aplicação."
