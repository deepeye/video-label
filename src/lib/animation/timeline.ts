import type { Speed } from '../../types';
import { applySpeed } from './speed';

interface ScheduledStep {
  at: number;        // 原始时间 (1x 下 ms)
  fn: () => void;
  fired: boolean;
}

export class Timeline {
  private steps: ScheduledStep[] = [];
  private speed: Speed = '1x';
  private timers = new Map<number, ReturnType<typeof setTimeout>>();
  private startedAt = 0;
  private elapsed = 0;       // pause 之前累计经过的真实毫秒
  private state: 'idle' | 'running' | 'paused' | 'cancelled' = 'idle';

  schedule(at: number, fn: () => void): this {
    this.steps.push({ at, fn, fired: false });
    return this;
  }

  start(speed: Speed): this {
    this.speed = speed;
    this.state = 'running';
    this.startedAt = Date.now();
    this.elapsed = 0;

    if (speed === 'instant') {
      // 同步触发所有未触发的回调
      for (const s of this.steps) {
        if (!s.fired) {
          s.fired = true;
          s.fn();
        }
      }
      this.state = 'idle';
      return this;
    }

    for (let i = 0; i < this.steps.length; i++) {
      this.scheduleStep(i, this.steps[i]!.at);
    }
    return this;
  }

  private scheduleStep(idx: number, scaledAt: number) {
    const realDelay = applySpeed(scaledAt, this.speed);
    const timer = setTimeout(() => {
      const s = this.steps[idx];
      if (!s || s.fired || this.state === 'cancelled') return;
      s.fired = true;
      s.fn();
      this.timers.delete(idx);
    }, realDelay);
    this.timers.set(idx, timer);
  }

  pause(): void {
    if (this.state !== 'running') return;
    this.state = 'paused';
    const now = Date.now();
    this.elapsed += now - this.startedAt;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this.startedAt = Date.now();
    // 重新调度未触发的步骤, 减去已经经过的时间 (转回 1x 时间轴)
    const elapsedScaled = this.elapsed / (this.speed === '2x' ? 0.5 : 1);
    for (let i = 0; i < this.steps.length; i++) {
      const s = this.steps[i]!;
      if (s.fired) continue;
      const remaining = Math.max(0, s.at - elapsedScaled);
      this.scheduleStep(i, remaining);
    }
  }

  cancel(): void {
    this.state = 'cancelled';
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  jumpToEnd(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    for (const s of this.steps) {
      if (!s.fired) {
        s.fired = true;
        s.fn();
      }
    }
    this.state = 'idle';
  }

  get isRunning(): boolean {
    return this.state === 'running';
  }
}
