import { beforeEach, describe, expect, it } from 'vitest';
import { getDataset } from '@/data';
import { useDemoStore } from '@/store/demoStore';

describe('demoStore', () => {
  beforeEach(() => {
    useDemoStore.getState().selectDataset('city-road');
  });

  it('initial state matches snapshot defaults', () => {
    const s = useDemoStore.getState();
    expect(s.demoStep).toBe(1);
    expect(s.speed).toBe('1x');
    expect(s.activeDatasetId).toBe('city-road');
    expect(s.annotations.length).toBe(47);
    expect(s.events).toEqual([]);
    expect(s.selectedEventId).toBeNull();
    expect(s.timelineTool).toBe('browse');
    expect(s.dirty).toBe(false);
  });

  it('goToStep updates demoStep', () => {
    useDemoStore.getState().goToStep(3);
    expect(useDemoStore.getState().demoStep).toBe(3);
  });

  it('setSpeed updates speed', () => {
    useDemoStore.getState().setSpeed('2x');
    expect(useDemoStore.getState().speed).toBe('2x');
  });

  it('seekToMs updates currentTimeMs, queues seek, and pauses playback', () => {
    useDemoStore.getState().play();

    useDemoStore.getState().seekToMs(2400);

    const s = useDemoStore.getState();
    expect(s.currentTimeMs).toBe(2400);
    expect(s.pendingSeekMs).toBe(2400);
    expect(s.seekNonce).toBe(1);
    expect(s.playbackState).toBe('paused');
  });

  it('play and pause toggle playbackState without changing currentTimeMs', () => {
    useDemoStore.getState().setCurrentTimeMs(1800);

    useDemoStore.getState().play();
    expect(useDemoStore.getState().playbackState).toBe('playing');
    expect(useDemoStore.getState().currentTimeMs).toBe(1800);

    useDemoStore.getState().pause();
    expect(useDemoStore.getState().playbackState).toBe('paused');
    expect(useDemoStore.getState().currentTimeMs).toBe(1800);
  });

  it('createPointEvent adds/selects event and marks dirty', () => {
    const id = useDemoStore.getState().createPointEvent(1200);
    const s = useDemoStore.getState();
    const event = s.events.find((item) => item.id === id);

    expect(event).toMatchObject({
      id,
      mode: 'point',
      timeMs: 1200,
      startMs: null,
      endMs: null,
      regionBox: null,
      regionAnchorMs: null,
      eventType: '',
      customEventType: null,
      severity: 'medium',
      tags: [],
      description: '',
    });
    expect(s.selectedEventId).toBe(id);
    expect(s.dirty).toBe(true);
  });

  it('createRangeEvent normalizes start/end', () => {
    const id = useDemoStore.getState().createRangeEvent(2500, 1000);
    const event = useDemoStore.getState().events.find((item) => item.id === id);

    expect(event).toMatchObject({
      id,
      mode: 'range',
      timeMs: null,
      startMs: 1000,
      endMs: 2500,
    });
  });

  it('attachRegionBox writes regionBox and regionAnchorMs', () => {
    const id = useDemoStore.getState().createPointEvent(800);

    useDemoStore.getState().attachRegionBox(id, [10, 20, 30, 40], 900);

    const event = useDemoStore.getState().events.find((item) => item.id === id);
    expect(event?.regionBox).toEqual([10, 20, 30, 40]);
    expect(event?.regionAnchorMs).toBe(900);
  });

  it('canAdvanceFromStep4 returns false when no events', () => {
    expect(useDemoStore.getState().canAdvanceFromStep4()).toBe(false);
  });

  it('canAdvanceFromStep4 returns true with at least one event', () => {
    useDemoStore.getState().createPointEvent(1200);
    expect(useDemoStore.getState().canAdvanceFromStep4()).toBe(true);
  });

  it('undo reverts create event actions', () => {
    const id = useDemoStore.getState().createPointEvent(1200);

    useDemoStore.getState().undo();

    const s = useDemoStore.getState();
    expect(s.events.find((item) => item.id === id)).toBeUndefined();
    expect(s.selectedEventId).toBeNull();
  });

  it('undo reverts update event actions', () => {
    const id = useDemoStore.getState().createPointEvent(1200);

    useDemoStore.getState().updateEvent(id, {
      eventType: 'hard-brake',
      severity: 'high',
      description: 'Vehicle brakes suddenly',
    });
    useDemoStore.getState().undo();

    const event = useDemoStore.getState().events.find((item) => item.id === id);
    expect(event).toMatchObject({
      eventType: '',
      severity: 'medium',
      description: '',
    });
  });

  it('undo reverts delete event actions', () => {
    const id = useDemoStore.getState().createPointEvent(1200);
    useDemoStore.getState().deleteEvent(id);

    useDemoStore.getState().undo();

    const s = useDemoStore.getState();
    expect(s.events.find((item) => item.id === id)).toMatchObject({ id, timeMs: 1200 });
    expect(s.selectedEventId).toBe(id);
  });

  it('reset restores snapshot state', () => {
    useDemoStore.getState().setSpeed('2x');
    useDemoStore.getState().createPointEvent(1200);
    useDemoStore.getState().setTimelineTool('range');
    useDemoStore.getState().seekToMs(3200);
    useDemoStore.getState().play();
    useDemoStore.getState().reset();

    const s = useDemoStore.getState();
    expect(s.activeDatasetId).toBe('city-road');
    expect(s.speed).toBe('2x');
    expect(s.demoStep).toBe(1);
    expect(s.events).toEqual([]);
    expect(s.selectedEventId).toBeNull();
    expect(s.timelineTool).toBe('browse');
    expect(s.undoStack).toEqual([]);
    expect(s.dirty).toBe(false);
    expect(s.playbackState).toBe('paused');
    expect(s.pendingSeekMs).toBeNull();
    expect(s.seekNonce).toBe(0);
  });

  it('reset restores fresh cloned annotations from the snapshot', () => {
    const beforeReset = useDemoStore.getState().annotations;
    const sourceDataset = getDataset('city-road');

    useDemoStore.getState().reset();

    const afterReset = useDemoStore.getState().annotations;
    expect(afterReset).not.toBe(beforeReset);
    expect(afterReset).not.toBe(sourceDataset.annotations);
    expect(afterReset[0]).not.toBe(sourceDataset.annotations[0]);
    expect(afterReset[0]?.keyframes[0]).not.toBe(sourceDataset.annotations[0]?.keyframes[0]);
    expect(afterReset[0]?.keyframes[0]?.timestamp_ms).toBe(sourceDataset.annotations[0]?.keyframes[0]?.timestamp_ms);
  });

  it('selectDataset replaces store with new snapshot', () => {
    useDemoStore.getState().createPointEvent(1200);
    expect(useDemoStore.getState().dirty).toBe(true);

    useDemoStore.getState().selectDataset('city-road');
    expect(useDemoStore.getState().events).toEqual([]);
    expect(useDemoStore.getState().dirty).toBe(false);
  });

  it('undo on empty stack is a no-op', () => {
    expect(() => useDemoStore.getState().undo()).not.toThrow();
  });
});
