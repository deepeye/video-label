import { useEffect, useState } from 'react';
import { tokens } from '../../styles/tokens';

interface UploadingToastProps {
  filename: string;
  onDone: () => void;
}

/**
 * 假上传进度条 — 2s 内 0→100%, 完成时调用 onDone()。
 * 不读文件内容、不创建 ObjectURL (spec §5.1.2)。
 */
export function UploadingToast({ filename, onDone }: UploadingToastProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const total = 2000;
    let raf = 0;
    const tick = () => {
      const dt = Date.now() - start;
      const p = Math.min(1, dt / total);
      setProgress(p);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        onDone();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <div
      data-testid="uploading-toast"
      style={{
        marginTop: tokens.space[4],
        padding: tokens.space[4],
        borderRadius: tokens.radius.md,
        background: tokens.color.neutral[0],
        border: `1px solid ${tokens.color.neutral[200]}`,
        boxShadow: tokens.shadow.sm,
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space[2],
        maxWidth: 480,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="tabular" style={{ fontSize: 13, color: tokens.color.neutral[700] }}>
          {filename}
        </span>
        <span className="tabular" style={{ fontSize: 12, color: tokens.color.neutral[500] }}>
          {Math.round(progress * 100)}%
        </span>
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
      {progress >= 1 && (
        <div style={{ fontSize: 12, color: tokens.color.success[500] }}>上传完成 ✓</div>
      )}
    </div>
  );
}

interface InfoToastProps {
  text: string;
  onClose: () => void;
}

export function InfoToast({ text, onClose }: InfoToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      data-testid="info-toast"
      style={{
        position: 'fixed',
        bottom: tokens.space[5],
        left: '50%',
        transform: 'translateX(-50%)',
        padding: `${tokens.space[3]}px ${tokens.space[4]}px`,
        borderRadius: tokens.radius.md,
        background: tokens.color.neutral[900],
        color: tokens.color.neutral[100],
        fontSize: 13,
        boxShadow: tokens.shadow.lg,
        maxWidth: 480,
        zIndex: 1000,
      }}
    >
      {text}
    </div>
  );
}
