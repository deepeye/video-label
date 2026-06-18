import { describe, it, expect } from 'vitest';
import { applyUndo, pushUndo, UNDO_STACK_LIMIT } from '@/store/undo';
import type { AnnotationState, ReviewAction } from '@/types';

function makeAnnotation(overrides: Partial<AnnotationState> = {}): AnnotationState {
  return {
    version: '2.0-demo',
    track_id: 'trk_t',
    label_id: 'pedestrian',
    label_display: '行人',
    source: 'machine',
    confidence: 0.41,
    needs_review: true,
    keyframes: [
      {
        timestamp_ms: 1000,
        frame_no: 30,
        geometry: { type: 'bbox', coords: [10, 20, 30, 40] },
        is_keyframe: true,
      },
    ],
    review: { status: 'pending', changed_frames: 0, reviewed_at: null },
    ...overrides,
  };
}

describe('undo stack', () => {
  it('pushUndo respects limit, drops oldest', () => {
    let stack: ReviewAction[] = [];
    for (let i = 0; i < UNDO_STACK_LIMIT + 5; i++) {
      stack = pushUndo(stack, { type: 'accept', trackId: `t${i}`, prevStatus: 'pending', prevSource: 'machine' });
    }
    expect(stack.length).toBe(UNDO_STACK_LIMIT);
    // 最旧的 5 个被丢弃
    expect((stack[0] as Extract<ReviewAction, { type: 'accept' }>).trackId).toBe('t5');
  });

  it('applyUndo of accept reverts review.status to prevStatus', () => {
    const ann = makeAnnotation({
      track_id: 'trk_t',
      review: { status: 'accepted', changed_frames: 0, reviewed_at: 12345 },
    });
    const action: ReviewAction = { type: 'accept', trackId: 'trk_t', prevStatus: 'pending', prevSource: 'machine' };
    const annotations = [ann];
    applyUndo(annotations, action);
    expect(annotations[0]!.review.status).toBe('pending');
    expect(annotations[0]!.source).toBe('machine');
  });

  it('applyUndo of reject reverts to prevStatus', () => {
    const ann = makeAnnotation({
      review: { status: 'rejected', changed_frames: 0, reviewed_at: 12345 },
    });
    const action: ReviewAction = { type: 'reject', trackId: 'trk_t', prevStatus: 'pending' };
    const annotations = [ann];
    applyUndo(annotations, action);
    expect(annotations[0]!.review.status).toBe('pending');
  });

  it('applyUndo of correct-geometry restores prev coords and source', () => {
    const ann = makeAnnotation({
      source: 'human',
      review: { status: 'corrected', changed_frames: 1, reviewed_at: 12345 },
    });
    ann.keyframes[0]!.geometry.coords = [100, 200, 300, 400];
    const action: ReviewAction = {
      type: 'correct-geometry',
      trackId: 'trk_t',
      frameIdx: 0,
      prevCoords: [10, 20, 30, 40],
      prevSource: 'machine',
    };
    const annotations = [ann];
    applyUndo(annotations, action);
    expect(annotations[0]!.keyframes[0]!.geometry.coords).toEqual([10, 20, 30, 40]);
    expect(annotations[0]!.source).toBe('machine');
  });
});
