#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

: "${BACKUP_ENCRYPTION_KEY:?Set BACKUP_ENCRYPTION_KEY in the runtime environment}"
BACKUP_DIR="${BACKUP_DIRECTORY:-$ROOT_DIR/backups}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-infra-postgres-1}"
BACKUP_FILE="$BACKUP_DIR/mefit-$(date -u +%Y%m%dT%H%M%SZ).dump.enc"
mkdir -p "$BACKUP_DIR"

POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-local-mefit-password}"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$POSTGRES_CONTAINER" \
  pg_dump --format=custom --no-owner --username=mefit --dbname=mefit \
  | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 -pass env:BACKUP_ENCRYPTION_KEY -out "$BACKUP_FILE"

shasum -a 256 "$BACKUP_FILE" > "$BACKUP_FILE.sha256"
find "$BACKUP_DIR" -type f -name 'mefit-*.dump.enc*' -mtime +7 -delete
echo "Encrypted backup written: $BACKUP_FILE"
