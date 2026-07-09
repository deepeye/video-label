# Step 3 分镜展示（Storyboard）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Step 3「自动标注」页面替换为分镜展示页面，以故事板网格 + 时间轴展示 AI 拆分的长视频片段。

**Architecture:** 分镜 Mock 数据写入 dataset JSON，经 Zustand store 驱动组件。Step3Storyboard 主组件通过定时器按速度档逐段揭示卡片和时间轴块。纯展示，无编辑交互。

**Tech Stack:** React 18 + TypeScript + Zustand (immer) + Vite + Vitest + React Testing Library

## Global Constraints

- 零真实后端 / 零外部网络请求，MP4 片段本地打包
- 还原有 speed 状态（1x/2x/instant）控制揭示速度
- reset() 通过重建 snapshot 归零，深拷贝初始 Mock 快照
- 不修改 Step 1、Step 2、Step 4、Step 5 组件
- 不引入新的外部依赖
- 审核交互保留在 Step 4

---

### Task 1: 类型定义 + Zod Schema + Mock 数据

**Files:**
- Modify: `src/types.ts`
- Modify: `src/types.zod.ts`
- Modify: `src/data/city-road.json`
- Create: `public/mock/storyboard/` (symlink or copy MP4 files)

**Interfaces:**
- Produces: `CameraMovement`, `ShotType`, `ShotSegment` types (used by Tasks 2-6)
- Produces: `ShotSegmentSchema` Zod validator (used by DatasetSchema)
- Produces: `segments` array in city-road.json (read by createSnapshot)

- [ ] **Step 1: 在 `src/types.ts` 新增类型定义**

在 `ReviewStatus` 类型之后、`AnnotationTool` 之前插入：

```typescript
// 新增：分镜类型
export type CameraMovement = '推' | '拉' | '摇' | '移' | '跟' | '固定';
export type ShotType = '远景' | '全景' | '中景' | '近景' | '特写';

export interface ShotSegment {
  id: string;
  clip_src: string;
  start_ms: number;
  end_ms: number;
  camera_movement: CameraMovement;
  shot_type: ShotType;
}
```

同时在 `Dataset` 接口的 `demo_script` 之后新增 `segments` 字段：

```typescript
export interface Dataset {
  // ... 现有字段不变 ...
  demo_script: DemoScript;
  segments: ShotSegment[];  // 新增
}
```

- [ ] **Step 2: 在 `src/types.zod.ts` 新增 Zod Schema**

在文件末尾、`DatasetSchema` 之前插入：

```typescript
export const ShotSegmentSchema = z.object({
  id: z.string().min(1),
  clip_src: z.string().min(1),
  start_ms: z.number().int().nonnegative(),
  end_ms: z.number().int().positive(),
  camera_movement: z.enum(['推', '拉', '摇', '移', '跟', '固定']),
  shot_type: z.enum(['远景', '全景', '中景', '近景', '特写']),
});
```

然后在 `DatasetSchema` 中新增 `segments` 字段：

```typescript
export const DatasetSchema = z.object({
  // ... 现有字段不变 ...
  demo_script: DemoScriptSchema,
  segments: z.array(ShotSegmentSchema),  // 新增
});
```

- [ ] **Step 3: 在 `src/data/city-road.json` 新增 segments 数组**

文件当前结构（末尾）：
```json
  "demo_script": {
    "metadata_reveal_ms": 1500,
    "inference_reveal_ms": 2500,
    "review_focus_ids": ["trk_2", "trk_9", "trk_5"]
  }
}
```

需要做两处修改：
1. 将 `demo_script` 的闭合 `}` （第 5077 行 `  }`）改为 `  },`
2. 在第 5077 行之后、最后的 `}` 之前，插入 segments 数组：

```json
  "segments": [
    {
      "id": "seg-1",
      "clip_src": "/mock/storyboard/jiazhengnvhuang_13.mp4",
      "start_ms": 0,
      "end_ms": 10680,
      "camera_movement": "固定",
      "shot_type": "中景"
    },
    {
      "id": "seg-2",
      "clip_src": "/mock/storyboard/jiazhengnvhuang_5-result.mp4",
      "start_ms": 10680,
      "end_ms": 43760,
      "camera_movement": "推",
      "shot_type": "近景"
    },
    {
      "id": "seg-3",
      "clip_src": "/mock/storyboard/meilihebeisegment_001_2-result.mp4",
      "start_ms": 43760,
      "end_ms": 92000,
      "camera_movement": "摇",
      "shot_type": "远景"
    },
    {
      "id": "seg-4",
      "clip_src": "/mock/storyboard/mingyilaile_17-0-result.mp4",
      "start_ms": 92000,
      "end_ms": 152000,
      "camera_movement": "跟",
      "shot_type": "中景"
    },
    {
      "id": "seg-5",
      "clip_src": "/mock/storyboard/mingyilaile_17-4-result.mp4",
      "start_ms": 152000,
      "end_ms": 185080,
      "camera_movement": "移",
      "shot_type": "全景"
    }
  ]
```

修改后的文件末尾应为：
```json
  "demo_script": {
    "metadata_reveal_ms": 1500,
    "inference_reveal_ms": 2500,
    "review_focus_ids": ["trk_2", "trk_9", "trk_5"]
  },
  "segments": [
    { "id": "seg-1", ... },
    ...
  ]
}
```

- [ ] **Step 4: 复制 MP4 文件到 public 目录**

```bash
mkdir -p public/mock/storyboard
cp assets/演示汇总/*.mp4 public/mock/storyboard/
```

- [ ] **Step 5: 同步更新 meeting-room.json 和 retail-cam.json**

两个 dataset JSON 也需要 `segments` 字段以通过 Zod 校验。在各自的 `demo_script` 闭合 `}` 之后添加：

```json
  "segments": []
```

- [ ] **Step 6: 运行类型校验 + 测试验证**

```bash
npx tsc --noEmit
npx vitest run tests/data.test.ts tests/store.test.ts
```

预期：类型检查通过，现有测试全部继续通过。

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/types.zod.ts src/data/ public/mock/storyboard/
git commit -m "feat: add ShotSegment types and mock data for storyboard"
```

---

### Task 2: Store 变更

**Files:**
- Modify: `src/store/snapshots.ts`
- Modify: `src/store/demoStore.ts`

**Interfaces:**
- Consumes: `ShotSegment` from Task 1
- Produces: `Snapshot.segments`, `Snapshot.revealedSegmentCount`, `DemoStore.revealNextSegment`

- [ ] **Step 1: 在 `snapshots.ts` 的 Snapshot 接口中新增字段**

```typescript
export interface Snapshot {
  // ... 现有字段不变 ...
  seekNonce: number;
  segments: ShotSegment[];            // 新增
  revealedSegmentCount: number;       // 新增
}
```

同时更新 import：

```typescript
import type {
  AnnotationState,
  AnnotationTool,
  DatasetId,
  DemoStep,
  EventMarker,
  FrameTagEntry,
  ReviewAction,
  ShotSegment,          // 新增
  Speed,
  TimelineTool,
} from '../types';
```

- [ ] **Step 2: 在 `createSnapshot` 中初始化新字段**

```typescript
export function createSnapshot(datasetId: DatasetId): Snapshot {
  const dataset = getDataset(datasetId);
  return {
    // ... 现有字段不变 ...
    seekNonce: 0,
    segments: dataset.segments ?? [],   // 新增
    revealedSegmentCount: 0,            // 新增
  };
}
```

- [ ] **Step 3: 在 `demoStore.ts` 的 DemoStore 接口中新增 action**

```typescript
export interface DemoStore extends Snapshot {
  // ... 现有 actions 不变 ...
  canAdvanceFromStep4: () => boolean;
  revealNextSegment: () => void;  // 新增
}
```

- [ ] **Step 4: 在 `demoStore.ts` 的 create 中实现 revealNextSegment**

在 `canAdvanceFromStep4` 实现之前插入：

```typescript
revealNextSegment: () =>
  set((s) => {
    if (s.revealedSegmentCount < s.segments.length) {
      s.revealedSegmentCount += 1;
    }
  }),
```

- [ ] **Step 5: 运行类型检查 + 测试**

```bash
npx tsc --noEmit
npx vitest run tests/store.test.ts tests/snapshots.test.ts
```

预期：全部通过。

- [ ] **Step 6: Commit**

```bash
git add src/store/
git commit -m "feat: add segments and revealNextSegment to store"
```

---

### Task 3: SegmentTimeline 组件

**Files:**
- Create: `src/steps/Step3Storyboard/SegmentTimeline.tsx`

**Interfaces:**
- Consumes: `ShotSegment[]`, `revealedSegmentCount` from store
- Produces: timeline visual component (used by Task 5)

- [ ] **Step 1: 创建 `SegmentTimeline.tsx`**

```typescript
import { useMemo } from 'react';
import type { ShotSegment } from '../../types';
import { tokens } from '../../styles/tokens';

const MOVEMENT_COLORS: Record<string, string> = {
  '推': '#6366F1',
  '拉': '#8B5CF6',
  '摇': '#F97316',
  '移': '#10B981',
  '跟': '#EF4444',
  '固定': '#3B82F6',
};

interface SegmentTimelineProps {
  segments: ShotSegment[];
  revealedCount: number;
}

export function SegmentTimeline({ segments, revealedCount }: SegmentTimelineProps) {
  const totalDuration = useMemo(
    () => segments.reduce((sum, seg) => sum + (seg.end_ms - seg.start_ms), 0),
    [segments],
  );

  if (totalDuration === 0) return null;

  return (
    <div
      data-testid="segment-timeline"
      style={{
        height: 80,
        display: 'flex',
        alignItems: 'center',
        padding: `0 ${tokens.space[4]}px`,
        background: tokens.color.neutral[0],
        borderTop: `1px solid ${tokens.color.neutral[200]}`,
      }}
    >
      <div
        style={{
          width: '100%',
          height: 32,
          display: 'flex',
          borderRadius: tokens.radius.sm,
          overflow: 'hidden',
          background: tokens.color.neutral[100],
        }}
      >
        {segments.map((seg, idx) => {
          const duration = seg.end_ms - seg.start_ms;
          const widthPct = (duration / totalDuration) * 100;
          const isRevealed = idx < revealedCount;
          return (
            <div
              key={seg.id}
              data-testid={`timeline-seg-${seg.id}`}
              style={{
                width: `${widthPct}%`,
                height: '100%',
                background: isRevealed
                  ? MOVEMENT_COLORS[seg.camera_movement] ?? tokens.color.neutral[400]
                  : tokens.color.neutral[200],
                transition: `background ${tokens.duration.slow}ms ${tokens.ease.out}`,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 0,
              }}
              title={isRevealed ? `${seg.camera_movement} · ${seg.shot_type} (${formatTime(seg.start_ms)} → ${formatTime(seg.end_ms)})` : ''}
            >
              {isRevealed && widthPct > 10 && (
                <span
                  style={{
                    fontSize: 10,
                    color: '#fff',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    padding: '0 4px',
                  }}
                >
                  {seg.camera_movement}·{seg.shot_type}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
```

- [ ] **Step 2: 运行类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/steps/Step3Storyboard/SegmentTimeline.tsx
git commit -m "feat: add SegmentTimeline component"
```

---

### Task 4: StoryboardCard + StoryboardGrid 组件

**Files:**
- Create: `src/steps/Step3Storyboard/StoryboardCard.tsx`
- Create: `src/steps/Step3Storyboard/StoryboardGrid.tsx`

**Interfaces:**
- Consumes: `ShotSegment` from Task 1
- Produces: `StoryboardCard`, `StoryboardGrid` (used by Task 5)

- [ ] **Step 1: 创建 `StoryboardCard.tsx`**

```typescript
import { useEffect, useRef, useState } from 'react';
import type { ShotSegment } from '../../types';
import { tokens } from '../../styles/tokens';

const MOVEMENT_LABELS: Record<string, string> = {
  '推': '推', '拉': '拉', '摇': '摇', '移': '移', '跟': '跟', '固定': '固定',
};

interface StoryboardCardProps {
  segment: ShotSegment;
  isNew: boolean;
}

export function StoryboardCard({ segment, isNew }: StoryboardCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [thumbReady, setThumbReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleLoaded = () => {
      video.currentTime = 0.5;
    };
    const handleSeeked = () => {
      setThumbReady(true);
    };
    video.addEventListener('loadeddata', handleLoaded);
    video.addEventListener('seeked', handleSeeked);
    return () => {
      video.removeEventListener('loadeddata', handleLoaded);
      video.removeEventListener('seeked', handleSeeked);
    };
  }, []);

  const duration = segment.end_ms - segment.start_ms;

  return (
    <div
      data-testid={`storyboard-card-${segment.id}`}
      style={{
        flexShrink: 0,
        width: 240,
        borderRadius: tokens.radius.md,
        overflow: 'hidden',
        background: tokens.color.neutral[0],
        border: `1px solid ${tokens.color.neutral[200]}`,
        boxShadow: tokens.shadow.sm,
        opacity: isNew ? 0 : 1,
        transform: isNew ? 'scale(0.85)' : 'scale(1)',
        transition: isNew
          ? `opacity ${tokens.duration.slow}ms ${tokens.ease.out}, transform 400ms ${tokens.ease.spring}`
          : 'none',
      }}
    >
      <div
        style={{
          width: '100%',
          height: 135,
          background: tokens.color.neutral[900],
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <video
          ref={videoRef}
          src={segment.clip_src}
          muted
          preload="metadata"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: thumbReady ? 1 : 0,
          }}
        />
        {!thumbReady && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: tokens.color.neutral[500],
              fontSize: 12,
            }}
          >
            加载中...
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '4px 8px',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            fontSize: 11,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>{formatTime(segment.start_ms)}</span>
          <span>{formatTime(segment.end_ms)}</span>
        </div>
      </div>
      <div style={{ padding: tokens.space[3], display: 'flex', flexDirection: 'column', gap: tokens.space[2] }}>
        <div style={{ display: 'flex', gap: tokens.space[1], alignItems: 'center' }}>
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#6366F1',
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: tokens.color.neutral[900] }}>
            {segment.camera_movement}
          </span>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              color: tokens.color.neutral[500],
              padding: '2px 6px',
              borderRadius: tokens.radius.sm,
              background: tokens.color.neutral[100],
            }}
          >
            {segment.shot_type}
          </span>
        </div>
        <span style={{ fontSize: 11, color: tokens.color.neutral[400] }}>
          {formatDuration(duration)}
        </span>
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatDuration(ms: number): string {
  const sec = (ms / 1000).toFixed(1);
  return `${sec}s`;
}
```

- [ ] **Step 2: 创建 `StoryboardGrid.tsx`**

```typescript
import type { ShotSegment } from '../../types';
import { tokens } from '../../styles/tokens';
import { StoryboardCard } from './StoryboardCard';

interface StoryboardGridProps {
  segments: ShotSegment[];
  revealedCount: number;
}

export function StoryboardGrid({ segments, revealedCount }: StoryboardGridProps) {
  const revealed = segments.slice(0, revealedCount);

  return (
    <div
      data-testid="storyboard-grid"
      style={{
        flex: 1,
        overflowX: 'auto',
        overflowY: 'hidden',
        padding: tokens.space[4],
        display: 'flex',
        gap: tokens.space[3],
        alignItems: 'flex-start',
      }}
    >
      {revealed.length === 0 && (
        <div
          data-testid="storyboard-empty"
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: tokens.color.neutral[400],
            fontSize: 14,
          }}
        >
          AI 正在拆分视频分镜...
        </div>
      )}
      {revealed.map((seg, idx) => (
        <StoryboardCard
          key={seg.id}
          segment={seg}
          isNew={idx === revealed.length - 1 && revealed.length < segments.length}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: 运行类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/steps/Step3Storyboard/
git commit -m "feat: add StoryboardCard and StoryboardGrid components"
```

---

### Task 5: Step3Storyboard 主组件 + 集成

**Files:**
- Create: `src/steps/Step3Storyboard/index.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `StoryboardGrid`, `SegmentTimeline` from Tasks 3-4
- Consumes: store `segments`, `revealedSegmentCount`, `speed`, `revealNextSegment`

- [ ] **Step 1: 创建 `src/steps/Step3Storyboard/index.tsx`**

```typescript
import { useEffect, useRef } from 'react';
import { useDemoStore } from '../../store/demoStore';
import { tokens } from '../../styles/tokens';
import { StoryboardGrid } from './StoryboardGrid';
import { SegmentTimeline } from './SegmentTimeline';

const REVEAL_INTERVALS: Record<string, number> = {
  '1x': 800,
  '2x': 400,
  'instant': 0,
};

export function Step3Storyboard() {
  const segments = useDemoStore((s) => s.segments);
  const revealedCount = useDemoStore((s) => s.revealedSegmentCount);
  const speed = useDemoStore((s) => s.speed);
  const revealNext = useDemoStore((s) => s.revealNextSegment);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const allRevealed = revealedCount >= segments.length;

  useEffect(() => {
    if (allRevealed) return;

    if (speed === 'instant') {
      // 一次性揭示全部
      const remaining = segments.length - revealedCount;
      for (let i = 0; i < remaining; i++) {
        revealNext();
      }
      return;
    }

    const interval = REVEAL_INTERVALS[speed] ?? 800;
    timerRef.current = setInterval(() => {
      revealNext();
    }, interval);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [speed, allRevealed, segments.length, revealedCount, revealNext]);

  return (
    <div
      data-testid="step3-storyboard"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: `${tokens.space[3]} ${tokens.space[4]}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: tokens.color.neutral[900] }}>
          ③ 分镜拆分
        </h2>
        <span style={{ fontSize: 13, color: tokens.color.neutral[500] }}>
          {allRevealed
            ? `共 ${segments.length} 个片段`
            : `已拆分 ${revealedCount}/${segments.length}`}
        </span>
      </div>
      <StoryboardGrid segments={segments} revealedCount={revealedCount} />
      <SegmentTimeline segments={segments} revealedCount={revealedCount} />
      {allRevealed && (
        <div
          data-testid="step3-complete"
          style={{
            padding: `${tokens.space[2]} ${tokens.space[4]}`,
            fontSize: 13,
            color: tokens.color.success[500],
            background: tokens.color.success[50],
            borderTop: `1px solid ${tokens.color.neutral[200]}`,
          }}
        >
          ✓ 分镜拆分完成，请点击「下一步」进入审核
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 修改 `src/App.tsx`**

将 import 和渲染替换：

```typescript
// 将 import { Step3AutoAnnotate } from './steps/Step3AutoAnnotate';
// 改为：
import { Step3Storyboard } from './steps/Step3Storyboard';

// 将 {demoStep === 3 && <Step3AutoAnnotate />}
// 改为：
{demoStep === 3 && <Step3Storyboard />}
```

- [ ] **Step 3: 运行类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/steps/Step3Storyboard/index.tsx src/App.tsx
git commit -m "feat: integrate Step3Storyboard, replace Step3AutoAnnotate"
```

---

### Task 6: TopBar 步骤名称更新

**Files:**
- Modify: `src/chrome/StepPills.tsx`

- [ ] **Step 1: 修改 Step 3 的名称**

```typescript
const STEPS: { id: DemoStep; label: string }[] = [
  { id: 1, label: '①上传' },
  { id: 2, label: '②元信息' },
  { id: 3, label: '③分镜' },   // 原 '③标注' 改为 '③分镜'
  { id: 4, label: '④审核' },
  { id: 5, label: '⑤导出' },
];
```

- [ ] **Step 2: 运行类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/chrome/StepPills.tsx
git commit -m "feat: update Step 3 label to 分镜拆分"
```

---

### Task 7: 测试

**Files:**
- Create: `tests/Step3Storyboard.test.tsx`

- [ ] **Step 1: 编写测试**

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Step3Storyboard } from '@/steps/Step3Storyboard';
import { useDemoStore } from '@/store/demoStore';

describe('Step3Storyboard', () => {
  beforeEach(() => {
    useDemoStore.getState().reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with empty state initially', () => {
    render(<Step3Storyboard />);
    expect(screen.getByTestId('step3-storyboard')).toBeTruthy();
    expect(screen.getByTestId('storyboard-empty')).toBeTruthy();
    expect(screen.getByTestId('segment-timeline')).toBeTruthy();
  });

  it('reveals segments one by one on 1x speed', () => {
    render(<Step3Storyboard />);
    const store = useDemoStore.getState();

    expect(store.revealedSegmentCount).toBe(0);

    act(() => { vi.advanceTimersByTime(800); });
    expect(useDemoStore.getState().revealedSegmentCount).toBe(1);

    act(() => { vi.advanceTimersByTime(800); });
    expect(useDemoStore.getState().revealedSegmentCount).toBe(2);
  });

  it('reveals all segments instantly on instant speed', () => {
    useDemoStore.getState().setSpeed('instant');
    render(<Step3Storyboard />);

    const store = useDemoStore.getState();
    expect(store.revealedSegmentCount).toBe(store.segments.length);
  });

  it('shows complete message when all revealed', () => {
    useDemoStore.getState().setSpeed('instant');
    render(<Step3Storyboard />);
    expect(screen.getByTestId('step3-complete')).toBeTruthy();
  });

  it('shows correct count in header', () => {
    render(<Step3Storyboard />);
    act(() => { vi.advanceTimersByTime(800); });
    expect(screen.getByText('已拆分 1/5')).toBeTruthy();
  });

  it('resets revealedSegmentCount on store reset', () => {
    useDemoStore.getState().setSpeed('instant');
    render(<Step3Storyboard />);
    expect(useDemoStore.getState().revealedSegmentCount).toBe(5);

    act(() => { useDemoStore.getState().reset(); });
    expect(useDemoStore.getState().revealedSegmentCount).toBe(0);
  });
});
```

- [ ] **Step 2: 运行测试**

```bash
npx vitest run tests/Step3Storyboard.test.tsx
```

预期：全部通过。

- [ ] **Step 3: 运行全部测试确保无回归**

```bash
npx vitest run
```

预期：全部通过。

- [ ] **Step 4: Commit**

```bash
git add tests/Step3Storyboard.test.tsx
git commit -m "test: add Step3Storyboard tests"
```

---

### Task 8: 验证 + 清理

- [ ] **Step 1: 运行完整检查**

```bash
npx tsc --noEmit
npx vitest run
```

- [ ] **Step 2: 启动开发服务器手动验证**

```bash
npx vite --open
```

手动验证流程：
1. 页面加载，Step 1 显示正常
2. 点击「下一步」→ Step 2 → Step 3
3. Step 3 显示「③ 分镜拆分」标题
4. 时间轴从灰色逐渐变色（1x 速度约 4s 完成）
5. 故事板卡片逐个出现，带入场动画
6. 全部揭示后显示「分镜拆分完成」提示
7. 点击「下一步」进入 Step 4（审核页面不变）
8. 点击「重置」→ 分镜状态归零
9. 切换到 2x / instant 速度档，揭示速度正常

- [ ] **Step 3: 清理旧 Step3AutoAnnotate（可选）**

旧 Step3AutoAnnotate 目录不再被引用，可在确认新页面正常后删除：

```bash
git rm -r src/steps/Step3AutoAnnotate/
git rm tests/Step3AutoAnnotate.manual.test.tsx
git commit -m "chore: remove deprecated Step3AutoAnnotate"
```