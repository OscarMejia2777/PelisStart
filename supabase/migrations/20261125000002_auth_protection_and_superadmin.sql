-- PelisStart migration 002: mandatory auth roles, account status, superadmin helpers & policies

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.profiles
  add column if not exists email text not null default '',
  add column if not exists role text not null default 'user' check (role in ('user', 'superadmin')),
  add column if not exists status text not null default 'active' check (status in ('active', 'blocked')),
  add column if not exists last_seen_at timestamptz not null default now();

create index if not exists idx_profiles_role_status
  on public.profiles (role, status);

-- Private helper outside exposed public schema so advisors stay clean
create or replace function private.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
      and role = 'superadmin'
      and status = 'active'
  );
$$;

revoke all on function private.is_superadmin() from public;
grant execute on function private.is_superadmin() to authenticated;

-- Prevent regular users from escalating role or unblocking themselves
create or replace function private.protect_profile_role_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Allow SQL/postgres maintenance or active superadmin
  if current_user in ('postgres', 'supabase_admin', 'service_role') or private.is_superadmin() then
    if old.role = 'superadmin' and (new.role <> 'superadmin' or new.status <> 'active') then
      if (
        select count(*)
        from public.profiles
        where role = 'superadmin' and status = 'active' and user_id <> old.user_id
      ) = 0 then
        raise exception 'No se puede degradar ni bloquear al único superadmin activo.';
      end if;
    end if;
    return new;
  end if;

  if new.role is distinct from old.role or new.status is distinct from old.status then
    raise exception 'Solo un superadmin puede modificar el rol o estado de la cuenta.';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_profile_role_status() from public;

create trigger trg_protect_profile_role_status
  before update on public.profiles
  for each row execute function private.protect_profile_role_status();

-- Keep email synced on new signups
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Cinéfilo'
  );
  insert into public.profiles (user_id, display_name, email, role, status)
  values (
    new.id,
    left(v_name, 80),
    left(coalesce(new.email, ''), 200),
    'user',
    'active'
  )
  on conflict (user_id) do update
    set email = case when length(excluded.email) > 0 then excluded.email else public.profiles.email end;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Superadmin read/manage policies across profiles & activity stats
create policy "Superadmin can view all profiles"
  on public.profiles for select
  to authenticated
  using (private.is_superadmin());

create policy "Superadmin can update all profiles"
  on public.profiles for update
  to authenticated
  using (private.is_superadmin())
  with check (private.is_superadmin());

create policy "Superadmin can view all favorites"
  on public.user_favorites for select
  to authenticated
  using (private.is_superadmin());

create policy "Superadmin can delete user favorites"
  on public.user_favorites for delete
  to authenticated
  using (private.is_superadmin());

create policy "Superadmin can view all watch history"
  on public.user_watch_history for select
  to authenticated
  using (private.is_superadmin());

create policy "Superadmin can delete user watch history"
  on public.user_watch_history for delete
  to authenticated
  using (private.is_superadmin());

create policy "Superadmin can view all advent progress"
  on public.user_advent_progress for select
  to authenticated
  using (private.is_superadmin());

create policy "Superadmin can delete user advent progress"
  on public.user_advent_progress for delete
  to authenticated
  using (private.is_superadmin());
