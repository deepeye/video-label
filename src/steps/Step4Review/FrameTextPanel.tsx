import { useMemo } from 'react';
import { getDataset } from '../../data';
import { useDemoStore } from '../../store/demoStore';
import { tokens } from '../../styles/tokens';
import type { FrameEntry } from '../../types';

function findClosestFrame(frames: FrameEntry[], targetMs: number): FrameEntry | null {
  if (frames.length === 0) return null;
  let closest = frames[0]!;
  let minDiff = Math.abs(closest.timestamp_ms - targetMs);
  for (let i = 1; i < frames.length; i++) {
    const diff = Math.abs(frames[i]!.timestamp_ms - targetMs);
    if (diff < minDiff) {
      minDiff = diff;
      closest = frames[i]!;
    }
  }
  return closest;
}

export function FrameTextPanel() {
  const currentTimeMs = useDemoStore((s) => s.currentTimeMs);
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const loadingDataset = useDemoStore((s) => s.loadingDataset);

  const dataset = loadingDataset ? null : getDataset(datasetId);
  const loadingDatasetError = useDemoStore((s) => s.loadingDatasetError);

  const frame = useMemo(() => {
    if (!dataset?.frame_boxes) return null;
    return findClosestFrame(dataset.frame_boxes.frames, currentTimeMs);
  }, [dataset, currentTimeMs]);

  if (loadingDataset) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space[2] }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: tokens.color.neutral[400] }}>
          画面文本
        </div>
        <div style={{ padding: tokens.space[3], borderRadius: tokens.radius.md, background: tokens.color.neutral[100], color: tokens.color.neutral[500], fontSize: 12 }}>
          加载中…
        </div>
      </div>
    );
  }

  if (loadingDatasetError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space[2] }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: tokens.color.neutral[400] }}>
          画面文本
        </div>
        <div style={{ padding: tokens.space[3], borderRadius: tokens.radius.md, background: tokens.color.danger[50], color: tokens.color.danger[500], fontSize: 12 }}>
          加载失败
        </div>
      </div>
    );
  }

  const parts = frame?.parts ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space[2] }}>
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: tokens.color.neutral[400],
        }}
      >
        画面文本
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
        {parts.length === 0 ? (
          <div
            style={{
              padding: tokens.space[3],
              borderRadius: tokens.radius.md,
              background: tokens.color.neutral[100],
              color: tokens.color.neutral[500],
              fontSize: 12,
            }}
          >
            当前画面无识别文本
          </div>
        ) : (
          parts.map((part) => (
            <div
              key={part.part_id}
              style={{
                padding: tokens.space[3],
                borderRadius: tokens.radius.md,
                background: tokens.color.neutral[0],
                border: `1px solid ${tokens.color.neutral[200]}`,
                fontSize: 13,
                color: tokens.color.neutral[700],
              }}
            >
              {part.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
