import Image from "next/image";
import Link from "next/link";
import { Search, Star, X } from "lucide-react";
import { normalizeCatalogQuery } from "@/lib/catalog-query";
import { getCachedCatalogPage, getCachedCatalogTags } from "@/lib/public-data";

const PAGE_SIZE = 12;

export default async function NovelsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; author?: string; page?: string }>;
}) {
  const filters = normalizeCatalogQuery(await searchParams);
  const { query, currentPage, selectedTag, selectedAuthor } = filters;

  const [tags, catalog] = await Promise.all([
    getCachedCatalogTags(),
    getCachedCatalogPage(query, selectedTag, selectedAuthor, currentPage, PAGE_SIZE),
  ]);
  const { total, novels } = catalog;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="px-4 py-6 md:px-8">
      <section className="mb-6">
        <p className="text-sm font-bold uppercase text-[#18b7bd]">Catalogo</p>
        <h1 className="mt-1 text-4xl font-black">Novels</h1>
        <p className="mt-2 text-zinc-400">Pesquise por titulo, autor ou filtre por tag.</p>
      </section>

      <form className="mb-4 flex flex-col gap-2 rounded-lg bg-[#06272b] p-3 sm:flex-row" action="/novels">
        <label className="relative min-w-0 flex-1">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Pesquisar novels"
            className="w-full rounded-md border border-white/10 bg-black py-3 pl-10 pr-4 outline-none focus:border-[#18b7bd]"
          />
        </label>
        {selectedTag ? <input type="hidden" name="tag" value={selectedTag} /> : null}
        {selectedAuthor ? <input type="hidden" name="author" value={selectedAuthor} /> : null}
        <button className="rounded-full bg-white px-5 py-3 font-black text-[#021114]" type="submit">
          Pesquisar
        </button>
        {query || selectedTag || selectedAuthor ? (
          <Link href="/novels" className="flex items-center justify-center gap-2 rounded-full border border-white/10 px-5 py-3 font-bold hover:bg-white/10">
            <X size={16} />
            Limpar
          </Link>
        ) : null}
      </form>

      <div className="mb-6 flex flex-wrap gap-2">
        <TagLink active={!selectedTag} href={buildHref({ q: query, author: selectedAuthor })}>
          Todas
        </TagLink>
        {tags.map((item) => (
          <TagLink key={item.id} active={selectedTag === item.slug} href={buildHref({ q: query, tag: item.slug, author: selectedAuthor })}>
            {item.name}
          </TagLink>
        ))}
      </div>

      {selectedAuthor ? (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-md border border-[#18b7bd]/25 bg-[#18b7bd]/10 p-3">
          <span className="text-sm text-zinc-300">Mostrando obras de</span>
          <span className="font-black text-[#8ff7ff]">{selectedAuthor}</span>
          <Link href={buildHref({ q: query, tag: selectedTag })} className="ml-auto rounded-full border border-white/10 px-3 py-1 text-sm font-bold hover:bg-white/10">
            Remover autor
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {novels.length ? (
          novels.map((novel) => (
            <article key={novel.id} className="rounded-md bg-[#06272b] p-3 transition hover:bg-[#08353a]">
              <Link href={`/novels/${novel.slug}`}>
                <Image src={novel.coverUrl} alt="" width={360} height={360} className="aspect-square w-full rounded-md object-cover" />
                <h2 className="mt-3 line-clamp-2 font-bold hover:text-[#8ff7ff]">{novel.title}</h2>
              </Link>
              <Link
                href={`/novels?author=${encodeURIComponent(novel.author)}`}
                className="mt-2 inline-flex max-w-full rounded-full bg-[#18b7bd]/15 px-2.5 py-1 text-xs font-black text-[#8ff7ff] hover:bg-[#18b7bd]/25"
              >
                <span className="truncate">{novel.author}</span>
              </Link>
              <p className="mt-1 flex items-center gap-1 text-sm font-bold text-yellow-200">
                <Star size={14} fill="currentColor" /> {novel.ratingCount ? `${novel.ratingScore.toFixed(1)} (${novel.ratingCount})` : "Sem notas"}
              </p>
              {novel.tags.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {novel.tags.map(({ tag: item }) => (
                    <Link key={item.id} href={`/novels?tag=${item.slug}`} className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-bold text-zinc-300 hover:bg-white/20">
                      {item.name}
                    </Link>
                  ))}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <p className="col-span-full rounded-md bg-[#06272b] p-4 text-zinc-400">Nenhuma novel encontrada.</p>
        )}
      </div>

      <nav className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <PageLink disabled={currentPage <= 1} href={buildHref({ q: query, tag: selectedTag, author: selectedAuthor, page: currentPage - 1 })}>
          Anterior
        </PageLink>
        <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold">
          Pagina {currentPage} de {totalPages}
        </span>
        <PageLink disabled={currentPage >= totalPages} href={buildHref({ q: query, tag: selectedTag, author: selectedAuthor, page: currentPage + 1 })}>
          Proxima
        </PageLink>
      </nav>
    </div>
  );
}

function buildHref({ q, tag, author, page }: { q?: string; tag?: string; author?: string; page?: number }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (tag) params.set("tag", tag);
  if (author) params.set("author", author);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/novels?${query}` : "/novels";
}

function TagLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`rounded-full px-3 py-2 text-sm font-bold ${active ? "bg-[#18b7bd] text-[#021114]" : "bg-white/10 text-zinc-200 hover:bg-white/20"}`}>
      {children}
    </Link>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) return <span className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-600">{children}</span>;
  return (
    <Link href={href} className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10">
      {children}
    </Link>
  );
}
