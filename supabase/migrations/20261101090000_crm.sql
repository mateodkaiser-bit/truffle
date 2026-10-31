-- Truffle CRM: organisations, contacts, interactions, behind a team allowlist.
-- Holds personal B2B contact data, so nothing here is readable without a signed-in
-- team member. The public site (contact_submissions) is untouched.

create type public.crm_org_type as enum (
  'restaurant', 'supplier', 'wholesaler', 'accountant', 'pos_vendor',
  'accounting_vendor', 'association', 'other'
);

create type public.crm_stage as enum (
  'researched', 'enriched', 'contacted', 'responded', 'in_conversation',
  'pilot_partner', 'declined'
);

create type public.crm_channel as enum ('email', 'call', 'visit', 'form', 'dm', 'meeting');
create type public.crm_direction as enum ('out', 'in');

-- Team allowlist. Rows are added by hand in SQL, never from the app.
create table public.crm_team (
  email text primary key check (email = lower(email)),
  name text,
  created_at timestamptz not null default now()
);

create or replace function public.is_crm_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.crm_team
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_crm_member() from public;
grant execute on function public.is_crm_member() to authenticated;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  -- Stable key for idempotent imports, e.g. 'supplier:meeuwig', 'permit:gmb-2025-471324', 'spotmapper:123'.
  external_ref text unique,
  name text not null,
  type public.crm_org_type not null default 'restaurant',
  stage public.crm_stage not null default 'researched',
  declined_reason text,
  category text,
  city text,
  address text,
  postcode text,
  lat double precision,
  lon double precision,
  website text,
  instagram text,
  phone text,
  email text,
  opening_hours text,
  size_note text,
  tags text[] not null default '{}',
  source text,
  opened_year int,
  pos_hint text,
  owner_name text,
  hook text,
  notes text,
  -- "Before you walk in"
  promised text,
  they_asked text,
  pitch_angle text,
  -- Current next step, kept on the organisation so the today view is one query.
  next_step text,
  next_step_due date,
  -- Existing clients and anyone else we must never contact by automation.
  do_not_contact boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organizations_stage_idx on public.organizations (stage);
create index organizations_type_idx on public.organizations (type);
create index organizations_next_step_due_idx on public.organizations (next_step_due);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text,
  role text,
  email text,
  phone text,
  linkedin text,
  notes text,
  external_ref text unique,
  created_at timestamptz not null default now()
);

create index contacts_org_id_idx on public.contacts (org_id);

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  channel public.crm_channel not null,
  direction public.crm_direction not null default 'out',
  date date not null default current_date,
  subject text,
  summary text,
  next_step text,
  next_step_due date,
  -- Team members who were there (first names, as in Spotmapper's @chips).
  people text[] not null default '{}',
  -- Stable key so re-running the import does not duplicate log rows.
  external_ref text unique,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index interactions_org_id_idx on public.interactions (org_id, date desc);

create or replace function public.crm_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_touch before update on public.organizations
  for each row execute function public.crm_touch_updated_at();

-- Row level security: team members only, for every operation.
alter table public.crm_team enable row level security;
alter table public.organizations enable row level security;
alter table public.contacts enable row level security;
alter table public.interactions enable row level security;

create policy "team reads team" on public.crm_team
  for select to authenticated using (public.is_crm_member());

create policy "team all organizations" on public.organizations
  for all to authenticated using (public.is_crm_member()) with check (public.is_crm_member());

create policy "team all contacts" on public.contacts
  for all to authenticated using (public.is_crm_member()) with check (public.is_crm_member());

create policy "team all interactions" on public.interactions
  for all to authenticated using (public.is_crm_member()) with check (public.is_crm_member());

-- anon gets nothing; authenticated still goes through the policies above.
revoke all on public.crm_team, public.organizations, public.contacts, public.interactions from anon;

-- Team emails are added after the migration, by hand, e.g.:
-- insert into public.crm_team (email, name) values ('someone@example.com', 'Name');
