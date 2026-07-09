import { describe, it, expect } from 'vitest';
import { extractCategories, buildCategoryMap } from '@/lib/format/categories';
import type { Annotation } from '@/types';

function ann(label_id: string, label_display: string): Annotation {
  return {
    version: '2.0-demo',
    track_id: 't',
    label_id,
    label_display,
    source: 'machine',
    confidence: 0.9,
    needs_review: false,
    keyframes: [
      {
        timestamp_ms: 0,
        frame_no: 0,
        geometry: { type: 'bbox', coords: [0, 0, 10, 10] },
        is_keyframe: true,
      },
    ],
    review: { status: 'pending', changed_frames: 0, reviewed_at: null },
  };
}

describe('extractCategories', () => {
  it('returns unique categories sorted by label_id', () => {
    const cats = extractCategories([
      ann('vehicle', '车辆'),
      ann('pedestrian', '行人'),
      ann('vehicle', '车辆'),
      ann('traffic_sign', '交通标志'),
    ]);
    expect(cats).toEqual([
      { id: 1, name: 'pedestrian', display: '行人' },
      { id: 2, name: 'traffic_sign', display: '交通标志' },
      { id: 3, name: 'vehicle', display: '车辆' },
    ]);
  });
});

describe('buildCategoryMap', () => {
  it('maps label_id to numeric category_id', () => {
    const map = buildCategoryMap([
      ann('vehicle', '车辆'),
      ann('pedestrian', '行人'),
    ]);
    expect(map['pedestrian']).toBe(1);
    expect(map['vehicle']).toBe(2);
  });
});
