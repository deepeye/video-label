import type { CSSProperties, ReactNode } from 'react';
import { useDemoStore } from '../store/demoStore';
import { tokens } from '../styles/tokens';
import type { Speed } from '../types';

const SPEEDS: { id: Speed; label: string }[] = [
  { id: '1x', label: '1×' },
  { id: '2x', label: '2×' },
  { id: 'instant', label: '即时' },
];

export function DemoControls() {
  const speed = useDemoStore((s) => s.speed);
  const setSpeed = useDemoStore((s) => s.setSpeed);
  const reset = useDemoStore((s) => s.reset);
  const dirty = useDemoStore((s) => s.dirty);

  const handleReset = () => {
    if (dirty) {
      const ok = window.confirm('重置将清空当前演示进度？');
      if (!ok) return;
    }
    reset();
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space[2] }} data-testid="demo-controls">
      {/* ▶ ⏸ ⏭ 占位 — Day 6 接入 */}
      <CtrlBtn testid="btn-auto" disabled>▶</CtrlBtn>
      <CtrlBtn testid="btn-pause" disabled>⏸</CtrlBtn>
      <CtrlBtn testid="btn-next" disabled>⏭</CtrlBtn>
      <CtrlBtn testid="btn-reset" onClick={handleReset}>↺</CtrlBtn>
      <select
        data-testid="speed-select"
        value={speed}
        onChange={(e) => setSpeed(e.target.value as Speed)}
        style={{
          padding: '6px 10px',
          borderRadius: tokens.radius.md,
          border: `1px solid ${tokens.color.neutral[200]}`,
          background: tokens.color.neutral[0],
          color: tokens.color.neutral[700],
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        {SPEEDS.map((s) => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
    </div>
  );
}

function CtrlBtn({
  testid,
  onClick,
  disabled,
  children,
}: {
  testid: string;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const style: CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.md,
    border: `1px solid ${tokens.color.neutral[200]}`,
    background: tokens.color.neutral[0],
    color: disabled ? tokens.color.neutral[400] : tokens.color.neutral[700],
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    fontSize: 14,
  };
  return (
    <button data-testid={testid} onClick={onClick} disabled={disabled} style={style}>
      {children}
    </button>
  );
}
