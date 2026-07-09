import { useDemoStore } from '../store/demoStore';
import { tokens } from '../styles/tokens';
import type { DemoStep } from '../types';

const STEPS: { id: DemoStep; label: string }[] = [
  { id: 1, label: '①上传' },
  { id: 2, label: '②元信息' },
  { id: 3, label: '③分镜' },
  { id: 4, label: '④审核' },
  { id: 5, label: '⑤导出' },
];

export function StepPills() {
  const current = useDemoStore((s) => s.demoStep);
  const goToStep = useDemoStore((s) => s.goToStep);

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: tokens.space[2] }}
      data-testid="step-pills"
    >
      {STEPS.map((step, idx) => {
        const isCurrent = step.id === current;
        const isCompleted = step.id < current;

        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: tokens.space[2] }}>
            <button
              type="button"
              data-testid={`step-pill-${step.id}`}
              data-state={isCurrent ? 'current' : isCompleted ? 'completed' : 'future'}
              onClick={() => goToStep(step.id)}
              style={{
                padding: '6px 14px',
                borderRadius: tokens.radius.full,
                border: 'none',
                fontSize: 12,
                fontWeight: isCurrent ? 600 : 500,
                color: isCurrent ? '#fff' : isCompleted ? tokens.color.neutral[700] : tokens.color.neutral[400],
                background: isCurrent ? tokens.brandGradient : tokens.color.neutral[100],
                boxShadow: isCurrent ? tokens.shadow.brand : 'none',
                userSelect: 'none',
                cursor: 'pointer',
              }}
            >
              {step.label}
              {isCompleted && <span style={{ marginLeft: 4, color: tokens.color.success[500] }}>✓</span>}
            </button>
            {idx < STEPS.length - 1 && (
              <span style={{ color: tokens.color.neutral[200], fontSize: 14 }}>→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
