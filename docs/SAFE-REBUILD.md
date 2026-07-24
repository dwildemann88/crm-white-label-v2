# Reconstrução segura do produto

Esta versão altera amplamente a interface sem mudar os contratos operacionais já utilizados em produção.

## Contratos preservados

- nomes e argumentos das RPCs atuais;
- tabelas e relacionamentos acessados pelo `SupabaseCrmGateway`;
- nomes das Edge Functions;
- payloads enviados ao Make;
- fluxo de envio e recebimento do WhatsApp;
- upload de imagens, áudios, vídeos e documentos;
- autenticação e sessão do Supabase;
- isolamento por `organization_id` e policies existentes.

## Mudanças realizadas

- nova tela de login centralizada e responsiva;
- remoção de linguagem de ambiente demonstrativo no modo conectado;
- shell branco com navegação semântica e identidade nominal por organização;
- sistema visual fixo, sem alteração de paleta por empresa;
- cores funcionais com significado estável;
- novo menu de usuário com logout;
- seletor de organização para administrador da plataforma;
- navegação móvel inferior;
- componentes, tabelas, Kanban, agenda, chat, relatórios, integrações e administração reconstruídos sobre o mesmo padrão claro;
- fontes das Edge Functions atuais versionadas em `supabase/functions`;
- operações de funis, etapas, etiquetas, campos e branding conectadas às tabelas e policies atuais;
- Edge Function isolada para convite e edição de usuários;
- migration opcional para provisionar uma nova organização copiando somente configurações;
- tipos atuais do banco versionados em `src/infrastructure/supabase/database.types.ts`;
- `.env.example` atualizado e proteção ampliada para arquivos `.env.*`.

## Limites desta etapa

A central de integrações permanece deliberadamente restrita ao essencial. Credenciais, conexões e estados técnicos não são simulados no navegador. O WhatsApp mantém os contratos atuais; o roteamento multiempresa será uma evolução posterior.

A Edge Function de usuários e a migration de provisionamento são novas e não foram aplicadas no projeto remoto. Enquanto não forem implantadas, o núcleo operacional atual permanece inalterado.

Novas integrações devem ser implementadas por configuração de organização, mantendo o frontend livre de tokens e credenciais administrativas.
