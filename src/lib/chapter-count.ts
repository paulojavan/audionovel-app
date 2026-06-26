export type ChapterCountSource = {
  position: number;
  positionEnd?: number | null;
};

export function getStoredChapterCount(chapter: ChapterCountSource) {
  if (chapter.positionEnd && chapter.positionEnd > chapter.position) {
    return chapter.positionEnd - chapter.position + 1;
  }

  return 1;
}

export function getTotalStoredChapterCount(chapters: ChapterCountSource[]) {
  return chapters.reduce((sum, chapter) => sum + getStoredChapterCount(chapter), 0);
}
