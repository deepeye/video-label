# Day 2-3 实施计划 · Step 4 审核工作台

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**前置:** Day 1 (`2026-06-18-video-label-demo.md`) 已完成，全部测试绿色。

**Goal:** 实现 Step 4 审核工作台 — Demo 唯一真交互、技术最重、Demo 高点。客户/主讲必须能 ✓ 接受 / ✗ 否决 / ↔ 拖框 / ↶ 撤销，且改动**必须真实回写到 Zustand store**（CLAUDE.md 第 2 条硬约束）。

**Architecture:** Konva Stage 三层（视频底图 / 标注框 / Transformer）；视频用真实 `<video>` 元素 + `requestVideoFrameCallback` 同步到 Konva.Image；47 个框按当前帧时间戳过滤，bbox 在两关键帧间线性插值；右属性面板大按钮 + 底部横向队列轨道；键盘 A/D/Ctrl+Z/←/→ 全部命中 store action。

**关键产出文件:**
- `src/chrome/TopBar.tsx` (Day 2 占位版，Day 6 接入完整逻辑)
- `src/chrome/StepPills.tsx`
- `src/chrome/DemoControls.tsx` (占位)
- `src/App.tsx` (重写为基于 demoStep 路由)
- `src/lib/ext/videoFrameCallback.ts`
- `src/lib/interpolate.ts`
- `src/steps/Step4Review/index.tsx`
- `src/steps/Step4Review/ReviewCanvas.tsx`
- `src/steps/Step4Review/BoxLayer.tsx`
- `src/steps/Step4Review/PropertyPanel.tsx`
- `src/steps/Step4Review/QueueTrack.tsx`
- `src/steps/Step4Review/keyboard.ts`
- `tests/interpolate.test.ts`
- `tests/Step4Review.test.tsx`

**Day 2-3 不涉及:**
- VirtualPresenter (Day 6 自动模式接入)
- 视频帧同步在测试环境的 mock (RTL 测试用 jsdom 没真 video, mock 即可)

---

## File Structure (Day 2-3 范围)

```
src/
├── chrome/
│   ├── TopBar.tsx              ← 顶栏壳 (Logo + StepPills + DemoControls 容器)
│   ├── StepPills.tsx           ← 5 个步骤胶囊
│   └── DemoControls.tsx        ← 控制按钮组占位 (Day 6 完整接入)
├── lib/
│   ├── ext/
│   │   └── videoFrameCallback.ts  ← requestVideoFrameCallback 兼容包装
│   └── interpolate.ts             ← bbox 在两关键帧间的线性插值
├── steps/
│   └── Step4Review/
│       ├── index.tsx              ← 步骤主视图 (布局 + 副组件组合)
│       ├── ReviewCanvas.tsx       ← Konva Stage + 视频帧同步 + 框渲染
│       ├── BoxLayer.tsx           ← 47 个框, 按 review.status 颜色编码
│       ├── PropertyPanel.tsx      ← 右侧属性 + ✓/✗ 大按钮
│       ├── QueueTrack.tsx         ← 底部横向重点项轨道
│       └── keyboard.ts            ← A/D/Ctrl+Z/←/→ 快捷键 hook
└── App.tsx                        ← 改写: 基于 demoStep 路由 5 步骤
```

---

## Day 2: 画布 + 框 + 属性面板 + 键盘

### Task 2.1: Chrome 层占位 (TopBar / StepPills / DemoControls)

**Files:**
- Create: `src/chrome/TopBar.tsx`
- Create: `src/chrome/StepPills.tsx`
- Create: `src/chrome/DemoControls.tsx`

> **设计依据:** spec §5.6.1 顶栏 56px 高，左 Logo + 中央步骤胶囊群 + 右控制按钮组。Day 2-3 把骨架搭起来，**胶囊不可点击**（spec §5.6.2 防止跳步），控制按钮先连 `goToStep / reset / setSpeed`，自动模式相关 (▶/⏸) Day 6 接入 timeline 后再完整。

- [ ] **Step 1: 写 src/chrome/StepPills.tsx**

```tsx
import { useDemoStore } from '../store/demoStore';
import { tokens } from '../styles/tokens';
import type { DemoStep } from '../types';

const STEPS: { id: DemoStep; label: string }[] = [
  { id: 1, label: '①上传' },
  { id: 2, label: '②元信息' },
  { id: 3, label: '③标注' },
  { id: 4, label: '④审核' },
  { id: 5, label: '⑤导出' },
];

export function StepPills() {
  const current = useDemoStore((s) => s.demoStep);

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: tokens.space[2] }}
      data-testid="step-pills"
    >
      {STEPS.map((step, idx) => {
        const isCurrent = step.id === current;
        const isCompleted = step.id < current;
        const isFuture = step.id > current;

        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: tokens.space[2] }}>
            <span
              data-testid={`step-pill-${step.id}`}
              data-state={isCurrent ? 'current' : isCompleted ? 'completed' : 'future'}
              style={{
                padding: '6px 14px',
                borderRadius: tokens.radius.full,
                fontSize: 12,
                fontWeight: isCurrent ? 600 : 500,
                color: isCurrent ? '#fff' : isCompleted ? tokens.color.neutral[700] : tokens.color.neutral[400],
                background: isCurrent ? tokens.brandGradient : tokens.color.neutral[100],
                boxShadow: isCurrent ? tokens.shadow.brand : 'none',
                userSelect: 'none',
              }}
            >
              {step.label}
              {isCompleted && <span style={{ marginLeft: 4, color: tokens.color.success[500] }}>✓</span>}
            </span>
            {idx < STEPS.length - 1 && (
              <span style={{ color: tokens.color.neutral[200], fontSize: 14 }}>→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 写 src/chrome/DemoControls.tsx (Day 2-3 占位版)**

```tsx
import { useDemoStore } from '../store/demoStore';
import { tokens } from '../styles/tokens';
import type { Speed } from '../types';

const SPEEDS: { id: Speed; label: string }[] = [
  { id: '1x', label: '1×' },
  { id: '2x', label: '2×' },
  { id: 'instant', label: '即时' },
];

export function DemoControls() {
  const speed = useDemoStore((s) => s.speed);
  const setSpeed = useDemoStore((s) => s.setSpeed);
  const reset = useDemoStore((s) => s.reset);
  const dirty = useDemoStore((s) => s.dirty);

  const handleReset = () => {
    if (dirty) {
      const ok = window.confirm('重置将清空当前演示进度？');
      if (!ok) return;
    }
    reset();
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space[2] }} data-testid="demo-controls">
      {/* ▶ ⏸ ⏭ 占位 — Day 6 接入 */}
      <button data-testid="btn-auto" disabled style={btnStyle(true)}>▶</button>
      <button data-testid="btn-pause" disabled style={btnStyle(true)}>⏸</button>
      <button data-testid="btn-next" disabled style={btnStyle(true)}>⏭</button>
      <button data-testid="btn-reset" onClick={handleReset} style={btnStyle(false)}>↺</button>
      <select
        data-testid="speed-select"
        value={speed}
        onChange={(e) => setSpeed(e.target.value as Speed)}
        style={{
          padding: '6px 10px',
          borderRadius: tokens.radius.md,
          border: `1px solid ${tokens.color.neutral[200]}`,
          background: tokens.color.neutral[0],
          color: tokens.color.neutral[700],
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        {SPEEDS.map((s) => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
    </div>
  );
}

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.md,
    border: `1px solid ${tokens.color.neutral[200]}`,
    background: tokens.color.neutral[0],
    color: disabled ? tokens.color.neutral[400] : tokens.color.neutral[700],
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    fontSize: 14,
  };
}
```

- [ ] **Step 3: 写 src/chrome/TopBar.tsx**

```tsx
import { tokens } from '../styles/tokens';
import { StepPills } from './StepPills';
import { DemoControls } from './DemoControls';

export function TopBar() {
  return (
    <header
      data-testid="top-bar"
      style={{
        height: 56,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${tokens.space[5]}px`,
        background: tokens.color.neutral[0],
        borderBottom: `1px solid ${tokens.color.neutral[200]}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.space[2],
          color: tokens.color.brand[500],
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        <span>◆</span>
        <span>Frameworks Demo</span>
      </div>
      <StepPills />
      <DemoControls />
    </header>
  );
}
```

- [ ] **Step 4: 验证 typecheck**

Run: `npm run typecheck`
Expected: 无报错。

- [ ] **Step 5: 提交**

```bash
mkdir -p src/chrome
git add src/chrome/
git commit -m "feat: chrome layer skeleton (TopBar + StepPills + DemoControls)"
```

---

### Task 2.2: App.tsx 改写 — 基于 demoStep 路由 + URL 参数支持

**Files:**
- Modify: `src/App.tsx`

> **设计依据:** spec §1.4 dev 期 `?step=N` URL 参数支持; spec §5 五个步骤视图按 demoStep 切换。

- [ ] **Step 1: 重写 src/App.tsx**

```tsx
import { useEffect } from 'react';
import { useDemoStore } from './store/demoStore';
import { TopBar } from './chrome/TopBar';
import { tokens } from './styles/tokens';
import type { DatasetId, DemoStep, Speed } from './types';

// Step 视图占位 — Day 2-3 仅实现 Step4Review, 其他在 Day 5 完成
import { Step4Review } from './steps/Step4Review';

function StepPlaceholder({ step }: { step: number }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: tokens.space[2],
      }}
    >
      <h2 style={{ margin: 0, color: tokens.color.neutral[900] }}>步骤 {step}</h2>
      <p style={{ margin: 0, color: tokens.color.neutral[500] }}>占位 — 后续天数实现</p>
    </div>
  );
}

function useUrlParams() {
  const goToStep = useDemoStore((s) => s.goToStep);
  const setSpeed = useDemoStore((s) => s.setSpeed);
  const selectDataset = useDemoStore((s) => s.selectDataset);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const params = new URLSearchParams(window.location.search);
    const step = params.get('step');
    const speed = params.get('speed');
    const dataset = params.get('dataset');

    if (dataset && ['city-road', 'meeting-room', 'retail-cam'].includes(dataset)) {
      selectDataset(dataset as DatasetId);
    }
    if (speed && ['1x', '2x', 'instant'].includes(speed)) {
      setSpeed(speed as Speed);
    }
    if (step) {
      const n = Number(step);
      if (n >= 1 && n <= 5) goToStep(n as DemoStep);
    }
  }, [goToStep, setSpeed, selectDataset]);
}

export default function App() {
  useUrlParams();
  const demoStep = useDemoStore((s) => s.demoStep);

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: tokens.color.neutral[50],
      }}
    >
      <TopBar />
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
        data-testid={`step-view-${demoStep}`}
      >
        {demoStep === 1 && <StepPlaceholder step={1} />}
        {demoStep === 2 && <StepPlaceholder step={2} />}
        {demoStep === 3 && <StepPlaceholder step={3} />}
        {demoStep === 4 && <Step4Review />}
        {demoStep === 5 && <StepPlaceholder step={5} />}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: 添加最小宽度遮罩 (spec §6.9 < 1280 显示「请用宽屏」)**

在 src/App.tsx 顶部 import + 在 return 最外层加：

```tsx
import { useState, useEffect } from 'react';

// ... 在 App 组件内添加:
const [tooNarrow, setTooNarrow] = useState(false);
useEffect(() => {
  const check = () => setTooNarrow(window.innerWidth < 1280);
  check();
  window.addEventListener('resize', check);
  return () => window.removeEventListener('resize', check);
}, []);

// 在主 return 之前:
if (tooNarrow) {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: tokens.space[3],
        background: tokens.color.neutral[50],
        padding: tokens.space[6],
        textAlign: 'center',
      }}
    >
      <h2 style={{ margin: 0, color: tokens.color.neutral[900] }}>请使用宽屏（≥ 1280×720）演示</h2>
      <p style={{ margin: 0, color: tokens.color.neutral[500] }}>建议按 F11 切换全屏</p>
    </div>
  );
}
```

- [ ] **Step 3: 验证 typecheck**

Run: `npm run typecheck`
Expected: 报错 — `Cannot find module './steps/Step4Review'`。这是预期的，下一任务实现。

- [ ] **Step 4: 暂时注释 Step4Review import**

为让本任务可独立提交，先把 `import { Step4Review }` 那行注释掉，并把 `<Step4Review />` 临时改为 `<StepPlaceholder step={4} />`。

```tsx
// import { Step4Review } from './steps/Step4Review';   // Task 2.4 启用

// ...
{demoStep === 4 && <StepPlaceholder step={4} />}  // Task 2.4 改回 <Step4Review />
```

- [ ] **Step 5: typecheck 通过**

Run: `npm run typecheck`
Expected: 无报错。

- [ ] **Step 6: dev 启动验证**

Run: `npm run dev` (后台) 然后浏览器打开 http://localhost:5173
Expected: 看到 TopBar + 「步骤 1 占位」中央区。

试试 URL 参数：
- http://localhost:5173/?step=4 → 看到「步骤 4 占位」
- http://localhost:5173/?step=2 → 「步骤 2 占位」

(Ctrl+C 停止 dev server)

- [ ] **Step 7: 提交**

```bash
git add src/App.tsx
git commit -m "feat: App routing by demoStep with URL params (?step= ?speed= ?dataset=) for dev"
```

---

### Task 2.3: requestVideoFrameCallback 兼容包装

**Files:**
- Create: `src/lib/ext/videoFrameCallback.ts`
- Create: `tests/videoFrameCallback.test.ts`

> **设计依据:** spec §5.4.2 用 `requestVideoFrameCallback` 同步视频帧到 Konva.Image。该 API 在 Chrome 83+ / Edge 84+ 原生支持，jsdom 没有 — 测试环境需要 mock。包装一层方便 mock 和降级提示。

- [ ] **Step 1: 写 src/lib/ext/videoFrameCallback.ts**

```ts
/**
 * requestVideoFrameCallback 兼容包装。
 *
 * - 浏览器环境且支持: 走原生 API
 * - 浏览器环境不支持: 降级到 requestAnimationFrame + 30fps polyfill
 * - jsdom 测试环境: 直接 no-op (返回 0)
 */

export interface FrameCallbackHandle {
  cancel(): void;
}

export type VideoFrameCallback = (
  now: number,
  metadata: { mediaTime: number; presentedFrames?: number },
) => void;

export function watchVideoFrames(video: HTMLVideoElement, cb: VideoFrameCallback): FrameCallbackHandle {
  // jsdom (test env): video 不会真播放, no-op
  if (typeof window === 'undefined') {
    return { cancel: () => {} };
  }

  // 原生 API (Chrome 83+ / Edge 84+ / Safari 16+)
  type V = HTMLVideoElement & {
    requestVideoFrameCallback?: (cb: (now: number, m: { mediaTime: number }) => void) => number;
    cancelVideoFrameCallback?: (id: number) => void;
  };
  const v = video as V;

  if (v.requestVideoFrameCallback) {
    let handle = 0;
    const tick = (now: number, metadata: { mediaTime: number }) => {
      cb(now, metadata);
      handle = v.requestVideoFrameCallback!(tick);
    };
    handle = v.requestVideoFrameCallback(tick);
    return {
      cancel: () => {
        if (v.cancelVideoFrameCallback) v.cancelVideoFrameCallback(handle);
      },
    };
  }

  // 降级: rAF 30fps 轮询
  let raf = 0;
  let lastT = 0;
  const tick = (t: number) => {
    if (t - lastT >= 1000 / 30) {
      lastT = t;
      cb(t, { mediaTime: video.currentTime });
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return { cancel: () => cancelAnimationFrame(raf) };
}

/**
 * 检测当前浏览器是否支持原生 requestVideoFrameCallback。
 * 用于启动期向用户提示「请使用最新 Chrome」(spec §7.3.1)。
 */
export function isNativeVideoFrameCallbackSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
}
```

- [ ] **Step 2: 写 tests/videoFrameCallback.test.ts**

```ts
import { describe, it, expect, vi } from 'vitest';
import { watchVideoFrames, isNativeVideoFrameCallbackSupported } from '@/lib/ext/videoFrameCallback';

describe('watchVideoFrames', () => {
  it('returns a handle with cancel method', () => {
    const video = document.createElement('video');
    const cb = vi.fn();
    const h = watchVideoFrames(video, cb);
    expect(typeof h.cancel).toBe('function');
    h.cancel();
  });

  it('does not throw when cancelled before any callback', () => {
    const video = document.createElement('video');
    const cb = vi.fn();
    const h = watchVideoFrames(video, cb);
    expect(() => h.cancel()).not.toThrow();
  });
});

describe('isNativeVideoFrameCallbackSupported', () => {
  it('returns false in jsdom (no native API)', () => {
    expect(isNativeVideoFrameCallbackSupported()).toBe(false);
  });
});
```

- [ ] **Step 3: 运行测试**

Run: `npm run test:run -- tests/videoFrameCallback.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 4: 提交**

```bash
mkdir -p src/lib/ext
git add src/lib/ext/videoFrameCallback.ts tests/videoFrameCallback.test.ts
git commit -m "feat: watchVideoFrames wrapper with rAF fallback + jsdom safety"
```

---

### Task 2.4: 关键帧间线性插值 (lib/interpolate.ts)

**Files:**
- Create: `src/lib/interpolate.ts`
- Create: `tests/interpolate.test.ts`

> **设计依据:** spec §5.4.3 bbox 在两关键帧间线性插值。是 Step4 渲染当前帧可见框时的核心计算。

- [ ] **Step 1: 写 tests/interpolate.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { findVisibleAtTime, interpolateBox } from '@/lib/interpolate';
import type { Annotation, Keyframe } from '@/types';

function kf(ts: number, coords: [number, number, number, number]): Keyframe {
  return {
    timestamp_ms: ts,
    frame_no: Math.round((ts / 1000) * 30),
    geometry: { type: 'bbox', coords },
    is_keyframe: true,
  };
}

function ann(track_id: string, keyframes: Keyframe[]): Annotation {
  return {
    version: '2.0-demo',
    track_id,
    label_id: 'pedestrian',
    label_display: '行人',
    source: 'machine',
    confidence: 0.9,
    needs_review: false,
    keyframes,
    review: { status: 'pending', changed_frames: 0, reviewed_at: null },
  };
}

describe('interpolateBox', () => {
  it('returns first frame box when t <= first.timestamp', () => {
    const frames = [kf(1000, [10, 10, 100, 100]), kf(2000, [20, 20, 100, 100])];
    expect(interpolateBox(frames, 500)).toEqual([10, 10, 100, 100]);
    expect(interpolateBox(frames, 1000)).toEqual([10, 10, 100, 100]);
  });

  it('returns last frame box when t >= last.timestamp', () => {
    const frames = [kf(1000, [10, 10, 100, 100]), kf(2000, [20, 20, 100, 100])];
    expect(interpolateBox(frames, 2500)).toEqual([20, 20, 100, 100]);
  });

  it('linearly interpolates between two adjacent keyframes', () => {
    const frames = [kf(1000, [0, 0, 100, 100]), kf(2000, [100, 50, 200, 150])];
    // t = 1500 (50% 处)
    expect(interpolateBox(frames, 1500)).toEqual([50, 25, 150, 125]);
  });

  it('handles 3+ keyframes by picking the right segment', () => {
    const frames = [kf(0, [0, 0, 50, 50]), kf(1000, [100, 100, 50, 50]), kf(2000, [200, 0, 50, 50])];
    expect(interpolateBox(frames, 500)).toEqual([50, 50, 50, 50]); // 0→1000 segment
    expect(interpolateBox(frames, 1500)).toEqual([150, 50, 50, 50]); // 1000→2000 segment
  });

  it('throws on empty keyframes', () => {
    expect(() => interpolateBox([], 500)).toThrow();
  });
});

describe('findVisibleAtTime', () => {
  it('returns annotations whose [first, last] keyframe span covers t', () => {
    const a = ann('a', [kf(0, [0, 0, 10, 10]), kf(1000, [0, 0, 10, 10])]);
    const b = ann('b', [kf(2000, [0, 0, 10, 10]), kf(3000, [0, 0, 10, 10])]);
    const c = ann('c', [kf(500, [0, 0, 10, 10]), kf(2500, [0, 0, 10, 10])]);
    const all = [a, b, c];

    expect(findVisibleAtTime(all, 500).map((x) => x.track_id)).toEqual(['a', 'c']);
    expect(findVisibleAtTime(all, 2200).map((x) => x.track_id)).toEqual(['b', 'c']);
    expect(findVisibleAtTime(all, 1500).map((x) => x.track_id)).toEqual(['c']);
  });

  it('excludes annotations with rejected status', () => {
    const a = ann('a', [kf(0, [0, 0, 10, 10]), kf(1000, [0, 0, 10, 10])]);
    a.review.status = 'rejected';
    expect(findVisibleAtTime([a], 500)).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试以确认失败**

Run: `npm run test:run -- tests/interpolate.test.ts`
Expected: FAIL — `Cannot find module '@/lib/interpolate'`

- [ ] **Step 3: 写 src/lib/interpolate.ts**

```ts
import type { Annotation, BBox, Keyframe } from '../types';

/**
 * 在关键帧序列中线性插值出某时间戳处的 bbox 坐标。
 *
 * - t ≤ first.timestamp: 返回 first.coords
 * - t ≥ last.timestamp:  返回 last.coords
 * - 在 (kf[i], kf[i+1]) 之间: 线性插值
 *
 * keyframes 必须按 timestamp_ms 升序 (city-road-fixture 已保证)。
 */
export function interpolateBox(keyframes: Keyframe[], t: number): BBox {
  if (keyframes.length === 0) throw new Error('interpolateBox: empty keyframes');

  const first = keyframes[0]!;
  const last = keyframes[keyframes.length - 1]!;
  if (t <= first.timestamp_ms) return [...first.geometry.coords] as BBox;
  if (t >= last.timestamp_ms) return [...last.geometry.coords] as BBox;

  // 找到 t 所在的 segment [i, i+1]
  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i]!;
    const b = keyframes[i + 1]!;
    if (t >= a.timestamp_ms && t <= b.timestamp_ms) {
      const dur = b.timestamp_ms - a.timestamp_ms;
      const frac = dur === 0 ? 0 : (t - a.timestamp_ms) / dur;
      const [ax, ay, aw, ah] = a.geometry.coords;
      const [bx, by, bw, bh] = b.geometry.coords;
      return [
        Math.round(ax + (bx - ax) * frac),
        Math.round(ay + (by - ay) * frac),
        Math.round(aw + (bw - aw) * frac),
        Math.round(ah + (bh - ah) * frac),
      ];
    }
  }
  // 不应到达
  return [...last.geometry.coords] as BBox;
}

/**
 * 当前帧时间戳下应该显示的标注列表。
 *
 * 过滤规则:
 *   1. annotation 的 [firstKf, lastKf] 时间区间覆盖 t
 *   2. review.status !== 'rejected' (否决的框淡出消失)
 */
export function findVisibleAtTime(annotations: Annotation[], t: number): Annotation[] {
  return annotations.filter((a) => {
    if (a.review.status === 'rejected') return false;
    const first = a.keyframes[0]!.timestamp_ms;
    const last = a.keyframes[a.keyframes.length - 1]!.timestamp_ms;
    return t >= first && t <= last;
  });
}
```

- [ ] **Step 4: 运行测试以确认通过**

Run: `npm run test:run -- tests/interpolate.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: 提交**

```bash
git add src/lib/interpolate.ts tests/interpolate.test.ts
git commit -m "feat: bbox linear interpolation between keyframes + visible-at-time filter"
```

---

### Task 2.5: Step4Review/index.tsx — 主视图布局

**Files:**
- Create: `src/steps/Step4Review/index.tsx`

> **设计依据:** spec §5.4 + §5.6 — 中央 Konva 画布占 ~76% 宽度（实际是 `flex:1`），底部 80px 队列轨道，右侧 ~24% 属性面板。

- [ ] **Step 1: 写 src/steps/Step4Review/index.tsx**

```tsx
import { tokens } from '../../styles/tokens';
import { ReviewCanvas } from './ReviewCanvas';
import { PropertyPanel } from './PropertyPanel';
import { QueueTrack } from './QueueTrack';
import { useReviewKeyboard } from './keyboard';

export function Step4Review() {
  useReviewKeyboard();

  return (
    <div
      data-testid="step4-review"
      style={{
        flex: 1,
        display: 'flex',
        minHeight: 0,
      }}
    >
      {/* 中央: 画布 + 队列轨道 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: tokens.space[3],
          gap: tokens.space[2],
          minWidth: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            background: tokens.color.neutral[900],
            borderRadius: tokens.radius.md,
            overflow: 'hidden',
            position: 'relative',
            boxShadow: tokens.shadow.sm,
          }}
        >
          <ReviewCanvas />
        </div>
        <QueueTrack />
      </div>
      {/* 右侧: 属性面板 24% */}
      <aside
        style={{
          width: 'min(24%, 320px)',
          minWidth: 260,
          background: tokens.color.neutral[0],
          borderLeft: `1px solid ${tokens.color.neutral[200]}`,
          padding: tokens.space[4],
        }}
      >
        <PropertyPanel />
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: 创建占位的 ReviewCanvas / PropertyPanel / QueueTrack / keyboard 让 import 不报错 (后续任务实现)**

```bash
mkdir -p src/steps/Step4Review
```

```tsx
// src/steps/Step4Review/ReviewCanvas.tsx (占位 — Task 2.6/2.7/2.8/2.9 实现)
export function ReviewCanvas() {
  return <div data-testid="review-canvas" style={{ color: 'white', padding: 24 }}>ReviewCanvas placeholder</div>;
}
```

```tsx
// src/steps/Step4Review/PropertyPanel.tsx (占位 — Task 2.10 实现)
export function PropertyPanel() {
  return <div data-testid="property-panel">PropertyPanel placeholder</div>;
}
```

```tsx
// src/steps/Step4Review/QueueTrack.tsx (占位 — Task 3.1 实现)
export function QueueTrack() {
  return <div data-testid="queue-track" style={{ height: 80 }}>QueueTrack placeholder</div>;
}
```

```ts
// src/steps/Step4Review/keyboard.ts (占位 — Task 2.11 实现)
export function useReviewKeyboard() {
  // no-op
}
```

- [ ] **Step 3: 在 App.tsx 重启 Step4Review import**

修改 src/App.tsx：

```tsx
import { Step4Review } from './steps/Step4Review';

// ...
{demoStep === 4 && <Step4Review />}
```

- [ ] **Step 4: typecheck + dev 验证**

```bash
npm run typecheck
```

dev 启动 + 打开 http://localhost:5173/?step=4，应看到：

- 顶栏 + 步骤胶囊 ④ 高亮
- 中央深色画布 (含 "ReviewCanvas placeholder")
- 底部 80px 灰条 ("QueueTrack placeholder")
- 右侧白色面板 ("PropertyPanel placeholder")

- [ ] **Step 5: 提交**

```bash
git add src/steps/Step4Review/ src/App.tsx
git commit -m "feat: Step4Review layout shell + placeholder subcomponents"
```

---

### Task 2.6: ReviewCanvas — Konva Stage + 视频帧同步

**Files:**
- Modify: `src/steps/Step4Review/ReviewCanvas.tsx` (替换占位)

> **设计依据:** spec §5.4.1 / §5.4.2 — 三层 Konva Layer (视频底图 / 框 / Transformer)，视频用 `<video>` + `requestVideoFrameCallback` 同步到 Konva.Image。

- [ ] **Step 1: 安装 react-konva 验证依赖已装**

Run: `node -e "require('react-konva')" 2>&1`
Expected: 无输出 (require 成功)。如果报错，运行 `npm install react-konva konva`。

- [ ] **Step 2: 写 src/steps/Step4Review/ReviewCanvas.tsx**

```tsx
import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import { useDemoStore } from '../../store/demoStore';
import { getDataset } from '../../data';
import { watchVideoFrames } from '../../lib/ext/videoFrameCallback';
import { BoxLayer } from './BoxLayer';

export function ReviewCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageNodeRef = useRef<Konva.Image>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const selectTrack = useDemoStore((s) => s.selectTrack);

  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const dataset = getDataset(datasetId);

  // 容器尺寸 (响应式)
  const [size, setSize] = useState({ width: 0, height: 0 });

  // 当前视频时间 (ms) — 触发可见框 memo 重算
  const [currentTimeMs, setCurrentTimeMs] = useState(0);

  // 监听容器 resize
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // 视频帧 → Konva.Image
  useEffect(() => {
    const video = videoRef.current;
    const node = imageNodeRef.current;
    if (!video || !node) return;

    const handle = watchVideoFrames(video, () => {
      node.image(video);
      node.getLayer()?.batchDraw();
      setCurrentTimeMs(Math.round(video.currentTime * 1000));
    });
    return () => handle.cancel();
  }, []);

  // 视频自动播放 (Demo 静音, 浏览器允许)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {
      // 自动播放被拦截 (即使 muted), 用户点击页面后可手动恢复
      // Demo 场景: 销售在客户机器上, 一定会有页面交互
    });
  }, []);

  // 计算画布缩放: video 1920×1080 → container 大小, 保持 16:9
  const scale = size.width > 0 && size.height > 0
    ? Math.min(size.width / dataset.metadata.width, size.height / dataset.metadata.height)
    : 0;
  const stageWidth = dataset.metadata.width * scale;
  const stageHeight = dataset.metadata.height * scale;

  // Stage 居中
  const offsetX = (size.width - stageWidth) / 2;
  const offsetY = (size.height - stageHeight) / 2;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* 隐藏的真实 video 元素 — Konva.Image 从它读帧 */}
      <video
        ref={videoRef}
        src={dataset.video_src}
        muted
        playsInline
        loop
        autoPlay
        crossOrigin="anonymous"
        style={{ display: 'none' }}
        data-testid="review-video"
      />
      {scale > 0 && (
        <div
          style={{
            position: 'absolute',
            left: offsetX,
            top: offsetY,
            width: stageWidth,
            height: stageHeight,
          }}
        >
          <Stage
            ref={stageRef}
            width={stageWidth}
            height={stageHeight}
            onClick={(e) => {
              if (e.target === e.target.getStage()) selectTrack(null);
            }}
            data-testid="konva-stage"
          >
            <Layer listening={false}>
              <KonvaImage
                ref={imageNodeRef}
                width={stageWidth}
                height={stageHeight}
                listening={false}
              />
            </Layer>
            <BoxLayer
              videoWidth={dataset.metadata.width}
              videoHeight={dataset.metadata.height}
              currentTimeMs={currentTimeMs}
              scale={scale}
            />
          </Stage>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck`
Expected: 报错 — BoxLayer 还没实现的 props 不匹配。Task 2.7 实现。

- [ ] **Step 4: 暂时让 BoxLayer 接收正确 props 占位**

修改 `src/steps/Step4Review/BoxLayer.tsx`：

```tsx
interface BoxLayerProps {
  videoWidth: number;
  videoHeight: number;
  currentTimeMs: number;
  scale: number;
}

export function BoxLayer(_props: BoxLayerProps) {
  // Task 2.7 实现
  return null;
}
```

- [ ] **Step 5: typecheck 通过**

Run: `npm run typecheck`
Expected: 无报错。

- [ ] **Step 6: dev 验证**

启动 dev 并访问 `?step=4`：

- 看到深色容器内嵌入了画布区
- 因为视频是 30s 黑屏占位，画布看到黑色画面 + 左上角白色时间戳水印（这就是占位视频的内容，正常）
- 视频在循环播放（每 30s 重头开始）

(Ctrl+C 停止 dev)

- [ ] **Step 7: 提交**

```bash
git add src/steps/Step4Review/ReviewCanvas.tsx src/steps/Step4Review/BoxLayer.tsx
git commit -m "feat: ReviewCanvas with Konva Stage + video frame sync via watchVideoFrames"
```

---

### Task 2.7: BoxLayer — 渲染当前帧可见框

**Files:**
- Modify: `src/steps/Step4Review/BoxLayer.tsx`

> **设计依据:** spec §5.4.3 (visibleAnnotations) + §5.4.4 (颜色编码)。

- [ ] **Step 1: 写 src/steps/Step4Review/BoxLayer.tsx**

```tsx
import { useMemo } from 'react';
import { Layer, Group, Rect, Text, Label, Tag } from 'react-konva';
import { useDemoStore } from '../../store/demoStore';
import { findVisibleAtTime, interpolateBox } from '../../lib/interpolate';
import { tokens } from '../../styles/tokens';
import type { Annotation, ReviewStatus, BBox } from '../../types';

interface BoxLayerProps {
  videoWidth: number;
  videoHeight: number;
  currentTimeMs: number;
  scale: number;
}

interface BoxStyle {
  stroke: string;
  strokeWidth: number;
  fill: string;
  dash: number[] | undefined;
}

function getBoxStyle(ann: Annotation, isSelected: boolean): BoxStyle {
  const status: ReviewStatus = ann.review.status;
  const isFocus = ann.needs_review && status === 'pending';

  let s: BoxStyle;
  if (status === 'accepted') {
    s = { stroke: tokens.color.success[500], strokeWidth: 2, fill: 'rgba(16, 185, 129, 0.05)', dash: undefined };
  } else if (status === 'corrected') {
    s = { stroke: tokens.color.info[500], strokeWidth: 2, fill: 'rgba(59, 130, 246, 0.05)', dash: undefined };
  } else if (status === 'rejected') {
    // 不应渲染 (findVisibleAtTime 已过滤), 兜底
    s = { stroke: tokens.color.rejectedStroke, strokeWidth: 1.5, fill: 'transparent', dash: [4, 4] };
  } else if (isFocus) {
    s = { stroke: tokens.color.warning[500], strokeWidth: 2, fill: 'transparent', dash: undefined };
  } else {
    s = { stroke: tokens.color.neutral[400], strokeWidth: 1.5, fill: 'transparent', dash: undefined };
  }

  if (isSelected) {
    s = { ...s, strokeWidth: s.strokeWidth + 1 };
  }
  return s;
}

interface BoxItem {
  annotation: Annotation;
  // 视频坐标系下的 bbox
  videoCoords: BBox;
}

export function BoxLayer({ videoWidth, videoHeight, currentTimeMs, scale }: BoxLayerProps) {
  void videoWidth;
  void videoHeight; // currently unused; kept for future viewport math
  const annotations = useDemoStore((s) => s.annotations);
  const selectedTrackId = useDemoStore((s) => s.selectedTrackId);
  const selectTrack = useDemoStore((s) => s.selectTrack);

  const items: BoxItem[] = useMemo(() => {
    const visible = findVisibleAtTime(annotations, currentTimeMs);
    return visible.map((a) => ({
      annotation: a,
      videoCoords: interpolateBox(a.keyframes, currentTimeMs),
    }));
  }, [annotations, currentTimeMs]);

  return (
    <Layer>
      {items.map(({ annotation, videoCoords }) => {
        const [vx, vy, vw, vh] = videoCoords;
        const x = vx * scale;
        const y = vy * scale;
        const w = vw * scale;
        const h = vh * scale;
        const isSelected = selectedTrackId === annotation.track_id;
        const style = getBoxStyle(annotation, isSelected);
        const labelText = `${annotation.label_display}${
          annotation.confidence !== null ? ' ' + annotation.confidence.toFixed(2) : ''
        }`;

        return (
          <Group
            key={annotation.track_id}
            x={x}
            y={y}
            onClick={(e) => {
              e.cancelBubble = true;
              selectTrack(annotation.track_id);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              selectTrack(annotation.track_id);
            }}
            data-track-id={annotation.track_id}
          >
            <Rect
              width={w}
              height={h}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              fill={style.fill}
              {...(style.dash ? { dash: style.dash } : {})}
              cornerRadius={tokens.radius.sm}
              listening
              shadowColor={isSelected ? tokens.color.brand[500] : undefined}
              shadowBlur={isSelected ? 8 : 0}
              shadowOpacity={isSelected ? 0.4 : 0}
            />
            {/* Label 在框左上外侧 */}
            <Label x={0} y={-18} listening={false}>
              <Tag fill={style.stroke} cornerRadius={3} />
              <Text
                text={labelText}
                fontFamily="JetBrains Mono"
                fontSize={11}
                fill="#fff"
                padding={3}
              />
            </Label>
          </Group>
        );
      })}
    </Layer>
  );
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: 无报错。

- [ ] **Step 3: dev 验证**

启动 dev → http://localhost:5173/?step=4

- 看到画布上覆盖了一些标注框（30s 视频里 47 个框按时间分布出现）
- 重点项 trk_2 / trk_9 / trk_5 颜色是橙色（warning）
- 高置信框是浅灰色边框（neutral-400）
- 点击任一框 → 边框变粗 + 紫色发光 (selected)
- 点击画布空白处 → 取消选中

(Ctrl+C 停止)

- [ ] **Step 4: 提交**

```bash
git add src/steps/Step4Review/BoxLayer.tsx
git commit -m "feat: BoxLayer renders annotations with status-based colors and selection"
```

---

### Task 2.8: PropertyPanel — 当前选中框的属性 + ✓/✗ 大按钮

**Files:**
- Modify: `src/steps/Step4Review/PropertyPanel.tsx`

> **设计依据:** spec §5.4.5 + §6.7.1 — 大 CTA 按钮，A/D 键提示。

- [ ] **Step 1: 写 src/steps/Step4Review/PropertyPanel.tsx**

```tsx
import { useDemoStore } from '../../store/demoStore';
import { tokens } from '../../styles/tokens';
import type { Annotation, ReviewStatus } from '../../types';

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: '待审核',
  accepted: '已接受',
  corrected: '已纠正',
  rejected: '已否决',
};

export function PropertyPanel() {
  const selectedTrackId = useDemoStore((s) => s.selectedTrackId);
  const annotations = useDemoStore((s) => s.annotations);
  const acceptBox = useDemoStore((s) => s.acceptBox);
  const rejectBox = useDemoStore((s) => s.rejectBox);

  const selected: Annotation | null = selectedTrackId
    ? annotations.find((a) => a.track_id === selectedTrackId) ?? null
    : null;

  if (!selected) {
    return (
      <div data-testid="property-panel" style={{ display: 'flex', flexDirection: 'column', gap: tokens.space[3] }}>
        <Header text="审核" />
        <div style={{ color: tokens.color.neutral[500], fontSize: 13, lineHeight: 1.6 }}>
          点击画布上的标注框开始审核，或在底部队列里选择重点项。
        </div>
      </div>
    );
  }

  const conf = selected.confidence;
  const isLowConf = conf !== null && conf < 0.5;

  return (
    <div data-testid="property-panel" style={{ display: 'flex', flexDirection: 'column', gap: tokens.space[3] }}>
      <Header text={`审核 · ${selected.label_display} #${selected.track_id.replace('trk_', '')}`} />
      <div
        style={{
          padding: tokens.space[3],
          borderRadius: tokens.radius.md,
          background: isLowConf ? tokens.color.warning[50] : tokens.color.neutral[100],
          border: `1px solid ${isLowConf ? tokens.color.warning[500] : tokens.color.neutral[200]}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          fontSize: 13,
        }}
      >
        <Row label="标签" value={selected.label_display} />
        <Row label="来源" value={selected.source === 'machine' ? '机器' : '人工'} />
        <Row
          label="置信"
          value={
            <span className="tabular" style={{ fontFamily: tokens.color.neutral[700] }}>
              {conf === null ? '—' : conf.toFixed(2)}
              {isLowConf && ' ⚠'}
            </span>
          }
        />
        <Row label="状态" value={STATUS_LABEL[selected.review.status]} />
      </div>

      <button
        data-testid="btn-accept"
        onClick={() => acceptBox(selected.track_id)}
        style={primaryBtn(tokens.color.success[500])}
      >
        ✓ 接受 <Kbd k="A" />
      </button>
      <button
        data-testid="btn-reject"
        onClick={() => rejectBox(selected.track_id)}
        style={primaryBtn(tokens.color.neutral[500])}
      >
        ✗ 否决 <Kbd k="D" />
      </button>
      <div
        style={{
          marginTop: tokens.space[2],
          padding: tokens.space[3],
          borderRadius: tokens.radius.md,
          background: tokens.color.neutral[100],
          textAlign: 'center',
          fontSize: 12,
          color: tokens.color.neutral[500],
        }}
      >
        ↔ 拖角点改框
      </div>
    </div>
  );
}

function Header({ text }: { text: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: tokens.color.neutral[400],
      }}
    >
      {text}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: tokens.color.neutral[500] }}>{label}</span>
      <span style={{ color: tokens.color.neutral[700] }}>{value}</span>
    </div>
  );
}

function Kbd({ k }: { k: string }) {
  return (
    <span
      style={{
        marginLeft: tokens.space[2],
        padding: '2px 6px',
        borderRadius: tokens.radius.sm,
        background: 'rgba(255,255,255,0.25)',
        fontFamily: 'JetBrains Mono',
        fontSize: 11,
        fontWeight: 500,
      }}
    >
      {k}
    </span>
  );
}

function primaryBtn(bg: string): React.CSSProperties {
  return {
    height: 44,
    borderRadius: tokens.radius.md,
    background: bg,
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: tokens.shadow.sm,
  };
}
```

- [ ] **Step 2: dev 验证**

启动 dev → /?step=4 → 点击画布上一个标注框 → 右侧面板显示该框的 label / 来源 / 置信 + ✓ ✗ 大按钮。点击 ✓ → 框变绿，再点 ✗ → 框变灰虚线。

- [ ] **Step 3: 提交**

```bash
git add src/steps/Step4Review/PropertyPanel.tsx
git commit -m "feat: PropertyPanel with accept/reject CTA and selected annotation details"
```

---

### Task 2.9: Transformer — 拖框 8 控制点 + 回写 store

**Files:**
- Modify: `src/steps/Step4Review/ReviewCanvas.tsx` (添加 Transformer Layer)

> **设计依据:** spec §5.4.6 — 8 个控制点，onTransformEnd 把 scale 合并回 width/height 后回写 store.correctBoxGeometry()。

- [ ] **Step 1: 在 ReviewCanvas.tsx 引入 Transformer Layer**

替换 `<Stage>` 内部的 children 部分：

```tsx
import { Stage, Layer, Image as KonvaImage, Transformer } from 'react-konva';

// ... 在 Stage 外面 useEffect 同步 selected 节点到 transformer:

const transformerRef = useRef<Konva.Transformer>(null);

const correctBoxGeometry = useDemoStore((s) => s.correctBoxGeometry);
const selectedTrackId = useDemoStore((s) => s.selectedTrackId);
const annotations = useDemoStore((s) => s.annotations);

// 选中变化时, 把 transformer 挂到对应 Group
useEffect(() => {
  const tr = transformerRef.current;
  const stage = stageRef.current;
  if (!tr || !stage) return;
  if (!selectedTrackId) {
    tr.nodes([]);
    tr.getLayer()?.batchDraw();
    return;
  }
  const node = stage.findOne(`Group[data-track-id="${selectedTrackId}"]`);
  if (node) {
    tr.nodes([node]);
    tr.getLayer()?.batchDraw();
  } else {
    tr.nodes([]);
    tr.getLayer()?.batchDraw();
  }
}, [selectedTrackId, annotations, currentTimeMs]);
```

完整替换 `<Stage>` 部分为：

```tsx
<Stage
  ref={stageRef}
  width={stageWidth}
  height={stageHeight}
  onClick={(e) => {
    if (e.target === e.target.getStage()) selectTrack(null);
  }}
  data-testid="konva-stage"
>
  <Layer listening={false}>
    <KonvaImage
      ref={imageNodeRef}
      width={stageWidth}
      height={stageHeight}
      listening={false}
    />
  </Layer>
  <BoxLayer
    videoWidth={dataset.metadata.width}
    videoHeight={dataset.metadata.height}
    currentTimeMs={currentTimeMs}
    scale={scale}
  />
  <Layer>
    <Transformer
      ref={transformerRef}
      rotateEnabled={false}
      enabledAnchors={[
        'top-left', 'top-right', 'bottom-left', 'bottom-right',
        'middle-left', 'middle-right', 'top-center', 'bottom-center',
      ]}
      anchorSize={8}
      anchorStroke={tokens.color.warning[500]}
      anchorFill="white"
      borderStroke="transparent"
      onTransformEnd={(e) => {
        const node = e.target;
        if (!selectedTrackId) return;
        const ann = annotations.find((a) => a.track_id === selectedTrackId);
        if (!ann) return;

        // 找到当前帧对应的 keyframe index (取最近的关键帧, 用 timestamp_ms)
        let frameIdx = 0;
        let minDiff = Infinity;
        ann.keyframes.forEach((kf, i) => {
          const diff = Math.abs(kf.timestamp_ms - currentTimeMs);
          if (diff < minDiff) {
            minDiff = diff;
            frameIdx = i;
          }
        });

        // 节点的 x/y/width/height 是 Konva 坐标 (已 scale), 还原回视频坐标
        const newX = node.x() / scale;
        const newY = node.y() / scale;
        const newW = (node.width() * node.scaleX()) / scale;
        const newH = (node.height() * node.scaleY()) / scale;

        // 重置 scale, 防止下次再次 transform 累积
        node.scaleX(1);
        node.scaleY(1);
        node.width(newW * scale);
        node.height(newH * scale);

        correctBoxGeometry(selectedTrackId, frameIdx, [
          Math.round(newX),
          Math.round(newY),
          Math.round(newW),
          Math.round(newH),
        ]);
      }}
    />
  </Layer>
</Stage>
```

注意：Konva Group 默认无 width/height 属性（因为 BoxLayer 里的 Group 本身没设 width/height，只是它的子 Rect 有 width/height）。Transformer 的 transform 会作用到选中节点上。这里需要让 BoxLayer 的 Group 暴露 width/height，让 Transformer 的 8 控制点找到边界。

修改 `src/steps/Step4Review/BoxLayer.tsx` 的 `<Group>`：

```tsx
<Group
  key={annotation.track_id}
  x={x}
  y={y}
  width={w}
  height={h}
  draggable={isSelected}   // 选中时可拖动
  onClick={(e) => {
    e.cancelBubble = true;
    selectTrack(annotation.track_id);
  }}
  // ...
>
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: 无报错。

- [ ] **Step 3: dev 验证**

启动 dev → /?step=4 → 点击 trk_2 框 → 看到 8 个白色控制点出现在框四周 → 拖动右下角控制点放大框 → 松开后框变蓝色 (corrected) → 右侧属性面板显示「来源: 人工」「状态: 已纠正」。

- [ ] **Step 4: 提交**

```bash
git add src/steps/Step4Review/ReviewCanvas.tsx src/steps/Step4Review/BoxLayer.tsx
git commit -m "feat: Transformer with 8 anchors writes back to store via correctBoxGeometry"
```

---

### Task 2.10: 键盘快捷键 A / D / Ctrl+Z / ←/→

**Files:**
- Modify: `src/steps/Step4Review/keyboard.ts`

> **设计依据:** spec §7.1.x + 决策: A/D 必保留, Ctrl+Z 单步撤销, ←/→ 切换队列重点项。

- [ ] **Step 1: 写 src/steps/Step4Review/keyboard.ts**

```ts
import { useEffect } from 'react';
import { useDemoStore } from '../../store/demoStore';
import { getDataset } from '../../data';

/**
 * Step 4 审核步骤的键盘快捷键。
 *
 * - A: 接受当前选中框
 * - D: 否决当前选中框
 * - Ctrl/Cmd+Z: 撤销
 * - ←: 上一重点项
 * - →: 下一重点项
 */
export function useReviewKeyboard() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 输入框/select 内不响应 (避免与文本编辑冲突)
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      const store = useDemoStore.getState();
      if (store.demoStep !== 4) return; // 只在 Step 4 生效

      const focusIds = getDataset(store.activeDatasetId).demo_script.review_focus_ids;

      // Ctrl/Cmd+Z 撤销
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        store.undo();
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'a': {
          if (store.selectedTrackId) {
            e.preventDefault();
            store.acceptBox(store.selectedTrackId);
            // 自动选中下一个 pending 重点项
            advanceToNextFocus(focusIds);
          }
          break;
        }
        case 'd': {
          if (store.selectedTrackId) {
            e.preventDefault();
            store.rejectBox(store.selectedTrackId);
            advanceToNextFocus(focusIds);
          }
          break;
        }
        case 'arrowleft': {
          e.preventDefault();
          const newIdx = Math.max(0, store.reviewQueueIndex - 1);
          store.setReviewQueueIndex(newIdx);
          const id = focusIds[newIdx];
          if (id) store.selectTrack(id);
          break;
        }
        case 'arrowright': {
          e.preventDefault();
          const newIdx = Math.min(focusIds.length - 1, store.reviewQueueIndex + 1);
          store.setReviewQueueIndex(newIdx);
          const id = focusIds[newIdx];
          if (id) store.selectTrack(id);
          break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}

function advanceToNextFocus(focusIds: string[]) {
  const store = useDemoStore.getState();
  // 从当前 reviewQueueIndex 之后找第一个仍 pending 的 focus
  const annotations = store.annotations;
  for (let i = store.reviewQueueIndex + 1; i < focusIds.length; i++) {
    const id = focusIds[i]!;
    const ann = annotations.find((a) => a.track_id === id);
    if (ann && ann.review.status === 'pending') {
      store.setReviewQueueIndex(i);
      store.selectTrack(id);
      return;
    }
  }
  // 全部裁决完 → 取消选中
  store.selectTrack(null);
}
```

- [ ] **Step 2: 写 tests/keyboard.test.ts (单元测试 store action 联动)**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDemoStore } from '@/store/demoStore';
import { useReviewKeyboard } from '@/steps/Step4Review/keyboard';

function fire(key: string, opts: { ctrlKey?: boolean; metaKey?: boolean } = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, ...opts, bubbles: true }));
}

describe('useReviewKeyboard', () => {
  beforeEach(() => {
    useDemoStore.getState().selectDataset('city-road');
    useDemoStore.getState().goToStep(4);
  });

  it('A accepts the selected track', () => {
    renderHook(() => useReviewKeyboard());
    useDemoStore.getState().selectTrack('trk_2');
    fire('a');
    const ann = useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_2')!;
    expect(ann.review.status).toBe('accepted');
  });

  it('D rejects the selected track', () => {
    renderHook(() => useReviewKeyboard());
    useDemoStore.getState().selectTrack('trk_5');
    fire('d');
    const ann = useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_5')!;
    expect(ann.review.status).toBe('rejected');
  });

  it('Ctrl+Z undoes the last action', () => {
    renderHook(() => useReviewKeyboard());
    useDemoStore.getState().selectTrack('trk_2');
    useDemoStore.getState().acceptBox('trk_2');
    expect(useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_2')!.review.status).toBe('accepted');
    fire('z', { ctrlKey: true });
    expect(useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_2')!.review.status).toBe('pending');
  });

  it('does not act when not on Step 4', () => {
    renderHook(() => useReviewKeyboard());
    useDemoStore.getState().goToStep(1);
    useDemoStore.getState().selectTrack('trk_2');
    fire('a');
    const ann = useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_2')!;
    expect(ann.review.status).toBe('pending');
  });

  it('ArrowRight advances reviewQueueIndex and selects next focus', () => {
    renderHook(() => useReviewKeyboard());
    useDemoStore.getState().setReviewQueueIndex(0);
    fire('ArrowRight');
    expect(useDemoStore.getState().reviewQueueIndex).toBe(1);
    expect(useDemoStore.getState().selectedTrackId).toBe('trk_9');
  });

  it('A advances to next pending focus after acceptance', () => {
    renderHook(() => useReviewKeyboard());
    useDemoStore.getState().selectTrack('trk_2');
    useDemoStore.getState().setReviewQueueIndex(0);
    fire('a');
    expect(useDemoStore.getState().selectedTrackId).toBe('trk_9');
  });
});
```

- [ ] **Step 3: 运行测试**

Run: `npm run test:run -- tests/keyboard.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 4: 提交**

```bash
git add src/steps/Step4Review/keyboard.ts tests/keyboard.test.ts
git commit -m "feat: Step4 keyboard shortcuts (A/D/Ctrl+Z/Arrows) with auto-advance"
```

---

## Day 3: 队列轨道 + 「一键全部接受」 + 集成测试

### Task 3.1: QueueTrack — 底部横向重点项轨道

**Files:**
- Modify: `src/steps/Step4Review/QueueTrack.tsx`

> **设计依据:** spec §5.4.5 — 80px 高横向轨道，3 张重点项卡片 + 「一键全部接受 (44)」按钮。

- [ ] **Step 1: 写 src/steps/Step4Review/QueueTrack.tsx**

```tsx
import { useDemoStore } from '../../store/demoStore';
import { getDataset } from '../../data';
import { tokens } from '../../styles/tokens';
import type { Annotation, ReviewStatus } from '../../types';

const STATUS_COLOR: Record<ReviewStatus, string> = {
  pending: tokens.color.warning[500],
  accepted: tokens.color.success[500],
  corrected: tokens.color.info[500],
  rejected: tokens.color.rejectedStroke,
};

export function QueueTrack() {
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const annotations = useDemoStore((s) => s.annotations);
  const selectedTrackId = useDemoStore((s) => s.selectedTrackId);
  const selectTrack = useDemoStore((s) => s.selectTrack);
  const setReviewQueueIndex = useDemoStore((s) => s.setReviewQueueIndex);
  const acceptAllRemaining = useDemoStore((s) => s.acceptAllRemaining);

  const dataset = getDataset(datasetId);
  const focusIds = dataset.demo_script.review_focus_ids;
  const focusItems: Annotation[] = focusIds
    .map((id) => annotations.find((a) => a.track_id === id))
    .filter((x): x is Annotation => Boolean(x));

  const allFocusReviewed = focusItems.every((a) => a.review.status !== 'pending');
  const remainingPending = annotations.filter((a) => a.review.status === 'pending' && !focusIds.includes(a.track_id));
  const acceptAllDisabled = !allFocusReviewed || remainingPending.length === 0;

  return (
    <div
      data-testid="queue-track"
      style={{
        height: 80,
        display: 'flex',
        alignItems: 'center',
        gap: tokens.space[3],
        padding: `0 ${tokens.space[3]}px`,
        background: tokens.color.neutral[100],
        borderRadius: tokens.radius.md,
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: tokens.color.neutral[500],
          flexShrink: 0,
          minWidth: 70,
        }}
      >
        队列 {focusItems.filter((a) => a.review.status !== 'pending').length}/{focusItems.length}
      </div>

      <div style={{ display: 'flex', gap: tokens.space[2], flex: 1 }}>
        {focusItems.map((ann, idx) => {
          const isCurrent = selectedTrackId === ann.track_id;
          const reviewed = ann.review.status !== 'pending';
          const statusColor = STATUS_COLOR[ann.review.status];
          return (
            <button
              key={ann.track_id}
              data-testid={`queue-card-${ann.track_id}`}
              onClick={() => {
                selectTrack(ann.track_id);
                setReviewQueueIndex(idx);
              }}
              style={{
                width: 130,
                height: 60,
                borderRadius: tokens.radius.md,
                background: tokens.color.neutral[0],
                border: `2px solid ${isCurrent ? 'transparent' : tokens.color.neutral[200]}`,
                backgroundImage: isCurrent ? tokens.brandGradient : undefined,
                color: isCurrent ? '#fff' : tokens.color.neutral[700],
                cursor: 'pointer',
                padding: tokens.space[2],
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                textAlign: 'left',
                opacity: reviewed && !isCurrent ? 0.6 : 1,
                boxShadow: isCurrent ? tokens.shadow.brand : 'none',
                position: 'relative',
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 600 }}>
                {ann.label_display} #{ann.track_id.replace('trk_', '')}
                {isCurrent && <span style={{ marginLeft: 6 }}>◀</span>}
              </div>
              <div className="tabular" style={{ fontSize: 11 }}>
                conf {ann.confidence?.toFixed(2) ?? '—'}
              </div>
              {reviewed && (
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    right: 6,
                    top: 6,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: statusColor,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      <button
        data-testid="accept-all-remaining"
        onClick={() => acceptAllRemaining()}
        disabled={acceptAllDisabled}
        style={{
          height: 44,
          padding: `0 ${tokens.space[4]}px`,
          borderRadius: tokens.radius.md,
          background: acceptAllDisabled ? tokens.color.neutral[200] : 'transparent',
          backgroundImage: acceptAllDisabled ? undefined : tokens.brandGradient,
          color: acceptAllDisabled ? tokens.color.neutral[400] : '#fff',
          border: 'none',
          fontSize: 13,
          fontWeight: 600,
          cursor: acceptAllDisabled ? 'not-allowed' : 'pointer',
          boxShadow: acceptAllDisabled ? 'none' : tokens.shadow.brand,
          flexShrink: 0,
        }}
      >
        一键全部接受 ({remainingPending.length})
      </button>
    </div>
  );
}
```

- [ ] **Step 2: dev 验证**

启动 dev → /?step=4

- 底部出现一条 80px 灰色轨道
- 3 张重点项卡片显示 trk_2 / trk_9 / trk_5（按 review_focus_ids 顺序）
- 当前选中的卡片是渐变紫蓝色背景
- 「一键全部接受 (44)」按钮在最右，**当前置灰**（因为还有重点项 pending）
- 点击 trk_2 卡片 → 它变紫色 + 画布上对应框被选中 + 右属性面板显示
- 按 A → trk_2 变绿（已接受）+ 自动跳到 trk_9
- 三个重点项处理完后，「一键全部接受」按钮亮起 → 点击 → 剩余 44 个框全变绿

- [ ] **Step 3: 提交**

```bash
git add src/steps/Step4Review/QueueTrack.tsx
git commit -m "feat: QueueTrack with focus cards and accept-all-remaining button"
```

---

### Task 3.2: 验证 Step 4 完整流程的 store 一致性 (集成测试)

**Files:**
- Create: `tests/Step4Review.test.tsx`

> **设计依据:** CLAUDE.md 第 2 条硬约束 — 审核改动必须真实回写到 store。这个集成测试模拟用户操作 + 检查 store 状态，是 spec §7.1.2 的 hard constraint #2 测试。

- [ ] **Step 1: 写 tests/Step4Review.test.tsx**

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Step4Review } from '@/steps/Step4Review';
import { useDemoStore } from '@/store/demoStore';

// Mock react-konva: jsdom 没 canvas, react-konva 在 jsdom 里渲染会出错
// 用一个 stub 让 BoxLayer / ReviewCanvas 不渲染 Konva, 但 PropertyPanel / QueueTrack / 键盘 hook 仍可测
vi.mock('react-konva', () => ({
  Stage: ({ children }: { children: React.ReactNode }) => <div data-testid="konva-stage-mock">{children}</div>,
  Layer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Rect: () => null,
  Image: () => null,
  Text: () => null,
  Label: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tag: () => null,
  Transformer: () => null,
}));

// Mock ResizeObserver (jsdom 不支持)
class ROStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = ROStub;

describe('Step4Review integration', () => {
  beforeEach(() => {
    useDemoStore.getState().selectDataset('city-road');
    useDemoStore.getState().goToStep(4);
  });

  it('clicking queue card selects the track in store', async () => {
    const user = userEvent.setup();
    render(<Step4Review />);
    const card = screen.getByTestId('queue-card-trk_2');
    await user.click(card);
    expect(useDemoStore.getState().selectedTrackId).toBe('trk_2');
  });

  it('clicking accept button writes review.status=accepted to store', async () => {
    const user = userEvent.setup();
    render(<Step4Review />);
    await user.click(screen.getByTestId('queue-card-trk_2'));
    await user.click(screen.getByTestId('btn-accept'));
    const ann = useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_2')!;
    expect(ann.review.status).toBe('accepted');
    expect(useDemoStore.getState().dirty).toBe(true);
  });

  it('clicking reject button writes review.status=rejected', async () => {
    const user = userEvent.setup();
    render(<Step4Review />);
    await user.click(screen.getByTestId('queue-card-trk_5'));
    await user.click(screen.getByTestId('btn-reject'));
    const ann = useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_5')!;
    expect(ann.review.status).toBe('rejected');
  });

  it('accept-all-remaining is disabled when focus items still pending', () => {
    render(<Step4Review />);
    const btn = screen.getByTestId('accept-all-remaining') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('accept-all-remaining is enabled after all focus items reviewed', async () => {
    const user = userEvent.setup();
    render(<Step4Review />);
    useDemoStore.getState().acceptBox('trk_2');
    useDemoStore.getState().correctBoxGeometry('trk_9', 0, [100, 200, 300, 400]);
    useDemoStore.getState().rejectBox('trk_5');

    // 重新渲染拿最新 disabled
    render(<Step4Review />);
    const btns = screen.getAllByTestId('accept-all-remaining') as HTMLButtonElement[];
    const last = btns[btns.length - 1]!;
    expect(last.disabled).toBe(false);

    await user.click(last);
    const remaining = useDemoStore.getState().annotations.filter((a) => a.review.status === 'pending');
    expect(remaining.length).toBe(0);
  });

  it('full review flow: 3 focus + accept all → store reflects every change', async () => {
    const user = userEvent.setup();
    render(<Step4Review />);
    // 1. trk_2 接受
    await user.click(screen.getByTestId('queue-card-trk_2'));
    await user.click(screen.getByTestId('btn-accept'));
    // 2. trk_9 (模拟 transform — 直接调 store action)
    useDemoStore.getState().correctBoxGeometry('trk_9', 0, [100, 200, 300, 400]);
    // 3. trk_5 否决
    await user.click(screen.getByTestId('queue-card-trk_5'));
    await user.click(screen.getByTestId('btn-reject'));
    // 4. 一键剩余
    expect(useDemoStore.getState().canAdvanceFromStep4()).toBe(true);
    useDemoStore.getState().acceptAllRemaining();

    const stats = {
      accepted: 0, corrected: 0, rejected: 0, pending: 0,
    };
    useDemoStore.getState().annotations.forEach((a) => {
      stats[a.review.status]++;
    });
    expect(stats.pending).toBe(0);
    expect(stats.rejected).toBe(1);
    expect(stats.corrected).toBe(1);
    expect(stats.accepted).toBe(45);  // 47 - 1 rejected - 1 corrected
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `npm run test:run -- tests/Step4Review.test.tsx`
Expected: PASS (6 tests)

如果有失败：

- "ResizeObserver not defined" → 检查 `globalThis.ResizeObserver = ROStub` 是否在 import 之前 (vi.mock 提前)
- "react-konva ... cannot read properties of null" → mock 是否在文件最顶部

- [ ] **Step 3: 提交**

```bash
git add tests/Step4Review.test.tsx
git commit -m "test: Step4Review integration — store reflects all review actions"
```

---

### Task 3.3: 性能确认 — 拖框 50fps + 重置 < 200ms (跑 Day 1 已写的 perf 测试)

- [ ] **Step 1: 跑全部测试**

Run: `npm run test:run`
Expected: 所有测试绿色，包括之前的 perf.test.ts。

- [ ] **Step 2: 手动 dev 验证拖框流畅度**

启动 dev → /?step=4 → Chrome DevTools → Performance → 录制 3 秒拖框过程 → 停止 → 看 FPS 曲线。

预期: 帧率 ≥ 50fps（拖框时帧率会略降但应保持在 50+）。如果低于 30fps，检查 Konva Layer 是否分了 3 层（Layer 列表外可能漏了 listening={false} 让视频底图层在拖框时也被命中检测）。

- [ ] **Step 3: 给 Konva Image Layer 加 listening={false} (优化)**

确认 ReviewCanvas.tsx 里：

```tsx
<Layer listening={false}>
  <KonvaImage ... listening={false} />
</Layer>
```

视频层不参与命中检测，拖框时跳过该层的事件分发，性能更好。

- [ ] **Step 4: 跑构建检查体积**

Run: `npm run build`
Expected: dist 总体积 < 1MB (无视频字体不含真实视频)。`du -sh dist/` 输出 800KB-1.5MB 之间正常（含 Konva 120KB + 占位视频 ~300-500KB）。

- [ ] **Step 5: 提交（如有改动）**

```bash
git add -u
git diff --cached --quiet || git commit -m "perf: ensure Konva video layer has listening=false for drag performance"
```

(如果没改动，跳过这步)

---

### Task 3.4: Day 2-3 验收 + 提交 tag

- [ ] **Step 1: 全部测试绿色**

Run: `npm run test:run`
Expected: 所有测试通过 (~40+ tests)。

- [ ] **Step 2: typecheck 干净**

Run: `npm run typecheck`
Expected: 无报错。

- [ ] **Step 3: build 通过**

Run: `npm run build`

- [ ] **Step 4: dev 端到端走查（手动）**

启动 dev → /?step=4

按以下顺序操作并验证:

1. ✅ 看到 47 个标注框分布在画布上
2. ✅ 重点项 trk_2 (橙色) / trk_9 (橙色) / trk_5 (橙色)
3. ✅ 点击 trk_2 → 选中态 + 右面板显示
4. ✅ 按 A → trk_2 变绿 + 自动选中 trk_9
5. ✅ 在 trk_9 上拖右下角控制点 → 框变蓝 + 右面板显示「人工/已纠正」
6. ✅ 选中 trk_5 → 按 D → 框变灰虚线 + 淡出
7. ✅ 「一键全部接受」按钮亮起 → 点击 → 44 个高置信框集体变绿
8. ✅ 按 Ctrl+Z → 最近一次操作被撤销
9. ✅ 点 ↺ 重置 → 所有框恢复初始状态 + 仍在 step 4 (注意: 这跟 spec 不一致, 因为目前重置是回 step 1 的, 应该回 step 1)

注: 第 9 项问题说明: spec §2.2.1 reset 应该回到 step 1。我们当前 store.reset() 实现里 `demoStep` 来自 `createSnapshot('city-road')` 默认是 1, 应该正确。但因为我们在第 9 项前还没退出 step 4, 重置后应跳回 step 1。验证一下 — URL 里的 ?step=4 在 reset 后会被 useUrlParams 重新触发吗?

useUrlParams 用 useEffect [] 一次性, reset 后不会再读 URL。所以重置后会回到 store.demoStep === 1。✅ 行为正确。

- [ ] **Step 5: 提交 tag**

```bash
git tag day2-3-review-complete
```

---

## Day 2-3 验收清单

至此 Day 2-3 应满足：

- ✅ Chrome 层骨架（TopBar + StepPills + DemoControls 占位）
- ✅ App 路由（基于 demoStep 切换 5 个步骤视图）
- ✅ URL 参数 `?step=N&speed=...&dataset=...` 开发期支持
- ✅ < 1280px 显示宽屏遮罩
- ✅ requestVideoFrameCallback 兼容包装 (含 jsdom 安全)
- ✅ bbox 关键帧线性插值
- ✅ Step4Review 主视图布局（中央画布 + 底部队列 + 右属性面板）
- ✅ ReviewCanvas Konva Stage 三层（视频底图 / 框 / Transformer）
- ✅ 视频帧用 watchVideoFrames 同步到 Konva.Image
- ✅ BoxLayer 渲染 47 个框 + 颜色编码（pending 橙 / accepted 绿 / corrected 蓝 / rejected 灰虚线）
- ✅ 选中态（粗边 + brand 外发光）
- ✅ Transformer 8 控制点 + onTransformEnd 回写 store.correctBoxGeometry
- ✅ PropertyPanel 当前框属性 + ✓/✗ 大按钮
- ✅ 键盘 A / D / Ctrl+Z / ←/→ 全部命中 store action
- ✅ 「一键全部接受 (44)」按钮（防呆置灰逻辑）
- ✅ Step4Review 集成测试（6+ 用例覆盖核心流程）
- ✅ 拖框性能 ≥ 50fps（手动验证 + Konva listening 分层优化）
- ✅ 重置 < 200ms（已被 perf.test.ts 守护）
- ✅ 全部单测绿色，typecheck 干净，build 通过

**核心硬约束验证**：

- ✅ CLAUDE.md 第 2 条（审核改动回写 store）— Step4Review.test.tsx 集成测试守护
- ✅ CLAUDE.md 第 3 条（重置深拷贝）— Day 1 store.test.ts 守护
- ✅ CLAUDE.md 第 5 条（审核是唯一真交互）— 其他步骤还是占位，没有逻辑可违反
