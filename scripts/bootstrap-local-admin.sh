#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYCLOAK_CONTAINER="${KEYCLOAK_CONTAINER:-infra-keycloak-1}"

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  echo "Copy .env.example to .env and configure local Keycloak credentials first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "$ROOT_DIR/.env"
set +a

if [[ -z "${MEFIT_ADMIN_EMAIL:-}" ]]; then
  echo "Set MEFIT_ADMIN_EMAIL to the local administrator's registered email in .env." >&2
  exit 1
fi

docker exec "$KEYCLOAK_CONTAINER" /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 --realm master \
  --user "$KEYCLOAK_ADMIN" --password "$KEYCLOAK_ADMIN_PASSWORD" >/dev/null

USER_ID="$(docker exec "$KEYCLOAK_CONTAINER" /opt/keycloak/bin/kcadm.sh get users -r mefit -q email="$MEFIT_ADMIN_EMAIL" --fields id | sed -n 's/.*"id" : "\([^"]*\)".*/\1/p')"
if [[ -z "$USER_ID" ]]; then
  echo "No MeFit user exists for MEFIT_ADMIN_EMAIL. Register the account first." >&2
  exit 1
fi

ROLE_ID="$(docker exec "$KEYCLOAK_CONTAINER" /opt/keycloak/bin/kcadm.sh get roles -r mefit -q name=ADMIN --fields id | sed -n 's/.*"id" : "\([^"]*\)".*/\1/p')"
if [[ -z "$ROLE_ID" ]]; then
  echo "The MeFit ADMIN realm role does not exist." >&2
  exit 1
fi

docker exec "$KEYCLOAK_CONTAINER" /opt/keycloak/bin/kcadm.sh add-roles -r mefit --uid "$USER_ID" --rid "$ROLE_ID"
echo "Local MeFit administrator role assigned to $MEFIT_ADMIN_EMAIL."
