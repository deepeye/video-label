import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import { useDemoStore } from '../../store/demoStore';
import { getDataset } from '../../data';
import { watchVideoFrames } from '../../lib/ext/videoFrameCallback';
import { BoxLayer } from './BoxLayer';

export function ReviewCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageNodeRef = useRef<Konva.Image>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const selectTrack = useDemoStore((s) => s.selectTrack);

  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const dataset = getDataset(datasetId);

  // 容器尺寸 (响应式)
  const [size, setSize] = useState({ width: 0, height: 0 });

  // 当前视频时间 (ms) — 触发可见框 memo 重算
  const [currentTimeMs, setCurrentTimeMs] = useState(0);

  // 监听容器 resize
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // 视频帧 → Konva.Image
  useEffect(() => {
    const video = videoRef.current;
    const node = imageNodeRef.current;
    if (!video || !node) return;

    const handle = watchVideoFrames(video, () => {
      node.image(video);
      node.getLayer()?.batchDraw();
      setCurrentTimeMs(Math.round(video.currentTime * 1000));
    });
    return () => handle.cancel();
  }, []);

  // 视频自动播放 (Demo 静音, 浏览器允许)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {
      // 自动播放被拦截 (即使 muted), 用户点击页面后可手动恢复
      // Demo 场景: 销售在客户机器上, 一定会有页面交互
    });
  }, []);

  // 计算画布缩放: video 1920×1080 → container 大小, 保持 16:9
  const scale = size.width > 0 && size.height > 0
    ? Math.min(size.width / dataset.metadata.width, size.height / dataset.metadata.height)
    : 0;
  const stageWidth = dataset.metadata.width * scale;
  const stageHeight = dataset.metadata.height * scale;

  // Stage 居中
  const offsetX = (size.width - stageWidth) / 2;
  const offsetY = (size.height - stageHeight) / 2;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* 隐藏的真实 video 元素 — Konva.Image 从它读帧 */}
      <video
        ref={videoRef}
        src={dataset.video_src}
        muted
        playsInline
        loop
        autoPlay
        crossOrigin="anonymous"
        style={{ display: 'none' }}
        data-testid="review-video"
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
          <Stage
            ref={stageRef}
            width={stageWidth}
            height={stageHeight}
            onClick={(e) => {
              if (e.target === e.target.getStage()) selectTrack(null);
            }}
            data-testid="konva-stage"
          >
            <Layer listening={false}>
              <KonvaImage
                ref={imageNodeRef}
                image={undefined}
                width={stageWidth}
                height={stageHeight}
                listening={false}
              />
            </Layer>
            <BoxLayer
              videoWidth={dataset.metadata.width}
              videoHeight={dataset.metadata.height}
              currentTimeMs={currentTimeMs}
              scale={scale}
            />
          </Stage>
        </div>
      )}
    </div>
  );
}
