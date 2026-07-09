import { describe, it, expect, vi } from 'vitest';
import { watchVideoFrames, isNativeVideoFrameCallbackSupported } from '@/lib/ext/videoFrameCallback';

describe('watchVideoFrames', () => {
  it('returns a handle with cancel method', () => {
    const video = document.createElement('video');
    const cb = vi.fn();
    const h = watchVideoFrames(video, cb);
    expect(typeof h.cancel).toBe('function');
    h.cancel();
  });

  it('does not throw when cancelled before any callback', () => {
    const video = document.createElement('video');
    const cb = vi.fn();
    const h = watchVideoFrames(video, cb);
    expect(() => h.cancel()).not.toThrow();
  });
});

describe('isNativeVideoFrameCallbackSupported', () => {
  it('returns false in jsdom (no native API)', () => {
    expect(isNativeVideoFrameCallbackSupported()).toBe(false);
  });
});
