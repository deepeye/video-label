# Step 4 审核页 — 逐帧 OCR/检测框叠加实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `assets/演示汇总/jiazhengnvhuang_13.json`（54 帧真实 AI 标注）作为 city-road 数据集 Step 4 视频的逐帧 OCR/检测框叠加数据，点击框→创建对应类型事件并回写 store。

**Architecture:** 新增 `FrameBoxesOverlay` SVG 组件嵌入 `Step4VideoStage` 之上；纯函数 `findFrameAt/visibleBoxes/quadToBox` 实现帧匹配和坐标转换；Dataset 新增可选 `frame_boxes` 字段（仅 city-road 填充）；一次性导入脚本消费 `assets/演示汇总/jiazhengnvhuang_13.json` 写入 city-road.json；store 完全不动。

**Tech Stack:** React 18 + TypeScript + Zustand + Vite + Vitest + React Testing Library + tsx (script runner)

## Global Constraints

- 零真实后端 / 零外部网络请求
- 不改 store（demoStore.ts / snapshots.ts / undo.ts）
- 不改 `getDataset` 函数签名
- 不改 App.tsx / 其他 Step
- meeting-room.json / retail-cam.json **不**填充 frame_boxes
- 测试 mock 模式遵循 `tests/Step4Review.test.tsx` 现有写法（ROStub + mockRect + mockVideoCurrentTime）
- 使用 `tsx` 运行一次性脚本：`npx tsx scripts/<name>.ts`
- TypeScript 严格模式（`tsc --noEmit` 必须通过）
- vitest 单测断言模式：`screen.getByTestId(...)` / `useDemoStore.getState().events`

## File Structure

**新建文件：**
- `scripts/import-frame-boxes.ts` — 一次性把 jiazhengnvhuang_13.json 写入 city-road.json
- `src/lib/frameBoxes.ts` — 帧匹配 + 框坐标转换 pure helper
- `src/steps/Step4Review/FrameBoxesOverlay.tsx` — SVG 叠加层组件
- `tests/frameBoxes.test.ts` — frameBoxes 单元测试
- `tests/Step4FrameBoxesOverlay.test.tsx` — 叠加层组件测试

**修改文件：**
- `src/types.ts` — 新增 FrameBox / FrameEntry / FrameBoxesOverlay；Dataset 加可选 frame_boxes
- `src/steps/Step4Review/eventPresets.ts` — EVENT_TYPE_PRESETS 追加 text / person / logo
- `src/steps/Step4Review/Step4VideoStage.tsx` — 在 `<video>` 后插入 `<FrameBoxesOverlay videoRef={videoRef} />`
- `src/data/city-road.json` — 顶层追加 frame_boxes 字段（运行脚本生成）

---

### Task 1: 数据迁移脚本

**Files:**
- Create: `scripts/import-frame-boxes.ts`

**Interfaces:**
- Consumes: `assets/演示汇总/jiazhengnvhuang_13.json`（已存在）
- Produces: 更新 `src/data/city-road.json` 顶层追加 `frame_boxes` 字段
- 幂等：相同输入产生相同输出

- [ ] **Step 1: 创建迁移脚本**

创建 `scripts/import-frame-boxes.ts`：

```ts
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
```

- [ ] **Step 2: 运行脚本生成数据**

```bash
cd /Users/felixwang/devspace/cc-project/video-label
npx tsx scripts/import-frame-boxes.ts
```

预期输出：`✓ wrote 54 frames to city-road.json`

- [ ] **Step 3: 验证 JSON 字段写入**

```bash
cd /Users/felixwang/devspace/cc-project/video-label
node -e "const d = require('./src/data/city-road.json'); console.log('frame_boxes.frames.length =', d.frame_boxes.frames.length); console.log('first timestamp_ms =', d.frame_boxes.frames[0].timestamp_ms); console.log('last frame_index =', d.frame_boxes.frames.at(-1).frame_index);"
```

预期输出：
```
frame_boxes.frames.length = 54
first timestamp_ms = 0
last frame_index = 265
```

- [ ] **Step 4: Commit**

```bash
git add scripts/import-frame-boxes.ts src/data/city-road.json
git commit -m "feat: import jiazhengnvhuang_13 frame_boxes into city-road"
```

---

### Task 2: 类型定义（types.ts）

**Files:**
- Modify: `src/types.ts`

**Interfaces:**
- Produces: `FrameBox` / `FrameEntry` / `FrameBoxesOverlay`
- Produces: `Dataset.frame_boxes?: FrameBoxesOverlay`

- [ ] **Step 1: 在 ShotSegment 之后新增类型**

编辑 `src/types.ts`，在 `ShotSegment` 接口后追加：

```typescript
export interface FrameBox {
  label: 'text' | 'person' | 'logo';
  text?: string;
  probability: number;
  prompt_used?: string;
  box: [number, number, number, number]; // x,y,w,h（视频原始像素）
}

export interface FrameEntry {
  frame_index: number;
  timestamp_ms: number;
  subtitle_text: string | null;
  parts: Array<{
    part_id: number;
    text: string;
    box: Array<[number, number]>; // 四角点
  }>;
  boxes: FrameBox[];
}

export interface FrameBoxesOverlay {
  fps: number;
  video_size: [number, number]; // [1920, 1080]
  frames: FrameEntry[]; // frame_index 升序
}
```

- [ ] **Step 2: 在 Dataset 接口加可选字段**

编辑 `src/types.ts`，把：

```typescript
export interface Dataset {
  version: '2.0-demo';
  dataset_id: DatasetId;
  display: string;
  video_src: string;
  thumb: string;
  metadata: VideoMetadata;
  annotations: Annotation[];
  demo_script: DemoScript;
  segments: ShotSegment[];
}
```

改为：

```typescript
export interface Dataset {
  version: '2.0-demo';
  dataset_id: DatasetId;
  display: string;
  video_src: string;
  thumb: string;
  metadata: VideoMetadata;
  annotations: Annotation[];
  demo_script: DemoScript;
  segments: ShotSegment[];
  frame_boxes?: FrameBoxesOverlay;
}
```

- [ ] **Step 3: 类型检查**

```bash
cd /Users/felixwang/devspace/cc-project/video-label
npx tsc --noEmit
```

预期：编译通过（city-road.json 是 JSON，无类型导入问题）。

- [ ] **Step 4: Commit**

```bash
git add src/types.ts
git commit -m "feat: add FrameBox types for step4 frame overlay"
```

---

### Task 3: 帧匹配 helper（src/lib/frameBoxes.ts）

**Files:**
- Create: `src/lib/frameBoxes.ts`
- Create: `tests/frameBoxes.test.ts`

**Interfaces:**
- Produces:
  - `findFrameAt(overlay: FrameBoxesOverlay | undefined, currentTimeMs: number): FrameEntry | null`
  - `visibleBoxes(frame: FrameEntry): FrameBox[]`
  - `quadToBox(quad: Array<[number, number]>): [number, number, number, number]`（内部 helper）

- [ ] **Step 1: 写失败测试**

创建 `tests/frameBoxes.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { findFrameAt, visibleBoxes } from '@/lib/frameBoxes';
import type { FrameBoxesOverlay } from '@/types';

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
    // fps=30, frame_index=30 → timestamp 1000ms
    // frame_index=15 → timestamp 500ms
    // frame_index=45 → timestamp 1500ms
    // 1100ms → closest is frame_index=45 (diff 400ms) over frame_index=30 (diff 100ms)... wait, frame_index=30 corresponds to timestamp 1000ms
    // 1100ms: target frame = 33. closest frame_index: 30 (diff 3, ts diff 100ms) vs 45 (diff 12, ts diff 400ms) → 30 wins
    const overlay = makeOverlay([0, 30, 45, 60]);
    expect(findFrameAt(overlay, 1100)?.frame_index).toBe(30);
  });

  it('rounds to closer frame when tied', () => {
    const overlay = makeOverlay([0, 30, 60]);
    // 500ms → target frame_index 15; both 0 (diff 15) and 30 (diff 15) are equidistant; implementation returns first match ≥ target
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
    expect(result[0].label).toBe('text');
    expect(result[0].text).toBe('hello');
    expect(result[0].probability).toBe(1);
    expect(result[0].box).toEqual([10, 20, 100, 40]);
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
    expect(result[0].label).toBe('person');
    expect(result[0].box).toEqual([100, 200, 50, 80]);
    expect(result[1].label).toBe('logo');
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
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /Users/felixwang/devspace/cc-project/video-label
yarn test:run -- tests/frameBoxes.test.ts
```

预期：FAIL — Cannot find module '@/lib/frameBoxes'

- [ ] **Step 3: 实现 helper**

创建 `src/lib/frameBoxes.ts`：

```typescript
import type { FrameBox, FrameEntry, FrameBoxesOverlay } from '../types';

/**
 * 给定视频 currentTimeMs，返回 overlay.frames 中最近的 FrameEntry。
 * overlay 缺失或 frames 为空时返回 null。
 * frames 必须按 frame_index 升序排列。
 */
export function findFrameAt(
  overlay: FrameBoxesOverlay | undefined,
  currentTimeMs: number,
): FrameEntry | null {
  if (!overlay || overlay.frames.length === 0) {
    return null;
  }
  const fps = overlay.fps;
  if (fps <= 0) {
    return null;
  }
  const targetFrameIndex = (currentTimeMs / 1000) * fps;
  const arr = overlay.frames;
  let lo = 0;
  let hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].frame_index < targetFrameIndex) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  const candidate = arr[lo];
  if (lo === 0) {
    return candidate;
  }
  const prev = arr[lo - 1];
  return Math.abs(candidate.frame_index - targetFrameIndex) <=
    Math.abs(prev.frame_index - targetFrameIndex)
    ? candidate
    : prev;
}

/**
 * 把 parts（OCR 四角）转换为轴对齐的 text FrameBox，
 * 再与原 boxes（person/logo）合并返回。
 */
export function visibleBoxes(frame: FrameEntry): FrameBox[] {
  const textBoxes: FrameBox[] = frame.parts.map((p) => ({
    label: 'text',
    text: p.text,
    probability: 1,
    box: quadToBox(p.box),
  }));
  return [...textBoxes, ...frame.boxes];
}

/**
 * 四角点转轴对齐包围盒 [x, y, w, h]。
 */
export function quadToBox(quad: Array<[number, number]>): [number, number, number, number] {
  const xs = quad.map((p) => p[0]);
  const ys = quad.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const w = Math.max(...xs) - x;
  const h = Math.max(...ys) - y;
  return [x, y, w, h];
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /Users/felixwang/devspace/cc-project/video-label
yarn test:run -- tests/frameBoxes.test.ts
```

预期：所有用例 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/frameBoxes.ts tests/frameBoxes.test.ts
git commit -m "feat: add frameBoxes helper with findFrameAt and visibleBoxes"
```

---

### Task 4: 事件预设扩展（eventPresets.ts）

**Files:**
- Modify: `src/steps/Step4Review/eventPresets.ts`

**Interfaces:**
- Produces: `EVENT_TYPE_PRESETS` 追加 text / person / logo

- [ ] **Step 1: 修改预设**

编辑 `src/steps/Step4Review/eventPresets.ts`，把：

```typescript
export const EVENT_TYPE_PRESETS = [
  { value: 'sudden_brake', label: '急刹' },
  { value: 'lane_change', label: '变道' },
  { value: 'pedestrian_crossing', label: '行人横穿' },
  { value: 'vehicle_cut_in', label: '车辆加塞' },
  { value: 'near_miss', label: '险情接近' },
  { value: 'custom', label: '自定义' },
] as const;
```

改为：

```typescript
export const EVENT_TYPE_PRESETS = [
  { value: 'sudden_brake', label: '急刹' },
  { value: 'lane_change', label: '变道' },
  { value: 'pedestrian_crossing', label: '行人横穿' },
  { value: 'vehicle_cut_in', label: '车辆加塞' },
  { value: 'near_miss', label: '险情接近' },
  { value: 'text', label: '文本/字幕' },
  { value: 'person', label: '人物' },
  { value: 'logo', label: '商标/Logo' },
  { value: 'custom', label: '自定义' },
] as const;
```

- [ ] **Step 2: 类型检查**

```bash
cd /Users/felixwang/devspace/cc-project/video-label
npx tsc --noEmit
```

预期：编译通过（type narrowing 自动更新）。

- [ ] **Step 3: Commit**

```bash
git add src/steps/Step4Review/eventPresets.ts
git commit -m "feat: add text/person/logo event types for frame box clicks"
```

---

### Task 5: FrameBoxesOverlay 组件

**Files:**
- Create: `src/steps/Step4Review/FrameBoxesOverlay.tsx`

**Interfaces:**
- Consumes:
  - `videoRef: React.RefObject<HTMLVideoElement>` — 父组件传入，用于读取 video 实际渲染尺寸
  - 从 store 读取 `currentTimeMs` / `createPointEvent` / `updateEvent` / `setCurrentTimeMs`
- Produces: SVG 节点，绝对定位覆盖 video；点击框→创建对应类型事件

- [ ] **Step 1: 创建组件**

创建 `src/steps/Step4Review/FrameBoxesOverlay.tsx`：

```tsx
import { useMemo } from 'react';
import { getDataset } from '../../data';
import { useDemoStore } from '../../store/demoStore';
import { tokens } from '../../styles/tokens';
import { findFrameAt, visibleBoxes } from '../../lib/frameBoxes';
import type { FrameBox } from '../../types';

interface LabelStyle {
  stroke: string;
  fill: string;
  label: string;
  dash?: string;
}

const LABEL_STYLE: Record<FrameBox['label'], LabelStyle> = {
  text: { stroke: '#F97316', fill: '#F9731622', label: 'OCR', dash: '6 4' },
  person: { stroke: '#3B82F6', fill: '#3B82F622', label: 'person' },
  logo: { stroke: '#10B981', fill: '#10B98122', label: 'logo' },
};

interface Props {
  videoRef: React.RefObject<HTMLVideoElement>;
}

export function FrameBoxesOverlay({ videoRef }: Props) {
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const currentTimeMs = useDemoStore((s) => s.currentTimeMs);
  const createPointEvent = useDemoStore((s) => s.createPointEvent);
  const updateEvent = useDemoStore((s) => s.updateEvent);
  const setCurrentTimeMs = useDemoStore((s) => s.setCurrentTimeMs);

  const overlay = getDataset(datasetId).frame_boxes;
  const frame = useMemo(() => findFrameAt(overlay, currentTimeMs), [overlay, currentTimeMs]);
  const boxes = useMemo(() => (frame ? visibleBoxes(frame) : []), [frame]);

  if (!overlay || !frame) {
    return null;
  }

  const video = videoRef.current;
  if (!video) {
    return null;
  }

  const videoRect = video.getBoundingClientRect();
  const stageEl = video.parentElement;
  if (!stageEl) {
    return null;
  }
  const stageRect = stageEl.getBoundingClientRect();
  if (videoRect.width === 0 || videoRect.height === 0) {
    return null;
  }

  const [vw, vh] = overlay.video_size;
  const scaleX = videoRect.width / vw;
  const scaleY = videoRect.height / vh;
  const offsetX = videoRect.left - stageRect.left;
  const offsetY = videoRect.top - stageRect.top;

  const handleBoxClick = (box: FrameBox) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentTimeMs(currentTimeMs);
    const id = createPointEvent(currentTimeMs);
    const description =
      box.label === 'text'
        ? box.text ?? ''
        : `${box.label} (prob ${box.probability.toFixed(2)})`;
    updateEvent(id, { eventType: box.label, description });
  };

  return (
    <svg
      data-testid="frame-boxes-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <title data-testid="frame-boxes-overlay-frame">{frame.frame_index}</title>
      {boxes.map((box, i) => {
        const [x, y, w, h] = box.box;
        const sx = offsetX + x * scaleX;
        const sy = offsetY + y * scaleY;
        const sw = w * scaleX;
        const sh = h * scaleY;
        const style = LABEL_STYLE[box.label];
        const labelText =
          box.label === 'text'
            ? (box.text?.slice(0, 12) ?? 'OCR')
            : `${box.label} ${box.probability.toFixed(2)}`;
        return (
          <g
            key={i}
            data-testid={`frame-box-${box.label}-${i}`}
            onClick={handleBoxClick(box)}
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
          >
            <rect
              x={sx}
              y={sy}
              width={sw}
              height={sh}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={2}
              strokeDasharray={style.dash}
            />
            <text
              x={sx + 4}
              y={sy + 12}
              fontSize={11}
              fill={style.stroke}
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {labelText}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: 类型检查**

```bash
cd /Users/felixwang/devspace/cc-project/video-label
npx tsc --noEmit
```

预期：编译通过。

- [ ] **Step 3: Commit**

```bash
git add src/steps/Step4Review/FrameBoxesOverlay.tsx
git commit -m "feat: add FrameBoxesOverlay component for step4 frame box rendering"
```

---

### Task 6: 嵌入 Step4VideoStage

**Files:**
- Modify: `src/steps/Step4Review/Step4VideoStage.tsx`

**Interfaces:**
- Consumes: `FrameBoxesOverlay` 组件
- Produces: `<video>` 之后插入 `<FrameBoxesOverlay videoRef={videoRef} />`

- [ ] **Step 1: 添加 import**

编辑 `src/steps/Step4Review/Step4VideoStage.tsx`，在 import 区域追加：

```tsx
import { FrameBoxesOverlay } from './FrameBoxesOverlay';
```

（追加到现有 import 之后；具体位置不强制）

- [ ] **Step 2: 插入叠加层**

编辑 `src/steps/Step4Review/Step4VideoStage.tsx`，找到：

```tsx
      <video
        ref={videoRef}
        src={dataset.video_src}
        muted
        playsInline
        loop
        autoPlay
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
```

替换为：

```tsx
      <video
        ref={videoRef}
        src={dataset.video_src}
        muted
        playsInline
        loop
        autoPlay
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
      <FrameBoxesOverlay videoRef={videoRef} />
```

- [ ] **Step 3: 类型检查**

```bash
cd /Users/felixwang/devspace/cc-project/video-label
npx tsc --noEmit
```

预期：编译通过。

- [ ] **Step 4: 跑现有测试确认未破坏**

```bash
cd /Users/felixwang/devspace/cc-project/video-label
yarn test:run -- tests/Step4Review.test.tsx
```

预期：所有现有用例 PASS（叠加层组件在测试中 video.getBoundingClientRect 已被 mock，叠加层可能渲染也可能不渲染，但不应让现有断言失败；如果出现 jest-dom 找不到某些 testid，可以在后续 Task 7 处理）。

- [ ] **Step 5: Commit**

```bash
git add src/steps/Step4Review/Step4VideoStage.tsx
git commit -m "feat: mount FrameBoxesOverlay in Step4VideoStage"
```

---

### Task 7: 叠加层组件测试

**Files:**
- Create: `tests/Step4FrameBoxesOverlay.test.tsx`

**Interfaces:**
- Consumes: `FrameBoxesOverlay` 组件
- 测试断言：SVG 渲染、点击框→事件创建、无 overlay 时不渲染

- [ ] **Step 1: 写失败测试**

创建 `tests/Step4FrameBoxesOverlay.test.tsx`：

```tsx
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
      x: 0,
      y: 0,
      top: rect.top ?? 0,
      left: rect.left ?? 0,
      bottom: (rect.top ?? 0) + rect.height,
      right: (rect.left ?? 0) + rect.width,
      width: rect.width,
      height: rect.height,
      toJSON: () => ({}),
    }),
  });
}

describe('Step4 frame boxes overlay', () => {
  beforeEach(() => {
    useDemoStore.getState().reset();
    useDemoStore.getState().selectDataset('city-road');
    useDemoStore.getState().goToStep(4);
  });

  it('renders overlay with rects matching the frame at currentTimeMs', () => {
    const { container } = render(<Step4Review />);
    const stage = screen.getByTestId('step4-video-stage');
    const video = stage.querySelector('video') as HTMLVideoElement;
    mockRect(video, { left: 0, top: 0, width: 1920, height: 1080 });
    mockRect(stage, { left: 0, top: 0, width: 1920, height: 1080 });

    act(() => {
      useDemoStore.getState().seekToMs(0);
    });

    const overlay = screen.getByTestId('frame-boxes-overlay');
    expect(overlay).toBeInTheDocument();
    // 第一帧 frame_index=0 应有多个框（parts + objects 都渲染）
    const rects = container.querySelectorAll('[data-testid^="frame-box-"]');
    expect(rects.length).toBeGreaterThan(0);
  });

  it('clicking a frame box creates an event with matching type', () => {
    const { container } = render(<Step4Review />);
    const stage = screen.getByTestId('step4-video-stage');
    const video = stage.querySelector('video') as HTMLVideoElement;
    mockRect(video, { left: 0, top: 0, width: 1920, height: 1080 });
    mockRect(stage, { left: 0, top: 0, width: 1920, height: 1080 });

    act(() => {
      useDemoStore.getState().seekToMs(0);
    });

    const textBox = container.querySelector('[data-testid^="frame-box-text-"]') as HTMLElement | null;
    expect(textBox).toBeTruthy();
    if (!textBox) return;

    fireEvent.click(textBox);

    const events = useDemoStore.getState().events;
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('text');
    expect(events[0].timeMs).toBe(0);
    expect(events[0].description.length).toBeGreaterThan(0);
  });

  it('does not render overlay for meeting-room dataset', () => {
    render(<Step4Review />);
    const stage = screen.getByTestId('step4-video-stage');
    const video = stage.querySelector('video') as HTMLVideoElement;
    mockRect(video, { left: 0, top: 0, width: 1920, height: 1080 });
    mockRect(stage, { left: 0, top: 0, width: 1920, height: 1080 });

    act(() => {
      useDemoStore.getState().selectDataset('meeting-room');
    });

    expect(screen.queryByTestId('frame-boxes-overlay')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 跑测试确认通过**

```bash
cd /Users/felixwang/devspace/cc-project/video-label
yarn test:run -- tests/Step4FrameBoxesOverlay.test.tsx
```

预期：3 个用例全部 PASS。

- [ ] **Step 3: 跑全量测试确认整体绿**

```bash
cd /Users/felixwang/devspace/cc-project/video-label
yarn test:run
```

预期：所有原有测试 + 新测试全部 PASS。

- [ ] **Step 4: Commit**

```bash
git add tests/Step4FrameBoxesOverlay.test.tsx
git commit -m "test: cover FrameBoxesOverlay render and click-to-create event"
```

---

### Task 8: 整体验证

**Files:**
- 不修改文件

- [ ] **Step 1: 类型检查**

```bash
cd /Users/felixwang/devspace/cc-project/video-label
npx tsc --noEmit
```

预期：无错误。

- [ ] **Step 2: 全量单测**

```bash
cd /Users/felixwang/devspace/cc-project/video-label
yarn test:run
```

预期：全部 PASS。

- [ ] **Step 3: 验证 fixture 仍然合法**

```bash
cd /Users/felixwang/devspace/cc-project/video-label
yarn validate-fixture
```

预期：city-road.json 通过（frame_boxes 字段不影响 fixture 校验规则，可选字段可忽略）。

- [ ] **Step 4: 构建**

```bash
cd /Users/felixwang/devspace/cc-project/video-label
yarn build
```

预期：构建成功，dist 生成。

- [ ] **Step 5: 体积检查**

```bash
cd /Users/felixwang/devspace/cc-project/video-label
yarn size:check
```

预期：dist < 30MB（city-road.json +70KB 无影响）。

- [ ] **Step 6: 最终 commit（如有未提交改动）**

```bash
git status
# 若有未提交改动：
git add -A
git commit -m "chore: final verification artifacts"
```
