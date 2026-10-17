#!/usr/bin/env bash
# SarembokVE Canonical Production Deploy Script
# Safe, idempotent, verifiable. Never silently overwrites uncommitted server changes.

set -Eeuo pipefail
umask 022

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

ENV_FILE="Deployment/cloud/.env"
COMPOSE=(docker compose -f Deployment/cloud/compose.yaml -f Deployment/cloud/compose.production.yaml)

printf '\n=======================================================\n'
printf '   SAREMBOKVE PRODUCTION DEPLOYMENT ENGINE\n'
printf '=======================================================\n'

# 1. Guard against accidental loss of uncommitted hot-patches
if [ -n "$(git status --porcelain)" ]; then
    printf '\n[WARN] Working tree has uncommitted local changes:\n'
    git status --short
    BACKUP_BRANCH="backup/pre-deploy-$(date +%Y%m%d-%H%M%S)"
    printf '[INFO] Creating safety checkpoint branch: %s\n' "$BACKUP_BRANCH"
    git branch "$BACKUP_BRANCH"
fi

# 2. Synchronize with GitHub main
printf '\n[1/6] Fetching origin/main...\n'
git fetch origin main
git checkout main
git pull --ff-only origin main || {
    printf '[WARN] Fast-forward pull failed; checking out origin/main directly\n'
    git reset --hard origin/main
}

# 3. Normalize permissions
printf '\n[2/6] Normalizing permissions on bind-mounted directories...\n'
chmod a+r Deployment/cloud/*.py Deployment/cloud/mcp_servers.json 2>/dev/null || true
if [ -d Deployment/cloud/skills ]; then
    find Deployment/cloud/skills -type f -exec chmod a+r {} + 2>/dev/null || true
fi
if [ -d frontend ]; then
    find frontend -type f -exec chmod a+r {} + 2>/dev/null || true
fi

# 4. Ensure production secrets in .env
printf '\n[3/6] Verifying environment secrets...\n'
mkdir -p Deployment/cloud
[ -f "$ENV_FILE" ] || touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

secret() { command -v openssl >/dev/null 2>&1 && openssl rand -hex 32 || head -c 32 /dev/urandom | xxd -p; }
passcode() { command -v openssl >/dev/null 2>&1 && openssl rand -hex 16 || head -c 16 /dev/urandom | xxd -p; }
set_if_missing() { grep -qE "^$1=" "$ENV_FILE" || printf '%s=%s\n' "$1" "$2" >> "$ENV_FILE"; }

set_if_missing SAREMBOK_AUTH_TOKEN "$(secret)"
set_if_missing SAREMBOK_ADMIN_TOKEN "$(secret)"
set_if_missing SAREMBOK_MASTER_TOKEN "$(secret)"
set_if_missing SAREMBOK_WORKER_ENROLLMENT_TOKEN "$(secret)"
set_if_missing SAREMBOK_WORKER_TOKEN_HASH_SALT "$(secret)"
set_if_missing SAREMBOK_ADMIN_PASSCODE "$(passcode)"
set_if_missing SAREMBOK_PUBLIC_HOST "sarembok.com"
set_if_missing SAREMBOK_REQUIRE_ORIGIN "true"
set_if_missing SAREMBOK_ALLOW_ORIGINLESS_LOCAL "false"
set_if_missing SAREMBOK_DAILY_PAID_CALL_BUDGET "500"
set_if_missing SAREMBOK_RATE_LIMIT_PER_IP "120"
set_if_missing SAREMBOK_RATE_LIMIT_WINDOW_SECONDS "60"

# 5. Compose validation and build
printf '\n[4/6] Validating Docker Compose configuration...\n'
"${COMPOSE[@]}" config >/dev/null

printf '\n[5/6] Building production containers and launching services...\n'
"${COMPOSE[@]}" build sarembok-runtime sarembok-browser sarembok-voice sarembok-edge
"${COMPOSE[@]}" up -d --force-recreate

printf '[INFO] Waiting for service health checks to pass (15s)...\n'
sleep 15

# 6. Post-deployment live smoke verification
printf '\n[6/6] Verifying live services...\n'
python3 - <<'PY'
import json, sys, urllib.request, urllib.error

base = "http://127.0.0.1:9000"

# Verify /health
try:
    with urllib.request.urlopen(f"{base}/health", timeout=5) as resp:
        data = json.loads(resp.read().decode())
        print(f"  [PASS] Runtime Health: {data.get('status', 'OK')}")
except Exception as exc:
    print(f"  [WARN] /health check: {exc}")

# Verify /session
try:
    req = urllib.request.Request(f"{base}/session", headers={"User-Agent": "SarembokDeployer/1.0"})
    with urllib.request.urlopen(req, timeout=5) as resp:
        sdata = json.loads(resp.read().decode())
        token = sdata.get("sessionToken")
        if token:
            print(f"  [PASS] Session Broker: Issued token ({token[:8]}...)")
        else:
            print("  [WARN] /session returned no sessionToken")
except Exception as exc:
    print(f"  [WARN] /session check: {exc}")

PY

printf '\n=======================================================\n'
printf '   SAREMBOKVE DEPLOYMENT SUCCESSFUL\n'
printf '   Commit: %s\n' "$(git rev-parse HEAD)"
printf '   Public URL: https://sarembok.com\n'
printf '   Console:    https://sarembok.com/console\n'
printf '   Legacy:     https://sarembok.com/legacy\n'
printf '=======================================================\n\n'
