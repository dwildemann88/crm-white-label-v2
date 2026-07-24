# CRM Comercial Multiempresa — V5

Aplicação React + TypeScript para operação comercial multiempresa, conectada ao Supabase e preparada para integrações externas.

## Estado do produto

A V5 reconstrói a experiência de uso sem modificar os contratos operacionais existentes. Permanecem preservados:

- autenticação e isolamento por organização;
- cadastro, edição, filtragem e movimentação de leads;
- Kanban;
- tarefas e agenda;
- etiquetas e campos personalizados;
- conversas do WhatsApp;
- envio e recebimento de texto, imagens, áudios, vídeos e documentos;
- templates e atualização de status;
- RPCs, Edge Functions, Storage e payloads já utilizados pelo Make.

## Sistema visual

A aplicação utiliza um único arquivo de estilo: `src/ui-system.css`.

O white-label altera somente:

- nome da empresa;
- nome do CRM;
- logo.

Paleta, contraste, tipografia, espaçamento, componentes e cores semânticas permanecem padronizados. Isso impede que uma organização crie uma interface ilegível ou inconsistente.

## Principais correções da V5

- interface única, sem sobreposição de temas antigos;
- escala tipográfica legível e densidade operacional consistente;
- navegação e ações contextualizadas por tela;
- indicadores do dashboard e dos relatórios abrem o recorte exato de leads;
- responsável comercial validado contra o acesso ao funil;
- responsável pelo atendimento separado do responsável comercial;
- filtros avançados, chips e recortes especiais na base de leads;
- drawer do lead reorganizado por contexto, dados, classificação, observações e histórico;
- calendário e agenda com leitura correta de eventos;
- chat mobile com alternância entre lista e conversa;
- composer do WhatsApp sem input nativo visível;
- relatórios refeitos com KPIs, tendência, funil, origens, equipe e saúde operacional;
- administração com busca, filtros de usuários e edição estruturada;
- integrações apresentadas como configuração técnica, sem falsos estados de conexão.

## Execução local

```bash
npm install
npm run dev
```

Crie `.env.local` na raiz:

```env
VITE_DATA_PROVIDER=supabase
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_DEMO_AUTO_LOGIN=false
VITE_APP_NAME=CRM Comercial
```

O arquivo `.env.local` não acompanha o pacote. Sem as variáveis do Supabase, a aplicação mostra uma tela de configuração em vez de uma página branca.

## Validação

```bash
npm run verify
npm run typecheck
npm run build
```

- `verify:contracts` protege os contratos do Supabase, Edge Functions e WhatsApp.
- `verify:ui` protege o tema único, a coerência comercial e os pontos críticos de UI/UX.

## Publicação

Publique primeiro em uma URL de prévia e execute o checklist de `docs/PRODUCTION-CHECKLIST.md`. Nenhuma migration ou Edge Function é aplicada automaticamente por este frontend.

## Documentação principal

- `docs/UI-UX-STANDARD.md`
- `docs/UI-UX-ACCEPTANCE-V5.md`
- `docs/SAFE-REBUILD.md`
- `docs/PRODUCTION-CHECKLIST.md`
- `docs/INTEGRATIONS.md`
- `docs/IMPLEMENTATION-STATUS.md`

## Auditoria visual e funcional

A relação detalhada das correções aplicadas está em `docs/AUDITORIA-E-CORRECOES-V5.md`. Os critérios de clique, responsividade e coerência operacional estão em `docs/UI-UX-ACCEPTANCE-V5.md`.
