#!/bin/sh
set -eu

node scripts/check-production-database.mjs
exec npm --workspace apps/api run start
