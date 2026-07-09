import { describe, it, expect } from 'vitest';
import { buildManifest } from '@/steps/Step5Export/manifest';
import { getDataset } from '@/data';

describe('buildManifest', () => {
  it('contains all required fields', () => {
    const ds = getDataset('city-road');
    const m = buildManifest({
      dataset: ds,
      format: 'native',
      exportedAt: 1718700000000,
      statistics: { total: 47, point: 30, range: 17, with_region: 5 },
      files: ['annotations/native.json', 'frames/00003333.jpg'],
    });
    expect(m.dataset_id).toBe('city-road');
    expect(m.display).toBe('城市道路样例');
    expect(m.note).toContain('演示数据集');
    expect(m.format).toBe('native');
    expect(m.statistics.total).toBe(47);
    expect(m.exported_at_iso).toMatch(/^\d{4}-/);
    expect(m.files.length).toBe(2);
    expect(m.metadata.width).toBe(1920);
  });
});
