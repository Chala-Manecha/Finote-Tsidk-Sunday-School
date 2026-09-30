#!/usr/bin/env bash
# Runs migrations + RLS tests against a throwaway local Postgres with Supabase stubs.
# Usage: PGHOST=... PGPORT=... PGUSER=postgres supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
psql -q -c "drop database if exists finote_rls_test" -c "create database finote_rls_test"
psql -q -d finote_rls_test -f supabase/tests/supabase_stubs.sql 2>/dev/null || true
for f in supabase/migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d finote_rls_test -f "$f"; done
psql -q -v ON_ERROR_STOP=1 -d finote_rls_test -f supabase/tests/rls_test.sql | grep -E "PASSED|ERROR"
