import { describe, it, expect } from 'vitest';
import { applySceneTagUndo, applyUndo, pushUndo, UNDO_STACK_LIMIT } from '@/store/undo';
import type { EventMarker, ReviewAction } from '@/types';

function makeEvent(overrides: Partial<EventMarker> = {}): EventMarker {
  return {
    id: 'event-1',
    eventType: 'sudden_brake',
    customEventType: null,
    severity: 'medium',
    tags: ['风险'],
    description: '车辆急刹',
    mode: 'point',
    timeMs: 1200,
    startMs: null,
    endMs: null,
    regionBox: null,
    regionAnchorMs: null,
    ...overrides,
  };
}

describe('undo stack', () => {
  it('pushUndo respects limit, drops oldest', () => {
    let stack: ReviewAction[] = [];
    for (let i = 0; i < UNDO_STACK_LIMIT + 5; i++) {
      stack = pushUndo(stack, {
        type: 'create-event',
        event: makeEvent({ id: `event-${i}` }),
        selectedEventIdBefore: null,
      });
    }
    expect(stack.length).toBe(UNDO_STACK_LIMIT);
    expect((stack[0] as Extract<ReviewAction, { type: 'create-event' }>).event.id).toBe('event-5');
  });

  it('applyUndo of create-event removes the created event and restores previous selection', () => {
    const created = makeEvent({ id: 'event-2' });
    const events = [makeEvent({ id: 'event-1' }), created];
    const action: ReviewAction = {
      type: 'create-event',
      event: created,
      selectedEventIdBefore: 'event-1',
    };

    const selectedEventId = applyUndo(events, action);

    expect(events).toHaveLength(1);
    expect(events[0]!.id).toBe('event-1');
    expect(selectedEventId).toBe('event-1');
  });

  it('applyUndo of update-event restores the previous event snapshot', () => {
    const previous = makeEvent({ description: '车辆急刹', severity: 'medium' });
    const events = [makeEvent({ description: '已修改', severity: 'high', tags: ['夜间'] })];
    const action: ReviewAction = {
      type: 'update-event',
      id: 'event-1',
      prevEvent: previous,
    };

    const selectedEventId = applyUndo(events, action);

    expect(events[0]).toEqual(previous);
    expect(selectedEventId).toBe('event-1');
  });

  it('applyUndo of delete-event restores deleted event at original index and previous selection', () => {
    const deleted = makeEvent({ id: 'event-2', mode: 'range', timeMs: null, startMs: 2000, endMs: 3600 });
    const events = [makeEvent({ id: 'event-1' }), makeEvent({ id: 'event-3' })];
    const action: ReviewAction = {
      type: 'delete-event',
      event: deleted,
      index: 1,
      selectedEventIdBefore: 'event-3',
    };

    const selectedEventId = applyUndo(events, action);

    expect(events).toHaveLength(3);
    expect(events[1]).toEqual(deleted);
    expect(selectedEventId).toBe('event-3');
  });

  it('applySceneTagUndo removes a newly created frame tag when there was no previous tag', () => {
    const frameTags = [{ frame_no: 32, timestamp_ms: 1067, tags: ['夜间'], source: 'human' as const }];
    const action: Extract<ReviewAction, { type: 'set-scene-tags' }> = {
      type: 'set-scene-tags',
      frameNo: 32,
      prevTags: [],
      prevTimestampMs: null,
    };

    applySceneTagUndo(frameTags, action);
    expect(frameTags).toEqual([]);
  });

  it('applySceneTagUndo restores previous frame tags when a tag already existed', () => {
    const frameTags = [{ frame_no: 32, timestamp_ms: 1067, tags: ['已修改'], source: 'human' as const }];
    const action: Extract<ReviewAction, { type: 'set-scene-tags' }> = {
      type: 'set-scene-tags',
      frameNo: 32,
      prevTags: ['夜间', '风险'],
      prevTimestampMs: 1067,
    };

    applySceneTagUndo(frameTags, action);
    expect(frameTags).toEqual([
      { frame_no: 32, timestamp_ms: 1067, tags: ['夜间', '风险'], source: 'human' },
    ]);
  });
});
