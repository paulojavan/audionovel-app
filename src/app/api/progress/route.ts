import { NextResponse } from "next/server";
import { canPlayChapter, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { progressSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const limited = await enforceRateLimit({ key: `progress:${auth.user.id}`, limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  const parsed = progressSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const access = await canPlayChapter(parsed.data.chapterId, auth.user.id);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const progress = await prisma.listeningProgress.upsert({
    where: { userId_chapterId: { userId: auth.user.id, chapterId: parsed.data.chapterId } },
    create: { userId: auth.user.id, ...parsed.data },
    update: {
      positionSec: parsed.data.positionSec,
      durationSec: parsed.data.durationSec,
      completed: parsed.data.completed ? true : undefined,
    },
  });

  return NextResponse.json(progress);
}
