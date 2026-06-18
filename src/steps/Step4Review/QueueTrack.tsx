import { useDemoStore } from '../../store/demoStore';
import { getDataset } from '../../data';
import { tokens } from '../../styles/tokens';
import type { Annotation, ReviewStatus } from '../../types';

const STATUS_COLOR: Record<ReviewStatus, string> = {
  pending: tokens.color.warning[500],
  accepted: tokens.color.success[500],
  corrected: tokens.color.info[500],
  rejected: tokens.color.rejectedStroke,
};

export function QueueTrack() {
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const annotations = useDemoStore((s) => s.annotations);
  const selectedTrackId = useDemoStore((s) => s.selectedTrackId);
  const selectTrack = useDemoStore((s) => s.selectTrack);
  const setReviewQueueIndex = useDemoStore((s) => s.setReviewQueueIndex);
  const acceptAllRemaining = useDemoStore((s) => s.acceptAllRemaining);

  const dataset = getDataset(datasetId);
  const focusIds = dataset.demo_script.review_focus_ids;
  const focusItems: Annotation[] = focusIds
    .map((id) => annotations.find((a) => a.track_id === id))
    .filter((x): x is Annotation => Boolean(x));

  const allFocusReviewed = focusItems.every((a) => a.review.status !== 'pending');
  const remainingPending = annotations.filter((a) => a.review.status === 'pending' && !focusIds.includes(a.track_id));
  const acceptAllDisabled = !allFocusReviewed || remainingPending.length === 0;

  return (
    <div
      data-testid="queue-track"
      style={{
        height: 80,
        display: 'flex',
        alignItems: 'center',
        gap: tokens.space[3],
        padding: `0 ${tokens.space[3]}px`,
        background: tokens.color.neutral[100],
        borderRadius: tokens.radius.md,
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: tokens.color.neutral[500],
          flexShrink: 0,
          minWidth: 70,
        }}
      >
        队列 {focusItems.filter((a) => a.review.status !== 'pending').length}/{focusItems.length}
      </div>

      <div style={{ display: 'flex', gap: tokens.space[2], flex: 1 }}>
        {focusItems.map((ann, idx) => {
          const isCurrent = selectedTrackId === ann.track_id;
          const reviewed = ann.review.status !== 'pending';
          const statusColor = STATUS_COLOR[ann.review.status];
          return (
            <button
              key={ann.track_id}
              data-testid={`queue-card-${ann.track_id}`}
              onClick={() => {
                selectTrack(ann.track_id);
                setReviewQueueIndex(idx);
              }}
              style={{
                width: 130,
                height: 60,
                borderRadius: tokens.radius.md,
                background: tokens.color.neutral[0],
                border: `2px solid ${isCurrent ? 'transparent' : tokens.color.neutral[200]}`,
                backgroundImage: isCurrent ? tokens.brandGradient : undefined,
                color: isCurrent ? '#fff' : tokens.color.neutral[700],
                cursor: 'pointer',
                padding: tokens.space[2],
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                textAlign: 'left',
                opacity: reviewed && !isCurrent ? 0.6 : 1,
                boxShadow: isCurrent ? tokens.shadow.brand : 'none',
                position: 'relative',
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 600 }}>
                {ann.label_display} #{ann.track_id.replace('trk_', '')}
                {isCurrent && <span style={{ marginLeft: 6 }}>◀</span>}
              </div>
              <div className="tabular" style={{ fontSize: 11 }}>
                conf {ann.confidence?.toFixed(2) ?? '—'}
              </div>
              {reviewed && (
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    right: 6,
                    top: 6,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: statusColor,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      <button
        data-testid="accept-all-remaining"
        onClick={() => acceptAllRemaining()}
        disabled={acceptAllDisabled}
        style={{
          height: 44,
          padding: `0 ${tokens.space[4]}px`,
          borderRadius: tokens.radius.md,
          background: acceptAllDisabled ? tokens.color.neutral[200] : 'transparent',
          backgroundImage: acceptAllDisabled ? undefined : tokens.brandGradient,
          color: acceptAllDisabled ? tokens.color.neutral[400] : '#fff',
          border: 'none',
          fontSize: 13,
          fontWeight: 600,
          cursor: acceptAllDisabled ? 'not-allowed' : 'pointer',
          boxShadow: acceptAllDisabled ? 'none' : tokens.shadow.brand,
          flexShrink: 0,
        }}
      >
        一键全部接受 ({remainingPending.length})
      </button>
    </div>
  );
}
