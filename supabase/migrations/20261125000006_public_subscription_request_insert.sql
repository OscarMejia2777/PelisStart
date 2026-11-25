-- PelisStart migration 006: permitir que el registro guarde solicitudes de activación
-- sin necesidad de SUPABASE_SERVICE_ROLE_KEY (y sin crear/enviar correos de Auth).

-- El formulario público solo puede insertar solicitudes pendientes y sin user_id.
-- La lectura y la activación siguen reservadas al Superadmin.
create policy "Public can submit pending subscription requests"
  on public.subscription_requests for insert
  to anon, authenticated
  with check (status = 'pending' and user_id is null);
