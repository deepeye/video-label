import { describe, it, expect } from 'vitest';
import { findFrameAt, visibleBoxes, mergeFrameTextOverrides } from '@/lib/frameBoxes';
import type { FrameBoxesOverlay, Dataset, FrameTextEdit } from '@/types';

const makeOverlay = (frameIndexes: number[]): FrameBoxesOverlay => ({
  fps: 30,
  video_size: [1920, 1080],
  frames: frameIndexes.map((idx) => ({
    frame_index: idx,
    timestamp_ms: Math.round((idx / 30) * 1000),
    subtitle_text: null,
    parts: [],
    boxes: [],
  })),
});

describe('findFrameAt', () => {
  it('returns null for undefined overlay', () => {
    expect(findFrameAt(undefined, 1000)).toBeNull();
  });

  it('returns null for empty frames', () => {
    expect(findFrameAt({ fps: 30, video_size: [1920, 1080], frames: [] }, 1000)).toBeNull();
  });

  it('returns the only frame when single frame overlay', () => {
    const overlay = makeOverlay([10]);
    expect(findFrameAt(overlay, 500)?.frame_index).toBe(10);
  });

  it('returns first frame for time = 0', () => {
    const overlay = makeOverlay([0, 30, 60, 90]);
    expect(findFrameAt(overlay, 0)?.frame_index).toBe(0);
  });

  it('returns last frame for time beyond range (closest match)', () => {
    const overlay = makeOverlay([0, 30, 60, 90]);
    expect(findFrameAt(overlay, 99999)?.frame_index).toBe(90);
  });

  it('returns nearest frame for time in the middle', () => {
    const overlay = makeOverlay([0, 30, 45, 60]);
    expect(findFrameAt(overlay, 1100)?.frame_index).toBe(30);
  });

  it('rounds to closer frame when tied', () => {
    const overlay = makeOverlay([0, 30, 60]);
    expect(findFrameAt(overlay, 500)?.frame_index).toBe(30);
  });
});

describe('visibleBoxes', () => {
  it('returns empty array for frame with no parts and no boxes', () => {
    expect(visibleBoxes({
      frame_index: 0,
      timestamp_ms: 0,
      subtitle_text: null,
      parts: [],
      boxes: [],
    })).toEqual([]);
  });

  it('converts parts to text FrameBox with axis-aligned bounding box', () => {
    const result = visibleBoxes({
      frame_index: 0,
      timestamp_ms: 0,
      subtitle_text: null,
      parts: [{ part_id: 0, text: 'hello', box: [[10, 20], [110, 20], [110, 60], [10, 60]] }],
      boxes: [],
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.label).toBe('text');
    expect(result[0]!.text).toBe('hello');
    expect(result[0]!.probability).toBe(1);
    expect(result[0]!.box).toEqual([10, 20, 100, 40]);
  });

  it('passes through person/logo boxes with original coordinates', () => {
    const result = visibleBoxes({
      frame_index: 0,
      timestamp_ms: 0,
      subtitle_text: null,
      parts: [],
      boxes: [
        { label: 'person', probability: 0.9, box: [100, 200, 50, 80] },
        { label: 'logo', probability: 0.7, box: [300, 400, 60, 30] },
      ],
    });
    expect(result).toHaveLength(2);
    expect(result[0]!.label).toBe('person');
    expect(result[0]!.box).toEqual([100, 200, 50, 80]);
    expect(result[1]!.label).toBe('logo');
  });

  it('combines parts (as text) and boxes (as person/logo) in order', () => {
    const result = visibleBoxes({
      frame_index: 0,
      timestamp_ms: 0,
      subtitle_text: null,
      parts: [{ part_id: 0, text: 'a', box: [[0, 0], [10, 0], [10, 10], [0, 10]] }],
      boxes: [{ label: 'person', probability: 0.9, box: [100, 100, 50, 80] }],
    });
    expect(result.map((b) => b.label)).toEqual(['text', 'person']);
  });
});

function makeDatasetWithFrames(parts: Array<{ part_id: number; text: string }>): Dataset {
  const frameParts = parts.map((p) => ({ ...p, box: [[0, 0], [1, 0], [1, 1], [0, 1]] as Array<[number, number]> }));
  return {
    version: '2.0-demo',
    dataset_id: 'jiazhengnvhuang_13',
    display: 't',
    video_src: '/mock/t.mp4',
    thumb: '',
    metadata: { duration_ms: 1000, frame_count: 30, fps: 30, width: 1920, height: 1080, codec: 'h264', audio_tracks: 1, sampled_frames: 0 },
    annotations: [],
    demo_script: { metadata_reveal_ms: 0, inference_reveal_ms: 0, review_focus_ids: [] },
    segments: [],
    frame_boxes: {
      fps: 30,
      video_size: [1920, 1080],
      frames: [{ frame_index: 0, timestamp_ms: 0, subtitle_text: null, parts: frameParts, boxes: [] }],
    },
  };
}

describe('mergeFrameTextOverrides', () => {
  it('returns undefined when dataset has no frame_boxes', () => {
    const ds: Dataset = { ...makeDatasetWithFrames([]), frame_boxes: undefined };
    expect(mergeFrameTextOverrides(ds, [])).toBeUndefined();
  });

  it('returns a deep clone with no changes when edits is empty', () => {
    const ds = makeDatasetWithFrames([{ part_id: 0, text: 'OCR' }]);
    const merged = mergeFrameTextOverrides(ds, []);
    expect(merged).toEqual(ds.frame_boxes);
    expect(merged).not.toBe(ds.frame_boxes);
    expect(merged!.frames[0]!.parts[0]).not.toBe(ds.frame_boxes!.frames[0]!.parts[0]);
  });

  it('applies edits to the matching part text', () => {
    const ds = makeDatasetWithFrames([{ part_id: 0, text: 'OCR' }]);
    const edits: FrameTextEdit[] = [{ frame_index: 0, part_id: 0, text: '修正' }];
    const merged = mergeFrameTextOverrides(ds, edits);
    expect(merged!.frames[0]!.parts[0]!.text).toBe('修正');
  });

  it('does not mutate the source dataset', () => {
    const ds = makeDatasetWithFrames([{ part_id: 0, text: 'OCR' }]);
    mergeFrameTextOverrides(ds, [{ frame_index: 0, part_id: 0, text: '修正' }]);
    expect(ds.frame_boxes!.frames[0]!.parts[0]!.text).toBe('OCR');
  });

  it('leaves edits for non-existent frames/parts as no-ops', () => {
    const ds = makeDatasetWithFrames([{ part_id: 0, text: 'OCR' }]);
    const edits: FrameTextEdit[] = [
      { frame_index: 99, part_id: 0, text: 'X' },
      { frame_index: 0, part_id: 99, text: 'Y' },
    ];
    const merged = mergeFrameTextOverrides(ds, edits);
    expect(merged!.frames[0]!.parts[0]!.text).toBe('OCR');
  });
});
