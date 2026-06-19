import type { Annotation, BBox, Dataset, Keyframe } from '../../types';

const VIDEO_W = 1280;
const VIDEO_H = 720;
const DURATION = 45_000;

interface Seed {
  track_id: string;
  label_id: 'person' | 'laptop';
  label_display: string;
  confidence: number;
  start: number;
  end: number;
  startBox: BBox;
  endBox: BBox;
}

const SEEDS: Seed[] = [
  // 2 重点项
  { track_id: 'trk_p1', label_id: 'person',  label_display: '人', confidence: 0.43, start: 5_000,  end: 30_000, startBox: [200, 200, 180, 380], endBox: [220, 200, 180, 380] },
  { track_id: 'trk_l1', label_id: 'laptop',  label_display: '笔记本', confidence: 0.46, start: 0,    end: 45_000, startBox: [600, 380, 220, 140], endBox: [600, 380, 220, 140] },
  // 13 高置信
  { track_id: 'trk_p2', label_id: 'person',  label_display: '人', confidence: 0.86, start: 0, end: 45_000, startBox: [400, 180, 200, 400], endBox: [400, 180, 200, 400] },
  { track_id: 'trk_p3', label_id: 'person',  label_display: '人', confidence: 0.91, start: 0, end: 45_000, startBox: [800, 180, 200, 400], endBox: [800, 180, 200, 400] },
  { track_id: 'trk_p4', label_id: 'person',  label_display: '人', confidence: 0.88, start: 0, end: 45_000, startBox: [80, 220, 160, 360], endBox: [80, 220, 160, 360] },
  { track_id: 'trk_p5', label_id: 'person',  label_display: '人', confidence: 0.93, start: 10_000, end: 40_000, startBox: [1020, 200, 180, 400], endBox: [1020, 200, 180, 400] },
  { track_id: 'trk_l2', label_id: 'laptop',  label_display: '笔记本', confidence: 0.89, start: 0, end: 45_000, startBox: [220, 460, 220, 140], endBox: [220, 460, 220, 140] },
  { track_id: 'trk_l3', label_id: 'laptop',  label_display: '笔记本', confidence: 0.92, start: 0, end: 45_000, startBox: [820, 460, 220, 140], endBox: [820, 460, 220, 140] },
  { track_id: 'trk_l4', label_id: 'laptop',  label_display: '笔记本', confidence: 0.85, start: 0, end: 45_000, startBox: [1040, 460, 200, 140], endBox: [1040, 460, 200, 140] },
  { track_id: 'trk_l5', label_id: 'laptop',  label_display: '笔记本', confidence: 0.87, start: 0, end: 45_000, startBox: [40, 460, 160, 140], endBox: [40, 460, 160, 140] },
  { track_id: 'trk_p6', label_id: 'person',  label_display: '人', confidence: 0.82, start: 5_000, end: 35_000, startBox: [560, 200, 200, 380], endBox: [560, 200, 200, 380] },
  { track_id: 'trk_p7', label_id: 'person',  label_display: '人', confidence: 0.90, start: 8_000, end: 38_000, startBox: [380, 220, 180, 360], endBox: [380, 220, 180, 360] },
  { track_id: 'trk_p8', label_id: 'person',  label_display: '人', confidence: 0.84, start: 12_000, end: 42_000, startBox: [880, 220, 200, 380], endBox: [880, 220, 200, 380] },
  { track_id: 'trk_l6', label_id: 'laptop',  label_display: '笔记本', confidence: 0.83, start: 0, end: 45_000, startBox: [620, 580, 200, 100], endBox: [620, 580, 200, 100] },
  { track_id: 'trk_p9', label_id: 'person',  label_display: '人', confidence: 0.81, start: 0, end: 45_000, startBox: [1080, 280, 140, 320], endBox: [1080, 280, 140, 320] },
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
  dataset_id: 'meeting-room',
  display: '室内会议样例',
  video_src: '/mock/meeting-room/meeting_demo.mp4',
  thumb: '/mock/meeting-room/meeting_thumb.jpg',
  metadata: {
    duration_ms: DURATION,
    frame_count: 1350,
    fps: 30.0,
    width: VIDEO_W,
    height: VIDEO_H,
    codec: 'h264',
    audio_tracks: 1,
    sampled_frames: 90,
  },
  annotations: SEEDS.map(gen),
  demo_script: {
    metadata_reveal_ms: 1500,
    inference_reveal_ms: 2000,
    review_focus_ids: ['trk_p1', 'trk_l1'],
  },
};

console.log(JSON.stringify(dataset, null, 2));
