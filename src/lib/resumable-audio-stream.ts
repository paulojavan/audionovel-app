type ParsedContentRange = {
  start: number;
  end: number;
  total: number | null;
};

export type ResumableAudioStreamFailure = {
  attempt: number;
  byteOffset: number;
};

export type CreateResumableAudioStreamOptions = {
  initialResponse: Response;
  requestRange: string | null;
  openRange: (headers: Headers, signal?: AbortSignal) => Promise<Response>;
  maxContinuations?: number;
  downstreamSignal?: AbortSignal;
  onFailure?: (failure: ResumableAudioStreamFailure) => void;
};

function parseSafeInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseRequestRange(value: string | null): number | null {
  if (value === null) return null;

  const match = /^bytes=(\d+)-$/i.exec(value);
  return match ? parseSafeInteger(match[1]) : null;
}

function parseContentRange(value: string | null): ParsedContentRange | null {
  if (value === null) return null;

  const match = /^bytes (\d+)-(\d+)\/(\d+|\*)$/i.exec(value);
  if (!match) return null;

  const start = parseSafeInteger(match[1]);
  const end = parseSafeInteger(match[2]);
  const total = match[3] === "*" ? null : parseSafeInteger(match[3]);
  if (
    start === null ||
    end === null ||
    end < start ||
    (match[3] !== "*" && (total === null || total <= end))
  ) {
    return null;
  }

  return { start, end, total };
}

function parseStrongEtag(value: string | null): string | null {
  return value !== null && /^"[\x21\x23-\x7e\x80-\xff]*"$/.test(value)
    ? value
    : null;
}

export function getStrongEtag(source: Response | Headers): string | null {
  const headers = source instanceof Response ? source.headers : source;
  return parseStrongEtag(headers.get("ETag"));
}

export function getAudioResponseStart(
  requestRange: string | null,
  status: number,
  contentRange: string | null,
): number | null {
  if (status === 200) return requestRange === null ? 0 : null;
  if (status !== 206) return null;

  const requestedStart = parseRequestRange(requestRange);
  const responseRange = parseContentRange(contentRange);
  return requestedStart !== null && responseRange?.start === requestedStart
    ? requestedStart
    : null;
}

export function getContinuationRange(
  responseStart: number,
  deliveredBytes: number,
): string {
  if (
    !Number.isSafeInteger(responseStart) ||
    responseStart < 0 ||
    !Number.isSafeInteger(deliveredBytes) ||
    deliveredBytes < 0
  ) {
    throw new RangeError("Audio continuation offsets must be nonnegative safe integers.");
  }

  const continuationStart = responseStart + deliveredBytes;
  if (!Number.isSafeInteger(continuationStart)) {
    throw new RangeError("Audio continuation offset exceeds the safe integer range.");
  }

  return `bytes=${continuationStart}-`;
}

export function getContinuationRequestHeaders(
  responseStart: number,
  deliveredBytes: number,
  strongEtag: string,
): Headers {
  const validatedEtag = parseStrongEtag(strongEtag);
  if (validatedEtag === null) {
    throw new TypeError("Audio continuation requires a strong ETag.");
  }

  return new Headers({
    Range: getContinuationRange(responseStart, deliveredBytes),
    "If-Range": validatedEtag,
  });
}

export function isExactContinuationResponse(
  response: Response,
  expectedStart: number,
  expectedStrongEtag: string,
  expectedTotal: number,
): boolean {
  if (
    response.status !== 206 ||
    response.body === null ||
    !Number.isSafeInteger(expectedStart) ||
    expectedStart < 0 ||
    !Number.isSafeInteger(expectedTotal) ||
    expectedTotal <= 0 ||
    parseStrongEtag(expectedStrongEtag) !== expectedStrongEtag
  ) {
    return false;
  }

  const contentRange = parseContentRange(response.headers.get("Content-Range"));
  return (
    contentRange?.start === expectedStart &&
    contentRange.total === expectedTotal &&
    getStrongEtag(response) === expectedStrongEtag
  );
}

function getContentLength(headers: Headers): number | null {
  const value = headers.get("Content-Length");
  if (value === null) return null;
  if (!/^\d+$/.test(value)) {
    throw new TypeError("Audio Content-Length must be a nonnegative safe integer.");
  }

  const length = parseSafeInteger(value);
  if (length === null) {
    throw new TypeError("Audio Content-Length must be a nonnegative safe integer.");
  }
  return length;
}

function validateContentLengthAgainstRange(
  contentLength: number | null,
  contentRange: ParsedContentRange | null,
) {
  if (contentLength === null || contentRange === null) return;

  const rangeLength = getContentRangeLength(contentRange);
  if (
    contentLength !== rangeLength
  ) {
    throw new TypeError("Audio Content-Length contradicts its Content-Range.");
  }
}

function getContentRangeLength(contentRange: ParsedContentRange) {
  const rangeLength = contentRange.end - contentRange.start + 1;
  if (!Number.isSafeInteger(rangeLength) || rangeLength <= 0) {
    throw new TypeError("Audio Content-Range extent is invalid.");
  }
  return rangeLength;
}

function createAbortError() {
  return new DOMException("Audio stream aborted.", "AbortError");
}

export function createResumableAudioStream({
  initialResponse,
  requestRange,
  openRange,
  maxContinuations = 2,
  downstreamSignal,
  onFailure,
}: CreateResumableAudioStreamOptions): ReadableStream<Uint8Array> {
  let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let responseStart = 0;
  let deliveredBytes = 0;
  let expectedLength: number | null = null;
  let activeExpectedLength: number | null = null;
  let activeDeliveredBytes = 0;
  let activeExpectedFromContentRange = false;
  let representationTotal: number | null = null;
  let strongEtag: string | null = null;
  let continuationAttempts = 0;
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let terminated = false;
  let abortListener: (() => void) | null = null;
  const continuationAbort = new AbortController();

  function cleanUpAbortListener() {
    if (abortListener && downstreamSignal) {
      downstreamSignal.removeEventListener("abort", abortListener);
    }
    abortListener = null;
  }

  function cancelActiveReader(reason?: unknown) {
    const reader = activeReader;
    activeReader = null;
    if (reader) {
      void reader.cancel(reason).catch(() => undefined);
    }
  }

  function finish() {
    if (terminated) return;
    terminated = true;
    cleanUpAbortListener();
    continuationAbort.abort();
    cancelActiveReader();
    controller?.close();
  }

  function fail(error: unknown) {
    if (terminated) return;
    terminated = true;
    cleanUpAbortListener();
    continuationAbort.abort();
    cancelActiveReader(error);
    controller?.error(error);
  }

  function abort() {
    if (terminated) return;
    const error = createAbortError();
    terminated = true;
    cleanUpAbortListener();
    continuationAbort.abort(error);
    cancelActiveReader(error);
    controller?.error(error);
  }

  async function openContinuation() {
    if (strongEtag === null) {
      throw new TypeError("Audio recovery requires a strong ETag.");
    }
    if (representationTotal === null) {
      throw new TypeError(
        "Audio recovery requires a trustworthy numeric representation total.",
      );
    }

    while (!terminated) {
      if (continuationAttempts >= maxContinuations) {
        throw new Error("Audio continuation limit reached.");
      }

      const range = getContinuationRange(responseStart, deliveredBytes);
      const byteOffset = parseRequestRange(range);
      if (byteOffset === null) {
        throw new RangeError("Audio continuation offset is invalid.");
      }

      continuationAttempts += 1;
      try {
        onFailure?.({
          attempt: continuationAttempts,
          byteOffset,
        });
      } catch {
        // Observability must not alter stream delivery.
      }

      let response: Response;
      try {
        response = await openRange(
          getContinuationRequestHeaders(
            responseStart,
            deliveredBytes,
            strongEtag,
          ),
          continuationAbort.signal,
        );
      } catch (error) {
        if (terminated || continuationAbort.signal.aborted) throw error;
        if (continuationAttempts >= maxContinuations) {
          throw new Error("Audio continuation limit reached.", {
            cause: error,
          });
        }
        continue;
      }

      if (terminated || continuationAbort.signal.aborted) {
        await response.body?.cancel().catch(() => undefined);
        throw createAbortError();
      }
      if (
        !isExactContinuationResponse(
          response,
          byteOffset,
          strongEtag,
          representationTotal,
        )
      ) {
        await response.body?.cancel().catch(() => undefined);
        throw new TypeError("Invalid audio continuation response.");
      }

      try {
        const contentRange = parseContentRange(
          response.headers.get("Content-Range"),
        );
        const contentLength = getContentLength(response.headers);
        validateContentLengthAgainstRange(contentLength, contentRange);
        activeExpectedLength = getContentRangeLength(contentRange!);
        activeDeliveredBytes = 0;
        activeExpectedFromContentRange = true;
        activeReader = response.body!.getReader();
      } catch (error) {
        await response.body?.cancel(error).catch(() => undefined);
        throw error;
      }
      return;
    }
  }

  async function pump() {
    while (!terminated) {
      if (expectedLength !== null && deliveredBytes === expectedLength) {
        finish();
        return;
      }

      if (activeReader === null) {
        await openContinuation();
        if (terminated) return;
      }

      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await activeReader!.read();
      } catch {
        activeReader = null;
        if (terminated) return;
        continue;
      }
      if (terminated) return;

      if (result.done) {
        activeReader = null;
        const activeResponseEndedEarly =
          activeExpectedLength !== null &&
          activeDeliveredBytes < activeExpectedLength;
        if (
          activeResponseEndedEarly ||
          (expectedLength !== null && deliveredBytes < expectedLength)
        ) {
          continue;
        }
        finish();
        return;
      }
      if (result.value.byteLength === 0) continue;

      const nextDeliveredBytes = deliveredBytes + result.value.byteLength;
      const nextActiveDeliveredBytes =
        activeDeliveredBytes + result.value.byteLength;
      if (!Number.isSafeInteger(nextDeliveredBytes)) {
        throw new RangeError("Delivered audio byte count exceeds the safe integer range.");
      }
      if (!Number.isSafeInteger(nextActiveDeliveredBytes)) {
        throw new RangeError(
          "Delivered response byte count exceeds the safe integer range.",
        );
      }
      if (
        activeExpectedLength !== null &&
        nextActiveDeliveredBytes > activeExpectedLength
      ) {
        throw new RangeError(
          activeExpectedFromContentRange
            ? "Audio body would exceed its declared Content-Range extent."
            : "Audio body would exceed its declared Content-Length.",
        );
      }
      if (
        expectedLength !== null &&
        nextDeliveredBytes > expectedLength
      ) {
        throw new RangeError(
          "Audio body would exceed the declared Content-Length.",
        );
      }

      deliveredBytes = nextDeliveredBytes;
      activeDeliveredBytes = nextActiveDeliveredBytes;
      controller!.enqueue(result.value);
      if (expectedLength !== null && deliveredBytes === expectedLength) {
        finish();
      }
      return;
    }
  }

  return new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
      try {
        if (
          !Number.isSafeInteger(maxContinuations) ||
          maxContinuations < 0
        ) {
          throw new TypeError(
            "maxContinuations must be a nonnegative safe integer.",
          );
        }

        const start = getAudioResponseStart(
          requestRange,
          initialResponse.status,
          initialResponse.headers.get("Content-Range"),
        );
        if (start === null) {
          throw new TypeError("Invalid initial audio response range.");
        }
        responseStart = start;
        expectedLength = getContentLength(initialResponse.headers);
        const contentRange = parseContentRange(
          initialResponse.headers.get("Content-Range"),
        );
        validateContentLengthAgainstRange(expectedLength, contentRange);
        const contentRangeLength = contentRange
          ? getContentRangeLength(contentRange)
          : null;
        if (
          expectedLength === null &&
          initialResponse.status === 206
        ) {
          expectedLength = contentRangeLength;
        }
        representationTotal =
          contentRange?.total ??
          (initialResponse.status === 200 ? expectedLength : null);
        strongEtag = getStrongEtag(initialResponse);
        activeExpectedLength = contentRangeLength ?? expectedLength;
        activeExpectedFromContentRange = contentRangeLength !== null;
        activeReader = initialResponse.body?.getReader() ?? null;

        abortListener = abort;
        downstreamSignal?.addEventListener("abort", abortListener, {
          once: true,
        });
        if (downstreamSignal?.aborted) abort();
      } catch (error) {
        fail(error);
      }
    },
    pull() {
      return pump().catch(fail);
    },
    cancel(reason) {
      if (terminated) return;
      terminated = true;
      cleanUpAbortListener();
      continuationAbort.abort(reason);
      const reader = activeReader;
      activeReader = null;
      return reader?.cancel(reason).catch(() => undefined);
    },
  });
}
