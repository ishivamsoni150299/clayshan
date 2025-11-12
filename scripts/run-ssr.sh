#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   SILVERBENE_ACCESS_TOKEN=YOUR_TOKEN ./scripts/run-ssr.sh
#   or create a file ./silverbene.token containing the token
# Optional envs: PORT=4000 EXCHANGE_RATE_USD_INR=83 SUPPLIER_CACHE_TTL_MS=300000 PRICE_MARKUP=15 NO_DB_CATALOG=1

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

TOKEN="${SILVERBENE_ACCESS_TOKEN:-}"
if [[ -z "$TOKEN" && -f "$ROOT_DIR/silverbene.token" ]]; then
  TOKEN="$(tr -d '\r' < "$ROOT_DIR/silverbene.token" | tr -d '\n')"
fi
if [[ -z "$TOKEN" ]]; then
  echo "SILVERBENE token not provided. Export SILVERBENE_ACCESS_TOKEN or create silverbene.token" >&2
  exit 1
fi

export SILVERBENE_ACCESS_TOKEN="$TOKEN"
export NO_DB_CATALOG="${NO_DB_CATALOG:-1}"
export PORT="${PORT:-4000}"
export EXCHANGE_RATE_USD_INR="${EXCHANGE_RATE_USD_INR:-83}"
export SUPPLIER_CACHE_TTL_MS="${SUPPLIER_CACHE_TTL_MS:-300000}"
if [[ -n "${PRICE_MARKUP:-}" ]]; then export PRICE_MARKUP; fi

echo "Building app (SSR)..."
npx ng build

SERVER="dist/clayshan/server/server.mjs"
if [[ ! -f "$SERVER" ]]; then
  echo "Server bundle not found: $SERVER" >&2
  exit 1
fi

echo "Starting SSR/API on http://localhost:$PORT"
exec node "$SERVER"

