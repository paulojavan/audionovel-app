import { NextResponse } from "next/server";
import { canPlayChapter, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { progressSchema } from "@/lib/validators";
import { isPlaybackComplete } from "@/lib/audio-progress";

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const limited = await enforceRateLimit({ key: `progress:${auth.user.id}`, limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  const parsed = progressSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const access = await canPlayChapter(parsed.data.chapterId, auth.user.id);
  if (!access.allowed || !access.chapter) return NextResponse.json({ error: access.reason }, { status: access.status });

  const canonicalDuration = access.chapter.durationSec;
  const durationSec = canonicalDuration > 0 ? canonicalDuration : parsed.data.durationSec;
  const positionSec = durationSec > 0 ? Math.min(parsed.data.positionSec, durationSec) : parsed.data.positionSec;
  const completed = isPlaybackComplete(positionSec, durationSec);

  const progress = await prisma.listeningProgress.upsert({
    where: { userId_chapterId: { userId: auth.user.id, chapterId: parsed.data.chapterId } },
    create: { userId: auth.user.id, chapterId: parsed.data.chapterId, positionSec, durationSec, completed },
    update: {
      // O player e a fonte da verdade: ao reouvir um capitulo concluido, os
      // novos checkpoints trazem completed=false e o novo tempo passa a valer.
      positionSec,
      durationSec,
      completed,
    },
  });

  return NextResponse.json(progress);
}
