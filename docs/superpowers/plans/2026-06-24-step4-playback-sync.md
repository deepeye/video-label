# Step4 播放时间回写到时间线 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Step4 update `currentTimeMs` continuously while the video is playing so the timeline playhead and played-progress bar advance in real time.

**Architecture:** Keep the current seek-and-pause behavior intact, and add the missing reverse sync path inside `Step4VideoStage`: when `playbackState === 'playing'`, the video element will continuously write `video.currentTime` back to store `currentTimeMs`; when paused, that writeback stops. No timeline structure or export logic changes are needed.

**Tech Stack:** React 18, TypeScript, Zustand + immer, existing Step4 video/timeline components, Vitest, Testing Library

## Global Constraints

- This is a playback-sync fix, not a player rewrite.
- Keep the existing manual seek behavior: timeline/marker click still means seek + pause.
- During normal playback, both the playhead and the played-progress bar must advance via `currentTimeMs` updates.
- Prefer the existing video-frame callback / frame-watch pattern if already present; do not add a new polling loop unless truly necessary.
- Scope should stay inside Step4 video syncing and focused tests.
- Do not touch Step5/export or broader application state unless required for this fix.

---

## File Structure Map

### Files to Modify

- `src/steps/Step4Review/Step4VideoStage.tsx` — add the missing playback-time-to-store sync while `playbackState === 'playing'`.
- `tests/Step4Review.test.tsx` — add focused assertions for playback-driven time updates and paused-state stopping.
- `tests/Step4Timeline.test.tsx` — only if a tiny assertion helps prove the progress bar responds to advancing `currentTimeMs`; otherwise leave unchanged.

### Files Not to Touch

- `src/store/demoStore.ts`
- `src/steps/Step4Review/Step4Timeline.tsx`
- `src/steps/Step5Export/*`
- `tests/e2e/*`

The store already has `playbackState`, `seekToMs`, and `pendingSeekMs`; this plan should use those as-is.

---

### Task 1: Add continuous playback-time writeback in Step4VideoStage

**Files:**
- Modify: `src/steps/Step4Review/Step4VideoStage.tsx`
- Test: `tests/Step4Review.test.tsx`

**Interfaces:**
- Consumes:
  - `playbackState: 'playing' | 'paused'`
  - `setCurrentTimeMs(ms: number): void`
  - existing video seek handling (`pendingSeekMs`, `clearPendingSeek`, `play()`, `pause()`)
- Produces:
  - While playing: `video.currentTime -> currentTimeMs`
  - While paused: no continuous writeback

- [ ] **Step 1: Add the failing integration tests**

```tsx
it('updates currentTimeMs while playbackState is playing', async () => {
  render(<Step4Review />);

  const video = screen.getByTestId('step4-video-stage').querySelector('video') as HTMLVideoElement;
  let currentTime = 0;
  Object.defineProperty(video, 'currentTime', {
    configurable: true,
    get: () => currentTime,
    set: (value: number) => {
      currentTime = value;
    },
  });

  act(() => {
    useDemoStore.getState().play();
  });

  currentTime = 1.8;
  fireEvent(video, new Event('timeupdate'));

  await waitFor(() => {
    expect(useDemoStore.getState().currentTimeMs).toBe(1800);
  });
});

it('stops writing currentTimeMs once playbackState is paused', async () => {
  render(<Step4Review />);

  const video = screen.getByTestId('step4-video-stage').querySelector('video') as HTMLVideoElement;
  let currentTime = 0;
  Object.defineProperty(video, 'currentTime', {
    configurable: true,
    get: () => currentTime,
    set: (value: number) => {
      currentTime = value;
    },
  });

  act(() => {
    useDemoStore.getState().play();
  });

  currentTime = 2.4;
  fireEvent(video, new Event('timeupdate'));
  await waitFor(() => {
    expect(useDemoStore.getState().currentTimeMs).toBe(2400);
  });

  act(() => {
    useDemoStore.getState().pause();
  });

  currentTime = 3.2;
  fireEvent(video, new Event('timeupdate'));

  expect(useDemoStore.getState().currentTimeMs).toBe(2400);
});
```

- [ ] **Step 2: Run the focused Step4 integration tests and verify failure**

Run: `npm run test:run -- tests/Step4Review.test.tsx`
Expected: FAIL because playback-time writeback is not wired, so `currentTimeMs` remains stale while the video is “playing”.

- [ ] **Step 3: Add playback-time writeback using the existing frame/event path**

```tsx
// src/steps/Step4Review/Step4VideoStage.tsx
const setCurrentTimeMs = useDemoStore((s) => s.setCurrentTimeMs);

useEffect(() => {
  const video = videoRef.current;
  if (!video) {
    return;
  }

  const syncTime = () => {
    if (playbackState !== 'playing') {
      return;
    }
    setCurrentTimeMs(Math.round(video.currentTime * 1000));
  };

  video.addEventListener('timeupdate', syncTime);
  return () => {
    video.removeEventListener('timeupdate', syncTime);
  };
}, [playbackState, setCurrentTimeMs]);
```

If the repo already has a better frame-level helper (e.g. the earlier `watchVideoFrames` pattern), use that instead of `timeupdate`, but keep the same external behavior and scope.

- [ ] **Step 4: Run the focused Step4 integration tests until they pass**

Run: `npm run test:run -- tests/Step4Review.test.tsx`
Expected: PASS with playback-driven `currentTimeMs` updates and paused-state stopping verified.

- [ ] **Step 5: Commit**

```bash
git add src/steps/Step4Review/Step4VideoStage.tsx tests/Step4Review.test.tsx
git commit -m "fix: sync step4 playback time to timeline state"
```

---

### Task 2: Confirm the timeline responds to store updates during playback

**Files:**
- Modify: `tests/Step4Timeline.test.tsx` (only if needed)
- Test: `tests/Step4Timeline.test.tsx`, `tests/Step4Review.test.tsx`

**Interfaces:**
- Consumes:
  - `currentTimeMs`
  - rendered `timeline-played-progress`
  - rendered playhead line
- Produces:
  - Focused proof that advancing `currentTimeMs` changes the progress width while leaving the timeline structure intact

- [ ] **Step 1: Add a minimal responsive-progress assertion if coverage is missing**

```tsx
it('played progress responds to store-driven playback time changes', () => {
  render(<Step4Review />);

  act(() => {
    useDemoStore.getState().setCurrentTimeMs(3000);
  });
  expect(screen.getByTestId('timeline-played-progress')).toHaveStyle({ width: '10%' });

  act(() => {
    useDemoStore.getState().setCurrentTimeMs(15000);
  });
  expect(screen.getByTestId('timeline-played-progress')).toHaveStyle({ width: '50%' });
});
```

If the existing `tests/Step4Timeline.test.tsx` already covers this adequately, skip the file change.

- [ ] **Step 2: Run the focused Step4 tests**

Run: `npm run test:run -- tests/Step4Review.test.tsx tests/Step4Timeline.test.tsx`
Expected: PASS with no regressions to seek/pause or progress rendering.

- [ ] **Step 3: Commit**

```bash
git add tests/Step4Review.test.tsx tests/Step4Timeline.test.tsx
git commit -m "test: verify timeline playback progress follows video time"
```

---

## Plan Self-Review

### Spec coverage

- Continuous playback should update `currentTimeMs` — covered by Task 1.
- Paused playback should stop updates — covered by Task 1.
- Timeline progress/playhead should advance because they read `currentTimeMs` — covered by Task 2.
- Manual seek behavior stays intact — no tasks modify timeline/store seek behavior.

### Placeholder scan

- No `TODO`, `TBD`, or vague “write tests later” placeholders remain.
- Each code-changing step includes concrete code.
- Each verification step includes an exact command and expected result.

### Type consistency

- Uses existing store API consistently: `playbackState`, `setCurrentTimeMs`, `play`, `pause`, `seekToMs`, `pendingSeekMs`.
- Keeps timeline progress element name consistent: `timeline-played-progress`.
- Limits changes to `Step4VideoStage` and focused tests as planned.

---

Plan complete and saved to `docs/superpowers/plans/2026-06-24-step4-playback-sync.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**