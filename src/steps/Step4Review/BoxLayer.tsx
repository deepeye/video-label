import { useMemo } from 'react';
import { Layer, Group, Rect, Line, Circle, Text, Label, Tag } from 'react-konva';
import { useDemoStore } from '../../store/demoStore';
import { findVisibleAtTime, getVisibleGeometryAtTime } from '../../lib/interpolate';
import { tokens } from '../../styles/tokens';
import type { Annotation, ReviewStatus, Geometry } from '../../types';

interface BoxLayerProps {
  videoWidth: number;
  videoHeight: number;
  currentTimeMs: number;
  scale: number;
}

interface ShapeStyle {
  stroke: string;
  strokeWidth: number;
  fill: string;
  dash: number[] | undefined;
}

function getShapeStyle(ann: Annotation, isSelected: boolean): ShapeStyle {
  const status: ReviewStatus = ann.review.status;
  const isFocus = ann.needs_review && status === 'pending';

  let s: ShapeStyle;
  if (status === 'accepted') {
    s = { stroke: tokens.color.success[500], strokeWidth: 2, fill: 'rgba(16, 185, 129, 0.05)', dash: undefined };
  } else if (status === 'corrected') {
    s = { stroke: tokens.color.info[500], strokeWidth: 2, fill: 'rgba(59, 130, 246, 0.05)', dash: undefined };
  } else if (status === 'rejected') {
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

interface ShapeItem {
  annotation: Annotation;
  geometry: Geometry;
  labelText: string;
  isSelected: boolean;
}

export function BoxLayer({ videoWidth, videoHeight, currentTimeMs, scale }: BoxLayerProps) {
  void videoWidth;
  void videoHeight;
  const annotations = useDemoStore((s) => s.annotations);
  const selectedTrackId = useDemoStore((s) => s.selectedTrackId);
  const selectTrack = useDemoStore((s) => s.selectTrack);

  const items: ShapeItem[] = useMemo(() => {
    const visible = findVisibleAtTime(annotations, currentTimeMs);
    const result: ShapeItem[] = [];
    for (const a of visible) {
      const g = getVisibleGeometryAtTime(a.keyframes, currentTimeMs);
      if (!g) continue;
      const labelText = `${a.label_display}${
        a.confidence !== null ? ' ' + a.confidence.toFixed(2) : ''
      }`;
      result.push({
        annotation: a,
        geometry: g.geometry,
        labelText,
        isSelected: selectedTrackId === a.track_id,
      });
    }
    return result;
  }, [annotations, currentTimeMs, selectedTrackId]);

  return (
    <Layer>
      {items.map(({ annotation, geometry, labelText, isSelected }) => {
        const style = getShapeStyle(annotation, isSelected);
        const labelNode = (
          <Label x={0} y={-18} listening={false}>
            <Tag fill={style.stroke} cornerRadius={3} />
            <Text text={labelText} fontFamily="JetBrains Mono" fontSize={11} fill="#fff" padding={3} />
          </Label>
        );

        if (geometry.type === 'bbox') {
          const [vx, vy, vw, vh] = geometry.coords;
          const x = vx * scale;
          const y = vy * scale;
          const w = vw * scale;
          const h = vh * scale;

          return (
            <Group
              key={annotation.track_id}
              x={x}
              y={y}
              width={w}
              height={h}
              trackId={annotation.track_id}
              draggable={isSelected}
              onClick={(e) => { e.cancelBubble = true; selectTrack(annotation.track_id); }}
              onTap={(e) => { e.cancelBubble = true; selectTrack(annotation.track_id); }}
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
              {labelNode}
            </Group>
          );
        }

        // polygon
        const flatPoints = geometry.points.flatMap(([px, py]) => [px * scale, py * scale]);
        return (
          <Group
            key={annotation.track_id}
            trackId={annotation.track_id}
            onClick={(e) => { e.cancelBubble = true; selectTrack(annotation.track_id); }}
            onTap={(e) => { e.cancelBubble = true; selectTrack(annotation.track_id); }}
          >
            <Line
              points={flatPoints}
              closed
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              fill={style.fill}
              {...(style.dash ? { dash: style.dash } : {})}
              shadowColor={isSelected ? tokens.color.brand[500] : undefined}
              shadowBlur={isSelected ? 8 : 0}
              shadowOpacity={isSelected ? 0.4 : 0}
            />
            {isSelected &&
              geometry.points.map(([px, py], i) => (
                <Circle
                  key={i}
                  x={px * scale}
                  y={py * scale}
                  radius={4}
                  fill="white"
                  stroke={tokens.color.warning[500]}
                  strokeWidth={1.5}
                  listening={false}
                />
              ))}
            {labelNode}
            {/* Polygon badge */}
            <Label x={0} y={14} listening={false}>
              <Tag fill={tokens.color.info[500]} cornerRadius={3} />
              <Text text="polygon" fontFamily="JetBrains Mono" fontSize={9} fill="#fff" padding={2} />
            </Label>
          </Group>
        );
      })}
    </Layer>
  );
}
