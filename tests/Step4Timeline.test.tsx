import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Step4Review } from '@/steps/Step4Review';
import { useDemoStore } from '@/store/demoStore';

vi.mock('react-konva', () => ({
  Stage: ({ children }: { children: ReactNode }) => <div data-testid="konva-stage-mock">{children}</div>,
  Layer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Rect: () => null,
  Image: () => null,
  Text: () => null,
  Label: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tag: () => null,
  Transformer: () => null,
}));

class ROStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = ROStub;

describe('Step4 timeline workflow', () => {
  const mockTimelineRect = (surface: HTMLElement) => {
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 24,
      right: 300,
      width: 300,
      height: 24,
      toJSON: () => ({}),
    });
  };

  beforeEach(() => {
    useDemoStore.getState().reset();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    useDemoStore.getState().selectDataset('city-road');
    useDemoStore.getState().goToStep(4);
    useDemoStore.getState().setCurrentTimeMs(0);
    useDemoStore.getState().setTimelineTool('browse');
  });

  it('point mode click creates point event and returns to browse mode', () => {
    render(<Step4Review />);

    fireEvent.click(screen.getByRole('button', { name: '点' }));

    const surface = screen.getByTestId('step4-timeline-surface');
    mockTimelineRect(surface);

    fireEvent.click(surface, { clientX: 150, clientY: 12 });

    const state = useDemoStore.getState();
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({ mode: 'point', timeMs: 15_000 });
    expect(state.timelineTool).toBe('browse');
    expect(state.selectedEventId).toBe(state.events[0]?.id);
  });

  it('right-clicking the timeline surface opens a context menu with both event actions', () => {
    render(<Step4Review />);

    const surface = screen.getByTestId('step4-timeline-surface');
    mockTimelineRect(surface);

    fireEvent.contextMenu(surface, { clientX: 90, clientY: 18 });

    expect(screen.getByRole('menuitem', { name: '新增点事件' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '新增区间事件' })).toBeInTheDocument();
  });

  it('clicking 新增点事件 from the timeline context menu creates a point event, selects it, seeks, and closes the menu', () => {
    render(<Step4Review />);

    const surface = screen.getByTestId('step4-timeline-surface');
    mockTimelineRect(surface);

    fireEvent.contextMenu(surface, { clientX: 120, clientY: 18 });
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: '新增点事件' }));

    const state = useDemoStore.getState();
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({ mode: 'point', timeMs: 12_000 });
    expect(state.selectedEventId).toBe(state.events[0]?.id);
    expect(state.currentTimeMs).toBe(12_000);
  });

  it('right-clicking 新增点事件 twice at the same time creates two independent events', () => {
    render(<Step4Review />);

    const surface = screen.getByTestId('step4-timeline-surface');
    mockTimelineRect(surface);

    fireEvent.contextMenu(surface, { clientX: 120, clientY: 18 });
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: '新增点事件' }));

    fireEvent.contextMenu(surface, { clientX: 120, clientY: 18 });
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: '新增点事件' }));

    const state = useDemoStore.getState();
    expect(state.events).toHaveLength(2);
    expect(state.events[0]).toMatchObject({ mode: 'point', timeMs: 12_000 });
    expect(state.events[1]).toMatchObject({ mode: 'point', timeMs: 12_000 });
    expect(state.selectedEventId).toBe(state.events[1]?.id);
  });

  it('clicking 新增区间事件 from the timeline context menu enters one-shot range creation from the clicked timestamp', () => {
    render(<Step4Review />);

    const surface = screen.getByTestId('step4-timeline-surface');
    mockTimelineRect(surface);

    fireEvent.contextMenu(surface, { clientX: 120, clientY: 18 });
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: '新增区间事件' }));

    expect(useDemoStore.getState().timelineTool).toBe('browse');
  });

  it('clicking 新增区间事件 from the timeline context menu creates a range event after drag release from the clicked start time', () => {
    render(<Step4Review />);

    const surface = screen.getByTestId('step4-timeline-surface');
    mockTimelineRect(surface);

    fireEvent.contextMenu(surface, { clientX: 120, clientY: 18 });
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: '新增区间事件' }));

    fireEvent.mouseMove(surface, { clientX: 210, clientY: 12 });
    fireEvent.mouseUp(surface, { clientX: 210, clientY: 12 });

    const state = useDemoStore.getState();
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({
      mode: 'range',
      startMs: 12_000,
      endMs: 21_000,
    });
    expect(state.selectedEventId).toBe(state.events[0]?.id);
    expect(state.currentTimeMs).toBe(12_000);
    expect(state.timelineTool).toBe('browse');
    expect(screen.getByText('工具：浏览')).toBeInTheDocument();
  });

  it('browse mode drag scrubs current time in real time and pauses on release', () => {
    render(<Step4Review />);

    act(() => {
      useDemoStore.getState().play();
    });

    const surface = screen.getByTestId('step4-timeline-surface');
    mockTimelineRect(surface);

    fireEvent.mouseDown(surface, { clientX: 90, clientY: 12, button: 0 });
    expect(useDemoStore.getState().currentTimeMs).toBe(9_000);

    fireEvent.mouseMove(surface, { clientX: 210, clientY: 12, buttons: 1 });
    expect(useDemoStore.getState().currentTimeMs).toBe(21_000);

    fireEvent.mouseUp(surface, { clientX: 180, clientY: 12, button: 0 });

    const state = useDemoStore.getState();
    expect(state.currentTimeMs).toBe(18_000);
    expect(state.playbackState).toBe('paused');
    expect(state.events).toHaveLength(0);
    expect(state.timelineTool).toBe('browse');
  });

  it('range mode drag creates normalized range event instead of browse scrubbing', () => {
    render(<Step4Review />);

    fireEvent.click(screen.getByRole('button', { name: '范围' }));

    const surface = screen.getByTestId('step4-timeline-surface');
    mockTimelineRect(surface);

    fireEvent.mouseDown(surface, { clientX: 240, clientY: 12, button: 0 });
    fireEvent.mouseMove(surface, { clientX: 60, clientY: 12, buttons: 1 });

    expect(useDemoStore.getState().currentTimeMs).toBe(0);

    fireEvent.mouseUp(surface, { clientX: 60, clientY: 12, button: 0 });

    const state = useDemoStore.getState();
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({
      mode: 'range',
      startMs: 6_000,
      endMs: 24_000,
    });
    expect(state.timelineTool).toBe('browse');
    expect(state.selectedEventId).toBe(state.events[0]?.id);
    expect(state.currentTimeMs).toBe(0);
  });


  it('clicking an existing timeline marker selects the matching event', () => {
    const firstId = useDemoStore.getState().createPointEvent(3_000);
    const secondId = useDemoStore.getState().createRangeEvent(8_000, 12_000);
    useDemoStore.getState().selectEvent(firstId);
    useDemoStore.getState().setCurrentTimeMs(0);

    render(<Step4Review />);

    fireEvent.click(screen.getByTestId(`timeline-event-${secondId}`));

    const state = useDemoStore.getState();
    expect(state.selectedEventId).toBe(secondId);
    expect(state.currentTimeMs).toBe(8_000);
  });

  it('renders played progress width from currentTimeMs', () => {
    useDemoStore.getState().setCurrentTimeMs(7_500);

    render(<Step4Review />);

    expect(screen.getByTestId('timeline-played-progress')).toHaveStyle({ width: '25%' });
  });

  it('updates played progress width when currentTimeMs changes', () => {
    render(<Step4Review />);

    expect(screen.getByTestId('timeline-played-progress')).toHaveStyle({ width: '0%' });

    act(() => {
      useDemoStore.getState().setCurrentTimeMs(18_000);
    });

    expect(screen.getByTestId('timeline-played-progress')).toHaveStyle({ width: '60%' });
  });

  it('renders highlighted current time and frame for currentTimeMs', () => {
    useDemoStore.getState().setCurrentTimeMs(2_893);

    render(<Step4Review />);

    expect(screen.getByText('当前时间 2.893s · 第 87 帧')).toBeInTheDocument();
    expect(screen.getByText('工具：浏览')).toBeInTheDocument();
  });

  it('updates highlighted current time and frame when currentTimeMs changes', () => {
    render(<Step4Review />);

    expect(screen.getByText('当前时间 0.000s · 第 0 帧')).toBeInTheDocument();

    act(() => {
      useDemoStore.getState().setCurrentTimeMs(18_000);
    });

    expect(screen.getByText('当前时间 18.000s · 第 540 帧')).toBeInTheDocument();
  });

  it('shell playback button reflects store playback state changes', () => {
    render(<Step4Review />);

    expect(screen.getByRole('button', { name: '播放' })).toBeInTheDocument();

    act(() => {
      useDemoStore.getState().play();
    });

    expect(screen.getByRole('button', { name: '暂停' })).toBeInTheDocument();

    act(() => {
      useDemoStore.getState().pause();
    });

    expect(screen.getByRole('button', { name: '播放' })).toBeInTheDocument();
  });
});
