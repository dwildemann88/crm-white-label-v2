-- Adiciona o modo CRM genérico ao provisionamento de organizações.
-- O modo "copy" mantém o provisionador anterior e copia apenas configurações.
-- O modo "generic" cria uma estrutura comercial neutra, sem dados operacionais,
-- etiquetas, campos personalizados, arquivos, integrações ou credenciais.

create or replace function public.provision_crm_organization(
  p_source_organization_id uuid,
  p_name text,
  p_slug text,
  p_template_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid := gen_random_uuid();
  v_pipeline_id uuid := gen_random_uuid();
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_template_mode text := lower(btrim(coalesce(p_template_mode, '')));
  v_admin_role_id uuid;
begin
  if v_template_mode not in ('generic', 'copy') then
    raise exception 'O modelo de criação informado é inválido.'
      using errcode = '22023';
  end if;

  -- Preserva integralmente o comportamento já validado para cópia de empresas.
  if v_template_mode = 'copy' then
    return public.provision_crm_organization(
      p_source_organization_id,
      p_name,
      p_slug
    );
  end if;

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

  -- A organização de origem é usada somente como referência dos vínculos de
  -- permissões dos quatro cargos padrão. Nenhuma configuração comercial é copiada.
  if not exists (
    select 1
    from public.organizations
    where id = p_source_organization_id
  ) then
    raise exception 'A organização de referência não foi encontrada.'
      using errcode = 'P0002';
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
  values (
    v_organization_id,
    v_name || ' CRM',
    null,
    null,
    null,
    '#2563eb',
    '#172033',
    '#0ea5e9',
    '#f5f7fb',
    'Inter'
  );

  insert into public.roles (
    organization_id,
    name,
    code,
    description,
    is_system
  )
  values
    (
      v_organization_id,
      'Administrador superior',
      'super_admin',
      'Acesso administrativo completo à organização.',
      true
    ),
    (
      v_organization_id,
      'Gerente',
      'manager',
      'Gestão comercial, equipe, tarefas e relatórios.',
      true
    ),
    (
      v_organization_id,
      'Comercial',
      'sales',
      'Operação dos leads e oportunidades atribuídos.',
      true
    ),
    (
      v_organization_id,
      'SDR',
      'sdr',
      'Captação, qualificação e distribuição inicial de leads.',
      true
    );

  insert into public.role_permissions (role_id, permission_id)
  select
    new_role.id,
    source_permission.permission_id
  from public.roles as new_role
  join public.roles as source_role
    on source_role.organization_id = p_source_organization_id
   and source_role.code = new_role.code
  join public.role_permissions as source_permission
    on source_permission.role_id = source_role.id
  where new_role.organization_id = v_organization_id
  on conflict do nothing;

  select role.id
  into v_admin_role_id
  from public.roles as role
  where role.organization_id = v_organization_id
    and role.code = 'super_admin'
  limit 1;

  -- Garante que o administrador nunca seja criado sem permissões, mesmo que a
  -- organização de referência esteja com uma matriz incompleta.
  insert into public.role_permissions (role_id, permission_id)
  select v_admin_role_id, permission.id
  from public.permissions as permission
  on conflict do nothing;

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
    id,
    organization_id,
    name,
    slug,
    description,
    status,
    is_default,
    created_by
  )
  values (
    v_pipeline_id,
    v_organization_id,
    'Comercial',
    'comercial',
    'Funil comercial padrão para captação, qualificação e fechamento.',
    'active',
    true,
    v_user_id
  );

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
  values
    (
      v_organization_id,
      v_pipeline_id,
      'Novos leads',
      'novos_leads',
      'Oportunidades recém-cadastradas ou recebidas.',
      '#F4C430',
      1,
      'open',
      10,
      true,
      false,
      false,
      v_user_id
    ),
    (
      v_organization_id,
      v_pipeline_id,
      'Qualificação',
      'qualificacao',
      'Validação de necessidade, perfil e potencial.',
      '#4DABF7',
      2,
      'open',
      25,
      true,
      false,
      false,
      v_user_id
    ),
    (
      v_organization_id,
      v_pipeline_id,
      'Proposta',
      'proposta',
      'Proposta comercial em elaboração ou apresentada.',
      '#B197FC',
      3,
      'open',
      50,
      true,
      false,
      false,
      v_user_id
    ),
    (
      v_organization_id,
      v_pipeline_id,
      'Negociação',
      'negociacao',
      'Ajustes comerciais e tratativas finais.',
      '#FFA94D',
      4,
      'open',
      75,
      true,
      false,
      false,
      v_user_id
    ),
    (
      v_organization_id,
      v_pipeline_id,
      'Ganhos',
      'ganhos',
      'Oportunidades convertidas.',
      '#38D9A9',
      5,
      'won',
      100,
      true,
      false,
      false,
      v_user_id
    ),
    (
      v_organization_id,
      v_pipeline_id,
      'Perdidos',
      'perdidos',
      'Oportunidades encerradas sem conversão.',
      '#FF8787',
      6,
      'lost',
      0,
      true,
      true,
      false,
      v_user_id
    );

  insert into public.lead_sources (
    organization_id,
    name,
    code,
    description,
    platform,
    is_active,
    created_by
  )
  values
    (
      v_organization_id,
      'Entrada manual',
      'entrada_manual',
      'Lead cadastrado diretamente no CRM.',
      'manual',
      true,
      v_user_id
    ),
    (
      v_organization_id,
      'Site',
      'site',
      'Lead recebido por formulário ou página da empresa.',
      'website',
      true,
      v_user_id
    ),
    (
      v_organization_id,
      'Indicação',
      'indicacao',
      'Lead originado por indicação.',
      'referral',
      true,
      v_user_id
    ),
    (
      v_organization_id,
      'Meta Ads',
      'meta_ads',
      'Lead originado por campanhas da Meta.',
      'meta',
      true,
      v_user_id
    ),
    (
      v_organization_id,
      'Google Ads',
      'google_ads',
      'Lead originado por campanhas do Google.',
      'google',
      true,
      v_user_id
    ),
    (
      v_organization_id,
      'WhatsApp',
      'whatsapp',
      'Lead iniciado por atendimento no WhatsApp.',
      'whatsapp',
      true,
      v_user_id
    ),
    (
      v_organization_id,
      'Outros',
      'outros',
      'Demais origens não classificadas.',
      'other',
      true,
      v_user_id
    );

  -- A trigger de organizations já cria os doze campos estruturais. O modelo
  -- genérico mantém somente Nome como obrigatório e inicia campos avançados ocultos.
  update public.lead_field_settings
  set
    is_required = case when field_key = 'name' then true else false end,
    is_active = case
      when field_key in ('campaign', 'temperature', 'score') then false
      else true
    end,
    show_in_table = case
      when field_key in ('name', 'company', 'phone', 'email', 'city', 'origin', 'priority', 'value') then true
      else false
    end
  where organization_id = v_organization_id;

  return jsonb_build_object(
    'created', true,
    'organization_id', v_organization_id,
    'name', v_name,
    'slug', v_slug,
    'template_mode', v_template_mode
  );
end;
$function$;

revoke all on function public.provision_crm_organization(
  uuid,
  text,
  text,
  text
) from public, anon;

grant execute on function public.provision_crm_organization(
  uuid,
  text,
  text,
  text
) to authenticated;
