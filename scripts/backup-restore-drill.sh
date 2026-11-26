#!/usr/bin/env bash
# Backup & restore drill. Proves a dump can be restored with data, RLS and policies intact.
#   Local:      bash scripts/backup-restore-drill.sh
#   Production: DB_URL="postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres" RESTORE_URL="<a SCRATCH database>" bash scripts/backup-restore-drill.sh
# NEVER point RESTORE_URL at production.
set -euo pipefail
CONTAINER=$(docker ps --format '{{.Names}}' | grep -m1 supabase_db_ || true)
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="backups/leadflow-$STAMP.dump"
mkdir -p backups

run() { if [ -n "${DB_URL:-}" ]; then "$@"; else docker exec -i "$CONTAINER" "$@"; fi; }
SRC=${DB_URL:-postgresql://postgres:postgres@localhost:5432/postgres}
DST=${RESTORE_URL:-postgresql://postgres:postgres@localhost:5432/restore_drill}

echo "▶ 1/4 Dumping business data (public schema) + user accounts (auth.users)"
# Two dumps: pg_dump given both --schema and --table silently dumps ONLY the table (found by this drill).
run pg_dump "$SRC" --table=auth.users --format=custom --no-owner --no-privileges > "$OUT.users"
run pg_dump "$SRC" --schema=public --format=custom --no-owner > "$OUT"
echo "   $(du -h "$OUT.users" | cut -f1) → $OUT.users"
echo "   $(du -h "$OUT" | cut -f1) → $OUT"

echo "▶ 2/4 Restoring into a scratch database"
if [ -z "${RESTORE_URL:-}" ]; then
  docker exec "$CONTAINER" psql -q -U postgres -c "drop database if exists restore_drill" -c "create database restore_drill"
fi
# Minimal Supabase prerequisites (a real recovery target is a fresh Supabase project, which already has these).
run psql -q "$DST" -v ON_ERROR_STOP=1 <<'SQL'
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable
  as $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
SQL
# Users first (memberships reference them), then business data with grants, RLS and policies.
# "schema public already exists" and Supabase-internal default-privilege notices are expected and harmless.
for f in "$OUT.users" "$OUT"; do
  ERRS=$(run pg_restore --no-owner -d "$DST" < "$f" 2>&1 | grep -E "^pg_restore: error" | grep -vE 'schema "public" already exists|default privileges|errors ignored' || true)
  [ -z "$ERRS" ] || { echo "✗ Unexpected restore errors:"; echo "$ERRS"; exit 1; }
done

echo "▶ 3/4 Verifying row counts"
Q="select string_agg(t || '=' || n, ' ' order by t) from (
  select 'businesses' t, count(*) n from public.businesses union all select 'leads', count(*) from public.leads
  union all select 'messages', count(*) from public.messages union all select 'follow_ups', count(*) from public.follow_ups
  union all select 'notifications', count(*) from public.notifications union all select 'business_members', count(*) from public.business_members
  union all select 'auth.users', count(*) from auth.users) x"
A=$(run psql -tA "$SRC" -c "$Q"); B=$(run psql -tA "$DST" -c "$Q")
echo "   source:   $A"; echo "   restored: $B"
[ "$A" = "$B" ] || { echo "✗ Row counts differ"; exit 1; }

echo "▶ 4/4 Verifying RLS & policies survived"
P="select count(*) filter (where c.relrowsecurity) || '/' || count(*) || ' tables with RLS, ' || (select count(*) from pg_policies where schemaname='public') || ' policies'
   from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'"
PA=$(run psql -tA "$SRC" -c "$P"); PB=$(run psql -tA "$DST" -c "$P")
echo "   source:   $PA"; echo "   restored: $PB"
[ "$PA" = "$PB" ] || { echo "✗ RLS/policies differ"; exit 1; }

[ -z "${RESTORE_URL:-}" ] && docker exec "$CONTAINER" psql -q -U postgres -c "drop database restore_drill"
echo "✓ Drill passed. Backup kept at $OUT (backups/ is git-ignored — store real backups encrypted, off-site)."
