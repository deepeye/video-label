import { describe, it, expect, beforeEach } from 'vitest';
import { useDemoStore } from '@/store/demoStore';
import { getDataset } from '@/data';
import { toNative } from '@/lib/format/native';
import { toCocoVideo } from '@/lib/format/cocoVideo';
import type { Point } from '@/types';

const DS_ID = 'jiazhengnvhuang_13' as const;

describe('toNative', () => {
  beforeEach(async () => {
    await useDemoStore.getState().selectDataset(DS_ID);
    useDemoStore.getState().reset();
  });

  it('exports event-based payload with dataset and video metadata', () => {
    const eventId = useDemoStore.getState().createPointEvent(4200);
    useDemoStore.getState().updateEvent(eventId, {
      eventType: 'sudden_brake',
      severity: 'high',
      tags: ['风险'],
      description: '车辆急刹',
    });

    const ds = getDataset(DS_ID);
    const out = toNative(useDemoStore.getState().events, ds, 1718700000000);

    expect(out.version).toBe('2.0-demo');
    expect(out.dataset.dataset_id).toBe(DS_ID);
    expect(out.exported_at).toBe(1718700000000);
    expect(out.video.file_name).toBe(ds.video_src.split('/').pop());
    expect(out.video.width).toBe(ds.metadata.width);
    expect(out.video.height).toBe(ds.metadata.height);
    expect(out.events).toHaveLength(1);
    expect(out.events[0]).toMatchObject({
      id: eventId,
      eventType: 'sudden_brake',
      severity: 'high',
      tags: ['风险'],
      description: '车辆急刹',
      mode: 'point',
      timeMs: 4200,
    });
  });

  it('reflects range events and region boxes from store', () => {
    const eventId = useDemoStore.getState().createRangeEvent(2400, 3600);
    useDemoStore.getState().updateEvent(eventId, {
      eventType: 'near_miss',
      customEventType: 'bus-cut-in',
      severity: 'medium',
      tags: ['bus', 'lane-change'],
    });
    useDemoStore.getState().attachRegionBox(eventId, [100, 200, 300, 400], 3200);

    const ds = getDataset('jiazhengnvhuang_13');
    const out = toNative(useDemoStore.getState().events, ds, 1);
    const event = out.events.find((item) => item.id === eventId)!;

    expect(event).toMatchObject({
      eventType: 'near_miss',
      customEventType: 'bus-cut-in',
      mode: 'range',
      startMs: 2400,
      endMs: 3600,
      regionBox: [100, 200, 300, 400],
      regionAnchorMs: 3200,
    });
  });

  it('serialization is JSON-roundtrip-safe', () => {
    const ds = getDataset('jiazhengnvhuang_13');
    const eventId = useDemoStore.getState().createPointEvent(800);
    useDemoStore.getState().updateEvent(eventId, { eventType: 'incident' });
    const out = toNative(useDemoStore.getState().events, ds, 1718700000000);
    const back = JSON.parse(JSON.stringify(out));

    expect(back.events).toHaveLength(1);
    expect(back.dataset.dataset_id).toBe('jiazhengnvhuang_13');
    expect(back.events[0].eventType).toBe('incident');
  });
});

describe('toCocoVideo', () => {
  beforeEach(async () => {
    await useDemoStore.getState().selectDataset('jiazhengnvhuang_13');
    useDemoStore.getState().reset();
  });

  it('builds proper COCO-Video structure from dataset annotations', () => {
    const ds = getDataset('jiazhengnvhuang_13');
    const out = toCocoVideo(ds.annotations, ds, 1718700000000);

    expect(out.info.version).toBe('2.0-demo');
    expect(out.info.date_created).toMatch(/^\d{4}-/);
    expect(out.videos).toHaveLength(1);
    expect(out.videos[0]!.width).toBe(1920);
    expect(out.videos[0]!.height).toBe(1080);
    expect(out.videos[0]!.frame_rate).toBe(30);
    expect(out.videos[0]!.duration).toBe(30);

    // mock fetch provides 1 frame with a 'person' object
    const cats = out.categories.map((c) => c.name);
    expect(cats).toContain('person');
    expect(out.annotations.length).toBeGreaterThanOrEqual(1);
  });

  it('includes x_events extension field when events are provided', () => {
    const eventId = useDemoStore.getState().createPointEvent(5000);
    useDemoStore.getState().updateEvent(eventId, {
      eventType: 'pedestrian_crossing',
      severity: 'high',
      description: '行人横穿',
    });

    const ds = getDataset('jiazhengnvhuang_13');
    const out = toCocoVideo(ds.annotations, ds, 1, [], useDemoStore.getState().events);

    expect(out.x_events).toHaveLength(1);
    expect(out.x_events?.[0]).toMatchObject({
      id: eventId,
      eventType: 'pedestrian_crossing',
      timeMs: 5000,
    });
  });

  it('annotation ids are unique', () => {
    const ds = getDataset('jiazhengnvhuang_13');
    const out = toCocoVideo(ds.annotations, ds, 1);
    const ids = out.annotations.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('converts polygon annotations to COCO with x_geometry_type and x_polygon', () =>
  {
    const ds = getDataset('jiazhengnvhuang_13');
    const polygonAnn = {
      ...ds.annotations[0]!,
      track_id: 'trk_polygon_test',
      label_id: 'vehicle',
      keyframes: [
        {
          timestamp_ms: 1000,
          frame_no: 30,
          geometry: {
            type: 'polygon' as const,
            points: [
              [0, 0],
              [50, 0],
              [50, 50],
            ] as Point[],
          },
          is_keyframe: true,
        },
      ],
    };
    const out = toCocoVideo([polygonAnn], ds, 1);
    const found = out.annotations.find((a) => a.x_geometry_type === 'polygon');
    expect(found).toBeDefined();
    expect(found!.x_geometry_type).toBe('polygon');
    expect(found!.x_polygon).toEqual([
      [0, 0],
      [50, 0],
      [50, 50],
    ]);
    expect(found!.bbox).toEqual([0, 0, 50, 50]);
  });

  it('maps track_id prefixes to numeric track_ids without collisions', () => {
    const ds = getDataset('jiazhengnvhuang_13');
    const base = ds.annotations[0]!;
    const anns = [
      { ...base, track_id: 'trk_1', label_id: 'vehicle', keyframes: [base.keyframes[0]!] },
      { ...base, track_id: 'trk_v1', label_id: 'vehicle', keyframes: [base.keyframes[0]!] },
      { ...base, track_id: 'trk_p1', label_id: 'vehicle', keyframes: [base.keyframes[0]!] },
      { ...base, track_id: 'trk_s1', label_id: 'vehicle', keyframes: [base.keyframes[0]!] },
      { ...base, track_id: 'trk_z99', label_id: 'vehicle', keyframes: [base.keyframes[0]!] },
    ];
    const out = toCocoVideo(anns, ds, 1);
    const trackIds = out.annotations.map((a) => a.track_id);
    expect(new Set(trackIds).size).toBe(trackIds.length);
    expect(trackIds).toContain(1);
    expect(trackIds).toContain(1001);
    expect(trackIds).toContain(2001);
    expect(trackIds).toContain(3001);
  });
});
