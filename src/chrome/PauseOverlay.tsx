import { useDemoStore } from '../store/demoStore';
import { tokens } from '../styles/tokens';

/**
 * 暂停遮罩 — 简化策略:
 *   playMode === 'auto' && paused 时显示半透明遮罩, 点击恢复。
 *
 * 不冻结底层定时器 (VirtualPresenter 在 paused 时 cancel timeline, resume 时重启)。
 */
export function PauseOverlay() {
  const playMode = useDemoStore((s) => s.playMode);
  const paused = useDemoStore((s) => s.paused);
  const resume = useDemoStore((s) => s.resume);

  if (playMode !== 'auto' || !paused) return null;

  return (
    <div
      data-testid="pause-overlay"
      onClick={() => resume()}
      data-control-bar="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(24, 24, 27, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          padding: `${tokens.space[4]}px ${tokens.space[6]}px`,
          borderRadius: tokens.radius.lg,
          background: tokens.color.neutral[0],
          boxShadow: tokens.shadow.xl,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: tokens.color.neutral[900] }}>⏸ 已暂停</div>
        <div style={{ marginTop: tokens.space[1], fontSize: 13, color: tokens.color.neutral[500] }}>
          点击任意位置继续, 或点 ▶ 按钮
        </div>
      </div>
    </div>
  );
}
