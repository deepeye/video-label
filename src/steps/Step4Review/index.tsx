import { useMemo } from 'react';
import type { TimelineTool } from '../../types';
import { useDemoStore } from '../../store/demoStore';
import { tokens } from '../../styles/tokens';
import { Step4EventEditor } from './Step4EventEditor';
import { Step4EventList } from './Step4EventList';
import { Step4TimelineConnected } from './Step4Timeline';
import { Step4VideoStage } from './Step4VideoStage';

const TIMELINE_TOOLS: Array<{ value: TimelineTool; label: string }> = [
  { value: 'browse', label: '浏览' },
  { value: 'point', label: '点' },
  { value: 'range', label: '范围' },
  { value: 'region', label: '区域' },
];

export function Step4Review() {
  const events = useDemoStore((s) => s.events);
  const selectedEventId = useDemoStore((s) => s.selectedEventId);
  const timelineTool = useDemoStore((s) => s.timelineTool);
  const playbackState = useDemoStore((s) => s.playbackState);
  const selectEvent = useDemoStore((s) => s.selectEvent);
  const setTimelineTool = useDemoStore((s) => s.setTimelineTool);
  const play = useDemoStore((s) => s.play);
  const pause = useDemoStore((s) => s.pause);

  const sortedEvents = useMemo(
    () =>
      [...events].sort((a, b) => {
        const aTime = a.mode === 'range' ? a.startMs ?? Number.MAX_SAFE_INTEGER : a.timeMs ?? Number.MAX_SAFE_INTEGER;
        const bTime = b.mode === 'range' ? b.startMs ?? Number.MAX_SAFE_INTEGER : b.timeMs ?? Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      }),
    [events],
  );

  return (
    <div
      data-testid="step4-review"
      style={{
        flex: 1,
        display: 'flex',
        minHeight: 0,
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: tokens.space[3],
          gap: tokens.space[2],
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.space[2],
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => (playbackState === 'playing' ? pause() : play())}
            style={{
              border: `1px solid ${tokens.color.neutral[300]}`,
              background: tokens.color.neutral[0],
              color: tokens.color.neutral[700],
              borderRadius: tokens.radius.pill,
              padding: `${tokens.space[1]} ${tokens.space[3]}`,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {playbackState === 'playing' ? '暂停' : '播放'}
          </button>
          {TIMELINE_TOOLS.map((tool) => {
            const active = timelineTool === tool.value;
            return (
              <button
                key={tool.value}
                type="button"
                onClick={() => setTimelineTool(tool.value)}
                aria-pressed={active}
                style={{
                  border: `1px solid ${active ? tokens.color.brand[500] : tokens.color.neutral[300]}`,
                  background: active ? tokens.color.brand[50] : tokens.color.neutral[0],
                  color: active ? tokens.color.brand[700] : tokens.color.neutral[700],
                  borderRadius: tokens.radius.pill,
                  padding: `${tokens.space[1]} ${tokens.space[3]}`,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {tool.label}
              </button>
            );
          })}
        </div>
        <div
          style={{
            flex: 1,
            background: tokens.color.neutral[900],
            borderRadius: tokens.radius.md,
            overflow: 'hidden',
            position: 'relative',
            boxShadow: tokens.shadow.sm,
          }}
        >
          <Step4VideoStage />
        </div>
        <Step4TimelineConnected />
      </div>
      <aside
        style={{
          width: 'min(28%, 360px)',
          minWidth: 280,
          background: tokens.color.neutral[0],
          borderLeft: `1px solid ${tokens.color.neutral[200]}`,
          padding: tokens.space[4],
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.space[3],
          overflowY: 'auto',
        }}
      >
        <Step4EventList events={sortedEvents} selectedEventId={selectedEventId} onSelect={selectEvent} />
        <Step4EventEditor />
      </aside>
    </div>
  );
}
