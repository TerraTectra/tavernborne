export const REALTIME_MS_PER_GAME_HOUR = 5 * 60 * 1000;

export const realtimeIntervalMs = (speedMultiplier: number): number => {
  const safeMultiplier = Number.isFinite(speedMultiplier) && speedMultiplier > 0 ? speedMultiplier : 1;
  return Math.round(REALTIME_MS_PER_GAME_HOUR / safeMultiplier);
};

export const realtimeRateLabel = (speedMultiplier: number): string => {
  const totalSeconds = Math.round(realtimeIntervalMs(speedMultiplier) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0
    ? `1 игровой час = ${minutes}:${seconds.toString().padStart(2, '0')} реального времени`
    : `1 игровой час = ${minutes} мин реального времени`;
};
