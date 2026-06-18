// src/types.ts

export type Speed = '1x' | '2x' | 'instant';
export type DemoStep = 1 | 2 | 3 | 4 | 5;
export type DatasetId = 'city-road' | 'meeting-room' | 'retail-cam';
export type BBox = [x: number, y: number, w: number, h: number];
export type AnnotationSource = 'machine' | 'human';
export type ReviewStatus = 'pending' | 'accepted' | 'corrected' | 'rejected';
export type PlayMode = 'manual' | 'auto';

export interface Dataset {
  version: '2.0-demo';
  dataset_id: DatasetId;
  display: string;
  video_src: string;
  thumb: string;
  metadata: VideoMetadata;
  annotations: Annotation[];
  demo_script: DemoScript;
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
  geometry: { type: 'bbox'; coords: BBox };
  is_keyframe: boolean;
}

export interface ReviewRecord {
  status: ReviewStatus;
  changed_frames: number;
  reviewed_at: number | null;
}

export interface DemoScript {
  metadata_reveal_ms: number;
  inference_reveal_ms: number;
  review_focus_ids: string[];
}

export type AnnotationState = Annotation;

// 撤销栈类型
export type ReviewAction =
  | { type: 'accept'; trackId: string; prevStatus: ReviewStatus; prevSource: AnnotationSource }
  | { type: 'reject'; trackId: string; prevStatus: ReviewStatus }
  | {
      type: 'correct-geometry';
      trackId: string;
      frameIdx: number;
      prevCoords: BBox;
      prevSource: AnnotationSource;
    };
