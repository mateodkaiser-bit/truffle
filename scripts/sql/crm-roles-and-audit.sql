-- CRM hardening: importer role, narrower delete rights, audit log. Proposed 2026-11-02.
--
-- Not applied yet. Migrations in this project are applied by Lovable: ask Lovable to apply this file
-- as a migration (or paste it into the backend's SQL editor). Lovable then commits its own copy under
-- supabase/migrations; this proposal can be deleted after that.
--
-- What it changes
-- 1. A team-link device (crm_link_members) gets a label and a role: 'member' (default, a person's
--    phone or laptop) or 'importer' (a script on a Mac, see scripts/crm-session.ts).
-- 2. Importers can read, add and update, but delete only untouched pipeline leads (external_ref
--    'lead:%', stage researched or enriched): the import folds duplicate leads, nothing more.
--    They cannot delete contacts or interactions. People keep full rights.
-- 3. Every insert, update and delete on organizations, contacts and interactions is logged in
--    crm_audit (who, when, which row, which fields changed). Team members can read it; nobody can
--    edit it from the app.
--
-- After applying: mark the import session as importer. `bun scripts/crm-session.ts status` prints
-- its user id; then
--   update public.crm_link_members set role = 'importer', label = 'Import script, Mateo''s Mac'
--   where user_id = '<user id>';
-- Revoke a device or script at any time:
--   delete from public.crm_link_members where user_id = '<user id>';
-- Rotate the team link (every device then has to rejoin; the stored import session keeps working
-- because it is already a member):
--   update public.crm_join_secret set secret_hash = encode(sha256(convert_to('<new secret>', 'UTF8')), 'hex');

alter table public.crm_link_members
  add column if not exists label text,
  add column if not exists role text not null default 'member';
alter table public.crm_link_members drop constraint if exists crm_link_members_role_check;
alter table public.crm_link_members
  add constraint crm_link_members_role_check check (role in ('member', 'importer'));

-- True for people (team emails and member devices), false for importer sessions and outsiders.
create or replace function public.is_crm_person()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.crm_team
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  ) or exists (
    select 1 from public.crm_link_members where user_id = auth.uid() and role = 'member'
  );
$$;
revoke all on function public.is_crm_person() from public;
grant execute on function public.is_crm_person() to authenticated;

-- Organisations: everyone on the team reads and writes; deleting is for people, or an importer
-- removing an untouched pipeline lead.
drop policy if exists "team all organizations" on public.organizations;
create policy "team reads organizations" on public.organizations
  for select to authenticated using (public.is_crm_member());
create policy "team adds organizations" on public.organizations
  for insert to authenticated with check (public.is_crm_member());
create policy "team updates organizations" on public.organizations
  for update to authenticated using (public.is_crm_member()) with check (public.is_crm_member());
create policy "people or importer lead cleanup delete organizations" on public.organizations
  for delete to authenticated using (
    public.is_crm_person()
    or (public.is_crm_member() and external_ref like 'lead:%' and stage in ('researched', 'enriched'))
  );

drop policy if exists "team all contacts" on public.contacts;
create policy "team reads contacts" on public.contacts
  for select to authenticated using (public.is_crm_member());
create policy "team adds contacts" on public.contacts
  for insert to authenticated with check (public.is_crm_member());
create policy "team updates contacts" on public.contacts
  for update to authenticated using (public.is_crm_member()) with check (public.is_crm_member());
create policy "people delete contacts" on public.contacts
  for delete to authenticated using (public.is_crm_person());

drop policy if exists "team all interactions" on public.interactions;
create policy "team reads interactions" on public.interactions
  for select to authenticated using (public.is_crm_member());
create policy "team adds interactions" on public.interactions
  for insert to authenticated with check (public.is_crm_member());
create policy "team updates interactions" on public.interactions
  for update to authenticated using (public.is_crm_member()) with check (public.is_crm_member());
create policy "people delete interactions" on public.interactions
  for delete to authenticated using (public.is_crm_person());

-- Audit log
create table if not exists public.crm_audit (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id uuid,
  email text,
  table_name text not null,
  row_id uuid,
  action text not null,
  changed jsonb not null default '{}'
);
create index if not exists crm_audit_row on public.crm_audit (table_name, row_id, at desc);
alter table public.crm_audit enable row level security;
revoke all on public.crm_audit from anon, authenticated;
grant select on public.crm_audit to authenticated;
grant all on public.crm_audit to service_role;
create policy "team reads audit" on public.crm_audit
  for select to authenticated using (public.is_crm_member());

create or replace function public.crm_audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  diff jsonb := '{}';
begin
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(n.key, n.value), '{}') into diff
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value and n.key <> 'updated_at';
    if diff = '{}' then
      return new;
    end if;
  elsif tg_op = 'INSERT' then
    diff := jsonb_build_object('created', true);
  else
    diff := to_jsonb(old);
  end if;
  insert into public.crm_audit (user_id, email, table_name, row_id, action, changed)
  values (auth.uid(), auth.jwt() ->> 'email', tg_table_name,
          case when tg_op = 'DELETE' then old.id else new.id end, tg_op, diff);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists crm_audit_organizations on public.organizations;
create trigger crm_audit_organizations after insert or update or delete on public.organizations
  for each row execute function public.crm_audit_row();
drop trigger if exists crm_audit_contacts on public.contacts;
create trigger crm_audit_contacts after insert or update or delete on public.contacts
  for each row execute function public.crm_audit_row();
drop trigger if exists crm_audit_interactions on public.interactions;
create trigger crm_audit_interactions after insert or update or delete on public.interactions
  for each row execute function public.crm_audit_row();
