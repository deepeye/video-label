# 真实数据集成 · 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Step 4 审核界面从手工 Mock 数据切换为 5 组真实 OCR + 目标检测数据（来自 `assets/演示汇总/`）

**Architecture:** 新增适配层 `adaptRealData` 将演示汇总 JSON 转为 `Dataset` 格式，通过 `realDatasets` 注册表管理 5 个数据集元信息，`loadRealDataset` 异步 fetch + 视频元数据提取，Store 中 `selectDataset` 改为异步。审核组件（FrameBoxesOverlay、Step4VideoStage）无需改动。

**Tech Stack:** React 18, Zustand + immer, Vitest + @testing-library/react, TypeScript

## Global Constraints

- 纯前端：零后端、零外部网络依赖（fetch 仅读取本地 public/ 文件）
- 数据集初始化后缓存在 `defaultDatasets` 中，供 `reset()` 同步复用
- 不修改 `Dataset` 接口定义，仅扩展 `DatasetId` 联合类型
- 不修改 `FrameBoxesOverlay`、`Step4VideoStage` 等审核组件
- Steps 1-3 揭示动画保持不变（annotations/segments 为空时跳过）
- 视频帧率 fps 默认值 30，从 video 元素推算优先

---

## 文件结构

```
新增:
  src/data/adaptRealData.ts      — 演示汇总 JSON → Dataset 适配器（纯函数）
  src/data/realDatasets.ts       — 5 个真实数据集配置注册表
  tests/adaptRealData.test.ts    — 适配器单元测试

修改:
  src/types.ts                   — DatasetId 扩展，Snapshot 新增 loading 字段
  src/data/index.ts              — 新增 loadRealDataset 异步加载，defaultDatasets 改为空
  src/store/snapshots.ts         — 新增 createSnapshotFromDataset，createLoadingSnapshot
  src/store/demoStore.ts         — selectDataset 改为异步，reset 泛用
  src/App.tsx                    — URL params 更新 dataset ID 列表 + 异步 selectDataset
  src/steps/Step1Upload/SampleCards.tsx — 5 张真实视频卡片 + 动态缩略图
  tests/data.test.ts             — 更新为新数据集
  tests/snapshots.test.ts        — 新增 loading snapshot 测试
  tests/store.test.ts            — 更新 dataset ID 引用
  tests/Step4FrameBoxesOverlay.test.tsx — 更新 dataset ID 引用
  tests/Step1Upload.test.tsx     — 更新 dataset ID 引用

移动:
  assets/演示汇总/*.json → public/mock/real/  (5 个 JSON)
```

---

### Task 1: 移动 JSON 文件到 public 目录

**Files:**
- Create: `public/mock/real/jiazhengnvhuang_13.json`
- Create: `public/mock/real/jiazhengnvhuang_5.json`
- Create: `public/mock/real/meilihebeisegment_001_2.json`
- Create: `public/mock/real/mingyilaile_17-0.json`
- Create: `public/mock/real/mingyilaile_17-4.json`

**Interfaces:**
- Consumes: `assets/演示汇总/*.json` (5 files)
- Produces: `public/mock/real/*.json` (5 files, fetchable at runtime)

- [ ] **Step 1: 创建目标目录并复制 JSON 文件**

```bash
mkdir -p public/mock/real
cp assets/演示汇总/jiazhengnvhuang_13.json public/mock/real/
cp assets/演示汇总/jiazhengnvhuang_5.json public/mock/real/
cp assets/演示汇总/meilihebeisegment_001_2.json public/mock/real/
cp assets/演示汇总/mingyilaile_17-0.json public/mock/real/
cp assets/演示汇总/mingyilaile_17-4.json public/mock/real/
```

- [ ] **Step 2: 验证文件存在**

```bash
ls -la public/mock/real/
```

Expected: 5 个 JSON 文件，每个文件大小 > 100KB

- [ ] **Step 3: Commit**

```bash
git add public/mock/real/
git commit -m "chore: move real demo JSON files to public/mock/real/"
```

---

### Task 2: 更新类型定义

**Files:**
- Modify: `src/types.ts` — `DatasetId` 扩展，`Snapshot` 新增 loading 字段

**Interfaces:**
- Consumes: (none)
- Produces:
  - `DatasetId = 'jiazhengnvhuang_13' | 'jiazhengnvhuang_5' | 'meilihebeisegment_001_2' | 'mingyilaile_17-0' | 'mingyilaile_17-4'`
  - `Snapshot` 新增 `loadingDataset: boolean`, `loadingDatasetError: string | null`

- [ ] **Step 1: 修改 DatasetId 类型**

在 `src/types.ts` 第 5 行，将：

```typescript
export type DatasetId = 'city-road' | 'meeting-room' | 'retail-cam';
```

改为：

```typescript
export type DatasetId =
  | 'jiazhengnvhuang_13'
  | 'jiazhengnvhuang_5'
  | 'meilihebeisegment_001_2'
  | 'mingyilaile_17-0'
  | 'mingyilaile_17-4';
```

- [ ] **Step 2: 运行类型检查，确认编译错误集中在预期位置**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: 报错出现在 `src/data/index.ts`、`src/store/snapshots.ts`、`src/store/demoStore.ts`、`src/App.tsx`、`src/steps/Step1Upload/SampleCards.tsx`、`tests/` 等引用旧 dataset ID 的地方。这是预期的——后续任务逐项修复。

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: extend DatasetId to 5 real video datasets"
```

---

### Task 3: 创建适配器 `adaptRealData`

**Files:**
- Create: `src/data/adaptRealData.ts`
- Create: `tests/adaptRealData.test.ts`

**Interfaces:**
- Consumes: `Dataset`, `FrameBoxesOverlay`, `FrameEntry`, `FrameBox` from `src/types.ts`
- Produces:
  - `VideoMeta = { durationMs: number; width: number; height: number; fps: number }`
  - `RealJsonFrame = { frame_index: number; subtitle_text: string; parts: Array<{ part_id: number; text: string; box: Array<[number, number]> }>; objects: Array<{ label: string; probability: number; box_px: [number, number, number, number]; prompt_used?: string }> }`
  - `RealJson = { video_name: string; concatenated_subtitles: string; all_frames: RealJsonFrame[] }`
  - `function adaptRealData(json: RealJson, videoMeta: VideoMeta, datasetId: DatasetId, display: string, videoSrc: string): Dataset`

- [ ] **Step 1: 编写失败测试**

创建 `tests/adaptRealData.test.ts`：

```typescript
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

  it('generates empty annotations and segments', () => {
    const ds = adaptRealData(
      SAMPLE_JSON,
      VIDEO_META,
      'jiazhengnvhuang_13' as DatasetId,
      'test',
      '/mock/test.mp4',
    );
    expect(ds.annotations).toEqual([]);
    expect(ds.segments).toEqual([]);
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
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run tests/adaptRealData.test.ts
```

Expected: FAIL — `adaptRealData` not exported from module

- [ ] **Step 3: 实现 `adaptRealData`**

创建 `src/data/adaptRealData.ts`：

```typescript
import type { Dataset, DatasetId, FrameBoxesOverlay, FrameEntry } from '../types';

export interface VideoMeta {
  durationMs: number;
  width: number;
  height: number;
  fps: number;
}

interface RealPart {
  part_id: number;
  text: string;
  box: Array<[number, number]>;
}

interface RealObject {
  label: string;
  probability: number;
  box_px: [number, number, number, number];
  prompt_used?: string;
}

interface RealFrame {
  frame_index: number;
  subtitle_text: string;
  parts: RealPart[];
  objects: RealObject[];
}

export interface RealJson {
  video_name: string;
  concatenated_subtitles: string;
  all_frames: RealFrame[];
}

function convertFrame(frame: RealFrame): FrameEntry {
  return {
    frame_index: frame.frame_index,
    timestamp_ms: 0, // will be computed below
    subtitle_text: frame.subtitle_text || null,
    parts: frame.parts.map((p) => ({
      part_id: p.part_id,
      text: p.text,
      box: p.box,
    })),
    boxes: frame.objects.map((obj) => ({
      label: (obj.label === 'person' || obj.label === 'logo') ? obj.label : 'text' as const,
      probability: obj.probability,
      prompt_used: obj.prompt_used,
      box: [obj.box_px[0], obj.box_px[1], obj.box_px[2] - obj.box_px[0], obj.box_px[3] - obj.box_px[1]] as [number, number, number, number],
    })),
  };
}

export function adaptRealData(
  json: RealJson,
  videoMeta: VideoMeta,
  datasetId: DatasetId,
  display: string,
  videoSrc: string,
): Dataset {
  const fps = videoMeta.fps > 0 ? videoMeta.fps : 30;
  const frames = json.all_frames.map((f) => {
    const entry = convertFrame(f);
    entry.timestamp_ms = Math.round((f.frame_index / fps) * 1000);
    return entry;
  });

  const frameBoxes: FrameBoxesOverlay = {
    fps,
    video_size: [videoMeta.width, videoMeta.height],
    frames,
  };

  return {
    version: '2.0-demo',
    dataset_id: datasetId,
    display,
    video_src: videoSrc,
    thumb: '',
    metadata: {
      duration_ms: videoMeta.durationMs,
      frame_count: Math.round((videoMeta.durationMs / 1000) * fps),
      fps,
      width: videoMeta.width,
      height: videoMeta.height,
      codec: 'h264',
      audio_tracks: 1,
      sampled_frames: frames.length,
    },
    annotations: [],
    demo_script: {
      metadata_reveal_ms: 3000,
      inference_reveal_ms: 5000,
      review_focus_ids: [],
    },
    segments: [],
    frame_boxes: frameBoxes,
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run tests/adaptRealData.test.ts
```

Expected: 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/adaptRealData.ts tests/adaptRealData.test.ts
git commit -m "feat: add adaptRealData to convert demo JSON to Dataset format"
```

---

### Task 4: 创建数据集注册表

**Files:**
- Create: `src/data/realDatasets.ts`

**Interfaces:**
- Consumes: `DatasetId` from `src/types.ts`
- Produces:
  - `RealDatasetConfig = { id: DatasetId; display: string; videoSrc: string; jsonUrl: string }`
  - `REAL_DATASETS: RealDatasetConfig[]`
  - `REAL_DATASETS_BY_ID: Record<DatasetId, RealDatasetConfig>`

- [ ] **Step 1: 创建注册表**

创建 `src/data/realDatasets.ts`：

```typescript
import type { DatasetId } from '../types';

export interface RealDatasetConfig {
  id: DatasetId;
  display: string;
  videoSrc: string;
  jsonUrl: string;
}

export const REAL_DATASETS: RealDatasetConfig[] = [
  {
    id: 'jiazhengnvhuang_13',
    display: '家政女皇·肉片穿衣',
    videoSrc: '/mock/storyboard/jiazhengnvhuang_13.mp4',
    jsonUrl: '/mock/real/jiazhengnvhuang_13.json',
  },
  {
    id: 'jiazhengnvhuang_5',
    display: '家政女皇·上浆',
    videoSrc: '/mock/storyboard/jiazhengnvhuang_5-result.mp4',
    jsonUrl: '/mock/real/jiazhengnvhuang_5.json',
  },
  {
    id: 'meilihebeisegment_001_2',
    display: '美丽河北·片段 2',
    videoSrc: '/mock/storyboard/meilihebeisegment_001_2-result.mp4',
    jsonUrl: '/mock/real/meilihebeisegment_001_2.json',
  },
  {
    id: 'mingyilaile_17-0',
    display: '名医来了·片段 0',
    videoSrc: '/mock/storyboard/mingyilaile_17-0-result.mp4',
    jsonUrl: '/mock/real/mingyilaile_17-0.json',
  },
  {
    id: 'mingyilaile_17-4',
    display: '名医来了·片段 4',
    videoSrc: '/mock/storyboard/mingyilaile_17-4-result.mp4',
    jsonUrl: '/mock/real/mingyilaile_17-4.json',
  },
];

export const REAL_DATASETS_BY_ID: Record<DatasetId, RealDatasetConfig> = Object.fromEntries(
  REAL_DATASETS.map((d) => [d.id, d]),
) as Record<DatasetId, RealDatasetConfig>;
```

- [ ] **Step 2: 验证类型检查**

```bash
npx tsc --noEmit 2>&1 | grep -v "data/index\|snapshots\|demoStore\|App.tsx\|SampleCards\|tests/"
```

Expected: 无新增错误（除已知的旧 dataset ID 引用外）

- [ ] **Step 3: Commit**

```bash
git add src/data/realDatasets.ts
git commit -m "feat: add real dataset registry with 5 video configs"
```

---

### Task 5: 更新 `data/index.ts` — 异步加载

**Files:**
- Modify: `src/data/index.ts`
- Modify: `tests/data.test.ts`

**Interfaces:**
- Consumes: `adaptRealData` from Task 3, `REAL_DATASETS_BY_ID` from Task 4, `Dataset`, `DatasetId` from types
- Produces:
  - `defaultDatasets: Record<DatasetId, Dataset>` (initially empty, populated on load)
  - `defaultDatasetId: DatasetId = 'jiazhengnvhuang_13'`
  - `getDataset(id: DatasetId): Dataset` (同步，从缓存取)
  - `async loadRealDataset(id: DatasetId): Promise<Dataset>` (fetch + adapt + cache)

- [ ] **Step 1: 更新 `src/data/index.ts`**

将 `src/data/index.ts` 替换为：

```typescript
import type { Dataset, DatasetId } from '../types';
import { adaptRealData, type VideoMeta } from './adaptRealData';
import { REAL_DATASETS_BY_ID } from './realDatasets';

export const defaultDatasets: Partial<Record<DatasetId, Dataset>> = {};

export const defaultDatasetId: DatasetId = 'jiazhengnvhuang_13';

export function getDataset(id: DatasetId): Dataset {
  const ds = defaultDatasets[id];
  if (!ds) {
    throw new Error(`Dataset "${id}" not loaded yet. Call loadRealDataset first.`);
  }
  return ds;
}

function extractVideoMeta(video: HTMLVideoElement): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      // 降级默认值
      resolve({
        durationMs: 30000,
        width: 1920,
        height: 1080,
        fps: 30,
      });
    }, 5000);

    const onMeta = () => {
      clearTimeout(timeout);
      const durationMs = Math.round(video.duration * 1000) || 30000;
      const width = video.videoWidth || 1920;
      const height = video.videoHeight || 1080;

      // 尝试推算 fps：播放 0.5s 后读取 decoded frame count
      let fps = 30;
      const tryFps = () => {
        if ('webkitDecodedFrameCount' in video && typeof video.webkitDecodedFrameCount === 'number') {
          const frames = video.webkitDecodedFrameCount;
          const elapsed = video.currentTime;
          if (elapsed > 0 && frames > 0) {
            fps = Math.round(frames / elapsed);
          }
        }
        resolve({ durationMs, width, height, fps });
        video.removeEventListener('timeupdate', tryFps);
      };

      video.currentTime = 0.5;
      video.addEventListener('timeupdate', tryFps, { once: true });
      video.play().catch(() => {
        resolve({ durationMs, width, height, fps });
      });
    };

    video.addEventListener('loadedmetadata', onMeta, { once: true });
    video.addEventListener('error', () => {
      clearTimeout(timeout);
      reject(new Error('Failed to load video metadata'));
    }, { once: true });
  });
}

export async function loadRealDataset(id: DatasetId): Promise<Dataset> {
  const config = REAL_DATASETS_BY_ID[id];
  if (!config) {
    throw new Error(`Unknown dataset: ${id}`);
  }

  const resp = await fetch(config.jsonUrl);
  if (!resp.ok) {
    throw new Error(`Failed to fetch ${config.jsonUrl}: ${resp.status}`);
  }
  const json = await resp.json();

  const videoMeta = await new Promise<VideoMeta>((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.crossOrigin = 'anonymous';
    video.src = config.videoSrc;

    const timeout = setTimeout(() => {
      resolve({ durationMs: 30000, width: 1920, height: 1080, fps: 30 });
      video.remove();
    }, 5000);

    const onMeta = () => {
      clearTimeout(timeout);
      const durationMs = Math.round(video.duration * 1000) || 30000;
      const width = video.videoWidth || 1920;
      const height = video.videoHeight || 1080;
      resolve({ durationMs, width, height, fps: 30 });
      video.remove();
    };

    video.addEventListener('loadedmetadata', onMeta, { once: true });
    video.addEventListener('error', () => {
      clearTimeout(timeout);
      resolve({ durationMs: 30000, width: 1920, height: 1080, fps: 30 });
      video.remove();
    }, { once: true });
  });

  const dataset = adaptRealData(json, videoMeta, id, config.display, config.videoSrc);
  defaultDatasets[id] = dataset;
  return dataset;
}
```

- [ ] **Step 2: 更新测试**

将 `tests/data.test.ts` 替换为：

```typescript
import { describe, expect, it } from 'vitest';
import { defaultDatasetId, loadRealDataset, getDataset } from '@/data';

describe('dataset registry', () => {
  it('defaultDatasetId is the first real dataset', () => {
    expect(defaultDatasetId).toBe('jiazhengnvhuang_13');
  });

  it('getDataset throws when dataset not loaded', () => {
    expect(() => getDataset('jiazhengnvhuang_13')).toThrow('not loaded yet');
  });

  it('loadRealDataset fetches and caches', async () => {
    // mock fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        video_name: 'test.mp4',
        concatenated_subtitles: '',
        all_frames: [{ frame_index: 0, subtitle_text: '', parts: [], objects: [] }],
      }),
    });

    const ds = await loadRealDataset('jiazhengnvhuang_13');
    expect(ds.dataset_id).toBe('jiazhengnvhuang_13');
    expect(ds.display).toBe('家政女皇·肉片穿衣');

    // 缓存后 getDataset 可用
    const cached = getDataset('jiazhengnvhuang_13');
    expect(cached).toBe(ds);

    globalThis.fetch = originalFetch;
  });
});
```

需要在文件顶部添加 `import { vi } from 'vitest';`

- [ ] **Step 3: 运行测试**

```bash
npx vitest run tests/data.test.ts
```

Expected: 3 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/data/index.ts tests/data.test.ts
git commit -m "feat: add async loadRealDataset with video metadata extraction"
```

---

### Task 6: 更新 `snapshots.ts` — 加载状态

**Files:**
- Modify: `src/store/snapshots.ts`
- Modify: `tests/snapshots.test.ts`

**Interfaces:**
- Consumes: `Dataset`, `DatasetId` from types
- Produces:
  - `Snapshot` 新增 `loadingDataset: boolean`, `loadingDatasetError: string | null`
  - `function createLoadingSnapshot(): Snapshot`
  - `function createSnapshotFromDataset(dataset: Dataset, id: DatasetId): Snapshot`
  - `function createSnapshot(id: DatasetId): Snapshot` (保留，供 reset 使用)

- [ ] **Step 1: 修改 `src/store/snapshots.ts`**

在 `Snapshot` 接口中新增两个字段。将文件内容改为：

```typescript
import type {
  AnnotationState,
  AnnotationTool,
  DatasetId,
  DemoStep,
  EventMarker,
  FrameTagEntry,
  ReviewAction,
  ShotSegment,
  Speed,
  TimelineTool,
} from '../types';
import { deepClone } from '../lib/deepClone';
import { getDataset } from '../data';

export interface RevealProgress {
  metadataFieldsShown: number;
  inferenceProgress: number;
  boxesRevealed: number;
}

export interface Snapshot {
  demoStep: DemoStep;
  speed: Speed;
  dirty: boolean;
  activeDatasetId: DatasetId;
  annotations: AnnotationState[];
  events: EventMarker[];
  selectedEventId: string | null;
  timelineTool: TimelineTool;
  revealProgress: RevealProgress;
  undoStack: ReviewAction[];
  annotationTool: AnnotationTool;
  draftPolygon: [number, number][];
  frameTags: FrameTagEntry[];
  currentTimeMs: number;
  playbackState: 'playing' | 'paused';
  pendingSeekMs: number | null;
  seekNonce: number;
  segments: ShotSegment[];
  revealedSegmentCount: number;
  loadingDataset: boolean;
  loadingDatasetError: string | null;
}

export function createLoadingSnapshot(): Snapshot {
  return {
    demoStep: 1,
    speed: '1x',
    dirty: false,
    activeDatasetId: 'jiazhengnvhuang_13',
    annotations: [],
    events: [],
    selectedEventId: null,
    timelineTool: 'browse',
    revealProgress: {
      metadataFieldsShown: 0,
      inferenceProgress: 0,
      boxesRevealed: 0,
    },
    undoStack: [],
    annotationTool: 'select',
    draftPolygon: [],
    frameTags: [],
    currentTimeMs: 0,
    playbackState: 'paused',
    pendingSeekMs: null,
    seekNonce: 0,
    segments: [],
    revealedSegmentCount: 0,
    loadingDataset: true,
    loadingDatasetError: null,
  };
}

export function createSnapshotFromDataset(dataset: Dataset, id: DatasetId): Snapshot {
  return {
    demoStep: 1,
    speed: '1x',
    dirty: false,
    activeDatasetId: id,
    annotations: deepClone(dataset.annotations),
    events: [],
    selectedEventId: null,
    timelineTool: 'browse',
    revealProgress: {
      metadataFieldsShown: 0,
      inferenceProgress: 0,
      boxesRevealed: 0,
    },
    undoStack: [],
    annotationTool: 'select',
    draftPolygon: [],
    frameTags: [],
    currentTimeMs: 0,
    playbackState: 'paused',
    pendingSeekMs: null,
    seekNonce: 0,
    segments: dataset.segments ?? [],
    revealedSegmentCount: 0,
    loadingDataset: false,
    loadingDatasetError: null,
  };
}

export function createSnapshot(id: DatasetId): Snapshot {
  const dataset = getDataset(id);
  return createSnapshotFromDataset(dataset, id);
}
```

- [ ] **Step 2: 更新测试**

将 `tests/snapshots.test.ts` 替换为：

```typescript
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
```

- [ ] **Step 3: 运行测试**

```bash
npx vitest run tests/snapshots.test.ts
```

Expected: 5 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/store/snapshots.ts tests/snapshots.test.ts
git commit -m "feat: add createLoadingSnapshot and createSnapshotFromDataset with loading state"
```

---

### Task 7: 更新 `demoStore.ts` — 异步 selectDataset

**Files:**
- Modify: `src/store/demoStore.ts`
- Modify: `tests/store.test.ts`

**Interfaces:**
- Consumes: `createLoadingSnapshot`, `createSnapshotFromDataset`, `createSnapshot` from snapshots; `loadRealDataset` from data
- Produces:
  - `DemoStore.selectDataset` 改为 async
  - `DemoStore.reset` 同步调用 `createSnapshot`
  - 初始状态使用 `createLoadingSnapshot()`

- [ ] **Step 1: 修改 `src/store/demoStore.ts`**

改动点：
1. Import 改为 `createLoadingSnapshot` 和 `createSnapshotFromDataset`
2. 初始变量从 `createSnapshot('city-road')` 改为 `createLoadingSnapshot()`
3. `selectDataset` 改为 async
4. `reset` 保持同步，使用 `createSnapshot(id)`

```typescript
// 顶部 import 修改
import { createLoadingSnapshot, createSnapshot, createSnapshotFromDataset, type RevealProgress, type Snapshot } from './snapshots';
import { loadRealDataset } from '../data';

// 初始变量
const initial = createLoadingSnapshot();

// selectDataset 改为 async
selectDataset: async (id) => {
  set((s) => {
    s.loadingDataset = true;
    s.loadingDatasetError = null;
  });
  try {
    const dataset = await loadRealDataset(id);
    const fresh = createSnapshotFromDataset(dataset, id);
    const currentSpeed = get().speed;
    set(() => ({ ...fresh, speed: currentSpeed }));
  } catch (e) {
    set((s) => {
      s.loadingDataset = false;
      s.loadingDatasetError = (e as Error).message;
    });
  }
},

// reset 修改
reset: () => {
  const id = get().activeDatasetId;
  try {
    const fresh = createSnapshot(id);
    const currentSpeed = get().speed;
    nextEventId = 1;
    set(() => ({ ...fresh, activeDatasetId: id, speed: currentSpeed }));
  } catch {
    // 如果数据集还未加载（不应发生），重置为 loading 状态
    const fresh = createLoadingSnapshot();
    const currentSpeed = get().speed;
    nextEventId = 1;
    set(() => ({ ...fresh, activeDatasetId: id, speed: currentSpeed }));
  }
},
```

完整修改后的 `demoStore.ts` 前三行：

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { ... } from '../types';
import { createLoadingSnapshot, createSnapshot, createSnapshotFromDataset, type RevealProgress, type Snapshot } from './snapshots';
import { loadRealDataset } from '../data';
import { applySceneTagUndo, applyUndo, pushUndo } from './undo';
```

- [ ] **Step 2: 更新 `tests/store.test.ts`**

修改 `tests/store.test.ts` 的 `beforeEach` 为异步加载：

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDemoStore } from '@/store/demoStore';

describe('demoStore', () => {
  beforeEach(async () => {
    // mock fetch for real dataset loading
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        video_name: 'test.mp4',
        concatenated_subtitles: '',
        all_frames: [{ frame_index: 0, subtitle_text: '', parts: [], objects: [] }],
      }),
    });
    await useDemoStore.getState().selectDataset('jiazhengnvhuang_13');
  });

  it('initial state after loading matches snapshot defaults', () => {
    const s = useDemoStore.getState();
    expect(s.demoStep).toBe(1);
    expect(s.speed).toBe('1x');
    expect(s.activeDatasetId).toBe('jiazhengnvhuang_13');
    expect(s.annotations).toEqual([]);
    expect(s.events).toEqual([]);
    expect(s.selectedEventId).toBeNull();
    expect(s.timelineTool).toBe('browse');
    expect(s.dirty).toBe(false);
    expect(s.loadingDataset).toBe(false);
    expect(s.loadingDatasetError).toBeNull();
  });
  // ... 其余测试保持不变
});
```

需要将 `beforeEach` 改为 `async`，并在每个测试的 `it` 回调中保持不变（同步）。

- [ ] **Step 3: 运行测试**

```bash
npx vitest run tests/store.test.ts
```

Expected: 所有测试 PASS

- [ ] **Step 4: 验证类型检查**

```bash
npx tsc --noEmit 2>&1 | grep -v "App.tsx\|SampleCards\|Step4FrameBoxesOverlay\|Step1Upload"
```

Expected: 仅剩 App.tsx、SampleCards、测试文件中的旧 dataset ID 引用

- [ ] **Step 5: Commit**

```bash
git add src/store/demoStore.ts tests/store.test.ts
git commit -m "feat: make selectDataset async with real data loading"
```

---

### Task 8: 更新 App.tsx URL 参数

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useDemoStore.selectDataset` (async)
- Produces: URL 参数 `?dataset=` 支持新的 5 个 ID，`selectDataset` 异步调用

- [ ] **Step 1: 修改 `useUrlParams`**

将 `src/App.tsx` 第 30 行的 dataset 检查改为：

```typescript
const REAL_IDS = [
  'jiazhengnvhuang_13',
  'jiazhengnvhuang_5',
  'meilihebeisegment_001_2',
  'mingyilaile_17-0',
  'mingyilaile_17-4',
];

if (dataset && REAL_IDS.includes(dataset)) {
  selectDataset(dataset as DatasetId);
}
```

完整改动后的 `useUrlParams`：

```typescript
function useUrlParams() {
  const goToStep = useDemoStore((s) => s.goToStep);
  const setSpeed = useDemoStore((s) => s.setSpeed);
  const selectDataset = useDemoStore((s) => s.selectDataset);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const params = new URLSearchParams(window.location.search);
    const step = params.get('step');
    const speed = params.get('speed');
    const dataset = params.get('dataset');

    if (dataset && [
      'jiazhengnvhuang_13',
      'jiazhengnvhuang_5',
      'meilihebeisegment_001_2',
      'mingyilaile_17-0',
      'mingyilaile_17-4',
    ].includes(dataset)) {
      selectDataset(dataset as DatasetId);
    }
    if (speed && ['1x', '2x', 'instant'].includes(speed)) {
      setSpeed(speed as Speed);
    }
    if (step) {
      const n = Number(step);
      if (n >= 1 && n <= 5) goToStep(n as DemoStep);
    }
  }, [goToStep, setSpeed, selectDataset]);
}
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit 2>&1 | grep "App.tsx"
```

Expected: 无 App.tsx 错误

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "fix: update URL params dataset list for real datasets"
```

---

### Task 9: 更新 SampleCards

**Files:**
- Modify: `src/steps/Step1Upload/SampleCards.tsx`
- Modify: `tests/Step1Upload.test.tsx`

**Interfaces:**
- Consumes: `REAL_DATASETS` from `realDatasets`, `DatasetId` from types, `useDemoStore`
- Produces: 5 张真实视频卡片，动态缩略图截帧

- [ ] **Step 1: 修改 SampleCards**

将 `src/steps/Step1Upload/SampleCards.tsx` 替换为：

```typescript
import { useEffect, useRef, useState } from 'react';
import { useDemoStore } from '../../store/demoStore';
import { tokens } from '../../styles/tokens';
import type { DatasetId } from '../../types';
import { REAL_DATASETS } from '../../data/realDatasets';

export function SampleCards() {
  const activeId = useDemoStore((s) => s.activeDatasetId);
  const loadingDataset = useDemoStore((s) => s.loadingDataset);
  const selectDataset = useDemoStore((s) => s.selectDataset);
  const goToStep = useDemoStore((s) => s.goToStep);

  const handleSelect = async (id: DatasetId) => {
    await selectDataset(id);
    goToStep(2);
  };

  return (
    <div data-testid="sample-cards" style={{ display: 'flex', gap: tokens.space[4], flexWrap: 'wrap' }}>
      {REAL_DATASETS.map((ds) => {
        const active = activeId === ds.id;
        return (
          <button
            key={ds.id}
            data-testid={`sample-card-${ds.id}`}
            onClick={() => handleSelect(ds.id)}
            disabled={loadingDataset}
            style={{
              width: 200,
              padding: 0,
              border: `2px solid ${active ? tokens.color.brand[500] : tokens.color.neutral[200]}`,
              borderRadius: tokens.radius.lg,
              overflow: 'hidden',
              background: tokens.color.neutral[0],
              cursor: loadingDataset ? 'wait' : 'pointer',
              boxShadow: active ? tokens.shadow.brand : tokens.shadow.sm,
              textAlign: 'left',
              opacity: loadingDataset ? 0.6 : 1,
            }}
          >
            <VideoThumb src={ds.videoSrc} />
            <div style={{ padding: tokens.space[3] }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: tokens.color.neutral[900] }}>
                {ds.display}
              </div>
              <div
                style={{
                  marginTop: tokens.space[2],
                  padding: '6px 10px',
                  borderRadius: tokens.radius.md,
                  background: active ? tokens.brandGradient : tokens.color.neutral[100],
                  color: active ? '#fff' : tokens.color.neutral[700],
                  fontSize: 12,
                  fontWeight: 500,
                  textAlign: 'center',
                }}
              >
                {loadingDataset ? '加载中…' : active ? '✓ 当前' : '使用 →'}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function VideoThumb({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    const video = document.createElement('video');
    videoRef.current = video;
    video.preload = 'metadata';
    video.muted = true;
    video.crossOrigin = 'anonymous';
    video.src = src;

    const onLoaded = () => {
      video.currentTime = 2;
    };

    const onSeeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 180;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setThumb(canvas.toDataURL('image/jpeg', 0.7));
      }
      video.remove();
    };

    video.addEventListener('loadedmetadata', onLoaded, { once: true });
    video.addEventListener('seeked', onSeeked, { once: true });

    return () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('seeked', onSeeked);
      video.remove();
    };
  }, [src]);

  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '16/9',
        background: tokens.color.neutral[100],
        backgroundImage: thumb ? `url(${thumb})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
```

- [ ] **Step 2: 更新步骤 1 测试**

将 `tests/Step1Upload.test.tsx` 中所有 `'city-road'` 引用改为 `'jiazhengnvhuang_13'`。

- [ ] **Step 3: 运行测试**

```bash
npx vitest run tests/Step1Upload.test.tsx
```

- [ ] **Step 4: Commit**

```bash
git add src/steps/Step1Upload/SampleCards.tsx tests/Step1Upload.test.tsx
git commit -m "feat: update SampleCards with 5 real video cards and dynamic thumbnails"
```

---

### Task 10: 更新剩余测试

**Files:**
- Modify: `tests/Step4FrameBoxesOverlay.test.tsx` — 更新 dataset ID 引用
- Modify: `tests/data.test.ts` — 已在 Task 5 更新

**Interfaces:**
- Consumes: 新 DatasetId 值
- Produces: 所有测试通过

- [ ] **Step 1: 更新 FrameBoxesOverlay 测试**

将 `tests/Step4FrameBoxesOverlay.test.tsx` 中 `beforeEach` 改为使用真实数据集（需要 mock fetch），并更新 dataset ID 引用。

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Step4Review } from '@/steps/Step4Review';
import { useDemoStore } from '@/store/demoStore';

class ROStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = ROStub;

vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);

function mockRect(node: HTMLElement, rect: { left?: number; top?: number; width: number; height: number }) {
  Object.defineProperty(node, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: 0, y: 0,
      top: rect.top ?? 0, left: rect.left ?? 0,
      bottom: (rect.top ?? 0) + rect.height, right: (rect.left ?? 0) + rect.width,
      width: rect.width, height: rect.height,
      toJSON: () => ({}),
    }),
  });
}

describe('Step4 frame boxes overlay', () => {
  beforeEach(async () => {
    useDemoStore.getState().reset();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        video_name: 'test.mp4',
        concatenated_subtitles: 'hello',
        all_frames: [
          {
            frame_index: 0,
            subtitle_text: 'hello',
            parts: [{ part_id: 0, text: 'OCR', box: [[0,0],[100,0],[100,50],[0,50]] }],
            objects: [{ label: 'person', probability: 0.9, box_px: [10,20,200,300] }],
          },
        ],
      }),
    });
    await useDemoStore.getState().selectDataset('jiazhengnvhuang_13');
    useDemoStore.getState().goToStep(4);
  });

  it('renders overlay with rects matching the frame at currentTimeMs', () => {
    const { container } = render(<Step4Review />);
    const stage = screen.getByTestId('step4-video-stage');
    const video = stage.querySelector('video') as HTMLVideoElement;
    mockRect(video, { left: 0, top: 0, width: 1920, height: 1080 });
    mockRect(stage, { left: 0, top: 0, width: 1920, height: 1080 });

    act(() => { useDemoStore.getState().seekToMs(0); });

    const overlay = screen.getByTestId('frame-boxes-overlay');
    expect(overlay).toBeInTheDocument();
    const rects = container.querySelectorAll('[data-testid^="frame-box-"]');
    expect(rects.length).toBeGreaterThan(0);
  });

  it('clicking a frame box creates an event with matching type', () => {
    const { container } = render(<Step4Review />);
    const stage = screen.getByTestId('step4-video-stage');
    const video = stage.querySelector('video') as HTMLVideoElement;
    mockRect(video, { left: 0, top: 0, width: 1920, height: 1080 });
    mockRect(stage, { left: 0, top: 0, width: 1920, height: 1080 });

    act(() => { useDemoStore.getState().seekToMs(0); });

    const textBox = container.querySelector('[data-testid^="frame-box-text-"]') as HTMLElement | null;
    expect(textBox).toBeTruthy();
    if (!textBox) return;

    fireEvent.click(textBox);

    const events = useDemoStore.getState().events;
    expect(events).toHaveLength(1);
    expect(events[0]!.eventType).toBe('text');
    expect(events[0]!.timeMs).toBe(0);
    expect(events[0]!.description.length).toBeGreaterThan(0);
  });

  it('shows overlay for real dataset (has frame_boxes)', () => {
    render(<Step4Review />);
    const stage = screen.getByTestId('step4-video-stage');
    const video = stage.querySelector('video') as HTMLVideoElement;
    mockRect(video, { left: 0, top: 0, width: 1920, height: 1080 });
    mockRect(stage, { left: 0, top: 0, width: 1920, height: 1080 });

    act(() => { useDemoStore.getState().seekToMs(0); });

    expect(screen.getByTestId('frame-boxes-overlay')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 更新 Step4EventEditor 测试**

检查 `tests/Step4EventEditor.test.tsx` 中是否有旧 dataset ID 引用，如有则更新。

- [ ] **Step 3: 运行全部测试**

```bash
npx vitest run
```

Expected: 所有测试 PASS

- [ ] **Step 4: 验证完整类型检查**

```bash
npx tsc --noEmit
```

Expected: 零错误

- [ ] **Step 5: Commit**

```bash
git add tests/Step4FrameBoxesOverlay.test.tsx tests/Step4EventEditor.test.tsx
git commit -m "test: update tests for real dataset async loading"
```

---

### Task 11: 端到端验证

- [ ] **Step 1: 启动开发服务器**

```bash
npx vite --port 5173 --open
```

- [ ] **Step 2: 手动验证 Step 1**

确认 SampleCards 展示 5 张卡片，缩略图正确显示。

- [ ] **Step 3: 手动验证 Step 4**

点击一张卡片 → 进入 Step 2 → 点击"下一步" → Step 3 → Step 4。
确认视频播放正常，OCR 框和目标检测框在视频上正确渲染。

- [ ] **Step 4: 验证事件创建**

在 Step 4 中点击 OCR 框 → 确认右侧事件列表出现新事件，类型为 `text`。

- [ ] **Step 5: 验证重置**

点击"重置"按钮 → 确认状态回到 Step 1，数据集不变。

- [ ] **Step 6: 验证数据集切换**

在 Step 1 点击另一个数据集 → 进入 Step 4 → 确认视频和框数据切换正常。

- [ ] **Step 7: 验证 URL 参数**

访问 `http://localhost:5173/?step=4&dataset=mingyilaile_17-0` → 确认直接跳转到 Step 4 并加载对应数据集。