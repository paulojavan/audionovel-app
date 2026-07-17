import assert from "node:assert/strict";
import test from "node:test";
import { isOfflineItemRevisionCurrent } from "./offline-items";

test("somente a mesma revisao pode aparecer como salva offline", () => {
  assert.equal(isOfflineItemRevisionCurrent(2, 2), true);
  assert.equal(isOfflineItemRevisionCurrent(1, 2), false);
  assert.equal(isOfflineItemRevisionCurrent(undefined, 2), false);
});
