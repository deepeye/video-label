import { tokens } from '../../styles/tokens';
import { ReviewCanvas } from './ReviewCanvas';
import { PropertyPanel } from './PropertyPanel';
import { QueueTrack } from './QueueTrack';
import { useReviewKeyboard } from './keyboard';

export function Step4Review() {
  useReviewKeyboard();

  return (
    <div
      data-testid="step4-review"
      style={{
        flex: 1,
        display: 'flex',
        minHeight: 0,
      }}
    >
      {/* 中央: 画布 + 队列轨道 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: tokens.space[3],
          gap: tokens.space[2],
          minWidth: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            background: tokens.color.neutral[900],
            borderRadius: tokens.radius.md,
            overflow: 'hidden',
            position: 'relative',
            boxShadow: tokens.shadow.sm,
          }}
        >
          <ReviewCanvas />
        </div>
        <QueueTrack />
      </div>
      {/* 右侧: 属性面板 24% */}
      <aside
        style={{
          width: 'min(24%, 320px)',
          minWidth: 260,
          background: tokens.color.neutral[0],
          borderLeft: `1px solid ${tokens.color.neutral[200]}`,
          padding: tokens.space[4],
        }}
      >
        <PropertyPanel />
      </aside>
    </div>
  );
}
