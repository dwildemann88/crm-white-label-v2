# Critérios de aceite de UI/UX — V5

## Princípios obrigatórios

1. Toda ação precisa deixar claro o resultado antes do clique.
2. Indicadores acionáveis devem abrir o conjunto de registros que gerou o número.
3. A mesma função deve possuir o mesmo componente, texto e comportamento em todas as páginas.
4. Nenhum texto operacional deve depender de tamanho excessivamente pequeno ou baixo contraste.
5. Nome, logo e organização podem variar; o sistema visual não varia.
6. Responsáveis só podem ser selecionados quando possuem acesso ao funil relacionado.
7. Estados vazio, carregando, desabilitado, erro e sucesso precisam ser explícitos.

## Matriz de navegação

| Origem | Ação | Destino esperado |
|---|---|---|
| Dashboard · oportunidades abertas | clique no KPI | Leads filtrados por etapas abertas |
| Dashboard · pipeline | clique no KPI | Leads abertos usados no valor do pipeline |
| Dashboard · etapa | clique na linha | Leads filtrados pelo funil e etapa |
| Dashboard · origem | clique na origem | Leads filtrados pelo canal |
| Dashboard · tarefa | clique na tarefa | edição da tarefa selecionada |
| Relatórios · pipeline aberto | clique no KPI | Leads abertos dentro do período e filtros |
| Relatórios · ganhos | clique no KPI | Leads em etapas ganhas |
| Relatórios · origem | clique na linha | Leads da origem e do recorte atual |
| Relatórios · usuário | clique no card | Leads atribuídos ao usuário |
| Kanban · configurar etapas | clique | Administração aberta no funil atual |
| Conversas · contato | clique | drawer do lead vinculado |
| Conversas mobile · conversa | clique | atendimento em tela própria com botão voltar |

## Critérios por módulo

### Shell

- não existe botão de fechar ou recolher ao lado da logo no desktop;
- o X existe somente no drawer móvel aberto;
- menus de perfil, notificações e organizações não ficam abertos simultaneamente;
- Escape fecha superfícies transitórias;
- busca global abre Leads com a consulta aplicada.

### Leads

- linha inteira é clicável e acessível por teclado;
- etapa sempre mostra o funil correspondente;
- responsável incompatível é sinalizado;
- filtros ativos são visíveis e removíveis;
- filtros vindos de dashboard e relatórios preservam o recorte.

### Drawer do lead

- cabeçalho identifica lead, empresa, temperatura e funil;
- ação principal é abrir/iniciar conversa;
- responsável comercial, funil e etapa ficam no mesmo bloco;
- campos personalizados exibem label e valor separados;
- origem não é tratada como etiqueta;
- observações e histórico são áreas distintas;
- inconsistência de responsável possui ação de correção.

### Kanban

- o funil selecionado controla etapas e responsáveis disponíveis;
- card possui responsável, prioridade, valor, contato e origem;
- arrastar não abre o drawer acidentalmente;
- clique abre o lead;
- drop target é visível.

### Agenda

- clique em evento abre a tarefa correta;
- clique no dia seleciona a data;
- botão + do dia cria tarefa naquela data;
- mobile usa contagem por dia e detalhes na agenda, sem texto esmagado nas células.

### Conversas

- responsável comercial e responsável pelo atendimento são campos distintos;
- responsável de atendimento incompatível bloqueia resposta e solicita transferência;
- janela de 24 horas aparece como estado operacional;
- arquivo nativo não aparece na interface;
- anexo possui prévia, nome, tipo, tamanho e remoção;
- mobile alterna lista e conversa.

### Relatórios

- nenhuma métrica aparece como texto concatenado;
- filtros de data alteram KPIs, gráficos, tabelas e drilldowns;
- KPIs possuem comparação com o período anterior quando possível;
- funil mostra quantidade e valor por etapa;
- equipe mostra ativos, pipeline, ganhos, conversão e pendências;
- saúde operacional permite agir sobre cada problema.

### Administração

- usuários podem ser buscados e filtrados por status;
- papel, acesso a funis e permissões aparecem separadamente;
- edição de funil abre o funil solicitado;
- identificação permite nome e logo, sem alterar o design do sistema.

## Regressão mínima antes da publicação

- desktop: 1366×768 e 1920×1080;
- tablet: 768×1024;
- mobile: 390×844;
- zoom do navegador: 100% e 125%;
- teclado: Tab, Enter, Espaço e Escape;
- dados com nomes e empresas longos;
- funil com muitas etapas;
- conversa com texto longo e mídias;
- relatório sem dados e com alto volume.
