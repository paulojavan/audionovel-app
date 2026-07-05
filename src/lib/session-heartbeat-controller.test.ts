import assert from "node:assert/strict";
import test from "node:test";
import {
  SESSION_HEARTBEAT_LOCK_NAME,
  createSessionHeartbeatController,
} from "./session-heartbeat-controller";

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test("serializes simultaneous refreshes within one tab", async () => {
  const pending = createDeferred();
  let fetches = 0;
  const controller = createSessionHeartbeatController({
    fetchSession: async () => {
      fetches += 1;
      await pending.promise;
    },
  });

  const first = controller.refresh();
  const second = controller.refresh();

  assert.equal(fetches, 1);
  pending.resolve();
  await Promise.all([first, second]);
  assert.equal(fetches, 1);
});

test("cancel aborts the active session request without rejecting refresh", async () => {
  let activeSignal: AbortSignal | undefined;
  const controller = createSessionHeartbeatController({
    fetchSession: (signal) =>
      new Promise<void>((_resolve, reject) => {
        activeSignal = signal;
        signal.addEventListener("abort", () => reject(new Error("aborted")), {
          once: true,
        });
      }),
  });

  const refresh = controller.refresh();
  controller.cancel();

  assert.equal(activeSignal?.aborted, true);
  await assert.doesNotReject(refresh);
});

test("skips the fetch when the cross-tab lock is unavailable", async () => {
  let fetches = 0;
  const controller = createSessionHeartbeatController({
    fetchSession: async () => {
      fetches += 1;
    },
    requestLock: async (_name, _options, callback) => {
      await callback(null);
    },
  });

  await controller.refresh();

  assert.equal(fetches, 0);
});

test("holds the stable cross-tab lock while fetching once", async () => {
  let fetches = 0;
  let requestedName: string | undefined;
  let requestedOptions: { ifAvailable: true } | undefined;
  const controller = createSessionHeartbeatController({
    fetchSession: async () => {
      fetches += 1;
    },
    requestLock: async (name, options, callback) => {
      requestedName = name;
      requestedOptions = options;
      await callback({});
    },
  });

  await controller.refresh();

  assert.equal(requestedName, SESSION_HEARTBEAT_LOCK_NAME);
  assert.deepEqual(requestedOptions, { ifAvailable: true });
  assert.equal(fetches, 1);
});

test("swallows rejected session requests", async () => {
  const controller = createSessionHeartbeatController({
    fetchSession: async () => {
      throw new Error("offline");
    },
  });

  await assert.doesNotReject(controller.refresh());
});
