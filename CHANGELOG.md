# Changelog

## 5.1.0 — Ciclo completo do lead e receita comercial

### Leads e Kanban

- lead pode ser movido por arraste ou pela seleção de etapa no painel lateral;
- etapas de perdido abrem justificativa obrigatória antes da movimentação;
- etapas de ganho solicitam e registram o valor final da venda;
- justificativa da perda fica visível no painel do lead;
- exclusão definitiva disponível para administradores e gerentes, com confirmação pelo nome do lead;
- exclusão remove tarefas, histórico e conversas vinculadas, mas preserva o contato cadastrado.

### Equipe e notificações

- transferência de responsável cria notificação em tempo real para o novo responsável;
- a notificação identifica o lead e, quando disponível, quem realizou a transferência;
- transferências para o próprio usuário não geram notificação redundante.

### Relatórios

- adicionado KPI de valor em vendas;
- desempenho por origem e por responsável passa a exibir valor vendido;
- exportação CSV inclui resultado comercial e valor da venda.

### Banco de dados

- adicionada a migration `202608050003_lead_outcomes_delete_notifications.sql`;
- nova RPC `move_crm_lead_with_outcome`;
- nova RPC `delete_crm_lead`;
- novo gatilho de notificação de atribuição de lead;
- criada e distribuída a permissão `leads.delete`.

## 5.0.0 — Reconstrução profissional de produto e usabilidade


### Coerência visual

- consolidado um único stylesheet em `src/ui-system.css`;
- removida a seção antiga de relatórios que ainda conflitava com o layout novo;
- ampliadas escala tipográfica, áreas clicáveis, espaçamentos e contraste;
- padronizados painéis, cabeçalhos, botões, campos, tabelas, drawers e modais;
- mantido um sistema visual fixo para todas as organizações;
- corrigida a responsividade de navegação, filtros, tabelas, calendário, chat e administração.

### Coerência operacional

- responsáveis de leads passam a ser filtrados conforme o acesso ao funil;
- responsável comercial e responsável pelo atendimento aparecem como conceitos distintos;
- inconsistências de responsável são destacadas em leads, drawer, chat e relatórios;
- o drawer oferece acesso direto à correção do responsável;
- configurações de integração só permitem responsáveis compatíveis com o funil;
- relatórios indicam acessos incompatíveis por membro da equipe.

### Navegação e ações

- KPIs do dashboard abrem filtros exatos, não páginas genéricas;
- etapas do dashboard abrem a lista correspondente ao funil e à etapa;
- origens abrem a base filtrada pelo canal;
- tarefas do dashboard abrem a tarefa correta;
- configuração de etapas abre diretamente o funil selecionado na Administração;
- indicadores dos relatórios abrem oportunidades abertas, negócios ganhos e pendências específicas;
- dropdowns do shell fecham de forma mutuamente exclusiva e respondem à tecla Escape.

### Leads, tarefas e WhatsApp

- base de leads com filtros de temperatura, período e saúde operacional;
- linhas de leads acessíveis por mouse e teclado;
- drawer reestruturado com valores formatados, contexto comercial e linha do tempo;
- calendário mobile prioriza seleção do dia e agenda, evitando texto ilegível nas células;
- chat mobile alterna entre lista e conversa;
- input nativo de arquivos permanece oculto e substituído por composer próprio;
- contratos atuais de texto, mídia, templates e status do WhatsApp preservados.

### Relatórios

- seis KPIs com comparação ao período anterior;
- gráfico de entrada de leads;
- distribuição por etapa e funil;
- desempenho por origem;
- produtividade da equipe sem concatenação de textos;
- saúde operacional clicável;
- filtros de período, funil, responsável e origem;
- exportação do recorte atual.

### Administração

- busca de usuários por nome, e-mail ou função;
- filtro por status ativo/inativo;
- papéis e acessos apresentados com contexto real;
- funis, etapas, campos e etiquetas organizados em áreas próprias;
- identificação da organização restrita a nome e logo.

### Garantias

- nenhum nome de RPC, Edge Function ou payload do Make foi alterado;
- adicionada verificação automática `npm run verify:ui`;
- preservada a verificação `npm run verify:contracts`.

## 4.0.0 — Reconstrução inicial de UI e UX

- criada a primeira base visual clara e padronizada;
- removida a alteração de paleta por empresa;
- login, sidebar, administração e desenvolvedor redesenhados;
- contratos críticos preservados.

## 3.0.1 — Tratamento de configuração ausente

- substituída a página branca por uma tela explicativa quando faltam variáveis do Supabase.
