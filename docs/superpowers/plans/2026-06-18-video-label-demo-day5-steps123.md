# Day 5 实施计划 · Step 1/2/3 + 副样例

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**前置:** Day 1-4 已完成（核心链路 review → export 已通）。

**Goal:** 实现剩余三个步骤的视图与揭示动画 — Step 1（上传/样例选择/友好 toast）、Step 2（元信息打字机揭示）、Step 3（推理进度 + 框逐个浮现）；同时补 2 个副样例 JSON（meeting-room / retail-cam）让样例切换有内容。

**Architecture:** 三个步骤都是「定时器驱动的揭示动画 + 读 Mock JSON」（CLAUDE.md 第 5 条：审核是唯一真交互）。共享一个 Timeline 抽象来支持「速度档 1x/2x/instant + 暂停/恢复 + 跳到末尾」。

**关键产出文件:**
- `src/lib/animation/timeline.ts` — 揭示动画通用调度器
- `src/lib/animation/speed.ts` — 速度档应用工具
- `src/lib/format/duration.ts` — 时长格式化（00:00:30.000）
- `src/steps/Step1Upload/index.tsx`
- `src/steps/Step1Upload/SampleCards.tsx`
- `src/steps/Step1Upload/DropZone.tsx`
- `src/steps/Step1Upload/UploadingToast.tsx`
- `src/steps/Step2Metadata/index.tsx`
- `src/steps/Step2Metadata/TypewriterField.tsx`
- `src/steps/Step3AutoAnnotate/index.tsx`
- `src/steps/Step3AutoAnnotate/InferenceProgress.tsx`
- `src/steps/Step3AutoAnnotate/BoxRevealCanvas.tsx`
- `src/data/meeting-room.json` (副样例)
- `src/data/retail-cam.json` (副样例)
- `src/data/_generators/meeting-room-fixture.ts`
- `src/data/_generators/retail-cam-fixture.ts`
- `tests/timeline.test.ts`
- `tests/Step1Upload.test.tsx`

---

## File Structure

```
src/
├── lib/
│   ├── animation/
│   │   ├── timeline.ts        ← schedule(at, fn) + start/pause/resume/cancel/jumpToEnd
│   │   └── speed.ts           ← applySpeed(ms, speed) + speedMultiplier 表
│   └── format/
│       └── duration.ts        ← duration_ms → "00:00:30.000"
├── steps/
│   ├── Step1Upload/
│   │   ├── index.tsx
│   │   ├── SampleCards.tsx
│   │   ├── DropZone.tsx
│   │   └── UploadingToast.tsx
│   ├── Step2Metadata/
│   │   ├── index.tsx
│   │   └── TypewriterField.tsx
│   └── Step3AutoAnnotate/
│       ├── index.tsx
│       ├── InferenceProgress.tsx
│       └── BoxRevealCanvas.tsx
└── data/
    ├── meeting-room.json
    ├── retail-cam.json
    └── _generators/
        ├── meeting-room-fixture.ts
        └── retail-cam-fixture.ts
```

---

## Day 5: 揭示动画引擎 + 三个步骤 + 副样例

### Task 5.1: Timeline 调度器

**Files:**
- Create: `src/lib/animation/timeline.ts`
- Create: `src/lib/animation/speed.ts`
- Create: `tests/timeline.test.ts`

> **设计依据:** spec §3.3.3 — schedule(at, fn) 在指定时间触发 + 支持 pause/resume/cancel/jumpToEnd + 速度档实时应用。

- [ ] **Step 1: 写 src/lib/animation/speed.ts**

```ts
import type { Speed } from '../../types';

export const speedMultiplier: Record<Speed, number> = {
  '1x': 1,
  '2x': 0.5,
  'instant': 0,
};

export function applySpeed(baseMs: number, speed: Speed): number {
  return Math.round(baseMs * speedMultiplier[speed]);
}
```

- [ ] **Step 2: 写 tests/timeline.test.ts**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Timeline } from '@/lib/animation/timeline';

describe('Timeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires scheduled callbacks in order at correct times (1x speed)', () => {
    const tl = new Timeline();
    const log: string[] = [];
    tl.schedule(0, () => log.push('a'));
    tl.schedule(100, () => log.push('b'));
    tl.schedule(300, () => log.push('c'));
    tl.start('1x');

    vi.advanceTimersByTime(0);
    expect(log).toEqual(['a']);
    vi.advanceTimersByTime(100);
    expect(log).toEqual(['a', 'b']);
    vi.advanceTimersByTime(200);
    expect(log).toEqual(['a', 'b', 'c']);
  });

  it('compresses time at 2x speed', () => {
    const tl = new Timeline();
    const log: string[] = [];
    tl.schedule(100, () => log.push('a'));
    tl.schedule(200, () => log.push('b'));
    tl.start('2x');

    vi.advanceTimersByTime(50);  // 2x → 100ms 实际 50ms 触发
    expect(log).toEqual(['a']);
    vi.advanceTimersByTime(50);  // 又 50ms → 200ms 实际 100ms 触发
    expect(log).toEqual(['a', 'b']);
  });

  it('instant speed fires all immediately', () => {
    const tl = new Timeline();
    const log: string[] = [];
    tl.schedule(100, () => log.push('a'));
    tl.schedule(500, () => log.push('b'));
    tl.start('instant');

    // 不需要推进时间, 同步触发
    expect(log).toEqual(['a', 'b']);
  });

  it('pause / resume preserves remaining time', () => {
    const tl = new Timeline();
    const log: string[] = [];
    tl.schedule(100, () => log.push('a'));
    tl.start('1x');

    vi.advanceTimersByTime(50);
    tl.pause();
    vi.advanceTimersByTime(200); // 暂停期间不该触发
    expect(log).toEqual([]);

    tl.resume();
    vi.advanceTimersByTime(50);  // 剩余 50ms
    expect(log).toEqual(['a']);
  });

  it('cancel stops further callbacks', () => {
    const tl = new Timeline();
    const log: string[] = [];
    tl.schedule(100, () => log.push('a'));
    tl.start('1x');
    tl.cancel();
    vi.advanceTimersByTime(500);
    expect(log).toEqual([]);
  });

  it('jumpToEnd fires all remaining callbacks immediately', () => {
    const tl = new Timeline();
    const log: string[] = [];
    tl.schedule(100, () => log.push('a'));
    tl.schedule(500, () => log.push('b'));
    tl.start('1x');

    vi.advanceTimersByTime(100);
    expect(log).toEqual(['a']);

    tl.jumpToEnd();
    expect(log).toEqual(['a', 'b']);
  });

  it('does not fire callbacks already triggered when jumpToEnd called', () => {
    const tl = new Timeline();
    const log: string[] = [];
    tl.schedule(100, () => log.push('a'));
    tl.start('1x');
    vi.advanceTimersByTime(100);
    expect(log).toEqual(['a']);
    tl.jumpToEnd();
    expect(log).toEqual(['a']);  // 'a' 不重复
  });
});
```

- [ ] **Step 3: 运行测试以确认失败**

Run: `npm run test:run -- tests/timeline.test.ts`
Expected: FAIL — `Cannot find module '@/lib/animation/timeline'`

- [ ] **Step 4: 写 src/lib/animation/timeline.ts**

```ts
import type { Speed } from '../../types';
import { applySpeed } from './speed';

interface ScheduledStep {
  at: number;        // 原始时间 (1x 下 ms)
  fn: () => void;
  fired: boolean;
}

export class Timeline {
  private steps: ScheduledStep[] = [];
  private speed: Speed = '1x';
  private timers = new Map<number, ReturnType<typeof setTimeout>>();
  private startedAt = 0;
  private pausedAt = 0;
  private elapsed = 0;       // pause 之前累计经过的真实毫秒
  private state: 'idle' | 'running' | 'paused' | 'cancelled' = 'idle';

  schedule(at: number, fn: () => void): this {
    this.steps.push({ at, fn, fired: false });
    return this;
  }

  start(speed: Speed): this {
    this.speed = speed;
    this.state = 'running';
    this.startedAt = Date.now();
    this.elapsed = 0;

    if (speed === 'instant') {
      // 同步触发所有未触发的回调
      for (const s of this.steps) {
        if (!s.fired) {
          s.fired = true;
          s.fn();
        }
      }
      this.state = 'idle';
      return this;
    }

    for (let i = 0; i < this.steps.length; i++) {
      this.scheduleStep(i, this.steps[i]!.at);
    }
    return this;
  }

  private scheduleStep(idx: number, scaledAt: number) {
    const realDelay = applySpeed(scaledAt, this.speed);
    const timer = setTimeout(() => {
      const s = this.steps[idx];
      if (!s || s.fired || this.state === 'cancelled') return;
      s.fired = true;
      s.fn();
      this.timers.delete(idx);
    }, realDelay);
    this.timers.set(idx, timer);
  }

  pause(): void {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this.pausedAt = Date.now();
    this.elapsed += this.pausedAt - this.startedAt;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this.startedAt = Date.now();
    // 重新调度未触发的步骤, 减去已经经过的时间
    const elapsedScaled = this.elapsed / (this.speed === '2x' ? 0.5 : 1);
    for (let i = 0; i < this.steps.length; i++) {
      const s = this.steps[i]!;
      if (s.fired) continue;
      const remaining = Math.max(0, s.at - elapsedScaled);
      this.scheduleStep(i, remaining);
    }
  }

  cancel(): void {
    this.state = 'cancelled';
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  jumpToEnd(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    for (const s of this.steps) {
      if (!s.fired) {
        s.fired = true;
        s.fn();
      }
    }
    this.state = 'idle';
  }

  get isRunning(): boolean {
    return this.state === 'running';
  }
}
```

- [ ] **Step 5: 运行测试**

Run: `npm run test:run -- tests/timeline.test.ts`
Expected: PASS (7 tests)

如果失败:
- "pause/resume preserves remaining time" → 检查 elapsed 计算是否考虑 speed (resume 重排时要把 elapsed 反向 scale 回原始时间轴)
- "cancel stops further callbacks" → 检查 setTimeout 是否真清掉

- [ ] **Step 6: 提交**

```bash
mkdir -p src/lib/animation
git add src/lib/animation/timeline.ts src/lib/animation/speed.ts tests/timeline.test.ts
git commit -m "feat: Timeline scheduler with speed/pause/resume/cancel/jumpToEnd"
```

---

### Task 5.2: 时长格式化工具

**Files:**
- Create: `src/lib/format/duration.ts`
- Create: `tests/duration.test.ts`

> **设计依据:** spec §5.2.3 — 元信息揭示要显示「时长 00:00:30.000 (900 帧)」。

- [ ] **Step 1: 写 tests/duration.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { formatDuration } from '@/lib/format/duration';

describe('formatDuration', () => {
  it('formats 30000 as 00:00:30.000', () => {
    expect(formatDuration(30000)).toBe('00:00:30.000');
  });
  it('formats 65500 as 00:01:05.500', () => {
    expect(formatDuration(65500)).toBe('00:01:05.500');
  });
  it('formats 3661123 as 01:01:01.123', () => {
    expect(formatDuration(3661123)).toBe('01:01:01.123');
  });
  it('formats 0 as 00:00:00.000', () => {
    expect(formatDuration(0)).toBe('00:00:00.000');
  });
});
```

- [ ] **Step 2: 写 src/lib/format/duration.ts**

```ts
export function formatDuration(durationMs: number): string {
  const ms = Math.floor(durationMs % 1000);
  const totalSec = Math.floor(durationMs / 1000);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60) % 60;
  const hr = Math.floor(totalSec / 3600);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(hr)}:${pad(min)}:${pad(sec)}.${pad(ms, 3)}`;
}
```

- [ ] **Step 3: 测试通过 + 提交**

```bash
npm run test:run -- tests/duration.test.ts
git add src/lib/format/duration.ts tests/duration.test.ts
git commit -m "feat: formatDuration utility"
```

---

### Task 5.3: Step 1 — SampleCards 样例卡片

**Files:**
- Create: `src/steps/Step1Upload/SampleCards.tsx`

> **设计依据:** spec §5.1.1 — 3 张样例卡片 + 当前选中态 + 点击切换样例并自动推进。

- [ ] **Step 1: 写 src/steps/Step1Upload/SampleCards.tsx**

```tsx
import { useDemoStore } from '../../store/demoStore';
import { tokens } from '../../styles/tokens';
import type { DatasetId } from '../../types';

interface SampleCardData {
  id: DatasetId;
  display: string;
  duration: string;
  resolution: string;
  thumb: string;
}

const SAMPLES: SampleCardData[] = [
  { id: 'city-road',    display: '城市道路', duration: '0:30', resolution: '1080p', thumb: '/mock/city-road/road_thumb.jpg' },
  { id: 'meeting-room', display: '室内会议', duration: '0:45', resolution: '720p',  thumb: '/mock/meeting-room/meeting_thumb.jpg' },
  { id: 'retail-cam',   display: '商超监控', duration: '1:00', resolution: '1080p', thumb: '/mock/retail-cam/retail_thumb.jpg' },
];

export function SampleCards() {
  const activeId = useDemoStore((s) => s.activeDatasetId);
  const selectDataset = useDemoStore((s) => s.selectDataset);
  const goToStep = useDemoStore((s) => s.goToStep);

  const handleSelect = (id: DatasetId) => {
    selectDataset(id);
    goToStep(2);
  };

  return (
    <div data-testid="sample-cards" style={{ display: 'flex', gap: tokens.space[4] }}>
      {SAMPLES.map((s) => {
        const active = activeId === s.id;
        return (
          <button
            key={s.id}
            data-testid={`sample-card-${s.id}`}
            onClick={() => handleSelect(s.id)}
            style={{
              width: 200,
              padding: 0,
              border: `2px solid ${active ? tokens.color.brand[500] : tokens.color.neutral[200]}`,
              borderRadius: tokens.radius.lg,
              overflow: 'hidden',
              background: tokens.color.neutral[0],
              cursor: 'pointer',
              boxShadow: active ? tokens.shadow.brand : tokens.shadow.sm,
              textAlign: 'left',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '100%',
                aspectRatio: '16/9',
                background: tokens.color.neutral[100],
                backgroundImage: `url(${s.thumb})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            <div style={{ padding: tokens.space[3] }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: tokens.color.neutral[900] }}>
                {s.display}
              </div>
              <div className="tabular" style={{ fontSize: 12, color: tokens.color.neutral[500], marginTop: 2 }}>
                {s.duration} · {s.resolution}
              </div>
              <div
                style={{
                  marginTop: tokens.space[2],
                  padding: '6px 10px',
                  borderRadius: tokens.radius.md,
                  background: active ? tokens.brandGradient : tokens.color.neutral[100],
                  color: active ? '#fff' : tokens.color.neutral[700],
                  fontSize: 12,
                  fontWeight: 500,
                  textAlign: 'center',
                }}
              >
                {active ? '✓ 当前' : '使用 →'}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
mkdir -p src/steps/Step1Upload
git add src/steps/Step1Upload/SampleCards.tsx
git commit -m "feat: Step1 SampleCards with active state and step advance"
```

---

### Task 5.4: Step 1 — DropZone + UploadingToast 假上传

**Files:**
- Create: `src/steps/Step1Upload/UploadingToast.tsx`
- Create: `src/steps/Step1Upload/DropZone.tsx`

> **设计依据:** spec §5.1.2 — 拖入非视频 → toast 提示；拖入视频 → 假上传 2s → 友好 toast 切回 city-road。

- [ ] **Step 1: 写 src/steps/Step1Upload/UploadingToast.tsx**

```tsx
import { useEffect, useState } from 'react';
import { tokens } from '../../styles/tokens';

interface UploadingToastProps {
  filename: string;
  onDone: () => void;
}

/**
 * 假上传进度条 — 2s 内 0→100%, 完成时调用 onDone()。
 * 不读文件内容、不创建 ObjectURL (spec §5.1.2)。
 */
export function UploadingToast({ filename, onDone }: UploadingToastProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const total = 2000;
    let raf = 0;
    const tick = () => {
      const dt = Date.now() - start;
      const p = Math.min(1, dt / total);
      setProgress(p);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        onDone();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <div
      data-testid="uploading-toast"
      style={{
        marginTop: tokens.space[4],
        padding: tokens.space[4],
        borderRadius: tokens.radius.md,
        background: tokens.color.neutral[0],
        border: `1px solid ${tokens.color.neutral[200]}`,
        boxShadow: tokens.shadow.sm,
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space[2],
        maxWidth: 480,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="tabular" style={{ fontSize: 13, color: tokens.color.neutral[700] }}>
          {filename}
        </span>
        <span className="tabular" style={{ fontSize: 12, color: tokens.color.neutral[500] }}>
          {Math.round(progress * 100)}%
        </span>
      </div>
      <div
        style={{
          height: 4,
          background: tokens.color.neutral[100],
          borderRadius: tokens.radius.full,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress * 100}%`,
            background: tokens.brandGradient,
            transition: 'width 50ms linear',
          }}
        />
      </div>
      {progress >= 1 && (
        <div style={{ fontSize: 12, color: tokens.color.success[500] }}>上传完成 ✓</div>
      )}
    </div>
  );
}

interface InfoToastProps {
  text: string;
  onClose: () => void;
}

export function InfoToast({ text, onClose }: InfoToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      data-testid="info-toast"
      style={{
        position: 'fixed',
        bottom: tokens.space[5],
        left: '50%',
        transform: 'translateX(-50%)',
        padding: `${tokens.space[3]}px ${tokens.space[4]}px`,
        borderRadius: tokens.radius.md,
        background: tokens.color.neutral[900],
        color: tokens.color.neutral[100],
        fontSize: 13,
        boxShadow: tokens.shadow.lg,
        maxWidth: 480,
        zIndex: 1000,
      }}
    >
      {text}
    </div>
  );
}
```

- [ ] **Step 2: 写 src/steps/Step1Upload/DropZone.tsx**

```tsx
import { useState } from 'react';
import { useDemoStore } from '../../store/demoStore';
import { tokens } from '../../styles/tokens';
import { UploadingToast, InfoToast } from './UploadingToast';

type Phase = 'idle' | 'uploading' | 'just-fallback';

export function DropZone() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [filename, setFilename] = useState('');
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [fallbackToast, setFallbackToast] = useState<string | null>(null);
  const selectDataset = useDemoStore((s) => s.selectDataset);
  const goToStep = useDemoStore((s) => s.goToStep);

  const handleFiles = (files: FileList) => {
    const f = files[0];
    if (!f) return;
    if (!f.type.startsWith('video/')) {
      setErrorToast('请拖入视频文件，或直接选用样例');
      setTimeout(() => setErrorToast(null), 3000);
      return;
    }
    setFilename(f.name);
    setPhase('uploading');
  };

  const onUploadDone = () => {
    setPhase('just-fallback');
    setFallbackToast(
      '为了让演示更贴近真实标注效果，已为您切换至『城市道路』样例数据。您上传的文件不会上传至任何服务器。',
    );
    selectDataset('city-road');
    setTimeout(() => {
      setFallbackToast(null);
      goToStep(2);
    }, 2000);
  };

  return (
    <div data-testid="drop-zone">
      <div
        onDrop={(e) => {
          e.preventDefault();
          if (phase === 'idle') handleFiles(e.dataTransfer.files);
        }}
        onDragOver={(e) => e.preventDefault()}
        style={{
          padding: tokens.space[8],
          borderRadius: tokens.radius.lg,
          border: `2px dashed ${tokens.color.neutral[200]}`,
          background: tokens.color.neutral[0],
          textAlign: 'center',
          maxWidth: 640,
        }}
      >
        <div style={{ fontSize: 14, color: tokens.color.neutral[500], marginBottom: tokens.space[3] }}>
          拖入视频或选择下方样例
        </div>
        <label
          style={{
            display: 'inline-block',
            padding: `${tokens.space[2]}px ${tokens.space[4]}px`,
            borderRadius: tokens.radius.md,
            background: 'transparent',
            backgroundImage: tokens.brandGradient,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: tokens.shadow.brand,
          }}
        >
          选择文件
          <input
            type="file"
            accept="video/*"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            style={{ display: 'none' }}
            data-testid="file-input"
          />
        </label>
      </div>

      {phase === 'uploading' && <UploadingToast filename={filename} onDone={onUploadDone} />}
      {errorToast && <InfoToast text={errorToast} onClose={() => setErrorToast(null)} />}
      {fallbackToast && <InfoToast text={fallbackToast} onClose={() => setFallbackToast(null)} />}
    </div>
  );
}
```

- [ ] **Step 3: 提交**

```bash
git add src/steps/Step1Upload/UploadingToast.tsx src/steps/Step1Upload/DropZone.tsx
git commit -m "feat: Step1 DropZone with fake-upload fallback to city-road sample"
```

---

### Task 5.5: Step 1 主视图

**Files:**
- Create: `src/steps/Step1Upload/index.tsx`
- Modify: `src/App.tsx` (启用 Step1Upload)

- [ ] **Step 1: 写 src/steps/Step1Upload/index.tsx**

```tsx
import { tokens } from '../../styles/tokens';
import { DropZone } from './DropZone';
import { SampleCards } from './SampleCards';

export function Step1Upload() {
  return (
    <div
      data-testid="step1-upload"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: tokens.space[8],
        gap: tokens.space[6],
        overflow: 'auto',
      }}
    >
      <h2 style={{ margin: 0, fontSize: 28, fontWeight: 600, color: tokens.color.neutral[900] }}>
        ① 上传视频
      </h2>
      <DropZone />
      <div style={{ width: '100%', maxWidth: 720 }}>
        <div
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: tokens.color.neutral[400],
            marginBottom: tokens.space[3],
          }}
        >
          推荐样例（点击即用，数据已就绪）
        </div>
        <SampleCards />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 修改 src/App.tsx**

```tsx
import { Step1Upload } from './steps/Step1Upload';

// 替换:
{demoStep === 1 && <StepPlaceholder step={1} />}
// 为:
{demoStep === 1 && <Step1Upload />}
```

- [ ] **Step 3: dev 验证**

启动 dev → / (默认 step 1)

- 看到「① 上传视频」标题 + 拖入区 + 3 张样例卡片
- 当前选中样例 (city-road) 卡片高亮
- 点击 meeting-room 卡片 → 进入 step 2 (占位 — 下个任务实现)
- 拖入一个视频文件 → 假上传 2s → 弹友好 toast → 切回 city-road → 进入 step 2

- [ ] **Step 4: 提交**

```bash
git add src/steps/Step1Upload/index.tsx src/App.tsx
git commit -m "feat: Step1Upload main view"
```

---

### Task 5.6: Step 1 测试 (集成)

**Files:**
- Create: `tests/Step1Upload.test.tsx`

- [ ] **Step 1: 写 tests/Step1Upload.test.tsx**

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Step1Upload } from '@/steps/Step1Upload';
import { useDemoStore } from '@/store/demoStore';

// mock raf for UploadingToast
beforeEach(() => {
  vi.useRealTimers();
  useDemoStore.getState().selectDataset('city-road');
});

describe('Step1Upload', () => {
  it('clicking sample card switches dataset and advances to step 2', async () => {
    const user = userEvent.setup();
    render(<Step1Upload />);
    await user.click(screen.getByTestId('sample-card-meeting-room'));
    expect(useDemoStore.getState().activeDatasetId).toBe('meeting-room');
    expect(useDemoStore.getState().demoStep).toBe(2);
  });

  it('non-video file shows error toast', async () => {
    const user = userEvent.setup();
    render(<Step1Upload />);
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    const file = new File(['data'], 'not-a-video.png', { type: 'image/png' });
    await user.upload(input, file);
    await waitFor(() => {
      expect(screen.getByTestId('info-toast').textContent).toContain('请拖入视频文件');
    });
  });

  it('video file triggers fake upload then falls back to city-road', async () => {
    const user = userEvent.setup();
    render(<Step1Upload />);
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    const file = new File(['video-bytes'], 'custom.mp4', { type: 'video/mp4' });
    await user.upload(input, file);
    expect(screen.getByTestId('uploading-toast')).toBeInTheDocument();

    // 等假上传完成 (2s) + fallback toast (2s)
    await waitFor(
      () => expect(useDemoStore.getState().demoStep).toBe(2),
      { timeout: 6000 },
    );
    expect(useDemoStore.getState().activeDatasetId).toBe('city-road');
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `npm run test:run -- tests/Step1Upload.test.tsx`
Expected: PASS (3 tests)。第三个测试比较慢 (~5s)。

- [ ] **Step 3: 提交**

```bash
git add tests/Step1Upload.test.tsx
git commit -m "test: Step1Upload integration covering sample select and fake-upload fallback"
```

---

### Task 5.7: Step 2 — TypewriterField 打字机组件

**Files:**
- Create: `src/steps/Step2Metadata/TypewriterField.tsx`

> **设计依据:** spec §5.2.2 — 行框淡入 150ms + 字符 8ms × speed。

- [ ] **Step 1: 写 src/steps/Step2Metadata/TypewriterField.tsx**

```tsx
import { useEffect, useState } from 'react';
import { tokens } from '../../styles/tokens';
import { applySpeed } from '../../lib/animation/speed';
import type { Speed } from '../../types';

interface TypewriterFieldProps {
  label: string;
  value: string;
  startAtMs: number;     // 在父 Timeline 中的开始时间
  speed: Speed;
  onComplete?: () => void;
}

export function TypewriterField({ label, value, startAtMs, speed, onComplete }: TypewriterFieldProps) {
  const [shownChars, setShownChars] = useState(0);
  const [framePhase, setFramePhase] = useState<'hidden' | 'frame' | 'typing' | 'done'>('hidden');

  useEffect(() => {
    setShownChars(0);
    setFramePhase('hidden');

    if (speed === 'instant') {
      // 即时模式: 直接显示
      setShownChars(value.length);
      setFramePhase('done');
      onComplete?.();
      return;
    }

    let f1 = 0;
    let typing: ReturnType<typeof setInterval> | null = null;

    f1 = window.setTimeout(() => {
      setFramePhase('frame');
      window.setTimeout(() => {
        setFramePhase('typing');
        const charDelay = applySpeed(8, speed);
        typing = setInterval(() => {
          setShownChars((c) => {
            if (c + 1 >= value.length) {
              if (typing) clearInterval(typing);
              setFramePhase('done');
              onComplete?.();
              return value.length;
            }
            return c + 1;
          });
        }, Math.max(1, charDelay));
      }, applySpeed(150, speed));
    }, applySpeed(startAtMs, speed));

    return () => {
      window.clearTimeout(f1);
      if (typing) clearInterval(typing);
    };
  }, [label, value, startAtMs, speed, onComplete]);

  return (
    <div
      data-testid={`typewriter-field-${label}`}
      style={{
        display: 'flex',
        gap: tokens.space[4],
        padding: `${tokens.space[2]}px ${tokens.space[3]}px`,
        borderRadius: tokens.radius.sm,
        background: framePhase === 'hidden' ? 'transparent' : tokens.color.brand[400] + '15',
        opacity: framePhase === 'hidden' ? 0 : 1,
        transition: `opacity 150ms var(--ease-out), background-color 150ms var(--ease-out)`,
      }}
    >
      <span
        style={{
          width: 100,
          flexShrink: 0,
          color: tokens.color.neutral[500],
          fontSize: 13,
        }}
      >
        {label}
      </span>
      <span
        className="tabular"
        style={{
          color: tokens.color.neutral[900],
          fontSize: 13,
          fontFamily: tokens.color.neutral[700], // (使用 inter, 无需指定)
        }}
      >
        {value.slice(0, shownChars)}
        {framePhase === 'typing' && <span style={{ color: tokens.color.brand[500] }}>▍</span>}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
mkdir -p src/steps/Step2Metadata
git add src/steps/Step2Metadata/TypewriterField.tsx
git commit -m "feat: TypewriterField for metadata reveal animation"
```

---

### Task 5.8: Step 2 主视图

**Files:**
- Create: `src/steps/Step2Metadata/index.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 写 src/steps/Step2Metadata/index.tsx**

```tsx
import { useEffect, useState } from 'react';
import { useDemoStore } from '../../store/demoStore';
import { getDataset } from '../../data';
import { tokens } from '../../styles/tokens';
import { formatDuration } from '../../lib/format/duration';
import { applySpeed } from '../../lib/animation/speed';
import { TypewriterField } from './TypewriterField';

export function Step2Metadata() {
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const speed = useDemoStore((s) => s.speed);
  const goToStep = useDemoStore((s) => s.goToStep);
  const dataset = getDataset(datasetId);
  const m = dataset.metadata;

  const fields = [
    { label: '时长', value: `${formatDuration(m.duration_ms)} (${m.frame_count} 帧)` },
    { label: '分辨率', value: `${m.width} × ${m.height}` },
    { label: '帧率', value: `${m.fps} fps (恒定)` },
    { label: '编码', value: `${m.codec.toUpperCase()} / yuv420p` },
    { label: '音轨', value: `${m.audio_tracks} 条 AAC 48kHz` },
    { label: '抽帧结果', value: `场景自适应 → ${m.sampled_frames} 关键帧` },
  ];

  const [progressPhase, setProgressPhase] = useState<'progress' | 'reveal' | 'done'>('progress');
  const [progress, setProgress] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  // 解析进度条 (600ms × speed)
  useEffect(() => {
    if (speed === 'instant') {
      setProgress(1);
      setProgressPhase('reveal');
      return;
    }
    const total = applySpeed(600, speed);
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const dt = Date.now() - start;
      const p = Math.min(1, dt / total);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setProgressPhase('reveal');
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  // 揭示完成自动推进
  useEffect(() => {
    if (completedCount === fields.length) {
      setProgressPhase('done');
      const t = setTimeout(() => goToStep(3), applySpeed(800, speed));
      return () => clearTimeout(t);
    }
    return undefined;
  }, [completedCount, fields.length, goToStep, speed]);

  return (
    <div
      data-testid="step2-metadata"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: tokens.space[8],
        gap: tokens.space[5],
      }}
    >
      <h2 style={{ margin: 0, fontSize: 28, fontWeight: 600, color: tokens.color.neutral[900] }}>
        ② 元信息提取
      </h2>

      <div
        style={{
          width: '100%',
          maxWidth: 600,
          padding: tokens.space[5],
          borderRadius: tokens.radius.lg,
          background: tokens.color.neutral[0],
          boxShadow: tokens.shadow.sm,
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.space[2],
        }}
      >
        <div style={{ fontSize: 13, color: tokens.color.neutral[500], marginBottom: tokens.space[2] }}>
          {progressPhase === 'progress' ? '解析中... 解析容器/编码/帧率' : '解析完成 ✓'}
        </div>
        <div
          style={{
            height: 4,
            background: tokens.color.neutral[100],
            borderRadius: tokens.radius.full,
            overflow: 'hidden',
            marginBottom: tokens.space[3],
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress * 100}%`,
              background: tokens.brandGradient,
              transition: 'width 50ms linear',
            }}
          />
        </div>

        {progressPhase !== 'progress' &&
          fields.map((f, idx) => (
            <TypewriterField
              key={f.label}
              label={f.label}
              value={f.value}
              startAtMs={idx * 130}
              speed={speed}
              onComplete={() => setCompletedCount((c) => c + 1)}
            />
          ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 修改 src/App.tsx 启用 Step2Metadata**

```tsx
import { Step2Metadata } from './steps/Step2Metadata';

{demoStep === 2 && <Step2Metadata />}
```

- [ ] **Step 3: dev 验证**

启动 dev → / → 点击 city-road 卡 → 自动到 step 2

- 看到「② 元信息提取」标题 + 卡片
- 进度条 0→100% (600ms)
- 进度满后, 6 行字段一行一行打字机式揭示 (~1.3s)
- 完成后约 800ms 自动跳到 step 3 (占位)
- 切速度档 2x → 节奏快一倍
- 切速度档 即时 → 直接全部显示, 立即跳 step 3

- [ ] **Step 4: 提交**

```bash
git add src/steps/Step2Metadata/index.tsx src/App.tsx
git commit -m "feat: Step2Metadata reveal — progress bar + 6 typewriter fields + auto-advance"
```

---

### Task 5.9: Step 3 — InferenceProgress 推理进度

**Files:**
- Create: `src/steps/Step3AutoAnnotate/InferenceProgress.tsx`

> **设计依据:** spec §5.3.2 — 三段式: YOLOv8 (0-1000ms) / ByteTrack (200-2000ms) / 低置信对象 (2200ms 标红抖动)。

- [ ] **Step 1: 写 src/steps/Step3AutoAnnotate/InferenceProgress.tsx**

```tsx
import { useEffect, useState } from 'react';
import { tokens } from '../../styles/tokens';
import { applySpeed } from '../../lib/animation/speed';
import type { Speed } from '../../types';

interface InferenceProgressProps {
  totalObjects: number;
  focusCount: number;
  speed: Speed;
}

export function InferenceProgress({ totalObjects, focusCount, speed }: InferenceProgressProps) {
  const [yoloProgress, setYolo] = useState(0);
  const [byteProgress, setByte] = useState(0);
  const [showFocus, setShowFocus] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (speed === 'instant') {
      setYolo(1);
      setByte(1);
      setShowFocus(true);
      return;
    }
    let raf1 = 0;
    let raf2 = 0;
    const start = Date.now();
    const yoloDur = applySpeed(1000, speed);
    const byteDur = applySpeed(1800, speed);
    const byteDelay = applySpeed(200, speed);
    const focusDelay = applySpeed(2200, speed);

    const tick = () => {
      const dt = Date.now() - start;
      setYolo(Math.min(1, dt / yoloDur));
      const byteEffective = Math.max(0, dt - byteDelay);
      setByte(Math.min(1, byteEffective / byteDur));
      if (dt < Math.max(yoloDur, byteDelay + byteDur)) {
        raf1 = requestAnimationFrame(tick);
      }
    };
    raf1 = requestAnimationFrame(tick);

    const focusTimer = window.setTimeout(() => {
      setShowFocus(true);
      setShake(true);
      window.setTimeout(() => setShake(false), 300);
    }, focusDelay);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(focusTimer);
    };
  }, [speed]);

  return (
    <div
      data-testid="inference-progress"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space[3],
        padding: tokens.space[4],
        borderRadius: tokens.radius.md,
        background: tokens.color.neutral[0],
        border: `1px solid ${tokens.color.neutral[200]}`,
      }}
    >
      <ProgressLine
        label="目标检测 YOLOv8"
        progress={yoloProgress}
        rightText={yoloProgress >= 1 ? `${totalObjects} 对象` : '推理中...'}
      />
      <ProgressLine
        label="多目标跟踪 ByteTrack"
        progress={byteProgress}
        rightText={byteProgress >= 1 ? `track ${totalObjects}` : '关联中...'}
      />
      <div
        style={{
          fontSize: 13,
          color: showFocus ? tokens.color.warning[500] : tokens.color.neutral[400],
          opacity: showFocus ? 1 : 0.6,
          transition: 'all 200ms var(--ease-out)',
          transform: shake ? 'translateX(2px)' : 'none',
          animation: shake ? 'inference-shake 300ms ease-in-out' : 'none',
        }}
      >
        ⚠ 低置信对象: {showFocus ? `${focusCount} 个 已标记『需重点审核』` : '...'}
      </div>
      <style>{`
        @keyframes inference-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
}

function ProgressLine({ label, progress, rightText }: { label: string; progress: number; rightText: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: tokens.color.neutral[700] }}>├ {label}</span>
        <span className="tabular" style={{ color: tokens.color.neutral[500] }}>{rightText}</span>
      </div>
      <div
        style={{
          height: 4,
          background: tokens.color.neutral[100],
          borderRadius: tokens.radius.full,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress * 100}%`,
            background: tokens.brandGradient,
            transition: 'width 50ms linear',
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
mkdir -p src/steps/Step3AutoAnnotate
git add src/steps/Step3AutoAnnotate/InferenceProgress.tsx
git commit -m "feat: Step3 InferenceProgress (YOLOv8 + ByteTrack + focus shake)"
```

---

### Task 5.10: Step 3 — BoxRevealCanvas 框逐个浮现

**Files:**
- Create: `src/steps/Step3AutoAnnotate/BoxRevealCanvas.tsx`

> **设计依据:** spec §5.3.3 — 47 个框分布式淡入 (平均 53ms 间隔), 重点项额外抖动。

- [ ] **Step 1: 写 src/steps/Step3AutoAnnotate/BoxRevealCanvas.tsx**

```tsx
import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Group, Text, Label, Tag } from 'react-konva';
import type Konva from 'konva';
import { useDemoStore } from '../../store/demoStore';
import { getDataset } from '../../data';
import { interpolateBox } from '../../lib/interpolate';
import { tokens } from '../../styles/tokens';
import { applySpeed } from '../../lib/animation/speed';
import type { Speed } from '../../types';

interface BoxRevealCanvasProps {
  speed: Speed;
  onComplete: () => void;
}

const REVEAL_START_MS = 800;     // 推理进度开始 800ms 后开始浮现
const PER_BOX_MS = 53;           // 每个框间隔

export function BoxRevealCanvas({ speed, onComplete }: BoxRevealCanvasProps) {
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const dataset = getDataset(datasetId);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageNodeRef = useRef<Konva.Image>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [revealedCount, setRevealedCount] = useState(0);

  const annotations = dataset.annotations;

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) setSize({ width: e.contentRect.width, height: e.contentRect.height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // 视频静止显示首帧 (Step 3 不播放, 只渲染当前帧标注)
  useEffect(() => {
    const video = videoRef.current;
    const node = imageNodeRef.current;
    if (!video || !node) return;
    const onLoaded = () => {
      video.currentTime = 0.5; // 显示稍后第 0.5s 的画面
      node.image(video);
      node.getLayer()?.batchDraw();
    };
    video.addEventListener('loadeddata', onLoaded);
    return () => video.removeEventListener('loadeddata', onLoaded);
  }, []);

  // 揭示动画
  useEffect(() => {
    if (speed === 'instant') {
      setRevealedCount(annotations.length);
      onComplete();
      return;
    }
    setRevealedCount(0);
    const startDelay = applySpeed(REVEAL_START_MS, speed);
    const perBox = applySpeed(PER_BOX_MS, speed);
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 0; i < annotations.length; i++) {
      const t = setTimeout(() => {
        setRevealedCount((c) => Math.max(c, i + 1));
        if (i === annotations.length - 1) onComplete();
      }, startDelay + i * perBox);
      timers.push(t);
    }
    return () => timers.forEach(clearTimeout);
  }, [annotations.length, speed, onComplete]);

  const scale = size.width > 0
    ? Math.min(size.width / dataset.metadata.width, size.height / dataset.metadata.height)
    : 0;
  const stageWidth = dataset.metadata.width * scale;
  const stageHeight = dataset.metadata.height * scale;
  const offsetX = (size.width - stageWidth) / 2;
  const offsetY = (size.height - stageHeight) / 2;

  // 用每个 annotation 的第一个关键帧时间戳作为渲染时刻
  const referenceTimeMs = 500;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <video
        ref={videoRef}
        src={dataset.video_src}
        muted
        playsInline
        crossOrigin="anonymous"
        style={{ display: 'none' }}
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
          <Stage width={stageWidth} height={stageHeight}>
            <Layer listening={false}>
              <KonvaImage ref={imageNodeRef} width={stageWidth} height={stageHeight} listening={false} />
            </Layer>
            <Layer listening={false}>
              {annotations.slice(0, revealedCount).map((ann) => {
                const coords = interpolateBox(ann.keyframes, referenceTimeMs);
                const [vx, vy, vw, vh] = coords;
                const x = vx * scale;
                const y = vy * scale;
                const w = vw * scale;
                const h = vh * scale;
                const isFocus = ann.needs_review;
                const stroke = isFocus ? tokens.color.warning[500] : tokens.color.neutral[400];
                const labelText = `${ann.label_display}${ann.confidence !== null ? ' ' + ann.confidence.toFixed(2) : ''}`;

                return (
                  <Group key={ann.track_id} x={x} y={y} opacity={1}>
                    <Rect
                      width={w}
                      height={h}
                      stroke={stroke}
                      strokeWidth={isFocus ? 2 : 1.5}
                      cornerRadius={tokens.radius.sm}
                    />
                    <Label x={0} y={-18}>
                      <Tag fill={stroke} cornerRadius={3} />
                      <Text text={labelText} fontFamily="JetBrains Mono" fontSize={11} fill="#fff" padding={3} />
                    </Label>
                  </Group>
                );
              })}
            </Layer>
          </Stage>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/steps/Step3AutoAnnotate/BoxRevealCanvas.tsx
git commit -m "feat: Step3 BoxRevealCanvas — 47 boxes fade in over time"
```

---

### Task 5.11: Step 3 主视图

**Files:**
- Create: `src/steps/Step3AutoAnnotate/index.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 写 src/steps/Step3AutoAnnotate/index.tsx**

```tsx
import { useState } from 'react';
import { useDemoStore } from '../../store/demoStore';
import { getDataset } from '../../data';
import { tokens } from '../../styles/tokens';
import { applySpeed } from '../../lib/animation/speed';
import { InferenceProgress } from './InferenceProgress';
import { BoxRevealCanvas } from './BoxRevealCanvas';

export function Step3AutoAnnotate() {
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const speed = useDemoStore((s) => s.speed);
  const goToStep = useDemoStore((s) => s.goToStep);
  const dataset = getDataset(datasetId);
  const focusCount = dataset.demo_script.review_focus_ids.length;

  const [revealDone, setRevealDone] = useState(false);

  const handleComplete = () => {
    setRevealDone(true);
    // 1.5s 缓冲后自动进入 Step 4 (spec §3.3.1 step3to4Buffer)
    setTimeout(() => goToStep(4), applySpeed(1500, speed));
  };

  return (
    <div
      data-testid="step3-autoannotate"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: tokens.space[5],
        gap: tokens.space[4],
      }}
    >
      <h2 style={{ margin: 0, fontSize: 28, fontWeight: 600, color: tokens.color.neutral[900] }}>
        ③ 自动标注
      </h2>

      <InferenceProgress
        totalObjects={dataset.annotations.length}
        focusCount={focusCount}
        speed={speed}
      />

      <div
        style={{
          flex: 1,
          background: tokens.color.neutral[900],
          borderRadius: tokens.radius.md,
          overflow: 'hidden',
          minHeight: 320,
        }}
      >
        <BoxRevealCanvas speed={speed} onComplete={handleComplete} />
      </div>

      {revealDone && (
        <div
          data-testid="step3-summary"
          style={{
            padding: tokens.space[3],
            borderRadius: tokens.radius.md,
            background: tokens.color.neutral[0],
            border: `1px solid ${tokens.color.neutral[200]}`,
            fontSize: 13,
            color: tokens.color.neutral[700],
          }}
        >
          共 {dataset.annotations.length} 对象, {focusCount} 个需重点审核 → 即将进入审核
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 修改 src/App.tsx**

```tsx
import { Step3AutoAnnotate } from './steps/Step3AutoAnnotate';

{demoStep === 3 && <Step3AutoAnnotate />}
```

- [ ] **Step 3: dev 验证**

启动 dev → / → 选 city-road → 进 step 2 揭示完 → 自动进 step 3:

- 推理进度条 (~2s 完成)
- 47 个框逐渐浮现在画布上 (~3s)
- 重点项标橙色, 抖动一下
- 揭示完 1.5s 自动进 step 4

- [ ] **Step 4: 提交**

```bash
git add src/steps/Step3AutoAnnotate/index.tsx src/App.tsx
git commit -m "feat: Step3AutoAnnotate main view with auto-advance to step 4"
```

---

### Task 5.12: 副样例 meeting-room.json

**Files:**
- Create: `src/data/_generators/meeting-room-fixture.ts`
- Create: `src/data/meeting-room.json`

> **设计依据:** spec §4.3 — 副样例只做门面: 15 标注 + 2 重点项 (一个 ✓ 一个 ✗，无 ✎)。label: person + laptop。

- [ ] **Step 1: 写 _generators/meeting-room-fixture.ts**

```ts
import type { Annotation, BBox, Dataset, Keyframe } from '../../types';

const VIDEO_W = 1280;
const VIDEO_H = 720;
const DURATION = 45_000;

interface Seed {
  track_id: string;
  label_id: 'person' | 'laptop';
  label_display: string;
  confidence: number;
  start: number;
  end: number;
  startBox: BBox;
  endBox: BBox;
}

const SEEDS: Seed[] = [
  // 2 重点项
  { track_id: 'trk_p1', label_id: 'person',  label_display: '人', confidence: 0.43, start: 5_000,  end: 30_000, startBox: [200, 200, 180, 380], endBox: [220, 200, 180, 380] },
  { track_id: 'trk_l1', label_id: 'laptop',  label_display: '笔记本', confidence: 0.46, start: 0,    end: 45_000, startBox: [600, 380, 220, 140], endBox: [600, 380, 220, 140] },
  // 13 高置信
  { track_id: 'trk_p2', label_id: 'person',  label_display: '人', confidence: 0.86, start: 0, end: 45_000, startBox: [400, 180, 200, 400], endBox: [400, 180, 200, 400] },
  { track_id: 'trk_p3', label_id: 'person',  label_display: '人', confidence: 0.91, start: 0, end: 45_000, startBox: [800, 180, 200, 400], endBox: [800, 180, 200, 400] },
  { track_id: 'trk_p4', label_id: 'person',  label_display: '人', confidence: 0.88, start: 0, end: 45_000, startBox: [80, 220, 160, 360], endBox: [80, 220, 160, 360] },
  { track_id: 'trk_p5', label_id: 'person',  label_display: '人', confidence: 0.93, start: 10_000, end: 40_000, startBox: [1020, 200, 180, 400], endBox: [1020, 200, 180, 400] },
  { track_id: 'trk_l2', label_id: 'laptop',  label_display: '笔记本', confidence: 0.89, start: 0, end: 45_000, startBox: [220, 460, 220, 140], endBox: [220, 460, 220, 140] },
  { track_id: 'trk_l3', label_id: 'laptop',  label_display: '笔记本', confidence: 0.92, start: 0, end: 45_000, startBox: [820, 460, 220, 140], endBox: [820, 460, 220, 140] },
  { track_id: 'trk_l4', label_id: 'laptop',  label_display: '笔记本', confidence: 0.85, start: 0, end: 45_000, startBox: [1040, 460, 200, 140], endBox: [1040, 460, 200, 140] },
  { track_id: 'trk_l5', label_id: 'laptop',  label_display: '笔记本', confidence: 0.87, start: 0, end: 45_000, startBox: [40, 460, 160, 140], endBox: [40, 460, 160, 140] },
  { track_id: 'trk_p6', label_id: 'person',  label_display: '人', confidence: 0.82, start: 5_000, end: 35_000, startBox: [560, 200, 200, 380], endBox: [560, 200, 200, 380] },
  { track_id: 'trk_p7', label_id: 'person',  label_display: '人', confidence: 0.90, start: 8_000, end: 38_000, startBox: [380, 220, 180, 360], endBox: [380, 220, 180, 360] },
  { track_id: 'trk_p8', label_id: 'person',  label_display: '人', confidence: 0.84, start: 12_000, end: 42_000, startBox: [880, 220, 200, 380], endBox: [880, 220, 200, 380] },
  { track_id: 'trk_l6', label_id: 'laptop',  label_display: '笔记本', confidence: 0.83, start: 0, end: 45_000, startBox: [620, 580, 200, 100], endBox: [620, 580, 200, 100] },
  { track_id: 'trk_p9', label_id: 'person',  label_display: '人', confidence: 0.81, start: 0, end: 45_000, startBox: [1080, 280, 140, 320], endBox: [1080, 280, 140, 320] },
];

function gen(seed: Seed): Annotation {
  const count = 5;
  const frames: Keyframe[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const ts = Math.round(seed.start + (seed.end - seed.start) * t);
    const x = Math.round(seed.startBox[0] + (seed.endBox[0] - seed.startBox[0]) * t);
    const y = Math.round(seed.startBox[1] + (seed.endBox[1] - seed.startBox[1]) * t);
    frames.push({
      timestamp_ms: ts,
      frame_no: Math.round((ts / 1000) * 30),
      geometry: { type: 'bbox', coords: [x, y, seed.startBox[2], seed.startBox[3]] },
      is_keyframe: true,
    });
  }
  return {
    version: '2.0-demo',
    track_id: seed.track_id,
    label_id: seed.label_id,
    label_display: seed.label_display,
    source: 'machine',
    confidence: seed.confidence,
    needs_review: seed.confidence < 0.5,
    keyframes: frames,
    review: { status: 'pending', changed_frames: 0, reviewed_at: null },
  };
}

const dataset: Dataset = {
  version: '2.0-demo',
  dataset_id: 'meeting-room',
  display: '室内会议样例',
  video_src: '/mock/meeting-room/meeting_demo.mp4',
  thumb: '/mock/meeting-room/meeting_thumb.jpg',
  metadata: {
    duration_ms: DURATION,
    frame_count: 1350,
    fps: 30.0,
    width: VIDEO_W,
    height: VIDEO_H,
    codec: 'h264',
    audio_tracks: 1,
    sampled_frames: 90,
  },
  annotations: SEEDS.map(gen),
  demo_script: {
    metadata_reveal_ms: 1500,
    inference_reveal_ms: 2000,
    review_focus_ids: ['trk_p1', 'trk_l1'],
  },
};

console.log(JSON.stringify(dataset, null, 2));
```

- [ ] **Step 2: 生成 JSON**

```bash
npx tsx src/data/_generators/meeting-room-fixture.ts > src/data/meeting-room.json
node scripts/validate-fixture.mjs
```

Expected: 校验通过 (注意校验脚本里高置信宽高比的检查只针对 vehicle/pedestrian, meeting-room 的 person/laptop 不会触发那条规则; bbox 越界检查仍有效)。

如果有 bbox 越界报错, 调整 fixture 的坐标。

- [ ] **Step 3: 提交**

```bash
git add src/data/_generators/meeting-room-fixture.ts src/data/meeting-room.json
git commit -m "feat: meeting-room secondary fixture (15 annotations, 2 focus)"
```

---

### Task 5.13: 副样例 retail-cam.json

**Files:**
- Create: `src/data/_generators/retail-cam-fixture.ts`
- Create: `src/data/retail-cam.json`

- [ ] **Step 1: 写 retail-cam-fixture.ts (类似 meeting-room, 但 label 是 person + cart, 1920x1080, 60s)**

```ts
import type { Annotation, BBox, Dataset, Keyframe } from '../../types';

const VIDEO_W = 1920;
const VIDEO_H = 1080;
const DURATION = 60_000;

interface Seed {
  track_id: string;
  label_id: 'person' | 'cart';
  label_display: string;
  confidence: number;
  start: number;
  end: number;
  startBox: BBox;
  endBox: BBox;
}

const SEEDS: Seed[] = [
  // 2 重点项
  { track_id: 'trk_p1', label_id: 'person', label_display: '顾客', confidence: 0.42, start: 8_000, end: 50_000, startBox: [400, 480, 180, 480], endBox: [800, 480, 180, 480] },
  { track_id: 'trk_c1', label_id: 'cart',   label_display: '购物车', confidence: 0.47, start: 5_000, end: 45_000, startBox: [600, 700, 200, 240], endBox: [900, 700, 200, 240] },
  // 13 高置信
  { track_id: 'trk_p2', label_id: 'person', label_display: '顾客', confidence: 0.91, start: 0, end: 60_000, startBox: [1200, 500, 200, 480], endBox: [1200, 500, 200, 480] },
  { track_id: 'trk_p3', label_id: 'person', label_display: '顾客', confidence: 0.86, start: 0, end: 60_000, startBox: [1500, 500, 180, 480], endBox: [1500, 500, 180, 480] },
  { track_id: 'trk_p4', label_id: 'person', label_display: '顾客', confidence: 0.88, start: 10_000, end: 55_000, startBox: [200, 500, 180, 480], endBox: [200, 500, 180, 480] },
  { track_id: 'trk_p5', label_id: 'person', label_display: '顾客', confidence: 0.93, start: 0, end: 60_000, startBox: [1700, 500, 160, 480], endBox: [1700, 500, 160, 480] },
  { track_id: 'trk_c2', label_id: 'cart',   label_display: '购物车', confidence: 0.89, start: 0, end: 60_000, startBox: [1300, 720, 220, 240], endBox: [1300, 720, 220, 240] },
  { track_id: 'trk_c3', label_id: 'cart',   label_display: '购物车', confidence: 0.92, start: 0, end: 60_000, startBox: [200, 720, 200, 240], endBox: [200, 720, 200, 240] },
  { track_id: 'trk_c4', label_id: 'cart',   label_display: '购物车', confidence: 0.85, start: 0, end: 60_000, startBox: [1500, 760, 200, 240], endBox: [1500, 760, 200, 240] },
  { track_id: 'trk_c5', label_id: 'cart',   label_display: '购物车', confidence: 0.87, start: 0, end: 60_000, startBox: [400, 740, 180, 240], endBox: [400, 740, 180, 240] },
  { track_id: 'trk_p6', label_id: 'person', label_display: '顾客', confidence: 0.82, start: 5_000, end: 50_000, startBox: [600, 500, 200, 480], endBox: [600, 500, 200, 480] },
  { track_id: 'trk_p7', label_id: 'person', label_display: '顾客', confidence: 0.84, start: 12_000, end: 55_000, startBox: [1000, 500, 180, 480], endBox: [1000, 500, 180, 480] },
  { track_id: 'trk_c6', label_id: 'cart',   label_display: '购物车', confidence: 0.83, start: 0, end: 60_000, startBox: [800, 740, 200, 240], endBox: [800, 740, 200, 240] },
  { track_id: 'trk_p8', label_id: 'person', label_display: '顾客', confidence: 0.81, start: 15_000, end: 55_000, startBox: [1380, 500, 180, 480], endBox: [1380, 500, 180, 480] },
  { track_id: 'trk_c7', label_id: 'cart',   label_display: '购物车', confidence: 0.86, start: 0, end: 60_000, startBox: [50, 740, 160, 240], endBox: [50, 740, 160, 240] },
];

function gen(seed: Seed): Annotation {
  const count = 5;
  const frames: Keyframe[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const ts = Math.round(seed.start + (seed.end - seed.start) * t);
    const x = Math.round(seed.startBox[0] + (seed.endBox[0] - seed.startBox[0]) * t);
    const y = Math.round(seed.startBox[1] + (seed.endBox[1] - seed.startBox[1]) * t);
    frames.push({
      timestamp_ms: ts,
      frame_no: Math.round((ts / 1000) * 30),
      geometry: { type: 'bbox', coords: [x, y, seed.startBox[2], seed.startBox[3]] },
      is_keyframe: true,
    });
  }
  return {
    version: '2.0-demo',
    track_id: seed.track_id,
    label_id: seed.label_id,
    label_display: seed.label_display,
    source: 'machine',
    confidence: seed.confidence,
    needs_review: seed.confidence < 0.5,
    keyframes: frames,
    review: { status: 'pending', changed_frames: 0, reviewed_at: null },
  };
}

const dataset: Dataset = {
  version: '2.0-demo',
  dataset_id: 'retail-cam',
  display: '商超监控样例',
  video_src: '/mock/retail-cam/retail_demo.mp4',
  thumb: '/mock/retail-cam/retail_thumb.jpg',
  metadata: {
    duration_ms: DURATION,
    frame_count: 1800,
    fps: 30.0,
    width: VIDEO_W,
    height: VIDEO_H,
    codec: 'h264',
    audio_tracks: 1,
    sampled_frames: 200,
  },
  annotations: SEEDS.map(gen),
  demo_script: {
    metadata_reveal_ms: 1500,
    inference_reveal_ms: 2500,
    review_focus_ids: ['trk_p1', 'trk_c1'],
  },
};

console.log(JSON.stringify(dataset, null, 2));
```

- [ ] **Step 2: 生成 JSON + 校验**

```bash
npx tsx src/data/_generators/retail-cam-fixture.ts > src/data/retail-cam.json
node scripts/validate-fixture.mjs
```

Expected: 三个数据集都通过校验。

- [ ] **Step 3: 提交**

```bash
git add src/data/_generators/retail-cam-fixture.ts src/data/retail-cam.json
git commit -m "feat: retail-cam secondary fixture (15 annotations, 2 focus)"
```

---

### Task 5.14: 注册副样例

**Files:**
- Modify: `src/data/index.ts`

- [ ] **Step 1: 修改 src/data/index.ts**

```ts
import type { Dataset, DatasetId } from '../types';
import { DatasetSchema } from '../types.zod';
import cityRoad from './city-road.json';
import meetingRoom from './meeting-room.json';
import retailCam from './retail-cam.json';

const cityRoadValidated = DatasetSchema.parse(cityRoad) as Dataset;
const meetingRoomValidated = DatasetSchema.parse(meetingRoom) as Dataset;
const retailCamValidated = DatasetSchema.parse(retailCam) as Dataset;

export const defaultDatasets: Record<DatasetId, Dataset> = {
  'city-road': cityRoadValidated,
  'meeting-room': meetingRoomValidated,
  'retail-cam': retailCamValidated,
};

export const defaultDatasetId: DatasetId = 'city-road';

export function getDataset(id: DatasetId): Dataset {
  return defaultDatasets[id];
}
```

- [ ] **Step 2: 生成副样例占位视频**

```bash
ffmpeg -y -f lavfi -i color=c=darkblue:s=1280x720:d=45 \
  -vf "drawtext=text='Meeting %{pts\\:hms}':x=10:y=10:fontsize=36:fontcolor=white" \
  -c:v libx264 -pix_fmt yuv420p -crf 28 -r 30 \
  public/mock/meeting-room/meeting_demo.mp4 2>&1 | tail -3

ffmpeg -y -i public/mock/meeting-room/meeting_demo.mp4 -vf "select='eq(n,0)'" -vframes 1 \
  public/mock/meeting-room/meeting_thumb.jpg 2>&1 | tail -3

ffmpeg -y -f lavfi -i color=c=darkgreen:s=1920x1080:d=60 \
  -vf "drawtext=text='Retail %{pts\\:hms}':x=10:y=10:fontsize=42:fontcolor=white" \
  -c:v libx264 -pix_fmt yuv420p -crf 28 -r 30 \
  public/mock/retail-cam/retail_demo.mp4 2>&1 | tail -3

ffmpeg -y -i public/mock/retail-cam/retail_demo.mp4 -vf "select='eq(n,0)'" -vframes 1 \
  public/mock/retail-cam/retail_thumb.jpg 2>&1 | tail -3
```

- [ ] **Step 3: 测试 + 提交**

```bash
npm run test:run -- tests/data.test.ts
git add src/data/index.ts public/mock/meeting-room/ public/mock/retail-cam/
git commit -m "feat: register meeting-room and retail-cam datasets + placeholder videos"
```

---

### Task 5.15: Day 5 验收

- [ ] **Step 1: 全部测试绿色**

Run: `npm run test:run`
Expected: 全绿。新增了 timeline / duration / Step1Upload 测试。

- [ ] **Step 2: typecheck + build**

```bash
npm run typecheck
npm run build
```

- [ ] **Step 3: 端到端走查**

启动 dev → /

- ✅ 三张样例卡片显示 (city-road / meeting-room / retail-cam) + 缩略图
- ✅ 点击 city-road → 进入 step 2 元信息揭示 (1.5s) → step 3 推理揭示 (2.5s) → 重点项标橙抖动 → step 4
- ✅ step 4 完成审核 → 跳 step 5 → 下载 zip 验证
- ✅ 重置回 step 1 → 切换到 meeting-room → 完整跑一遍 → 副样例 15 标注 + 2 重点项
- ✅ 切速度档 2x / 即时 → 揭示节奏跟随变化

- [ ] **Step 4: 提交 tag**

```bash
git tag day5-steps123-complete
```

---

## Day 5 验收清单

至此 Day 5 应满足：

- ✅ Timeline 调度器 (schedule + start + pause + resume + cancel + jumpToEnd)
- ✅ 速度档 1x / 2x / 即时 应用
- ✅ Step 1 Upload: 拖入 + 假上传 + 友好 toast 切回 city-road + 三张样例卡片
- ✅ Step 1 集成测试 (3 用例)
- ✅ Step 2 Metadata: 解析进度条 + 6 字段打字机揭示 + 自动推进
- ✅ Step 3 AutoAnnotate: YOLOv8/ByteTrack 进度 + 47 框逐个浮现 + 重点项标红抖动
- ✅ 副样例 meeting-room.json (15 标注, 2 重点项)
- ✅ 副样例 retail-cam.json (15 标注, 2 重点项)
- ✅ 副样例占位视频
- ✅ 数据集注册表更新 (3 个样例都通过 zod 校验)
- ✅ 全部样例可切换 + 全步骤可走完

下一分册: Day 6 完成控制条联动 + 自动模式 + 虚拟主讲。
