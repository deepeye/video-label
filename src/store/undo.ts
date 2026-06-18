import type { AnnotationState, ReviewAction } from '../types';

export const UNDO_STACK_LIMIT = 20;

/**
 * push 一个 action 到栈，超过上限则丢弃最旧的。
 * 不可变地返回新数组（Zustand + immer 会处理引用问题）。
 */
export function pushUndo(stack: ReviewAction[], action: ReviewAction): ReviewAction[] {
  const next = [...stack, action];
  if (next.length > UNDO_STACK_LIMIT) {
    return next.slice(next.length - UNDO_STACK_LIMIT);
  }
  return next;
}

/**
 * 就地把 annotations 数组按 action 反向恢复。
 * 在 Zustand store 的 immer producer 中调用即可。
 */
export function applyUndo(annotations: AnnotationState[], action: ReviewAction): void {
  const target = annotations.find(a => a.track_id === action.trackId);
  if (!target) return;

  switch (action.type) {
    case 'accept':
      target.review.status = action.prevStatus;
      target.review.reviewed_at = null;
      target.source = action.prevSource;
      break;
    case 'reject':
      target.review.status = action.prevStatus;
      target.review.reviewed_at = null;
      break;
    case 'correct-geometry': {
      const kf = target.keyframes[action.frameIdx];
      if (kf) {
        kf.geometry.coords = [...action.prevCoords] as typeof kf.geometry.coords;
      }
      target.source = action.prevSource;
      // 注意: review.status 不在这里改, 因为同一 track 可能有多次 correct, 各自只对应一帧
      // 简化策略: 只恢复 source; review.status 留待 store action 决定
      break;
    }
  }
}
