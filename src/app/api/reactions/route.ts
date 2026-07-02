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

  const parsed = reactionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  if (parsed.data.target === "novel") {
    await prisma.novelReaction.upsert({
      where: { userId_novelId: { userId: auth.user.id, novelId: parsed.data.targetId } },
      create: { userId: auth.user.id, novelId: parsed.data.targetId, type: "RATING", rating: parsed.data.rating ?? 5 },
      update: { type: "RATING", rating: parsed.data.rating ?? 5 },
    });
    await refreshNovelScore(parsed.data.targetId);
  } else {
    const type = parsed.data.type ?? "LIKE";
    await prisma.chapterReaction.upsert({
      where: { userId_chapterId: { userId: auth.user.id, chapterId: parsed.data.targetId } },
      create: { userId: auth.user.id, chapterId: parsed.data.targetId, type },
      update: { type },
    });
    await refreshChapterScore(parsed.data.targetId);
  }

  return NextResponse.json({ ok: true });
}

async function refreshNovelScore(novelId: string) {
  const aggregate = await prisma.novelReaction.aggregate({
    where: { novelId },
    _avg: { rating: true },
    _count: { rating: true },
  });
  const ratingCount = aggregate._count.rating;
  const ratingAverage = aggregate._avg.rating ?? 0;

  await prisma.novel.update({
    where: { id: novelId },
    data: {
      likeCount: ratingCount,
      dislikeCount: 0,
      ratingScore: ratingAverage,
      ratingCount,
    },
  });
}

async function refreshChapterScore(chapterId: string) {
  const [likes, dislikes] = await Promise.all([
    prisma.chapterReaction.count({ where: { chapterId, type: "LIKE" } }),
    prisma.chapterReaction.count({ where: { chapterId, type: "DISLIKE" } }),
  ]);
  await prisma.chapter.update({
    where: { id: chapterId },
    data: { likeCount: likes, dislikeCount: dislikes },
  });
}
