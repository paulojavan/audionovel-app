import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/api";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { isSafeImageHttpsUrl } from "@/lib/url-security";

const novelSchema = z.object({
  title: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  author: z.string().trim().min(2).max(120),
  synopsis: z.string().trim().min(10).max(4000),
  coverUrl: z.string().url().refine((value) => isSafeImageHttpsUrl(value), "Use uma URL de imagem HTTPS permitida."),
  status: z.string().trim().default("ONGOING"),
  tagIds: z.array(z.string()).optional().default([]),
  continuationId: z.string().trim().min(1).nullable().optional().default(null),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = novelSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  try {
    if (parsed.data.continuationId) {
      const continuation = await prisma.novel.findUnique({
        where: { id: parsed.data.continuationId },
        select: { id: true },
      });
      if (!continuation) {
        return NextResponse.json(
          { error: "A continuação selecionada não existe." },
          { status: 400 },
        );
      }
    }

    const slug = await createUniqueSlug(parsed.data.slug ?? parsed.data.title);
    const { tagIds, ...novelData } = parsed.data;
    const novel = await prisma.novel.create({
      data: {
        ...novelData,
        slug,
        tags: tagIds.length ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
      },
    });
    revalidateTag(CACHE_TAGS.content, "max");
    return NextResponse.json(novel, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Não foi possível cadastrar a novel." }, { status: 409 });
  }
}

async function createUniqueSlug(value: string) {
  const base = slugify(value, { fallback: "novel", maxLength: 170 });
  let slug = base;
  let suffix = 2;

  while (await prisma.novel.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}
