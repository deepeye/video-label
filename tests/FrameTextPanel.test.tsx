import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FrameTextPanel } from '@/steps/Step4Review/FrameTextPanel';
import { useDemoStore } from '@/store/demoStore';

describe('FrameTextPanel edit', () => {
  beforeEach(async () => {
    useDemoStore.getState().reset();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        video_name: 'test.mp4',
        concatenated_subtitles: '',
        all_frames: [{
          frame_index: 0,
          subtitle_text: '',
          parts: [{ part_id: 0, text: '原始OCR', box: [[0,0],[100,0],[100,50],[0,50]] }],
          objects: [],
        }],
      }),
    });
    await useDemoStore.getState().selectDataset('jiazhengnvhuang_13');
    useDemoStore.getState().goToStep(4);
  });

  it('renders the OCR text of the closest frame', () => {
    render(<FrameTextPanel />);
    expect(screen.getByText('原始OCR')).toBeInTheDocument();
  });

  it('double-click enters edit mode with a textarea prefilled', () => {
    render(<FrameTextPanel />);
    fireEvent.dblClick(screen.getByText('原始OCR'));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.value).toBe('原始OCR');
  });

  it('Cmd+Enter saves the edit to the store and shows the corrected badge', () => {
    render(<FrameTextPanel />);
    fireEvent.dblClick(screen.getByText('原始OCR'));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '修正后' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });

    expect(useDemoStore.getState().frameTextEdits).toEqual([
      { frame_index: 0, part_id: 0, text: '修正后' },
    ]);
    expect(screen.getByText('已修正')).toBeInTheDocument();
    expect(screen.getByText('修正后')).toBeInTheDocument();
  });

  it('Esc cancels the edit without writing to the store', () => {
    render(<FrameTextPanel />);
    fireEvent.dblClick(screen.getByText('原始OCR'));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '不会保存' } });
    fireEvent.keyDown(textarea, { key: 'Escape' });

    expect(useDemoStore.getState().frameTextEdits).toEqual([]);
    expect(screen.getByText('原始OCR')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('blur saves the edit', () => {
    render(<FrameTextPanel />);
    fireEvent.dblClick(screen.getByText('原始OCR'));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '失焦保存' } });
    fireEvent.blur(textarea);

    expect(useDemoStore.getState().frameTextEdits[0]?.text).toBe('失焦保存');
  });

  it('shows the corrected badge and edited text after a prior edit', () => {
    useDemoStore.getState().setFrameTextPart(0, 0, '已改');
    render(<FrameTextPanel />);
    expect(screen.getByText('已修正')).toBeInTheDocument();
    expect(screen.getByText('已改')).toBeInTheDocument();
    expect(screen.queryByText('原始OCR')).toBeNull();
  });
});
