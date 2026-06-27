import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import JSZip from 'jszip';
import { buildExportZip } from '@/steps/Step5Export/exportZip';
import { Step5Export } from '@/steps/Step5Export';
import { useDemoStore } from '@/store/demoStore';
import { getDataset } from '@/data';

// Mock fetch for frame loading (jsdom 没真 server)
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: false,
    status: 404,
    blob: async () => new Blob(),
  } as unknown as Response)));
  useDemoStore.getState().selectDataset('city-road');
});

describe('buildExportZip', () => {
  it('produces a zip with manifest, README, and event exports', async () => {
    const eventId = useDemoStore.getState().createPointEvent(4200);
    useDemoStore.getState().updateEvent(eventId, {
      eventType: 'incident',
      description: 'sudden lane change',
      severity: 'high',
      tags: ['vehicle'],
    });

    const ds = getDataset('city-road');
    const events = useDemoStore.getState().events;
    const blob = await buildExportZip({
      format: 'native',
      events,
      dataset: ds,
      exportedAt: 1718700000000,
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(500);

    const zip = await JSZip.loadAsync(blob);
    expect(zip.files['manifest.json']).toBeDefined();
    expect(zip.files['README.txt']).toBeDefined();
    expect(zip.files['annotations/native.json']).toBeDefined();
    expect(zip.files['annotations/coco_video.json']).toBeUndefined();

    const text = await zip.files['annotations/native.json']!.async('string');
    const data = JSON.parse(text);
    expect(data.dataset.dataset_id).toBe('city-road');
    expect(data.video.file_name).toBe(ds.video_src.split('/').pop());
    expect(data.events).toHaveLength(1);
    expect(data.events[0].id).toBe(eventId);
    expect(data.events[0].eventType).toBe('incident');
  });

  it('switches file path based on format', async () => {
    const ds = getDataset('city-road');
    const eventId = useDemoStore.getState().createRangeEvent(1000, 2500);
    useDemoStore.getState().updateEvent(eventId, { eventType: 'pedestrian', tags: ['crossing'] });
    const events = useDemoStore.getState().events;
    const blob = await buildExportZip({
      format: 'coco-video',
      events,
      dataset: ds,
      exportedAt: 1,
    });
    const zip = await JSZip.loadAsync(blob);
    expect(zip.files['annotations/coco_video.json']).toBeDefined();
    expect(zip.files['annotations/native.json']).toBeUndefined();
  });

  it('manifest reflects exported_at and event statistics', async () => {
    const pointId = useDemoStore.getState().createPointEvent(1200);
    useDemoStore.getState().updateEvent(pointId, { eventType: 'brake', severity: 'medium' });
    const rangeId = useDemoStore.getState().createRangeEvent(2400, 3600);
    useDemoStore.getState().attachRegionBox(rangeId, [10, 20, 30, 40], 2600);

    const ds = getDataset('city-road');
    const events = useDemoStore.getState().events;
    const blob = await buildExportZip({
      format: 'native',
      events,
      dataset: ds,
      exportedAt: 1718700000000,
    });
    const zip = await JSZip.loadAsync(blob);
    const mText = await zip.files['manifest.json']!.async('string');
    const m = JSON.parse(mText);
    expect(m.exported_at).toBe(1718700000000);
    expect(m.statistics.total).toBe(2);
    expect(m.statistics.point).toBe(1);
    expect(m.statistics.range).toBe(1);
    expect(m.statistics.with_region).toBe(1);
  });

  it('zip native.json reflects event marker changes from store', async () => {
    const eventId = useDemoStore.getState().createRangeEvent(5000, 9000);
    useDemoStore.getState().updateEvent(eventId, {
      eventType: 'near_miss',
      customEventType: 'bus-cut-in',
      severity: 'high',
      description: 'bus cuts in sharply',
      tags: ['bus', 'lane-change'],
    });
    useDemoStore.getState().attachRegionBox(eventId, [777, 888, 999, 222], 6400);

    const ds = getDataset('city-road');
    const events = useDemoStore.getState().events;
    const blob = await buildExportZip({
      format: 'native',
      events,
      dataset: ds,
      exportedAt: 1,
    });
    const zip = await JSZip.loadAsync(blob);
    const text = await zip.files['annotations/native.json']!.async('string');
    const data = JSON.parse(text);
    expect(data.events).toHaveLength(1);
    expect(data.events[0]).toMatchObject({
      id: eventId,
      eventType: 'near_miss',
      customEventType: 'bus-cut-in',
      mode: 'range',
      regionBox: [777, 888, 999, 222],
      regionAnchorMs: 6400,
    });
  });

  it('step5 preview shows event-based stats', () => {
    const pointId = useDemoStore.getState().createPointEvent(800);
    useDemoStore.getState().updateEvent(pointId, { eventType: 'brake' });
    const rangeId = useDemoStore.getState().createRangeEvent(2000, 4200);
    useDemoStore.getState().attachRegionBox(rangeId, [1, 2, 3, 4], 2400);

    render(createElement(Step5Export));

    expect(screen.getByText('总计')).toBeInTheDocument();
    expect(screen.getByText('点事件')).toBeInTheDocument();
    expect(screen.getByText('范围事件')).toBeInTheDocument();
    expect(screen.getByText('带框事件')).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === '总计2')).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === '点事件1')).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === '范围事件1')).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === '带框事件1')).toBeInTheDocument();
  });
});
