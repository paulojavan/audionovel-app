import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OfflineListenPanel } from "@/components/offline-listen-panel";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/subscription";

export default async function OfflinePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.isBlocked) redirect("/login?blocked=1");
  const canUseOffline = hasPremiumAccess(session.user);

  if (!canUseOffline) {
    return (
      <div className="px-4 py-6 md:px-8">
        <section className="mb-6">
          <p className="text-sm font-bold uppercase text-[#18b7bd]">Offline</p>
          <h1 className="mt-1 text-4xl font-black">Offline e exclusivo para premium</h1>
          <p className="mt-2 max-w-2xl text-zinc-400">
            Assine um plano premium para salvar capitulos em audio criptografados no navegador e ouvir mesmo sem baixar de novo.
          </p>
        </section>
        <Link href="/assinaturas" className="inline-flex rounded-full bg-[#18b7bd] px-5 py-3 font-black text-[#021114] hover:bg-[#22d3dc]">
          Ver planos premium
        </Link>
      </div>
    );
  }

  const downloads = await prisma.offlineDownload.findMany({
    where: { userId: session.user.id, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: "desc" },
    include: {
      chapter: {
        include: {
          volume: { include: { novel: true } },
        },
      },
    },
  });

  return (
    <div className="px-4 py-6 md:px-8">
      <section className="mb-6">
        <p className="text-sm font-bold uppercase text-[#18b7bd]">Offline</p>
        <h1 className="mt-1 text-4xl font-black">Ouvir capitulos offline</h1>
        <p className="mt-2 text-zinc-400">Capitulos salvos ficam criptografados no navegador e podem expirar conforme a chave offline.</p>
      </section>

      <OfflineListenPanel
        items={downloads.map((download) => ({
          id: download.id,
          chapterId: download.chapterId,
          title: download.chapter.title,
          novelTitle: download.chapter.volume.novel.title,
          volumeTitle: download.chapter.volume.title,
          chapterPosition: download.chapter.position,
          cacheKey: download.cacheKey,
          expiresAt: download.expiresAt.toISOString(),
        }))}
      />
    </div>
  );
}
