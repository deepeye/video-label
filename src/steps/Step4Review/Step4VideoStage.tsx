import { useEffect, useMemo, useRef, useState } from 'react';
import { getDataset } from '../../data';
import { useDemoStore } from '../../store/demoStore';
import { tokens } from '../../styles/tokens';
import type { BBox, EventMarker } from '../../types';
import { FrameBoxesOverlay } from './FrameBoxesOverlay';

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getEventAnchorMs(event: EventMarker) {
  if (event.mode === 'range') {
    return event.startMs ?? event.regionAnchorMs ?? 0;
  }
  return event.timeMs ?? event.regionAnchorMs ?? 0;
}

function normalizeBox(startX: number, startY: number, endX: number, endY: number): BBox {
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  return [left, top, width, height];
}

export function Step4VideoStage() {
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const currentTimeMs = useDemoStore((s) => s.currentTimeMs);
  const events = useDemoStore((s) => s.events);
  const selectedEventId = useDemoStore((s) => s.selectedEventId);
  const timelineTool = useDemoStore((s) => s.timelineTool);
  const pendingSeekMs = useDemoStore((s) => s.pendingSeekMs);
  const seekNonce = useDemoStore((s) => s.seekNonce);
  const playbackState = useDemoStore((s) => s.playbackState);
  const loadingDataset = useDemoStore((s) => s.loadingDataset);
  const loadingDatasetError = useDemoStore((s) => s.loadingDatasetError);
  const selectDataset = useDemoStore((s) => s.selectDataset);
  const selectEvent = useDemoStore((s) => s.selectEvent);
  const attachRegionBox = useDemoStore((s) => s.attachRegionBox);
  const setTimelineTool = useDemoStore((s) => s.setTimelineTool);
  const clearPendingSeek = useDemoStore((s) => s.clearPendingSeek);
  const setCurrentTimeMs = useDemoStore((s) => s.setCurrentTimeMs);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [draftBox, setDraftBox] = useState<BBox | null>(null);
  const dataset = loadingDataset ? null : getDataset(datasetId);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || pendingSeekMs === null) {
      return;
    }

    video.currentTime = pendingSeekMs / 1000;
    video.pause();
    clearPendingSeek();
  }, [clearPendingSeek, pendingSeekMs, seekNonce]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || pendingSeekMs !== null || playbackState !== 'paused') {
      return;
    }

    video.currentTime = currentTimeMs / 1000;
  }, [currentTimeMs, pendingSeekMs, playbackState]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const syncCurrentTime = () => {
      setCurrentTimeMs(Math.round(video.currentTime * 1000));
    };

    if (playbackState === 'playing') {
      const playResult = video.play();
      if (playResult && typeof playResult.catch === 'function') {
        void playResult.catch(() => {});
      }
      video.addEventListener('timeupdate', syncCurrentTime);
      return () => {
        video.removeEventListener('timeupdate', syncCurrentTime);
      };
    }

    video.pause();
  }, [dataset?.video_src, playbackState, setCurrentTimeMs]);

  const regionEvents = useMemo(() => events.filter((event) => event.regionBox), [events]);

  const beginRegionDrag = (clientX: number, clientY: number) => {
    if (timelineTool !== 'region' || !selectedEventId) {
      return;
    }
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const startX = clamp(clientX - rect.left, 0, rect.width);
    const startY = clamp(clientY - rect.top, 0, rect.height);
    dragStartRef.current = { x: startX, y: startY };
    setDraftBox([startX, startY, 0, 0]);
  };

  const updateRegionDrag = (clientX: number, clientY: number) => {
    if (!dragStartRef.current) {
      return;
    }
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const endX = clamp(clientX - rect.left, 0, rect.width);
    const endY = clamp(clientY - rect.top, 0, rect.height);
    setDraftBox(normalizeBox(dragStartRef.current.x, dragStartRef.current.y, endX, endY));
  };

  const finishRegionDrag = (clientX: number, clientY: number) => {
    if (!dragStartRef.current || !selectedEventId) {
      return;
    }
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) {
      dragStartRef.current = null;
      setDraftBox(null);
      return;
    }
    const endX = clamp(clientX - rect.left, 0, rect.width);
    const endY = clamp(clientY - rect.top, 0, rect.height);
    const nextBox = normalizeBox(dragStartRef.current.x, dragStartRef.current.y, endX, endY);
    dragStartRef.current = null;
    setDraftBox(null);
    if (nextBox[2] === 0 || nextBox[3] === 0) {
      return;
    }
    attachRegionBox(selectedEventId, nextBox, currentTimeMs);
    setTimelineTool('browse');
  };

  if (!dataset) {
    if (loadingDatasetError) {
      return (
        <div
          data-testid="step4-video-stage"
          style={{ width: '100%', height: '100%', minHeight: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: tokens.color.danger[500], fontSize: 14, background: '#000', gap: tokens.space[2] }}
        >
          <span>加载失败: {loadingDatasetError}</span>
          <button
            type="button"
            onClick={() => selectDataset(datasetId)}
            style={{
              border: `1px solid ${tokens.color.danger[500]}`,
              background: 'transparent',
              color: tokens.color.danger[500],
              borderRadius: tokens.radius.md,
              padding: `${tokens.space[1]} ${tokens.space[3]}`,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            重试
          </button>
        </div>
      );
    }
    return (
      <div
        data-testid="step4-video-stage"
        style={{ width: '100%', height: '100%', minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.color.neutral[400], fontSize: 14, background: '#000' }}
      >
        加载中…
      </div>
    );
  }

  return (
    <div
      data-testid="step4-video-stage"
      ref={stageRef}
      onMouseDown={(event) => beginRegionDrag(event.clientX, event.clientY)}
      onMouseMove={(event) => updateRegionDrag(event.clientX, event.clientY)}
      onMouseUp={(event) => finishRegionDrag(event.clientX, event.clientY)}
      onMouseLeave={(event) => {
        if (dragStartRef.current) {
          finishRegionDrag(event.clientX, event.clientY);
        }
      }}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 320,
        background: '#000',
        overflow: 'hidden',
        cursor: timelineTool === 'region' && selectedEventId ? 'crosshair' : 'default',
      }}
    >
      <video
        ref={videoRef}
        src={dataset.video_src}
        muted
        playsInline
        loop
        autoPlay
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
      <FrameBoxesOverlay videoRef={videoRef} />
      {regionEvents.map((event) => {
        const box = event.regionBox;
        if (!box) {
          return null;
        }
        const selected = event.id === selectedEventId;
        return (
          <button
            key={event.id}
            type="button"
            data-testid={`region-box-${event.id}`}
            aria-label={`region-box-${event.id}`}
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              selectEvent(event.id);
            }}
            style={{
              position: 'absolute',
              left: box[0],
              top: box[1],
              width: box[2],
              height: box[3],
              borderRadius: tokens.radius.sm,
              border: `2px solid ${selected ? tokens.color.brand[500] : tokens.color.accent[500]}`,
              background: selected ? `${tokens.color.brand[500]}22` : `${tokens.color.accent[500]}1A`,
              boxSizing: 'border-box',
              cursor: 'pointer',
            }}
            title={`${event.eventType || '未命名事件'} @ ${getEventAnchorMs(event)}ms`}
          />
        );
      })}
      {draftBox ? (
        <div
          style={{
            position: 'absolute',
            left: draftBox[0],
            top: draftBox[1],
            width: draftBox[2],
            height: draftBox[3],
            borderRadius: tokens.radius.sm,
            border: `1px dashed ${tokens.color.brand[400]}`,
            background: `${tokens.color.brand[400]}22`,
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </div>
  );
}
