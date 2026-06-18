import { describe, it, expect, beforeEach } from 'vitest';
import { useDemoStore } from '@/store/demoStore';
import { getDataset } from '@/data';
import { toNative } from '@/lib/format/native';

describe('toNative', () => {
  beforeEach(() => {
    useDemoStore.getState().selectDataset('city-road');
  });

  it('preserves all annotation fields per spec §4.1 schema', () => {
    const ds = getDataset('city-road');
    const out = toNative(ds.annotations, ds, 1718700000000);
    expect(out.version).toBe('2.0-demo');
    expect(out.dataset.dataset_id).toBe('city-road');
    expect(out.exported_at).toBe(1718700000000);
    expect(out.annotations.length).toBe(47);

    // 抽样: trk_2 完整字段
    const trk2 = out.annotations.find((a) => a.track_id === 'trk_2')!;
    expect(trk2.label_id).toBe('pedestrian');
    expect(trk2.label_display).toBe('行人');
    expect(trk2.source).toBe('machine');
    expect(trk2.confidence).toBe(0.41);
    expect(trk2.needs_review).toBe(true);
    expect(trk2.review.status).toBe('pending');
    expect(trk2.keyframes[0]!.geometry.type).toBe('bbox');
    expect(trk2.keyframes[0]!.geometry.coords.length).toBe(4);
    expect(trk2.keyframes[0]!.timestamp_ms).toBeGreaterThanOrEqual(0);
  });

  it('reflects review changes from store (CLAUDE.md hard constraint #2)', () => {
    useDemoStore.getState().acceptBox('trk_2');
    useDemoStore.getState().correctBoxGeometry('trk_9', 0, [100, 200, 300, 400]);
    useDemoStore.getState().rejectBox('trk_5');

    const annotations = useDemoStore.getState().annotations;
    const ds = getDataset('city-road');
    const out = toNative(annotations, ds, 1);

    const trk2 = out.annotations.find((a) => a.track_id === 'trk_2')!;
    const trk9 = out.annotations.find((a) => a.track_id === 'trk_9')!;
    const trk5 = out.annotations.find((a) => a.track_id === 'trk_5')!;

    expect(trk2.review.status).toBe('accepted');
    expect(trk2.source).toBe('machine');                       // 接受不改 source

    expect(trk9.review.status).toBe('corrected');
    expect(trk9.source).toBe('human');                         // 改框转 human
    expect(trk9.keyframes[0]!.geometry.coords).toEqual([100, 200, 300, 400]);

    expect(trk5.review.status).toBe('rejected');
  });

  it('statistics match annotations counts', () => {
    useDemoStore.getState().acceptBox('trk_2');
    useDemoStore.getState().rejectBox('trk_5');
    useDemoStore.getState().correctBoxGeometry('trk_9', 0, [1, 2, 3, 4]);
    useDemoStore.getState().acceptAllRemaining();

    const annotations = useDemoStore.getState().annotations;
    const ds = getDataset('city-road');
    const out = toNative(annotations, ds, 1);

    expect(out.statistics.total).toBe(47);
    expect(out.statistics.accepted).toBe(45); // 47 - 1 rejected - 1 corrected
    expect(out.statistics.corrected).toBe(1);
    expect(out.statistics.rejected).toBe(1);
    expect(out.statistics.pending).toBe(0);
  });

  it('serialization is JSON-roundtrip-safe', () => {
    const ds = getDataset('city-road');
    const out = toNative(ds.annotations, ds, 1718700000000);
    const json = JSON.stringify(out);
    const back = JSON.parse(json);
    expect(back.annotations.length).toBe(47);
    expect(back.dataset.dataset_id).toBe('city-road');
  });
});
