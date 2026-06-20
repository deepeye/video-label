import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { Step2Metadata } from '@/steps/Step2Metadata';
import { useDemoStore } from '@/store/demoStore';

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
    vi.runAllTimers();
    expect(useDemoStore.getState().demoStep).toBe(2);
  });
});
