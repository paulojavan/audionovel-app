export const PROGRESS_CHECKPOINT_INTERVAL_MS = 15_000;

export function isPlaybackComplete(positionSec: number, durationSec: number, toleranceSec = 1) {
  return durationSec > 0 && positionSec >= Math.max(0, durationSec - toleranceSec);
}

// Um capitulo concluido (ou concluido pela tolerancia final) sempre recomeça do
// zero ao ser ouvido novamente; capitulos em andamento retomam de onde pararam.
export function getInitialResumePosition(positionSec: number, durationSec: number, completed: boolean) {
  return completed || isPlaybackComplete(positionSec, durationSec) ? 0 : positionSec;
}

export function shouldSaveCheckpoint(lastSavedAt: number, now: number) {
  return now - lastSavedAt >= PROGRESS_CHECKPOINT_INTERVAL_MS;
}
