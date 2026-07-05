type MediaRetryState = {
  errorCode: number | null;
  retryCount: number;
};

export function shouldRetryMediaError({
  errorCode,
  retryCount,
}: MediaRetryState) {
  return retryCount < 1 && (errorCode === 2 || errorCode === 3);
}

export function buildAudioRetrySource(source: string, retryCount: number) {
  const startsAtOrigin = source.startsWith("/");
  const url = new URL(source, "https://audio-retry.invalid/");
  url.searchParams.set("streamRetry", String(retryCount));

  const path = startsAtOrigin ? url.pathname : url.pathname.slice(1);
  return `${path}${url.search}${url.hash}`;
}
