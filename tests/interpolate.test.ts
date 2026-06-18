import { describe, it, expect } from 'vitest';
import { findVisibleAtTime, interpolateBox } from '@/lib/interpolate';
import type { Annotation, Keyframe } from '@/types';

function kf(ts: number, coords: [number, number, number, number]): Keyframe {
  return {
    timestamp_ms: ts,
    frame_no: Math.round((ts / 1000) * 30),
    geometry: { type: 'bbox', coords },
    is_keyframe: true,
  };
}

function ann(track_id: string, keyframes: Keyframe[]): Annotation {
  return {
    version: '2.0-demo',
    track_id,
    label_id: 'pedestrian',
    label_display: '行人',
    source: 'machine',
    confidence: 0.9,
    needs_review: false,
    keyframes,
    review: { status: 'pending', changed_frames: 0, reviewed_at: null },
  };
}

describe('interpolateBox', () => {
  it('returns first frame box when t <= first.timestamp', () => {
    const frames = [kf(1000, [10, 10, 100, 100]), kf(2000, [20, 20, 100, 100])];
    expect(interpolateBox(frames, 500)).toEqual([10, 10, 100, 100]);
    expect(interpolateBox(frames, 1000)).toEqual([10, 10, 100, 100]);
  });

  it('returns last frame box when t >= last.timestamp', () => {
    const frames = [kf(1000, [10, 10, 100, 100]), kf(2000, [20, 20, 100, 100])];
    expect(interpolateBox(frames, 2500)).toEqual([20, 20, 100, 100]);
  });

  it('linearly interpolates between two adjacent keyframes', () => {
    const frames = [kf(1000, [0, 0, 100, 100]), kf(2000, [100, 50, 200, 150])];
    // t = 1500 (50% 处)
    expect(interpolateBox(frames, 1500)).toEqual([50, 25, 150, 125]);
  });

  it('handles 3+ keyframes by picking the right segment', () => {
    const frames = [kf(0, [0, 0, 50, 50]), kf(1000, [100, 100, 50, 50]), kf(2000, [200, 0, 50, 50])];
    expect(interpolateBox(frames, 500)).toEqual([50, 50, 50, 50]); // 0→1000 segment
    expect(interpolateBox(frames, 1500)).toEqual([150, 50, 50, 50]); // 1000→2000 segment
  });

  it('throws on empty keyframes', () => {
    expect(() => interpolateBox([], 500)).toThrow();
  });
});

describe('findVisibleAtTime', () => {
  it('returns annotations whose [first, last] keyframe span covers t', () => {
    const a = ann('a', [kf(0, [0, 0, 10, 10]), kf(1000, [0, 0, 10, 10])]);
    const b = ann('b', [kf(2000, [0, 0, 10, 10]), kf(3000, [0, 0, 10, 10])]);
    const c = ann('c', [kf(500, [0, 0, 10, 10]), kf(2500, [0, 0, 10, 10])]);
    const all = [a, b, c];

    expect(findVisibleAtTime(all, 500).map((x) => x.track_id)).toEqual(['a', 'c']);
    expect(findVisibleAtTime(all, 2200).map((x) => x.track_id)).toEqual(['b', 'c']);
    expect(findVisibleAtTime(all, 1500).map((x) => x.track_id)).toEqual(['c']);
  });

  it('excludes annotations with rejected status', () => {
    const a = ann('a', [kf(0, [0, 0, 10, 10]), kf(1000, [0, 0, 10, 10])]);
    a.review.status = 'rejected';
    expect(findVisibleAtTime([a], 500)).toEqual([]);
  });
});
