import { describe, it, expect, beforeEach } from 'vitest';
import { useDemoStore } from '@/store/demoStore';
import { getDataset } from '@/data';

describe('demoStore', () => {
  beforeEach(() => {
    // 每个测试重置成初始 city-road 快照
    useDemoStore.getState().selectDataset('city-road');
  });

  // ── 编排状态机 ──────────────────────────────────────────
  it('initial state matches snapshot defaults', () => {
    const s = useDemoStore.getState();
    expect(s.demoStep).toBe(1);
    expect(s.speed).toBe('1x');
    expect(s.activeDatasetId).toBe('city-road');
    expect(s.annotations.length).toBe(47);
    expect(s.dirty).toBe(false);
  });

  it('goToStep updates demoStep', () => {
    useDemoStore.getState().goToStep(3);
    expect(useDemoStore.getState().demoStep).toBe(3);
  });

  it('setSpeed updates speed', () => {
    useDemoStore.getState().setSpeed('2x');
    expect(useDemoStore.getState().speed).toBe('2x');
  });

  // ── 重置（CLAUDE.md 第 3 条硬约束）─────────────────────
  it('reset deep-clones annotations, source data unaffected', () => {
    useDemoStore.getState().acceptBox('trk_2');
    expect(useDemoStore.getState().annotations.find(a => a.track_id === 'trk_2')!.review.status).toBe('accepted');

    useDemoStore.getState().reset();
    expect(useDemoStore.getState().annotations.find(a => a.track_id === 'trk_2')!.review.status).toBe('pending');

    // 关键: 源数据集没被污染
    const sourceDataset = getDataset('city-road');
    expect(sourceDataset.annotations.find(a => a.track_id === 'trk_2')!.review.status).toBe('pending');
  });

  it('reset preserves activeDatasetId and speed', () => {
    useDemoStore.getState().setSpeed('2x');
    useDemoStore.getState().acceptBox('trk_2');
    useDemoStore.getState().reset();
    expect(useDemoStore.getState().activeDatasetId).toBe('city-road');
    expect(useDemoStore.getState().speed).toBe('2x');
    expect(useDemoStore.getState().demoStep).toBe(1);
    expect(useDemoStore.getState().dirty).toBe(false);
  });

  it('reset clears undo stack', () => {
    useDemoStore.getState().acceptBox('trk_2');
    expect(useDemoStore.getState().undoStack.length).toBe(1);
    useDemoStore.getState().reset();
    expect(useDemoStore.getState().undoStack.length).toBe(0);
  });

  // ── 审核动作 ───────────────────────────────────────────
  it('acceptBox sets review.status to accepted and marks dirty', () => {
    useDemoStore.getState().acceptBox('trk_2');
    const s = useDemoStore.getState();
    const ann = s.annotations.find(a => a.track_id === 'trk_2')!;
    expect(ann.review.status).toBe('accepted');
    expect(ann.review.reviewed_at).not.toBeNull();
    expect(s.dirty).toBe(true);
  });

  it('rejectBox sets review.status to rejected', () => {
    useDemoStore.getState().rejectBox('trk_5');
    const ann = useDemoStore.getState().annotations.find(a => a.track_id === 'trk_5')!;
    expect(ann.review.status).toBe('rejected');
  });

  it('correctBoxGeometry updates coords, source becomes human, status corrected', () => {
    useDemoStore.getState().correctBoxGeometry('trk_9', 0, [100, 200, 300, 400]);
    const ann = useDemoStore.getState().annotations.find(a => a.track_id === 'trk_9')!;
    expect(ann.keyframes[0]!.geometry.coords).toEqual([100, 200, 300, 400]);
    expect(ann.source).toBe('human');
    expect(ann.review.status).toBe('corrected');
  });

  // ── 撤销 ──────────────────────────────────────────────
  it('undo reverts the last accept', () => {
    const before = useDemoStore.getState().annotations.find(a => a.track_id === 'trk_2')!.review.status;
    useDemoStore.getState().acceptBox('trk_2');
    useDemoStore.getState().undo();
    const after = useDemoStore.getState().annotations.find(a => a.track_id === 'trk_2')!.review.status;
    expect(after).toBe(before);
  });

  it('undo on empty stack is a no-op', () => {
    expect(() => useDemoStore.getState().undo()).not.toThrow();
  });

  it('acceptAllRemaining accepts all pending non-rejected non-corrected', () => {
    useDemoStore.getState().rejectBox('trk_5');           // 1 个拒绝
    useDemoStore.getState().acceptAllRemaining();
    const remaining = useDemoStore.getState().annotations.filter(a => a.review.status === 'pending');
    expect(remaining.length).toBe(0);
    const accepted = useDemoStore.getState().annotations.filter(a => a.review.status === 'accepted').length;
    expect(accepted).toBe(46); // 47 - 1 rejected
  });

  it('acceptAllRemaining does NOT push to undo stack (batch op)', () => {
    const before = useDemoStore.getState().undoStack.length;
    useDemoStore.getState().acceptAllRemaining();
    expect(useDemoStore.getState().undoStack.length).toBe(before);
  });

  // ── selectDataset ─────────────────────────────────────
  it('selectDataset replaces store with new snapshot', () => {
    useDemoStore.getState().acceptBox('trk_2');
    expect(useDemoStore.getState().dirty).toBe(true);

    useDemoStore.getState().selectDataset('city-road');  // 重新选同一个 = 重置
    expect(useDemoStore.getState().annotations.find(a => a.track_id === 'trk_2')!.review.status).toBe('pending');
    expect(useDemoStore.getState().dirty).toBe(false);
  });

  // ── canAdvanceFromStep4 (防呆 helper) ────────────────
  it('canAdvanceFromStep4 returns false when focus items have pending', () => {
    expect(useDemoStore.getState().canAdvanceFromStep4()).toBe(false);
  });

  it('canAdvanceFromStep4 returns true after all focus items reviewed', () => {
    useDemoStore.getState().acceptBox('trk_2');
    useDemoStore.getState().correctBoxGeometry('trk_9', 0, [100, 200, 300, 400]);
    useDemoStore.getState().rejectBox('trk_5');
    expect(useDemoStore.getState().canAdvanceFromStep4()).toBe(true);
  });
});

