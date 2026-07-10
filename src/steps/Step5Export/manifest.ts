import type { Dataset } from '../../types';

export type ExportFormat = 'native' | 'coco-video';

export interface Manifest {
  dataset_id: string;
  display: string;
  note: string;
  exported_at: number;
  exported_at_iso: string;
  format: ExportFormat;
  statistics: {
    total: number;
    point: number;
    range: number;
    with_region: number;
    text_edits: number;
  };
  metadata: Dataset['metadata'];
  files: string[];
}

export function buildManifest(args: {
  dataset: Dataset;
  format: ExportFormat;
  exportedAt: number;
  statistics: Manifest['statistics'];
  files: string[];
}): Manifest {
  return {
    dataset_id: args.dataset.dataset_id,
    display: args.dataset.display,
    note: '演示数据集 · Demo Export · 数据为样例, 非生产标注集',
    exported_at: args.exportedAt,
    exported_at_iso: new Date(args.exportedAt).toISOString(),
    format: args.format,
    statistics: args.statistics,
    metadata: args.dataset.metadata,
    files: args.files,
  };
}
