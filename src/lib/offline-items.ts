export type OfflineItem = {
  id: string;
  chapterId: string;
  audioRevision?: number;
  title: string;
  novelTitle: string;
  volumeTitle: string;
  chapterPosition: number;
  chapterPositionLabel?: string;
  chapterParts?: Array<{
    position: number;
    title: string;
    startSec: number;
    endSec: number;
  }>;
  cacheKey: string;
  expiresAt: string;
};

export function isOfflineItemRevisionCurrent(
  savedRevision: number | undefined,
  currentRevision: number,
) {
  return savedRevision === currentRevision;
}

export function mergeOfflineItems(serverItems: OfflineItem[], localItems: OfflineItem[]) {
  const byChapter = new Map<string, OfflineItem>();

  for (const item of serverItems) {
    byChapter.set(item.chapterId, item);
  }

  for (const item of localItems) {
    const serverItem = byChapter.get(item.chapterId);
    byChapter.set(item.chapterId, {
      ...serverItem,
      ...item,
      chapterParts: item.chapterParts ?? serverItem?.chapterParts,
    });
  }

  return Array.from(byChapter.values()).sort((a, b) => {
    const novelOrder = a.novelTitle.localeCompare(b.novelTitle, "pt-BR");
    if (novelOrder) return novelOrder;
    const volumeOrder = a.volumeTitle.localeCompare(b.volumeTitle, "pt-BR");
    if (volumeOrder) return volumeOrder;
    return a.chapterPosition - b.chapterPosition;
  });
}

export function mergeAvailableOfflineItems(
  serverItems: OfflineItem[],
  localItems: OfflineItem[],
) {
  const availableChapterIds = new Set(localItems.map((item) => item.chapterId));
  return mergeOfflineItems(serverItems, localItems).filter((item) => (
    availableChapterIds.has(item.chapterId)
  ));
}

export function removeExpiredOfflineItems(items: OfflineItem[], now = Date.now()) {
  return items.filter((item) => new Date(item.expiresAt).getTime() > now);
}
