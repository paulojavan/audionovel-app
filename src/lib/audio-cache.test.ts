import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import * as audioCache from "./audio-cache";

const { getReusableAudioCacheModes } = audioCache;

test("cache de audio separa registros por conta", () => {
  assert.equal(
    audioCache.getAudioCacheId("user-a", "chapter-1", "offline"),
    "account:user-a:offline:chapter:chapter-1",
  );
  assert.notEqual(
    audioCache.getAudioCacheId("user-a", "chapter-1", "offline"),
    audioCache.getAudioCacheId("user-b", "chapter-1", "offline"),
  );
});

test("salvar offline reutiliza somente o cache offline da mesma conta", () => {
  assert.deepEqual(getReusableAudioCacheModes("offline"), ["offline"]);
});

test("player online transmite pelo proxy sem baixar o audio inteiro ao montar", () => {
  const playerSource = readFileSync(join(process.cwd(), "src", "components", "audio-player.tsx"), "utf8");
  assert.doesNotMatch(playerSource, /getEncryptedAudioUrl\(chapterId, src\)/);
  assert.doesNotMatch(playerSource, /setAudioSrc/);
  assert.match(playerSource, /src=\{src\}/);
});

test("download de audio retoma do byte recebido quando a conexao cai", async () => {
  const downloadAudioBuffer = (
    audioCache as typeof audioCache & {
      downloadAudioBuffer?: (
        sourceUrl: string,
        options: { fetcher: typeof fetch; maxAttempts: number },
      ) => Promise<ArrayBuffer>;
    }
  ).downloadAudioBuffer;
  assert.equal(typeof downloadAudioBuffer, "function");
  if (!downloadAudioBuffer) return;

  const requests: Array<{ range: string | null }> = [];
  const firstChunk = new Uint8Array([1, 2]);
  const remainingChunk = new Uint8Array([3, 4]);
  let attempt = 0;
  const fetcher: typeof fetch = async (_input, init) => {
    requests.push({ range: new Headers(init?.headers).get("range") });
    attempt += 1;

    if (attempt === 1) {
      let pullCount = 0;
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          if (pullCount === 0) {
            pullCount += 1;
            controller.enqueue(firstChunk);
            return;
          }
          await Promise.resolve();
          controller.error(new TypeError("HTTP/2 connection lost"));
        },
      });
      return new Response(body, {
        status: 200,
        headers: { "Content-Length": "4", "Content-Type": "audio/mpeg" },
      });
    }

    return new Response(remainingChunk, {
      status: 206,
      headers: {
        "Content-Length": "2",
        "Content-Range": "bytes 2-3/4",
        "Content-Type": "audio/mpeg",
      },
    });
  };

  const result = await downloadAudioBuffer("/audio", { fetcher, maxAttempts: 2 });

  assert.deepEqual([...new Uint8Array(result)], [1, 2, 3, 4]);
  assert.deepEqual(requests, [{ range: null }, { range: "bytes=2-" }]);
});
