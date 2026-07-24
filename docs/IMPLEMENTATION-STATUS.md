# Situação da reconstrução

## Núcleo preservado

A reconstrução não renomeia nem remove os contratos usados atualmente para:

- autenticação Supabase;
- carregamento do contexto da organização;
- criação, edição e movimentação de leads;
- tarefas e lembretes;
- abertura e transferência de conversas;
- envio de texto, imagens, áudios, vídeos e documentos;
- templates do WhatsApp;
- recebimento de mensagens e atualização de status;
- upload privado de mídias;
- webhooks já conectados ao Make.

## Implementado no frontend

- login centralizado e responsivo;
- shell claro e multiempresa;
- sidebar agrupada por finalidade;
- navegação móvel inferior;
- sistema visual fixo e consistente em todas as organizações;
- personalização restrita a nome e logo da empresa;
- cores semânticas estáveis para estados e ações;
- remoção de controles demonstrativos no modo Supabase;
- logout e troca de organização;
- permissões da interface alinhadas ao contexto retornado pelo banco;
- filtros de data em leads e relatórios;
- filtros existentes preservados;
- edição de funis, etapas, campos personalizados, etiquetas e identificação da empresa conectada às tabelas atuais;
- central de integrações reduzida aos contratos essenciais e estados reais;
- área de desenvolvedor preparada para copiar configurações sem copiar dados operacionais.

## Recursos novos que exigem implantação separada

### Administração de usuários

Arquivo:

```text
supabase/functions/admin-manage-crm-user/index.ts
```

Responsabilidades:

- validar o administrador chamador;
- convidar ou atualizar usuário no Supabase Auth;
- criar ou atualizar vínculo com a organização;
- aplicar papel e acesso aos funis;
- manter a chave administrativa fora do navegador.

### Provisionamento de organizações

Arquivo:

```text
supabase/migrations/202607230001_provision_crm_organization.sql
```

Copia somente:

- branding;
- papéis e permissões;
- funis e etapas;
- etiquetas;
- origens;
- campos personalizados e opções.

Não copia:

- leads;
- contatos;
- tarefas;
- mensagens;
- usuários de outras empresas;
- arquivos;
- históricos;
- tokens ou credenciais.

Esses dois recursos não foram implantados automaticamente no projeto remoto.

## Integrações

O WhatsApp permanece com o fluxo atual e com os contratos existentes. A próxima evolução é associar cada conexão a uma organização pelo identificador do número ou conta, mantendo um único modelo de cenário no Make.

Meta Lead Ads, Google Ads e Analytics aparecem como fundações de produto, não como conexões fictícias. Credenciais e status não podem ser definidos manualmente no navegador.

## Validações executadas

- parsing dos 32 arquivos TypeScript/TSX sem erro sintático;
- parsing das 8 Edge Functions sem erro sintático;
- resolução de todos os imports relativos;
- verificação automática dos contratos essenciais com `npm run verify:contracts`;
- confirmação de ausência de `.env` e `.env.local` no pacote final.

O build completo não pôde ser executado neste ambiente porque o acesso ao registro npm falhou por DNS (`EAI_AGAIN`). A instalação e o build devem ser executados no computador de desenvolvimento antes do deploy.
