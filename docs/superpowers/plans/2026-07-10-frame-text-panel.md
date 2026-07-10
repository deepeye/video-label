# Frame Text Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Step4 sidebar event list + editor with a frame-synced text panel showing OCR parts from the current playback frame.

**Architecture:** New `FrameTextPanel` component reads `currentTimeMs` from the Zustand store, does nearest-neighbor lookup in `dataset.frame_boxes.frames`, and renders each frame's `parts[].text` as a simple list. No new store fields needed.

**Tech Stack:** React 18, Zustand, TypeScript

## Global Constraints

- Demo only, no real backend
- All data from pre-loaded mock JSON (`/mock/real/*.json`)
- Match existing code style, token system, and component patterns
- Zero external dependencies

---

### Task 1: Create FrameTextPanel component

**Files:**
- Create: `src/steps/Step4Review/FrameTextPanel.tsx`

**Interfaces:**
- Consumes: `useDemoStore` (specifically `currentTimeMs`, `activeDatasetId`, `loadingDataset`), `getDataset` from `@/data`, `tokens` from `@/styles/tokens`, `FrameEntry` from `@/types`
- Produces: `FrameTextPanel` — default-exported React component, no props

- [ ] **Step 1: Write the component**

```tsx
import { useMemo } from 'react';
import { getDataset } from '../../data';
import { useDemoStore } from '../../store/demoStore';
import { tokens } from '../../styles/tokens';
import type { FrameEntry } from '../../types';

function findClosestFrame(frames: FrameEntry[], targetMs: number): FrameEntry | null {
  if (frames.length === 0) return null;
  let closest = frames[0]!;
  let minDiff = Math.abs(closest.timestamp_ms - targetMs);
  for (let i = 1; i < frames.length; i++) {
    const diff = Math.abs(frames[i]!.timestamp_ms - targetMs);
    if (diff < minDiff) {
      minDiff = diff;
      closest = frames[i]!;
    }
  }
  return closest;
}

export function FrameTextPanel() {
  const currentTimeMs = useDemoStore((s) => s.currentTimeMs);
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const loadingDataset = useDemoStore((s) => s.loadingDataset);

  const dataset = loadingDataset ? null : getDataset(datasetId);
  const loadingDatasetError = useDemoStore((s) => s.loadingDatasetError);

  const frame = useMemo(() => {
    if (!dataset?.frame_boxes) return null;
    return findClosestFrame(dataset.frame_boxes.frames, currentTimeMs);
  }, [dataset, currentTimeMs]);

  if (loadingDataset) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space[2] }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: tokens.color.neutral[400] }}>
          画面文本
        </div>
        <div style={{ padding: tokens.space[3], borderRadius: tokens.radius.md, background: tokens.color.neutral[100], color: tokens.color.neutral[500], fontSize: 12 }}>
          加载中…
        </div>
      </div>
    );
  }

  if (loadingDatasetError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space[2] }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: tokens.color.neutral[400] }}>
          画面文本
        </div>
        <div style={{ padding: tokens.space[3], borderRadius: tokens.radius.md, background: tokens.color.danger[50], color: tokens.color.danger[500], fontSize: 12 }}>
          加载失败
        </div>
      </div>
    );
  }

  const parts = frame?.parts ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space[2] }}>
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: tokens.color.neutral[400],
        }}
      >
        画面文本
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
        {parts.length === 0 ? (
          <div
            style={{
              padding: tokens.space[3],
              borderRadius: tokens.radius.md,
              background: tokens.color.neutral[100],
              color: tokens.color.neutral[500],
              fontSize: 12,
            }}
          >
            当前画面无识别文本
          </div>
        ) : (
          parts.map((part) => (
            <div
              key={part.part_id}
              style={{
                padding: tokens.space[3],
                borderRadius: tokens.radius.md,
                background: tokens.color.neutral[0],
                border: `1px solid ${tokens.color.neutral[200]}`,
                fontSize: 13,
                color: tokens.color.neutral[700],
              }}
            >
              {part.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit src/steps/Step4Review/FrameTextPanel.tsx`
Expected: no errors

---

### Task 2: Update Step4Review index to use FrameTextPanel and remove old components

**Files:**
- Modify: `src/steps/Step4Review/index.tsx`

**Interfaces:**
- Consumes: `FrameTextPanel` from `./FrameTextPanel`
- Removes: `Step4EventList`, `Step4EventEditor` imports and usage

- [ ] **Step 1: Replace imports and aside content**

In `src/steps/Step4Review/index.tsx`, replace:

```tsx
import { Step4EventEditor } from './Step4EventEditor';
import { Step4EventList } from './Step4EventList';
```

with:

```tsx
import { FrameTextPanel } from './FrameTextPanel';
```

Then replace the aside content (the `<Step4EventList ... />` and `<Step4EventEditor />` lines) with:

```tsx
<FrameTextPanel />
```

Also remove the now-unused `sortedEvents` `useMemo` block and the `events`, `selectedEventId`, `selectEvent` selectors from the component.

- [ ] **Step 2: Verify the full file compiles**

Run: `npx tsc --noEmit`
Expected: no errors

---

### Task 3: Clean up unused files

**Files:**
- Delete: `src/steps/Step4Review/Step4EventList.tsx`
- Delete: `src/steps/Step4Review/Step4EventEditor.tsx`
- Delete: `src/steps/Step4Review/eventPresets.ts`

- [ ] **Step 1: Delete the files**

```bash
rm src/steps/Step4Review/Step4EventList.tsx
rm src/steps/Step4Review/Step4EventEditor.tsx
rm src/steps/Step4Review/eventPresets.ts
```

- [ ] **Step 2: Verify no broken imports**

Run: `npx tsc --noEmit`
Expected: no errors

---

### Task 4: Update tests

**Files:**
- Modify: `tests/Step4Review.test.tsx`
- Delete: `tests/Step4EventEditor.test.tsx`

- [ ] **Step 1: Update Step4Review test — fix the shell render assertion**

In `tests/Step4Review.test.tsx`, replace the assertion on line 72:

```tsx
expect(screen.getByText('事件列表')).toBeInTheDocument();
```

with:

```tsx
expect(screen.getByText('画面文本')).toBeInTheDocument();
```

- [ ] **Step 2: Delete the event editor test file**

```bash
rm tests/Step4EventEditor.test.tsx
```

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 4: Commit all changes**

```bash
git add src/steps/Step4Review/FrameTextPanel.tsx
git add src/steps/Step4Review/index.tsx
git rm src/steps/Step4Review/Step4EventList.tsx
git rm src/steps/Step4Review/Step4EventEditor.tsx
git rm src/steps/Step4Review/eventPresets.ts
git add tests/Step4Review.test.tsx
git rm tests/Step4EventEditor.test.tsx
git commit -m "feat: replace event list with frame-synced text panel in Step4"
```