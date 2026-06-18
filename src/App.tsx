import { useEffect, useState } from 'react';
import { useDemoStore } from './store/demoStore';
import { TopBar } from './chrome/TopBar';
import { tokens } from './styles/tokens';
import type { DatasetId, DemoStep, Speed } from './types';
import { Step4Review } from './steps/Step4Review';
import { Step5Export } from './steps/Step5Export';

// dev 期把 store 暴露到 window.__demoStore 供 E2E 测试用 (生产不暴露)
if (import.meta.env.DEV) {
  type W = typeof window & { __demoStore?: typeof useDemoStore };
  (window as W).__demoStore = useDemoStore;
}

function StepPlaceholder({ step }: { step: number }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: tokens.space[2],
      }}
    >
      <h2 style={{ margin: 0, color: tokens.color.neutral[900] }}>步骤 {step}</h2>
      <p style={{ margin: 0, color: tokens.color.neutral[500] }}>占位 — 后续天数实现</p>
    </div>
  );
}

function useUrlParams() {
  const goToStep = useDemoStore((s) => s.goToStep);
  const setSpeed = useDemoStore((s) => s.setSpeed);
  const selectDataset = useDemoStore((s) => s.selectDataset);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const params = new URLSearchParams(window.location.search);
    const step = params.get('step');
    const speed = params.get('speed');
    const dataset = params.get('dataset');

    if (dataset && ['city-road', 'meeting-room', 'retail-cam'].includes(dataset)) {
      selectDataset(dataset as DatasetId);
    }
    if (speed && ['1x', '2x', 'instant'].includes(speed)) {
      setSpeed(speed as Speed);
    }
    if (step) {
      const n = Number(step);
      if (n >= 1 && n <= 5) goToStep(n as DemoStep);
    }
  }, [goToStep, setSpeed, selectDataset]);
}

function useNarrowGuard() {
  const [tooNarrow, setTooNarrow] = useState(false);
  useEffect(() => {
    const check = () => setTooNarrow(window.innerWidth < 1280);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return tooNarrow;
}

export default function App() {
  useUrlParams();
  const tooNarrow = useNarrowGuard();
  const demoStep = useDemoStore((s) => s.demoStep);

  if (tooNarrow) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: tokens.space[3],
          background: tokens.color.neutral[50],
          padding: tokens.space[6],
          textAlign: 'center',
        }}
      >
        <h2 style={{ margin: 0, color: tokens.color.neutral[900] }}>请使用宽屏（≥ 1280×720）演示</h2>
        <p style={{ margin: 0, color: tokens.color.neutral[500] }}>建议按 F11 切换全屏</p>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: tokens.color.neutral[50],
      }}
    >
      <TopBar />
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
        data-testid={`step-view-${demoStep}`}
      >
        {demoStep === 1 && <StepPlaceholder step={1} />}
        {demoStep === 2 && <StepPlaceholder step={2} />}
        {demoStep === 3 && <StepPlaceholder step={3} />}
        {demoStep === 4 && <Step4Review />}
        {demoStep === 5 && <Step5Export />}
      </main>
    </div>
  );
}
