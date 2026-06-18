import type { Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * 解压 Playwright 下载的 zip, 返回 {filename: string}
 *
 * 用系统 unzip 命令而非 JSZip — 因为 jszip 的 base64 子模块在 Playwright
 * test runner 的 ESM 加载下会抛 "Unexpected module status 3" 错误。
 * 系统自带 unzip (macOS / Linux); Windows 用 PowerShell Expand-Archive (fallback)。
 */
export async function unzipDownload(zipPath: string): Promise<Record<string, string>> {
  const tmpDir = mkdtempSync(join(tmpdir(), 'video-label-e2e-'));
  try {
    // 优先用系统 unzip
    try {
      execSync(`unzip -q "${zipPath}" -d "${tmpDir}"`, { stdio: 'pipe' });
    } catch {
      // Windows fallback: PowerShell
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tmpDir}' -Force"`, { stdio: 'pipe' });
    }

    const out: Record<string, string> = {};
    function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.name.endsWith('.json') || entry.name.endsWith('.txt')) {
          // 相对路径 key (相对 tmpDir)
          const rel = full.slice(tmpDir.length + 1);
          out[rel] = readFileSync(full, 'utf-8');
        }
      }
    }
    walk(tmpDir);
    return out;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * 等 App 启动完成 (TopBar 渲染)
 */
export async function exposeStore(page: Page) {
  await page.waitForSelector('[data-testid="top-bar"]');
}
