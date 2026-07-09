import { test, expect } from '@playwright/test';

test.describe('performance hard lines (PRD §10)', () => {
  test('first contentful paint < 2s', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="top-bar"]');
    const fcp = await page.evaluate(() => {
      const entries = performance.getEntriesByType('paint');
      const e = entries.find((x) => x.name === 'first-contentful-paint');
      return e ? e.startTime : -1;
    });
    expect(fcp).toBeGreaterThan(0);
    expect(fcp).toBeLessThan(2000);
  });

  test('export packaging < 1.5s (P95 estimate)', async ({ page }) => {
    await page.goto('/?step=4&speed=instant');
    await page.waitForSelector('[data-testid="step4-review"]');

    await page.getByRole('button', { name: '新增事件' }).click();
    await expect(page.locator('[data-testid^="event-row-"]')).toHaveCount(1);

    await page.evaluate(() => {
      type W = typeof window & {
        __demoStore?: { getState: () => { goToStep: (n: 5) => void } };
      };
      const s = (window as W).__demoStore!.getState();
      s.goToStep(5);
    });
    await page.waitForSelector('[data-testid="step5-export"]');

    const t0 = Date.now();
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="download-btn"]');
    await downloadPromise;
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(1500);
  });

  test('reset < 300ms (E2E real DOM)', async ({ page }) => {
    await page.goto('/?step=4&speed=instant');
    await page.waitForSelector('[data-testid="step4-review"]');

    await page.getByRole('button', { name: '新增事件' }).click();
    await expect(page.locator('[data-testid^="event-row-"]')).toHaveCount(1);

    page.on('dialog', (d) => d.accept());

    const t0 = Date.now();
    await page.click('[data-testid="btn-reset"]');
    await page.waitForSelector('[data-testid="step1-upload"]');
    const elapsed = Date.now() - t0;
    // E2E 中 dialog accept + DOM 重渲染 + Konva 销毁 重建会比单测 200ms 慢一些, 给 300ms 余量
    expect(elapsed).toBeLessThan(300);
  });
});
