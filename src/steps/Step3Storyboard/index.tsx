import { useEffect, useRef } from 'react';
import { useDemoStore } from '../../store/demoStore';
import { tokens } from '../../styles/tokens';
import { StoryboardGrid } from './StoryboardGrid';
import { SegmentTimeline } from './SegmentTimeline';

const REVEAL_INTERVALS: Record<string, number> = {
  '1x': 800,
  '2x': 400,
  'instant': 0,
};

export function Step3Storyboard() {
  const segments = useDemoStore((s) => s.segments);
  const revealedCount = useDemoStore((s) => s.revealedSegmentCount);
  const speed = useDemoStore((s) => s.speed);
  const revealNext = useDemoStore((s) => s.revealNextSegment);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const allRevealed = revealedCount >= segments.length;

  useEffect(() => {
    if (allRevealed) return;

    if (speed === 'instant') {
      const remaining = segments.length - revealedCount;
      for (let i = 0; i < remaining; i++) {
        revealNext();
      }
      return;
    }

    const interval = REVEAL_INTERVALS[speed] ?? 800;
    timerRef.current = setInterval(() => {
      revealNext();
    }, interval);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [speed, allRevealed, segments.length, revealedCount, revealNext]);

  return (
    <div
      data-testid="step3-storyboard"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: `${tokens.space[3]} ${tokens.space[4]}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: tokens.color.neutral[900] }}>
          ③ 分镜拆分
        </h2>
        <span style={{ fontSize: 13, color: tokens.color.neutral[500] }}>
          {allRevealed
            ? `共 ${segments.length} 个片段`
            : `已拆分 ${revealedCount}/${segments.length}`}
        </span>
      </div>
      <StoryboardGrid segments={segments} revealedCount={revealedCount} />
      <SegmentTimeline segments={segments} revealedCount={revealedCount} />
      {allRevealed && (
        <div
          data-testid="step3-complete"
          style={{
            padding: `${tokens.space[2]} ${tokens.space[4]}`,
            fontSize: 13,
            color: tokens.color.success[500],
            background: tokens.color.success[50],
            borderTop: `1px solid ${tokens.color.neutral[200]}`,
          }}
        >
          ✓ 分镜拆分完成，请点击「下一步」进入审核
        </div>
      )}
    </div>
  );
}
