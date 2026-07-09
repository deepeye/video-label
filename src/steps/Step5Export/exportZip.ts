import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Annotation, Dataset, EventMarker, FrameTagEntry } from '../../types';
import { toNative } from '../../lib/format/native';
import { toCocoVideo } from '../../lib/format/cocoVideo';
import { buildManifest, type ExportFormat } from './manifest';

const README_CONTENT = `视频语料标注 Demo · 导出包

本包由演示系统从浏览器内存生成, 数据为样例 (非生产标注集)。
关键文件:
  - annotations/native.json    或  annotations/coco_video.json
  - frames/                    几张样例帧 (用于离线检视)
  - manifest.json              数据集 / 导出参数 / 统计

完整 schema 与字段含义见: docs/视频语料标注平台 · 演示 Demo PRD.md (第五章)
`;

// 真实数据集无样例帧图片导出；保留入口以便后续按需补充。
const FRAMES_TO_INCLUDE: Record<string, string[]> = {};

export interface ExportArgs {
  format: ExportFormat;
  events: EventMarker[];
  dataset: Dataset;
  exportedAt: number;
  annotations?: Annotation[];
  frameTags?: FrameTagEntry[];
}

function buildEventStats(events: EventMarker[]) {
  return {
    total: events.length,
    point: events.filter((event) => event.mode === 'point').length,
    range: events.filter((event) => event.mode === 'range').length,
    with_region: events.filter((event) => event.regionBox !== null).length,
  };
}

/**
 * 生成 zip Blob (不触发下载)。便于测试。
 */
export async function buildExportZip(args: ExportArgs): Promise<Blob> {
  const { format, events, dataset, exportedAt, annotations = [], frameTags } = args;
  const zip = new JSZip();

  const annFolder = zip.folder('annotations')!;
  let annFile: string;
  if (format === 'native') {
    annFile = 'annotations/native.json';
    annFolder.file('native.json', JSON.stringify(toNative(events, dataset, exportedAt), null, 2));
  } else {
    annFile = 'annotations/coco_video.json';
    annFolder.file('coco_video.json', JSON.stringify(toCocoVideo(annotations, dataset, exportedAt, frameTags ?? [], events), null, 2));
  }

  const frameNames = FRAMES_TO_INCLUDE[dataset.dataset_id] ?? [];
  const frameFiles: string[] = [];
  if (frameNames.length > 0) {
    const framesFolder = zip.folder('frames')!;
    for (const fname of frameNames) {
      try {
        const url = `/mock/${dataset.dataset_id}/frames/${fname}`;
        const blob = await fetch(url).then((r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r.blob();
        });
        framesFolder.file(fname, blob);
        frameFiles.push(`frames/${fname}`);
      } catch {
        console.warn(`[exportZip] frame missing: ${fname}, skipped`);
      }
    }
  }

  const manifest = buildManifest({
    dataset,
    format,
    exportedAt,
    statistics: buildEventStats(events),
    files: [annFile, ...frameFiles],
  });
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  zip.file('README.txt', README_CONTENT);

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * 一键下载: 打包 + 触发浏览器下载。
 */
export async function downloadExportZip(args: ExportArgs): Promise<void> {
  const blob = await buildExportZip(args);
  saveAs(blob, `${args.dataset.dataset_id}_export.zip`);
}
