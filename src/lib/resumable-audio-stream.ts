type ParsedContentRange = {
  start: number;
  end: number;
  total: number | null;
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

export function isExactContinuationResponse(
  response: Response,
  expectedStart: number,
): boolean {
  if (
    response.status !== 206 ||
    response.body === null ||
    !Number.isSafeInteger(expectedStart) ||
    expectedStart < 0
  ) {
    return false;
  }

  return parseContentRange(response.headers.get("Content-Range"))?.start === expectedStart;
}
