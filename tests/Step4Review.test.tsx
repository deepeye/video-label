import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { Step4Review } from '@/steps/Step4Review';
import { useDemoStore } from '@/store/demoStore';

// Mock react-konva: jsdom 没 canvas, react-konva 在 jsdom 里渲染会出错
// 用一个 stub 让 BoxLayer / ReviewCanvas 不渲染 Konva, 但 PropertyPanel / QueueTrack / 键盘 hook 仍可测
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

// Mock ResizeObserver (jsdom 不支持)
class ROStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = ROStub;

describe('Step4Review integration', () => {
  beforeEach(() => {
    useDemoStore.getState().selectDataset('city-road');
    useDemoStore.getState().goToStep(4);
  });

  it('clicking queue card selects the track in store', async () => {
    const user = userEvent.setup();
    render(<Step4Review />);
    const card = screen.getByTestId('queue-card-trk_2');
    await user.click(card);
    expect(useDemoStore.getState().selectedTrackId).toBe('trk_2');
  });

  it('clicking accept button writes review.status=accepted to store', async () => {
    const user = userEvent.setup();
    render(<Step4Review />);
    await user.click(screen.getByTestId('queue-card-trk_2'));
    await user.click(screen.getByTestId('btn-accept'));
    const ann = useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_2')!;
    expect(ann.review.status).toBe('accepted');
    expect(useDemoStore.getState().dirty).toBe(true);
  });

  it('clicking reject button writes review.status=rejected', async () => {
    const user = userEvent.setup();
    render(<Step4Review />);
    await user.click(screen.getByTestId('queue-card-trk_5'));
    await user.click(screen.getByTestId('btn-reject'));
    const ann = useDemoStore.getState().annotations.find((a) => a.track_id === 'trk_5')!;
    expect(ann.review.status).toBe('rejected');
  });

  it('accept-all-remaining is disabled when focus items still pending', () => {
    render(<Step4Review />);
    const btn = screen.getByTestId('accept-all-remaining') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('accept-all-remaining is enabled after all focus items reviewed', async () => {
    const user = userEvent.setup();
    useDemoStore.getState().acceptBox('trk_2');
    useDemoStore.getState().correctBoxGeometry('trk_9', 0, [100, 200, 300, 400]);
    useDemoStore.getState().rejectBox('trk_5');

    render(<Step4Review />);
    const btn = screen.getByTestId('accept-all-remaining') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);

    await user.click(btn);
    const remaining = useDemoStore.getState().annotations.filter((a) => a.review.status === 'pending');
    expect(remaining.length).toBe(0);
  });

  it('full review flow: 3 focus + accept all → store reflects every change', async () => {
    const user = userEvent.setup();
    render(<Step4Review />);
    // 1. trk_2 接受
    await user.click(screen.getByTestId('queue-card-trk_2'));
    await user.click(screen.getByTestId('btn-accept'));
    // 2. trk_9 (模拟 transform — 直接调 store action)
    useDemoStore.getState().correctBoxGeometry('trk_9', 0, [100, 200, 300, 400]);
    // 3. trk_5 否决
    await user.click(screen.getByTestId('queue-card-trk_5'));
    await user.click(screen.getByTestId('btn-reject'));
    // 4. 一键剩余
    expect(useDemoStore.getState().canAdvanceFromStep4()).toBe(true);
    useDemoStore.getState().acceptAllRemaining();

    const stats = {
      accepted: 0, corrected: 0, rejected: 0, pending: 0,
    };
    useDemoStore.getState().annotations.forEach((a) => {
      stats[a.review.status]++;
    });
    expect(stats.pending).toBe(0);
    expect(stats.rejected).toBe(1);
    expect(stats.corrected).toBe(1);
    expect(stats.accepted).toBe(45);  // 47 - 1 rejected - 1 corrected
  });
});
