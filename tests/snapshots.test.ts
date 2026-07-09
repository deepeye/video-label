import { describe, expect, it } from 'vitest';
import { createLoadingSnapshot, createSnapshotFromDataset } from '@/store/snapshots';
import type { Dataset, DatasetId } from '@/types';

function makeDataset(id: DatasetId): Dataset {
  return {
    version: '2.0-demo',
    dataset_id: id,
    display: 'test',
    video_src: '/mock/test.mp4',
    thumb: '',
    metadata: {
      duration_ms: 10000,
      frame_count: 300,
      fps: 30,
      width: 1920,
      height: 1080,
      codec: 'h264',
      audio_tracks: 1,
      sampled_frames: 0,
    },
    annotations: [
      {
        version: '2.0-demo',
        track_id: 'trk_1',
        label_id: 'test',
        label_display: 'Test',
        source: 'machine',
        confidence: 0.5,
        needs_review: false,
        keyframes: [],
        review: { status: 'pending', changed_frames: 0, reviewed_at: null },
      },
    ],
    demo_script: { metadata_reveal_ms: 3000, inference_reveal_ms: 5000, review_focus_ids: [] },
    segments: [],
  };
}

describe('snapshot factory', () => {
  it('createLoadingSnapshot has loadingDataset=true', () => {
    const snap = createLoadingSnapshot();
    expect(snap.loadingDataset).toBe(true);
    expect(snap.loadingDatasetError).toBeNull();
    expect(snap.activeDatasetId).toBe('jiazhengnvhuang_13');
    expect(snap.annotations).toEqual([]);
    expect(snap.events).toEqual([]);
  });

  it('createSnapshotFromDataset creates a deep clone of annotations', () => {
    const ds = makeDataset('jiazhengnvhuang_13');
    const snap = createSnapshotFromDataset(ds, 'jiazhengnvhuang_13');
    expect(snap.annotations).toEqual(ds.annotations);
    expect(snap.annotations).not.toBe(ds.annotations);
    expect(snap.annotations[0]).not.toBe(ds.annotations[0]);
  });

  it('createSnapshotFromDataset has loadingDataset=false', () => {
    const ds = makeDataset('jiazhengnvhuang_13');
    const snap = createSnapshotFromDataset(ds, 'jiazhengnvhuang_13');
    expect(snap.loadingDataset).toBe(false);
    expect(snap.loadingDatasetError).toBeNull();
  });

  it('mutating snapshot does not affect source dataset', () => {
    const ds = makeDataset('jiazhengnvhuang_13');
    const snap = createSnapshotFromDataset(ds, 'jiazhengnvhuang_13');
    snap.annotations[0]!.review.status = 'accepted';
    expect(ds.annotations[0]!.review.status).toBe('pending');
  });

  it('two snapshots are independent', () => {
    const ds = makeDataset('jiazhengnvhuang_13');
    const a = createSnapshotFromDataset(ds, 'jiazhengnvhuang_13');
    const b = createSnapshotFromDataset(ds, 'jiazhengnvhuang_13');
    a.annotations[0]!.review.status = 'accepted';
    expect(b.annotations[0]!.review.status).toBe('pending');
  });
});
