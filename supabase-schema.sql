-- Run once in the Supabase SQL Editor. Staff are added explicitly by the owner.
create table public.sochill_staff (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.sochill_staff enable row level security;
revoke all on public.sochill_staff from anon, authenticated;
grant select on public.sochill_staff to authenticated;
create policy staff_read_self on public.sochill_staff for select to authenticated using (user_id = (select auth.uid()));

create table public.sochill_profiles (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (length(trim(nickname)) between 1 and 100),
  phone text not null default '',
  profile jsonb not null check (jsonb_typeof(profile) = 'object' and octet_length(profile::text) < 100000),
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.sochill_profiles enable row level security;
revoke all on public.sochill_profiles from anon, authenticated;
grant select, insert, update, delete on public.sochill_profiles to authenticated;
create policy staff_profiles on public.sochill_profiles for all to authenticated
using (exists(select 1 from public.sochill_staff where user_id = (select auth.uid())))
with check (exists(select 1 from public.sochill_staff where user_id = (select auth.uid())));
create function public.sochill_revision() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if TG_OP = 'UPDATE' then new.revision := old.revision + 1;
  else new.revision := 1; end if;
  return new;
end;
$$;
create trigger sochill_revision before insert or update on public.sochill_profiles
for each row execute function public.sochill_revision();

-- No-login mode: anyone with the app link and public key can read, change and delete every profile.
grant select, insert, update, delete on public.sochill_profiles to anon;
create policy anon_profiles on public.sochill_profiles for all to anon using (true) with check (true);

-- To require a login again, undo no-login mode:
-- drop policy anon_profiles on public.sochill_profiles;
-- revoke all on public.sochill_profiles from anon;
