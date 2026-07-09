import { z } from 'zod';

export const BBoxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);
export const PointSchema = z.tuple([z.number(), z.number()]);

export const BBoxGeometrySchema = z.object({
  type: z.literal('bbox'),
  coords: BBoxSchema,
});

export const PolygonGeometrySchema = z.object({
  type: z.literal('polygon'),
  points: z.array(PointSchema).min(3),
});

export const GeometrySchema = z.discriminatedUnion('type', [
  BBoxGeometrySchema,
  PolygonGeometrySchema,
]);

export const KeyframeSchema = z.object({
  timestamp_ms: z.number().int().nonnegative(),
  frame_no: z.number().int().nonnegative(),
  geometry: GeometrySchema,
  is_keyframe: z.boolean(),
});

export const ReviewRecordSchema = z.object({
  status: z.enum(['pending', 'accepted', 'corrected', 'rejected']),
  changed_frames: z.number().int().nonnegative(),
  reviewed_at: z.number().nullable(),
});

export const AnnotationSchema = z.object({
  version: z.literal('2.0-demo'),
  track_id: z.string().min(1),
  label_id: z.string().min(1),
  label_display: z.string().min(1),
  source: z.enum(['machine', 'human']),
  confidence: z.number().min(0).max(1).nullable(),
  needs_review: z.boolean(),
  keyframes: z.array(KeyframeSchema).min(1),
  review: ReviewRecordSchema,
});

export const VideoMetadataSchema = z.object({
  duration_ms: z.number().positive(),
  frame_count: z.number().int().positive(),
  fps: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  codec: z.string().min(1),
  audio_tracks: z.number().int().nonnegative(),
  sampled_frames: z.number().int().positive(),
});

export const DemoScriptSchema = z.object({
  metadata_reveal_ms: z.number().int().nonnegative(),
  inference_reveal_ms: z.number().int().nonnegative(),
  review_focus_ids: z.array(z.string()),
});

export const ShotSegmentSchema = z.object({
  id: z.string().min(1),
  clip_src: z.string().min(1),
  start_ms: z.number().int().nonnegative(),
  end_ms: z.number().int().positive(),
  camera_movement: z.enum(['推', '拉', '摇', '移', '跟', '固定']),
  shot_type: z.enum(['远景', '全景', '中景', '近景', '特写']),
});

export const DatasetSchema = z.object({
  version: z.literal('2.0-demo'),
  dataset_id: z.enum(['city-road', 'meeting-room', 'retail-cam']),
  display: z.string().min(1),
  video_src: z.string().min(1),
  thumb: z.string().min(1),
  metadata: VideoMetadataSchema,
  annotations: z.array(AnnotationSchema),
  demo_script: DemoScriptSchema,
  segments: z.array(ShotSegmentSchema),
});

export type DatasetParsed = z.infer<typeof DatasetSchema>;
