# Frame Text Panel — 替换审核页事件列表

**日期**: 2026-07-10
**状态**: 已确认

## 目标

将 Step4 审核页面右侧面板的「事件列表 + 事件编辑器」替换为「画面文本面板」，根据视频播放进度实时显示当前帧的 OCR 识别文本。

## 动机

- 原有事件列表（用户手动创建 EventMarker）为 Demo 辅助功能，当前需求聚焦于展示 JSON 中 `all_frames` 的 OCR 文本
- 事件编辑器（Step4EventEditor）随事件列表一同移除

## 设计

### 新组件: `FrameTextPanel`

- 订阅 `currentTimeMs`（Zustand store）
- 从 `getDataset(activeDatasetId).frame_boxes.frames` 读取全部帧数据
- 按 `timestamp_ms` 做最近邻查找，定位当前播放位置对应的帧
- 渲染该帧 `parts[].text` 为纯文本列表

### 显示规则

- 仅显示**当前帧**的 parts 文本（不显示历史帧、不显示全部帧列表）
- 仅显示文本内容，不显示 box 坐标、part_id、frame_index 等元数据
- 视频播放时自动随 `currentTimeMs` 更新

### 边界情况

| 场景 | 行为 |
|------|------|
| 当前时间无匹配帧 | 显示 "当前画面无识别文本" |
| 帧存在但 parts 为空 | 显示 "当前画面无识别文本" |
| 数据集未加载 | 显示加载占位符 |

### 文件变更

| 文件 | 操作 |
|------|------|
| `src/steps/Step4Review/FrameTextPanel.tsx` | 新增 |
| `src/steps/Step4Review/index.tsx` | 移除 Step4EventList + Step4EventEditor 引用，接入 FrameTextPanel |
| `src/steps/Step4Review/Step4EventList.tsx` | 删除 |
| `src/steps/Step4Review/Step4EventEditor.tsx` | 删除 |

### 数据流

```
store.currentTimeMs ──► FrameTextPanel
                           │
                           ├─ getDataset(id).frame_boxes.frames
                           ├─ nearest-neighbor by timestamp_ms
                           └─ render frame.parts[].text
```

无需新增 store 字段，`frame_boxes` 已通过 `adaptRealData` 加载到 dataset 中。