type MediaRetryState = {
  errorCode: number | null;
  retryCount: number;
};

export type AudioRetryState = {
  sourceRevision: number;
  automaticRetryCount: number;
};

export type PendingAudioRetry = {
  position: number;
  shouldResume: boolean;
};

export function shouldRetryMediaError({
  errorCode,
  retryCount,
}: MediaRetryState) {
  return retryCount < 1 && (errorCode === 2 || errorCode === 3);
}

export function buildAudioRetrySource(source: string, retryCount: number) {
  const isProtocolRelative = source.startsWith("//");
  const isAbsolute = /^[a-z][a-z\d+.-]*:/i.test(source);
  const startsAtOrigin = !isProtocolRelative && source.startsWith("/");
  const url = new URL(source, "https://audio-retry.invalid/");
  url.searchParams.set("streamRetry", String(retryCount));

  if (isProtocolRelative) return url.href.slice(url.protocol.length);
  if (isAbsolute) return url.href;

  const path = startsAtOrigin ? url.pathname : url.pathname.slice(1);
  return `${path}${url.search}${url.hash}`;
}

export function advanceAudioRetryState({
  state,
  reason,
}: {
  state: AudioRetryState;
  reason: "automatic" | "manual";
}): AudioRetryState {
  return {
    sourceRevision: state.sourceRevision + 1,
    automaticRetryCount:
      reason === "manual" ? 0 : state.automaticRetryCount + 1,
  };
}

export function resolveInterruptedAudioRetry({
  pendingRetry,
  currentPosition,
  desiredPlayback,
}: {
  pendingRetry: PendingAudioRetry | null;
  currentPosition: number;
  desiredPlayback: boolean;
}): PendingAudioRetry {
  return pendingRetry ?? {
    position: currentPosition,
    shouldResume: desiredPlayback,
  };
}
