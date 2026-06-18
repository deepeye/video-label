import type { Annotation, Dataset } from '../../types';

export interface NativeExport {
  version: '2.0-demo';
  exported_at: number;
  dataset: {
    dataset_id: string;
    display: string;
    metadata: Dataset['metadata'];
  };
  statistics: {
    total: number;
    accepted: number;
    corrected: number;
    rejected: number;
    pending: number;
  };
  annotations: Annotation[];
}

export function toNative(annotations: Annotation[], dataset: Dataset, exportedAt: number): NativeExport {
  const stats = {
    total: annotations.length,
    accepted: 0,
    corrected: 0,
    rejected: 0,
    pending: 0,
  };
  for (const a of annotations) {
    stats[a.review.status]++;
  }

  return {
    version: '2.0-demo',
    exported_at: exportedAt,
    dataset: {
      dataset_id: dataset.dataset_id,
      display: dataset.display,
      metadata: dataset.metadata,
    },
    statistics: stats,
    annotations,
  };
}
