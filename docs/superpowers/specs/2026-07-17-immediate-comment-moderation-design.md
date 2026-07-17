# Comentários publicados antes da moderação

## Objetivo

Publicar comentários e respostas imediatamente, mantendo-os em uma fila de revisão no painel administrativo. Respostas publicadas devem notificar o autor do comentário principal sem aguardar a análise do administrador.

## Semântica dos estados

- `PENDING`: comentário público que ainda aguarda revisão administrativa.
- `APPROVED`: comentário público que já foi revisado e aprovado.
- `REMOVED`: comentário moderado cujo conteúdo foi ocultado e substituído pelo aviso existente.

O valor padrão do banco continua sendo `PENDING`. Portanto, a mudança não exige migração de dados e comentários que já aguardam moderação passam a aparecer publicamente após a implantação.

## Publicação e consulta

As páginas de novel e capítulo passam a consultar comentários principais com status `PENDING`, `APPROVED` ou `REMOVED`. A seleção das respostas usa a mesma lista. A ordenação, o limite de resultados, a proteção contra spoilers e as permissões de edição permanecem inalterados.

Um módulo de domínio centraliza a lista de estados públicos para impedir que as consultas de novel, capítulo e respostas voltem a divergir.

Após criar um comentário ou uma resposta, a interface limpa o formulário, confirma que o conteúdo foi publicado e atualiza a página. Após editar, a nova versão permanece pública, retorna para `PENDING` e aparece novamente no topo da fila administrativa por causa do `updatedAt`.

## Notificação imediata de respostas

Quando uma resposta é criada para o comentário principal de outro usuário, a mesma transação que cria a resposta também cria a notificação `COMMENT_REPLY`. O destino continua apontando para a âncora da resposta na novel ou no capítulo.

Não é criada notificação quando o usuário responde ao próprio comentário. Editar uma resposta não gera outra notificação. A aprovação administrativa deixa de criar notificações, evitando duplicidade.

A criação do comentário e da notificação é atômica: se a notificação obrigatória falhar, a resposta também não é persistida. Comentários principais, respostas ao próprio usuário e respostas sem necessidade de aviso continuam sendo gravados normalmente na transação.

## Painel administrativo

A aba principal continua consultando `PENDING` e passa a descrevê-los como comentários publicados que aguardam revisão. A ação `APPROVE` marca o item como revisado e preenche os campos de auditoria existentes. A ação `REMOVE` oculta o conteúdo público e preserva a linha na aba de removidos.

Nenhuma ação de restauração, exclusão automática ou pré-moderação será adicionada.

## Erros e segurança

- Autenticação, bloqueio de usuário, rate limit e validação de corpo permanecem obrigatórios antes da publicação.
- Respostas continuam limitadas a um nível e precisam pertencer ao mesmo conteúdo do comentário principal.
- Falha na transação retorna erro sem publicar parcialmente a resposta.
- A moderação posterior não pode emitir uma segunda notificação.

## Testes

O desenvolvimento seguirá TDD e demonstrará:

- `PENDING`, `APPROVED` e `REMOVED` pertencem ao conjunto de estados públicos;
- as páginas de novel e capítulo e a seleção de respostas usam o conjunto público;
- comentário novo é criado como `PENDING` e fica publicamente consultável;
- edição preserva a visibilidade, redefine a revisão para `PENDING` e não gera notificação;
- resposta a outro usuário cria exatamente uma notificação dentro da transação;
- resposta ao próprio comentário não cria notificação;
- aprovação administrativa não cria notificação;
- remoção continua ocultando o corpo;
- mensagens dos formulários confirmam publicação e não dizem que o conteúdo está aguardando para ser publicado.

Ao final serão executados os testes direcionados, a suíte completa, o lint e o build de produção.

## Critérios de aceite

- Um comentário válido aparece após a resposta `201`, sem ação administrativa.
- Uma edição válida aparece imediatamente e volta para a fila `PENDING`.
- A fila administrativa mostra todos os comentários novos e editados ainda não revisados.
- Uma resposta a outro usuário gera uma única notificação imediatamente.
- Aprovar não altera a visibilidade pública nem duplica a notificação.
- Remover substitui o conteúdo pelo aviso de moderação existente.

## Fora de escopo

- Moderação automática ou análise de conteúdo por IA.
- Novos níveis de resposta, reações ou paginação de comentários.
- Restauração de comentários removidos.
- Notificações por push ou e-mail.
