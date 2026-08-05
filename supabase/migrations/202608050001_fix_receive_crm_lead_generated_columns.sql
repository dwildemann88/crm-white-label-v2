-- Correção Etapa 4A.2
-- contacts.phone_normalized e contacts.email_normalized são colunas geradas.
-- O PostgreSQL calcula esses valores a partir de phone e email; por isso,
-- não podem receber valores explícitos em INSERT ou UPDATE.

create or replace function public.ingest_crm_webhook_lead(
  p_integration_id uuid,
  p_request_id text,
  p_payload jsonb,
  p_mapped_values jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_integration public.crm_webhook_integrations%rowtype;
  v_request_id text := nullif(pg_catalog.btrim(coalesce(p_request_id, '')), '');
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_values jsonb := coalesce(p_mapped_values, '{}'::jsonb);

  v_existing_event record;
  v_existing_lead_id uuid;

  v_name text;
  v_company text;
  v_phone text;
  v_phone_normalized text;
  v_email text;
  v_email_normalized text;
  v_city text;
  v_state text;
  v_campaign text;
  v_notes text;
  v_external_id text;
  v_stored_external_id text;
  v_utm_source text;
  v_utm_medium text;
  v_utm_content text;
  v_utm_term text;
  v_gclid text;
  v_fbclid text;

  v_priority_raw text;
  v_priority text := 'medium';
  v_temperature_raw text;
  v_temperature text := 'cold';
  v_score numeric := 0;
  v_estimated_value numeric;

  v_owner_id uuid;
  v_stage_category text;
  v_lead_status text := 'open';

  v_contact_by_phone uuid;
  v_contact_by_email uuid;
  v_contact_id uuid;
  v_lead_id uuid;

  v_required_field record;
  v_custom_field record;
  v_custom_value jsonb;
  v_value_text text;
  v_value_number numeric;
  v_value_boolean boolean;
  v_value_date date;
  v_value_timestamp timestamptz;
  v_value_json jsonb;
begin
  if p_integration_id is null then
    raise exception 'Integração não informada.' using errcode = '22023';
  end if;

  if v_request_id is null or char_length(v_request_id) > 180 then
    raise exception 'O identificador da requisição é inválido.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(v_payload) <> 'object' then
    raise exception 'O payload recebido deve ser um objeto JSON.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(v_values) <> 'object' then
    raise exception 'Os valores mapeados devem formar um objeto JSON.'
      using errcode = '22023';
  end if;

  select integration.*
  into v_integration
  from public.crm_webhook_integrations as integration
  where integration.id = p_integration_id
    and integration.is_active = true
  for update;

  if not found then
    raise exception 'A integração não existe ou está desativada.'
      using errcode = 'P0002';
  end if;

  select event.outcome, event.lead_id
  into v_existing_event
  from public.crm_webhook_events as event
  where event.integration_id = v_integration.id
    and event.request_id = v_request_id
  limit 1;

  if found then
    if v_existing_event.outcome in ('created', 'duplicate') then
      return jsonb_build_object(
        'created', false,
        'duplicate', true,
        'idempotent', true,
        'outcome', v_existing_event.outcome,
        'lead_id', v_existing_event.lead_id,
        'request_id', v_request_id
      );
    end if;

    -- Falhas anteriores com o mesmo identificador podem ser reenviadas.
    delete from public.crm_webhook_events
    where integration_id = v_integration.id
      and request_id = v_request_id
      and outcome in ('received', 'rejected', 'failed');
  end if;

  select stage.category
  into v_stage_category
  from public.pipeline_stages as stage
  join public.pipelines as pipeline
    on pipeline.organization_id = stage.organization_id
   and pipeline.id = stage.pipeline_id
  where stage.organization_id = v_integration.organization_id
    and stage.pipeline_id = v_integration.target_pipeline_id
    and stage.id = v_integration.target_stage_id
    and stage.is_active = true
    and pipeline.status = 'active';

  if not found then
    raise exception 'O funil ou a etapa configurada está inativa.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.lead_sources as source
    where source.organization_id = v_integration.organization_id
      and source.id = v_integration.source_id
      and source.is_active = true
  ) then
    raise exception 'A origem configurada está inativa.'
      using errcode = '22023';
  end if;

  v_name := private.crm_webhook_text_value(v_values, 'name');

  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 150 then
    raise exception 'Informe um nome entre 2 e 150 caracteres.'
      using errcode = '22023';
  end if;

  for v_required_field in
    select field.field_key, field.label
    from public.lead_field_settings as field
    where field.organization_id = v_integration.organization_id
      and field.is_active = true
      and field.is_required = true
  loop
    -- A origem é preenchida pela própria configuração do webhook.
    if v_required_field.field_key = 'origin' then
      continue;
    end if;

    if not private.crm_webhook_has_value(
      v_values,
      v_required_field.field_key
    ) then
      raise exception 'O campo % é obrigatório.', v_required_field.label
        using errcode = '22023';
    end if;
  end loop;

  for v_required_field in
    select field.code, field.name
    from public.custom_fields as field
    where field.organization_id = v_integration.organization_id
      and field.is_active = true
      and field.is_required = true
      and (
        field.pipeline_id is null
        or field.pipeline_id = v_integration.target_pipeline_id
      )
  loop
    if not private.crm_webhook_has_value(v_values, v_required_field.code) then
      raise exception 'O campo % é obrigatório.', v_required_field.name
        using errcode = '22023';
    end if;
  end loop;

  v_company := private.crm_webhook_text_value(v_values, 'company');
  v_phone := private.crm_webhook_text_value(v_values, 'phone');
  v_phone_normalized := public.normalize_phone(v_phone);
  v_email := private.crm_webhook_text_value(v_values, 'email');
  v_email_normalized := public.normalize_email(v_email);
  v_city := private.crm_webhook_text_value(v_values, 'city');
  v_campaign := private.crm_webhook_text_value(v_values, 'campaign');
  v_notes := private.crm_webhook_text_value(v_values, 'notes');
  v_external_id := private.crm_webhook_text_value(v_values, 'external_id');
  v_utm_source := private.crm_webhook_text_value(v_values, 'utm_source');
  v_utm_medium := private.crm_webhook_text_value(v_values, 'utm_medium');
  v_utm_content := private.crm_webhook_text_value(v_values, 'utm_content');
  v_utm_term := private.crm_webhook_text_value(v_values, 'utm_term');
  v_gclid := private.crm_webhook_text_value(v_values, 'gclid');
  v_fbclid := private.crm_webhook_text_value(v_values, 'fbclid');

  if v_email is not null
     and v_email_normalized !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'Informe um e-mail válido.' using errcode = '22023';
  end if;

  if v_city is not null
     and v_city ~* '[/,-][[:space:]]*[A-Z]{2}$' then
    v_state := pg_catalog.upper(
      pg_catalog.substring(v_city, '([A-Za-z]{2})$')
    );
    v_city := nullif(
      pg_catalog.btrim(
        pg_catalog.regexp_replace(
          v_city,
          '[[:space:]]*[/,-][[:space:]]*[A-Za-z]{2}$',
          ''
        )
      ),
      ''
    );
  end if;

  v_priority_raw := pg_catalog.lower(
    coalesce(private.crm_webhook_text_value(v_values, 'priority'), '')
  );

  if v_priority_raw <> '' then
    v_priority := case v_priority_raw
      when 'low' then 'low'
      when 'baixa' then 'low'
      when 'baixo' then 'low'
      when 'medium' then 'medium'
      when 'média' then 'medium'
      when 'media' then 'medium'
      when 'médio' then 'medium'
      when 'medio' then 'medium'
      when 'high' then 'high'
      when 'alta' then 'high'
      when 'alto' then 'high'
      when 'urgent' then 'urgent'
      when 'urgente' then 'urgent'
      else null
    end;

    if v_priority is null then
      raise exception 'Prioridade inválida.' using errcode = '22023';
    end if;
  end if;

  v_temperature_raw := pg_catalog.lower(
    coalesce(private.crm_webhook_text_value(v_values, 'temperature'), '')
  );

  if v_temperature_raw <> '' then
    v_temperature := case v_temperature_raw
      when 'cold' then 'cold'
      when 'frio' then 'cold'
      when 'fria' then 'cold'
      when 'warm' then 'warm'
      when 'morno' then 'warm'
      when 'morna' then 'warm'
      when 'hot' then 'hot'
      when 'quente' then 'hot'
      else null
    end;

    if v_temperature is null then
      raise exception 'Temperatura inválida.' using errcode = '22023';
    end if;
  end if;

  if private.crm_webhook_has_value(v_values, 'score') then
    v_score := private.crm_webhook_decimal(
      private.crm_webhook_text_value(v_values, 'score')
    );

    if v_score < 0 or v_score > 100 or v_score <> trunc(v_score) then
      raise exception 'O score deve ser um número inteiro entre 0 e 100.'
        using errcode = '22023';
    end if;
  end if;

  if private.crm_webhook_has_value(v_values, 'value') then
    v_estimated_value := private.crm_webhook_decimal(
      private.crm_webhook_text_value(v_values, 'value')
    );

    if v_estimated_value < 0 then
      raise exception 'O valor estimado não pode ser negativo.'
        using errcode = '22023';
    end if;
  end if;

  if v_integration.duplicate_rule = 'external_id'
     and v_external_id is null then
    raise exception
      'A regra de duplicidade exige o campo external_id no payload.'
      using errcode = '22023';
  end if;

  if v_integration.duplicate_rule = 'phone_or_email'
     and v_phone_normalized is null
     and v_email_normalized is null then
    raise exception
      'A regra de duplicidade exige telefone ou e-mail.'
      using errcode = '22023';
  end if;

  v_stored_external_id := case
    when v_integration.duplicate_rule in ('external_or_contact', 'external_id')
      then v_external_id
    else null
  end;

  if v_external_id is not null
     and v_integration.duplicate_rule in ('external_or_contact', 'external_id') then
    select lead.id
    into v_existing_lead_id
    from public.leads as lead
    where lead.organization_id = v_integration.organization_id
      and lead.source_id = v_integration.source_id
      and lead.external_lead_id = v_external_id
    order by lead.created_at desc
    limit 1;
  end if;

  if v_existing_lead_id is not null then
    insert into public.crm_webhook_events (
      organization_id,
      integration_id,
      request_id,
      outcome,
      external_id,
      lead_id,
      payload
    ) values (
      v_integration.organization_id,
      v_integration.id,
      v_request_id,
      'duplicate',
      v_external_id,
      v_existing_lead_id,
      v_payload
    );

    update public.crm_webhook_integrations
    set event_count = event_count + 1,
        last_event_at = now(),
        last_error = null,
        updated_at = now()
    where id = v_integration.id;

    return jsonb_build_object(
      'created', false,
      'duplicate', true,
      'duplicate_by', 'external_id',
      'lead_id', v_existing_lead_id,
      'request_id', v_request_id
    );
  end if;

  if v_phone_normalized is not null then
    select contact.id
    into v_contact_by_phone
    from public.contacts as contact
    where contact.organization_id = v_integration.organization_id
      and contact.phone_normalized = v_phone_normalized
    order by contact.created_at
    limit 1;
  end if;

  if v_email_normalized is not null then
    select contact.id
    into v_contact_by_email
    from public.contacts as contact
    where contact.organization_id = v_integration.organization_id
      and contact.email_normalized = v_email_normalized
    order by contact.created_at
    limit 1;
  end if;

  if v_contact_by_phone is not null
     and v_contact_by_email is not null
     and v_contact_by_phone <> v_contact_by_email then
    raise exception
      'O telefone e o e-mail informados pertencem a contatos diferentes.'
      using errcode = '22023';
  end if;

  v_contact_id := coalesce(v_contact_by_phone, v_contact_by_email);

  if v_contact_id is not null
     and v_integration.duplicate_rule in ('external_or_contact', 'phone_or_email') then
    select lead.id
    into v_existing_lead_id
    from public.leads as lead
    where lead.organization_id = v_integration.organization_id
      and lead.contact_id = v_contact_id
    order by lead.created_at desc
    limit 1;
  end if;

  if v_existing_lead_id is not null then
    insert into public.crm_webhook_events (
      organization_id,
      integration_id,
      request_id,
      outcome,
      external_id,
      lead_id,
      payload
    ) values (
      v_integration.organization_id,
      v_integration.id,
      v_request_id,
      'duplicate',
      v_external_id,
      v_existing_lead_id,
      v_payload
    );

    update public.crm_webhook_integrations
    set event_count = event_count + 1,
        last_event_at = now(),
        last_error = null,
        updated_at = now()
    where id = v_integration.id;

    return jsonb_build_object(
      'created', false,
      'duplicate', true,
      'duplicate_by', 'phone_or_email',
      'lead_id', v_existing_lead_id,
      'request_id', v_request_id
    );
  end if;

  v_owner_id := v_integration.default_owner_id;

  if v_owner_id is not null and not exists (
    select 1
    from public.organization_members as member
    join public.roles as role
      on role.organization_id = member.organization_id
     and role.id = member.role_id
    where member.organization_id = v_integration.organization_id
      and member.user_id = v_owner_id
      and member.status = 'active'
      and (
        role.code in ('super_admin', 'manager')
        or exists (
          select 1
          from public.pipeline_user_access as access
          where access.organization_id = v_integration.organization_id
            and access.user_id = v_owner_id
            and access.pipeline_id = v_integration.target_pipeline_id
            and access.access_level in ('operate', 'manage')
        )
      )
  ) then
    v_owner_id := null;
  end if;

  if v_contact_id is null then
    insert into public.contacts (
      organization_id,
      full_name,
      company_name,
      phone,
      email,
      city,
      state,
      created_by
    ) values (
      v_integration.organization_id,
      v_name,
      v_company,
      v_phone,
      v_email_normalized,
      v_city,
      v_state,
      v_owner_id
    )
    returning id into v_contact_id;
  else
    update public.contacts
    set full_name = v_name,
        company_name = coalesce(v_company, company_name),
        phone = coalesce(v_phone, phone),
        email = coalesce(v_email_normalized, email),
        city = coalesce(v_city, city),
        state = coalesce(v_state, state),
        updated_at = now()
    where organization_id = v_integration.organization_id
      and id = v_contact_id;
  end if;

  v_lead_status := case v_stage_category
    when 'won' then 'won'
    when 'lost' then 'lost'
    else 'open'
  end;

  insert into public.leads (
    organization_id,
    contact_id,
    pipeline_id,
    stage_id,
    source_id,
    title,
    assigned_to,
    priority,
    temperature,
    score,
    estimated_value,
    external_lead_id,
    utm_campaign,
    utm_source,
    utm_medium,
    utm_content,
    utm_term,
    gclid,
    fbclid,
    status,
    raw_payload,
    source_metadata,
    created_by,
    updated_by
  ) values (
    v_integration.organization_id,
    v_contact_id,
    v_integration.target_pipeline_id,
    v_integration.target_stage_id,
    v_integration.source_id,
    v_name,
    v_owner_id,
    v_priority,
    v_temperature,
    v_score::smallint,
    v_estimated_value,
    v_stored_external_id,
    v_campaign,
    v_utm_source,
    v_utm_medium,
    v_utm_content,
    v_utm_term,
    v_gclid,
    v_fbclid,
    v_lead_status,
    v_payload
      || case
        when v_notes is null then '{}'::jsonb
        else jsonb_build_object('notes', v_notes)
      end
      || jsonb_build_object(
        '_crm_webhook',
        jsonb_build_object(
          'integration_id', v_integration.id,
          'request_id', v_request_id,
          'received_at', now()
        )
      ),
    jsonb_build_object(
      'provider', 'webhook',
      'integration_id', v_integration.id,
      'request_id', v_request_id
    ),
    v_owner_id,
    v_owner_id
  )
  returning id into v_lead_id;

  for v_custom_field in
    select field.id, field.code, field.name, field.field_type
    from public.custom_fields as field
    where field.organization_id = v_integration.organization_id
      and field.is_active = true
      and (
        field.pipeline_id is null
        or field.pipeline_id = v_integration.target_pipeline_id
      )
      and v_values ? field.code
    order by field.position, field.name
  loop
    v_custom_value := v_values -> v_custom_field.code;

    if not private.crm_webhook_has_value(v_values, v_custom_field.code) then
      continue;
    end if;

    v_value_text := null;
    v_value_number := null;
    v_value_boolean := null;
    v_value_date := null;
    v_value_timestamp := null;
    v_value_json := null;

    case v_custom_field.field_type
      when 'text', 'textarea', 'phone', 'email', 'url', 'user' then
        v_value_text := nullif(pg_catalog.btrim(v_custom_value #>> '{}'), '');

      when 'number', 'currency' then
        v_value_number := private.crm_webhook_decimal(v_custom_value #>> '{}');

      when 'boolean' then
        if jsonb_typeof(v_custom_value) = 'boolean' then
          v_value_boolean := (v_custom_value #>> '{}')::boolean;
        else
          v_value_boolean := case pg_catalog.lower(
            pg_catalog.btrim(v_custom_value #>> '{}')
          )
            when 'true' then true
            when 'sim' then true
            when '1' then true
            when 'yes' then true
            when 'false' then false
            when 'não' then false
            when 'nao' then false
            when '0' then false
            when 'no' then false
            else null
          end;

          if v_value_boolean is null then
            raise exception 'Valor inválido no campo %.', v_custom_field.name
              using errcode = '22023';
          end if;
        end if;

      when 'date' then
        begin
          v_value_date := (v_custom_value #>> '{}')::date;
        exception when others then
          raise exception 'Data inválida no campo %.', v_custom_field.name
            using errcode = '22023';
        end;

      when 'datetime' then
        begin
          v_value_timestamp := (v_custom_value #>> '{}')::timestamptz;
        exception when others then
          raise exception 'Data e hora inválidas no campo %.', v_custom_field.name
            using errcode = '22023';
        end;

      when 'select' then
        select option.value
        into v_value_text
        from public.custom_field_options as option
        where option.organization_id = v_integration.organization_id
          and option.field_id = v_custom_field.id
          and option.is_active = true
          and (
            option.value = v_custom_value #>> '{}'
            or pg_catalog.lower(option.label) = pg_catalog.lower(
              v_custom_value #>> '{}'
            )
          )
        limit 1;

        if v_value_text is null then
          raise exception 'Opção inválida no campo %.', v_custom_field.name
            using errcode = '22023';
        end if;

      when 'multiselect' then
        if jsonb_typeof(v_custom_value) <> 'array' then
          raise exception 'O campo % deve receber uma lista.', v_custom_field.name
            using errcode = '22023';
        end if;

        select jsonb_agg(to_jsonb(option.value) order by selected.position)
        into v_value_json
        from jsonb_array_elements_text(v_custom_value) with ordinality
          as selected(selected_value, position)
        join public.custom_field_options as option
          on option.organization_id = v_integration.organization_id
         and option.field_id = v_custom_field.id
         and option.is_active = true
         and (
           option.value = selected.selected_value
           or pg_catalog.lower(option.label) = pg_catalog.lower(
             selected.selected_value
           )
         );

        if v_value_json is null
           or jsonb_array_length(v_value_json) <> jsonb_array_length(v_custom_value) then
          raise exception 'Uma ou mais opções são inválidas no campo %.',
            v_custom_field.name using errcode = '22023';
        end if;

      else
        raise exception 'Tipo não suportado no campo %.', v_custom_field.name
          using errcode = '22023';
    end case;

    insert into public.lead_custom_values (
      organization_id,
      lead_id,
      field_id,
      value_text,
      value_number,
      value_boolean,
      value_date,
      value_timestamp,
      value_json,
      created_by,
      updated_by
    ) values (
      v_integration.organization_id,
      v_lead_id,
      v_custom_field.id,
      v_value_text,
      v_value_number,
      v_value_boolean,
      v_value_date,
      v_value_timestamp,
      v_value_json,
      v_owner_id,
      v_owner_id
    );
  end loop;

  insert into public.crm_webhook_events (
    organization_id,
    integration_id,
    request_id,
    outcome,
    external_id,
    lead_id,
    payload
  ) values (
    v_integration.organization_id,
    v_integration.id,
    v_request_id,
    'created',
    v_external_id,
    v_lead_id,
    v_payload
  );

  update public.crm_webhook_integrations
  set event_count = event_count + 1,
      last_event_at = now(),
      last_error = null,
      updated_at = now()
  where id = v_integration.id;

  return jsonb_build_object(
    'created', true,
    'duplicate', false,
    'lead_id', v_lead_id,
    'contact_id', v_contact_id,
    'request_id', v_request_id
  );
end;
$function$;

revoke all on function public.ingest_crm_webhook_lead(uuid, text, jsonb, jsonb) from public;
grant execute on function public.ingest_crm_webhook_lead(uuid, text, jsonb, jsonb) to service_role;
