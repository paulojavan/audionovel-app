export type ChapterPlaybackPart = {
  position: number;
  title: string;
  startSec: number;
  endSec: number;
};

export type ChapterSeekDetail = {
  startSec: number;
  autoplay: boolean;
};

export type ChapterNavigationDirection = "previous" | "next";

export function getActiveChapterPartIndex(
  parts: ChapterPlaybackPart[],
  absoluteTime: number,
) {
  if (parts.length === 0) return -1;

  let activeIndex = 0;
  for (let index = 1; index < parts.length; index += 1) {
    if (absoluteTime < parts[index].startSec) break;
    activeIndex = index;
  }

  return activeIndex;
}

export function getAdjacentChapterPart(
  parts: ChapterPlaybackPart[],
  absoluteTime: number,
  direction: ChapterNavigationDirection,
) {
  const activeIndex = getActiveChapterPartIndex(parts, absoluteTime);
  if (activeIndex < 0) return null;

  const adjacentIndex = activeIndex + (direction === "previous" ? -1 : 1);
  return parts[adjacentIndex] ?? null;
}

export function getChapterPartSeekDetail(
  part: ChapterPlaybackPart,
): ChapterSeekDetail {
  return {
    startSec: part.startSec,
    autoplay: true,
  };
}
