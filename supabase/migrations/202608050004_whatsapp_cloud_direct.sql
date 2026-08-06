-- v5.2.0 — integração direta por organização com a WhatsApp Cloud API.
-- O token é criptografado pela Edge Function antes de chegar ao banco.

create table if not exists public.crm_whatsapp_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  waba_id text not null,
  phone_number_id text not null,
  display_phone_number text not null default '',
  verified_name text not null default '',
  graph_api_version text not null default 'v25.0',
  access_token_ciphertext text not null,
  token_last_four text not null,
  status text not null default 'connected',
  active boolean not null default true,
  quality_rating text null,
  last_verified_at timestamptz null,
  last_test_at timestamptz null,
  last_message_at timestamptz null,
  last_error text null,
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint crm_whatsapp_integrations_org_unique unique (organization_id),
  constraint crm_whatsapp_integrations_phone_unique unique (phone_number_id),
  constraint crm_whatsapp_integrations_waba_check check (waba_id ~ '^\d+$'),
  constraint crm_whatsapp_integrations_phone_id_check check (phone_number_id ~ '^\d+$'),
  constraint crm_whatsapp_integrations_graph_version_check
    check (graph_api_version ~ '^v\d+\.\d+$'),
  constraint crm_whatsapp_integrations_token_last_four_check
    check (char_length(token_last_four) = 4),
  constraint crm_whatsapp_integrations_status_check
    check (status in ('connected', 'attention', 'disconnected'))
);

create index if not exists crm_whatsapp_integrations_org_status_idx
  on public.crm_whatsapp_integrations (organization_id, status);

alter table public.crm_whatsapp_integrations enable row level security;
revoke all on public.crm_whatsapp_integrations from anon, authenticated;
grant all on public.crm_whatsapp_integrations to service_role;

create or replace function private.assert_crm_whatsapp_admin(
  p_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Sessão não informada.' using errcode = '42501';
  end if;

  if not (
    private.is_platform_admin()
    or private.has_permission(
      p_organization_id,
      'integrations.manage'
    )
  ) then
    raise exception
      'Você não possui permissão para administrar o WhatsApp desta empresa.'
      using errcode = '42501';
  end if;
end;
$function$;

create or replace function public.list_crm_whatsapp_integrations(
  p_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  perform private.assert_crm_whatsapp_admin(p_organization_id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', integration.id,
        'organization_id', integration.organization_id,
        'provider', 'whatsapp',
        'name', 'WhatsApp Cloud API',
        'description', 'Atendimento direto pela API oficial da Meta.',
        'status', case
          when integration.active = false then 'disconnected'
          else integration.status
        end,
        'account_label', coalesce(
          nullif(integration.display_phone_number, ''),
          integration.phone_number_id
        ),
        'endpoint', '/functions/v1/whatsapp-cloud-webhook',
        'secret_masked', '••••••••••••' || integration.token_last_four,
        'active', integration.active,
        'waba_id', integration.waba_id,
        'phone_number_id', integration.phone_number_id,
        'display_phone_number', integration.display_phone_number,
        'verified_name', integration.verified_name,
        'quality_rating', integration.quality_rating,
        'graph_api_version', integration.graph_api_version,
        'last_verified_at', integration.last_verified_at,
        'last_test_at', integration.last_test_at,
        'last_message_at', integration.last_message_at,
        'last_error', integration.last_error,
        'errors', case
          when integration.last_error is null then '[]'::jsonb
          else jsonb_build_array(integration.last_error)
        end,
        'created_at', integration.created_at,
        'updated_at', integration.updated_at
      )
      order by integration.created_at desc
    ),
    '[]'::jsonb
  )
  into v_result
  from public.crm_whatsapp_integrations as integration
  where integration.organization_id = p_organization_id;

  return v_result;
end;
$function$;

create or replace function public.upsert_crm_whatsapp_integration(
  p_organization_id uuid,
  p_waba_id text,
  p_phone_number_id text,
  p_display_phone_number text,
  p_verified_name text,
  p_quality_rating text,
  p_graph_api_version text,
  p_access_token_ciphertext text,
  p_token_last_four text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_existing public.crm_whatsapp_integrations%rowtype;
  v_saved public.crm_whatsapp_integrations%rowtype;
begin
  perform private.assert_crm_whatsapp_admin(p_organization_id);

  if btrim(coalesce(p_waba_id, '')) !~ '^\d+$' then
    raise exception 'O WABA ID informado é inválido.' using errcode = '22023';
  end if;

  if btrim(coalesce(p_phone_number_id, '')) !~ '^\d+$' then
    raise exception 'O Phone Number ID informado é inválido.' using errcode = '22023';
  end if;

  if btrim(coalesce(p_graph_api_version, '')) !~ '^v\d+\.\d+$' then
    raise exception 'A versão da Graph API é inválida.' using errcode = '22023';
  end if;

  select * into v_existing
  from public.crm_whatsapp_integrations
  where organization_id = p_organization_id
  for update;

  if not found and nullif(btrim(coalesce(p_access_token_ciphertext, '')), '') is null then
    raise exception 'A credencial criptografada é obrigatória na primeira conexão.'
      using errcode = '22023';
  end if;

  insert into public.crm_whatsapp_integrations (
    organization_id,
    waba_id,
    phone_number_id,
    display_phone_number,
    verified_name,
    graph_api_version,
    access_token_ciphertext,
    token_last_four,
    status,
    active,
    quality_rating,
    last_verified_at,
    last_test_at,
    last_error,
    created_by,
    updated_by
  )
  values (
    p_organization_id,
    btrim(p_waba_id),
    btrim(p_phone_number_id),
    btrim(coalesce(p_display_phone_number, '')),
    btrim(coalesce(p_verified_name, '')),
    btrim(p_graph_api_version),
    coalesce(
      nullif(btrim(coalesce(p_access_token_ciphertext, '')), ''),
      v_existing.access_token_ciphertext
    ),
    coalesce(
      nullif(btrim(coalesce(p_token_last_four, '')), ''),
      v_existing.token_last_four
    ),
    'connected',
    true,
    nullif(btrim(coalesce(p_quality_rating, '')), ''),
    now(),
    now(),
    null,
    coalesce(v_existing.created_by, v_actor),
    v_actor
  )
  on conflict (organization_id)
  do update set
    waba_id = excluded.waba_id,
    phone_number_id = excluded.phone_number_id,
    display_phone_number = excluded.display_phone_number,
    verified_name = excluded.verified_name,
    graph_api_version = excluded.graph_api_version,
    access_token_ciphertext = excluded.access_token_ciphertext,
    token_last_four = excluded.token_last_four,
    status = 'connected',
    active = true,
    quality_rating = excluded.quality_rating,
    last_verified_at = now(),
    last_test_at = now(),
    last_error = null,
    updated_by = v_actor,
    updated_at = now()
  returning * into v_saved;

  return jsonb_build_object(
    'saved', true,
    'integration_id', v_saved.id,
    'phone_number_id', v_saved.phone_number_id,
    'display_phone_number', v_saved.display_phone_number,
    'verified_name', v_saved.verified_name,
    'status', v_saved.status,
    'last_verified_at', v_saved.last_verified_at
  );
end;
$function$;

create or replace function public.mark_crm_whatsapp_integration_test(
  p_organization_id uuid,
  p_display_phone_number text,
  p_verified_name text,
  p_quality_rating text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
begin
  perform private.assert_crm_whatsapp_admin(p_organization_id);

  update public.crm_whatsapp_integrations
  set
    display_phone_number = coalesce(
      nullif(btrim(coalesce(p_display_phone_number, '')), ''),
      display_phone_number
    ),
    verified_name = coalesce(
      nullif(btrim(coalesce(p_verified_name, '')), ''),
      verified_name
    ),
    quality_rating = coalesce(
      nullif(btrim(coalesce(p_quality_rating, '')), ''),
      quality_rating
    ),
    status = 'connected',
    active = true,
    last_verified_at = now(),
    last_test_at = now(),
    last_error = null,
    updated_by = auth.uid(),
    updated_at = now()
  where organization_id = p_organization_id
  returning id into v_id;

  if v_id is null then
    raise exception 'A integração WhatsApp ainda não foi configurada.'
      using errcode = '22023';
  end if;

  return jsonb_build_object(
    'tested', true,
    'integration_id', v_id,
    'status', 'connected',
    'tested_at', now()
  );
end;
$function$;

create or replace function public.disconnect_crm_whatsapp_integration(
  p_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
begin
  perform private.assert_crm_whatsapp_admin(p_organization_id);

  update public.crm_whatsapp_integrations
  set
    active = false,
    status = 'disconnected',
    last_error = null,
    updated_by = auth.uid(),
    updated_at = now()
  where organization_id = p_organization_id
  returning id into v_id;

  if v_id is null then
    raise exception 'A integração WhatsApp não foi encontrada.'
      using errcode = '22023';
  end if;

  return jsonb_build_object(
    'disconnected', true,
    'integration_id', v_id
  );
end;
$function$;

create or replace function public.mark_crm_whatsapp_direct_transport(
  p_organization_id uuid,
  p_message_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $function$
  update public.messages
  set metadata =
    coalesce(metadata, '{}'::jsonb)
    || jsonb_build_object(
      'delivery_mode', 'meta_cloud_api_direct',
      'transport_updated_at', now()
    )
  where organization_id = p_organization_id
    and id = p_message_id;
$function$;

revoke all on function public.list_crm_whatsapp_integrations(uuid) from public;
revoke all on function public.upsert_crm_whatsapp_integration(uuid, text, text, text, text, text, text, text, text) from public;
revoke all on function public.mark_crm_whatsapp_integration_test(uuid, text, text, text) from public;
revoke all on function public.disconnect_crm_whatsapp_integration(uuid) from public;
revoke all on function public.mark_crm_whatsapp_direct_transport(uuid, uuid) from public;

grant execute on function public.list_crm_whatsapp_integrations(uuid) to authenticated;
grant execute on function public.upsert_crm_whatsapp_integration(uuid, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.mark_crm_whatsapp_integration_test(uuid, text, text, text) to authenticated;
grant execute on function public.disconnect_crm_whatsapp_integration(uuid) to authenticated;
grant execute on function public.mark_crm_whatsapp_direct_transport(uuid, uuid) to service_role;
