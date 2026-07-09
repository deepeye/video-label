import type {
  AnnotationState,
  AnnotationTool,
  DatasetId,
  DemoStep,
  EventMarker,
  FrameTagEntry,
  ReviewAction,
  Speed,
  TimelineTool,
} from '../types';
import { deepClone } from '../lib/deepClone';
import { getDataset } from '../data';

export interface RevealProgress {
  metadataFieldsShown: number;
  inferenceProgress: number;
  boxesRevealed: number;
}

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
