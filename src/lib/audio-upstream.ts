type AudioFetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function createAbortError() {
  return new DOMException("Audio request aborted.", "AbortError");
}

export async function openAudioUpstream(
  url: string,
  headers: Headers,
  downstreamSignal: AbortSignal,
  fetcher: AudioFetcher = fetch,
): Promise<Response> {
  if (downstreamSignal.aborted) {
    throw downstreamSignal.reason ?? createAbortError();
  }

  const controller = new AbortController();
  const abortFromClient = () => {
    controller.abort(downstreamSignal.reason ?? createAbortError());
  };
  downstreamSignal.addEventListener("abort", abortFromClient, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new DOMException("Audio upstream timed out.", "TimeoutError")),
    15_000,
  );

  try {
    return await fetcher(url, {
      headers,
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    downstreamSignal.removeEventListener("abort", abortFromClient);
  }
}
