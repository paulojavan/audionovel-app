import { NextResponse } from "next/server";
import { canPlayChapter } from "@/lib/api";
import { openAudioUpstream } from "@/lib/audio-upstream";
import { prisma } from "@/lib/prisma";
import { CHAPTER_MEDIA_SOURCE_SELECT } from "@/lib/page-data-select";
import { enforceRateLimit, getRequestIdentifier } from "@/lib/rate-limit";
import {
  createResumableAudioStream,
  isSafeAudioPassThroughResponse,
} from "@/lib/resumable-audio-stream";
import { getActiveServerSession } from "@/lib/safe-auth-session";
import { isSafeMediaHttpsUrl } from "@/lib/url-security";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  const session = await getActiveServerSession();
  const access = await canPlayChapter(id, session?.user?.id);

  if (!access.allowed || !access.chapter) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  const media = await prisma.chapter.findUnique({
    where: { id, published: true },
    select: CHAPTER_MEDIA_SOURCE_SELECT,
  });

  if (!media || media.contentType !== "AUDIO" || !media.audioUrl) {
    return NextResponse.json({ error: "Este capitulo nao possui audio hospedado." }, { status: 400 });
  }
  const audioUrl = media.audioUrl;

  const limited = await enforceRateLimit({
    key: `audio:${id}:${getRequestIdentifier(request, session?.user?.id)}`,
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  if (!isSafeMediaHttpsUrl(audioUrl)) {
    return NextResponse.json({ error: "URL de audio invalida ou nao permitida." }, { status: 400 });
  }

  const offlineKey = new URL(request.url).searchParams.get("offline");
  if (offlineKey) {
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Autenticacao obrigatoria para audio offline." }, { status: 401 });
    }

    const offlineDownload = await prisma.offlineDownload.findFirst({
      where: {
        cacheKey: offlineKey,
        chapterId: id,
        userId: session.user.id,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (!offlineDownload) {
      return NextResponse.json({ error: "Audio offline expirado ou invalido." }, { status: 403 });
    }

    await prisma.offlineDownload.update({
      where: { id: offlineDownload.id },
      data: { lastUsedAt: new Date() },
    });
  }

  const range = request.headers.get("range");
  const initialHeaders = new Headers();
  if (range) initialHeaders.set("Range", range);

  let upstream: Response;
  try {
    upstream = await openAudioUpstream(
      audioUrl,
      initialHeaders,
      request.signal,
    );
  } catch {
    return NextResponse.json({ error: "Audio temporariamente indisponivel." }, { status: 502 });
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    await upstream.body?.cancel().catch(() => undefined);
    return NextResponse.json({ error: "Redirecionamento de audio nao permitido." }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    await upstream.body?.cancel().catch(() => undefined);
    return NextResponse.json({ error: "Áudio indisponível." }, { status: 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "audio/mpeg");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store");

  for (const header of ["content-length", "content-range"]) {
    const value = upstream.headers.get(header);
    if (value) headers.set(header, value);
  }

  let body: ReadableStream<Uint8Array>;
  try {
    body = isSafeAudioPassThroughResponse(range, upstream)
      ? upstream.body
      : createResumableAudioStream({
        initialResponse: upstream,
        requestRange: range,
        openRange: (headers, continuationSignal) =>
          openAudioUpstream(
            audioUrl,
            headers,
            AbortSignal.any([request.signal, continuationSignal]),
          ),
        maxContinuations: 2,
        downstreamSignal: request.signal,
        onFailure({ attempt, byteOffset }) {
          console.warn(JSON.stringify({
            event: "audio_upstream_interrupted",
            timestamp: new Date().toISOString(),
            attempt,
            byteOffset,
          }));
        },
      });
  } catch (error) {
    await upstream.body?.cancel(error).catch(() => undefined);
    return NextResponse.json(
      { error: "Audio temporariamente indisponivel." },
      { status: 502 },
    );
  }

  return new Response(body, {
    status: upstream.status,
    headers,
  });
}
