#!/usr/bin/env bash
# Starts Fictulary for driving: API on :3399 against a throwaway database,
# web dev server on :4300 proxied to it. Dev sign-in is on; OAuth settings
# are placeholders. Your own apps/api/.env database is never touched.
# Usage (from the repo root): .claude/skills/run-fictulary/start.sh
# NO_APPLE=1 starts the API without Apple settings (Apple sign-in off).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
SKILL=.claude/skills/run-fictulary
OUT=$SKILL/out
DB=${RUN_DB:-fictulary_run}
mkdir -p "$OUT"

docker compose up -d postgres >/dev/null
timeout 60 bash -c 'until docker compose exec -T postgres pg_isready -qU fictulary; do sleep 1; done'
docker compose exec -T postgres psql -qU fictulary -d postgres \
  -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"

npx nx run api:build >"$OUT/api-build.log" 2>&1

APPLE_ENV=(
  APPLE_TEAM_ID=T APPLE_KEY_ID=K APPLE_PRIVATE_KEY=x
  APPLE_BUNDLE_ID=com.example.fictulary APPLE_SERVICES_ID=com.example.fictulary.web
  APPLE_REDIRECT_URI=http://localhost:4300/auth/callback
  TOKEN_ENCRYPTION_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")"
)
# Empty rather than unset: Nest also loads apps/api/.env, whose values
# would otherwise fill them in. Empty counts as unset for the API.
[ "${NO_APPLE:-}" = 1 ] && APPLE_ENV=(
  APPLE_TEAM_ID= APPLE_KEY_ID= APPLE_PRIVATE_KEY= APPLE_BUNDLE_ID=
  APPLE_SERVICES_ID= APPLE_REDIRECT_URI=
)

# Everything the API needs is set here, so it doesn't depend on
# apps/api/.env (which it still loads for anything left unset).
env PORT=3399 DB_NAME="$DB" DB_MIGRATIONS_RUN=true AUTH_DEV_LOGIN=true \
  JWT_SECRET=run-fictulary-local-only \
  GOOGLE_WEB_CLIENT_ID=placeholder.apps.googleusercontent.com \
  "${APPLE_ENV[@]}" \
  nohup node dist/apps/api/main.js >"$OUT/api.log" 2>&1 &

echo '{"/api":{"target":"http://localhost:3399","secure":false}}' >"$OUT/proxy.json"
# Own Nx workspace data: otherwise Nx waits for a `nx serve web` you
# already have running ("Waiting for web:serve:development in another nx
# process") instead of starting a second one.
NX_WORKSPACE_DATA_DIRECTORY="$OUT/nx-data" NX_DAEMON=false \
  nohup npx nx run web:serve --port=4300 --proxy-config="$OUT/proxy.json" \
  >"$OUT/web.log" 2>&1 &

timeout 180 bash -c 'until curl -sf localhost:3399/api/auth/providers >/dev/null \
  && curl -sf localhost:4300 >/dev/null; do sleep 2; done' \
  || { echo "Not ready; see $OUT/api.log and $OUT/web.log"; exit 1; }
echo "Ready: web http://localhost:4300  api http://localhost:3399/api  db $DB"
