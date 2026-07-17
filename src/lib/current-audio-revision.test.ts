import assert from "node:assert/strict";
import test from "node:test";
import { getCurrentChapterAudioIdentity } from "./current-audio-revision";

const fallback = {
  audioRevision: 1,
  src: "/api/chapters/chapter-1/audio?revision=1",
};

test("player conectado descobre uma revisao publicada depois da montagem", async () => {
  const requests: Array<{ input: string; init?: RequestInit }> = [];
  const identity = await getCurrentChapterAudioIdentity(
    "chapter-1",
    fallback,
    {
      online: true,
      fetcher: async (input, init) => {
        requests.push({ input: String(input), init });
        return new Response(JSON.stringify({
          audioRevision: 2,
          src: "/api/chapters/chapter-1/audio?revision=2",
        }), { status: 200 });
      },
    },
  );

  assert.deepEqual(identity, {
    audioRevision: 2,
    src: "/api/chapters/chapter-1/audio?revision=2",
  });
  assert.equal(requests[0].input, "/api/chapters/chapter-1/audio-revision");
  assert.equal(requests[0].init?.cache, "no-store");
});

test("player realmente offline preserva a copia conhecida sem consultar rede", async () => {
  let fetchCalls = 0;
  const identity = await getCurrentChapterAudioIdentity(
    "chapter-1",
    fallback,
    {
      online: false,
      fetcher: async () => {
        fetchCalls += 1;
        throw new Error("unexpected");
      },
    },
  );

  assert.deepEqual(identity, fallback);
  assert.equal(fetchCalls, 0);
});

test("resposta de revisao invalida nao autoriza reutilizar audio antigo online", async () => {
  await assert.rejects(
    getCurrentChapterAudioIdentity("chapter-1", fallback, {
      online: true,
      fetcher: async () => new Response(JSON.stringify({ audioRevision: 2 }), { status: 200 }),
    }),
    /revisao atual do audio/i,
  );
});
