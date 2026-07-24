# Padrão de UI e UX

## Princípio

A interface deve parecer um único produto, independentemente da organização conectada. White-label significa identificação da empresa e isolamento operacional, não liberdade para alterar a legibilidade do sistema.

## Personalização permitida

- nome da empresa;
- nome do CRM;
- logo.

## Elementos protegidos

- paleta principal;
- cores semânticas;
- tipografia;
- contraste;
- raios de borda;
- sombras;
- espaçamentos;
- hierarquia de títulos;
- estrutura de botões, campos, tabelas, modais e navegação.

## Paleta funcional

- azul: ação principal e informação;
- verde: sucesso, ganho e conexão saudável;
- amarelo/laranja: atenção e pendência;
- vermelho: falha, atraso e ação destrutiva;
- violeta: automação e plataforma;
- cinza: estados neutros, inativos e informações secundárias.

Cores não devem ser usadas apenas para decoração. Todo estado importante deve possuir também texto, ícone ou rótulo.

## Navegação

No desktop, a sidebar permanece estável e não possui botão de fechar ou recolher junto à logo. No mobile, a navegação vira um drawer com título e botão de fechar próprio.

## Contraste

Textos primários usam tons escuros sobre superfícies claras. Textos secundários não podem depender de cinzas excessivamente claros. Botões devem preservar contraste em estado normal, hover, foco, desabilitado e carregando.

## Responsividade

- desktop: sidebar fixa e conteúdo fluido;
- tablet: redução controlada de colunas e ações;
- mobile: navegação em drawer e atalhos inferiores;
- tabelas: rolagem horizontal ou conversão para cards quando necessário;
- formulários: uma coluna em telas estreitas;
- modais e drawers: largura limitada e altura rolável.

## Regra de evolução

Novas páginas devem reutilizar componentes e tokens existentes. Não criar cores, sombras, espaçamentos ou padrões de interação isolados dentro de uma página.
