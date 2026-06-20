import assert from "node:assert/strict";
import test from "node:test";
import { createClientDeviceIdValue } from "./client-device";

test("createClientDeviceIdValue falls back when randomUUID is unavailable", () => {
  const cryptoLike = {
    getRandomValues(bytes: Uint8Array) {
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = index;
      }
      return bytes;
    },
  };

  assert.equal(createClientDeviceIdValue(cryptoLike), "00010203-0405-4607-8809-0a0b0c0d0e0f");
});
