/**
 * 跨步骤的自动演示编排策略。
 *
 * 设计取舍:
 *   - Step 1 (上传): 自动模式下 1.5s 后进 Step 2 (沿用当前 dataset)
 *   - Step 2 (元信息): 视图自身定时器跑完后自动 goToStep(3)
 *   - Step 3 (推理): 视图自身揭示完 + 1.5s 缓冲后 goToStep(4)
 *   - Step 4 (审核): 自动模式下进入时启动 VirtualPresenter
 *   - Step 5 (导出): 自动模式下不自动下载 (破坏性操作)
 *
 * orchestrator hook 真正主动做的事只有:
 *   playMode 从 manual → auto 时, 如果当前在 step 1, 1.5s 后自动进 step 2
 */

import { useEffect } from 'react';
import { useDemoStore } from '../../store/demoStore';
import { applySpeed } from './speed';

export function useDemoOrchestrator() {
  const playMode = useDemoStore((s) => s.playMode);
  const demoStep = useDemoStore((s) => s.demoStep);
  const speed = useDemoStore((s) => s.speed);
  const goToStep = useDemoStore((s) => s.goToStep);

  useEffect(() => {
    // 进入 auto + 当前在 step 1 → 1.5s 后自动进 step 2 (沿用当前 dataset)
    if (playMode === 'auto' && demoStep === 1) {
      const t = setTimeout(() => {
        // 重新读 store, 防止此期间用户已切回 manual
        const cur = useDemoStore.getState();
        if (cur.playMode === 'auto' && cur.demoStep === 1) {
          goToStep(2);
        }
      }, applySpeed(1500, speed));
      return () => clearTimeout(t);
    }
    return undefined;
  }, [playMode, demoStep, speed, goToStep]);
}
