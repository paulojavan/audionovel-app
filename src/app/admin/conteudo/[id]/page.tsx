import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminNovelPanelForms } from "@/components/admin-content-forms";
import { AdminDeleteButton } from "@/components/admin-delete-button";
import { AdminVolumeAccordion } from "@/components/admin-volume-accordion";
import { getNextChapterPosition } from "@/lib/admin-chapter-sequence";
import { getTotalStoredChapterCount } from "@/lib/chapter-count";
import { prisma } from "@/lib/prisma";

export default async function AdminNovelPanelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const novel = await prisma.novel.findUnique({
    where: { id },
    include: {
      volumes: {
        orderBy: { position: "asc" },
        include: { chapters: { orderBy: { position: "asc" } } },
      },
      tags: { include: { tag: true } },
    },
  });

  if (!novel) notFound();

  const chapterCount = novel.volumes.reduce((sum, volume) => sum + getTotalStoredChapterCount(volume.chapters), 0);

  return (
    <div className="grid gap-8">
      <Link href="/admin/conteudo" className="text-sm font-bold text-[#18b7bd]">
        Voltar para novels cadastradas
      </Link>

      <section className="grid gap-5 rounded-lg bg-[#06272b] p-4 md:grid-cols-[180px_1fr]">
        <Image src={novel.coverUrl} alt="" width={360} height={360} className="aspect-square w-full max-w-48 rounded-md object-cover" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-3xl font-black">{novel.title}</h2>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">{novel.status}</span>
          </div>
          <p className="mt-2 text-zinc-400">{novel.author}</p>
          {novel.tags.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {novel.tags.map((item) => (
                <span key={item.tagId} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-zinc-200">
                  {item.tag.name}
                </span>
              ))}
            </div>
          ) : null}
          <p className="mt-4 max-w-3xl text-zinc-300">{novel.synopsis}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold">
            <Link href={`/admin/conteudo/${novel.id}/editar`} className="rounded-full bg-[#18b7bd] px-4 py-2 text-[#021114]">
              Editar novel
            </Link>
            <AdminDeleteButton
              endpoint={`/api/admin/novels/${novel.id}`}
              label="Excluir novel"
              confirmMessage={`Excluir definitivamente a novel "${novel.title}" e todo o conteudo dela?`}
              redirectTo="/admin/conteudo"
            />
            <a href="#novo-conteudo" className="rounded-full border border-white/10 px-4 py-2 hover:bg-white/10">Cadastrar conteudo</a>
            <Link href={`/novels/${novel.slug}`} className="rounded-full border border-white/10 px-4 py-2 hover:bg-white/10">Ver pagina publica</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <Metric label="Volumes" value={novel.volumes.length.toString()} />
        <Metric label="Capitulos" value={chapterCount.toString()} />
        <Metric label="Views" value={novel.viewCount.toString()} />
        <Metric label="Nota media" value={novel.ratingCount ? `${novel.ratingScore.toFixed(1)} (${novel.ratingCount})` : "Sem notas"} />
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-bold">Volumes e capitulos</h2>
        <AdminVolumeAccordion
          volumes={novel.volumes.map((volume) => ({
            id: volume.id,
            title: volume.title,
            position: volume.position,
            chapters: volume.chapters.map((chapter) => ({
              id: chapter.id,
              title: chapter.title,
              position: chapter.position,
              positionEnd: chapter.positionEnd,
              contentType: chapter.contentType,
              durationSec: chapter.durationSec,
              premiumOnly: chapter.premiumOnly,
              createdAt: chapter.createdAt.toISOString(),
            })),
          }))}
        />
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-bold">Adicionar conteudo nesta novel</h2>
        <AdminNovelPanelForms
          novelId={novel.id}
          volumes={novel.volumes.map((volume) => ({
            id: volume.id,
            title: volume.title,
            position: volume.position,
            nextChapterPosition: getNextChapterPosition(volume.chapters),
          }))}
        />
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#06272b] p-4">
      <p className="text-sm font-bold text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}
