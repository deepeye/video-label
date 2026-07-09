# Step4 当前时间与帧号高亮 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a prominent current time and frame readout next to the Step4 timeline so users can clearly see where they are before creating or editing events.

**Architecture:** Keep all playback, seek, and event behavior unchanged. Only enhance `Step4Timeline.tsx` to render a stronger status block derived from existing `currentTimeMs` and dataset `fps`, with focused tests that verify the displayed time/frame text updates as store time changes.

**Tech Stack:** React 18, TypeScript, Zustand store state already present, Vitest, Testing Library

## Global Constraints

- Pure UI-display enhancement only; do not change playback or timeline interaction logic.
- Place the highlighted time/frame readout beside the timeline header, not in the top toolbar.
- Show both time and frame: `当前时间 2.893s · 第 87 帧`.
- Keep the existing tool hint visible as secondary information.
- Reuse existing `currentTimeMs` and dataset `fps`; do not add store fields.
- Scope stays inside Step4 timeline rendering and focused tests.

---

## File Structure Map

### Files to Modify

- `src/steps/Step4Review/Step4Timeline.tsx` — replace the plain tool-only header text with a richer status block.
- `tests/Step4Timeline.test.tsx` — add assertions for current time/frame display and reactive updates.

### Files Not to Touch

- `src/store/demoStore.ts`
- `src/steps/Step4Review/Step4VideoStage.tsx`
- `src/steps/Step4Review/index.tsx`
- `src/steps/Step5Export/*`
- `tests/e2e/*`

---

### Task 1: Add current time and frame readout to the timeline header

**Files:**
- Modify: `src/steps/Step4Review/Step4Timeline.tsx`
- Test: `tests/Step4Timeline.test.tsx`

**Interfaces:**
- Consumes:
  - `currentTimeMs: number`
  - `durationMs: number`
  - dataset `fps`
  - `timelineTool: TimelineTool`
- Produces:
  - Prominent header text: `当前时间 {seconds}s · 第 {frame} 帧`
  - Secondary tool text: `工具：{label}`

- [ ] **Step 1: Write the failing timeline header tests**

```tsx
it('renders highlighted current time and frame beside the timeline header', () => {
  useDemoStore.getState().setCurrentTimeMs(2893);
  render(<Step4Review />);

  expect(screen.getByText('当前时间 2.893s · 第 87 帧')).toBeInTheDocument();
  expect(screen.getByText('工具：浏览')).toBeInTheDocument();
});

it('updates the highlighted time and frame when currentTimeMs changes', () => {
  render(<Step4Review />);

  act(() => {
    useDemoStore.getState().setCurrentTimeMs(1000);
  });
  expect(screen.getByText('当前时间 1.000s · 第 30 帧')).toBeInTheDocument();

  act(() => {
    useDemoStore.getState().setCurrentTimeMs(4200);
  });
  expect(screen.getByText('当前时间 4.200s · 第 126 帧')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused timeline tests and verify failure**

Run: `npm run test:run -- tests/Step4Timeline.test.tsx`
Expected: FAIL because the header currently only renders `工具：浏览/点/范围` and does not show current time/frame text.

- [ ] **Step 3: Replace the timeline header text with a current-position status block**

```tsx
// src/steps/Step4Review/Step4Timeline.tsx
const fps = getDataset(datasetId).metadata.fps;
const currentSeconds = (currentTimeMs / 1000).toFixed(3);
const currentFrame = Math.round((currentTimeMs / 1000) * fps);
const toolLabel = timelineTool === 'browse' ? '浏览' : timelineTool === 'point' ? '点' : timelineTool === 'range' ? '范围' : '区域';

<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: tokens.space[2] }}>
  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: tokens.color.neutral[400] }}>
    时间线标注
  </div>
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
    <div style={{ fontSize: 13, fontWeight: 600, color: tokens.color.neutral[800] }}>
      {`当前时间 ${currentSeconds}s · 第 ${currentFrame} 帧`}
    </div>
    <div style={{ fontSize: 12, color: tokens.color.neutral[500] }}>{`工具：${toolLabel}`}</div>
  </div>
</div>
```

Use the dataset already available in the connected timeline path; do not introduce new store state.

- [ ] **Step 4: Run the focused timeline tests until they pass**

Run: `npm run test:run -- tests/Step4Timeline.test.tsx`
Expected: PASS with the new current-time/frame assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/steps/Step4Review/Step4Timeline.tsx tests/Step4Timeline.test.tsx
git commit -m "feat: highlight current time and frame in step4 timeline"
```

---

## Plan Self-Review

### Spec coverage

- Highlight time/frame beside the timeline — covered by Task 1.
- Keep tool text visible as secondary info — covered by Task 1.
- Do not change store, playback, or seek behavior — task scope limited to timeline UI/tests.

### Placeholder scan

- No `TODO`, `TBD`, or vague placeholders remain.
- All code-changing steps include concrete code.
- Verification steps include exact commands and expected outcomes.

### Type consistency

- Uses existing `currentTimeMs`, dataset `fps`, and `timelineTool` consistently.
- Keeps text format aligned with the approved design: `当前时间 {seconds}s · 第 {frame} 帧`.

---

Plan complete and saved to `docs/superpowers/plans/2026-06-24-step4-current-time-highlight.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**