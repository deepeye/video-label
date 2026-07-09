import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Step4Review } from '@/steps/Step4Review';
import { useDemoStore } from '@/store/demoStore';

class ROStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = ROStub;

vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);

function mockRect(node: HTMLElement, rect: { left?: number; top?: number; width: number; height: number }) {
  Object.defineProperty(node, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: 0, y: 0,
      top: rect.top ?? 0, left: rect.left ?? 0,
      bottom: (rect.top ?? 0) + rect.height, right: (rect.left ?? 0) + rect.width,
      width: rect.width, height: rect.height,
      toJSON: () => ({}),
    }),
  });
}

describe('Step4 frame boxes overlay', () => {
  beforeEach(async () => {
    useDemoStore.getState().reset();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        video_name: 'test.mp4',
        concatenated_subtitles: 'hello',
        all_frames: [
          {
            frame_index: 0,
            subtitle_text: 'hello',
            parts: [{ part_id: 0, text: 'OCR', box: [[0,0],[100,0],[100,50],[0,50]] }],
            objects: [{ label: 'person', probability: 0.9, box_px: [10,20,200,300] }],
          },
        ],
      }),
    });
    await useDemoStore.getState().selectDataset('jiazhengnvhuang_13');
    useDemoStore.getState().goToStep(4);
  });

  it('renders overlay with rects matching the frame at currentTimeMs', () => {
    const { container } = render(<Step4Review />);
    const stage = screen.getByTestId('step4-video-stage');
    const video = stage.querySelector('video') as HTMLVideoElement;
    mockRect(video, { left: 0, top: 0, width: 1920, height: 1080 });
    mockRect(stage, { left: 0, top: 0, width: 1920, height: 1080 });

    act(() => { useDemoStore.getState().seekToMs(0); });

    const overlay = screen.getByTestId('frame-boxes-overlay');
    expect(overlay).toBeInTheDocument();
    const rects = container.querySelectorAll('[data-testid^="frame-box-"]');
    expect(rects.length).toBeGreaterThan(0);
  });

  it('clicking a frame box creates an event with matching type', () => {
    const { container } = render(<Step4Review />);
    const stage = screen.getByTestId('step4-video-stage');
    const video = stage.querySelector('video') as HTMLVideoElement;
    mockRect(video, { left: 0, top: 0, width: 1920, height: 1080 });
    mockRect(stage, { left: 0, top: 0, width: 1920, height: 1080 });

    act(() => { useDemoStore.getState().seekToMs(0); });

    const textBox = container.querySelector('[data-testid^="frame-box-text-"]') as HTMLElement | null;
    expect(textBox).toBeTruthy();
    if (!textBox) return;

    fireEvent.click(textBox);

    const events = useDemoStore.getState().events;
    expect(events).toHaveLength(1);
    expect(events[0]!.eventType).toBe('text');
    expect(events[0]!.timeMs).toBe(0);
    expect(events[0]!.description.length).toBeGreaterThan(0);
  });

  it('shows overlay for real dataset (has frame_boxes)', () => {
    render(<Step4Review />);
    const stage = screen.getByTestId('step4-video-stage');
    const video = stage.querySelector('video') as HTMLVideoElement;
    mockRect(video, { left: 0, top: 0, width: 1920, height: 1080 });
    mockRect(stage, { left: 0, top: 0, width: 1920, height: 1080 });

    act(() => { useDemoStore.getState().seekToMs(0); });

    expect(screen.getByTestId('frame-boxes-overlay')).toBeInTheDocument();
  });
});
