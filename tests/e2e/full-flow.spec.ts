import { test, expect } from '@playwright/test';
import { unzipDownload } from './helpers';

test.describe('full flow: timestamping → export zip reflects event-based stats', () => {
  test('manual full flow: sample → step2 → step3 → step4 → step5 export', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="sample-card-city-road"]');

    await page.click('[data-testid="sample-card-city-road"]');
    await page.waitForSelector('[data-testid="step2-metadata"]');
    await page.waitForTimeout(1500);
    await expect(page.locator('[data-testid="step-view-2"]')).toBeVisible();

    await page.click('[data-testid="btn-next"]');
    await page.waitForSelector('[data-testid="step3-autoannotate"]');
    await page.waitForTimeout(2500);
    await expect(page.locator('[data-testid="step-view-3"]')).toBeVisible();

    await page.click('[data-testid="btn-next"]');
    await page.waitForSelector('[data-testid="step4-review"]');
    await expect(page.locator('[data-testid="btn-next"]')).toBeDisabled();

    await page.getByRole('button', { name: '新增事件' }).click();
    await expect(page.locator('[data-testid^="event-row-"]')).toHaveCount(1);

    await page.getByLabel('事件类型').selectOption('sudden_brake');
    await page.getByLabel('严重程度').selectOption('high');
    await page.getByLabel('标签').fill('风险, 夜间');
    await page.getByLabel('描述').fill('夜间车辆急刹，需要人工复核。');
    await page.getByLabel('时间(ms)').fill('4200');

    await expect(page.locator('[data-testid="btn-next"]')).toBeEnabled();
    await page.click('[data-testid="btn-next"]');
    await page.waitForSelector('[data-testid="step5-export"]');

    await expect(page.getByText('本次导出统计')).toBeVisible();
    await expect(page.getByText('总计')).toBeVisible();
    await expect(page.getByText('点事件')).toBeVisible();
    await expect(page.getByText('范围事件')).toBeVisible();
    await expect(page.getByText('带框事件')).toBeVisible();

    const preview = page.locator('[data-testid="json-preview"]');
    await expect(preview).toContainText('"events"');
    await expect(preview).toContainText('"eventType": "sudden_brake"');
    await expect(preview).toContainText('"timeMs": 4200');

    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="download-btn"]');
    const download = await downloadPromise;
    const zipPath = await download.path();
    expect(zipPath).toBeTruthy();

    const files = await unzipDownload(zipPath!);
    expect(files['manifest.json']).toBeDefined();
    expect(files['README.txt']).toBeDefined();
    expect(files['annotations/native.json']).toBeDefined();

    const native = JSON.parse(files['annotations/native.json']!);
    expect(native.version).toBe('2.0-demo');
    expect(native.dataset.dataset_id).toBe('city-road');
    expect(native.events).toHaveLength(1);
    expect(native.events[0]).toMatchObject({
      eventType: 'sudden_brake',
      severity: 'high',
      tags: ['风险', '夜间'],
      description: '夜间车辆急刹，需要人工复核。',
      mode: 'point',
      timeMs: 4200,
      startMs: null,
      endMs: null,
      regionBox: null,
      regionAnchorMs: null,
    });

    const manifest = JSON.parse(files['manifest.json']!);
    expect(manifest.statistics).toEqual({
      total: 1,
      point: 1,
      range: 0,
      with_region: 0,
    });
  });

  test('reset returns to step 1 and clears timestamp events', async ({ page }) => {
    await page.goto('/?step=4&speed=instant');
    await page.waitForSelector('[data-testid="step4-review"]');

    await page.getByRole('button', { name: '新增事件' }).click();
    await expect(page.locator('[data-testid^="event-row-"]')).toHaveCount(1);

    page.on('dialog', (d) => d.accept());
    await page.click('[data-testid="btn-reset"]');
    await page.waitForSelector('[data-testid="step-view-1"]');

    const state = await page.evaluate(() => {
      type W = typeof window & {
        __demoStore?: {
          getState: () => { activeDatasetId: string; demoStep: number; events: { id: string }[] };
        };
      };
      const s = (window as W).__demoStore?.getState();
      return {
        step: s?.demoStep,
        dataset: s?.activeDatasetId,
        eventCount: s?.events.length,
      };
    });

    expect(state.step).toBe(1);
    expect(state.dataset).toBe('city-road');
    expect(state.eventCount).toBe(0);
  });
});
