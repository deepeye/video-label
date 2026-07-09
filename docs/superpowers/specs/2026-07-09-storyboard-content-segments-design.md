# 分页页面（Storyboard）内容分段设计

> 日期：2026-07-09
> 状态：已确认
> 关联：Step 3 分镜展示 — 将视频片段按内容（字幕/ASR）拆分，替代原有的镜头运动+景别模式

## 改动动机

原设计用 `camera_movement` 和 `shot_type` 模拟 AI 按镜头运动/景别拆分视频。但 Demo 语境下，展示"按内容段落拆分"（如按字幕/ASR 结果）更贴近真实标注场景，对客户叙事更有说服力。

## 变更范围

### 1. 类型定义（`src/types.ts`）

```typescript
export interface ShotSegment {
  id: string;
  clip_src: string;       // 片段视频路径
  start_ms: number;
  end_ms: number;
  title: string;          // 段落标题，如"家政女皇：软炒肉片"
  content_type: string;   // 内容分类，如"美食"、"广告"、"纪录片"等
}
```

移除字段：`camera_movement`、`shot_type`
新增字段：`title`、`content_type`
类型名 `ShotSegment` 保持不动，减少搜索/替换风险。

同时移除不再使用的 `CameraMovement`、`ShotType` 类型（已确认无其他引用）。

### 2. Mock 数据（`city-road.json`）

| id | clip_src | start_ms | end_ms | title | content_type |
|----|----------|----------|--------|-------|-------------|
| seg-1 | /mock/storyboard/jiazhengnvhuang_13.mp4 | 0 | 10680 | 家政女皇：软炒肉片 | 美食 |
| seg-2 | /mock/storyboard/jiazhengnvhuang_5-result.mp4 | 10680 | 43760 | 广告：益安宁丸 | 广告 |
| seg-3 | /mock/storyboard/meilihebeisegment_001_2-result.mp4 | 43760 | 92000 | 张家口康巴诺尔湿地 | 纪录片 |
| seg-4 | /mock/storyboard/mingyilaile_17-0-result.mp4 | 92000 | 152000 | 名医来了：访谈节目 | 访谈 |
| seg-5 | /mock/storyboard/mingyilaile_17-4-result.mp4 | 152000 | 185080 | 名医来了：科学应对儿童遗尿症 | 医疗 |

`meeting-room.json` 和 `retail-cam.json` 各新增空数组 `segments: []` 以兼容 store 读取。

### 3. 组件变更

#### StoryboardCard.tsx

卡片布局调整：

```
┌─────────────────────────┐
│ [ 视频缩略图（不变）]     │
│  ┌──────┐ ┌──────┐      │
│  │00:00 │ │00:11 │      │ ← 时间码（不变）
│  └──────┘ └──────┘      │
├─────────────────────────┤
│  家政女皇：软炒肉片 ← title（14px, bold, 主色）│
│                          │
│  美食          8.5s    ← content_type Badge + 时长 │
│                          │
└─────────────────────────┘
```

- 去掉彩圆点指示器（原 `camera_movement`）
- 标题展示 `title` 字段，字号 14px font-weight 600
- 分类标签展示 `content_type`，带背景色 Badge
- 悬停播放预览功能不变

#### SegmentTimeline.tsx

着色策略从 `MOVEMENT_COLORS` 改为 `CONTENT_TYPE_COLORS`：

```typescript
const CONTENT_TYPE_COLORS: Record<string, string> = {
  '美食': '#6366F1',      // indigo
  '广告': '#F97316',      // orange
  '纪录片': '#10B981',    // emerald
  '访谈': '#3B82F6',      // blue
  '医疗': '#EF4444',      // red
};
```

时间轴标签改为显示 `content_type`（如"美食"）。宽度足够时才显示。

#### StoryboardGrid.tsx

无变化。横向滚动网格 + 入场动画逻辑不变。

### 4. 不影响的部分

- Store（`snapshots.ts` / `demoStore.ts`）：segments 数组路径不变，action 不变
- App.tsx：Step 引用不变
- 其他 Step（1/2/4/5）：不受影响
- TopBar：已改为"分镜拆分"，文案不变
- 控制条：速度档逻辑不变

### 5. 其他数据集

`meeting-room.json` 和 `retail-cam.json` 目前无分镜数据。各补充 `segments: []` 空数组。Step 3 进入时因 `revealedCount >= segments.length (0)`，立即提示"分镜拆分完成"，跳过揭示动画。后续如需扩展再填充。

## Store 行为

无需改动。现有逻辑：
- `createSnapshot(datasetId)` 从 dataset JSON 读取 `segments`
- `revealedSegmentCount` 初始为 0
- `revealNextSegment()` 每次 +1
- `reset()` 通过重建 snapshot 自动归零

字段名变了，但 JSON key 名未变，store 按 key 读取不受影响。

## 排除项

- 不改造类型名 `ShotSegment`（保持最小 diff）
- 不填充另两个数据集的分段（留空数组）
- 不改测试用例—新字段后调整 mock 数据即可
- 不涉及审核/导出逻辑

## 实现顺序

1. `types.ts` 改字段定义，移除废弃类型
2. JSON 文件更新（三个数据集）
3. `StoryboardCard.tsx` 调整渲染
4. `SegmentTimeline.tsx` 调整着色映射
5. 验证：yarn build + yarn test
