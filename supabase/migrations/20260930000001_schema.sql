-- =====================================================================
-- ፍኖተ ጽድቅ ሰንበት ትምህርት ቤት — core schema
-- Run order: 0001_schema → 0002_auth_helpers → 0003_rls → 0004_functions
-- Stored values are English codes; Amharic labels live in the app
-- (src/lib/constants.ts). Every date is stored as Gregorian; the UI
-- enters/displays Ethiopian calendar and converts.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.sex               as enum ('male', 'female');
create type public.work_status       as enum ('student', 'worker');
create type public.member_status     as enum ('new', 'existing', 'lost');
create type public.geez_level        as enum ('none', 'understand', 'correct');
create type public.session_type      as enum ('mezmur', 'wereb', 'course', 'abnet', 'meeting');
create type public.attendance_status as enum ('absent', 'present', 'half');
create type public.event_status      as enum ('pending', 'approved', 'rejected');
create type public.money_status      as enum ('pending', 'approved', 'rejected', 'paid', 'withdrawn');
create type public.earning_status    as enum ('pending', 'approved', 'rejected');
create type public.item_condition    as enum ('new', 'old', 'refurbished', 'unusable');
create type public.media_type        as enum ('photo', 'video');
create type public.feedback_status   as enum ('unseen', 'seen');

-- ---------------------------------------------------------------------
-- Shared updated_at trigger
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Departments (lookup)
-- ---------------------------------------------------------------------
create table public.departments (
  code     text primary key,
  name_am  text not null unique,
  sort     int  not null
);

insert into public.departments (code, name_am, sort) values
  ('office',        'ጽሕፈት ቤት',               1),
  ('mezmur',        'መዝሙር ክፍል',              2),
  ('hr',            'የሰው ሃብት አስተዳደር',       3),
  ('schedule',      'መርሓ ግብራት',              4),
  ('finance',       'ሒሳብና ንብረት አስተዳደር',     5),
  ('development',   'ልማትና በጎ አድራጎት',        6),
  ('audit',         'ኦዲት እና ምርመራ',          7),
  ('education',     'ትምህርት ክፍል',            8),
  ('internal_comm', 'የውስጥ ግንኙነት',           9);

-- ---------------------------------------------------------------------
-- Staff accounts (1:1 with auth.users) + department roles
-- ---------------------------------------------------------------------
create table public.staff_profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  username    text not null unique check (username ~ '^[a-z0-9._-]{3,32}$'),
  full_name   text not null,
  sex         public.sex,
  member_id   uuid,                       -- optional link to their member record (FK added below)
  is_admin    boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_staff_profiles_updated before update on public.staff_profiles
  for each row execute function public.set_updated_at();

create table public.staff_departments (
  user_id  uuid not null references public.staff_profiles (user_id) on delete cascade,
  dept     text not null references public.departments (code),
  primary key (user_id, dept)
);

-- ---------------------------------------------------------------------
-- Members (registered by HR at Office 9)
-- ---------------------------------------------------------------------
create table public.members (
  id                 uuid primary key default gen_random_uuid(),
  full_name          text not null check (length(trim(full_name)) > 1),
  sex                public.sex not null,
  title              text check (title in ('qesis', 'diakon', 'doctor')),
  work_status        public.work_status not null,
  member_status      public.member_status not null default 'new',
  dob                date,                                  -- Gregorian equivalent of the EC birth date
  phone              text,
  email              text,
  telegram_username  text,
  sub_city           text,
  language           text,
  geez_level         public.geez_level not null default 'none',
  is_ethiopian       boolean not null default true,
  nationality        text,
  -- {"name": "...", "years": 3, "evidence_path": "member-docs/..."}
  prior_school       jsonb,
  -- {"name": "...", "evidence_path": "member-docs/..."}
  secular_school     jsonb,
  is_active          boolean not null default true,        -- soft delete
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint nationality_when_not_ethiopian
    check (is_ethiopian or coalesce(length(trim(nationality)), 0) > 0)
);
create index members_name_idx on public.members (lower(full_name));
create index members_active_idx on public.members (is_active);
create trigger trg_members_updated before update on public.members
  for each row execute function public.set_updated_at();

alter table public.staff_profiles
  add constraint staff_profiles_member_fk
  foreign key (member_id) references public.members (id) on delete set null;

-- Sub-membership: departments chosen at registration (affiliation marker,
-- NOT an attendance filter). Join table instead of text[] for FK integrity.
create table public.member_departments (
  member_id  uuid not null references public.members (id) on delete cascade,
  dept       text not null references public.departments (code),
  primary key (member_id, dept)
);
create index member_departments_dept_idx on public.member_departments (dept);

-- ---------------------------------------------------------------------
-- Attendance (session-first, every active member gets a row)
-- ---------------------------------------------------------------------
create table public.attendance_sessions (
  id            uuid primary key default gen_random_uuid(),
  session_type  public.session_type not null,
  -- owning department is fixed by the session type
  dept          text generated always as (
                  case session_type
                    when 'mezmur'  then 'mezmur'
                    when 'wereb'   then 'mezmur'
                    when 'course'  then 'education'
                    when 'abnet'   then 'education'
                    when 'meeting' then 'hr'
                  end) stored,
  session_date  date not null,
  session_time  time,
  notes         text,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (session_type, session_date, session_time)
);
create index attendance_sessions_date_idx on public.attendance_sessions (session_date desc);
create trigger trg_attendance_sessions_updated before update on public.attendance_sessions
  for each row execute function public.set_updated_at();

create table public.attendance (
  session_id  uuid not null references public.attendance_sessions (id) on delete cascade,
  member_id   uuid not null references public.members (id) on delete cascade,
  status      public.attendance_status not null default 'absent',
  primary key (session_id, member_id)
);
create index attendance_member_idx on public.attendance (member_id);

-- ---------------------------------------------------------------------
-- Scheduling (መርሓ ግብራት)
-- ---------------------------------------------------------------------
create table public.events (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  event_date   date not null,
  event_time   time not null,
  dept         text not null references public.departments (code),  -- requesting dept
  status       public.event_status not null default 'pending',
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  decided_by   uuid references auth.users (id) on delete set null,
  decided_at   timestamptz
);
create index events_date_idx on public.events (event_date, event_time);

-- ---------------------------------------------------------------------
-- Duty roster (የአባላት ምደባ) — 4 contributing departments
-- ---------------------------------------------------------------------
create table public.duty_assignments (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members (id) on delete cascade,
  dept         text not null references public.departments (code)
               check (dept in ('mezmur', 'hr', 'development', 'education')),
  duty         text not null,
  duty_date    date not null,
  occasion     text not null,
  assigned_by  uuid references auth.users (id) on delete set null,
  assigned_at  timestamptz not null default now()
);
create index duty_assignments_date_idx on public.duty_assignments (duty_date);

-- ---------------------------------------------------------------------
-- Content: songs, ወረብ, ታሪካችን, marquee photos, assignees
-- Media columns hold storage object paths, not base64.
-- ---------------------------------------------------------------------
create table public.songs (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text,
  category    text not null,
  audio_path  text,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_songs_updated before update on public.songs
  for each row execute function public.set_updated_at();

create table public.wereb_items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text,
  audio_path  text,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_wereb_items_updated before update on public.wereb_items
  for each row execute function public.set_updated_at();

create table public.history_items (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,
  media_type  public.media_type not null,
  media_path  text not null,
  caption     text,
  item_date   date,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.event_photos (
  id          uuid primary key default gen_random_uuid(),
  caption     text,
  image_path  text not null,
  sort        int not null default 0,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.dept_assignees (
  dept        text primary key references public.departments (code),
  full_name   text not null,
  sex         public.sex not null,
  photo_path  text,
  user_id     uuid references public.staff_profiles (user_id) on delete set null,
  updated_at  timestamptz not null default now()
);
create trigger trg_dept_assignees_updated before update on public.dept_assignees
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Education
-- ---------------------------------------------------------------------
create table public.abnet_sessions (
  id        uuid primary key default gen_random_uuid(),
  subjects  text[] not null default '{}',
  days      smallint[] not null default '{}',   -- 0=Sunday … 6=Saturday
  times     text[] not null default '{}',
  teacher   text not null,
  created_at timestamptz not null default now()
);

create table public.course_sessions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  class_name  text,
  teacher     text,
  days        smallint[] not null default '{}',
  created_at  timestamptz not null default now()
);

create table public.edu_plan (
  id               uuid primary key default gen_random_uuid(),
  course_name      text not null,
  class_name       text,
  start_date       date,
  mid_exam_date    date,
  mid_mark         numeric(5,2) default 30,
  final_exam_date  date,
  final_mark       numeric(5,2) default 50,
  notebook_mark    numeric(5,2),
  attendance_mark  numeric(5,2),
  teacher          text,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Public schedules managed by ጽሕፈት ቤት
-- ---------------------------------------------------------------------
create table public.mahiberat (
  id                uuid primary key default gen_random_uuid(),
  association_name  text not null,
  event_date        date not null,
  event_time        time,
  rescheduled       boolean not null default false,
  created_at        timestamptz not null default now()
);

create table public.prayer_schedule (
  id       uuid primary key default gen_random_uuid(),
  program  text not null,
  days     smallint[] not null default '{}',
  times    text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Property & inventory
--   dept_property : fixed assets, written by ጽሕፈት ቤት (any dept) and
--                   ሒሳብና ንብረት (its own). Collateral Report reads this.
--   sale_items    : ልማትና በጎ አድራጎት resale stock (the shop).
-- (Splits the prototype's outreach_items/property into two clear tables.)
-- ---------------------------------------------------------------------
create table public.dept_property (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  qty         int  not null default 1 check (qty >= 0),
  price       numeric(12,2) check (price >= 0),
  condition   public.item_condition not null default 'new',
  owner_dept  text not null references public.departments (code),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index dept_property_owner_idx on public.dept_property (owner_dept);
create trigger trg_dept_property_updated before update on public.dept_property
  for each row execute function public.set_updated_at();

create table public.sale_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  qty         int  not null default 0 check (qty >= 0),
  price       numeric(12,2) check (price >= 0),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_sale_items_updated before update on public.sale_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Money
-- ---------------------------------------------------------------------
create table public.money_requests (
  id            uuid primary key default gen_random_uuid(),
  dept          text not null references public.departments (code),
  amount        numeric(12,2) not null check (amount > 0),
  reason        text not null,
  needed_by     date,
  status        public.money_status not null default 'pending',
  audit_flag    boolean not null default false,
  audit_note    text,
  requested_by  uuid references auth.users (id) on delete set null,
  requested_at  timestamptz not null default now(),
  decided_by    uuid references auth.users (id) on delete set null,
  decided_at    timestamptz,
  paid_by       uuid references auth.users (id) on delete set null,
  paid_at       timestamptz
);
create index money_requests_dept_idx on public.money_requests (dept, status);

-- ወጪ ሪፖርት line items. ተመላሽ / ከራስ ወጪ are NEVER stored — see view below.
create table public.expense_lines (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.money_requests (id) on delete cascade,
  amount      numeric(12,2) not null check (amount > 0),
  reason      text not null,
  spent_on    date not null,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index expense_lines_request_idx on public.expense_lines (request_id);

create table public.earnings (
  id            uuid primary key default gen_random_uuid(),
  dept          text not null references public.departments (code),
  amount        numeric(12,2) not null check (amount > 0),
  source        text not null,
  earned_on     date not null,
  status        public.earning_status not null default 'pending',
  submitted_by  uuid references auth.users (id) on delete set null,
  submitted_at  timestamptz not null default now(),
  decided_by    uuid references auth.users (id) on delete set null,
  decided_at    timestamptz
);
create index earnings_dept_idx on public.earnings (dept, status);

-- ---------------------------------------------------------------------
-- Feedback (public submit; submitter must be a registered member)
-- ---------------------------------------------------------------------
create table public.feedback (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members (id) on delete cascade,
  dept        text not null references public.departments (code),
  message     text not null check (length(message) between 1 and 4000),
  contact     text,                                   -- telegram username or phone
  status      public.feedback_status not null default 'unseen',
  seen_by     uuid references auth.users (id) on delete set null,
  seen_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index feedback_dept_idx on public.feedback (dept, status);
