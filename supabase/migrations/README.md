# Migrations novas

As migrations desta pasta não foram aplicadas automaticamente ao projeto remoto.

Antes de aplicar em produção:

1. criar um projeto de staging ou branch de banco;
2. revisar o SQL contra o schema atual;
3. testar criação de organização e isolamento por RLS;
4. validar rollback;
5. aplicar somente depois do aceite.

A migration `202607230001_provision_crm_organization.sql` copia apenas configurações. Ela não copia leads, contatos, mensagens, tarefas, arquivos, usuários ou credenciais.
