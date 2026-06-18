import { describe, it, expect } from 'vitest';
import { useDemoStore } from '@/store/demoStore';

describe('reset performance', () => {
  it('reset finishes under 200ms (PRD §10 hard line)', () => {
    useDemoStore.getState().acceptAllRemaining();
    const t0 = performance.now();
    useDemoStore.getState().reset();
    const dur = performance.now() - t0;
    expect(dur).toBeLessThan(200);
  });
});
