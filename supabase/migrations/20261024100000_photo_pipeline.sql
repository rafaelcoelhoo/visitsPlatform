-- =============================================================================
-- 20261024100000_photo_pipeline
-- 1) A confirmação (pending -> ready) passa a ser exclusiva da Edge Function (service_role),
--    depois de validar os magic bytes. O cliente da API deixa de a poder fazer.
-- 2) Funções de administração para a reconciliação (só service_role).
-- 3) Agendamento: pg_cron -> pg_net -> Edge Function, com segredos no Vault.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Sem UPDATE de status pelo cliente
-- -----------------------------------------------------------------------------
drop policy property_images_confirm_org on public.property_images;
revoke update (status) on public.property_images from authenticated;
revoke update on public.property_images from authenticated;

-- Uma foto confirmada nunca regride a pending (nem pelo service_role).
create or replace function app.property_images_confirm_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'ready' and new.status = 'pending' then
    raise exception 'status_regression' using errcode = '55000';
  end if;
  if new.status = 'ready' and old.status = 'pending' and not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'property-images'
      and o.name = old.storage_path
      and o.metadata ->> 'mimetype' = 'image/webp'
  ) then
    raise exception 'upload_not_found' using errcode = '55000';
  end if;
  return new;
end
$$;

-- -----------------------------------------------------------------------------
-- 2) Funções de reconciliação
-- -----------------------------------------------------------------------------
-- Apaga as reservas pending antigas (libertando os slots) e devolve os caminhos para a função apagar os ficheiros.
create function public.admin_expire_pending_images(p_older_than interval default interval '1 hour')
returns table (storage_path text)
language sql
security invoker
set search_path = ''
as $$
  delete from public.property_images i
  where i.status = 'pending'
    and i.created_at < pg_catalog.now() - p_older_than
  returning i.storage_path
$$;

-- Objetos do bucket sem linha correspondente (ex.: imóvel apagado, reserva expirada, upload sem reserva por service_role).
-- DEFINER porque lê storage.objects; a execução fica restrita a service_role.
create function app.orphan_property_objects(p_older_than interval)
returns table (name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'property-images'
    and o.created_at < pg_catalog.now() - p_older_than
    and not exists (select 1 from public.property_images i where i.storage_path = o.name)
$$;

create function public.admin_orphan_property_objects(p_older_than interval default interval '1 hour')
returns table (name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from app.orphan_property_objects(p_older_than)
$$;

revoke execute on function public.admin_expire_pending_images(interval) from public, anon, authenticated;
revoke execute on function app.orphan_property_objects(interval) from public, anon, authenticated;
revoke execute on function public.admin_orphan_property_objects(interval) from public, anon, authenticated;
grant execute on function public.admin_expire_pending_images(interval) to service_role;
grant execute on function app.orphan_property_objects(interval) to service_role;
grant execute on function public.admin_orphan_property_objects(interval) to service_role;

-- -----------------------------------------------------------------------------
-- 3) Agendamento (pg_cron -> pg_net -> Edge Function)
-- Segredos no Vault (nunca no código nem em tabelas normais):
--   functions_base_url  -> ex.: https://<ref>.supabase.co/functions/v1
--   reconcile_secret    -> segredo dedicado e aleatório (não a service_role), igual a RECONCILE_SECRET da função
-- Sem estes segredos o job não faz nada.
-- -----------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create function app.invoke_reconcile_property_images()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  select ds.decrypted_secret into v_url from vault.decrypted_secrets ds where ds.name = 'functions_base_url';
  select ds.decrypted_secret into v_secret from vault.decrypted_secrets ds where ds.name = 'reconcile_secret';

  if v_url is null or v_secret is null then
    raise warning 'reconcile-property-images: segredos do Vault em falta, job ignorado';
    return null;
  end if;

  return net.http_post(
    url     := v_url || '/reconcile-property-images',
    headers := pg_catalog.jsonb_build_object('Content-Type', 'application/json', 'x-reconcile-secret', v_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end
$$;

revoke execute on function app.invoke_reconcile_property_images() from public, anon, authenticated;

select cron.schedule('reconcile-property-images', '*/15 * * * *', $$select app.invoke_reconcile_property_images()$$);
