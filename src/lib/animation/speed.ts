import type { Speed } from '../../types';

export const speedMultiplier: Record<Speed, number> = {
  '1x': 1,
  '2x': 0.5,
  'instant': 0,
};

export function applySpeed(baseMs: number, speed: Speed): number {
  return Math.round(baseMs * speedMultiplier[speed]);
}
