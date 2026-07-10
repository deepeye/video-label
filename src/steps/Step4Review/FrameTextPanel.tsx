import { useMemo, useState } from 'react';
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
  const frameTextEdits = useDemoStore((s) => s.frameTextEdits);
  const setFrameTextPart = useDemoStore((s) => s.setFrameTextPart);

  const dataset = loadingDataset ? null : getDataset(datasetId);
  const loadingDatasetError = useDemoStore((s) => s.loadingDatasetError);

  const frame = useMemo(() => {
    if (!dataset?.frame_boxes) return null;
    return findClosestFrame(dataset.frame_boxes.frames, currentTimeMs);
  }, [dataset, currentTimeMs]);

  const [editingPartId, setEditingPartId] = useState<number | null>(null);
  const [editingFrameIndex, setEditingFrameIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  if (loadingDataset) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space[2], flex: 1, minHeight: 0 }}>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space[2], flex: 1, minHeight: 0 }}>
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
  const frameIndex = frame?.frame_index ?? 0;

  const resolvedText = (partId: number, original: string): string => {
    const edit = frameTextEdits.find(
      (e) => e.frame_index === frameIndex && e.part_id === partId,
    );
    return edit ? edit.text : original;
  };

  const startEdit = (partId: number, current: string) => {
    setEditingPartId(partId);
    setEditingFrameIndex(frameIndex);
    setDraft(current);
  };

  const commitEdit = (partId: number) => {
    // Commit to the frame the edit was started on, even if playback has since moved.
    if (editingFrameIndex !== null) {
      setFrameTextPart(editingFrameIndex, partId, draft);
    }
    setEditingPartId(null);
    setEditingFrameIndex(null);
  };

  const cancelEdit = () => {
    setEditingPartId(null);
    setEditingFrameIndex(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space[2], flex: 1, minHeight: 0 }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: tokens.color.neutral[400] }}>
        画面文本
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {parts.length === 0 ? (
          <div style={{ padding: tokens.space[3], borderRadius: tokens.radius.md, background: tokens.color.neutral[100], color: tokens.color.neutral[500], fontSize: 12 }}>
            当前画面无识别文本
          </div>
        ) : (
          parts.map((part) => {
            const text = resolvedText(part.part_id, part.text);
            const edited = text !== part.text;
            const isEditing = editingPartId === part.part_id;
            return (
              <div
                key={part.part_id}
                onDoubleClick={() => !isEditing && startEdit(part.part_id, text)}
                style={{
                  position: 'relative',
                  padding: tokens.space[3],
                  borderRadius: tokens.radius.md,
                  background: tokens.color.neutral[0],
                  border: `1px solid ${edited ? tokens.color.brand[400] : tokens.color.neutral[200]}`,
                  borderLeft: edited ? `2px solid ${tokens.color.brand[500]}` : undefined,
                  fontSize: 13,
                  color: tokens.color.neutral[700],
                  cursor: isEditing ? 'text' : 'pointer',
                }}
              >
                {edited && (
                  <span style={{ position: 'absolute', top: 4, right: 8, fontSize: 10, color: tokens.color.brand[500] }}>
                    已修正
                  </span>
                )}
                {isEditing ? (
                  <textarea
                    autoFocus
                    value={draft}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => commitEdit(part.part_id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        commitEdit(part.part_id);
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelEdit();
                      }
                    }}
                    style={{ width: '100%', minHeight: 32, resize: 'vertical', border: `1px solid ${tokens.color.brand[400]}`, borderRadius: tokens.radius.sm, padding: 6, fontSize: 13, fontFamily: 'inherit' }}
                  />
                ) : (
                  text
                )}
              </div>
            );
          })
        )}
      </div>
      <div style={{ fontSize: 11, color: tokens.color.neutral[400] }}>
        双击文本编辑 · ⌘↵ 保存 · Esc 取消
      </div>
    </div>
  );
}
