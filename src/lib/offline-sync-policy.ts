const SUCCESS_INTERVAL_MS = 5 * 60_000;
const FAILURE_INTERVAL_MS = 60_000;

export type OfflineSyncOutcome = "success" | "failure";

export function getOfflineSyncNextAttemptAt(
  outcome: OfflineSyncOutcome,
  now = Date.now(),
) {
  return now + (
    outcome === "success" ? SUCCESS_INTERVAL_MS : FAILURE_INTERVAL_MS
  );
}

export function shouldStartOfflineSync(
  storedNextAttemptAt: string | null,
  now = Date.now(),
) {
  const nextAttemptAt = Number(storedNextAttemptAt);
  return !Number.isFinite(nextAttemptAt) || nextAttemptAt <= now;
}
