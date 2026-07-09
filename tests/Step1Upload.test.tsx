import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Step1Upload } from '@/steps/Step1Upload';
import { useDemoStore } from '@/store/demoStore';

beforeEach(() => {
  vi.useRealTimers();
  useDemoStore.getState().selectDataset('city-road');
});

describe('Step1Upload', () => {
  it('clicking city-road sample card advances to step 2', async () => {
    const user = userEvent.setup();
    render(<Step1Upload />);
    await user.click(screen.getByTestId('sample-card-city-road'));
    expect(useDemoStore.getState().activeDatasetId).toBe('city-road');
    expect(useDemoStore.getState().demoStep).toBe(2);
  });

  it('clicking meeting-room sample card switches dataset', async () => {
    const user = userEvent.setup();
    render(<Step1Upload />);
    await user.click(screen.getByTestId('sample-card-meeting-room'));
    expect(useDemoStore.getState().activeDatasetId).toBe('meeting-room');
    expect(useDemoStore.getState().demoStep).toBe(2);
    expect(useDemoStore.getState().annotations.length).toBe(15);
  });

  it('non-video file shows error toast', async () => {
    render(<Step1Upload />);
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    const file = new File(['data'], 'not-a-video.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByTestId('info-toast').textContent).toContain('请拖入视频文件');
    });
  });

  it('video file triggers fake upload then falls back to city-road', async () => {
    render(<Step1Upload />);
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    const file = new File(['video-bytes'], 'custom.mp4', { type: 'video/mp4' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByTestId('uploading-toast')).toBeInTheDocument();

    // 等假上传完成 (2s) + fallback toast (2s)
    await waitFor(
      () => expect(useDemoStore.getState().demoStep).toBe(2),
      { timeout: 6000 },
    );
    expect(useDemoStore.getState().activeDatasetId).toBe('city-road');
  });
});
