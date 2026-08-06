# WhatsApp Cloud API direto — V5.2.0

Esta versão substitui o Make como transporte das mensagens do WhatsApp. O CRM mantém o mesmo módulo de conversas, banco, janela de atendimento, templates, mídia e status, mas passa a conversar diretamente com a API oficial da Meta.

## Escopo desta etapa

- uma integração ativa de WhatsApp por organização;
- configuração manual por WABA ID, Phone Number ID e token;
- token criptografado antes de ser armazenado;
- validação do número e da WABA na Meta;
- inscrição automática da WABA no aplicativo;
- recebimento direto de mensagens e status;
- envio direto de texto, imagem, áudio, vídeo, documento e template;
- criação automática de contato, lead e conversa pelo fluxo já existente;
- download de mídia recebida para o bucket `crm-whatsapp-media`;
- atualização de `sent`, `delivered`, `read` e `failed`;
- separação da empresa pelo `phone_number_id` recebido no webhook.

Ainda não fazem parte desta etapa:

- Embedded Signup;
- múltiplos números na mesma organização;
- sincronização automática de templates;
- gestão de templates pela interface;
- migração automática do WhatsApp Business App para Cloud API.

## 1. Pré-requisitos na Meta

Use um aplicativo Meta pertencente ao responsável pelo CRM e um token de usuário de sistema com acesso aos ativos da empresa cliente. O token precisa ter sido emitido para o mesmo aplicativo cujo App Secret e webhook serão usados pelo CRM.

O token precisa, no mínimo, das permissões:

```text
whatsapp_business_management
whatsapp_business_messaging
```

Tenha disponíveis:

```text
Meta App Secret
WABA ID
Phone Number ID
Token de acesso do usuário de sistema
```

O WABA ID e o Phone Number ID precisam pertencer à mesma conta. A Edge Function valida essa associação antes de salvar.

## 2. Aplicar a migration

No Supabase, abra **SQL Editor**, cole e execute:

```text
supabase/migrations/202608050004_whatsapp_cloud_direct.sql
```

Resultado esperado:

```text
Success. No rows returned
```

A migration cria a tabela `crm_whatsapp_integrations` e as RPCs administrativas. Nenhuma credencial fica exposta ao frontend.

## 3. Configurar secrets das Edge Functions

Gere dois valores aleatórios diferentes: uma chave para criptografar credenciais e um token para verificar o webhook.

Exemplo de geração local:

```bash
openssl rand -hex 32
```

Cadastre no Supabase:

```bash
supabase secrets set \
  WHATSAPP_CREDENTIALS_KEY="CHAVE_ALEATORIA_COM_PELO_MENOS_24_CARACTERES" \
  WHATSAPP_WEBHOOK_VERIFY_TOKEN="TOKEN_ALEATORIO_DO_WEBHOOK" \
  META_APP_SECRET="APP_SECRET_DO_APLICATIVO_META" \
  META_GRAPH_VERSION="v25.0"
```

Regras:

- `WHATSAPP_CREDENTIALS_KEY` não pode ser alterada depois que tokens forem salvos, salvo se todos forem reconectados;
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` precisa ser exatamente igual ao informado na Meta;
- `META_APP_SECRET` deve ser do mesmo aplicativo que recebe o webhook;
- não use nenhuma dessas chaves em variáveis `VITE_*`.

## 4. Publicar as Edge Functions

```bash
supabase functions deploy manage-whatsapp-cloud-integration
supabase functions deploy dispatch-whatsapp-message
supabase functions deploy dispatch-whatsapp-template
supabase functions deploy whatsapp-cloud-webhook --no-verify-jwt
```

Somente `whatsapp-cloud-webhook` usa `--no-verify-jwt`, porque a Meta não envia JWT do Supabase. Essa função valida o desafio inicial e a assinatura `X-Hub-Signature-256` da Meta.

## 5. Configurar o webhook no aplicativo Meta

No produto WhatsApp do aplicativo Meta, configure:

```text
Callback URL:
https://SEU-PROJETO.supabase.co/functions/v1/whatsapp-cloud-webhook

Verify token:
mesmo valor de WHATSAPP_WEBHOOK_VERIFY_TOKEN
```

Assine o campo:

```text
messages
```

Ao salvar a integração no CRM, a função também chama a inscrição da WABA em `/{WABA-ID}/subscribed_apps`. Uma inscrição cobre todos os números daquela WABA.

## 6. Conectar o número no CRM

Acesse:

```text
Administração/Integrações → WhatsApp Cloud API → Conectar WhatsApp
```

Informe:

- WABA ID;
- Phone Number ID;
- versão da Graph API;
- token de acesso.

O número exibido e o nome verificado são consultados diretamente na Meta. O campo de número exibido existe apenas como apoio visual e não substitui o Phone Number ID.

Ao editar uma conexão já existente, deixe o token vazio para mantê-lo.

## 7. Testes obrigatórios

Faça os testes nesta ordem:

1. clique em **Testar conexão**;
2. envie uma mensagem de um telefone externo para o número empresarial;
3. confirme a criação ou localização do contato, lead e conversa;
4. responda com texto dentro da janela de 24 horas;
5. confirme os estados `sent`, `delivered` e `read`;
6. envie imagem, áudio, vídeo e documento;
7. receba uma mídia e abra o arquivo no CRM;
8. simule uma falha de envio e confira a mensagem de erro;
9. teste o template `reativar_chat` fora da janela de 24 horas;
10. confirme que uma segunda organização não enxerga a integração nem as conversas.

## 8. Transição do Make

Durante a homologação, mantenha o cenário antigo do Make disponível como rollback. A deduplicação por `external_message_id` reduz o risco de duplicação caso os dois receptores recebam o mesmo evento.

Depois de validar todos os testes:

1. desative os cenários do Make responsáveis pelo WhatsApp;
2. não desative o cenário do Facebook Lead Ads, pois ele é uma integração separada;
3. remova apenas secrets antigos relacionados ao transporte do WhatsApp pelo Make;
4. preserve o ZIP da V5.1.0 para rollback das Edge Functions antigas.

## 9. Diagnóstico

### O CRM envia, mas não recebe

Verifique:

- callback validado na Meta;
- campo `messages` assinado;
- WABA inscrita no aplicativo;
- `phone_number_id` igual ao cadastrado no CRM;
- logs da função `whatsapp-cloud-webhook`;
- assinatura usando o App Secret correto.

### O CRM recebe, mas não envia

Verifique:

- token com `whatsapp_business_messaging`;
- número registrado e ativo na Cloud API;
- telefone do contato com DDI;
- janela de 24 horas;
- logs de `dispatch-whatsapp-message`;
- `last_error` exibido na integração.

### A conexão retorna que o número não pertence à WABA

O WABA ID ou Phone Number ID foi copiado de outro ativo. Consulte a lista de números da WABA na Meta e use o `id`, não o número formatado.

### Erro ao descriptografar credencial

A secret `WHATSAPP_CREDENTIALS_KEY` foi alterada. Restaure a chave anterior ou reconecte cada número com o novo token.

## 10. Rollback

Para retornar temporariamente ao Make:

1. reative os cenários antigos;
2. redeploy das funções `dispatch-whatsapp-message` e `dispatch-whatsapp-template` da V5.1.0;
3. mantenha a migration V5.2.0 aplicada — a tabela adicional não interfere no modelo antigo;
4. não apague conversas ou mensagens.
