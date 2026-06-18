import { useEffect } from 'react';
import { useDemoStore } from '../../store/demoStore';
import { getDataset } from '../../data';

/**
 * Step 4 审核步骤的键盘快捷键。
 *
 * - A: 接受当前选中框
 * - D: 否决当前选中框
 * - Ctrl/Cmd+Z: 撤销
 * - ←: 上一重点项
 * - →: 下一重点项
 */
export function useReviewKeyboard() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 输入框/select 内不响应 (避免与文本编辑冲突)
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      const store = useDemoStore.getState();
      if (store.demoStep !== 4) return; // 只在 Step 4 生效

      const focusIds = getDataset(store.activeDatasetId).demo_script.review_focus_ids;

      // Ctrl/Cmd+Z 撤销
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        store.undo();
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'a': {
          if (store.selectedTrackId) {
            e.preventDefault();
            store.acceptBox(store.selectedTrackId);
            // 自动选中下一个 pending 重点项
            advanceToNextFocus(focusIds);
          }
          break;
        }
        case 'd': {
          if (store.selectedTrackId) {
            e.preventDefault();
            store.rejectBox(store.selectedTrackId);
            advanceToNextFocus(focusIds);
          }
          break;
        }
        case 'arrowleft': {
          e.preventDefault();
          const newIdx = Math.max(0, store.reviewQueueIndex - 1);
          store.setReviewQueueIndex(newIdx);
          const id = focusIds[newIdx];
          if (id) store.selectTrack(id);
          break;
        }
        case 'arrowright': {
          e.preventDefault();
          const newIdx = Math.min(focusIds.length - 1, store.reviewQueueIndex + 1);
          store.setReviewQueueIndex(newIdx);
          const id = focusIds[newIdx];
          if (id) store.selectTrack(id);
          break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}

function advanceToNextFocus(focusIds: string[]) {
  const store = useDemoStore.getState();
  // 从当前 reviewQueueIndex 之后找第一个仍 pending 的 focus
  const annotations = store.annotations;
  for (let i = store.reviewQueueIndex + 1; i < focusIds.length; i++) {
    const id = focusIds[i]!;
    const ann = annotations.find((a) => a.track_id === id);
    if (ann && ann.review.status === 'pending') {
      store.setReviewQueueIndex(i);
      store.selectTrack(id);
      return;
    }
  }
  // 全部裁决完 → 取消选中
  store.selectTrack(null);
}
