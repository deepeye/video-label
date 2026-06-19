import type { Annotation, BBox, Dataset, Keyframe } from '../../types';

const VIDEO_W = 1920;
const VIDEO_H = 1080;
const DURATION = 60_000;

interface Seed {
  track_id: string;
  label_id: 'person' | 'cart';
  label_display: string;
  confidence: number;
  start: number;
  end: number;
  startBox: BBox;
  endBox: BBox;
}

const SEEDS: Seed[] = [
  // 2 重点项
  { track_id: 'trk_p1', label_id: 'person', label_display: '顾客', confidence: 0.42, start: 8_000, end: 50_000, startBox: [400, 480, 180, 480], endBox: [800, 480, 180, 480] },
  { track_id: 'trk_c1', label_id: 'cart',   label_display: '购物车', confidence: 0.47, start: 5_000, end: 45_000, startBox: [600, 700, 200, 240], endBox: [900, 700, 200, 240] },
  // 13 高置信
  { track_id: 'trk_p2', label_id: 'person', label_display: '顾客', confidence: 0.91, start: 0, end: 60_000, startBox: [1200, 500, 200, 480], endBox: [1200, 500, 200, 480] },
  { track_id: 'trk_p3', label_id: 'person', label_display: '顾客', confidence: 0.86, start: 0, end: 60_000, startBox: [1500, 500, 180, 480], endBox: [1500, 500, 180, 480] },
  { track_id: 'trk_p4', label_id: 'person', label_display: '顾客', confidence: 0.88, start: 10_000, end: 55_000, startBox: [200, 500, 180, 480], endBox: [200, 500, 180, 480] },
  { track_id: 'trk_p5', label_id: 'person', label_display: '顾客', confidence: 0.93, start: 0, end: 60_000, startBox: [1700, 500, 160, 480], endBox: [1700, 500, 160, 480] },
  { track_id: 'trk_c2', label_id: 'cart',   label_display: '购物车', confidence: 0.89, start: 0, end: 60_000, startBox: [1300, 720, 220, 240], endBox: [1300, 720, 220, 240] },
  { track_id: 'trk_c3', label_id: 'cart',   label_display: '购物车', confidence: 0.92, start: 0, end: 60_000, startBox: [200, 720, 200, 240], endBox: [200, 720, 200, 240] },
  { track_id: 'trk_c4', label_id: 'cart',   label_display: '购物车', confidence: 0.85, start: 0, end: 60_000, startBox: [1500, 760, 200, 240], endBox: [1500, 760, 200, 240] },
  { track_id: 'trk_c5', label_id: 'cart',   label_display: '购物车', confidence: 0.87, start: 0, end: 60_000, startBox: [400, 740, 180, 240], endBox: [400, 740, 180, 240] },
  { track_id: 'trk_p6', label_id: 'person', label_display: '顾客', confidence: 0.82, start: 5_000, end: 50_000, startBox: [600, 500, 200, 480], endBox: [600, 500, 200, 480] },
  { track_id: 'trk_p7', label_id: 'person', label_display: '顾客', confidence: 0.84, start: 12_000, end: 55_000, startBox: [1000, 500, 180, 480], endBox: [1000, 500, 180, 480] },
  { track_id: 'trk_c6', label_id: 'cart',   label_display: '购物车', confidence: 0.83, start: 0, end: 60_000, startBox: [800, 740, 200, 240], endBox: [800, 740, 200, 240] },
  { track_id: 'trk_p8', label_id: 'person', label_display: '顾客', confidence: 0.81, start: 15_000, end: 55_000, startBox: [1380, 500, 180, 480], endBox: [1380, 500, 180, 480] },
  { track_id: 'trk_c7', label_id: 'cart',   label_display: '购物车', confidence: 0.86, start: 0, end: 60_000, startBox: [50, 740, 160, 240], endBox: [50, 740, 160, 240] },
];

function gen(seed: Seed): Annotation {
  const count = 5;
  const frames: Keyframe[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const ts = Math.round(seed.start + (seed.end - seed.start) * t);
    const x = Math.round(seed.startBox[0] + (seed.endBox[0] - seed.startBox[0]) * t);
    const y = Math.round(seed.startBox[1] + (seed.endBox[1] - seed.startBox[1]) * t);
    frames.push({
      timestamp_ms: ts,
      frame_no: Math.round((ts / 1000) * 30),
      geometry: { type: 'bbox', coords: [x, y, seed.startBox[2], seed.startBox[3]] },
      is_keyframe: true,
    });
  }
  return {
    version: '2.0-demo',
    track_id: seed.track_id,
    label_id: seed.label_id,
    label_display: seed.label_display,
    source: 'machine',
    confidence: seed.confidence,
    needs_review: seed.confidence < 0.5,
    keyframes: frames,
    review: { status: 'pending', changed_frames: 0, reviewed_at: null },
  };
}

const dataset: Dataset = {
  version: '2.0-demo',
  dataset_id: 'retail-cam',
  display: '商超监控样例',
  video_src: '/mock/retail-cam/retail_demo.mp4',
  thumb: '/mock/retail-cam/retail_thumb.jpg',
  metadata: {
    duration_ms: DURATION,
    frame_count: 1800,
    fps: 30.0,
    width: VIDEO_W,
    height: VIDEO_H,
    codec: 'h264',
    audio_tracks: 1,
    sampled_frames: 200,
  },
  annotations: SEEDS.map(gen),
  demo_script: {
    metadata_reveal_ms: 1500,
    inference_reveal_ms: 2500,
    review_focus_ids: ['trk_p1', 'trk_c1'],
  },
};

console.log(JSON.stringify(dataset, null, 2));
