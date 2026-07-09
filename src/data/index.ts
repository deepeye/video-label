import type { Dataset, DatasetId } from '../types';
import { adaptRealData, type VideoMeta } from './adaptRealData';
import { REAL_DATASETS_BY_ID } from './realDatasets';

export const defaultDatasets: Partial<Record<DatasetId, Dataset>> = {};

export const defaultDatasetId: DatasetId = 'jiazhengnvhuang_13';

export function getDataset(id: DatasetId): Dataset {
  const ds = defaultDatasets[id];
  if (!ds) {
    throw new Error(`Dataset "${id}" not loaded yet. Call loadRealDataset first.`);
  }
  return ds;
}

export async function loadRealDataset(id: DatasetId): Promise<Dataset> {
  const config = REAL_DATASETS_BY_ID[id];
  if (!config) {
    throw new Error(`Unknown dataset: ${id}`);
  }

  const resp = await fetch(config.jsonUrl);
  if (!resp.ok) {
    throw new Error(`Failed to fetch ${config.jsonUrl}: ${resp.status}`);
  }
  const json = await resp.json();

  const videoMeta = await new Promise<VideoMeta>((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.crossOrigin = 'anonymous';
    video.src = config.videoSrc;

    const timeout = setTimeout(() => {
      resolve({ durationMs: 30000, width: 1920, height: 1080, fps: 30 });
      video.remove();
    }, 5000);

    const onMeta = () => {
      clearTimeout(timeout);
      const durationMs = Math.round(video.duration * 1000) || 30000;
      const width = video.videoWidth || 1920;
      const height = video.videoHeight || 1080;
      resolve({ durationMs, width, height, fps: 30 });
      video.remove();
    };

    video.addEventListener('loadedmetadata', onMeta, { once: true });
    video.addEventListener('error', () => {
      clearTimeout(timeout);
      resolve({ durationMs: 30000, width: 1920, height: 1080, fps: 30 });
      video.remove();
    }, { once: true });
  });

  const dataset = adaptRealData(json, videoMeta, id, config.display, config.videoSrc);
  defaultDatasets[id] = dataset;
  return dataset;
}
