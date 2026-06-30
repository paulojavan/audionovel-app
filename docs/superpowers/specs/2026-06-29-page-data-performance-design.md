# Otimização de carregamento de dados das páginas

## Objetivo

Reduzir o tempo de carregamento das páginas públicas, privadas e administrativas eliminando colunas e relações que não são usadas na renderização, sem alterar a interface ou o comportamento funcional do aplicativo.

## Evidências

O banco atual contém 3 novels e 1.530 capítulos. As transcrições somam aproximadamente 14,9 milhões de caracteres; a maior novel possui 878 capítulos e cerca de 8,9 milhões de caracteres somente em `transcriptJson`.

As medições compararam as consultas atuais com consultas equivalentes que retornam apenas os campos renderizados:

- página pública da maior novel: de aproximadamente 10,1 MB para 350 KB;
- painel administrativo de conteúdo: de aproximadamente 16,9 MB para 90 KB.

A causa principal é o uso de `include` amplo em relações que contêm `transcriptJson`, URLs de áudio, dados de sincronização e outros campos grandes. A latência do PostgreSQL remoto amplia o custo dessas transferências.

## Decisões aprovadas

- Dados públicos de catálogo e conteúdo podem permanecer em cache por até 60 segundos.
- Alterações administrativas de conteúdo invalidam imediatamente as entradas de cache correspondentes.
- Dados privados ou específicos do usuário não usam cache compartilhado.
- A aparência, os textos, os links e os recursos das páginas permanecem inalterados.
- Esta etapa não migra o projeto para Cache Components do Next.js 16.
- Esta etapa não cria carregamento de capítulos sob demanda por volume.
- Não serão adicionados índices ou migrações de banco sem evidência de que a seleção enxuta e o cache são insuficientes.

## Arquitetura

### Seleções Prisma

Consultas de página passam a usar objetos `select` tipados com `Prisma.*Select` quando retornam modelos ou relações com campos grandes. Seleções reutilizadas ou críticas ficam em módulos puros para permitir testes de regressão.

As páginas públicas recebem somente os campos necessários para cards, filtros, volumes, capítulos, comentários e navegação. Em especial, listagens de capítulos não carregam `transcriptJson`, `audioUrl`, `youtubeUrl`, `coverUrl` ou outros campos que não são utilizados naquele contexto.

Páginas privadas e administrativas continuam consultando dados frescos, mas selecionam apenas os campos renderizados. A edição de um capítulo pode carregar os campos completos do capítulo porque o formulário efetivamente os utiliza; relações de volume e novel permanecem restritas aos campos necessários.

### Cache público

O padrão atual de `unstable_cache` será mantido, pois `cacheComponents` não está habilitado no projeto. As funções públicas recebem filtros e paginação como argumentos, que também fazem parte da chave de cache.

O catálogo de novels terá uma função armazenada por 60 segundos contendo:

- total de resultados;
- página solicitada;
- campos essenciais dos cards;
- até três tags exibidas por card.

Os dados públicos de uma novel serão separados em:

- conteúdo editorial e lista de volumes/capítulos, em cache por 60 segundos e vinculados à tag de conteúdo;
- comentários, progresso, avaliação e favorito, consultados sem cache compartilhado.

Tags do catálogo continuam usando o cache existente. Mutações administrativas que alterem novels, volumes, capítulos ou tags invalidam as tags de cache necessárias.

### Páginas privadas

Biblioteca, perfil, offline, notificações e assinaturas não terão cache compartilhado. Suas consultas serão convertidas para seleções mínimas:

- biblioteca: dados de exibição dos favoritos e dos últimos 20 progressos;
- perfil: nome, email, estado Premium e campos exibidos dos dez pagamentos;
- offline: metadados do download, capítulo, volume e novel usados pelo painel;
- notificações: campos exibidos e estado de leitura;
- assinaturas: campos necessários para status do usuário e cards dos planos.

### Páginas administrativas

Dashboard, financeiro, moderação, reportes, conteúdo, detalhes de usuário e formulários administrativos usarão seleções explícitas. Os maiores cortes ficam em:

- listagem de conteúdo, que precisa apenas de posições e estado Premium dos capítulos para calcular totais;
- painel de uma novel, que precisa somente dos campos exibidos no acordeão;
- detalhes de usuário, que precisa somente dos campos usados para métricas, histórico e links;
- dashboard e financeiro, que precisam apenas do email relacionado ao pagamento.

Listagens que já possuem limites mantêm seus limites atuais. Paginação e mudanças de comportamento ficam fora desta etapa.

## Fluxo de dados

1. A página recebe parâmetros e sessão fora do escopo de cache.
2. Dados públicos estáveis são buscados por uma função cacheada com argumentos serializáveis.
3. Dados específicos do usuário e comentários são buscados separadamente e em paralelo quando possível.
4. A página combina os resultados sem enviar campos adicionais aos Client Components.
5. Rotas administrativas invalidam as tags após uma mutação bem-sucedida.

## Falhas e segurança

- Falhas de banco preservam o tratamento atual da página; não serão ocultadas por valores vazios.
- Nenhum objeto `User` completo deve ser carregado em páginas que não precisam do hash de senha ou de dados administrativos.
- Cache público nunca recebe ID de usuário, sessão, cookies ou dados privados.
- A invalidação ocorre somente depois de a mutação administrativa ser concluída.
- As páginas continuam usando `notFound` e `redirect` nos mesmos casos atuais.

## Testes e verificação

O desenvolvimento seguirá TDD para seleções e funções cacheáveis:

- testes falham primeiro ao detectar campos grandes ou privados em seleções de listagem;
- testes confirmam os campos mínimos necessários para catálogo, novel, biblioteca e administração;
- testes confirmam que filtros e paginação produzem argumentos estáveis para o cache;
- testes existentes de home, capítulos, assinaturas e continuação permanecem verdes.

A verificação final inclui:

- suíte completa de testes;
- ESLint;
- build de produção;
- comparação somente de leitura no banco entre o volume das consultas antigas medido nesta análise e as consultas otimizadas;
- inspeção das páginas principais para confirmar ausência de regressões visuais ou funcionais.

## Critérios de sucesso

- A consulta pública da maior novel não carrega transcrições dos 878 capítulos.
- A listagem administrativa de conteúdo não carrega transcrições ou URLs de mídia.
- Nenhuma página carrega um modelo `User` completo quando utiliza apenas dados de perfil ou pagamento.
- Catálogo e conteúdo público reutilizam resultados por até 60 segundos.
- Alterações administrativas continuam aparecendo imediatamente após invalidação.
- Testes, lint e build terminam com sucesso.
