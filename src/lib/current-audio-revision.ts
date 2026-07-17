export type ChapterAudioIdentity = {
  audioRevision: number;
  src: string;
};

type CurrentAudioRevisionOptions = {
  online: boolean;
  fetcher?: typeof fetch;
};

export async function getCurrentChapterAudioIdentity(
  chapterId: string,
  fallback: ChapterAudioIdentity,
  { online, fetcher = fetch }: CurrentAudioRevisionOptions,
) {
  if (!online) return fallback;

  const response = await fetcher(
    `/api/chapters/${encodeURIComponent(chapterId)}/audio-revision`,
    {
      cache: "no-store",
      credentials: "same-origin",
    },
  );
  const payload = await response.json().catch(() => ({})) as {
    audioRevision?: number;
    src?: string;
  };
  if (
    !response.ok ||
    !Number.isInteger(payload.audioRevision) ||
    (payload.audioRevision ?? 0) < 1 ||
    typeof payload.src !== "string" ||
    !payload.src
  ) {
    throw new Error("Nao foi possivel confirmar a revisao atual do audio.");
  }

  return {
    audioRevision: payload.audioRevision as number,
    src: payload.src,
  };
}
