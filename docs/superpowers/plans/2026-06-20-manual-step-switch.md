# Manual Step Switching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Demo 从自动推进改成主讲手动控节奏：步骤不再自动切换，顶部步骤胶囊可点击跳转，审核不再自动裁决。

**Architecture:** 保留现有五步骤页面与 store，不改数据模型，只改流程控制层。核心做法是移除 step2/step3/step4 的自动推进逻辑、停用 `VirtualPresenter` 与 `useDemoOrchestrator()` 的实际效果、让 `StepPills` 变成可点击导航，并用新的手动主路径测试替换自动演示测试。

**Tech Stack:** React 18, Zustand, react-konva, Vitest, Playwright

---

## File Structure

**Modify:**
- `src/chrome/DemoControls.tsx` — 置灰保留自动演示按钮，保留下一步/重置/速度档
- `src/chrome/StepPills.tsx` — 胶囊变成可点击步骤导航
- `src/App.tsx` — 停用 `useDemoOrchestrator()` 调用
- `src/steps/Step2Metadata/index.tsx` — 去掉自动 `goToStep(3)`
- `src/steps/Step3AutoAnnotate/index.tsx` — 去掉自动 `goToStep(4)`
- `src/steps/Step4Review/index.tsx` — 不再挂载 `VirtualPresenter`
- `tests/e2e/full-flow.spec.ts` — 改成手动主路径版本

**Delete:**
- `tests/e2e/auto-presenter.spec.ts` — 自动演示不再是产品行为
- `tests/VirtualPresenter.test.tsx` — 虚拟主讲不再挂载
- `tests/orchestrator.test.ts` — orchestrator 不再承担真实推进行为

**Create:**
- `tests/StepPills.test.tsx` — 胶囊点击跳转单测
- `tests/Step2Metadata.manual.test.tsx` — Step2 动画结束后仍停在 step2
- `tests/Step3AutoAnnotate.manual.test.tsx` — Step3 动画结束后仍停在 step3

---

### Task 1: 先锁住手动切换行为的测试

**Files:**
- Create: `tests/StepPills.test.tsx`
- Create: `tests/Step2Metadata.manual.test.tsx`
- Create: `tests/Step3AutoAnnotate.manual.test.tsx`
- Modify: `tests/e2e/full-flow.spec.ts`
- Delete: `tests/e2e/auto-presenter.spec.ts`
- Delete: `tests/VirtualPresenter.test.tsx`
- Delete: `tests/orchestrator.test.ts`

- [ ] **Step 1: 写步骤胶囊点击跳转单测**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepPills } from '@/chrome/StepPills';
import { useDemoStore } from '@/store/demoStore';

describe('StepPills manual navigation', () => {
  beforeEach(() => {
    useDemoStore.getState().selectDataset('city-road');
  });

  it('clicks step 3 pill and jumps to step 3', () => {
    render(<StepPills />);
    fireEvent.click(screen.getByTestId('step-pill-3'));
    expect(useDemoStore.getState().demoStep).toBe(3);
  });

  it('clicks step 5 pill and jumps to step 5', () => {
    render(<StepPills />);
    fireEvent.click(screen.getByTestId('step-pill-5'));
    expect(useDemoStore.getState().demoStep).toBe(5);
  });
});
```

- [ ] **Step 2: 写 Step2 停留测试**

```tsx
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { Step2Metadata } from '@/steps/Step2Metadata';
import { useDemoStore } from '@/store/demoStore';

describe('Step2 manual mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useDemoStore.getState().selectDataset('city-road');
    useDemoStore.getState().goToStep(2);
    useDemoStore.getState().setSpeed('instant');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('finishes reveal but stays on step 2', () => {
    render(<Step2Metadata />);
    vi.runAllTimers();
    expect(useDemoStore.getState().demoStep).toBe(2);
  });
});
```

- [ ] **Step 3: 写 Step3 停留测试**

```tsx
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { Step3AutoAnnotate } from '@/steps/Step3AutoAnnotate';
import { useDemoStore } from '@/store/demoStore';

describe('Step3 manual mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useDemoStore.getState().selectDataset('city-road');
    useDemoStore.getState().goToStep(3);
    useDemoStore.getState().setSpeed('instant');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('finishes reveal but stays on step 3', () => {
    render(<Step3AutoAnnotate />);
    vi.runAllTimers();
    expect(useDemoStore.getState().demoStep).toBe(3);
  });
});
```

- [ ] **Step 4: 把 E2E 改成手动主路径**

把 `tests/e2e/full-flow.spec.ts` 中的 step2/step3 进入方式改成手动点击下一步：

```ts
await page.click('[data-testid="sample-card-city-road"]');
await page.waitForSelector('[data-testid="step2-metadata"]');
// 确认仍停在 step2
await page.waitForTimeout(1500);
await expect(page.locator('[data-testid="step-view-2"]')).toBeVisible();
// 主讲手动点下一步
await page.click('[data-testid="btn-next"]');
await page.waitForSelector('[data-testid="step3-autoannotate"]');
await page.waitForTimeout(2500);
await expect(page.locator('[data-testid="step-view-3"]')).toBeVisible();
await page.click('[data-testid="btn-next"]');
await page.waitForSelector('[data-testid="step4-review"]');
```

- [ ] **Step 5: 删除不再适用的自动演示测试文件**

Run:
```bash
rm tests/e2e/auto-presenter.spec.ts tests/VirtualPresenter.test.tsx tests/orchestrator.test.ts
```

- [ ] **Step 6: 跑测试确认它们先失败**

Run:
```bash
npm run test:run -- tests/StepPills.test.tsx tests/Step2Metadata.manual.test.tsx tests/Step3AutoAnnotate.manual.test.tsx
npm run test:e2e -- tests/e2e/full-flow.spec.ts
```
Expected: FAIL（当前实现还会自动推进 / StepPills 还不可点）。

- [ ] **Step 7: Commit failing tests**

```bash
git add tests/StepPills.test.tsx tests/Step2Metadata.manual.test.tsx tests/Step3AutoAnnotate.manual.test.tsx tests/e2e/full-flow.spec.ts
git rm tests/e2e/auto-presenter.spec.ts tests/VirtualPresenter.test.tsx tests/orchestrator.test.ts
git commit -m "test: lock manual step-switching behavior before implementation"
```

---

### Task 2: 实现手动步骤切换

**Files:**
- Modify: `src/chrome/StepPills.tsx`
- Modify: `src/chrome/DemoControls.tsx`
- Modify: `src/App.tsx`
- Modify: `src/steps/Step2Metadata/index.tsx`
- Modify: `src/steps/Step3AutoAnnotate/index.tsx`
- Modify: `src/steps/Step4Review/index.tsx`

- [ ] **Step 1: 让 StepPills 可点击**

把 `src/chrome/StepPills.tsx` 里的只读 `<span>` 改成按钮，并在点击时调 `goToStep(step.id)`：

```tsx
const goToStep = useDemoStore((s) => s.goToStep);

<button
  type="button"
  data-testid={`step-pill-${step.id}`}
  onClick={() => goToStep(step.id)}
  style={{
    padding: '6px 14px',
    borderRadius: tokens.radius.full,
    border: 'none',
    background: isCurrent ? tokens.brandGradient : tokens.color.neutral[100],
    color: isCurrent ? '#fff' : isCompleted ? tokens.color.neutral[700] : tokens.color.neutral[400],
    boxShadow: isCurrent ? tokens.shadow.brand : 'none',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: isCurrent ? 600 : 500,
  }}
>
  {step.label}
  {isCompleted && <span style={{ marginLeft: 4, color: tokens.color.success[500] }}>✓</span>}
</button>
```

- [ ] **Step 2: 置灰自动演示按钮，但保留外观结构**

在 `src/chrome/DemoControls.tsx`：

```tsx
<CtrlBtn
  testid="btn-play-pause"
  onClick={() => {}}
  disabled
  title="自动演示已关闭，当前为手动演示模式"
>
  <Play size={16} />
</CtrlBtn>
```

并删除/停用这些读取：
- `playMode`
- `paused`
- `togglePlayMode`
- `pause`
- `resume`
- `isAutoActive`
- `handlePlayPause`

`btn-next` / `btn-reset` / `speed-select` 保持。

- [ ] **Step 3: 去掉 App 里的全局自动推进 hook**

把 `src/App.tsx` 里：

```tsx
useDemoOrchestrator();
```

删掉，并移除对应 import。

保留全局接管监听也没意义（没有 auto 了），一起删掉：

- 删 `isControlBar()`
- 删 `mousedown/keydown` 的 `userTakeover()` 逻辑
- 保留 `useUrlParams()` 和 `useNarrowGuard()`

- [ ] **Step 4: 去掉 Step2 自动跳转**

把 `src/steps/Step2Metadata/index.tsx` 中：

```ts
if (completedCount >= fields.length) {
  setProgressPhase('done');
  const t = setTimeout(() => goToStep(3), applySpeed(800, speed));
  return () => clearTimeout(t);
}
```

改为：

```ts
if (completedCount >= fields.length) {
  setProgressPhase('done');
}
```

并移除 `goToStep` 读取与 effect 里的定时器逻辑。

- [ ] **Step 5: 去掉 Step3 自动跳转**

把 `src/steps/Step3AutoAnnotate/index.tsx` 中：

```ts
const handleComplete = () => {
  setRevealDone(true);
  setTimeout(() => goToStep(4), applySpeed(1500, speed));
};
```

改为：

```ts
const handleComplete = () => {
  setRevealDone(true);
};
```

并移除 `goToStep` 读取。

- [ ] **Step 6: Step4 不再挂 VirtualPresenter**

把 `src/steps/Step4Review/index.tsx` 中：

```tsx
import { VirtualPresenter } from './VirtualPresenter';
import { AutoModeBadge } from '../../chrome/AutoModeBadge';
...
<VirtualPresenter />
...
<AutoModeBadge />
```

全部移除。

Step4 保留：
- `ReviewCanvas`
- `QueueTrack`
- `PropertyPanel`
- `useReviewKeyboard()`

- [ ] **Step 7: 跑测试确认通过**

Run:
```bash
npm run typecheck
npm run test:run -- tests/StepPills.test.tsx tests/Step2Metadata.manual.test.tsx tests/Step3AutoAnnotate.manual.test.tsx
npm run test:e2e -- tests/e2e/full-flow.spec.ts
```
Expected: PASS。

- [ ] **Step 8: Commit implementation**

```bash
git add src/chrome/StepPills.tsx src/chrome/DemoControls.tsx src/App.tsx src/steps/Step2Metadata/index.tsx src/steps/Step3AutoAnnotate/index.tsx src/steps/Step4Review/index.tsx
git commit -m "feat: switch demo flow to fully manual step navigation"
```

---

### Task 3: 全量回归与 release 重打包

**Files:**
- Modify: `docs/superpowers/specs/2026-06-18-video-label-demo-design.md` (可选，记录行为变更)

- [ ] **Step 1: 全量单测通过**

Run:
```bash
npm run test:run
```
Expected: 全绿。

- [ ] **Step 2: 全量 E2E 通过**

Run:
```bash
npm run test:e2e
```
Expected: 现存 E2E 全绿，且不再依赖 auto-presenter。

- [ ] **Step 3: 构建与体积检查**

Run:
```bash
npm run build
npm run size:check
```
Expected: dist < 30MB。

- [ ] **Step 4: 手工验收**

手工检查：
1. 选样例后进入 step2
2. step2 动画结束后仍停在 step2
3. 点顶部 `③标注` 胶囊直接跳 step3
4. step3 动画结束后仍停在 step3
5. 点 `下一步` 进入 step4
6. step4 无自动裁决
7. 处理完重点项后点 `下一步` 进入 step5
8. 下载 zip 成功

- [ ] **Step 5: 重新打包 release**

Run:
```bash
npm run pack:release
```
Expected: `release/video-label-demo-v0.1.0.zip` 更新。

- [ ] **Step 6: Commit / tag**

```bash
git add -u
git diff --cached --quiet || git commit -m "chore: refresh release package after manual-step-switching change"
```

---

## Self-Review

### 1. Spec coverage
- ✅ 禁用 step2→3 自动推进 → Task 2 Step 4
- ✅ 禁用 step3→4 自动推进 → Task 2 Step 5
- ✅ 禁用 step4 VirtualPresenter → Task 2 Step 6
- ✅ StepPills 可点击 → Task 2 Step 1
- ✅ 自动演示按钮置灰保留 → Task 2 Step 2
- ✅ 保留 step4 下一步门禁 → `DemoControls` 的 `canAdvanceFromStep4()` 逻辑不动

### 2. Placeholder scan
- ✅ 无 TBD/TODO
- ✅ 每个实现步骤都给了具体代码与命令
- ✅ 删除的测试文件明确列出

### 3. Type consistency
- ✅ 继续沿用 `demoStep`, `goToStep`, `canAdvanceFromStep4`
- ✅ 无新增类型，仅删减流程控制调用

---

Plan complete and saved to `docs/superpowers/plans/2026-06-20-manual-step-switch.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?