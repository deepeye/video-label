import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDataset } from '@/data';
import { useDemoStore } from '@/store/demoStore';

describe('demoStore', () => {
  beforeEach(async () => {
    // mock fetch for real dataset loading
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        video_name: 'test.mp4',
        concatenated_subtitles: '',
        all_frames: [{ frame_index: 0, subtitle_text: '', parts: [], objects: [] }],
      }),
    });
    // loadedmetadata resolution handled by global test setup
    await useDemoStore.getState().selectDataset('jiazhengnvhuang_13');
  });

  it('initial state after loading matches snapshot defaults', () => {
    const s = useDemoStore.getState();
    expect(s.demoStep).toBe(1);
    expect(s.speed).toBe('1x');
    expect(s.activeDatasetId).toBe('jiazhengnvhuang_13');
    expect(s.annotations).toEqual([]);
    expect(s.events).toEqual([]);
    expect(s.selectedEventId).toBeNull();
    expect(s.timelineTool).toBe('browse');
    expect(s.dirty).toBe(false);
    expect(s.loadingDataset).toBe(false);
    expect(s.loadingDatasetError).toBeNull();
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
    expect(s.activeDatasetId).toBe('jiazhengnvhuang_13');
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
    const sourceDataset = getDataset('jiazhengnvhuang_13');

    useDemoStore.getState().reset();

    const afterReset = useDemoStore.getState().annotations;
    expect(afterReset).not.toBe(beforeReset);
    expect(afterReset).not.toBe(sourceDataset.annotations);
    expect(afterReset).toEqual([]);
  });

  it('deleteEvent removes the event and clears selection if selected', () => {
    const id = useDemoStore.getState().createPointEvent(1200);
    useDemoStore.getState().selectEvent(id);

    useDemoStore.getState().deleteEvent(id);

    const s = useDemoStore.getState();
    expect(s.events.find((item) => item.id === id)).toBeUndefined();
    expect(s.selectedEventId).toBeNull();
    expect(s.dirty).toBe(true);
  });

  it('removeRegionBox clears regionBox and regionAnchorMs', () => {
    const id = useDemoStore.getState().createPointEvent(800);
    useDemoStore.getState().attachRegionBox(id, [10, 20, 30, 40], 900);

    useDemoStore.getState().removeRegionBox(id);

    const event = useDemoStore.getState().events.find((item) => item.id === id);
    expect(event?.regionBox).toBeNull();
    expect(event?.regionAnchorMs).toBeNull();
  });

  it('updateEvent can clear regionBox by passing null', () => {
    const id = useDemoStore.getState().createPointEvent(800);
    useDemoStore.getState().attachRegionBox(id, [10, 20, 30, 40], 900);

    useDemoStore.getState().updateEvent(id, { regionBox: null });

    const event = useDemoStore.getState().events.find((item) => item.id === id);
    expect(event?.regionBox).toBeNull();
  });

  it('setSceneTags creates a new frame tag entry and tracks it for undo', () => {
    useDemoStore.getState().setSceneTags(30, 1000, ['夜间']);

    const s = useDemoStore.getState();
    expect(s.frameTags).toEqual([{ frame_no: 30, timestamp_ms: 1000, tags: ['夜间'], source: 'human' }]);
    expect(s.dirty).toBe(true);
    expect(s.undoStack).toHaveLength(1);
    expect(s.undoStack[0]).toMatchObject({ type: 'set-scene-tags', frameNo: 30, prevTags: [], prevTimestampMs: null });
  });

  it('setSceneTags updates an existing frame tag entry', () => {
    useDemoStore.getState().setSceneTags(30, 1000, ['夜间']);
    useDemoStore.getState().setSceneTags(30, 1000, ['夜间', '风险']);

    const s = useDemoStore.getState();
    expect(s.frameTags[0]?.tags).toEqual(['夜间', '风险']);
    expect(s.undoStack).toHaveLength(2);
    expect(s.undoStack[1]).toMatchObject({ type: 'set-scene-tags', frameNo: 30, prevTags: ['夜间'], prevTimestampMs: 1000 });
  });

  it('setAnnotationTool clears draftPolygon when switching away from polygon', () => {
    useDemoStore.getState().setAnnotationTool('polygon');
    useDemoStore.getState().addPolygonPoint([10, 20]);
    expect(useDemoStore.getState().draftPolygon).toHaveLength(1);

    useDemoStore.getState().setAnnotationTool('select');

    expect(useDemoStore.getState().draftPolygon).toEqual([]);
  });

  it('setAnnotationTool keeps draftPolygon when tool is polygon', () => {
    useDemoStore.getState().setAnnotationTool('polygon');
    useDemoStore.getState().addPolygonPoint([10, 20]);

    useDemoStore.getState().setAnnotationTool('polygon');

    expect(useDemoStore.getState().draftPolygon).toHaveLength(1);
  });

  it('polygon draft helpers mutate the draft array', () => {
    useDemoStore.getState().setAnnotationTool('polygon');
    useDemoStore.getState().startPolygonDraft();
    useDemoStore.getState().addPolygonPoint([1, 2]);
    useDemoStore.getState().addPolygonPoint([3, 4]);
    useDemoStore.getState().updatePolygonPoint(0, [5, 6]);
    useDemoStore.getState().updatePolygonPoint(10, [99, 99]);

    const s = useDemoStore.getState();
    expect(s.draftPolygon).toEqual([
      [5, 6],
      [3, 4],
    ]);

    useDemoStore.getState().commitPolygonDraft('trk_1', 1, 33);
    expect(useDemoStore.getState().draftPolygon).toEqual([]);

    useDemoStore.getState().addPolygonPoint([7, 8]);
    useDemoStore.getState().cancelPolygonDraft();
    expect(useDemoStore.getState().draftPolygon).toEqual([]);
  });

  it('updateEvent with unknown id is a no-op', () => {
    expect(() => useDemoStore.getState().updateEvent('event-does-not-exist', { eventType: 'x' })).not.toThrow();
    expect(useDemoStore.getState().undoStack).toHaveLength(0);
  });

  it('deleteEvent with unknown id is a no-op', () => {
    expect(() => useDemoStore.getState().deleteEvent('event-does-not-exist')).not.toThrow();
  });

  it('removeRegionBox with unknown id is a no-op', () => {
    expect(() => useDemoStore.getState().removeRegionBox('event-does-not-exist')).not.toThrow();
  });

  it('attachRegionBox with unknown id is a no-op', () => {
    expect(() => useDemoStore.getState().attachRegionBox('event-does-not-exist', [1, 2, 3, 4], 100)).not.toThrow();
  });

  it('createPointEvent generates independent ids across dataset switches', async () => {
    const id1 = useDemoStore.getState().createPointEvent(100);
    await useDemoStore.getState().selectDataset('jiazhengnvhuang_5');
    const id2 = useDemoStore.getState().createPointEvent(200);

    expect(id1).not.toBe(id2);
    expect(useDemoStore.getState().events).toHaveLength(1);
  });

  it('setFrameTextPart writes an edit, marks dirty, and tracks undo', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        video_name: 'test.mp4',
        concatenated_subtitles: '',
        all_frames: [{
          frame_index: 0,
          subtitle_text: '',
          parts: [{ part_id: 0, text: '原始OCR', box: [[0,0],[100,0],[100,50],[0,50]] }],
          objects: [],
        }],
      }),
    });
    await useDemoStore.getState().selectDataset('jiazhengnvhuang_13');

    useDemoStore.getState().setFrameTextPart(0, 0, '修正后');

    const s = useDemoStore.getState();
    expect(s.frameTextEdits).toEqual([{ frame_index: 0, part_id: 0, text: '修正后' }]);
    expect(s.dirty).toBe(true);
    expect(s.undoStack).toHaveLength(1);
    expect(s.undoStack[0]).toMatchObject({ type: 'set-frame-text', frameIndex: 0, partId: 0, prevText: null });
  });

  it('setFrameTextPart is a no-op when text equals current resolved value', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        video_name: 'test.mp4',
        concatenated_subtitles: '',
        all_frames: [{
          frame_index: 0,
          subtitle_text: '',
          parts: [{ part_id: 0, text: '原始OCR', box: [[0,0],[100,0],[100,50],[0,50]] }],
          objects: [],
        }],
      }),
    });
    await useDemoStore.getState().selectDataset('jiazhengnvhuang_13');

    useDemoStore.getState().setFrameTextPart(0, 0, '原始OCR');

    const s = useDemoStore.getState();
    expect(s.frameTextEdits).toEqual([]);
    expect(s.dirty).toBe(false);
    expect(s.undoStack).toEqual([]);
  });

  it('setFrameTextPart back to original removes the edit and records prevText', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        video_name: 'test.mp4',
        concatenated_subtitles: '',
        all_frames: [{
          frame_index: 0,
          subtitle_text: '',
          parts: [{ part_id: 0, text: '原始OCR', box: [[0,0],[100,0],[100,50],[0,50]] }],
          objects: [],
        }],
      }),
    });
    await useDemoStore.getState().selectDataset('jiazhengnvhuang_13');

    useDemoStore.getState().setFrameTextPart(0, 0, '修正A');
    useDemoStore.getState().setFrameTextPart(0, 0, '原始OCR');

    const s = useDemoStore.getState();
    expect(s.frameTextEdits).toEqual([]);
    expect(s.undoStack).toHaveLength(2);
    expect(s.undoStack[1]).toMatchObject({ type: 'set-frame-text', frameIndex: 0, partId: 0, prevText: '修正A' });
  });

  it('undo reverts setFrameTextPart back to original (no edit)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        video_name: 'test.mp4',
        concatenated_subtitles: '',
        all_frames: [{
          frame_index: 0,
          subtitle_text: '',
          parts: [{ part_id: 0, text: '原始OCR', box: [[0,0],[100,0],[100,50],[0,50]] }],
          objects: [],
        }],
      }),
    });
    await useDemoStore.getState().selectDataset('jiazhengnvhuang_13');

    useDemoStore.getState().setFrameTextPart(0, 0, '修正后');
    useDemoStore.getState().undo();

    expect(useDemoStore.getState().frameTextEdits).toEqual([]);
  });

  it('undo of A->B->A chain restores each step', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        video_name: 'test.mp4',
        concatenated_subtitles: '',
        all_frames: [{
          frame_index: 0,
          subtitle_text: '',
          parts: [{ part_id: 0, text: '原始', box: [[0,0],[100,0],[100,50],[0,50]] }],
          objects: [],
        }],
      }),
    });
    await useDemoStore.getState().selectDataset('jiazhengnvhuang_13');

    useDemoStore.getState().setFrameTextPart(0, 0, 'A');
    useDemoStore.getState().setFrameTextPart(0, 0, 'B');
    useDemoStore.getState().setFrameTextPart(0, 0, '原始');

    useDemoStore.getState().undo();
    expect(useDemoStore.getState().frameTextEdits[0]?.text).toBe('B');
    useDemoStore.getState().undo();
    expect(useDemoStore.getState().frameTextEdits[0]?.text).toBe('A');
    useDemoStore.getState().undo();
    expect(useDemoStore.getState().frameTextEdits).toEqual([]);
  });

  it('reset clears frameTextEdits and undoStack', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        video_name: 'test.mp4',
        concatenated_subtitles: '',
        all_frames: [{
          frame_index: 0,
          subtitle_text: '',
          parts: [{ part_id: 0, text: '原始', box: [[0,0],[100,0],[100,50],[0,50]] }],
          objects: [],
        }],
      }),
    });
    await useDemoStore.getState().selectDataset('jiazhengnvhuang_13');
    useDemoStore.getState().setFrameTextPart(0, 0, '修正');
    expect(useDemoStore.getState().frameTextEdits).toHaveLength(1);

    useDemoStore.getState().reset();

    const s = useDemoStore.getState();
    expect(s.frameTextEdits).toEqual([]);
    expect(s.undoStack).toEqual([]);
    expect(s.dirty).toBe(false);
  });
});
