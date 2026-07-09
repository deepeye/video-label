import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('Step4 event panel', () => {
  beforeEach(() => {
    useDemoStore.getState().reset();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    useDemoStore.getState().selectDataset('city-road');
    useDemoStore.getState().goToStep(4);
    useDemoStore.getState().setCurrentTimeMs(12_345);
  });

  it('fallback add creates a point event at current time and shows the selected editor', async () => {
    const user = userEvent.setup();
    render(<Step4Review />);

    await user.click(screen.getByRole('button', { name: '新增事件' }));

    const { events, selectedEventId } = useDemoStore.getState();
    expect(events).toHaveLength(1);
    expect(selectedEventId).toBe(events[0]?.id);
    expect(events[0]?.mode).toBe('point');
    expect(events[0]?.timeMs).toBe(12_345);
    expect(screen.getByLabelText('事件类型')).toBeInTheDocument();
  });

  it('editing type, severity, tags, and description writes back to store', async () => {
    const user = userEvent.setup();
    const eventId = useDemoStore.getState().createPointEvent(5_000);

    render(<Step4Review />);

    await user.selectOptions(screen.getByLabelText('事件类型'), 'custom');
    await user.type(screen.getByLabelText('自定义事件类型'), '追尾');
    await user.selectOptions(screen.getByLabelText('严重程度'), 'high');
    useDemoStore.getState().updateEvent(eventId, { tags: ['风险', '夜间'] });
    await user.clear(screen.getByLabelText('描述'));
    await user.type(screen.getByLabelText('描述'), '车辆急刹并接近碰撞');

    const event = useDemoStore.getState().events.find((item) => item.id === eventId);
    expect(event).toMatchObject({
      eventType: 'custom',
      customEventType: '追尾',
      severity: 'high',
      tags: ['风险', '夜间'],
      description: '车辆急刹并接近碰撞',
    });
  });

  it('deleting an event removes it from the store and shows the empty fallback', async () => {
    const user = userEvent.setup();
    const eventId = useDemoStore.getState().createPointEvent(5_000);

    render(<Step4Review />);

    await user.click(screen.getByRole('button', { name: '删除事件' }));

    expect(useDemoStore.getState().events.find((item) => item.id === eventId)).toBeUndefined();
    expect(screen.getByRole('button', { name: '新增事件' })).toBeInTheDocument();
  });

  it('range event shows start/end time fields', async () => {
    const eventId = useDemoStore.getState().createRangeEvent(1_000, 3_000);
    useDemoStore.getState().selectEvent(eventId);

    render(<Step4Review />);

    expect(screen.getByLabelText('开始时间(ms)')).toHaveValue(1000);
    expect(screen.getByLabelText('结束时间(ms)')).toHaveValue(3000);
    expect(screen.queryByLabelText('时间(ms)')).not.toBeInTheDocument();
  });

  it('normalizes tags input and filters empty entries', async () => {
    const eventId = useDemoStore.getState().createPointEvent(5_000);

    render(<Step4Review />);

    const tagsInput = screen.getByLabelText('标签');
    fireEvent.change(tagsInput, { target: { value: ' 风险 , , 夜间 ,' } });

    const event = useDemoStore.getState().events.find((item) => item.id === eventId);
    expect(event?.tags).toEqual(['风险', '夜间']);
  });

  it('ignores non-numeric time input and clears the value', async () => {
    const user = userEvent.setup();
    const eventId = useDemoStore.getState().createPointEvent(5_000);

    render(<Step4Review />);

    const timeInput = screen.getByLabelText('时间(ms)');
    await user.clear(timeInput);
    await user.type(timeInput, 'not-a-number');

    const event = useDemoStore.getState().events.find((item) => item.id === eventId);
    expect(event?.timeMs).toBeNull();
  });
});
