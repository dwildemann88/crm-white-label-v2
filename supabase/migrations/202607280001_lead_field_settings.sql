-- Configuração white-label dos campos estruturais do lead.
-- Mantém as colunas atuais de contacts/leads e controla apenas a apresentação por organização.

create table if not exists public.lead_field_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  field_key text not null,
  label text not null,
  field_type text not null,
  is_required boolean not null default false,
  is_active boolean not null default true,
  show_in_table boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint lead_field_settings_organization_key_unique
    unique (organization_id, field_key),

  constraint lead_field_settings_label_check
    check (char_length(btrim(label)) between 1 and 80),

  constraint lead_field_settings_key_check
    check (
      field_key in (
        'name',
        'company',
        'phone',
        'email',
        'city',
        'origin',
        'campaign',
        'priority',
        'temperature',
        'score',
        'value',
        'notes'
      )
    ),

  constraint lead_field_settings_type_check
    check (
      field_type in (
        'text',
        'email',
        'phone',
        'number',
        'select',
        'textarea'
      )
    ),

  constraint lead_field_settings_key_type_check
    check (
      (field_key in ('name', 'company', 'city', 'campaign') and field_type = 'text')
      or (field_key = 'phone' and field_type = 'phone')
      or (field_key = 'email' and field_type = 'email')
      or (field_key in ('origin', 'priority', 'temperature') and field_type = 'select')
      or (field_key in ('score', 'value') and field_type = 'number')
      or (field_key = 'notes' and field_type = 'textarea')
    ),

  constraint lead_field_settings_active_required_check
    check (is_active or not is_required),

  constraint lead_field_settings_active_table_check
    check (is_active or not show_in_table),

  constraint lead_field_settings_name_integrity_check
    check (field_key <> 'name' or (is_active and is_required)),

  constraint lead_field_settings_position_check
    check (position between 1 and 100)
);

create index if not exists lead_field_settings_organization_position_idx
  on public.lead_field_settings (organization_id, position);

alter table public.lead_field_settings enable row level security;

drop policy if exists lead_field_settings_select
  on public.lead_field_settings;
create policy lead_field_settings_select
  on public.lead_field_settings
  for select
  to authenticated
  using (
    private.is_organization_member(organization_id)
  );

drop policy if exists lead_field_settings_insert
  on public.lead_field_settings;
create policy lead_field_settings_insert
  on public.lead_field_settings
  for insert
  to authenticated
  with check (
    private.is_organization_member(organization_id)
    and private.has_permission(
      organization_id,
      'custom_fields.manage'
    )
  );

drop policy if exists lead_field_settings_update
  on public.lead_field_settings;
create policy lead_field_settings_update
  on public.lead_field_settings
  for update
  to authenticated
  using (
    private.has_permission(
      organization_id,
      'custom_fields.manage'
    )
  )
  with check (
    private.has_permission(
      organization_id,
      'custom_fields.manage'
    )
  );

grant select, insert, update
  on public.lead_field_settings
  to authenticated;

drop trigger if exists lead_field_settings_set_updated_at
  on public.lead_field_settings;
create trigger lead_field_settings_set_updated_at
  before update on public.lead_field_settings
  for each row
  execute function public.set_updated_at();

create or replace function private.seed_default_lead_field_settings(
  p_organization_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $function$
  insert into public.lead_field_settings (
    organization_id,
    field_key,
    label,
    field_type,
    is_required,
    is_active,
    show_in_table,
    position
  )
  select
    p_organization_id,
    defaults.field_key,
    defaults.label,
    defaults.field_type,
    defaults.is_required,
    defaults.is_active,
    defaults.show_in_table,
    defaults.position
  from (
    values
      ('name',        'Nome',            'text',     true,  true, true,  1),
      ('company',     'Empresa',         'text',     false, true, true,  2),
      ('phone',       'Telefone',        'phone',    true,  true, true,  3),
      ('email',       'E-mail',          'email',    false, true, true,  4),
      ('city',        'Cidade',          'text',     false, true, true,  5),
      ('origin',      'Origem',          'select',   false, true, true,  6),
      ('campaign',    'Campanha',        'text',     false, true, false, 7),
      ('priority',    'Prioridade',      'select',   false, true, true,  8),
      ('temperature', 'Temperatura',     'select',   false, true, false, 9),
      ('score',       'Score',           'number',   false, true, false, 10),
      ('value',       'Valor estimado',  'number',   false, true, true,  11),
      ('notes',       'Observações',     'textarea', false, true, false, 12)
  ) as defaults(
    field_key,
    label,
    field_type,
    is_required,
    is_active,
    show_in_table,
    position
  )
  on conflict (organization_id, field_key) do nothing;
$function$;

create or replace function private.seed_lead_fields_after_organization_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.seed_default_lead_field_settings(new.id);
  return new;
end;
$function$;

drop trigger if exists organizations_seed_lead_fields
  on public.organizations;
create trigger organizations_seed_lead_fields
  after insert on public.organizations
  for each row
  execute function private.seed_lead_fields_after_organization_insert();

do $block$
declare
  organization_record record;
begin
  for organization_record in
    select id from public.organizations
  loop
    perform private.seed_default_lead_field_settings(
      organization_record.id
    );
  end loop;
end;
$block$;


-- Atualiza o provisionador para copiar as configurações dos campos padrão.

-- Provisiona uma nova organização copiando apenas configurações.
-- Não copia leads, contatos, tarefas, mensagens, arquivos, usuários ou credenciais.
-- A aplicação desta migration é opcional e deve ser validada em staging antes da produção.

create or replace function public.provision_crm_organization(
  p_source_organization_id uuid,
  p_name text,
  p_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid := gen_random_uuid();
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_admin_role_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sessão não informada.' using errcode = '42501';
  end if;

  if not private.is_platform_admin() then
    raise exception 'Somente um administrador da plataforma pode criar organizações.'
      using errcode = '42501';
  end if;

  if v_name = '' then
    raise exception 'O nome da organização é obrigatório.' using errcode = '22023';
  end if;

  if v_slug = '' or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'O identificador deve conter apenas letras minúsculas, números e hífens.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organizations
    where id = p_source_organization_id
  ) then
    raise exception 'A organização modelo não foi encontrada.' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.organizations
    where slug = v_slug
  ) then
    raise exception 'Já existe uma organização com este identificador.'
      using errcode = '23505';
  end if;

  insert into public.organizations (
    id,
    name,
    slug,
    status,
    created_by
  )
  values (
    v_organization_id,
    v_name,
    v_slug,
    'active',
    v_user_id
  );

  insert into public.organization_branding (
    organization_id,
    crm_name,
    logo_url,
    favicon_url,
    login_background_url,
    primary_color,
    secondary_color,
    accent_color,
    background_color,
    font_family
  )
  select
    v_organization_id,
    case
      when coalesce(b.crm_name, '') = '' then v_name
      else v_name || ' CRM'
    end,
    b.logo_url,
    b.favicon_url,
    b.login_background_url,
    b.primary_color,
    b.secondary_color,
    b.accent_color,
    b.background_color,
    b.font_family
  from public.organization_branding as b
  where b.organization_id = p_source_organization_id;

  if not found then
    insert into public.organization_branding (
      organization_id,
      crm_name,
      primary_color,
      secondary_color,
      accent_color,
      background_color,
      font_family
    )
    values (
      v_organization_id,
      v_name || ' CRM',
      '#2563eb',
      '#172033',
      '#0ea5e9',
      '#f5f7fb',
      'Inter'
    );
  end if;

  insert into public.roles (
    organization_id,
    name,
    code,
    description,
    is_system
  )
  select
    v_organization_id,
    role.name,
    role.code,
    role.description,
    role.is_system
  from public.roles as role
  where role.organization_id = p_source_organization_id;

  insert into public.role_permissions (role_id, permission_id)
  select
    new_role.id,
    role_permission.permission_id
  from public.role_permissions as role_permission
  join public.roles as source_role
    on source_role.id = role_permission.role_id
   and source_role.organization_id = p_source_organization_id
  join public.roles as new_role
    on new_role.organization_id = v_organization_id
   and new_role.code = source_role.code;

  select role.id
  into v_admin_role_id
  from public.roles as role
  where role.organization_id = v_organization_id
    and role.code in ('super_admin', 'admin')
  order by case role.code when 'super_admin' then 1 else 2 end
  limit 1;

  if v_admin_role_id is null then
    raise exception 'A organização modelo não possui um perfil administrativo.';
  end if;

  insert into public.organization_members (
    organization_id,
    user_id,
    role_id,
    status
  )
  values (
    v_organization_id,
    v_user_id,
    v_admin_role_id,
    'active'
  );

  insert into public.pipelines (
    organization_id,
    name,
    slug,
    description,
    status,
    is_default,
    created_by
  )
  select
    v_organization_id,
    pipeline.name,
    pipeline.slug,
    pipeline.description,
    pipeline.status,
    pipeline.is_default,
    v_user_id
  from public.pipelines as pipeline
  where pipeline.organization_id = p_source_organization_id;

  insert into public.pipeline_stages (
    organization_id,
    pipeline_id,
    name,
    code,
    description,
    color,
    position,
    category,
    probability,
    is_active,
    requires_loss_reason,
    requires_value,
    created_by
  )
  select
    v_organization_id,
    new_pipeline.id,
    stage.name,
    stage.code,
    stage.description,
    stage.color,
    stage.position,
    stage.category,
    stage.probability,
    stage.is_active,
    stage.requires_loss_reason,
    stage.requires_value,
    v_user_id
  from public.pipeline_stages as stage
  join public.pipelines as source_pipeline
    on source_pipeline.id = stage.pipeline_id
   and source_pipeline.organization_id = p_source_organization_id
  join public.pipelines as new_pipeline
    on new_pipeline.organization_id = v_organization_id
   and new_pipeline.slug = source_pipeline.slug
  where stage.organization_id = p_source_organization_id;

  insert into public.tags (
    organization_id,
    name,
    code,
    description,
    color,
    is_active,
    created_by
  )
  select
    v_organization_id,
    tag.name,
    tag.code,
    tag.description,
    tag.color,
    tag.is_active,
    v_user_id
  from public.tags as tag
  where tag.organization_id = p_source_organization_id;

  insert into public.lead_sources (
    organization_id,
    name,
    code,
    description,
    platform,
    is_active,
    created_by
  )
  select
    v_organization_id,
    source.name,
    source.code,
    source.description,
    source.platform,
    source.is_active,
    v_user_id
  from public.lead_sources as source
  where source.organization_id = p_source_organization_id;

  insert into public.custom_fields (
    organization_id,
    pipeline_id,
    name,
    code,
    description,
    field_type,
    config,
    position,
    is_required,
    is_active,
    is_filterable,
    show_in_table,
    show_in_kanban,
    placeholder,
    help_text,
    created_by
  )
  select
    v_organization_id,
    new_pipeline.id,
    field.name,
    field.code,
    field.description,
    field.field_type,
    field.config,
    field.position,
    field.is_required,
    field.is_active,
    field.is_filterable,
    field.show_in_table,
    field.show_in_kanban,
    field.placeholder,
    field.help_text,
    v_user_id
  from public.custom_fields as field
  left join public.pipelines as source_pipeline
    on source_pipeline.id = field.pipeline_id
   and source_pipeline.organization_id = p_source_organization_id
  left join public.pipelines as new_pipeline
    on new_pipeline.organization_id = v_organization_id
   and new_pipeline.slug = source_pipeline.slug
  where field.organization_id = p_source_organization_id;

  insert into public.custom_field_options (
    organization_id,
    field_id,
    label,
    value,
    color,
    position,
    is_active,
    created_by
  )
  select
    v_organization_id,
    new_field.id,
    option.label,
    option.value,
    option.color,
    option.position,
    option.is_active,
    v_user_id
  from public.custom_field_options as option
  join public.custom_fields as source_field
    on source_field.id = option.field_id
   and source_field.organization_id = p_source_organization_id
  join public.custom_fields as new_field
    on new_field.organization_id = v_organization_id
   and new_field.code = source_field.code
  where option.organization_id = p_source_organization_id;


  if exists (
    select 1
    from public.lead_field_settings
    where organization_id = p_source_organization_id
  ) then
    delete from public.lead_field_settings
    where organization_id = v_organization_id;

    insert into public.lead_field_settings (
      organization_id,
      field_key,
      label,
      field_type,
      is_required,
      is_active,
      show_in_table,
      position
    )
    select
      v_organization_id,
      field.field_key,
      field.label,
      field.field_type,
      field.is_required,
      field.is_active,
      field.show_in_table,
      field.position
    from public.lead_field_settings as field
    where field.organization_id = p_source_organization_id;
  end if;

  return jsonb_build_object(
    'created', true,
    'organization_id', v_organization_id,
    'name', v_name,
    'slug', v_slug
  );
end;
$function$;

revoke all on function public.provision_crm_organization(uuid, text, text)
  from public, anon;
grant execute on function public.provision_crm_organization(uuid, text, text)
  to authenticated;
