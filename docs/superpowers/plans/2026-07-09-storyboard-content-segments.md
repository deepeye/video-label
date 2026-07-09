# Storyboard 内容分段替换实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Storyboard（Step 3）视频片段从「镜头运动+景别」模式替换为「按内容（字幕/ASR）拆分」模式。

**Architecture:** ShotSegment 类型字段替换（camera_movement→title, shot_type→content_type），Mock 数据对应更新，卡片和时间轴渲染调整。Store 层无变化（store 只读数组不关心字段名）。

**Tech Stack:** React 18 + TypeScript + Zustand + Vite + Vitest + React Testing Library

## Global Constraints

- 零真实后端/零外部网络请求
- 不改 Store（snapshots.ts / demoStore.ts）：segments 数组读取路径不变
- 不改 App.tsx / StepPills.tsx / 其他 Step
- 类型名 `ShotSegment` 保持不动（仅改字段）
- 移除不再使用的 `CameraMovement`、`ShotType` 类型
- meeting-room.json 和 retail-cam.json 已有 `segments: []`，无需改动

---

### Task 1: 类型定义更新（types.ts + types.zod.ts）

**Files:**
- Modify: `src/types.ts`
- Modify: `src/types.zod.ts`

**Interfaces:**
- Produces: 新的 `ShotSegment` 定义（`title: string` + `content_type: string` 替代原字段）
- Produces: 移除 `CameraMovement`/`ShotType` 类型（经 grep 确认仅在此文件和原型定义中使用，无其他引用）

- [ ] **Step 1: 修改 `src/types.ts` 中 ShotSegment 及相关类型**

移除 `CameraMovement` 和 `ShotType` 类型（第 12-13 行），替换 `ShotSegment` 字段（第 15-22 行）：

```typescript
// 删除这两行（第 12-13 行）
// export type CameraMovement = '推' | '拉' | '摇' | '移' | '跟' | '固定';
// export type ShotType = '远景' | '全景' | '中景' | '近景' | '特写';

// 替换 ShotSegment（第 15-22 行）
export interface ShotSegment {
  id: string;
  clip_src: string;
  start_ms: number;
  end_ms: number;
  title: string;          // 段落标题，如"家政女皇：软炒肉片"
  content_type: string;   // 内容分类，如"美食"、"广告"、"纪录片"
}
```

- [ ] **Step 2: 修改 `src/types.zod.ts` 中 ShotSegmentSchema**

替换第 63-71 行：

```typescript
export const ShotSegmentSchema = z.object({
  id: z.string().min(1),
  clip_src: z.string().min(1),
  start_ms: z.number().int().nonnegative(),
  end_ms: z.number().int().positive(),
  title: z.string().min(1),
  content_type: z.string().min(1),
});
```

- [ ] **Step 3: 运行类型检查**

```bash
npx tsc --noEmit
```

预期：类型检查通过，无 `CameraMovement`/`ShotType` 残留引用。

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/types.zod.ts
git commit -m "feat: replace ShotSegment fields with title/content_type"
```

---

### Task 2: Mock 数据更新（city-road.json）

**Files:**
- Modify: `src/data/city-road.json`

**Interfaces:**
- Consumes: 新的 `ShotSegment` 字段（title, content_type）
- Notes: meeting-room.json 和 retail-cam.json 已有 `segments: []`，无需改动

- [ ] **Step 1: 更新 city-road.json 中的 segments 数据**

替换现有 segments 数组（5 个对象）：

```json
  "segments": [
    {
      "id": "seg-1",
      "clip_src": "/mock/storyboard/jiazhengnvhuang_13.mp4",
      "start_ms": 0,
      "end_ms": 10680,
      "title": "家政女皇：软炒肉片",
      "content_type": "美食"
    },
    {
      "id": "seg-2",
      "clip_src": "/mock/storyboard/jiazhengnvhuang_5-result.mp4",
      "start_ms": 10680,
      "end_ms": 43760,
      "title": "广告：益安宁丸",
      "content_type": "广告"
    },
    {
      "id": "seg-3",
      "clip_src": "/mock/storyboard/meilihebeisegment_001_2-result.mp4",
      "start_ms": 43760,
      "end_ms": 92000,
      "title": "张家口康巴诺尔湿地",
      "content_type": "纪录片"
    },
    {
      "id": "seg-4",
      "clip_src": "/mock/storyboard/mingyilaile_17-0-result.mp4",
      "start_ms": 92000,
      "end_ms": 152000,
      "title": "名医来了：访谈节目",
      "content_type": "访谈"
    },
    {
      "id": "seg-5",
      "clip_src": "/mock/storyboard/mingyilaile_17-4-result.mp4",
      "start_ms": 152000,
      "end_ms": 185080,
      "title": "名医来了：科学应对儿童遗尿症",
      "content_type": "医疗"
    }
  ]
```

- [ ] **Step 2: 运行 Zod 校验（确认 JSON 通过 schema 校验）**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/data/city-road.json
git commit -m "feat: update segments data with title/content_type"
```

---

### Task 3: StoryboardCard 展示调整

**Files:**
- Modify: `src/steps/Step3Storyboard/StoryboardCard.tsx`

**Interfaces:**
- Consumes: 新的 `ShotSegment.title`, `ShotSegment.content_type`
- Produces: 调整后的卡片展示（标题 + 内容分类标签替代原 camera_movement + shot_type）

- [ ] **Step 1: 修改 `StoryboardCard.tsx` 的标签区域**

**改动 1:** 移除 `MOVEMENT_LABELS` map（不存在于当前代码，当前代码没有 MOVEMENT_LABELS，但有彩圆点渲染部分）。

**改动 2:** 替换第 221-251 行（标签展示区），将圆点 + camera_movement + shot_type 改为 title + content_type：

```tsx
      <div style={{ padding: tokens.space[3], display: 'flex', flexDirection: 'column', gap: tokens.space[2] }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: tokens.color.neutral[900], lineHeight: '20px' }}>
            {segment.title}
          </span>
        </div>
        <div style={{ display: 'flex', gap: tokens.space[2], alignItems: 'center' }}>
          <span
            style={{
              fontSize: 11,
              color: tokens.color.neutral[0],
              padding: '1px 6px',
              borderRadius: tokens.radius.sm,
              background: CONTENT_TYPE_COLORS[segment.content_type] ?? tokens.color.neutral[400],
              fontWeight: 500,
            }}
          >
            {segment.content_type}
          </span>
          <span style={{ fontSize: 11, color: tokens.color.neutral[400] }}>
            {formatDuration(duration)}
          </span>
        </div>
      </div>
```

需要在文件顶部添加 `CONTENT_TYPE_COLORS` 常量（与 SegmentTimeline 共享同一份映射，但分开定义避免跨文件依赖）：

```typescript
const CONTENT_TYPE_COLORS: Record<string, string> = {
  '美食': '#6366F1',
  '广告': '#F97316',
  '纪录片': '#10B981',
  '访谈': '#3B82F6',
  '医疗': '#EF4444',
};
```

**改动 3:** 更新 title tooltip — 将时间轴上的 tooltip 也要对应改（如果现在还有的话，但 card 上没有 title 属性，所以不涉及）。

- [ ] **Step 2: 运行类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/steps/Step3Storyboard/StoryboardCard.tsx
git commit -m "feat: update StoryboardCard to show title/content_type"
```

---

### Task 4: SegmentTimeline 着色表替换

**Files:**
- Modify: `src/steps/Step3Storyboard/SegmentTimeline.tsx`

**Interfaces:**
- Consumes: 新的 `ShotSegment.content_type`（替代 `camera_movement` 用于着色和标签）

- [ ] **Step 1: 替换 MOVEMENT_COLORS 为 CONTENT_TYPE_COLORS**

第 5-11 行：

```typescript
const CONTENT_TYPE_COLORS: Record<string, string> = {
  '美食': '#6366F1',
  '广告': '#F97316',
  '纪录片': '#10B981',
  '访谈': '#3B82F6',
  '医疗': '#EF4444',
};
```

- [ ] **Step 2: 替换对 `camera_movement` 和 `shot_type` 的引用**

第 61 行颜色引用：
```typescript
// 原：
? MOVEMENT_COLORS[seg.camera_movement] ?? tokens.color.neutral[400]
// 改为：
? CONTENT_TYPE_COLORS[seg.content_type] ?? tokens.color.neutral[400]
```

第 70 行 title tooltip：
```typescript
// 原：
title={isRevealed ? `${seg.camera_movement} · ${seg.shot_type} (${formatTime(seg.start_ms)} → ${formatTime(seg.end_ms)})` : ''}
// 改为：
title={isRevealed ? `${seg.title} (${formatTime(seg.start_ms)} → ${formatTime(seg.end_ms)})` : ''}
```

第 84 行标签文字：
```typescript
// 原：
{seg.camera_movement}·{seg.shot_type}
// 改为：
{seg.content_type}
```

- [ ] **Step 3: 运行类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/steps/Step3Storyboard/SegmentTimeline.tsx
git commit -m "feat: update SegmentTimeline coloring to use content_type"
```

---

### Task 5: 验证 + 测试

- [ ] **Step 1: 完整构建检查**

```bash
npx tsc --noEmit
npx vitest run
```

预期：类型检查通过，全部测试通过（现有测试只检查渲染层和揭示逻辑，不检查具体字段值，因此无需修改测试文件）。

- [ ] **Step 2: 启动开发服务器手动验证**

```bash
npx vite --open
```

手动验证流程：
1. 进入 Step 3（分镜拆分页）
2. 时间轴各块的颜色按 content_type 区分（美食=indigo、广告=orange 等）
3. 卡片逐个揭示：展示段落标题（如"家政女皇：软炒肉片"）而非"固定 中景"
4. 卡片上内容分类标签（如"美食"）替代原景别标签
5. 时间轴上的标签显示 content_type（如"美食"）
6. 悬停 tooltip 显示完整标题
7. 全部揭示后完成提示正常
8. 点击重置，分镜归零重新揭示
