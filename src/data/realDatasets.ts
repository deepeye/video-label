import type { DatasetId } from '../types';

export interface RealDatasetConfig {
  id: DatasetId;
  display: string;
  videoSrc: string;
  jsonUrl: string;
}

export const REAL_DATASETS: RealDatasetConfig[] = [
  {
    id: 'jiazhengnvhuang_13',
    display: '家政女皇·肉片穿衣',
    videoSrc: '/mock/storyboard/jiazhengnvhuang_13.mp4',
    jsonUrl: '/mock/real/jiazhengnvhuang_13.json',
  },
  {
    id: 'jiazhengnvhuang_5',
    display: '家政女皇·上浆',
    videoSrc: '/mock/storyboard/jiazhengnvhuang_5-result.mp4',
    jsonUrl: '/mock/real/jiazhengnvhuang_5.json',
  },
  {
    id: 'meilihebeisegment_001_2',
    display: '美丽河北·片段 2',
    videoSrc: '/mock/storyboard/meilihebeisegment_001_2-result.mp4',
    jsonUrl: '/mock/real/meilihebeisegment_001_2.json',
  },
  {
    id: 'mingyilaile_17-0',
    display: '名医来了·片段 0',
    videoSrc: '/mock/storyboard/mingyilaile_17-0-result.mp4',
    jsonUrl: '/mock/real/mingyilaile_17-0.json',
  },
  {
    id: 'mingyilaile_17-4',
    display: '名医来了·片段 4',
    videoSrc: '/mock/storyboard/mingyilaile_17-4-result.mp4',
    jsonUrl: '/mock/real/mingyilaile_17-4.json',
  },
];

export const REAL_DATASETS_BY_ID: Record<DatasetId, RealDatasetConfig> = Object.fromEntries(
  REAL_DATASETS.map((d) => [d.id, d]),
) as Record<DatasetId, RealDatasetConfig>;
