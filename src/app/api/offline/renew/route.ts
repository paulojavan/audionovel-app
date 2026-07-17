import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { getChapterAudioPath } from "@/lib/audio-revision";
import { getOfflineLicenseExpiry } from "@/lib/offline-license";
import { normalizeRenewalChapterIds } from "@/lib/offline-renewal";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { hasPremiumAccess } from "@/lib/subscription";

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const limited = await enforceRateLimit({
    key: `offline-renew:${auth.user.id}`,
    limit: 12,
    windowMs: 60 * 60_000,
  });
  if (limited) return limited;
  if (!hasPremiumAccess(auth.user)) {
    return NextResponse.json(
      { error: "Ouvir offline esta disponivel apenas para usuarios premium." },
      { status: 402 },
    );
  }

  let chapterIds: string[];
  try {
    const body = await request.json() as { chapterIds?: unknown };
    chapterIds = normalizeRenewalChapterIds(body.chapterIds);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Capitulos invalidos." },
      { status: 400 },
    );
  }
  if (!chapterIds.length) return NextResponse.json({ items: [] });

  const chapters = await prisma.chapter.findMany({
    where: {
      id: { in: chapterIds },
      contentType: "AUDIO",
      published: true,
    },
    select: { id: true, audioRevision: true },
    take: 100,
  });
  const now = new Date();
  const expiresAt = getOfflineLicenseExpiry(
    auth.user.premiumUntil,
    now,
    auth.user.role,
  );
  const items = await Promise.all(
    chapters.map(async ({ id: chapterId, audioRevision }) => {
      const cacheKey = randomBytes(24).toString("base64url");
      await prisma.offlineDownload.upsert({
        where: { userId_chapterId: { userId: auth.user.id, chapterId } },
        create: { userId: auth.user.id, chapterId, cacheKey, expiresAt },
        update: { cacheKey, expiresAt, lastUsedAt: now },
      });
      return {
        chapterId,
        cacheKey,
        expiresAt: expiresAt.toISOString(),
        audioRevision,
        audioUrl: getChapterAudioPath(chapterId, audioRevision, cacheKey),
      };
    }),
  );

  return NextResponse.json({ items });
}
