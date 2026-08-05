# Ajustes do ciclo de leads — versão 5.1.0

## O que foi implementado

- exclusão definitiva de lead com permissão e confirmação;
- movimentação pelo Kanban e pela seleção de etapa no painel do lead;
- justificativa obrigatória para perda;
- valor final obrigatório para venda;
- notificação ao novo responsável quando um lead é transferido;
- valor vendido nos KPIs, por origem, por responsável e na exportação CSV.

## Ordem de publicação

1. Faça backup do banco antes de alterar produção.
2. Aplique a migration:

   `supabase/migrations/202608050003_lead_outcomes_delete_notifications.sql`

3. Publique o frontend da versão 5.1.0.
4. Saia e entre novamente no CRM para recarregar as permissões.
5. Teste com uma oportunidade de homologação.

## Testes obrigatórios

1. Arraste um lead para uma etapa aberta.
2. Abra o lead, altere a etapa pelo seletor e confirme a movimentação.
3. Mova para perdido e valide que a justificativa é obrigatória.
4. Mova para ganho e informe um valor final maior que zero.
5. Transfira o responsável e valide a notificação no usuário destinatário.
6. Confira o valor vendido no relatório e no CSV.
7. Exclua apenas um lead de teste e confirme que contato, permissões e demais organizações não foram afetados.

## Permissão de exclusão

A migration concede `leads.delete` aos papéis com código `super_admin`, `admin` e `manager`. Vendedores e SDRs não recebem essa permissão automaticamente.

## Observação sobre exclusão

Excluir é uma operação destrutiva: tarefas, histórico e conversas vinculadas à oportunidade são removidos. O contato permanece no banco. Para manter todo o histórico operacional, use a etapa de perdido.
