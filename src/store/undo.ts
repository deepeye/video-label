import type { EventMarker, ReviewAction } from '../types';

export const UNDO_STACK_LIMIT = 20;

export function pushUndo(stack: ReviewAction[], action: ReviewAction): ReviewAction[] {
  const next = [...stack, action];
  if (next.length > UNDO_STACK_LIMIT) {
    return next.slice(next.length - UNDO_STACK_LIMIT);
  }
  return next;
}

export function applyUndo(
  events: EventMarker[],
  action: Exclude<ReviewAction, { type: 'set-scene-tags' }>,
): string | null | undefined {
  switch (action.type) {
    case 'create-event': {
      const index = events.findIndex((event) => event.id === action.event.id);
      if (index >= 0) events.splice(index, 1);
      return action.selectedEventIdBefore;
    }
    case 'update-event': {
      const index = events.findIndex((event) => event.id === action.id);
      if (index >= 0) {
        events[index] = { ...action.prevEvent, tags: [...action.prevEvent.tags] };
      }
      return action.id;
    }
    case 'delete-event': {
      const restored = { ...action.event, tags: [...action.event.tags] };
      events.splice(action.index, 0, restored);
      return action.selectedEventIdBefore;
    }
  }
}

export function applySceneTagUndo(
  frameTags: { frame_no: number; timestamp_ms: number; tags: string[]; source: 'human' }[],
  action: Extract<ReviewAction, { type: 'set-scene-tags' }>,
): void {
  if (action.prevTags.length === 0 && action.prevTimestampMs === null) {
    const idx = frameTags.findIndex((f) => f.frame_no === action.frameNo);
    if (idx >= 0) frameTags.splice(idx, 1);
  } else {
    const existing = frameTags.find((f) => f.frame_no === action.frameNo);
    if (existing) {
      existing.tags = action.prevTags;
    } else {
      frameTags.push({
        frame_no: action.frameNo,
        timestamp_ms: action.prevTimestampMs!,
        tags: action.prevTags,
        source: 'human',
      });
    }
  }
}
