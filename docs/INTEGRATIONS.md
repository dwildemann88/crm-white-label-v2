# Integrações externas

## Facebook Lead Ads

O fluxo atualmente validado utiliza:

```text
Facebook Lead Ads → Make → receive-crm-lead → Supabase → CRM
```

O Make consulta os detalhes do lead, normaliza o payload e envia ao endpoint do CRM com autenticação própria e idempotência por ID do lead.

## Entrada genérica

Cada página, simulador ou cenário recebe uma chave própria.

```http
POST /functions/v1/receive-crm-lead
x-crm-integration-key: <public-key>
Authorization: Bearer <secret>
Content-Type: application/json
```

O backend valida a chave, registra o payload, aplica mapeamento, deduplicação, funil, etapa, responsável e campos personalizados.

## Google

Existem dois fluxos:

- formulário nativo do Google Ads: o Google envia ao webhook configurado;
- landing page ou simulador: o próprio formulário chama a entrada genérica e envia UTMs, `gclid` e, quando disponíveis, `gbraid`/`wbraid`.

Cada origem deve ter chave independente para permitir revogação e rastreamento.

## WhatsApp Business Platform — integração direta

A partir da V5.2.0, o Make não transporta mensagens do WhatsApp.

Recebimento:

```text
Webhook Meta → whatsapp-cloud-webhook → banco → Realtime → tela do atendente
```

Envio:

```text
Tela → dispatch-whatsapp-message → Graph API → webhook de status → banco → tela
```

A configuração é feita por organização com WABA ID, Phone Number ID e token de usuário de sistema. O token é criptografado no backend e não fica acessível pelo frontend.

Regras:

- um número ativo por organização nesta etapa;
- roteamento da empresa pelo `phone_number_id`;
- uma conversa possui responsável atual;
- a próxima mensagem após transferência preserva a assinatura prevista pelo CRM;
- anexos são armazenados no bucket privado e entregues à Meta por URL temporária;
- mensagens recebidas criam ou localizam contato, lead e conversa;
- janela de atendimento e templates continuam obrigatórios;
- `sent`, `delivered`, `read` e `failed` são atualizados pelo webhook;
- o webhook valida a assinatura HMAC enviada pela Meta.

A publicação detalhada está em `docs/WHATSAPP-CLOUD-DIRETO.md`.

## Atualização em tempo real

O Supabase Realtime publica alterações de leads, tarefas, conversas, mensagens, status e notificações conforme as tabelas já cadastradas na publicação.
