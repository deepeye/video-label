# 画面文本编辑（Frame Text Edit）设计

日期：2026-07-10
关联模块：`src/steps/Step4Review/FrameTextPanel.tsx`、步骤⑤导出
Hard Constraints 覆盖：#1（导出 schema 对齐生产）、#2（审核改动回写到 store）

## 背景

审核步骤（步骤④）右侧 FrameTextPanel 当前以**只读**形式展示当前最接近帧的 `parts[]`（OCR 识别文本），客户在现场无法对识别错误进行修正。Demo 灵魂要求「客户改动必须回流到导出」，但当前帧文本无法编辑，导致人工修正 OCR 这一常见操作断链。

## 目标

让审核页右侧每条 OCR 文本支持：
1. 现场可编辑（双击 → textarea → 保存/取消）。
2. 修改回写到 Zustand store（不污染原始 Mock 数据）。
3. 单步 Ctrl+Z 可撤销。
4. 步骤⑤导出 zip 内包含修正后的 `frame_boxes`，技术评估方可读。

## 非目标

- 不做 OCR 引擎联动（Demo，无后端）。
- 不做多人协同（Demo 单会话）。
- 不动生产 schema：修正文本走独立 `frame_boxes.json` 文件，不塞入 events / coco annotations。
- 不引入额外依赖（textarea + 受控组件即可）。

## 设计

### 1. 数据模型

新增轻量覆盖层（不克隆整棵 `frame_boxes`）：

```ts
// src/types.ts
export interface FrameTextEdit {
  frame_index: number;
  part_id: number;
  text: string;
}
```

```ts
// src/store/snapshots.ts (Snapshot 扩展)
frameTextEdits: FrameTextEdit[];
```

- 选择「列表」而非嵌套 `Record<frame_index, Record<part_id, text>>`：与现有 `frameTags`、`undoStack` 风格一致；删除与撤销逻辑更直观。
- `selectDataset` / `reset` 时 `frameTextEdits = []`，保证重置深拷贝原始 Mock 的硬约束。
- 渲染时优先级：`frameTextEdits[(frame_index, part_id)]` 存在 → 用其 `text`；否则回退到 `dataset.frame_boxes.frames[i].parts[j].text`。

### 2. Store Action 与 Undo

新增：

```ts
// src/store/demoStore.ts (DemoStore 扩展)
setFrameTextPart: (frameIndex: number, partId: number, text: string) => void;
```

行为：
- 若 `text === resolveOriginalText(frameIndex, partId)`（即与原始 OCR 文本相等）：no-op，不入 undoStack、不置 `dirty`。
- 否则：upsert `frameTextEdits`，push undo action，置 `dirty = true`。

`ReviewAction` 扩展一个分支：

```ts
| {
    type: 'set-frame-text';
    frameIndex: number;
    partId: number;
    prevText: string;   // 撤销目标（原始 OCR 或上次未覆盖值）
  };
```

撤销策略：`prevText` 取「恢复目标」而非「上一个 store 值」。连续 A→B→C 编辑的撤销序列是 C→B→A，符合直觉，与 `set-scene-tags` 风格一致。

`undo.ts` 新增对称函数 `applyFrameTextUndo(frameTextEdits, action)`：
- 若 action 后值与 prevText 相同 → 删条目。
- 否则 → upsert 条目为 prevText。

`store/demoStore.ts` 的 `undo()` 分支加 `set-frame-text` 分发，复用 `applyFrameTextUndo`。

### 3. 组件交互（FrameTextPanel.tsx）

- 默认态：每条 part 渲染为只读卡片，**双击** 进入编辑态。
- 编辑态：受控 `<textarea>`，自适应高度（最少 1 行 + 14px 内边距），自动 focus + select 全文。
  - **Cmd/Ctrl + Enter**：保存（调 `setFrameTextPart`，退出编辑态）。
  - **Esc**：取消（丢弃本次编辑，退出编辑态）。
  - **blur**：保存（与 Cmd+Enter 等价），避免依赖点击外部空白处的歧义。
- 视觉提示：
  - 已被修改的卡片：左边 2px 品牌色竖条 + 右上角小角标「已修正」。
  - hover：显示 ✏️ 图标，提示可双击。
- 列表底部加一行小字：「双击文本编辑 · ⌘↵ 保存 · Esc 取消」，与 Timeline 顶部操作栏的提示语风格一致。
- 组件局部 `useState` 维护「当前正在编辑的 part_id」，保证同时只有一条进入编辑。

不引入新依赖；不破坏 `FrameTextPanel` 当前 `loadingDataset` / `loadingDatasetError` / `无识别文本` 三种空态分支。

### 4. 导出影响（步骤⑤）

- `exportZip.ts` 的 `ExportArgs` 增加 `frameTextEdits: FrameTextEdit[]`。
- 新增辅助函数 `mergeFrameTextOverrides(dataset, frameTextEdits)`：深拷贝 `dataset.frame_boxes`，把每条 edit 落到 `frames[i].parts[j].text`，返回新的 overlay（不修改 `dataset`）。
- zip 内容新增 `annotations/frame_boxes.json`：
  - 内容即合并后的 overlay，schema 与生产 `FrameBoxesOverlay` 完全一致。
  - Hard Constraint #1 满足：导出文件不含 demo-only 字段。
- `manifest.ts` 的 `files[]` 加上 `annotations/frame_boxes.json` 一行（含路径 + 描述）。
- **不修改 `native.json` 与 `coco_video.json`**：保持 PRD 第五章对齐生产的硬约束。修正 OCR 与事件标注是两个独立语义维度，技术评估方可分别阅读。
- `Step5Export/index.tsx` 从 store 读取 `frameTextEdits` 传入 `downloadExportZip`。
- 「本次导出统计」区块追加一行：`已修正文本 N`（N = `frameTextEdits.length`），便于销售现场叙事。

### 5. 测试

单元测试（vitest）：

1. `setFrameTextPart` 首次写入 → `dirty=true`，undoStack +1，`frameTextEdits` 出现条目。
2. 相同值写入 → no-op（store 不变，undoStack 不增长）。
3. `undo()` 后文本回到原始 OCR。
4. 连续 A→B→C 编辑 → 撤销三次依次回到 C→B→A。
5. `reset()` → `frameTextEdits=[]`、undoStack 清空、`dirty=false`。
6. `mergeFrameTextOverrides` 在无 edit 时输出与 `dataset.frame_boxes` 结构等价（深拷贝而非引用）。
7. `buildExportZip` 输出包含 `annotations/frame_boxes.json` 且其 `parts[].text` 与 store 一致。

手动验收：
- 双击 → 编辑 → Cmd+Enter → 视觉出现「已修正」角标。
- 撤销一次 → 角标消失，文本恢复。
- 步骤⑤「预览」与「下载 zip」中 `frame_boxes.json` 反映修正。

## 风险与权衡

- **新增导出文件**：技术评估方多读一个文件，但语义更干净，比塞进 events/coco 更专业。
- **`prevText` 取「恢复目标」**：要求 store action 在写入时计算 prev；多一次原始值查找但 O(1) 哈希定位，可接受。
- **不克隆 frame_boxes 整树**：节省内存与重置时间，但导出时仍需深拷贝一次以避免污染 dataset；合并开销 O(parts × edits)，每个数据集 parts ≤ 数百，可忽略。

## 实施顺序

1. `types.ts` 加 `FrameTextEdit`；`ReviewAction` 加分支。
2. `snapshots.ts` 加 `frameTextEdits`，初始化 `[]`。
3. `undo.ts` 加 `applyFrameTextUndo`。
4. `demoStore.ts` 加 `setFrameTextPart` action 与 `undo()` 分支。
5. `FrameTextPanel.tsx` 改造：双击进入编辑态 + 视觉提示 + 底部帮助文案。
6. `lib/format/frameBoxes.ts` 新增 `mergeFrameTextOverrides`。
7. `exportZip.ts` / `manifest.ts` 加 `frame_boxes.json` 输出。
8. `Step5Export/index.tsx` 传 `frameTextEdits` + 「已修正文本 N」统计。
9. 单测覆盖第 5 节列出的 7 条用例。

## 性能

- 文本编辑是低频操作（人点击），无帧率压力。
- `undoStack` 限 20 条（现有 `UNDO_STACK_LIMIT`），无内存风险。
- 导出合并复杂度 O(parts × edits)，单数据集 ≤ 数百量级，远低于 PRD 第 10 章性能红线。