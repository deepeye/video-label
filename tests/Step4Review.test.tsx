import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Step4Review } from '@/steps/Step4Review';
import { useDemoStore } from '@/store/demoStore';

class ROStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

(globalThis as { ResizeObserver?: unknown }).ResizeObserver = ROStub;

const playSpy = vi
  .spyOn(HTMLMediaElement.prototype, 'play')
  .mockImplementation(() => Promise.resolve());
const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);

function mockRect(node: HTMLElement, rect: Partial<DOMRect> & Pick<DOMRect, 'width' | 'height'>) {
  Object.defineProperty(node, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      top: rect.top ?? 0,
      left: rect.left ?? 0,
      bottom: rect.bottom ?? (rect.top ?? 0) + rect.height,
      right: rect.right ?? (rect.left ?? 0) + rect.width,
      width: rect.width,
      height: rect.height,
      toJSON: () => ({}),
    }),
  });
}

function mockVideoCurrentTime(video: HTMLVideoElement) {
  let currentTime = 0;
  Object.defineProperty(video, 'currentTime', {
    configurable: true,
    get: () => currentTime,
    set: (value: number) => {
      currentTime = value;
    },
  });

  return {
    set(value: number) {
      currentTime = value;
    },
  };
}

describe('Step4Review integration', () => {
  beforeEach(() => {
    useDemoStore.getState().reset();
    useDemoStore.getState().selectDataset('city-road');
    useDemoStore.getState().goToStep(4);
    playSpy.mockClear();
    pauseSpy.mockClear();
  });

  it('renders the final Step4 shell with mode switcher, video stage, timeline, and event panel', () => {
    render(<Step4Review />);

    expect(screen.getByRole('button', { name: '播放' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '浏览' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '点' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '范围' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '区域' })).toBeInTheDocument();
    expect(screen.getByTestId('step4-video-stage')).toBeInTheDocument();
    expect(screen.getByTestId('step4-timeline-surface')).toBeInTheDocument();
    expect(screen.getByText('事件列表')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-accept')).not.toBeInTheDocument();
    expect(screen.queryByTestId('queue-card-trk_2')).not.toBeInTheDocument();
    expect(playSpy).not.toHaveBeenCalled();
  });

  it('store-driven seek updates video.currentTime and pauses playback', async () => {
    render(<Step4Review />);

    const video = screen.getByTestId('step4-video-stage').querySelector('video') as HTMLVideoElement;
    mockVideoCurrentTime(video);

    act(() => {
      useDemoStore.getState().seekToMs(7500);
    });

    await waitFor(() => {
      expect(video.currentTime).toBeCloseTo(7.5, 1);
      expect(pauseSpy).toHaveBeenCalled();
      expect(useDemoStore.getState().pendingSeekMs).toBeNull();
      expect(useDemoStore.getState().playbackState).toBe('paused');
    });
  });

  it('store play() resumes video from a paused seek location and syncs currentTimeMs while playing', async () => {
    render(<Step4Review />);

    const video = screen.getByTestId('step4-video-stage').querySelector('video') as HTMLVideoElement;
    const mockedTime = mockVideoCurrentTime(video);

    act(() => {
      useDemoStore.getState().seekToMs(3200);
    });

    await waitFor(() => {
      expect(video.currentTime).toBeCloseTo(3.2, 1);
      expect(pauseSpy).toHaveBeenCalled();
    });

    act(() => {
      useDemoStore.getState().play();
    });

    expect(useDemoStore.getState().playbackState).toBe('playing');
    expect(playSpy).toHaveBeenCalled();

    act(() => {
      mockedTime.set(4.8);
      fireEvent(video, new Event('timeupdate'));
    });

    expect(useDemoStore.getState().currentTimeMs).toBe(4800);
  });

  it('stops syncing currentTimeMs after playback is paused', async () => {
    render(<Step4Review />);

    const video = screen.getByTestId('step4-video-stage').querySelector('video') as HTMLVideoElement;
    const mockedTime = mockVideoCurrentTime(video);

    act(() => {
      useDemoStore.getState().play();
    });

    act(() => {
      mockedTime.set(2.1);
      fireEvent(video, new Event('timeupdate'));
    });

    expect(useDemoStore.getState().currentTimeMs).toBe(2100);

    act(() => {
      useDemoStore.getState().pause();
    });

    expect(useDemoStore.getState().playbackState).toBe('paused');

    act(() => {
      mockedTime.set(3.4);
      fireEvent(video, new Event('timeupdate'));
    });

    expect(useDemoStore.getState().currentTimeMs).toBe(2100);
  });

  it('clicking the shell playback button toggles playbackState', () => {
    render(<Step4Review />);

    const playButton = screen.getByRole('button', { name: '播放' });
    fireEvent.click(playButton);

    expect(useDemoStore.getState().playbackState).toBe('playing');
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '暂停' })).toBeInTheDocument();

    pauseSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: '暂停' }));

    expect(useDemoStore.getState().playbackState).toBe('paused');
    expect(pauseSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '播放' })).toBeInTheDocument();
  });
  it('clicking shell mode buttons updates timelineTool', () => {
    render(<Step4Review />);

    fireEvent.click(screen.getByRole('button', { name: '点' }));
    expect(useDemoStore.getState().timelineTool).toBe('point');

    fireEvent.click(screen.getByRole('button', { name: '范围' }));
    expect(useDemoStore.getState().timelineTool).toBe('range');

    fireEvent.click(screen.getByRole('button', { name: '区域' }));
    expect(useDemoStore.getState().timelineTool).toBe('region');

    fireEvent.click(screen.getByRole('button', { name: '浏览' }));
    expect(useDemoStore.getState().timelineTool).toBe('browse');
  });

  it('dragging on the video stage in region mode attaches a region box and returns to browse', () => {
    render(<Step4Review />);

    const timeline = screen.getByTestId('step4-timeline-surface');
    mockRect(timeline, { left: 0, top: 0, width: 1000, height: 56 });
    act(() => {
      useDemoStore.getState().setTimelineTool('point');
    });
    fireEvent.click(timeline, { clientX: 250 });

    const createdEvent = useDemoStore.getState().events[0];
    expect(createdEvent).toBeDefined();

    act(() => {
      useDemoStore.getState().selectEvent(createdEvent!.id);
      useDemoStore.getState().setTimelineTool('region');
    });

    const stage = screen.getByTestId('step4-video-stage');
    mockRect(stage, { left: 10, top: 20, width: 400, height: 200 });

    fireEvent.mouseDown(stage, { clientX: 50, clientY: 60 });
    fireEvent.mouseMove(stage, { clientX: 210, clientY: 160 });
    fireEvent.mouseUp(stage, { clientX: 210, clientY: 160 });

    const updatedEvent = useDemoStore.getState().events.find((item) => item.id === createdEvent!.id);
    expect(updatedEvent?.regionBox).toEqual([40, 40, 160, 100]);
    expect(updatedEvent?.regionAnchorMs).toBe(useDemoStore.getState().currentTimeMs);
    expect(useDemoStore.getState().timelineTool).toBe('browse');
  });

  it('canAdvanceFromStep4 becomes true after creating one event', () => {
    render(<Step4Review />);

    expect(useDemoStore.getState().canAdvanceFromStep4()).toBe(false);

    const timeline = screen.getByTestId('step4-timeline-surface');
    mockRect(timeline, { left: 0, top: 0, width: 1000, height: 56 });
    act(() => {
      useDemoStore.getState().setTimelineTool('point');
    });
    fireEvent.click(timeline, { clientX: 320 });

    expect(useDemoStore.getState().events).toHaveLength(1);
    expect(useDemoStore.getState().canAdvanceFromStep4()).toBe(true);
  });
});
