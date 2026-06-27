# Step4 浏览态时间线拖动预览 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users scrub the Step4 timeline in browse mode so the video seeks continuously while dragging and stays paused at the released position.

**Architecture:** Keep the existing store APIs and all event-creation flows. Add a small local `isScrubbing` state inside `Step4Timeline.tsx`; in browse mode only, left-button drag will repeatedly call the existing seek behavior to preview video position in real time, while point/range/context-menu flows stay unchanged.

**Tech Stack:** React 18, TypeScript, existing Step4 timeline/video/store setup, Vitest, Testing Library

## Global Constraints

- This is a browse-mode timeline enhancement only; do not change event-creation semantics in point/range modes.
- Reuse existing seek behavior and paused playback behavior.
- Do not add new global store fields unless absolutely necessary.
- Browse-mode drag should preview continuously and stop at the released position.
- Right-click context menu must keep working.
- Scope stays in Step4 timeline and focused tests.

---

## File Structure Map

### Files to Modify

- `src/steps/Step4Review/Step4Timeline.tsx` — add browse-mode scrub drag behavior.
- `tests/Step4Timeline.test.tsx` — add focused assertions for browse-mode scrub and mode isolation.
- `tests/Step4Review.test.tsx` — only if a tiny integration assertion is useful; otherwise leave untouched.

### Files Not to Touch

- `src/store/demoStore.ts`
- `src/steps/Step4Review/Step4VideoStage.tsx`
- `src/steps/Step5Export/*`
- `tests/e2e/*`

---

### Task 1: Add browse-mode scrub dragging to the timeline

**Files:**
- Modify: `src/steps/Step4Review/Step4Timeline.tsx`
- Test: `tests/Step4Timeline.test.tsx`

**Interfaces:**
- Consumes:
  - `timelineTool`
  - `setCurrentTimeMs` or existing seek pathway already used by the timeline
  - `currentTimeMs`
- Produces:
  - local state `isScrubbing`
  - browse-mode `mousedown/mousemove/mouseup` preview flow

- [ ] **Step 1: Write the failing scrub tests**

```tsx
it('browse mode drag scrubs currentTimeMs continuously and leaves the final time on mouse up', () => {
  render(<Step4Review />);

  const surface = screen.getByTestId('step4-timeline-surface');
  vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 24,
    right: 300,
    width: 300,
    height: 24,
    toJSON: () => ({}),
  });

  fireEvent.mouseDown(surface, { clientX: 60, clientY: 12, button: 0 });
  expect(useDemoStore.getState().currentTimeMs).toBe(6000);

  fireEvent.mouseMove(surface, { clientX: 150, clientY: 12, buttons: 1 });
  expect(useDemoStore.getState().currentTimeMs).toBe(15000);

  fireEvent.mouseUp(surface, { clientX: 210, clientY: 12 });
  expect(useDemoStore.getState().currentTimeMs).toBe(21000);
  expect(useDemoStore.getState().playbackState).toBe('paused');
});

it('range mode drag still creates a range event instead of scrubbing', () => {
  render(<Step4Review />);
  fireEvent.click(screen.getByRole('button', { name: '范围' }));

  const surface = screen.getByTestId('step4-timeline-surface');
  vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 24,
    right: 300,
    width: 300,
    height: 24,
    toJSON: () => ({}),
  });

  fireEvent.mouseDown(surface, { clientX: 60, clientY: 12, button: 0 });
  fireEvent.mouseMove(surface, { clientX: 150, clientY: 12, buttons: 1 });
  fireEvent.mouseUp(surface, { clientX: 210, clientY: 12 });

  const state = useDemoStore.getState();
  expect(state.events).toHaveLength(1);
  expect(state.events[0]).toMatchObject({ mode: 'range', startMs: 6000, endMs: 21000 });
});
```

- [ ] **Step 2: Run the focused timeline tests and verify failure**

Run: `npm run test:run -- tests/Step4Timeline.test.tsx`
Expected: FAIL because browse-mode drag currently does nothing except existing click behavior.

- [ ] **Step 3: Add local scrub state and browse-mode drag handling**

```tsx
// src/steps/Step4Review/Step4Timeline.tsx
const [isScrubbing, setIsScrubbing] = useState(false);

onMouseDown={(event) => {
  closeContextMenu();

  if (timelineTool === 'browse' && event.button === 0) {
    const timeMs = msFromClientX(event.clientX);
    setIsScrubbing(true);
    setCurrentTimeMs(timeMs);
    return;
  }

  if (timelineTool !== 'range') {
    return;
  }

  const startMs = msFromClientX(event.clientX);
  setDraftRange({ startMs, endMs: startMs });
  setOneShotRangeStartMs(null);
}}

onMouseMove={(event) => {
  if (isScrubbing && timelineTool === 'browse') {
    setCurrentTimeMs(msFromClientX(event.clientX));
    return;
  }

  if (!draftRange || (timelineTool !== 'range' && oneShotRangeStartMs == null)) {
    return;
  }

  const endMs = msFromClientX(event.clientX);
  setDraftRange({ ...draftRange, endMs });
}}

onMouseUp={(event) => {
  if (isScrubbing && timelineTool === 'browse') {
    setCurrentTimeMs(msFromClientX(event.clientX));
    setIsScrubbing(false);
    return;
  }

  if (!draftRange || (timelineTool !== 'range' && oneShotRangeStartMs == null)) {
    return;
  }

  finishRange(msFromClientX(event.clientX));
}}
```

Also clear `isScrubbing` on `onMouseLeave` / `window mouseup` if needed to avoid getting stuck after dragging outside the element.

- [ ] **Step 4: Run the focused timeline tests until they pass**

Run: `npm run test:run -- tests/Step4Timeline.test.tsx`
Expected: PASS with browse-mode scrub and range-mode isolation both green.

- [ ] **Step 5: Commit**

```bash
git add src/steps/Step4Review/Step4Timeline.tsx tests/Step4Timeline.test.tsx
git commit -m "feat: allow step4 timeline scrubbing in browse mode"
```

---

### Task 2: Sanity-check integration with current time readout and progress bar

**Files:**
- Modify: `tests/Step4Timeline.test.tsx` (only if needed)
- Test: `tests/Step4Timeline.test.tsx`, `tests/Step4Review.test.tsx`

**Interfaces:**
- Consumes:
  - `currentTimeMs`
  - timeline progress fill
  - highlighted current time/frame text
- Produces:
  - Confidence that scrub updates also refresh the existing readout/progress display

- [ ] **Step 1: Add a minimal assertion if coverage is missing**

```tsx
it('browse-mode scrub updates both played progress and the current time readout', () => {
  render(<Step4Review />);

  const surface = screen.getByTestId('step4-timeline-surface');
  vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 24,
    right: 300,
    width: 300,
    height: 24,
    toJSON: () => ({}),
  });

  fireEvent.mouseDown(surface, { clientX: 90, clientY: 12, button: 0 });
  fireEvent.mouseMove(surface, { clientX: 180, clientY: 12, buttons: 1 });

  expect(screen.getByTestId('timeline-played-progress')).toHaveStyle({ width: '60%' });
  expect(screen.getByText('当前时间 18.000s · 第 540 帧')).toBeInTheDocument();
});
```

If the Task 1 tests already cover this sufficiently, keep this implicit and do not add more test code.

- [ ] **Step 2: Run the focused Step4 tests**

Run: `npm run test:run -- tests/Step4Timeline.test.tsx tests/Step4Review.test.tsx`
Expected: PASS with no regressions to existing Step4 behaviors.

- [ ] **Step 3: Commit**

```bash
git add tests/Step4Timeline.test.tsx tests/Step4Review.test.tsx
git commit -m "test: verify step4 scrub updates progress and readout"
```

---

## Plan Self-Review

### Spec coverage

- Browse-mode drag should scrub in real time — covered by Task 1.
- Releasing drag should stop at final position — covered by Task 1.
- Point/range event modes must keep existing semantics — covered by Task 1 isolation test.
- Existing progress bar and time/frame readout should follow scrubbed time — covered by Task 2.

### Placeholder scan

- No `TODO`, `TBD`, or vague placeholders remain.
- Each code-changing step includes concrete code.
- Each verification step includes exact commands and expected outcomes.

### Type consistency

- Uses existing `timelineTool`, `currentTimeMs`, `draftRange`, and `setCurrentTimeMs` consistently.
- Local scrub state is consistently named `isScrubbing`.
- Keeps range-mode logic separate from browse-mode scrub logic.

---

Plan complete and saved to `docs/superpowers/plans/2026-06-24-step4-timeline-scrub.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**