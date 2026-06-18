import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDemoStore } from '@/store/demoStore';
import { useReviewKeyboard } from '@/steps/Step4Review/keyboard';

function fire(key: string, opts: { ctrlKey?: boolean; metaKey?: boolean } = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, ...opts, bubbles: true }));
}

describe('useReviewKeyboard', () => {
  beforeEach(() => {
    useDemoStore.getState().selectDataset('city-road');
    useDemoStore.getState().goToStep(4);
  });

  it('A accepts the selected track', () => {
    renderHook(() => useReviewKeyboard());
    useDemoStore.getState().selectTrack('trk_2');
    fire('a');
    const ann = useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_2')!;
    expect(ann.review.status).toBe('accepted');
  });

  it('D rejects the selected track', () => {
    renderHook(() => useReviewKeyboard());
    useDemoStore.getState().selectTrack('trk_5');
    fire('d');
    const ann = useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_5')!;
    expect(ann.review.status).toBe('rejected');
  });

  it('Ctrl+Z undoes the last action', () => {
    renderHook(() => useReviewKeyboard());
    useDemoStore.getState().selectTrack('trk_2');
    useDemoStore.getState().acceptBox('trk_2');
    expect(useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_2')!.review.status).toBe('accepted');
    fire('z', { ctrlKey: true });
    expect(useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_2')!.review.status).toBe('pending');
  });

  it('does not act when not on Step 4', () => {
    renderHook(() => useReviewKeyboard());
    useDemoStore.getState().goToStep(1);
    useDemoStore.getState().selectTrack('trk_2');
    fire('a');
    const ann = useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_2')!;
    expect(ann.review.status).toBe('pending');
  });

  it('ArrowRight advances reviewQueueIndex and selects next focus', () => {
    renderHook(() => useReviewKeyboard());
    useDemoStore.getState().setReviewQueueIndex(0);
    fire('ArrowRight');
    expect(useDemoStore.getState().reviewQueueIndex).toBe(1);
    expect(useDemoStore.getState().selectedTrackId).toBe('trk_9');
  });

  it('A advances to next pending focus after acceptance', () => {
    renderHook(() => useReviewKeyboard());
    useDemoStore.getState().selectTrack('trk_2');
    useDemoStore.getState().setReviewQueueIndex(0);
    fire('a');
    expect(useDemoStore.getState().selectedTrackId).toBe('trk_9');
  });
});
