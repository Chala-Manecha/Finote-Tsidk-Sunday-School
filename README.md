# ፍኖተ ጽድቅ ሰንበት ትምህርት ቤት

Management system for the Sunday school: registration, attendance, and the other department workflows. Built with Next.js 16 (App Router), Supabase (Postgres, Auth, RLS, Storage), and Vercel.

Spec: see the project's *System Requirements* and *Tables, Movement & Dashboards* docs.

## What's built so far (phase 1)

| Area | Status |
|---|---|
| Database schema, all tables from the spec | ✅ `supabase/migrations/0001` |
| Role helpers + row-level security, all tables | ✅ `0002`, `0003` (tested) |
| Approval state machines (money, earnings, events, feedback) as DB triggers | ✅ `0003` |
| Views/RPCs: spend totals, attendance, member save, public roster/names | ✅ `0004` |
| Storage buckets: `member-docs` (private), `media` (public) | ✅ `0005` |
| Staff login (username + password), admin account management | ✅ |
| Department hub + per-department tab shell + welcome banner | ✅ |
| HR registration form (EC birth date, evidence uploads, sub-memberships) | ✅ |
| Member roster (per dept / all / ጽሕፈት ቤት), member detail with attendance and absent dates | ✅ |
| Session-first attendance (መዝሙር/ወረብ, ኮርስ/አብነት, ስብሰባ) with locked history and edit | ✅ |
| HR unified attendance matrix + member absence search | ✅ |
| Everything else (money, schedule, songs, duty roster, public pages…) | shown as "በቅርቡ" tabs |

## Setup

### 1. Run the migrations (once)

Supabase dashboard → **SQL Editor** → paste and run each file in `supabase/migrations/` **in order**:

1. `20260930000001_schema.sql`
2. `20260930000002_auth_helpers.sql`
3. `20260930000003_rls.sql`
4. `20260930000004_functions.sql`
5. `20260930000005_storage.sql`

(Or with the Supabase CLI: `supabase link --project-ref dhdnvqsqmfzxkrwbkbxc && supabase db push`.)

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in the values. In Vercel, add the same four variables under **Settings → Environment Variables**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`: the `sb_secret_…` key from **Project Settings → API Keys**. It's server-only and should never get a `NEXT_PUBLIC_` prefix.
- `NEXT_PUBLIC_STAFF_EMAIL_DOMAIN` (keep `staff.finote-tsidk.app`)

### 3. Supabase Auth settings

Under **Authentication → Sign In / Providers → Email**:
- Turn **off** "Allow new users to sign up". Accounts are created only by an admin inside the app.
- "Confirm email" can stay on. Admin-created accounts are pre-confirmed.

### 4. Create the first admin

```bash
npm install
npm run create-admin -- chala 'a-strong-password' "Chala Manecha"
```

Then sign in at `/login` with username `chala`. Create everyone else from **መለያዎች** (`/staff/admin/accounts`).

### 5. Run

```bash
npm run dev      # http://localhost:3000
npm run build
```

## How auth and permissions work

- Staff sign in with a **username**. Supabase Auth stores it as `<username>@staff.finote-tsidk.app`. No email or SMS is ever sent.
- `staff_profiles` (one per login) + `staff_departments` (which departments they belong to). Someone can be in several departments. `is_admin` passes every department check.
- **The database is the source of truth.** Every table has RLS using `has_dept()` / `has_any_dept()` / `is_staff()`. The UI checks are only for display.
- Rules RLS can't express are enforced by triggers:
  - money: only ጽሕፈት ቤት approves, only ሒሳብና ንብረት marks paid, only ኦዲት flags, and only the requester withdraws or edits while pending
  - earnings: only ሒሳብና ንብረት approves
  - events: only መርሓ ግብራት approves
  - feedback: content is read-only after submit, and only the tagged department marks it seen
- Anonymous visitors can read only the public tables and submit feedback. Member names and the duty roster are exposed through `public_member_names()` / `public_duty_roster()`, which return no phone numbers or other contact details.

## Deviations from the prototype's table doc

- Status/enum values are stored as English codes (`absent`, `pending`, …). The Amharic labels live in `src/lib/constants.ts`.
- `sub_memberships text[]` became a `member_departments` join table, for FK integrity and fast per-department lists.
- `attendance_sessions.dept` is **generated** from `session_type`, so a session can't be filed under the wrong department.
- `outreach_items` and `property` became `dept_property` (fixed assets, which the Collateral Report reads) and `sale_items` (ልማት's shop stock).
- `expense_reports` became `expense_lines`. ተመላሽ/ከራስ ወጪ are never stored; the `money_request_totals` view computes them.
- Media columns store Storage paths, not base64. Files upload from the browser straight to Storage, so there's no size ceiling from the server.
- The ጳጉሜ date picker now offers the real 5 or 6 days.

## Tests

```bash
# needs a local Postgres 15+; uses stand-ins for Supabase's auth/storage schemas
PGHOST=localhost PGUSER=postgres npm run test:db
```

`supabase/tests/rls_test.sql` checks the permission matrix: anon vs staff, cross-department writes, the money approval chain, feedback visibility, the attendance RPCs, and save_member.
