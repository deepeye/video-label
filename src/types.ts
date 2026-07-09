// src/types.ts

export type Speed = '1x' | '2x' | 'instant';
export type DemoStep = 1 | 2 | 3 | 4 | 5;
export type DatasetId = 'city-road' | 'meeting-room' | 'retail-cam';
export type BBox = [x: number, y: number, w: number, h: number];
export type Point = [x: number, y: number];
export type AnnotationSource = 'machine' | 'human';
export type ReviewStatus = 'pending' | 'accepted' | 'corrected' | 'rejected';

export interface ShotSegment {
  id: string;
  clip_src: string;
  start_ms: number;
  end_ms: number;
  title: string;
  content_type: string;
}

export type AnnotationTool = 'select' | 'bbox' | 'polygon';
export type TimelineTool = 'browse' | 'point' | 'range' | 'region';

export type Geometry =
  | { type: 'bbox'; coords: BBox }
  | { type: 'polygon'; points: Point[] };

export interface Dataset {
  version: '2.0-demo';
  dataset_id: DatasetId;
  display: string;
  video_src: string;
  thumb: string;
  metadata: VideoMetadata;
  annotations: Annotation[];
  demo_script: DemoScript;
  segments: ShotSegment[];
}

export interface FrameTagEntry {
  frame_no: number;
  timestamp_ms: number;
  tags: string[];
  source: 'human';
}

export interface VideoMetadata {
  duration_ms: number;
  frame_count: number;
  fps: number;
  width: number;
  height: number;
  codec: string;
  audio_tracks: number;
  sampled_frames: number;
}

export interface Annotation {
  version: '2.0-demo';
  track_id: string;
  label_id: string;
  label_display: string;
  source: AnnotationSource;
  confidence: number | null;
  needs_review: boolean;
  keyframes: Keyframe[];
  review: ReviewRecord;
}

export interface Keyframe {
  timestamp_ms: number;
  frame_no: number;
  geometry: Geometry;
  is_keyframe: boolean;
}

export interface ReviewRecord {
  status: ReviewStatus;
  changed_frames: number;
  reviewed_at: number | null;
}

export interface EventMarker {
  id: string;
  eventType: string;
  customEventType: string | null;
  severity: 'high' | 'medium' | 'low';
  tags: string[];
  description: string;
  mode: 'point' | 'range';
  timeMs: number | null;
  startMs: number | null;
  endMs: number | null;
  regionBox: BBox | null;
  regionAnchorMs: number | null;
}

export interface DemoScript {
  metadata_reveal_ms: number;
  inference_reveal_ms: number;
  review_focus_ids: string[];
}

export type AnnotationState = Annotation;

export type ReviewAction =
  | {
      type: 'create-event';
      event: EventMarker;
      selectedEventIdBefore: string | null;
    }
  | {
      type: 'update-event';
      id: string;
      prevEvent: EventMarker;
    }
  | {
      type: 'delete-event';
      event: EventMarker;
      index: number;
      selectedEventIdBefore: string | null;
    }
  | {
      type: 'set-scene-tags';
      frameNo: number;
      prevTags: string[];
      prevTimestampMs: number | null;
    };
