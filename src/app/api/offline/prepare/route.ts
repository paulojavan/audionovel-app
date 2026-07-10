import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { canPlayChapter, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getOfflineLicenseExpiry } from "@/lib/offline-license";
import { hasPremiumAccess } from "@/lib/subscription";

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const limited = await enforceRateLimit({ key: `offline:${auth.user.id}`, limit: 30, windowMs: 60 * 60_000 });
  if (limited) return limited;

  const { chapterId } = (await request.json()) as { chapterId?: string };
  if (!chapterId) return NextResponse.json({ error: "Capítulo obrigatório." }, { status: 400 });

  if (!hasPremiumAccess(auth.user)) {
    return NextResponse.json({ error: "Ouvir offline esta disponivel apenas para usuarios premium." }, { status: 402 });
  }

  const access = await canPlayChapter(chapterId, auth.user.id);
  if (!access.allowed || !access.chapter) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  if (access.chapter.contentType !== "AUDIO") {
    return NextResponse.json({ error: "Offline criptografado esta disponivel apenas para capitulos em audio." }, { status: 400 });
  }

  const cacheKey = randomBytes(24).toString("base64url");
  const now = new Date();
  const expiresAt = getOfflineLicenseExpiry(
    auth.user.premiumUntil,
    now,
    auth.user.role,
  );

  await prisma.offlineDownload.upsert({
    where: { userId_chapterId: { userId: auth.user.id, chapterId } },
    create: { userId: auth.user.id, chapterId, cacheKey, expiresAt },
    update: { cacheKey, expiresAt, lastUsedAt: now },
  });

  return NextResponse.json({
    cacheKey,
    expiresAt,
    audioUrl: `/api/chapters/${chapterId}/audio?offline=${cacheKey}`,
  });
}
