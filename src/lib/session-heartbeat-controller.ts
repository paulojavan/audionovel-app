export const SESSION_HEARTBEAT_LOCK_NAME =
  "audio-novel-session-heartbeat-refresh";

type HeartbeatLock = object;

type RequestLock = (
  name: string,
  options: { ifAvailable: true },
  callback: (lock: HeartbeatLock | null) => Promise<void>,
) => Promise<void>;

type SessionHeartbeatControllerOptions = {
  fetchSession: (signal: AbortSignal) => Promise<unknown>;
  requestLock?: RequestLock;
};

export function createSessionHeartbeatController({
  fetchSession,
  requestLock,
}: SessionHeartbeatControllerOptions) {
  let activeController: AbortController | null = null;
  let inFlight: Promise<void> | null = null;
  let cancelled = false;

  const fetchOnce = async () => {
    if (cancelled) {
      return;
    }

    const controller = new AbortController();
    activeController = controller;
    try {
      await fetchSession(controller.signal);
    } finally {
      if (activeController === controller) {
        activeController = null;
      }
    }
  };

  const refresh = () => {
    if (cancelled) {
      return Promise.resolve();
    }
    if (inFlight) {
      return inFlight;
    }

    const refreshPromise = (
      requestLock
        ? requestLock(
            SESSION_HEARTBEAT_LOCK_NAME,
            { ifAvailable: true },
            async (lock) => {
              if (lock) {
                await fetchOnce();
              }
            },
          )
        : fetchOnce()
    ).catch(() => undefined);

    inFlight = refreshPromise.finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  const cancel = () => {
    cancelled = true;
    activeController?.abort();
  };

  return { cancel, refresh };
}
