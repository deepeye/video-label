import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Step3Storyboard } from '@/steps/Step3Storyboard';
import { useDemoStore } from '@/store/demoStore';

describe('Step3Storyboard', () => {
  beforeEach(() => {
    useDemoStore.getState().reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with empty state initially', () => {
    render(<Step3Storyboard />);
    expect(screen.getByTestId('step3-storyboard')).toBeTruthy();
    expect(screen.getByTestId('storyboard-empty')).toBeTruthy();
    expect(screen.getByTestId('segment-timeline')).toBeTruthy();
  });

  it('reveals segments one by one on 1x speed', () => {
    render(<Step3Storyboard />);
    expect(useDemoStore.getState().revealedSegmentCount).toBe(0);

    act(() => { vi.advanceTimersByTime(800); });
    expect(useDemoStore.getState().revealedSegmentCount).toBe(1);

    act(() => { vi.advanceTimersByTime(800); });
    expect(useDemoStore.getState().revealedSegmentCount).toBe(2);
  });

  it('reveals all segments instantly on instant speed', () => {
    useDemoStore.getState().setSpeed('instant');
    render(<Step3Storyboard />);
    expect(useDemoStore.getState().revealedSegmentCount).toBe(5);
  });

  it('shows complete message when all revealed', () => {
    useDemoStore.getState().setSpeed('instant');
    render(<Step3Storyboard />);
    expect(screen.getByTestId('step3-complete')).toBeTruthy();
  });

  it('shows total count in header when all revealed', () => {
    useDemoStore.getState().setSpeed('instant');
    render(<Step3Storyboard />);
    expect(screen.getByText('共 5 个片段')).toBeTruthy();
  });

  it('shows in-progress count in header', () => {
    useDemoStore.getState().setSpeed('1x');
    render(<Step3Storyboard />);
    act(() => { vi.advanceTimersByTime(800); });
    expect(screen.getByText(/已拆分/)).toBeTruthy();
  });
});
