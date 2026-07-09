import type { ShotSegment } from '../../types';
import { tokens } from '../../styles/tokens';
import { StoryboardCard } from './StoryboardCard';

interface StoryboardGridProps {
  segments: ShotSegment[];
  revealedCount: number;
}

export function StoryboardGrid({ segments, revealedCount }: StoryboardGridProps) {
  const revealed = segments.slice(0, revealedCount);

  return (
    <div
      data-testid="storyboard-grid"
      style={{
        flex: 1,
        overflowX: 'auto',
        overflowY: 'hidden',
        padding: tokens.space[4],
        display: 'flex',
        gap: tokens.space[3],
        alignItems: 'flex-start',
      }}
    >
      {revealed.length === 0 && (
        <div
          data-testid="storyboard-empty"
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: tokens.color.neutral[400],
            fontSize: 14,
          }}
        >
          AI 正在拆分视频分镜...
        </div>
      )}
      {revealed.map((seg, idx) => (
        <StoryboardCard
          key={seg.id}
          segment={seg}
          isNew={idx === revealed.length - 1 && revealed.length < segments.length}
        />
      ))}
    </div>
  );
}
