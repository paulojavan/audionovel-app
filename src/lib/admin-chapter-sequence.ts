type ChapterPosition = {
  position: number;
  positionEnd: number | null;
};

export function getNextChapterPosition(chapters: ChapterPosition[]) {
  const lastPosition = chapters.reduce((highest, chapter) => Math.max(highest, chapter.positionEnd ?? chapter.position), 0);
  return Math.floor(lastPosition) + 1;
}
