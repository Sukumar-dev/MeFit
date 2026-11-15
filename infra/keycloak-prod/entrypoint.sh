#!/usr/bin/env bash
set -euo pipefail

# Start Keycloak, then repair the existing realm in place. Realm imports are
# intentionally non-destructive on subsequent boots, so these OIDC scopes and
# claim mappers must be reconciled through the admin API.
/opt/keycloak/bin/kc.sh "$@" &
keycloak_pid=$!
finish() {
  kill -TERM "$keycloak_pid" 2>/dev/null || true
  wait "$keycloak_pid" || true
}
trap finish EXIT INT TERM

server='http://127.0.0.1:10000'
realm='mefit'
token=''
for attempt in $(seq 1 90); do
  token=$(curl --silent --show-error --fail \
    --data-urlencode 'client_id=admin-cli' \
    --data-urlencode "username=${KC_BOOTSTRAP_ADMIN_USERNAME}" \
    --data-urlencode "password=${KC_BOOTSTRAP_ADMIN_PASSWORD}" \
    --data-urlencode 'grant_type=password' \
    "${server}/realms/master/protocol/openid-connect/token" 2>/dev/null | jq -r '.access_token // empty' || true)
  if [[ -n "$token" ]]; then break; fi
  if ! kill -0 "$keycloak_pid" 2>/dev/null; then
    wait "$keycloak_pid"
    exit 1
  fi
  sleep 5
done
if [[ -z "$token" ]]; then
  echo 'Keycloak did not become ready for in-place realm configuration.' >&2
  exit 1
fi

api="${server}/admin/realms/${realm}"
auth_header="Authorization: Bearer ${token}"
ensure_scope() {
  local scope_name="$1"
  local scope_id
  scope_id=$(curl --silent --show-error --fail -H "$auth_header" \
    "${api}/client-scopes" | jq -r --arg name "$scope_name" '.[] | select(.name == $name) | .id' | head -n 1)
  if [[ -z "$scope_id" ]]; then
    curl --silent --show-error --fail -X POST -H "$auth_header" \
      -H 'Content-Type: application/json' \
      -d "{\"name\":\"${scope_name}\",\"protocol\":\"openid-connect\",\"attributes\":{\"include.in.token.scope\":\"true\",\"display.on.consent.screen\":\"false\"}}" \
      "${api}/client-scopes" >/dev/null
    scope_id=$(curl --silent --show-error --fail -H "$auth_header" \
      "${api}/client-scopes" | jq -r --arg name "$scope_name" '.[] | select(.name == $name) | .id' | head -n 1)
  fi
  printf '%s' "$scope_id"
}

ensure_mapper() {
  local scope_id="$1" mapper_name="$2" attribute="$3" claim="$4"
  if ! curl --silent --show-error --fail -H "$auth_header" \
      "${api}/client-scopes/${scope_id}/protocol-mappers/models" \
      | jq -e --arg name "$mapper_name" 'any(.[]; .name == $name)' >/dev/null; then
    curl --silent --show-error --fail -X POST -H "$auth_header" \
      -H 'Content-Type: application/json' \
      -d "{\"name\":\"${mapper_name}\",\"protocol\":\"openid-connect\",\"protocolMapper\":\"oidc-usermodel-property-mapper\",\"consentRequired\":false,\"config\":{\"user.attribute\":\"${attribute}\",\"claim.name\":\"${claim}\",\"jsonType.label\":\"String\",\"id.token.claim\":\"true\",\"access.token.claim\":\"true\",\"userinfo.token.claim\":\"true\"}}" \
      "${api}/client-scopes/${scope_id}/protocol-mappers/models" >/dev/null
  fi
}

profile_id=$(ensure_scope profile)
email_id=$(ensure_scope email)
ensure_mapper "$profile_id" 'mefit-first-name' firstName given_name
ensure_mapper "$profile_id" 'mefit-last-name' lastName family_name
ensure_mapper "$email_id" 'mefit-email' email email

client_id=$(curl --silent --show-error --fail -H "$auth_header" \
  "${api}/clients?clientId=mefit-web" | jq -r '.[0].id // empty')
if [[ -z "$client_id" ]]; then
  echo 'The mefit-web client is missing from the MeFit realm.' >&2
  exit 1
fi
for scope_id in "$profile_id" "$email_id"; do
  curl --silent --show-error --fail -X PUT -H "$auth_header" \
    "${api}/clients/${client_id}/default-client-scopes/${scope_id}" >/dev/null
done

echo 'MeFit OIDC profile and email scopes are configured.'
wait "$keycloak_pid"
