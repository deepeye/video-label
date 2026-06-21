import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  AnnotationSource,
  AnnotationState,
  BBox,
  DatasetId,
  DemoStep,
  ReviewAction,
  Speed,
} from '../types';
import { createSnapshot, type RevealProgress, type Snapshot } from './snapshots';
import { applyUndo, pushUndo } from './undo';
import { getDataset } from '../data';

export interface DemoStore extends Snapshot {
  // ── 编排 ────────────────────────────────────────────
  goToStep: (step: DemoStep) => void;
  setSpeed: (s: Speed) => void;

  // ── 样例 / 重置 ─────────────────────────────────────
  selectDataset: (id: DatasetId) => void;
  reset: () => void;

  // ── 审核 ────────────────────────────────────────────
  acceptBox: (trackId: string) => void;
  rejectBox: (trackId: string) => void;
  correctBoxGeometry: (trackId: string, frameIdx: number, newCoords: BBox) => void;
  acceptAllRemaining: () => void;
  selectTrack: (id: string | null) => void;
  setReviewQueueIndex: (idx: number) => void;

  // ── 撤销 ────────────────────────────────────────────
  undo: () => void;

  // ── 揭示动画进度 ────────────────────────────────────
  setRevealProgress: (p: Partial<RevealProgress>) => void;

  // ── Helpers / Selectors ─────────────────────────────
  canAdvanceFromStep4: () => boolean;
}

const initial = createSnapshot('city-road');

export const useDemoStore = create<DemoStore>()(
  immer((set, get) => ({
    ...initial,

    // ── 编排 ────────────────────────────────────────────
    goToStep: (step) =>
      set((s) => {
        s.demoStep = step;
      }),

    setSpeed: (speed) =>
      set((s) => {
        s.speed = speed;
      }),

    // ── 样例 / 重置 ─────────────────────────────────────
    selectDataset: (id) => {
      const fresh = createSnapshot(id);
      // 保留 speed (CLAUDE.md 决策 #7: 同样例重演也走这条, 但 speed 保留)
      const currentSpeed = get().speed;
      set(() => ({ ...fresh, speed: currentSpeed }));
    },

    reset: () => {
      const id = get().activeDatasetId;
      const fresh = createSnapshot(id);
      const currentSpeed = get().speed;
      // 保留 activeDatasetId 与 speed (spec §2.2)
      set(() => ({ ...fresh, activeDatasetId: id, speed: currentSpeed }));
    },

    // ── 审核 ────────────────────────────────────────────
    acceptBox: (trackId) =>
      set((s) => {
        const ann = s.annotations.find((a: AnnotationState) => a.track_id === trackId);
        if (!ann) return;
        const prevStatus = ann.review.status;
        const prevSource: AnnotationSource = ann.source;
        ann.review.status = 'accepted';
        ann.review.reviewed_at = Date.now();
        s.dirty = true;
        s.undoStack = pushUndo(s.undoStack, {
          type: 'accept',
          trackId,
          prevStatus,
          prevSource,
        });
      }),

    rejectBox: (trackId) =>
      set((s) => {
        const ann = s.annotations.find((a: AnnotationState) => a.track_id === trackId);
        if (!ann) return;
        const prevStatus = ann.review.status;
        ann.review.status = 'rejected';
        ann.review.reviewed_at = Date.now();
        s.dirty = true;
        s.undoStack = pushUndo(s.undoStack, { type: 'reject', trackId, prevStatus });
      }),

    correctBoxGeometry: (trackId, frameIdx, newCoords) =>
      set((s) => {
        const ann = s.annotations.find((a: AnnotationState) => a.track_id === trackId);
        if (!ann) return;
        const kf = ann.keyframes[frameIdx];
        if (!kf) return;
        const prevCoords = [...kf.geometry.coords] as BBox;
        const prevSource: AnnotationSource = ann.source;
        kf.geometry.coords = [...newCoords] as BBox;
        ann.source = 'human';
        ann.review.status = 'corrected';
        ann.review.changed_frames += 1;
        ann.review.reviewed_at = Date.now();
        s.dirty = true;
        s.undoStack = pushUndo(s.undoStack, {
          type: 'correct-geometry',
          trackId,
          frameIdx,
          prevCoords,
          prevSource,
        });
      }),

    acceptAllRemaining: () =>
      set((s) => {
        const now = Date.now();
        for (const ann of s.annotations) {
          if (ann.review.status === 'pending') {
            ann.review.status = 'accepted';
            ann.review.reviewed_at = now;
          }
        }
        s.dirty = true;
        // 注意: 批量操作不入 undoStack (spec §2.4.2)
      }),

    selectTrack: (id) =>
      set((s) => {
        s.selectedTrackId = id;
      }),

    setReviewQueueIndex: (idx) =>
      set((s) => {
        s.reviewQueueIndex = idx;
      }),

    // ── 撤销 ────────────────────────────────────────────
    undo: () =>
      set((s) => {
        const action = s.undoStack[s.undoStack.length - 1];
        if (!action) return;
        s.undoStack = s.undoStack.slice(0, -1);
        applyUndo(s.annotations, action as ReviewAction);
        // 撤销 correct-geometry 时, 如果该 track 没有其他 correct 操作, 把 status 恢复成 pending
        if (action.type === 'correct-geometry') {
          const ann = s.annotations.find((a: AnnotationState) => a.track_id === action.trackId);
          if (ann && ann.review.changed_frames > 0) {
            ann.review.changed_frames -= 1;
            if (ann.review.changed_frames === 0) {
              ann.review.status = 'pending';
              ann.review.reviewed_at = null;
            }
          }
        }
        // 简化: dirty 保持 true (即使栈空了, 用户对 store 改过仍记为 dirty)
      }),

    // ── 揭示动画 ────────────────────────────────────────
    setRevealProgress: (p) =>
      set((s) => {
        s.revealProgress = { ...s.revealProgress, ...p };
      }),

    // ── Helpers ────────────────────────────────────────
    canAdvanceFromStep4: () => {
      const s = get();
      const ds = getDataset(s.activeDatasetId);
      const focusIds = ds.demo_script.review_focus_ids;
      const focus = s.annotations.filter((a) => focusIds.includes(a.track_id));
      return focus.every((a) => a.review.status !== 'pending');
    },
  })),
);
