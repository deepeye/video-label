# 真实数据集成 · 设计文档

> 2026-07-09 | 将 Step 4 审核界面从手工 Mock 数据切换为真实 OCR + 目标检测数据

## 目标

用 `assets/演示汇总/` 中的 5 组真实视频+JSON 数据替换现有的 3 个 mock 数据集，使审核界面（Step 4）展示真实的 OCR 文字框和目标检测框。

## 非目标

- Steps 1-3 的揭示动画保持 mock 逻辑不变
- 不修改 `Dataset` 接口定义（仅扩展 `DatasetId` 联合类型）
- 不修改 `FrameBoxesOverlay`、`Step4VideoStage` 等审核组件
- 不引入后端服务

---

## 架构

### 文件变更

```
新增:
  src/data/realDatasets.ts       — 5 个真实数据集注册表
  src/data/adaptRealData.ts      — 演示汇总 JSON → Dataset 适配器

修改:
  src/types.ts                   — DatasetId 扩展为 5 个新 ID
  src/data/index.ts              — 增加异步加载入口 loadRealDataset
  src/store/snapshots.ts         — 新增 createSnapshotFromDataset，Snapshot 增加 loading 字段
  src/store/demoStore.ts         — selectDataset 改为异步
  src/steps/Step1Upload/SampleCards.tsx — 展示 5 个真实视频卡片

移动:
  assets/演示汇总/*.json → public/mock/real/  (5 个 JSON，供 fetch 访问)
```

### 数据流

```
public/mock/real/jiazhengnvhuang_13.json
  │ fetch
  ▼
adaptRealData(json, videoMetadata)
  │ all_frames[].parts  → frame_boxes.frames[].parts  (四角点，直通)
  │ all_frames[].objects → frame_boxes.frames[].boxes (xyxy→xywh)
  │ video element        → metadata (duration_ms, fps, w, h)
  │ concatenated_subtitles → 保留（暂存于 frame_boxes 扩展）
  ▼
Dataset 对象（与现有类型完全一致）
  │
  ▼
createSnapshotFromDataset(dataset) → Zustand Store
  │
  ▼
Step4Review 组件（无需改动）
```

---

## 适配层：`adaptRealData`

### 输入

- `json`: 演示汇总 JSON 原文（`all_frames`, `concatenated_subtitles`, `video_name`）
- `videoMeta`: 从 `<video>` 元素提取的元数据 `{ durationMs, width, height, fps }`

### 核心转换

| 源字段 | → | 目标字段 | 转换逻辑 |
|---|---|---|---|
| `all_frames[].frame_index` | → | `frame_boxes.frames[].frame_index` | 直通 |
| `all_frames[].subtitle_text` | → | `frame_boxes.frames[].subtitle_text` | 直通 |
| `all_frames[].parts[]` | → | `frame_boxes.frames[].parts[]` | 直通（四角点格式一致） |
| `all_frames[].objects[].box_px` | → | `frame_boxes.frames[].boxes[].box` | `[x1,y1,x2,y2]` → `[x1, y1, x2-x1, y2-y1]` |
| `all_frames[].objects[].label` | → | `frame_boxes.frames[].boxes[].label` | 直通（`'person'` / `'logo'`） |
| `all_frames[].objects[].probability` | → | `frame_boxes.frames[].boxes[].probability` | 直通 |
| `all_frames[].objects[].prompt_used` | → | `frame_boxes.frames[].boxes[].prompt_used` | 直通 |
| `videoMeta.durationMs` | → | `metadata.duration_ms` | 直通 |
| `videoMeta.width` | → | `metadata.width` | 直通 |
| `videoMeta.height` | → | `metadata.height` | 直通 |
| `videoMeta.fps` | → | `metadata.fps` | 直通，默认 30 |

> **fps 获取**：HTMLVideoElement 不直接提供 fps。策略：优先从视频的 `webkitDecodedFrameCount` / `currentTime` 推算（播放 0.5s 取帧数），失败则回退为 30。

### 数据集字段生成

`Dataset` 中演示汇总 JSON 不包含的字段，生成合理默认值：

| 字段 | 生成策略 |
|---|---|
| `version` | 固定 `'2.0-demo'` |
| `dataset_id` | 从注册表传入 |
| `display` | 从注册表传入（中文显示名） |
| `video_src` | 从注册表传入（`/mock/storyboard/xxx.mp4`） |
| `thumb` | 空字符串，由 SampleCards 动态截帧 |
| `annotations` | 空数组 `[]` |
| `demo_script` | 默认值 `{ metadata_reveal_ms: 3000, inference_reveal_ms: 5000, review_focus_ids: [] }` |
| `segments` | 空数组 `[]` |
| `frame_boxes` | 由 `adaptRealData` 从 `all_frames` 生成 |
| `metadata.frame_count` | `Math.round(durationMs / 1000 * fps)` |
| `metadata.codec` | `'h264'` |
| `metadata.audio_tracks` | `1` |
| `metadata.sampled_frames` | `frames.length` |

---

## 异步加载

### 注册表：`realDatasets.ts`

```typescript
interface RealDatasetConfig {
  id: DatasetId;
  display: string;
  videoSrc: string;
  jsonUrl: string;
}

const REAL_DATASETS: RealDatasetConfig[] = [
  { id: 'jiazhengnvhuang_13', display: '家政女皇·肉片穿衣',
    videoSrc: '/mock/storyboard/jiazhengnvhuang_13.mp4',
    jsonUrl: '/mock/real/jiazhengnvhuang_13.json' },
  { id: 'jiazhengnvhuang_5', display: '家政女皇·上浆',
    videoSrc: '/mock/storyboard/jiazhengnvhuang_5-result.mp4',
    jsonUrl: '/mock/real/jiazhengnvhuang_5.json' },
  { id: 'meilihebeisegment_001_2', display: '美丽河北·片段 2',
    videoSrc: '/mock/storyboard/meilihebeisegment_001_2-result.mp4',
    jsonUrl: '/mock/real/meilihebeisegment_001_2.json' },
  { id: 'mingyilaile_17-0', display: '名医来了·片段 0',
    videoSrc: '/mock/storyboard/mingyilaile_17-0-result.mp4',
    jsonUrl: '/mock/real/mingyilaile_17-0.json' },
  { id: 'mingyilaile_17-4', display: '名医来了·片段 4',
    videoSrc: '/mock/storyboard/mingyilaile_17-4-result.mp4',
    jsonUrl: '/mock/real/mingyilaile_17-4.json' },
];
```

### 加载函数：`loadRealDataset(id)`

```
1. 查注册表获取 videoSrc, jsonUrl
2. fetch(jsonUrl)
3. 创建隐藏 video 元素，src = videoSrc
4. 等待 loadedmetadata 事件（5s 超时 → 降级默认值）
5. 提取 duration/size
6. adaptRealData(json, videoMeta) → Dataset
7. 清理 video 元素
```

### Store 改动

`Snapshot` 新增两个字段：

```typescript
loadingDataset: boolean;
loadingDatasetError: string | null;
```

`selectDataset` 改为异步：

```typescript
selectDataset: async (id: DatasetId) => {
  set({ loadingDataset: true, loadingDatasetError: null });
  try {
    const dataset = await loadRealDataset(id);
    set({ ...createSnapshotFromDataset(dataset, id), loadingDataset: false });
  } catch (e) {
    set({ loadingDatasetError: (e as Error).message, loadingDataset: false });
  }
}
```

应用启动时自动触发默认数据集（注册表中第一个：`jiazhengnvhuang_13`）的异步加载。

### DatasetId 类型扩展

`types.ts` 中 `DatasetId` 从 `'city-road' | 'meeting-room' | 'retail-cam'` 改为：

```typescript
export type DatasetId = 
  | 'jiazhengnvhuang_13' 
  | 'jiazhengnvhuang_5' 
  | 'meilihebeisegment_001_2' 
  | 'mingyilaile_17-0' 
  | 'mingyilaile_17-4';
```

`defaultDatasetId` 改为 `'jiazhengnvhuang_13'`。

---

## UI 适配

### Step 1 SampleCards

5 张卡片，对应 5 个真实视频。缩略图通过 `<video>` 元素截帧（`currentTime = 2s` 时用 canvas 导出）。

### Loading 状态

Step 4 视频区域在 `loadingDataset === true` 时显示居中加载指示器。加载失败时显示错误信息 + 重试按钮。

### 其他步骤

Steps 1-3 的揭示动画依赖 `metadata`、`annotations`、`segments`。适配层中 annotations 和 segments 为空数组，揭示动画会跳过（无内容可揭示），不影响流程走通。

---

## 错误处理

| 场景 | 处理 |
|---|---|
| fetch 失败 | `loadingDatasetError` 展示错误信息，提供重试按钮 |
| video 元数据加载超时（5s） | 降级为默认值：1920x1080, 30fps, 30s |
| JSON 格式不符 | 适配器中 validate，失败则抛错，由 Store catch 展示 |
| 数据集不存在 | `loadRealDataset` 抛错，提示未知数据集 |

---

## 测试要点

1. `adaptRealData` 单元测试：xyxy→xywh 转换、边界值、空 frames
2. `loadRealDataset` 集成测试：fetch mock + video 元数据 mock
3. `selectDataset` Store 测试：异步加载完成、loading 状态切换、错误处理
4. FrameBoxesOverlay 渲染测试：真实数据帧的 boxes 数量、label 映射
5. SampleCards 渲染测试：5 张卡片都存在