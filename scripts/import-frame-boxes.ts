// scripts/import-frame-boxes.ts
// 用法: npx tsx scripts/import-frame-boxes.ts
//
// 把 assets/演示汇总/jiazhengnvhuang_13.json 转换为 city-road.json 的 frame_boxes 字段。
// 一次性脚本：跑一次后结果留在 JSON，CI 不再依赖 assets。

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface SourceFrame {
  frame_index: number;
  subtitle_text: string | null;
  parts: Array<{ part_id: number; text: string; box: Array<[number, number]> }>;
  objects: Array<{
    label: string;
    prompt_used: string;
    probability: number;
    box_px: [number, number, number, number];
  }>;
}

interface SourceFile {
  video_name: string;
  concatenated_subtitles: string;
  all_frames: SourceFrame[];
}

const FPS = 30;

function main() {
  const src = resolve(process.cwd(), 'assets/演示汇总/jiazhengnvhuang_13.json');
  const dst = resolve(process.cwd(), 'src/data/city-road.json');

  const data: SourceFile = JSON.parse(readFileSync(src, 'utf-8'));
  const dataset = JSON.parse(readFileSync(dst, 'utf-8'));

  const frames = data.all_frames.map((f) => ({
    frame_index: f.frame_index,
    timestamp_ms: Math.round((f.frame_index / FPS) * 1000),
    subtitle_text: f.subtitle_text,
    parts: f.parts,
    boxes: f.objects.map((o) => ({
      label: o.label,
      probability: o.probability,
      prompt_used: o.prompt_used,
      box: o.box_px,
    })),
  }));

  dataset.frame_boxes = {
    fps: FPS,
    video_size: [1920, 1080],
    frames,
  };

  writeFileSync(dst, JSON.stringify(dataset, null, 2));
  console.log(`✓ wrote ${frames.length} frames to city-road.json`);
}

main();
