# Design: PWA com estilo resiliente e biblioteca offline preparada

## Objetivo

Garantir que:

1. a interface do PWA continue estilizada quando a conexão estiver instável;
2. a rota `/offline` abra sem internet com o player funcional;
3. após salvar o primeiro áudio, `/offline` funcione mesmo que o usuário nunca tenha visitado essa rota;
4. páginas e metadados privados permaneçam isolados por conta.

## Diagnóstico

O service worker atual ignora todas as URLs `/_next/`. O Next.js 16 entrega o CSS global do Tailwind e o JavaScript do cliente em arquivos versionados sob `/_next/static/`. Assim, o HTML pode chegar ou ser restaurado do cache enquanto os arquivos necessários para o estilo e para o player falham, produzindo uma página sem Tailwind ou sem interação.

A rota `/offline` usa um cache de HTML por conta, mas só é armazenada quando o usuário a visita online. Se a conexão cair antes dessa primeira visita, o service worker não encontra a página da conta e devolve `offline-fallback.html`, que não acessa os áudios salvos no IndexedDB.

## Abordagem escolhida

Manter a rota `/offline` e o player existentes, acrescentando uma preparação explícita do shell offline ao final de cada download bem-sucedido.

Os chunks versionados de `/_next/static/` usarão cache-first. Como seus nomes incluem hash de conteúdo, uma nova implantação gera URLs diferentes e não reutiliza código ou CSS antigo. O cache geral continuará versionado para permitir limpeza controlada.

As alternativas descartadas foram:

- duplicar o player em uma página pública de HTML e JavaScript puro, por aumentar manutenção e risco de divergência;
- transformar toda a rota `/offline` em uma página estática client-side, por ampliar o trabalho para autenticação e autorização Premium.

## Componentes e responsabilidades

### `OfflineChapterButton`

Depois que o áudio criptografado e os metadados forem gravados no IndexedDB, solicita ao service worker a preparação da experiência offline. O botão só exibe sucesso completo quando áudio, metadados e shell estiverem prontos.

Se a preparação do shell falhar, o áudio salvo não será apagado. A interface informará que o áudio foi salvo, mas que é necessário permanecer online e tentar novamente para preparar a página.

### Mensagem do service worker

Uma mensagem explícita, por exemplo `PREPARE_OFFLINE_PAGE`, carregará o escopo normalizado da conta. O worker validará que o escopo recebido coincide com o escopo ativo antes de gravar qualquer página privada.

O tratamento da mensagem:

1. busca `/offline` com cookies da mesma origem;
2. exige resposta HTML bem-sucedida;
3. extrai do HTML somente URLs locais sob `/_next/static/`;
4. baixa e guarda esses chunks no cache estático compartilhado;
5. grava o HTML no cache de páginas da conta usando a URL canônica `/offline`;
6. responde ao cliente com sucesso ou erro por `MessageChannel`.

O HTML só será publicado no cache da conta depois que todos os chunks essenciais tiverem sido armazenados. Isso evita considerar pronta uma página sem CSS ou JavaScript.

### Estratégia de fetch

- `/_next/static/*`: cache-first, com busca e armazenamento quando o recurso ainda não estiver presente.
- `/offline`: network-first quando online e fallback para o cache da conta atual.
- demais navegações: continuam network-only com `offline-fallback.html` quando a rede falhar.
- APIs e manifesto: continuam fora da interceptação existente.

### Cache e atualização

O cache será atualizado para `v7`. Na ativação, caches estáticos e caches de páginas de versões anteriores serão removidos. Os caches de páginas continuarão separados por escopo de conta.

Quando o usuário trocar de conta, `/offline` só poderá usar a página associada ao novo escopo. O cache estático de chunks pode ser compartilhado porque não contém dados privados.

## Fluxo de dados

1. O usuário solicita “Ouvir offline”.
2. A API autoriza a conta Premium e fornece a chave temporária do download.
3. O cliente baixa, criptografa e guarda o áudio.
4. O cliente grava no IndexedDB os metadados associados à conta.
5. O cliente envia `PREPARE_OFFLINE_PAGE` ao service worker.
6. O worker guarda os chunks atuais e o HTML de `/offline` no cache da conta.
7. O cliente confirma que o conteúdo está pronto.
8. Sem rede, a navegação para `/offline` restaura o HTML e os chunks; o player combina os dados do HTML com os metadados locais e abre o áudio criptografado.

## Tratamento de falhas

- Sem service worker controlador: aguardar `navigator.serviceWorker.ready` antes de preparar o shell.
- Resposta de `/offline` redirecionada para login ou sem sucesso: rejeitar a preparação e não armazenar HTML.
- Falha ao baixar qualquer chunk essencial: não substituir uma versão válida já preparada; retornar erro ao cliente.
- Falha de rede durante a navegação: usar o cache da conta; se ele não existir, manter o fallback genérico.
- Áudio ou metadado expirado: preservar o comportamento atual de remover o item inválido da lista local.

## Testes

Os testes de regressão deverão demonstrar primeiro as falhas atuais e depois validar:

- o service worker intercepta `/_next/static/` com cache-first;
- a mensagem de preparação existe e usa cache isolado por conta;
- a página só é marcada pronta depois de seus chunks;
- o componente solicita preparação após salvar áudio e metadados;
- troca de conta não reutiliza HTML privado;
- `/offline` usa o cache da conta sem rede;
- outras rotas continuam usando o fallback genérico;
- cache versionado antigo é removido;
- testes completos, lint e build continuam aprovados.

## Critérios de aceite

- A home não perde o Tailwind em recargas com conexão intermitente depois que seus chunks já tiverem sido carregados uma vez.
- Ao concluir o salvamento de um áudio, desligar a internet e abrir `/offline` funciona sem visita online prévia à rota.
- A página offline aparece estilizada, lista o áudio salvo e consegue reproduzi-lo.
- Conteúdo HTML de uma conta nunca é servido para outra conta.
- Uma nova implantação não deixa o PWA preso a chunks antigos.
