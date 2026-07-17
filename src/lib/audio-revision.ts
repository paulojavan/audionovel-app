type ChapterMediaIdentity = {
  contentType: string;
  audioUrl: string | null;
};

function normalizeAudioUrl(value: string | null) {
  return value?.trim() || null;
}

export function shouldIncrementAudioRevision(
  previous: ChapterMediaIdentity,
  next: ChapterMediaIdentity,
  forceRefresh: boolean,
) {
  return (
    forceRefresh ||
    previous.contentType !== next.contentType ||
    normalizeAudioUrl(previous.audioUrl) !== normalizeAudioUrl(next.audioUrl)
  );
}

export function getChapterAudioPath(
  chapterId: string,
  audioRevision: number,
  offlineKey?: string,
) {
  const params = new URLSearchParams({ revision: String(audioRevision) });
  if (offlineKey) params.set("offline", offlineKey);
  return `/api/chapters/${encodeURIComponent(chapterId)}/audio?${params}`;
}
