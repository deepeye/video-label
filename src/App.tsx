import { useEffect } from 'react';
import { useDemoStore } from './store/demoStore';
import { TopBar } from './chrome/TopBar';
import { tokens } from './styles/tokens';
import type { DatasetId, DemoStep, Speed } from './types';
import { Step1Upload } from './steps/Step1Upload';
import { Step2Metadata } from './steps/Step2Metadata';
import { Step3Storyboard } from './steps/Step3Storyboard';
import { Step4Review } from './steps/Step4Review';
import { Step5Export } from './steps/Step5Export';

// dev 期把 store 暴露到 window.__demoStore 供 E2E 测试用 (生产不暴露)
if (import.meta.env.DEV) {
  type W = typeof window & { __demoStore?: typeof useDemoStore };
  (window as W).__demoStore = useDemoStore;
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

    if (dataset && [
      'jiazhengnvhuang_13',
      'jiazhengnvhuang_5',
      'meilihebeisegment_001_2',
      'mingyilaile_17-0',
      'mingyilaile_17-4',
    ].includes(dataset)) {
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

export default function App() {
  useUrlParams();
  const demoStep = useDemoStore((s) => s.demoStep);

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
        {demoStep === 1 && <Step1Upload />}
        {demoStep === 2 && <Step2Metadata />}
        {demoStep === 3 && <Step3Storyboard />}
        {demoStep === 4 && <Step4Review />}
        {demoStep === 5 && <Step5Export />}
      </main>
    </div>
  );
}
