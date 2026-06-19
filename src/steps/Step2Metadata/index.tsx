import { useEffect, useState } from 'react';
import { useDemoStore } from '../../store/demoStore';
import { getDataset } from '../../data';
import { tokens } from '../../styles/tokens';
import { formatDuration } from '../../lib/format/duration';
import { applySpeed } from '../../lib/animation/speed';
import { TypewriterField } from './TypewriterField';

export function Step2Metadata() {
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const speed = useDemoStore((s) => s.speed);
  const goToStep = useDemoStore((s) => s.goToStep);
  const dataset = getDataset(datasetId);
  const m = dataset.metadata;

  const fields = [
    { label: '时长', value: `${formatDuration(m.duration_ms)} (${m.frame_count} 帧)` },
    { label: '分辨率', value: `${m.width} × ${m.height}` },
    { label: '帧率', value: `${m.fps} fps (恒定)` },
    { label: '编码', value: `${m.codec.toUpperCase()} / yuv420p` },
    { label: '音轨', value: `${m.audio_tracks} 条 AAC 48kHz` },
    { label: '抽帧结果', value: `场景自适应 → ${m.sampled_frames} 关键帧` },
  ];

  const [progressPhase, setProgressPhase] = useState<'progress' | 'reveal' | 'done'>('progress');
  const [progress, setProgress] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  // 解析进度条 (600ms × speed)
  useEffect(() => {
    if (speed === 'instant') {
      setProgress(1);
      setProgressPhase('reveal');
      return;
    }
    const total = applySpeed(600, speed);
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const dt = Date.now() - start;
      const p = Math.min(1, dt / total);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setProgressPhase('reveal');
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  // 揭示完成自动推进 (用 >= 兼容 StrictMode 双跑导致的 completedCount 超出)
  useEffect(() => {
    if (completedCount >= fields.length) {
      setProgressPhase('done');
      const t = setTimeout(() => goToStep(3), applySpeed(800, speed));
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedCount, fields.length, goToStep, speed]);

  return (
    <div
      data-testid="step2-metadata"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: tokens.space[8],
        gap: tokens.space[5],
      }}
    >
      <h2 style={{ margin: 0, fontSize: 28, fontWeight: 600, color: tokens.color.neutral[900] }}>
        ② 元信息提取
      </h2>

      <div
        style={{
          width: '100%',
          maxWidth: 600,
          padding: tokens.space[5],
          borderRadius: tokens.radius.lg,
          background: tokens.color.neutral[0],
          boxShadow: tokens.shadow.sm,
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.space[2],
        }}
      >
        <div style={{ fontSize: 13, color: tokens.color.neutral[500], marginBottom: tokens.space[2] }}>
          {progressPhase === 'progress' ? '解析中... 解析容器/编码/帧率' : '解析完成 ✓'}
        </div>
        <div
          style={{
            height: 4,
            background: tokens.color.neutral[100],
            borderRadius: tokens.radius.full,
            overflow: 'hidden',
            marginBottom: tokens.space[3],
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

        {progressPhase !== 'progress' &&
          fields.map((f, idx) => (
            <TypewriterField
              key={f.label}
              label={f.label}
              value={f.value}
              startAtMs={idx * 130}
              speed={speed}
              onComplete={() => setCompletedCount((c) => c + 1)}
            />
          ))}
      </div>
    </div>
  );
}
