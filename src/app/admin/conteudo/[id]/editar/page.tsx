import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminNovelEditForm } from "@/components/admin-content-forms";
import { ADMIN_EDIT_NOVEL_SELECT } from "@/lib/page-data-select";
import { prisma } from "@/lib/prisma";

export default async function EditNovelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [novel, tags, novels] = await Promise.all([
    prisma.novel.findUnique({
      where: { id },
      select: ADMIN_EDIT_NOVEL_SELECT,
    }),
    prisma.tag.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    prisma.novel.findMany({
      where: { id: { not: id } },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  if (!novel) notFound();

  const backHref = `/admin/conteudo/${novel.id}`;

  return (
    <div className="grid gap-5">
      <Link href={backHref} className="text-sm font-bold text-[#18b7bd]">
        Voltar para {novel.title}
      </Link>
      <AdminNovelEditForm
        backHref={backHref}
        tags={tags}
        novels={novels}
        novel={{
          id: novel.id,
          title: novel.title,
          author: novel.author,
          synopsis: novel.synopsis,
          coverUrl: novel.coverUrl,
          status: novel.status,
          continuationId: novel.continuationId,
          tagIds: novel.tags.map((item) => item.tagId),
        }}
      />
    </div>
  );
}
