import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OfflineListenPanel } from "@/components/offline-listen-panel";
import { OfflinePremiumGate } from "@/components/offline-premium-gate";
import { getChapterPartsForDisplay } from "@/lib/chapter-grouping";
import { getChapterPositionLabel } from "@/lib/chapter-time";
import { DEVICE_COOKIE_NAME, getDeviceIdFromToken } from "@/lib/device-identity";
import { OFFLINE_DOWNLOAD_SELECT } from "@/lib/page-data-select";
import { createOfflineLicense } from "@/lib/offline-license";
import { prisma } from "@/lib/prisma";
import { getActiveServerSession } from "@/lib/safe-auth-session";
import { hasPremiumAccess } from "@/lib/subscription";

export default async function OfflinePage() {
  const session = await getActiveServerSession();
  if (!session?.user?.id) redirect("/login");
  if (session.user.isBlocked) redirect("/login?blocked=1");
  if (!session.user.sessionId) redirect("/login");
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
    take: 100,
    orderBy: { lastUsedAt: "desc" },
    select: OFFLINE_DOWNLOAD_SELECT,
  });
  const deviceId = getDeviceIdFromToken(
    (await cookies()).get(DEVICE_COOKIE_NAME)?.value,
  );
  const license = createOfflineLicense({
    userId: session.user.id,
    deviceId: deviceId ?? undefined,
    sessionId: deviceId ? undefined : session.user.sessionId,
    premiumUntil: session.user.premiumUntil ?? null,
    role: session.user.role,
  });

  return (
    <>
      <meta name="audio-novel-account-scope" content={session.user.id} />
      <div className="px-4 py-6 md:px-8">
        <section className="mb-6">
          <p className="text-sm font-bold uppercase text-[#18b7bd]">Offline</p>
          <h1 className="mt-1 text-4xl font-black">Ouvir capitulos offline</h1>
          <p className="mt-2 text-zinc-400">Capitulos salvos ficam criptografados no navegador e podem expirar conforme a chave offline.</p>
        </section>

        <OfflinePremiumGate
          accountScope={session.user.id}
          deviceId={deviceId ?? undefined}
          sessionId={session.user.sessionId}
          license={license}
        >
          <OfflineListenPanel
            accountScope={session.user.id}
            items={downloads.map((download) => {
              const chapterParts = getChapterPartsForDisplay(download.chapter).map((part) => ({
                position: part.position,
                title: part.title,
                startSec: part.startSec,
                endSec: part.endSec,
              }));

              return {
                id: download.id,
                chapterId: download.chapterId,
                audioRevision: download.chapter.audioRevision,
                title: download.chapter.title,
                novelTitle: download.chapter.volume.novel.title,
                volumeTitle: download.chapter.volume.title,
                chapterPosition: download.chapter.position,
                chapterPositionLabel: getChapterPositionLabel(download.chapter.position, download.chapter.positionEnd),
                chapterParts,
                cacheKey: download.cacheKey,
                expiresAt: download.expiresAt.toISOString(),
              };
            })}
          />
        </OfflinePremiumGate>
      </div>
    </>
  );
}
