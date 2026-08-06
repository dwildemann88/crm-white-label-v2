# Arquitetura atual do CRM

```text
React + TypeScript
        ↓
CrmContext
        ↓
CrmGateway
 ├── LocalCrmGateway
 ├── RestCrmGateway
 └── SupabaseCrmGateway
        ↓
Supabase Auth + PostgreSQL + RLS + RPCs + Realtime + Storage
        ↓
Edge Functions
 ├── Meta Graph API / WhatsApp Cloud API
 └── Make para Facebook Lead Ads e integrações auxiliares
```

## Núcleo operacional

O provedor Supabase atende leads, Kanban, tarefas, conversas, mensagens, mídias, templates, notificações e organizações. O provedor local permanece para desenvolvimento e compatibilidade.

## Multiempresa

O isolamento é feito por `organization_id`, memberships, papéis, permissões, acesso a funis e policies de RLS. Uma aplicação atende várias empresas sem duplicar o frontend.

## Identidade da organização

Cada organização pode fornecer:

- nome da empresa;
- nome exibido do CRM;
- logo.

A interface não aplica cores diferentes por organização. Paleta, tipografia, contraste, espaçamento e componentes são controlados pelo produto para manter consistência e acessibilidade.

Os campos de cor existentes no banco são preservados por compatibilidade, mas não dirigem o tema visual V4.

## Administração

Funis, etapas, etiquetas, campos personalizados e identificação da empresa utilizam os contratos atuais. Convites de usuários e provisionamento de organizações permanecem separados em `supabase/functions` e `supabase/migrations`, sem implantação automática.

## Integrações

O WhatsApp utiliza Edge Functions próprias e a Graph API da Meta. A organização é identificada pelo `phone_number_id` recebido no webhook. O Make não participa do transporte das mensagens na V5.2.

Credenciais não são armazenadas no frontend.
