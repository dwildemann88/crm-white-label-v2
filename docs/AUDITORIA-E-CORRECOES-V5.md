# Auditoria e correções aplicadas — V5

Esta versão foi revisada a partir das telas reais da V4. O objetivo não foi apenas alterar aparência, mas corrigir hierarquia, comportamento, coerência comercial, navegação e legibilidade sem modificar os contratos atuais do Supabase, Make e WhatsApp.

## Sistema visual

- um único stylesheet (`src/ui-system.css`);
- fundo neutro e superfícies brancas com hierarquia clara;
- contraste revisado para títulos, textos, placeholders, badges e estados desabilitados;
- escala consistente de espaçamento, alturas, bordas e raios;
- áreas clicáveis com foco visível e tamanho adequado;
- cores fixas por significado, não por empresa;
- nome e logo permanecem personalizáveis, mas o padrão de produto é protegido.

## Navegação e shell

- removido qualquer botão de fechar/recolher ao lado da marca no desktop;
- o X existe somente no drawer móvel aberto;
- menus de perfil, organização e notificações são mutuamente exclusivos;
- Escape fecha superfícies transitórias;
- busca global leva à lista de leads com a consulta aplicada;
- cabeçalho e navegação móvel foram ajustados para telas estreitas.

## Coerência comercial

- responsável por lead só pode ser selecionado quando possui acesso ao funil;
- responsável incompatível é sinalizado no lead, drawer e relatórios;
- responsável comercial e responsável pelo atendimento são tratados separadamente;
- transferências no chat exibem apenas usuários elegíveis;
- funil e etapa permanecem vinculados em filtros, listas, Kanban e relatórios.

## Leads e drawer

- linha inteira é clicável e acessível por teclado;
- tabela mostra etapa e funil correspondente;
- filtros vindos do dashboard e relatórios preservam o recorte;
- campos personalizados usam label e valor separados;
- valores monetários recebem formatação apropriada;
- origem e etiquetas são áreas distintas;
- observações e histórico foram separados;
- aviso de responsabilidade incompatível possui ação de correção;
- ações principais foram hierarquizadas.

## Kanban

- cards exibem responsável, origem, prioridade, valor e contato;
- usuários disponíveis respeitam o funil;
- arrastar não abre o lead acidentalmente;
- drop target e feedback de movimentação são visíveis;
- configuração de etapas abre a Administração no funil correto.

## Agenda e tarefas

- clique no evento abre a tarefa exata;
- clique no dia seleciona a data;
- criação rápida usa a data selecionada;
- calendário móvel evita texto esmagado e usa agenda detalhada;
- tarefas diferenciam prioridade, atraso, responsável e lead.

## Conversas

- lista e conversa possuem fluxo separado no mobile;
- há botão de voltar apenas no atendimento móvel;
- responsável comercial e atendente atual são identificados;
- contexto do lead mostra funil e etapa;
- janela de 24 horas é apresentada como estado operacional;
- input nativo de arquivo é oculto;
- anexos têm prévia, tipo, tamanho e remoção;
- respostas são bloqueadas quando o atendente não é elegível, exigindo transferência.

## Relatórios

- filtros por período, funil, responsável e origem;
- comparação com período anterior;
- KPIs para entrada de leads, pipeline, ganhos, conversão, ticket médio e primeiro atendimento;
- evolução de leads no período;
- funil visual por pipeline, com quantidade e valor por etapa;
- desempenho por origem;
- produtividade da equipe com cargo, leads, pipeline, ganhos, tarefas atrasadas e inconsistências;
- saúde operacional com recortes acionáveis;
- cards, linhas e etapas abrem os leads que compõem o indicador;
- exportação CSV respeita o recorte.

## Integrações, Administração e Desenvolvedor

- cards de integração separam status, conta, eventos, roteamento, mapeamento e ações;
- configurações técnicas não podem ser marcadas artificialmente como conectadas no frontend;
- Administração possui busca, filtros de usuários, acessos, funis, etapas, campos, etiquetas e identificação;
- personalização da organização está limitada a nome e logo;
- área Desenvolvedor segue o mesmo sistema visual e mantém provisionamento separado do núcleo operacional.

## Contratos preservados

Não foram renomeados nem removidos os contratos usados por autenticação, leads, Kanban, tarefas, mensagens, mídias, templates, status, Storage, Supabase Realtime, Edge Functions ou Make.
