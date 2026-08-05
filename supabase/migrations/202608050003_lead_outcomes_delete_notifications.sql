-- Movimentação comercial com motivo de perda/valor de venda,
-- exclusão segura de leads e notificações de transferência.

insert into public.permissions (
  code,
  name,
  description,
  category
)
select
  'leads.delete',
  'Excluir leads',
  'Permite excluir definitivamente leads e seus registros operacionais vinculados.',
  'leads'
where not exists (
  select 1
  from public.permissions
  where code = 'leads.delete'
);

insert into public.role_permissions (
  role_id,
  permission_id
)
select
  role.id,
  permission.id
from public.roles as role
join public.permissions as permission
  on permission.code = 'leads.delete'
where role.code in ('super_admin', 'admin', 'manager')
  and not exists (
    select 1
    from public.role_permissions as existing
    where existing.role_id = role.id
      and existing.permission_id = permission.id
  );

create or replace function public.move_crm_lead_with_outcome(
  p_organization_id uuid,
  p_lead_id uuid,
  p_stage_id uuid,
  p_loss_reason text default null,
  p_sale_value numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor_id uuid := auth.uid();
  current_lead record;
  target_stage record;
  normalized_loss_reason text;
  final_sale_value numeric;
begin
  if actor_id is null then
    raise exception 'É necessário estar autenticado para movimentar leads.';
  end if;

  if not private.is_organization_member(p_organization_id) then
    raise exception 'O usuário não pertence à empresa informada.';
  end if;

  if not (
    private.is_organization_admin(p_organization_id)
    or private.has_permission(p_organization_id, 'leads.update')
    or private.has_permission(p_organization_id, 'leads.move')
  ) then
    raise exception 'Você não possui permissão para movimentar leads.';
  end if;

  select
    lead.id,
    lead.pipeline_id,
    lead.stage_id,
    lead.assigned_to,
    lead.estimated_value
  into current_lead
  from public.leads as lead
  where lead.id = p_lead_id
    and lead.organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Lead não encontrado.';
  end if;

  if not private.can_view_lead(p_lead_id) then
    raise exception 'Este lead não está no seu escopo de acesso.';
  end if;

  if not private.user_can_access_pipeline(actor_id, current_lead.pipeline_id) then
    raise exception 'Você não possui acesso ao funil deste lead.';
  end if;

  select
    stage.id,
    stage.pipeline_id,
    stage.name,
    stage.category,
    stage.requires_loss_reason,
    stage.requires_value
  into target_stage
  from public.pipeline_stages as stage
  where stage.id = p_stage_id
    and stage.organization_id = p_organization_id
    and stage.pipeline_id = current_lead.pipeline_id
    and stage.is_active = true;

  if not found then
    raise exception 'A etapa selecionada não pertence ao funil do lead ou está inativa.';
  end if;

  if not private.can_operate_pipeline_stage(p_stage_id) then
    raise exception 'Você não possui acesso operacional à etapa selecionada.';
  end if;

  if current_lead.stage_id = p_stage_id then
    return jsonb_build_object(
      'lead_id', p_lead_id,
      'stage_id', p_stage_id,
      'moved', false,
      'reason', 'same_stage'
    );
  end if;

  normalized_loss_reason := nullif(pg_catalog.btrim(p_loss_reason), '');
  final_sale_value := p_sale_value;

  if p_sale_value is not null and p_sale_value < 0 then
    raise exception 'O valor da venda não pode ser negativo.';
  end if;

  if (target_stage.requires_loss_reason or target_stage.category = 'lost')
     and (
       normalized_loss_reason is null
       or char_length(normalized_loss_reason) < 3
     ) then
    raise exception 'Informe a justificativa da perda.';
  end if;

  if normalized_loss_reason is not null
     and char_length(normalized_loss_reason) > 1000 then
    raise exception 'A justificativa da perda deve possuir no máximo 1000 caracteres.';
  end if;

  if (target_stage.requires_value or target_stage.category = 'won')
     and (final_sale_value is null or final_sale_value <= 0) then
    raise exception 'Informe um valor de venda maior que zero.';
  end if;

  update public.leads
  set
    stage_id = p_stage_id,
    status = case
      when target_stage.category in ('open', 'won', 'lost')
        then target_stage.category
      else status
    end,
    lost_reason = case
      when target_stage.category = 'lost'
        then normalized_loss_reason
      else null
    end,
    estimated_value = case
      when target_stage.category = 'won'
        then final_sale_value
      else estimated_value
    end,
    closed_at = case
      when target_stage.category in ('won', 'lost')
        then now()
      else null
    end,
    updated_by = actor_id,
    updated_at = now(),
    last_activity_at = now()
  where id = p_lead_id
    and organization_id = p_organization_id;

  return jsonb_build_object(
    'lead_id', p_lead_id,
    'previous_stage_id', current_lead.stage_id,
    'stage_id', p_stage_id,
    'stage_name', target_stage.name,
    'outcome', target_stage.category,
    'sale_value', case
      when target_stage.category = 'won' then final_sale_value
      else null
    end,
    'loss_reason', case
      when target_stage.category = 'lost' then normalized_loss_reason
      else null
    end,
    'moved', true
  );
end;
$function$;

create or replace function public.delete_crm_lead(
  p_organization_id uuid,
  p_lead_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'É necessário estar autenticado para excluir leads.';
  end if;

  if not private.is_organization_member(p_organization_id) then
    raise exception 'O usuário não pertence à empresa informada.';
  end if;

  if not (
    private.is_organization_admin(p_organization_id)
    or private.has_permission(p_organization_id, 'leads.delete')
  ) then
    raise exception 'Você não possui permissão para excluir leads.';
  end if;

  if not private.can_view_lead(p_lead_id) then
    raise exception 'Lead não encontrado ou indisponível para este usuário.';
  end if;

  perform 1
  from public.leads as lead
  where lead.id = p_lead_id
    and lead.organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Lead não encontrado.';
  end if;

  delete from public.notifications
  where organization_id = p_organization_id
    and entity_type = 'lead'
    and entity_id = p_lead_id;

  -- A exclusão é definitiva. Conversas e mensagens vinculadas ao lead também
  -- são removidas para não deixar atendimentos sem contexto comercial.
  delete from public.conversations
  where organization_id = p_organization_id
    and lead_id = p_lead_id;

  delete from public.leads
  where id = p_lead_id
    and organization_id = p_organization_id;


  return jsonb_build_object(
    'lead_id', p_lead_id,
    'deleted', true
  );
end;
$function$;

create or replace function private.notify_lead_assignment()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor_id uuid;
  actor_name text;
  lead_name text;
begin
  if new.assigned_to is null
     or new.assigned_to is not distinct from old.assigned_to then
    return new;
  end if;

  actor_id := coalesce(new.updated_by, auth.uid(), new.created_by);

  -- Não gera uma notificação para uma atribuição feita pelo próprio destinatário.
  if actor_id is not null and actor_id = new.assigned_to then
    return new;
  end if;

  select profile.full_name
  into actor_name
  from public.profiles as profile
  where profile.id = actor_id;

  select coalesce(contact.full_name, new.title, 'Lead sem nome')
  into lead_name
  from public.contacts as contact
  where contact.id = new.contact_id
    and contact.organization_id = new.organization_id;

  insert into public.notifications (
    organization_id,
    user_id,
    type,
    title,
    message,
    entity_type,
    entity_id,
    payload
  )
  values (
    new.organization_id,
    new.assigned_to,
    'lead.assigned',
    'Você recebeu um lead',
    pg_catalog.concat(
      coalesce(lead_name, 'Uma oportunidade'),
      ' foi transferido para você',
      case
        when actor_name is not null then pg_catalog.concat(' por ', actor_name)
        else ''
      end,
      '.'
    ),
    'lead',
    new.id,
    jsonb_build_object(
      'lead_id', new.id,
      'previous_user_id', old.assigned_to,
      'new_user_id', new.assigned_to,
      'changed_by', actor_id
    )
  );

  return new;
end;
$function$;

drop trigger if exists leads_notify_assignment on public.leads;

create trigger leads_notify_assignment
after update of assigned_to on public.leads
for each row
execute function private.notify_lead_assignment();

revoke all on function public.move_crm_lead_with_outcome(uuid, uuid, uuid, text, numeric) from public;
grant execute on function public.move_crm_lead_with_outcome(uuid, uuid, uuid, text, numeric) to authenticated;

revoke all on function public.delete_crm_lead(uuid, uuid) from public;
grant execute on function public.delete_crm_lead(uuid, uuid) to authenticated;

revoke all on function private.notify_lead_assignment() from public;
