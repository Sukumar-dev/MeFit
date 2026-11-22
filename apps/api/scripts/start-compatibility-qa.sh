#!/bin/sh
set -eu

node apps/api/scripts/check-compatibility-qa.mjs
export DATABASE_URL="$QA_DISPOSABLE_DATABASE_URL"
export API_PUBLIC_ORIGIN="$RENDER_EXTERNAL_URL"
npm --workspace apps/api run db:deploy
exec npm --workspace apps/api run start
