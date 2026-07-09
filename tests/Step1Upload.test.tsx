import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Step1Upload } from '@/steps/Step1Upload';
import { useDemoStore } from '@/store/demoStore';

beforeEach(async () => {
  vi.useRealTimers();
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      video_name: 'test.mp4',
      concatenated_subtitles: '',
      all_frames: [{ frame_index: 0, subtitle_text: '', parts: [], objects: [] }],
    }),
  });
  await useDemoStore.getState().selectDataset('jiazhengnvhuang_13');
});

describe('Step1Upload', () => {
  it('clicking jiazhengnvhuang_13 sample card advances to step 2', async () => {
    const user = userEvent.setup();
    render(<Step1Upload />);
    await user.click(screen.getByTestId('sample-card-jiazhengnvhuang_13'));
    expect(useDemoStore.getState().activeDatasetId).toBe('jiazhengnvhuang_13');
    expect(useDemoStore.getState().demoStep).toBe(2);
  });

  it('clicking jiazhengnvhuang_5 sample card switches dataset', async () => {
    const user = userEvent.setup();
    render(<Step1Upload />);
    await user.click(screen.getByTestId('sample-card-jiazhengnvhuang_5'));
    expect(useDemoStore.getState().activeDatasetId).toBe('jiazhengnvhuang_5');
    expect(useDemoStore.getState().demoStep).toBe(2);
    expect(useDemoStore.getState().annotations.length).toBe(0);
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

  it('video file triggers fake upload then falls back to jiazhengnvhuang_13', async () => {
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
    expect(useDemoStore.getState().activeDatasetId).toBe('jiazhengnvhuang_13');
  });
});
