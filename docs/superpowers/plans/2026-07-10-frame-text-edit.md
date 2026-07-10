# 画面文本编辑（Frame Text Edit）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让审核页（步骤④）右侧 FrameTextPanel 每条 OCR 文本可双击编辑，修改回写 Zustand store、支持 Ctrl+Z 撤销，并出现在步骤⑤导出 zip 的 `annotations/frame_boxes.json` 中。

**Architecture:** 在 store 上新增轻量覆盖层 `frameTextEdits: FrameTextEdit[]`（不克隆整棵 `frame_boxes`）。渲染时 override 优先于原始 Mock；导出时用 `mergeFrameTextOverrides` 深拷贝 `dataset.frame_boxes` 并落地修正，写入独立 `frame_boxes.json`，不污染 `native.json` / `coco_video.json` 的生产对齐 schema。

**Tech Stack:** React 18 + Zustand(+immer) + Vitest + @testing-library/react + JSZip。无新依赖。

## Global Constraints

- 导出 schema 对齐生产（Hard Constraint #1）：`frame_boxes.json` 的结构必须与 `FrameBoxesOverlay`（`src/types.ts`）完全一致，不引入 demo-only 字段。
- 审核改动必须回写 Zustand store（Hard Constraint #2）：编辑通过 store action 落盘，导出从 store 读取。
- 重置深拷贝初始 Mock 快照（Hard Constraint #3）：`reset()` / `selectDataset()` 后 `frameTextEdits = []`。
- 零后端、零外部网络（Hard Constraint #4）：不引入新依赖、不联网。
- 编辑是低频人机交互，无帧率红线；`undoStack` 复用现有 `UNDO_STACK_LIMIT = 20`。

## 设计注记（对 spec 一处精化）

spec §2 写「新值与原始 OCR 相同 → no-op」。这在「A→B→A」场景下会漏删已存 edit。本计划采用更精确的语义：
- `currentText` = 当前解析值（有 edit 取 edit.text，否则取原始 OCR）。
- 若 `newText === currentText` → no-op。
- 否则 `prevText = currentText`（被覆盖的值）。落盘：`newText === 原始 OCR` → 删除 edit 条目；否则 upsert。
- 撤销恢复到 `prevText`：`prevText === 原始 OCR` → 确保 edit 不存在；否则 upsert edit 为 `prevText`。

这样 A→B→A 可正确撤销回 A（无 edit）。no-op 的「无变化」意图保留，语义更正确。

## 文件结构

| 文件 | 责任 | 动作 |
|---|---|---|
| `src/types.ts` | `FrameTextEdit` 类型 + `ReviewAction` 新分支 | 修改 |
| `src/store/snapshots.ts` | `Snapshot.frameTextEdits` 字段 + 初始化 | 修改 |
| `src/store/undo.ts` | `applyFrameTextUndo` 撤销函数 | 修改 |
| `src/store/demoStore.ts` | `setFrameTextPart` action + `undo()` 分发 | 修改 |
| `src/steps/Step4Review/FrameTextPanel.tsx` | 双击编辑 UI + 「已修正」角标 | 修改 |
| `src/lib/format/frameBoxes.ts` | `mergeFrameTextOverrides` 纯函数 | 新增导出 |
| `src/steps/Step5Export/exportZip.ts` | 写 `frame_boxes.json` + `ExportArgs.frameTextEdits` | 修改 |
| `src/steps/Step5Export/manifest.ts` | files[] 含 `frame_boxes.json` | 修改 |
| `src/steps/Step5Export/index.tsx` | 传 `frameTextEdits` + 「已修正文本 N」统计行 | 修改 |
| `tests/undo.test.ts` | `applyFrameTextUndo` 用例 | 修改 |
| `tests/store.test.ts` | `setFrameTextPart` / 撤销 / reset 用例 | 修改 |
| `tests/frameBoxes.test.ts` | `mergeFrameTextOverrides` 用例 | 修改 |
| `tests/exportZip.test.ts` | `frame_boxes.json` + 统计行用例 | 修改 |
| `tests/FrameTextPanel.test.tsx` | 双击编辑 UI 用例 | 新建 |

---

## Task 1: 数据模型 — FrameTextEdit 类型与 snapshot 字段

**Files:**
- Modify: `src/types.ts`（在 `ReviewAction` 联合前加 `FrameTextEdit` 接口；在 `ReviewAction` 末尾加分支）
- Modify: `src/store/snapshots.ts`（`Snapshot` 加字段；两个 factory 初始化 `[]`）
- Test: `tests/snapshots.test.ts`

**Interfaces:**
- Produces: `FrameTextEdit { frame_index: number; part_id: number; text: string }`；`Snapshot.frameTextEdits: FrameTextEdit[]`。

- [ ] **Step 1: 写失败测试**

追加到 `tests/snapshots.test.ts` 末尾（`describe` 块内）：

```ts
  it('createLoadingSnapshot initializes frameTextEdits to empty array', () => {
    const snap = createLoadingSnapshot();
    expect(snap.frameTextEdits).toEqual([]);
  });

  it('createSnapshotFromDataset initializes frameTextEdits to empty array', () => {
    const ds = makeDataset('jiazhengnvhuang_13');
    const snap = createSnapshotFromDataset(ds, 'jiazhengnvhuang_13');
    expect(snap.frameTextEdits).toEqual([]);
  });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/snapshots.test.ts`
Expected: FAIL — `frameTextEdits` 属性 `undefined`。

- [ ] **Step 3: 实现 — types.ts**

在 `src/types.ts` 的 `ReviewAction` type 之前插入：

```ts
export interface FrameTextEdit {
  frame_index: number;
  part_id: number;
  text: string;
}
```

在 `ReviewAction` 联合的最后一个分支（`set-scene-tags`）之后追加一个分支：

```ts
  | {
      type: 'set-frame-text';
      frameIndex: number;
      partId: number;
      prevText: string;
    };
```

- [ ] **Step 4: 实现 — snapshots.ts**

在 `src/store/snapshots.ts`：
1. `import` 块加入 `FrameTextEdit`（与 `FrameTagEntry` 同一行）。
2. `Snapshot` 接口加字段（放在 `frameTags` 之后）：

```ts
  frameTags: FrameTagEntry[];
  frameTextEdits: FrameTextEdit[];
```

3. `createLoadingSnapshot()` 在 `frameTags: [],` 之后加 `frameTextEdits: [],`。
4. `createSnapshotFromDataset()` 在 `frameTags: [],` 之后加 `frameTextEdits: [],`。

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run tests/snapshots.test.ts`
Expected: PASS。

- [ ] **Step 6: typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 无错误（`ReviewAction` 新分支尚未被构造，仅类型定义，不会破坏现有代码）。

- [ ] **Step 7: commit**

```bash
git add src/types.ts src/store/snapshots.ts tests/snapshots.test.ts
git commit -m "feat: add FrameTextEdit type and frameTextEdits snapshot field"
```

---

## Task 2: 撤销函数 applyFrameTextUndo

**Files:**
- Modify: `src/store/undo.ts`（新增 `applyFrameTextUndo`）
- Test: `tests/undo.test.ts`

**Interfaces:**
- Consumes: `FrameTextEdit`（Task 1）、`ReviewAction` 的 `set-frame-text` 分支。
- Produces: `applyFrameTextUndo(edits: FrameTextEdit[], action): void`，原地变更 `edits`。

**纯函数语义**（见设计注记）：撤销目标为 `action.prevText`。
- 先按 `(frame_index, part_id)` 找现有 edit。
- 若 `prevText === 原始 OCR` → 该 (frame,part) 不应有 edit：若存在则删除。
- 但 `applyFrameTextUndo` 是纯 undo 模块，不感知「原始 OCR」（那是 store 的职责）。因此约定：`prevText` 即恢复后的目标值；函数只负责让 `edits` 中该 (frame,part) 的解析值等于 `prevText`。若 `prevText` 为特殊哨兵 `null` → 表示「恢复到无 edit」；否则 upsert 为 `prevText`。

为保持类型简洁，本计划采用：**`prevText` 用 `string | null`，`null` = 移除 edit**。需把 Task 1 的 `prevText: string` 改为 `prevText: string | null`。

- [ ] **Step 1: 调整 Task 1 的类型**

把 `src/types.ts` 中 `set-frame-text` 分支的 `prevText: string;` 改为 `prevText: string | null;`。

- [ ] **Step 2: 写失败测试**

追加到 `tests/undo.test.ts`（顶部 import 加 `FrameTextEdit`）：

```ts
import { applyFrameTextUndo, applySceneTagUndo, applyUndo, pushUndo, UNDO_STACK_LIMIT } from '@/store/undo';
import type { EventMarker, FrameTextEdit, ReviewAction } from '@/types';
```

在 `describe('undo stack', ...)` 块末尾追加：

```ts
  it('applyFrameTextUndo upserts the edit when prevText is a string', () => {
    const edits: FrameTextEdit[] = [];
    const action: Extract<ReviewAction, { type: 'set-frame-text' }> = {
      type: 'set-frame-text',
      frameIndex: 5,
      partId: 2,
      prevText: '之前文本',
    };
    applyFrameTextUndo(edits, action);
    expect(edits).toEqual([{ frame_index: 5, part_id: 2, text: '之前文本' }]);
  });

  it('applyFrameTextUndo replaces an existing edit with prevText', () => {
    const edits: FrameTextEdit[] = [{ frame_index: 5, part_id: 2, text: '现在文本' }];
    const action: Extract<ReviewAction, { type: 'set-frame-text' }> = {
      type: 'set-frame-text',
      frameIndex: 5,
      partId: 2,
      prevText: '之前文本',
    };
    applyFrameTextUndo(edits, action);
    expect(edits).toEqual([{ frame_index: 5, part_id: 2, text: '之前文本' }]);
    expect(edits.length).toBe(1);
  });

  it('applyFrameTextUndo removes the edit when prevText is null', () => {
    const edits: FrameTextEdit[] = [{ frame_index: 5, part_id: 2, text: '现在文本' }];
    const action: Extract<ReviewAction, { type: 'set-frame-text' }> = {
      type: 'set-frame-text',
      frameIndex: 5,
      partId: 2,
      prevText: null,
    };
    applyFrameTextUndo(edits, action);
    expect(edits).toEqual([]);
  });

  it('applyFrameTextUndo is a no-op when prevText is null and no edit exists', () => {
    const edits: FrameTextEdit[] = [];
    const action: Extract<ReviewAction, { type: 'set-frame-text' }> = {
      type: 'set-frame-text',
      frameIndex: 5,
      partId: 2,
      prevText: null,
    };
    applyFrameTextUndo(edits, action);
    expect(edits).toEqual([]);
  });
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npx vitest run tests/undo.test.ts`
Expected: FAIL — `applyFrameTextUndo` 未导出。

- [ ] **Step 4: 实现 — undo.ts**

在 `src/store/undo.ts` 顶部 import 加 `FrameTextEdit`：

```ts
import type { EventMarker, FrameTextEdit, ReviewAction } from '../types';
```

在文件末尾追加：

```ts
export function applyFrameTextUndo(
  edits: FrameTextEdit[],
  action: Extract<ReviewAction, { type: 'set-frame-text' }>,
): void {
  const idx = edits.findIndex(
    (e) => e.frame_index === action.frameIndex && e.part_id === action.partId,
  );
  if (action.prevText === null) {
    if (idx >= 0) edits.splice(idx, 1);
    return;
  }
  if (idx >= 0) {
    edits[idx]!.text = action.prevText;
  } else {
    edits.push({ frame_index: action.frameIndex, part_id: action.partId, text: action.prevText });
  }
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run tests/undo.test.ts`
Expected: PASS（含原有用例）。

- [ ] **Step 6: commit**

```bash
git add src/types.ts src/store/undo.ts tests/undo.test.ts
git commit -m "feat: add applyFrameTextUndo for set-frame-text actions"
```

---

## Task 3: Store action setFrameTextPart + undo 分发

**Files:**
- Modify: `src/store/demoStore.ts`（接口加方法；实现；`undo()` 分发）
- Test: `tests/store.test.ts`

**Interfaces:**
- Consumes: `applyFrameTextUndo`（Task 2）、`getDataset`（从 `../data`）、`FrameTextEdit`。
- Produces: `setFrameTextPart(frameIndex: number, partId: number, text: string): void`。

**实现语义**（设计注记）：
1. `originalText` = 在 `getDataset(s.activeDatasetId).frame_boxes?.frames` 中找 `frame_index === frameIndex` 的 frame，再找 `part_id === partId` 的 part，取 `text`；找不到 → `''`。
2. `currentText` = `frameTextEdits` 中匹配条目的 `text`，无则 `originalText`。
3. 若 `text === currentText` → no-op return。
4. `prevText` = `currentText === originalText ? null : currentText`（`null` 表示「恢复到原始」）。
5. 落盘：若 `text === originalText` → 删除 edit 条目（若有）；否则 upsert edit 为 `text`。
6. `dirty = true`；`pushUndo` 一条 `set-frame-text`。

- [ ] **Step 1: 写失败测试**

`tests/store.test.ts` 的 `beforeEach` mock fetch 的 `all_frames` 当前 `parts: []`。需让本用例自带一个有 part 的帧。最简方案：在测试内重置 fetch 并重新 `selectDataset`。追加到 `describe('demoStore', ...)` 块末尾：

```ts
  it('setFrameTextPart writes an edit, marks dirty, and tracks undo', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        video_name: 'test.mp4',
        concatenated_subtitles: '',
        all_frames: [{
          frame_index: 0,
          subtitle_text: '',
          parts: [{ part_id: 0, text: '原始OCR', box: [[0,0],[100,0],[100,50],[0,50]] }],
          objects: [],
        }],
      }),
    });
    await useDemoStore.getState().selectDataset('jiazhengnvhuang_13');

    useDemoStore.getState().setFrameTextPart(0, 0, '修正后');

    const s = useDemoStore.getState();
    expect(s.frameTextEdits).toEqual([{ frame_index: 0, part_id: 0, text: '修正后' }]);
    expect(s.dirty).toBe(true);
    expect(s.undoStack).toHaveLength(1);
    expect(s.undoStack[0]).toMatchObject({ type: 'set-frame-text', frameIndex: 0, partId: 0, prevText: null });
  });

  it('setFrameTextPart is a no-op when text equals current resolved value', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        video_name: 'test.mp4',
        concatenated_subtitles: '',
        all_frames: [{
          frame_index: 0,
          subtitle_text: '',
          parts: [{ part_id: 0, text: '原始OCR', box: [[0,0],[100,0],[100,50],[0,50]] }],
          objects: [],
        }],
      }),
    });
    await useDemoStore.getState().selectDataset('jiazhengnvhuang_13');

    useDemoStore.getState().setFrameTextPart(0, 0, '原始OCR');

    const s = useDemoStore.getState();
    expect(s.frameTextEdits).toEqual([]);
    expect(s.dirty).toBe(false);
    expect(s.undoStack).toEqual([]);
  });

  it('setFrameTextPart back to original removes the edit and records prevText', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        video_name: 'test.mp4',
        concatenated_subtitles: '',
        all_frames: [{
          frame_index: 0,
          subtitle_text: '',
          parts: [{ part_id: 0, text: '原始OCR', box: [[0,0],[100,0],[100,50],[0,50]] }],
          objects: [],
        }],
      }),
    });
    await useDemoStore.getState().selectDataset('jiazhengnvhuang_13');

    useDemoStore.getState().setFrameTextPart(0, 0, '修正A');
    useDemoStore.getState().setFrameTextPart(0, 0, '原始OCR');

    const s = useDemoStore.getState();
    expect(s.frameTextEdits).toEqual([]);
    expect(s.undoStack).toHaveLength(2);
    expect(s.undoStack[1]).toMatchObject({ type: 'set-frame-text', frameIndex: 0, partId: 0, prevText: '修正A' });
  });

  it('undo reverts setFrameTextPart back to original (no edit)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        video_name: 'test.mp4',
        concatenated_subtitles: '',
        all_frames: [{
          frame_index: 0,
          subtitle_text: '',
          parts: [{ part_id: 0, text: '原始OCR', box: [[0,0],[100,0],[100,50],[0,50]] }],
          objects: [],
        }],
      }),
    });
    await useDemoStore.getState().selectDataset('jiazhengnvhuang_13');

    useDemoStore.getState().setFrameTextPart(0, 0, '修正后');
    useDemoStore.getState().undo();

    expect(useDemoStore.getState().frameTextEdits).toEqual([]);
  });

  it('undo of A->B->A chain restores each step', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        video_name: 'test.mp4',
        concatenated_subtitles: '',
        all_frames: [{
          frame_index: 0,
          subtitle_text: '',
          parts: [{ part_id: 0, text: '原始', box: [[0,0],[100,0],[100,50],[0,50]] }],
          objects: [],
        }],
      }),
    });
    await useDemoStore.getState().selectDataset('jiazhengnvhuang_13');

    useDemoStore.getState().setFrameTextPart(0, 0, 'A');
    useDemoStore.getState().setFrameTextPart(0, 0, 'B');
    useDemoStore.getState().setFrameTextPart(0, 0, '原始');

    useDemoStore.getState().undo();
    expect(useDemoStore.getState().frameTextEdits[0]?.text).toBe('B');
    useDemoStore.getState().undo();
    expect(useDemoStore.getState().frameTextEdits[0]?.text).toBe('A');
    useDemoStore.getState().undo();
    expect(useDemoStore.getState().frameTextEdits).toEqual([]);
  });

  it('reset clears frameTextEdits and undoStack', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        video_name: 'test.mp4',
        concatenated_subtitles: '',
        all_frames: [{
          frame_index: 0,
          subtitle_text: '',
          parts: [{ part_id: 0, text: '原始', box: [[0,0],[100,0],[100,50],[0,50]] }],
          objects: [],
        }],
      }),
    });
    await useDemoStore.getState().selectDataset('jiazhengnvhuang_13');
    useDemoStore.getState().setFrameTextPart(0, 0, '修正');
    expect(useDemoStore.getState().frameTextEdits).toHaveLength(1);

    useDemoStore.getState().reset();

    const s = useDemoStore.getState();
    expect(s.frameTextEdits).toEqual([]);
    expect(s.undoStack).toEqual([]);
    expect(s.dirty).toBe(false);
  });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/store.test.ts`
Expected: FAIL — `setFrameTextPart is not a function`。

- [ ] **Step 3: 实现 — demoStore.ts**

1. import 块：把 `getDataset` 加入 `from '../data'`：

```ts
import { getDataset, loadRealDataset } from '../data';
```

并在 type import 加 `FrameTextEdit`：

```ts
import type {
  AnnotationTool,
  BBox,
  DatasetId,
  DemoStep,
  EventMarker,
  FrameTextEdit,
  Geometry,
  Point,
  ReviewAction,
  Speed,
  TimelineTool,
} from '../types';
```

2. import 块加 `applyFrameTextUndo`：

```ts
import { applyFrameTextUndo, applySceneTagUndo, applyUndo, pushUndo } from './undo';
```

3. `DemoStore` 接口加方法（放在 `setSceneTags` 之后）：

```ts
  setSceneTags: (frameNo: number, timestampMs: number, tags: string[]) => void;
  setFrameTextPart: (frameIndex: number, partId: number, text: string) => void;
```

4. 在 `setSceneTags` 实现之后插入：

```ts
    setFrameTextPart: (frameIndex, partId, text) =>
      set((s) => {
        const dataset = getDataset(s.activeDatasetId);
        const originalText = resolveOriginalPartText(dataset, frameIndex, partId);
        const existing = s.frameTextEdits.find(
          (e) => e.frame_index === frameIndex && e.part_id === partId,
        );
        const currentText = existing ? existing.text : originalText;
        if (text === currentText) return;

        const prevText = currentText === originalText ? null : currentText;
        if (text === originalText) {
          const idx = s.frameTextEdits.findIndex(
            (e) => e.frame_index === frameIndex && e.part_id === partId,
          );
          if (idx >= 0) s.frameTextEdits.splice(idx, 1);
        } else if (existing) {
          existing.text = text;
        } else {
          s.frameTextEdits.push({ frame_index: frameIndex, part_id: partId, text });
        }

        s.dirty = true;
        s.undoStack = pushUndo(s.undoStack, { type: 'set-frame-text', frameIndex, partId, prevText });
      }),
```

5. 在文件顶部（`createEmptyEvent` 之前）加 helper：

```ts
function resolveOriginalPartText(
  dataset: { frame_boxes?: { frames: Array<{ frame_index: number; parts: Array<{ part_id: number; text: string }> }> } },
  frameIndex: number,
  partId: number,
): string {
  const frame = dataset.frame_boxes?.frames.find((f) => f.frame_index === frameIndex);
  return frame?.parts.find((p) => p.part_id === partId)?.text ?? '';
}
```

> 注意：helper 的参数类型用结构化类型，避免 import 整个 `Dataset`；`getDataset` 返回 `Dataset`，结构兼容。

6. 在 `undo()` 实现里，于 `set-scene-tags` 分支之后、`applyUndo` 调用之前加分支：

```ts
        if (action.type === 'set-scene-tags') {
          applySceneTagUndo(s.frameTags, action);
          return;
        }
        if (action.type === 'set-frame-text') {
          applyFrameTextUndo(s.frameTextEdits, action);
          return;
        }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/store.test.ts`
Expected: PASS（含新增 6 条 + 原有用例）。

- [ ] **Step 5: 全量 typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 无错误。

- [ ] **Step 6: commit**

```bash
git add src/store/demoStore.ts tests/store.test.ts
git commit -m "feat: add setFrameTextPart store action with undo support"
```

---

## Task 4: mergeFrameTextOverrides 纯函数

**Files:**
- Modify: `src/lib/format/frameBoxes.ts`（新增导出函数）
- Test: `tests/frameBoxes.test.ts`

**Interfaces:**
- Consumes: `Dataset`、`FrameTextEdit`、`deepClone`（`src/lib/deepClone`）。
- Produces: `mergeFrameTextOverrides(dataset: Dataset, edits: FrameTextEdit[]): FrameBoxesOverlay | undefined`。深拷贝 `dataset.frame_boxes`，按 edit 落地 `parts[].text`；`dataset.frame_boxes` 不存在时返回 `undefined`；不修改入参 `dataset`。

- [ ] **Step 1: 写失败测试**

在 `tests/frameBoxes.test.ts` 顶部 import 追加：

```ts
import { mergeFrameTextOverrides } from '@/lib/format/frameBoxes';
import type { Dataset, FrameTextEdit } from '@/types';
```

在文件末尾追加：

```ts
function makeDatasetWithFrames(parts: Array<{ part_id: number; text: string }>): Dataset {
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
      frames: [{ frame_index: 0, timestamp_ms: 0, subtitle_text: null, parts, boxes: [] }],
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/frameBoxes.test.ts`
Expected: FAIL — `mergeFrameTextOverrides` 未导出。

- [ ] **Step 3: 实现 — frameBoxes.ts**

在 `src/lib/format/frameBoxes.ts` 顶部 import 修改为：

```ts
import type { Dataset, FrameBox, FrameBoxesOverlay, FrameEntry, FrameTextEdit } from '../../types';
import { deepClone } from '../deepClone';
```

在文件末尾追加：

```ts
/**
 * 深拷贝 dataset.frame_boxes，并把 frameTextEdits 覆盖到对应 parts[].text。
 * dataset.frame_boxes 不存在时返回 undefined。不修改入参 dataset。
 */
export function mergeFrameTextOverrides(
  dataset: Dataset,
  edits: FrameTextEdit[],
): FrameBoxesOverlay | undefined {
  if (!dataset.frame_boxes) return undefined;
  const overlay = deepClone(dataset.frame_boxes);
  for (const edit of edits) {
    const frame = overlay.frames.find((f) => f.frame_index === edit.frame_index);
    const part = frame?.parts.find((p) => p.part_id === edit.part_id);
    if (part) part.text = edit.text;
  }
  return overlay;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/frameBoxes.test.ts`
Expected: PASS（含原有用例）。

- [ ] **Step 5: commit**

```bash
git add src/lib/format/frameBoxes.ts tests/frameBoxes.test.ts
git commit -m "feat: add mergeFrameTextOverrides for export"
```

---

## Task 5: exportZip 写 frame_boxes.json + manifest files

**Files:**
- Modify: `src/steps/Step5Export/exportZip.ts`（`ExportArgs` 加字段；写文件；files 列表）
- Modify: `src/steps/Step5Export/manifest.ts`（无需改结构，files 由调用方传入）
- Test: `tests/exportZip.test.ts`

**Interfaces:**
- Consumes: `mergeFrameTextOverrides`（Task 4）、`FrameTextEdit`。
- Produces: `ExportArgs.frameTextEdits?: FrameTextEdit[]`；zip 含 `annotations/frame_boxes.json`（当 `dataset.frame_boxes` 存在时）。

- [ ] **Step 1: 写失败测试**

在 `tests/exportZip.test.ts` import 区加 `FrameTextEdit`：

```ts
import type { ExportFormat } from '@/steps/Step5Export/manifest';
```

> 无需额外类型 import；测试用 store 设置 edit。

在 `describe('buildExportZip', ...)` 块末尾追加：

```ts
  it('includes frame_boxes.json with merged text edits when frame_boxes exists', async () => {
    useDemoStore.getState().setFrameTextPart(0, 0, '修正后的OCR');

    const ds = getDataset('jiazhengnvhuang_13');
    const events = useDemoStore.getState().events;
    const frameTextEdits = useDemoStore.getState().frameTextEdits;
    const blob = await buildExportZip({
      format: 'native',
      events,
      dataset: ds,
      exportedAt: 1,
      frameTextEdits,
    });
    const zip = await JSZip.loadAsync(blob);
    expect(zip.files['annotations/frame_boxes.json']).toBeDefined();

    const text = await zip.files['annotations/frame_boxes.json']!.async('string');
    const data = JSON.parse(text);
    const part = data.frames[0].parts.find((p: { part_id: number }) => p.part_id === 0);
    expect(part.text).toBe('修正后的OCR');
  });

  it('manifest files list includes frame_boxes.json', async () => {
    const ds = getDataset('jiazhengnvhuang_13');
    const blob = await buildExportZip({
      format: 'native',
      events: [],
      dataset: ds,
      exportedAt: 1,
    });
    const zip = await JSZip.loadAsync(blob);
    const m = JSON.parse(await zip.files['manifest.json']!.async('string'));
    expect(m.files).toContain('annotations/frame_boxes.json');
  });
```

> 注：`exportZip.test.ts` 的 `beforeEach` 已通过 store 加载带 `parts: [{ part_id: 0, text: 'OCR', ... }]` 的数据集（见文件第 22-28 行），故 `dataset.frame_boxes` 存在，`frame_boxes.json` 会被写入。

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/exportZip.test.ts`
Expected: FAIL — `frame_boxes.json` 未定义；`frameTextEdits` 不在 `ExportArgs`。

- [ ] **Step 3: 实现 — exportZip.ts**

1. import 块加 `FrameTextEdit` 与 `mergeFrameTextOverrides`：

```ts
import type { Annotation, Dataset, EventMarker, FrameTagEntry, FrameTextEdit } from '../../types';
import { toNative } from '../../lib/format/native';
import { toCocoVideo } from '../../lib/format/cocoVideo';
import { mergeFrameTextOverrides } from '../../lib/format/frameBoxes';
import { buildManifest, type ExportFormat } from './manifest';
```

2. `ExportArgs` 加字段：

```ts
export interface ExportArgs {
  format: ExportFormat;
  events: EventMarker[];
  dataset: Dataset;
  exportedAt: number;
  annotations?: Annotation[];
  frameTags?: FrameTagEntry[];
  frameTextEdits?: FrameTextEdit[];
}
```

3. `buildExportZip` 解构加 `frameTextEdits = []`：

```ts
  const { format, events, dataset, exportedAt, annotations = [], frameTags, frameTextEdits = [] } = args;
```

4. 在 manifest 构建之前、frame 文件处理之后，插入 frame_boxes.json 写入：

```ts
  const files: string[] = [annFile, ...frameFiles];

  const mergedFrameBoxes = mergeFrameTextOverrides(dataset, frameTextEdits);
  if (mergedFrameBoxes) {
    annFolder.file('frame_boxes.json', JSON.stringify(mergedFrameBoxes, null, 2));
    files.push('annotations/frame_boxes.json');
  }

  const manifest = buildManifest({
    dataset,
    format,
    exportedAt,
    statistics: buildEventStats(events),
    files,
  });
```

> 替换原有 `files: [annFile, ...frameFiles],` 那一行（把 files 计算移到上方，并追加 frame_boxes.json）。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/exportZip.test.ts`
Expected: PASS（含新增 2 条 + 原有用例）。

- [ ] **Step 5: commit**

```bash
git add src/steps/Step5Export/exportZip.ts tests/exportZip.test.ts
git commit -m "feat: export frame_boxes.json with merged text edits"
```

---

## Task 6: Step5Export 接线 + 「已修正文本」统计行

**Files:**
- Modify: `src/steps/Step5Export/index.tsx`（读 `frameTextEdits`；传给 `downloadExportZip`；统计区加一行）
- Modify: `src/steps/Step5Export/exportZip.ts`（`buildEventStats` 加 `text_edits` 字段）—— 见下
- Modify: `src/steps/Step5Export/manifest.ts`（`Manifest.statistics` 加 `text_edits`）
- Test: `tests/exportZip.test.ts`

**Interfaces:**
- Consumes: store `frameTextEdits`；`ExportArgs.frameTextEdits`。
- Produces: `Manifest.statistics.text_edits: number`；UI 统计行「已修正文本 N」。

- [ ] **Step 1: 写失败测试**

在 `tests/exportZip.test.ts` 末尾追加：

```ts
  it('manifest statistics includes text_edits count', async () => {
    useDemoStore.getState().setFrameTextPart(0, 0, '修正');
    const ds = getDataset('jiazhengnvhuang_13');
    const blob = await buildExportZip({
      format: 'native',
      events: [],
      dataset: ds,
      exportedAt: 1,
      frameTextEdits: useDemoStore.getState().frameTextEdits,
    });
    const zip = await JSZip.loadAsync(blob);
    const m = JSON.parse(await zip.files['manifest.json']!.async('string'));
    expect(m.statistics.text_edits).toBe(1);
  });

  it('Step5Export shows edited text count stat', async () => {
    useDemoStore.getState().setFrameTextPart(0, 0, '修正');
    render(createElement(Step5Export));
    expect(screen.getByText('已修正文本')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/exportZip.test.ts`
Expected: FAIL — `text_edits` 不在 statistics；「已修正文本」文案不存在。

- [ ] **Step 3: 实现 — manifest.ts**

`Manifest.statistics` 加字段：

```ts
  statistics: {
    total: number;
    point: number;
    range: number;
    with_region: number;
    text_edits: number;
  };
```

- [ ] **Step 4: 实现 — exportZip.ts buildEventStats**

```ts
function buildEventStats(events: EventMarker[], textEdits: FrameTextEdit[] = []) {
  return {
    total: events.length,
    point: events.filter((event) => event.mode === 'point').length,
    range: events.filter((event) => event.mode === 'range').length,
    with_region: events.filter((event) => event.regionBox !== null).length,
    text_edits: textEdits.length,
  };
}
```

并把 `buildExportZip` 中调用改为 `statistics: buildEventStats(events, frameTextEdits),`。

- [ ] **Step 5: 实现 — index.tsx**

1. 读 store：

```ts
  const frameTags = useDemoStore((s) => s.frameTags);
  const frameTextEdits = useDemoStore((s) => s.frameTextEdits);
```

2. `previewJson` 的 `useMemo` 依赖加 `frameTextEdits`（native/coco 预览暂不展示 frame_boxes，依赖加入仅保持一致性；如需可在后续迭代展示，本计划不扩展）。

3. `handleDownload` 传参：

```ts
      await downloadExportZip({
        format,
        events,
        annotations,
        dataset,
        exportedAt: Date.now(),
        frameTags,
        frameTextEdits,
      });
```

4. `stats` useMemo 加 `text_edits`：

```ts
  const stats = useMemo(() => {
    return {
      total: events.length,
      point: events.filter((event) => event.mode === 'point').length,
      range: events.filter((event) => event.mode === 'range').length,
      withRegion: events.filter((event) => event.regionBox !== null).length,
      textEdits: frameTextEdits.length,
    };
  }, [events, frameTextEdits]);
```

5. 在统计卡片 grid 内追加一行（放在「带框事件」之后）：

```tsx
              <Stat label="已修正文本" value={stats.textEdits} color={tokens.color.brand[500]} />
```

> grid 是 `repeat(2, 1fr)`，5 个 item 会自然换行，无需改布局。

- [ ] **Step 6: 运行测试确认通过**

Run: `npx vitest run tests/exportZip.test.ts`
Expected: PASS。

- [ ] **Step 7: 全量测试回归**

Run: `npx vitest run`
Expected: 全部 PASS（含 Step4FrameBoxesOverlay、Step4Review 等组件测试——本任务未改其行为，应保持绿色；若 `manifest.test.ts` 有对 statistics 形状的断言失败，按新字段补齐）。

- [ ] **Step 8: commit**

```bash
git add src/steps/Step5Export/manifest.ts src/steps/Step5Export/exportZip.ts src/steps/Step5Export/index.tsx tests/exportZip.test.ts
git commit -m "feat: wire frameTextEdits into Step5Export and stats"
```

---

## Task 7: FrameTextPanel 双击编辑 UI

**Files:**
- Modify: `src/steps/Step4Review/FrameTextPanel.tsx`
- Test: `tests/FrameTextPanel.test.tsx`（新建）

**Interfaces:**
- Consumes: store `frameTextEdits`、`setFrameTextPart`；`getDataset`、`findClosestFrame`。
- Produces: 双击进入编辑；Cmd/Ctrl+Enter 或 blur 保存；Esc 取消；「已修正」角标。

**渲染逻辑**：每条 part 的显示文本 = `frameTextEdits` 中匹配 `(frame.frame_index, part.part_id)` 的 `text`，否则 `part.text`。

- [ ] **Step 1: 写失败测试**

新建 `tests/FrameTextPanel.test.tsx`：

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { FrameTextPanel } from '@/steps/Step4Review/FrameTextPanel';
import { useDemoStore } from '@/store/demoStore';

describe('FrameTextPanel edit', () => {
  beforeEach(async () => {
    useDemoStore.getState().reset();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        video_name: 'test.mp4',
        concatenated_subtitles: '',
        all_frames: [{
          frame_index: 0,
          subtitle_text: '',
          parts: [{ part_id: 0, text: '原始OCR', box: [[0,0],[100,0],[100,50],[0,50]] }],
          objects: [],
        }],
      }),
    });
    await useDemoStore.getState().selectDataset('jiazhengnvhuang_13');
    useDemoStore.getState().goToStep(4);
  });

  it('renders the OCR text of the closest frame', () => {
    render(<FrameTextPanel />);
    expect(screen.getByText('原始OCR')).toBeInTheDocument();
  });

  it('double-click enters edit mode with a textarea prefilled', () => {
    render(<FrameTextPanel />);
    fireEvent.dblClick(screen.getByText('原始OCR'));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.value).toBe('原始OCR');
  });

  it('Cmd+Enter saves the edit to the store and shows the corrected badge', () => {
    render(<FrameTextPanel />);
    fireEvent.dblClick(screen.getByText('原始OCR'));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '修正后' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });

    expect(useDemoStore.getState().frameTextEdits).toEqual([
      { frame_index: 0, part_id: 0, text: '修正后' },
    ]);
    expect(screen.getByText('已修正')).toBeInTheDocument();
    expect(screen.getByText('修正后')).toBeInTheDocument();
  });

  it('Esc cancels the edit without writing to the store', () => {
    render(<FrameTextPanel />);
    fireEvent.dblClick(screen.getByText('原始OCR'));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '不会保存' } });
    fireEvent.keyDown(textarea, { key: 'Escape' });

    expect(useDemoStore.getState().frameTextEdits).toEqual([]);
    expect(screen.getByText('原始OCR')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('blur saves the edit', () => {
    render(<FrameTextPanel />);
    fireEvent.dblClick(screen.getByText('原始OCR'));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '失焦保存' } });
    fireEvent.blur(textarea);

    expect(useDemoStore.getState().frameTextEdits[0]?.text).toBe('失焦保存');
  });

  it('shows the corrected badge and edited text after a prior edit', () => {
    useDemoStore.getState().setFrameTextPart(0, 0, '已改');
    render(<FrameTextPanel />);
    expect(screen.getByText('已修正')).toBeInTheDocument();
    expect(screen.getByText('已改')).toBeInTheDocument();
    expect(screen.queryByText('原始OCR')).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/FrameTextPanel.test.tsx`
Expected: FAIL — 双击无 textarea；「已修正」角标不存在。

- [ ] **Step 3: 实现 — FrameTextPanel.tsx**

整体替换 `FrameTextPanel.tsx` 内容（保留原 loading/error/empty 分支，扩展 part 渲染为可编辑卡片）：

```tsx
import { useMemo, useState } from 'react';
import { getDataset } from '../../data';
import { useDemoStore } from '../../store/demoStore';
import { tokens } from '../../styles/tokens';
import type { FrameEntry } from '../../types';

function findClosestFrame(frames: FrameEntry[], targetMs: number): FrameEntry | null {
  if (frames.length === 0) return null;
  let closest = frames[0]!;
  let minDiff = Math.abs(closest.timestamp_ms - targetMs);
  for (let i = 1; i < frames.length; i++) {
    const diff = Math.abs(frames[i]!.timestamp_ms - targetMs);
    if (diff < minDiff) {
      minDiff = diff;
      closest = frames[i]!;
    }
  }
  return closest;
}

export function FrameTextPanel() {
  const currentTimeMs = useDemoStore((s) => s.currentTimeMs);
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const loadingDataset = useDemoStore((s) => s.loadingDataset);
  const frameTextEdits = useDemoStore((s) => s.frameTextEdits);
  const setFrameTextPart = useDemoStore((s) => s.setFrameTextPart);

  const dataset = loadingDataset ? null : getDataset(datasetId);
  const loadingDatasetError = useDemoStore((s) => s.loadingDatasetError);

  const frame = useMemo(() => {
    if (!dataset?.frame_boxes) return null;
    return findClosestFrame(dataset.frame_boxes.frames, currentTimeMs);
  }, [dataset, currentTimeMs]);

  const [editingPartId, setEditingPartId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  if (loadingDataset) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space[2], flex: 1, minHeight: 0 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: tokens.color.neutral[400] }}>
          画面文本
        </div>
        <div style={{ padding: tokens.space[3], borderRadius: tokens.radius.md, background: tokens.color.neutral[100], color: tokens.color.neutral[500], fontSize: 12 }}>
          加载中…
        </div>
      </div>
    );
  }

  if (loadingDatasetError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space[2], flex: 1, minHeight: 0 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: tokens.color.neutral[400] }}>
          画面文本
        </div>
        <div style={{ padding: tokens.space[3], borderRadius: tokens.radius.md, background: tokens.color.danger[50], color: tokens.color.danger[500], fontSize: 12 }}>
          加载失败
        </div>
      </div>
    );
  }

  const parts = frame?.parts ?? [];
  const frameIndex = frame?.frame_index ?? 0;

  const resolvedText = (partId: number, original: string): string => {
    const edit = frameTextEdits.find(
      (e) => e.frame_index === frameIndex && e.part_id === partId,
    );
    return edit ? edit.text : original;
  };

  const startEdit = (partId: number, current: string) => {
    setEditingPartId(partId);
    setDraft(current);
  };

  const commitEdit = (partId: number) => {
    setFrameTextPart(frameIndex, partId, draft);
    setEditingPartId(null);
  };

  const cancelEdit = () => {
    setEditingPartId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space[2], flex: 1, minHeight: 0 }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: tokens.color.neutral[400] }}>
        画面文本
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {parts.length === 0 ? (
          <div style={{ padding: tokens.space[3], borderRadius: tokens.radius.md, background: tokens.color.neutral[100], color: tokens.color.neutral[500], fontSize: 12 }}>
            当前画面无识别文本
          </div>
        ) : (
          parts.map((part) => {
            const edited = resolvedText(part.part_id, part.text) !== part.text;
            const text = resolvedText(part.part_id, part.text);
            const isEditing = editingPartId === part.part_id;
            return (
              <div
                key={part.part_id}
                onDoubleClick={() => !isEditing && startEdit(part.part_id, text)}
                style={{
                  position: 'relative',
                  padding: tokens.space[3],
                  borderRadius: tokens.radius.md,
                  background: tokens.color.neutral[0],
                  border: `1px solid ${edited ? tokens.color.brand[300] : tokens.color.neutral[200]}`,
                  borderLeft: edited ? `2px solid ${tokens.color.brand[500]}` : undefined,
                  fontSize: 13,
                  color: tokens.color.neutral[700],
                  cursor: isEditing ? 'text' : 'pointer',
                }}
              >
                {edited && (
                  <span style={{ position: 'absolute', top: 4, right: 8, fontSize: 10, color: tokens.color.brand[500] }}>
                    已修正
                  </span>
                )}
                {isEditing ? (
                  <textarea
                    autoFocus
                    value={draft}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => commitEdit(part.part_id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        commitEdit(part.part_id);
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelEdit();
                      }
                    }}
                    style={{ width: '100%', minHeight: 32, resize: 'vertical', border: `1px solid ${tokens.color.brand[400]}`, borderRadius: tokens.radius.sm, padding: 6, fontSize: 13, fontFamily: 'inherit' }}
                  />
                ) : (
                  text
                )}
              </div>
            );
          })
        )}
      </div>
      <div style={{ fontSize: 11, color: tokens.color.neutral[400] }}>
        双击文本编辑 · ⌘↵ 保存 · Esc 取消
      </div>
    </div>
  );
}
```

> 说明：`onFocus={(e) => e.target.select()}` 让进入编辑时全选文本，便于整段覆盖。`commitEdit` 用局部 `draft`，避免每次 keystroke 写 store；仅在 Cmd+Enter / blur 时落盘。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/FrameTextPanel.test.tsx`
Expected: PASS（6 条）。

- [ ] **Step 5: 回归 Step4 组件测试**

Run: `npx vitest run tests/Step4FrameBoxesOverlay.test.tsx tests/Step4Review.test.tsx`
Expected: PASS（FrameTextPanel 改造不影响 overlay/timeline 行为）。

- [ ] **Step 6: commit**

```bash
git add src/steps/Step4Review/FrameTextPanel.tsx tests/FrameTextPanel.test.tsx
git commit -m "feat: FrameTextPanel double-click edit with corrected badge"
```

---

## Task 8: 全量验证 + 文档更新

**Files:**
- 验证命令
- 无源码改动（除非回归发现问题）

- [ ] **Step 1: 全量单测**

Run: `npx vitest run`
Expected: 全绿。若 `tests/manifest.test.ts` 因新增 `text_edits` 字段失败，补齐断言（该测试若构造 Manifest 应包含 `text_edits`）。

- [ ] **Step 2: typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 无错误。

- [ ] **Step 3: 构建产物体积检查**

Run: `npm run build`
Expected: 构建成功；无新依赖，产物体积不超 PRD 红线 30MB（本变更不引入依赖，体积不变）。

- [ ] **Step 4: 手动验收脚本（供销售/产品）**

启动 `npm run dev`，进入步骤④审核页：
1. 右侧 FrameTextPanel 出现当前帧 OCR 文本。
2. 双击一条文本 → 出现 textarea，内容预填。
3. 改为「修正后」→ 按 Cmd+Enter → 文本更新，左侧出现品牌色竖条 + 右上「已修正」。
4. 按 Ctrl+Z（或调用 store.undo）→ 文本回到原始 OCR，角标消失。
5. 进入步骤⑤导出 → 统计区出现「已修正文本 1」→ 下载 zip → 解压 `annotations/frame_boxes.json` → `frames[0].parts` 中对应 part 的 `text` 为「修正后」。

- [ ] **Step 5: 最终 commit（如有回归修复）**

```bash
git add -A
git commit -m "test: adjust manifest assertions for text_edits stat"
```

> 仅当 Step 1 回归发现需要修复时执行；否则跳过本步。

---

## Self-Review 已完成

- **Spec 覆盖**：§1 数据模型 → Task 1；§2 action+undo → Task 2+3；§3 组件交互 → Task 7；§4 导出 → Task 4+5+6；§5 测试 → 各 Task 内 + Task 8。无遗漏。
- **占位符**：无 TBD/TODO；每步含可运行代码或命令。
- **类型一致性**：`FrameTextEdit`、`setFrameTextPart(frameIndex, partId, text)`、`mergeFrameTextOverrides(dataset, edits)`、`applyFrameTextUndo(edits, action)`、`ExportArgs.frameTextEdits`、`Manifest.statistics.text_edits` 跨任务签名一致。`prevText: string | null` 在 Task 1→2 调整已注明。
