import { NextResponse } from "next/server";
import { canPlayChapterAudioRevision } from "@/lib/api";
import { getChapterAudioPath } from "@/lib/audio-revision";
import { enforceRateLimit, getRequestIdentifier } from "@/lib/rate-limit";
import { getActiveServerSession } from "@/lib/safe-auth-session";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  const session = await getActiveServerSession();
  const limited = await enforceRateLimit({
    key: `audio-revision:${id}:${getRequestIdentifier(request, session?.user?.id)}`,
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const access = await canPlayChapterAudioRevision(id, session?.user?.id);

  if (!access.allowed || !access.chapter) {
    return NextResponse.json(
      { error: access.reason },
      { status: access.status },
    );
  }
  if (access.chapter.contentType !== "AUDIO") {
    return NextResponse.json(
      { error: "Este capitulo nao possui audio hospedado." },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      audioRevision: access.chapter.audioRevision,
      src: getChapterAudioPath(id, access.chapter.audioRevision),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
