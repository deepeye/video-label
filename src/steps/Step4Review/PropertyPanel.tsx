import { useState, type CSSProperties, type ReactNode } from 'react';
import { useDemoStore } from '../../store/demoStore';
import { getDataset } from '../../data';
import { findKeyframeAtTime } from '../../lib/interpolate';
import { tokens } from '../../styles/tokens';
import type { Annotation, AnnotationTool, ReviewStatus } from '../../types';

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: '待审核',
  accepted: '已接受',
  corrected: '已纠正',
  rejected: '已否决',
};

const TOOL_LABELS: { value: AnnotationTool; label: string }[] = [
  { value: 'select', label: '选择' },
  { value: 'bbox', label: '矩形框' },
  { value: 'polygon', label: '多边形' },
];

export function PropertyPanel() {
  const selectedTrackId = useDemoStore((s) => s.selectedTrackId);
  const annotations = useDemoStore((s) => s.annotations);
  const frameTags = useDemoStore((s) => s.frameTags);
  const currentTimeMs = useDemoStore((s) => s.currentTimeMs);
  const annotationTool = useDemoStore((s) => s.annotationTool);
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const acceptBox = useDemoStore((s) => s.acceptBox);
  const rejectBox = useDemoStore((s) => s.rejectBox);
  const upsertKeyframeGeometry = useDemoStore((s) => s.upsertKeyframeGeometry);
  const deleteKeyframe = useDemoStore((s) => s.deleteKeyframe);
  const setSceneTags = useDemoStore((s) => s.setSceneTags);
  const setAnnotationTool = useDemoStore((s) => s.setAnnotationTool);

  const dataset = getDataset(datasetId);
  const fps = dataset.metadata.fps;
  const currentFrameNo = Math.round((currentTimeMs / 1000) * fps);

  const selected: Annotation | null = selectedTrackId
    ? annotations.find((a) => a.track_id === selectedTrackId) ?? null
    : null;

  const currentKeyframe = selected
    ? findKeyframeAtTime(selected.keyframes, currentTimeMs)
    : null;

  const currentFrameTags = frameTags.find((f) => f.frame_no === currentFrameNo);

  const [tagInput, setTagInput] = useState('');

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    const current = currentFrameTags?.tags ?? [];
    if (current.includes(trimmed)) return;
    setSceneTags(currentFrameNo, currentTimeMs, [...current, trimmed]);
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    const current = currentFrameTags?.tags ?? [];
    setSceneTags(currentFrameNo, currentTimeMs, current.filter((t) => t !== tag));
  };

  const handleAddKeyframe = () => {
    if (!selectedTrackId) return;
    // 为当前帧创建一个 bbox keyframe（默认类型）
    const existingKf = findKeyframeAtTime(selected?.keyframes ?? [], currentTimeMs);
    if (existingKf) return; // 已有关键帧则不重复创建
    upsertKeyframeGeometry(selectedTrackId, currentFrameNo, currentTimeMs, {
      type: 'bbox',
      coords: [100, 100, 200, 200],
    });
  };

  const handleDeleteKeyframe = () => {
    if (!selectedTrackId || !currentKeyframe) return;
    deleteKeyframe(selectedTrackId, currentKeyframe.frame_no);
  };

  const timeDisplay = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div data-testid="property-panel" style={{ display: 'flex', flexDirection: 'column', gap: tokens.space[3], overflowY: 'auto', flex: 1 }}>
      {/* 工具切换 */}
      <div>
        <Header text="标注工具" />
        <div style={{ display: 'flex', gap: 4, marginTop: tokens.space[2] }}>
          {TOOL_LABELS.map((t) => (
            <button
              key={t.value}
              onClick={() => setAnnotationTool(t.value)}
              style={{
                flex: 1,
                height: 32,
                borderRadius: tokens.radius.sm,
                border: `1px solid ${annotationTool === t.value ? tokens.color.brand[500] : tokens.color.neutral[200]}`,
                background: annotationTool === t.value ? tokens.color.brand[400] + '20' : '#fff',
                color: annotationTool === t.value ? tokens.color.brand[600] : tokens.color.neutral[700],
                fontSize: 12,
                fontWeight: annotationTool === t.value ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 当前帧信息 */}
      <div>
        <Header text="当前帧" />
        <div
          style={{
            marginTop: tokens.space[2],
            padding: tokens.space[3],
            borderRadius: tokens.radius.md,
            background: tokens.color.neutral[100],
            fontSize: 13,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <Row label="时间" value={timeDisplay(currentTimeMs)} />
          <Row label="帧号" value={`#${currentFrameNo}`} />
          {currentKeyframe && (
            <span style={{ fontSize: 11, color: tokens.color.info[500] }}>
              已有关键帧 · {currentKeyframe.geometry.type}
            </span>
          )}
        </div>
      </div>

      {/* 关键帧操作 */}
      <div>
        <Header text="关键帧" />
        <div style={{ display: 'flex', gap: 6, marginTop: tokens.space[2] }}>
          <button
            onClick={handleAddKeyframe}
            disabled={!selectedTrackId || !!currentKeyframe}
            style={{
              ...smallBtn,
              background: !selectedTrackId || currentKeyframe ? tokens.color.neutral[200] : tokens.color.brand[500],
              color: !selectedTrackId || currentKeyframe ? tokens.color.neutral[400] : '#fff',
              cursor: !selectedTrackId || currentKeyframe ? 'not-allowed' : 'pointer',
            }}
          >
            + 添加关键帧
          </button>
          <button
            onClick={handleDeleteKeyframe}
            disabled={!currentKeyframe}
            style={{
              ...smallBtn,
              background: currentKeyframe ? tokens.color.danger[500] : tokens.color.neutral[200],
              color: currentKeyframe ? '#fff' : tokens.color.neutral[400],
              cursor: currentKeyframe ? 'pointer' : 'not-allowed',
            }}
          >
            删除
          </button>
        </div>
        {/* 已有的关键帧列表 */}
        {selected && selected.keyframes.length > 0 && (
          <div style={{ marginTop: tokens.space[2], maxHeight: 120, overflowY: 'auto' }}>
            <div style={{ fontSize: 11, color: tokens.color.neutral[400], marginBottom: 4 }}>
              {selected.keyframes.length} 个关键帧
            </div>
            {selected.keyframes.map((kf) => (
              <div
                key={kf.frame_no}
                style={{
                  fontSize: 11,
                  padding: '2px 6px',
                  borderRadius: 3,
                  background: kf.frame_no === currentFrameNo ? tokens.color.info[50] : 'transparent',
                  color: kf.frame_no === currentFrameNo ? tokens.color.info[500] : tokens.color.neutral[500],
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>#{kf.frame_no} {timeDisplay(kf.timestamp_ms)}</span>
                <span style={{ color: tokens.color.neutral[400] }}>{kf.geometry.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 场景标签 */}
      <div>
        <Header text="场景标签" />
        <div style={{ display: 'flex', gap: 4, marginTop: tokens.space[2] }}>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); }}
            placeholder="输入标签后回车"
            style={{
              flex: 1,
              height: 32,
              padding: '0 8px',
              borderRadius: tokens.radius.sm,
              border: `1px solid ${tokens.color.neutral[200]}`,
              fontSize: 12,
              outline: 'none',
            }}
          />
          <button
            onClick={handleAddTag}
            style={{
              ...smallBtn,
              background: tokens.color.brand[500],
              color: '#fff',
            }}
          >
            添加
          </button>
        </div>
        {currentFrameTags && currentFrameTags.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: tokens.space[2] }}>
            {currentFrameTags.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 20,
                  background: tokens.color.brand[400] + '40',
                  color: tokens.color.brand[600],
                  fontSize: 12,
                }}
              >
                {tag}
                <span
                  onClick={() => handleRemoveTag(tag)}
                  style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14, lineHeight: 1 }}
                >
                  ×
                </span>
              </span>
            ))}
          </div>
        )}
        {(!currentFrameTags || currentFrameTags.tags.length === 0) && (
          <div style={{ fontSize: 12, color: tokens.color.neutral[400], marginTop: tokens.space[1] }}>
            当前帧无场景标签
          </div>
        )}
      </div>

      {/* 审核区 */}
      {!selected ? (
        <div style={{ color: tokens.color.neutral[500], fontSize: 13, lineHeight: 1.6 }}>
          点击画布上的标注框开始审核，或在底部队列里选择重点项。
        </div>
      ) : (
        <>
          <Header text={`审核 · ${selected.label_display} #${selected.track_id.replace('trk_', '')}`} />
          <div
            style={{
              padding: tokens.space[3],
              borderRadius: tokens.radius.md,
              background: selected.confidence !== null && selected.confidence < 0.5 ? tokens.color.warning[50] : tokens.color.neutral[100],
              border: `1px solid ${selected.confidence !== null && selected.confidence < 0.5 ? tokens.color.warning[500] : tokens.color.neutral[200]}`,
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
                  {selected.confidence === null ? '—' : selected.confidence.toFixed(2)}
                  {selected.confidence !== null && selected.confidence < 0.5 && ' ⚠'}
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
        </>
      )}
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
        borderBottom: `1px solid ${tokens.color.neutral[200]}`,
        paddingBottom: 4,
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
        marginLeft: 4,
        padding: '2px 6px',
        borderRadius: 3,
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
    borderRadius: 8,
    background: bg,
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
  };
}

const smallBtn: CSSProperties = {
  flex: 1,
  height: 32,
  borderRadius: 4,
  border: 'none',
  fontSize: 12,
  fontWeight: 500,
};
