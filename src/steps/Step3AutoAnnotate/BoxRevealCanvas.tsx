import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Group, Text, Label, Tag } from 'react-konva';
import { useDemoStore } from '../../store/demoStore';
import { getDataset } from '../../data';
import { interpolateBox } from '../../lib/interpolate';
import { tokens } from '../../styles/tokens';
import { applySpeed } from '../../lib/animation/speed';
import type { Speed } from '../../types';

interface BoxRevealCanvasProps {
  speed: Speed;
  onComplete: () => void;
}

const REVEAL_START_MS = 800;
const PER_BOX_MS = 53;

export function BoxRevealCanvas({ speed, onComplete }: BoxRevealCanvasProps) {
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const dataset = getDataset(datasetId);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [revealedCount, setRevealedCount] = useState(0);
  const [videoReady, setVideoReady] = useState(false);

  const annotations = dataset.annotations;

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) setSize({ width: e.contentRect.width, height: e.contentRect.height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Step 3 只需要显示一个静止画面：loaded 后 seek 到 0.5s，并把 video 显示出来
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoaded = () => {
      const markReady = () => setVideoReady(true);
      try {
        video.currentTime = 0.5;
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          markReady();
        };
        video.addEventListener('seeked', onSeeked, { once: true });
      } catch {
        markReady();
      }
    };

    if (video.readyState >= 2) onLoaded();
    else video.addEventListener('loadeddata', onLoaded);

    return () => video.removeEventListener('loadeddata', onLoaded);
  }, []);

  useEffect(() => {
    if (speed === 'instant') {
      setRevealedCount(annotations.length);
      onComplete();
      return;
    }
    setRevealedCount(0);
    const startDelay = applySpeed(REVEAL_START_MS, speed);
    const perBox = applySpeed(PER_BOX_MS, speed);
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 0; i < annotations.length; i++) {
      const t = setTimeout(() => {
        setRevealedCount((c) => Math.max(c, i + 1));
        if (i === annotations.length - 1) onComplete();
      }, startDelay + i * perBox);
      timers.push(t);
    }
    return () => timers.forEach(clearTimeout);
  }, [annotations.length, speed, onComplete]);

  const scale = size.width > 0
    ? Math.min(size.width / dataset.metadata.width, size.height / dataset.metadata.height)
    : 0;
  const stageWidth = dataset.metadata.width * scale;
  const stageHeight = dataset.metadata.height * scale;
  const offsetX = (size.width - stageWidth) / 2;
  const offsetY = (size.height - stageHeight) / 2;

  const referenceTimeMs = 500;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <video
        ref={videoRef}
        src={dataset.video_src}
        muted
        playsInline
        crossOrigin="anonymous"
        style={{
          position: 'absolute',
          left: offsetX,
          top: offsetY,
          width: stageWidth,
          height: stageHeight,
          objectFit: 'fill',
          pointerEvents: 'none',
          display: scale > 0 && videoReady ? 'block' : 'none',
          background: '#000',
        }}
      />
      {scale > 0 && (
        <div
          style={{
            position: 'absolute',
            left: offsetX,
            top: offsetY,
            width: stageWidth,
            height: stageHeight,
          }}
        >
          <Stage width={stageWidth} height={stageHeight}>
            <Layer listening={false}>
              {annotations.slice(0, revealedCount).map((ann) => {
                const coords = interpolateBox(ann.keyframes, referenceTimeMs);
                const [vx, vy, vw, vh] = coords;
                const x = vx * scale;
                const y = vy * scale;
                const w = vw * scale;
                const h = vh * scale;
                const isFocus = ann.needs_review;
                const stroke = isFocus ? tokens.color.warning[500] : tokens.color.neutral[400];
                const labelText = `${ann.label_display}${ann.confidence !== null ? ' ' + ann.confidence.toFixed(2) : ''}`;

                return (
                  <Group key={ann.track_id} x={x} y={y} opacity={1}>
                    <Rect
                      width={w}
                      height={h}
                      stroke={stroke}
                      strokeWidth={isFocus ? 2 : 1.5}
                      cornerRadius={tokens.radius.sm}
                    />
                    <Label x={0} y={-18}>
                      <Tag fill={stroke} cornerRadius={3} />
                      <Text text={labelText} fontFamily="JetBrains Mono" fontSize={11} fill="#fff" padding={3} />
                    </Label>
                  </Group>
                );
              })}
            </Layer>
          </Stage>
        </div>
      )}
    </div>
  );
}
