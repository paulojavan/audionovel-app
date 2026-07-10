import type { Prisma } from "@prisma/client";

export const FAVORITE_NOVEL_NEW_CHAPTERS = "FAVORITE_NOVEL_NEW_CHAPTERS";

type NotificationInput = {
  novelId: string;
  novelSlug: string;
  novelTitle: string;
  publishedAt: Date;
};

export function buildFavoriteChapterNotification(input: NotificationInput) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(input.publishedAt);
  const value = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value ?? "";
  const year = value("year");
  const month = value("month");
  const day = value("day");

  return {
    type: FAVORITE_NOVEL_NEW_CHAPTERS,
    eventKey: `${input.novelId}:${year}-${month}-${day}`,
    title: "Novos capítulos adicionados",
    message: `Novos capítulos adicionados à novel ${input.novelTitle} em ${day}/${month}/${year}.`,
    href: `/novels/${input.novelSlug}`,
  };
}

export async function notifyFavoriteUsersAboutPublishedChapter(
  tx: Prisma.TransactionClient,
  input: { volumeId: string; publishedAt: Date },
) {
  const volume = await tx.volume.findUnique({
    where: { id: input.volumeId },
    select: {
      novel: {
        select: {
          id: true,
          slug: true,
          title: true,
          favorites: { select: { userId: true } },
        },
      },
    },
  });
  if (!volume) throw new Error("volume");
  if (!volume.novel.favorites.length) return 0;

  const notification = buildFavoriteChapterNotification({
    novelId: volume.novel.id,
    novelSlug: volume.novel.slug,
    novelTitle: volume.novel.title,
    publishedAt: input.publishedAt,
  });
  const result = await tx.notification.createMany({
    data: volume.novel.favorites.map(({ userId }) => ({
      userId,
      novelId: volume.novel.id,
      ...notification,
    })),
    skipDuplicates: true,
  });

  return result.count;
}
