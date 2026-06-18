import { useMemo } from 'react';
import { Layer, Group, Rect, Text, Label, Tag } from 'react-konva';
import { useDemoStore } from '../../store/demoStore';
import { findVisibleAtTime, interpolateBox } from '../../lib/interpolate';
import { tokens } from '../../styles/tokens';
import type { Annotation, ReviewStatus, BBox } from '../../types';

interface BoxLayerProps {
  videoWidth: number;
  videoHeight: number;
  currentTimeMs: number;
  scale: number;
}

interface BoxStyle {
  stroke: string;
  strokeWidth: number;
  fill: string;
  dash: number[] | undefined;
}

function getBoxStyle(ann: Annotation, isSelected: boolean): BoxStyle {
  const status: ReviewStatus = ann.review.status;
  const isFocus = ann.needs_review && status === 'pending';

  let s: BoxStyle;
  if (status === 'accepted') {
    s = { stroke: tokens.color.success[500], strokeWidth: 2, fill: 'rgba(16, 185, 129, 0.05)', dash: undefined };
  } else if (status === 'corrected') {
    s = { stroke: tokens.color.info[500], strokeWidth: 2, fill: 'rgba(59, 130, 246, 0.05)', dash: undefined };
  } else if (status === 'rejected') {
    // 不应渲染 (findVisibleAtTime 已过滤), 兜底
    s = { stroke: tokens.color.rejectedStroke, strokeWidth: 1.5, fill: 'transparent', dash: [4, 4] };
  } else if (isFocus) {
    s = { stroke: tokens.color.warning[500], strokeWidth: 2, fill: 'transparent', dash: undefined };
  } else {
    s = { stroke: tokens.color.neutral[400], strokeWidth: 1.5, fill: 'transparent', dash: undefined };
  }

  if (isSelected) {
    s = { ...s, strokeWidth: s.strokeWidth + 1 };
  }
  return s;
}

interface BoxItem {
  annotation: Annotation;
  // 视频坐标系下的 bbox
  videoCoords: BBox;
}

export function BoxLayer({ videoWidth, videoHeight, currentTimeMs, scale }: BoxLayerProps) {
  void videoWidth;
  void videoHeight; // currently unused; kept for future viewport math
  const annotations = useDemoStore((s) => s.annotations);
  const selectedTrackId = useDemoStore((s) => s.selectedTrackId);
  const selectTrack = useDemoStore((s) => s.selectTrack);

  const items: BoxItem[] = useMemo(() => {
    const visible = findVisibleAtTime(annotations, currentTimeMs);
    return visible.map((a) => ({
      annotation: a,
      videoCoords: interpolateBox(a.keyframes, currentTimeMs),
    }));
  }, [annotations, currentTimeMs]);

  return (
    <Layer>
      {items.map(({ annotation, videoCoords }) => {
        const [vx, vy, vw, vh] = videoCoords;
        const x = vx * scale;
        const y = vy * scale;
        const w = vw * scale;
        const h = vh * scale;
        const isSelected = selectedTrackId === annotation.track_id;
        const style = getBoxStyle(annotation, isSelected);
        const labelText = `${annotation.label_display}${
          annotation.confidence !== null ? ' ' + annotation.confidence.toFixed(2) : ''
        }`;

        return (
          <Group
            key={annotation.track_id}
            x={x}
            y={y}
            width={w}
            height={h}
            trackId={annotation.track_id}
            draggable={isSelected}
            onClick={(e) => {
              e.cancelBubble = true;
              selectTrack(annotation.track_id);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              selectTrack(annotation.track_id);
            }}
          >
            <Rect
              width={w}
              height={h}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              fill={style.fill}
              {...(style.dash ? { dash: style.dash } : {})}
              cornerRadius={tokens.radius.sm}
              listening
              shadowColor={isSelected ? tokens.color.brand[500] : undefined}
              shadowBlur={isSelected ? 8 : 0}
              shadowOpacity={isSelected ? 0.4 : 0}
            />
            {/* Label 在框左上外侧 */}
            <Label x={0} y={-18} listening={false}>
              <Tag fill={style.stroke} cornerRadius={3} />
              <Text
                text={labelText}
                fontFamily="JetBrains Mono"
                fontSize={11}
                fill="#fff"
                padding={3}
              />
            </Label>
          </Group>
        );
      })}
    </Layer>
  );
}
