# Step4 右键新增点事件反馈增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Step4 timeline right-click point-event creation feel obviously successful by strengthening both menu click feedback and post-create visual focus.

**Architecture:** Keep the existing creation logic and store shape. Only enhance the local feedback chain across `Step4Timeline.tsx`, `Step4EventList.tsx`, and `Step4EventEditor.tsx`: stronger context-menu item hover/press states, more obvious selected event styling in the list, and guaranteed focus on the event-type control after point-event creation from the timeline menu.

**Tech Stack:** React 18, TypeScript, Zustand store state already present, Vitest, Testing Library

## Global Constraints

- Feedback enhancement only; do not change event creation semantics or store structure.
- Right-click point-event creation must keep working exactly as it does now.
- Context menu items must remain `menuitem`-based and stay inside the viewport.
- The new feedback should come from local UI emphasis, not a global toast system.
- Scope stays inside Step4 timeline/list/editor and focused tests.
- Do not touch Step5/export, VideoStage behavior, or E2E unless strictly needed.

---

## File Structure Map

### Files to Modify

- `src/steps/Step4Review/Step4Timeline.tsx` — strengthen right-click menu item feedback and optionally tag newly created point events for stronger selected styling.
- `src/steps/Step4Review/Step4EventList.tsx` — make the selected event card visibly stronger.
- `src/steps/Step4Review/Step4EventEditor.tsx` — guarantee focus lands on the event-type control after point-event creation.
- `tests/Step4Timeline.test.tsx` — verify menu items exist with the correct accessible roles and that point-event creation closes the menu and selects the event.
- `tests/Step4Review.test.tsx` — verify the newly created event is visibly selected and the event-type control receives focus.

### Files Not to Touch

- `src/store/demoStore.ts`
- `src/steps/Step4Review/Step4VideoStage.tsx`
- `src/steps/Step5Export/*`
- `tests/e2e/*`

---

### Task 1: Strengthen context-menu interaction feedback

**Files:**
- Modify: `src/steps/Step4Review/Step4Timeline.tsx`
- Test: `tests/Step4Timeline.test.tsx`

**Interfaces:**
- Consumes:
  - local context menu render block in `Step4Timeline`
  - existing handlers `createPointEventFromContextMenu()` and `startOneShotRangeFromContextMenu()`
- Produces:
  - more obvious hover/pressable menu items for `新增点事件` and `新增区间事件`

- [ ] **Step 1: Add the failing menu-feedback test expectation**

```tsx
it('renders context-menu items as accessible menu actions', () => {
  render(<Step4Review />);

  const surface = screen.getByTestId('step4-timeline-surface');
  mockTimelineRect(surface);
  fireEvent.contextMenu(surface, { clientX: 90, clientY: 18 });

  expect(screen.getByRole('menu')).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: '新增点事件' })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: '新增区间事件' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused timeline tests and confirm the baseline**

Run: `npm run test:run -- tests/Step4Timeline.test.tsx`
Expected: PASS or near-pass, proving the menu exists before styling changes. This is the guard before touching styles.

- [ ] **Step 3: Strengthen the menu item visual feedback only**

```tsx
// src/steps/Step4Review/Step4Timeline.tsx
const menuItemStyle = {
  border: 'none',
  background: 'transparent',
  textAlign: 'left' as const,
  padding: '10px 12px',
  borderRadius: tokens.radius.sm,
  color: tokens.color.neutral[900],
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
};

// on both menuitem buttons
onMouseEnter={(event) => {
  event.currentTarget.style.background = tokens.color.brand[50];
}}
onMouseLeave={(event) => {
  event.currentTarget.style.background = 'transparent';
}}
onMouseDown={(event) => {
  event.currentTarget.style.background = tokens.color.brand[100];
}}
onMouseUp={(event) => {
  event.currentTarget.style.background = tokens.color.brand[50];
}}
```

Keep this local and simple. Do not introduce new CSS files or global classes.

- [ ] **Step 4: Re-run the focused timeline tests**

Run: `npm run test:run -- tests/Step4Timeline.test.tsx`
Expected: PASS with no behavioral regressions.

- [ ] **Step 5: Commit**

```bash
git add src/steps/Step4Review/Step4Timeline.tsx tests/Step4Timeline.test.tsx
git commit -m "style: strengthen step4 context menu feedback"
```

---

### Task 2: Make successful point-event creation visually obvious

**Files:**
- Modify: `src/steps/Step4Review/Step4EventList.tsx`, `src/steps/Step4Review/Step4EventEditor.tsx`, `tests/Step4Review.test.tsx`
- Test: `tests/Step4Review.test.tsx`

**Interfaces:**
- Consumes:
  - `selectedEventId`
  - event list row `aria-selected`
  - existing event-type focus ref in `Step4EventEditor`
- Produces:
  - visibly stronger selected list card
  - guaranteed focus on `事件类型` after right-click point-event creation

- [ ] **Step 1: Add failing integration assertions for selected-state feedback**

```tsx
it('right-click point creation visibly selects the new event and focuses the event type control', () => {
  render(<Step4Review />);

  const surface = screen.getByTestId('step4-timeline-surface');
  mockRect(surface, { left: 0, top: 0, width: 300, height: 24 });
  fireEvent.contextMenu(surface, { clientX: 120, clientY: 18 });
  fireEvent.click(screen.getByRole('menuitem', { name: '新增点事件' }));

  const eventRow = screen.getByTestId(/event-row-/);
  expect(eventRow).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByLabelText('事件类型')).toHaveFocus();
});
```

- [ ] **Step 2: Run the focused Step4 integration tests and verify failure or weak coverage**

Run: `npm run test:run -- tests/Step4Review.test.tsx`
Expected: FAIL or expose that the selected card styling/focus behavior is not guaranteed enough for this scenario.

- [ ] **Step 3: Strengthen selected-card contrast and guarantee type-field focus**

```tsx
// src/steps/Step4Review/Step4EventList.tsx
border: `1px solid ${selected ? tokens.color.brand[600] : tokens.color.neutral[200]}`,
background: selected ? `${tokens.color.brand[500]}14` : tokens.color.neutral[0],
boxShadow: selected ? tokens.shadow.sm : 'none',

// src/steps/Step4Review/Step4EventEditor.tsx
useEffect(() => {
  if (selectedEventId && previousSelectedRef.current !== selectedEventId) {
    requestAnimationFrame(() => {
      typeRef.current?.focus();
    });
  }
  previousSelectedRef.current = selectedEventId;
}, [selectedEventId]);
```

Use `requestAnimationFrame` so focus lands after the editor rerenders around the newly selected event.

- [ ] **Step 4: Re-run the focused Step4 integration tests**

Run: `npm run test:run -- tests/Step4Review.test.tsx`
Expected: PASS with the new event row selected and `事件类型` focused.

- [ ] **Step 5: Commit**

```bash
git add src/steps/Step4Review/Step4EventList.tsx src/steps/Step4Review/Step4EventEditor.tsx tests/Step4Review.test.tsx
git commit -m "feat: emphasize selected step4 events after context menu creation"
```

---

## Plan Self-Review

### Spec coverage

- Menu click feedback strengthened — covered by Task 1.
- New point event visibly selected in the right rail — covered by Task 2.
- Event-type control focused after creation — covered by Task 2.
- No store or export changes — task scope remains inside timeline/list/editor/tests.

### Placeholder scan

- No `TODO`, `TBD`, or vague placeholders remain.
- Each code-changing step includes concrete code.
- Each verification step includes exact commands and expected outcomes.

### Type consistency

- Uses existing `selectedEventId`, `menuitem`, and `typeRef` patterns consistently.
- Keeps accessible roles aligned with the current timeline menu implementation.

---

Plan complete and saved to `docs/superpowers/plans/2026-06-24-step4-context-menu-feedback.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**