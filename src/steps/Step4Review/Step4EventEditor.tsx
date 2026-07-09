import { useEffect, useMemo, useRef, useState } from 'react';
import { useDemoStore } from '../../store/demoStore';
import { tokens } from '../../styles/tokens';
import type { EventMarker } from '../../types';
import { EVENT_TYPE_PRESETS, SEVERITY_OPTIONS } from './eventPresets';

function normalizeTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formatTags(tags: string[]) {
  return tags.join(', ');
}

function parseTimeValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const next = Number(trimmed);
  return Number.isFinite(next) ? next : null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: tokens.color.neutral[700] }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function inputStyle() {
  return {
    height: 36,
    borderRadius: tokens.radius.sm,
    border: `1px solid ${tokens.color.neutral[200]}`,
    padding: '0 10px',
    fontSize: 13,
    color: tokens.color.neutral[700],
    background: tokens.color.neutral[0],
  };
}

function textareaStyle() {
  return {
    minHeight: 88,
    borderRadius: tokens.radius.sm,
    border: `1px solid ${tokens.color.neutral[200]}`,
    padding: '10px',
    fontSize: 13,
    color: tokens.color.neutral[700],
    resize: 'vertical' as const,
  };
}

export function Step4EventEditor() {
  const selectedEventId = useDemoStore((s) => s.selectedEventId);
  const events = useDemoStore((s) => s.events);
  const currentTimeMs = useDemoStore((s) => s.currentTimeMs);
  const createPointEvent = useDemoStore((s) => s.createPointEvent);
  const updateEvent = useDemoStore((s) => s.updateEvent);
  const deleteEvent = useDemoStore((s) => s.deleteEvent);
  const typeRef = useRef<HTMLSelectElement | null>(null);
  const previousSelectedRef = useRef<string | null>(selectedEventId);
  const [tagsInput, setTagsInput] = useState('');

  const event = useMemo(
    () => events.find((item) => item.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  useEffect(() => {
    if (selectedEventId && previousSelectedRef.current !== selectedEventId) {
      requestAnimationFrame(() => {
        typeRef.current?.focus();
      });
    }
    previousSelectedRef.current = selectedEventId;
  }, [selectedEventId]);

  useEffect(() => {
    setTagsInput(event ? formatTags(event.tags) : '');
  }, [event]);

  if (!event) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.space[3],
          padding: tokens.space[3],
          borderRadius: tokens.radius.md,
          background: tokens.color.neutral[100],
        }}
      >
        <div style={{ fontSize: 12, color: tokens.color.neutral[500], lineHeight: 1.6 }}>
          还没有选中事件，可在当前播放时间新增一个时间点事件。
        </div>
        <button
          type="button"
          onClick={() => createPointEvent(currentTimeMs)}
          style={{
            height: 40,
            borderRadius: tokens.radius.md,
            border: 'none',
            background: tokens.color.brand[500],
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          新增事件
        </button>
      </div>
    );
  }

  const timeField = event.mode === 'range'
    ? (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: tokens.space[2] }}>
        <Field label="开始时间(ms)">
          <input
            aria-label="开始时间(ms)"
            type="number"
            value={event.startMs ?? ''}
            onChange={(e) => updateEvent(event.id, { startMs: parseTimeValue(e.target.value) })}
            style={inputStyle()}
          />
        </Field>
        <Field label="结束时间(ms)">
          <input
            aria-label="结束时间(ms)"
            type="number"
            value={event.endMs ?? ''}
            onChange={(e) => updateEvent(event.id, { endMs: parseTimeValue(e.target.value) })}
            style={inputStyle()}
          />
        </Field>
      </div>
    )
    : (
      <Field label="时间(ms)">
        <input
          aria-label="时间(ms)"
          type="number"
          value={event.timeMs ?? ''}
          onChange={(e) => updateEvent(event.id, { timeMs: parseTimeValue(e.target.value) })}
          style={inputStyle()}
        />
      </Field>
    );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space[3] }}>
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: tokens.color.neutral[400],
        }}
      >
        事件编辑
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space[3] }}>
        <Field label="事件类型">
          <select
            ref={typeRef}
            aria-label="事件类型"
            value={event.eventType}
            onChange={(e) => updateEvent(event.id, { eventType: e.target.value, customEventType: e.target.value === 'custom' ? event.customEventType : null })}
            style={inputStyle()}
          >
            <option value="">请选择事件类型</option>
            {EVENT_TYPE_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>{preset.label}</option>
            ))}
          </select>
        </Field>

        {event.eventType === 'custom' && (
          <Field label="自定义事件类型">
            <input
              aria-label="自定义事件类型"
              value={event.customEventType ?? ''}
              onChange={(e) => updateEvent(event.id, { customEventType: e.target.value })}
              style={inputStyle()}
            />
          </Field>
        )}

        <Field label="严重程度">
          <select
            aria-label="严重程度"
            value={event.severity}
            onChange={(e) => updateEvent(event.id, { severity: e.target.value as EventMarker['severity'] })}
            style={inputStyle()}
          >
            {SEVERITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </Field>

        <Field label="标签">
          <input
            aria-label="标签"
            value={tagsInput}
            onChange={(e) => {
              const nextValue = e.target.value;
              setTagsInput(nextValue);
              updateEvent(event.id, { tags: normalizeTags(nextValue) });
            }}
            placeholder="逗号分隔，如 风险, 夜间"
            style={inputStyle()}
          />
        </Field>

        <Field label="描述">
          <textarea
            aria-label="描述"
            value={event.description}
            onChange={(e) => updateEvent(event.id, { description: e.target.value })}
            style={textareaStyle()}
          />
        </Field>

        {timeField}

        <button
          type="button"
          onClick={() => deleteEvent(event.id)}
          style={{
            height: 36,
            borderRadius: tokens.radius.sm,
            border: `1px solid ${tokens.color.danger[500]}`,
            background: tokens.color.neutral[0],
            color: tokens.color.danger[500],
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          删除事件
        </button>
      </div>
    </div>
  );
}
