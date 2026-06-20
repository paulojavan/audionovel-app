export function getDurationFromRange(startSec: number, endSec: number) {
  return Math.max(0, endSec - startSec);
}

export function getChapterPositionLabel(position: number, positionEnd?: number | null) {
  return positionEnd && positionEnd > position ? `${position}-${positionEnd}` : String(position);
}

export function getGroupedChapterPositionEnd(positions: number[]) {
  return positions.length > 1 ? Math.max(...positions) : null;
}

export function getGroupedChapterDuration(chapters: Array<{ startSec: number; durationSec: number }>) {
  if (chapters.length === 0) return 0;

  const startSec = Math.min(...chapters.map((chapter) => chapter.startSec));
  const endSec = Math.max(...chapters.map((chapter) => chapter.startSec + chapter.durationSec));
  return getDurationFromRange(startSec, endSec);
}
