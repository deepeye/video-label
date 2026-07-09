# Step4 时间线播放进度显示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a continuous played-progress fill to the Step4 timeline while keeping the existing playhead line and event markers.

**Architecture:** This is a pure rendering enhancement inside `Step4Timeline.tsx`. The timeline will derive a `playedRatio` from `currentTimeMs / durationMs`, render a background fill bar between the base rail and the interaction layers, and keep the event markers/range bars/playhead line above it. No store, VideoStage, or export changes are needed.

**Tech Stack:** React 18, TypeScript, Zustand store state already present, Vitest, Testing Library

## Global Constraints

- Pure display enhancement only; do not change playback behavior.
- Reuse existing `currentTimeMs` and `durationMs`; do not add store fields.
- Keep the current playhead line and event marker behavior intact.
- The progress fill must sit below draft range, range events, point markers, and the playhead.
- Scope must stay inside Step4 timeline rendering and its focused tests.
- Do not touch Step5/export, VideoStage behavior, or E2E unless absolutely required.

---

## File Structure Map

### Files to Modify

- `src/steps/Step4Review/Step4Timeline.tsx` — add the played-progress visual layer.
- `tests/Step4Timeline.test.tsx` — add assertions for rendered progress width and updates.
- `tests/Step4Review.test.tsx` — optional lightweight integration assertion if needed, but only if it helps validate the shell still renders the progress layer.

### Files Not to Touch

- `src/store/demoStore.ts`
- `src/store/snapshots.ts`
- `src/steps/Step4Review/Step4VideoStage.tsx`
- `src/steps/Step5Export/*`
- `tests/e2e/*`

---

### Task 1: Add played-progress layer to the timeline

**Files:**
- Modify: `src/steps/Step4Review/Step4Timeline.tsx`
- Test: `tests/Step4Timeline.test.tsx`

**Interfaces:**
- Consumes:
  - `currentTimeMs: number`
  - `durationMs: number`
- Produces:
  - Progress element with `data-testid="timeline-played-progress"`
  - Width derived from `currentTimeMs / durationMs`

- [ ] **Step 1: Write the failing timeline rendering tests**

```tsx
it('renders a played-progress bar with width based on currentTimeMs', () => {
  render(<Step4Review />);

  act(() => {
    useDemoStore.getState().seekToMs(5000);
  });

  const progress = screen.getByTestId('timeline-played-progress');
  expect(progress).toHaveStyle({ width: '50%' });
});

it('updates the played-progress width when currentTimeMs changes', () => {
  render(<Step4Review />);

  act(() => {
    useDemoStore.getState().seekToMs(2500);
  });
  expect(screen.getByTestId('timeline-played-progress')).toHaveStyle({ width: '25%' });

  act(() => {
    useDemoStore.getState().seekToMs(7500);
  });
  expect(screen.getByTestId('timeline-played-progress')).toHaveStyle({ width: '75%' });
});
```

- [ ] **Step 2: Run the focused timeline tests and verify failure**

Run: `npm run test:run -- tests/Step4Timeline.test.tsx`
Expected: FAIL because `timeline-played-progress` does not exist yet.

- [ ] **Step 3: Add the played-progress layer below interaction overlays**

```tsx
// src/steps/Step4Review/Step4Timeline.tsx
const playedRatio = durationMs <= 0 ? 0 : clamp(currentTimeMs / durationMs, 0, 1);

<div
  data-testid="timeline-played-progress"
  style={{
    position: 'absolute',
    left: 0,
    top: '50%',
    height: 4,
    transform: 'translateY(-50%)',
    width: `${playedRatio * 100}%`,
    background: `${tokens.color.brand[400]}55`,
    pointerEvents: 'none',
  }}
/>
```

Placement rule:
- Render this immediately after the gray base rail and before draft range / range event / point marker / playhead layers.

- [ ] **Step 4: Run the focused timeline tests until they pass**

Run: `npm run test:run -- tests/Step4Timeline.test.tsx`
Expected: PASS with the new progress-bar assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/steps/Step4Review/Step4Timeline.tsx tests/Step4Timeline.test.tsx
git commit -m "feat: show playback progress on step4 timeline"
```

---

### Task 2: Sanity-check Step4 shell integration

**Files:**
- Modify: `tests/Step4Review.test.tsx` (only if needed)
- Test: `tests/Step4Review.test.tsx`, `tests/Step4Timeline.test.tsx`

**Interfaces:**
- Consumes:
  - `Step4Review`
  - `timeline-played-progress`
- Produces:
  - Focused integration confirmation that the shell still renders the progress layer correctly

- [ ] **Step 1: Add a minimal integration assertion if the shell test lacks coverage**

```tsx
it('renders the timeline progress layer in the Step4 shell', () => {
  render(<Step4Review />);
  expect(screen.getByTestId('timeline-played-progress')).toBeInTheDocument();
});
```

If `tests/Step4Timeline.test.tsx` already renders `Step4Review` and covers the progress layer well enough, skip this step and leave `tests/Step4Review.test.tsx` unchanged.

- [ ] **Step 2: Run the focused Step4 tests**

Run: `npm run test:run -- tests/Step4Timeline.test.tsx tests/Step4Review.test.tsx`
Expected: PASS with no behavior regressions.

- [ ] **Step 3: Commit**

```bash
git add tests/Step4Timeline.test.tsx tests/Step4Review.test.tsx
git commit -m "test: verify step4 timeline playback progress rendering"
```

---

## Plan Self-Review

### Spec coverage

- Add continuous progress fill — covered by Task 1.
- Keep playhead line and event markers intact — Task 1 only adds a lower visual layer, no interaction changes.
- Keep change local to Step4 timeline rendering — all tasks limited to timeline/tests.

### Placeholder scan

- No `TODO`, `TBD`, or vague “write tests” placeholders remain.
- All code-changing steps include concrete snippets.
- All verification steps include explicit commands and expected results.

### Type consistency

- Uses existing `currentTimeMs` and `durationMs` consistently.
- The new element test id is consistently named `timeline-played-progress`.
- No new store or playback interfaces are introduced.

---

Plan complete and saved to `docs/superpowers/plans/2026-06-23-step4-timeline-progress.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**