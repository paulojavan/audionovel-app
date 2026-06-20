import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminNovelEditForm } from "@/components/admin-content-forms";
import { prisma } from "@/lib/prisma";

export default async function EditNovelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [novel, tags] = await Promise.all([
    prisma.novel.findUnique({
      where: { id },
      include: {
        tags: { select: { tagId: true } },
      },
    }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
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
        novel={{
          id: novel.id,
          title: novel.title,
          author: novel.author,
          synopsis: novel.synopsis,
          coverUrl: novel.coverUrl,
          status: novel.status,
          tagIds: novel.tags.map((item) => item.tagId),
        }}
      />
    </div>
  );
}
