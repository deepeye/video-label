import type { CSSProperties, ReactNode } from 'react';
import { useDemoStore } from '../store/demoStore';
import { tokens } from '../styles/tokens';
import { Play, Pause, SkipForward, RotateCcw } from 'lucide-react';
import type { Speed } from '../types';

const SPEEDS: { id: Speed; label: string }[] = [
  { id: '1x', label: '1×' },
  { id: '2x', label: '2×' },
  { id: 'instant', label: '即时' },
];

export function DemoControls() {
  const playMode = useDemoStore((s) => s.playMode);
  const paused = useDemoStore((s) => s.paused);
  const speed = useDemoStore((s) => s.speed);
  const demoStep = useDemoStore((s) => s.demoStep);
  const dirty = useDemoStore((s) => s.dirty);
  const togglePlayMode = useDemoStore((s) => s.togglePlayMode);
  const pause = useDemoStore((s) => s.pause);
  const resume = useDemoStore((s) => s.resume);
  const setSpeed = useDemoStore((s) => s.setSpeed);
  const reset = useDemoStore((s) => s.reset);
  const goToStep = useDemoStore((s) => s.goToStep);
  const canAdvance = useDemoStore((s) => s.canAdvanceFromStep4);

  const isAutoActive = playMode === 'auto' && !paused;

  // ▶/⏸ 切换
  const handlePlayPause = () => {
    if (playMode === 'manual') {
      togglePlayMode(); // → auto
      return;
    }
    if (paused) resume();
    else pause();
  };

  // ⏭ 下一步
  const nextDisabled = (() => {
    if (demoStep === 5) return true;
    if (demoStep === 4 && !canAdvance()) return true;
    return false;
  })();

  const handleNext = () => {
    if (nextDisabled) return;
    if (demoStep < 5) {
      goToStep((demoStep + 1) as 1 | 2 | 3 | 4 | 5);
    }
  };

  const handleReset = () => {
    if (dirty) {
      const ok = window.confirm('重置将清空当前演示进度？');
      if (!ok) return;
    }
    reset();
  };

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: tokens.space[2] }}
      data-testid="demo-controls"
      data-control-bar="true"
    >
      <CtrlBtn
        testid="btn-play-pause"
        onClick={handlePlayPause}
        active={isAutoActive}
        title={playMode === 'manual' ? '自动演示' : paused ? '继续' : '暂停'}
      >
        {playMode === 'manual' || paused ? <Play size={16} /> : <Pause size={16} />}
      </CtrlBtn>
      <CtrlBtn testid="btn-next" onClick={handleNext} disabled={nextDisabled} title="下一步">
        <SkipForward size={16} />
      </CtrlBtn>
      <CtrlBtn testid="btn-reset" onClick={handleReset} title="重置">
        <RotateCcw size={16} />
      </CtrlBtn>
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
  disabled = false,
  active = false,
  title,
  children,
}: {
  testid: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  title: string;
  children: ReactNode;
}) {
  const style: CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.md,
    border: `1px solid ${active ? tokens.color.brand[500] : tokens.color.neutral[200]}`,
    background: active ? tokens.color.brand[400] + '20' : tokens.color.neutral[0],
    color: disabled ? tokens.color.neutral[400] : active ? tokens.color.brand[600] : tokens.color.neutral[700],
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
  return (
    <button data-testid={testid} onClick={onClick} disabled={disabled} title={title} aria-label={title} style={style}>
      {children}
    </button>
  );
}
