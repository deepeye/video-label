import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { Step3AutoAnnotate } from '@/steps/Step3AutoAnnotate';
import { useDemoStore } from '@/store/demoStore';

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
    vi.runAllTimers();
    expect(useDemoStore.getState().demoStep).toBe(3);
  });
});
