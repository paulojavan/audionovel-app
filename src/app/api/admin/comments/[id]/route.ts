import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const moderationSchema = z.object({
  action: z.enum(["APPROVE", "REMOVE"]),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  const parsed = moderationSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Acao invalida." }, { status: 400 });

  const comment = await prisma.comment.findUnique({
    where: { id },
    include: {
      user: { select: { name: true } },
      parent: { select: { id: true, userId: true } },
      novel: { select: { title: true, slug: true } },
      chapter: {
        select: {
          id: true,
          title: true,
          volume: { select: { novel: { select: { title: true, slug: true } } } },
        },
      },
    },
  });

  if (!comment) return NextResponse.json({ error: "Comentario nao encontrado." }, { status: 404 });

  if (parsed.data.action === "REMOVE") {
    await prisma.comment.update({
      where: { id },
      data: {
        status: "REMOVED",
        removedAt: new Date(),
        moderatedByAdminId: auth.user.id,
      },
    });
    return NextResponse.json({ ok: true });
  }

  await prisma.comment.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      removedAt: null,
      moderatedByAdminId: auth.user.id,
    },
  });

  if (comment.parent && comment.parent.userId !== comment.userId) {
    const targetTitle = comment.novel?.title ?? comment.chapter?.volume.novel.title ?? "comentario";
    const href = comment.novel ? `/novels/${comment.novel.slug}#comment-${comment.id}` : `/chapters/${comment.chapter?.id}#comment-${comment.id}`;

    const existingNotification = await prisma.notification.findFirst({
      where: { userId: comment.parent.userId, commentId: comment.id, type: "COMMENT_REPLY" },
      select: { id: true },
    });

    if (!existingNotification) {
      await prisma.notification.create({
        data: {
          userId: comment.parent.userId,
          commentId: comment.id,
          title: "Seu comentario recebeu uma resposta",
          message: `${comment.user.name} respondeu seu comentario em ${targetTitle}.`,
          href,
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
