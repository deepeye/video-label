import { useMemo } from 'react';
import type { ShotSegment } from '../../types';
import { tokens } from '../../styles/tokens';

const CONTENT_TYPE_COLORS: Record<string, string> = {
  '美食': '#6366F1',
  '广告': '#F97316',
  '纪录片': '#10B981',
  '访谈': '#3B82F6',
  '医疗': '#EF4444',
};

interface SegmentTimelineProps {
  segments: ShotSegment[];
  revealedCount: number;
}

export function SegmentTimeline({ segments, revealedCount }: SegmentTimelineProps) {
  const totalDuration = useMemo(
    () => segments.reduce((sum, seg) => sum + (seg.end_ms - seg.start_ms), 0),
    [segments],
  );

  if (totalDuration === 0) return null;

  return (
    <div
      data-testid="segment-timeline"
      style={{
        height: 80,
        display: 'flex',
        alignItems: 'center',
        padding: `0 ${tokens.space[4]}px`,
        background: tokens.color.neutral[0],
        borderTop: `1px solid ${tokens.color.neutral[200]}`,
      }}
    >
      <div
        style={{
          width: '100%',
          height: 32,
          display: 'flex',
          borderRadius: tokens.radius.sm,
          overflow: 'hidden',
          background: tokens.color.neutral[100],
        }}
      >
        {segments.map((seg, idx) => {
          const duration = seg.end_ms - seg.start_ms;
          const widthPct = (duration / totalDuration) * 100;
          const isRevealed = idx < revealedCount;
          return (
            <div
              key={seg.id}
              data-testid={`timeline-seg-${seg.id}`}
              style={{
                width: `${widthPct}%`,
                height: '100%',
                background: isRevealed
                  ? CONTENT_TYPE_COLORS[seg.content_type] ?? tokens.color.neutral[400]
                  : tokens.color.neutral[200],
                transition: `background ${tokens.duration.slow}ms ${tokens.ease.out}`,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 0,
              }}
              title={isRevealed ? `${seg.title} (${formatTime(seg.start_ms)} -> ${formatTime(seg.end_ms)})` : ''}
            >
              {isRevealed && widthPct > 10 && (
                <span
                  style={{
                    fontSize: 10,
                    color: '#fff',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    padding: '0 4px',
                  }}
                >
                  {seg.content_type}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
