# Lançamentos, dias de Premium e continuação de novels

## Objetivo

Melhorar a experiência do usuário autenticado em três pontos:

1. mostrar os oito capítulos publicados mais recentes na tela inicial;
2. substituir “Sessão ativa” pelos dias restantes da assinatura Premium;
3. permitir que uma novel indique uma única continuação e promovê-la após os volumes.

## Decisões aprovadas

- A seção “Lançamentos” aparece somente na home autenticada.
- A seleção contém os oito capítulos publicados mais recentes, ordenados por `createdAt` decrescente.
- Capítulos Premium aparecem para todos os usuários autenticados e recebem identificação visual.
- Quando mais de um dos oito capítulos pertence à mesma novel, a interface mostra capa e título uma vez e lista os capítulos dessa obra no mesmo grupo.
- O agrupamento não altera a seleção nem a ordem global: continuam sendo exatamente os oito capítulos mais recentes.
- Todos os usuários autenticados veem a contagem de dias Premium no cabeçalho. Usuários gratuitos veem `0 dias de Premium`.
- Cada novel pode apontar para no máximo uma continuação. O modelo aceita cadeias como Livro 1 → Livro 2 → Livro 3.
- A chamada da continuação fica abaixo dos volumes e antes dos comentários.
- A direção visual escolhida é a opção A editorial, refinada com o agrupamento da imagem de referência.

## Arquitetura

### Lançamentos

`getCachedHomeData` passa a buscar, junto aos dados atuais da home, oito registros de `Chapter` com `published: true`, incluindo o `Volume` e sua `Novel`. A consulta usa `createdAt` decrescente e continua vinculada à tag de cache de conteúdo, que já é invalidada pelas rotas administrativas.

Um helper puro recebe a lista ordenada e cria grupos de novels na ordem em que cada obra aparece pela primeira vez. Cada grupo mantém seus capítulos na ordem original. A renderização usa:

- capa e título com link para a novel;
- volume, posição e título de cada capítulo;
- link direto para o capítulo;
- tempo relativo desde o cadastro;
- selo de Premium quando `premiumOnly` for verdadeiro.

Se não houver capítulos publicados, a seção exibe “Nenhum capítulo publicado ainda”.

### Dias restantes do Premium

Um helper em `src/lib/subscription.ts` recebe `premiumUntil` e um instante de referência. Ele retorna zero para valores ausentes, inválidos ou expirados e usa arredondamento para cima para datas futuras. Assim, uma assinatura com menos de 24 horas restantes ainda mostra um dia.

O cabeçalho sempre renderiza a contagem para usuários autenticados. Quando não houver acesso Premium ativo, exibe zero. O texto respeita singular e plural:

- `0 dias de Premium`;
- `1 dia de Premium`;
- `N dias de Premium`.

### Relação de continuação

`Novel` recebe uma autorrelação opcional de um para um:

- `continuationId String? @unique`;
- `continuation Novel?`, a próxima novel;
- `previousNovel Novel?`, o lado inverso.

A unicidade garante uma única continuação por novel e um único predecessor direto para cada continuação, sem impedir cadeias.

Os formulários administrativos de criação e edição recebem a lista de novels disponíveis e mostram um seletor opcional “Continuação”. Na edição, a própria novel não aparece como opção. As APIs de criação e atualização aceitam `continuationId`, confirmam que o ID existe e recusam autorreferência ou qualquer vínculo que feche um ciclo.

Na página pública, a consulta inclui os campos essenciais da continuação. Quando ela existe, a interface exibe um card editorial abaixo de `NovelVolumeList` e antes dos comentários, com capa, título e a chamada:

> A jornada continua. Terminou de ouvir? O próximo mundo já está chamando.

O botão “Conhecer continuação” leva à página da novel vinculada. Sem vínculo válido, nenhum card é renderizado.

## Banco Aiven

A alteração exige uma coluna anulável, índice único e chave estrangeira em PostgreSQL:

```sql
ALTER TABLE "Novel"
ADD COLUMN "continuationId" TEXT;

CREATE UNIQUE INDEX "Novel_continuationId_key"
ON "Novel"("continuationId");

ALTER TABLE "Novel"
ADD CONSTRAINT "Novel_continuationId_fkey"
FOREIGN KEY ("continuationId")
REFERENCES "Novel"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
```

O mesmo SQL será salvo em um documento operacional dedicado dentro de `docs/`, para aplicação manual no Aiven.

## Validação e falhas

- `continuationId: null` remove o vínculo.
- IDs inexistentes retornam erro de validação, sem alteração parcial.
- Autorreferência e ciclos retornam erro de validação.
- A remoção de uma novel referenciada limpa o vínculo por `ON DELETE SET NULL`.
- A ausência de continuação não afeta a página pública.
- A ausência de lançamentos produz um estado vazio, não uma falha da home.

## Testes

Os testes unitários devem cobrir:

- cálculo de dias ausentes, expirados, parciais e inteiros;
- singular e plural do texto Premium;
- agrupamento de oito capítulos por novel sem duplicar capa ou perder a ordem;
- preservação do selo Premium nos dados agrupados;
- validação de continuação inexistente, autorreferente e cíclica;
- aceitação de remoção de vínculo e de uma cadeia válida.

Depois da implementação, a verificação completa inclui testes, lint, geração do Prisma Client e build de produção.
