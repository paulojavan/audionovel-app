import Link from "next/link";
import { redirect } from "next/navigation";
import { NovelStatusCover } from "@/components/novel-status-cover";
import { getChapterPositionLabel } from "@/lib/chapter-time";
import { LIBRARY_USER_SELECT } from "@/lib/page-data-select";
import { prisma } from "@/lib/prisma";
import { getActiveServerSession } from "@/lib/safe-auth-session";

export default async function LibraryPage() {
  const session = await getActiveServerSession();
  if (!session?.user?.id) redirect("/login");
  if (session.user.isBlocked) redirect("/login?blocked=1");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: LIBRARY_USER_SELECT,
  });

  if (!user) redirect("/login");

  return (
    <div className="px-4 py-6 md:px-8">
      <section className="mb-8">
        <h1 className="text-4xl font-black">Biblioteca</h1>
        <p className="mt-2 text-zinc-400">Seus favoritos e os ultimos capitulos ouvidos.</p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-bold">Ultimos capitulos ouvidos</h2>
        <div className="grid gap-2">
          {user.listeningProgress.length ? (
            user.listeningProgress.map((item) => (
              <Link key={item.id} href={`/chapters/${item.chapterId}`} className="rounded-md bg-[#06272b] p-3 hover:bg-[#08353a]">
                <h3 className="font-bold">{item.chapter.title}</h3>
                <p className="text-sm text-zinc-400">
                  {item.chapter.volume.novel.title} - {item.chapter.volume.title} - Vol. {item.chapter.volume.position} Cap.{" "}
                  {getChapterPositionLabel(item.chapter.position, item.chapter.positionEnd)} - {item.completed ? "visto" : `parou em ${item.positionSec}s`}
                </p>
              </Link>
            ))
          ) : (
            <p className="rounded-md bg-[#06272b] p-3 text-zinc-400">Nenhum capitulo ouvido ainda.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-bold">Favoritos</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
          {user.favorites.length ? (
            user.favorites.map((favorite) => (
              <Link key={favorite.id} href={`/novels/${favorite.novel.slug}`} className="rounded-md bg-[#06272b] p-3 hover:bg-[#08353a]">
                <NovelStatusCover
                  src={favorite.novel.coverUrl}
                  title={favorite.novel.title}
                  status={favorite.novel.status}
                  className="aspect-square w-full rounded"
                  sizes="(min-width: 1280px) 16vw, (min-width: 768px) 25vw, 50vw"
                />
                <h3 className="mt-2 font-bold">{favorite.novel.title}</h3>
              </Link>
            ))
          ) : (
            <p className="rounded-md bg-[#06272b] p-3 text-zinc-400">Nenhuma novel favoritada ainda.</p>
          )}
        </div>
      </section>
    </div>
  );
}
