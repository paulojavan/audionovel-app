import Image from "next/image";
import Link from "next/link";
import { Plus, Search, X } from "lucide-react";
import { getTotalStoredChapterCount } from "@/lib/chapter-count";
import { prisma } from "@/lib/prisma";

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim();
  const novels = await prisma.novel.findMany({
    where: query
      ? {
          OR: [
            { title: { contains: query } },
            { author: { contains: query } },
            { slug: { contains: query } },
            { synopsis: { contains: query } },
          ],
        }
      : undefined,
    orderBy: { updatedAt: "desc" },
    include: { volumes: { include: { chapters: true } }, tags: { include: { tag: true } } },
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Novels cadastradas</h2>
          <p className="mt-1 text-sm text-zinc-400">Clique em uma novel para abrir o painel dela.</p>
        </div>
        <Link href="/admin/conteudo/novo" className="flex items-center gap-2 rounded-full bg-[#18b7bd] px-5 py-3 font-black text-[#021114]">
          <Plus size={18} />
          Cadastrar novel
        </Link>
      </div>

      <form className="flex flex-col gap-2 rounded-lg bg-[#06272b] p-3 sm:flex-row" action="/admin/conteudo">
        <label className="relative min-w-0 flex-1">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Pesquisar por título, autor ou sinopse"
            className="w-full rounded-md border border-white/10 bg-black py-3 pl-10 pr-4 outline-none focus:border-[#18b7bd]"
          />
        </label>
        <button className="rounded-full bg-[#18b7bd] px-5 py-3 font-black text-[#021114] hover:bg-[#22d3dc]" type="submit">
          Pesquisar
        </button>
        {query ? (
          <Link href="/admin/conteudo" className="flex items-center justify-center gap-2 rounded-full border border-white/10 px-5 py-3 font-bold hover:bg-white/10">
            <X size={16} />
            Limpar
          </Link>
        ) : null}
      </form>

      <div className="grid gap-3">
        {novels.length ? (
          novels.map((novel) => {
            const chapterCount = novel.volumes.reduce((sum, volume) => sum + getTotalStoredChapterCount(volume.chapters), 0);
            const premiumCount = novel.volumes.reduce(
              (sum, volume) => sum + volume.chapters.filter((chapter) => chapter.premiumOnly).length,
              0,
            );

            return (
              <Link
                key={novel.id}
                href={`/admin/conteudo/${novel.id}`}
                className="grid gap-4 rounded-lg bg-[#06272b] p-3 hover:bg-[#08353a] md:grid-cols-[96px_1fr_auto]"
              >
                <Image src={novel.coverUrl} alt="" width={192} height={192} className="aspect-square w-24 rounded-md object-cover" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-black">{novel.title}</h3>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">{novel.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-400">{novel.author}</p>
                  {novel.tags.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {novel.tags.map(({ tag }) => (
                        <span key={tag.id} className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-zinc-300">
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-3 line-clamp-2 text-sm text-zinc-300">{novel.synopsis}</p>
                </div>
                <div className="grid content-center gap-1 text-sm text-zinc-300 md:text-right">
                  <span>{novel.volumes.length} volumes</span>
                  <span>{chapterCount} capítulos</span>
                  <span>{premiumCount} premium</span>
                  <span>{novel.viewCount} views</span>
                </div>
              </Link>
            );
          })
        ) : (
          <div className="rounded-lg bg-[#06272b] p-6 text-zinc-400">
            {query ? `Nenhuma novel encontrada para "${query}".` : "Nenhuma novel cadastrada ainda."}
          </div>
        )}
      </div>
    </div>
  );
}
