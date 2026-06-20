export type OfflineItem = {
  id: string;
  chapterId: string;
  title: string;
  novelTitle: string;
  volumeTitle: string;
  chapterPosition: number;
  chapterPositionLabel?: string;
  cacheKey: string;
  expiresAt: string;
};

export function mergeOfflineItems(serverItems: OfflineItem[], localItems: OfflineItem[]) {
  const byChapter = new Map<string, OfflineItem>();

  for (const item of serverItems) {
    byChapter.set(item.chapterId, item);
  }

  for (const item of localItems) {
    byChapter.set(item.chapterId, item);
  }

  return Array.from(byChapter.values()).sort((a, b) => {
    const novelOrder = a.novelTitle.localeCompare(b.novelTitle, "pt-BR");
    if (novelOrder) return novelOrder;
    const volumeOrder = a.volumeTitle.localeCompare(b.volumeTitle, "pt-BR");
    if (volumeOrder) return volumeOrder;
    return a.chapterPosition - b.chapterPosition;
  });
}

export function removeExpiredOfflineItems(items: OfflineItem[], now = Date.now()) {
  return items.filter((item) => new Date(item.expiresAt).getTime() > now);
}
