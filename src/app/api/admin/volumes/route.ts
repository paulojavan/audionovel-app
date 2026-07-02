import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/api";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";

const volumeSchema = z.object({
  novelId: z.string().min(1),
  title: z.string().trim().min(2).max(160),
  position: z.number().int().min(1),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = volumeSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  try {
    const volume = await prisma.volume.create({ data: parsed.data });
    revalidateTag(CACHE_TAGS.content, "max");
    return NextResponse.json(volume, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Volume duplicado ou novel inexistente." }, { status: 409 });
  }
}
