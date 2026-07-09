# Day 6 实施计划 · 控制条联动 + 自动模式 + 虚拟主讲

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**前置:** Day 1-5 已完成（5 步骤视图 + 导出 + 副样例都通了）。

**Goal:** 把 Day 2-3 留下的 ⏵/⏸/⏭ 控制按钮真正接上，实现「自动演示模式」整体编排：自动按节奏推进 step 1→2→3 揭示动画，进 step 4 时切换到「虚拟主讲」自动裁决三动作（接受/改框/否决）→ 一键全部接受 → 自动进 step 5。任意鼠标/键盘点击立即接管。

**Architecture:** 引入一个 `useDemoOrchestrator()` hook 监听 `playMode`/`demoStep` 变化，编排各步骤的进入/退出行为。Step 4 的虚拟主讲是独立组件 `VirtualPresenter`，挂在 Step4Review 内部、仅在 `playMode === 'auto'` 时渲染。中断检测用全局 mousedown/keydown 监听器（控制条按钮点击除外）。

**关键产出文件:**
- `src/store/demoStore.ts` (扩展: 「客户接管」action `userTakeover`)
- `src/lib/animation/orchestrator.ts` (跨步骤编排策略)
- `src/chrome/DemoControls.tsx` (重写: ▶ ⏸ ⏭ 真接入)
- `src/chrome/AutoModeBadge.tsx` (右属性面板顶部「🎬 演示模式」角标)
- `src/steps/Step4Review/VirtualPresenter.tsx`
- `src/steps/Step4Review/index.tsx` (集成 VirtualPresenter)
- `src/App.tsx` (挂载 useDemoOrchestrator + 全局接管监听)
- `tests/orchestrator.test.ts`
- `tests/VirtualPresenter.test.tsx`

---

## File Structure

```
src/
├── store/demoStore.ts                  ← 扩展: userTakeover action
├── lib/animation/
│   └── orchestrator.ts                 ← stepEnter/stepExit/intoAuto 编排
├── chrome/
│   ├── DemoControls.tsx                ← 重写
│   └── AutoModeBadge.tsx               ← 自动模式角标
├── steps/Step4Review/
│   ├── VirtualPresenter.tsx            ← 虚拟主讲: 三动作裁决
│   └── index.tsx                       ← 集成 badge + presenter
└── App.tsx                             ← orchestrator hook + 接管监听
```

---

## Day 6: 控制条 + 自动模式 + 虚拟主讲

### Task 6.1: store 扩展 `userTakeover` action

**Files:**
- Modify: `src/store/demoStore.ts`
- Modify: `tests/store.test.ts`

> **设计依据:** spec §3.4 — 任意鼠标/键盘 → 切换 playMode 为 manual + cancel 当前 timeline + 保留已发生的改动。

- [ ] **Step 1: 在 demoStore.ts 的 DemoStore interface 加 `userTakeover`**

```ts
export interface DemoStore extends Snapshot {
  // ... 已有 actions
  userTakeover: () => void;
}
```

- [ ] **Step 2: 实现 action**

```ts
userTakeover: () =>
  set((s) => {
    if (s.playMode === 'auto') {
      s.playMode = 'manual';
      s.paused = false;
    }
  }),
```

- [ ] **Step 3: 写测试 (在 tests/store.test.ts 末尾追加)**

```ts
describe('userTakeover', () => {
  beforeEach(() => {
    useDemoStore.getState().selectDataset('city-road');
  });

  it('switches auto to manual', () => {
    useDemoStore.getState().togglePlayMode();
    expect(useDemoStore.getState().playMode).toBe('auto');
    useDemoStore.getState().userTakeover();
    expect(useDemoStore.getState().playMode).toBe('manual');
  });

  it('is no-op when already manual', () => {
    expect(useDemoStore.getState().playMode).toBe('manual');
    useDemoStore.getState().userTakeover();
    expect(useDemoStore.getState().playMode).toBe('manual');
  });

  it('clears paused flag', () => {
    useDemoStore.getState().togglePlayMode();
    useDemoStore.getState().pause();
    expect(useDemoStore.getState().paused).toBe(true);
    useDemoStore.getState().userTakeover();
    expect(useDemoStore.getState().paused).toBe(false);
  });
});
```

- [ ] **Step 4: typecheck + 测试**

```bash
npm run typecheck
npm run test:run -- tests/store.test.ts
```

Expected: 全绿。

- [ ] **Step 5: 提交**

```bash
git add src/store/demoStore.ts tests/store.test.ts
git commit -m "feat: store userTakeover action — switches auto→manual"
```

---

### Task 6.2: 编排器 orchestrator

**Files:**
- Create: `src/lib/animation/orchestrator.ts`
- Create: `tests/orchestrator.test.ts`

> **设计依据:** spec §3.1 状态机图 — 自动模式从 idle 向后推进，但 step 4 进入时**不自动**做事 (Step 4 内的 VirtualPresenter 自己接管自动逻辑)。本文件只管 step 1→2→3→4 的进入条件 + step 5 的「下载完弹 done」。

- [ ] **Step 1: 写 src/lib/animation/orchestrator.ts**

```ts
/**
 * 跨步骤的自动演示编排策略。
 *
 * 设计取舍:
 *   - Step 1 (上传): 自动模式下 1.5s 后选 city-road 自动进 Step 2
 *   - Step 2 (元信息): 视图自身定时器跑完后自动 goToStep(3) — 已在 Step2Metadata/index.tsx 实现
 *   - Step 3 (推理): 视图自身揭示完 + 1.5s 缓冲后 goToStep(4) — 已实现
 *   - Step 4 (审核): 自动模式下进入时启动 VirtualPresenter — 在 Step4Review/index.tsx 集成
 *   - Step 5 (导出): 自动模式下进入时不自动下载 (那是破坏性操作, 不应自动触发)
 *
 * 因此 orchestrator hook 真正"主动"做的事只有:
 *   - playMode 从 manual → auto 时, 如果当前在 step 1 且没选样例, 自动进 step 2
 *   - 这里也是「manual 重置后 → 重新开 auto」的入口
 *
 * 各步骤内部的自动推进逻辑保留在各自视图里, 因为他们最知道自己的揭示动画时长。
 */

import { useEffect } from 'react';
import { useDemoStore } from '../../store/demoStore';
import { applySpeed } from './speed';

export function useDemoOrchestrator() {
  const playMode = useDemoStore((s) => s.playMode);
  const demoStep = useDemoStore((s) => s.demoStep);
  const speed = useDemoStore((s) => s.speed);
  const goToStep = useDemoStore((s) => s.goToStep);

  useEffect(() => {
    // 进入 auto + 当前在 step 1 → 1.5s 后自动进 step 2 (沿用当前 dataset)
    if (playMode === 'auto' && demoStep === 1) {
      const t = setTimeout(() => {
        // 重新读 store, 防止此期间用户已切回 manual
        const cur = useDemoStore.getState();
        if (cur.playMode === 'auto' && cur.demoStep === 1) {
          goToStep(2);
        }
      }, applySpeed(1500, speed));
      return () => clearTimeout(t);
    }
    return undefined;
  }, [playMode, demoStep, speed, goToStep]);
}
```

- [ ] **Step 2: 写 tests/orchestrator.test.ts**

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDemoStore } from '@/store/demoStore';
import { useDemoOrchestrator } from '@/lib/animation/orchestrator';

describe('useDemoOrchestrator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useDemoStore.getState().selectDataset('city-road');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto + step 1 → goToStep(2) after 1.5s', () => {
    renderHook(() => useDemoOrchestrator());
    useDemoStore.getState().togglePlayMode();
    expect(useDemoStore.getState().demoStep).toBe(1);
    vi.advanceTimersByTime(1600);
    expect(useDemoStore.getState().demoStep).toBe(2);
  });

  it('does nothing when manual', () => {
    renderHook(() => useDemoOrchestrator());
    expect(useDemoStore.getState().playMode).toBe('manual');
    vi.advanceTimersByTime(2000);
    expect(useDemoStore.getState().demoStep).toBe(1);
  });

  it('does not advance if user takes over before timer', () => {
    renderHook(() => useDemoOrchestrator());
    useDemoStore.getState().togglePlayMode();
    vi.advanceTimersByTime(500);
    useDemoStore.getState().userTakeover();
    vi.advanceTimersByTime(2000);
    expect(useDemoStore.getState().demoStep).toBe(1);
  });

  it('respects 2x speed', () => {
    useDemoStore.getState().setSpeed('2x');
    renderHook(() => useDemoOrchestrator());
    useDemoStore.getState().togglePlayMode();
    vi.advanceTimersByTime(800); // 1500ms × 0.5 = 750ms
    expect(useDemoStore.getState().demoStep).toBe(2);
  });
});
```

- [ ] **Step 3: 测试通过 + 提交**

```bash
npm run test:run -- tests/orchestrator.test.ts
git add src/lib/animation/orchestrator.ts tests/orchestrator.test.ts
git commit -m "feat: useDemoOrchestrator — auto-advance step 1→2 after 1.5s"
```

---

### Task 6.3: DemoControls 重写 — ▶/⏸/⏭ 真接入

**Files:**
- Modify: `src/chrome/DemoControls.tsx`

> **设计依据:** spec §3.2 控制条按钮行为表。

- [ ] **Step 1: 重写 src/chrome/DemoControls.tsx**

```tsx
import { useDemoStore } from '../../store/demoStore';
import { tokens } from '../../styles/tokens';
import { Play, Pause, SkipForward, RotateCcw } from 'lucide-react';
import type { Speed } from '../../types';

const SPEEDS: { id: Speed; label: string }[] = [
  { id: '1x', label: '1×' },
  { id: '2x', label: '2×' },
  { id: 'instant', label: '即时' },
];

export function DemoControls() {
  const playMode = useDemoStore((s) => s.playMode);
  const paused = useDemoStore((s) => s.paused);
  const speed = useDemoStore((s) => s.speed);
  const demoStep = useDemoStore((s) => s.demoStep);
  const dirty = useDemoStore((s) => s.dirty);
  const togglePlayMode = useDemoStore((s) => s.togglePlayMode);
  const pause = useDemoStore((s) => s.pause);
  const resume = useDemoStore((s) => s.resume);
  const setSpeed = useDemoStore((s) => s.setSpeed);
  const reset = useDemoStore((s) => s.reset);
  const goToStep = useDemoStore((s) => s.goToStep);
  const canAdvance = useDemoStore((s) => s.canAdvanceFromStep4);

  const isAutoActive = playMode === 'auto' && !paused;

  // ▶/⏸ 切换
  const handlePlayPause = () => {
    if (playMode === 'manual') {
      togglePlayMode(); // → auto
      return;
    }
    if (paused) resume();
    else pause();
  };

  // ⏭ 下一步: 立即推进
  // - step 1 (默认 city-road) → step 2
  // - step 2/3: 跳过揭示 (step 2/3 视图会响应 demoStep 变化, 但揭示动画自己有定时器, 这里直接强推 demoStep)
  // - step 4: 若 canAdvance → step 5; 否则置灰 (按钮 disabled 处理)
  // - step 5: 不响应 (已是终点)
  const nextDisabled = (() => {
    if (demoStep === 5) return true;
    if (demoStep === 4 && !canAdvance()) return true;
    return false;
  })();

  const handleNext = () => {
    if (nextDisabled) return;
    if (demoStep < 5) {
      goToStep((demoStep + 1) as 1 | 2 | 3 | 4 | 5);
    }
  };

  const handleReset = () => {
    if (dirty) {
      const ok = window.confirm('重置将清空当前演示进度？');
      if (!ok) return;
    }
    reset();
  };

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: tokens.space[2] }}
      data-testid="demo-controls"
      data-control-bar="true"  /* orchestrator 接管检测会读它 */
    >
      <CtrlBtn
        testid="btn-play-pause"
        onClick={handlePlayPause}
        active={isAutoActive}
        title={playMode === 'manual' ? '自动演示' : paused ? '继续' : '暂停'}
      >
        {playMode === 'manual' || paused ? <Play size={16} /> : <Pause size={16} />}
      </CtrlBtn>
      <CtrlBtn testid="btn-next" onClick={handleNext} disabled={nextDisabled} title="下一步">
        <SkipForward size={16} />
      </CtrlBtn>
      <CtrlBtn testid="btn-reset" onClick={handleReset} title="重置">
        <RotateCcw size={16} />
      </CtrlBtn>
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

function CtrlBtn({
  testid,
  onClick,
  disabled = false,
  active = false,
  title,
  children,
}: {
  testid: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      style={{
        width: 32,
        height: 32,
        borderRadius: tokens.radius.md,
        border: `1px solid ${active ? tokens.color.brand[500] : tokens.color.neutral[200]}`,
        background: active ? tokens.color.brand[400] + '20' : tokens.color.neutral[0],
        color: disabled ? tokens.color.neutral[400] : active ? tokens.color.brand[600] : tokens.color.neutral[700],
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: typecheck + dev 验证**

```bash
npm run typecheck
npm run dev
```

启动 dev → /

- ✅ ▶ 按钮点击 → playMode = auto + 1.5s 后自动进 step 2
- ✅ Step 2 揭示完自动进 step 3 (Step2Metadata 视图自己定时器)
- ✅ Step 3 揭示完自动进 step 4 (Step3AutoAnnotate 视图自己定时器 + 1.5s 缓冲)
- ✅ ⏸ 按钮在 auto 模式下显示, 点击切换为暂停 (但揭示动画的暂停在 Day 6 后续任务才接入到 timeline.pause())
- ✅ ⏭ 按钮在 step 4 (重点项未审完) 置灰
- ✅ ⏭ 按钮在 step 4 (重点项审完) 亮起, 点击进 step 5
- ✅ ↺ 按钮: dirty 时二次确认, 重置后回 step 1

(Ctrl+C 停止)

- [ ] **Step 3: 提交**

```bash
git add src/chrome/DemoControls.tsx
git commit -m "feat: DemoControls fully wired to store (play/pause/next/reset/speed)"
```

---

### Task 6.4: 全局接管监听 + AutoModeBadge

**Files:**
- Create: `src/chrome/AutoModeBadge.tsx`
- Modify: `src/App.tsx` (挂载 orchestrator + 接管监听)

> **设计依据:** spec §3.4.2 + §3.4.3 — 监听 mousedown/keydown，但**控制条按钮上的点击不触发接管**（通过 `data-control-bar` 属性识别）。

- [ ] **Step 1: 写 src/chrome/AutoModeBadge.tsx**

```tsx
import { useDemoStore } from '../../store/demoStore';
import { tokens } from '../../styles/tokens';

/**
 * 自动模式角标 — 显示在右属性面板顶部 (Step 4) 或步骤主区角落。
 * 仅 playMode === 'auto' 时显示。
 */
export function AutoModeBadge() {
  const playMode = useDemoStore((s) => s.playMode);
  const paused = useDemoStore((s) => s.paused);

  if (playMode !== 'auto') return null;

  return (
    <div
      data-testid="auto-mode-badge"
      style={{
        padding: `${tokens.space[2]}px ${tokens.space[3]}px`,
        borderRadius: tokens.radius.md,
        background: tokens.brandGradient,
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
        boxShadow: tokens.shadow.brand,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <div>🎬 演示模式{paused ? ' · 已暂停' : '自动裁决中'}</div>
      <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.85 }}>任意点击立即接管</div>
    </div>
  );
}
```

- [ ] **Step 2: 修改 src/App.tsx — 挂 orchestrator + 全局接管监听**

在 App.tsx 顶部 import：

```tsx
import { useDemoOrchestrator } from './lib/animation/orchestrator';
import { useEffect } from 'react';
```

在 App 组件内（useUrlParams 之后）：

```tsx
useDemoOrchestrator();

useEffect(() => {
  const isControlBar = (el: Element | null): boolean => {
    let cur = el;
    while (cur) {
      if (cur instanceof HTMLElement && cur.dataset.controlBar === 'true') return true;
      cur = cur.parentElement;
    }
    return false;
  };

  const onMousedown = (e: MouseEvent) => {
    const target = e.target as Element | null;
    if (isControlBar(target)) return;
    if (useDemoStore.getState().playMode === 'auto') {
      useDemoStore.getState().userTakeover();
    }
  };
  const onKeydown = (e: KeyboardEvent) => {
    // 不响应控制条 select 内的 keydown (避免 ↑↓ 选档时被误判)
    const target = e.target as HTMLElement | null;
    if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
    if (useDemoStore.getState().playMode === 'auto') {
      useDemoStore.getState().userTakeover();
    }
  };

  window.addEventListener('mousedown', onMousedown);
  window.addEventListener('keydown', onKeydown);
  return () => {
    window.removeEventListener('mousedown', onMousedown);
    window.removeEventListener('keydown', onKeydown);
  };
}, []);
```

- [ ] **Step 3: dev 验证**

启动 dev → /

- ✅ 点击 ▶ → 进 auto 模式
- ✅ 点击画布空白处 → playMode 切回 manual ✓
- ✅ 按任意键 (例如 A 键) → 切回 manual ✓
- ✅ 点击控制条 ⏸ 按钮 → playMode 仍是 auto + paused = true (没被「接管」)
- ✅ 点击 ↺ 按钮 → 不触发 takeover

- [ ] **Step 4: 提交**

```bash
git add src/chrome/AutoModeBadge.tsx src/App.tsx
git commit -m "feat: global takeover listener + AutoModeBadge component"
```

---

### Task 6.5: VirtualPresenter — Step 4 自动裁决三动作

**Files:**
- Create: `src/steps/Step4Review/VirtualPresenter.tsx`
- Create: `tests/VirtualPresenter.test.tsx`

> **设计依据:** spec §3.4.1 — 时间线: t=0 选 trk_2 → t=1500 接受 → t=1500 选 trk_9 → t=3500 改框 → t=3500 选 trk_5 → t=5500 否决 → t=6500 一键剩余 → t=7500 goToStep(5)。

- [ ] **Step 1: 写 src/steps/Step4Review/VirtualPresenter.tsx**

```tsx
import { useEffect, useRef } from 'react';
import { useDemoStore } from '../../store/demoStore';
import { getDataset } from '../../data';
import { Timeline } from '../../lib/animation/timeline';

const T = {
  selectFirst: 0,
  acceptFirst: 1500,
  selectSecond: 1500,
  correctSecond: 3500,
  selectThird: 3500,
  rejectThird: 5500,
  acceptAll: 6500,
  goNext: 7500,
};

/**
 * Step 4 自动模式下的虚拟主讲。
 *
 * 行为:
 *   - 进入 Step 4 + playMode==='auto' + !paused → 启动时间线
 *   - playMode→manual 或 paused→true 或步骤离开 → 取消
 *   - 三个 review_focus_ids 各演一种动作 (顺序按 review_focus_ids[0/1/2])
 *     [0] 接受
 *     [1] 改框 (收紧 ~15%)
 *     [2] 否决
 */
export function VirtualPresenter() {
  const playMode = useDemoStore((s) => s.playMode);
  const paused = useDemoStore((s) => s.paused);
  const demoStep = useDemoStore((s) => s.demoStep);
  const speed = useDemoStore((s) => s.speed);
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const tlRef = useRef<Timeline | null>(null);

  useEffect(() => {
    if (demoStep !== 4 || playMode !== 'auto') {
      tlRef.current?.cancel();
      tlRef.current = null;
      return;
    }
    if (paused) {
      tlRef.current?.pause();
      return;
    }
    if (tlRef.current?.isRunning) {
      // 已在跑, 仅 resume
      tlRef.current.resume();
      return;
    }

    const dataset = getDataset(datasetId);
    const focusIds = dataset.demo_script.review_focus_ids;
    if (focusIds.length < 3) {
      // 副样例只有 2 个 focus, 节奏调整: [0] 接受, [1] 否决, 跳过改框
      runShortPresentation(focusIds, speed);
      return;
    }

    const tl = new Timeline();
    tl.schedule(T.selectFirst,  () => useDemoStore.getState().selectTrack(focusIds[0]!));
    tl.schedule(T.acceptFirst,  () => useDemoStore.getState().acceptBox(focusIds[0]!));
    tl.schedule(T.selectSecond, () => useDemoStore.getState().selectTrack(focusIds[1]!));
    tl.schedule(T.correctSecond, () => correctTighten(focusIds[1]!));
    tl.schedule(T.selectThird,  () => useDemoStore.getState().selectTrack(focusIds[2]!));
    tl.schedule(T.rejectThird,  () => useDemoStore.getState().rejectBox(focusIds[2]!));
    tl.schedule(T.acceptAll,    () => useDemoStore.getState().acceptAllRemaining());
    tl.schedule(T.goNext,       () => {
      useDemoStore.getState().selectTrack(null);
      useDemoStore.getState().goToStep(5);
    });

    tlRef.current = tl;
    tl.start(speed);

    return () => {
      tl.cancel();
      tlRef.current = null;
    };
  }, [demoStep, playMode, paused, speed, datasetId]);

  return null;
}

function correctTighten(trackId: string) {
  const store = useDemoStore.getState();
  const ann = store.annotations.find((a) => a.track_id === trackId);
  if (!ann) return;
  // 取该 ann 第一个关键帧, 收紧 ~15%
  const kf0 = ann.keyframes[0]!;
  const [x, y, w, h] = kf0.geometry.coords;
  const newW = Math.round(w * 0.85);
  const newH = Math.round(h * 0.85);
  const newX = Math.round(x + (w - newW) / 2);
  const newY = Math.round(y + (h - newH) / 2);
  store.correctBoxGeometry(trackId, 0, [newX, newY, newW, newH]);
}

// 副样例 (focusIds.length === 2) 的简化节奏
function runShortPresentation(focusIds: string[], speed: import('../../types').Speed) {
  const tl = new Timeline();
  tl.schedule(0,    () => useDemoStore.getState().selectTrack(focusIds[0]!));
  tl.schedule(1500, () => useDemoStore.getState().acceptBox(focusIds[0]!));
  tl.schedule(1500, () => useDemoStore.getState().selectTrack(focusIds[1]!));
  tl.schedule(3500, () => useDemoStore.getState().rejectBox(focusIds[1]!));
  tl.schedule(4500, () => useDemoStore.getState().acceptAllRemaining());
  tl.schedule(5500, () => {
    useDemoStore.getState().selectTrack(null);
    useDemoStore.getState().goToStep(5);
  });
  tl.start(speed);
}
```

- [ ] **Step 2: 集成 VirtualPresenter 和 AutoModeBadge 到 Step4Review/index.tsx**

修改 src/steps/Step4Review/index.tsx，替换为：

```tsx
import { tokens } from '../../styles/tokens';
import { ReviewCanvas } from './ReviewCanvas';
import { PropertyPanel } from './PropertyPanel';
import { QueueTrack } from './QueueTrack';
import { useReviewKeyboard } from './keyboard';
import { VirtualPresenter } from './VirtualPresenter';
import { AutoModeBadge } from '../../chrome/AutoModeBadge';

export function Step4Review() {
  useReviewKeyboard();

  return (
    <div
      data-testid="step4-review"
      style={{ flex: 1, display: 'flex', minHeight: 0 }}
    >
      <VirtualPresenter />
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
      <aside
        style={{
          width: 'min(24%, 320px)',
          minWidth: 260,
          background: tokens.color.neutral[0],
          borderLeft: `1px solid ${tokens.color.neutral[200]}`,
          padding: tokens.space[4],
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.space[3],
        }}
      >
        <AutoModeBadge />
        <PropertyPanel />
      </aside>
    </div>
  );
}
```

- [ ] **Step 3: 写 tests/VirtualPresenter.test.tsx**

```tsx
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { VirtualPresenter } from '@/steps/Step4Review/VirtualPresenter';
import { useDemoStore } from '@/store/demoStore';
import { render } from '@testing-library/react';

describe('VirtualPresenter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useDemoStore.getState().selectDataset('city-road');
    useDemoStore.getState().goToStep(4);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when manual', () => {
    render(<VirtualPresenter />);
    vi.advanceTimersByTime(10000);
    const trk2 = useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_2')!;
    expect(trk2.review.status).toBe('pending');
  });

  it('runs full presentation when auto on city-road (3 focus)', () => {
    render(<VirtualPresenter />);
    useDemoStore.getState().togglePlayMode(); // auto

    // t=0: select trk_2
    vi.advanceTimersByTime(0);
    expect(useDemoStore.getState().selectedTrackId).toBe('trk_2');

    // t=1500: accept trk_2 + select trk_9
    vi.advanceTimersByTime(1500);
    expect(useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_2')!.review.status).toBe('accepted');
    expect(useDemoStore.getState().selectedTrackId).toBe('trk_9');

    // t=3500: correct trk_9 + select trk_5
    vi.advanceTimersByTime(2000);
    expect(useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_9')!.review.status).toBe('corrected');
    expect(useDemoStore.getState().selectedTrackId).toBe('trk_5');

    // t=5500: reject trk_5
    vi.advanceTimersByTime(2000);
    expect(useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_5')!.review.status).toBe('rejected');

    // t=6500: accept all remaining
    vi.advanceTimersByTime(1000);
    const pending = useDemoStore.getState().annotations.filter((a) => a.review.status === 'pending');
    expect(pending.length).toBe(0);

    // t=7500: goToStep(5)
    vi.advanceTimersByTime(1000);
    expect(useDemoStore.getState().demoStep).toBe(5);
  });

  it('cancels when user takes over mid-presentation', () => {
    render(<VirtualPresenter />);
    useDemoStore.getState().togglePlayMode();
    vi.advanceTimersByTime(2000); // 已经接受 trk_2, 选了 trk_9

    useDemoStore.getState().userTakeover();
    vi.advanceTimersByTime(10000);

    // trk_9 不应被 correct (因为已 takeover)
    const trk9 = useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_9')!;
    expect(trk9.review.status).toBe('pending');
    // trk_2 已发生的改动保留
    const trk2 = useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_2')!;
    expect(trk2.review.status).toBe('accepted');
  });

  it('handles 2-focus secondary sample', () => {
    useDemoStore.getState().selectDataset('meeting-room');
    useDemoStore.getState().goToStep(4);
    render(<VirtualPresenter />);
    useDemoStore.getState().togglePlayMode();

    vi.advanceTimersByTime(1500); // 接受 trk_p1
    vi.advanceTimersByTime(2000); // 否决 trk_l1
    vi.advanceTimersByTime(1000); // 一键剩余
    vi.advanceTimersByTime(1000); // goToStep(5)

    const ds = useDemoStore.getState();
    expect(ds.demoStep).toBe(5);
    expect(ds.annotations.find((a) => a.track_id === 'trk_p1')!.review.status).toBe('accepted');
    expect(ds.annotations.find((a) => a.track_id === 'trk_l1')!.review.status).toBe('rejected');
    const pending = ds.annotations.filter((a) => a.review.status === 'pending');
    expect(pending.length).toBe(0);
  });
});
```

- [ ] **Step 4: 测试**

Run: `npm run test:run -- tests/VirtualPresenter.test.tsx`
Expected: PASS (4 tests)

如果失败:
- "trk_9 review.status === pending" 在 takeover 后 → 检查 useEffect cleanup 是否真的 cancel timeline
- timing 不对 → 在 useEffect 第一次跑时 timeline 在 paused 状态需要 resume, 注意 schedule 的 at 是从 timeline.start 开始算的

- [ ] **Step 5: dev 完整端到端走查**

启动 dev → /

完整自动演示:
1. 点 ▶ → 1.5s 后进 step 2
2. step 2 揭示完进 step 3
3. step 3 揭示完进 step 4
4. step 4 看到「🎬 演示模式自动裁决中」角标
5. 自动选 trk_2 → 1.5s 后接受 (绿) → 选 trk_9 → 2s 后改框 (蓝) → 选 trk_5 → 2s 后否决 (灰) → 1s 后一键全部接受 (44 个变绿) → 1s 后跳 step 5
6. step 5 自动到达, 但**不自动下载** (主讲手动点)
7. 期间任何点击/按键 → 立即切回 manual

- [ ] **Step 6: 提交**

```bash
git add src/steps/Step4Review/VirtualPresenter.tsx src/steps/Step4Review/index.tsx tests/VirtualPresenter.test.tsx
git commit -m "feat: VirtualPresenter — auto Step 4 review with 3-action choreography"
```

---

### Task 6.6: 揭示动画的暂停 — Step 2/3 接入 paused

**Files:**
- Modify: `src/steps/Step2Metadata/index.tsx`
- Modify: `src/steps/Step3AutoAnnotate/index.tsx`

> **设计依据:** spec §3.5 — 暂停/恢复语义边界。Step 2 进度条 + 字段揭示要响应 paused, Step 3 推理进度 + 框浮现要响应 paused。

> **简化策略:** Day 5 实现的 Step 2/3 用了 raf + setTimeout 自驱, 没接 paused。我们用一个**简化办法**: 把它们的揭示动画都用 `Timeline` 重写, 让它能 pause/resume。但这会大量重写 Day 5 的代码。**更经济的方法**: 当 paused 时, 不重写整个揭示, 而是用 useEffect 监听 paused, paused 时清掉 raf/setTimeout, resume 时重新跑剩余部分。

> **进一步简化**: Demo 主战场是销售主讲, 暂停期间客户最多盯 1-2 秒, 我们让 paused 在 step 2/3 里**冻结当前画面但不冻结底层定时器**——视觉冻结靠 `pointer-events: none + opacity` + 一个全局遮罩说"已暂停"。这避免大量改写。

**实施: 用全局 PauseOverlay 替代细粒度暂停**

- [ ] **Step 1: 创建 src/chrome/PauseOverlay.tsx**

```tsx
import { useDemoStore } from '../store/demoStore';
import { tokens } from '../styles/tokens';

/**
 * 暂停遮罩 — 简化策略:
 *   playMode === 'auto' && paused 时显示一个半透明遮罩,
 *   提示「已暂停, 点击继续」, 点击恢复。
 *
 * 不冻结底层定时器, 因此暂停时间过久揭示动画会失序。
 * Demo 主战场暂停期间一般 < 5s, 可接受。
 */
export function PauseOverlay() {
  const playMode = useDemoStore((s) => s.playMode);
  const paused = useDemoStore((s) => s.paused);
  const resume = useDemoStore((s) => s.resume);

  if (playMode !== 'auto' || !paused) return null;

  return (
    <div
      data-testid="pause-overlay"
      onClick={() => resume()}
      data-control-bar="true"  /* 点击不触发 userTakeover */
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(24, 24, 27, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          padding: `${tokens.space[4]}px ${tokens.space[6]}px`,
          borderRadius: tokens.radius.lg,
          background: tokens.color.neutral[0],
          boxShadow: tokens.shadow.xl,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: tokens.color.neutral[900] }}>⏸ 已暂停</div>
        <div style={{ marginTop: tokens.space[1], fontSize: 13, color: tokens.color.neutral[500] }}>
          点击任意位置继续, 或点 ▶ 按钮
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 在 src/App.tsx 挂载 PauseOverlay**

在 App return 内最末尾加:

```tsx
import { PauseOverlay } from './chrome/PauseOverlay';

// 在 return 里 <main /> 之后:
<PauseOverlay />
```

- [ ] **Step 3: 让 VirtualPresenter 在 paused 时 cancel 而非 pause (简化)**

修改 src/steps/Step4Review/VirtualPresenter.tsx 的 useEffect 内 paused 分支:

```ts
if (paused) {
  // 简化: 暂停就 cancel timeline, resume 时重新启动
  tlRef.current?.cancel();
  tlRef.current = null;
  return;
}
```

注意这意味着 paused → resume 后, 虚拟主讲会**重新从头开始**。这个行为不完美, 但实施成本低且 Demo 主战场极少在 step 4 自动模式下暂停（如果客户有问题会直接接管）。如果实际演示中发现这是问题, Day 8 缓冲日可以补 timeline 的精确 pause/resume。

- [ ] **Step 4: dev 验证**

启动 dev → 点 ▶ → 进 auto → 在 step 2/3/4 任意时刻按 ⏸ → 看到全屏遮罩「⏸ 已暂停, 点击继续」→ 点击遮罩 → 恢复。

- [ ] **Step 5: 提交**

```bash
git add src/chrome/PauseOverlay.tsx src/App.tsx src/steps/Step4Review/VirtualPresenter.tsx
git commit -m "feat: PauseOverlay — global pause UI, simplified VirtualPresenter pause→cancel"
```

---

### Task 6.7: Day 6 验收

- [ ] **Step 1: 全部测试绿色**

Run: `npm run test:run`
Expected: 全绿。新增 orchestrator + VirtualPresenter + userTakeover store 测试。

- [ ] **Step 2: typecheck + build**

```bash
npm run typecheck
npm run build
```

- [ ] **Step 3: E2E 走查**

Run: `npm run test:e2e`
Expected: Day 4 的 full-flow 仍通过。

- [ ] **Step 4: 端到端手动验证**

启动 dev → /

**自动演示完整体验:**
1. 点 ▶ → 角标「🎬 演示模式」出现
2. 1.5s 后进 step 2 → 进度条 + 字段揭示
3. 揭示完进 step 3 → 推理 + 框浮现
4. 揭示完 1.5s 后进 step 4
5. 选 trk_2 (橙色高亮) → 1.5s 后变绿 (✓ 接受)
6. 选 trk_9 → 2s 后变蓝 (✎ 改框, 框收紧 ~15%)
7. 选 trk_5 → 2s 后变灰虚线 (✗ 否决)
8. 1s 后 44 个高置信框集体变绿
9. 1s 后跳 step 5

**接管测试:**
- 在 step 3 揭示中点击画布 → 切回 manual, 揭示动画停止
- 在 step 4 虚拟主讲中按 A 键 → 切回 manual

**暂停测试:**
- ▶ 进 auto → 立即点 ⏸ → 看到「⏸ 已暂停」遮罩 → 点击遮罩 → 恢复 (虚拟主讲重新从头跑, 但因为 acceptBox 是幂等的, trk_2 状态不变)

**速度测试:**
- 重置 → 切 2x 速度 → ▶ → 整个流程时间减半
- 重置 → 切「即时」→ ▶ → 几乎立即跳到 step 5

- [ ] **Step 5: 提交 tag**

```bash
git tag day6-orchestration-complete
```

---

## Day 6 验收清单

至此 Day 6 应满足：

- ✅ store 加 userTakeover action
- ✅ orchestrator hook (auto + step 1 → 自动进 step 2)
- ✅ DemoControls 完整接入 (▶ ⏸ ⏭ ↺ + 速度档)
- ✅ ⏭ 在 Step 4 重点项未审完置灰 (canAdvanceFromStep4)
- ✅ AutoModeBadge 角标 (右属性面板顶部)
- ✅ 全局接管监听 (mousedown / keydown, 排除控制条)
- ✅ VirtualPresenter — Step 4 三动作裁决编排 (city-road 完整流程 / 副样例简化)
- ✅ PauseOverlay 暂停遮罩
- ✅ 4 个新单测覆盖 orchestrator + VirtualPresenter + userTakeover
- ✅ 完整自动演示流程跑通 (~7-8s 总时长 1x)
- ✅ 任意接管 + 暂停 + 速度档都正确响应
- ✅ Day 4 E2E 仍绿

下一分册: Day 7 防呆 + 错误边界 + 现场分发脚本 + 性能与离线验证。
