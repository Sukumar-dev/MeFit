#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYCLOAK_CONTAINER="${KEYCLOAK_CONTAINER:-infra-keycloak-1}"

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  echo "Copy .env.example to .env and set local Keycloak bootstrap credentials first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "$ROOT_DIR/.env"
set +a

docker exec "$KEYCLOAK_CONTAINER" mkdir -p /tmp/mefit-keycloak-config
docker cp "$ROOT_DIR/infra/keycloak-config/." "$KEYCLOAK_CONTAINER:/tmp/mefit-keycloak-config/"
docker exec "$KEYCLOAK_CONTAINER" /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 --realm master \
  --user "$KEYCLOAK_ADMIN" --password "$KEYCLOAK_ADMIN_PASSWORD" >/dev/null

API_CLIENT_ID="$(docker exec "$KEYCLOAK_CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r mefit -q clientId=mefit-api --fields id | sed -n 's/.*"id" : "\([^"]*\)".*/\1/p')"
if [[ -z "$API_CLIENT_ID" ]]; then
  docker exec "$KEYCLOAK_CONTAINER" /opt/keycloak/bin/kcadm.sh create clients -r mefit -f /tmp/mefit-keycloak-config/mefit-api-client.json >/dev/null
fi

WEB_CLIENT_ID="$(docker exec "$KEYCLOAK_CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r mefit -q clientId=mefit-web --fields id | sed -n 's/.*"id" : "\([^"]*\)".*/\1/p')"
if [[ -z "$WEB_CLIENT_ID" ]]; then
  echo "The mefit-web client is missing from the mefit realm." >&2
  exit 1
fi

PROFILE_SCOPE_ID=""
for scope_name in profile email; do
  scope_id="$(docker exec "$KEYCLOAK_CONTAINER" /opt/keycloak/bin/kcadm.sh get client-scopes -r mefit -q name="$scope_name" --fields id | sed -n 's/.*"id" : "\([^"]*\)".*/\1/p')"
  if [[ -z "$scope_id" ]]; then
    echo "The standard $scope_name client scope is missing from the mefit realm." >&2
    exit 1
  fi
  attached_scopes="$(docker exec "$KEYCLOAK_CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$WEB_CLIENT_ID/default-client-scopes" -r mefit --fields name)"
  if ! grep -Fq "\"name\" : \"$scope_name\"" <<<"$attached_scopes"; then
    docker exec "$KEYCLOAK_CONTAINER" /opt/keycloak/bin/kcadm.sh create "clients/$WEB_CLIENT_ID/default-client-scopes/$scope_id" -r mefit >/dev/null
  fi
  if [[ "$scope_name" == "profile" ]]; then PROFILE_SCOPE_ID="$scope_id"; fi
done

for mapper_file in first-name-mapper.json last-name-mapper.json; do
  case "$mapper_file" in
    first-name-mapper.json) mapper_name="mefit-first-name" ;;
    last-name-mapper.json) mapper_name="mefit-last-name" ;;
  esac
  existing="$(docker exec "$KEYCLOAK_CONTAINER" /opt/keycloak/bin/kcadm.sh get "client-scopes/$PROFILE_SCOPE_ID/protocol-mappers/models" -r mefit --fields name | grep -F "$mapper_name" || true)"
  if [[ -z "$existing" ]]; then
    docker exec "$KEYCLOAK_CONTAINER" /opt/keycloak/bin/kcadm.sh create "client-scopes/$PROFILE_SCOPE_ID/protocol-mappers/models" -r mefit -f "/tmp/mefit-keycloak-config/$mapper_file" >/dev/null
  fi
done

for mapper_file in realm-roles-mapper.json api-audience-mapper.json email-mapper.json username-mapper.json subject-mapper.json; do
  case "$mapper_file" in
    realm-roles-mapper.json) mapper_name="mefit-realm-roles" ;;
    api-audience-mapper.json) mapper_name="mefit-api-audience" ;;
    email-mapper.json) mapper_name="mefit-email" ;;
    username-mapper.json) mapper_name="mefit-username" ;;
    subject-mapper.json) mapper_name="mefit-subject" ;;
  esac
  existing="$(docker exec "$KEYCLOAK_CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$WEB_CLIENT_ID/protocol-mappers/models" -r mefit --fields name | grep -F "$mapper_name" || true)"
  if [[ -z "$existing" ]]; then
    docker exec "$KEYCLOAK_CONTAINER" /opt/keycloak/bin/kcadm.sh create "clients/$WEB_CLIENT_ID/protocol-mappers/models" -r mefit -f "/tmp/mefit-keycloak-config/$mapper_file" >/dev/null
  fi
done

echo "Local Keycloak MeFit API client and token mappers are configured."
