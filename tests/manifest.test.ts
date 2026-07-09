import { describe, it, expect, beforeEach } from 'vitest';
import { buildManifest } from '@/steps/Step5Export/manifest';
import { getDataset, loadRealDataset } from '@/data';

describe('buildManifest', () => {
  beforeEach(async () => {
    // global setup mocks fetch + video; prime the cache.
    if (!getDatasetOrUndefined('jiazhengnvhuang_13')) {
      await loadRealDataset('jiazhengnvhuang_13');
    }
  });

  it('contains all required fields', () => {
    const ds = getDataset('jiazhengnvhuang_13');
    const m = buildManifest({
      dataset: ds,
      format: 'native',
      exportedAt: 1718700000000,
      statistics: { total: 47, point: 30, range: 17, with_region: 5 },
      files: ['annotations/native.json', 'frames/00003333.jpg'],
    });
    expect(m.dataset_id).toBe('jiazhengnvhuang_13');
    expect(m.format).toBe('native');
    expect(m.statistics.total).toBe(47);
    expect(m.exported_at_iso).toMatch(/^\d{4}-/);
    expect(m.files.length).toBe(2);
    expect(m.metadata.width).toBe(1920);
  });
});

function getDatasetOrUndefined(id: 'jiazhengnvhuang_13') {
  try {
    return getDataset(id);
  } catch {
    return undefined;
  }
}
