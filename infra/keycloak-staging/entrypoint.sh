#!/bin/bash
set -euo pipefail

: "${MEFIT_STAGING_WEB_ORIGIN:?Set MEFIT_STAGING_WEB_ORIGIN to the exact HTTPS origin of the staging frontend}"

origin="${MEFIT_STAGING_WEB_ORIGIN%/}"
case "$origin" in
  https://*) ;;
  *) echo "MEFIT_STAGING_WEB_ORIGIN must use HTTPS." >&2; exit 1 ;;
esac
host="${origin#https://}"
case "$host" in
  ""|*/*|*\?*|*\#*|*@*|*:*) echo "MEFIT_STAGING_WEB_ORIGIN must be an HTTPS origin without a path, query, or credentials." >&2; exit 1 ;;
esac
case "$host" in
  *[!A-Za-z0-9.-]*) echo "MEFIT_STAGING_WEB_ORIGIN must contain a valid public hostname." >&2; exit 1 ;;
esac

sed "s|__MEFIT_STAGING_WEB_ORIGIN__|${host}|g" \
  /opt/keycloak/data/import/mefit-realm.json.template \
  > /opt/keycloak/data/import/mefit-realm.json

exec /opt/keycloak/bin/kc.sh "$@"
