// scripts/validate-fixture.mjs
// 用法: node scripts/validate-fixture.mjs
// 校验 src/data/*.json 是否合规

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const dataDir = resolve(process.cwd(), 'src/data');
const files = readdirSync(dataDir).filter(f => f.endsWith('.json'));

let failed = 0;

for (const file of files) {
  const path = resolve(dataDir, file);
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  const errs = [];

  // 1. 重复 track_id
  const ids = data.annotations.map(a => a.track_id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length > 0) errs.push(`重复 track_id: ${[...new Set(dup)].join(', ')}`);

  // 2. bbox 越界
  const { width: W, height: H } = data.metadata;
  for (const a of data.annotations) {
    for (const kf of a.keyframes) {
      const [x, y, w, h] = kf.geometry.coords;
      if (x < 0 || y < 0 || x + w > W || y + h > H) {
        errs.push(`${a.track_id} @ ${kf.timestamp_ms}ms bbox [${x},${y},${w},${h}] 越界 (视频 ${W}x${H})`);
      }
    }
  }

  // 3. 高置信车辆宽高比 ≥ 1.5
  for (const a of data.annotations) {
    if (a.label_id === 'vehicle' && (a.confidence ?? 0) >= 0.78) {
      const kf = a.keyframes[0];
      const [, , w, h] = kf.geometry.coords;
      if (w / h < 1.5) errs.push(`${a.track_id} 高置信车辆宽高比 ${(w / h).toFixed(2)} < 1.5`);
    }
  }

  // 4. 行人宽高比 ≤ 0.6
  for (const a of data.annotations) {
    if (a.label_id === 'pedestrian' && (a.confidence ?? 0) >= 0.78) {
      const kf = a.keyframes[0];
      const [, , w, h] = kf.geometry.coords;
      if (w / h > 0.6) errs.push(`${a.track_id} 高置信行人宽高比 ${(w / h).toFixed(2)} > 0.6`);
    }
  }

  // 5. review_focus_ids 必须存在于 annotations
  for (const id of data.demo_script.review_focus_ids) {
    if (!ids.includes(id)) errs.push(`review_focus_ids 中的 ${id} 在 annotations 里不存在`);
  }

  if (errs.length > 0) {
    console.error(`\n❌ ${file} 校验失败:`);
    errs.forEach(e => console.error('  -', e));
    failed++;
  } else {
    console.log(`✓ ${file} ok (${data.annotations.length} 标注)`);
  }
}

if (failed > 0) process.exit(1);
console.log('\n所有 fixture 校验通过');
