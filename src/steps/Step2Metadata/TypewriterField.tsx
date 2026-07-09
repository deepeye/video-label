import { useEffect, useRef, useState } from 'react';
import { tokens } from '../../styles/tokens';
import { applySpeed } from '../../lib/animation/speed';
import type { Speed } from '../../types';

interface TypewriterFieldProps {
  label: string;
  value: string;
  startAtMs: number;     // 在父 Timeline 中的开始时间
  speed: Speed;
  onComplete?: () => void;
}

export function TypewriterField({ label, value, startAtMs, speed, onComplete }: TypewriterFieldProps) {
  const [shownChars, setShownChars] = useState(0);
  const [framePhase, setFramePhase] = useState<'hidden' | 'frame' | 'typing' | 'done'>('hidden');
  const completedRef = useRef(false);

  useEffect(() => {
    setShownChars(0);
    setFramePhase('hidden');
    completedRef.current = false;

    const finish = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      setFramePhase('done');
      // 避免在 render / state updater 链路里同步更新父组件
      queueMicrotask(() => onComplete?.());
    };

    if (speed === 'instant') {
      setShownChars(value.length);
      finish();
      return;
    }

    let f1 = 0;
    let typing: ReturnType<typeof setInterval> | null = null;
    let f2 = 0;

    f1 = window.setTimeout(() => {
      setFramePhase('frame');
      f2 = window.setTimeout(() => {
        setFramePhase('typing');
        const charDelay = applySpeed(8, speed);
        typing = setInterval(() => {
          setShownChars((c) => {
            if (c + 1 >= value.length) {
              if (typing) clearInterval(typing);
              finish();
              return value.length;
            }
            return c + 1;
          });
        }, Math.max(1, charDelay));
      }, applySpeed(150, speed));
    }, applySpeed(startAtMs, speed));

    return () => {
      window.clearTimeout(f1);
      window.clearTimeout(f2);
      if (typing) clearInterval(typing);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, value, startAtMs, speed]);

  return (
    <div
      data-testid={`typewriter-field-${label}`}
      style={{
        display: 'flex',
        gap: tokens.space[4],
        padding: `${tokens.space[2]}px ${tokens.space[3]}px`,
        borderRadius: tokens.radius.sm,
        background: framePhase === 'hidden' ? 'transparent' : tokens.color.brand[400] + '15',
        opacity: framePhase === 'hidden' ? 0 : 1,
        transition: 'opacity 150ms var(--ease-out), background-color 150ms var(--ease-out)',
      }}
    >
      <span
        style={{
          width: 100,
          flexShrink: 0,
          color: tokens.color.neutral[500],
          fontSize: 13,
        }}
      >
        {label}
      </span>
      <span
        className="tabular"
        style={{
          color: tokens.color.neutral[900],
          fontSize: 13,
        }}
      >
        {value.slice(0, shownChars)}
        {framePhase === 'typing' && <span style={{ color: tokens.color.brand[500] }}>▍</span>}
      </span>
    </div>
  );
}
