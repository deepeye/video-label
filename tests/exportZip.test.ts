import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import JSZip from 'jszip';
import { buildExportZip } from '@/steps/Step5Export/exportZip';
import { Step5Export } from '@/steps/Step5Export';
import { useDemoStore } from '@/store/demoStore';
import { getDataset } from '@/data';

// Mock fetch: dataset JSON (.json) returns ok payload so loadRealDataset succeeds;
// frame images return 404 (jsdom has no real server).
beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('.json')) {
      return {
        ok: true,
        json: async () => ({
          video_name: 'jiazhengnvhuang_13.mp4',
          concatenated_subtitles: 'sample',
          all_frames: [
            {
              frame_index: 0,
              subtitle_text: 'sample',
              parts: [{ part_id: 0, text: 'OCR', box: [[0, 0], [100, 0], [100, 50], [0, 50]] }],
              objects: [{ label: 'person', probability: 0.9, box_px: [10, 20, 200, 300] }],
            },
          ],
        }),
      } as unknown as Response;
    }
    return { ok: false, status: 404, blob: async () => new Blob() } as unknown as Response;
  }));
  await useDemoStore.getState().selectDataset('jiazhengnvhuang_13');
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

    const ds = getDataset('jiazhengnvhuang_13');
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
    expect(data.dataset.dataset_id).toBe('jiazhengnvhuang_13');
    expect(data.video.file_name).toBe(ds.video_src.split('/').pop());
    expect(data.events).toHaveLength(1);
    expect(data.events[0].id).toBe(eventId);
    expect(data.events[0].eventType).toBe('incident');
  });

  it('switches file path based on format', async () => {
    const ds = getDataset('jiazhengnvhuang_13');
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

    const ds = getDataset('jiazhengnvhuang_13');
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

    const ds = getDataset('jiazhengnvhuang_13');
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

  it('switching export format updates the preview JSON', () => {
    const eventId = useDemoStore.getState().createPointEvent(800);
    useDemoStore.getState().updateEvent(eventId, { eventType: 'brake' });

    render(createElement(Step5Export));

    expect(screen.getByTestId('format-native')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('json-preview')).toHaveTextContent('"events"');

    fireEvent.click(screen.getByTestId('format-coco-video'));

    expect(screen.getByTestId('format-coco-video')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('json-preview')).toHaveTextContent('"annotations"');

    fireEvent.click(screen.getByTestId('format-native'));

    expect(screen.getByTestId('format-native')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('json-preview')).toHaveTextContent('"events"');
  });
});
