# Flexible Chapter Numbering and Domain Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support chapter numbers such as `0` and `8.5`, protect the existing admin-user pagination, and prepare public metadata and deployment guidance for `https://audionovelbr.com.br`.

**Architecture:** Keep `Chapter.position` as the single ordering/display value, changing its database representation from integer to floating point. Isolate admin pagination URL/page normalization into a pure helper, configure root metadata for the new public origin, and document deployment-only changes that cannot be made inside the repository.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma 6/PostgreSQL, Zod 4, Node test runner.

---

### Task 1: Accept zero and decimal chapter positions

**Files:**
- Modify: `src/lib/admin-chapter-validation.test.ts`
- Modify: `src/lib/admin-chapter-validation.ts`
- Modify: `src/lib/chapter-time.test.ts`
- Modify: `src/lib/chapter-time.ts`
- Modify: `src/lib/admin-chapter-sequence.test.ts`
- Modify: `src/lib/admin-chapter-sequence.ts`

- [ ] **Step 1: Add failing validation tests**

Add these tests to `src/lib/admin-chapter-validation.test.ts`:

```ts
test("aceita capitulo zero", () => {
  assert.equal(chapterSchema.safeParse({ ...baseChapter, position: 0, positionEnd: null }).success, true);
});

test("aceita capitulo decimal intermediario", () => {
  assert.equal(chapterSchema.safeParse({ ...baseChapter, position: 8.5, positionEnd: null }).success, true);
});

test("rejeita numero de capitulo negativo", () => {
  assert.equal(chapterSchema.safeParse({ ...baseChapter, position: -0.5, positionEnd: null }).success, false);
});
```

- [ ] **Step 2: Run the validation tests and verify RED**

Run: `npx tsx --test src/lib/admin-chapter-validation.test.ts`

Expected: the tests for `0` and `8.5` fail because the schema requires a positive integer.

- [ ] **Step 3: Implement numeric validation**

Change the position rules in `src/lib/admin-chapter-validation.ts` to:

```ts
const chapterPositionSchema = z.number().finite().min(0);

const chapterPartSchema = z.object({
  position: chapterPositionSchema,
  title: z.string().trim().min(1),
  startSec: z.number().int().min(0),
  endSec: z.number().int().min(0),
});
```

Use `chapterPositionSchema` for both `chapterSchema.position` and nullable `chapterSchema.positionEnd`.

- [ ] **Step 4: Add failing label and sequence tests**

Add to `src/lib/chapter-time.test.ts`:

```ts
test("formata capitulos zero e decimal sem zeros extras", () => {
  assert.equal(getChapterPositionLabel(0), "0");
  assert.equal(getChapterPositionLabel(8.5), "8.5");
});
```

Add to `src/lib/admin-chapter-sequence.test.ts`:

```ts
test("avanca uma unidade depois do maior capitulo decimal", () => {
  assert.equal(getNextChapterPosition([{ position: 8.5, positionEnd: null }]), 9.5);
});
```

- [ ] **Step 5: Run label and sequence tests**

Run: `npx tsx --test src/lib/chapter-time.test.ts src/lib/admin-chapter-sequence.test.ts`

Expected: PASS, documenting that existing pure-number helpers already preserve decimal labels and ordering.

- [ ] **Step 6: Run the focused validation suite and commit**

Run: `npx tsx --test src/lib/admin-chapter-validation.test.ts src/lib/chapter-time.test.ts src/lib/admin-chapter-sequence.test.ts`

Expected: all focused tests pass.

Commit:

```bash
git add src/lib/admin-chapter-validation.test.ts src/lib/admin-chapter-validation.ts src/lib/chapter-time.test.ts src/lib/admin-chapter-sequence.test.ts
git commit -m "test: define flexible chapter numbering"
```

### Task 2: Persist and edit flexible chapter positions

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/aiven-2026-07-04-flexible-chapter-positions.sql`
- Modify: `src/components/admin-content-forms.tsx`
- Modify: `src/lib/chapter-grouping.ts`
- Modify: `src/lib/chapter-grouping.test.ts`

- [ ] **Step 1: Add a failing source-wiring test**

Create `src/lib/flexible-chapter-position-wiring.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const form = readFileSync("src/components/admin-content-forms.tsx", "utf8");

test("schema persiste posicoes decimais", () => {
  assert.match(schema, /position\s+Float/);
  assert.match(schema, /positionEnd\s+Float\?/);
});

test("formularios aceitam zero e decimais", () => {
  const chapterInputs = [...form.matchAll(/name="position"[^>]+/g)].map((match) => match[0]);
  assert.ok(chapterInputs.length >= 1);
  for (const input of chapterInputs) {
    assert.match(input, /min="0"/);
    assert.match(input, /step="any"/);
  }
});
```

- [ ] **Step 2: Run the wiring test and verify RED**

Run: `npx tsx --test src/lib/flexible-chapter-position-wiring.test.ts`

Expected: FAIL because the Prisma fields are `Int` and chapter inputs require `min="1"`.

- [ ] **Step 3: Change Prisma and form field types**

In `prisma/schema.prisma`, change:

```prisma
position         Float
positionEnd      Float?
```

In chapter-number inputs inside `src/components/admin-content-forms.tsx`, use:

```tsx
<input name="position" type="number" min="0" step="any" ... />
```

Do not change volume-number inputs, which remain positive integers.

- [ ] **Step 4: Preserve decimal chapter parts**

In `src/lib/chapter-grouping.ts`, replace integer coercion:

```ts
position: Math.max(0, Number(part.position || 0)),
```

Add this case to `src/lib/chapter-grouping.test.ts`:

```ts
test("preserva posicao decimal ao normalizar partes", () => {
  assert.deepEqual(normalizeChapterParts([
    { position: 8.5, title: "Interludio", startSec: 0, endSec: 30 },
  ])[0]?.position, 8.5);
});
```

- [ ] **Step 5: Add the Aiven migration**

Create `prisma/aiven-2026-07-04-flexible-chapter-positions.sql`:

```sql
BEGIN;

ALTER TABLE "Chapter"
  ALTER COLUMN "position" TYPE DOUBLE PRECISION USING "position"::DOUBLE PRECISION,
  ALTER COLUMN "positionEnd" TYPE DOUBLE PRECISION USING "positionEnd"::DOUBLE PRECISION;

COMMIT;
```

- [ ] **Step 6: Generate Prisma client and verify**

Run: `npm run prisma:generate`

Expected: Prisma Client generation succeeds.

Run: `npx tsx --test src/lib/flexible-chapter-position-wiring.test.ts src/lib/chapter-grouping.test.ts`

Expected: all tests pass.

- [ ] **Step 7: Commit persistence and form changes**

```bash
git add prisma/schema.prisma prisma/aiven-2026-07-04-flexible-chapter-positions.sql src/components/admin-content-forms.tsx src/lib/chapter-grouping.ts src/lib/chapter-grouping.test.ts src/lib/flexible-chapter-position-wiring.test.ts
git commit -m "feat: support zero and decimal chapter numbers"
```

### Task 3: Protect admin-user pagination

**Files:**
- Create: `src/lib/admin-user-pagination.ts`
- Create: `src/lib/admin-user-pagination.test.ts`
- Modify: `src/app/admin/usuarios/page.tsx`

- [ ] **Step 1: Write failing pagination tests**

Create `src/lib/admin-user-pagination.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildAdminUsersPageHref, normalizeAdminUsersPage } from "./admin-user-pagination";

test("normaliza paginas ausentes ou invalidas", () => {
  assert.equal(normalizeAdminUsersPage(undefined), 1);
  assert.equal(normalizeAdminUsersPage("0"), 1);
  assert.equal(normalizeAdminUsersPage("abc"), 1);
  assert.equal(normalizeAdminUsersPage("3"), 3);
});

test("preserva busca e omite pagina um do link", () => {
  assert.equal(buildAdminUsersPageHref("ana", 1), "/admin/usuarios?q=ana");
  assert.equal(buildAdminUsersPageHref("ana", 2), "/admin/usuarios?q=ana&page=2");
});
```

- [ ] **Step 2: Run pagination tests and verify RED**

Run: `npx tsx --test src/lib/admin-user-pagination.test.ts`

Expected: FAIL because the helper module does not exist.

- [ ] **Step 3: Implement the pure pagination helper**

Create `src/lib/admin-user-pagination.ts`:

```ts
export const ADMIN_USERS_PAGE_SIZE = 50;

export function normalizeAdminUsersPage(page: string | undefined) {
  const parsed = Number.parseInt(page ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function buildAdminUsersPageHref(query: string | undefined, page: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/admin/usuarios?${suffix}` : "/admin/usuarios";
}
```

- [ ] **Step 4: Wire the page to the helper**

Import the three exports in `src/app/admin/usuarios/page.tsx`, remove its local constant and `buildPageHref`, use `ADMIN_USERS_PAGE_SIZE` for both `skip` and `take`, and use `buildAdminUsersPageHref` in previous/next links.

- [ ] **Step 5: Verify and commit pagination**

Run: `npx tsx --test src/lib/admin-user-pagination.test.ts`

Expected: all tests pass.

```bash
git add src/lib/admin-user-pagination.ts src/lib/admin-user-pagination.test.ts src/app/admin/usuarios/page.tsx
git commit -m "test: protect admin user pagination"
```

### Task 4: Configure and document the new domain

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/lib/public-domain-wiring.test.ts`
- Modify: `src/lib/billing-checkout.test.ts`
- Modify: `src/lib/password-reset-delivery.test.ts`
- Modify: `src/lib/public-origin.test.ts`
- Create: `docs/domain-migration-audionovelbr-com-br.md`

- [ ] **Step 1: Write a failing metadata wiring test**

Create `src/lib/public-domain-wiring.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const layout = readFileSync("src/app/layout.tsx", "utf8");

test("metadata usa o novo dominio publico e canonical", () => {
  assert.match(layout, /metadataBase:\s*new URL\("https:\/\/audionovelbr\.com\.br"\)/);
  assert.match(layout, /alternates:\s*\{\s*canonical:\s*"\/"/);
});
```

- [ ] **Step 2: Run the metadata test and verify RED**

Run: `npx tsx --test src/lib/public-domain-wiring.test.ts`

Expected: FAIL because root metadata has no `metadataBase` or canonical.

- [ ] **Step 3: Configure root metadata**

Add to the `metadata` object in `src/app/layout.tsx`:

```ts
metadataBase: new URL("https://audionovelbr.com.br"),
alternates: {
  canonical: "/",
},
```

- [ ] **Step 4: Update old-domain test fixtures**

Replace `https://audionovelbr.qzz.io` with `https://audionovelbr.com.br` in:

```text
src/lib/billing-checkout.test.ts
src/lib/password-reset-delivery.test.ts
src/lib/public-origin.test.ts
```

These are fixtures, not production hard-codes; updating them ensures examples and expected public URLs reflect the new domain.

- [ ] **Step 5: Write the deployment checklist**

Create `docs/domain-migration-audionovelbr-com-br.md` with explicit commands/settings:

```md
# Migração para audionovelbr.com.br

## Variáveis no Coolify

- `NEXTAUTH_URL=https://audionovelbr.com.br`
- `NEXT_PUBLIC_APP_URL=https://audionovelbr.com.br`

## Infraestrutura externa

1. Aponte DNS para o proxy/Coolify e emita o certificado TLS.
2. Configure `audionovelbr.com.br` como domínio principal.
3. Redirecione o domínio antigo por HTTP 301, preservando caminho e query string.
4. Cadastre `https://audionovelbr.com.br/api/billing/webhook` no Mercado Pago.
5. Atualize callbacks OAuth, caso algum provedor seja habilitado.

## Validação após o deploy

1. Abra `/manifest.webmanifest` e confirme `application/manifest+json`.
2. Teste login, recuperação de senha, checkout e retorno do pagamento.
3. Remova a instalação PWA antiga e instale pelo novo domínio.
4. Salve novamente conteúdos offline, pois armazenamento e service worker não migram entre origens.
```

- [ ] **Step 6: Verify domain changes and commit**

Run: `npx tsx --test src/lib/public-domain-wiring.test.ts src/lib/public-origin.test.ts src/lib/billing-checkout.test.ts src/lib/password-reset-delivery.test.ts`

Expected: all tests pass.

```bash
git add src/app/layout.tsx src/lib/public-domain-wiring.test.ts src/lib/public-origin.test.ts src/lib/billing-checkout.test.ts src/lib/password-reset-delivery.test.ts
git add -f docs/domain-migration-audionovelbr-com-br.md
git commit -m "chore: prepare audionovelbr.com.br domain"
```

### Task 5: Full verification, subagent review, and publication

**Files:**
- Inspect: all files changed by Tasks 1–4

- [ ] **Step 1: Run the complete local verification**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: all commands exit with status `0`; known database-reachability warnings during prerender are acceptable only if the build exits successfully.

- [ ] **Step 2: Dispatch independent subagents**

Dispatch one subagent to review schema/API/form compatibility and another to review pagination/domain/PWA behavior. Give both the approved spec and current diff; ask them to report findings without editing.

- [ ] **Step 3: Resolve findings with TDD**

For every valid finding, add a focused failing test, run it to confirm the expected failure, implement the smallest correction, and rerun the focused and complete verification commands.

- [ ] **Step 4: Confirm repository state**

Run:

```bash
git status -sb
git log origin/main..main --oneline
```

Expected: only intended local artifacts remain untracked; commits for the specification, implementation, and verification are ahead of `origin/main`.

- [ ] **Step 5: Push**

Run: `git push origin main`

Expected: the remote `main` advances to the final verified commit.
