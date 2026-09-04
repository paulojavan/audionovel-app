export type ChapterCountSource = {
  position: number;
  positionEnd?: number | null;
  chapterPartsJson?: string | null;
};

export function getStoredChapterCount(chapter: ChapterCountSource) {
  try {
    const parts = JSON.parse(chapter.chapterPartsJson || "[]") as unknown;
    if (Array.isArray(parts) && parts.length > 0) return parts.length;
  } catch {
    // Registros antigos podem nao ter metadados de partes validos.
  }

  if (chapter.positionEnd && chapter.positionEnd > chapter.position) {
    return Math.floor(chapter.positionEnd - chapter.position) + 1;
  }

  return 1;
}

export function getTotalStoredChapterCount(chapters: ChapterCountSource[]) {
  return chapters.reduce((sum, chapter) => sum + getStoredChapterCount(chapter), 0);
}
