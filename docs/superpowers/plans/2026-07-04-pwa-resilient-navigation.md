# PWA Resilient Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manter páginas de leitura já visitadas navegáveis durante quedas de conexão, usando a tela estática “Você está offline” somente para URLs inéditas e reservando `/offline` aos áudios salvos.

**Architecture:** O service worker usará rede primeiro com limite de quatro segundos nas rotas permitidas e cache HTML separado por conta. Um marcador de conta no layout impedirá publicação cruzada, e um componente cliente converterá links elegíveis em navegação completa quando o navegador estiver offline.

**Tech Stack:** Next.js 16 App Router, React 19, Service Worker API, Cache Storage API, TypeScript, Node `vm` tests.

---

### Task 1: Definir rotas e chaves de navegação

**Files:**
- Modify: `public/sw.js`
- Test: `src/lib/pwa-service-worker-runtime.test.ts`
- Test: `src/lib/pwa-service-worker.test.ts`

- [ ] **Step 1: Escrever testes que falham**

Cobrir uma função exposta no runtime de teste:

```ts
assert.equal(created.runtime.isCacheableNavigationPath("/"), true);
assert.equal(created.runtime.isCacheableNavigationPath("/novels"), true);
assert.equal(created.runtime.isCacheableNavigationPath("/novels/teste"), true);
assert.equal(created.runtime.isCacheableNavigationPath("/chapters/id"), true);
assert.equal(created.runtime.isCacheableNavigationPath("/biblioteca"), true);
assert.equal(created.runtime.isCacheableNavigationPath("/perfil"), false);
assert.equal(created.runtime.isCacheableNavigationPath("/offline"), false);
```

Também exigir `CACHE_VERSION = "v8"`.

- [ ] **Step 2: Confirmar RED**

```powershell
npx tsx --test src/lib/pwa-service-worker.test.ts src/lib/pwa-service-worker-runtime.test.ts
```

Expected: FAIL porque a função e a versão v8 não existem.

- [ ] **Step 3: Implementar regras mínimas**

Em `public/sw.js`:

```js
const CACHE_VERSION = "v8";

function isCacheableNavigationPath(pathname) {
  return (
    pathname === "/" ||
    pathname === "/novels" ||
    pathname.startsWith("/novels/") ||
    pathname.startsWith("/chapters/") ||
    pathname === "/biblioteca"
  );
}

function getNavigationCacheKey(request) {
  const url = new URL(request.url);
  url.searchParams.delete("_rsc");
  url.hash = "";
  return url.href;
}
```

- [ ] **Step 4: Confirmar GREEN e commit**

```powershell
npx tsx --test src/lib/pwa-service-worker.test.ts src/lib/pwa-service-worker-runtime.test.ts
git add public/sw.js src/lib/pwa-service-worker.test.ts src/lib/pwa-service-worker-runtime.test.ts
git commit -m "test: define cacheable PWA navigation routes"
```

### Task 2: Marcar HTML com a conta ativa

**Files:**
- Modify: `src/app/layout.tsx`
- Test: `src/lib/pwa-service-worker-runtime.test.ts`

- [ ] **Step 1: Escrever teste que falha**

```ts
test("layout publica o escopo da conta para validar paginas em cache", () => {
  assert.match(
    layoutSource,
    /<meta name="audio-novel-account-scope" content=\{activeSession\?\.user\?\.id \?\? "anonymous"\} \/>/,
  );
});
```

- [ ] **Step 2: Confirmar RED**

```powershell
npx tsx --test src/lib/pwa-service-worker-runtime.test.ts
```

- [ ] **Step 3: Adicionar o marcador**

Dentro de `<html>` e antes de `<body>`:

```tsx
<head>
  <meta
    name="audio-novel-account-scope"
    content={activeSession?.user?.id ?? "anonymous"}
  />
</head>
```

- [ ] **Step 4: Confirmar GREEN e commit**

```powershell
npx tsx --test src/lib/pwa-service-worker-runtime.test.ts
git add src/app/layout.tsx src/lib/pwa-service-worker-runtime.test.ts
git commit -m "fix: mark PWA pages with account scope"
```

### Task 3: Salvar e servir páginas visitadas por conta

**Files:**
- Modify: `public/sw.js`
- Test: `src/lib/pwa-service-worker-runtime.test.ts`

- [ ] **Step 1: Escrever testes RED**

Adicionar testes de runtime para:

```ts
// resposta online válida é devolvida e salva pela chave normalizada
// falha de fetch devolve a cópia exata salva
// /biblioteca de account-a nunca é devolvida para account-b ou anonymous
// /perfil não é salvo
// URL inédita devolve offline-fallback.html e nunca redirect 302 para /offline
```

Cada fixture HTML deve conter:

```html
<meta name="audio-novel-account-scope" content="account-a">
```

- [ ] **Step 2: Confirmar RED**

```powershell
npx tsx --test src/lib/pwa-service-worker-runtime.test.ts
```

Expected: os testes falham porque navegações comuns ainda usam
`networkOnlyWithOfflineFallback`.

- [ ] **Step 3: Implementar publicação validada**

Adicionar helpers:

```js
async function publishNavigationPage(response, request, scope) {
  if (!response.ok || !isHtmlResponse(response)) return;
  const html = await response.clone().text();
  if (extractOfflineAccountScope(html) !== scope) return;
  if (new URL(request.url).pathname === "/biblioteca" && scope === ANONYMOUS_ACCOUNT_SCOPE) return;
  const cache = await caches.open(getAccountPageCacheName(scope));
  await cache.put(getNavigationCacheKey(request), response);
}
```

Substituir o fluxo de navegação comum por:

```js
if (request.mode === "navigate") {
  event.respondWith(
    url.pathname === "/offline"
      ? accountScopedOfflinePage(request)
      : isCacheableNavigationPath(url.pathname)
        ? networkFirstWithPageCache(request, event)
        : networkOnlyWithStaticFallback(request),
  );
}
```

`networkFirstWithPageCache` deve:

- usar o escopo atual;
- iniciar `fetch(request)`;
- publicar somente HTML da mesma conta;
- aguardar no máximo quatro segundos quando houver cache;
- devolver a rede quando ela responder;
- devolver a página exata salva após falha/timeout;
- devolver `getOfflineFallback()` para URL inédita;
- registrar a atualização de rede restante em `event.waitUntil`.

Remover `getAccountOfflineRedirect`; nenhuma navegação comum deve responder 302
para `/offline`.

- [ ] **Step 4: Confirmar GREEN e commit**

```powershell
npx tsx --test src/lib/pwa-service-worker-runtime.test.ts src/lib/pwa-service-worker.test.ts
git add public/sw.js src/lib/pwa-service-worker-runtime.test.ts src/lib/pwa-service-worker.test.ts
git commit -m "fix: cache visited PWA pages per account"
```

### Task 4: Forçar navegação de documento quando offline

**Files:**
- Create: `src/components/pwa-offline-navigation.tsx`
- Create: `src/lib/pwa-offline-navigation.test.ts`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Escrever testes RED**

O teste de wiring deve exigir:

```ts
assert.match(source, /document\.addEventListener\("click", handleOfflineClick/);
assert.match(source, /if \(navigator\.onLine\) return/);
assert.match(source, /event\.button !== 0/);
assert.match(source, /event\.metaKey \|\| event\.ctrlKey \|\| event\.shiftKey \|\| event\.altKey/);
assert.match(source, /anchor\.hasAttribute\("download"\)/);
assert.match(source, /window\.location\.assign\(url\.href\)/);
```

E o layout deve renderizar `<PwaOfflineNavigation />`.

- [ ] **Step 2: Confirmar RED**

```powershell
npx tsx --test src/lib/pwa-offline-navigation.test.ts
```

- [ ] **Step 3: Implementar o componente**

Criar um Client Component sem UI que registre clique em fase de captura. Ele deve:

- retornar quando online;
- aceitar apenas botão principal sem modificadores;
- localizar `event.target.closest("a[href]")`;
- ignorar `target`, `download`, origem externa e rotas fora da allowlist;
- chamar `event.preventDefault()` e `window.location.assign(url.href)`.

A allowlist cliente deve corresponder ao service worker:

```ts
function isOfflineNavigablePath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/novels" ||
    pathname.startsWith("/novels/") ||
    pathname.startsWith("/chapters/") ||
    pathname === "/biblioteca"
  );
}
```

Montar o componente ao lado de `ServiceWorkerRegister` no layout.

- [ ] **Step 4: Confirmar GREEN e commit**

```powershell
npx tsx --test src/lib/pwa-offline-navigation.test.ts
git add src/components/pwa-offline-navigation.tsx src/lib/pwa-offline-navigation.test.ts src/app/layout.tsx
git commit -m "fix: use document navigation for cached PWA pages"
```

### Task 5: Verificar o comportamento completo

- [ ] **Step 1: Testes focados**

```powershell
npx tsx --test src/lib/pwa-service-worker.test.ts src/lib/pwa-service-worker-runtime.test.ts src/lib/pwa-offline-navigation.test.ts
```

Expected: zero falhas.

- [ ] **Step 2: Validação completa**

```powershell
npm test
npm run lint
npm run build
```

Expected: exit code 0 em todos. O build pode imprimir avisos transitórios de
conectividade do Aiven sem falhar.

- [ ] **Step 3: Verificação manual**

Com o app em HTTPS e service worker v8 ativo:

1. visitar início, catálogo, uma novel, um capítulo e biblioteca;
2. ativar modo offline;
3. navegar entre essas páginas e confirmar que abrem;
4. abrir uma URL inédita e confirmar a tela estática “Você está offline”;
5. abrir `/offline` e confirmar que continua mostrando apenas os áudios salvos;
6. trocar de conta e confirmar que a biblioteca anterior não aparece.
