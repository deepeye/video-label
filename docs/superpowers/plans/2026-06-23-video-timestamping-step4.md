# Step4 视频打点工作台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Step4 review workstation with a video event timestamping workstation that supports point events, range events, and optional region boxes, then export those events from Step5.

**Architecture:** Keep the existing five-step demo shell, Zustand store, reset behavior, and local-video playback, but change Step4’s business model from annotation review to event markers. Split the new Step4 into focused UI units — timeline, video stage, event list, and event editor — with all writes flowing through store actions so reset, undo, and export stay deterministic.

**Tech Stack:** React 18, Vite, TypeScript, Zustand + immer, react-konva/Konva, Vitest, Testing Library, Playwright, JSZip, FileSaver

## Global Constraints

- Pure frontend demo only; no backend calls and no external network dependencies.
- Demo success is narrative credibility + zero-failure live demo + repeatable reset, not production realism.
- Replace only Step4 semantics; keep the five-step outer flow, top controls, and step shell intact.
- Support both point events and range events in the same Step4 workstation.
- Region box is optional, one rectangle per event maximum, with no tracking/interpolation/polygon support.
- Creation is timeline-first, with a right-panel fallback button.
- Event type must support preset values plus custom input.
- Reset must still rebuild state from a deep-cloned initial snapshot.
- Undo must remain available for Step4 edits.
- Keep the implementation DRY/YAGNI: do not preserve old review-only UI behaviors that are no longer exposed.

---

## File Structure Map

### Files to Modify

- `src/types.ts` — replace Step4-facing review types with event marker types that the new store/UI/export use.
- `src/store/snapshots.ts` — seed Step4 event data into the initial snapshot and replace Step4 UI defaults.
- `src/store/demoStore.ts` — replace review actions with event-marker actions, event selection, timeline mode state, region-box writes, and undo wiring.
- `src/store/undo.ts` — add undo action types for event create/update/delete and region attach/remove.
- `src/steps/Step4Review/index.tsx` — replace the current Step4 composition with the new workstation shell.
- `src/steps/Step5Export/index.tsx` — switch stats/preview/download to events-based export.
- `src/steps/Step5Export/exportZip.ts` — build zip payloads from event markers instead of annotations.
- `src/lib/format/native.ts` — serialize exported event markers into native JSON.
- `src/lib/format/cocoVideo.ts` — either remove event-incompatible COCO review assumptions or emit an event-friendly derived structure.
- `tests/store.test.ts` — replace review-store assertions with event-store assertions.
- `tests/Step4Review.test.tsx` — replace review-workbench integration assertions with event workbench assertions.
- `tests/exportZip.test.ts` — replace annotation-export assertions with event-export assertions.

### Files to Create

- `src/steps/Step4Review/Step4Timeline.tsx` — bottom timeline interaction, point/range creation, event markers, playhead.
- `src/steps/Step4Review/Step4VideoStage.tsx` — video playback surface and optional region-box drawing/highlighting.
- `src/steps/Step4Review/Step4EventList.tsx` — right-panel event list.
- `src/steps/Step4Review/Step4EventEditor.tsx` — right-panel editor form.
- `src/steps/Step4Review/eventPresets.ts` — preset event types and severity labels/colors.
- `tests/Step4Timeline.test.tsx` — focused timeline creation tests.
- `tests/Step4EventEditor.test.tsx` — focused editor writeback tests.

### Files to Delete

- `src/steps/Step4Review/BoxLayer.tsx`
- `src/steps/Step4Review/PropertyPanel.tsx`
- `src/steps/Step4Review/QueueTrack.tsx`
- `src/steps/Step4Review/keyboard.ts`

Delete these only after their replacements are green and imported by `src/steps/Step4Review/index.tsx`.

---

### Task 1: Replace Step4 data model in types, snapshots, and store

**Files:**
- Create: none
- Modify: `src/types.ts`, `src/store/snapshots.ts`, `src/store/demoStore.ts`, `src/store/undo.ts`
- Test: `tests/store.test.ts`

**Interfaces:**
- Consumes: `createSnapshot(datasetId: DatasetId): Snapshot`, `useDemoStore`
- Produces:
  - `interface EventMarker { id: string; eventType: string; customEventType: string | null; severity: 'high' | 'medium' | 'low'; tags: string[]; description: string; mode: 'point' | 'range'; timeMs: number | null; startMs: number | null; endMs: number | null; regionBox: BBox | null; regionAnchorMs: number | null; }`
  - `type TimelineTool = 'browse' | 'point' | 'range' | 'region'`
  - Store actions:
    - `createPointEvent(timeMs: number): string`
    - `createRangeEvent(startMs: number, endMs: number): string`
    - `updateEvent(id: string, patch: Partial<EventMarker>): void`
    - `deleteEvent(id: string): void`
    - `selectEvent(id: string | null): void`
    - `setTimelineTool(tool: TimelineTool): void`
    - `attachRegionBox(id: string, box: BBox, anchorMs: number): void`
    - `removeRegionBox(id: string): void`
    - `canAdvanceFromStep4(): boolean`

- [ ] **Step 1: Write the failing store tests**

```ts
it('createPointEvent adds a point event, selects it, and marks store dirty', () => {
  const store = useDemoStore.getState();
  const id = store.createPointEvent(3200);
  const created = useDemoStore.getState().events.find((event) => event.id === id);

  expect(created).toMatchObject({
    id,
    mode: 'point',
    timeMs: 3200,
    startMs: null,
    endMs: null,
    regionBox: null,
    severity: 'medium',
  });
  expect(useDemoStore.getState().selectedEventId).toBe(id);
  expect(useDemoStore.getState().dirty).toBe(true);
});

it('createRangeEvent normalizes start/end and creates a range event', () => {
  const id = useDemoStore.getState().createRangeEvent(9000, 4200);
  const created = useDemoStore.getState().events.find((event) => event.id === id)!;

  expect(created.mode).toBe('range');
  expect(created.startMs).toBe(4200);
  expect(created.endMs).toBe(9000);
  expect(created.timeMs).toBeNull();
});

it('attachRegionBox stores one region and region anchor on the selected event', () => {
  const store = useDemoStore.getState();
  const id = store.createPointEvent(1500);
  store.attachRegionBox(id, [100, 120, 80, 60], 1500);

  expect(useDemoStore.getState().events.find((event) => event.id === id)).toMatchObject({
    regionBox: [100, 120, 80, 60],
    regionAnchorMs: 1500,
  });
});

it('canAdvanceFromStep4 returns true when there is at least one event', () => {
  expect(useDemoStore.getState().canAdvanceFromStep4()).toBe(false);
  useDemoStore.getState().createPointEvent(500);
  expect(useDemoStore.getState().canAdvanceFromStep4()).toBe(true);
});

it('undo reverts create, patch, and delete event actions', () => {
  const store = useDemoStore.getState();
  const id = store.createPointEvent(1800);
  store.updateEvent(id, { description: '碰撞瞬间', severity: 'high' });
  store.deleteEvent(id);

  store.undo();
  expect(useDemoStore.getState().events.find((event) => event.id === id)).toBeTruthy();

  store.undo();
  expect(useDemoStore.getState().events.find((event) => event.id === id)?.description).toBe('');

  store.undo();
  expect(useDemoStore.getState().events.find((event) => event.id === id)).toBeUndefined();
});
```

- [ ] **Step 2: Run the failing store tests**

Run: `npm test -- --run tests/store.test.ts`
Expected: FAIL with errors like `Property 'createPointEvent' does not exist on type 'DemoStore'` and `Property 'events' does not exist on type 'Snapshot'`.

- [ ] **Step 3: Replace Step4 data types and store state with event markers**

```ts
// src/types.ts
export type TimelineTool = 'browse' | 'point' | 'range' | 'region';
export type EventSeverity = 'high' | 'medium' | 'low';

export interface EventMarker {
  id: string;
  eventType: string;
  customEventType: string | null;
  severity: EventSeverity;
  tags: string[];
  description: string;
  mode: 'point' | 'range';
  timeMs: number | null;
  startMs: number | null;
  endMs: number | null;
  regionBox: BBox | null;
  regionAnchorMs: number | null;
}
```

```ts
// src/store/snapshots.ts
export interface Snapshot {
  activeDatasetId: DatasetId;
  currentTimeMs: number;
  demoStep: DemoStep;
  dirty: boolean;
  events: EventMarker[];
  selectedEventId: string | null;
  speed: Speed;
  timelineTool: TimelineTool;
  undoStack: EventUndoAction[];
}

const INITIAL_EVENTS: Record<DatasetId, EventMarker[]> = {
  'city-road': [
    {
      id: 'evt_collision_1',
      eventType: '碰撞',
      customEventType: null,
      severity: 'high',
      tags: ['车辆', '擦碰'],
      description: '前车右后保险杠出现明显擦碰痕迹',
      mode: 'point',
      timeMs: 1700,
      startMs: null,
      endMs: null,
      regionBox: [556, 246, 318, 207],
      regionAnchorMs: 1700,
    },
    {
      id: 'evt_stop_1',
      eventType: '异常停留',
      customEventType: null,
      severity: 'medium',
      tags: ['车辆'],
      description: '车辆在路边短时停留，需要复看',
      mode: 'range',
      timeMs: null,
      startMs: 3200,
      endMs: 4700,
      regionBox: null,
      regionAnchorMs: null,
    },
  ],
  'meeting-room': [],
  'retail-cam': [],
};

export function createSnapshot(datasetId: DatasetId): Snapshot {
  return {
    demoStep: 1,
    speed: '1x',
    dirty: false,
    activeDatasetId: datasetId,
    events: deepClone(INITIAL_EVENTS[datasetId]),
    selectedEventId: null,
    timelineTool: 'browse',
    undoStack: [],
    currentTimeMs: 0,
  };
}
```

```ts
// src/store/demoStore.ts
const createEmptyEvent = (id: string): EventMarker => ({
  id,
  eventType: '',
  customEventType: null,
  severity: 'medium',
  tags: [],
  description: '',
  mode: 'point',
  timeMs: null,
  startMs: null,
  endMs: null,
  regionBox: null,
  regionAnchorMs: null,
});

createPointEvent: (timeMs) => {
  const id = `evt_${crypto.randomUUID()}`;
  set((state) => {
    state.events.push({ ...createEmptyEvent(id), mode: 'point', timeMs: Math.round(timeMs) });
    state.selectedEventId = id;
    state.timelineTool = 'browse';
    state.dirty = true;
    state.undoStack = pushUndo(state.undoStack, { type: 'create-event', eventId: id });
  });
  return id;
},

createRangeEvent: (startMs, endMs) => {
  const id = `evt_${crypto.randomUUID()}`;
  const normalizedStart = Math.min(startMs, endMs);
  const normalizedEnd = Math.max(startMs, endMs);
  set((state) => {
    state.events.push({
      ...createEmptyEvent(id),
      mode: 'range',
      timeMs: null,
      startMs: Math.round(normalizedStart),
      endMs: Math.round(normalizedEnd),
    });
    state.selectedEventId = id;
    state.timelineTool = 'browse';
    state.dirty = true;
    state.undoStack = pushUndo(state.undoStack, { type: 'create-event', eventId: id });
  });
  return id;
},

canAdvanceFromStep4: () => get().events.length > 0,
```

- [ ] **Step 4: Run the store tests until they pass**

Run: `npm test -- --run tests/store.test.ts`
Expected: PASS with the new event-store cases green.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/store/snapshots.ts src/store/demoStore.ts src/store/undo.ts tests/store.test.ts
git commit -m "feat: replace step4 review state with event markers"
```

---

### Task 2: Build preset metadata and the right-panel event list/editor

**Files:**
- Create: `src/steps/Step4Review/eventPresets.ts`, `src/steps/Step4Review/Step4EventList.tsx`, `src/steps/Step4Review/Step4EventEditor.tsx`, `tests/Step4EventEditor.test.tsx`
- Modify: `src/steps/Step4Review/index.tsx`
- Test: `tests/Step4EventEditor.test.tsx`

**Interfaces:**
- Consumes:
  - `useDemoStore((s) => s.events)`
  - `updateEvent(id: string, patch: Partial<EventMarker>): void`
  - `selectEvent(id: string | null): void`
  - `deleteEvent(id: string): void`
  - `createPointEvent(timeMs: number): string`
- Produces:
  - `EVENT_TYPE_PRESETS: readonly string[]`
  - `SEVERITY_OPTIONS: readonly { value: EventSeverity; label: string }[]`
  - `<Step4EventList events={EventMarker[]} selectedEventId={string | null} onSelect={(id) => void} />`
  - `<Step4EventEditor currentTimeMs={number} />`

- [ ] **Step 1: Write failing editor/list tests**

```tsx
it('clicking the fallback add button creates a point event at current time and focuses the editor', async () => {
  useDemoStore.getState().setCurrentTimeMs(2400);
  const user = userEvent.setup();
  render(<Step4EventEditor currentTimeMs={2400} />);

  await user.click(screen.getByRole('button', { name: '新增事件' }));

  const selected = useDemoStore.getState().selectedEventId!;
  expect(useDemoStore.getState().events.find((event) => event.id === selected)?.timeMs).toBe(2400);
  expect(screen.getByLabelText('事件类型')).toHaveFocus();
});

it('editing type, severity, tags, and description writes back to store', async () => {
  const id = useDemoStore.getState().createPointEvent(1200);
  useDemoStore.getState().selectEvent(id);
  const user = userEvent.setup();
  render(<Step4EventEditor currentTimeMs={1200} />);

  await user.selectOptions(screen.getByLabelText('事件类型'), '碰撞');
  await user.selectOptions(screen.getByLabelText('严重级别'), 'high');
  await user.type(screen.getByLabelText('标签'), '车辆{enter}擦碰{enter}');
  await user.type(screen.getByLabelText('描述'), '右后保险杠擦碰痕迹明显');

  expect(useDemoStore.getState().events.find((event) => event.id === id)).toMatchObject({
    eventType: '碰撞',
    severity: 'high',
    tags: ['车辆', '擦碰'],
    description: '右后保险杠擦碰痕迹明显',
  });
});

it('clicking an event list row selects it and highlights the row', async () => {
  const first = useDemoStore.getState().createPointEvent(1000);
  const second = useDemoStore.getState().createRangeEvent(2200, 3000);
  const user = userEvent.setup();
  render(<Step4EventList events={useDemoStore.getState().events} selectedEventId={null} onSelect={(id) => useDemoStore.getState().selectEvent(id)} />);

  await user.click(screen.getByTestId(`event-row-${second}`));
  expect(useDemoStore.getState().selectedEventId).toBe(second);
});
```

- [ ] **Step 2: Run the new editor/list tests**

Run: `npm test -- --run tests/Step4EventEditor.test.tsx`
Expected: FAIL because `Step4EventEditor`, `Step4EventList`, and `eventPresets` do not exist yet.

- [ ] **Step 3: Implement the right-panel event list/editor with preset metadata**

```ts
// src/steps/Step4Review/eventPresets.ts
export const EVENT_TYPE_PRESETS = ['碰撞', '急刹', '行人出现', '车道偏移', '异常停留', '自定义'] as const;

export const SEVERITY_OPTIONS = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
] as const;

export const SEVERITY_COLORS: Record<EventSeverity, string> = {
  high: tokens.color.danger[500],
  medium: tokens.color.warning[500],
  low: tokens.color.info[500],
};
```

```tsx
// src/steps/Step4Review/Step4EventEditor.tsx
export function Step4EventEditor({ currentTimeMs }: { currentTimeMs: number }) {
  const events = useDemoStore((s) => s.events);
  const selectedEventId = useDemoStore((s) => s.selectedEventId);
  const createPointEvent = useDemoStore((s) => s.createPointEvent);
  const updateEvent = useDemoStore((s) => s.updateEvent);
  const deleteEvent = useDemoStore((s) => s.deleteEvent);

  const selected = events.find((event) => event.id === selectedEventId) ?? null;

  const handleCreate = () => {
    const createdId = createPointEvent(currentTimeMs);
    requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>(`[data-event-type-input="${createdId}"]`)?.focus();
    });
  };

  if (!selected) {
    return <button onClick={handleCreate}>新增事件</button>;
  }

  return (
    <form>
      <label>
        事件类型
        <select
          aria-label="事件类型"
          value={selected.eventType || '自定义'}
          data-event-type-input={selected.id}
          onChange={(event) => updateEvent(selected.id, { eventType: event.target.value, customEventType: event.target.value === '自定义' ? '' : null })}
        >
          {EVENT_TYPE_PRESETS.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </label>
    </form>
  );
}
```

```tsx
// src/steps/Step4Review/Step4EventList.tsx
export function Step4EventList({ events, selectedEventId, onSelect }: Props) {
  const sorted = [...events].sort((a, b) => {
    const left = a.mode === 'point' ? a.timeMs ?? 0 : a.startMs ?? 0;
    const right = b.mode === 'point' ? b.timeMs ?? 0 : b.startMs ?? 0;
    return left - right;
  });

  return (
    <div>
      {sorted.map((event) => (
        <button
          key={event.id}
          data-testid={`event-row-${event.id}`}
          aria-pressed={event.id === selectedEventId}
          onClick={() => onSelect(event.id)}
        >
          {event.eventType || '未命名事件'}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the editor/list tests until they pass**

Run: `npm test -- --run tests/Step4EventEditor.test.tsx`
Expected: PASS with event create/edit/list selection green.

- [ ] **Step 5: Commit**

```bash
git add src/steps/Step4Review/eventPresets.ts src/steps/Step4Review/Step4EventList.tsx src/steps/Step4Review/Step4EventEditor.tsx src/steps/Step4Review/index.tsx tests/Step4EventEditor.test.tsx
git commit -m "feat: add step4 event list and editor"
```

---

### Task 3: Build the timeline-first creation workflow

**Files:**
- Create: `src/steps/Step4Review/Step4Timeline.tsx`, `tests/Step4Timeline.test.tsx`
- Modify: `src/steps/Step4Review/index.tsx`
- Test: `tests/Step4Timeline.test.tsx`

**Interfaces:**
- Consumes:
  - `events: EventMarker[]`
  - `selectedEventId: string | null`
  - `timelineTool: TimelineTool`
  - `currentTimeMs: number`
  - `createPointEvent(timeMs: number): string`
  - `createRangeEvent(startMs: number, endMs: number): string`
  - `selectEvent(id: string | null): void`
  - `setCurrentTimeMs(ms: number): void`
  - `setTimelineTool(tool: TimelineTool): void`
- Produces:
  - `<Step4Timeline durationMs={number} />`
  - Marker mapping helper `timeMsToPercent(timeMs: number, durationMs: number): number`

- [ ] **Step 1: Write failing timeline tests**

```tsx
it('point mode click creates a point event at the clicked timeline position and returns to browse mode', async () => {
  const user = userEvent.setup();
  useDemoStore.getState().setTimelineTool('point');
  render(<Step4Timeline durationMs={10000} />);

  await user.click(screen.getByTestId('step4-timeline-surface'), { clientX: 250, clientY: 20 });

  const created = useDemoStore.getState().events.at(-1)!;
  expect(created.mode).toBe('point');
  expect(created.timeMs).toBeGreaterThan(0);
  expect(useDemoStore.getState().timelineTool).toBe('browse');
});

it('range mode drag creates a normalized range event and returns to browse mode', async () => {
  useDemoStore.getState().setTimelineTool('range');
  render(<Step4Timeline durationMs={10000} />);

  const surface = screen.getByTestId('step4-timeline-surface');
  fireEvent.mouseDown(surface, { clientX: 320, clientY: 18 });
  fireEvent.mouseMove(surface, { clientX: 140, clientY: 18 });
  fireEvent.mouseUp(surface, { clientX: 140, clientY: 18 });

  const created = useDemoStore.getState().events.at(-1)!;
  expect(created.mode).toBe('range');
  expect(created.startMs).toBeLessThan(created.endMs!);
  expect(useDemoStore.getState().timelineTool).toBe('browse');
});

it('clicking an existing timeline marker selects the matching event', async () => {
  const id = useDemoStore.getState().createPointEvent(3000);
  const user = userEvent.setup();
  render(<Step4Timeline durationMs={10000} />);

  await user.click(screen.getByTestId(`timeline-event-${id}`));
  expect(useDemoStore.getState().selectedEventId).toBe(id);
});
```

- [ ] **Step 2: Run the failing timeline tests**

Run: `npm test -- --run tests/Step4Timeline.test.tsx`
Expected: FAIL because `Step4Timeline` is missing.

- [ ] **Step 3: Implement the timeline creation workflow**

```tsx
// src/steps/Step4Review/Step4Timeline.tsx
function clampTime(ms: number, durationMs: number) {
  return Math.max(0, Math.min(durationMs, Math.round(ms)));
}

function positionToTime(clientX: number, rect: DOMRect, durationMs: number) {
  const ratio = (clientX - rect.left) / rect.width;
  return clampTime(ratio * durationMs, durationMs);
}

export function Step4Timeline({ durationMs }: { durationMs: number }) {
  const events = useDemoStore((s) => s.events);
  const selectedEventId = useDemoStore((s) => s.selectedEventId);
  const timelineTool = useDemoStore((s) => s.timelineTool);
  const createPointEvent = useDemoStore((s) => s.createPointEvent);
  const createRangeEvent = useDemoStore((s) => s.createRangeEvent);
  const selectEvent = useDemoStore((s) => s.selectEvent);
  const setCurrentTimeMs = useDemoStore((s) => s.setCurrentTimeMs);
  const [dragStart, setDragStart] = useState<number | null>(null);

  return (
    <div
      data-testid="step4-timeline-surface"
      onMouseDown={(event) => {
        if (timelineTool !== 'range') return;
        const rect = event.currentTarget.getBoundingClientRect();
        setDragStart(positionToTime(event.clientX, rect, durationMs));
      }}
      onMouseUp={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const timeMs = positionToTime(event.clientX, rect, durationMs);

        if (timelineTool === 'point') {
          createPointEvent(timeMs);
          return;
        }

        if (timelineTool === 'range' && dragStart !== null) {
          createRangeEvent(dragStart, timeMs);
          setDragStart(null);
        }
      }}
      onClick={(event) => {
        if (timelineTool !== 'browse') return;
        const rect = event.currentTarget.getBoundingClientRect();
        setCurrentTimeMs(positionToTime(event.clientX, rect, durationMs));
      }}
    >
      {events.map((event) => {
        const anchor = event.mode === 'point' ? event.timeMs ?? 0 : event.startMs ?? 0;
        return (
          <button
            key={event.id}
            data-testid={`timeline-event-${event.id}`}
            aria-pressed={event.id === selectedEventId}
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              selectEvent(event.id);
              setCurrentTimeMs(anchor);
            }}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run the timeline tests until they pass**

Run: `npm test -- --run tests/Step4Timeline.test.tsx`
Expected: PASS with point-create, range-create, and marker-select cases green.

- [ ] **Step 5: Commit**

```bash
git add src/steps/Step4Review/Step4Timeline.tsx src/steps/Step4Review/index.tsx tests/Step4Timeline.test.tsx
git commit -m "feat: add step4 timeline event creation"
```

---

### Task 4: Build the video stage with optional region-box attachment

**Files:**
- Create: `src/steps/Step4Review/Step4VideoStage.tsx`
- Modify: `src/steps/Step4Review/index.tsx`, `tests/Step4Review.test.tsx`
- Delete: `src/steps/Step4Review/ReviewCanvas.tsx`, `src/steps/Step4Review/BoxLayer.tsx`
- Test: `tests/Step4Review.test.tsx`

**Interfaces:**
- Consumes:
  - `events: EventMarker[]`
  - `selectedEventId: string | null`
  - `timelineTool: TimelineTool`
  - `currentTimeMs: number`
  - `attachRegionBox(id: string, box: BBox, anchorMs: number): void`
  - `selectEvent(id: string | null): void`
- Produces:
  - `<Step4VideoStage datasetId={DatasetId} />`
  - Region-drawing surface with `data-testid="step4-video-stage"`

- [ ] **Step 1: Rewrite the Step4 integration tests around event workflow**

```tsx
it('the step4 shell renders timeline, event list, and editor instead of review controls', () => {
  render(<Step4Review />);
  expect(screen.getByTestId('step4-video-stage')).toBeInTheDocument();
  expect(screen.getByTestId('step4-timeline-surface')).toBeInTheDocument();
  expect(screen.getByText('新增事件')).toBeInTheDocument();
  expect(screen.queryByTestId('btn-accept')).not.toBeInTheDocument();
});

it('region mode drag attaches a region box to the selected event', () => {
  const id = useDemoStore.getState().createPointEvent(1700);
  useDemoStore.getState().selectEvent(id);
  useDemoStore.getState().setTimelineTool('region');
  render(<Step4Review />);

  const stage = screen.getByTestId('step4-video-stage');
  fireEvent.mouseDown(stage, { clientX: 140, clientY: 120 });
  fireEvent.mouseMove(stage, { clientX: 260, clientY: 210 });
  fireEvent.mouseUp(stage, { clientX: 260, clientY: 210 });

  expect(useDemoStore.getState().events.find((event) => event.id === id)?.regionBox).toEqual([140, 120, 120, 90]);
  expect(useDemoStore.getState().timelineTool).toBe('browse');
});

it('canAdvanceFromStep4 becomes true after creating one event', () => {
  expect(useDemoStore.getState().canAdvanceFromStep4()).toBe(false);
  useDemoStore.getState().createPointEvent(900);
  expect(useDemoStore.getState().canAdvanceFromStep4()).toBe(true);
});
```

- [ ] **Step 2: Run the Step4 integration tests and verify they fail**

Run: `npm test -- --run tests/Step4Review.test.tsx`
Expected: FAIL because `step4-video-stage` is missing and old review controls are still rendered.

- [ ] **Step 3: Replace the old review canvas with a lightweight event video stage**

```tsx
// src/steps/Step4Review/Step4VideoStage.tsx
export function Step4VideoStage() {
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const currentTimeMs = useDemoStore((s) => s.currentTimeMs);
  const events = useDemoStore((s) => s.events);
  const selectedEventId = useDemoStore((s) => s.selectedEventId);
  const timelineTool = useDemoStore((s) => s.timelineTool);
  const attachRegionBox = useDemoStore((s) => s.attachRegionBox);
  const setTimelineTool = useDemoStore((s) => s.setTimelineTool);
  const dataset = getDataset(datasetId);
  const [draftStart, setDraftStart] = useState<Point | null>(null);
  const [draftBox, setDraftBox] = useState<BBox | null>(null);

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;

  return (
    <div
      data-testid="step4-video-stage"
      onMouseDown={(event) => {
        if (timelineTool !== 'region' || !selectedEvent) return;
        setDraftStart([event.clientX, event.clientY]);
      }}
      onMouseMove={(event) => {
        if (!draftStart) return;
        setDraftBox([draftStart[0], draftStart[1], event.clientX - draftStart[0], event.clientY - draftStart[1]]);
      }}
      onMouseUp={(event) => {
        if (!draftStart || !selectedEvent) return;
        const box: BBox = [
          Math.min(draftStart[0], event.clientX),
          Math.min(draftStart[1], event.clientY),
          Math.abs(event.clientX - draftStart[0]),
          Math.abs(event.clientY - draftStart[1]),
        ];
        const anchorMs = selectedEvent.mode === 'point' ? selectedEvent.timeMs ?? currentTimeMs : selectedEvent.startMs ?? currentTimeMs;
        attachRegionBox(selectedEvent.id, box, anchorMs);
        setDraftStart(null);
        setDraftBox(null);
        setTimelineTool('browse');
      }}
    >
      <video src={dataset.video_src} muted playsInline />
      {selectedEvent?.regionBox && <div data-testid="selected-region-box" />}
      {draftBox && <div data-testid="draft-region-box" />}
    </div>
  );
}
```

- [ ] **Step 4: Run the Step4 integration tests until they pass**

Run: `npm test -- --run tests/Step4Review.test.tsx`
Expected: PASS with shell-render, region attach, and advance gating green.

- [ ] **Step 5: Commit**

```bash
git add src/steps/Step4Review/Step4VideoStage.tsx src/steps/Step4Review/index.tsx tests/Step4Review.test.tsx
git rm src/steps/Step4Review/ReviewCanvas.tsx src/steps/Step4Review/BoxLayer.tsx
git commit -m "feat: replace review canvas with step4 event video stage"
```

---

### Task 5: Compose the new Step4 workstation and remove obsolete review-only UI

**Files:**
- Modify: `src/steps/Step4Review/index.tsx`
- Delete: `src/steps/Step4Review/PropertyPanel.tsx`, `src/steps/Step4Review/QueueTrack.tsx`, `src/steps/Step4Review/keyboard.ts`
- Test: `tests/Step4Review.test.tsx`, `tests/Step4Timeline.test.tsx`, `tests/Step4EventEditor.test.tsx`

**Interfaces:**
- Consumes:
  - `<Step4VideoStage />`
  - `<Step4Timeline durationMs={number} />`
  - `<Step4EventList ... />`
  - `<Step4EventEditor currentTimeMs={number} />`
- Produces:
  - Final `Step4Review` composition with tool switcher and right-panel split layout

- [ ] **Step 1: Add a shell-level test for mode switching**

```tsx
it('mode buttons switch the active timeline tool in store', async () => {
  const user = userEvent.setup();
  render(<Step4Review />);

  await user.click(screen.getByRole('button', { name: '单点' }));
  expect(useDemoStore.getState().timelineTool).toBe('point');

  await user.click(screen.getByRole('button', { name: '时间段' }));
  expect(useDemoStore.getState().timelineTool).toBe('range');
});
```

- [ ] **Step 2: Run the focused Step4 tests and verify the new shell test fails**

Run: `npm test -- --run tests/Step4Review.test.tsx tests/Step4Timeline.test.tsx tests/Step4EventEditor.test.tsx`
Expected: FAIL because the tool-switching shell buttons are not wired yet.

- [ ] **Step 3: Compose the final Step4 workstation shell and remove obsolete review-only controls**

```tsx
// src/steps/Step4Review/index.tsx
export function Step4Review() {
  const dataset = getDataset(useDemoStore((s) => s.activeDatasetId));
  const events = useDemoStore((s) => s.events);
  const selectedEventId = useDemoStore((s) => s.selectedEventId);
  const currentTimeMs = useDemoStore((s) => s.currentTimeMs);
  const timelineTool = useDemoStore((s) => s.timelineTool);
  const setTimelineTool = useDemoStore((s) => s.setTimelineTool);
  const selectEvent = useDemoStore((s) => s.selectEvent);

  return (
    <div data-testid="step4-review" style={{ display: 'flex', minHeight: 0, flex: 1 }}>
      <section style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header>
          {(['browse', 'point', 'range', 'region'] as const).map((tool) => (
            <button key={tool} onClick={() => setTimelineTool(tool)} aria-pressed={timelineTool === tool}>
              {{ browse: '浏览', point: '单点', range: '时间段', region: '框选' }[tool]}
            </button>
          ))}
          <span>{Math.round(currentTimeMs)}ms</span>
        </header>
        <Step4VideoStage />
        <Step4Timeline durationMs={dataset.metadata.duration_ms} />
      </section>

      <aside>
        <Step4EventList events={events} selectedEventId={selectedEventId} onSelect={selectEvent} />
        <Step4EventEditor currentTimeMs={currentTimeMs} />
      </aside>
    </div>
  );
}
```

- [ ] **Step 4: Run the focused Step4 tests until they pass**

Run: `npm test -- --run tests/Step4Review.test.tsx tests/Step4Timeline.test.tsx tests/Step4EventEditor.test.tsx`
Expected: PASS with the shell, timeline, and editor interactions all green.

- [ ] **Step 5: Commit**

```bash
git add src/steps/Step4Review/index.tsx tests/Step4Review.test.tsx tests/Step4Timeline.test.tsx tests/Step4EventEditor.test.tsx
git rm src/steps/Step4Review/PropertyPanel.tsx src/steps/Step4Review/QueueTrack.tsx src/steps/Step4Review/keyboard.ts
git commit -m "refactor: compose the new step4 timestamping workstation"
```

---

### Task 6: Switch Step5 preview/export from annotations to events

**Files:**
- Modify: `src/lib/format/native.ts`, `src/lib/format/cocoVideo.ts`, `src/steps/Step5Export/index.tsx`, `src/steps/Step5Export/exportZip.ts`
- Test: `tests/exportZip.test.ts`

**Interfaces:**
- Consumes:
  - `events: EventMarker[]`
  - `dataset: Dataset`
  - `exportedAt: number`
- Produces:
  - `toNative(events: EventMarker[], dataset: Dataset, exportedAt: number): object`
  - `toCocoVideo(events: EventMarker[], dataset: Dataset, exportedAt: number): object`
  - `buildExportZip({ format, events, dataset, exportedAt }): Promise<Blob>`

- [ ] **Step 1: Rewrite the export tests around events**

```ts
it('native export includes event markers and event statistics', async () => {
  const events: EventMarker[] = [
    {
      id: 'evt_collision_1',
      eventType: '碰撞',
      customEventType: null,
      severity: 'high',
      tags: ['车辆'],
      description: '右后保险杠擦碰',
      mode: 'point',
      timeMs: 1700,
      startMs: null,
      endMs: null,
      regionBox: [556, 246, 318, 207],
      regionAnchorMs: 1700,
    },
  ];

  const blob = await buildExportZip({ format: 'native', events, dataset: getDataset('city-road'), exportedAt: 1234 });
  const zip = await JSZip.loadAsync(blob);
  const content = JSON.parse(await zip.file('annotations/native.json')!.async('string'));

  expect(content.events).toHaveLength(1);
  expect(content.events[0]).toMatchObject({ eventType: '碰撞', severity: 'high' });
});

it('step5 preview statistics show point/range totals instead of review totals', () => {
  useDemoStore.setState({
    events: [
      { ...makePointEvent('evt_1', 1000) },
      { ...makeRangeEvent('evt_2', 2000, 2800) },
    ],
  });
  render(<Step5Export />);

  expect(screen.getByText('事件总数')).toBeInTheDocument();
  expect(screen.getByText('单点事件')).toBeInTheDocument();
  expect(screen.getByText('时间段事件')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the export tests and verify they fail**

Run: `npm test -- --run tests/exportZip.test.ts`
Expected: FAIL because `buildExportZip` and `Step5Export` still expect `annotations`/`frameTags` review data.

- [ ] **Step 3: Rewire Step5 and export serializers to emit event payloads**

```ts
// src/steps/Step5Export/exportZip.ts
export interface ExportArgs {
  format: ExportFormat;
  events: EventMarker[];
  dataset: Dataset;
  exportedAt: number;
}

export async function buildExportZip(args: ExportArgs): Promise<Blob> {
  const { format, events, dataset, exportedAt } = args;
  const zip = new JSZip();
  const annFolder = zip.folder('annotations')!;

  if (format === 'native') {
    annFolder.file('native.json', JSON.stringify(toNative(events, dataset, exportedAt), null, 2));
  } else {
    annFolder.file('coco_video.json', JSON.stringify(toCocoVideo(events, dataset, exportedAt), null, 2));
  }

  zip.file('manifest.json', JSON.stringify({
    dataset_id: dataset.dataset_id,
    exported_at: exportedAt,
    statistics: {
      total: events.length,
      point: events.filter((event) => event.mode === 'point').length,
      range: events.filter((event) => event.mode === 'range').length,
      with_region: events.filter((event) => event.regionBox !== null).length,
    },
  }, null, 2));

  return zip.generateAsync({ type: 'blob' });
}
```

```ts
// src/lib/format/native.ts
export function toNative(events: EventMarker[], dataset: Dataset, exportedAt: number) {
  return {
    datasetId: dataset.dataset_id,
    videoMetadata: dataset.metadata,
    exportedAt,
    events,
  };
}
```

```tsx
// src/steps/Step5Export/index.tsx
const events = useDemoStore((s) => s.events);
const stats = useMemo(() => ({
  total: events.length,
  point: events.filter((event) => event.mode === 'point').length,
  range: events.filter((event) => event.mode === 'range').length,
  withRegion: events.filter((event) => event.regionBox !== null).length,
}), [events]);
```

- [ ] **Step 4: Run the export tests until they pass**

Run: `npm test -- --run tests/exportZip.test.ts`
Expected: PASS with event-based zip payloads and Step5 stats green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format/native.ts src/lib/format/cocoVideo.ts src/steps/Step5Export/index.tsx src/steps/Step5Export/exportZip.ts tests/exportZip.test.ts
git commit -m "feat: export step4 timestamping events from step5"
```

---

### Task 7: Update full-flow verification and remove old Step4 review assumptions

**Files:**
- Modify: `tests/e2e/full-flow.spec.ts`, `tests/e2e/canAdvance.spec.ts`
- Test: `tests/e2e/full-flow.spec.ts`, `tests/e2e/canAdvance.spec.ts`

**Interfaces:**
- Consumes:
  - Step4 buttons `浏览`, `单点`, `时间段`, `框选`
  - Timeline `data-testid="step4-timeline-surface"`
  - Video stage `data-testid="step4-video-stage"`
  - Step5 export stats labels `事件总数`, `单点事件`, `时间段事件`
- Produces:
  - E2E assertions for Step4 advance after at least one event exists

- [ ] **Step 1: Rewrite the Step4-to-Step5 e2e expectations**

```ts
await page.getByRole('button', { name: '单点' }).click();
await page.getByTestId('step4-timeline-surface').click({ position: { x: 220, y: 18 } });
await page.getByLabel('事件类型').selectOption('碰撞');
await page.getByLabel('描述').fill('右后保险杠擦碰');
await expect(page.getByRole('button', { name: '下一步' })).toBeEnabled();
await page.getByRole('button', { name: '下一步' }).click();
await expect(page.getByText('事件总数')).toBeVisible();
```

- [ ] **Step 2: Run the targeted e2e specs and verify they fail**

Run: `npm run test:e2e -- tests/e2e/canAdvance.spec.ts tests/e2e/full-flow.spec.ts`
Expected: FAIL because the old specs still look for review queue cards and accept/reject buttons.

- [ ] **Step 3: Update the e2e specs to follow the timestamping demo narrative**

```ts
// tests/e2e/canAdvance.spec.ts
await page.goto('/?step=4&speed=instant');
await expect(page.getByRole('button', { name: '下一步' })).toBeDisabled();
await page.getByRole('button', { name: '单点' }).click();
await page.getByTestId('step4-timeline-surface').click({ position: { x: 180, y: 18 } });
await expect(page.getByRole('button', { name: '下一步' })).toBeEnabled();
```

```ts
// tests/e2e/full-flow.spec.ts
await page.goto('/?step=4&speed=instant');
await page.getByRole('button', { name: '时间段' }).click();
const timeline = page.getByTestId('step4-timeline-surface');
await timeline.hover({ position: { x: 160, y: 18 } });
await page.mouse.down();
await timeline.hover({ position: { x: 300, y: 18 } });
await page.mouse.up();
await page.getByLabel('事件类型').selectOption('异常停留');
await page.getByLabel('描述').fill('车辆在画面边缘短暂停留');
await page.getByRole('button', { name: '下一步' }).click();
await expect(page.getByText('时间段事件')).toBeVisible();
```

- [ ] **Step 4: Run the targeted e2e specs until they pass**

Run: `npm run test:e2e -- tests/e2e/canAdvance.spec.ts tests/e2e/full-flow.spec.ts`
Expected: PASS with the new Step4 creation flow and Step5 export page verified end-to-end.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/canAdvance.spec.ts tests/e2e/full-flow.spec.ts
git commit -m "test: update e2e flow for step4 timestamping demo"
```

---

## Plan Self-Review

### Spec coverage

- Replace Step4 review workstation with timestamping workstation — covered by Tasks 2–5.
- Support both point and range events — covered by Tasks 1 and 3.
- Optional single region box per event — covered by Tasks 1 and 4.
- Preset + custom event type — covered by Task 2.
- Timeline-first creation with right-panel fallback — covered by Tasks 2 and 3.
- Keep reset/undo deterministic — covered by Task 1.
- Export event markers from Step5 — covered by Task 6.
- Ensure at least one event unlocks Step4 advance — covered by Tasks 1, 4, and 7.

### Placeholder scan

- No `TODO`, `TBD`, or “similar to previous task” placeholders remain.
- Every code-edit step includes explicit code snippets.
- Every test/run step includes exact commands and expected outcomes.

### Type consistency

- Store actions use the same names throughout: `createPointEvent`, `createRangeEvent`, `updateEvent`, `deleteEvent`, `selectEvent`, `setTimelineTool`, `attachRegionBox`, `canAdvanceFromStep4`.
- Event model consistently uses `EventMarker`, `TimelineTool`, `EventSeverity`, `regionBox`, and `regionAnchorMs`.
- Step5 export consistently consumes `events`, not `annotations`.

---

Plan complete and saved to `docs/superpowers/plans/2026-06-23-video-timestamping-step4.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
