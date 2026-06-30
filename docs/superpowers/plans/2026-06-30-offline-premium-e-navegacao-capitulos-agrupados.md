# Offline Premium e Navegação de Capítulos Agrupados Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir a autorização Premium do download offline e adicionar autoplay e navegação anterior/próximo dentro de áudios com capítulos agrupados.

**Architecture:** A consulta compartilhada de autorização voltará a carregar os dois campos que definem acesso Premium. A lógica pura de localizar e navegar entre partes ficará em `src/lib/chapter-playback.ts`; os componentes clientes usarão essa API, enquanto `AudioPlayer` continuará sendo o único proprietário do elemento de áudio e da chamada a `play()`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma, Node test runner com `tsx`.

---

### Task 0: Corrigir referência de tempo e cabeçalho Premium mobile

**Files:**
- Modify: `src/lib/subscription.ts`
- Modify: `src/lib/subscription.test.ts`
- Create: `src/lib/layout-premium.test.ts`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Confirm the existing failing clock test**

Run: `npx tsx --test src/lib/subscription.test.ts`

Expected: FAIL em `getPremiumDaysLabel mantem a contagem para usuario premium`,
pois a validação usa o relógio real em vez do `now` fornecido.

- [ ] **Step 2: Write the mobile-header failing test**

Criar um teste que leia `src/app/layout.tsx` e exija que o link mobile contenha
`premiumDaysLabel`, não contenha `<span>Audio Novel BR</span>` e mantenha a
apresentação desktop.

- [ ] **Step 3: Run the mobile-header test to verify it fails**

Run: `npx tsx --test src/lib/layout-premium.test.ts`

Expected: FAIL porque o texto da marca ainda ocupa o espaço mobile.

- [ ] **Step 4: Write minimal implementation**

Permitir que `hasPremiumAccess()` receba `now`, repassar esse valor a
`hasPremiumAccessAt()` e usá-lo em `getPremiumDaysLabel()`. No link mobile do
layout, substituir “Audio Novel BR” por `{premiumDaysLabel}` com estilo compacto.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx tsx --test src/lib/subscription.test.ts src/lib/layout-premium.test.ts`

Expected: todos PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/subscription.ts src/lib/subscription.test.ts src/lib/layout-premium.test.ts src/app/layout.tsx
git commit -m "fix: show deterministic premium days on mobile"
```

### Task 1: Restaurar os dados de autorização Premium

**Files:**
- Modify: `src/lib/page-data-select.test.ts`
- Modify: `src/lib/page-data-select.ts`

- [ ] **Step 1: Write the failing test**

Atualizar o teste de `REQUIRE_USER_SELECT` para exigir:

```ts
assert.deepEqual(Object.keys(REQUIRE_USER_SELECT).sort(), [
  "email",
  "id",
  "isBlocked",
  "name",
  "premiumUntil",
  "role",
  "subscriptionStatus",
]);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/lib/page-data-select.test.ts`

Expected: FAIL porque `premiumUntil` e `subscriptionStatus` ainda não pertencem à seleção.

- [ ] **Step 3: Write minimal implementation**

Adicionar à `REQUIRE_USER_SELECT`:

```ts
subscriptionStatus: true,
premiumUntil: true,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/lib/page-data-select.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/page-data-select.ts src/lib/page-data-select.test.ts
git commit -m "fix: restore premium offline authorization"
```

### Task 2: Modelar navegação entre partes agrupadas

**Files:**
- Create: `src/lib/chapter-playback.ts`
- Create: `src/lib/chapter-playback.test.ts`

- [ ] **Step 1: Write the failing tests**

Criar testes para a API desejada:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  getActiveChapterPartIndex,
  getAdjacentChapterPart,
  getChapterPartSeekDetail,
} from "./chapter-playback";

const parts = [
  { position: 1, title: "Um", startSec: 30, endSec: 90 },
  { position: 2, title: "Dois", startSec: 90, endSec: 150 },
  { position: 3, title: "Três", startSec: 150, endSec: 210 },
];

test("identifica a parte agrupada pelo tempo absoluto", () => {
  assert.equal(getActiveChapterPartIndex(parts, 30), 0);
  assert.equal(getActiveChapterPartIndex(parts, 120), 1);
  assert.equal(getActiveChapterPartIndex(parts, 210), 2);
});

test("encontra partes anterior e seguinte", () => {
  assert.equal(getAdjacentChapterPart(parts, 120, "previous")?.position, 1);
  assert.equal(getAdjacentChapterPart(parts, 120, "next")?.position, 3);
});

test("respeita os limites do agrupamento", () => {
  assert.equal(getAdjacentChapterPart(parts, 30, "previous"), null);
  assert.equal(getAdjacentChapterPart(parts, 210, "next"), null);
});

test("clique em uma parte solicita posicionamento com autoplay", () => {
  assert.deepEqual(getChapterPartSeekDetail(parts[1]), {
    startSec: 90,
    autoplay: true,
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test src/lib/chapter-playback.test.ts`

Expected: FAIL porque `chapter-playback.ts` ainda não existe.

- [ ] **Step 3: Write minimal implementation**

Criar os tipos `ChapterPlaybackPart`, `ChapterSeekDetail` e as três funções testadas. A parte ativa deve usar intervalos `[startSec, endSec)`, escolhendo a primeira antes do início e a última no fim do áudio.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test src/lib/chapter-playback.test.ts`

Expected: 4 testes PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/chapter-playback.ts src/lib/chapter-playback.test.ts
git commit -m "feat: model grouped chapter navigation"
```

### Task 3: Conectar autoplay e controles ao player

**Files:**
- Modify: `src/components/chapter-part-links.tsx`
- Modify: `src/components/audio-player.tsx`

- [ ] **Step 1: Send explicit autoplay intent from chapter titles**

Em `ChapterPartLinks`, importar `getChapterPartSeekDetail()` e emitir:

```ts
window.dispatchEvent(
  new CustomEvent("audio-novel-seek", {
    detail: getChapterPartSeekDetail(part),
  }),
);
```

- [ ] **Step 2: Handle seek-and-play in AudioPlayer**

Tipar o evento com `ChapterSeekDetail`. Evoluir `seekToAbsoluteTime` para receber `autoplay`; quando verdadeiro, configurar tempo, volume, mute e velocidade, chamar `audio.play()`, atualizar `playing` e salvar progresso. Em rejeição, manter o áudio pausado e mostrar a mensagem de erro já existente.

- [ ] **Step 3: Add previous and next grouped-part actions**

Calcular a parte ativa com `getActiveChapterPartIndex(groupedChapterParts, startOffset + current)`. Usar `getAdjacentChapterPart()` em uma ação que salta para o destino com autoplay.

- [ ] **Step 4: Render accessible controls**

Importar `SkipBack` e `SkipForward` de `lucide-react`. Nos controles normal e karaokê, renderizar os botões somente quando houver agrupamento, com:

```tsx
aria-label="Capítulo agrupado anterior"
aria-label="Próximo capítulo agrupado"
```

Aplicar `disabled` nos limites e estilos visuais de estado desabilitado.

- [ ] **Step 5: Run focused tests and lint**

Run: `npx tsx --test src/lib/chapter-playback.test.ts src/lib/page-data-select.test.ts`

Expected: todos PASS.

Run: `npm run lint -- --file src/components/audio-player.tsx --file src/components/chapter-part-links.tsx --file src/lib/chapter-playback.ts`

Expected: exit 0. Se o ESLint desta versão não aceitar `--file`, executar `npm run lint`.

- [ ] **Step 6: Commit**

```powershell
git add src/components/audio-player.tsx src/components/chapter-part-links.tsx
git commit -m "feat: navigate grouped chapters in player"
```

### Task 4: Verificação completa

**Files:**
- Verify: all changed files

- [ ] **Step 1: Run complete test suite**

Run: `npm test`

Expected: exit 0, sem testes falhando.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: exit 0.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: exit 0 e build de produção concluído.

- [ ] **Step 4: Review the final diff**

Run: `git diff HEAD~3 --check`

Expected: nenhuma saída.

Run: `git status --short`

Expected: apenas alterações preexistentes e não relacionadas, se houver.

### Task 5: Exibir dias Premium no perfil

**Files:**
- Create: `src/lib/profile-premium.test.ts`
- Modify: `src/app/perfil/page.tsx`

- [ ] **Step 1: Write the failing integration contract**

Criar um teste que leia `src/app/perfil/page.tsx` e exija o uso de
`getPremiumDaysLabel(user)` e a renderização de `{premiumDaysLabel}` ao lado do
selo do plano.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/lib/profile-premium.test.ts`

Expected: FAIL porque o perfil ainda não usa `getPremiumDaysLabel`.

- [ ] **Step 3: Write minimal implementation**

Importar `getPremiumDaysLabel`, calcular o texto com o usuário já selecionado e
renderizar um segundo selo no grupo que contém “Plano: Premium/Free”.

- [ ] **Step 4: Run focused tests**

Run: `npx tsx --test src/lib/profile-premium.test.ts src/lib/subscription.test.ts`

Expected: todos PASS.

- [ ] **Step 5: Verify and commit**

Run: `npm test`

Run: `npm run lint`

Run: `npm run build`

```powershell
git add src/app/perfil/page.tsx src/lib/profile-premium.test.ts docs/superpowers/plans/2026-06-30-offline-premium-e-navegacao-capitulos-agrupados.md
git commit -m "feat: show premium days on profile"
```
