import type { CSSProperties, ReactNode } from 'react';
import { useDemoStore } from '../../store/demoStore';
import { tokens } from '../../styles/tokens';
import type { Annotation, ReviewStatus } from '../../types';

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: '待审核',
  accepted: '已接受',
  corrected: '已纠正',
  rejected: '已否决',
};

export function PropertyPanel() {
  const selectedTrackId = useDemoStore((s) => s.selectedTrackId);
  const annotations = useDemoStore((s) => s.annotations);
  const acceptBox = useDemoStore((s) => s.acceptBox);
  const rejectBox = useDemoStore((s) => s.rejectBox);

  const selected: Annotation | null = selectedTrackId
    ? annotations.find((a) => a.track_id === selectedTrackId) ?? null
    : null;

  if (!selected) {
    return (
      <div data-testid="property-panel" style={{ display: 'flex', flexDirection: 'column', gap: tokens.space[3] }}>
        <Header text="审核" />
        <div style={{ color: tokens.color.neutral[500], fontSize: 13, lineHeight: 1.6 }}>
          点击画布上的标注框开始审核，或在底部队列里选择重点项。
        </div>
      </div>
    );
  }

  const conf = selected.confidence;
  const isLowConf = conf !== null && conf < 0.5;

  return (
    <div data-testid="property-panel" style={{ display: 'flex', flexDirection: 'column', gap: tokens.space[3] }}>
      <Header text={`审核 · ${selected.label_display} #${selected.track_id.replace('trk_', '')}`} />
      <div
        style={{
          padding: tokens.space[3],
          borderRadius: tokens.radius.md,
          background: isLowConf ? tokens.color.warning[50] : tokens.color.neutral[100],
          border: `1px solid ${isLowConf ? tokens.color.warning[500] : tokens.color.neutral[200]}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          fontSize: 13,
        }}
      >
        <Row label="标签" value={selected.label_display} />
        <Row label="来源" value={selected.source === 'machine' ? '机器' : '人工'} />
        <Row
          label="置信"
          value={
            <span className="tabular">
              {conf === null ? '—' : conf.toFixed(2)}
              {isLowConf && ' ⚠'}
            </span>
          }
        />
        <Row label="状态" value={STATUS_LABEL[selected.review.status]} />
      </div>

      <button
        data-testid="btn-accept"
        onClick={() => acceptBox(selected.track_id)}
        style={primaryBtn(tokens.color.success[500])}
      >
        ✓ 接受 <Kbd k="A" />
      </button>
      <button
        data-testid="btn-reject"
        onClick={() => rejectBox(selected.track_id)}
        style={primaryBtn(tokens.color.neutral[500])}
      >
        ✗ 否决 <Kbd k="D" />
      </button>
      <div
        style={{
          marginTop: tokens.space[2],
          padding: tokens.space[3],
          borderRadius: tokens.radius.md,
          background: tokens.color.neutral[100],
          textAlign: 'center',
          fontSize: 12,
          color: tokens.color.neutral[500],
        }}
      >
        ↔ 拖角点改框
      </div>
    </div>
  );
}

function Header({ text }: { text: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: tokens.color.neutral[400],
      }}
    >
      {text}
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: tokens.color.neutral[500] }}>{label}</span>
      <span style={{ color: tokens.color.neutral[700] }}>{value}</span>
    </div>
  );
}

function Kbd({ k }: { k: string }) {
  return (
    <span
      style={{
        marginLeft: tokens.space[2],
        padding: '2px 6px',
        borderRadius: tokens.radius.sm,
        background: 'rgba(255,255,255,0.25)',
        fontFamily: 'JetBrains Mono',
        fontSize: 11,
        fontWeight: 500,
      }}
    >
      {k}
    </span>
  );
}

function primaryBtn(bg: string): CSSProperties {
  return {
    height: 44,
    borderRadius: tokens.radius.md,
    background: bg,
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: tokens.shadow.sm,
  };
}
