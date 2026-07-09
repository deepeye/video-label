import { describe, expect, it, vi } from 'vitest';
import { defaultDatasetId, loadRealDataset, getDataset } from '@/data';

describe('dataset registry', () => {
  it('defaultDatasetId is the first real dataset', () => {
    expect(defaultDatasetId).toBe('jiazhengnvhuang_13');
  });

  it('getDataset throws when dataset not loaded', () => {
    expect(() => getDataset('jiazhengnvhuang_13')).toThrow('not loaded yet');
  });

  it('loadRealDataset fetches and caches', async () => {
    // mock fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        video_name: 'test.mp4',
        concatenated_subtitles: '',
        all_frames: [{ frame_index: 0, subtitle_text: '', parts: [], objects: [] }],
      }),
    });

    // mock video element so loadedmetadata fires immediately in jsdom
    const originalCreateElement = document.createElement;
    const mockVideo = {
      preload: '',
      muted: false,
      crossOrigin: '',
      src: '',
      currentTime: 0,
      duration: 10,
      videoWidth: 1920,
      videoHeight: 1080,
      remove: vi.fn(),
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === 'loadedmetadata') {
          handler();
        }
      }),
    };
    document.createElement = vi.fn((tag: string) => {
      if (tag === 'video') return mockVideo as unknown as HTMLVideoElement;
      return originalCreateElement.call(document, tag);
    });

    const ds = await loadRealDataset('jiazhengnvhuang_13');
    expect(ds.dataset_id).toBe('jiazhengnvhuang_13');
    expect(ds.display).toBe('家政女皇·肉片穿衣');

    // 缓存后 getDataset 可用
    const cached = getDataset('jiazhengnvhuang_13');
    expect(cached).toBe(ds);

    globalThis.fetch = originalFetch;
    document.createElement = originalCreateElement;
  });
});
