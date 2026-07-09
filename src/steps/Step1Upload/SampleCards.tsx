import { useEffect, useRef, useState } from 'react';
import { useDemoStore } from '../../store/demoStore';
import { tokens } from '../../styles/tokens';
import type { DatasetId } from '../../types';
import { REAL_DATASETS } from '../../data/realDatasets';

export function SampleCards() {
  const activeId = useDemoStore((s) => s.activeDatasetId);
  const loadingDataset = useDemoStore((s) => s.loadingDataset);
  const selectDataset = useDemoStore((s) => s.selectDataset);
  const goToStep = useDemoStore((s) => s.goToStep);

  const handleSelect = async (id: DatasetId) => {
    await selectDataset(id);
    goToStep(2);
  };

  return (
    <div data-testid="sample-cards" style={{ display: 'flex', gap: tokens.space[4], flexWrap: 'wrap' }}>
      {REAL_DATASETS.map((ds) => {
        const active = activeId === ds.id;
        return (
          <button
            key={ds.id}
            data-testid={`sample-card-${ds.id}`}
            onClick={() => handleSelect(ds.id)}
            disabled={loadingDataset}
            style={{
              width: 200,
              padding: 0,
              border: `2px solid ${active ? tokens.color.brand[500] : tokens.color.neutral[200]}`,
              borderRadius: tokens.radius.lg,
              overflow: 'hidden',
              background: tokens.color.neutral[0],
              cursor: loadingDataset ? 'wait' : 'pointer',
              boxShadow: active ? tokens.shadow.brand : tokens.shadow.sm,
              textAlign: 'left',
              opacity: loadingDataset ? 0.6 : 1,
            }}
          >
            <VideoThumb src={ds.videoSrc} />
            <div style={{ padding: tokens.space[3] }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: tokens.color.neutral[900] }}>
                {ds.display}
              </div>
              <div
                style={{
                  marginTop: tokens.space[2],
                  padding: '6px 10px',
                  borderRadius: tokens.radius.md,
                  background: active ? tokens.brandGradient : tokens.color.neutral[100],
                  color: active ? '#fff' : tokens.color.neutral[700],
                  fontSize: 12,
                  fontWeight: 500,
                  textAlign: 'center',
                }}
              >
                {loadingDataset ? '加载中…' : active ? '✓ 当前' : '使用 →'}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function VideoThumb({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    const video = document.createElement('video');
    videoRef.current = video;
    video.preload = 'metadata';
    video.muted = true;
    video.crossOrigin = 'anonymous';
    video.src = src;

    const onLoaded = () => {
      video.currentTime = 2;
    };

    const onSeeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 180;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setThumb(canvas.toDataURL('image/jpeg', 0.7));
      }
      video.remove();
    };

    video.addEventListener('loadedmetadata', onLoaded, { once: true });
    video.addEventListener('seeked', onSeeked, { once: true });

    return () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('seeked', onSeeked);
      video.remove();
    };
  }, [src]);

  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '16/9',
        background: tokens.color.neutral[100],
        backgroundImage: thumb ? `url(${thumb})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
