#!/usr/bin/env bash
# Stops what start.sh started and drops its database.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
DB=${RUN_DB:-fictulary_run}
for port in 3399 4300; do
  lsof -ti:$port -sTCP:LISTEN | xargs -r kill
done
sleep 1
docker compose exec -T postgres psql -qU fictulary -d postgres \
  -c "DROP DATABASE IF EXISTS $DB (FORCE)"
echo "Stopped; dropped $DB"
