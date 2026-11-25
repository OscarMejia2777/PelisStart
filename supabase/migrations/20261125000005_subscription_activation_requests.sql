-- PelisStart migration 005: subscription activation requests (datos de registro enviados a Soporte)

create table if not exists public.subscription_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null default '',
  username text,
  display_name text,
  status text not null default 'pending' check (status in ('pending', 'active', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscription_requests enable row level security;

create unique index if not exists idx_subscription_requests_user_id
  on public.subscription_requests (user_id)
  where user_id is not null;

create index if not exists idx_subscription_requests_status
  on public.subscription_requests (status, created_at desc);

-- Superadmin (panel de Soporte) puede ver y activar las solicitudes
create policy "Superadmin can view subscription requests"
  on public.subscription_requests for select
  to authenticated
  using (private.is_superadmin());

create policy "Superadmin can update subscription requests"
  on public.subscription_requests for update
  to authenticated
  using (private.is_superadmin())
  with check (private.is_superadmin());
