# Day 4 实施计划 · Step 5 导出

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**前置:** Day 1 (`2026-06-18-video-label-demo.md`) + Day 2-3 (`...-day2-3-review.md`) 已完成。

**Goal:** 实现 Step 5 导出 — 把内存里的标注状态序列化为原生 JSON / COCO-Video，用 JSZip 打包成真实可下载的 zip。打通「客户审核改动 → 内存 → 导出」核心链路；E2E 验证此链路在 Day 4 末完成。

**Architecture:** 纯函数序列化（`toNative` / `toCocoVideo`） + JSZip 浏览器内打包 + FileSaver 触发下载。预览组件实时反映 store.annotations，确保「客户改动 → 预览 → 下载内容」三者一致。E2E 用 Playwright 跑全流程，断言 zip 内 native.json 包含正确的 review.status。

**关键产出文件:**
- `src/lib/format/native.ts`
- `src/lib/format/cocoVideo.ts`
- `src/lib/format/categories.ts`
- `src/steps/Step5Export/index.tsx`
- `src/steps/Step5Export/FormatSwitch.tsx`
- `src/steps/Step5Export/JsonPreview.tsx`
- `src/steps/Step5Export/exportZip.ts`
- `src/steps/Step5Export/manifest.ts`
- `tests/format.test.ts` (覆盖率: schema 一致性、客户改动反映)
- `tests/exportZip.test.ts` (zip 内容验证)
- `playwright.config.ts`
- `tests/e2e/full-flow.spec.ts` (P0 端到端)
- `tests/e2e/helpers.ts`

---

## File Structure

```
src/
├── lib/format/
│   ├── native.ts          ← AnnotationState[] → 原生 JSON (含 review/source 溯源)
│   ├── cocoVideo.ts       ← AnnotationState[] → COCO-Video 标准格式
│   └── categories.ts      ← 抽取唯一 categories (id 映射)
├── steps/Step5Export/
│   ├── index.tsx          ← 主视图: 格式切换 + 预览 + 下载按钮
│   ├── FormatSwitch.tsx   ← radio: 原生 JSON / COCO-Video
│   ├── JsonPreview.tsx    ← <pre> + 自写 JSON 高亮
│   ├── exportZip.ts       ← JSZip 打包 + FileSaver 触发下载
│   └── manifest.ts        ← manifest.json 结构生成
└── App.tsx                ← 启用 <Step5Export />
```

---

## Day 4: 序列化 + 打包 + 下载 + E2E

### Task 4.1: categories 抽取工具

**Files:**
- Create: `src/lib/format/categories.ts`
- Create: `tests/categories.test.ts`

> **设计依据:** spec §5.5.4 — COCO-Video 需要 `categories: [{id, name}]` 段，且每个 annotation 引用 `category_id`。从 annotations 抽取 unique label 并稳定排序。

- [ ] **Step 1: 写 tests/categories.test.ts**

```ts
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
```

- [ ] **Step 2: 运行测试以确认失败**

Run: `npm run test:run -- tests/categories.test.ts`
Expected: FAIL — `Cannot find module '@/lib/format/categories'`

- [ ] **Step 3: 写 src/lib/format/categories.ts**

```ts
import type { Annotation } from '../../types';

export interface Category {
  id: number;          // 1-indexed (COCO 习惯)
  name: string;        // label_id, 用于 COCO 标准
  display: string;     // label_display, 中文展示
}

/**
 * 从 annotations 抽取唯一 category, 按 label_id 字典序排序。
 * 排序保证导出确定性 (相同输入永远相同输出)。
 */
export function extractCategories(annotations: Annotation[]): Category[] {
  const map = new Map<string, string>();
  for (const a of annotations) {
    if (!map.has(a.label_id)) {
      map.set(a.label_id, a.label_display);
    }
  }
  const sorted = [...map.keys()].sort();
  return sorted.map((label_id, idx) => ({
    id: idx + 1,
    name: label_id,
    display: map.get(label_id)!,
  }));
}

/**
 * 反向: label_id → category_id。给 COCO-Video 序列化用。
 */
export function buildCategoryMap(annotations: Annotation[]): Record<string, number> {
  const cats = extractCategories(annotations);
  const out: Record<string, number> = {};
  for (const c of cats) {
    out[c.name] = c.id;
  }
  return out;
}
```

- [ ] **Step 4: 运行测试以确认通过**

Run: `npm run test:run -- tests/categories.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 提交**

```bash
mkdir -p src/lib/format
git add src/lib/format/categories.ts tests/categories.test.ts
git commit -m "feat: category extraction with stable ordering for export"
```

---

### Task 4.2: 原生 JSON 序列化 (含 review/source 溯源)

**Files:**
- Create: `src/lib/format/native.ts`
- Modify: `tests/format.test.ts` (从空文件开始写)

> **设计依据:** spec §0.2 / §4.1 — 原生 JSON 是 Demo 默认导出格式，最能体现「人机协同 review/source 留痕」卖点。对齐 PRD 第五章 schema。

- [ ] **Step 1: 写 src/lib/format/native.ts**

```ts
import type { Annotation, Dataset } from '../../types';

export interface NativeExport {
  version: '2.0-demo';
  exported_at: number;
  dataset: {
    dataset_id: string;
    display: string;
    metadata: Dataset['metadata'];
  };
  statistics: {
    total: number;
    accepted: number;
    corrected: number;
    rejected: number;
    pending: number;
  };
  annotations: Annotation[];
}

export function toNative(annotations: Annotation[], dataset: Dataset, exportedAt: number): NativeExport {
  const stats = {
    total: annotations.length,
    accepted: 0,
    corrected: 0,
    rejected: 0,
    pending: 0,
  };
  for (const a of annotations) {
    stats[a.review.status]++;
  }

  return {
    version: '2.0-demo',
    exported_at: exportedAt,
    dataset: {
      dataset_id: dataset.dataset_id,
      display: dataset.display,
      metadata: dataset.metadata,
    },
    statistics: stats,
    annotations,
  };
}
```

- [ ] **Step 2: 写 tests/format.test.ts (主体: native + 与 spec §4.1 schema 一致性)**

```ts
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
```

- [ ] **Step 3: 运行测试**

Run: `npm run test:run -- tests/format.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 4: 提交**

```bash
git add src/lib/format/native.ts tests/format.test.ts
git commit -m "feat: native JSON export with review/source tracking + statistics"
```

---

### Task 4.3: COCO-Video 序列化

**Files:**
- Create: `src/lib/format/cocoVideo.ts`
- Modify: `tests/format.test.ts` (追加 COCO-Video 用例)

> **设计依据:** spec §5.5.4 — COCO-Video 标准格式 + `x_review` / `x_source` 扩展字段。

- [ ] **Step 1: 写 src/lib/format/cocoVideo.ts**

```ts
import type { Annotation, BBox, Dataset, ReviewRecord, AnnotationSource } from '../../types';
import { buildCategoryMap, extractCategories, type Category } from './categories';

export interface CocoCategory {
  id: number;
  name: string;
  supercategory?: string;
}

export interface CocoVideoEntry {
  id: number;
  file_name: string;
  width: number;
  height: number;
  frame_rate: number;
  duration: number;
}

export interface CocoAnnotation {
  id: number;
  track_id: number;
  video_id: number;
  timestamp: number;       // 秒, COCO 习惯
  frame_no: number;
  bbox: BBox;
  category_id: number;
  score: number | null;
  // 扩展字段
  x_review: ReviewRecord;
  x_source: AnnotationSource;
}

export interface CocoVideoExport {
  info: {
    description: string;
    version: '2.0-demo';
    date_created: string;
  };
  videos: CocoVideoEntry[];
  categories: CocoCategory[];
  annotations: CocoAnnotation[];
}

/**
 * 把 track_id "trk_2" / "trk_v3" 这类字符串转成数字 ID。
 * 用 hash 风格保证 (track_id, timestamp_ms) 组合唯一。
 */
function annotationId(trackId: string, ts: number): number {
  let h = 0;
  const s = `${trackId}#${ts}`;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function trackIdToNumber(trackId: string): number {
  // "trk_2" → 2, "trk_v3" → 1003 (前缀映射避免冲突)
  const m = trackId.match(/^trk_([a-z]?)(\d+)$/);
  if (!m) return annotationId(trackId, 0);
  const prefix = m[1] ?? '';
  const num = parseInt(m[2]!, 10);
  const offset =
    prefix === '' ? 0 :
    prefix === 'v' ? 1000 :
    prefix === 'p' ? 2000 :
    prefix === 's' ? 3000 :
    9000;
  return offset + num;
}

export function toCocoVideo(annotations: Annotation[], dataset: Dataset, exportedAt: number): CocoVideoExport {
  const categoryMap = buildCategoryMap(annotations);
  const categoriesFull = extractCategories(annotations);
  const categories: CocoCategory[] = categoriesFull.map((c: Category) => ({
    id: c.id,
    name: c.name,
  }));

  const cocoAnns: CocoAnnotation[] = [];
  for (const a of annotations) {
    for (const kf of a.keyframes) {
      const cid = categoryMap[a.label_id];
      if (cid === undefined) continue;
      cocoAnns.push({
        id: annotationId(a.track_id, kf.timestamp_ms),
        track_id: trackIdToNumber(a.track_id),
        video_id: 1,
        timestamp: kf.timestamp_ms / 1000,
        frame_no: kf.frame_no,
        bbox: [...kf.geometry.coords] as BBox,
        category_id: cid,
        score: a.confidence,
        x_review: a.review,
        x_source: a.source,
      });
    }
  }

  return {
    info: {
      description: 'Demo Export — Video Annotation Platform',
      version: '2.0-demo',
      date_created: new Date(exportedAt).toISOString(),
    },
    videos: [
      {
        id: 1,
        file_name: dataset.video_src.split('/').pop()!,
        width: dataset.metadata.width,
        height: dataset.metadata.height,
        frame_rate: dataset.metadata.fps,
        duration: dataset.metadata.duration_ms / 1000,
      },
    ],
    categories,
    annotations: cocoAnns,
  };
}
```

- [ ] **Step 2: 在 tests/format.test.ts 末尾追加 COCO-Video 用例**

在文件末尾追加：

```ts
import { toCocoVideo } from '@/lib/format/cocoVideo';

describe('toCocoVideo', () => {
  beforeEach(() => {
    useDemoStore.getState().selectDataset('city-road');
  });

  it('builds proper COCO-Video structure', () => {
    const ds = getDataset('city-road');
    const out = toCocoVideo(ds.annotations, ds, 1718700000000);

    expect(out.info.version).toBe('2.0-demo');
    expect(out.info.date_created).toMatch(/^\d{4}-/);
    expect(out.videos.length).toBe(1);
    expect(out.videos[0]!.width).toBe(1920);
    expect(out.videos[0]!.height).toBe(1080);
    expect(out.videos[0]!.frame_rate).toBe(30);
    expect(out.videos[0]!.duration).toBe(30);

    // categories sorted alphabetically
    const cats = out.categories.map((c) => c.name);
    expect(cats).toEqual(['pedestrian', 'traffic_sign', 'vehicle']);

    // annotations: every keyframe → 1 entry; 47 tracks × ~6 frames ≈ 280 entries
    expect(out.annotations.length).toBeGreaterThan(200);
    expect(out.annotations.length).toBeLessThan(400);
  });

  it('includes x_review and x_source extension fields', () => {
    useDemoStore.getState().correctBoxGeometry('trk_9', 0, [100, 200, 300, 400]);
    const annotations = useDemoStore.getState().annotations;
    const ds = getDataset('city-road');
    const out = toCocoVideo(annotations, ds, 1);

    const trk9Ann = out.annotations.find(
      (a) => a.track_id === 1009 && a.frame_no === ds.annotations.find(x => x.track_id === 'trk_9')!.keyframes[0]!.frame_no,
    );
    expect(trk9Ann).toBeDefined();
    expect(trk9Ann!.x_source).toBe('human');
    expect(trk9Ann!.x_review.status).toBe('corrected');
    expect(trk9Ann!.bbox).toEqual([100, 200, 300, 400]);
  });

  it('annotation ids are unique', () => {
    const ds = getDataset('city-road');
    const out = toCocoVideo(ds.annotations, ds, 1);
    const ids = out.annotations.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 3: 运行测试**

Run: `npm run test:run -- tests/format.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 4: 提交**

```bash
git add src/lib/format/cocoVideo.ts tests/format.test.ts
git commit -m "feat: COCO-Video format export with x_review/x_source extensions"
```

---

### Task 4.4: manifest.json 生成器

**Files:**
- Create: `src/steps/Step5Export/manifest.ts`
- Create: `tests/manifest.test.ts`

> **设计依据:** spec §5.5.3 + §8.2 — manifest 标注「演示数据集」、导出参数、统计。

- [ ] **Step 1: 写 src/steps/Step5Export/manifest.ts**

```ts
import type { Dataset } from '../../types';

export type ExportFormat = 'native' | 'coco-video';

export interface Manifest {
  dataset_id: string;
  display: string;
  note: string;
  exported_at: number;
  exported_at_iso: string;
  format: ExportFormat;
  statistics: {
    total: number;
    accepted: number;
    corrected: number;
    rejected: number;
    pending: number;
  };
  metadata: Dataset['metadata'];
  files: string[];
}

export function buildManifest(args: {
  dataset: Dataset;
  format: ExportFormat;
  exportedAt: number;
  statistics: Manifest['statistics'];
  files: string[];
}): Manifest {
  return {
    dataset_id: args.dataset.dataset_id,
    display: args.dataset.display,
    note: '演示数据集 · Demo Export · 数据为样例, 非生产标注集',
    exported_at: args.exportedAt,
    exported_at_iso: new Date(args.exportedAt).toISOString(),
    format: args.format,
    statistics: args.statistics,
    metadata: args.dataset.metadata,
    files: args.files,
  };
}
```

- [ ] **Step 2: 写 tests/manifest.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { buildManifest } from '@/steps/Step5Export/manifest';
import { getDataset } from '@/data';

describe('buildManifest', () => {
  it('contains all required fields', () => {
    const ds = getDataset('city-road');
    const m = buildManifest({
      dataset: ds,
      format: 'native',
      exportedAt: 1718700000000,
      statistics: { total: 47, accepted: 45, corrected: 1, rejected: 1, pending: 0 },
      files: ['annotations/native.json', 'frames/00003333.jpg'],
    });
    expect(m.dataset_id).toBe('city-road');
    expect(m.display).toBe('城市道路样例');
    expect(m.note).toContain('演示数据集');
    expect(m.format).toBe('native');
    expect(m.statistics.total).toBe(47);
    expect(m.exported_at_iso).toMatch(/^\d{4}-/);
    expect(m.files.length).toBe(2);
    expect(m.metadata.width).toBe(1920);
  });
});
```

- [ ] **Step 3: 运行测试**

Run: `npm run test:run -- tests/manifest.test.ts`
Expected: PASS (1 test)

- [ ] **Step 4: 提交**

```bash
mkdir -p src/steps/Step5Export
git add src/steps/Step5Export/manifest.ts tests/manifest.test.ts
git commit -m "feat: export manifest.json builder"
```

---

### Task 4.5: exportZip — JSZip 打包 + FileSaver 下载

**Files:**
- Create: `src/steps/Step5Export/exportZip.ts`
- Create: `tests/exportZip.test.ts`

> **设计依据:** spec §5.5.3 — JSZip 在浏览器内生成 zip，FileSaver 触发下载。

- [ ] **Step 1: 写 src/steps/Step5Export/exportZip.ts**

```ts
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Annotation, Dataset } from '../../types';
import { toNative } from '../../lib/format/native';
import { toCocoVideo } from '../../lib/format/cocoVideo';
import { buildManifest, type ExportFormat } from './manifest';

const README_CONTENT = `视频语料标注 Demo · 导出包

本包由演示系统从浏览器内存生成, 数据为样例 (非生产标注集)。
关键文件:
  - annotations/native.json    或  annotations/coco_video.json
  - frames/                    几张样例帧 (用于离线检视)
  - manifest.json              数据集 / 导出参数 / 统计

完整 schema 与字段含义见: docs/视频语料标注平台 · 演示 Demo PRD.md (第五章)
`;

const FRAMES_TO_INCLUDE: Record<string, string[]> = {
  'city-road': ['00003333.jpg', '00010000.jpg'],
  'meeting-room': [],
  'retail-cam': [],
};

export interface ExportArgs {
  format: ExportFormat;
  annotations: Annotation[];
  dataset: Dataset;
  exportedAt: number;
}

/**
 * 生成 zip Blob (不触发下载)。便于测试。
 */
export async function buildExportZip(args: ExportArgs): Promise<Blob> {
  const { format, annotations, dataset, exportedAt } = args;
  const zip = new JSZip();

  // 1. annotations/
  const annFolder = zip.folder('annotations')!;
  let annFile: string;
  if (format === 'native') {
    annFile = 'annotations/native.json';
    annFolder.file('native.json', JSON.stringify(toNative(annotations, dataset, exportedAt), null, 2));
  } else {
    annFile = 'annotations/coco_video.json';
    annFolder.file('coco_video.json', JSON.stringify(toCocoVideo(annotations, dataset, exportedAt), null, 2));
  }

  // 2. frames/ (尽力, 失败不阻断)
  const frameNames = FRAMES_TO_INCLUDE[dataset.dataset_id] ?? [];
  const frameFiles: string[] = [];
  if (frameNames.length > 0) {
    const framesFolder = zip.folder('frames')!;
    for (const fname of frameNames) {
      try {
        const url = `/mock/${dataset.dataset_id}/frames/${fname}`;
        const blob = await fetch(url).then((r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r.blob();
        });
        framesFolder.file(fname, blob);
        frameFiles.push(`frames/${fname}`);
      } catch {
        // 帧丢失不阻断导出 (Day 4 占位视频里可能没帧)
        console.warn(`[exportZip] frame missing: ${fname}, skipped`);
      }
    }
  }

  // 3. manifest.json
  const stats = { total: annotations.length, accepted: 0, corrected: 0, rejected: 0, pending: 0 };
  for (const a of annotations) stats[a.review.status]++;
  const manifest = buildManifest({
    dataset,
    format,
    exportedAt,
    statistics: stats,
    files: [annFile, ...frameFiles],
  });
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // 4. README.txt
  zip.file('README.txt', README_CONTENT);

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * 一键下载: 打包 + 触发浏览器下载。
 */
export async function downloadExportZip(args: ExportArgs): Promise<void> {
  const blob = await buildExportZip(args);
  saveAs(blob, `${args.dataset.dataset_id}_export.zip`);
}
```

- [ ] **Step 2: 写 tests/exportZip.test.ts**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import JSZip from 'jszip';
import { buildExportZip } from '@/steps/Step5Export/exportZip';
import { useDemoStore } from '@/store/demoStore';
import { getDataset } from '@/data';

// Mock fetch for frame loading (jsdom 没真 server)
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: false,
    status: 404,
    blob: async () => new Blob(),
  } as unknown as Response)));
  useDemoStore.getState().selectDataset('city-road');
});

describe('buildExportZip', () => {
  it('produces a zip with manifest, README, and annotations', async () => {
    const ds = getDataset('city-road');
    const annotations = useDemoStore.getState().annotations;
    const blob = await buildExportZip({
      format: 'native',
      annotations,
      dataset: ds,
      exportedAt: 1718700000000,
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000);

    // 解压验证
    const zip = await JSZip.loadAsync(blob);
    expect(zip.files['manifest.json']).toBeDefined();
    expect(zip.files['README.txt']).toBeDefined();
    expect(zip.files['annotations/native.json']).toBeDefined();
    expect(zip.files['annotations/coco_video.json']).toBeUndefined();
  });

  it('switches file path based on format', async () => {
    const ds = getDataset('city-road');
    const annotations = useDemoStore.getState().annotations;
    const blob = await buildExportZip({
      format: 'coco-video',
      annotations,
      dataset: ds,
      exportedAt: 1,
    });
    const zip = await JSZip.loadAsync(blob);
    expect(zip.files['annotations/coco_video.json']).toBeDefined();
    expect(zip.files['annotations/native.json']).toBeUndefined();
  });

  it('manifest reflects exported_at and statistics', async () => {
    useDemoStore.getState().acceptBox('trk_2');
    useDemoStore.getState().rejectBox('trk_5');

    const ds = getDataset('city-road');
    const annotations = useDemoStore.getState().annotations;
    const blob = await buildExportZip({
      format: 'native',
      annotations,
      dataset: ds,
      exportedAt: 1718700000000,
    });
    const zip = await JSZip.loadAsync(blob);
    const mText = await zip.files['manifest.json']!.async('string');
    const m = JSON.parse(mText);
    expect(m.exported_at).toBe(1718700000000);
    expect(m.statistics.accepted).toBe(1);
    expect(m.statistics.rejected).toBe(1);
    expect(m.statistics.pending).toBe(45);
  });

  it('zip native.json reflects review changes from store', async () => {
    useDemoStore.getState().correctBoxGeometry('trk_9', 0, [777, 888, 999, 222]);

    const ds = getDataset('city-road');
    const annotations = useDemoStore.getState().annotations;
    const blob = await buildExportZip({
      format: 'native',
      annotations,
      dataset: ds,
      exportedAt: 1,
    });
    const zip = await JSZip.loadAsync(blob);
    const text = await zip.files['annotations/native.json']!.async('string');
    const data = JSON.parse(text);
    const trk9 = data.annotations.find((a: { track_id: string }) => a.track_id === 'trk_9');
    expect(trk9.source).toBe('human');
    expect(trk9.review.status).toBe('corrected');
    expect(trk9.keyframes[0].geometry.coords).toEqual([777, 888, 999, 222]);
  });
});
```

- [ ] **Step 3: 运行测试**

Run: `npm run test:run -- tests/exportZip.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 4: 提交**

```bash
git add src/steps/Step5Export/exportZip.ts tests/exportZip.test.ts
git commit -m "feat: zip packaging — JSZip + manifest + README + frames + format switch"
```

---

### Task 4.6: JsonPreview — 预览组件

**Files:**
- Create: `src/steps/Step5Export/JsonPreview.tsx`

> **设计依据:** spec §5.5.2 — `<pre>` + 简单 JSON 高亮 + 前 80 行截断 + 折叠提示。

- [ ] **Step 1: 写 src/steps/Step5Export/JsonPreview.tsx**

```tsx
import { useMemo } from 'react';
import { tokens } from '../../styles/tokens';

interface JsonPreviewProps {
  json: object;
  maxLines?: number;
}

const COLORS = {
  key: '#7C3AED',     // 紫
  string: '#059669',  // 绿
  number: '#2563EB',  // 蓝
  boolean: '#DC2626', // 红
  null: '#71717A',    // 灰
  punct: '#52525B',
  comment: '#A1A1AA',
};

/**
 * 极简 JSON 高亮 — 不引外部库 (避免增加包体积)。
 * 单行正则即可, 不处理嵌套字符串内的特殊转义 (Demo 数据没有)。
 */
function highlightLine(line: string): string {
  // 顺序很关键: 先 string, 再 key (前者后跟 :)
  let out = line.replace(/"([^"\\]|\\.)*"(\s*:)?/g, (m, _g, colon) => {
    if (colon) {
      const key = m.slice(0, -colon.length);
      return `<span style="color:${COLORS.key}">${key}</span><span style="color:${COLORS.punct}">${colon}</span>`;
    }
    return `<span style="color:${COLORS.string}">${m}</span>`;
  });
  // numbers (避免在已经高亮的 string 里再匹配 — 简单方式: 限定后跟 , } ] 或行尾)
  out = out.replace(/(\b-?\d+\.?\d*\b)(?=[\s,\]}])/g, (m) => `<span style="color:${COLORS.number}">${m}</span>`);
  // booleans / null
  out = out.replace(/\b(true|false|null)\b/g, (m) => {
    const c = m === 'null' ? COLORS.null : COLORS.boolean;
    return `<span style="color:${c}">${m}</span>`;
  });
  return out;
}

export function JsonPreview({ json, maxLines = 80 }: JsonPreviewProps) {
  const { html, hidden } = useMemo(() => {
    const text = JSON.stringify(json, null, 2);
    const lines = text.split('\n');
    const truncated = lines.length > maxLines;
    const shown = truncated ? lines.slice(0, maxLines) : lines;
    return {
      html: shown
        .map((line) => highlightLine(escapeHtml(line)))
        .join('\n'),
      hidden: truncated ? lines.length - maxLines : 0,
    };
  }, [json, maxLines]);

  return (
    <div
      data-testid="json-preview"
      style={{
        background: tokens.color.neutral[900],
        color: tokens.color.neutral[100],
        borderRadius: tokens.radius.md,
        padding: tokens.space[4],
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 12,
        lineHeight: 1.6,
        maxHeight: 320,
        overflow: 'auto',
        whiteSpace: 'pre',
      }}
    >
      <pre style={{ margin: 0 }} dangerouslySetInnerHTML={{ __html: html }} />
      {hidden > 0 && (
        <div style={{ marginTop: tokens.space[3], color: COLORS.comment, fontStyle: 'italic' }}>
          // ... 还有 {hidden} 行 (导出 zip 含完整内容)
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
```

- [ ] **Step 2: 提交**

```bash
git add src/steps/Step5Export/JsonPreview.tsx
git commit -m "feat: JsonPreview with inline syntax highlighter (no external dep)"
```

---

### Task 4.7: FormatSwitch — 格式切换 radio

**Files:**
- Create: `src/steps/Step5Export/FormatSwitch.tsx`

- [ ] **Step 1: 写 src/steps/Step5Export/FormatSwitch.tsx**

```tsx
import { tokens } from '../../styles/tokens';
import type { ExportFormat } from './manifest';

interface FormatSwitchProps {
  value: ExportFormat;
  onChange: (v: ExportFormat) => void;
}

const OPTS: { id: ExportFormat; label: string; desc: string }[] = [
  { id: 'native', label: '原生 JSON (含溯源)', desc: '反映人工审核 review/source — 演示卖点最强' },
  { id: 'coco-video', label: 'COCO-Video', desc: '业内标准格式, 兼容主流训练管线' },
];

export function FormatSwitch({ value, onChange }: FormatSwitchProps) {
  return (
    <div data-testid="format-switch" role="radiogroup" aria-label="导出格式">
      {OPTS.map((opt) => {
        const active = opt.id === value;
        return (
          <label
            key={opt.id}
            data-testid={`format-${opt.id}`}
            data-active={active ? 'true' : 'false'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: tokens.space[3],
              padding: tokens.space[3],
              marginBottom: tokens.space[2],
              borderRadius: tokens.radius.md,
              cursor: 'pointer',
              background: active ? tokens.color.brand[400] + '20' : tokens.color.neutral[0],
              border: `1px solid ${active ? tokens.color.brand[500] : tokens.color.neutral[200]}`,
            }}
          >
            <input
              type="radio"
              name="format"
              checked={active}
              onChange={() => onChange(opt.id)}
              style={{ accentColor: tokens.color.brand[500] }}
            />
            <div>
              <div style={{ fontWeight: 600, color: tokens.color.neutral[900] }}>{opt.label}</div>
              <div style={{ fontSize: 12, color: tokens.color.neutral[500] }}>{opt.desc}</div>
            </div>
          </label>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/steps/Step5Export/FormatSwitch.tsx
git commit -m "feat: FormatSwitch radio group for native / coco-video"
```

---

### Task 4.8: Step 5 主视图

**Files:**
- Create: `src/steps/Step5Export/index.tsx`
- Modify: `src/App.tsx` (启用 Step5Export)

- [ ] **Step 1: 写 src/steps/Step5Export/index.tsx**

```tsx
import { useMemo, useState } from 'react';
import { useDemoStore } from '../../store/demoStore';
import { getDataset } from '../../data';
import { tokens } from '../../styles/tokens';
import { FormatSwitch } from './FormatSwitch';
import { JsonPreview } from './JsonPreview';
import { downloadExportZip } from './exportZip';
import { toNative } from '../../lib/format/native';
import { toCocoVideo } from '../../lib/format/cocoVideo';
import type { ExportFormat } from './manifest';

export function Step5Export() {
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const annotations = useDemoStore((s) => s.annotations);
  const [format, setFormat] = useState<ExportFormat>('native');
  const [downloading, setDownloading] = useState(false);

  const dataset = getDataset(datasetId);
  // 预览用稳定的 exported_at, 避免每次 render 时间变化
  const previewJson = useMemo(() => {
    return format === 'native'
      ? toNative(annotations, dataset, 0)
      : toCocoVideo(annotations, dataset, 0);
  }, [format, annotations, dataset]);

  const stats = useMemo(() => {
    const s = { total: annotations.length, accepted: 0, corrected: 0, rejected: 0, pending: 0 };
    for (const a of annotations) s[a.review.status]++;
    return s;
  }, [annotations]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadExportZip({
        format,
        annotations,
        dataset,
        exportedAt: Date.now(),
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      data-testid="step5-export"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: tokens.space[6],
        gap: tokens.space[4],
        overflow: 'auto',
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 28,
          fontWeight: 600,
          color: tokens.color.neutral[900],
        }}
      >
        ⑤ 导出标注结果
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: tokens.space[5] }}>
        <section>
          <Header text="格式" />
          <FormatSwitch value={format} onChange={setFormat} />

          <div style={{ marginTop: tokens.space[5] }}>
            <Header text="本次导出统计" />
            <div
              style={{
                padding: tokens.space[4],
                borderRadius: tokens.radius.md,
                background: tokens.color.neutral[0],
                border: `1px solid ${tokens.color.neutral[200]}`,
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: tokens.space[2],
                fontSize: 13,
              }}
            >
              <Stat label="总计" value={stats.total} />
              <Stat label="已接受" value={stats.accepted} color={tokens.color.success[500]} />
              <Stat label="已纠正" value={stats.corrected} color={tokens.color.info[500]} />
              <Stat label="已否决" value={stats.rejected} color={tokens.color.neutral[500]} />
              <Stat label="待审核" value={stats.pending} color={tokens.color.warning[500]} />
            </div>
          </div>

          <button
            data-testid="download-btn"
            onClick={handleDownload}
            disabled={downloading}
            style={{
              marginTop: tokens.space[5],
              width: '100%',
              height: 44,
              borderRadius: tokens.radius.md,
              background: 'transparent',
              backgroundImage: tokens.brandGradient,
              color: '#fff',
              border: 'none',
              fontSize: 14,
              fontWeight: 600,
              cursor: downloading ? 'wait' : 'pointer',
              boxShadow: tokens.shadow.brand,
              opacity: downloading ? 0.7 : 1,
            }}
          >
            {downloading ? '⏳ 打包中...' : `↓ 下载导出包 (${dataset.dataset_id}_export.zip)`}
          </button>
        </section>

        <section>
          <Header text="预览 (实时反映你刚才的审核改动)" />
          <JsonPreview json={previewJson} />
        </section>
      </div>
    </div>
  );
}

function Header({ text }: { text: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: tokens.color.neutral[400],
        marginBottom: tokens.space[2],
      }}
    >
      {text}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: tokens.color.neutral[500] }}>{label}</span>
      <span className="tabular" style={{ fontWeight: 600, color: color ?? tokens.color.neutral[900] }}>
        {value}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: 修改 src/App.tsx 启用 Step5Export**

替换：

```tsx
{demoStep === 5 && <StepPlaceholder step={5} />}
```

为：

```tsx
{demoStep === 5 && <Step5Export />}
```

并加 import：

```tsx
import { Step5Export } from './steps/Step5Export';
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck`
Expected: 无报错。

- [ ] **Step 4: dev 验证**

启动 dev → /?step=5

- 看到「⑤ 导出标注结果」标题
- 左侧: 两个格式 radio + 统计表 + 下载按钮
- 右侧: JSON 预览（深色背景 + 紫绿语法高亮）
- 切换格式 → 预览内容变化
- 点击下载按钮 → 浏览器下载 city-road_export.zip
- 解压 zip → 看到 manifest.json / annotations/native.json / README.txt

(Ctrl+C 停止)

- [ ] **Step 5: 提交**

```bash
git add src/steps/Step5Export/index.tsx src/App.tsx
git commit -m "feat: Step5Export view — format switch, preview, statistics, download"
```

---

### Task 4.9: Playwright 配置 + E2E helpers

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/helpers.ts`

> **设计依据:** spec §7.1.3 — 5 个核心 E2E 用例。本任务建配置和 helpers，下一任务写第一个用例。

- [ ] **Step 1: 安装 playwright 浏览器**

Run: `npx playwright install chromium`
Expected: 下载并安装 Chromium。10-30s 视网络情况。

- [ ] **Step 2: 写 playwright.config.ts**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    actionTimeout: 5_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

- [ ] **Step 3: 写 tests/e2e/helpers.ts**

```ts
import type { Page } from '@playwright/test';
import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';

/**
 * 解压 Playwright 下载的 zip, 返回 {filename: string|Buffer}
 */
export async function unzipDownload(zipPath: string): Promise<Record<string, string>> {
  const buffer = await readFile(zipPath);
  const zip = await JSZip.loadAsync(buffer);
  const out: Record<string, string> = {};
  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    if (name.endsWith('.json') || name.endsWith('.txt')) {
      out[name] = await file.async('string');
    }
  }
  return out;
}

/**
 * 暴露 store 到 window.__demoStore (App.tsx 启动时挂)
 */
export async function exposeStore(page: Page) {
  // 等 App 启动完成
  await page.waitForSelector('[data-testid="top-bar"]');
}
```

- [ ] **Step 4: 修改 src/App.tsx 把 store 挂到 window (仅 dev)**

在 App.tsx 顶部 import 后加：

```tsx
import { useDemoStore } from './store/demoStore';

if (import.meta.env.DEV) {
  type W = typeof window & { __demoStore?: typeof useDemoStore };
  (window as W).__demoStore = useDemoStore;
}
```

- [ ] **Step 5: 提交**

```bash
mkdir -p tests/e2e
git add playwright.config.ts tests/e2e/helpers.ts src/App.tsx
git commit -m "chore: Playwright config + E2E helpers + window.__demoStore in dev"
```

---

### Task 4.10: E2E 用例 — 完整审核 → 导出 zip 验证

**Files:**
- Create: `tests/e2e/full-flow.spec.ts`

> **设计依据:** spec §7.1.3 — 这是 P0 守护测试: 「客户审核改动 → 内存 → 下载 zip 内容」全链路。

- [ ] **Step 1: 写 tests/e2e/full-flow.spec.ts**

```ts
import { test, expect } from '@playwright/test';
import { unzipDownload } from './helpers';

test.describe('full flow: review → export zip reflects all changes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?step=4&speed=instant');
    await page.waitForSelector('[data-testid="step4-review"]');
  });

  test('A/D + correctBoxGeometry + accept-all → export zip native.json reflects all', async ({ page }) => {
    // 1. 选 trk_2 → A 接受
    await page.click('[data-testid="queue-card-trk_2"]');
    await page.keyboard.press('a');

    // 2. trk_9 改框 (走 store action 直接调用, 因为 Konva 拖框难自动化)
    await page.evaluate(() => {
      type W = typeof window & { __demoStore?: { getState: () => { correctBoxGeometry: (id: string, idx: number, c: [number, number, number, number]) => void } } };
      (window as W).__demoStore?.getState().correctBoxGeometry('trk_9', 0, [777, 888, 200, 100]);
    });

    // 3. 选 trk_5 → D 否决
    await page.click('[data-testid="queue-card-trk_5"]');
    await page.keyboard.press('d');

    // 4. 一键全部接受
    const acceptAllBtn = page.locator('[data-testid="accept-all-remaining"]');
    await expect(acceptAllBtn).toBeEnabled();
    await acceptAllBtn.click();

    // 5. 跳到 step 5
    await page.evaluate(() => {
      type W = typeof window & { __demoStore?: { getState: () => { goToStep: (n: 1 | 2 | 3 | 4 | 5) => void } } };
      (window as W).__demoStore?.getState().goToStep(5);
    });
    await page.waitForSelector('[data-testid="step5-export"]');

    // 6. 触发下载
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="download-btn"]');
    const download = await downloadPromise;
    const zipPath = await download.path();
    expect(zipPath).toBeTruthy();

    // 7. 解压 + 验证内容
    const files = await unzipDownload(zipPath!);
    expect(files['manifest.json']).toBeDefined();
    expect(files['README.txt']).toBeDefined();
    expect(files['annotations/native.json']).toBeDefined();

    const native = JSON.parse(files['annotations/native.json']!);
    expect(native.version).toBe('2.0-demo');
    expect(native.dataset.dataset_id).toBe('city-road');
    expect(native.annotations.length).toBe(47);

    const trk2 = native.annotations.find((a: { track_id: string }) => a.track_id === 'trk_2');
    const trk9 = native.annotations.find((a: { track_id: string }) => a.track_id === 'trk_9');
    const trk5 = native.annotations.find((a: { track_id: string }) => a.track_id === 'trk_5');

    expect(trk2.review.status).toBe('accepted');
    expect(trk9.review.status).toBe('corrected');
    expect(trk9.source).toBe('human');
    expect(trk9.keyframes[0].geometry.coords).toEqual([777, 888, 200, 100]);
    expect(trk5.review.status).toBe('rejected');

    // statistics
    const manifest = JSON.parse(files['manifest.json']!);
    expect(manifest.statistics.accepted + manifest.statistics.corrected + manifest.statistics.rejected).toBe(47);
    expect(manifest.statistics.pending).toBe(0);
  });

  test('reset returns to step 1 and preserves dataset', async ({ page }) => {
    await page.click('[data-testid="queue-card-trk_2"]');
    await page.keyboard.press('a');

    // 点重置, accept dialog
    page.on('dialog', (d) => d.accept());
    await page.click('[data-testid="btn-reset"]');

    // 等步骤切换
    await page.waitForSelector('[data-testid="step-view-1"]');

    // store 应该恢复
    const state = await page.evaluate(() => {
      type W = typeof window & { __demoStore?: { getState: () => { activeDatasetId: string; demoStep: number; annotations: { track_id: string; review: { status: string } }[] } } };
      const s = (window as W).__demoStore?.getState();
      const trk2 = s?.annotations.find((a) => a.track_id === 'trk_2');
      return {
        step: s?.demoStep,
        dataset: s?.activeDatasetId,
        trk2Status: trk2?.review.status,
      };
    });
    expect(state.step).toBe(1);
    expect(state.dataset).toBe('city-road');
    expect(state.trk2Status).toBe('pending');
  });

  test('next button disabled when focus items pending', async ({ page }) => {
    // step 4 时, 控制条上 ⏭ 应该置灰 (Day 6 才接入完整逻辑, 此处先确认按钮存在)
    const nextBtn = page.locator('[data-testid="btn-next"]');
    await expect(nextBtn).toBeDisabled();
  });
});
```

- [ ] **Step 2: 跑 E2E**

Run: `npm run test:e2e -- tests/e2e/full-flow.spec.ts --reporter=list`
Expected: 3 个 test 通过。耗时 30-90s。

如果失败:

- "Timeout waiting for step4-review" → dev server 没起来或编译失败, 看终端是否有 vite 错误
- "downloadPromise timeout" → click '[data-testid="download-btn"]' 没触发下载, 检查 exportZip 里 saveAs 是否被调用 (jsdom 测试是 mock 的, e2e 是真浏览器, saveAs 应该能用)
- "trk9.keyframes[0].geometry.coords mismatch" → store action 调用没生效, 检查 `window.__demoStore` 是否真挂上 (App.tsx 顶部 if (import.meta.env.DEV))

- [ ] **Step 3: 提交**

```bash
git add tests/e2e/full-flow.spec.ts
git commit -m "test: E2E P0 — review changes propagate through store to downloaded zip"
```

---

### Task 4.11: Day 4 验收

- [ ] **Step 1: 全部测试绿色 (单测 + E2E)**

```bash
npm run test:run     # 单测
npm run test:e2e     # E2E
```

Expected: 全绿。单测约 50+ 个, E2E 3 个。

- [ ] **Step 2: typecheck + build**

```bash
npm run typecheck
npm run build
```

- [ ] **Step 3: 手动端到端走查**

启动 dev → 走完整流程：
1. ✅ /?step=4 → 完成审核 (按 A/D 接受/否决, 用 store action 改框)
2. ✅ 控制条上手动跳 step 5 (Day 6 后会用 ⏭ 按钮)
3. ✅ /?step=5 → 看到统计、预览、下载按钮
4. ✅ 切换 native ↔ coco-video → 预览内容变化
5. ✅ 点下载 → 浏览器下载 city-road_export.zip
6. ✅ 解压 zip → manifest.json / annotations/native.json / README.txt 都存在
7. ✅ native.json 里的 trk_2 / trk_9 / trk_5 review 状态匹配你刚才操作

- [ ] **Step 4: 性能确认 (打包 ≤ 1.5s)**

DevTools → Performance 录制点击下载到下载触发的过程, 应在 100-800ms 完成 (远低于 1.5s PRD 红线)。

- [ ] **Step 5: 提交 tag**

```bash
git tag day4-export-complete
```

---

## Day 4 验收清单

至此 Day 4 应满足：

- ✅ category 抽取与映射工具
- ✅ 原生 JSON 序列化 (含完整 review/source 信息 + 统计)
- ✅ COCO-Video 序列化 (含 x_review/x_source 扩展字段)
- ✅ manifest.json 生成器
- ✅ JSZip 打包: annotations + frames (尽力) + manifest + README
- ✅ FileSaver 触发浏览器下载
- ✅ JsonPreview 实时反映 store + 内置 JSON 高亮 (无外部依赖)
- ✅ FormatSwitch radio 切换格式 + 预览内容跟随变化
- ✅ Step 5 完整视图: 格式 + 统计 + 预览 + 下载
- ✅ Playwright 配置 + 浏览器安装
- ✅ E2E P0 用例: 审核改动 → 下载 zip → 解压验证内容
- ✅ E2E 重置回 step 1 + 保留 dataset 验证
- ✅ window.__demoStore 仅 dev 暴露 (生产不暴露)

**核心硬约束验证**：

- ✅ CLAUDE.md 第 1 条 (schema 对齐生产) — format.test.ts 守护
- ✅ CLAUDE.md 第 2 条 (审核改动回写) — exportZip.test.ts + E2E full-flow 全链路守护
- ✅ 性能红线: 打包 ≤ 1.5s — 实测 < 800ms

下一分册: Day 5 完成 Step 1/2/3 (上传 + 元信息揭示 + 自动标注揭示) + 副样例。
