import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Timeline } from '@/lib/animation/timeline';

describe('Timeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires scheduled callbacks in order at correct times (1x speed)', () => {
    const tl = new Timeline();
    const log: string[] = [];
    tl.schedule(0, () => log.push('a'));
    tl.schedule(100, () => log.push('b'));
    tl.schedule(300, () => log.push('c'));
    tl.start('1x');

    vi.advanceTimersByTime(0);
    expect(log).toEqual(['a']);
    vi.advanceTimersByTime(100);
    expect(log).toEqual(['a', 'b']);
    vi.advanceTimersByTime(200);
    expect(log).toEqual(['a', 'b', 'c']);
  });

  it('compresses time at 2x speed', () => {
    const tl = new Timeline();
    const log: string[] = [];
    tl.schedule(100, () => log.push('a'));
    tl.schedule(200, () => log.push('b'));
    tl.start('2x');

    vi.advanceTimersByTime(50);  // 2x → 100ms 实际 50ms 触发
    expect(log).toEqual(['a']);
    vi.advanceTimersByTime(50);  // 又 50ms → 200ms 实际 100ms 触发
    expect(log).toEqual(['a', 'b']);
  });

  it('instant speed fires all immediately', () => {
    const tl = new Timeline();
    const log: string[] = [];
    tl.schedule(100, () => log.push('a'));
    tl.schedule(500, () => log.push('b'));
    tl.start('instant');

    // 不需要推进时间, 同步触发
    expect(log).toEqual(['a', 'b']);
  });

  it('pause / resume preserves remaining time', () => {
    const tl = new Timeline();
    const log: string[] = [];
    tl.schedule(100, () => log.push('a'));
    tl.start('1x');

    vi.advanceTimersByTime(50);
    tl.pause();
    vi.advanceTimersByTime(200); // 暂停期间不该触发
    expect(log).toEqual([]);

    tl.resume();
    vi.advanceTimersByTime(50);  // 剩余 50ms
    expect(log).toEqual(['a']);
  });

  it('cancel stops further callbacks', () => {
    const tl = new Timeline();
    const log: string[] = [];
    tl.schedule(100, () => log.push('a'));
    tl.start('1x');
    tl.cancel();
    vi.advanceTimersByTime(500);
    expect(log).toEqual([]);
  });

  it('jumpToEnd fires all remaining callbacks immediately', () => {
    const tl = new Timeline();
    const log: string[] = [];
    tl.schedule(100, () => log.push('a'));
    tl.schedule(500, () => log.push('b'));
    tl.start('1x');

    vi.advanceTimersByTime(100);
    expect(log).toEqual(['a']);

    tl.jumpToEnd();
    expect(log).toEqual(['a', 'b']);
  });

  it('does not fire callbacks already triggered when jumpToEnd called', () => {
    const tl = new Timeline();
    const log: string[] = [];
    tl.schedule(100, () => log.push('a'));
    tl.start('1x');
    vi.advanceTimersByTime(100);
    expect(log).toEqual(['a']);
    tl.jumpToEnd();
    expect(log).toEqual(['a']);  // 'a' 不重复
  });
});
