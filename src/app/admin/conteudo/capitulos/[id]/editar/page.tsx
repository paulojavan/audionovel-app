import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminChapterEditForm } from "@/components/admin-content-forms";
import { prisma } from "@/lib/prisma";

export default async function EditChapterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chapter = await prisma.chapter.findUnique({
    where: { id },
    include: {
      volume: {
        include: {
          novel: {
            include: {
              volumes: { orderBy: { position: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!chapter) notFound();

  const backHref = `/admin/conteudo/${chapter.volume.novel.id}`;

  return (
    <div className="grid gap-5">
      <Link href={backHref} className="text-sm font-bold text-[#18b7bd]">
        Voltar para {chapter.volume.novel.title}
      </Link>
      <div>
        <p className="text-sm uppercase text-zinc-400">Capítulo</p>
        <h2 className="text-3xl font-black">{chapter.title}</h2>
      </div>
      <AdminChapterEditForm chapter={chapter} volumes={chapter.volume.novel.volumes} backHref={backHref} />
    </div>
  );
}
