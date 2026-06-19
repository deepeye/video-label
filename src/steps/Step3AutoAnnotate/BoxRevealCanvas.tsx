import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Group, Text, Label, Tag } from 'react-konva';
import type Konva from 'konva';
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

const REVEAL_START_MS = 800;     // 推理进度开始 800ms 后开始浮现
const PER_BOX_MS = 53;           // 每个框间隔

export function BoxRevealCanvas({ speed, onComplete }: BoxRevealCanvasProps) {
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const dataset = getDataset(datasetId);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageNodeRef = useRef<Konva.Image>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [revealedCount, setRevealedCount] = useState(0);

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

  // 视频静止显示首帧 (Step 3 不播放, 只渲染当前帧标注)
  useEffect(() => {
    const video = videoRef.current;
    const node = imageNodeRef.current;
    if (!video || !node) return;
    const onLoaded = () => {
      try {
        video.currentTime = 0.5; // 显示稍后第 0.5s 的画面
      } catch {
        // jsdom 不支持
      }
      node.image(video);
      node.getLayer()?.batchDraw();
    };
    video.addEventListener('loadeddata', onLoaded);
    return () => video.removeEventListener('loadeddata', onLoaded);
  }, []);

  // 揭示动画
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations.length, speed]);

  const scale = size.width > 0
    ? Math.min(size.width / dataset.metadata.width, size.height / dataset.metadata.height)
    : 0;
  const stageWidth = dataset.metadata.width * scale;
  const stageHeight = dataset.metadata.height * scale;
  const offsetX = (size.width - stageWidth) / 2;
  const offsetY = (size.height - stageHeight) / 2;

  // 用每个 annotation 的第一个关键帧时间戳作为渲染时刻
  const referenceTimeMs = 500;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <video
        ref={videoRef}
        src={dataset.video_src}
        muted
        playsInline
        crossOrigin="anonymous"
        style={{ display: 'none' }}
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
              <KonvaImage ref={imageNodeRef} image={undefined} width={stageWidth} height={stageHeight} listening={false} />
            </Layer>
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
