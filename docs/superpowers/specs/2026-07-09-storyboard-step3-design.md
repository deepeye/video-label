# 分镜页面（Storyboard）设计文档

> 日期：2026-07-09
> 状态：已确认
> 关联：Step 3 自动标注 → 替换为 Step 3 分镜展示

## 概述

将当前 Step 3「自动标注揭示动画」页面替换为「分镜展示」页面。模拟一段长视频被 AI 按照镜头运动与景别自动拆分为多个片段，以故事板网格 + 时间轴的形式展示拆分结果。

纯展示页面，无用户编辑交互。审核互动保留在 Step 4。

## Mock 数据

### 来源

5 个 MP4 片段（`assets/演示汇总/`）虚构为同一段长视频的分镜输出：

| id | 文件 | 时长 | 镜头运动 | 景别 |
|----|------|------|---------|------|
| seg-1 | jiazhengnvhuang_13.mp4 | 10.7s | 固定 | 中景 |
| seg-2 | jiazhengnvhuang_5-result.mp4 | 33.1s | 推 | 近景 |
| seg-3 | meilihebeisegment_001_2-result.mp4 | 48.2s | 摇 | 远景 |
| seg-4 | mingyilaile_17-0-result.mp4 | 60.0s | 跟 | 中景 |
| seg-5 | mingyilaile_17-4-result.mp4 | 33.1s | 移 | 全景 |

5 个片段首尾相接，形成一段约 185 秒的"长视频"时间线。

> **缩略图**：使用 `<video>` 标签加载片段 MP4 文件，截取首帧作为缩略图展示。不单独生成缩略图文件。

### 类型定义（`src/types.ts` 新增）

```typescript
export type CameraMovement = '推' | '拉' | '摇' | '移' | '跟' | '固定';
export type ShotType = '远景' | '全景' | '中景' | '近景' | '特写';

export interface ShotSegment {
  id: string;
  clip_src: string;              // 片段视频路径（同时用于缩略图：video 首帧）
  start_ms: number;
  end_ms: number;
  camera_movement: CameraMovement;
  shot_type: ShotType;
}
```

### 数据位置

分镜数据写入 `src/data/city-road.json`，与 `annotations` 并列新增 `segments` 数组。`createSnapshot` 时读入 store。

## Store 变更（`src/store/`）

### Snapshot 接口新增字段

```typescript
segments: ShotSegment[];          // 所有分镜片段
revealedSegmentCount: number;     // 已揭示片段数（0 → segments.length）
```

### 新增 Action

```typescript
revealNextSegment: () => void;    // revealedSegmentCount += 1
```

### 行为

- `createSnapshot(datasetId)` 从 dataset JSON 读取 `segments`，`revealedSegmentCount` 初始为 0
- `reset()` 通过重建 snapshot 自动归零
- `revealNextSegment()` 由 Step 3 组件定时器调用，受速度档控制

## 组件架构

```
src/steps/Step3Storyboard/          ← 替换现有 Step3AutoAnnotate/
├── index.tsx                       ← 主组件：定时器 + 布局编排
├── StoryboardGrid.tsx              ← 上方：分镜卡片网格
├── StoryboardCard.tsx              ← 单个分镜卡片
└── SegmentTimeline.tsx             ← 下方：分段时间轴
```

### index.tsx

- 从 store 读取 `segments`、`revealedSegmentCount`、`speed`
- `useEffect` 定时器：按速度档间隔调用 `revealNextSegment()`
- `instant` 速度档一次性揭示全部
- 布局：flex column，上方 `StoryboardGrid`（flex 1），下方 `SegmentTimeline`（固定约 80px）

### StoryboardGrid

- 横向滚动网格，展示已揭示片段
- 新揭示卡片带入场动画：`scale(0.85) + opacity(0)` → `scale(1) + opacity(1)`（400ms ease-out）

### StoryboardCard

- 视频首帧缩略图
- 镜头运动标签（彩色圆点 + 文字）
- 景别标签
- 时间码（`mm:ss → mm:ss`）

### SegmentTimeline

- 横向时间轴，全长 = 所有片段总时长
- 已揭示片段：彩色块（不同镜头运动不同颜色）
- 未揭示部分：灰色占位
- 揭示过渡：灰色 → 彩色（300ms ease）

## 揭示动画

### 速度档

| 速度档 | 揭示间隔 | 总耗时 |
|--------|---------|--------|
| 1x | 800ms/个 | ~4s |
| 2x | 400ms/个 | ~2s |
| instant | 0ms | 0s |

### 流程

1. 进入 Step 3，`revealedSegmentCount = 0`
2. 定时器按速度档间隔调用 `revealNextSegment()`
3. 每次调用：时间轴对应块变色 + 网格新增一张卡片（带动画）
4. 全部揭示后，自动模式暂停，等待用户点击「下一步」进入 Step 4

## 与现有系统的集成

### App.tsx 改动

```tsx
// 将
{demoStep === 3 && <Step3AutoAnnotate />}
// 改为
{demoStep === 3 && <Step3Storyboard />}
```

### Demo 控制条

- 速度档控制揭示间隔（复用现有 `speed` 状态）
- 「下一步」在片段全部揭示后可用
- 「重置」通过 `reset()` 自动归零 `revealedSegmentCount`

### 不影响的部分

- Step 1、Step 2、Step 4、Step 5 不变
- TopBar 步骤条文案将「自动标注」改为「分镜拆分」
- 导出逻辑不变（Step 5 导出的仍是 Step 4 审核后的标注数据）

## 实现要点

1. 先建 Mock 数据（`city-road.json` 新增 `segments` + 将 `assets/演示汇总/*.mp4` 复制或软链接到 `public/mock/storyboard/` 下）
2. 改 store（`snapshots.ts` + `demoStore.ts`）
3. 实现 `SegmentTimeline`（最重的视觉组件）
4. 实现 `StoryboardCard` + `StoryboardGrid`
5. 组装 `index.tsx`（定时器 + 布局）
6. 替换 App.tsx 中的 Step 3 引用
7. 更新 TopBar 步骤名称

## 排除项

- 不接入真实视频分析/分镜算法
- 不支持用户编辑分段边界或标签
- 不修改 Step 4（审核）和 Step 5（导出）
- 不引入新的外部依赖