import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDemoStore } from '@/store/demoStore';
import { useDemoOrchestrator } from '@/lib/animation/orchestrator';

describe('useDemoOrchestrator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useDemoStore.getState().selectDataset('city-road');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto + step 1 → goToStep(2) after 1.5s', () => {
    renderHook(() => useDemoOrchestrator());
    act(() => {
      useDemoStore.getState().togglePlayMode();
    });
    expect(useDemoStore.getState().demoStep).toBe(1);
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(useDemoStore.getState().demoStep).toBe(2);
  });

  it('does nothing when manual', () => {
    renderHook(() => useDemoOrchestrator());
    expect(useDemoStore.getState().playMode).toBe('manual');
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(useDemoStore.getState().demoStep).toBe(1);
  });

  it('does not advance if user takes over before timer', () => {
    renderHook(() => useDemoOrchestrator());
    act(() => {
      useDemoStore.getState().togglePlayMode();
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => {
      useDemoStore.getState().userTakeover();
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(useDemoStore.getState().demoStep).toBe(1);
  });

  it('respects 2x speed', () => {
    useDemoStore.getState().setSpeed('2x');
    renderHook(() => useDemoOrchestrator());
    act(() => {
      useDemoStore.getState().togglePlayMode();
    });
    act(() => {
      vi.advanceTimersByTime(800); // 1500ms × 0.5 = 750ms
    });
    expect(useDemoStore.getState().demoStep).toBe(2);
  });
});
