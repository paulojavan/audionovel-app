import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function LibraryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.isBlocked) redirect("/login?blocked=1");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      favorites: { include: { novel: true }, orderBy: { createdAt: "desc" } },
      listeningProgress: {
        take: 20,
        orderBy: { updatedAt: "desc" },
        include: { chapter: { include: { volume: { include: { novel: true } } } } },
      },
    },
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
                  {item.chapter.volume.novel.title} - {item.completed ? "visto" : `parou em ${item.positionSec}s`}
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
                <Image src={favorite.novel.coverUrl} alt="" width={360} height={360} className="aspect-square w-full rounded object-cover" />
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
