import { NextResponse } from "next/server";
import { openAudioUpstream } from "@/lib/audio-upstream";
import { prisma } from "@/lib/prisma";
import { CHAPTER_MEDIA_SOURCE_SELECT } from "@/lib/page-data-select";
import { checkRateLimit, getRequestIdentifier } from "@/lib/rate-limit";
import {
  createResumableAudioStream,
  isSafeAudioPassThroughResponse,
} from "@/lib/resumable-audio-stream";
import { getActiveServerSession } from "@/lib/safe-auth-session";
import { hasPremiumAccess } from "@/lib/subscription";
import { isSafeMediaHttpsUrl } from "@/lib/url-security";

type Context = {
  params: Promise<{ id: string }>;
};

// O player abre varios range requests por reproducao; lastUsedAt so precisa
// granularidade suficiente para ordenar a lista de "recentes" da area offline.
const LAST_USED_WRITE_THROTTLE_MS = 5 * 60_000;

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  const session = await getActiveServerSession();

  const media = await prisma.chapter.findUnique({
    where: { id, published: true },
    select: CHAPTER_MEDIA_SOURCE_SELECT,
  });

  if (!media) {
    return NextResponse.json({ error: "Capitulo nao encontrado." }, { status: 404 });
  }
  if (media.premiumOnly && !session?.user?.id) {
    return NextResponse.json({ error: "Faca login para ouvir este capitulo." }, { status: 401 });
  }
  if (media.premiumOnly && !hasPremiumAccess(session?.user)) {
    return NextResponse.json({ error: "Capitulo disponivel apenas para premium." }, { status: 402 });
  }
  if (media.contentType !== "AUDIO" || !media.audioUrl) {
    return NextResponse.json({ error: "Este capitulo nao possui audio hospedado." }, { status: 400 });
  }
  const audioUrl = media.audioUrl;

  // Range requests fazem parte do streaming normal. Um contador em memoria
  // evita uma escrita no PostgreSQL para cada chunk; o proxy/CDN deve aplicar
  // o limite distribuido de borda em producao.
  const rateLimit = checkRateLimit({
    key: `audio:${id}:${getRequestIdentifier(request, session?.user?.id)}`,
    limit: 240,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Muitas requisicoes de audio. Aguarde um pouco." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } },
    );
  }

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
      select: { id: true, lastUsedAt: true },
    });

    if (!offlineDownload) {
      return NextResponse.json({ error: "Audio offline expirado ou invalido." }, { status: 403 });
    }

    // Gravar lastUsedAt em todo range request gerava uma escrita por chunk de
    // streaming. Uma escrita por janela mantem a ordenacao de recentes sem
    // pressionar o pool de conexoes.
    if (Date.now() - offlineDownload.lastUsedAt.getTime() > LAST_USED_WRITE_THROTTLE_MS) {
      await prisma.offlineDownload.update({
        where: { id: offlineDownload.id },
        data: { lastUsedAt: new Date() },
      });
    }
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
        maxContinuations: 12,
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
