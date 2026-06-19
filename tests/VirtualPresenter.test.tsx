import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { VirtualPresenter } from '@/steps/Step4Review/VirtualPresenter';
import { useDemoStore } from '@/store/demoStore';

describe('VirtualPresenter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useDemoStore.getState().selectDataset('city-road');
    useDemoStore.getState().goToStep(4);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when manual', () => {
    render(<VirtualPresenter />);
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    const trk2 = useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_2')!;
    expect(trk2.review.status).toBe('pending');
  });

  it('runs full presentation when auto on city-road (3 focus)', () => {
    render(<VirtualPresenter />);
    act(() => {
      useDemoStore.getState().togglePlayMode(); // auto
    });

    // t=0: select trk_2 (setTimeout 0, 需推进一帧)
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(useDemoStore.getState().selectedTrackId).toBe('trk_2');

    // t=1500: accept trk_2 + select trk_9
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_2')!.review.status).toBe('accepted');
    expect(useDemoStore.getState().selectedTrackId).toBe('trk_9');

    // t=3500: correct trk_9 + select trk_5
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_9')!.review.status).toBe('corrected');
    expect(useDemoStore.getState().selectedTrackId).toBe('trk_5');

    // t=5500: reject trk_5
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_5')!.review.status).toBe('rejected');

    // t=6500: accept all remaining
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const pending = useDemoStore.getState().annotations.filter((a) => a.review.status === 'pending');
    expect(pending.length).toBe(0);

    // t=7500: goToStep(5)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(useDemoStore.getState().demoStep).toBe(5);
  });

  it('cancels when user takes over mid-presentation', () => {
    render(<VirtualPresenter />);
    act(() => {
      useDemoStore.getState().togglePlayMode();
    });
    act(() => {
      vi.advanceTimersByTime(2000); // 已经接受 trk_2, 选了 trk_9
    });

    act(() => {
      useDemoStore.getState().userTakeover();
    });
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // trk_9 不应被 correct (因为已 takeover)
    const trk9 = useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_9')!;
    expect(trk9.review.status).toBe('pending');
    // trk_2 已发生的改动保留
    const trk2 = useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_2')!;
    expect(trk2.review.status).toBe('accepted');
  });

  it('handles 2-focus secondary sample', () => {
    useDemoStore.getState().selectDataset('meeting-room');
    useDemoStore.getState().goToStep(4);
    render(<VirtualPresenter />);
    act(() => {
      useDemoStore.getState().togglePlayMode();
    });

    act(() => {
      vi.advanceTimersByTime(1500); // 接受 trk_p1
    });
    act(() => {
      vi.advanceTimersByTime(2000); // 否决 trk_l1
    });
    act(() => {
      vi.advanceTimersByTime(1000); // 一键剩余
    });
    act(() => {
      vi.advanceTimersByTime(1000); // goToStep(5)
    });

    const ds = useDemoStore.getState();
    expect(ds.demoStep).toBe(5);
    expect(ds.annotations.find((a) => a.track_id === 'trk_p1')!.review.status).toBe('accepted');
    expect(ds.annotations.find((a) => a.track_id === 'trk_l1')!.review.status).toBe('rejected');
    const pending = ds.annotations.filter((a) => a.review.status === 'pending');
    expect(pending.length).toBe(0);
  });
});
