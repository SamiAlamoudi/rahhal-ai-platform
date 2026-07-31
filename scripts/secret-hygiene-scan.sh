#!/usr/bin/env bash
# Fail only on real (non-comment) client-side secret assignments with values.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Local developer env files are gitignored and must not fail CI hygiene.
EXCLUDE_GLOBS=(
  --exclude-dir=node_modules
  --exclude-dir=.git
  --exclude-dir=dist
  --exclude-dir=coverage
  --exclude='*.md'
  --exclude='secret-hygiene-scan.sh'
  --exclude='ci.yml'
  --exclude='.env'
  --exclude='.env.local'
)

PATTERN='^\s*VITE_(AMADEUS_CLIENT_SECRET|AMADEUS_CLIENT_ID|DUFFEL_API_TOKEN|GOOGLE_MAPS_API_KEY|OPENWEATHER_API_KEY|MOYASAR_SECRET[_A-Z]*)\s*=\s*[^#[:space:]].*'

MATCHES="$(grep -RInE "${EXCLUDE_GLOBS[@]}" -e "${PATTERN}" . || true)"

if [[ -n "${MATCHES}" ]]; then
  echo "Forbidden client-side secret assignments found:" >&2
  echo "${MATCHES}" >&2
  exit 1
fi

# Sprint 79 P0 — committed env *examples* must not assign client OpenAI keys or enable demo auth.
for f in .env.example .env.staging.example .env.production.example; do
  if [[ ! -f "$f" ]]; then
    echo "Missing env example: $f" >&2
    exit 1
  fi
  if grep -E '^\s*VITE_(OPENAI_API_KEY|AGENT_OPENAI_API_KEY)\s*=\s*[^#[:space:]].*' "$f" >/dev/null; then
    echo "Forbidden client-side OpenAI key assignment in $f (use server OPENAI_API_KEY only)" >&2
    grep -nE '^\s*VITE_(OPENAI_API_KEY|AGENT_OPENAI_API_KEY)\s*=' "$f" >&2 || true
    exit 1
  fi
  if grep -E '^\s*VITE_DEMO_AUTH\s*=\s*(true|1|yes)\s*$' "$f" >/dev/null; then
    echo "VITE_DEMO_AUTH=true is forbidden in $f (dev-only, never production examples)" >&2
    exit 1
  fi
  grep -q '^VITE_PAYMENT_PROVIDER=mock' "$f" || {
    echo "VITE_PAYMENT_PROVIDER=mock missing from $f" >&2
    exit 1
  }
done

echo "Secret / env hygiene scan passed."
