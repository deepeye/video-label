import { useMemo } from 'react';
import { getDataset } from '../../data';
import { useDemoStore } from '../../store/demoStore';
import { findFrameAt, visibleBoxes } from '../../lib/frameBoxes';
import type { FrameBox } from '../../types';

interface LabelStyle {
  stroke: string;
  fill: string;
  label: string;
  dash?: string;
}

const LABEL_STYLE: Record<FrameBox['label'], LabelStyle> = {
  text: { stroke: '#F97316', fill: '#F9731622', label: 'OCR', dash: '6 4' },
  person: { stroke: '#3B82F6', fill: '#3B82F622', label: 'person' },
  logo: { stroke: '#10B981', fill: '#10B98122', label: 'logo' },
};

interface Props {
  videoRef: React.RefObject<HTMLVideoElement>;
}

export function FrameBoxesOverlay({ videoRef }: Props) {
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const currentTimeMs = useDemoStore((s) => s.currentTimeMs);
  const createPointEvent = useDemoStore((s) => s.createPointEvent);
  const updateEvent = useDemoStore((s) => s.updateEvent);
  const setCurrentTimeMs = useDemoStore((s) => s.setCurrentTimeMs);

  const overlay = getDataset(datasetId).frame_boxes;
  const frame = useMemo(() => findFrameAt(overlay, currentTimeMs), [overlay, currentTimeMs]);
  const boxes = useMemo(() => (frame ? visibleBoxes(frame) : []), [frame]);

  if (!overlay || !frame) {
    return null;
  }

  const video = videoRef.current;
  if (!video) {
    return null;
  }

  const videoRect = video.getBoundingClientRect();
  const stageEl = video.parentElement;
  if (!stageEl) {
    return null;
  }
  const stageRect = stageEl.getBoundingClientRect();
  if (videoRect.width === 0 || videoRect.height === 0) {
    return null;
  }

  const [vw, vh] = overlay.video_size;
  const scaleX = videoRect.width / vw;
  const scaleY = videoRect.height / vh;
  const offsetX = videoRect.left - stageRect.left;
  const offsetY = videoRect.top - stageRect.top;

  const handleBoxClick = (box: FrameBox) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentTimeMs(currentTimeMs);
    const id = createPointEvent(currentTimeMs);
    const description =
      box.label === 'text'
        ? box.text ?? ''
        : `${box.label} (prob ${box.probability.toFixed(2)})`;
    updateEvent(id, { eventType: box.label, description });
  };

  return (
    <svg
      data-testid="frame-boxes-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <title data-testid="frame-boxes-overlay-frame">{frame.frame_index}</title>
      {boxes.map((box, i) => {
        const [x, y, w, h] = box.box;
        const sx = offsetX + x * scaleX;
        const sy = offsetY + y * scaleY;
        const sw = w * scaleX;
        const sh = h * scaleY;
        const style = LABEL_STYLE[box.label];
        const labelText =
          box.label === 'text'
            ? (box.text?.slice(0, 12) ?? 'OCR')
            : `${box.label} ${box.probability.toFixed(2)}`;
        return (
          <g
            key={i}
            data-testid={`frame-box-${box.label}-${i}`}
            onClick={handleBoxClick(box)}
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
          >
            <rect
              x={sx}
              y={sy}
              width={sw}
              height={sh}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={2}
              strokeDasharray={style.dash}
            />
            <text
              x={sx + 4}
              y={sy + 12}
              fontSize={11}
              fill={style.stroke}
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {labelText}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
