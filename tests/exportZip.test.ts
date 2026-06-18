import { describe, it, expect, beforeEach, vi } from 'vitest';
import JSZip from 'jszip';
import { buildExportZip } from '@/steps/Step5Export/exportZip';
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
  it('produces a zip with manifest, README, and annotations', async () => {
    const ds = getDataset('city-road');
    const annotations = useDemoStore.getState().annotations;
    const blob = await buildExportZip({
      format: 'native',
      annotations,
      dataset: ds,
      exportedAt: 1718700000000,
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000);

    // 解压验证
    const zip = await JSZip.loadAsync(blob);
    expect(zip.files['manifest.json']).toBeDefined();
    expect(zip.files['README.txt']).toBeDefined();
    expect(zip.files['annotations/native.json']).toBeDefined();
    expect(zip.files['annotations/coco_video.json']).toBeUndefined();
  });

  it('switches file path based on format', async () => {
    const ds = getDataset('city-road');
    const annotations = useDemoStore.getState().annotations;
    const blob = await buildExportZip({
      format: 'coco-video',
      annotations,
      dataset: ds,
      exportedAt: 1,
    });
    const zip = await JSZip.loadAsync(blob);
    expect(zip.files['annotations/coco_video.json']).toBeDefined();
    expect(zip.files['annotations/native.json']).toBeUndefined();
  });

  it('manifest reflects exported_at and statistics', async () => {
    useDemoStore.getState().acceptBox('trk_2');
    useDemoStore.getState().rejectBox('trk_5');

    const ds = getDataset('city-road');
    const annotations = useDemoStore.getState().annotations;
    const blob = await buildExportZip({
      format: 'native',
      annotations,
      dataset: ds,
      exportedAt: 1718700000000,
    });
    const zip = await JSZip.loadAsync(blob);
    const mText = await zip.files['manifest.json']!.async('string');
    const m = JSON.parse(mText);
    expect(m.exported_at).toBe(1718700000000);
    expect(m.statistics.accepted).toBe(1);
    expect(m.statistics.rejected).toBe(1);
    expect(m.statistics.pending).toBe(45);
  });

  it('zip native.json reflects review changes from store', async () => {
    useDemoStore.getState().correctBoxGeometry('trk_9', 0, [777, 888, 999, 222]);

    const ds = getDataset('city-road');
    const annotations = useDemoStore.getState().annotations;
    const blob = await buildExportZip({
      format: 'native',
      annotations,
      dataset: ds,
      exportedAt: 1,
    });
    const zip = await JSZip.loadAsync(blob);
    const text = await zip.files['annotations/native.json']!.async('string');
    const data = JSON.parse(text);
    const trk9 = data.annotations.find((a: { track_id: string }) => a.track_id === 'trk_9');
    expect(trk9.source).toBe('human');
    expect(trk9.review.status).toBe('corrected');
    expect(trk9.keyframes[0].geometry.coords).toEqual([777, 888, 999, 222]);
  });
});
