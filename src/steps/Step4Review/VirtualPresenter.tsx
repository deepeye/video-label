import { useEffect, useRef } from 'react';
import { useDemoStore } from '../../store/demoStore';
import { getDataset } from '../../data';
import { Timeline } from '../../lib/animation/timeline';

const T = {
  selectFirst: 0,
  acceptFirst: 1500,
  selectSecond: 1500,
  correctSecond: 3500,
  selectThird: 3500,
  rejectThird: 5500,
  acceptAll: 6500,
  goNext: 7500,
};

/**
 * Step 4 自动模式下的虚拟主讲。
 *
 * 行为:
 *   - 进入 Step 4 + playMode==='auto' + !paused → 启动时间线
 *   - playMode→manual / 步骤离开 → 取消
 *   - 三个 review_focus_ids 各演一种动作 (顺序按 review_focus_ids[0/1/2])
 *     [0] 接受
 *     [1] 改框 (收紧 ~15%)
 *     [2] 否决
 *
 * 副样例 (focusIds.length === 2) 用简化节奏: [0] 接受, [1] 否决, 跳过改框。
 */
export function VirtualPresenter() {
  const playMode = useDemoStore((s) => s.playMode);
  const paused = useDemoStore((s) => s.paused);
  const demoStep = useDemoStore((s) => s.demoStep);
  const speed = useDemoStore((s) => s.speed);
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const tlRef = useRef<Timeline | null>(null);

  useEffect(() => {
    if (demoStep !== 4 || playMode !== 'auto') {
      tlRef.current?.cancel();
      tlRef.current = null;
      return;
    }
    if (paused) {
      // 简化: 暂停就 cancel, resume 时重新启动 (Day 6 Task 6.6 决策)
      tlRef.current?.cancel();
      tlRef.current = null;
      return;
    }
    if (tlRef.current?.isRunning) {
      return;
    }

    const dataset = getDataset(datasetId);
    const focusIds = dataset.demo_script.review_focus_ids;

    const tl = new Timeline();
    if (focusIds.length >= 3) {
      // 主样例: 三动作各演一遍
      tl.schedule(T.selectFirst, () => useDemoStore.getState().selectTrack(focusIds[0]!));
      tl.schedule(T.acceptFirst, () => useDemoStore.getState().acceptBox(focusIds[0]!));
      tl.schedule(T.selectSecond, () => useDemoStore.getState().selectTrack(focusIds[1]!));
      tl.schedule(T.correctSecond, () => correctTighten(focusIds[1]!));
      tl.schedule(T.selectThird, () => useDemoStore.getState().selectTrack(focusIds[2]!));
      tl.schedule(T.rejectThird, () => useDemoStore.getState().rejectBox(focusIds[2]!));
      tl.schedule(T.acceptAll, () => useDemoStore.getState().acceptAllRemaining());
      tl.schedule(T.goNext, () => {
        useDemoStore.getState().selectTrack(null);
        useDemoStore.getState().goToStep(5);
      });
    } else {
      // 副样例 (2 个 focus): [0] 接受 + [1] 否决 + 一键剩余 + 跳 step 5
      tl.schedule(0, () => useDemoStore.getState().selectTrack(focusIds[0]!));
      tl.schedule(1500, () => useDemoStore.getState().acceptBox(focusIds[0]!));
      tl.schedule(1500, () => useDemoStore.getState().selectTrack(focusIds[1]!));
      tl.schedule(3500, () => useDemoStore.getState().rejectBox(focusIds[1]!));
      tl.schedule(4500, () => useDemoStore.getState().acceptAllRemaining());
      tl.schedule(5500, () => {
        useDemoStore.getState().selectTrack(null);
        useDemoStore.getState().goToStep(5);
      });
    }

    tlRef.current = tl;
    tl.start(speed);

    return () => {
      tl.cancel();
      tlRef.current = null;
    };
  }, [demoStep, playMode, paused, speed, datasetId]);

  return null;
}

function correctTighten(trackId: string) {
  const store = useDemoStore.getState();
  const ann = store.annotations.find((a) => a.track_id === trackId);
  if (!ann) return;
  // 取该 ann 第一个关键帧, 收紧 ~15%
  const kf0 = ann.keyframes[0]!;
  const [x, y, w, h] = kf0.geometry.coords;
  const newW = Math.round(w * 0.85);
  const newH = Math.round(h * 0.85);
  const newX = Math.round(x + (w - newW) / 2);
  const newY = Math.round(y + (h - newH) / 2);
  store.correctBoxGeometry(trackId, 0, [newX, newY, newW, newH]);
}
