import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { commentEditSchema } from "@/lib/validators";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const parsed = commentEditSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Comentario invalido." }, { status: 400 });

  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true },
  });

  if (!comment) return NextResponse.json({ error: "Comentario nao encontrado." }, { status: 404 });
  if (comment.userId !== auth.user.id) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  if (comment.status === "REMOVED") return NextResponse.json({ error: "Comentario removido nao pode ser editado." }, { status: 400 });

  const updated = await prisma.comment.update({
    where: { id },
    data: {
      body: parsed.data.body,
      status: "PENDING",
      editedAt: new Date(),
      approvedAt: null,
      moderatedByAdminId: null,
    },
  });

  return NextResponse.json(updated);
}
