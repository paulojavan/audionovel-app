import assert from "node:assert/strict";
import test from "node:test";
import { enqueueOfflineDownload, type OfflineDownloadQueueStatus } from "./offline-download-queue";

test("fila de downloads offline executa apenas um download por vez", async () => {
  const events: string[] = [];
  const statuses: OfflineDownloadQueueStatus[] = [];
  let releaseFirstDownload!: () => void;

  const firstDownload = enqueueOfflineDownload(async () => {
    events.push("first:start");
    await new Promise<void>((resolve) => {
      releaseFirstDownload = resolve;
    });
    events.push("first:end");
    return "first";
  });

  const secondDownload = enqueueOfflineDownload(async () => {
    events.push("second:start");
    return "second";
  }, (status) => statuses.push(status));

  await Promise.resolve();
  assert.deepEqual(events, ["first:start"]);
  assert.deepEqual(statuses.at(-1), { state: "queued", position: 1 });

  releaseFirstDownload();

  assert.equal(await firstDownload, "first");
  assert.equal(await secondDownload, "second");
  assert.deepEqual(events, ["first:start", "first:end", "second:start"]);
  assert.deepEqual(statuses.at(-1), { state: "running", position: 0 });
});
