#!/usr/bin/env bash
# Fail only on real (non-comment) client-side secret assignments with values.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MATCHES="$(
  grep -RInE \
    --exclude-dir=node_modules \
    --exclude-dir=.git \
    --exclude-dir=dist \
    --exclude-dir=coverage \
    --exclude='*.md' \
    --exclude='secret-hygiene-scan.sh' \
    --exclude='ci.yml' \
    '^\s*VITE_(AMADEUS_CLIENT_SECRET|AMADEUS_CLIENT_ID|DUFFEL_API_TOKEN|GOOGLE_MAPS_API_KEY|OPENWEATHER_API_KEY|MOYASAR_SECRET[_A-Z]*)\s*=\s*[^#[:space:]].*' \
    . || true
)"

if [[ -n "${MATCHES}" ]]; then
  echo "Forbidden client-side secret assignments found:" >&2
  echo "${MATCHES}" >&2
  exit 1
fi

for f in .env.example .env.staging.example .env.production.example; do
  grep -q '^VITE_PAYMENT_PROVIDER=mock' "$f" || {
    echo "VITE_PAYMENT_PROVIDER=mock missing from $f" >&2
    exit 1
  }
done

echo "Secret / env hygiene scan passed."
