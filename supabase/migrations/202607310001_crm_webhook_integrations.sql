-- Etapa 4A.1 — configuração segura de webhooks genéricos por organização.
-- Esta migration cria apenas credenciais, roteamento, mapeamentos e auditoria.
-- O receptor público de leads será publicado na Etapa 4A.2.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.crm_webhook_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  name text not null,
  description text not null default '',
  public_key text not null unique,
  secret_hash text not null,
  secret_last_four text not null,
  target_pipeline_id uuid not null,
  target_stage_id uuid not null,
  source_id uuid not null,
  default_owner_id uuid null,
  duplicate_rule text not null default 'external_or_contact',
  field_mappings jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  event_count bigint not null default 0,
  last_event_at timestamptz null,
  last_error text null,
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint crm_webhook_integrations_organization_id_id_unique
    unique (organization_id, id),

  constraint crm_webhook_integrations_name_check
    check (char_length(btrim(name)) between 2 and 100),

  constraint crm_webhook_integrations_public_key_check
    check (public_key ~ '^whk_[a-f0-9]{20}$'),

  constraint crm_webhook_integrations_secret_last_four_check
    check (secret_last_four ~ '^[a-f0-9]{4}$'),

  constraint crm_webhook_integrations_duplicate_rule_check
    check (
      duplicate_rule in (
        'external_or_contact',
        'external_id',
        'phone_or_email',
        'always_create'
      )
    ),

  constraint crm_webhook_integrations_mappings_array_check
    check (jsonb_typeof(field_mappings) = 'array'),

  constraint crm_webhook_integrations_event_count_check
    check (event_count >= 0),

  constraint crm_webhook_integrations_pipeline_fk
    foreign key (organization_id, target_pipeline_id)
    references public.pipelines(organization_id, id)
    on delete restrict,

  constraint crm_webhook_integrations_stage_fk
    foreign key (
      organization_id,
      target_pipeline_id,
      target_stage_id
    )
    references public.pipeline_stages(
      organization_id,
      pipeline_id,
      id
    )
    on delete restrict,

  constraint crm_webhook_integrations_source_fk
    foreign key (organization_id, source_id)
    references public.lead_sources(organization_id, id)
    on delete restrict,

  constraint crm_webhook_integrations_owner_fk
    foreign key (default_owner_id)
    references public.profiles(id)
    on delete set null
);

create unique index if not exists crm_webhook_integrations_org_name_unique
  on public.crm_webhook_integrations (
    organization_id,
    lower(btrim(name))
  );

create index if not exists crm_webhook_integrations_org_created_idx
  on public.crm_webhook_integrations (
    organization_id,
    created_at desc
  );

create table if not exists public.crm_webhook_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  integration_id uuid not null,
  request_id text not null,
  outcome text not null,
  external_id text null,
  lead_id uuid null,
  error_message text null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),

  constraint crm_webhook_events_outcome_check
    check (
      outcome in (
        'received',
        'created',
        'duplicate',
        'rejected',
        'failed'
      )
    ),

  constraint crm_webhook_events_integration_fk
    foreign key (organization_id, integration_id)
    references public.crm_webhook_integrations(organization_id, id)
    on delete cascade,

  constraint crm_webhook_events_lead_fk
    foreign key (lead_id)
    references public.leads(id)
    on delete set null
);

create unique index if not exists crm_webhook_events_request_unique
  on public.crm_webhook_events (integration_id, request_id);

create index if not exists crm_webhook_events_integration_received_idx
  on public.crm_webhook_events (integration_id, received_at desc);

alter table public.crm_webhook_integrations enable row level security;
alter table public.crm_webhook_events enable row level security;

-- As tabelas não são expostas diretamente ao navegador. A leitura e as alterações
-- administrativas passam pelas RPCs abaixo, que nunca retornam o hash do segredo.
revoke all on public.crm_webhook_integrations from anon, authenticated;
revoke all on public.crm_webhook_events from anon, authenticated;

grant all on public.crm_webhook_integrations to service_role;
grant all on public.crm_webhook_events to service_role;

create or replace function private.assert_crm_webhook_admin(
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
      'Você não possui permissão para administrar integrações desta empresa.'
      using errcode = '42501';
  end if;
end;
$function$;

create or replace function private.assert_crm_webhook_configuration(
  p_organization_id uuid,
  p_pipeline_id uuid,
  p_stage_id uuid,
  p_source_id uuid,
  p_default_owner_id uuid,
  p_field_mappings jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_mappings jsonb := coalesce(p_field_mappings, '[]'::jsonb);
begin
  if not exists (
    select 1
    from public.pipelines as pipeline
    where pipeline.organization_id = p_organization_id
      and pipeline.id = p_pipeline_id
      and pipeline.status = 'active'
  ) then
    raise exception 'O funil selecionado não existe ou está inativo.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.pipeline_stages as stage
    where stage.organization_id = p_organization_id
      and stage.pipeline_id = p_pipeline_id
      and stage.id = p_stage_id
  ) then
    raise exception 'A etapa inicial não pertence ao funil selecionado.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.lead_sources as source
    where source.organization_id = p_organization_id
      and source.id = p_source_id
      and source.is_active = true
  ) then
    raise exception 'A origem selecionada não existe ou está inativa.'
      using errcode = '22023';
  end if;

  if p_default_owner_id is not null and not exists (
    select 1
    from public.organization_members as member
    join public.roles as role
      on role.organization_id = member.organization_id
     and role.id = member.role_id
    where member.organization_id = p_organization_id
      and member.user_id = p_default_owner_id
      and member.status = 'active'
      and (
        role.code in ('super_admin', 'manager')
        or exists (
          select 1
          from public.pipeline_user_access as access
          where access.organization_id = p_organization_id
            and access.user_id = p_default_owner_id
            and access.pipeline_id = p_pipeline_id
            and access.access_level in ('operate', 'manage')
        )
      )
  ) then
    raise exception
      'O responsável padrão não está ativo ou não possui acesso ao funil.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(v_mappings) <> 'array' then
    raise exception 'O mapeamento de campos deve ser uma lista.'
      using errcode = '22023';
  end if;

  if jsonb_array_length(v_mappings) = 0 then
    raise exception 'Cadastre ao menos um mapeamento de campo.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_mappings) as mapping(value)
    where nullif(btrim(mapping.value ->> 'source'), '') is null
       or nullif(btrim(mapping.value ->> 'target'), '') is null
       or btrim(mapping.value ->> 'source') !~ '^[A-Za-z0-9_.-]{1,120}$'
       or btrim(mapping.value ->> 'target') !~ '^[A-Za-z0-9_.-]{1,120}$'
  ) then
    raise exception
      'Cada mapeamento precisa possuir origem e destino válidos.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from (
      select lower(btrim(mapping.value ->> 'source')) as source_key
      from jsonb_array_elements(v_mappings) as mapping(value)
      group by lower(btrim(mapping.value ->> 'source'))
      having count(*) > 1
    ) as duplicated_source
  ) then
    raise exception 'Há campos recebidos duplicados no mapeamento.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from (
      select lower(btrim(mapping.value ->> 'target')) as target_key
      from jsonb_array_elements(v_mappings) as mapping(value)
      group by lower(btrim(mapping.value ->> 'target'))
      having count(*) > 1
    ) as duplicated_target
  ) then
    raise exception 'Um campo do CRM foi utilizado mais de uma vez.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(v_mappings) as mapping(value)
    where lower(btrim(mapping.value ->> 'target')) = 'name'
  ) then
    raise exception 'O mapeamento precisa preencher o campo Nome.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_mappings) as mapping(value)
    where not (
      lower(btrim(mapping.value ->> 'target')) in (
        'external_id',
        'utm_source',
        'utm_medium',
        'utm_content',
        'utm_term',
        'gclid',
        'fbclid'
      )
      or exists (
        select 1
        from public.lead_field_settings as field
        where field.organization_id = p_organization_id
          and field.field_key = lower(btrim(mapping.value ->> 'target'))
          and field.is_active = true
      )
      or exists (
        select 1
        from public.custom_fields as field
        where field.organization_id = p_organization_id
          and field.code = btrim(mapping.value ->> 'target')
          and field.is_active = true
          and (
            field.pipeline_id is null
            or field.pipeline_id = p_pipeline_id
          )
      )
    )
  ) then
    raise exception
      'Um ou mais destinos do mapeamento não existem, estão inativos ou pertencem a outro funil.'
      using errcode = '22023';
  end if;
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

create or replace function public.create_crm_webhook_integration(
  p_organization_id uuid,
  p_name text,
  p_description text,
  p_pipeline_id uuid,
  p_stage_id uuid,
  p_source_id uuid,
  p_default_owner_id uuid,
  p_duplicate_rule text,
  p_field_mappings jsonb,
  p_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_id uuid := gen_random_uuid();
  v_public_key text := 'whk_' || encode(extensions.gen_random_bytes(10), 'hex');
  v_secret text := 'crm_' || encode(extensions.gen_random_bytes(24), 'hex');
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := btrim(coalesce(p_description, ''));
  v_duplicate_rule text := lower(btrim(coalesce(p_duplicate_rule, '')));
  v_mappings jsonb := coalesce(p_field_mappings, '[]'::jsonb);
begin
  perform private.assert_crm_webhook_admin(p_organization_id);

  if char_length(v_name) < 2 or char_length(v_name) > 100 then
    raise exception 'Informe um nome entre 2 e 100 caracteres.'
      using errcode = '22023';
  end if;

  if v_duplicate_rule not in (
    'external_or_contact',
    'external_id',
    'phone_or_email',
    'always_create'
  ) then
    raise exception 'A regra de duplicidade informada é inválida.'
      using errcode = '22023';
  end if;

  perform private.assert_crm_webhook_configuration(
    p_organization_id,
    p_pipeline_id,
    p_stage_id,
    p_source_id,
    p_default_owner_id,
    v_mappings
  );

  insert into public.crm_webhook_integrations (
    id,
    organization_id,
    name,
    description,
    public_key,
    secret_hash,
    secret_last_four,
    target_pipeline_id,
    target_stage_id,
    source_id,
    default_owner_id,
    duplicate_rule,
    field_mappings,
    is_active,
    created_by,
    updated_by
  )
  values (
    v_id,
    p_organization_id,
    v_name,
    v_description,
    v_public_key,
    encode(extensions.digest(v_secret, 'sha256'), 'hex'),
    right(v_secret, 4),
    p_pipeline_id,
    p_stage_id,
    p_source_id,
    p_default_owner_id,
    v_duplicate_rule,
    v_mappings,
    coalesce(p_active, true),
    v_actor_id,
    v_actor_id
  );

  return jsonb_build_object(
    'created', true,
    'integration_id', v_id,
    'public_key', v_public_key,
    'secret', v_secret
  );
end;
$function$;

create or replace function public.update_crm_webhook_integration(
  p_organization_id uuid,
  p_integration_id uuid,
  p_name text,
  p_description text,
  p_pipeline_id uuid,
  p_stage_id uuid,
  p_source_id uuid,
  p_default_owner_id uuid,
  p_duplicate_rule text,
  p_field_mappings jsonb,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := btrim(coalesce(p_description, ''));
  v_duplicate_rule text := lower(btrim(coalesce(p_duplicate_rule, '')));
  v_mappings jsonb := coalesce(p_field_mappings, '[]'::jsonb);
begin
  perform private.assert_crm_webhook_admin(p_organization_id);

  if not exists (
    select 1
    from public.crm_webhook_integrations
    where organization_id = p_organization_id
      and id = p_integration_id
  ) then
    raise exception 'Integração não encontrada.' using errcode = 'P0002';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 100 then
    raise exception 'Informe um nome entre 2 e 100 caracteres.'
      using errcode = '22023';
  end if;

  if v_duplicate_rule not in (
    'external_or_contact',
    'external_id',
    'phone_or_email',
    'always_create'
  ) then
    raise exception 'A regra de duplicidade informada é inválida.'
      using errcode = '22023';
  end if;

  perform private.assert_crm_webhook_configuration(
    p_organization_id,
    p_pipeline_id,
    p_stage_id,
    p_source_id,
    p_default_owner_id,
    v_mappings
  );

  update public.crm_webhook_integrations
  set
    name = v_name,
    description = v_description,
    target_pipeline_id = p_pipeline_id,
    target_stage_id = p_stage_id,
    source_id = p_source_id,
    default_owner_id = p_default_owner_id,
    duplicate_rule = v_duplicate_rule,
    field_mappings = v_mappings,
    is_active = coalesce(p_active, false),
    updated_by = v_actor_id,
    updated_at = now()
  where organization_id = p_organization_id
    and id = p_integration_id;

  return jsonb_build_object(
    'updated', true,
    'integration_id', p_integration_id
  );
end;
$function$;

create or replace function public.rotate_crm_webhook_secret(
  p_organization_id uuid,
  p_integration_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_secret text := 'crm_' || encode(extensions.gen_random_bytes(24), 'hex');
  v_public_key text;
begin
  perform private.assert_crm_webhook_admin(p_organization_id);

  update public.crm_webhook_integrations
  set
    secret_hash = encode(extensions.digest(v_secret, 'sha256'), 'hex'),
    secret_last_four = right(v_secret, 4),
    last_error = null,
    updated_by = v_actor_id,
    updated_at = now()
  where organization_id = p_organization_id
    and id = p_integration_id
  returning public_key into v_public_key;

  if not found then
    raise exception 'Integração não encontrada.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'rotated', true,
    'integration_id', p_integration_id,
    'public_key', v_public_key,
    'secret', v_secret
  );
end;
$function$;

create or replace function public.delete_crm_webhook_integration(
  p_organization_id uuid,
  p_integration_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.assert_crm_webhook_admin(p_organization_id);

  delete from public.crm_webhook_integrations
  where organization_id = p_organization_id
    and id = p_integration_id;

  if not found then
    raise exception 'Integração não encontrada.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'deleted', true,
    'integration_id', p_integration_id
  );
end;
$function$;

-- Usada exclusivamente pela Edge Function da Etapa 4A.2.
create or replace function public.resolve_crm_webhook_integration(
  p_public_key text,
  p_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'integration_id', integration.id,
    'organization_id', integration.organization_id,
    'target_pipeline_id', integration.target_pipeline_id,
    'target_stage_id', integration.target_stage_id,
    'source_id', integration.source_id,
    'default_owner_id', integration.default_owner_id,
    'duplicate_rule', integration.duplicate_rule,
    'field_mappings', integration.field_mappings
  )
  into v_result
  from public.crm_webhook_integrations as integration
  where integration.public_key = btrim(coalesce(p_public_key, ''))
    and integration.is_active = true
    and integration.secret_hash = encode(
      extensions.digest(coalesce(p_secret, ''), 'sha256'),
      'hex'
    )
  limit 1;

  return v_result;
end;
$function$;

revoke all on function public.list_crm_webhook_integrations(uuid) from public;
revoke all on function public.create_crm_webhook_integration(uuid, text, text, uuid, uuid, uuid, uuid, text, jsonb, boolean) from public;
revoke all on function public.update_crm_webhook_integration(uuid, uuid, text, text, uuid, uuid, uuid, uuid, text, jsonb, boolean) from public;
revoke all on function public.rotate_crm_webhook_secret(uuid, uuid) from public;
revoke all on function public.delete_crm_webhook_integration(uuid, uuid) from public;
revoke all on function public.resolve_crm_webhook_integration(text, text) from public;

grant execute on function public.list_crm_webhook_integrations(uuid) to authenticated;
grant execute on function public.create_crm_webhook_integration(uuid, text, text, uuid, uuid, uuid, uuid, text, jsonb, boolean) to authenticated;
grant execute on function public.update_crm_webhook_integration(uuid, uuid, text, text, uuid, uuid, uuid, uuid, text, jsonb, boolean) to authenticated;
grant execute on function public.rotate_crm_webhook_secret(uuid, uuid) to authenticated;
grant execute on function public.delete_crm_webhook_integration(uuid, uuid) to authenticated;
grant execute on function public.resolve_crm_webhook_integration(text, text) to service_role;
