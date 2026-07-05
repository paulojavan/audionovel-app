import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getAudioResponseStart,
  getContinuationRequestHeaders,
  getContinuationRange,
  getStrongEtag,
  isExactContinuationResponse,
} from "./resumable-audio-stream";

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

  assert.equal(getStrongEtag(response), '"audio-v1"');
  assert.equal(getStrongEtag(headers), '"audio-v2"');
});

test("rejects missing, empty, and weak ETags", () => {
  assert.equal(getStrongEtag(new Headers()), null);
  assert.equal(getStrongEtag(new Headers({ ETag: "" })), null);
  assert.equal(getStrongEtag(new Headers({ ETag: '""' })), null);
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
