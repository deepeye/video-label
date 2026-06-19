import { test, expect } from '@playwright/test';

test.describe('auto mode + virtual presenter', () => {
  test('full auto run reaches step 5 with correct state', async ({ page }) => {
    await page.goto('/?step=1&speed=instant');
    await page.waitForSelector('[data-testid="step1-upload"]');

    // 启动自动演示
    await page.click('[data-testid="btn-play-pause"]');

    // instant 速度下整个流程在 ~2s 内跳完, 等到 step 5
    await page.waitForSelector('[data-testid="step5-export"]', { timeout: 15_000 });

    const state = await page.evaluate(() => {
      type W = typeof window & {
        __demoStore?: { getState: () => {
          demoStep: number;
          annotations: { track_id: string; review: { status: string }; source: string }[];
        } };
      };
      const s = (window as W).__demoStore!.getState();
      return {
        step: s.demoStep,
        trk2: s.annotations.find((a) => a.track_id === 'trk_2'),
        trk9: s.annotations.find((a) => a.track_id === 'trk_9'),
        trk5: s.annotations.find((a) => a.track_id === 'trk_5'),
        pending: s.annotations.filter((a) => a.review.status === 'pending').length,
      };
    });
    expect(state.step).toBe(5);
    expect(state.trk2!.review.status).toBe('accepted');
    expect(state.trk9!.review.status).toBe('corrected');
    expect(state.trk9!.source).toBe('human');
    expect(state.trk5!.review.status).toBe('rejected');
    expect(state.pending).toBe(0);
  });

  test('user click during auto switches to manual', async ({ page }) => {
    await page.goto('/?step=4&speed=1x');
    await page.waitForSelector('[data-testid="step4-review"]');
    await page.click('[data-testid="btn-play-pause"]');
    await page.waitForFunction(() => {
      type W = typeof window & { __demoStore?: { getState: () => { playMode: string } } };
      return (window as W).__demoStore?.getState().playMode === 'auto';
    });
    // 模拟客户点击画布空白处 (step4-review 容器)
    await page.click('[data-testid="step4-review"]');
    await page.waitForFunction(() => {
      type W = typeof window & { __demoStore?: { getState: () => { playMode: string } } };
      return (window as W).__demoStore?.getState().playMode === 'manual';
    });
  });

  test('control bar buttons do not trigger user takeover', async ({ page }) => {
    await page.goto('/?step=1&speed=1x');
    await page.click('[data-testid="btn-play-pause"]'); // manual → auto
    // 再点一次: auto + !paused → paused (仍是 auto)
    await page.click('[data-testid="btn-play-pause"]');
    const stateAfterPause = await page.evaluate(() => {
      type W = typeof window & { __demoStore?: { getState: () => { playMode: string; paused: boolean } } };
      return (window as W).__demoStore!.getState();
    });
    expect(stateAfterPause.playMode).toBe('auto');
    expect(stateAfterPause.paused).toBe(true);
  });
});
