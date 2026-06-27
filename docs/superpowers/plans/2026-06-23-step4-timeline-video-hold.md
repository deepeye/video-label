# Step4 时间线控制视频停留 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Step4 timeline interactions seek the video to the chosen time and pause there, so timestamp markers can actually hold the video frame for inspection.

**Architecture:** Keep the current Step4 shell, timeline, and video stage, but add a minimal playback control protocol to the store: `currentTimeMs`, `playbackState`, and a monotonic seek signal. Timeline interactions will stop writing raw time directly and instead dispatch `seekToMs(ms)` + pause intent. `Step4VideoStage` will consume that signal, set `video.currentTime`, and call `pause()` or `play()` as needed.

**Tech Stack:** React 18, TypeScript, Zustand + immer, Vite, Vitest, Testing Library

## Global Constraints

- Pure frontend demo only; no backend calls and no external network dependencies.
- This is a behavior-correctness fix, not a player rewrite.
- Timeline manual interaction must win over automatic playback.
- Clicking/dragging the Step4 timeline must seek the video and leave it paused.
- Video natural playback must still update `currentTimeMs` for the timeline playhead.
- Scope stays inside Step4 store/timeline/video/test files; do not touch Step5/export logic.
- Keep the implementation minimal: no full player state machine, no scrub-preview system, no interpolation/tracking work.

---

## File Structure Map

### Files to Modify

- `src/store/snapshots.ts` — add Step4 playback defaults to the snapshot.
- `src/store/demoStore.ts` — add `playbackState`, seek signal, and play/pause/seek actions.
- `src/steps/Step4Review/index.tsx` — add a Step4-local play/pause button in the shell toolbar.
- `src/steps/Step4Review/Step4Timeline.tsx` — replace direct `setCurrentTimeMs` writes with `seekToMs` semantics.
- `src/steps/Step4Review/Step4VideoStage.tsx` — consume seek/playback signals and control `<video>`.
- `tests/store.test.ts` — add playback-state store tests.
- `tests/Step4Timeline.test.tsx` — assert timeline interactions pause via store.
- `tests/Step4Review.test.tsx` — assert shell button behavior and seek-driven pause integration.

### Files Not to Touch

- `src/steps/Step5Export/*`
- `src/lib/format/*`
- `tests/exportZip.test.ts`
- `tests/e2e/*`

This fix should stabilize Step4 behavior first; broader regression or E2E updates come after.

---

### Task 1: Add store-level seek and playback state

**Files:**
- Modify: `src/store/snapshots.ts`, `src/store/demoStore.ts`
- Test: `tests/store.test.ts`

**Interfaces:**
- Consumes: existing `currentTimeMs`, `reset()`, `createSnapshot(datasetId)`
- Produces:
  - `playbackState: 'playing' | 'paused'`
  - `pendingSeekMs: number | null`
  - `seekNonce: number`
  - `seekToMs(ms: number): void`
  - `play(): void`
  - `pause(): void`
  - `clearPendingSeek(): void`

- [ ] **Step 1: Write the failing store tests**

```ts
it('seekToMs updates currentTimeMs, queues a seek, and pauses playback', () => {
  const store = useDemoStore.getState();

  store.play();
  store.seekToMs(4200);

  const next = useDemoStore.getState();
  expect(next.currentTimeMs).toBe(4200);
  expect(next.pendingSeekMs).toBe(4200);
  expect(next.playbackState).toBe('paused');
  expect(next.seekNonce).toBeGreaterThan(0);
});

it('play and pause toggle playbackState without mutating currentTimeMs', () => {
  const store = useDemoStore.getState();

  store.seekToMs(1800);
  store.clearPendingSeek();
  store.play();
  expect(useDemoStore.getState().playbackState).toBe('playing');
  expect(useDemoStore.getState().currentTimeMs).toBe(1800);

  store.pause();
  expect(useDemoStore.getState().playbackState).toBe('paused');
  expect(useDemoStore.getState().currentTimeMs).toBe(1800);
});

it('reset restores paused playback and clears pending seek', () => {
  const store = useDemoStore.getState();

  store.seekToMs(5000);
  store.play();
  store.reset();

  const next = useDemoStore.getState();
  expect(next.currentTimeMs).toBe(0);
  expect(next.playbackState).toBe('paused');
  expect(next.pendingSeekMs).toBeNull();
  expect(next.seekNonce).toBe(0);
});
```

- [ ] **Step 2: Run the focused store tests and verify failure**

Run: `npm run test:run -- tests/store.test.ts`
Expected: FAIL with missing properties/actions like `seekToMs`, `playbackState`, or `clearPendingSeek`.

- [ ] **Step 3: Add minimal playback control state to the snapshot and store**

```ts
// src/store/snapshots.ts
export interface Snapshot {
  demoStep: DemoStep;
  speed: Speed;
  dirty: boolean;
  activeDatasetId: DatasetId;
  annotations: AnnotationState[];
  events: EventMarker[];
  selectedEventId: string | null;
  timelineTool: TimelineTool;
  revealProgress: RevealProgress;
  undoStack: ReviewAction[];
  annotationTool: AnnotationTool;
  draftPolygon: [number, number][];
  frameTags: FrameTagEntry[];
  currentTimeMs: number;
  playbackState: 'playing' | 'paused';
  pendingSeekMs: number | null;
  seekNonce: number;
}

export function createSnapshot(datasetId: DatasetId): Snapshot {
  const dataset = getDataset(datasetId);
  return {
    demoStep: 1,
    speed: '1x',
    dirty: false,
    activeDatasetId: datasetId,
    annotations: deepClone(dataset.annotations),
    events: [],
    selectedEventId: null,
    timelineTool: 'browse',
    revealProgress: {
      metadataFieldsShown: 0,
      inferenceProgress: 0,
      boxesRevealed: 0,
    },
    undoStack: [],
    annotationTool: 'select',
    draftPolygon: [],
    frameTags: [],
    currentTimeMs: 0,
    playbackState: 'paused',
    pendingSeekMs: null,
    seekNonce: 0,
  };
}
```

```ts
// src/store/demoStore.ts
export interface DemoStore extends Snapshot {
  goToStep: (step: DemoStep) => void;
  setSpeed: (s: Speed) => void;
  selectDataset: (id: DatasetId) => void;
  reset: () => void;
  seekToMs: (ms: number) => void;
  clearPendingSeek: () => void;
  play: () => void;
  pause: () => void;
  // ...existing event APIs...
}

seekToMs: (ms) =>
  set((s) => {
    s.currentTimeMs = Math.max(0, Math.round(ms));
    s.pendingSeekMs = s.currentTimeMs;
    s.seekNonce += 1;
    s.playbackState = 'paused';
  }),

clearPendingSeek: () =>
  set((s) => {
    s.pendingSeekMs = null;
  }),

play: () =>
  set((s) => {
    s.playbackState = 'playing';
  }),

pause: () =>
  set((s) => {
    s.playbackState = 'paused';
  }),
```

- [ ] **Step 4: Run the focused store tests until they pass**

Run: `npm run test:run -- tests/store.test.ts`
Expected: PASS with both existing event-store tests and the new playback-state tests green.

- [ ] **Step 5: Commit**

```bash
git add src/store/snapshots.ts src/store/demoStore.ts tests/store.test.ts
git commit -m "feat: add step4 seek and playback state"
```

---

### Task 2: Make timeline interactions dispatch seek-and-pause intent

**Files:**
- Modify: `src/steps/Step4Review/Step4Timeline.tsx`
- Test: `tests/Step4Timeline.test.tsx`

**Interfaces:**
- Consumes:
  - `seekToMs(ms: number): void`
  - `setTimelineTool(tool: TimelineTool): void`
  - `createPointEvent(timeMs: number): string`
  - `createRangeEvent(startMs: number, endMs: number): string`
- Produces:
  - Timeline clicks and marker clicks that pause by store intent instead of only moving the playhead

- [ ] **Step 1: Rewrite the failing timeline tests around pause intent**

```tsx
it('point mode click creates a point event, seeks to that time, and returns to browse mode', () => {
  render(<Step4Review />);

  fireEvent.click(screen.getByRole('button', { name: '点' }));

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

  fireEvent.click(surface, { clientX: 150, clientY: 12 });

  const state = useDemoStore.getState();
  expect(state.events).toHaveLength(1);
  expect(state.currentTimeMs).toBe(15000);
  expect(state.pendingSeekMs).toBe(15000);
  expect(state.playbackState).toBe('paused');
  expect(state.timelineTool).toBe('browse');
});

it('range mode drag creates a normalized range event, seeks to the end, and pauses', () => {
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

  fireEvent.mouseDown(surface, { clientX: 240, clientY: 12 });
  fireEvent.mouseMove(surface, { clientX: 60, clientY: 12 });
  fireEvent.mouseUp(surface, { clientX: 60, clientY: 12 });

  const state = useDemoStore.getState();
  expect(state.events[0]).toMatchObject({ startMs: 6000, endMs: 24000, mode: 'range' });
  expect(state.currentTimeMs).toBe(6000);
  expect(state.playbackState).toBe('paused');
});

it('clicking an existing timeline marker seeks to its anchor and pauses playback', () => {
  const id = useDemoStore.getState().createRangeEvent(8000, 12000);
  useDemoStore.getState().play();

  render(<Step4Review />);

  fireEvent.click(screen.getByTestId(`timeline-event-${id}`));

  const state = useDemoStore.getState();
  expect(state.selectedEventId).toBe(id);
  expect(state.currentTimeMs).toBe(8000);
  expect(state.playbackState).toBe('paused');
});
```

- [ ] **Step 2: Run the focused timeline tests and verify failure**

Run: `npm run test:run -- tests/Step4Timeline.test.tsx`
Expected: FAIL because timeline still uses `setCurrentTimeMs` and does not queue seek/pause state.

- [ ] **Step 3: Replace raw time writes with `seekToMs` in the timeline**

```tsx
// src/steps/Step4Review/Step4Timeline.tsx
const seekToMs = useDemoStore((s) => s.seekToMs);

const finishRange = (endMs: number) => {
  if (!draftRange) return;
  const normalizedStart = Math.min(draftRange.startMs, endMs);
  const normalizedEnd = Math.max(draftRange.startMs, endMs);
  createRangeEvent(normalizedStart, normalizedEnd);
  seekToMs(normalizedStart);
  setDraftRange(null);
  setTimelineTool('browse');
};

onClick={(event) => {
  if (timelineTool !== 'point') return;
  const timeMs = msFromClientX(event.clientX);
  createPointEvent(timeMs);
  seekToMs(timeMs);
  setTimelineTool('browse');
}}

onClick={(clickEvent) => {
  clickEvent.stopPropagation();
  selectEvent(event.id);
  seekToMs(anchorMs);
}}
```

- [ ] **Step 4: Run the focused timeline tests until they pass**

Run: `npm run test:run -- tests/Step4Timeline.test.tsx`
Expected: PASS with seek-and-pause semantics asserted.

- [ ] **Step 5: Commit**

```bash
git add src/steps/Step4Review/Step4Timeline.tsx tests/Step4Timeline.test.tsx
git commit -m "fix: make step4 timeline seek and pause video"
```

---

### Task 3: Make the video stage consume seek/playback signals

**Files:**
- Modify: `src/steps/Step4Review/Step4VideoStage.tsx`, `tests/Step4Review.test.tsx`
- Test: `tests/Step4Review.test.tsx`

**Interfaces:**
- Consumes:
  - `currentTimeMs`
  - `pendingSeekMs`
  - `seekNonce`
  - `playbackState`
  - `clearPendingSeek(): void`
  - `pause(): void`
- Produces:
  - Video element that seeks and pauses on timeline intent
  - Play/pause side effects tied to store state

- [ ] **Step 1: Rewrite the failing integration tests around real video control**

```tsx
it('timeline-created seek updates video.currentTime and pauses playback', () => {
  const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  render(<Step4Review />);

  const timeline = screen.getByTestId('step4-timeline-surface');
  mockRect(timeline, { left: 0, top: 0, width: 1000, height: 56 });

  fireEvent.click(screen.getByRole('button', { name: '点' }));
  fireEvent.click(timeline, { clientX: 250 });

  const video = screen.getByTestId('step4-video-stage').querySelector('video') as HTMLVideoElement;
  expect(video.currentTime).toBeCloseTo(7.5, 1);
  expect(pauseSpy).toHaveBeenCalled();
  expect(useDemoStore.getState().pendingSeekMs).toBeNull();
});

it('playback button resumes video from paused seek location', () => {
  const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);

  render(<Step4Review />);
  act(() => {
    useDemoStore.getState().seekToMs(3200);
  });

  fireEvent.click(screen.getByRole('button', { name: '播放' }));

  expect(useDemoStore.getState().playbackState).toBe('playing');
  expect(playSpy).toHaveBeenCalled();
  expect(pauseSpy).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the Step4 integration tests and verify failure**

Run: `npm run test:run -- tests/Step4Review.test.tsx`
Expected: FAIL because `Step4VideoStage` does not yet consume pending seek/playback state and the shell has no play button.

- [ ] **Step 3: Make `Step4VideoStage` seek/pause on manual timeline requests**

```tsx
// src/steps/Step4Review/Step4VideoStage.tsx
const pendingSeekMs = useDemoStore((s) => s.pendingSeekMs);
const seekNonce = useDemoStore((s) => s.seekNonce);
const playbackState = useDemoStore((s) => s.playbackState);
const clearPendingSeek = useDemoStore((s) => s.clearPendingSeek);

useEffect(() => {
  const video = videoRef.current;
  if (!video || pendingSeekMs === null) {
    return;
  }

  video.currentTime = pendingSeekMs / 1000;
  video.pause();
  clearPendingSeek();
}, [pendingSeekMs, seekNonce, clearPendingSeek]);

useEffect(() => {
  const video = videoRef.current;
  if (!video) {
    return;
  }

  if (playbackState === 'playing') {
    const playResult = video.play();
    if (playResult && typeof playResult.catch === 'function') {
      void playResult.catch(() => {});
    }
    return;
  }

  video.pause();
}, [playbackState]);
```

- [ ] **Step 4: Run the Step4 integration tests until they pass**

Run: `npm run test:run -- tests/Step4Review.test.tsx`
Expected: PASS with video seek/pause integration green.

- [ ] **Step 5: Commit**

```bash
git add src/steps/Step4Review/Step4VideoStage.tsx tests/Step4Review.test.tsx
git commit -m "fix: sync step4 video element with seek state"
```

---

### Task 4: Add a shell-level play/pause button and verify end-user behavior

**Files:**
- Modify: `src/steps/Step4Review/index.tsx`, `tests/Step4Review.test.tsx`
- Test: `tests/Step4Review.test.tsx`, `tests/Step4Timeline.test.tsx`

**Interfaces:**
- Consumes:
  - `playbackState`
  - `play()`
  - `pause()`
- Produces:
  - Toolbar button with label `播放` or `暂停`

- [ ] **Step 1: Add a shell-level failing test for the play/pause button**

```tsx
it('playback button toggles between paused and playing states', () => {
  render(<Step4Review />);

  const button = screen.getByRole('button', { name: '播放' });
  fireEvent.click(button);
  expect(useDemoStore.getState().playbackState).toBe('playing');

  fireEvent.click(screen.getByRole('button', { name: '暂停' }));
  expect(useDemoStore.getState().playbackState).toBe('paused');
});
```

- [ ] **Step 2: Run the focused Step4 tests and verify failure**

Run: `npm run test:run -- tests/Step4Review.test.tsx tests/Step4Timeline.test.tsx`
Expected: FAIL because the shell does not yet expose a play/pause button.

- [ ] **Step 3: Add the play/pause button to the Step4 toolbar**

```tsx
// src/steps/Step4Review/index.tsx
const playbackState = useDemoStore((s) => s.playbackState);
const play = useDemoStore((s) => s.play);
const pause = useDemoStore((s) => s.pause);

<button
  type="button"
  onClick={() => {
    if (playbackState === 'playing') {
      pause();
      return;
    }
    play();
  }}
  style={{
    border: `1px solid ${tokens.color.neutral[300]}`,
    background: tokens.color.neutral[0],
    color: tokens.color.neutral[700],
    borderRadius: tokens.radius.pill,
    padding: `${tokens.space[1]} ${tokens.space[3]}`,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  }}
>
  {playbackState === 'playing' ? '暂停' : '播放'}
</button>
```

- [ ] **Step 4: Run the focused Step4 tests until they pass**

Run: `npm run test:run -- tests/Step4Review.test.tsx tests/Step4Timeline.test.tsx`
Expected: PASS with all Step4-focused tests green and no new failures introduced.

- [ ] **Step 5: Commit**

```bash
git add src/steps/Step4Review/index.tsx tests/Step4Review.test.tsx tests/Step4Timeline.test.tsx
git commit -m "feat: add step4 playback toggle"
```

---

## Plan Self-Review

### Spec coverage

- Timeline click should seek and pause — covered by Tasks 1–3.
- Marker click should seek and pause — covered by Task 2.
- Range creation should stop at the chosen time — covered by Task 2.
- Video stage must actually set `video.currentTime` and `pause()` — covered by Task 3.
- User needs a way to resume playback after pausing — covered by Task 4.
- Scope stays inside Step4 and tests — all tasks limited to Step4/store files.

### Placeholder scan

- No `TODO`, `TBD`, or “similar to previous task” placeholders remain.
- Every code-changing step includes concrete snippets.
- Every verification step includes an exact command and expected outcome.

### Type consistency

- Store state/action names are used consistently: `playbackState`, `pendingSeekMs`, `seekNonce`, `seekToMs`, `clearPendingSeek`, `play`, `pause`.
- Timeline and video stage both use the same seek/playback protocol.
- Test labels align with the planned shell UI labels: `点`, `范围`, `播放`, `暂停`.

---

Plan complete and saved to `docs/superpowers/plans/2026-06-23-step4-timeline-video-hold.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**