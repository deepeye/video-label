import { describe, expect, it } from 'vitest';
import { adaptRealData } from '@/data/adaptRealData';
import type { DatasetId } from '@/types';

const SAMPLE_JSON = {
  video_name: 'test.mp4',
  concatenated_subtitles: 'hello world',
  all_frames: [
    {
      frame_index: 0,
      subtitle_text: 'hello',
      parts: [
        {
          part_id: 0,
          text: 'OCR text',
          box: [[0, 0], [100, 0], [100, 50], [0, 50]],
        },
      ],
      objects: [
        {
          label: 'person',
          probability: 0.95,
          box_px: [10, 20, 200, 300],
          prompt_used: 'person prompt',
        },
        {
          label: 'logo',
          probability: 0.8,
          box_px: [400, 100, 500, 200],
        },
      ],
    },
    {
      frame_index: 5,
      subtitle_text: 'world',
      parts: [],
      objects: [],
    },
  ],
};

const VIDEO_META = {
  durationMs: 10000,
  width: 1920,
  height: 1080,
  fps: 30,
};

describe('adaptRealData', () => {
  it('returns a Dataset with correct dataset_id and display', () => {
    const ds = adaptRealData(
      SAMPLE_JSON,
      VIDEO_META,
      'jiazhengnvhuang_13' as DatasetId,
      '家政女皇·肉片穿衣',
      '/mock/storyboard/test.mp4',
    );
    expect(ds.version).toBe('2.0-demo');
    expect(ds.dataset_id).toBe('jiazhengnvhuang_13');
    expect(ds.display).toBe('家政女皇·肉片穿衣');
    expect(ds.video_src).toBe('/mock/storyboard/test.mp4');
  });

  it('converts metadata from VideoMeta', () => {
    const ds = adaptRealData(
      SAMPLE_JSON,
      VIDEO_META,
      'jiazhengnvhuang_13' as DatasetId,
      'test',
      '/mock/test.mp4',
    );
    expect(ds.metadata.duration_ms).toBe(10000);
    expect(ds.metadata.width).toBe(1920);
    expect(ds.metadata.height).toBe(1080);
    expect(ds.metadata.fps).toBe(30);
    expect(ds.metadata.frame_count).toBe(300); // 10s * 30fps
    expect(ds.metadata.codec).toBe('h264');
    expect(ds.metadata.audio_tracks).toBe(1);
    expect(ds.metadata.sampled_frames).toBe(2); // 2 frames in all_frames
  });

  it('converts all_frames to frame_boxes.frames', () => {
    const ds = adaptRealData(
      SAMPLE_JSON,
      VIDEO_META,
      'jiazhengnvhuang_13' as DatasetId,
      'test',
      '/mock/test.mp4',
    );
    expect(ds.frame_boxes).toBeDefined();
    expect(ds.frame_boxes!.fps).toBe(30);
    expect(ds.frame_boxes!.video_size).toEqual([1920, 1080]);
    expect(ds.frame_boxes!.frames).toHaveLength(2);
  });

  it('converts objects box_px (xyxy) to boxes box (xywh)', () => {
    const ds = adaptRealData(
      SAMPLE_JSON,
      VIDEO_META,
      'jiazhengnvhuang_13' as DatasetId,
      'test',
      '/mock/test.mp4',
    );
    const frame0 = ds.frame_boxes!.frames[0]!;
    expect(frame0.boxes).toHaveLength(2);

    const personBox = frame0.boxes.find(b => b.label === 'person')!;
    expect(personBox.box).toEqual([10, 20, 190, 280]); // [x1, y1, x2-x1, y2-y1]
    expect(personBox.probability).toBe(0.95);
    expect(personBox.prompt_used).toBe('person prompt');

    const logoBox = frame0.boxes.find(b => b.label === 'logo')!;
    expect(logoBox.box).toEqual([400, 100, 100, 100]);
    expect(logoBox.probability).toBe(0.8);
  });

  it('passes through parts (OCR quads) unchanged', () => {
    const ds = adaptRealData(
      SAMPLE_JSON,
      VIDEO_META,
      'jiazhengnvhuang_13' as DatasetId,
      'test',
      '/mock/test.mp4',
    );
    const frame0 = ds.frame_boxes!.frames[0]!;
    expect(frame0.parts).toHaveLength(1);
    expect(frame0.parts[0]!.text).toBe('OCR text');
    expect(frame0.parts[0]!.box).toEqual([[0, 0], [100, 0], [100, 50], [0, 50]]);
  });

  it('handles empty all_frames', () => {
    const ds = adaptRealData(
      { video_name: 'e.mp4', concatenated_subtitles: '', all_frames: [] },
      VIDEO_META,
      'jiazhengnvhuang_13' as DatasetId,
      'test',
      '/mock/test.mp4',
    );
    expect(ds.frame_boxes!.frames).toHaveLength(0);
  });

  it('generates annotations from frame objects and 5 storyboard segments', () => {
    const ds = adaptRealData(
      SAMPLE_JSON,
      VIDEO_META,
      'jiazhengnvhuang_13' as DatasetId,
      'test',
      '/mock/test.mp4',
    );
    expect(ds.segments).toHaveLength(5);
    expect(ds.segments[0]!.content_type).toBe('美食');
    // frame 0 has 2 objects → 2 annotations, each one keyframe
    expect(ds.annotations).toHaveLength(2);
    const person = ds.annotations.find(a => a.label_id === 'person')!;
    expect(person.source).toBe('machine');
    expect(person.confidence).toBe(0.95);
    expect(person.needs_review).toBe(false);
    expect(person.keyframes).toHaveLength(1);
    expect(person.keyframes[0]!.geometry).toMatchObject({
      type: 'bbox',
      coords: [10, 20, 190, 280],
    });
    expect(person.review.status).toBe('pending');
  });

  it('marks low-confidence objects as needs_review', () => {
    const lowJson = {
      ...SAMPLE_JSON,
      all_frames: [{
        frame_index: 0,
        subtitle_text: '',
        parts: [],
        objects: [{ label: 'logo', probability: 0.3, box_px: [0, 0, 10, 10] }],
      }],
    };
    const ds = adaptRealData(
      lowJson,
      VIDEO_META,
      'jiazhengnvhuang_13' as DatasetId,
      'test',
      '/mock/test.mp4',
    );
    expect(ds.annotations[0]!.needs_review).toBe(true);
    expect(ds.annotations[0]!.confidence).toBe(0.3);
  });

  it('generates default demo_script', () => {
    const ds = adaptRealData(
      SAMPLE_JSON,
      VIDEO_META,
      'jiazhengnvhuang_13' as DatasetId,
      'test',
      '/mock/test.mp4',
    );
    expect(ds.demo_script).toEqual({
      metadata_reveal_ms: 3000,
      inference_reveal_ms: 5000,
      review_focus_ids: [],
    });
  });

  it('defaults fps to 30 when VideoMeta has 0 fps', () => {
    const ds = adaptRealData(
      SAMPLE_JSON,
      { ...VIDEO_META, fps: 0 },
      'jiazhengnvhuang_13' as DatasetId,
      'test',
      '/mock/test.mp4',
    );
    expect(ds.metadata.fps).toBe(30);
  });
});
