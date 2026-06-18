import { describe, it, expect } from 'vitest';
import { defaultDatasets, defaultDatasetId, getDataset } from '@/data';

describe('dataset registry', () => {
  it('loads city-road and passes zod validation', () => {
    const ds = getDataset('city-road');
    expect(ds.dataset_id).toBe('city-road');
    expect(ds.annotations.length).toBe(47);
    expect(ds.demo_script.review_focus_ids).toEqual(['trk_2', 'trk_9', 'trk_5']);
  });

  it('default dataset id matches', () => {
    expect(defaultDatasetId).toBe('city-road');
    expect(defaultDatasets[defaultDatasetId]).toBeDefined();
  });

  it('all 3 focus items exist in annotations', () => {
    const ds = getDataset('city-road');
    const ids = ds.annotations.map(a => a.track_id);
    expect(ids).toContain('trk_2');
    expect(ids).toContain('trk_9');
    expect(ids).toContain('trk_5');
  });

  it('focus items have low confidence', () => {
    const ds = getDataset('city-road');
    const focus = ds.annotations.filter(a =>
      ds.demo_script.review_focus_ids.includes(a.track_id),
    );
    focus.forEach(a => expect(a.confidence).toBeLessThan(0.5));
  });
});
