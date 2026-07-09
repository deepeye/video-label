import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { useDemoStore } from '@/store/demoStore';

// Mock TypewriterField to call onComplete once in useEffect on mount,
// driving completedCount to reach fields.length and exercising the
// existing auto-advance timeout path.
vi.mock('@/steps/Step2Metadata/TypewriterField', () => ({
  TypewriterField: ({ onComplete }: { onComplete?: () => void }) => {
    const firedRef = useRef(false);
    useEffect(() => {
      if (!firedRef.current && onComplete) {
        firedRef.current = true;
        onComplete();
      }
    });
    return <div data-testid="mock-typewriter-field" />;
  },
}));

import { Step2Metadata } from '@/steps/Step2Metadata';

describe('Step2 manual mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useDemoStore.getState().selectDataset('city-road');
    useDemoStore.getState().goToStep(2);
    useDemoStore.getState().setSpeed('instant');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('finishes reveal but stays on step 2', () => {
    render(<Step2Metadata />);
    // Flush effect-triggered microtasks, state updates, and the auto-advance
    // setTimeout(() => goToStep(3), ...) that fires when all fields complete.
    vi.runAllTimers();
    // This should FAIL because the implementation still auto-advances to step 3
    // via the setTimeout(() => goToStep(3), ...) in Step2Metadata.
    expect(useDemoStore.getState().demoStep).toBe(2);
  });
});
