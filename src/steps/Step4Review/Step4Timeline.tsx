import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getDataset } from '../../data';
import { useDemoStore } from '../../store/demoStore';
import { tokens } from '../../styles/tokens';
import type { EventMarker } from '../../types';

interface Step4TimelineProps {
  durationMs: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getEventAnchorMs(event: EventMarker) {
  if (event.mode === 'range') {
    return event.startMs ?? 0;
  }
  return event.timeMs ?? 0;
}

export function Step4Timeline({ durationMs }: Step4TimelineProps) {
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const events = useDemoStore((s) => s.events);
  const selectedEventId = useDemoStore((s) => s.selectedEventId);
  const timelineTool = useDemoStore((s) => s.timelineTool);
  const currentTimeMs = useDemoStore((s) => s.currentTimeMs);
  const createPointEvent = useDemoStore((s) => s.createPointEvent);
  const createRangeEvent = useDemoStore((s) => s.createRangeEvent);
  const selectEvent = useDemoStore((s) => s.selectEvent);
  const setCurrentTimeMs = useDemoStore((s) => s.setCurrentTimeMs);
  const setTimelineTool = useDemoStore((s) => s.setTimelineTool);
  const pause = useDemoStore((s) => s.pause);
  const [draftRange, setDraftRange] = useState<{ startMs: number; endMs: number } | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; timeMs: number } | null>(null);
  const [contextMenuPlacement, setContextMenuPlacement] = useState<{ top: number; left: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const [oneShotRangeStartMs, setOneShotRangeStartMs] = useState<number | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const fps = getDataset(datasetId).metadata.fps;
  const currentFrameNo = Math.round((currentTimeMs / 1000) * fps);
  const currentTimeLabel = `${(currentTimeMs / 1000).toFixed(3)}s`;

  const sortedEvents = useMemo(
    () =>
      [...events].sort((a, b) => {
        return getEventAnchorMs(a) - getEventAnchorMs(b);
      }),
    [events],
  );

  const ratioForMs = (ms: number) => {
    if (durationMs <= 0) {
      return 0;
    }
    return clamp(ms / durationMs, 0, 1);
  };

  const msFromClientX = (clientX: number) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) {
      return 0;
    }
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    return Math.round(ratio * durationMs);
  };

  const finishRange = (endMs: number) => {
    if (!draftRange) {
      return;
    }
    createRangeEvent(draftRange.startMs, endMs);
    setDraftRange(null);
    setOneShotRangeStartMs(null);
    setTimelineTool('browse');
  };

  const closeContextMenu = () => {
    setContextMenu(null);
    setContextMenuPlacement(null);
  };

  const createPointEventFromContextMenu = () => {
    if (!contextMenu) {
      return;
    }
    createPointEvent(contextMenu.timeMs);
    setCurrentTimeMs(contextMenu.timeMs);
    closeContextMenu();
  };

  const startOneShotRangeFromContextMenu = () => {
    if (!contextMenu) {
      return;
    }
    setDraftRange({ startMs: contextMenu.timeMs, endMs: contextMenu.timeMs });
    setOneShotRangeStartMs(contextMenu.timeMs);
    setCurrentTimeMs(contextMenu.timeMs);
    closeContextMenu();
  };

  useLayoutEffect(() => {
    if (!contextMenu || !contextMenuRef.current) {
      return;
    }

    const menuRect = contextMenuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 8;

    let left = contextMenu.x + margin;
    let top = contextMenu.y + margin;

    if (left + menuRect.width > viewportWidth - margin) {
      left = contextMenu.x - menuRect.width - margin;
    }
    if (top + menuRect.height > viewportHeight - margin) {
      top = contextMenu.y - menuRect.height - margin;
    }

    left = clamp(left, margin, Math.max(margin, viewportWidth - menuRect.width - margin));
    top = clamp(top, margin, Math.max(margin, viewportHeight - menuRect.height - margin));

    setContextMenuPlacement((prev) => {
      if (prev?.left === left && prev?.top === top) {
        return prev;
      }
      return { left, top };
    });
  }, [contextMenu]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space[2],
        padding: tokens.space[3],
        background: tokens.color.neutral[0],
        borderRadius: tokens.radius.md,
        boxShadow: tokens.shadow.xs,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: tokens.space[2] }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: tokens.color.neutral[400] }}>
            时间线标注
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: tokens.color.neutral[900] }}>
            当前时间 {currentTimeLabel} · 第 {currentFrameNo} 帧
          </div>
        </div>
        <div style={{ fontSize: 12, color: tokens.color.neutral[500] }}>
          工具：{timelineTool === 'browse' ? '浏览' : timelineTool === 'point' ? '点' : '范围'}
        </div>
      </div>
      <div
        ref={surfaceRef}
        data-testid="step4-timeline-surface"
        onClick={(event) => {
          closeContextMenu();
          if (timelineTool !== 'point') {
            return;
          }
          const timeMs = msFromClientX(event.clientX);
          createPointEvent(timeMs);
          setTimelineTool('browse');
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          setContextMenu({
            x: event.clientX,
            y: event.clientY,
            timeMs: msFromClientX(event.clientX),
          });
        }}
        onMouseDown={(event) => {
          const target = event.target as HTMLElement;
          const isMenuClick = target.closest('[role="menu"]') !== null;
          if (isMenuClick) {
            return;
          }
          closeContextMenu();
          if (event.button !== 0) {
            return;
          }
          if (timelineTool === 'browse') {
            const timeMs = msFromClientX(event.clientX);
            setCurrentTimeMs(timeMs);
            pause();
            setIsScrubbing(true);
            return;
          }
          if (timelineTool !== 'range') {
            return;
          }
          const startMs = msFromClientX(event.clientX);
          setDraftRange({ startMs, endMs: startMs });
          setOneShotRangeStartMs(null);
        }}
        onMouseMove={(event) => {
          if (isScrubbing) {
            setCurrentTimeMs(msFromClientX(event.clientX));
            return;
          }
          if (!draftRange || (timelineTool !== 'range' && oneShotRangeStartMs == null)) {
            return;
          }
          const endMs = msFromClientX(event.clientX);
          setDraftRange({ ...draftRange, endMs });
        }}
        onMouseUp={(event) => {
          if (isScrubbing) {
            setCurrentTimeMs(msFromClientX(event.clientX));
            pause();
            setIsScrubbing(false);
            return;
          }
          if (!draftRange || (timelineTool !== 'range' && oneShotRangeStartMs == null)) {
            return;
          }
          finishRange(msFromClientX(event.clientX));
        }}
        onMouseLeave={() => {
          if (isScrubbing) {
            pause();
            setIsScrubbing(false);
            return;
          }
          if (draftRange && (timelineTool === 'range' || oneShotRangeStartMs != null)) {
            finishRange(draftRange.endMs);
          }
        }}
        style={{
          position: 'relative',
          height: 56,
          borderRadius: tokens.radius.md,
          border: `1px solid ${timelineTool === 'browse' ? tokens.color.neutral[200] : tokens.color.brand[500]}`,
          background: tokens.color.neutral[50],
          cursor: timelineTool === 'browse' ? 'default' : 'crosshair',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '50%',
            height: 4,
            transform: 'translateY(-50%)',
            background: tokens.color.neutral[200],
          }}
        />
        <div
          data-testid="timeline-played-progress"
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            height: 4,
            width: `${ratioForMs(currentTimeMs) * 100}%`,
            transform: 'translateY(-50%)',
            background: tokens.color.brand[400],
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${ratioForMs(currentTimeMs) * 100}%`,
            width: 2,
            background: tokens.color.brand[600],
          }}
        />
        {draftRange ? (
          <div
            style={{
              position: 'absolute',
              top: 12,
              bottom: 12,
              left: `${ratioForMs(Math.min(draftRange.startMs, draftRange.endMs)) * 100}%`,
              width: `${Math.max(ratioForMs(Math.max(draftRange.startMs, draftRange.endMs)) - ratioForMs(Math.min(draftRange.startMs, draftRange.endMs)), 0.003) * 100}%`,
              background: `${tokens.color.brand[400]}33`,
              border: `1px solid ${tokens.color.brand[500]}`,
              borderRadius: tokens.radius.sm,
            }}
          />
        ) : null}
      {contextMenu ? (
        <div
          ref={contextMenuRef}
          role="menu"
          style={{
            position: 'fixed',
            top: contextMenuPlacement?.top ?? contextMenu.y + 8,
            left: contextMenuPlacement?.left ?? contextMenu.x + 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            minWidth: 140,
            padding: 6,
            borderRadius: tokens.radius.md,
            border: `1px solid ${tokens.color.neutral[200]}`,
            background: tokens.color.neutral[0],
            boxShadow: tokens.shadow.md,
            zIndex: 1000,
          }}
        >
          <button
            role="menuitem"
            type="button"
            onMouseDown={(event) => {
              event.stopPropagation();
              event.preventDefault();
              event.currentTarget.style.background = tokens.color.neutral[200];
              createPointEventFromContextMenu();
            }}
            style={{
              border: 'none',
              background: 'transparent',
              textAlign: 'left',
              padding: '10px 12px',
              borderRadius: tokens.radius.sm,
              color: tokens.color.neutral[900],
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 120ms ease',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = tokens.color.neutral[100];
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'transparent';
            }}
            onMouseUp={(event) => {
              event.currentTarget.style.background = tokens.color.neutral[100];
            }}
          >
            新增点事件
          </button>
          <button
            role="menuitem"
            type="button"
            onMouseDown={(event) => {
              event.stopPropagation();
              event.preventDefault();
              event.currentTarget.style.background = tokens.color.neutral[200];
              startOneShotRangeFromContextMenu();
            }}
            style={{
              border: 'none',
              background: 'transparent',
              textAlign: 'left',
              padding: '10px 12px',
              borderRadius: tokens.radius.sm,
              color: tokens.color.neutral[900],
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 120ms ease',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = tokens.color.neutral[100];
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'transparent';
            }}
            onMouseUp={(event) => {
              event.currentTarget.style.background = tokens.color.neutral[100];
            }}
          >
            新增区间事件
          </button>
        </div>
      ) : null}
        {sortedEvents.map((event) => {
          const selected = event.id === selectedEventId;
          const anchorMs = getEventAnchorMs(event);
          const left = `${ratioForMs(anchorMs) * 100}%`;
          if (event.mode === 'range') {
            const startMs = event.startMs ?? anchorMs;
            const endMs = event.endMs ?? anchorMs;
            return (
              <button
                key={event.id}
                type="button"
                data-testid={`timeline-event-${event.id}`}
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  selectEvent(event.id);
                  setCurrentTimeMs(anchorMs);
                }}
                style={{
                  position: 'absolute',
                  top: 14,
                  height: 28,
                  left: `${ratioForMs(startMs) * 100}%`,
                  width: `${Math.max(ratioForMs(endMs) - ratioForMs(startMs), 0.01) * 100}%`,
                  borderRadius: tokens.radius.sm,
                  border: `1px solid ${selected ? tokens.color.brand[600] : tokens.color.accent[500]}`,
                  background: selected ? `${tokens.color.brand[400]}33` : `${tokens.color.accent[500]}22`,
                  cursor: 'pointer',
                }}
                aria-label={`event-${event.id}`}
              />
            );
          }

          return (
            <button
              key={event.id}
              type="button"
              data-testid={`timeline-event-${event.id}`}
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                selectEvent(event.id);
                setCurrentTimeMs(anchorMs);
              }}
              style={{
                position: 'absolute',
                top: 10,
                left,
                width: 12,
                height: 36,
                transform: 'translateX(-50%)',
                borderRadius: tokens.radius.full,
                border: `1px solid ${selected ? tokens.color.brand[600] : tokens.color.info[500]}`,
                background: selected ? tokens.color.brand[500] : tokens.color.info[500],
                cursor: 'pointer',
              }}
              aria-label={`event-${event.id}`}
            />
          );
        })}
      </div>
    </div>
  );
}

export function Step4TimelineConnected() {
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const durationMs = getDataset(datasetId).metadata.duration_ms;

  return <Step4Timeline durationMs={durationMs} />;
}
