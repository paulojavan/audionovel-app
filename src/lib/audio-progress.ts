export const PROGRESS_CHECKPOINT_INTERVAL_MS = 15_000;

export function isPlaybackComplete(positionSec: number, durationSec: number, toleranceSec = 1) {
  return durationSec > 0 && positionSec >= Math.max(0, durationSec - toleranceSec);
}

export function mergeCompletion(previous: boolean, next: boolean) {
  return previous || next;
}

export function shouldSaveCheckpoint(lastSavedAt: number, now: number) {
  return now - lastSavedAt >= PROGRESS_CHECKPOINT_INTERVAL_MS;
}
