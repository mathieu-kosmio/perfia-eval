#!/usr/bin/env bash
# =============================================================================
# PerfIA Diagnostic IA : import du schéma PocketBase via l'API
# =============================================================================
# Envoie pocketbase/pb_schema.json à PUT /api/collections/import avec
# { collections, deleteMissing: false } (fusion avec les collections existantes,
# les collections système comme _superusers sont conservées).
# Le jeton est obtenu par POST /api/collections/_superusers/auth-with-password.
#
# Variables :
#   PB_URL            URL de l'instance (défaut http://127.0.0.1:8090)
#   PB_ADMIN_EMAIL    e-mail du superutilisateur (requis)
#   PB_ADMIN_PASSWORD mot de passe du superutilisateur (requis)
#   PB_SCHEMA         chemin du schéma (défaut pocketbase/pb_schema.json)
#
# Dépendances : curl et node (pas de jq).
# =============================================================================
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

PB_URL="${PB_URL:-http://127.0.0.1:8090}"
PB_SCHEMA="${PB_SCHEMA:-pocketbase/pb_schema.json}"

# .local/env.sh peut fournir PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD en local.
if [ -f .local/env.sh ]; then
  set -a
  # shellcheck disable=SC1091
  source .local/env.sh
  set +a
fi

if [ -z "${PB_ADMIN_EMAIL:-}" ] || [ -z "${PB_ADMIN_PASSWORD:-}" ]; then
  echo "PB_ADMIN_EMAIL et PB_ADMIN_PASSWORD sont requis." >&2
  exit 1
fi
if [ ! -f "$PB_SCHEMA" ]; then
  echo "Schéma introuvable : $PB_SCHEMA" >&2
  exit 1
fi
for tool in curl node; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "$tool est requis." >&2
    exit 1
  fi
done

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# --- 1. Authentification du superutilisateur --------------------------------
echo "Authentification sur ${PB_URL}..."
AUTH_BODY="$(node -e 'process.stdout.write(JSON.stringify({identity: process.argv[1], password: process.argv[2]}))' \
  "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD")"
AUTH_RESPONSE="$(curl -sS -X POST "${PB_URL}/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' --data "$AUTH_BODY")"
TOKEN="$(printf '%s' "$AUTH_RESPONSE" | node -e '
  let raw = "";
  process.stdin.on("data", c => raw += c).on("end", () => {
    let json;
    try { json = JSON.parse(raw); } catch { json = {}; }
    if (!json.token) { process.stderr.write("Authentification refusée : " + raw + "\n"); process.exit(1); }
    process.stdout.write(json.token);
  });
')"

# --- 2. Construction du corps { collections, deleteMissing: false } ---------
node -e '
  const fs = require("fs");
  const raw = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const collections = Array.isArray(raw) ? raw : raw.collections;
  if (!Array.isArray(collections)) {
    process.stderr.write("Le schéma doit être un tableau de collections ou un objet { collections: [...] }\n");
    process.exit(1);
  }
  fs.writeFileSync(process.argv[2], JSON.stringify({ collections, deleteMissing: false }));
  process.stdout.write(String(collections.length));
' "$PB_SCHEMA" "$TMP_DIR/import.json" > "$TMP_DIR/count"
echo "Import de $(cat "$TMP_DIR/count") collection(s) depuis ${PB_SCHEMA}..."

# --- 3. Import --------------------------------------------------------------
HTTP_CODE="$(curl -sS -o "$TMP_DIR/response" -w '%{http_code}' -X PUT "${PB_URL}/api/collections/import" \
  -H "Authorization: ${TOKEN}" -H 'Content-Type: application/json' \
  --data-binary "@$TMP_DIR/import.json")"

if [ "$HTTP_CODE" = "204" ] || [ "$HTTP_CODE" = "200" ]; then
  echo "Schéma importé (HTTP ${HTTP_CODE})."
else
  echo "Échec de l'import (HTTP ${HTTP_CODE}) :" >&2
  cat "$TMP_DIR/response" >&2
  echo >&2
  exit 1
fi
