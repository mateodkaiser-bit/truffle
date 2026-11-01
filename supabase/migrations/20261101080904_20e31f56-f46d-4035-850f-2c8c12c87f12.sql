-- Table privileges for the CRM. Access is still limited by the RLS policies (is_crm_member()).
grant select, insert, update, delete on public.organizations, public.contacts, public.interactions to authenticated;
grant select on public.crm_team to authenticated;
grant all on public.crm_team, public.organizations, public.contacts, public.interactions to service_role;