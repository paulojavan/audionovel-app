import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { commentSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const limited = await enforceRateLimit({ key: `comments:${auth.user.id}`, limit: 12, windowMs: 60_000 });
  if (limited) return limited;

  const parsed = commentSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Comentario invalido." }, { status: 400 });

  const parent = parsed.data.parentId
    ? await prisma.comment.findUnique({
        where: { id: parsed.data.parentId },
        select: {
          id: true,
          userId: true,
          novelId: true,
          chapterId: true,
          parentId: true,
          novel: { select: { title: true, slug: true } },
          chapter: {
            select: {
              id: true,
              title: true,
              volume: { select: { novel: { select: { title: true, slug: true } } } },
            },
          },
        },
      })
    : null;

  if (parsed.data.parentId && !parent) {
    return NextResponse.json({ error: "Comentario original nao encontrado." }, { status: 404 });
  }

  if (parent?.parentId) {
    return NextResponse.json({ error: "Responda apenas comentarios principais." }, { status: 400 });
  }

  if (parent && (parent.novelId !== (parsed.data.novelId ?? null) || parent.chapterId !== (parsed.data.chapterId ?? null))) {
    return NextResponse.json({ error: "A resposta nao pertence a este conteudo." }, { status: 400 });
  }

  const [novel, chapter] = await Promise.all([
    parsed.data.novelId
      ? prisma.novel.findUnique({ where: { id: parsed.data.novelId }, select: { id: true, title: true, slug: true } })
      : Promise.resolve(null),
    parsed.data.chapterId
      ? prisma.chapter.findUnique({
          where: { id: parsed.data.chapterId },
          select: { id: true, title: true, volume: { select: { novel: { select: { title: true, slug: true } } } } },
        })
      : Promise.resolve(null),
  ]);

  if (parsed.data.novelId && !novel) return NextResponse.json({ error: "Novel nao encontrada." }, { status: 404 });
  if (parsed.data.chapterId && !chapter) return NextResponse.json({ error: "Capitulo nao encontrado." }, { status: 404 });

  const comment = await prisma.comment.create({
    data: {
      body: parsed.data.body,
      status: "PENDING",
      userId: auth.user.id,
      novelId: parsed.data.novelId,
      chapterId: parsed.data.chapterId,
      parentId: parent?.id,
    },
    include: { user: { select: { name: true } } },
  });

  return NextResponse.json(comment, { status: 201 });
}
