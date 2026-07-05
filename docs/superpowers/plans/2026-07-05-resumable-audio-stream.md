# Resumable Audio Stream Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resume interrupted R2 audio responses at the exact next byte and give the browser one bounded fallback reload that preserves playback position.

**Architecture:** Isolate byte-range parsing and upstream continuation in a server-only streaming helper used by the audio Route Handler. Keep a second, small client policy for a single media-element reload after terminal network failure; the existing encrypted offline download path remains unchanged.

**Tech Stack:** Next.js 16.2.9 Route Handlers, Web `ReadableStream`, Cloudflare R2 HTTP Range requests, React 19, TypeScript, Node test runner through `tsx`.

---

## File structure

- Create `src/lib/resumable-audio-stream.ts`: server-owned stream, exact Range continuation, cancellation, and sanitized upstream diagnostics.
- Create `src/lib/resumable-audio-stream.test.ts`: interrupted-stream, early-EOF, invalid-range, retry-bound, and cancellation tests.
- Create `src/lib/audio-player-retry.ts`: pure one-reload decision and retry URL builder.
- Create `src/lib/audio-player-retry.test.ts`: client retry policy tests.
- Modify `src/app/api/chapters/[id]/audio/route.ts`: use the resumable body while preserving authorization and headers.
- Modify `src/components/audio-player.tsx`: restore playback position after one terminal media reload.
- Modify `src/lib/audio-resilience-wiring.test.ts`: ensure server and player integrations remain connected.

### Task 1: Exact byte-range helpers

**Files:**
- Create: `src/lib/resumable-audio-stream.ts`
- Test: `src/lib/resumable-audio-stream.test.ts`

- [ ] **Step 1: Write failing range tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  getAudioResponseStart,
  getContinuationRange,
  isExactContinuationResponse,
} from "./resumable-audio-stream";

test("calcula o proximo byte para resposta completa e parcial", () => {
  assert.equal(getAudioResponseStart(null, 200, null), 0);
  assert.equal(
    getAudioResponseStart("bytes=100-", 206, "bytes 100-199/1000"),
    100,
  );
  assert.equal(getContinuationRange(100, 25), "bytes=125-");
});

test("aceita somente continuacao 206 no byte exato", () => {
  assert.equal(
    isExactContinuationResponse(
      new Response(new Uint8Array([1]), {
        status: 206,
        headers: { "Content-Range": "bytes 125-125/1000" },
      }),
      125,
    ),
    true,
  );
  assert.equal(
    isExactContinuationResponse(
      new Response(new Uint8Array([1]), {
        status: 200,
        headers: { "Content-Range": "bytes 125-125/1000" },
      }),
      125,
    ),
    false,
  );
  assert.equal(
    isExactContinuationResponse(
      new Response(new Uint8Array([1]), {
        status: 206,
        headers: { "Content-Range": "bytes 124-124/1000" },
      }),
      125,
    ),
    false,
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test src/lib/resumable-audio-stream.test.ts`

Expected: FAIL because `./resumable-audio-stream` does not exist.

- [ ] **Step 3: Implement range parsing**

```ts
function parseOpenEndedRange(value: string | null) {
  const match = value?.match(/^bytes=(\d+)-$/i);
  return match ? Number(match[1]) : null;
}

function parseContentRange(value: string | null) {
  const match = value?.match(/^bytes (\d+)-(\d+)\/(\d+|\*)$/i);
  if (!match) return null;
  return { start: Number(match[1]), end: Number(match[2]) };
}

export function getAudioResponseStart(
  requestRange: string | null,
  status: number,
  contentRange: string | null,
) {
  if (status === 200 && requestRange === null) return 0;
  const parsed = parseContentRange(contentRange);
  const requestedStart = parseOpenEndedRange(requestRange);
  if (status !== 206 || !parsed || requestedStart === null || parsed.start !== requestedStart) {
    return null;
  }
  return parsed.start;
}

export function getContinuationRange(responseStart: number, deliveredBytes: number) {
  return `bytes=${responseStart + deliveredBytes}-`;
}

export function isExactContinuationResponse(response: Response, expectedStart: number) {
  const parsed = parseContentRange(response.headers.get("content-range"));
  return response.status === 206 && Boolean(response.body) && parsed?.start === expectedStart;
}
```

- [ ] **Step 4: Run range tests**

Run: `npx tsx --test src/lib/resumable-audio-stream.test.ts`

Expected: both tests PASS.

- [ ] **Step 5: Commit range helpers**

```powershell
git add src/lib/resumable-audio-stream.ts src/lib/resumable-audio-stream.test.ts
git commit -m "feat: add exact audio range continuation helpers"
```

### Task 2: Resumable server-owned stream

**Files:**
- Modify: `src/lib/resumable-audio-stream.ts`
- Modify: `src/lib/resumable-audio-stream.test.ts`

- [ ] **Step 1: Add a failing interrupted-stream test**

```ts
import { createResumableAudioStream } from "./resumable-audio-stream";

async function readBytes(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const values: number[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) return values;
    values.push(...value);
  }
}

test("retoma stream interrompido no proximo byte", async () => {
  let pulls = 0;
  const firstBody = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pulls++ === 0) controller.enqueue(new Uint8Array([1, 2]));
      else controller.error(new TypeError("terminated"));
    },
  });
  const ranges: string[] = [];
  const stream = createResumableAudioStream({
    initialResponse: new Response(firstBody, {
      status: 200,
      headers: { "Content-Length": "4" },
    }),
    requestRange: null,
    openRange: async (range) => {
      ranges.push(range);
      return new Response(new Uint8Array([3, 4]), {
        status: 206,
        headers: { "Content-Range": "bytes 2-3/4", "Content-Length": "2" },
      });
    },
    maxContinuations: 2,
  });

  assert.deepEqual(await readBytes(stream), [1, 2, 3, 4]);
  assert.deepEqual(ranges, ["bytes=2-"]);
});
```

- [ ] **Step 2: Add failing early-EOF and invalid-continuation tests**

```ts
test("retoma quando EOF chega antes do Content-Length", async () => {
  const ranges: string[] = [];
  const stream = createResumableAudioStream({
    initialResponse: new Response(new Uint8Array([1, 2]), {
      status: 200,
      headers: { "Content-Length": "4" },
    }),
    requestRange: null,
    openRange: async (range) => {
      ranges.push(range);
      return new Response(new Uint8Array([3, 4]), {
        status: 206,
        headers: { "Content-Range": "bytes 2-3/4" },
      });
    },
  });
  assert.deepEqual(await readBytes(stream), [1, 2, 3, 4]);
  assert.deepEqual(ranges, ["bytes=2-"]);
});

test("rejeita continuacao que comeca no byte errado", async () => {
  const stream = createResumableAudioStream({
    initialResponse: new Response(new Uint8Array([1]), {
      status: 200,
      headers: { "Content-Length": "2" },
    }),
    requestRange: null,
    openRange: async () => new Response(new Uint8Array([2]), {
      status: 206,
      headers: { "Content-Range": "bytes 0-0/2" },
    }),
    maxContinuations: 1,
  });
  await assert.rejects(() => readBytes(stream), /continuacao invalida/i);
});
```

- [ ] **Step 3: Run tests to verify the new cases fail**

Run: `npx tsx --test src/lib/resumable-audio-stream.test.ts`

Expected: FAIL because `createResumableAudioStream` is not exported.

- [ ] **Step 4: Implement bounded continuation**

Add to `src/lib/resumable-audio-stream.ts`:

```ts
export function createResumableAudioStream({
  initialResponse,
  requestRange,
  openRange,
  maxContinuations = 2,
  onFailure,
  downstreamSignal,
}: {
  initialResponse: Response;
  requestRange: string | null;
  openRange: (range: string) => Promise<Response>;
  maxContinuations?: number;
  onFailure?: (details: { attempt: number; byteOffset: number }) => void;
  downstreamSignal?: AbortSignal;
}) {
  const responseStart = getAudioResponseStart(
    requestRange,
    initialResponse.status,
    initialResponse.headers.get("content-range"),
  );
  if (responseStart === null || !initialResponse.body) {
    throw new Error("Resposta inicial de audio nao pode ser retomada.");
  }

  const expectedLengthValue = Number(initialResponse.headers.get("content-length"));
  const expectedLength =
    Number.isFinite(expectedLengthValue) && expectedLengthValue >= 0
      ? expectedLengthValue
      : null;
  let reader = initialResponse.body.getReader();
  let deliveredBytes = 0;
  let continuations = 0;
  let cancelled = downstreamSignal?.aborted ?? false;
  const cancelFromDownstream = () => {
    cancelled = true;
    void reader.cancel("client disconnected").catch(() => undefined);
  };
  const cleanupAbortListener = () => {
    downstreamSignal?.removeEventListener("abort", cancelFromDownstream);
  };
  downstreamSignal?.addEventListener("abort", cancelFromDownstream, { once: true });

  async function continueFromNextByte() {
    if (cancelled) throw new Error("Cliente cancelou o audio.");
    if (continuations >= maxContinuations) {
      throw new Error("Limite de retomadas do audio excedido.");
    }
    continuations += 1;
    const expectedStart = responseStart + deliveredBytes;
    onFailure?.({ attempt: continuations, byteOffset: expectedStart });
    const response = await openRange(getContinuationRange(responseStart, deliveredBytes));
    if (!isExactContinuationResponse(response, expectedStart) || !response.body) {
      throw new Error("Resposta de continuacao invalida.");
    }
    reader = response.body.getReader();
  }

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        try {
          const { done, value } = await reader.read();
          if (cancelled) {
            cleanupAbortListener();
            controller.close();
            return;
          }
          if (!done && value) {
            deliveredBytes += value.byteLength;
            controller.enqueue(value);
            return;
          }
          if (expectedLength === null || deliveredBytes >= expectedLength) {
            cleanupAbortListener();
            controller.close();
            return;
          }
          await continueFromNextByte();
        } catch (error) {
          if (cancelled) {
            cleanupAbortListener();
            controller.close();
            return;
          }
          if (
            error instanceof Error &&
            /Limite de retomadas|continuacao invalida/.test(error.message)
          ) {
            controller.error(error);
            return;
          }
          try {
            await continueFromNextByte();
          } catch (continuationError) {
            controller.error(continuationError);
            return;
          }
        }
      }
    },
    async cancel(reason) {
      cancelled = true;
      cleanupAbortListener();
      await reader.cancel(reason).catch(() => undefined);
    },
  });
}
```

- [ ] **Step 5: Add a bounded-retry test**

```ts
test("limita retomadas", async () => {
  let opens = 0;
  const broken = () => new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.error(new TypeError("terminated"));
    },
  });
  const stream = createResumableAudioStream({
    initialResponse: new Response(broken(), {
      status: 200,
      headers: { "Content-Length": "1" },
    }),
    requestRange: null,
    openRange: async (range) => {
      opens += 1;
      const start = Number(range.match(/\d+/)?.[0] ?? 0);
      return new Response(broken(), {
        status: 206,
        headers: { "Content-Range": `bytes ${start}-${start}/1` },
      });
    },
    maxContinuations: 2,
  });
  await assert.rejects(() => readBytes(stream), /limite/i);
  assert.equal(opens, 2);
});
```

- [ ] **Step 6: Run resumable-stream tests**

Run: `npx tsx --test src/lib/resumable-audio-stream.test.ts`

Expected: all tests PASS.

- [ ] **Step 7: Commit stream recovery**

```powershell
git add src/lib/resumable-audio-stream.ts src/lib/resumable-audio-stream.test.ts
git commit -m "feat: resume interrupted R2 audio streams"
```

### Task 3: Route Handler integration and cancellation

**Files:**
- Modify: `src/app/api/chapters/[id]/audio/route.ts`
- Modify: `src/lib/resumable-audio-stream.ts`
- Modify: `src/lib/resumable-audio-stream.test.ts`
- Modify: `src/lib/audio-resilience-wiring.test.ts`

- [ ] **Step 1: Add a failing cancellation test**

```ts
test("cancelamento do cliente cancela o leitor sem retomar", async () => {
  let cancelled = false;
  let opens = 0;
  const downstream = new AbortController();
  const body = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true;
    },
  });
  const stream = createResumableAudioStream({
    initialResponse: new Response(body, {
      status: 200,
      headers: { "Content-Length": "10" },
    }),
    requestRange: null,
    openRange: async () => {
      opens += 1;
      throw new Error("nao deveria abrir");
    },
    downstreamSignal: downstream.signal,
  });
  const read = stream.getReader().read();
  downstream.abort();
  await read;
  assert.equal(cancelled, true);
  assert.equal(opens, 0);
});
```

- [ ] **Step 2: Extend the wiring test before changing the route**

Add:

```ts
test("rota usa stream retomavel e propaga cancelamento", () => {
  assert.match(audioRoute, /createResumableAudioStream/);
  assert.match(audioRoute, /request\.signal/);
  assert.match(audioRoute, /bytes=/);
});
```

- [ ] **Step 3: Run targeted tests to verify they fail**

Run: `npx tsx --test src/lib/resumable-audio-stream.test.ts src/lib/audio-resilience-wiring.test.ts`

Expected: wiring test FAIL because the route still returns `upstream.body` directly.

- [ ] **Step 4: Add one timed upstream opener in the route**

Import the helper:

```ts
import { createResumableAudioStream } from "@/lib/resumable-audio-stream";
```

Replace the current one-off fetch block with a local opener that creates a fresh timeout for every attempt:

```ts
const openUpstream = async (requestedRange: string | null) => {
  if (request.signal.aborted) throw new DOMException("Aborted", "AbortError");
  const controller = new AbortController();
  const abortFromClient = () => controller.abort();
  request.signal.addEventListener("abort", abortFromClient, { once: true });
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(media.audioUrl, {
      headers: requestedRange ? { range: requestedRange } : {},
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abortFromClient);
  }
};

let upstream: Response;
try {
  upstream = await openUpstream(range);
} catch {
  return NextResponse.json({ error: "Audio temporariamente indisponivel." }, { status: 502 });
}
```

- [ ] **Step 5: Return the resumable body**

After the existing redirect and response-validity checks:

```ts
const body = createResumableAudioStream({
  initialResponse: upstream,
  requestRange: range,
  openRange: openUpstream,
  maxContinuations: 2,
  downstreamSignal: request.signal,
  onFailure({ attempt, byteOffset }) {
    console.warn(JSON.stringify({
      event: "audio_upstream_interrupted",
      timestamp: new Date().toISOString(),
      attempt,
      byteOffset,
    }));
  },
});
```

Change the returned response body from `upstream.body` to `body`. The diagnostic intentionally excludes chapter ID, media URL, account, headers, and upstream error text.

- [ ] **Step 6: Run targeted server tests**

Run: `npx tsx --test src/lib/resumable-audio-stream.test.ts src/lib/chapter-view.test.ts src/lib/audio-resilience-wiring.test.ts`

Expected: all tests PASS.

- [ ] **Step 7: Run lint**

Run: `npm run lint`

Expected: exit 0.

- [ ] **Step 8: Commit route integration**

```powershell
git add src/lib/resumable-audio-stream.ts src/lib/resumable-audio-stream.test.ts src/app/api/chapters/[id]/audio/route.ts src/lib/audio-resilience-wiring.test.ts
git commit -m "feat: recover interrupted audio proxy responses"
```

### Task 4: One bounded player reload

**Files:**
- Create: `src/lib/audio-player-retry.ts`
- Create: `src/lib/audio-player-retry.test.ts`
- Modify: `src/components/audio-player.tsx`
- Modify: `src/lib/audio-resilience-wiring.test.ts`

- [ ] **Step 1: Write failing player-policy tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildAudioRetrySource, shouldRetryMediaError } from "./audio-player-retry";

test("retenta somente uma falha de rede ou decodificacao", () => {
  assert.equal(shouldRetryMediaError({ errorCode: 2, retryCount: 0 }), true);
  assert.equal(shouldRetryMediaError({ errorCode: 3, retryCount: 0 }), true);
  assert.equal(shouldRetryMediaError({ errorCode: 2, retryCount: 1 }), false);
  assert.equal(shouldRetryMediaError({ errorCode: 4, retryCount: 0 }), false);
});

test("adiciona tentativa sem perder query existente", () => {
  assert.equal(
    buildAudioRetrySource("/api/chapters/1/audio?offline=key", 1),
    "/api/chapters/1/audio?offline=key&streamRetry=1",
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx tsx --test src/lib/audio-player-retry.test.ts`

Expected: FAIL because `./audio-player-retry` does not exist.

- [ ] **Step 3: Implement the policy**

```ts
export function shouldRetryMediaError({
  errorCode,
  retryCount,
}: {
  errorCode: number | null;
  retryCount: number;
}) {
  return retryCount < 1 && (errorCode === 2 || errorCode === 3);
}

export function buildAudioRetrySource(source: string, retryCount: number) {
  const separator = source.includes("?") ? "&" : "?";
  return `${source}${separator}streamRetry=${retryCount}`;
}
```

- [ ] **Step 4: Run the policy tests**

Run: `npx tsx --test src/lib/audio-player-retry.test.ts`

Expected: both tests PASS.

- [ ] **Step 5: Add the player wiring assertions**

Add:

```ts
test("player retenta uma vez e restaura a posicao", () => {
  assert.match(player, /shouldRetryMediaError/);
  assert.match(player, /buildAudioRetrySource/);
  assert.match(player, /pendingRetryPlaybackRef/);
  assert.match(player, /streamRetry/);
});
```

- [ ] **Step 6: Wire bounded retry into the player**

Import the helpers:

```ts
import { buildAudioRetrySource, shouldRetryMediaError } from "@/lib/audio-player-retry";
```

Add state and refs beside the existing audio refs:

```ts
const retryCountRef = useRef(0);
const pendingRetryPlaybackRef = useRef<{ position: number; resume: boolean } | null>(null);
const [audioSource, setAudioSource] = useState(src);
```

Reset when the chapter source changes:

```ts
useEffect(() => {
  retryCountRef.current = 0;
  pendingRetryPlaybackRef.current = null;
  setAudioSource(src);
}, [src]);
```

Change `<audio src={src}>` to `<audio src={audioSource}>` and add:

```tsx
onError={(event) => {
  const audio = event.currentTarget;
  const errorCode = audio.error?.code ?? null;
  if (shouldRetryMediaError({ errorCode, retryCount: retryCountRef.current })) {
    retryCountRef.current += 1;
    pendingRetryPlaybackRef.current = {
      position: audio.currentTime,
      resume: !audio.paused || playbackStartedRef.current,
    };
    setAudioSource(buildAudioRetrySource(src, retryCountRef.current));
    return;
  }
  setPlaying(false);
  setKaraokeMode(false);
  setPlaybackError("A conexao com o audio foi interrompida. Toque em play para tentar novamente.");
}}
```

At the end of `onLoadedMetadata`, restore once:

```ts
const pendingRetry = pendingRetryPlaybackRef.current;
if (pendingRetry) {
  pendingRetryPlaybackRef.current = null;
  event.currentTarget.currentTime = pendingRetry.position;
  if (pendingRetry.resume) {
    void event.currentTarget.play().catch(() => {
      setPlaying(false);
      setKaraokeMode(false);
      setPlaybackError("A conexao com o audio foi interrompida. Toque em play para tentar novamente.");
    });
  }
}
```

Do not reset `retryCountRef` on metadata load; it resets only when the `src` prop changes, preventing a retry loop.

- [ ] **Step 7: Run targeted client tests**

Run: `npx tsx --test src/lib/audio-player-retry.test.ts src/lib/audio-resilience-wiring.test.ts src/lib/audio-progress.test.ts`

Expected: all tests PASS.

- [ ] **Step 8: Commit the player fallback**

```powershell
git add src/lib/audio-player-retry.ts src/lib/audio-player-retry.test.ts src/components/audio-player.tsx src/lib/audio-resilience-wiring.test.ts
git commit -m "feat: retry interrupted audio playback once"
```

### Task 5: Audio verification

**Files:**
- Verify only; no expected source changes.

- [ ] **Step 1: Re-run offline retry regression**

Run: `npx tsx --test src/lib/audio-cache.test.ts`

Expected: the existing test `download de audio retoma do byte recebido quando a conexao cai` PASS.

- [ ] **Step 2: Run all audio-focused tests**

Run: `npx tsx --test src/lib/resumable-audio-stream.test.ts src/lib/audio-player-retry.test.ts src/lib/audio-cache.test.ts src/lib/audio-resilience-wiring.test.ts src/lib/chapter-view.test.ts`

Expected: all tests PASS.

- [ ] **Step 3: Run the complete suite**

Run: `npm test`

Expected: exit 0.

- [ ] **Step 4: Run lint**

Run: `npm run lint`

Expected: exit 0.

- [ ] **Step 5: Run production build**

Run: `npm run build`

Expected: exit 0. Report database reachability warnings separately from the build result.

- [ ] **Step 6: Inspect the final diff**

Run: `git diff HEAD~4 --check`

Expected: no whitespace errors.

- [ ] **Step 7: Confirm clean task state**

Run: `git status --short`

Expected: clean worktree after the task commits.
