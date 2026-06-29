import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/api";
import { CACHE_TAGS } from "@/lib/cache-tags";
import {
  getNovelContinuationErrorMessage,
  validateNovelContinuation,
} from "@/lib/novel-continuation";
import { prisma } from "@/lib/prisma";
import { isSafePublicHttpsUrl } from "@/lib/url-security";

const novelUpdateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  author: z.string().trim().min(2).max(120),
  synopsis: z.string().trim().min(10).max(4000),
  coverUrl: z.string().url().refine((value) => isSafePublicHttpsUrl(value), "Use uma URL HTTPS publica permitida."),
  status: z.string().trim().default("ONGOING"),
  tagIds: z.array(z.string()).max(30).optional().default([]),
  continuationId: z.string().trim().min(1).nullable().optional().default(null),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  const parsed = novelUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });

  const tagIds = Array.from(new Set(parsed.data.tagIds));

  try {
    const continuationError = validateNovelContinuation(
      id,
      parsed.data.continuationId,
      await prisma.novel.findMany({
        select: { id: true, continuationId: true },
      }),
    );
    if (continuationError) {
      return NextResponse.json(
        { error: getNovelContinuationErrorMessage(continuationError) },
        { status: 400 },
      );
    }

    const novel = await prisma.novel.update({
      where: { id },
      data: {
        title: parsed.data.title,
        author: parsed.data.author,
        synopsis: parsed.data.synopsis,
        coverUrl: parsed.data.coverUrl,
        status: parsed.data.status,
        continuationId: parsed.data.continuationId,
        tags: {
          deleteMany: {},
          create: tagIds.map((tagId) => ({ tagId })),
        },
      },
      include: { tags: { include: { tag: true } } },
    });

    revalidateTag(CACHE_TAGS.content, "max");
    return NextResponse.json(novel);
  } catch {
    return NextResponse.json({ error: "Nao foi possivel atualizar a novel." }, { status: 409 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;

  try {
    await prisma.novel.delete({ where: { id } });
    revalidateTag(CACHE_TAGS.content, "max");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Nao foi possivel excluir a novel." }, { status: 404 });
  }
}
