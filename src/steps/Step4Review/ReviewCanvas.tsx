import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Transformer } from 'react-konva';
import type Konva from 'konva';
import { useDemoStore } from '../../store/demoStore';
import { getDataset } from '../../data';
import { watchVideoFrames } from '../../lib/ext/videoFrameCallback';
import { tokens } from '../../styles/tokens';
import { BoxLayer } from './BoxLayer';
import type { BBox } from '../../types';

export function ReviewCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageNodeRef = useRef<Konva.Image>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const selectTrack = useDemoStore((s) => s.selectTrack);
  const correctBoxGeometry = useDemoStore((s) => s.correctBoxGeometry);
  const selectedTrackId = useDemoStore((s) => s.selectedTrackId);
  const annotations = useDemoStore((s) => s.annotations);
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const dataset = getDataset(datasetId);

  // 容器尺寸 (响应式)
  const [size, setSize] = useState({ width: 0, height: 0 });
  // 当前视频时间 (ms)
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

  // 视频自动播放
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {
      // 自动播放被拦截, 等用户点击恢复
    });
  }, []);

  // 选中的 annotation, 用于 Transformer 计算 frameIdx
  const selectedAnnotation = useMemo(
    () => (selectedTrackId ? annotations.find((a) => a.track_id === selectedTrackId) ?? null : null),
    [selectedTrackId, annotations],
  );

  // 选中变化时, 把 Transformer 挂到对应 Group
  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if (!selectedTrackId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    // 通过自定义 attr 找到对应的 Group (BoxLayer 在 Group 上设置了 attr)
    const node = stage.findOne((n: Konva.Node) => n.getAttr('trackId') === selectedTrackId);
    if (node) {
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedTrackId, annotations, currentTimeMs]);

  // 计算画布缩放
  const scale = size.width > 0 && size.height > 0
    ? Math.min(size.width / dataset.metadata.width, size.height / dataset.metadata.height)
    : 0;
  const stageWidth = dataset.metadata.width * scale;
  const stageHeight = dataset.metadata.height * scale;
  const offsetX = (size.width - stageWidth) / 2;
  const offsetY = (size.height - stageHeight) / 2;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
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
            <Layer>
              <Transformer
                ref={transformerRef}
                rotateEnabled={false}
                resizeEnabled={true}
                enabledAnchors={[
                  'top-left', 'top-right', 'bottom-left', 'bottom-right',
                  'middle-left', 'middle-right', 'top-center', 'bottom-center',
                ]}
                anchorSize={8}
                anchorStroke={tokens.color.warning[500]}
                anchorFill="white"
                borderStroke="transparent"
                onTransformEnd={(e) => {
                  const node = e.target;
                  if (!selectedTrackId || !selectedAnnotation) return;

                  // 找到当前帧对应的 keyframe index (取最近的关键帧, 用 timestamp_ms)
                  let frameIdx = 0;
                  let minDiff = Infinity;
                  selectedAnnotation.keyframes.forEach((kf, i) => {
                    const diff = Math.abs(kf.timestamp_ms - currentTimeMs);
                    if (diff < minDiff) {
                      minDiff = diff;
                      frameIdx = i;
                    }
                  });

                  // 节点的 x/y/width/height 是 Konva 坐标 (已 scale), 还原回视频坐标
                  const newX = node.x() / scale;
                  const newY = node.y() / scale;
                  const newW = (node.width() * node.scaleX()) / scale;
                  const newH = (node.height() * node.scaleY()) / scale;

                  // 重置 scale, 防止下次再次 transform 累积
                  node.scaleX(1);
                  node.scaleY(1);
                  node.width(newW * scale);
                  node.height(newH * scale);

                  const newCoords: BBox = [
                    Math.round(newX),
                    Math.round(newY),
                    Math.round(newW),
                    Math.round(newH),
                  ];
                  correctBoxGeometry(selectedTrackId, frameIdx, newCoords);
                }}
              />
            </Layer>
          </Stage>
        </div>
      )}
    </div>
  );
}
