import { test, expect } from '@playwright/test';
import { unzipDownload } from './helpers';

test.describe('full flow: review → export zip reflects all changes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?step=4&speed=instant');
    await page.waitForSelector('[data-testid="step4-review"]');
  });

  test('A/D + correctBoxGeometry + accept-all → export zip native.json reflects all', async ({ page }) => {
    // 1. 选 trk_2 → A 接受
    await page.click('[data-testid="queue-card-trk_2"]');
    await page.keyboard.press('a');

    // 2. trk_9 改框 (走 store action 直接调用, 因为 Konva 拖框难自动化)
    await page.evaluate(() => {
      type W = typeof window & { __demoStore?: { getState: () => { correctBoxGeometry: (id: string, idx: number, c: [number, number, number, number]) => void } } };
      (window as W).__demoStore?.getState().correctBoxGeometry('trk_9', 0, [777, 888, 200, 100]);
    });

    // 3. 选 trk_5 → D 否决
    await page.click('[data-testid="queue-card-trk_5"]');
    await page.keyboard.press('d');

    // 4. 一键全部接受
    const acceptAllBtn = page.locator('[data-testid="accept-all-remaining"]');
    await expect(acceptAllBtn).toBeEnabled();
    await acceptAllBtn.click();

    // 5. 跳到 step 5
    await page.evaluate(() => {
      type W = typeof window & { __demoStore?: { getState: () => { goToStep: (n: 1 | 2 | 3 | 4 | 5) => void } } };
      (window as W).__demoStore?.getState().goToStep(5);
    });
    await page.waitForSelector('[data-testid="step5-export"]');

    // 6. 触发下载
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="download-btn"]');
    const download = await downloadPromise;
    const zipPath = await download.path();
    expect(zipPath).toBeTruthy();

    // 7. 解压 + 验证内容
    const files = await unzipDownload(zipPath!);
    expect(files['manifest.json']).toBeDefined();
    expect(files['README.txt']).toBeDefined();
    expect(files['annotations/native.json']).toBeDefined();

    const native = JSON.parse(files['annotations/native.json']!);
    expect(native.version).toBe('2.0-demo');
    expect(native.dataset.dataset_id).toBe('city-road');
    expect(native.annotations.length).toBe(47);

    const trk2 = native.annotations.find((a: { track_id: string }) => a.track_id === 'trk_2');
    const trk9 = native.annotations.find((a: { track_id: string }) => a.track_id === 'trk_9');
    const trk5 = native.annotations.find((a: { track_id: string }) => a.track_id === 'trk_5');

    expect(trk2.review.status).toBe('accepted');
    expect(trk9.review.status).toBe('corrected');
    expect(trk9.source).toBe('human');
    expect(trk9.keyframes[0].geometry.coords).toEqual([777, 888, 200, 100]);
    expect(trk5.review.status).toBe('rejected');

    // statistics
    const manifest = JSON.parse(files['manifest.json']!);
    expect(manifest.statistics.accepted + manifest.statistics.corrected + manifest.statistics.rejected).toBe(47);
    expect(manifest.statistics.pending).toBe(0);
  });

  test('reset returns to step 1 and preserves dataset', async ({ page }) => {
    await page.click('[data-testid="queue-card-trk_2"]');
    await page.keyboard.press('a');

    // 点重置, accept dialog
    page.on('dialog', (d) => d.accept());
    await page.click('[data-testid="btn-reset"]');

    // 等步骤切换
    await page.waitForSelector('[data-testid="step-view-1"]');

    // store 应该恢复
    const state = await page.evaluate(() => {
      type W = typeof window & { __demoStore?: { getState: () => { activeDatasetId: string; demoStep: number; annotations: { track_id: string; review: { status: string } }[] } } };
      const s = (window as W).__demoStore?.getState();
      const trk2 = s?.annotations.find((a) => a.track_id === 'trk_2');
      return {
        step: s?.demoStep,
        dataset: s?.activeDatasetId,
        trk2Status: trk2?.review.status,
      };
    });
    expect(state.step).toBe(1);
    expect(state.dataset).toBe('city-road');
    expect(state.trk2Status).toBe('pending');
  });

  test('next button disabled when focus items pending', async ({ page }) => {
    // step 4 时, 控制条上 ⏭ 应该置灰
    const nextBtn = page.locator('[data-testid="btn-next"]');
    await expect(nextBtn).toBeDisabled();
  });
});
