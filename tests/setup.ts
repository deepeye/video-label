import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // Restore only the addEventListener spy installed by this setup; leave
  // module-level spies (e.g. HTMLMediaElement.play in Step4Review tests) intact.
  vi.mocked(HTMLVideoElement.prototype.addEventListener).mockRestore?.();
});

// Global mocks for real dataset async loading: stub fetch and make
// <video> elements resolve loadedmetadata on the next microtask (jsdom never
// fires it). Other addEventListener calls pass through to the original so
// timeupdate/seeked listeners (used by the playback effect) still register.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({
      video_name: 'jiazhengnvhuang_13.mp4',
      concatenated_subtitles: 'sample subtitle',
      all_frames: [
        {
          frame_index: 0,
          subtitle_text: 'sample',
          parts: [{ part_id: 0, text: 'OCR', box: [[0, 0], [100, 0], [100, 50], [0, 50]] }],
          objects: [{ label: 'person', probability: 0.9, box_px: [10, 20, 200, 300], prompt_used: 'p' }],
        },
      ],
    }),
  } as unknown as Response)));

  const original = HTMLVideoElement.prototype.addEventListener;
  vi.spyOn(HTMLVideoElement.prototype, 'addEventListener').mockImplementation(function (this: HTMLVideoElement, event: string, handler: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions) {
    if (event === 'loadedmetadata' && typeof handler === 'function') {
      queueMicrotask(() => (handler as EventListener).call(this, new Event('loadedmetadata')));
    }
    if (handler) {
      return original.call(this, event, handler, options);
    }
    return this;
  } as typeof original);
});
