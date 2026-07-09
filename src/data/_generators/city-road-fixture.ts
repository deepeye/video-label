// 用法: npx tsx src/data/_generators/city-road-fixture.ts > src/data/city-road.json
//
// 生成城市道路主样例 Mock: 47 标注 + 3 重点项, 1920x1080 30s 视频。
// 设计意图 (spec §4.2.2):
//   trk_2  pedestrian  0.41  → 真行人, 机器没把握 → 虚拟主讲: ✓ 接受
//   trk_9  vehicle     0.48  → 真车辆, 框偏大需收紧 → 虚拟主讲: ✎ 改框
//   trk_5  traffic_sign 0.49 → 实际是路边广告牌, 误检 → 虚拟主讲: ✗ 否决

import type { Annotation, Dataset, Keyframe, BBox } from '../../types';

const VIDEO_W = 1920;
const VIDEO_H = 1080;
const VIDEO_DURATION_MS = 30_000;

interface Seed {
  track_id: string;
  label_id: 'pedestrian' | 'vehicle' | 'traffic_sign';
  label_display: string;
  confidence: number;
  start: number;
  end: number;
  startBox: BBox;
  endBox: BBox;
  is_focus?: boolean;
}

const FOCUS: Seed[] = [
  // trk_2: 行人 0.41 (✓ 接受) — 画面中下偏左, 走路过马路
  {
    track_id: 'trk_2',
    label_id: 'pedestrian',
    label_display: '行人',
    confidence: 0.41,
    start: 8000,
    end: 22000,
    startBox: [380, 620, 90, 220],
    endBox: [560, 600, 92, 215],
    is_focus: true,
  },
  // trk_9: 车辆 0.48 (✎ 改框, 框偏大) — 画面中偏右, 远处来车
  {
    track_id: 'trk_9',
    label_id: 'vehicle',
    label_display: '车辆',
    confidence: 0.48,
    start: 4000,
    end: 18000,
    startBox: [1100, 480, 320, 200],
    endBox: [900, 520, 340, 220],
    is_focus: true,
  },
  // trk_5: 交通标志 0.49 (✗ 否决, 误检为广告牌) — 画面右上, 静止
  {
    track_id: 'trk_5',
    label_id: 'traffic_sign',
    label_display: '交通标志',
    confidence: 0.49,
    start: 0,
    end: 30000,
    startBox: [1500, 120, 180, 220],
    endBox: [1500, 120, 180, 220],
    is_focus: true,
  },
];

// 用确定性 PRNG 生成可复现的随机
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20260618);

function randInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 2): number {
  const v = rng() * (max - min) + min;
  return Math.round(v * 10 ** decimals) / 10 ** decimals;
}

function buildHighConfTracks(): Seed[] {
  const out: Seed[] = [];

  // 28 高置信车辆 (宽高比 ≥ 1.5, 0.85-0.97)
  for (let i = 0; i < 28; i++) {
    const w = randInt(140, 360);
    const h = Math.floor(w / randFloat(1.5, 2.4)); // 宽高比 ≥ 1.5
    const x = randInt(0, VIDEO_W - w);
    const y = randInt(420, VIDEO_H - h);
    const start = randInt(0, VIDEO_DURATION_MS - 4000);
    const end = Math.min(VIDEO_DURATION_MS, start + randInt(3000, 12000));
    const dx = randInt(-80, 80);
    const dy = randInt(-30, 30);
    out.push({
      track_id: `trk_v${i + 1}`,
      label_id: 'vehicle',
      label_display: '车辆',
      confidence: randFloat(0.85, 0.97),
      start,
      end,
      startBox: [x, y, w, h],
      endBox: [Math.max(0, Math.min(VIDEO_W - w, x + dx)), Math.max(0, Math.min(VIDEO_H - h, y + dy)), w, h],
    });
  }

  // 12 高置信行人 (宽高比 ≤ 0.6, 0.78-0.94)
  for (let i = 0; i < 12; i++) {
    const h = randInt(180, 280);
    const w = Math.floor(h * randFloat(0.35, 0.6));
    const x = randInt(0, VIDEO_W - w);
    const y = randInt(560, VIDEO_H - h);
    const start = randInt(0, VIDEO_DURATION_MS - 4000);
    const end = Math.min(VIDEO_DURATION_MS, start + randInt(3000, 10000));
    out.push({
      track_id: `trk_p${i + 1}`,
      label_id: 'pedestrian',
      label_display: '行人',
      confidence: randFloat(0.78, 0.94),
      start,
      end,
      startBox: [x, y, w, h],
      endBox: [Math.max(0, Math.min(VIDEO_W - w, x + randInt(-40, 40))), y, w, h],
    });
  }

  // 4 高置信交通标志 (画面上部, 静止, 0.82-0.93)
  for (let i = 0; i < 4; i++) {
    const w = randInt(80, 160);
    const h = randInt(80, 160);
    const x = randInt(0, VIDEO_W - w);
    const y = randInt(60, 320);
    out.push({
      track_id: `trk_s${i + 1}`,
      label_id: 'traffic_sign',
      label_display: '交通标志',
      confidence: randFloat(0.82, 0.93),
      start: 0,
      end: VIDEO_DURATION_MS,
      startBox: [x, y, w, h],
      endBox: [x, y, w, h],
    });
  }

  return out;
}

function generateKeyframes(seed: Seed): Keyframe[] {
  // 5-8 个关键帧, 均匀分布
  const count = randInt(5, 8);
  const frames: Keyframe[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const ts = Math.round(seed.start + (seed.end - seed.start) * t);
    const x = Math.round(seed.startBox[0] + (seed.endBox[0] - seed.startBox[0]) * t);
    const y = Math.round(seed.startBox[1] + (seed.endBox[1] - seed.startBox[1]) * t);
    const w = Math.round(seed.startBox[2] + (seed.endBox[2] - seed.startBox[2]) * t);
    const h = Math.round(seed.startBox[3] + (seed.endBox[3] - seed.startBox[3]) * t);
    frames.push({
      timestamp_ms: ts,
      frame_no: Math.round((ts / 1000) * 30),
      geometry: { type: 'bbox', coords: [x, y, w, h] },
      is_keyframe: true,
    });
  }
  return frames;
}

function seedToAnnotation(seed: Seed): Annotation {
  return {
    version: '2.0-demo',
    track_id: seed.track_id,
    label_id: seed.label_id,
    label_display: seed.label_display,
    source: 'machine',
    confidence: seed.confidence,
    needs_review: seed.confidence < 0.5,
    keyframes: generateKeyframes(seed),
    review: { status: 'pending', changed_frames: 0, reviewed_at: null },
  };
}

function buildDataset(): Dataset {
  const all = [...FOCUS, ...buildHighConfTracks()];
  const annotations = all.map(seedToAnnotation);

  return {
    version: '2.0-demo',
    dataset_id: 'city-road',
    display: '城市道路样例',
    video_src: '/mock/city-road/road_demo.mp4',
    thumb: '/mock/city-road/road_thumb.jpg',
    metadata: {
      duration_ms: 30000,
      frame_count: 900,
      fps: 30.0,
      width: 1920,
      height: 1080,
      codec: 'h264',
      audio_tracks: 1,
      sampled_frames: 132,
    },
    annotations,
    demo_script: {
      metadata_reveal_ms: 1500,
      inference_reveal_ms: 2500,
      review_focus_ids: ['trk_2', 'trk_9', 'trk_5'],
    },
    segments: [
      {
        id: 'seg-1',
        clip_src: '/mock/storyboard/jiazhengnvhuang_13.mp4',
        start_ms: 0,
        end_ms: 10680,
        title: '家政女皇：软炒肉片',
        content_type: '美食',
      },
      {
        id: 'seg-2',
        clip_src: '/mock/storyboard/jiazhengnvhuang_5-result.mp4',
        start_ms: 10680,
        end_ms: 43760,
        title: '广告：益安宁丸',
        content_type: '广告',
      },
      {
        id: 'seg-3',
        clip_src: '/mock/storyboard/meilihebeisegment_001_2-result.mp4',
        start_ms: 43760,
        end_ms: 92000,
        title: '张家口康巴诺尔湿地',
        content_type: '纪录片',
      },
      {
        id: 'seg-4',
        clip_src: '/mock/storyboard/mingyilaile_17-0-result.mp4',
        start_ms: 92000,
        end_ms: 152000,
        title: '名医来了：访谈节目',
        content_type: '访谈',
      },
      {
        id: 'seg-5',
        clip_src: '/mock/storyboard/mingyilaile_17-4-result.mp4',
        start_ms: 152000,
        end_ms: 185080,
        title: '名医来了：科学应对儿童遗尿症',
        content_type: '医疗',
      },
    ],
  };
}

const dataset = buildDataset();
console.log(JSON.stringify(dataset, null, 2));
