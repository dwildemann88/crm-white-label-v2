-- Etapa 4A.3 — operação, teste e diagnóstico dos webhooks no próprio CRM.

alter table public.crm_webhook_integrations
  add column if not exists last_test_at timestamptz null;

create or replace function private.crm_webhook_value_at_path(
  p_payload jsonb,
  p_path text
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $function$
declare
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_path text := btrim(coalesce(p_path, ''));
begin
  if v_path = '' or jsonb_typeof(v_payload) <> 'object' then
    return null;
  end if;

  -- Mantém a mesma precedência da Edge Function: primeiro uma chave literal,
  -- depois um caminho pontuado, como contact.email.
  if v_payload ? v_path then
    return v_payload -> v_path;
  end if;

  return v_payload #> string_to_array(v_path, '.');
end;
$function$;

create or replace function public.list_crm_webhook_integrations(
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
  perform private.assert_crm_webhook_admin(p_organization_id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', integration.id,
        'organization_id', integration.organization_id,
        'provider', 'webhook',
        'name', integration.name,
        'description', integration.description,
        'status', case
          when integration.is_active = false then 'disconnected'
          when integration.last_error is not null then 'attention'
          when integration.last_event_at is not null then 'connected'
          else 'attention'
        end,
        'account_label', source.name,
        'public_key', integration.public_key,
        'secret_masked', '••••••••••••' || integration.secret_last_four,
        'target_pipeline_id', integration.target_pipeline_id,
        'target_stage_id', integration.target_stage_id,
        'source_id', integration.source_id,
        'default_owner_id', integration.default_owner_id,
        'duplicate_rule', integration.duplicate_rule,
        'field_mappings', integration.field_mappings,
        'active', integration.is_active,
        'last_event_at', integration.last_event_at,
        'last_test_at', integration.last_test_at,
        'events_received', integration.event_count,
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
  from public.crm_webhook_integrations as integration
  join public.lead_sources as source
    on source.organization_id = integration.organization_id
   and source.id = integration.source_id
  where integration.organization_id = p_organization_id;

  return v_result;
end;
$function$;

create or replace function public.list_crm_webhook_events(
  p_organization_id uuid,
  p_integration_id uuid default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_result jsonb;
begin
  perform private.assert_crm_webhook_admin(p_organization_id);

  if p_integration_id is not null and not exists (
    select 1
    from public.crm_webhook_integrations as integration
    where integration.organization_id = p_organization_id
      and integration.id = p_integration_id
  ) then
    raise exception 'Integração não encontrada.' using errcode = 'P0002';
  end if;

  select coalesce(
    jsonb_agg(event_row.value order by event_row.received_at desc),
    '[]'::jsonb
  )
  into v_result
  from (
    select
      event.received_at,
      jsonb_build_object(
        'id', event.id,
        'organization_id', event.organization_id,
        'integration_id', event.integration_id,
        'integration_name', integration.name,
        'request_id', event.request_id,
        'outcome', event.outcome,
        'external_id', event.external_id,
        'lead_id', event.lead_id,
        'error_message', event.error_message,
        'payload', event.payload,
        'received_at', event.received_at
      ) as value
    from public.crm_webhook_events as event
    join public.crm_webhook_integrations as integration
      on integration.organization_id = event.organization_id
     and integration.id = event.integration_id
    where event.organization_id = p_organization_id
      and (
        p_integration_id is null
        or event.integration_id = p_integration_id
      )
    order by event.received_at desc
    limit v_limit
  ) as event_row;

  return v_result;
end;
$function$;

create or replace function public.test_crm_webhook_integration(
  p_organization_id uuid,
  p_integration_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_mapped_values jsonb := '{}'::jsonb;
  v_request_id text := 'crm-ui-test-' || encode(extensions.gen_random_bytes(12), 'hex');
  v_result jsonb;
begin
  perform private.assert_crm_webhook_admin(p_organization_id);

  if jsonb_typeof(v_payload) <> 'object' then
    raise exception 'O payload de teste deve ser um objeto JSON.'
      using errcode = '22023';
  end if;

  if octet_length(v_payload::text) > 262144 then
    raise exception 'O payload excede o limite de 256 KB.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.crm_webhook_integrations as integration
    where integration.organization_id = p_organization_id
      and integration.id = p_integration_id
      and integration.is_active = true
  ) then
    raise exception 'A integração não existe ou está desativada.'
      using errcode = 'P0002';
  end if;

  select coalesce(
    jsonb_object_agg(mapped.target_key, mapped.source_value)
      filter (where mapped.source_value is not null),
    '{}'::jsonb
  )
  into v_mapped_values
  from (
    select
      btrim(mapping.value ->> 'target') as target_key,
      private.crm_webhook_value_at_path(
        v_payload,
        btrim(mapping.value ->> 'source')
      ) as source_value
    from public.crm_webhook_integrations as integration
    cross join lateral jsonb_array_elements(integration.field_mappings)
      as mapping(value)
    where integration.organization_id = p_organization_id
      and integration.id = p_integration_id
  ) as mapped;

  begin
    v_result := public.ingest_crm_webhook_lead(
      p_integration_id,
      v_request_id,
      v_payload,
      v_mapped_values
    );
  exception
    when others then
      perform public.record_crm_webhook_failure(
        p_integration_id,
        v_request_id,
        v_payload,
        sqlerrm
      );

      update public.crm_webhook_integrations
      set last_test_at = now(),
          updated_at = now()
      where organization_id = p_organization_id
        and id = p_integration_id;

      raise;
  end;

  update public.crm_webhook_integrations
  set last_test_at = now(),
      updated_at = now()
  where organization_id = p_organization_id
    and id = p_integration_id;

  return coalesce(v_result, '{}'::jsonb) || jsonb_build_object(
    'tested', true,
    'request_id', v_request_id
  );
end;
$function$;

revoke all on function private.crm_webhook_value_at_path(jsonb, text) from public;
revoke all on function public.list_crm_webhook_events(uuid, uuid, integer) from public;
revoke all on function public.test_crm_webhook_integration(uuid, uuid, jsonb) from public;

grant execute on function public.list_crm_webhook_events(uuid, uuid, integer) to authenticated;
grant execute on function public.test_crm_webhook_integration(uuid, uuid, jsonb) to authenticated;
