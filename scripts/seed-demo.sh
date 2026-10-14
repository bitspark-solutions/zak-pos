#!/usr/bin/env bash
# =============================================================================
# seed-demo.sh — load demo data into a running ZakPOS stack via the public API
# =============================================================================
# Provisions one owner-tenant store ("Demo Kiryana Store") with categories,
# products carrying real scannable barcodes, and opening stock, by calling the
# same endpoints the apps use (register -> categories -> products -> inventory
# adjust). Safe to re-run: exits early when the demo catalog already exists.
#
# Requirements: bash, curl, node (>=18, global fetch not used — node is only
# used for JSON). Override with env vars:
#   ZAKPOS_API_URL (default http://localhost:39847/api/v1)
#   ZAKPOS_DEMO_EMAIL / ZAKPOS_DEMO_PASSWORD
set -euo pipefail

API="${ZAKPOS_API_URL:-http://localhost:39847/api/v1}"
EMAIL="${ZAKPOS_DEMO_EMAIL:-owner@demo.zakpos.test}"
PASSWORD="${ZAKPOS_DEMO_PASSWORD:-demo12345}"
STORE_NAME="Demo Kiryana Store"

# jget <js-expression over 'o'>  — extract one value from JSON on stdin.
jget() {
  node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const o=JSON.parse(d);const v=$1;console.log(v??'')}catch{console.log('')}})"
}

# json <node expression over 'argv' style>  — print JSON.stringify of a body.
post_json() { # post_json <path> <js-object-expression using vars V>
  local path="$1" body_expr="$2"
  curl -sS -X POST "$API$path" -H 'Content-Type: application/json' \
    ${TOKEN:+-H "Authorization: Bearer $TOKEN"} \
    --data "$body_expr"
}

# --- 1. Auth: register the demo owner (self-provisions tenant + first shop).
echo "→ ensuring demo account $EMAIL exists…"
RESP=$(curl -sS -X POST "$API/auth/register" -H 'Content-Type: application/json' \
  --data "{\"name\":\"Demo Owner\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"storeName\":\"$STORE_NAME\"}")
TOKEN=$(printf %s "$RESP" | jget "o.access_token")
if [ -z "$TOKEN" ]; then
  # Already registered (409) — fall back to login.
  RESP=$(curl -sS -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    --data "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
  TOKEN=$(printf %s "$RESP" | jget "o.access_token")
fi
if [ -z "$TOKEN" ]; then
  echo "ERROR: could not obtain an access token. API reply: $RESP" >&2
  exit 1
fi

# --- 2. Skip when the catalog is already seeded (idempotency probe).
# GET /products/barcode/:code answers 200+null for unknown codes, so the
# probe must look for a real id in the body, not just the status.
PROBE=$(curl -sS -H "Authorization: Bearer $TOKEN" "$API/products/barcode/8904144414441")
if printf %s "$PROBE" | grep -q '"id"'; then
  echo "✓ Demo catalog already present — nothing to do."
  echo "Sign in at http://localhost:41923 with $EMAIL / $PASSWORD"
  exit 0
fi

# --- 3. Shop id (register provisions the first shop automatically).
SHOP_ID=$(curl -sS -H "Authorization: Bearer $TOKEN" "$API/shops" \
  | jget "o.data && o.data[0] && o.data[0].id")
if [ -z "$SHOP_ID" ]; then
  echo "ERROR: no shop found for the demo tenant" >&2
  exit 1
fi

# --- 4. Categories.
declare -A CAT
for NAME in "Groceries" "Beverages" "Personal Care" "Household"; do
  ID=$(post_json "/categories" "{\"name\":\"$NAME\"}" | jget "o.id")
  CAT[$NAME]="$ID"
  echo "→ category $NAME (${ID:-FAILED})"
done

# --- 5. Products with scannable barcodes: name|barcode|price|cost|qty|category
ROWS='
Sugar 1kg|8901234567890|125|110|60|Groceries
Mineral oil 1L|8901037120406|160|135|48|Groceries
Red lentils (masoor) 1kg|8901356001111|145|120|30|Groceries
Tea leaves 400g|8901446001234|290|240|24|Groceries
Bottled water 1.5L|8902034111111|30|22|120|Beverages
Instant coffee 50g|8901068000000|210|180|18|Beverages
Soap (per piece)|8901099123456|45|33|90|Personal Care
Shampoo 180ml|8901222333444|190|155|26|Personal Care
Dish soap 500ml|8901777888999|120|95|40|Household
Laundry detergent 1kg|8901555666777|310|260|20|Household
'
SEED_SKIPPED=0
while IFS='|' read -r NAME BARCODE PRICE COST QTY CATEGORY; do
  [ -z "${NAME:-}" ] && continue
  CAT_ID="${CAT[$CATEGORY]:-}"
  BODY="{\"name\":\"$NAME\",\"barcode\":\"$BARCODE\",\"basePrice\":$PRICE,\"defaultCost\":$COST,\"unit\":\"pcs\""
  [ -n "$CAT_ID" ] && BODY="$BODY,\"categoryId\":\"$CAT_ID\""
  BODY="$BODY}"
  PID=$(post_json "/products" "$BODY" | jget "o.id")
  if [ -z "$PID" ]; then
    echo "  ! product $NAME failed (continuing)" >&2
    SEED_SKIPPED=$((SEED_SKIPPED + 1))
    continue
  fi
  post_json "/inventory/adjust" \
    "{\"shopId\":\"$SHOP_ID\",\"productId\":\"$PID\",\"quantity\":$QTY,\"type\":\"IN\",\"unitCost\":$COST,\"reference\":\"demo opening stock\"}" \
    >/dev/null
  echo "→ product $NAME ($BARCODE) · stock $QTY"
done <<< "$ROWS"

# --- 6. The demo probe barcode must exist for the idempotency check above.
PID=$(curl -sS -H "Authorization: Bearer $TOKEN" "$API/products/barcode/8904144414441")
if ! printf %s "$PID" | grep -q '"id"'; then
  PID=$(post_json "/products" '{"name":"Biscuit pack 200g","barcode":"8904144414441","basePrice":60,"defaultCost":48,"unit":"pcs"}' | jget "o.id")
  [ -n "$PID" ] && post_json "/inventory/adjust" \
    "{\"shopId\":\"$SHOP_ID\",\"productId\":\"$PID\",\"quantity\":80,\"type\":\"IN\",\"unitCost\":48,\"reference\":\"demo opening stock\"}" >/dev/null
fi

echo
echo "✓ Demo data ready."
echo "  Web POS:      http://localhost:41923  (sign in below)"
echo "  Email:        $EMAIL"
echo "  Password:     $PASSWORD"
echo "  Try scanning barcode 8901234567890 (Sugar 1kg) in the POS screen."
