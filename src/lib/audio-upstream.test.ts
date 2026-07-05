import assert from "node:assert/strict";
import { test } from "node:test";
import { openAudioUpstream } from "./audio-upstream";

test("uses a fresh controller, 15 second timeout, and exact continuation headers", async () => {
  const request = new AbortController();
  const seenSignals: AbortSignal[] = [];
  const seenHeaders: Headers[] = [];
  const timeoutDelays: number[] = [];
  const cleared: unknown[] = [];
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const timeoutToken = { timeout: true };

  globalThis.setTimeout = ((callback: TimerHandler, delay?: number) => {
    void callback;
    timeoutDelays.push(delay ?? 0);
    return timeoutToken;
  }) as unknown as typeof setTimeout;
  globalThis.clearTimeout = ((token: unknown) => {
    cleared.push(token);
  }) as typeof clearTimeout;

  try {
    const fetcher = async (_url: string | URL | Request, init?: RequestInit) => {
      seenSignals.push(init?.signal as AbortSignal);
      seenHeaders.push(new Headers(init?.headers));
      assert.equal(init?.cache, "no-store");
      assert.equal(init?.redirect, "manual");
      return new Response(new Uint8Array([1]));
    };
    const continuation = new Headers({
      Range: "bytes=25-",
      "If-Range": '"audio-v1"',
    });

    await openAudioUpstream(
      "https://media.example/audio.mp3",
      continuation,
      request.signal,
      fetcher,
    );
    await openAudioUpstream(
      "https://media.example/audio.mp3",
      continuation,
      request.signal,
      fetcher,
    );

    assert.notEqual(seenSignals[0], seenSignals[1]);
    assert.deepEqual(timeoutDelays, [15_000, 15_000]);
    assert.deepEqual(cleared, [timeoutToken, timeoutToken]);
    assert.deepEqual([...seenHeaders[0].entries()], [
      ["if-range", '"audio-v1"'],
      ["range", "bytes=25-"],
    ]);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("aborts a pending upstream fetch when the client disconnects", async () => {
  const request = new AbortController();
  let fetchSignal: AbortSignal | undefined;
  const fetcher = (_url: string | URL | Request, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      fetchSignal = init?.signal ?? undefined;
      fetchSignal?.addEventListener(
        "abort",
        () => reject(fetchSignal?.reason),
        { once: true },
      );
    });

  const pending = openAudioUpstream(
    "https://media.example/audio.mp3",
    new Headers(),
    request.signal,
    fetcher,
  );
  request.abort(new DOMException("client disconnected", "AbortError"));

  await assert.rejects(pending, /client disconnected/i);
  assert.equal(fetchSignal?.aborted, true);
});

test("fails before fetch when the client signal is already aborted", async () => {
  const request = new AbortController();
  let calls = 0;
  request.abort();

  await assert.rejects(
    openAudioUpstream(
      "https://media.example/audio.mp3",
      new Headers(),
      request.signal,
      async () => {
        calls += 1;
        return new Response();
      },
    ),
    { name: "AbortError" },
  );
  assert.equal(calls, 0);
});

test("removes the client abort listener after upstream headers arrive", async () => {
  const request = new AbortController();
  const signal = request.signal;
  const originalAdd = signal.addEventListener.bind(signal);
  const originalRemove = signal.removeEventListener.bind(signal);
  let added: EventListenerOrEventListenerObject | undefined;
  let removed: EventListenerOrEventListenerObject | undefined;

  signal.addEventListener = ((
    type: "abort",
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => {
    if (type === "abort") added = listener;
    originalAdd(type, listener, options);
  }) as typeof signal.addEventListener;
  signal.removeEventListener = ((
    type: "abort",
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ) => {
    if (type === "abort") removed = listener;
    originalRemove(type, listener, options);
  }) as typeof signal.removeEventListener;

  await openAudioUpstream(
    "https://media.example/audio.mp3",
    new Headers(),
    signal,
    async () => new Response(),
  );

  assert.ok(added);
  assert.equal(removed, added);
});
