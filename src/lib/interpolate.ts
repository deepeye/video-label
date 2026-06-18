import type { Annotation, BBox, Keyframe } from '../types';

/**
 * 在关键帧序列中线性插值出某时间戳处的 bbox 坐标。
 *
 * - t ≤ first.timestamp: 返回 first.coords
 * - t ≥ last.timestamp:  返回 last.coords
 * - 在 (kf[i], kf[i+1]) 之间: 线性插值
 *
 * keyframes 必须按 timestamp_ms 升序 (city-road-fixture 已保证)。
 */
export function interpolateBox(keyframes: Keyframe[], t: number): BBox {
  if (keyframes.length === 0) throw new Error('interpolateBox: empty keyframes');

  const first = keyframes[0]!;
  const last = keyframes[keyframes.length - 1]!;
  if (t <= first.timestamp_ms) return [...first.geometry.coords] as BBox;
  if (t >= last.timestamp_ms) return [...last.geometry.coords] as BBox;

  // 找到 t 所在的 segment [i, i+1]
  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i]!;
    const b = keyframes[i + 1]!;
    if (t >= a.timestamp_ms && t <= b.timestamp_ms) {
      const dur = b.timestamp_ms - a.timestamp_ms;
      const frac = dur === 0 ? 0 : (t - a.timestamp_ms) / dur;
      const [ax, ay, aw, ah] = a.geometry.coords;
      const [bx, by, bw, bh] = b.geometry.coords;
      return [
        Math.round(ax + (bx - ax) * frac),
        Math.round(ay + (by - ay) * frac),
        Math.round(aw + (bw - aw) * frac),
        Math.round(ah + (bh - ah) * frac),
      ];
    }
  }
  // 不应到达
  return [...last.geometry.coords] as BBox;
}

/**
 * 当前帧时间戳下应该显示的标注列表。
 *
 * 过滤规则:
 *   1. annotation 的 [firstKf, lastKf] 时间区间覆盖 t
 *   2. review.status !== 'rejected' (否决的框淡出消失)
 */
export function findVisibleAtTime(annotations: Annotation[], t: number): Annotation[] {
  return annotations.filter((a) => {
    if (a.review.status === 'rejected') return false;
    const first = a.keyframes[0]!.timestamp_ms;
    const last = a.keyframes[a.keyframes.length - 1]!.timestamp_ms;
    return t >= first && t <= last;
  });
}
