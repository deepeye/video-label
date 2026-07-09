import { useDemoStore } from '../store/demoStore';
import { tokens } from '../styles/tokens';

export function DemoCrashScreen() {
  const handleReset = () => {
    try {
      useDemoStore.getState().reset();
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  return (
    <div
      data-testid="demo-crash-screen"
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: tokens.space[3],
        padding: tokens.space[6],
        background: tokens.color.neutral[50],
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 32 }}>🛟</div>
      <h2 style={{ margin: 0, color: tokens.color.neutral[900] }}>演示遇到了意外问题</h2>
      <p style={{ margin: 0, color: tokens.color.neutral[500], maxWidth: 360 }}>
        请刷新页面或重置 Demo 重新演示。
      </p>
      <div style={{ display: 'flex', gap: tokens.space[3], marginTop: tokens.space[3] }}>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: `${tokens.space[2]}px ${tokens.space[4]}px`,
            borderRadius: tokens.radius.md,
            background: 'transparent',
            backgroundImage: tokens.brandGradient,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            boxShadow: tokens.shadow.brand,
          }}
        >
          ↻ 刷新页面
        </button>
        <button
          onClick={handleReset}
          style={{
            padding: `${tokens.space[2]}px ${tokens.space[4]}px`,
            borderRadius: tokens.radius.md,
            background: tokens.color.neutral[0],
            color: tokens.color.neutral[700],
            fontSize: 13,
            fontWeight: 600,
            border: `1px solid ${tokens.color.neutral[200]}`,
            cursor: 'pointer',
          }}
        >
          ↺ 重置 Demo
        </button>
      </div>
    </div>
  );
}
