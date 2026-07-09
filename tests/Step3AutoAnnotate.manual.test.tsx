import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { useDemoStore } from '@/store/demoStore';

// Mock BoxRevealCanvas to call onComplete once in useEffect on mount,
// avoiding Konva/canvas test infra issues while still exercising the
// auto-advance timer path.
vi.mock('@/steps/Step3AutoAnnotate/BoxRevealCanvas', () => ({
  BoxRevealCanvas: ({ onComplete }: { onComplete: () => void }) => {
    const firedRef = useRef(false);
    useEffect(() => {
      if (!firedRef.current) {
        firedRef.current = true;
        onComplete();
      }
    });
    return <div data-testid="mock-box-reveal" />;
  },
}));

// Mock InferenceProgress to a placeholder to avoid timer-driven RAF in tests.
vi.mock('@/steps/Step3AutoAnnotate/InferenceProgress', () => ({
  InferenceProgress: () => <div data-testid="mock-inference-progress" />,
}));

import { Step3AutoAnnotate } from '@/steps/Step3AutoAnnotate';

describe('Step3 manual mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useDemoStore.getState().selectDataset('city-road');
    useDemoStore.getState().goToStep(3);
    useDemoStore.getState().setSpeed('instant');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('finishes reveal but stays on step 3', () => {
    render(<Step3AutoAnnotate />);
    // Flush effect-triggered state updates and the auto-advance
    // setTimeout(() => goToStep(4), ...) that fires on reveal complete.
    vi.runAllTimers();
    // This should FAIL because the implementation still auto-advances to step 4
    // via the setTimeout in handleComplete.
    expect(useDemoStore.getState().demoStep).toBe(3);
  });
});
