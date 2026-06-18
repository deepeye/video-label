import { tokens } from '../styles/tokens';
import { StepPills } from './StepPills';
import { DemoControls } from './DemoControls';

export function TopBar() {
  return (
    <header
      data-testid="top-bar"
      style={{
        height: 56,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${tokens.space[5]}px`,
        background: tokens.color.neutral[0],
        borderBottom: `1px solid ${tokens.color.neutral[200]}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.space[2],
          color: tokens.color.brand[500],
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        <span>◆</span>
        <span>Frameworks Demo</span>
      </div>
      <StepPills />
      <DemoControls />
    </header>
  );
}
