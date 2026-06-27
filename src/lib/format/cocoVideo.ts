import type { Annotation, AnnotationSource, BBox, Dataset, EventMarker, FrameTagEntry, Geometry, Point, ReviewRecord } from '../../types';
import { geometryToBBox } from '../interpolate';
import { buildCategoryMap, extractCategories, type Category } from './categories';

export interface CocoCategory {
  id: number;
  name: string;
  supercategory?: string;
}

export interface CocoVideoEntry {
  id: number;
  file_name: string;
  width: number;
  height: number;
  frame_rate: number;
  duration: number;
}

export interface CocoAnnotation {
  id: number;
  track_id: number;
  video_id: number;
  timestamp: number;
  frame_no: number;
  bbox: BBox;
  category_id: number;
  score: number | null;
  x_review: ReviewRecord;
  x_source: AnnotationSource;
  x_geometry_type?: string;
  x_polygon?: Point[];
}

export interface CocoVideoExport {
  info: {
    description: string;
    version: '2.0-demo';
    date_created: string;
  };
  videos: CocoVideoEntry[];
  categories: CocoCategory[];
  annotations: CocoAnnotation[];
  x_frame_tags?: FrameTagEntry[];
  x_events?: EventMarker[];
}

/**
 * 把 track_id "trk_2" / "trk_v3" 这类字符串转成数字 ID。
 * 用 hash 风格保证 (track_id, timestamp_ms) 组合唯一。
 */
function annotationId(trackId: string, ts: number): number {
  let h = 0;
  const s = `${trackId}#${ts}`;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function trackIdToNumber(trackId: string): number {
  // "trk_2" → 2, "trk_v3" → 1003 (前缀映射避免冲突)
  const m = trackId.match(/^trk_([a-z]?)(\d+)$/);
  if (!m) return annotationId(trackId, 0);
  const prefix = m[1] ?? '';
  const num = parseInt(m[2]!, 10);
  const offset =
    prefix === '' ? 0 :
    prefix === 'v' ? 1000 :
    prefix === 'p' ? 2000 :
    prefix === 's' ? 3000 :
    9000;
  return offset + num;
}

export function toCocoVideo(annotations: Annotation[], dataset: Dataset, exportedAt: number, frameTags: FrameTagEntry[] = [], events: EventMarker[] = []): CocoVideoExport {
  const categoryMap = buildCategoryMap(annotations);
  const categoriesFull = extractCategories(annotations);
  const categories: CocoCategory[] = categoriesFull.map((c: Category) => ({
    id: c.id,
    name: c.name,
  }));

  const cocoAnns: CocoAnnotation[] = [];
  for (const a of annotations) {
    for (const kf of a.keyframes) {
      const cid = categoryMap[a.label_id];
      if (cid === undefined) continue;
      const g: Geometry = kf.geometry;
      const base: CocoAnnotation = {
        id: annotationId(a.track_id, kf.timestamp_ms),
        track_id: trackIdToNumber(a.track_id),
        video_id: 1,
        timestamp: kf.timestamp_ms / 1000,
        frame_no: kf.frame_no,
        bbox: geometryToBBox(g),
        category_id: cid,
        score: a.confidence,
        x_review: a.review,
        x_source: a.source,
      };
      if (g.type === 'polygon') {
        base.x_geometry_type = 'polygon';
        base.x_polygon = g.points;
      }
      cocoAnns.push(base);
    }
  }

  return {
    info: {
      description: 'Demo Export — Video Annotation Platform',
      version: '2.0-demo',
      date_created: new Date(exportedAt).toISOString(),
    },
    videos: [
      {
        id: 1,
        file_name: dataset.video_src.split('/').pop()!,
        width: dataset.metadata.width,
        height: dataset.metadata.height,
        frame_rate: dataset.metadata.fps,
        duration: dataset.metadata.duration_ms / 1000,
      },
    ],
    categories,
    annotations: cocoAnns,
    x_frame_tags: frameTags.length > 0 ? frameTags : undefined,
    x_events: events.length > 0 ? events : undefined,
  };
}
