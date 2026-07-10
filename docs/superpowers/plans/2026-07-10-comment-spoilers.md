# Comment Spoilers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users hide portions of comments with `[spoiler]text[/spoiler]` until each reader explicitly reveals them.

**Architecture:** Keep comment bodies as plain text and parse valid spoiler pairs into typed segments at render time. A focused client component owns one-way reveal state, while existing server-rendered comment threads and APIs remain unchanged.

**Tech Stack:** Next.js 16.2.9 App Router, React 19.2.4, TypeScript, Tailwind CSS, Node test runner via `tsx --test`, React server rendering for initial-state tests.

## Global Constraints

- Recognize only exact lowercase `[spoiler]text[/spoiler]` pairs.
- Show `Spoiler — clique para revelar` before disclosure.
- Once revealed, a spoiler remains visible until page reload.
- Support multiple independent spoilers in one comment.
- Preserve incomplete, empty, incorrectly capitalized, and nested tags as literal text.
- Render user content only as React text; never use `dangerouslySetInnerHTML`, Markdown, or user HTML.
- Show `Use [spoiler]texto[/spoiler] para ocultar spoilers.` in new-comment, reply, and edit forms.
- Keep administrative moderation and user-history surfaces raw and unchanged.
- Keep the existing 1,200-character validation limit and all comment APIs unchanged.

---

### Task 1: Parse spoiler tags without interpreting HTML

**Files:**
- Create: `src/lib/comment-spoilers.ts`
- Create: `src/lib/comment-spoilers.test.ts`

**Interfaces:**
- Produces: `CommentTextSegment`, `CommentSpoilerSegment`, `CommentSegment`, and `parseCommentSpoilers(body: string): CommentSegment[]`.
- Consumes: a raw comment body string exactly as stored in Prisma.

- [ ] **Step 1: Write the failing parser tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { parseCommentSpoilers } from "./comment-spoilers";

test("preserves a comment without spoiler tags", () => {
  assert.deepEqual(parseCommentSpoilers("Texto comum."), [
    { type: "text", content: "Texto comum." },
  ]);
});

test("splits public text from one spoiler", () => {
  assert.deepEqual(parseCommentSpoilers("Antes [spoiler]segredo[/spoiler] depois"), [
    { type: "text", content: "Antes " },
    { type: "spoiler", content: "segredo" },
    { type: "text", content: " depois" },
  ]);
});

test("parses multiple independent spoilers including line breaks", () => {
  assert.deepEqual(
    parseCommentSpoilers("A [spoiler]um\ndois[/spoiler] B [spoiler]três[/spoiler]"),
    [
      { type: "text", content: "A " },
      { type: "spoiler", content: "um\ndois" },
      { type: "text", content: " B " },
      { type: "spoiler", content: "três" },
    ],
  );
});

test("keeps incomplete empty and incorrectly capitalized tags literal", () => {
  for (const body of [
    "[spoiler]sem fechamento",
    "[spoiler][/spoiler]",
    "[SPOILER]segredo[/SPOILER]",
  ]) {
    assert.deepEqual(parseCommentSpoilers(body), [{ type: "text", content: body }]);
  }
});

test("keeps an entire nested sequence literal", () => {
  const body = "[spoiler]fora [spoiler]dentro[/spoiler] fim[/spoiler]";
  assert.deepEqual(parseCommentSpoilers(body), [{ type: "text", content: body }]);
});

test("returns no segments for an empty body", () => {
  assert.deepEqual(parseCommentSpoilers(""), []);
});
```

- [ ] **Step 2: Run the parser test and verify RED**

Run: `npx tsx --test src/lib/comment-spoilers.test.ts`

Expected: FAIL with module-not-found for `comment-spoilers`.

- [ ] **Step 3: Implement the linear plain-text parser**

```ts
const OPEN_TAG = "[spoiler]";
const CLOSE_TAG = "[/spoiler]";

export type CommentTextSegment = { type: "text"; content: string };
export type CommentSpoilerSegment = { type: "spoiler"; content: string };
export type CommentSegment = CommentTextSegment | CommentSpoilerSegment;

export function parseCommentSpoilers(body: string): CommentSegment[] {
  const segments: CommentSegment[] = [];
  let cursor = 0;

  const appendText = (content: string) => {
    if (!content) return;
    const previous = segments[segments.length - 1];
    if (previous?.type === "text") previous.content += content;
    else segments.push({ type: "text", content });
  };

  while (cursor < body.length) {
    const openIndex = body.indexOf(OPEN_TAG, cursor);
    if (openIndex < 0) {
      appendText(body.slice(cursor));
      break;
    }

    appendText(body.slice(cursor, openIndex));
    const contentStart = openIndex + OPEN_TAG.length;
    const closeIndex = body.indexOf(CLOSE_TAG, contentStart);
    if (closeIndex < 0) {
      appendText(body.slice(openIndex));
      break;
    }

    const rawEnd = closeIndex + CLOSE_TAG.length;
    const content = body.slice(contentStart, closeIndex);
    if (!content || content.includes(OPEN_TAG) || content.includes(CLOSE_TAG)) {
      appendText(body.slice(openIndex, rawEnd));
      cursor = rawEnd;
      continue;
    }

    segments.push({ type: "spoiler", content });
    cursor = rawEnd;
  }

  return segments;
}
```

- [ ] **Step 4: Run the parser tests and verify GREEN**

Run: `npx tsx --test src/lib/comment-spoilers.test.ts`

Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/comment-spoilers.ts src/lib/comment-spoilers.test.ts
git commit -m "feat: parse spoiler tags in comments"
```

### Task 2: Render accessible one-way spoiler controls

**Files:**
- Create: `src/components/comment-body-text.tsx`
- Create: `src/lib/comment-spoiler-component.test.ts`

**Interfaces:**
- Consumes: `parseCommentSpoilers(body)` from Task 1 and `body: string`.
- Produces: `CommentBodyText({ body }: { body: string })`, with one independent `SpoilerText` state per parsed spoiler.

- [ ] **Step 1: Read the installed Next.js client-component guidance**

Read completely:

- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`

Confirm that the stateful spoiler component has a focused `"use client"` boundary and receives serializable string props.

- [ ] **Step 2: Write the failing initial-render and wiring tests**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { CommentBodyText } from "../components/comment-body-text";

const source = readFileSync("src/components/comment-body-text.tsx", "utf8");

test("hides spoiler content in the initial accessible control", () => {
  const html = renderToStaticMarkup(
    createElement(CommentBodyText, {
      body: "Antes [spoiler]<strong>segredo</strong>[/spoiler] depois",
    }),
  );

  assert.match(html, /Antes /);
  assert.match(html, / depois/);
  assert.match(html, /Spoiler — clique para revelar/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /segredo/);
  assert.doesNotMatch(html, /<strong>/);
});

test("renders independent controls for multiple spoilers", () => {
  const html = renderToStaticMarkup(
    createElement(CommentBodyText, {
      body: "[spoiler]um[/spoiler] [spoiler]dois[/spoiler]",
    }),
  );
  assert.equal(html.match(/Spoiler — clique para revelar/g)?.length, 2);
});

test("reveal state only moves to true", () => {
  assert.match(source, /onClick=\{\(\) => setRevealed\(true\)\}/);
  assert.doesNotMatch(source, /setRevealed\(\(.*!.*\)\)/);
  assert.match(source, /aria-expanded=\{revealed\}/);
});
```

- [ ] **Step 3: Run the component test and verify RED**

Run: `npx tsx --test src/lib/comment-spoiler-component.test.ts`

Expected: FAIL with module-not-found for `comment-body-text`.

- [ ] **Step 4: Implement the focused client component**

```tsx
"use client";

import { useState } from "react";
import { parseCommentSpoilers } from "@/lib/comment-spoilers";

export function CommentBodyText({ body }: { body: string }) {
  const segments = parseCommentSpoilers(body);

  return (
    <p className="mt-1 whitespace-pre-wrap text-zinc-300">
      {segments.map((segment, index) =>
        segment.type === "text" ? (
          <span key={`text-${index}`}>{segment.content}</span>
        ) : (
          <SpoilerText key={`spoiler-${index}-${segment.content}`} content={segment.content} />
        ),
      )}
    </p>
  );
}

function SpoilerText({ content }: { content: string }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <button
      type="button"
      aria-expanded={revealed}
      onClick={() => setRevealed(true)}
      className={`mx-1 inline rounded-md border px-2 py-0.5 text-left align-baseline transition ${
        revealed
          ? "border-[#18b7bd]/40 bg-[#18b7bd]/10 text-zinc-200"
          : "border-white/15 bg-black text-xs font-bold text-zinc-400 hover:border-[#18b7bd]/50 hover:text-white"
      }`}
    >
      {revealed ? content : "Spoiler — clique para revelar"}
    </button>
  );
}
```

- [ ] **Step 5: Run parser and component tests**

Run: `npx tsx --test src/lib/comment-spoilers.test.ts src/lib/comment-spoiler-component.test.ts`

Expected: 9 tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/components/comment-body-text.tsx src/lib/comment-spoiler-component.test.ts
git commit -m "feat: reveal comment spoilers on click"
```

### Task 3: Wire public comments and syntax guidance

**Files:**
- Create: `src/components/comment-spoiler-hint.tsx`
- Modify: `src/components/comment-thread.tsx`
- Modify: `src/components/comment-form.tsx`
- Modify: `src/components/comment-actions.tsx`
- Create: `src/lib/comment-spoiler-surfaces.test.ts`

**Interfaces:**
- Consumes: `CommentBodyText` from Task 2.
- Produces: `CommentSpoilerHint()` and public spoiler rendering for non-removed comments.

- [ ] **Step 1: Write the failing surface-wiring tests**

```ts
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const thread = readFileSync("src/components/comment-thread.tsx", "utf8");
const form = readFileSync("src/components/comment-form.tsx", "utf8");
const actions = readFileSync("src/components/comment-actions.tsx", "utf8");
const hintPath = "src/components/comment-spoiler-hint.tsx";
const hint = existsSync(hintPath) ? readFileSync(hintPath, "utf8") : "";
const moderation = readFileSync("src/app/admin/moderacao/page.tsx", "utf8");

test("public non-removed comments delegate body rendering to CommentBodyText", () => {
  assert.match(thread, /import \{ CommentBodyText \}/);
  assert.match(thread, /removed[\s\S]*Comentario removido pelo administrador\.[\s\S]*CommentBodyText/);
  assert.match(thread, /<CommentBodyText key=\{comment\.body\} body=\{comment\.body\} \/>/);
});

test("new reply and edit forms explain the spoiler syntax", () => {
  assert.ok(existsSync(hintPath), "shared spoiler hint is required");
  assert.match(hint, /Use \[spoiler\]texto\[\/spoiler\] para ocultar spoilers\./);
  assert.match(form, /<textarea[\s\S]*?\/>\s*<CommentSpoilerHint \/>/);
  assert.match(actions, /<textarea[\s\S]*?\/>\s*<CommentSpoilerHint \/>/);
});

test("administrative moderation keeps the raw body", () => {
  assert.match(moderation, /\{comment\.body\}/);
  assert.doesNotMatch(moderation, /CommentBodyText/);
});
```

- [ ] **Step 2: Run the surface test and verify RED**

Run: `npx tsx --test src/lib/comment-spoiler-surfaces.test.ts`

Expected: FAIL because the hint component does not exist and the thread still renders `comment.body` directly.

- [ ] **Step 3: Create the shared hint**

```tsx
export function CommentSpoilerHint() {
  return (
    <p className="text-xs text-zinc-400">
      Use <code className="rounded bg-black/50 px-1 py-0.5 text-zinc-300">[spoiler]texto[/spoiler]</code> para ocultar spoilers.
    </p>
  );
}
```

- [ ] **Step 4: Add the hint after both textarea implementations**

Import `CommentSpoilerHint` in `comment-form.tsx` and `comment-actions.tsx`. Render `<CommentSpoilerHint />` immediately after the textarea in each file. Because `CommentForm` is shared by root comments and compact replies, this covers all three approved authoring surfaces.

- [ ] **Step 5: Delegate public body rendering without changing removed comments**

Import `CommentBodyText` in `comment-thread.tsx` and replace the body paragraph in `CommentBody` with:

```tsx
{removed ? (
  <p className="mt-1 whitespace-pre-wrap italic text-zinc-500">
    Comentario removido pelo administrador.
  </p>
) : (
  <CommentBodyText key={comment.body} body={comment.body} />
)}
```

- [ ] **Step 6: Run all spoiler tests**

Run: `npx tsx --test src/lib/comment-spoilers.test.ts src/lib/comment-spoiler-component.test.ts src/lib/comment-spoiler-surfaces.test.ts`

Expected: 12 tests PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/components/comment-spoiler-hint.tsx src/components/comment-thread.tsx src/components/comment-form.tsx src/components/comment-actions.tsx src/lib/comment-spoiler-surfaces.test.ts
git commit -m "feat: show spoiler controls in comment surfaces"
```

### Task 4: Verify the completed feature

**Files:**
- Verify only; modify spoiler feature files only if a check exposes a defect.

**Interfaces:**
- Consumes: all outputs from Tasks 1–3.
- Produces: current verification evidence for the complete implementation.

- [ ] **Step 1: Run the entire test suite**

Run: `npm test`

Expected: all tests PASS with exit code 0.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: exit code 0 with no ESLint errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Next.js compilation, TypeScript, page generation, and finalization complete with exit code 0.

- [ ] **Step 4: Audit the final branch**

Run: `git diff --check && git status --short && git log --oneline -5`

Expected: no whitespace errors; only intended spoiler files are committed; the user's pre-existing `.vscode/` remains untouched in the original checkout.
