import assert from "node:assert/strict";
import { test } from "node:test";
import { getReusableAudioCacheModes } from "./audio-cache";

test("player online reaproveita cache offline antes de baixar novamente", () => {
  assert.deepEqual(getReusableAudioCacheModes("temporary"), ["offline", "temporary"]);
});

test("salvar offline reaproveita audio temporario baixado pelo play", () => {
  assert.deepEqual(getReusableAudioCacheModes("offline"), ["offline", "temporary"]);
});
