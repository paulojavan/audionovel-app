import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/api";
import { volumeCreateSchema } from "@/lib/admin-volume-validation";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = volumeCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  try {
    const volume = await prisma.volume.create({ data: parsed.data });
    revalidateTag(CACHE_TAGS.content, "max");
    return NextResponse.json(volume, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Volume duplicado ou novel inexistente." }, { status: 409 });
  }
}
