export function getNextVolumePosition(volumes: Array<{ position: number }>) {
  const highestPosition = volumes.reduce((highest, volume) => Math.max(highest, volume.position), 0);
  return Math.floor(highestPosition) + 1;
}
