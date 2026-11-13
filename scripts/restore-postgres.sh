#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

BACKUP_FILE="${1:?Usage: restore-postgres.sh /path/to/mefit-YYYYMMDDTHHMMSSZ.dump.enc}"
: "${BACKUP_ENCRYPTION_KEY:?Set BACKUP_ENCRYPTION_KEY in the runtime environment}"
: "${RESTORE_DATABASE:?Set RESTORE_DATABASE to a non-production target database}"
if [[ "${RESTORE_CONFIRM:-}" != "RESTORE_TO_NON_PRODUCTION" ]]; then
  echo "Set RESTORE_CONFIRM=RESTORE_TO_NON_PRODUCTION to acknowledge that the target will be overwritten." >&2
  exit 2
fi
if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found." >&2
  exit 2
fi

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-infra-postgres-1}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-local-mefit-password}"
if [[ -f "$BACKUP_FILE.sha256" ]]; then shasum -a 256 -c "$BACKUP_FILE.sha256"; fi
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_ENCRYPTION_KEY -in "$BACKUP_FILE" \
  | docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" "$POSTGRES_CONTAINER" \
      pg_restore --clean --if-exists --no-owner --username=mefit --dbname="$RESTORE_DATABASE"
echo "Restore completed into database: $RESTORE_DATABASE"
