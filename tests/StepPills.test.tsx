import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepPills } from '@/chrome/StepPills';
import { useDemoStore } from '@/store/demoStore';

describe('StepPills manual navigation', () => {
  beforeEach(() => {
    useDemoStore.getState().selectDataset('city-road');
  });

  it('clicks step 3 pill and jumps to step 3', () => {
    render(<StepPills />);
    fireEvent.click(screen.getByTestId('step-pill-3'));
    expect(useDemoStore.getState().demoStep).toBe(3);
  });

  it('clicks step 5 pill and jumps to step 5', () => {
    render(<StepPills />);
    fireEvent.click(screen.getByTestId('step-pill-5'));
    expect(useDemoStore.getState().demoStep).toBe(5);
  });
});
