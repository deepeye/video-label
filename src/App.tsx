import { tokens } from './styles/tokens';

export default function App() {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: tokens.color.neutral[50],
      }}
    >
      <div
        style={{
          padding: tokens.space[6],
          background: tokens.color.neutral[0],
          borderRadius: tokens.radius.lg,
          boxShadow: tokens.shadow.sm,
          textAlign: 'center',
        }}
      >
        <h1 style={{ margin: 0, color: tokens.color.neutral[900] }}>
          视频语料标注 Demo
        </h1>
        <p style={{ marginTop: tokens.space[2], color: tokens.color.neutral[500] }}>
          骨架已就绪 · Day 1 占位
        </p>
      </div>
    </div>
  );
}
