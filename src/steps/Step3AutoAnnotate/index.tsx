import { useState } from 'react';
import { useDemoStore } from '../../store/demoStore';
import { getDataset } from '../../data';
import { tokens } from '../../styles/tokens';
import { InferenceProgress } from './InferenceProgress';
import { BoxRevealCanvas } from './BoxRevealCanvas';

export function Step3AutoAnnotate() {
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const speed = useDemoStore((s) => s.speed);
  const dataset = getDataset(datasetId);
  const focusCount = dataset.demo_script.review_focus_ids.length;

  const [revealDone, setRevealDone] = useState(false);

  const handleComplete = () => {
    setRevealDone(true);
  };

  return (
    <div
      data-testid="step3-autoannotate"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: tokens.space[5],
        gap: tokens.space[4],
      }}
    >
      <h2 style={{ margin: 0, fontSize: 28, fontWeight: 600, color: tokens.color.neutral[900] }}>
        ③ 自动标注
      </h2>

      <InferenceProgress
        totalObjects={dataset.annotations.length}
        focusCount={focusCount}
        speed={speed}
      />

      <div
        style={{
          flex: 1,
          background: tokens.color.neutral[900],
          borderRadius: tokens.radius.md,
          overflow: 'hidden',
          minHeight: 320,
        }}
      >
        <BoxRevealCanvas speed={speed} onComplete={handleComplete} />
      </div>

      {revealDone && (
        <div
          data-testid="step3-summary"
          style={{
            padding: tokens.space[3],
            borderRadius: tokens.radius.md,
            background: tokens.color.neutral[0],
            border: `1px solid ${tokens.color.neutral[200]}`,
            fontSize: 13,
            color: tokens.color.neutral[700],
          }}
        >
          共 {dataset.annotations.length} 对象, {focusCount} 个需重点审核 → 即将进入审核
        </div>
      )}
    </div>
  );
}
