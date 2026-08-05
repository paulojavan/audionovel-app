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
    const body = await request.json().catch(() => ({})) as { chapterIds?: unknown };
    chapterIds = normalizeRenewalChapterIds(body.chapterIds);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Capitulos invalidos." },
      { status: 400 },
    );
  }
  if (!chapterIds.length) return NextResponse.json({ items: [] });

  const now = new Date();
  const downloads = await prisma.offlineDownload.findMany({
    where: {
      userId: auth.user.id,
      chapterId: { in: chapterIds },
      chapter: {
        contentType: "AUDIO",
        published: true,
      },
    },
    select: {
      id: true,
      chapterId: true,
      createdAt: true,
      expiresAt: true,
      chapter: { select: { audioRevision: true } },
    },
    take: 100,
  });
  const grants = downloads.flatMap((download) => {
    const maximumExpiry = getOfflineLicenseExpiry(
      auth.user.premiumUntil,
      download.createdAt,
      auth.user.role,
    );
    const expiresAt = new Date(Math.min(
      download.expiresAt.getTime(),
      maximumExpiry.getTime(),
    ));
    if (
      download.expiresAt.getTime() <= now.getTime() ||
      expiresAt.getTime() <= now.getTime()
    ) return [];
    return [{
      id: download.id,
      chapterId: download.chapterId,
      audioRevision: download.chapter.audioRevision,
      cacheKey: randomBytes(24).toString("base64url"),
      expiresAt,
    }];
  });
  const grantedChapterIds = new Set(grants.map((grant) => grant.chapterId));
  const unavailableChapterIds = chapterIds.filter(
    (chapterId) => !grantedChapterIds.has(chapterId),
  );
  // As atualizacoes rodam em uma unica transacao sequencial: um Promise.all aqui
  // disparava ate 100 escritas concorrentes por request, ocupando todo o pool
  // de conexoes e derrubando o banco (P2037) nos horarios de pico.
  await prisma.$transaction(
    [
      ...grants.map(({ id, cacheKey, expiresAt }) =>
        prisma.offlineDownload.update({
          where: { id },
          data: { cacheKey, expiresAt, lastUsedAt: now },
        }),
      ),
      ...(unavailableChapterIds.length ? [
        prisma.offlineDownload.deleteMany({
          where: {
            userId: auth.user.id,
            chapterId: { in: unavailableChapterIds },
          },
        }),
      ] : []),
    ],
  );
  const items = grants.map(({ chapterId, audioRevision, cacheKey, expiresAt }) => ({
    chapterId,
    cacheKey,
    expiresAt: expiresAt.toISOString(),
    audioRevision,
    audioUrl: getChapterAudioPath(chapterId, audioRevision, cacheKey),
  }));

  return NextResponse.json({ items });
}
