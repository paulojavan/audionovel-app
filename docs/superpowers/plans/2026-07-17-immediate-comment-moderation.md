# Immediate Comment Moderation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar comentários e respostas imediatamente, mantendo a revisão administrativa posterior e enviando notificações de resposta no momento da publicação.

**Architecture:** Um módulo de domínio fornecerá o conjunto único de estados públicos e outro montará notificações de resposta sem acessar o banco. As rotas usarão esses contratos dentro de uma transação Prisma; páginas e seleções passarão a incluir `PENDING`, enquanto a aprovação administrativa deixará de emitir notificações.

**Tech Stack:** Next.js 16.2.9 App Router, React 19.2.4, TypeScript 5, Prisma 6.19.3, Zod 4.4.3, Node test runner via `tsx --test`.

## Global Constraints

- `PENDING` significa público e ainda não revisado; `APPROVED` significa público e revisado; `REMOVED` permanece oculto pelo aviso existente.
- Comentários e edições válidos aparecem imediatamente.
- Respostas a outro usuário notificam imediatamente e uma única vez.
- Autenticação, bloqueio, rate limit, validação e limite de um nível de resposta permanecem obrigatórios.
- Não adicionar moderação automática, restauração, push, e-mail ou novos níveis de resposta.

---

### Task 1: Contrato único de visibilidade pública

**Files:**
- Create: `src/lib/comment-moderation.ts`
- Create: `src/lib/comment-publication.test.ts`
- Modify: `src/lib/page-data-select.ts`
- Modify: `src/app/novels/[slug]/page.tsx`
- Modify: `src/app/chapters/[id]/page.tsx`

**Interfaces:**
- Produces: `PUBLIC_COMMENT_STATUSES: ["PENDING", "APPROVED", "REMOVED"]` e `getPublicCommentStatusFilter(): { in: string[] }`.
- Consumes: Prisma `where.status` nas páginas e no relacionamento `COMMENT_THREAD_SELECT.replies`.

- [ ] **Step 1: Write the failing visibility tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { PUBLIC_COMMENT_STATUSES, getPublicCommentStatusFilter } from "./comment-moderation";

test("pending comments are public before review", () => {
  assert.deepEqual(PUBLIC_COMMENT_STATUSES, ["PENDING", "APPROVED", "REMOVED"]);
  assert.deepEqual(getPublicCommentStatusFilter(), { in: ["PENDING", "APPROVED", "REMOVED"] });
});
```

Add source assertions in the same file that both public pages import `getPublicCommentStatusFilter` and that `COMMENT_THREAD_SELECT` uses it for replies.

- [ ] **Step 2: Run the test and verify RED**

Run: `npx tsx --test src/lib/comment-publication.test.ts`

Expected: FAIL because `src/lib/comment-moderation.ts` does not exist.

- [ ] **Step 3: Implement the public status contract and wire all queries**

```ts
export const PUBLIC_COMMENT_STATUSES = ["PENDING", "APPROVED", "REMOVED"] as const;

export function getPublicCommentStatusFilter() {
  return { in: [...PUBLIC_COMMENT_STATUSES] };
}
```

Replace each literal `status: { in: ["APPROVED", "REMOVED"] }` in public comment queries and reply selection with `status: getPublicCommentStatusFilter()`.

- [ ] **Step 4: Run the directed test and verify GREEN**

Run: `npx tsx --test src/lib/comment-publication.test.ts src/lib/page-data-select.test.ts`

Expected: PASS with zero failures.

- [ ] **Step 5: Commit the visibility contract**

```powershell
git add -- 'src/lib/comment-moderation.ts' 'src/lib/comment-publication.test.ts' 'src/lib/page-data-select.ts' 'src/app/novels/[slug]/page.tsx' 'src/app/chapters/[id]/page.tsx'
git commit -m "feat: publish pending comments immediately"
```

### Task 2: Notificação atômica no momento da resposta

**Files:**
- Create: `src/lib/comment-reply-notification.ts`
- Create: `src/lib/comment-reply-notification.test.ts`
- Modify: `src/app/api/comments/route.ts`
- Modify: `src/app/api/admin/comments/[id]/route.ts`

**Interfaces:**
- Produces: `buildCommentReplyNotification(input): Prisma.NotificationUncheckedCreateInput | null` sem acesso ao banco.
- Consumes: resposta criada, autor do comentário principal e metadados de novel/capítulo já consultados pela rota.

- [ ] **Step 1: Write failing notification domain tests**

```ts
test("builds an immediate notification for a reply to another user", () => {
  assert.deepEqual(buildCommentReplyNotification({
    commentId: "reply-1",
    authorId: "author-2",
    authorName: "Bia",
    parentAuthorId: "author-1",
    targetTitle: "Novel",
    href: "/novels/novel#comment-reply-1",
  }), {
    userId: "author-1",
    commentId: "reply-1",
    title: "Seu comentario recebeu uma resposta",
    message: "Bia respondeu seu comentario em Novel.",
    href: "/novels/novel#comment-reply-1",
  });
});

test("does not notify a self reply", () => {
  assert.equal(buildCommentReplyNotification({
    commentId: "reply-1",
    authorId: "author-1",
    authorName: "Bia",
    parentAuthorId: "author-1",
    targetTitle: "Novel",
    href: "/novels/novel#comment-reply-1",
  }), null);
});
```

Add source assertions proving the public POST uses `prisma.$transaction`, creates the notification from the created comment ID, and the admin PATCH no longer calls `prisma.notification.create`.

- [ ] **Step 2: Run the tests and verify RED**

Run: `npx tsx --test src/lib/comment-reply-notification.test.ts`

Expected: FAIL because `buildCommentReplyNotification` does not exist.

- [ ] **Step 3: Implement the notification builder and transaction wiring**

```ts
export function buildCommentReplyNotification(input: ReplyNotificationInput) {
  if (!input.parentAuthorId || input.parentAuthorId === input.authorId) return null;
  return {
    userId: input.parentAuthorId,
    commentId: input.commentId,
    title: "Seu comentario recebeu uma resposta",
    message: `${input.authorName} respondeu seu comentario em ${input.targetTitle}.`,
    href: input.href,
  };
}
```

Wrap comment creation and optional notification creation in one `prisma.$transaction(async (tx) => ...)`. Remove the notification block from administrative approval so approval only updates audit fields.

- [ ] **Step 4: Run the directed tests and verify GREEN**

Run: `npx tsx --test src/lib/comment-reply-notification.test.ts src/lib/comment-publication.test.ts`

Expected: PASS with zero failures.

- [ ] **Step 5: Commit immediate notifications**

```powershell
git add -- 'src/lib/comment-reply-notification.ts' 'src/lib/comment-reply-notification.test.ts' 'src/app/api/comments/route.ts' 'src/app/api/admin/comments/[id]/route.ts'
git commit -m "feat: notify comment replies on publication"
```

### Task 3: Copy and administrative semantics

**Files:**
- Modify: `src/components/comment-form.tsx`
- Modify: `src/components/comment-actions.tsx`
- Modify: `src/app/admin/moderacao/page.tsx`
- Modify: `src/lib/comment-publication.test.ts`

**Interfaces:**
- Consumes: successful POST/PATCH responses and existing `router.refresh()` calls.
- Produces: success copy that confirms publication and admin copy that describes post-moderation.

- [ ] **Step 1: Add failing copy assertions**

```ts
assert.match(formSource, /Resposta publicada\.|Comentario publicado\./);
assert.doesNotMatch(formSource, /enviad[oa] para moderacao/i);
assert.match(actionsSource, /Comentario editado e publicado\./);
assert.match(moderationSource, /publicados aguardam revisao/i);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx tsx --test src/lib/comment-publication.test.ts`

Expected: FAIL because the current UI still says the content was sent to moderation.

- [ ] **Step 3: Update the three user-facing messages**

```ts
setMessage(parentId ? "Resposta publicada." : "Comentario publicado.");
setMessage("Comentario editado e publicado.");
```

Set the admin helper text to `Comentarios publicados aguardam revisao administrativa.` and keep the removed-tab copy unchanged.

- [ ] **Step 4: Run comment tests**

Run: `npx tsx --test src/lib/comment-publication.test.ts src/lib/comment-reply-notification.test.ts src/lib/comment-spoilers.test.ts src/lib/comment-spoiler-surfaces.test.ts src/lib/comment-spoiler-component.test.ts`

Expected: PASS with zero failures.

- [ ] **Step 5: Commit copy changes**

```powershell
git add -- 'src/components/comment-form.tsx' 'src/components/comment-actions.tsx' 'src/app/admin/moderacao/page.tsx' 'src/lib/comment-publication.test.ts'
git commit -m "fix: align comment copy with post moderation"
```

### Task 4: Verify the comment subsystem

**Files:**
- Verify only.

**Interfaces:**
- Consumes: all outputs from Tasks 1-3.
- Produces: evidence that comment behavior and repository checks remain valid.

- [ ] **Step 1: Run all comment-directed tests**

Run: `npx tsx --test src/lib/comment-*.test.ts src/lib/page-data-select.test.ts`

Expected: PASS with zero failures.

- [ ] **Step 2: Run type-aware lint on changed files**

Run: `npx eslint src/lib/comment-moderation.ts src/lib/comment-publication.test.ts src/lib/comment-reply-notification.ts src/lib/comment-reply-notification.test.ts src/lib/page-data-select.ts src/app/api/comments/route.ts "src/app/api/admin/comments/[id]/route.ts" "src/app/novels/[slug]/page.tsx" "src/app/chapters/[id]/page.tsx" src/components/comment-form.tsx src/components/comment-actions.tsx src/app/admin/moderacao/page.tsx`

Expected: exit code 0.

- [ ] **Step 3: Inspect the diff**

Run: `git diff --check HEAD~3..HEAD`

Expected: no whitespace errors.
