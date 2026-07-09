import type { Annotation } from '../../types';

export interface Category {
  id: number;          // 1-indexed (COCO 习惯)
  name: string;        // label_id, 用于 COCO 标准
  display: string;     // label_display, 中文展示
}

/**
 * 从 annotations 抽取唯一 category, 按 label_id 字典序排序。
 * 排序保证导出确定性 (相同输入永远相同输出)。
 */
export function extractCategories(annotations: Annotation[]): Category[] {
  const map = new Map<string, string>();
  for (const a of annotations) {
    if (!map.has(a.label_id)) {
      map.set(a.label_id, a.label_display);
    }
  }
  const sorted = [...map.keys()].sort();
  return sorted.map((label_id, idx) => ({
    id: idx + 1,
    name: label_id,
    display: map.get(label_id)!,
  }));
}

/**
 * 反向: label_id → category_id。给 COCO-Video 序列化用。
 */
export function buildCategoryMap(annotations: Annotation[]): Record<string, number> {
  const cats = extractCategories(annotations);
  const out: Record<string, number> = {};
  for (const c of cats) {
    out[c.name] = c.id;
  }
  return out;
}
