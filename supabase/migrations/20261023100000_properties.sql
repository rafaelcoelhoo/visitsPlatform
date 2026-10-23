-- =============================================================================
-- 20261023100000_properties
-- properties, property_images (slot 1..8 + padrão reservar -> carregar -> confirmar),
-- public.reserve_property_image(), bucket privado 'property-images' e políticas de Storage.
--
-- O limite de 8 fotos é garantido pelo Postgres (check + unique (property_id, slot)),
-- não por contagem. Dados em falta são NULL, nunca 0 nem ''.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------
create table public.properties (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  created_by          uuid default auth.uid() references auth.users (id) on delete set null,
  title               text not null check (length(btrim(title)) between 1 and 120),
  price_eur           numeric(12, 2) check (price_eur is null or price_eur > 0),
  location_text       text check (location_text is null or length(btrim(location_text)) between 1 and 200),
  typology            text check (typology is null or typology ~ '^T[0-9]{1,2}$'),
  area_m2             numeric(8, 2) check (area_m2 is null or area_m2 > 0),
  monthly_charges_eur numeric(10, 2) check (monthly_charges_eur is null or monthly_charges_eur >= 0),
  archived_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, organization_id)  -- alvo da FK composta de property_images
);

create index properties_organization_id_idx on public.properties (organization_id, created_at desc);

create trigger properties_touch_updated_at
  before update on public.properties
  for each row execute function app.touch_updated_at();

create table public.property_images (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null,
  organization_id uuid not null,
  slot            smallint not null check (slot between 1 and 8),
  -- Determinístico e não forjável: {org}/{property}/{id}.webp
  storage_path    text generated always as (
                    organization_id::text || '/' || property_id::text || '/' || id::text || '.webp'
                  ) stored,
  status          text not null default 'pending' check (status in ('pending', 'ready')),
  created_at      timestamptz not null default now(),
  unique (property_id, slot),
  unique (storage_path),
  foreign key (property_id, organization_id)
    references public.properties (id, organization_id) on delete cascade
);

create index property_images_property_id_idx on public.property_images (property_id);
create index property_images_organization_id_idx on public.property_images (organization_id);
-- Suporta o job de limpeza (linhas pending antigas).
create index property_images_pending_created_at_idx on public.property_images (created_at) where status = 'pending';

-- -----------------------------------------------------------------------------
-- Funções
-- -----------------------------------------------------------------------------
-- Só confirma (pending -> ready) se o ficheiro existe mesmo no bucket, como WebP.
-- Usa old.storage_path: num BEFORE trigger as colunas geradas ainda não foram recalculadas (o caminho é imutável).
-- A validação do conteúdo real (magic bytes) é feita na Edge Function (etapa 4b).
create function app.property_images_confirm_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

create trigger property_images_confirm_guard
  before update on public.property_images
  for each row execute function app.property_images_confirm_guard();

-- Reserva o primeiro slot livre. INVOKER: o RLS do chamador aplica-se (um imóvel de outra org "não existe").
-- Cada tentativa corre numa subtransação; sob concorrência, quem perde recebe unique_violation e tenta o seguinte.
create function public.reserve_property_image(p_property_id uuid)
returns public.property_images
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_row public.property_images;
begin
  select p.organization_id into v_org from public.properties p where p.id = p_property_id;
  if v_org is null then
    raise exception 'property_not_found' using errcode = 'P0002';
  end if;

  for v_slot in 1..8 loop
    begin
      insert into public.property_images (property_id, organization_id, slot)
      values (p_property_id, v_org, v_slot)
      returning * into v_row;
      return v_row;
    exception when unique_violation then
      null;
    end;
  end loop;

  raise exception 'photo_limit_reached' using errcode = '53400';
end
$$;

revoke execute on function app.property_images_confirm_guard() from public, anon, authenticated;
revoke execute on function public.reserve_property_image(uuid) from public, anon;
grant execute on function public.reserve_property_image(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Privilégios
-- -----------------------------------------------------------------------------
revoke all on public.properties, public.property_images from anon, authenticated;

-- Sem DELETE: arquivar (archived_at). Apagar imóveis/fotos passa por Edge Function (valida permissão e limpa o Storage).
grant select on public.properties to authenticated;
grant insert (organization_id, title, price_eur, location_text, typology, area_m2, monthly_charges_eur)
  on public.properties to authenticated;
grant update (title, price_eur, location_text, typology, area_m2, monthly_charges_eur, archived_at)
  on public.properties to authenticated;

grant select on public.property_images to authenticated;
grant insert (property_id, organization_id, slot) on public.property_images to authenticated;
grant update (status) on public.property_images to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.properties      enable row level security;
alter table public.property_images enable row level security;

create policy properties_select_org on public.properties
  for select to authenticated
  using ( organization_id = any ((select app.user_org_ids())::uuid[]) );

create policy properties_insert_org on public.properties
  for insert to authenticated
  with check ( organization_id = any ((select app.user_org_ids())::uuid[]) );

create policy properties_update_org on public.properties
  for update to authenticated
  using      ( organization_id = any ((select app.user_org_ids())::uuid[]) )
  with check ( organization_id = any ((select app.user_org_ids())::uuid[]) );

create policy property_images_select_org on public.property_images
  for select to authenticated
  using ( organization_id = any ((select app.user_org_ids())::uuid[]) );

create policy property_images_insert_org on public.property_images
  for insert to authenticated
  with check ( status = 'pending' and organization_id = any ((select app.user_org_ids())::uuid[]) );

-- Só se confirma o que está pending, e só para ready.
create policy property_images_confirm_org on public.property_images
  for update to authenticated
  using      ( status = 'pending' and organization_id = any ((select app.user_org_ids())::uuid[]) )
  with check ( status = 'ready'   and organization_id = any ((select app.user_org_ids())::uuid[]) );

-- -----------------------------------------------------------------------------
-- Storage: bucket PRIVADO. Limite de tamanho e tipo declarado nas regras do bucket.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-images', 'property-images', false, 1048576, array['image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Só se lê/escreve um objeto que corresponda a uma reserva da própria org.
-- Sem políticas de UPDATE/DELETE para clientes: apagar é na Edge Function (service_role).
create policy property_images_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'property-images'
    and exists (
      select 1 from public.property_images i
      where i.storage_path = name
        and i.organization_id = any ((select app.user_org_ids())::uuid[])
    )
  );

create policy property_images_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'property-images'
    and exists (
      select 1 from public.property_images i
      where i.storage_path = name
        and i.status = 'pending'
        and i.organization_id = any ((select app.user_org_ids())::uuid[])
    )
  );
