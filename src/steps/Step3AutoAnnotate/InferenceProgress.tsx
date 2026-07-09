import { useEffect, useState } from 'react';
import { tokens } from '../../styles/tokens';
import { applySpeed } from '../../lib/animation/speed';
import type { Speed } from '../../types';

interface InferenceProgressProps {
  totalObjects: number;
  focusCount: number;
  speed: Speed;
}

export function InferenceProgress({ totalObjects, focusCount, speed }: InferenceProgressProps) {
  const [yoloProgress, setYolo] = useState(0);
  const [byteProgress, setByte] = useState(0);
  const [showFocus, setShowFocus] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (speed === 'instant') {
      setYolo(1);
      setByte(1);
      setShowFocus(true);
      return;
    }
    let raf1 = 0;
    const start = Date.now();
    const yoloDur = applySpeed(1000, speed);
    const byteDur = applySpeed(1800, speed);
    const byteDelay = applySpeed(200, speed);
    const focusDelay = applySpeed(2200, speed);

    const tick = () => {
      const dt = Date.now() - start;
      setYolo(Math.min(1, dt / yoloDur));
      const byteEffective = Math.max(0, dt - byteDelay);
      setByte(Math.min(1, byteEffective / byteDur));
      if (dt < Math.max(yoloDur, byteDelay + byteDur)) {
        raf1 = requestAnimationFrame(tick);
      }
    };
    raf1 = requestAnimationFrame(tick);

    const focusTimer = window.setTimeout(() => {
      setShowFocus(true);
      setShake(true);
      window.setTimeout(() => setShake(false), 300);
    }, focusDelay);

    return () => {
      cancelAnimationFrame(raf1);
      clearTimeout(focusTimer);
    };
  }, [speed]);

  return (
    <div
      data-testid="inference-progress"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space[3],
        padding: tokens.space[4],
        borderRadius: tokens.radius.md,
        background: tokens.color.neutral[0],
        border: `1px solid ${tokens.color.neutral[200]}`,
      }}
    >
      <ProgressLine
        label="目标检测 YOLOv8"
        progress={yoloProgress}
        rightText={yoloProgress >= 1 ? `${totalObjects} 对象` : '推理中...'}
      />
      <ProgressLine
        label="多目标跟踪 ByteTrack"
        progress={byteProgress}
        rightText={byteProgress >= 1 ? `track ${totalObjects}` : '关联中...'}
      />
      <div
        style={{
          fontSize: 13,
          color: showFocus ? tokens.color.warning[500] : tokens.color.neutral[400],
          opacity: showFocus ? 1 : 0.6,
          transition: 'all 200ms var(--ease-out)',
          animation: shake ? 'inference-shake 300ms ease-in-out' : 'none',
        }}
      >
        ⚠ 低置信对象: {showFocus ? `${focusCount} 个 已标记『需重点审核』` : '...'}
      </div>
      <style>{`
        @keyframes inference-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
}

function ProgressLine({ label, progress, rightText }: { label: string; progress: number; rightText: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: tokens.color.neutral[700] }}>├ {label}</span>
        <span className="tabular" style={{ color: tokens.color.neutral[500] }}>{rightText}</span>
      </div>
      <div
        style={{
          height: 4,
          background: tokens.color.neutral[100],
          borderRadius: tokens.radius.full,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress * 100}%`,
            background: tokens.brandGradient,
            transition: 'width 50ms linear',
          }}
        />
      </div>
    </div>
  );
}
