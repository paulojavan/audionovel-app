import assert from "node:assert/strict";
import test from "node:test";
import { buildAudioRetrySource, shouldRetryMediaError } from "./audio-player-retry";

test("retries one network or decode media failure", () => {
  assert.equal(shouldRetryMediaError({ errorCode: 2, retryCount: 0 }), true);
  assert.equal(shouldRetryMediaError({ errorCode: 3, retryCount: 0 }), true);
});

test("does not retry unsupported media failures or a second failure", () => {
  for (const errorCode of [0, 1, 4, null]) {
    assert.equal(shouldRetryMediaError({ errorCode, retryCount: 0 }), false);
  }
  assert.equal(shouldRetryMediaError({ errorCode: 2, retryCount: 1 }), false);
  assert.equal(shouldRetryMediaError({ errorCode: 3, retryCount: 2 }), false);
});

test("adds streamRetry without changing an offline key or hash", () => {
  assert.equal(
    buildAudioRetrySource("/api/chapters/chapter-1/audio?offline=secret-key#resume", 1),
    "/api/chapters/chapter-1/audio?offline=secret-key&streamRetry=1#resume",
  );
});

test("replaces duplicate streamRetry parameters on a relative source", () => {
  assert.equal(
    buildAudioRetrySource("api/audio?streamRetry=0&quality=high&streamRetry=8#player", 1),
    "api/audio?streamRetry=1&quality=high#player",
  );
});

test("adds streamRetry to a source without an existing query", () => {
  assert.equal(
    buildAudioRetrySource("/api/chapters/chapter-1/audio#player", 1),
    "/api/chapters/chapter-1/audio?streamRetry=1#player",
  );
});
