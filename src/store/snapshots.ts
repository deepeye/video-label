import type { AnnotationState, DatasetId, DemoStep, PlayMode, ReviewAction, Speed } from '../types';
import { deepClone } from '../lib/deepClone';
import { getDataset } from '../data';

export interface RevealProgress {
  metadataFieldsShown: number;
  inferenceProgress: number;
  boxesRevealed: number;
}

export interface Snapshot {
  // 编排
  demoStep: DemoStep;
  playMode: PlayMode;
  speed: Speed;
  paused: boolean;
  dirty: boolean;

  // 当前样例
  activeDatasetId: DatasetId;

  // 标注内存状态 (深拷贝自 dataset)
  annotations: AnnotationState[];

  // Step 4 UI 子状态
  selectedTrackId: string | null;
  reviewQueueIndex: number;

  // 揭示动画进度
  revealProgress: RevealProgress;

  // 撤销栈
  undoStack: ReviewAction[];
}

/**
 * 从指定数据集生成一份初始快照。
 * 关键: annotations 通过 deepClone 拷贝, 后续审核操作改它不会污染源数据。
 *
 * 用于:
 *   - 应用启动时的初始 store 状态 (initialState)
 *   - reset() 时整体替换 store
 *   - selectDataset(id) 切换样例时整体替换 store
 */
export function createSnapshot(datasetId: DatasetId): Snapshot {
  const dataset = getDataset(datasetId);
  return {
    demoStep: 1,
    playMode: 'manual',
    speed: '1x',
    paused: false,
    dirty: false,
    activeDatasetId: datasetId,
    annotations: deepClone(dataset.annotations),
    selectedTrackId: null,
    reviewQueueIndex: 0,
    revealProgress: {
      metadataFieldsShown: 0,
      inferenceProgress: 0,
      boxesRevealed: 0,
    },
    undoStack: [],
  };
}
