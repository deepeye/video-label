# Day 7 实施计划 · 防呆 + 错误边界 + 现场分发 + 离线验证

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**前置:** Day 1-6 已完成（功能全部跑通）。

**Goal:** 把 Demo 从「功能跑通」推到「现场不翻车」——加全局错误边界、浏览器兼容性提示、E2E 防呆用例补全、离线请求验证脚本、可分发的 start.sh / start.bat 脚本和打包工具。

**Architecture:** 错误边界 + DemoCrashScreen 兜底；启动期检测 requestVideoFrameCallback；scripts/verify-offline.mjs 用 Playwright 跑全流程并断言所有请求 host = localhost；scripts/pack-release.sh 把 dist + start scripts 打成可分发 zip。

**关键产出文件:**
- `src/chrome/ErrorBoundary.tsx`
- `src/chrome/DemoCrashScreen.tsx`
- `src/chrome/BrowserCompatGuard.tsx`
- `src/main.tsx` (集成 ErrorBoundary + 兼容性检测)
- `scripts/verify-offline.mjs`
- `scripts/pack-release.sh`
- `dist-extras/start.sh`
- `dist-extras/start.bat`
- `dist-extras/README.md`
- `tests/e2e/canAdvance.spec.ts`
- `tests/e2e/auto-presenter.spec.ts`
- `tests/e2e/offline.spec.ts`
- `package.json` (script 补 verify-offline / pack:release / size 检查)

---

## File Structure

```
src/
├── chrome/
│   ├── ErrorBoundary.tsx          ← React 错误边界
│   ├── DemoCrashScreen.tsx        ← 友好崩溃画面
│   └── BrowserCompatGuard.tsx     ← 启动期浏览器兼容性检测
└── main.tsx                       ← 集成

scripts/
├── verify-offline.mjs             ← Playwright 检查无外部请求
└── pack-release.sh                ← 构建 + 注入 start scripts → zip

dist-extras/                       ← pack-release.sh 复制到 release zip 根目录
├── start.sh
├── start.bat
└── README.md

tests/e2e/
├── canAdvance.spec.ts             ← ⏭ 防呆置灰
├── auto-presenter.spec.ts         ← 虚拟主讲完整 + 接管
└── offline.spec.ts                ← 没有外部 host 请求
```

---

## Day 7: 防呆 + 错误边界 + 离线分发

### Task 7.1: 浏览器兼容性 Guard

**Files:**
- Create: `src/chrome/BrowserCompatGuard.tsx`

> **设计依据:** spec §7.3.1 — main.tsx 启动检测 requestVideoFrameCallback；不存在则显示「请使用最新 Chrome」遮罩。

- [ ] **Step 1: 写 src/chrome/BrowserCompatGuard.tsx**

```tsx
import type { ReactNode } from 'react';
import { isNativeVideoFrameCallbackSupported } from '../lib/ext/videoFrameCallback';
import { tokens } from '../styles/tokens';

interface BrowserCompatGuardProps {
  children: ReactNode;
}

/**
 * 启动期检测关键浏览器特性。不满足直接显示遮罩, 不渲染主应用。
 *
 * 当前检测项:
 *   - requestVideoFrameCallback (Chrome 83+ / Edge 84+ / Safari 16+)
 *
 * 未来若加更多检测, 把它们 OR 进 missingFeatures 数组。
 */
export function BrowserCompatGuard({ children }: BrowserCompatGuardProps) {
  const missingFeatures: string[] = [];

  if (!isNativeVideoFrameCallbackSupported()) {
    missingFeatures.push('requestVideoFrameCallback');
  }

  if (missingFeatures.length > 0) {
    return (
      <div
        data-testid="browser-compat-guard"
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: tokens.space[3],
          padding: tokens.space[6],
          background: tokens.color.neutral[50],
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 28 }}>⚠️</div>
        <h2 style={{ margin: 0, color: tokens.color.neutral[900] }}>建议使用最新版 Chrome 或 Edge 演示</h2>
        <p style={{ margin: 0, color: tokens.color.neutral[500], maxWidth: 460 }}>
          当前浏览器缺少以下特性: <code>{missingFeatures.join(', ')}</code>
          <br />
          演示功能依赖这些特性，请升级浏览器后重试。
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: tokens.space[3],
            padding: `${tokens.space[2]}px ${tokens.space[4]}px`,
            borderRadius: tokens.radius.md,
            background: 'transparent',
            backgroundImage: tokens.brandGradient,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            boxShadow: tokens.shadow.brand,
          }}
        >
          ↻ 刷新页面
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: 提交**

```bash
git add src/chrome/BrowserCompatGuard.tsx
git commit -m "feat: BrowserCompatGuard — startup-time check for requestVideoFrameCallback"
```

---

### Task 7.2: 错误边界 + 崩溃画面

**Files:**
- Create: `src/chrome/ErrorBoundary.tsx`
- Create: `src/chrome/DemoCrashScreen.tsx`

> **设计依据:** spec §7.3.2 — 全局 ErrorBoundary，崩溃时显示「演示遇到了意外问题」+ 刷新页面 / 重置按钮，**刻意不显示错误堆栈**。

- [ ] **Step 1: 写 src/chrome/DemoCrashScreen.tsx**

```tsx
import { useDemoStore } from '../store/demoStore';
import { tokens } from '../styles/tokens';

export function DemoCrashScreen() {
  const handleReset = () => {
    try {
      useDemoStore.getState().reset();
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  return (
    <div
      data-testid="demo-crash-screen"
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: tokens.space[3],
        padding: tokens.space[6],
        background: tokens.color.neutral[50],
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 32 }}>🛟</div>
      <h2 style={{ margin: 0, color: tokens.color.neutral[900] }}>演示遇到了意外问题</h2>
      <p style={{ margin: 0, color: tokens.color.neutral[500], maxWidth: 360 }}>
        请刷新页面或重置 Demo 重新演示。
      </p>
      <div style={{ display: 'flex', gap: tokens.space[3], marginTop: tokens.space[3] }}>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: `${tokens.space[2]}px ${tokens.space[4]}px`,
            borderRadius: tokens.radius.md,
            background: 'transparent',
            backgroundImage: tokens.brandGradient,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            boxShadow: tokens.shadow.brand,
          }}
        >
          ↻ 刷新页面
        </button>
        <button
          onClick={handleReset}
          style={{
            padding: `${tokens.space[2]}px ${tokens.space[4]}px`,
            borderRadius: tokens.radius.md,
            background: tokens.color.neutral[0],
            color: tokens.color.neutral[700],
            fontSize: 13,
            fontWeight: 600,
            border: `1px solid ${tokens.color.neutral[200]}`,
            cursor: 'pointer',
          }}
        >
          ↺ 重置 Demo
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 写 src/chrome/ErrorBoundary.tsx**

```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { DemoCrashScreen } from './DemoCrashScreen';

interface State {
  hasError: boolean;
}

interface Props {
  children: ReactNode;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(_error: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 错误信息进 console 而非 UI (spec §7.3.2)
    console.error('[Demo crash]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return <DemoCrashScreen />;
    }
    return this.props.children;
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add src/chrome/ErrorBoundary.tsx src/chrome/DemoCrashScreen.tsx
git commit -m "feat: ErrorBoundary + DemoCrashScreen for graceful crash UX"
```

---

### Task 7.3: 集成 ErrorBoundary + Guard 到 main.tsx

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: 重写 src/main.tsx**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './chrome/ErrorBoundary';
import { BrowserCompatGuard } from './chrome/BrowserCompatGuard';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserCompatGuard>
        <App />
      </BrowserCompatGuard>
    </ErrorBoundary>
  </React.StrictMode>,
);
```

- [ ] **Step 2: 验证**

```bash
npm run typecheck
npm run dev
```

启动 dev → / → 应正常进入 Demo 首页 (Chrome/Edge 都支持 requestVideoFrameCallback)。

测试错误边界 (临时手段): 在 src/App.tsx 临时加一行 `throw new Error('test')`, 验证显示 DemoCrashScreen。验证完去掉那行。

- [ ] **Step 3: 提交**

```bash
git add src/main.tsx
git commit -m "feat: integrate ErrorBoundary + BrowserCompatGuard at app root"
```

---

### Task 7.4: E2E — ⏭ 防呆置灰用例

**Files:**
- Create: `tests/e2e/canAdvance.spec.ts`

> **设计依据:** spec §7.6 P0 防呆 + Day 4 E2E 已经包含一个最基础的 disable 检查, 这里补完整。

- [ ] **Step 1: 写 tests/e2e/canAdvance.spec.ts**

```ts
import { test, expect } from '@playwright/test';

test.describe('next button disable / enable based on canAdvanceFromStep4', () => {
  test('step 4 with no review → next disabled', async ({ page }) => {
    await page.goto('/?step=4&speed=instant');
    await page.waitForSelector('[data-testid="step4-review"]');
    const nextBtn = page.locator('[data-testid="btn-next"]');
    await expect(nextBtn).toBeDisabled();
  });

  test('step 4 after all 3 focus reviewed → next enabled', async ({ page }) => {
    await page.goto('/?step=4&speed=instant');
    await page.waitForSelector('[data-testid="step4-review"]');
    await page.evaluate(() => {
      type W = typeof window & {
        __demoStore?: {
          getState: () => {
            acceptBox: (id: string) => void;
            correctBoxGeometry: (id: string, idx: number, c: [number, number, number, number]) => void;
            rejectBox: (id: string) => void;
          };
        };
      };
      const s = (window as W).__demoStore!.getState();
      s.acceptBox('trk_2');
      s.correctBoxGeometry('trk_9', 0, [100, 200, 300, 400]);
      s.rejectBox('trk_5');
    });
    const nextBtn = page.locator('[data-testid="btn-next"]');
    await expect(nextBtn).toBeEnabled();
  });

  test('step 5 → next disabled (no further step)', async ({ page }) => {
    await page.goto('/?step=5');
    await page.waitForSelector('[data-testid="step5-export"]');
    const nextBtn = page.locator('[data-testid="btn-next"]');
    await expect(nextBtn).toBeDisabled();
  });

  test('step 1 → next enabled (advances to 2)', async ({ page }) => {
    await page.goto('/?step=1');
    await page.waitForSelector('[data-testid="step1-upload"]');
    const nextBtn = page.locator('[data-testid="btn-next"]');
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();
    await page.waitForSelector('[data-testid="step2-metadata"]', { timeout: 1000 });
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `npm run test:e2e -- tests/e2e/canAdvance.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 3: 提交**

```bash
git add tests/e2e/canAdvance.spec.ts
git commit -m "test: E2E next button disable/enable based on canAdvanceFromStep4"
```

---

### Task 7.5: E2E — 自动模式 + 虚拟主讲完整流程

**Files:**
- Create: `tests/e2e/auto-presenter.spec.ts`

> **设计依据:** spec §3.4 — 用 instant 速度跑完整自动流程, 验证最终 store 状态。

- [ ] **Step 1: 写 tests/e2e/auto-presenter.spec.ts**

```ts
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
    // 模拟客户点击画布空白处 (canvas mock 在 e2e 是真 Konva 渲染区)
    await page.click('[data-testid="step4-review"]');
    await page.waitForFunction(() => {
      type W = typeof window & { __demoStore?: { getState: () => { playMode: string } } };
      return (window as W).__demoStore?.getState().playMode === 'manual';
    });
  });

  test('control bar buttons do not trigger user takeover', async ({ page }) => {
    await page.goto('/?step=1&speed=1x');
    await page.click('[data-testid="btn-play-pause"]');
    // 暂停 → 继续 → 仍在 auto
    await page.click('[data-testid="btn-play-pause"]');
    const stateAfterPause = await page.evaluate(() => {
      type W = typeof window & { __demoStore?: { getState: () => { playMode: string; paused: boolean } } };
      return (window as W).__demoStore!.getState();
    });
    expect(stateAfterPause.playMode).toBe('auto');
    expect(stateAfterPause.paused).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `npm run test:e2e -- tests/e2e/auto-presenter.spec.ts`
Expected: PASS (3 tests)

如果失败:
- "auto run reaches step 5 timeout" → 检查 instant 速度下各步骤是否真的瞬时完成 (Step 2 视图、Step 3 视图、VirtualPresenter 都需要响应 instant)
- "user click switches to manual" → 检查 App.tsx mousedown listener 是否对 Konva canvas 区域生效 (可能 step4-review div 的 click 不冒泡到 window? 但 mousedown 一定会冒泡)

- [ ] **Step 3: 提交**

```bash
git add tests/e2e/auto-presenter.spec.ts
git commit -m "test: E2E auto presenter full flow + user takeover scenarios"
```

---

### Task 7.6: 离线请求验证脚本

**Files:**
- Create: `scripts/verify-offline.mjs`

> **设计依据:** CLAUDE.md 第 4 条硬约束 — 零外部网络请求。这是上线前必跑的守护脚本。

- [ ] **Step 1: 写 scripts/verify-offline.mjs**

```js
// scripts/verify-offline.mjs
// 用法: node scripts/verify-offline.mjs
// 用 Playwright 启动一个 dev server, 跑完整 demo 流程, 拦截所有请求, 断言 host 都是 localhost。
// 返回 0 全部 OK, 1 有外部请求。

import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 5193;
const URL = `http://localhost:${PORT}`;

function startDevServer() {
  const proc = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('dev server timeout')), 30_000);
    proc.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      if (buf.includes(`localhost:${PORT}`)) {
        clearTimeout(timer);
        resolve(proc);
      }
    });
    proc.on('exit', (code) => reject(new Error(`dev server exited: ${code}`)));
  });
}

async function main() {
  console.log('[verify-offline] starting dev server...');
  const proc = await startDevServer();
  console.log('[verify-offline] dev server up at', URL);

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const externalRequests = [];
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith('http://localhost') && !url.startsWith('data:') && !url.startsWith('blob:')) {
      externalRequests.push(`${req.method()} ${url}`);
    }
  });

  try {
    await page.goto(`${URL}/?step=1&speed=instant`);
    await page.waitForSelector('[data-testid="step1-upload"]');
    await page.click('[data-testid="sample-card-city-road"]');
    await page.waitForSelector('[data-testid="step2-metadata"]', { timeout: 5000 });
    await page.waitForSelector('[data-testid="step4-review"]', { timeout: 10_000 });
    // 模拟审核
    await page.evaluate(() => {
      const s = (/** @type {any} */ (window)).__demoStore.getState();
      s.acceptBox('trk_2');
      s.correctBoxGeometry('trk_9', 0, [100, 200, 300, 400]);
      s.rejectBox('trk_5');
      s.acceptAllRemaining();
      s.goToStep(5);
    });
    await page.waitForSelector('[data-testid="step5-export"]');
    // 触发下载
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="download-btn"]');
    await downloadPromise;
  } catch (err) {
    console.error('[verify-offline] flow error:', err);
  }

  await browser.close();
  proc.kill();

  if (externalRequests.length > 0) {
    console.error('[verify-offline] FAIL — 外部请求:');
    externalRequests.forEach((u) => console.error('  -', u));
    process.exit(1);
  }
  console.log('[verify-offline] OK — 所有请求都走 localhost');
}

main().catch((err) => {
  console.error('[verify-offline] uncaught:', err);
  process.exit(1);
});
```

- [ ] **Step 2: 跑一次确认通过**

Run: `node scripts/verify-offline.mjs`
Expected: 输出 `[verify-offline] OK — 所有请求都走 localhost`，exit code 0。

如果失败 (有外部请求):

- 字体: 检查 globals.css 是否有遗留的 Google Fonts CDN URL (Day 1 已锁定本地打包)
- 其他: 看输出的 host, 找到对应 import 改成本地

- [ ] **Step 3: 提交**

```bash
git add scripts/verify-offline.mjs
git commit -m "feat: verify-offline.mjs — assert no external network requests"
```

---

### Task 7.7: start.sh / start.bat 现场分发脚本

**Files:**
- Create: `dist-extras/start.sh`
- Create: `dist-extras/start.bat`
- Create: `dist-extras/README.md`

- [ ] **Step 1: 写 dist-extras/start.sh**

```bash
#!/usr/bin/env bash
# 视频语料标注 Demo · 现场启动脚本 (macOS / Linux)
# 用法: 双击此文件，或终端运行 bash start.sh

set -e
cd "$(dirname "$0")"

PORT=8080
while lsof -i :$PORT >/dev/null 2>&1; do
  PORT=$((PORT+1))
done

echo "─────────────────────────────────────────────"
echo "  视频语料标注 Demo"
echo "─────────────────────────────────────────────"
echo "  地址: http://localhost:$PORT"
echo "  按 Ctrl+C 退出"
echo "─────────────────────────────────────────────"
echo ""

# 1s 后自动打开浏览器, 同时启动 server
(
  sleep 1
  if command -v open >/dev/null 2>&1; then
    open "http://localhost:$PORT"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:$PORT"
  fi
) &

if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server "$PORT" --directory ./dist
elif command -v python >/dev/null 2>&1; then
  python -m http.server "$PORT" --directory ./dist
else
  echo "未找到 python3 或 python。请安装 Python 3 后重试。"
  echo "macOS: brew install python"
  echo "Linux: sudo apt install python3"
  exit 1
fi
```

- [ ] **Step 2: 写 dist-extras/start.bat**

```bat
@echo off
REM 视频语料标注 Demo · 现场启动脚本 (Windows)
REM 用法: 双击此文件
chcp 65001 >NUL
cd /d "%~dp0"

set PORT=8080

REM 找空闲端口 (PowerShell)
for /f "delims=" %%P in ('powershell -NoProfile -Command ^
  "$p=8080; while ((Test-NetConnection -ComputerName localhost -Port $p -WarningAction SilentlyContinue).TcpTestSucceeded) { $p++ }; Write-Output $p"') do set PORT=%%P

echo -----------------------------------------
echo   视频语料标注 Demo
echo -----------------------------------------
echo   地址: http://localhost:%PORT%
echo   按 Ctrl+C 退出
echo -----------------------------------------
echo.

REM 1s 后自动开浏览器
start /B powershell -Command "Start-Sleep 1; Start-Process 'http://localhost:%PORT%'"

REM 启动 Python http.server
python -m http.server %PORT% --directory ./dist
if errorlevel 1 (
  echo.
  echo 未找到 python。请安装 Python 3 后重试:
  echo   Microsoft Store 搜索 "Python 3" 或访问 https://www.python.org/downloads/
  pause
)
```

- [ ] **Step 3: 写 dist-extras/README.md**

```markdown
# 视频语料标注 Demo · 现场分发包

## 启动方式

### macOS / Linux
双击 `start.sh`。如果双击不工作（系统不识别 .sh 为可执行）：

```bash
chmod +x start.sh
./start.sh
```

### Windows
双击 `start.bat`。

## 系统要求

- **Python 3**：macOS / 大部分 Linux 自带；Windows 需手动安装。
  - macOS: `brew install python`（如果没装 Homebrew，访问 https://brew.sh）
  - Windows: Microsoft Store 搜索 "Python 3"，或访问 https://www.python.org/downloads/
- **浏览器**：Chrome 或 Edge **最新两个稳定版本**
- **屏幕分辨率**：≥ 1280 × 720（建议按 F11 全屏）

## 启动后

浏览器自动打开 `http://localhost:8080`（端口被占用会自动 +1）。

## 使用流程

1. 选择「城市道路」样例（或其他）
2. ▶ 自动演示，或手动点 "下一步" 推进
3. ④ 审核步骤可亲自接受 / 否决 / 拖框纠正
4. ⑤ 导出步骤下载 zip 包

## 故障排除

- **端口被占用**：脚本会自动找下一个空闲端口
- **浏览器没自动打开**：手动访问终端显示的 URL
- **找不到 Python**：见上方系统要求
- **关闭演示**：终端按 Ctrl+C；浏览器关闭页面即可

## 关于这个包

这是**纯前端演示**，所有数据是预置 Mock。不连接任何服务器，不上传任何文件。
```

- [ ] **Step 4: 提交**

```bash
mkdir -p dist-extras
chmod +x dist-extras/start.sh
git add dist-extras/
git commit -m "feat: dist-extras/ with start.sh, start.bat, and README for distribution"
```

---

### Task 7.8: pack-release.sh 打包脚本

**Files:**
- Create: `scripts/pack-release.sh`
- Modify: `package.json` (确认 scripts 已含 pack:release)

- [ ] **Step 1: 写 scripts/pack-release.sh**

```bash
#!/usr/bin/env bash
# scripts/pack-release.sh
# 把 dist/ + dist-extras/ 打包成可分发的 zip。
# 用法: bash scripts/pack-release.sh
# 输出: video-label-demo-<version>.zip

set -e
cd "$(dirname "$0")/.."

VERSION=$(node -e "console.log(require('./package.json').version)")
NAME="video-label-demo-v${VERSION}"
OUT_DIR="release"

echo "[pack-release] cleaning..."
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR/$NAME"

echo "[pack-release] building..."
npm run build

echo "[pack-release] copying dist + dist-extras..."
cp -R dist "$OUT_DIR/$NAME/dist"
cp dist-extras/start.sh "$OUT_DIR/$NAME/"
cp dist-extras/start.bat "$OUT_DIR/$NAME/"
cp dist-extras/README.md "$OUT_DIR/$NAME/"
chmod +x "$OUT_DIR/$NAME/start.sh"

echo "[pack-release] zipping..."
cd "$OUT_DIR"
zip -r "${NAME}.zip" "$NAME"
cd ..

SIZE=$(du -sh "$OUT_DIR/${NAME}.zip" | cut -f1)
echo ""
echo "─────────────────────────────────────────────"
echo "  ✓ 打包完成: $OUT_DIR/${NAME}.zip ($SIZE)"
echo "─────────────────────────────────────────────"
```

- [ ] **Step 2: chmod + 跑一次**

```bash
chmod +x scripts/pack-release.sh
npm run pack:release
```

Expected: 在 `release/` 目录下生成 `video-label-demo-v0.1.0.zip`，大小通常 800KB-3MB（含字体 + 占位视频）。

- [ ] **Step 3: 验证 release zip 可启动**

```bash
cd release
unzip -q video-label-demo-v0.1.0.zip
cd video-label-demo-v0.1.0
bash start.sh &
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/
# 期望: 200
# 然后 Ctrl+C 关闭 server
kill %1 2>/dev/null || true
cd ../..
```

- [ ] **Step 4: 把 release/ 加进 .gitignore**

```bash
echo "" >> .gitignore
echo "# Release packaging" >> .gitignore
echo "release/" >> .gitignore
git add .gitignore
```

- [ ] **Step 5: 提交**

```bash
git add scripts/pack-release.sh
git commit -m "feat: pack-release.sh — produce distributable zip with start scripts"
```

---

### Task 7.9: 包体积 CI gate

**Files:**
- Create: `scripts/check-size.mjs`
- Modify: `package.json` (script 加 size:check)

> **设计依据:** spec §7.2.2 — 30MB 红线。

- [ ] **Step 1: 写 scripts/check-size.mjs**

```js
// scripts/check-size.mjs
// 用法: node scripts/check-size.mjs
// 检查 dist/ 总大小是否在 30MB 红线内。

import { statSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const LIMIT_BYTES = 30 * 1024 * 1024; // 30 MB
const DIST = resolve(process.cwd(), 'dist');

function dirSize(path) {
  let total = 0;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) {
      total += dirSize(full);
    } else if (entry.isFile()) {
      total += statSync(full).size;
    }
  }
  return total;
}

const size = dirSize(DIST);
const sizeMB = (size / 1024 / 1024).toFixed(2);
const limitMB = (LIMIT_BYTES / 1024 / 1024).toFixed(0);

if (size > LIMIT_BYTES) {
  console.error(`❌ dist size ${sizeMB} MB exceeds limit ${limitMB} MB`);
  process.exit(1);
}
console.log(`✓ dist size ${sizeMB} MB (limit ${limitMB} MB)`);
```

- [ ] **Step 2: package.json 加 script**

修改 package.json 的 scripts：

```json
{
  "scripts": {
    ...
    "size:check": "node scripts/check-size.mjs",
    ...
  }
}
```

- [ ] **Step 3: 跑一次**

```bash
npm run build
npm run size:check
```

Expected: ✓ 输出 dist 大小 < 30MB。

- [ ] **Step 4: 提交**

```bash
git add scripts/check-size.mjs package.json
git commit -m "feat: check-size.mjs — enforce 30MB dist size limit"
```

---

### Task 7.10: E2E — 离线请求验证（双轨）

**Files:**
- Create: `tests/e2e/offline.spec.ts`

> **注:** 这是 spec §7.1 列出的 5 个 E2E 之一。和 Task 7.6 的脚本作用相似但形式不同：脚本可独立运行（不需要 Playwright test runner）；这里的 E2E 是 CI 的标准测试入口。

- [ ] **Step 1: 写 tests/e2e/offline.spec.ts**

```ts
import { test, expect } from '@playwright/test';

test.describe('offline guarantees', () => {
  test('no external host requests during full demo flow', async ({ page }) => {
    const externalRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (
        !url.startsWith('http://localhost') &&
        !url.startsWith('data:') &&
        !url.startsWith('blob:')
      ) {
        externalRequests.push(`${req.method()} ${url}`);
      }
    });

    await page.goto('/?step=1&speed=instant');
    await page.waitForSelector('[data-testid="step1-upload"]');
    await page.click('[data-testid="sample-card-city-road"]');
    await page.waitForSelector('[data-testid="step2-metadata"]', { timeout: 5000 });
    await page.waitForSelector('[data-testid="step4-review"]', { timeout: 10_000 });

    await page.evaluate(() => {
      type W = typeof window & {
        __demoStore?: {
          getState: () => {
            acceptBox: (id: string) => void;
            correctBoxGeometry: (id: string, idx: number, c: [number, number, number, number]) => void;
            rejectBox: (id: string) => void;
            acceptAllRemaining: () => void;
            goToStep: (n: 5) => void;
          };
        };
      };
      const s = (window as W).__demoStore!.getState();
      s.acceptBox('trk_2');
      s.correctBoxGeometry('trk_9', 0, [100, 200, 300, 400]);
      s.rejectBox('trk_5');
      s.acceptAllRemaining();
      s.goToStep(5);
    });
    await page.waitForSelector('[data-testid="step5-export"]');
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="download-btn"]');
    await downloadPromise;

    expect(externalRequests, '外部请求被检出: ' + externalRequests.join('\n')).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `npm run test:e2e -- tests/e2e/offline.spec.ts`
Expected: PASS (1 test)

- [ ] **Step 3: 提交**

```bash
git add tests/e2e/offline.spec.ts
git commit -m "test: E2E offline — full flow has no external host requests"
```

---

### Task 7.11: 性能基准 E2E (可选 — 守 PRD 第十章)

**Files:**
- Create: `tests/e2e/perf.spec.ts`

> **设计依据:** spec §7.1.4 + PRD 第十章红线 — 重置 ≤ 200ms（已有单测）+ 打包 ≤ 1.5s + 首屏 ≤ 2s。

- [ ] **Step 1: 写 tests/e2e/perf.spec.ts**

```ts
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
    await page.evaluate(() => {
      type W = typeof window & {
        __demoStore?: { getState: () => {
          acceptAllRemaining: () => void;
          goToStep: (n: 5) => void;
        } };
      };
      const s = (window as W).__demoStore!.getState();
      s.acceptAllRemaining();
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

    page.on('dialog', (d) => d.accept());

    await page.evaluate(() => {
      type W = typeof window & { __demoStore?: { getState: () => { acceptAllRemaining: () => void } } };
      (window as W).__demoStore!.getState().acceptAllRemaining();
    });

    const t0 = Date.now();
    await page.click('[data-testid="btn-reset"]');
    await page.waitForSelector('[data-testid="step1-upload"]');
    const elapsed = Date.now() - t0;
    // E2E 中 dialog accept + DOM 重渲染 + Konva 销毁 重建会比单测 200ms 慢一些, 给 300ms 余量
    expect(elapsed).toBeLessThan(300);
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `npm run test:e2e -- tests/e2e/perf.spec.ts`
Expected: PASS (3 tests)。如果有失败:

- "fcp > 2000" → 有大模块没 code split, 检查 vite build 输出, 调整 manualChunks
- "packaging > 1500ms" → JSZip 同步执行慢, 看是不是 frame fetch 失败延迟 (Day 4 已设默认占位帧)
- "reset > 300ms" → Konva Stage 销毁慢, Day 8 调优

- [ ] **Step 3: 提交**

```bash
git add tests/e2e/perf.spec.ts
git commit -m "test: E2E performance hard lines (FCP < 2s, export < 1.5s, reset < 300ms)"
```

---

### Task 7.12: Day 7 验收 + 全量回归

- [ ] **Step 1: 全部单测绿色**

Run: `npm run test:run`
Expected: 全绿。预期 60+ 个测试。

- [ ] **Step 2: 全部 E2E 绿色**

Run: `npm run test:e2e`
Expected: 全绿。包含 Day 4 full-flow + canAdvance + auto-presenter + offline + perf。

- [ ] **Step 3: typecheck + build + size + verify-offline**

```bash
npm run typecheck
npm run build
npm run size:check
node scripts/verify-offline.mjs
```

Expected: 全部 OK。

- [ ] **Step 4: 完整端到端走查 (含错误场景)**

启动 dev → / → 验证:

1. ✅ Chrome / Edge 正常进入 (BrowserCompatGuard 不拦)
2. ✅ 拖入 .png → 友好 toast「请拖入视频文件」
3. ✅ 拖入 .mp4 → 假上传 → 切回 city-road
4. ✅ ▶ 自动演示完整跑完 7-8s
5. ✅ ⏸ 暂停遮罩 → 点击恢复
6. ✅ 任意点击/按键接管
7. ✅ 重点项未审完 ⏭ 置灰
8. ✅ 重置二次确认 (有改动时) / 无确认 (无改动时)
9. ✅ 导出 zip 解压验证内容

**关闭网络** (拔网线 / Wi-Fi 关闭) 重新跑 → 完全可用。

- [ ] **Step 5: 打包 release zip 并验证**

```bash
npm run pack:release
ls -lh release/
unzip -l release/video-label-demo-v0.1.0.zip | head -20
```

Expected: zip 大小 ≤ 30MB, 包含 dist/ + start.sh + start.bat + README.md。

- [ ] **Step 6: 提交 tag**

```bash
git tag day7-polish-complete
```

---

## Day 7 验收清单

至此 Day 7 应满足：

- ✅ 浏览器兼容性 Guard (启动检测 requestVideoFrameCallback)
- ✅ React ErrorBoundary + 友好 DemoCrashScreen (无错误堆栈泄漏)
- ✅ E2E ⏭ 防呆 (4 个用例)
- ✅ E2E 自动模式 + 虚拟主讲 (3 个用例)
- ✅ E2E 离线请求验证 (1 个用例)
- ✅ E2E 性能红线 (FCP / 打包 / 重置)
- ✅ scripts/verify-offline.mjs (独立守护脚本)
- ✅ scripts/check-size.mjs (30MB 红线 gate)
- ✅ scripts/pack-release.sh (产可分发 zip)
- ✅ dist-extras/start.sh + start.bat + README
- ✅ release zip 自验证可启动
- ✅ .gitignore 含 release/

下一分册: Day 8 缓冲日 (真视频替换 + 视觉调优 + bug 修复)。
