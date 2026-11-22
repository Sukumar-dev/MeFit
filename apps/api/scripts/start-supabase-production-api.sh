#!/bin/sh
set -eu

node apps/api/scripts/check-production-database.mjs
exec npm --workspace apps/api run start
