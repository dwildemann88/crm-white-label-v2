# Publicação segura

## Antes de publicar

1. preserve as variáveis já configuradas no provedor de hospedagem;
2. não substitua ou renomeie Edge Functions implantadas;
3. não execute `db reset`, `db push` ou migrations não revisadas;
4. publique primeiro o frontend em uma URL de prévia;
5. valide os fluxos abaixo com uma organização de teste.

## Testes obrigatórios

- login e logout;
- carregamento da organização e da identidade visual;
- criação e edição de lead;
- movimentação no Kanban;
- criação, edição e conclusão de tarefa;
- abertura de conversa;
- envio de texto;
- envio de imagem, áudio, vídeo e documento;
- recebimento de mensagem;
- atualização de `sent`, `delivered`, `read` e `failed`;
- template para conversa fora da janela de 24 horas;
- visualização no celular;
- isolamento de dados entre organizações.

## Estratégia de rollback

A alteração é predominantemente de frontend. Mantenha o deploy anterior disponível no provedor de hospedagem e reverta para ele caso um teste operacional falhe.

As fontes em `supabase/functions` são referências exportadas. Elas não são implantadas automaticamente durante o build do Vite.


## Recursos administrativos opcionais

Não aplique os recursos abaixo diretamente em produção sem staging:

- `supabase/functions/admin-manage-crm-user`;
- `supabase/migrations/202607230001_provision_crm_organization.sql`.

A publicação somente do frontend não altera o banco, as Edge Functions existentes nem os cenários do Make. O cadastro de usuários e a criação transacional de novas empresas exigem implantação separada dos recursos acima.

## Publicação da V5.2.0 — WhatsApp direto

Esta versão altera banco e Edge Functions. Não basta publicar o frontend.

Ordem obrigatória:

1. aplicar `202608050004_whatsapp_cloud_direct.sql`;
2. cadastrar secrets da Meta e da criptografia;
3. publicar `manage-whatsapp-cloud-integration`;
4. publicar as duas funções de despacho;
5. publicar `whatsapp-cloud-webhook --no-verify-jwt`;
6. configurar callback e campo `messages` na Meta;
7. conectar um número de homologação no CRM;
8. concluir o checklist de `docs/WHATSAPP-CLOUD-DIRETO.md`;
9. somente então desativar o transporte do WhatsApp no Make.
