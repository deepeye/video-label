import { useDemoStore } from '../store/demoStore';
import { tokens } from '../styles/tokens';

/**
 * 自动模式角标 — 显示在右属性面板顶部 (Step 4)。
 * 仅 playMode === 'auto' 时显示。
 */
export function AutoModeBadge() {
  const playMode = useDemoStore((s) => s.playMode);
  const paused = useDemoStore((s) => s.paused);

  if (playMode !== 'auto') return null;

  return (
    <div
      data-testid="auto-mode-badge"
      style={{
        padding: `${tokens.space[2]}px ${tokens.space[3]}px`,
        borderRadius: tokens.radius.md,
        background: tokens.brandGradient,
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
        boxShadow: tokens.shadow.brand,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <div>🎬 演示模式{paused ? ' · 已暂停' : '自动裁决中'}</div>
      <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.85 }}>任意点击立即接管</div>
    </div>
  );
}
