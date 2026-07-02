import { NextResponse } from "next/server";
import { canPlayChapter } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, getRequestIdentifier } from "@/lib/rate-limit";
import { getActiveServerSession } from "@/lib/safe-auth-session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getActiveServerSession();
  const { id } = await context.params;
  const limited = await enforceRateLimit({
    key: `chapter-view:${getRequestIdentifier(request, session?.user?.id)}:${id}`,
    limit: 4,
    windowMs: 60 * 60_000,
  });
  if (limited) return limited;

  const access = await canPlayChapter(id, session?.user?.id);
  if (!access.allowed || !access.chapter) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  await prisma.chapter.update({
    where: { id },
    data: {
      viewCount: { increment: 1 },
      volume: { update: { novel: { update: { viewCount: { increment: 1 } } } } },
    },
  });

  return NextResponse.json({ ok: true });
}
