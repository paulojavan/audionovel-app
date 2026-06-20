import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { novelId } = (await request.json()) as { novelId?: string };
  if (!novelId) return NextResponse.json({ error: "Novel obrigatória." }, { status: 400 });

  await prisma.favorite.upsert({
    where: { userId_novelId: { userId: auth.user.id, novelId } },
    create: { userId: auth.user.id, novelId },
    update: {},
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { novelId } = (await request.json()) as { novelId?: string };
  if (!novelId) return NextResponse.json({ error: "Novel obrigatória." }, { status: 400 });

  await prisma.favorite.deleteMany({ where: { userId: auth.user.id, novelId } });
  return NextResponse.json({ ok: true });
}
