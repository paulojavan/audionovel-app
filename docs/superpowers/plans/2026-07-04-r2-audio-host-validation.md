# R2 Audio Host Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aceitar automaticamente áudio HTTPS hospedado em qualquer subdomínio `*.r2.dev` e mostrar a causa específica quando um lote falhar na validação.

**Architecture:** A allowlist de mídia continuará centralizada em `url-security.ts`, mas reconhecerá o domínio pai público do Cloudflare R2. A rota de capítulos selecionará o schema correto pelo formato do payload e devolverá a primeira mensagem segura do Zod.

**Tech Stack:** TypeScript, Zod 4, Next.js 16 Route Handlers, Node test runner.

---

### Task 1: Permitir qualquer bucket público R2

**Files:**
- Modify: `src/lib/url-security.ts`
- Test: `src/lib/url-security.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Adicionar:

```ts
test("autoriza qualquer subdominio publico do Cloudflare R2", () => {
  assert.equal(
    isSafeMediaHttpsUrl("https://pub-4684220593db49858eb8eea0e3b7b910.r2.dev/audio.mp3"),
    true,
  );
});

test("nao confunde dominio falso com Cloudflare R2", () => {
  assert.equal(isSafeMediaHttpsUrl("https://r2.dev.exemplo.com/audio.mp3"), false);
  assert.equal(isSafeMediaHttpsUrl("http://bucket.r2.dev/audio.mp3"), false);
});
```

- [ ] **Step 2: Confirmar RED**

Run:

```powershell
npx tsx --test src/lib/url-security.test.ts
```

Expected: FAIL no novo bucket, pois ele ainda não está nos defaults.

- [ ] **Step 3: Implementar a regra mínima**

Em `DEFAULT_MEDIA_HOSTS`, adicionar o domínio pai:

```ts
const DEFAULT_MEDIA_HOSTS = [
  "r2.dev",
  // hosts explícitos existentes
];
```

A comparação existente por igualdade ou sufixo autoriza `*.r2.dev` e continua
rejeitando `r2.dev.exemplo.com`.

- [ ] **Step 4: Confirmar GREEN**

Run:

```powershell
npx tsx --test src/lib/url-security.test.ts
```

Expected: todos os testes passam.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/url-security.ts src/lib/url-security.test.ts
git commit -m "fix: allow public Cloudflare R2 audio buckets"
```

### Task 2: Cobrir o lote real de capítulos

**Files:**
- Test: `src/lib/admin-chapter-validation.test.ts`

- [ ] **Step 1: Escrever o teste do lote 96–100**

```ts
test("aceita lote consecutivo hospedado em novo bucket R2", () => {
  const chapters = [96, 97, 98, 99, 100].map((position) => ({
    ...baseChapter,
    position,
    title: `Capitulo ${position}`,
    audioUrl: "https://pub-4684220593db49858eb8eea0e3b7b910.r2.dev/audio.mp3",
  }));

  assert.equal(chapterBatchSchema.safeParse({ chapters }).success, true);
});
```

- [ ] **Step 2: Executar o teste**

Run:

```powershell
npx tsx --test src/lib/admin-chapter-validation.test.ts
```

Expected: PASS porque a Task 1 já liberou o domínio.

- [ ] **Step 3: Commit**

```powershell
git add src/lib/admin-chapter-validation.test.ts
git commit -m "test: cover R2 chapter batch validation"
```

### Task 3: Mostrar a mensagem específica de validação

**Files:**
- Modify: `src/app/api/admin/chapters/route.ts`
- Create: `src/lib/admin-chapter-route-validation.test.ts`

- [ ] **Step 1: Escrever o teste de wiring que falha**

O teste deve ler a rota e exigir que o erro venha do schema selecionado:

```ts
test("POST devolve a primeira mensagem do schema no erro 400", () => {
  assert.match(routeSource, /const validationError = batchPayload \? batch\.error : single\.error/);
  assert.match(routeSource, /validationError\.issues\[0\]\?\.message \?\? "Dados invalidos\."/);
});
```

- [ ] **Step 2: Confirmar RED**

Run:

```powershell
npx tsx --test src/lib/admin-chapter-route-validation.test.ts
```

Expected: FAIL enquanto a rota ainda retorna sempre `Dados invalidos.`.

- [ ] **Step 3: Implementar a seleção do erro**

Depois dos `safeParse`, detectar o formato:

```ts
const batchPayload =
  typeof body === "object" &&
  body !== null &&
  "chapters" in body;
```

No ramo inválido:

```ts
if (!chapters) {
  const validationError = batchPayload ? batch.error : single.error;
  return NextResponse.json(
    { error: validationError.issues[0]?.message ?? "Dados invalidos." },
    { status: 400 },
  );
}
```

- [ ] **Step 4: Confirmar GREEN**

Run:

```powershell
npx tsx --test src/lib/admin-chapter-route-validation.test.ts src/lib/admin-chapter-validation.test.ts
```

Expected: todos passam.

- [ ] **Step 5: Commit**

```powershell
git add src/app/api/admin/chapters/route.ts src/lib/admin-chapter-route-validation.test.ts
git commit -m "fix: expose chapter validation errors"
```

### Task 4: Verificação do conjunto

- [ ] **Step 1: Executar testes focados**

```powershell
npx tsx --test src/lib/url-security.test.ts src/lib/admin-chapter-validation.test.ts src/lib/admin-chapter-route-validation.test.ts
```

Expected: zero falhas.

- [ ] **Step 2: Executar validação completa**

```powershell
npm test
npm run lint
npm run build
```

Expected: todos terminam com exit code 0; avisos transitórios do Aiven devem ser
separados do resultado real do build.
