# Notificações de novos capítulos em novels favoritas

## Objetivo

Quando um capítulo for publicado, avisar os usuários que já favoritaram a novel. O aviso deve ser interno ao aplicativo, genérico e consolidado: cada usuário recebe no máximo uma notificação por novel e por data, mesmo quando vários capítulos são publicados separadamente no mesmo dia.

## Regras de produto

- Um capítulo criado com `published: true` dispara a notificação.
- Um capítulo criado como rascunho não dispara a notificação.
- A primeira transição de rascunho para publicado dispara a notificação.
- Editar um capítulo já publicado não dispara uma nova notificação.
- Retirar um capítulo do ar e republicá-lo não dispara uma nova notificação.
- Favoritar uma novel depois da publicação não cria notificações retroativas.
- Somente os usuários que tiverem a novel como favorita no momento da publicação recebem o aviso.
- Várias publicações da mesma novel na mesma data resultam em uma única notificação por usuário.
- A data civil e sua exibição usam o fuso `America/Sao_Paulo`.

## Conteúdo e destino

A notificação terá:

- tipo: `FAVORITE_NOVEL_NEW_CHAPTERS`;
- título: `Novos capítulos adicionados`;
- mensagem: `Novos capítulos adicionados à novel {título da novel} em {DD/MM/AAAA}.`;
- destino: `/novels/{slug}`.

Exemplo: `Novos capítulos adicionados à novel Circle of Inevitability em 10/07/2026.`

## Persistência

`Chapter` receberá `publishedAt: DateTime?`. Capítulos publicados existentes serão retroativamente marcados com `createdAt`; novos rascunhos permanecerão com `null`. Na primeira publicação, `publishedAt` recebe o instante atual e nunca é apagado. Esse campo distingue a primeira publicação de uma republicação.

`Notification` receberá:

- `novelId: String?` e relação opcional com `Novel`, com exclusão em cascata;
- `eventKey: String?`, contendo `{novelId}:{AAAA-MM-DD}` para esse tipo de evento;
- restrição única composta em `(userId, type, eventKey)`.

O campo opcional preserva as notificações de comentários existentes. No PostgreSQL, as linhas antigas com `eventKey = null` não entram em conflito entre si. Um script SQL específico para o Aiven adicionará as colunas, o relacionamento, o backfill e a restrição.

## Componentes

Um módulo focado em notificações de capítulos favoritos será responsável por:

1. converter um instante na data civil de São Paulo;
2. montar `eventKey`, título, mensagem e `href`;
3. obter os IDs dos usuários que favoritaram a novel;
4. inserir os avisos com `createMany({ skipDuplicates: true })`.

As rotas administrativas de criação e edição de capítulos chamarão esse módulo dentro da mesma transação Prisma usada para persistir o capítulo.

## Fluxo de criação

1. A rota valida e normaliza o capítulo como já faz hoje.
2. A transação cria o capítulo, definindo `publishedAt` somente quando ele nasce publicado.
3. Se publicado, a transação resolve a novel pelo volume e busca seus favoritos.
4. O módulo cria uma notificação por usuário. A restrição única elimina repetições para a mesma novel e data.
5. Após o sucesso, a rota invalida `CACHE_TAGS.content` e, quando houver evento notificável, `CACHE_TAGS.notifications`.

## Fluxo de edição

1. Quando a entrada pede `published: true`, a transação tenta reservar a primeira publicação com um `updateMany` condicionado por `id` e `publishedAt: null`.
2. O `count` retornado define o vencedor: somente a transação que alterar uma linha grava `publishedAt` e gera notificações.
3. A atualização normal do capítulo preserva `publishedAt` em todas as edições futuras.
4. A novel usada no aviso é a novel do volume persistido na atualização.

## Concorrência e falhas

A mutação do capítulo e as notificações são atômicas: uma falha ao gerar os avisos desfaz também a criação ou publicação, evitando capítulo publicado sem a comunicação correspondente. Em edições concorrentes, a reserva condicional de `publishedAt` permite que somente uma transação reconheça a primeira publicação. A restrição única e `skipDuplicates` também garantem uma linha por usuário, novel e data quando capítulos distintos são publicados ao mesmo tempo. Não haver usuários favoritos é um resultado válido e não impede a publicação.

## Testes

O desenvolvimento seguirá TDD e cobrirá:

- formatação de chave e mensagem no fuso `America/Sao_Paulo`, incluindo a virada da data em UTC;
- capítulo criado publicado como evento notificável;
- rascunho criado sem evento;
- primeira publicação de rascunho como evento notificável;
- edição ou republicação sem novo evento;
- chave idêntica para várias publicações da mesma novel/data;
- chave diferente para novels ou datas diferentes;
- esquema Prisma e SQL com relacionamento, backfill e unicidade;
- rotas de criação e edição usando a transação e invalidando o cache de notificações;
- consulta restrita aos favoritos da novel publicada.

Ao final serão executados os testes direcionados, a suíte completa, o lint e o build.

## Fora de escopo

- push notifications do navegador ou do sistema operacional;
- envio por e-mail;
- preferências individuais para desativar esse tipo de aviso;
- notificações retroativas;
- exibição do número, intervalo ou título do capítulo na mensagem.
