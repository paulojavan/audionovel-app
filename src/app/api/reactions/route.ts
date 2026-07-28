import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { reactionSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const limited = await enforceRateLimit({ key: `reactions:${auth.user.id}`, limit: 80, windowMs: 60_000 });
  if (limited) return limited;

  const parsed = reactionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  if (parsed.data.target === "novel") {
    const found = await refreshNovelScore(auth.user.id, parsed.data.targetId, parsed.data.rating ?? 5);
    if (!found) return NextResponse.json({ error: "Novel nao encontrada." }, { status: 404 });
  } else {
    const type = parsed.data.type ?? "LIKE";
    const found = await refreshChapterScore(auth.user.id, parsed.data.targetId, type);
    if (!found) return NextResponse.json({ error: "Capitulo nao encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

async function refreshNovelScore(userId: string, novelId: string, rating: number) {
  return prisma.$transaction(async (tx) => {
    const target = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Novel" WHERE "id" = ${novelId} FOR UPDATE
    `;
    if (!target.length) return false;

    await tx.novelReaction.upsert({
      where: { userId_novelId: { userId, novelId } },
      create: { userId, novelId, type: "RATING", rating },
      update: { type: "RATING", rating },
    });
    const aggregate = await tx.novelReaction.aggregate({
      where: { novelId },
      _avg: { rating: true },
      _count: { rating: true },
    });
    const ratingCount = aggregate._count.rating;
    await tx.novel.update({
      where: { id: novelId },
      data: {
        likeCount: ratingCount,
        dislikeCount: 0,
        ratingScore: aggregate._avg.rating ?? 0,
        ratingCount,
      },
    });
    return true;
  });
}

async function refreshChapterScore(userId: string, chapterId: string, type: "LIKE" | "DISLIKE") {
  return prisma.$transaction(async (tx) => {
    const target = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Chapter" WHERE "id" = ${chapterId} FOR UPDATE
    `;
    if (!target.length) return false;

    await tx.chapterReaction.upsert({
      where: { userId_chapterId: { userId, chapterId } },
      create: { userId, chapterId, type },
      update: { type },
    });
    const [likes, dislikes] = await Promise.all([
      tx.chapterReaction.count({ where: { chapterId, type: "LIKE" } }),
      tx.chapterReaction.count({ where: { chapterId, type: "DISLIKE" } }),
    ]);
    await tx.chapter.update({
      where: { id: chapterId },
      data: { likeCount: likes, dislikeCount: dislikes },
    });
    return true;
  });
}
