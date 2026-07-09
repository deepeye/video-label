# Step 4 审核页 — 逐帧 OCR/检测框叠加设计

> 日期：2026-07-09
> 状态：已确认（5 节设计已逐节过审）
> 关联：替换 Step 4 审核页的"视频纯播放 + 时间轴标注"为"逐帧叠加 OCR/检测框 + 框点击创建事件"

## 概述

将 `assets/演示汇总/jiazhengnvhuang_13.json`（真实 AI 标注输出，54 帧）作为 city-road 数据集前 10.6 秒（seg-1 家政女皇片段）的逐帧检测结果。在 Step 4 视频画布上方叠加一层 SVG，按 currentTimeMs 二分匹配最近帧，渲染 OCR 文本框 + person/logo 检测框。点击框→自动创建对应类型的事件并回写 store。

保留现有三栏布局、timeline、事件列表、事件编辑器全部不动。叠加层是**只读视觉层**，点击副作用仅为创建事件。

## 设计动机

- 原审核页纯视频播放 + 时间轴标注，画面"AI 在看"的视觉冲击不足
- 客户现场最直观的演示是「AI 把字幕和人脸都画出来了」
- 已有真实标注 JSON 沉淀在 `assets/演示汇总/`，未在产品中消费

## 1. 数据模型

### 1.1 新类型（`src/types.ts`）

```ts
export interface FrameBox {
  label: 'text' | 'person' | 'logo';
  text?: string;                       // label==='text' 时存在
  probability: number;                 // 0~1
  prompt_used?: string;                // person/logo 来源
  box: [number, number, number, number]; // x,y,w,h（视频原始像素）
}

export interface FrameEntry {
  frame_index: number;                 // 0,5,10,...,265
  timestamp_ms: number;                // frame_index / 30 * 1000
  subtitle_text: string | null;
  parts: Array<{                       // OCR 文本框（jiazhengnvhuang_13.json 原结构）
    part_id: number;
    text: string;
    box: Array<[number, number]>;      // 四角点
  }>;
  boxes: FrameBox[];                   // person/logo 检测框
}

export interface FrameBoxesOverlay {
  fps: number;                         // 默认 30
  video_size: [number, number];        // [1920, 1080]
  frames: FrameEntry[];                // frame_index 升序
}
```

### 1.2 Dataset 新增可选字段

```ts
export interface Dataset {
  // ... existing fields ...
  frame_boxes?: FrameBoxesOverlay;     // 仅 city-road 提供；其他数据集不填
}
```

`?` 可选：缺失或 `frames: []` 时叠加层 return null，零副作用。

### 1.3 city-road.json 新增字段

顶层追加：

```json
{
  "frame_boxes": {
    "fps": 30,
    "video_size": [1920, 1080],
    "frames": [ /* 54 项 */ ]
  }
}
```

`timestamp_ms` 在导入时计算并固化（`frame_index / 30 * 1000`），避免运行期依赖 fps 字段。

### 1.4 一次性迁移脚本（`scripts/import-frame-boxes.ts`）

- 读 `assets/演示汇总/jiazhengnvhuang_13.json`
- 转换：`parts` → `label: 'text'`；`objects` → `label` 直接透传
- 输出：追加 `frame_boxes` 到 `src/data/city-road.json`
- 幂等：再次运行产生相同输出
- 跑一次即可，结果留在 JSON，CI 不再依赖 `assets/`

## 2. 状态层

### 2.1 新 helper（`src/lib/frameBoxes.ts`）

```ts
export function findFrameAt(
  overlay: FrameBoxesOverlay | undefined,
  currentTimeMs: number,
): FrameEntry | null

export function visibleBoxes(frame: FrameEntry): FrameBox[]
```

`findFrameAt` 在 `overlay.frames`（升序）上二分最近帧，`overlay` 缺失或 `frames: []` 返回 null。

`visibleBoxes` 合并 `parts`（转换为 `FrameBox label: 'text'`）和 `boxes`，四角坐标转轴对齐包围盒。

### 2.2 Store 不变

- `frame_boxes` 通过 `getDataset(datasetId).frame_boxes` 现取，不进 store
- currentTimeMs 已在 store 跟踪
- 框点击走现有 `createPointEvent + updateEvent`，无须新增 action

### 2.3 不新增"框选中"状态

frame boxes 是只读视觉层。被点击后副作用：
1. `createPointEvent(currentTimeMs)`
2. `updateEvent(id, { eventType, description })`

事件后续由右侧列表/编辑器接管。

## 3. UI 层

### 3.1 新组件 `src/steps/Step4Review/FrameBoxesOverlay.tsx`

在 `Step4VideoStage` 内部 `<video>` 之后插入一层 absolute 定位 SVG。

**渲染**：
- `overlay` 缺失或 `findFrameAt` 返回 null → 返回 null
- 读 `video.getBoundingClientRect()` 计算缩放（处理 letterbox 黑边）
- 每框：`<rect>` + `<text>`（OCR 截短 12 字 / person+prob / logo+prob）
- 颜色：`text` 橙虚线 / `person` 蓝实线 / `logo` 绿实线

**点击行为**：
- `e.stopPropagation()` 不影响 region tool 拖拽
- `createPointEvent(currentTimeMs)` 创建点事件
- `updateEvent` 设置 `eventType` 和 `description`

### 3.2 嵌入 Step4VideoStage

```tsx
<video ref={videoRef} ... />
<FrameBoxesOverlay videoRef={videoRef} />
{regionEvents.map(...)}
```

`<video objectFit="contain">` 渲染时 video 元素实际尺寸 ≠ 父容器 → 叠加层用 `video.getBoundingClientRect()` 算缩放 + 偏移，letterbox 区域不画框。

### 3.3 性能

- 帧匹配 `useMemo[overlay, currentTimeMs]`：54 帧 O(log 54) < 6 次
- SVG `<g>` 节点数：单帧最多 ~20 个，原生点击事件零成本
- 无 Konva / canvas，不影响 PRD §10 性能红线

### 3.4 不动现有交互

- timeline scrub、context menu、tool 按钮、region 拖拽全部保留
- region 事件框（绝对定位 button，stage 像素坐标系）与叠加层（SVG，视频原始分辨率坐标系）并存，零冲突

### 3.5 事件预设扩展（`src/steps/Step4Review/eventPresets.ts`）

```ts
export const EVENT_TYPE_PRESETS = [
  // ... existing ...
  { value: 'text', label: '文本/字幕' },
  { value: 'person', label: '人物' },
  { value: 'logo', label: '商标/Logo' },
];
```

点 OCR 框 → `eventType: 'text'`；点 person 框 → `eventType: 'person'`；点 logo 框 → `eventType: 'logo'`。

## 4. 范围限定

### 4.1 仅 city-road 启用

`meeting-room.json` / `retail-cam.json` **不**加 `frame_boxes` 字段。
读取时 `dataset.frame_boxes === undefined` → 组件 return null，零渲染、零开销。

### 4.2 city-road 时段行为

| currentTimeMs | 行为 |
|---|---|
| 0 ~ 10680ms | 正常显示对应帧 |
| > 10680ms | `findFrameAt` 返回最后一帧（closest match），模拟"该片段已无新检测" |

不切片段、不做时序切换。

### 4.3 Demo 控制条兼容

- reset：`frame_boxes` 在 dataset JSON 内，自动跟随新 snapshot
- 速度档：不干预 currentTimeMs
- 切数据集：自动切换叠加层显隐

## 5. 测试与验证

### 5.1 新增单元测试

**`tests/frameBoxes.test.ts`**：
- `findFrameAt` 边界、首尾、空 overlay、超出范围
- `visibleBoxes` 合并 parts + boxes
- `quadToBox` 四角→轴对齐矩形正确性

**`tests/Step4FrameBoxesOverlay.test.tsx`**：
- mock `getDataset` 返回带 overlay 的 dataset
- mock `videoRef.current.getBoundingClientRect()` 返回已知尺寸
- 断言 SVG 节点数、`<rect>` 数
- 点击框 → 断言 `createPointEvent` + `updateEvent` 被调用，`eventType` 正确
- datasetId 切到无 overlay 数据集 → SVG 不渲染

### 5.2 不破坏现有

| 测试 | 期望 |
|---|---|
| Step4Review.test.tsx | 通过 |
| Step4Timeline.test.tsx | 通过 |
| Step4EventEditor.test.tsx | 通过（预设值新增不影响断言） |
| data.test.ts | 通过（可选字段） |
| snapshots.test.ts | 通过 |

### 5.3 验证命令

```bash
npx tsc --noEmit
yarn test --run
yarn build
```

### 5.4 数据量预算

- city-road.json +70KB（54 帧 × ~16 框 × ~80 bytes）
- 构建产物 < 30MB 远未触及

## Store 行为

零改动。所有现有 actions（`createPointEvent`、`updateEvent`、`selectEvent`、`undo` 等）均适用于叠加层创建的事件，undo 栈自动入栈。

## 排除项

- 不生成缩略图
- 不预渲染 frame strip
- 不扩展 frame_boxes 到其他数据集
- 不新增 store action / state
- 不改 undo 逻辑
- 不切换代表帧（closest match 而非切片段）

## 实现顺序

1. `scripts/import-frame-boxes.ts` 一次性脚本：读 jiazhengnvhuang_13.json → 写 city-road.json
2. `src/types.ts`：新增 FrameBox / FrameEntry / FrameBoxesOverlay + Dataset.frame_boxes 可选字段
3. `src/lib/frameBoxes.ts`：findFrameAt / visibleBoxes / quadToBox
4. `tests/frameBoxes.test.ts`：单元测试
5. `src/steps/Step4Review/eventPresets.ts`：EVENT_TYPE_PRESETS 加 text/person/logo
6. `src/steps/Step4Review/FrameBoxesOverlay.tsx`：SVG 叠加层组件
7. `src/steps/Step4Review/Step4VideoStage.tsx`：嵌入 `<FrameBoxesOverlay videoRef={videoRef} />`
8. `tests/Step4FrameBoxesOverlay.test.tsx`：组件测试
9. `npx tsc --noEmit && yarn test --run && yarn build` 全绿

## 风险与回退

- 风险：letterbox 计算偏差导致框位置不准 → 缓解：组件测试已覆盖缩放计算
- 风险：city-road.json 体积膨胀 → 缓解：+70KB 可忽略
- 回退：删除 `FrameBoxesOverlay` 组件引用即可还原旧版，city-road.json 的 `frame_boxes` 字段保留不影响其他步骤
