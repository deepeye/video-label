import type { Annotation, BBox, Geometry, Keyframe, Point } from '../types';

/**
 * 在关键帧序列中线性插值出某时间戳处的 bbox 坐标。
 *
 * - t ≤ first.timestamp: 返回 first.coords
 * - t ≥ last.timestamp:  返回 last.coords
 * - 在 (kf[i], kf[i+1]) 之间: 线性插值
 *
 * keyframes 必须按 timestamp_ms 升序。
 * 仅对 geometry.type === 'bbox' 的关键帧进行插值。
 */
export function interpolateBox(keyframes: Keyframe[], t: number): BBox {
  const bboxKfs = keyframes.filter((k): k is Keyframe & { geometry: { type: 'bbox'; coords: BBox } } => k.geometry.type === 'bbox');
  if (bboxKfs.length === 0) throw new Error('interpolateBox: no bbox keyframes');

  const first = bboxKfs[0]!;
  const last = bboxKfs[bboxKfs.length - 1]!;
  if (t <= first.timestamp_ms) return [...first.geometry.coords] as BBox;
  if (t >= last.timestamp_ms) return [...last.geometry.coords] as BBox;

  for (let i = 0; i < bboxKfs.length - 1; i++) {
    const a = bboxKfs[i]!;
    const b = bboxKfs[i + 1]!;
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
  return [...last.geometry.coords] as BBox;
}

/**
 * 在给定时间戳下获取应显示的几何图形。
 * bbox: 返回插值或最近关键帧的 bbox
 * polygon: 只在当前帧精确匹配 polygon 关键帧时才返回该轮廓;
 *   否则返回 null（不对多边形做跨关键帧插值）
 *   添加近 50ms 公差应对帧提前情形。
 */
export function getVisibleGeometryAtTime(
  keyframes: Keyframe[],
  t: number,
): { geometry: Geometry; isExactKeyframe: boolean } | null {
  const TOLERANCE_MS = 50;

  // 先找是否命中 polygon 关键帧
  const exactPoly = keyframes.find(
    (k) => k.geometry.type === 'polygon' && Math.abs(k.timestamp_ms - t) <= TOLERANCE_MS,
  );
  if (exactPoly) {
    return { geometry: exactPoly.geometry, isExactKeyframe: true };
  }

  // bbox 依然做插值
  const bboxKfs = keyframes.filter((k) => k.geometry.type === 'bbox');
  if (bboxKfs.length > 0) {
    return { geometry: { type: 'bbox', coords: interpolateBox(bboxKfs, t) }, isExactKeyframe: false };
  }

  return null;
}

/**
 * 查找当前时间戳命中的关键帧（精确匹配，50ms 公差）。
 */
export function findKeyframeAtTime(keyframes: Keyframe[], t: number): Keyframe | null {
  const TOLERANCE_MS = 50;
  const match = keyframes.find((k) => Math.abs(k.timestamp_ms - t) <= TOLERANCE_MS);
  return match ?? null;
}

/**
 * 计算 polygon 的外接矩形 (bbox)。
 */
export function polygonBounds(points: Point[]): BBox {
  if (points.length === 0) return [0, 0, 0, 0];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [Math.round(minX), Math.round(minY), Math.round(maxX - minX), Math.round(maxY - minY)];
}

/**
 * 计算任意 geometry 的外接矩形。
 */
export function geometryToBBox(g: Geometry): BBox {
  if (g.type === 'bbox') return [...g.coords] as BBox;
  return polygonBounds(g.points);
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
