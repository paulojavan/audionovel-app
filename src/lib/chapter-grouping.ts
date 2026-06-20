import { getGroupedChapterDuration, getGroupedChapterPositionEnd } from "./chapter-time";

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

  return {
    title: orderedChapters.map((chapter) => chapter.title).join(", "),
    position: firstChapter.position,
    positionEnd: getGroupedChapterPositionEnd(orderedChapters.map((chapter) => chapter.position)),
    startSec: Math.min(...orderedChapters.map((chapter) => chapter.startSec)),
    durationSec: getGroupedChapterDuration(orderedChapters),
    youtubeUrl: firstChapter.youtubeUrl,
  };
}
