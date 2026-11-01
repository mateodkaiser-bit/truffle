-- Team join link: opening /crm#join=<secret> signs a device in anonymously and, if the secret
-- matches, adds that device to the team. Only a SHA-256 hash of the secret is stored.
create table public.crm_join_secret (
  id int primary key default 1 check (id = 1),
  secret_hash text not null,
  created_at timestamptz not null default now()
);
grant all on public.crm_join_secret to service_role;
alter table public.crm_join_secret enable row level security;
revoke all on public.crm_join_secret from anon, authenticated;

create table public.crm_link_members (
  user_id uuid primary key,
  joined_at timestamptz not null default now()
);
grant all on public.crm_link_members to service_role;
alter table public.crm_link_members enable row level security;
revoke all on public.crm_link_members from anon, authenticated;

create or replace function public.join_crm(secret text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or secret is null or length(secret) < 20 then
    return false;
  end if;
  if not exists (
    select 1 from public.crm_join_secret
    where secret_hash = encode(sha256(convert_to(secret, 'UTF8')), 'hex')
  ) then
    return false;
  end if;
  insert into public.crm_link_members (user_id) values (auth.uid()) on conflict do nothing;
  return true;
end;
$$;
revoke all on function public.join_crm(text) from public;
grant execute on function public.join_crm(text) to authenticated;

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
  ) or exists (
    select 1 from public.crm_link_members where user_id = auth.uid()
  );
$$;
revoke all on function public.is_crm_member() from public;
grant execute on function public.is_crm_member() to authenticated;