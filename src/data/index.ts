import type { Dataset, DatasetId } from '../types';
import { DatasetSchema } from '../types.zod';
import cityRoad from './city-road.json';

// 启动期 zod 校验, 数据有问题立即抛错
const cityRoadValidated = DatasetSchema.parse(cityRoad) as Dataset;

export const defaultDatasets: Partial<Record<DatasetId, Dataset>> = {
  'city-road': cityRoadValidated,
  // Day 5 补 'meeting-room' 与 'retail-cam'
};

export const defaultDatasetId: DatasetId = 'city-road';

export function getDataset(id: DatasetId): Dataset {
  const ds = defaultDatasets[id];
  if (!ds) throw new Error(`Dataset not registered: ${id}`);
  return ds;
}
