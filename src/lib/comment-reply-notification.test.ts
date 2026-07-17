import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { buildCommentReplyNotification } from "./comment-reply-notification";

const createRouteSource = readFileSync(
  join(process.cwd(), "src", "app", "api", "comments", "route.ts"),
  "utf8",
);
const moderationRouteSource = readFileSync(
  join(
    process.cwd(),
    "src",
    "app",
    "api",
    "admin",
    "comments",
    "[id]",
    "route.ts",
  ),
  "utf8",
);

test("builds an immediate notification for a reply to another user", () => {
  assert.deepEqual(
    buildCommentReplyNotification({
      commentId: "reply-1",
      authorId: "author-2",
      authorName: "Bia",
      parentAuthorId: "author-1",
      targetTitle: "Novel",
      href: "/novels/novel#comment-reply-1",
    }),
    {
      userId: "author-1",
      commentId: "reply-1",
      title: "Seu comentario recebeu uma resposta",
      message: "Bia respondeu seu comentario em Novel.",
      href: "/novels/novel#comment-reply-1",
    },
  );
});

test("does not notify a self reply or a root comment", () => {
  const input = {
    commentId: "reply-1",
    authorId: "author-1",
    authorName: "Bia",
    targetTitle: "Novel",
    href: "/novels/novel#comment-reply-1",
  };

  assert.equal(
    buildCommentReplyNotification({ ...input, parentAuthorId: "author-1" }),
    null,
  );
  assert.equal(
    buildCommentReplyNotification({ ...input, parentAuthorId: null }),
    null,
  );
});

test("publication creates reply notifications atomically", () => {
  assert.match(createRouteSource, /prisma\.\$transaction/);
  assert.match(createRouteSource, /buildCommentReplyNotification/);
  assert.match(createRouteSource, /tx\.notification\.create/);
  assert.match(createRouteSource, /commentId:\s*comment\.id/);
});

test("administrative approval never duplicates the reply notification", () => {
  assert.doesNotMatch(moderationRouteSource, /notification\.create/);
  assert.doesNotMatch(moderationRouteSource, /COMMENT_REPLY/);
});

test("nova resposta invalida o contador de notificacoes depois do commit", () => {
  assert.match(createRouteSource, /revalidateTag\(CACHE_TAGS\.notifications, "max"\)/);
});
