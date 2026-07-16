import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import * as audioCache from "./audio-cache";

const { getReusableAudioCacheModes } = audioCache;
const audioCacheSource = readFileSync(
  join(process.cwd(), "src", "lib", "audio-cache.ts"),
  "utf8",
);

type AudioDownloadHttpErrorConstructor = new (
  status: number,
  message?: string,
) => Error & { status: number };

function getAudioDownloadHttpErrorConstructor() {
  return (
    audioCache as typeof audioCache & {
      AudioDownloadHttpError?: AudioDownloadHttpErrorConstructor;
    }
  ).AudioDownloadHttpError;
}

test("cache offline nunca ultrapassa a validade da licenca", () => {
  const now = new Date("2026-07-10T12:00:00.000Z").getTime();
  const licenseExpiry = now + 60 * 60_000;
  assert.equal(
    audioCache.getAudioCacheExpiry("offline", now, licenseExpiry),
    licenseExpiry,
  );
});

test("cache temporario preserva seu limite padrao", () => {
  const now = new Date("2026-07-10T12:00:00.000Z").getTime();
  assert.equal(
    audioCache.getAudioCacheExpiry("temporary", now),
    now + 2 * 24 * 60 * 60_000,
  );
});

test("cache offline acompanha uma licenca premium superior a sete dias", () => {
  const now = new Date("2026-07-10T12:00:00.000Z").getTime();
  const premiumExpiry = now + 30 * 24 * 60 * 60_000;
  assert.equal(
    audioCache.getAudioCacheExpiry("offline", now, premiumExpiry),
    premiumExpiry,
  );
});

test("recuperacao consulta chaves sem materializar blobs expirados", () => {
  const source = readFileSync(join(process.cwd(), "src", "lib", "audio-cache.ts"), "utf8");
  const recoverableBlock = source.match(
    /export async function getRecoverableOfflineItems[\s\S]*?\r?\n}\r?\n/,
  )?.[0] ?? "";
  assert.match(recoverableBlock, /readOfflineCatalogSnapshot/);
  assert.match(recoverableBlock, /selectRecoverableOfflineItems/);
  assert.doesNotMatch(recoverableBlock, /readRecord/);
  assert.doesNotMatch(recoverableBlock, /cleanupExpired/);
});

test("extensao de validade preserva o registro criptografado existente", () => {
  const source = readFileSync(join(process.cwd(), "src", "lib", "audio-cache.ts"), "utf8");
  const extensionBlock = source.match(
    /export async function extendOfflineAudioExpiry[\s\S]*?\r?\n}\r?\n/,
  )?.[0] ?? "";
  assert.match(extensionBlock, /readRecord/);
  assert.match(extensionBlock, /writeRecord\(\{[\s\S]*?\.\.\.record[\s\S]*?expiresAt/);
  assert.doesNotMatch(extensionBlock, /deleteRecord/);
});

test("reproducao offline direcionada nao executa limpeza global", () => {
  const playbackBlock = audioCacheSource.match(
    /export async function getSavedEncryptedAudioUrl[\s\S]*?\r?\n}\r?\n/,
  )?.[0] ?? "";

  assert.match(playbackBlock, /getValidCachedRecord/);
  assert.match(playbackBlock, /createObjectUrlFromRecord/);
  assert.doesNotMatch(playbackBlock, /cleanupExpiredAudioCache/);
  assert.doesNotMatch(playbackBlock, /downloadAudioBuffer/);
});

test("remocao offline apaga somente as duas chaves do capitulo", () => {
  const removalBlock = audioCacheSource.match(
    /export async function removeOfflineItem[\s\S]*?\r?\n}\r?\n/,
  )?.[0] ?? "";

  assert.match(removalBlock, /OFFLINE_ITEMS_STORE_NAME/);
  assert.match(removalBlock, /STORE_NAME/);
  assert.match(removalBlock, /getAudioCacheId\(accountScope, chapterId, "offline"\)/);
  assert.doesNotMatch(removalBlock, /openCursor/);
});

test("renovacao offline agrupa audios e metadados em uma transacao", () => {
  const batchBlock = audioCacheSource.match(
    /export async function updateOfflineItemsBatch[\s\S]*?\r?\n}\r?\n/,
  )?.[0] ?? "";

  assert.match(batchBlock, /\[OFFLINE_ITEMS_STORE_NAME, STORE_NAME\]/);
  assert.match(batchBlock, /"readwrite"/);
  assert.match(batchBlock, /waitForTransaction/);
  assert.doesNotMatch(batchBlock, /saveOfflineItem/);
  assert.doesNotMatch(batchBlock, /cleanupExpiredAudioCache/);
});

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

test("salvar offline reutiliza cache offline ou temporario da mesma conta", () => {
  assert.deepEqual(getReusableAudioCacheModes("offline"), ["offline", "temporary"]);
});

test("play online reutiliza cache temporario por dois dias", () => {
  assert.deepEqual(getReusableAudioCacheModes("temporary"), ["temporary"]);
});

test("player online baixa o audio inteiro no cache criptografado apenas depois do play", () => {
  const playerSource = readFileSync(join(process.cwd(), "src", "components", "audio-player.tsx"), "utf8");
  assert.match(playerSource, /getEncryptedAudioUrl\(chapterId, src,/);
  assert.match(playerSource, /mode:\s*"temporary"/);
  assert.match(playerSource, /accountScope/);
  assert.match(playerSource, /src=\{activeAudioSource \|\| undefined\}/);
  assert.match(playerSource, /function toggle\(\)/);
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

test("download preserva 401 e a mensagem segura da API sem repetir a requisicao", async () => {
  const AudioDownloadHttpError = getAudioDownloadHttpErrorConstructor();
  assert.equal(typeof AudioDownloadHttpError, "function");
  if (!AudioDownloadHttpError) return;

  let attempts = 0;
  await assert.rejects(
    audioCache.downloadAudioBuffer("/audio", {
      fetcher: async () => {
        attempts += 1;
        return Response.json(
          { error: "Autenticacao obrigatoria." },
          { status: 401 },
        );
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof AudioDownloadHttpError);
      assert.equal(error.status, 401);
      assert.equal(error.message, "Autenticacao obrigatoria.");
      return true;
    },
  );
  assert.equal(attempts, 1);
});

test("download ignora corpo HTTP grande e usa mensagem segura generica", async () => {
  const AudioDownloadHttpError = getAudioDownloadHttpErrorConstructor();
  assert.equal(typeof AudioDownloadHttpError, "function");
  if (!AudioDownloadHttpError) return;

  await assert.rejects(
    audioCache.downloadAudioBuffer("/audio", {
      fetcher: async () => new Response(
        JSON.stringify({ error: "x".repeat(2_000) }),
        {
          status: 403,
          headers: {
            "Content-Length": "2012",
            "Content-Type": "application/json",
          },
        },
      ),
    }),
    (error: unknown) => {
      assert.ok(error instanceof AudioDownloadHttpError);
      assert.equal(error.status, 403);
      assert.equal(error.message, "Nao foi possivel baixar o audio.");
      return true;
    },
  );
});
