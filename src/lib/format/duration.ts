export function formatDuration(durationMs: number): string {
  const ms = Math.floor(durationMs % 1000);
  const totalSec = Math.floor(durationMs / 1000);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60) % 60;
  const hr = Math.floor(totalSec / 3600);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(hr)}:${pad(min)}:${pad(sec)}.${pad(ms, 3)}`;
}
