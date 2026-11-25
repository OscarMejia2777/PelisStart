-- PelisStart migration 004: pending subscription approval workflow for new signups

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check check (status in ('active', 'pending', 'blocked'));
alter table public.profiles alter column status set default 'pending';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_username text;
begin
  v_username := nullif(
    regexp_replace(lower(trim(coalesce(new.raw_user_meta_data ->> 'username', ''))), '[^a-z0-9._-]', '', 'g'),
    ''
  );
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    v_username,
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Cinéfilo'
  );
  insert into public.profiles (user_id, display_name, email, auth_email, username, role, status)
  values (
    new.id,
    left(v_name, 80),
    case when coalesce(new.raw_user_meta_data ->> 'username_only', '') = 'true' then '' else left(coalesce(new.email, ''), 200) end,
    left(coalesce(new.email, ''), 200),
    left(v_username, 32),
    'user',
    'pending'
  )
  on conflict (user_id) do update
    set auth_email = case when length(excluded.auth_email) > 0 then excluded.auth_email else public.profiles.auth_email end,
        username = coalesce(excluded.username, public.profiles.username),
        email = case when length(excluded.email) > 0 then excluded.email else public.profiles.email end;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
