# Integrações externas

A página de integrações desta base configura o destino, o responsável padrão e o mapeamento dos campos. O teste atual é local e serve para validar o fluxo da interface. A conexão real depende dos endpoints abaixo.

## Entrada genérica

Cada página, simulador ou cenário recebe uma chave própria.

```http
POST /public/leads/webhook_7a91
Authorization: Bearer <secret>
Content-Type: application/json
```

O backend deve:

1. validar a chave;
2. registrar o payload bruto;
3. normalizar telefone e e-mail;
4. aplicar o mapeamento salvo;
5. deduplicar por `external_id`, telefone e e-mail;
6. criar ou atualizar o lead;
7. aplicar funil, etapa, responsável e etiquetas;
8. gerar histórico e notificação;
9. publicar o evento em tempo real.

## Meta Lead Ads

Necessário:

- aplicativo no Meta for Developers;
- empresa e Página autorizadas;
- assinatura do campo `leadgen`;
- token armazenado de forma criptografada;
- consulta dos dados completos pelo identificador do lead;
- idempotência pelo ID externo;
- seleção de Página, formulário, funil e mapeamento.

A interface já possui o local para configurar destino e mapeamento. O backend deverá realizar OAuth, guardar credenciais e registrar os webhooks.

## Google

Existem dois fluxos:

- formulário nativo do Google Ads: o Google envia ao webhook configurado;
- landing page ou simulador: o próprio formulário chama a entrada genérica e envia UTMs, `gclid` e, quando disponíveis, `gbraid`/`wbraid`.

Cada origem deve ter chave independente para permitir revogação e rastreamento.

## WhatsApp Business Platform

O CRM utiliza um número empresarial compartilhado por todos os usuários autorizados.

Recebimento:

```text
Webhook Meta → backend → banco → Realtime/WebSocket → tela do atendente
```

Envio:

```text
Tela → backend → Cloud API → status por webhook → banco → tela
```

Regras:

- uma conversa possui responsável atual;
- após transferência, `signature_pending = true`;
- a próxima mensagem recebe `Nome | Cargo` no corpo;
- todos os usuários autorizados consultam o histórico conforme seu escopo;
- respostas simultâneas podem ser bloqueadas por posse ou trava curta;
- tokens nunca ficam no frontend;
- anexos devem ser validados, armazenados e enviados pelo backend;
- janela de atendimento e templates precisam ser respeitados.

## Atualização em tempo real

Para o backend real, use Supabase Realtime ou WebSocket para publicar eventos como:

```text
lead.created
lead.updated
lead.moved
lead.assigned
task.created
task.completed
message.received
message.status_changed
notification.created
```
