import type { Dataset, DatasetId } from '../types';
import { DatasetSchema } from '../types.zod';
import cityRoad from './city-road.json';
import meetingRoom from './meeting-room.json';
import retailCam from './retail-cam.json';

const cityRoadValidated = DatasetSchema.parse(cityRoad) as Dataset;
const meetingRoomValidated = DatasetSchema.parse(meetingRoom) as Dataset;
const retailCamValidated = DatasetSchema.parse(retailCam) as Dataset;

export const defaultDatasets: Record<DatasetId, Dataset> = {
  'city-road': cityRoadValidated,
  'meeting-room': meetingRoomValidated,
  'retail-cam': retailCamValidated,
};

export const defaultDatasetId: DatasetId = 'city-road';

export function getDataset(id: DatasetId): Dataset {
  return defaultDatasets[id];
}
