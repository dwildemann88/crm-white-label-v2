-- ATENÇÃO: ARQUIVO LEGADO, SOMENTE PARA REFERÊNCIA HISTÓRICA.
-- NÃO EXECUTE ESTE ARQUIVO NO PROJETO SUPABASE ATUAL.
-- A estrutura real está documentada em supabase/reference e nas migrations versionadas.

-- Base inicial PostgreSQL/Supabase para o Projem Flow CRM.
-- Revise políticas, índices e funções em ambiente de homologação antes da produção.

create extension if not exists pgcrypto;
create extension if not exists citext;

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug citext not null unique,
  active boolean not null default true,
  branding jsonb not null default '{}'::jsonb,
  enabled_modules text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  initials text not null default '',
  color text not null default '#ffd43b',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table organization_memberships (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('super_admin','manager','sales','sdr')),
  role_label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table pipelines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table user_pipeline_access (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, pipeline_id)
);

create table pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  name text not null,
  color text not null default '#ffd43b',
  stage_order integer not null,
  kind text not null default 'open' check (kind in ('open','won','lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pipeline_id, stage_order)
);

create table custom_fields (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  field_key citext not null,
  name text not null,
  field_type text not null check (field_type in ('text','number','date','select','boolean')),
  options jsonb not null default '[]'::jsonb,
  required boolean not null default false,
  active boolean not null default true,
  show_in_table boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, field_key)
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  pipeline_id uuid not null references pipelines(id),
  stage_id uuid not null references pipeline_stages(id),
  owner_id uuid references profiles(id) on delete set null,
  name text not null,
  company text not null default '',
  phone text not null,
  phone_normalized text not null,
  email citext,
  city text not null default '',
  origin text not null default 'Entrada manual',
  campaign text not null default '',
  priority text not null default 'Média' check (priority in ('Baixa','Média','Alta','Urgente')),
  temperature text not null default 'Morno' check (temperature in ('Frio','Morno','Quente')),
  score integer not null default 0 check (score between 0 and 100),
  estimated_value numeric(14,2) not null default 0,
  notes text not null default '',
  raw_payload jsonb,
  external_source text,
  external_id text,
  last_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (organization_id, external_source, external_id)
);

create index leads_org_pipeline_stage_idx on leads(organization_id, pipeline_id, stage_id);
create index leads_org_owner_idx on leads(organization_id, owner_id);
create index leads_phone_idx on leads(organization_id, phone_normalized);
create index leads_created_at_idx on leads(organization_id, created_at desc);

create table lead_custom_values (
  organization_id uuid not null references organizations(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  field_id uuid not null references custom_fields(id) on delete cascade,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (lead_id, field_id)
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  color text not null default '#ffd43b',
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table lead_tags (
  organization_id uuid not null references organizations(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lead_id, tag_id)
);

create table lead_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  event_type text not null check (event_type in ('created','updated','moved','assigned','note','message')),
  description text not null,
  from_stage_id uuid references pipeline_stages(id) on delete set null,
  to_stage_id uuid references pipeline_stages(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index lead_history_lead_created_idx on lead_history(lead_id, created_at desc);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  owner_id uuid not null references profiles(id),
  lead_id uuid references leads(id) on delete set null,
  title text not null,
  description text not null default '',
  task_type text not null,
  priority text not null default 'Média' check (priority in ('Baixa','Média','Alta','Urgente')),
  due_at timestamptz not null,
  reminder_minutes integer not null default 15 check (reminder_minutes >= 0),
  reminder_notified_at timestamptz,
  done boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_org_owner_due_idx on tasks(organization_id, owner_id, due_at);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  owner_id uuid references profiles(id) on delete set null,
  channel text not null default 'whatsapp' check (channel in ('whatsapp')),
  external_conversation_id text,
  status text not null default 'open' check (status in ('open','waiting','closed')),
  unread_count integer not null default 0,
  signature_pending boolean not null default false,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, lead_id, channel)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_user_id uuid references profiles(id) on delete set null,
  external_message_id text,
  direction text not null check (direction in ('inbound','outbound','internal')),
  body text not null default '',
  status text not null check (status in ('received','sent','delivered','read','failed')),
  payload jsonb,
  created_at timestamptz not null default now(),
  unique nulls not distinct (organization_id, external_message_id)
);
create index messages_conversation_created_idx on messages(conversation_id, created_at);

create table integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider text not null check (provider in ('meta','google','whatsapp','webhook','website')),
  name text not null,
  description text not null default '',
  status text not null default 'disconnected' check (status in ('connected','attention','disconnected')),
  account_label text not null default '',
  endpoint text not null default '',
  secret_masked text not null default '',
  encrypted_credentials bytea,
  target_pipeline_id uuid references pipelines(id) on delete set null,
  target_stage_id uuid references pipeline_stages(id) on delete set null,
  default_owner_id uuid references profiles(id) on delete set null,
  last_event_at timestamptz,
  last_test_at timestamptz,
  events_received integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table integration_field_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  integration_id uuid not null references integrations(id) on delete cascade,
  source_field text not null,
  target_field text not null,
  unique (integration_id, source_field)
);

create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  integration_id uuid references integrations(id) on delete set null,
  provider text not null,
  external_event_id text,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received','processing','processed','failed','ignored')),
  attempts integer not null default 0,
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique nulls not distinct (provider, external_event_id)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_read_idx on notifications(organization_id, user_id, read, created_at desc);

create table user_column_preferences (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  view_key text not null,
  columns jsonb not null default '[]'::jsonb,
  filters jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id, view_key)
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index audit_logs_org_created_idx on audit_logs(organization_id, created_at desc);

-- Funções auxiliares de isolamento.
create or replace function is_member_of(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_memberships m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
      and m.active = true
  )
$$;

create or replace function role_in(target_org uuid, accepted_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_memberships m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
      and m.active = true
      and m.role = any(accepted_roles)
  )
$$;

-- Habilitação de RLS.
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table organization_memberships enable row level security;
alter table pipelines enable row level security;
alter table user_pipeline_access enable row level security;
alter table pipeline_stages enable row level security;
alter table custom_fields enable row level security;
alter table leads enable row level security;
alter table lead_custom_values enable row level security;
alter table tags enable row level security;
alter table lead_tags enable row level security;
alter table lead_history enable row level security;
alter table tasks enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table integrations enable row level security;
alter table integration_field_mappings enable row level security;
alter table webhook_events enable row level security;
alter table notifications enable row level security;
alter table user_column_preferences enable row level security;
alter table audit_logs enable row level security;

-- Políticas-base de leitura por organização. As regras específicas de proprietário,
-- funil, função e escrita precisam ser ampliadas antes da produção.
create policy organizations_member_select on organizations
for select using (is_member_of(id));

create policy pipelines_member_select on pipelines
for select using (is_member_of(organization_id));

create policy stages_member_select on pipeline_stages
for select using (is_member_of(organization_id));

create policy leads_member_select on leads
for select using (is_member_of(organization_id));

create policy tasks_member_select on tasks
for select using (is_member_of(organization_id));

create policy conversations_member_select on conversations
for select using (is_member_of(organization_id));

create policy messages_member_select on messages
for select using (is_member_of(organization_id));

create policy notifications_own_select on notifications
for select using (
  is_member_of(organization_id)
  and (user_id is null or user_id = auth.uid())
);

-- Não crie políticas genéricas de escrita antes de implementar as regras de papel,
-- propriedade, pipeline e auditoria descritas no contrato da API.
