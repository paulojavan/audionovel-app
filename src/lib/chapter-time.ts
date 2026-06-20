export function getDurationFromRange(startSec: number, endSec: number) {
  return Math.max(0, endSec - startSec);
}
