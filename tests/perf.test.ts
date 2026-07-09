import { describe, it, expect } from 'vitest';
import { useDemoStore } from '@/store/demoStore';

describe('reset performance', () => {
  it('reset finishes under 200ms (PRD §10 hard line)', () => {
    const pointId = useDemoStore.getState().createPointEvent(1200);
    useDemoStore.getState().updateEvent(pointId, {
      eventType: 'sudden_brake',
      description: '车辆急刹',
      severity: 'high',
    });

    const rangeId = useDemoStore.getState().createRangeEvent(2400, 3800);
    useDemoStore.getState().attachRegionBox(rangeId, [100, 120, 80, 60], 2400);

    const t0 = performance.now();
    useDemoStore.getState().reset();
    const dur = performance.now() - t0;

    expect(dur).toBeLessThan(200);
  });
});
