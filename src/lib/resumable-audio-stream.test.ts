import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getAudioResponseStart,
  getContinuationRange,
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

test("recognizes an exact 206 continuation response with a body", () => {
  const response = new Response(new Uint8Array([1]), {
    status: 206,
    headers: { "Content-Range": "bytes 100-100/200" },
  });

  assert.equal(isExactContinuationResponse(response, 100), true);
});

test("rejects a 200 response as a continuation", () => {
  const response = new Response(new Uint8Array([1]), {
    status: 200,
    headers: { "Content-Range": "bytes 100-100/200" },
  });

  assert.equal(isExactContinuationResponse(response, 100), false);
});

test("rejects a continuation response starting at the wrong byte", () => {
  const response = new Response(new Uint8Array([1]), {
    status: 206,
    headers: { "Content-Range": "bytes 101-101/200" },
  });

  assert.equal(isExactContinuationResponse(response, 100), false);
});

test("rejects continuation responses missing a body or content range", () => {
  const missingBody = new Response(null, {
    status: 206,
    headers: { "Content-Range": "bytes 100-100/200" },
  });
  const missingContentRange = new Response(new Uint8Array([1]), {
    status: 206,
  });

  assert.equal(isExactContinuationResponse(missingBody, 100), false);
  assert.equal(isExactContinuationResponse(missingContentRange, 100), false);
});

test("rejects a continuation response whose content range ends before it starts", () => {
  const response = new Response(new Uint8Array([1]), {
    status: 206,
    headers: { "Content-Range": "bytes 100-99/200" },
  });

  assert.equal(isExactContinuationResponse(response, 100), false);
});
