import assert from "node:assert/strict";
import test from "node:test";
import {
  createClientDeviceIdValue,
  ensureClientDeviceToken,
} from "./client-device";

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

test("restaura cookie de dispositivo usando backup local assinado", async () => {
  const writes: string[] = [];
  const storage = {
    getItem() {
      return "signed-backup";
    },
    setItem(_key: string, value: string) {
      writes.push(value);
    },
  };

  const token = await ensureClientDeviceToken(
    async (_input, init) => {
      assert.deepEqual(JSON.parse(String(init?.body)), {
        backupToken: "signed-backup",
      });
      return Response.json({ token: "signed-backup" });
    },
    storage,
  );

  assert.equal(token, "signed-backup");
  assert.deepEqual(writes, ["signed-backup"]);
});

test("falha do armazenamento local nao impede preparar o dispositivo", async () => {
  const storage = {
    getItem(): string | null {
      throw new Error("storage blocked");
    },
    setItem(): void {
      throw new Error("storage blocked");
    },
  };

  const token = await ensureClientDeviceToken(
    async (_input, init) => {
      assert.deepEqual(JSON.parse(String(init?.body)), { backupToken: null });
      return Response.json({ token: "server-token" });
    },
    storage,
  );

  assert.equal(token, "server-token");
});
