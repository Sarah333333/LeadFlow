#!/usr/bin/env bash
# Security & reliability test suite. Requires the local Supabase stack (npx supabase start).
# Builds the app in production mode against a mock OpenAI and fake provider credentials, then attacks it.
set -euo pipefail
cd "$(dirname "$0")/.."

# Supabase URL/keys for the local stack (never hardcoded in the repo).
eval "$(npx supabase status -o env --override-name api.url=NEXT_PUBLIC_SUPABASE_URL \
  --override-name auth.anon_key=NEXT_PUBLIC_SUPABASE_ANON_KEY --override-name auth.service_role_key=SUPABASE_SERVICE_ROLE_KEY 2>/dev/null \
  | grep -E '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY)=' | sed 's/^/export /')"
rnd() { openssl rand -hex 24; }

export PORT=3100
export NEXT_PUBLIC_APP_URL="http://localhost:$PORT"
export OPENAI_API_KEY="sk-mock-$(rnd)"   # random; the mock server accepts any key
export OPENAI_BASE_URL="http://127.0.0.1:4010/v1"
export TWILIO_ACCOUNT_SID="ACffffffffffffffffffffffffffffffff"
export TWILIO_AUTH_TOKEN="$(rnd)"   # random per run
export TWILIO_PHONE_NUMBER="+353861119999"
export STRIPE_SECRET_KEY="sk_test_$(rnd)"
export STRIPE_WEBHOOK_SECRET="whsec_$(rnd)"
export STRIPE_PRICE_STARTER="price_starter_test" STRIPE_PRICE_GROWTH="price_growth_test" STRIPE_PRICE_PRO="price_pro_test"
export CRON_SECRET="$(rnd)"
export ADMIN_EMAILS="ops-admin@test.leadflow.dev"
export TEST_APP_URL="http://localhost:$PORT"

echo "▶ Applying migrations"; npx supabase migration up >/dev/null
if [ -z "${SKIP_BUILD:-}" ]; then echo "▶ Building (production)"; npx next build > /tmp/leadflow-test-build.log 2>&1 || { tail -40 /tmp/leadflow-test-build.log; exit 1; }; fi

# Refuse to run against a stale server left on the port (it would silently test an old build).
if curl -s -o /dev/null "$TEST_APP_URL" || curl -s -o /dev/null http://127.0.0.1:4010; then
  echo "✗ Port $PORT or 4010 is already in use — stop the old test server first."; exit 1
fi
set -m  # each background job gets its own process group, so cleanup kills children too
node tests/security/mock-openai.mjs > /tmp/leadflow-mock-openai.log 2>&1 & MOCK_PID=$!
node node_modules/next/dist/bin/next start -p $PORT > /tmp/leadflow-test-app.log 2>&1 & APP_PID=$!
trap 'kill -- -$MOCK_PID -$APP_PID 2>/dev/null || true' EXIT
for i in $(seq 1 60); do curl -sf -o /dev/null "$TEST_APP_URL/login" && break; sleep 1; done

echo "▶ Running security tests"
npx vitest run --config vitest.security.config.mts "$@"
