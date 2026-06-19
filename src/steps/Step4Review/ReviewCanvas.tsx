import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Transformer } from 'react-konva';
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
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const selectTrack = useDemoStore((s) => s.selectTrack);
  const correctBoxGeometry = useDemoStore((s) => s.correctBoxGeometry);
  const selectedTrackId = useDemoStore((s) => s.selectedTrackId);
  const annotations = useDemoStore((s) => s.annotations);
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const dataset = getDataset(datasetId);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [currentTimeMs, setCurrentTimeMs] = useState(0);

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

  // 用可见 video 的实际帧时间驱动 BoxLayer，而不是把视频画进 Konva canvas
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let handle: ReturnType<typeof watchVideoFrames> | null = null;
    const onLoaded = () => {
      handle = watchVideoFrames(video, () => {
        setCurrentTimeMs(Math.round(video.currentTime * 1000));
      });
    };

    if (video.readyState >= 2) onLoaded();
    else video.addEventListener('loadeddata', onLoaded);

    return () => {
      video.removeEventListener('loadeddata', onLoaded);
      handle?.cancel();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // 自动播放被拦截，等待用户交互
        });
      }
    } catch {
      // jsdom: HTMLMediaElement.play 未实现
    }
  }, []);

  const selectedAnnotation = useMemo(
    () => (selectedTrackId ? annotations.find((a) => a.track_id === selectedTrackId) ?? null : null),
    [selectedTrackId, annotations],
  );

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
    if (node) {
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
                  if (!selectedTrackId || !selectedAnnotation || scale === 0) return;

                  let frameIdx = 0;
                  let minDiff = Infinity;
                  selectedAnnotation.keyframes.forEach((kf, i) => {
                    const diff = Math.abs(kf.timestamp_ms - currentTimeMs);
                    if (diff < minDiff) {
                      minDiff = diff;
                      frameIdx = i;
                    }
                  });

                  const newX = node.x() / scale;
                  const newY = node.y() / scale;
                  const newW = (node.width() * node.scaleX()) / scale;
                  const newH = (node.height() * node.scaleY()) / scale;

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
