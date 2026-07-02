import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/api";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

const tagSchema = z.object({
  name: z.string().trim().min(2).max(40),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = tagSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Tag invalida." }, { status: 400 });

  const slug = slugify(parsed.data.name, { fallback: "tag", maxLength: 38 });

  try {
    const tag = await prisma.tag.upsert({
      where: { slug },
      create: { name: parsed.data.name, slug },
      update: { name: parsed.data.name },
    });
    revalidateTag(CACHE_TAGS.tags, "max");
    revalidateTag(CACHE_TAGS.content, "max");
    return NextResponse.json(tag, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Nao foi possivel cadastrar a tag." }, { status: 409 });
  }
}
