import { getGroupedChapterDuration, getGroupedChapterPositionEnd } from "./chapter-time";

export type ChapterPart = {
  position: number;
  title: string;
  startSec: number;
  endSec: number;
};

export type ChapterGroupSource = {
  title: string;
  position: number;
  startSec: number;
  durationSec: number;
  youtubeUrl?: string;
};

export function getGroupedChapterSummary<T extends ChapterGroupSource>(chapters: T[]) {
  const orderedChapters = [...chapters].sort((a, b) => a.position - b.position);
  const firstChapter = orderedChapters[0];
  const parts = normalizeChapterParts(
    orderedChapters.map((chapter) => ({
      position: chapter.position,
      title: chapter.title,
      startSec: chapter.startSec,
      endSec: chapter.startSec + chapter.durationSec,
    })),
  );

  return {
    title: orderedChapters.map((chapter) => chapter.title).join(", "),
    position: firstChapter.position,
    positionEnd: getGroupedChapterPositionEnd(orderedChapters.map((chapter) => chapter.position)),
    startSec: Math.min(...orderedChapters.map((chapter) => chapter.startSec)),
    durationSec: getGroupedChapterDuration(orderedChapters),
    youtubeUrl: firstChapter.youtubeUrl,
    chapterPartsJson: JSON.stringify(parts),
  };
}

export function normalizeChapterParts(parts: ChapterPart[]) {
  return parts
    .map((part) => {
      const position = Number(part.position || 0);

      return {
        position: Number.isFinite(position) ? Math.max(0, position) : 0,
        title: part.title.trim(),
        startSec: Math.max(0, Math.floor(part.startSec || 0)),
        endSec: Math.max(0, Math.floor(part.endSec || 0)),
      };
    })
    .filter((part) => part.title.length > 0)
    .sort((a, b) => a.position - b.position);
}

export function parseChapterParts(chapterPartsJson: string | null | undefined) {
  try {
    const parsed = JSON.parse(chapterPartsJson || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];

    return normalizeChapterParts(
      parsed.map((part) => {
        const record = part as Partial<ChapterPart>;
        return {
          position: Number(record.position ?? 1),
          title: String(record.title ?? ""),
          startSec: Number(record.startSec ?? 0),
          endSec: Number(record.endSec ?? 0),
        };
      }),
    );
  } catch {
    return [];
  }
}

export function getChapterPartsForDisplay(chapter: {
  title: string;
  position: number;
  positionEnd?: number | null;
  startSec: number;
  durationSec: number;
  chapterPartsJson?: string | null;
}) {
  const parts = parseChapterParts(chapter.chapterPartsJson);
  if (parts.length > 0) return parts;

  const titles = chapter.title
    .split(",")
    .map((title) => title.trim())
    .filter(Boolean);
  const count = chapter.positionEnd && chapter.positionEnd > chapter.position ? chapter.positionEnd - chapter.position + 1 : 1;
  const segmentCount = Math.max(count, titles.length, 1);
  const segmentDuration = Math.max(1, Math.floor(chapter.durationSec / segmentCount));

  return Array.from({ length: segmentCount }, (_, index) => {
    const startSec = chapter.startSec + index * segmentDuration;
    const isLast = index === segmentCount - 1;
    return {
      position: chapter.position + index,
      title: titles[index] ?? (segmentCount > 1 ? `Capitulo ${chapter.position + index}` : chapter.title),
      startSec,
      endSec: isLast ? chapter.startSec + chapter.durationSec : startSec + segmentDuration,
    };
  });
}
