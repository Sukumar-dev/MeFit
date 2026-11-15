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
admin_ready=false
for attempt in $(seq 1 90); do
  if /opt/keycloak/bin/kcadm.sh config credentials \
      --server "$server" --realm master \
      --user "$KC_BOOTSTRAP_ADMIN_USERNAME" \
      --password "$KC_BOOTSTRAP_ADMIN_PASSWORD" >/dev/null 2>&1; then
    admin_ready=true
    break
  fi
  if ! kill -0 "$keycloak_pid" 2>/dev/null; then
    wait "$keycloak_pid"
    exit 1
  fi
  sleep 5
done
if [[ "$admin_ready" != true ]]; then
  echo 'Keycloak did not become ready for in-place realm configuration.' >&2
  exit 1
fi

named_resource_id() {
  local json="$1" field="$2" expected="$3"
  printf '%s\n' "$json" | awk -v field="$field" -v expected="$expected" '
    $1 == "\"id\"" { id=$3; gsub(/[\",]/, "", id) }
    $1 == "\"" field "\"" { value=$3; gsub(/[\",]/, "", value); if (value == expected) { print id; exit } }
  '
}

ensure_scope() {
  local scope_name="$1"
  local scopes scope_id
  scopes=$(/opt/keycloak/bin/kcadm.sh get client-scopes -r "$realm")
  scope_id=$(named_resource_id "$scopes" name "$scope_name")
  if [[ -z "$scope_id" ]]; then
    /opt/keycloak/bin/kcadm.sh create client-scopes -r "$realm" \
      -s "name=${scope_name}" -s protocol=openid-connect >/dev/null
    scopes=$(/opt/keycloak/bin/kcadm.sh get client-scopes -r "$realm")
    scope_id=$(named_resource_id "$scopes" name "$scope_name")
  fi
  printf '%s' "$scope_id"
}

ensure_mapper() {
  local scope_id="$1" mapper_name="$2" attribute="$3" claim="$4" mappers mapper_id
  mappers=$(/opt/keycloak/bin/kcadm.sh get "client-scopes/${scope_id}/protocol-mappers/models" -r "$realm")
  mapper_id=$(named_resource_id "$mappers" name "$mapper_name")
  if [[ -z "$mapper_id" ]]; then
    /opt/keycloak/bin/kcadm.sh create "client-scopes/${scope_id}/protocol-mappers/models" -r "$realm" \
      -s "name=${mapper_name}" \
      -s protocol=openid-connect \
      -s protocolMapper=oidc-usermodel-property-mapper \
      -s consentRequired=false \
      -s "config.user.attribute=${attribute}" \
      -s "config.claim.name=${claim}" \
      -s config.jsonType.label=String \
      -s config.id.token.claim=true \
      -s config.access.token.claim=true \
      -s config.userinfo.token.claim=true >/dev/null
  fi
}

profile_id=$(ensure_scope profile)
email_id=$(ensure_scope email)
ensure_mapper "$profile_id" 'mefit-first-name' firstName given_name
ensure_mapper "$profile_id" 'mefit-last-name' lastName family_name
ensure_mapper "$email_id" 'mefit-email' email email

clients=$(/opt/keycloak/bin/kcadm.sh get clients -r "$realm" -q clientId=mefit-web)
client_id=$(named_resource_id "$clients" clientId mefit-web)
if [[ -z "$client_id" ]]; then
  echo 'The mefit-web client is missing from the MeFit realm.' >&2
  exit 1
fi
for scope_id in "$profile_id" "$email_id"; do
  /opt/keycloak/bin/kcadm.sh update "clients/${client_id}/default-client-scopes/${scope_id}" \
    -r "$realm" -s "id=${scope_id}" >/dev/null
done

echo 'MeFit OIDC profile and email scopes are configured.'
wait "$keycloak_pid"
