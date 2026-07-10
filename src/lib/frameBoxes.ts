import type { Dataset, FrameBox, FrameBoxesOverlay, FrameEntry, FrameTextEdit } from '../types';
import { deepClone } from './deepClone';

/**
 * 给定视频 currentTimeMs，返回 overlay.frames 中最近的 FrameEntry。
 * overlay 缺失或 frames 为空时返回 null。
 * frames 必须按 frame_index 升序排列。
 */
export function findFrameAt(
  overlay: FrameBoxesOverlay | undefined,
  currentTimeMs: number,
): FrameEntry | null {
  if (!overlay || overlay.frames.length === 0) {
    return null;
  }
  const fps = overlay.fps;
  if (fps <= 0) {
    return null;
  }
  const targetFrameIndex = (currentTimeMs / 1000) * fps;
  const arr = overlay.frames;
  if (targetFrameIndex <= arr[0]!.frame_index) {
    return arr[0]!;
  }
  const last = arr[arr.length - 1]!;
  if (targetFrameIndex >= last.frame_index) {
    return last;
  }
  let lo = 1;
  let hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid]!.frame_index < targetFrameIndex) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  const candidate = arr[lo]!;
  const prev = arr[lo - 1]!;
  return Math.abs(candidate.frame_index - targetFrameIndex) <=
    Math.abs(prev.frame_index - targetFrameIndex)
    ? candidate
    : prev;
}

/**
 * 把 parts（OCR 四角）转换为轴对齐的 text FrameBox，
 * 再与原 boxes（person/logo）合并返回。
 */
export function visibleBoxes(frame: FrameEntry): FrameBox[] {
  const textBoxes: FrameBox[] = frame.parts.map((p) => ({
    label: 'text',
    text: p.text,
    probability: 1,
    box: quadToBox(p.box),
  }));
  return [...textBoxes, ...frame.boxes];
}

/**
 * 四角点转轴对齐包围盒 [x, y, w, h]。
 */
export function quadToBox(quad: Array<[number, number]>): [number, number, number, number] {
  const xs = quad.map((p) => p[0]);
  const ys = quad.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const w = Math.max(...xs) - x;
  const h = Math.max(...ys) - y;
  return [x, y, w, h];
}

/**
 * 深拷贝 dataset.frame_boxes，并把 frameTextEdits 覆盖到对应 parts[].text。
 * dataset.frame_boxes 不存在时返回 undefined。不修改入参 dataset。
 */
export function mergeFrameTextOverrides(
  dataset: Dataset,
  edits: FrameTextEdit[],
): FrameBoxesOverlay | undefined {
  if (!dataset.frame_boxes) return undefined;
  const overlay = deepClone(dataset.frame_boxes);
  for (const edit of edits) {
    const frame = overlay.frames.find((f) => f.frame_index === edit.frame_index);
    const part = frame?.parts.find((p) => p.part_id === edit.part_id);
    if (part) part.text = edit.text;
  }
  return overlay;
}
