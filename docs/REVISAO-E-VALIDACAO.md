# Revisão e validação da V5

## Correções de produto

- substituição do stylesheet incremental por `ui-system.css` como referência única;
- remoção do bloco antigo de relatórios que ainda gerava conflito de seletores;
- escala tipográfica e áreas clicáveis ampliadas;
- contraste e hierarquia revisados em todas as páginas;
- navegação contextual entre dashboard, leads, Kanban, agenda e relatórios;
- validação de responsável conforme acesso ao funil;
- separação entre responsável comercial e responsável pelo atendimento;
- chat mobile com fluxo lista → conversa → voltar;
- relatórios reestruturados para leitura gerencial e ação.

## Validações automáticas

```bash
npm run verify:contracts
npm run verify:ui
npm run typecheck
npm run build
```

O verificador de UI confirma a presença do tema único, dos filtros especiais, da coerência de responsáveis, dos relatórios acionáveis e do composer próprio do WhatsApp.

## Limite da validação no ambiente de geração

A verificação estática de TypeScript foi concluída com um ambiente de tipos controlado. A instalação npm completa depende do registro externo e deve ser repetida no computador de implantação antes do build final.
