import type {
  AnnotationState,
  AnnotationTool,
  Dataset,
  DatasetId,
  DemoStep,
  EventMarker,
  FrameTagEntry,
  ReviewAction,
  ShotSegment,
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
  segments: ShotSegment[];
  revealedSegmentCount: number;
  loadingDataset: boolean;
  loadingDatasetError: string | null;
}

export function createLoadingSnapshot(): Snapshot {
  return {
    demoStep: 1,
    speed: '1x',
    dirty: false,
    activeDatasetId: 'jiazhengnvhuang_13',
    annotations: [],
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
    segments: [],
    revealedSegmentCount: 0,
    loadingDataset: true,
    loadingDatasetError: null,
  };
}

export function createSnapshotFromDataset(dataset: Dataset, id: DatasetId): Snapshot {
  return {
    demoStep: 1,
    speed: '1x',
    dirty: false,
    activeDatasetId: id,
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
    segments: dataset.segments ?? [],
    revealedSegmentCount: 0,
    loadingDataset: false,
    loadingDatasetError: null,
  };
}

export function createSnapshot(id: DatasetId): Snapshot {
  const dataset = getDataset(id);
  return createSnapshotFromDataset(dataset, id);
}
