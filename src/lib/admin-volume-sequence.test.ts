import assert from "node:assert/strict";
import test from "node:test";
import { getNextVolumePosition } from "./admin-volume-sequence";

test("sugere o proximo inteiro depois de volumes intermediarios", () => {
  assert.equal(getNextVolumePosition([{ position: 0 }, { position: 1 }, { position: 2.5 }]), 3);
});

test("sugere um para uma novel sem volumes", () => {
  assert.equal(getNextVolumePosition([]), 1);
});
