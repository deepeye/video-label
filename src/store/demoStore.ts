import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  AnnotationTool,
  BBox,
  DatasetId,
  DemoStep,
  EventMarker,
  Geometry,
  Keyframe,
  Point,
  ReviewAction,
  Speed,
  TimelineTool,
} from '../types';
import { createSnapshot, type RevealProgress, type Snapshot } from './snapshots';
import { applySceneTagUndo, applyUndo, pushUndo } from './undo';

function createEmptyEvent(id: string): EventMarker {
  return {
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
  };
}

function cloneEvent(event: EventMarker): EventMarker {
  return {
    ...event,
    regionBox: event.regionBox ? [...event.regionBox] as BBox : null,
    tags: [...event.tags],
  };
}

export interface DemoStore extends Snapshot {
  goToStep: (step: DemoStep) => void;
  setSpeed: (s: Speed) => void;
  selectDataset: (id: DatasetId) => void;
  reset: () => void;
  createPointEvent: (timeMs: number) => string;
  createRangeEvent: (startMs: number, endMs: number) => string;
  updateEvent: (id: string, patch: Partial<EventMarker>) => void;
  deleteEvent: (id: string) => void;
  selectEvent: (id: string | null) => void;
  setTimelineTool: (tool: TimelineTool) => void;
  attachRegionBox: (id: string, box: BBox, anchorMs: number) => void;
  removeRegionBox: (id: string) => void;
  upsertKeyframeGeometry: (trackId: string, frameNo: number, timestampMs: number, geometry: Geometry) => void;
  deleteKeyframe: (trackId: string, frameNo: number) => void;
  setSceneTags: (frameNo: number, timestampMs: number, tags: string[]) => void;
  startPolygonDraft: () => void;
  addPolygonPoint: (point: Point) => void;
  updatePolygonPoint: (index: number, point: Point) => void;
  commitPolygonDraft: (trackId: string, frameNo: number, timestampMs: number) => void;
  cancelPolygonDraft: () => void;
  setAnnotationTool: (tool: AnnotationTool) => void;
  setCurrentTimeMs: (ms: number) => void;
  seekToMs: (ms: number) => void;
  clearPendingSeek: () => void;
  play: () => void;
  pause: () => void;
  undo: () => void;
  setRevealProgress: (p: Partial<RevealProgress>) => void;
  canAdvanceFromStep4: () => boolean;
}

const initial = createSnapshot('city-road');
let nextEventId = 1;

export const useDemoStore = create<DemoStore>()(
  immer((set, get) => ({
    ...initial,

    goToStep: (step) =>
      set((s) => {
        s.demoStep = step;
      }),

    setSpeed: (speed) =>
      set((s) => {
        s.speed = speed;
      }),

    selectDataset: (id) => {
      const fresh = createSnapshot(id);
      const currentSpeed = get().speed;
      set(() => ({ ...fresh, speed: currentSpeed }));
    },

    reset: () => {
      const id = get().activeDatasetId;
      const fresh = createSnapshot(id);
      const currentSpeed = get().speed;
      set(() => ({ ...fresh, activeDatasetId: id, speed: currentSpeed }));
    },

    createPointEvent: (timeMs) => {
      const id = `event-${nextEventId++}`;
      set((s) => {
        const selectedEventIdBefore = s.selectedEventId;
        const event = createEmptyEvent(id);
        event.mode = 'point';
        event.timeMs = timeMs;
        s.events.push(event);
        s.selectedEventId = id;
        s.dirty = true;
        s.undoStack = pushUndo(s.undoStack, {
          type: 'create-event',
          event: cloneEvent(event),
          selectedEventIdBefore,
        });
      });
      return id;
    },

    createRangeEvent: (startMs, endMs) => {
      const id = `event-${nextEventId++}`;
      const normalizedStart = Math.min(startMs, endMs);
      const normalizedEnd = Math.max(startMs, endMs);
      set((s) => {
        const selectedEventIdBefore = s.selectedEventId;
        const event = createEmptyEvent(id);
        event.mode = 'range';
        event.startMs = normalizedStart;
        event.endMs = normalizedEnd;
        s.events.push(event);
        s.selectedEventId = id;
        s.dirty = true;
        s.undoStack = pushUndo(s.undoStack, {
          type: 'create-event',
          event: cloneEvent(event),
          selectedEventIdBefore,
        });
      });
      return id;
    },

    updateEvent: (id, patch) =>
      set((s) => {
        const event = s.events.find((item) => item.id === id);
        if (!event) return;
        const prevEvent = cloneEvent(event);
        if (patch.tags) {
          event.tags = [...patch.tags];
        }
        if (patch.regionBox) {
          event.regionBox = [...patch.regionBox] as BBox;
        } else if (patch.regionBox === null) {
          event.regionBox = null;
        }
        if (patch.eventType !== undefined) event.eventType = patch.eventType;
        if (patch.customEventType !== undefined) event.customEventType = patch.customEventType;
        if (patch.severity !== undefined) event.severity = patch.severity;
        if (patch.description !== undefined) event.description = patch.description;
        if (patch.mode !== undefined) event.mode = patch.mode;
        if (patch.timeMs !== undefined) event.timeMs = patch.timeMs;
        if (patch.startMs !== undefined) event.startMs = patch.startMs;
        if (patch.endMs !== undefined) event.endMs = patch.endMs;
        if (patch.regionAnchorMs !== undefined) event.regionAnchorMs = patch.regionAnchorMs;
        s.selectedEventId = id;
        s.dirty = true;
        s.undoStack = pushUndo(s.undoStack, { type: 'update-event', id, prevEvent });
      }),

    deleteEvent: (id) =>
      set((s) => {
        const index = s.events.findIndex((item) => item.id === id);
        if (index < 0) return;
        const event = cloneEvent(s.events[index]!);
        const selectedEventIdBefore = s.selectedEventId;
        s.events.splice(index, 1);
        if (s.selectedEventId === id) {
          s.selectedEventId = null;
        }
        s.dirty = true;
        s.undoStack = pushUndo(s.undoStack, {
          type: 'delete-event',
          event,
          index,
          selectedEventIdBefore,
        });
      }),

    selectEvent: (id) =>
      set((s) => {
        s.selectedEventId = id;
      }),

    setTimelineTool: (tool) =>
      set((s) => {
        s.timelineTool = tool;
      }),

    attachRegionBox: (id, box, anchorMs) =>
      set((s) => {
        const event = s.events.find((item) => item.id === id);
        if (!event) return;
        const prevEvent = cloneEvent(event);
        event.regionBox = [...box] as BBox;
        event.regionAnchorMs = anchorMs;
        s.selectedEventId = id;
        s.dirty = true;
        s.undoStack = pushUndo(s.undoStack, { type: 'update-event', id, prevEvent });
      }),

    removeRegionBox: (id) =>
      set((s) => {
        const event = s.events.find((item) => item.id === id);
        if (!event) return;
        const prevEvent = cloneEvent(event);
        event.regionBox = null;
        event.regionAnchorMs = null;
        s.selectedEventId = id;
        s.dirty = true;
        s.undoStack = pushUndo(s.undoStack, { type: 'update-event', id, prevEvent });
      }),

    upsertKeyframeGeometry: (_trackId, _frameNo, _timestampMs, _geometry) =>
      set(() => {}),

    deleteKeyframe: (_trackId, _frameNo) =>
      set(() => {}),

    setSceneTags: (frameNo, timestampMs, tags) =>
      set((s) => {
        const existing = s.frameTags.find((f) => f.frame_no === frameNo);
        const prevTags = existing ? [...existing.tags] : [];
        const prevTimestampMs = existing ? existing.timestamp_ms : null;

        if (existing) {
          existing.tags = tags;
        } else {
          s.frameTags.push({ frame_no: frameNo, timestamp_ms: timestampMs, tags, source: 'human' });
        }

        s.dirty = true;
        s.undoStack = pushUndo(s.undoStack, {
          type: 'set-scene-tags',
          frameNo,
          prevTags,
          prevTimestampMs,
        });
      }),

    startPolygonDraft: () =>
      set((s) => {
        s.draftPolygon = [];
      }),

    addPolygonPoint: (point) =>
      set((s) => {
        s.draftPolygon.push([...point]);
      }),

    updatePolygonPoint: (index, point) =>
      set((s) => {
        if (index >= 0 && index < s.draftPolygon.length) {
          s.draftPolygon[index] = [...point];
        }
      }),

    commitPolygonDraft: (_trackId, _frameNo, _timestampMs) =>
      set((s) => {
        s.draftPolygon = [];
      }),

    cancelPolygonDraft: () =>
      set((s) => {
        s.draftPolygon = [];
      }),

    setAnnotationTool: (tool) =>
      set((s) => {
        s.annotationTool = tool;
        if (tool !== 'polygon') {
          s.draftPolygon = [];
        }
      }),

    setCurrentTimeMs: (ms) =>
      set((s) => {
        s.currentTimeMs = ms;
      }),

    seekToMs: (ms) =>
      set((s) => {
        s.currentTimeMs = ms;
        s.pendingSeekMs = ms;
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

    undo: () =>
      set((s) => {
        const action = s.undoStack[s.undoStack.length - 1];
        if (!action) return;
        s.undoStack = s.undoStack.slice(0, -1);

        if (action.type === 'set-scene-tags') {
          applySceneTagUndo(s.frameTags, action);
          return;
        }

        const selectedEventId = applyUndo(s.events, action as Exclude<ReviewAction, { type: 'set-scene-tags' }>);
        if (selectedEventId !== undefined) {
          s.selectedEventId = selectedEventId;
        }
      }),

    setRevealProgress: (p) =>
      set((s) => {
        s.revealProgress = { ...s.revealProgress, ...p };
      }),

    canAdvanceFromStep4: () => get().events.length > 0,
  })),
);
