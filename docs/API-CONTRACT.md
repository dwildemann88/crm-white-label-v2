# Contrato esperado pelo RestCrmGateway

Base: `VITE_API_URL`, por exemplo `https://api.crm.com.br/api`.

Todas as rotas, exceto login e entradas públicas, devem validar a sessão, o `organization_id`, o perfil e o acesso ao registro solicitado. O frontend não é uma barreira de segurança.

## Respostas e erros

- JSON em todas as respostas com conteúdo.
- `204 No Content` para operações sem payload.
- Erros no formato `{ "message": "Descrição segura do erro" }`.
- Datas em ISO 8601.
- Valores monetários em número decimal ou centavos, desde que o padrão seja único.

## Autenticação

- `POST /auth/login` — `{ email, password }` → `Session`
- `POST /auth/logout` — encerra a sessão no servidor, quando aplicável
- `GET /bootstrap` — retorna `AppSnapshot` já limitado ao escopo do usuário

O modo local usa sessão automática. Em produção, prefira cookie `httpOnly` ou token curto com renovação segura.

## Leads

- `POST /leads` — cria lead
- `PATCH /leads/:id` — edita lead
- `PATCH /leads/:id/stage` — `{ stageId }`
- `POST /leads/:id/notes` — `{ note }`

O backend deve validar pipeline, etapa, responsável, campos obrigatórios, telefone normalizado, duplicidade e escopo do usuário. Alterações de etapa e responsável devem gerar histórico.

## Tarefas

- `POST /tasks`
- `PATCH /tasks/:id`
- `PATCH /tasks/:id/toggle`
- `DELETE /tasks/:id`

## Usuários

- `POST /users`
- `PATCH /users/:id`
- `PATCH /users/:id/toggle`

Em produção, a criação deve gerar convite temporário; a interface administrativa não deve definir uma senha permanente.

## Funis e etapas

- `PUT /pipelines/:id`
- `DELETE /pipelines/:id`
- `PUT /stages/:id`
- `DELETE /stages/:id`

Bloqueie a exclusão do último funil e de funis/etapas utilizados por leads ou integrações, salvo migração explícita.

## Campos personalizados e etiquetas

- `PUT /custom-fields/:id`
- `DELETE /custom-fields/:id`
- `PUT /tags/:id`
- `DELETE /tags/:id`

## Organização e white-label

- `PUT /organization/branding`
- `PUT /organizations/:id`
- `POST /organizations/duplicate` — `{ sourceId, name, slug }`
- `POST /organizations/:id/switch` — retorna uma nova `Session`

A troca de organização é exclusiva do desenvolvedor/superadministrador autorizado. O backend deve auditar essa ação.

## Conversas

- `POST /conversations/:id/messages` — `{ body }`
- `PATCH /conversations/:id/transfer` — `{ userId }`
- `PATCH /conversations/:id/read`

O backend deve inserir a assinatura do novo atendente somente na primeira mensagem após transferência ou retomada, além de validar acesso ao lead e posse da conversa.

## Notificações

- `PATCH /notifications/:id/read`
- `PATCH /notifications/read-all`

## Integrações

- `PUT /integrations/:id`
- `POST /integrations/:id/test`

Credenciais reais devem ser recebidas por fluxo seguro e armazenadas criptografadas. O snapshot enviado ao navegador deve conter somente máscaras e metadados.

## Entradas públicas e webhooks

- `GET /webhooks/meta/leadgen` — verificação do webhook
- `POST /webhooks/meta/leadgen`
- `POST /webhooks/google/lead-form`
- `POST /webhooks/whatsapp`
- `POST /public/leads/:integrationKey`

Webhooks devem:

1. validar assinatura ou segredo;
2. responder rapidamente;
3. preservar o payload bruto;
4. registrar idempotência;
5. processar em fila;
6. normalizar e deduplicar;
7. publicar atualização em tempo real;
8. registrar falhas e tentativas.
