import type { Dataset, EventMarker } from '../../types';

export interface NativeExport {
  version: '2.0-demo';
  exported_at: number;
  dataset: {
    dataset_id: string;
    display: string;
    metadata: Dataset['metadata'];
  };
  video: {
    file_name: string;
    width: number;
    height: number;
    frame_rate: number;
    duration_ms: number;
  };
  events: EventMarker[];
}

export function toNative(events: EventMarker[], dataset: Dataset, exportedAt: number): NativeExport {
  return {
    version: '2.0-demo',
    exported_at: exportedAt,
    dataset: {
      dataset_id: dataset.dataset_id,
      display: dataset.display,
      metadata: dataset.metadata,
    },
    video: {
      file_name: dataset.video_src.split('/').pop()!,
      width: dataset.metadata.width,
      height: dataset.metadata.height,
      frame_rate: dataset.metadata.fps,
      duration_ms: dataset.metadata.duration_ms,
    },
    events,
  };
}
