import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { canPlayChapter } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, getRequestIdentifier } from "@/lib/rate-limit";
import { isSafePublicHttpsUrl } from "@/lib/url-security";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  const session = await getServerSession(authOptions);
  const access = await canPlayChapter(id, session?.user?.id);

  if (!access.allowed || !access.chapter) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  if (access.chapter.contentType !== "AUDIO" || !access.chapter.audioUrl) {
    return NextResponse.json({ error: "Este capitulo nao possui audio hospedado." }, { status: 400 });
  }

  const limited = enforceRateLimit({
    key: `audio:${id}:${getRequestIdentifier(request, session?.user?.id)}`,
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  if (!isSafePublicHttpsUrl(access.chapter.audioUrl)) {
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

  await prisma.chapter.update({
    where: { id },
    data: {
      viewCount: { increment: 1 },
      volume: { update: { novel: { update: { viewCount: { increment: 1 } } } } },
    },
  });

  const range = request.headers.get("range");
  const upstream = await fetch(access.chapter.audioUrl, {
    headers: range ? { range } : {},
    cache: "no-store",
  });

  if (!upstream.ok || !upstream.body) {
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

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
