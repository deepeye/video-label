import { tokens } from '../../styles/tokens';
import type { EventMarker } from '../../types';

type Step4EventListProps = {
  events: EventMarker[];
  selectedEventId: string | null;
  onSelect: (id: string) => void;
};

function formatTime(ms: number | null) {
  if (ms === null) return '未设置';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${Math.floor(milliseconds / 100)}`;
}

function getEventTitle(event: EventMarker) {
  if (event.eventType === 'custom') {
    return event.customEventType?.trim() || '自定义事件';
  }
  return event.eventType || '未命名事件';
}

function getTimeLabel(event: EventMarker) {
  if (event.mode === 'range') {
    return `${formatTime(event.startMs)} - ${formatTime(event.endMs)}`;
  }
  return formatTime(event.timeMs);
}

export function Step4EventList({ events, selectedEventId, onSelect }: Step4EventListProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space[2] }}>
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: tokens.color.neutral[400],
        }}
      >
        事件列表
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
        {events.length === 0 ? (
          <div
            style={{
              padding: tokens.space[3],
              borderRadius: tokens.radius.md,
              background: tokens.color.neutral[100],
              color: tokens.color.neutral[500],
              fontSize: 12,
            }}
          >
            暂无事件，请先新增一个时间点事件。
          </div>
        ) : (
          events.map((event) => {
            const selected = event.id === selectedEventId;
            return (
              <button
                key={event.id}
                type="button"
                data-testid={`event-row-${event.id}`}
                aria-selected={selected}
                onClick={() => onSelect(event.id)}
                style={{
                  textAlign: 'left',
                  border: `1px solid ${selected ? tokens.color.brand[600] : tokens.color.neutral[200]}`,
                  background: selected ? `${tokens.color.brand[500]}14` : tokens.color.neutral[0],
                  borderRadius: tokens.radius.md,
                  padding: tokens.space[3],
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  boxShadow: selected ? tokens.shadow.sm : 'none',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: tokens.color.neutral[700] }}>
                  {getEventTitle(event)}
                </span>
                <span style={{ fontSize: 12, color: tokens.color.neutral[500] }}>{getTimeLabel(event)}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
