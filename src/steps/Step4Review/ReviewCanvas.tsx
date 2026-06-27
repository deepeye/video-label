import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Transformer, Line, Circle } from 'react-konva';
import type Konva from 'konva';
import { useDemoStore } from '../../store/demoStore';
import { getDataset } from '../../data';
import { watchVideoFrames } from '../../lib/ext/videoFrameCallback';
import { findKeyframeAtTime } from '../../lib/interpolate';
import { tokens } from '../../styles/tokens';
import { BoxLayer } from './BoxLayer';
import type { BBox, Geometry, Point } from '../../types';

export function ReviewCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const selectTrack = useDemoStore((s) => s.selectTrack);
  const selectedTrackId = useDemoStore((s) => s.selectedTrackId);
  const annotations = useDemoStore((s) => s.annotations);
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const annotationTool = useDemoStore((s) => s.annotationTool);
  const draftPolygon = useDemoStore((s) => s.draftPolygon);
  const currentTimeMs = useDemoStore((s) => s.currentTimeMs);
  const setCurrentTimeMs = useDemoStore((s) => s.setCurrentTimeMs);
  const addPolygonPoint = useDemoStore((s) => s.addPolygonPoint);
  const commitPolygonDraft = useDemoStore((s) => s.commitPolygonDraft);
  const upsertKeyframeGeometry = useDemoStore((s) => s.upsertKeyframeGeometry);
  const correctBoxGeometry = useDemoStore((s) => s.correctBoxGeometry);

  const dataset = getDataset(datasetId);

  const [size, setSize] = useState({ width: 0, height: 0 });

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

  // 视频帧时间同步（同时写入 store，让面板能读到 currentTimeMs）
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let handle: ReturnType<typeof watchVideoFrames> | null = null;
    const onLoaded = () => {
      handle = watchVideoFrames(video, () => {
        const ms = Math.round(video.currentTime * 1000);
        setCurrentTimeMs(ms);
      });
    };

    if (video.readyState >= 2) onLoaded();
    else video.addEventListener('loadeddata', onLoaded);

    return () => {
      video.removeEventListener('loadeddata', onLoaded);
      handle?.cancel();
    };
  }, [setCurrentTimeMs]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {});
      }
    } catch {}
  }, []);

  const selectedAnnotation = useMemo(
    () => (selectedTrackId ? annotations.find((a) => a.track_id === selectedTrackId) ?? null : null),
    [selectedTrackId, annotations],
  );

  // 给 Transformer 绑定选中的 bbox node
  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if (!selectedTrackId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const node = stage.findOne((n: Konva.Node) => n.getAttr('trackId') === selectedTrackId);
    if (node && node.getClassName() === 'Group') {
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedTrackId, annotations, currentTimeMs]);

  const scale = size.width > 0 && size.height > 0
    ? Math.min(size.width / dataset.metadata.width, size.height / dataset.metadata.height)
    : 0;
  const stageWidth = dataset.metadata.width * scale;
  const stageHeight = dataset.metadata.height * scale;
  const offsetX = (size.width - stageWidth) / 2;
  const offsetY = (size.height - stageHeight) / 2;

  const currentFrameNo = useMemo(() => {
    if (!dataset.metadata.fps) return 0;
    return Math.round((currentTimeMs / 1000) * dataset.metadata.fps);
  }, [currentTimeMs, dataset.metadata.fps]);

  // Stage 单击处理：polygon 模式下加点
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (annotationTool !== 'polygon') return;
      if (!selectedTrackId) return;

      const stage = e.target.getStage();
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;

      const videoX = pos.x / scale;
      const videoY = pos.y / scale;

      // 检查是否点到了第一个点附近（闭合）
      if (draftPolygon.length >= 3) {
        const [fx, fy] = draftPolygon[0]!;
        const dist = Math.sqrt((videoX - fx) ** 2 + (videoY - fy) ** 2);
        if (dist < 12) {
          commitPolygonDraft(selectedTrackId, currentFrameNo, currentTimeMs);
          return;
        }
      }

      addPolygonPoint([Math.round(videoX), Math.round(videoY)]);
    },
    [annotationTool, selectedTrackId, draftPolygon, scale, currentFrameNo, currentTimeMs, addPolygonPoint, commitPolygonDraft],
  );

  // bbox transform end
  const handleTransformEnd = useCallback(
    (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target;
      if (!selectedTrackId || !selectedAnnotation || scale === 0) return;

      const newX = node.x() / scale;
      const newY = node.y() / scale;
      const newW = (node.width() * node.scaleX()) / scale;
      const newH = (node.height() * node.scaleY()) / scale;

      node.scaleX(1);
      node.scaleY(1);
      node.width(newW * scale);
      node.height(newH * scale);

      const newCoords: BBox = [Math.round(newX), Math.round(newY), Math.round(newW), Math.round(newH)];

      // 编辑当前帧对应的 keyframe；若不存在则创建 bbox
      const kf = findKeyframeAtTime(selectedAnnotation.keyframes, currentTimeMs);
      if (kf && kf.geometry.type === 'bbox') {
        const frameIdx = selectedAnnotation.keyframes.indexOf(kf);
        correctBoxGeometry(selectedTrackId, frameIdx, newCoords);
      } else {
        // 无此帧 bbox keyframe → 创建
        upsertKeyframeGeometry(selectedTrackId, currentFrameNo, currentTimeMs, {
          type: 'bbox',
          coords: newCoords,
        });
      }
    },
    [selectedTrackId, selectedAnnotation, scale, currentTimeMs, currentFrameNo, correctBoxGeometry, upsertKeyframeGeometry],
  );

  // 多边形顶点拖拽结束
  const handlePolygonVertexDragEnd = useCallback(
    (index: number, node: Konva.Node) => {
      if (!selectedTrackId || !selectedAnnotation || scale === 0) return;
      const newX = Math.round(node.x() / scale);
      const newY = Math.round(node.y() / scale);
      node.x(newX * scale);
      node.y(newY * scale);

      // 更新这个顶点并回写
      const kf = findKeyframeAtTime(selectedAnnotation.keyframes, currentTimeMs);
      if (!kf || kf.geometry.type !== 'polygon') return;
      const newPoints: Point[] = kf.geometry.points.map((p, i) =>
        i === index ? [newX, newY] as Point : [...p] as Point,
      );
      const newGeometry: Geometry = { type: 'polygon', points: newPoints };
      upsertKeyframeGeometry(selectedTrackId, kf.frame_no, kf.timestamp_ms, newGeometry);
    },
    [selectedTrackId, selectedAnnotation, scale, currentTimeMs, upsertKeyframeGeometry],
  );

  // 已提交的 polygon 在当前帧的几何
  const committedPoly = useMemo(() => {
    if (!selectedAnnotation) return null;
    const kf = findKeyframeAtTime(selectedAnnotation.keyframes, currentTimeMs);
    if (!kf || kf.geometry.type !== 'polygon') return null;
    return kf.geometry;
  }, [selectedAnnotation, currentTimeMs]);

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
        style={{
          position: 'absolute',
          left: offsetX,
          top: offsetY,
          width: stageWidth,
          height: stageHeight,
          objectFit: 'fill',
          pointerEvents: 'none',
          display: scale > 0 ? 'block' : 'none',
          background: '#000',
        }}
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
              if (annotationTool === 'polygon') {
                handleStageClick(e);
                return;
              }
              if (e.target === e.target.getStage()) selectTrack(null);
            }}
            onTap={(e: any) => {
              if (annotationTool === 'polygon') {
                handleStageClick(e);
                return;
              }
              if (e.target === e.target.getStage()) selectTrack(null);
            }}
            data-testid="konva-stage"
          >
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
                resizeEnabled={annotationTool !== 'polygon'}
                enabledAnchors={[
                  'top-left', 'top-right', 'bottom-left', 'bottom-right',
                  'middle-left', 'middle-right', 'top-center', 'bottom-center',
                ]}
                anchorSize={8}
                anchorStroke={tokens.color.warning[500]}
                anchorFill="white"
                borderStroke="transparent"
                onTransformEnd={handleTransformEnd as any}
              />
            </Layer>
            {/* Draft polygon layer */}
            {annotationTool === 'polygon' && draftPolygon.length > 0 && (
              <Layer>
                <Line
                  points={draftPolygon.flatMap(([px, py]) => [px * scale, py * scale])}
                  stroke={tokens.color.info[500]}
                  strokeWidth={2}
                  dash={[6, 3]}
                />
                {draftPolygon.map(([px, py], i) => (
                  <Circle
                    key={i}
                    x={px * scale}
                    y={py * scale}
                    radius={i === 0 ? 5 : 3}
                    fill={i === 0 ? tokens.color.info[500] : 'white'}
                    stroke={tokens.color.info[500]}
                    strokeWidth={2}
                  />
                ))}
              </Layer>
            )}
            {/* Committed polygon vertex editing layer */}
            {annotationTool === 'select' && committedPoly && selectedTrackId && (
              <Layer>
                {committedPoly.points.map(([px, py], i) => (
                  <Circle
                    key={i}
                    x={px * scale}
                    y={py * scale}
                    radius={5}
                    fill="white"
                    stroke={tokens.color.warning[500]}
                    strokeWidth={2}
                    draggable
                    hitStrokeWidth={12}
                    onDragEnd={(e: any) => handlePolygonVertexDragEnd(i, e.target)}
                  />
                ))}
              </Layer>
            )}
          </Stage>
        </div>
      )}
    </div>
  );
}
