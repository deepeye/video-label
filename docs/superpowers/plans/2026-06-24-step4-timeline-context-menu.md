# Step4 时间线右键新增事件 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a timeline right-click context menu in Step4 so users can right-click any time point and create a point event immediately or start a one-off range event from that frame.

**Architecture:** Keep the existing Step4 shell, store, playback sync, and top-level mode buttons. Implement the new behavior locally inside `Step4Timeline.tsx` with a small context-menu state (`x/y/timeMs`) plus a one-shot `contextRangeStartMs` draft state; create point events directly from the menu, and create range events by capturing the right-click time as the start and finishing on the next drag release.

**Tech Stack:** React 18, TypeScript, Zustand store, existing Step4 timeline/video components, Vitest, Testing Library

## Global Constraints

- This is a timeline-entry enhancement only; do not change VideoStage or Step5/export logic.
- Right-click behavior applies only to the timeline surface, not the video area.
- The context menu must offer exactly two primary actions: `新增点事件` and `新增区间事件`.
- `新增点事件` must not depend on the current top mode.
- `新增区间事件` must use a one-shot drag state and must not permanently switch the global timeline tool.
- Existing top toolbar modes (`浏览 / 点 / 范围 / 区域`) must remain intact.
- Keep changes local to Step4 timeline and focused tests unless a tiny shell test is needed.

---

## File Structure Map

### Files to Modify

- `src/steps/Step4Review/Step4Timeline.tsx` — add right-click menu state, menu rendering, and one-shot range draft flow.
- `tests/Step4Timeline.test.tsx` — add focused tests for context-menu creation.
- `tests/Step4Review.test.tsx` — only if a small integration assertion is useful for shell-level rendering or event selection behavior.

### Files Not to Touch

- `src/store/demoStore.ts`
- `src/steps/Step4Review/Step4VideoStage.tsx`
- `src/steps/Step5Export/*`
- `tests/e2e/*`

---

### Task 1: Add timeline right-click context menu and point-event creation

**Files:**
- Modify: `src/steps/Step4Review/Step4Timeline.tsx`
- Test: `tests/Step4Timeline.test.tsx`

**Interfaces:**
- Consumes:
  - `createPointEvent(timeMs: number): string`
  - `selectEvent(id: string | null): void`
  - `seekToMs(ms: number): void`
  - `currentTimeMs`, `durationMs`
- Produces:
  - Right-click menu state: `{ x, y, timeMs } | null`
  - Context menu items `新增点事件` and `新增区间事件`

- [ ] **Step 1: Write the failing context-menu tests**

```tsx
it('shows a context menu with point and range actions on timeline right-click', () => {
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

  fireEvent.contextMenu(surface, { clientX: 150, clientY: 12 });

  expect(screen.getByRole('menu')).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: '新增点事件' })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: '新增区间事件' })).toBeInTheDocument();
});

it('creates and selects a point event from timeline right-click menu', () => {
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

  fireEvent.contextMenu(surface, { clientX: 150, clientY: 12 });
  fireEvent.click(screen.getByRole('menuitem', { name: '新增点事件' }));

  const state = useDemoStore.getState();
  expect(state.events).toHaveLength(1);
  expect(state.events[0]).toMatchObject({ mode: 'point', timeMs: 15000 });
  expect(state.selectedEventId).toBe(state.events[0]?.id);
});
```

- [ ] **Step 2: Run the focused timeline tests and verify failure**

Run: `npm run test:run -- tests/Step4Timeline.test.tsx`
Expected: FAIL because the context menu does not exist yet.

- [ ] **Step 3: Add local context-menu state and point creation**

```tsx
// src/steps/Step4Review/Step4Timeline.tsx
const [contextMenu, setContextMenu] = useState<{ x: number; y: number; timeMs: number } | null>(null);

onContextMenu={(event) => {
  event.preventDefault();
  const timeMs = msFromClientX(event.clientX);
  setContextMenu({ x: event.clientX, y: event.clientY, timeMs });
}}

{contextMenu ? (
  <div role="menu" style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y }}>
    <button
      role="menuitem"
      type="button"
      onClick={() => {
        const eventId = createPointEvent(contextMenu.timeMs);
        selectEvent(eventId);
        seekToMs(contextMenu.timeMs);
        setContextMenu(null);
      }}
    >
      新增点事件
    </button>
    <button role="menuitem" type="button">新增区间事件</button>
  </div>
) : null}
```

Also close the menu on left-click outside the menu or after action completion.

- [ ] **Step 4: Run the focused timeline tests until they pass**

Run: `npm run test:run -- tests/Step4Timeline.test.tsx`
Expected: PASS with context-menu rendering and point-event creation green.

- [ ] **Step 5: Commit**

```bash
git add src/steps/Step4Review/Step4Timeline.tsx tests/Step4Timeline.test.tsx
git commit -m "feat: add step4 timeline context menu for point events"
```

---

### Task 2: Add one-shot range creation from the right-click menu

**Files:**
- Modify: `src/steps/Step4Review/Step4Timeline.tsx`, `tests/Step4Timeline.test.tsx`
- Test: `tests/Step4Timeline.test.tsx`

**Interfaces:**
- Consumes:
  - `createRangeEvent(startMs: number, endMs: number): string`
  - `selectEvent(id: string | null): void`
  - `seekToMs(ms: number): void`
- Produces:
  - `contextRangeStartMs: number | null`
  - one-off drag flow for range creation

- [ ] **Step 1: Write the failing one-shot range tests**

```tsx
it('starts one-shot range creation from the right-clicked time', () => {
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

  fireEvent.contextMenu(surface, { clientX: 120, clientY: 12 });
  fireEvent.click(screen.getByRole('menuitem', { name: '新增区间事件' }));

  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(screen.getByText(/工具：浏览/)).toBeInTheDocument();
});

it('creates a range event after right-click range start then drag release', () => {
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

  fireEvent.contextMenu(surface, { clientX: 120, clientY: 12 });
  fireEvent.click(screen.getByRole('menuitem', { name: '新增区间事件' }));
  fireEvent.mouseMove(surface, { clientX: 210, clientY: 12 });
  fireEvent.mouseUp(surface, { clientX: 210, clientY: 12 });

  const state = useDemoStore.getState();
  expect(state.events).toHaveLength(1);
  expect(state.events[0]).toMatchObject({ mode: 'range', startMs: 12000, endMs: 21000 });
  expect(state.selectedEventId).toBe(state.events[0]?.id);
});
```

- [ ] **Step 2: Run the focused timeline tests and verify failure**

Run: `npm run test:run -- tests/Step4Timeline.test.tsx`
Expected: FAIL because the range action is not yet wired.

- [ ] **Step 3: Add one-shot range draft flow**

```tsx
// src/steps/Step4Review/Step4Timeline.tsx
const [contextRangeStartMs, setContextRangeStartMs] = useState<number | null>(null);

// in menu action
onClick={() => {
  setContextRangeStartMs(contextMenu.timeMs);
  setContextMenu(null);
}}

// mouse move uses contextRangeStartMs first
onMouseMove={(event) => {
  if (contextRangeStartMs === null && (timelineTool !== 'range' || !draftRange)) {
    return;
  }
  const endMs = msFromClientX(event.clientX);
  if (contextRangeStartMs !== null) {
    setDraftRange({ startMs: contextRangeStartMs, endMs });
    return;
  }
  setDraftRange({ ...draftRange!, endMs });
}}

onMouseUp={(event) => {
  const endMs = msFromClientX(event.clientX);
  if (contextRangeStartMs !== null) {
    const eventId = createRangeEvent(contextRangeStartMs, endMs);
    selectEvent(eventId);
    seekToMs(Math.min(contextRangeStartMs, endMs));
    setDraftRange(null);
    setContextRangeStartMs(null);
    return;
  }
  if (timelineTool === 'range') {
    finishRange(endMs);
  }
}}
```

Keep this one-shot range path separate from the permanent top-mode range path.

- [ ] **Step 4: Run the focused timeline tests until they pass**

Run: `npm run test:run -- tests/Step4Timeline.test.tsx`
Expected: PASS with both point and range right-click creation green.

- [ ] **Step 5: Commit**

```bash
git add src/steps/Step4Review/Step4Timeline.tsx tests/Step4Timeline.test.tsx
git commit -m "feat: add one-shot range creation from step4 timeline menu"
```

---

## Plan Self-Review

### Spec coverage

- Right-click timeline opens menu — covered by Task 1.
- Menu offers `新增点事件 / 新增区间事件` — covered by Task 1.
- Point event creates immediately from the right-clicked frame — covered by Task 1.
- Range event starts from the right-clicked frame and finishes on drag release — covered by Task 2.
- Existing top toolbar modes remain intact — tasks are local to the timeline and do not alter shell mode structure.

### Placeholder scan

- No `TODO`, `TBD`, or vague placeholders remain.
- All code-changing steps include concrete code.
- Every verification step includes an exact command and expected result.

### Type consistency

- Uses existing store APIs consistently: `createPointEvent`, `createRangeEvent`, `selectEvent`, `seekToMs`.
- Context menu item labels are consistent with the approved design: `新增点事件`, `新增区间事件`.
- One-shot range state is consistently named `contextRangeStartMs`.

---

Plan complete and saved to `docs/superpowers/plans/2026-06-24-step4-timeline-context-menu.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**