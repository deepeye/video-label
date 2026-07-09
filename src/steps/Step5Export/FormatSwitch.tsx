import { tokens } from '../../styles/tokens';
import type { ExportFormat } from './manifest';

interface FormatSwitchProps {
  value: ExportFormat;
  onChange: (v: ExportFormat) => void;
}

const OPTS: { id: ExportFormat; label: string; desc: string }[] = [
  { id: 'native', label: '原生 JSON (含溯源)', desc: '反映人工审核 review/source — 演示卖点最强' },
  { id: 'coco-video', label: 'COCO-Video', desc: '业内标准格式, 兼容主流训练管线' },
];

export function FormatSwitch({ value, onChange }: FormatSwitchProps) {
  return (
    <div data-testid="format-switch" role="radiogroup" aria-label="导出格式">
      {OPTS.map((opt) => {
        const active = opt.id === value;
        return (
          <label
            key={opt.id}
            data-testid={`format-${opt.id}`}
            data-active={active ? 'true' : 'false'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: tokens.space[3],
              padding: tokens.space[3],
              marginBottom: tokens.space[2],
              borderRadius: tokens.radius.md,
              cursor: 'pointer',
              background: active ? tokens.color.brand[400] + '20' : tokens.color.neutral[0],
              border: `1px solid ${active ? tokens.color.brand[500] : tokens.color.neutral[200]}`,
            }}
          >
            <input
              type="radio"
              name="format"
              checked={active}
              onChange={() => onChange(opt.id)}
              style={{ accentColor: tokens.color.brand[500] }}
            />
            <div>
              <div style={{ fontWeight: 600, color: tokens.color.neutral[900] }}>{opt.label}</div>
              <div style={{ fontSize: 12, color: tokens.color.neutral[500] }}>{opt.desc}</div>
            </div>
          </label>
        );
      })}
    </div>
  );
}
