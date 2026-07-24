# Checklist de publicação

## Frontend

- executar `npm ci`;
- executar `npm run verify:contracts`;
- executar `npm run typecheck`;
- executar `npm run build`;
- publicar primeiro em URL de prévia;
- confirmar as variáveis `VITE_DATA_PROVIDER`, `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`;
- confirmar que `.env` e `.env.local` não estão versionados.

## Regressão operacional

- login e logout;
- carregamento da organização e do branding;
- criação e edição de lead;
- filtros e exportação;
- movimentação no Kanban;
- criação, edição e conclusão de tarefa;
- abertura e transferência de conversa;
- envio de texto;
- envio de imagem, áudio, vídeo e documento;
- recebimento de mensagem;
- status `sent`, `delivered`, `read` e `failed`;
- template fora da janela de 24 horas;
- isolamento entre organizações;
- funcionamento em celular.

## Banco e Supabase

- não executar `docs/SUPABASE-SCHEMA.sql`;
- manter migrations novas versionadas;
- testar migrations em staging;
- revisar RLS, grants e funções `SECURITY DEFINER`;
- manter backup e rollback disponíveis;
- não usar `db reset --linked` em produção.

## Recursos opcionais desta versão

Antes de implantar:

- testar `admin-manage-crm-user` com convite, edição, desativação e acesso a funis;
- testar `provision_crm_organization` com uma organização modelo;
- confirmar que nenhuma informação operacional ou credencial foi copiada;
- validar que o administrador criado não visualiza dados de outra empresa.

## Integrações

- manter tokens somente em secrets do Supabase ou serviço seguro;
- validar assinatura e idempotência dos webhooks;
- registrar erros com identificadores de mensagem e organização;
- manter cenário atual do Make disponível para rollback;
- não alterar payloads do WhatsApp no mesmo deploy do redesenho do frontend.
