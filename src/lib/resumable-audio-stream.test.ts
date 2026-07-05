import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createResumableAudioStream,
  getAudioResponseStart,
  getContinuationRequestHeaders,
  getContinuationRange,
  getStrongEtag,
  isExactContinuationResponse,
} from "./resumable-audio-stream";

function streamFromChunks(
  chunks: Uint8Array[],
  options: { errorAfter?: number; onCancel?: () => void } = {},
) {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (options.errorAfter === index) {
        controller.error(new TypeError("upstream connection lost"));
        return;
      }
      const chunk = chunks[index];
      if (chunk) {
        index += 1;
        controller.enqueue(chunk);
        return;
      }
      controller.close();
    },
    cancel() {
      options.onCancel?.();
    },
  });
}

async function readBytes(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const bytes: number[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) return bytes;
    bytes.push(...value);
  }
}

test("accepts a full 200 response when no range was requested", () => {
  assert.equal(getAudioResponseStart(null, 200, null), 0);
});

test("accepts a 206 response whose content range starts at the requested byte", () => {
  assert.equal(
    getAudioResponseStart("bytes=100-", 206, "bytes 100-199/200"),
    100,
  );
});

test("rejects a 206 response whose content range starts at another byte", () => {
  assert.equal(
    getAudioResponseStart("bytes=100-", 206, "bytes 101-199/200"),
    null,
  );
});

test("rejects malformed, multiple, and suffix request ranges", () => {
  for (const requestRange of [
    "bytes=abc-",
    "bytes=0-99",
    "bytes=0-,100-",
    "bytes=-100",
  ]) {
    assert.equal(
      getAudioResponseStart(requestRange, 206, "bytes 0-99/100"),
      null,
      requestRange,
    );
  }
});

test("rejects ranged 200 responses and unsupported statuses", () => {
  assert.equal(getAudioResponseStart("bytes=0-", 200, null), null);
  assert.equal(getAudioResponseStart(null, 206, "bytes 0-99/100"), null);
  assert.equal(getAudioResponseStart(null, 416, null), null);
});

test("rejects malformed content ranges", () => {
  for (const contentRange of [
    "bytes 100-99/200",
    "bytes 100-199/not-a-total",
    "bytes 100-199/200, bytes 300-399/400",
    `bytes ${Number.MAX_SAFE_INTEGER + 1}-${Number.MAX_SAFE_INTEGER + 1}/*`,
  ]) {
    assert.equal(
      getAudioResponseStart("bytes=100-", 206, contentRange),
      null,
      contentRange,
    );
  }
});

test("rejects a content range whose numeric total equals its end", () => {
  assert.equal(
    getAudioResponseStart("bytes=100-", 206, "bytes 100-199/199"),
    null,
  );
});

test("rejects a zero-sized content range with a numeric zero total", () => {
  assert.equal(getAudioResponseStart("bytes=0-", 206, "bytes 0-0/0"), null);
});

test("builds the next open-ended continuation range", () => {
  assert.equal(getContinuationRange(100, 25), "bytes=125-");
});

test("throws instead of emitting malformed or unsafe continuation offsets", () => {
  for (const [responseStart, deliveredBytes] of [
    [Number.NaN, 1],
    [Number.POSITIVE_INFINITY, 1],
    [-1, 1],
    [1.5, 1],
    [1, -1],
    [1, 1.5],
    [Number.MAX_SAFE_INTEGER, 1],
  ]) {
    assert.throws(
      () => getContinuationRange(responseStart, deliveredBytes),
      RangeError,
      `${responseStart} + ${deliveredBytes}`,
    );
  }
});

test("extracts a quoted strong ETag from a response or headers", () => {
  const response = new Response(null, { headers: { ETag: '"audio-v1"' } });
  const headers = new Headers({ ETag: '"audio-v2"' });
  const emptyOpaqueTag = new Headers({ ETag: '""' });

  assert.equal(getStrongEtag(response), '"audio-v1"');
  assert.equal(getStrongEtag(headers), '"audio-v2"');
  assert.equal(getStrongEtag(emptyOpaqueTag), '""');
});

test("rejects missing, malformed, and weak ETags", () => {
  assert.equal(getStrongEtag(new Headers()), null);
  assert.equal(getStrongEtag(new Headers({ ETag: "" })), null);
  assert.equal(getStrongEtag(new Headers({ ETag: 'W/"audio-v1"' })), null);
});

test("recognizes an exact 206 continuation response with the same validator and total", () => {
  const response = new Response(new Uint8Array([1]), {
    status: 206,
    headers: {
      "Content-Range": "bytes 100-100/200",
      ETag: '"audio-v1"',
    },
  });

  assert.equal(
    isExactContinuationResponse(response, 100, '"audio-v1"', 200),
    true,
  );
});

test("rejects a 200 response as a continuation", () => {
  const response = new Response(new Uint8Array([1]), {
    status: 200,
    headers: {
      "Content-Range": "bytes 100-100/200",
      ETag: '"audio-v1"',
    },
  });

  assert.equal(
    isExactContinuationResponse(response, 100, '"audio-v1"', 200),
    false,
  );
});

test("rejects a continuation response starting at the wrong byte", () => {
  const response = new Response(new Uint8Array([1]), {
    status: 206,
    headers: {
      "Content-Range": "bytes 101-101/200",
      ETag: '"audio-v1"',
    },
  });

  assert.equal(
    isExactContinuationResponse(response, 100, '"audio-v1"', 200),
    false,
  );
});

test("rejects continuation responses missing a body or content range", () => {
  const missingBody = new Response(null, {
    status: 206,
    headers: {
      "Content-Range": "bytes 100-100/200",
      ETag: '"audio-v1"',
    },
  });
  const missingContentRange = new Response(new Uint8Array([1]), {
    status: 206,
    headers: { ETag: '"audio-v1"' },
  });

  assert.equal(
    isExactContinuationResponse(missingBody, 100, '"audio-v1"', 200),
    false,
  );
  assert.equal(
    isExactContinuationResponse(
      missingContentRange,
      100,
      '"audio-v1"',
      200,
    ),
    false,
  );
});

test("rejects a continuation response whose content range ends before it starts", () => {
  const response = new Response(new Uint8Array([1]), {
    status: 206,
    headers: {
      "Content-Range": "bytes 100-99/200",
      ETag: '"audio-v1"',
    },
  });

  assert.equal(
    isExactContinuationResponse(response, 100, '"audio-v1"', 200),
    false,
  );
});

test("rejects a continuation response whose numeric total does not exceed its end", () => {
  const response = new Response(new Uint8Array([1]), {
    status: 206,
    headers: {
      "Content-Range": "bytes 100-199/100",
      ETag: '"audio-v1"',
    },
  });

  assert.equal(
    isExactContinuationResponse(response, 100, '"audio-v1"', 200),
    false,
  );
});

test("rejects changed, missing, or weak continuation ETags", () => {
  for (const etag of ['"audio-v2"', null, 'W/"audio-v1"']) {
    const headers = new Headers({ "Content-Range": "bytes 100-199/200" });
    if (etag !== null) headers.set("ETag", etag);
    const response = new Response(new Uint8Array([1]), {
      status: 206,
      headers,
    });

    assert.equal(
      isExactContinuationResponse(response, 100, '"audio-v1"', 200),
      false,
      String(etag),
    );
  }
});

test("rejects changed and wildcard continuation totals", () => {
  for (const contentRange of ["bytes 100-199/201", "bytes 100-199/*"]) {
    const response = new Response(new Uint8Array([1]), {
      status: 206,
      headers: {
        "Content-Range": contentRange,
        ETag: '"audio-v1"',
      },
    });

    assert.equal(
      isExactContinuationResponse(response, 100, '"audio-v1"', 200),
      false,
      contentRange,
    );
  }
});

test("builds continuation headers with exact Range and If-Range values", () => {
  const headers = getContinuationRequestHeaders(100, 25, '"audio-v1"');

  assert.deepEqual([...headers.entries()], [
    ["if-range", '"audio-v1"'],
    ["range", "bytes=125-"],
  ]);
});

test("refuses to build continuation headers from an invalid ETag", () => {
  assert.throws(
    () => getContinuationRequestHeaders(100, 25, 'W/"audio-v1"'),
    TypeError,
  );
});

test("resumes a thrown initial body at the exact next byte with Range and If-Range", async () => {
  const requests: Array<{ range: string | null; ifRange: string | null }> = [];
  const failures: Array<{ attempt: number; byteOffset: number }> = [];
  const initialResponse = new Response(
    streamFromChunks([new Uint8Array([1, 2])], { errorAfter: 1 }),
    {
      headers: {
        "Content-Length": "4",
        ETag: '"audio-v1"',
      },
    },
  );

  const stream = createResumableAudioStream({
    initialResponse,
    requestRange: null,
    async openRange(headers) {
      requests.push({
        range: headers.get("Range"),
        ifRange: headers.get("If-Range"),
      });
      return new Response(new Uint8Array([3, 4]), {
        status: 206,
        headers: {
          "Content-Length": "2",
          "Content-Range": "bytes 2-3/4",
          ETag: '"audio-v1"',
        },
      });
    },
    onFailure(failure) {
      failures.push(failure);
    },
  });

  assert.deepEqual(await readBytes(stream), [1, 2, 3, 4]);
  assert.deepEqual(requests, [
    { range: "bytes=2-", ifRange: '"audio-v1"' },
  ]);
  assert.deepEqual(failures, [{ attempt: 1, byteOffset: 2 }]);
});

test("resumes when the initial body reaches EOF before Content-Length", async () => {
  let attempts = 0;
  const stream = createResumableAudioStream({
    initialResponse: new Response(new Uint8Array([1, 2]), {
      headers: {
        "Content-Length": "4",
        ETag: '"audio-v1"',
      },
    }),
    requestRange: null,
    async openRange(headers) {
      attempts += 1;
      assert.equal(headers.get("Range"), "bytes=2-");
      return new Response(new Uint8Array([3, 4]), {
        status: 206,
        headers: {
          "Content-Range": "bytes 2-3/4",
          ETag: '"audio-v1"',
        },
      });
    },
  });

  assert.deepEqual(await readBytes(stream), [1, 2, 3, 4]);
  assert.equal(attempts, 1);
});

test("derives a 206 expected length from Content-Range and resumes premature EOF", async () => {
  const requests: string[] = [];
  const stream = createResumableAudioStream({
    initialResponse: new Response(new Uint8Array([3]), {
      status: 206,
      headers: {
        "Content-Range": "bytes 2-3/4",
        ETag: '"audio-v1"',
      },
    }),
    requestRange: "bytes=2-",
    async openRange(headers) {
      requests.push(headers.get("Range")!);
      return new Response(new Uint8Array([4]), {
        status: 206,
        headers: {
          "Content-Range": "bytes 3-3/4",
          ETag: '"audio-v1"',
        },
      });
    },
  });

  assert.deepEqual(await readBytes(stream), [3, 4]);
  assert.deepEqual(requests, ["bytes=3-"]);
});

test("resumes again when a continuation ends before its Content-Range extent", async () => {
  const requests: string[] = [];
  const stream = createResumableAudioStream({
    initialResponse: new Response(
      streamFromChunks([new Uint8Array([1])], { errorAfter: 1 }),
      {
        status: 206,
        headers: {
          "Content-Length": "4",
          "Content-Range": "bytes 0-3/4",
          ETag: '"audio-v1"',
        },
      },
    ),
    requestRange: "bytes=0-",
    async openRange(headers) {
      const range = headers.get("Range")!;
      requests.push(range);
      if (range === "bytes=1-") {
        return new Response(new Uint8Array([2]), {
          status: 206,
          headers: {
            "Content-Range": "bytes 1-2/4",
            ETag: '"audio-v1"',
          },
        });
      }
      return new Response(new Uint8Array([3, 4]), {
        status: 206,
        headers: {
          "Content-Range": "bytes 2-3/4",
          ETag: '"audio-v1"',
        },
      });
    },
  });

  assert.deepEqual(await readBytes(stream), [1, 2, 3, 4]);
  assert.deepEqual(requests, ["bytes=1-", "bytes=2-"]);
});

test("accepts a complete initial body without a strong validator", async () => {
  let attempts = 0;
  const stream = createResumableAudioStream({
    initialResponse: new Response(new Uint8Array([1, 2]), {
      headers: { "Content-Length": "2" },
    }),
    requestRange: null,
    async openRange() {
      attempts += 1;
      throw new Error("must not open a continuation");
    },
  });

  assert.deepEqual(await readBytes(stream), [1, 2]);
  assert.equal(attempts, 0);
});

test("fails safely on recovery when the initial response has no strong validator", async () => {
  let attempts = 0;
  const stream = createResumableAudioStream({
    initialResponse: new Response(
      streamFromChunks([new Uint8Array([1])], { errorAfter: 1 }),
      { headers: { "Content-Length": "2" } },
    ),
    requestRange: null,
    async openRange() {
      attempts += 1;
      return new Response(new Uint8Array([2]));
    },
  });

  await assert.rejects(readBytes(stream), /strong ETag/i);
  assert.equal(attempts, 0);
});

test("fails safely on recovery when the representation total is unknown", async () => {
  let attempts = 0;
  const stream = createResumableAudioStream({
    initialResponse: new Response(
      streamFromChunks([new Uint8Array([1])], { errorAfter: 1 }),
      { headers: { ETag: '"audio-v1"' } },
    ),
    requestRange: null,
    async openRange() {
      attempts += 1;
      return new Response(new Uint8Array([2]));
    },
  });

  await assert.rejects(readBytes(stream), /numeric representation total/i);
  assert.equal(attempts, 0);
});

test("rejects malformed initial Content-Length values", async () => {
  for (const contentLength of [
    "-1",
    "1.5",
    "not-a-number",
    String(Number.MAX_SAFE_INTEGER + 1),
  ]) {
    const stream = createResumableAudioStream({
      initialResponse: new Response(new Uint8Array([1]), {
        headers: { "Content-Length": contentLength },
      }),
      requestRange: null,
      async openRange() {
        throw new Error("must not open a continuation");
      },
    });
    await assert.rejects(readBytes(stream), /Content-Length/i, contentLength);
  }
});

test("rejects a 206 whose Content-Length contradicts its Content-Range extent", async () => {
  const stream = createResumableAudioStream({
    initialResponse: new Response(new Uint8Array([3, 4]), {
      status: 206,
      headers: {
        "Content-Length": "1",
        "Content-Range": "bytes 2-3/4",
        ETag: '"audio-v1"',
      },
    }),
    requestRange: "bytes=2-",
    async openRange() {
      throw new Error("must not open a continuation");
    },
  });

  await assert.rejects(readBytes(stream), /Content-Length.*Content-Range/i);
});

test("rejects and cancels a 200 response carrying Content-Range before streaming bytes", async () => {
  let cancelled = false;
  let attempts = 0;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([3, 4]));
    },
    cancel() {
      cancelled = true;
    },
  });
  const stream = createResumableAudioStream({
    initialResponse: new Response(body, {
      status: 200,
      headers: {
        "Content-Range": "bytes 2-3/4",
        ETag: '"audio-v1"',
      },
    }),
    requestRange: null,
    async openRange() {
      attempts += 1;
      throw new Error("must not open a continuation");
    },
  });
  const reader = stream.getReader();

  await assert.rejects(reader.read(), /200.*Content-Range/i);
  assert.equal(cancelled, true);
  assert.equal(attempts, 0);
});

test("cancels the initial body when synchronous option validation fails", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true;
    },
  });
  const stream = createResumableAudioStream({
    initialResponse: new Response(body),
    requestRange: null,
    maxContinuations: -1,
    async openRange() {
      throw new Error("must not open a continuation");
    },
  });

  await assert.rejects(readBytes(stream), /maxContinuations/i);
  assert.equal(cancelled, true);
});

test("rejects invalid continuation status, start, ETag, and total without a second attempt", async () => {
  const cases = [
    {
      name: "status",
      status: 200,
      contentRange: "bytes 1-1/2",
      etag: '"audio-v1"',
    },
    {
      name: "start",
      status: 206,
      contentRange: "bytes 0-1/2",
      etag: '"audio-v1"',
    },
    {
      name: "ETag",
      status: 206,
      contentRange: "bytes 1-1/2",
      etag: '"audio-v2"',
    },
    {
      name: "total",
      status: 206,
      contentRange: "bytes 1-1/3",
      etag: '"audio-v1"',
    },
  ];

  for (const invalid of cases) {
    let attempts = 0;
    const stream = createResumableAudioStream({
      initialResponse: new Response(
        streamFromChunks([new Uint8Array([1])], { errorAfter: 1 }),
        {
          headers: {
            "Content-Length": "2",
            ETag: '"audio-v1"',
          },
        },
      ),
      requestRange: null,
      async openRange() {
        attempts += 1;
        return new Response(new Uint8Array([2]), {
          status: invalid.status,
          headers: {
            "Content-Range": invalid.contentRange,
            ETag: invalid.etag,
          },
        });
      },
    });

    await assert.rejects(readBytes(stream), /continuation response/i, invalid.name);
    assert.equal(attempts, 1, invalid.name);
  }
});

test("bounds continuation attempts exactly at maxContinuations", async () => {
  const failures: Array<{ attempt: number; byteOffset: number }> = [];
  let attempts = 0;
  const stream = createResumableAudioStream({
    initialResponse: new Response(
      streamFromChunks([new Uint8Array([1])], { errorAfter: 1 }),
      {
        headers: {
          "Content-Length": "3",
          ETag: '"audio-v1"',
        },
      },
    ),
    requestRange: null,
    maxContinuations: 2,
    async openRange(headers) {
      attempts += 1;
      assert.equal(headers.get("Range"), "bytes=1-");
      return new Response(
        streamFromChunks([], { errorAfter: 0 }),
        {
          status: 206,
          headers: {
            "Content-Range": "bytes 1-2/3",
            ETag: '"audio-v1"',
          },
        },
      );
    },
    onFailure(failure) {
      failures.push(failure);
    },
  });

  await assert.rejects(readBytes(stream), /continuation limit/i);
  assert.equal(attempts, 2);
  assert.deepEqual(failures, [
    { attempt: 1, byteOffset: 1 },
    { attempt: 2, byteOffset: 1 },
  ]);
});

test("consumes an asynchronous onFailure rejection without interrupting delivery", async () => {
  const observationError = new Error("metrics backend unavailable");
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => {
    unhandled.push(reason);
  };
  process.on("unhandledRejection", onUnhandled);

  try {
    const stream = createResumableAudioStream({
      initialResponse: new Response(
        streamFromChunks([new Uint8Array([1])], { errorAfter: 1 }),
        {
          headers: {
            "Content-Length": "2",
            ETag: '"audio-v1"',
          },
        },
      ),
      requestRange: null,
      async openRange() {
        return new Response(new Uint8Array([2]), {
          status: 206,
          headers: {
            "Content-Range": "bytes 1-1/2",
            ETag: '"audio-v1"',
          },
        });
      },
      async onFailure() {
        throw observationError;
      },
    });

    assert.deepEqual(await readBytes(stream), [1, 2]);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(unhandled, []);
  } finally {
    process.removeListener("unhandledRejection", onUnhandled);
  }
});

test("releases a failed reader lock before continuing", async () => {
  const initialBody = streamFromChunks(
    [new Uint8Array([1])],
    { errorAfter: 1 },
  );
  const stream = createResumableAudioStream({
    initialResponse: new Response(initialBody, {
      headers: {
        "Content-Length": "2",
        ETag: '"audio-v1"',
      },
    }),
    requestRange: null,
    async openRange() {
      return new Response(new Uint8Array([2]), {
        status: 206,
        headers: {
          "Content-Range": "bytes 1-1/2",
          ETag: '"audio-v1"',
        },
      });
    },
  });

  assert.deepEqual(await readBytes(stream), [1, 2]);
  assert.equal(initialBody.locked, false);
});

test("rejects a continuation chunk that would exceed the original Content-Length", async () => {
  const stream = createResumableAudioStream({
    initialResponse: new Response(
      streamFromChunks([new Uint8Array([1, 2])], { errorAfter: 1 }),
      {
        headers: {
          "Content-Length": "4",
          ETag: '"audio-v1"',
        },
      },
    ),
    requestRange: null,
    async openRange() {
      return new Response(new Uint8Array([3, 4, 5]), {
        status: 206,
        headers: {
          "Content-Range": "bytes 2-3/4",
          ETag: '"audio-v1"',
        },
      });
    },
  });

  await assert.rejects(
    readBytes(stream),
    /exceed.*(?:Content-Length|Content-Range)/i,
  );
});

test("rejects a chunk that exceeds its continuation Content-Range before forwarding it", async () => {
  let continuationCancelled = false;
  const overflowingContinuation = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([2, 3, 4, 5]));
    },
    cancel() {
      continuationCancelled = true;
    },
  });
  const stream = createResumableAudioStream({
    initialResponse: new Response(
      streamFromChunks([new Uint8Array([1])], { errorAfter: 1 }),
      {
        status: 206,
        headers: {
          "Content-Length": "4",
          "Content-Range": "bytes 0-3/5",
          ETag: '"audio-v1"',
        },
      },
    ),
    requestRange: "bytes=0-",
    async openRange() {
      return new Response(overflowingContinuation, {
        status: 206,
        headers: {
          "Content-Range": "bytes 1-2/5",
          ETag: '"audio-v1"',
        },
      });
    },
  });
  const reader = stream.getReader();

  assert.deepEqual(await reader.read(), {
    done: false,
    value: new Uint8Array([1]),
  });
  await assert.rejects(reader.read(), /exceed.*Content-Range/i);
  assert.equal(continuationCancelled, true);
});

test("rejects and cancels a continuation whose Content-Length contradicts its range", async () => {
  let cancelled = false;
  const stream = createResumableAudioStream({
    initialResponse: new Response(
      streamFromChunks([new Uint8Array([1])], { errorAfter: 1 }),
      {
        headers: {
          "Content-Length": "2",
          ETag: '"audio-v1"',
        },
      },
    ),
    requestRange: null,
    async openRange() {
      return new Response(
        streamFromChunks([new Uint8Array([2])], {
          onCancel: () => (cancelled = true),
        }),
        {
          status: 206,
          headers: {
            "Content-Length": "2",
            "Content-Range": "bytes 1-1/2",
            ETag: '"audio-v1"',
          },
        },
      );
    },
  });

  await assert.rejects(
    readBytes(stream),
    /Content-Length.*Content-Range/i,
  );
  assert.equal(cancelled, true);
});

test("closes at the original Content-Length without reading duplicate trailing bytes", async () => {
  let continuationCancelled = false;
  const continuationBody = streamFromChunks(
    [new Uint8Array([3, 4]), new Uint8Array([5])],
    { onCancel: () => (continuationCancelled = true) },
  );
  const stream = createResumableAudioStream({
    initialResponse: new Response(
      streamFromChunks([new Uint8Array([1, 2])], { errorAfter: 1 }),
      {
        headers: {
          "Content-Length": "4",
          ETag: '"audio-v1"',
        },
      },
    ),
    requestRange: null,
    async openRange() {
      return new Response(continuationBody, {
        status: 206,
        headers: {
          "Content-Range": "bytes 2-3/4",
          ETag: '"audio-v1"',
        },
      });
    },
  });

  assert.deepEqual(await readBytes(stream), [1, 2, 3, 4]);
  assert.equal(continuationCancelled, true);
});

test("downstream abort cancels the active reader and never opens a continuation", async () => {
  let cancelled = false;
  let attempts = 0;
  const abortController = new AbortController();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1]));
    },
    cancel() {
      cancelled = true;
    },
  });
  const stream = createResumableAudioStream({
    initialResponse: new Response(body, {
      headers: {
        "Content-Length": "2",
        ETag: '"audio-v1"',
      },
    }),
    requestRange: null,
    downstreamSignal: abortController.signal,
    async openRange() {
      attempts += 1;
      throw new Error("must not open a continuation");
    },
  });
  const reader = stream.getReader();

  assert.deepEqual(await reader.read(), {
    done: false,
    value: new Uint8Array([1]),
  });
  abortController.abort();
  await assert.rejects(reader.read(), /abort/i);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(cancelled, true);
  assert.equal(attempts, 0);
});

test("downstream cancellation cancels the active reader and never opens a continuation", async () => {
  let cancelled = false;
  let attempts = 0;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1]));
    },
    cancel() {
      cancelled = true;
    },
  });
  const stream = createResumableAudioStream({
    initialResponse: new Response(body, {
      headers: {
        "Content-Length": "2",
        ETag: '"audio-v1"',
      },
    }),
    requestRange: null,
    async openRange() {
      attempts += 1;
      throw new Error("must not open a continuation");
    },
  });
  const reader = stream.getReader();

  await reader.read();
  await reader.cancel();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(cancelled, true);
  assert.equal(attempts, 0);
});

test("a normal complete body opens no continuation", async () => {
  let attempts = 0;
  const stream = createResumableAudioStream({
    initialResponse: new Response(new Uint8Array([1, 2, 3]), {
      headers: {
        "Content-Length": "3",
        ETag: '"audio-v1"',
      },
    }),
    requestRange: null,
    async openRange() {
      attempts += 1;
      throw new Error("must not open a continuation");
    },
  });

  assert.deepEqual(await readBytes(stream), [1, 2, 3]);
  assert.equal(attempts, 0);
});
