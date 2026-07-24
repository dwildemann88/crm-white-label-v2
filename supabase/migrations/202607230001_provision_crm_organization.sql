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
