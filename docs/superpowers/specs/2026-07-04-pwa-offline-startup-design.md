# Abertura do PWA com conteúdo offline

## Objetivo

Ao abrir o PWA sem internet, uma conta autenticada que já preparou capítulos para uso offline deve chegar automaticamente à página `/offline` armazenada para essa conta. Usuários sem uma página offline válida continuam vendo o fallback genérico.

## Causa raiz

O manifesto inicia o aplicativo em `/`. O service worker v7 usa a rede para qualquer navegação diferente de `/offline` e, quando a rede falha, devolve `offline-fallback.html`. Embora `/offline` esteja armazenada por conta, o fluxo de abertura pela raiz nunca consulta esse cache.

## Solução

O service worker continuará tentando a rede primeiro em rotas comuns. Se essa tentativa falhar:

1. identifica a conta ativa no cache de metadados;
2. procura a página `/offline` no cache isolado dessa conta;
3. se a página existir, redireciona a navegação para `/offline`;
4. se não existir, devolve `offline-fallback.html`.

A navegação para `/offline` continua sendo atendida pelo fluxo atual, que valida o escopo da conta e usa somente o cache correspondente. O `start_url` permanece `/`, preservando a página inicial normal quando houver internet.

## Segurança e isolamento

- Uma conta anônima nunca recebe uma página privada em cache.
- O service worker consulta apenas o cache associado ao escopo ativo.
- A correção não mistura páginas ou áudios entre contas.
- A página genérica permanece como fallback quando o cache offline estiver ausente.

## Testes

Um teste de regressão do runtime do service worker deve demonstrar:

- abertura de `/` sem rede redireciona para `/offline` quando a conta ativa possui um shell salvo;
- abertura sem rede mantém o fallback genérico quando não existe shell para a conta;
- navegação online continua retornando a resposta da rede;
- os testes existentes de isolamento por conta continuam passando.

## Critério de aceite

Depois que uma conta Premium salvar ao menos um capítulo e a preparação offline terminar, fechar a conexão e abrir o PWA pelo ícone deve mostrar automaticamente a página com os áudios salvos, sem parar na tela genérica.
