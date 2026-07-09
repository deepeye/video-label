# 视频语料标注平台 Demo 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个纯前端视频标注流程演示系统（Demo），让销售在客户现场 5 分钟内走通「上传 → 元信息 → 自动标注 → 人工审核 → 导出」五步叙事，叙事可信、现场零故障、可反复重置。

**Architecture:** React 18 + Vite SPA，Zustand 单一全局 store 持有 Demo 编排状态机和标注内存数据；Konva.js 渲染审核工作台的可拖拽标注框；JSZip + FileSaver 浏览器内打包真实可下载 zip。所有数据走 Mock JSON、所有「计算」用定时器揭示动画驱动，零后端、零外部网络请求。

**Tech Stack:** React 18 + Vite 5 + TypeScript 5 (strict + noUncheckedIndexedAccess) + Zustand 4 (immer middleware) + Konva.js 9 + react-konva + JSZip + FileSaver + lucide-react + zod (启动期 schema 校验) + Vitest + @testing-library/react + Playwright

**参考来源:** `docs/superpowers/specs/2026-06-18-video-label-demo-design.md` (设计文档 v1.0)
**约束来源:** `CLAUDE.md` (项目硬约束) + `docs/视频语料标注平台 · 演示 Demo PRD.md` (PRD v2.0-demo)

**计划文件分册:**
- 本文件 (Day 0-1): 项目脚手架、TypeScript 类型、设计 token、Zustand store 骨架
- `2026-06-18-video-label-demo-day2-3-review.md` (Day 2-3): Step 4 审核工作台 (Konva + Transformer + 撤销栈 + 队列)
- `2026-06-18-video-label-demo-day4-export.md` (Day 4): Step 5 导出 (序列化 + JSZip 打包 + E2E 验证核心链路)
- `2026-06-18-video-label-demo-day5-steps123.md` (Day 5): Step 1/2/3 (上传 + 元信息揭示 + 自动标注揭示) + 副样例
- `2026-06-18-video-label-demo-day6-controls.md` (Day 6): 控制条联动 + 自动模式 + 虚拟主讲
- `2026-06-18-video-label-demo-day7-polish.md` (Day 7): 防呆 + 错误边界 + 现场分发脚本 + 性能测试
- `2026-06-18-video-label-demo-day8-buffer.md` (Day 8): 真视频替换、视觉调优、bug 修复缓冲

**实施顺序原则 (CLAUDE.md 实施建议 + spec §7.5):**
1. 先建数据骨架 (类型 + Mock + store)，因为五步骤都消费它
2. 再做 Step 4 审核工作台 (技术最重 + Demo 灵魂)
3. 再做 Step 5 导出 (验证「客户改动 → 内存 → 导出」核心链路真的通)
4. 最后补 Step 1/2/3 揭示动画 (观感层，定时器读 Mock 渲染)
5. 控制条与重置贯穿始终，尽早接上

**关键硬约束 (CLAUDE.md):**
- ① 数据 schema 对齐生产 (PRD 第五章)；导出经得起技术评估方审视
- ② 审核改动必须回写到 Zustand store (Konva 图层只是渲染)
- ③ 重置必须深拷贝初始 Mock 快照 (整体替换 store)
- ④ 零真实后端 / 零外部网络请求 (含字体 CDN)
- ⑤ 审核步骤是唯一真交互 (其余四步是揭示动画 + 读 Mock)

---

## File Structure (Day 0-1 范围)

本计划分册涉及的文件：

**新建:**
- `package.json` — 依赖与 npm scripts
- `vite.config.ts` — Vite 配置 (含 path alias)
- `tsconfig.json` — TS strict 配置
- `tsconfig.node.json` — Vite/Node 工具的 TS 配置
- `index.html` — Vite HTML 入口
- `.gitignore` (已存在 `.superpowers/` 一行) — 增加 `node_modules/`、`dist/` 等
- `src/main.tsx` — React 应用入口
- `src/App.tsx` — 根组件 (此阶段仅占位)
- `src/types.ts` — 全部 TypeScript 类型定义 (Dataset / Annotation / DemoStep / 等)
- `src/styles/globals.css` — CSS 变量 + 字体 @font-face + reset
- `src/styles/tokens.ts` — 设计 token TypeScript 镜像
- `src/lib/deepClone.ts` — structuredClone 包装
- `src/store/snapshots.ts` — 初始 Mock 快照工厂
- `src/store/undo.ts` — 撤销栈实现
- `src/store/demoStore.ts` — Zustand 全局 store
- `src/data/index.ts` — 数据集注册
- `src/data/city-road.json` — 主样例 (47 标注 + 3 重点项)
- `src/data/_generators/city-road-fixture.ts` — 主样例生成脚本
- `src/data/_generators/README.md` — 生成器说明
- `tests/store.test.ts` — store + 重置 + 撤销单测
- `tests/tokens.test.ts` — CSS 变量与 TS 镜像一致性测试
- `tests/format.test.ts` — schema 一致性占位测试 (本阶段先建文件)
- `vitest.config.ts` — Vitest 配置
- `public/fonts/Inter-Regular.woff2` — 字体本地打包 (从 Google Fonts 下载到本地)
- `public/fonts/Inter-Medium.woff2`
- `public/fonts/Inter-SemiBold.woff2`
- `public/fonts/JetBrainsMono-Regular.woff2`
- `public/mock/city-road/road_demo.mp4` — 占位视频 (黑屏 + 时间戳)

**Day 0-1 不涉及 (后续分册):**
- 副样例 JSON (Day 5)
- 5 步骤视图组件 (Day 2-5)
- chrome 层 UI (Day 1 末尾会建占位组件，Day 6 接入完整逻辑)
- E2E 测试 (Day 4 起)

---

## Day 0: 环境准备 (~1 小时, 实操中合并入 Day 1)

### Task 0.1: 确认 Node / npm 可用

- [ ] **Step 1: 检查 Node 版本**

Run: `node --version`
Expected: `v18.x.x` 或更新 (Vite 5 要求 ≥ 18)

- [ ] **Step 2: 检查 npm 版本**

Run: `npm --version`
Expected: `9.x.x` 或更新

- [ ] **Step 3: 检查 git 用户配置**

Run: `git config user.name && git config user.email`
Expected: 输出当前 git user (本仓库首次 commit 已有，确认可用即可)

如果 Node < 18 或不存在，先安装 Node 18+ (推荐用 nvm: `nvm install 18 && nvm use 18`)。

---

## Day 1: 骨架

### Task 1.1: 初始化 npm 项目与 .gitignore

**Files:**
- Modify: `.gitignore` (现有 1 行 `.superpowers/`)
- Create: `package.json` (通过 npm init -y 生成基础结构后我们改写)

- [ ] **Step 1: 检查现有 .gitignore**

Run: `cat .gitignore`
Expected: 看到一行 `.superpowers/`

- [ ] **Step 2: 完善 .gitignore**

替换 `.gitignore` 全文为：

```
# Superpowers brainstorm artifacts
.superpowers/

# Dependencies
node_modules/

# Build output
dist/
dist-ssr/

# Test coverage
coverage/

# Editor
.vscode/
.idea/
*.swp
.DS_Store

# Env
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*

# Vite
*.local
.vite/

# Playwright
test-results/
playwright-report/
playwright/.cache/
```

- [ ] **Step 3: 写 package.json**

创建 `package.json`：

```json
{
  "name": "video-label-demo",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b --noEmit",
    "test": "vitest",
    "test:run": "vitest run",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "validate-fixture": "node scripts/validate-fixture.mjs",
    "verify-offline": "node scripts/verify-offline.mjs",
    "pack:release": "bash scripts/pack-release.sh"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^4.5.0",
    "immer": "^10.1.0",
    "konva": "^9.3.0",
    "react-konva": "^18.2.0",
    "jszip": "^3.10.0",
    "file-saver": "^2.0.5",
    "lucide-react": "^0.456.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/file-saver": "^2.0.7",
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0",
    "@vitest/ui": "^2.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/user-event": "^14.5.0",
    "jsdom": "^24.0.0",
    "@playwright/test": "^1.46.0"
  }
}
```

- [ ] **Step 4: 安装依赖**

Run: `npm install`
Expected: 创建 `node_modules/` 与 `package-lock.json`，无报错。耗时 30-90s。

- [ ] **Step 5: 提交**

```bash
git add .gitignore package.json package-lock.json
git commit -m "chore: init npm project with Vite + React + TypeScript stack"
```

---

### Task 1.2: TypeScript 配置 (strict + noUncheckedIndexedAccess)

**Files:**
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`

- [ ] **Step 1: 写 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": false,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 2: 写 tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

- [ ] **Step 3: 验证 tsc 可运行 (会报缺少入口文件，正常)**

Run: `npx tsc -b --noEmit 2>&1 | head -20`
Expected: 没有 "Cannot find module" 之类的配置错误；可能报 "No inputs were found" — 此时还没文件，正常。

- [ ] **Step 4: 提交**

```bash
git add tsconfig.json tsconfig.node.json
git commit -m "chore: configure TypeScript with strict + noUncheckedIndexedAccess"
```

---

### Task 1.3: Vite 配置 + index.html

**Files:**
- Create: `vite.config.ts`
- Create: `index.html`

- [ ] **Step 1: 写 vite.config.ts**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'konva-vendor': ['konva', 'react-konva'],
          'zip-vendor': ['jszip', 'file-saver'],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    open: false,
  },
});
```

- [ ] **Step 2: 写 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Frameworks · 视频标注 Demo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: 创建占位 favicon**

Run:
```bash
cat > public/favicon.svg <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6366F1"/><stop offset="100%" stop-color="#8B5CF6"/></linearGradient></defs><rect width="24" height="24" rx="6" fill="url(#g)"/><path d="M7 8h10M7 12h10M7 16h6" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>
EOF
```

(预先创建 `public/` 目录：`mkdir -p public`)

- [ ] **Step 4: 提交**

```bash
mkdir -p public
git add vite.config.ts index.html public/favicon.svg
git commit -m "chore: add Vite config and HTML entry"
```

---

### Task 1.4: Vitest 配置

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`

- [ ] **Step 1: 写 vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});
```

- [ ] **Step 2: 写 tests/setup.ts**

```ts
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 3: 提交**

```bash
mkdir -p tests
git add vitest.config.ts tests/setup.ts
git commit -m "chore: configure Vitest + jsdom + RTL"
```

---

### Task 1.5: 全部 TypeScript 类型定义 (src/types.ts)

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: 写 src/types.ts (与 spec §4.1 1:1)**

```ts
// src/types.ts

export type Speed = '1x' | '2x' | 'instant';
export type DemoStep = 1 | 2 | 3 | 4 | 5;
export type DatasetId = 'city-road' | 'meeting-room' | 'retail-cam';
export type BBox = [x: number, y: number, w: number, h: number];
export type AnnotationSource = 'machine' | 'human';
export type ReviewStatus = 'pending' | 'accepted' | 'corrected' | 'rejected';
export type PlayMode = 'manual' | 'auto';

export interface Dataset {
  version: '2.0-demo';
  dataset_id: DatasetId;
  display: string;
  video_src: string;
  thumb: string;
  metadata: VideoMetadata;
  annotations: Annotation[];
  demo_script: DemoScript;
}

export interface VideoMetadata {
  duration_ms: number;
  frame_count: number;
  fps: number;
  width: number;
  height: number;
  codec: string;
  audio_tracks: number;
  sampled_frames: number;
}

export interface Annotation {
  version: '2.0-demo';
  track_id: string;
  label_id: string;
  label_display: string;
  source: AnnotationSource;
  confidence: number | null;
  needs_review: boolean;
  keyframes: Keyframe[];
  review: ReviewRecord;
}

export interface Keyframe {
  timestamp_ms: number;
  frame_no: number;
  geometry: { type: 'bbox'; coords: BBox };
  is_keyframe: boolean;
}

export interface ReviewRecord {
  status: ReviewStatus;
  changed_frames: number;
  reviewed_at: number | null;
}

export interface DemoScript {
  metadata_reveal_ms: number;
  inference_reveal_ms: number;
  review_focus_ids: string[];
}

export type AnnotationState = Annotation;

// 撤销栈类型
export type ReviewAction =
  | { type: 'accept'; trackId: string; prevStatus: ReviewStatus; prevSource: AnnotationSource }
  | { type: 'reject'; trackId: string; prevStatus: ReviewStatus }
  | {
      type: 'correct-geometry';
      trackId: string;
      frameIdx: number;
      prevCoords: BBox;
      prevSource: AnnotationSource;
    };
```

- [ ] **Step 2: 验证 tsc 不报错**

Run: `npx tsc -b --noEmit 2>&1 | head -20`
Expected: 不输出与 src/types.ts 相关的错误。

- [ ] **Step 3: 提交**

```bash
mkdir -p src
git add src/types.ts
git commit -m "feat: define TypeScript types matching production schema"
```

---

### Task 1.6: zod schema 校验 + 启动期断言

**Files:**
- Create: `src/types.zod.ts` (zod schema)

- [ ] **Step 1: 写 src/types.zod.ts**

```ts
import { z } from 'zod';

export const BBoxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export const KeyframeSchema = z.object({
  timestamp_ms: z.number().int().nonnegative(),
  frame_no: z.number().int().nonnegative(),
  geometry: z.object({
    type: z.literal('bbox'),
    coords: BBoxSchema,
  }),
  is_keyframe: z.boolean(),
});

export const ReviewRecordSchema = z.object({
  status: z.enum(['pending', 'accepted', 'corrected', 'rejected']),
  changed_frames: z.number().int().nonnegative(),
  reviewed_at: z.number().nullable(),
});

export const AnnotationSchema = z.object({
  version: z.literal('2.0-demo'),
  track_id: z.string().min(1),
  label_id: z.string().min(1),
  label_display: z.string().min(1),
  source: z.enum(['machine', 'human']),
  confidence: z.number().min(0).max(1).nullable(),
  needs_review: z.boolean(),
  keyframes: z.array(KeyframeSchema).min(1),
  review: ReviewRecordSchema,
});

export const VideoMetadataSchema = z.object({
  duration_ms: z.number().positive(),
  frame_count: z.number().int().positive(),
  fps: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  codec: z.string().min(1),
  audio_tracks: z.number().int().nonnegative(),
  sampled_frames: z.number().int().positive(),
});

export const DemoScriptSchema = z.object({
  metadata_reveal_ms: z.number().int().nonnegative(),
  inference_reveal_ms: z.number().int().nonnegative(),
  review_focus_ids: z.array(z.string()),
});

export const DatasetSchema = z.object({
  version: z.literal('2.0-demo'),
  dataset_id: z.enum(['city-road', 'meeting-room', 'retail-cam']),
  display: z.string().min(1),
  video_src: z.string().min(1),
  thumb: z.string().min(1),
  metadata: VideoMetadataSchema,
  annotations: z.array(AnnotationSchema),
  demo_script: DemoScriptSchema,
});

export type DatasetParsed = z.infer<typeof DatasetSchema>;
```

- [ ] **Step 2: 提交**

```bash
git add src/types.zod.ts
git commit -m "feat: zod schemas for runtime dataset validation"
```

---

### Task 1.7: deepClone 工具函数

**Files:**
- Create: `src/lib/deepClone.ts`
- Create: `tests/deepClone.test.ts`

- [ ] **Step 1: 先写测试 tests/deepClone.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { deepClone } from '@/lib/deepClone';

describe('deepClone', () => {
  it('clones nested objects without sharing references', () => {
    const src = { a: { b: { c: 1 } }, list: [1, 2, { d: 3 }] };
    const out = deepClone(src);
    expect(out).toEqual(src);
    expect(out).not.toBe(src);
    expect(out.a).not.toBe(src.a);
    expect(out.a.b).not.toBe(src.a.b);
    expect(out.list).not.toBe(src.list);
    expect(out.list[2]).not.toBe(src.list[2]);
  });

  it('handles arrays and primitives', () => {
    expect(deepClone([1, 2, 3])).toEqual([1, 2, 3]);
    expect(deepClone('hello')).toBe('hello');
    expect(deepClone(42)).toBe(42);
    expect(deepClone(null)).toBe(null);
  });

  it('mutating clone does not affect source', () => {
    const src: { items: number[] } = { items: [1, 2] };
    const out = deepClone(src);
    out.items.push(3);
    expect(src.items).toEqual([1, 2]);
    expect(out.items).toEqual([1, 2, 3]);
  });
});
```

- [ ] **Step 2: 运行测试以确认失败**

Run: `npm run test:run -- tests/deepClone.test.ts`
Expected: FAIL — `Cannot find module '@/lib/deepClone'`

- [ ] **Step 3: 写 src/lib/deepClone.ts**

```ts
/**
 * 深拷贝工具，包装 structuredClone。
 * structuredClone 是 ES2022 标准 API，所有现代浏览器 + Node 17+ 原生支持。
 */
export function deepClone<T>(value: T): T {
  return structuredClone(value);
}
```

- [ ] **Step 4: 运行测试以确认通过**

Run: `npm run test:run -- tests/deepClone.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 提交**

```bash
mkdir -p src/lib
git add src/lib/deepClone.ts tests/deepClone.test.ts
git commit -m "feat: add deepClone utility with tests"
```

---

### Task 1.8: 设计 token TS 镜像 + CSS 变量 + 一致性测试

**Files:**
- Create: `src/styles/tokens.ts`
- Create: `src/styles/globals.css`
- Create: `tests/tokens.test.ts`

- [ ] **Step 1: 写 src/styles/tokens.ts (与 spec §6.1-6.6 完全对齐)**

```ts
export const tokens = {
  color: {
    brand: { 400: '#818CF8', 500: '#6366F1', 600: '#4F46E5' },
    accent: { 500: '#8B5CF6' },
    neutral: {
      0: '#FFFFFF',
      50: '#FAFAFA',
      100: '#F4F4F5',
      200: '#E4E4E7',
      400: '#A1A1AA',
      500: '#71717A',
      700: '#3F3F46',
      900: '#18181B',
    },
    success: { 50: '#ECFDF5', 500: '#10B981' },
    warning: { 50: '#FFF7ED', 500: '#F97316' },
    info: { 50: '#EFF6FF', 500: '#3B82F6' },
    danger: { 500: '#EF4444' },
    rejectedStroke: '#71717A',
  },
  brandGradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
  radius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 8: 48, 10: 64 },
  shadow: {
    xs: '0 1px 2px rgba(0, 0, 0, 0.04)',
    sm: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
    md: '0 4px 6px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.04)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.08), 0 4px 6px rgba(0, 0, 0, 0.04)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.10), 0 8px 10px rgba(0, 0, 0, 0.04)',
    brand: '0 4px 14px rgba(99, 102, 241, 0.30)',
  },
  ease: {
    out: 'cubic-bezier(0.16, 1, 0.3, 1)',
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  duration: { fast: 120, base: 200, slow: 320 },
} as const;

export type Tokens = typeof tokens;
```

- [ ] **Step 2: 写 src/styles/globals.css (与 tokens.ts 一一对应)**

```css
/* === Font face: 本地打包字体 (避免 CDN, 满足 CLAUDE.md 第 4 条) === */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/Inter-Regular.woff2') format('woff2');
}
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('/fonts/Inter-Medium.woff2') format('woff2');
}
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('/fonts/Inter-SemiBold.woff2') format('woff2');
}
@font-face {
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/JetBrainsMono-Regular.woff2') format('woff2');
}

:root {
  /* === Color: brand === */
  --brand-400: #818CF8;
  --brand-500: #6366F1;
  --brand-600: #4F46E5;
  --accent-500: #8B5CF6;
  --brand-gradient: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);

  /* === Color: neutral === */
  --neutral-0: #FFFFFF;
  --neutral-50: #FAFAFA;
  --neutral-100: #F4F4F5;
  --neutral-200: #E4E4E7;
  --neutral-400: #A1A1AA;
  --neutral-500: #71717A;
  --neutral-700: #3F3F46;
  --neutral-900: #18181B;

  /* === Color: functional === */
  --success-500: #10B981;
  --success-50: #ECFDF5;
  --warning-500: #F97316;
  --warning-50: #FFF7ED;
  --info-500: #3B82F6;
  --info-50: #EFF6FF;
  --danger-500: #EF4444;
  --rejected-stroke: #71717A;

  /* === Radius === */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* === Spacing === */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-8: 48px;
  --space-10: 64px;

  /* === Shadow === */
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.04);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.08), 0 4px 6px rgba(0, 0, 0, 0.04);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.10), 0 8px 10px rgba(0, 0, 0, 0.04);
  --shadow-brand: 0 4px 14px rgba(99, 102, 241, 0.30);

  /* === Ease === */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* === Duration === */
  --duration-fast: 120ms;
  --duration-base: 200ms;
  --duration-slow: 320ms;

  /* === Font === */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', Consolas, 'PingFang SC Mono', monospace;
}

* {
  box-sizing: border-box;
}

html, body, #root {
  margin: 0;
  padding: 0;
  height: 100%;
}

body {
  font-family: var(--font-sans);
  background: var(--neutral-50);
  color: var(--neutral-700);
  font-size: 14px;
  line-height: 20px;
  -webkit-font-smoothing: antialiased;
}

button {
  font-family: inherit;
  cursor: pointer;
}

/* 数字等宽 (spec §6.2.2) */
.tabular {
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 3: 写一致性测试 tests/tokens.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tokens } from '@/styles/tokens';

const cssFile = readFileSync(resolve(__dirname, '../src/styles/globals.css'), 'utf-8');

function readVar(name: string): string {
  const match = cssFile.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`CSS var --${name} not found`);
  return match[1]!.trim();
}

describe('tokens TS / CSS consistency', () => {
  it('brand colors match', () => {
    expect(readVar('brand-400')).toBe(tokens.color.brand[400]);
    expect(readVar('brand-500')).toBe(tokens.color.brand[500]);
    expect(readVar('brand-600')).toBe(tokens.color.brand[600]);
    expect(readVar('accent-500')).toBe(tokens.color.accent[500]);
  });

  it('neutral colors match', () => {
    expect(readVar('neutral-0')).toBe(tokens.color.neutral[0]);
    expect(readVar('neutral-50')).toBe(tokens.color.neutral[50]);
    expect(readVar('neutral-100')).toBe(tokens.color.neutral[100]);
    expect(readVar('neutral-200')).toBe(tokens.color.neutral[200]);
    expect(readVar('neutral-400')).toBe(tokens.color.neutral[400]);
    expect(readVar('neutral-500')).toBe(tokens.color.neutral[500]);
    expect(readVar('neutral-700')).toBe(tokens.color.neutral[700]);
    expect(readVar('neutral-900')).toBe(tokens.color.neutral[900]);
  });

  it('functional colors match', () => {
    expect(readVar('success-500')).toBe(tokens.color.success[500]);
    expect(readVar('warning-500')).toBe(tokens.color.warning[500]);
    expect(readVar('info-500')).toBe(tokens.color.info[500]);
    expect(readVar('danger-500')).toBe(tokens.color.danger[500]);
  });

  it('radius matches (CSS adds px suffix)', () => {
    expect(readVar('radius-sm')).toBe(`${tokens.radius.sm}px`);
    expect(readVar('radius-md')).toBe(`${tokens.radius.md}px`);
    expect(readVar('radius-lg')).toBe(`${tokens.radius.lg}px`);
    expect(readVar('radius-xl')).toBe(`${tokens.radius.xl}px`);
  });

  it('spacing matches', () => {
    expect(readVar('space-1')).toBe(`${tokens.space[1]}px`);
    expect(readVar('space-4')).toBe(`${tokens.space[4]}px`);
    expect(readVar('space-8')).toBe(`${tokens.space[8]}px`);
  });

  it('duration matches (CSS adds ms suffix)', () => {
    expect(readVar('duration-fast')).toBe(`${tokens.duration.fast}ms`);
    expect(readVar('duration-base')).toBe(`${tokens.duration.base}ms`);
    expect(readVar('duration-slow')).toBe(`${tokens.duration.slow}ms`);
  });
});
```

- [ ] **Step 4: 运行测试**

Run: `npm run test:run -- tests/tokens.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 提交**

```bash
mkdir -p src/styles
git add src/styles/tokens.ts src/styles/globals.css tests/tokens.test.ts
git commit -m "feat: design tokens (TS) + CSS variables with consistency tests"
```

---

### Task 1.9: 下载 Inter 与 JetBrains Mono 字体到 public/fonts/

> **关于本任务的执行**: 字体文件不能 git LFS 添加进 commit body 中。下载来源是 Google Fonts，授权 SIL Open Font License (允许商用 + 重分发)。

**Files:**
- Create (binary): `public/fonts/Inter-Regular.woff2`
- Create (binary): `public/fonts/Inter-Medium.woff2`
- Create (binary): `public/fonts/Inter-SemiBold.woff2`
- Create (binary): `public/fonts/JetBrainsMono-Regular.woff2`
- Create: `public/fonts/LICENSE.txt` (字体授权说明)

- [ ] **Step 1: 创建字体目录**

Run: `mkdir -p public/fonts`

- [ ] **Step 2: 下载 Inter Regular**

由于 Google Fonts 提供的 woff2 直链需要 User-Agent 头，使用 curl 加 UA 下载。**这是构建期一次性下载，运行时不依赖网络**。

Run:
```bash
curl -L -A "Mozilla/5.0" \
  "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2" \
  -o public/fonts/Inter-Regular.woff2
```

如果上述 URL 失效（Google 偶尔改路径），改用 Bunny Fonts 镜像：
```bash
curl -L "https://fonts.bunny.net/inter/files/inter-latin-400-normal.woff2" \
  -o public/fonts/Inter-Regular.woff2
```

Expected: 文件大小 18-25KB，`file public/fonts/Inter-Regular.woff2` 输出 "Web Open Font Format (Version 2)"。

- [ ] **Step 3: 下载 Inter Medium / SemiBold**

```bash
curl -L "https://fonts.bunny.net/inter/files/inter-latin-500-normal.woff2" \
  -o public/fonts/Inter-Medium.woff2
curl -L "https://fonts.bunny.net/inter/files/inter-latin-600-normal.woff2" \
  -o public/fonts/Inter-SemiBold.woff2
```

- [ ] **Step 4: 下载 JetBrains Mono Regular**

```bash
curl -L "https://fonts.bunny.net/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2" \
  -o public/fonts/JetBrainsMono-Regular.woff2
```

- [ ] **Step 5: 验证 4 个文件都存在且 > 10KB**

Run: `ls -la public/fonts/*.woff2`
Expected: 4 个文件，每个 10-30KB。

- [ ] **Step 6: 写 LICENSE.txt**

```
Fonts in this directory are bundled under the SIL Open Font License v1.1.

- Inter (Regular / Medium / SemiBold) by Rasmus Andersson
  https://github.com/rsms/inter
- JetBrains Mono (Regular) by JetBrains
  https://github.com/JetBrains/JetBrainsMono

SIL Open Font License: https://scripts.sil.org/OFL

Bundled locally to satisfy: zero CDN / zero external network dependency.
```

- [ ] **Step 7: 提交**

```bash
git add public/fonts/
git commit -m "chore: bundle Inter and JetBrains Mono fonts (SIL OFL)"
```

---

### Task 1.10: React 入口 + 占位 App

**Files:**
- Create: `src/main.tsx`
- Create: `src/App.tsx`

- [ ] **Step 1: 写 src/main.tsx**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 2: 写 src/App.tsx (Day 1 占位，后续天数会改写)**

```tsx
import { tokens } from './styles/tokens';

export default function App() {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: tokens.color.neutral[50],
      }}
    >
      <div
        style={{
          padding: tokens.space[6],
          background: tokens.color.neutral[0],
          borderRadius: tokens.radius.lg,
          boxShadow: tokens.shadow.sm,
          textAlign: 'center',
        }}
      >
        <h1 style={{ margin: 0, color: tokens.color.neutral[900] }}>
          视频语料标注 Demo
        </h1>
        <p style={{ marginTop: tokens.space[2], color: tokens.color.neutral[500] }}>
          骨架已就绪 · Day 1 占位
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 启动 dev server 验证**

Run: `npm run dev` (后台运行) 然后浏览器打开 http://localhost:5173
Expected: 看到「视频语料标注 Demo · 骨架已就绪」卡片，字体是 Inter。

(验证后 Ctrl+C 停止 dev server。)

- [ ] **Step 4: 验证 typecheck**

Run: `npm run typecheck`
Expected: 无报错。

- [ ] **Step 5: 验证 build**

Run: `npm run build`
Expected: 生成 `dist/` 目录，无报错。`du -sh dist/` 应该是 200-400KB（不含字体的话；有字体则 ~300-450KB）。

- [ ] **Step 6: 提交**

```bash
git add src/main.tsx src/App.tsx
git commit -m "feat: React entry + placeholder App for Day 1"
```

---

### Task 1.11: Mock 数据生成器骨架 (city-road fixture)

**Files:**
- Create: `src/data/_generators/README.md`
- Create: `src/data/_generators/city-road-fixture.ts`
- Create: `scripts/validate-fixture.mjs`

> **设计依据 (spec §4.4):** 47 标注 = 3 重点项 + 28 高置信车辆 + 12 高置信行人 + 4 高置信交通标志。三个重点项设计意图见 spec §4.2.2。

- [ ] **Step 1: 写 _generators/README.md**

```markdown
# Mock Data Generators

本目录下脚本用于生成 `src/data/*.json` 主样例与副样例。

**用法:**
```bash
npx tsx src/data/_generators/city-road-fixture.ts > src/data/city-road.json
node scripts/validate-fixture.mjs
```

**为什么不直接手写 JSON:** 47 标注 × 6 关键帧 ≈ 282 个对象，手写易出错；
脚本生成保证 schema 一致性、坐标合理性、置信度分布。

**生成器输出后必须人工 check:**
- [ ] 3 个重点项 bbox 在视频对应时间戳的画面里视觉合理
- [ ] 高置信车辆框宽高比 ≥ 1.5
- [ ] 行人框宽高比 ≤ 0.6
- [ ] 没有 bbox 越界 (坐标 < 0 或 > video 尺寸)
- [ ] 没有重复 track_id

`scripts/validate-fixture.mjs` 自动跑这些校验。
```

- [ ] **Step 2: 写 city-road-fixture.ts**

```ts
// 用法: npx tsx src/data/_generators/city-road-fixture.ts > src/data/city-road.json
//
// 生成城市道路主样例 Mock: 47 标注 + 3 重点项, 1920x1080 30s 视频。
// 设计意图 (spec §4.2.2):
//   trk_2  pedestrian  0.41  → 真行人, 机器没把握 → 虚拟主讲: ✓ 接受
//   trk_9  vehicle     0.48  → 真车辆, 框偏大需收紧 → 虚拟主讲: ✎ 改框
//   trk_5  traffic_sign 0.49 → 实际是路边广告牌, 误检 → 虚拟主讲: ✗ 否决

import type { Annotation, Dataset, Keyframe, BBox } from '../../types';

const VIDEO_W = 1920;
const VIDEO_H = 1080;
const VIDEO_DURATION_MS = 30_000;

interface Seed {
  track_id: string;
  label_id: 'pedestrian' | 'vehicle' | 'traffic_sign';
  label_display: string;
  confidence: number;
  // 起止时间 (ms)
  start: number;
  end: number;
  // 起止位置 (左上角 + 宽高), 中间帧线性插值
  startBox: BBox;
  endBox: BBox;
  is_focus?: boolean;
}

const FOCUS: Seed[] = [
  // trk_2: 行人 0.41 (✓ 接受) — 画面中下偏左, 走路过马路
  {
    track_id: 'trk_2',
    label_id: 'pedestrian',
    label_display: '行人',
    confidence: 0.41,
    start: 8000,
    end: 22000,
    startBox: [380, 620, 90, 220],
    endBox: [560, 600, 92, 215],
    is_focus: true,
  },
  // trk_9: 车辆 0.48 (✎ 改框, 框偏大) — 画面中偏右, 远处来车
  {
    track_id: 'trk_9',
    label_id: 'vehicle',
    label_display: '车辆',
    confidence: 0.48,
    start: 4000,
    end: 18000,
    startBox: [1100, 480, 320, 200],
    endBox: [900, 520, 340, 220],
    is_focus: true,
  },
  // trk_5: 交通标志 0.49 (✗ 否决, 误检为广告牌) — 画面右上, 静止
  {
    track_id: 'trk_5',
    label_id: 'traffic_sign',
    label_display: '交通标志',
    confidence: 0.49,
    start: 0,
    end: 30000,
    startBox: [1500, 120, 180, 220],
    endBox: [1500, 120, 180, 220],
    is_focus: true,
  },
];

// 用确定性 PRNG 生成可复现的随机
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20260618);

function randInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 2): number {
  const v = rng() * (max - min) + min;
  return Math.round(v * 10 ** decimals) / 10 ** decimals;
}

function buildHighConfTracks(): Seed[] {
  const out: Seed[] = [];

  // 28 高置信车辆 (宽高比 ≥ 1.5, 0.85-0.97)
  for (let i = 0; i < 28; i++) {
    const w = randInt(140, 360);
    const h = Math.floor(w / randFloat(1.5, 2.4)); // 宽高比 ≥ 1.5
    const x = randInt(0, VIDEO_W - w);
    const y = randInt(420, VIDEO_H - h);
    const start = randInt(0, VIDEO_DURATION_MS - 4000);
    const end = Math.min(VIDEO_DURATION_MS, start + randInt(3000, 12000));
    const dx = randInt(-80, 80);
    const dy = randInt(-30, 30);
    out.push({
      track_id: `trk_v${i + 1}`,
      label_id: 'vehicle',
      label_display: '车辆',
      confidence: randFloat(0.85, 0.97),
      start,
      end,
      startBox: [x, y, w, h],
      endBox: [Math.max(0, Math.min(VIDEO_W - w, x + dx)), Math.max(0, Math.min(VIDEO_H - h, y + dy)), w, h],
    });
  }

  // 12 高置信行人 (宽高比 ≤ 0.6, 0.78-0.94)
  for (let i = 0; i < 12; i++) {
    const h = randInt(180, 280);
    const w = Math.floor(h * randFloat(0.35, 0.6));
    const x = randInt(0, VIDEO_W - w);
    const y = randInt(560, VIDEO_H - h);
    const start = randInt(0, VIDEO_DURATION_MS - 4000);
    const end = Math.min(VIDEO_DURATION_MS, start + randInt(3000, 10000));
    out.push({
      track_id: `trk_p${i + 1}`,
      label_id: 'pedestrian',
      label_display: '行人',
      confidence: randFloat(0.78, 0.94),
      start,
      end,
      startBox: [x, y, w, h],
      endBox: [Math.max(0, Math.min(VIDEO_W - w, x + randInt(-40, 40))), y, w, h],
    });
  }

  // 4 高置信交通标志 (画面上部, 静止, 0.82-0.93)
  for (let i = 0; i < 4; i++) {
    const w = randInt(80, 160);
    const h = randInt(80, 160);
    const x = randInt(0, VIDEO_W - w);
    const y = randInt(60, 320);
    out.push({
      track_id: `trk_s${i + 1}`,
      label_id: 'traffic_sign',
      label_display: '交通标志',
      confidence: randFloat(0.82, 0.93),
      start: 0,
      end: VIDEO_DURATION_MS,
      startBox: [x, y, w, h],
      endBox: [x, y, w, h],
    });
  }

  return out;
}

function generateKeyframes(seed: Seed): Keyframe[] {
  // 5-8 个关键帧, 均匀分布
  const count = randInt(5, 8);
  const frames: Keyframe[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const ts = Math.round(seed.start + (seed.end - seed.start) * t);
    const x = Math.round(seed.startBox[0] + (seed.endBox[0] - seed.startBox[0]) * t);
    const y = Math.round(seed.startBox[1] + (seed.endBox[1] - seed.startBox[1]) * t);
    const w = Math.round(seed.startBox[2] + (seed.endBox[2] - seed.startBox[2]) * t);
    const h = Math.round(seed.startBox[3] + (seed.endBox[3] - seed.startBox[3]) * t);
    frames.push({
      timestamp_ms: ts,
      frame_no: Math.round((ts / 1000) * 30),
      geometry: { type: 'bbox', coords: [x, y, w, h] },
      is_keyframe: true,
    });
  }
  return frames;
}

function seedToAnnotation(seed: Seed): Annotation {
  return {
    version: '2.0-demo',
    track_id: seed.track_id,
    label_id: seed.label_id,
    label_display: seed.label_display,
    source: 'machine',
    confidence: seed.confidence,
    needs_review: seed.confidence < 0.5,
    keyframes: generateKeyframes(seed),
    review: { status: 'pending', changed_frames: 0, reviewed_at: null },
  };
}

function buildDataset(): Dataset {
  const all = [...FOCUS, ...buildHighConfTracks()];
  const annotations = all.map(seedToAnnotation);

  return {
    version: '2.0-demo',
    dataset_id: 'city-road',
    display: '城市道路样例',
    video_src: '/mock/city-road/road_demo.mp4',
    thumb: '/mock/city-road/road_thumb.jpg',
    metadata: {
      duration_ms: 30000,
      frame_count: 900,
      fps: 30.0,
      width: 1920,
      height: 1080,
      codec: 'h264',
      audio_tracks: 1,
      sampled_frames: 132,
    },
    annotations,
    demo_script: {
      metadata_reveal_ms: 1500,
      inference_reveal_ms: 2500,
      review_focus_ids: ['trk_2', 'trk_9', 'trk_5'],
    },
  };
}

const dataset = buildDataset();
console.log(JSON.stringify(dataset, null, 2));
```

- [ ] **Step 3: 安装 tsx 用于运行 TS 脚本**

Run: `npm install -D tsx`
Expected: `tsx` 添加到 devDependencies。

- [ ] **Step 4: 运行生成器, 输出主样例 JSON**

Run:
```bash
mkdir -p src/data
npx tsx src/data/_generators/city-road-fixture.ts > src/data/city-road.json
```

Expected: 生成 `src/data/city-road.json`, 大小 50-80KB, head 是 `{` 开头, 包含 `"annotations": [` 数组共 47 项。

验证：
```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('src/data/city-road.json','utf8')).annotations.length)"
```
Expected: `47`

- [ ] **Step 5: 写 validate-fixture.mjs**

```js
// scripts/validate-fixture.mjs
// 用法: node scripts/validate-fixture.mjs
// 校验 src/data/*.json 是否合规

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const dataDir = resolve(process.cwd(), 'src/data');
const files = readdirSync(dataDir).filter(f => f.endsWith('.json'));

let failed = 0;

for (const file of files) {
  const path = resolve(dataDir, file);
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  const errs = [];

  // 1. 重复 track_id
  const ids = data.annotations.map(a => a.track_id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length > 0) errs.push(`重复 track_id: ${[...new Set(dup)].join(', ')}`);

  // 2. bbox 越界
  const { width: W, height: H } = data.metadata;
  for (const a of data.annotations) {
    for (const kf of a.keyframes) {
      const [x, y, w, h] = kf.geometry.coords;
      if (x < 0 || y < 0 || x + w > W || y + h > H) {
        errs.push(`${a.track_id} @ ${kf.timestamp_ms}ms bbox [${x},${y},${w},${h}] 越界 (视频 ${W}x${H})`);
      }
    }
  }

  // 3. 高置信车辆宽高比 ≥ 1.5
  for (const a of data.annotations) {
    if (a.label_id === 'vehicle' && (a.confidence ?? 0) >= 0.78) {
      const kf = a.keyframes[0];
      const [, , w, h] = kf.geometry.coords;
      if (w / h < 1.5) errs.push(`${a.track_id} 高置信车辆宽高比 ${(w / h).toFixed(2)} < 1.5`);
    }
  }

  // 4. 行人宽高比 ≤ 0.6
  for (const a of data.annotations) {
    if (a.label_id === 'pedestrian' && (a.confidence ?? 0) >= 0.78) {
      const kf = a.keyframes[0];
      const [, , w, h] = kf.geometry.coords;
      if (w / h > 0.6) errs.push(`${a.track_id} 高置信行人宽高比 ${(w / h).toFixed(2)} > 0.6`);
    }
  }

  // 5. review_focus_ids 必须存在于 annotations
  for (const id of data.demo_script.review_focus_ids) {
    if (!ids.includes(id)) errs.push(`review_focus_ids 中的 ${id} 在 annotations 里不存在`);
  }

  if (errs.length > 0) {
    console.error(`\n❌ ${file} 校验失败:`);
    errs.forEach(e => console.error('  -', e));
    failed++;
  } else {
    console.log(`✓ ${file} ok (${data.annotations.length} 标注)`);
  }
}

if (failed > 0) process.exit(1);
console.log('\n所有 fixture 校验通过');
```

- [ ] **Step 6: 运行校验**

Run:
```bash
mkdir -p scripts
node scripts/validate-fixture.mjs
```

Expected: 输出 `✓ city-road.json ok (47 标注)` 和 `所有 fixture 校验通过`。**如果有越界/比例错误**, 修改 city-road-fixture.ts 中对应类别的随机参数范围, 重新生成 + 校验, 直到通过。

- [ ] **Step 7: 提交**

```bash
git add src/data/_generators/ src/data/city-road.json scripts/validate-fixture.mjs package.json package-lock.json
git commit -m "feat: city-road master fixture (47 annotations, 3 focus items)"
```

---

### Task 1.12: 数据集注册 src/data/index.ts (Day 1 仅注册主样例)

**Files:**
- Create: `src/data/index.ts`

> **注:** Day 5 会补副样例 JSON 和注册行；Day 1 先只注册主样例。

- [ ] **Step 1: 写 src/data/index.ts**

```ts
import type { Dataset, DatasetId } from '../types';
import { DatasetSchema } from '../types.zod';
import cityRoad from './city-road.json';

// 启动期 zod 校验, 数据有问题立即抛错
const cityRoadValidated = DatasetSchema.parse(cityRoad) as Dataset;

export const defaultDatasets: Partial<Record<DatasetId, Dataset>> = {
  'city-road': cityRoadValidated,
  // Day 5 补 'meeting-room' 与 'retail-cam'
};

export const defaultDatasetId: DatasetId = 'city-road';

export function getDataset(id: DatasetId): Dataset {
  const ds = defaultDatasets[id];
  if (!ds) throw new Error(`Dataset not registered: ${id}`);
  return ds;
}
```

- [ ] **Step 2: 验证 typecheck**

Run: `npm run typecheck`
Expected: 无报错。

- [ ] **Step 3: 写 tests/data.test.ts 验证数据集加载与 zod 校验通过**

```ts
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
```

- [ ] **Step 4: 运行测试**

Run: `npm run test:run -- tests/data.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 提交**

```bash
git add src/data/index.ts tests/data.test.ts
git commit -m "feat: dataset registry with zod validation"
```

---

### Task 1.13: 初始 Mock 快照工厂 (src/store/snapshots.ts)

**Files:**
- Create: `src/store/snapshots.ts`
- Create: `tests/snapshots.test.ts`

- [ ] **Step 1: 写 tests/snapshots.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { createSnapshot } from '@/store/snapshots';
import { getDataset } from '@/data';

describe('snapshot factory', () => {
  it('creates a deep clone of dataset annotations', () => {
    const snap = createSnapshot('city-road');
    const source = getDataset('city-road');
    expect(snap.annotations).toEqual(source.annotations);
    expect(snap.annotations).not.toBe(source.annotations);
    expect(snap.annotations[0]).not.toBe(source.annotations[0]);
  });

  it('mutating snapshot does not affect source dataset', () => {
    const snap = createSnapshot('city-road');
    const source = getDataset('city-road');
    snap.annotations[0]!.review.status = 'accepted';
    expect(source.annotations[0]!.review.status).toBe('pending');
  });

  it('two snapshots are independent', () => {
    const a = createSnapshot('city-road');
    const b = createSnapshot('city-road');
    a.annotations[0]!.review.status = 'accepted';
    expect(b.annotations[0]!.review.status).toBe('pending');
  });

  it('snapshot includes initial demo state', () => {
    const snap = createSnapshot('city-road');
    expect(snap.demoStep).toBe(1);
    expect(snap.playMode).toBe('manual');
    expect(snap.paused).toBe(false);
    expect(snap.dirty).toBe(false);
    expect(snap.selectedTrackId).toBeNull();
    expect(snap.reviewQueueIndex).toBe(0);
    expect(snap.undoStack).toEqual([]);
    expect(snap.revealProgress).toEqual({
      metadataFieldsShown: 0,
      inferenceProgress: 0,
      boxesRevealed: 0,
    });
  });
});
```

- [ ] **Step 2: 运行测试以确认失败**

Run: `npm run test:run -- tests/snapshots.test.ts`
Expected: FAIL — `Cannot find module '@/store/snapshots'`

- [ ] **Step 3: 写 src/store/snapshots.ts**

```ts
import type { AnnotationState, DatasetId, DemoStep, PlayMode, ReviewAction, Speed } from '../types';
import { deepClone } from '../lib/deepClone';
import { getDataset } from '../data';

export interface RevealProgress {
  metadataFieldsShown: number;
  inferenceProgress: number;
  boxesRevealed: number;
}

export interface Snapshot {
  // 编排
  demoStep: DemoStep;
  playMode: PlayMode;
  speed: Speed;
  paused: boolean;
  dirty: boolean;

  // 当前样例
  activeDatasetId: DatasetId;

  // 标注内存状态 (深拷贝自 dataset)
  annotations: AnnotationState[];

  // Step 4 UI 子状态
  selectedTrackId: string | null;
  reviewQueueIndex: number;

  // 揭示动画进度
  revealProgress: RevealProgress;

  // 撤销栈
  undoStack: ReviewAction[];
}

/**
 * 从指定数据集生成一份初始快照。
 * 关键: annotations 通过 deepClone 拷贝, 后续审核操作改它不会污染源数据。
 *
 * 用于:
 *   - 应用启动时的初始 store 状态 (initialState)
 *   - reset() 时整体替换 store
 *   - selectDataset(id) 切换样例时整体替换 store
 */
export function createSnapshot(datasetId: DatasetId): Snapshot {
  const dataset = getDataset(datasetId);
  return {
    demoStep: 1,
    playMode: 'manual',
    speed: '1x',
    paused: false,
    dirty: false,
    activeDatasetId: datasetId,
    annotations: deepClone(dataset.annotations),
    selectedTrackId: null,
    reviewQueueIndex: 0,
    revealProgress: {
      metadataFieldsShown: 0,
      inferenceProgress: 0,
      boxesRevealed: 0,
    },
    undoStack: [],
  };
}
```

- [ ] **Step 4: 运行测试以确认通过**

Run: `npm run test:run -- tests/snapshots.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 提交**

```bash
mkdir -p src/store
git add src/store/snapshots.ts tests/snapshots.test.ts
git commit -m "feat: snapshot factory with deep-clone isolation"
```

---

### Task 1.14: 撤销栈 (src/store/undo.ts)

**Files:**
- Create: `src/store/undo.ts`
- Create: `tests/undo.test.ts`

- [ ] **Step 1: 写 tests/undo.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { applyUndo, pushUndo, UNDO_STACK_LIMIT } from '@/store/undo';
import type { AnnotationState, ReviewAction } from '@/types';

function makeAnnotation(overrides: Partial<AnnotationState> = {}): AnnotationState {
  return {
    version: '2.0-demo',
    track_id: 'trk_t',
    label_id: 'pedestrian',
    label_display: '行人',
    source: 'machine',
    confidence: 0.41,
    needs_review: true,
    keyframes: [
      {
        timestamp_ms: 1000,
        frame_no: 30,
        geometry: { type: 'bbox', coords: [10, 20, 30, 40] },
        is_keyframe: true,
      },
    ],
    review: { status: 'pending', changed_frames: 0, reviewed_at: null },
    ...overrides,
  };
}

describe('undo stack', () => {
  it('pushUndo respects limit, drops oldest', () => {
    let stack: ReviewAction[] = [];
    for (let i = 0; i < UNDO_STACK_LIMIT + 5; i++) {
      stack = pushUndo(stack, { type: 'accept', trackId: `t${i}`, prevStatus: 'pending', prevSource: 'machine' });
    }
    expect(stack.length).toBe(UNDO_STACK_LIMIT);
    // 最旧的 5 个被丢弃
    expect((stack[0] as Extract<ReviewAction, { type: 'accept' }>).trackId).toBe('t5');
  });

  it('applyUndo of accept reverts review.status to prevStatus', () => {
    const ann = makeAnnotation({
      track_id: 'trk_t',
      review: { status: 'accepted', changed_frames: 0, reviewed_at: 12345 },
    });
    const action: ReviewAction = { type: 'accept', trackId: 'trk_t', prevStatus: 'pending', prevSource: 'machine' };
    const annotations = [ann];
    applyUndo(annotations, action);
    expect(annotations[0]!.review.status).toBe('pending');
    expect(annotations[0]!.source).toBe('machine');
  });

  it('applyUndo of reject reverts to prevStatus', () => {
    const ann = makeAnnotation({
      review: { status: 'rejected', changed_frames: 0, reviewed_at: 12345 },
    });
    const action: ReviewAction = { type: 'reject', trackId: 'trk_t', prevStatus: 'pending' };
    const annotations = [ann];
    applyUndo(annotations, action);
    expect(annotations[0]!.review.status).toBe('pending');
  });

  it('applyUndo of correct-geometry restores prev coords and source', () => {
    const ann = makeAnnotation({
      source: 'human',
      review: { status: 'corrected', changed_frames: 1, reviewed_at: 12345 },
    });
    ann.keyframes[0]!.geometry.coords = [100, 200, 300, 400];
    const action: ReviewAction = {
      type: 'correct-geometry',
      trackId: 'trk_t',
      frameIdx: 0,
      prevCoords: [10, 20, 30, 40],
      prevSource: 'machine',
    };
    const annotations = [ann];
    applyUndo(annotations, action);
    expect(annotations[0]!.keyframes[0]!.geometry.coords).toEqual([10, 20, 30, 40]);
    expect(annotations[0]!.source).toBe('machine');
  });
});
```

- [ ] **Step 2: 运行测试以确认失败**

Run: `npm run test:run -- tests/undo.test.ts`
Expected: FAIL — `Cannot find module '@/store/undo'`

- [ ] **Step 3: 写 src/store/undo.ts**

```ts
import type { AnnotationState, ReviewAction } from '../types';

export const UNDO_STACK_LIMIT = 20;

/**
 * push 一个 action 到栈，超过上限则丢弃最旧的。
 * 不可变地返回新数组（Zustand + immer 会处理引用问题）。
 */
export function pushUndo(stack: ReviewAction[], action: ReviewAction): ReviewAction[] {
  const next = [...stack, action];
  if (next.length > UNDO_STACK_LIMIT) {
    return next.slice(next.length - UNDO_STACK_LIMIT);
  }
  return next;
}

/**
 * 就地把 annotations 数组按 action 反向恢复。
 * 在 Zustand store 的 immer producer 中调用即可。
 */
export function applyUndo(annotations: AnnotationState[], action: ReviewAction): void {
  const target = annotations.find(a => a.track_id === action.trackId);
  if (!target) return;

  switch (action.type) {
    case 'accept':
      target.review.status = action.prevStatus;
      target.review.reviewed_at = null;
      target.source = action.prevSource;
      break;
    case 'reject':
      target.review.status = action.prevStatus;
      target.review.reviewed_at = null;
      break;
    case 'correct-geometry': {
      const kf = target.keyframes[action.frameIdx];
      if (kf) {
        kf.geometry.coords = [...action.prevCoords] as typeof kf.geometry.coords;
      }
      target.source = action.prevSource;
      // 注意: review.status 不在这里改, 因为同一 track 可能有多次 correct, 各自只对应一帧
      // 简化策略: 只恢复 source; review.status 留待 store action 决定
      break;
    }
  }
}
```

- [ ] **Step 4: 运行测试以确认通过**

Run: `npm run test:run -- tests/undo.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 提交**

```bash
git add src/store/undo.ts tests/undo.test.ts
git commit -m "feat: undo stack with 20-action limit and reverse application"
```

---

### Task 1.15: Zustand 全局 store

> **Day 1 此任务篇幅大, 是 store 骨架, 后续天数会扩展。** 本任务覆盖编排状态机 + 重置 + selectDataset, 以及审核动作的雏形（含 dirty 标记、写 review、写 undoStack）。Day 6 会补 setSpeed/togglePlayMode 的事件副作用，Day 4 会接 store 到 Step 5 导出。

**Files:**
- Create: `src/store/demoStore.ts`
- Create: `tests/store.test.ts`

- [ ] **Step 1: 写 tests/store.test.ts**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useDemoStore } from '@/store/demoStore';
import { getDataset } from '@/data';

describe('demoStore', () => {
  beforeEach(() => {
    // 每个测试重置成初始 city-road 快照
    useDemoStore.getState().selectDataset('city-road');
  });

  // ── 编排状态机 ──────────────────────────────────────────
  it('initial state matches snapshot defaults', () => {
    const s = useDemoStore.getState();
    expect(s.demoStep).toBe(1);
    expect(s.playMode).toBe('manual');
    expect(s.speed).toBe('1x');
    expect(s.activeDatasetId).toBe('city-road');
    expect(s.annotations.length).toBe(47);
    expect(s.dirty).toBe(false);
  });

  it('goToStep updates demoStep', () => {
    useDemoStore.getState().goToStep(3);
    expect(useDemoStore.getState().demoStep).toBe(3);
  });

  it('setSpeed updates speed', () => {
    useDemoStore.getState().setSpeed('2x');
    expect(useDemoStore.getState().speed).toBe('2x');
  });

  // ── 重置（CLAUDE.md 第 3 条硬约束）─────────────────────
  it('reset deep-clones annotations, source data unaffected', () => {
    useDemoStore.getState().acceptBox('trk_2');
    expect(useDemoStore.getState().annotations.find(a => a.track_id === 'trk_2')!.review.status).toBe('accepted');

    useDemoStore.getState().reset();
    expect(useDemoStore.getState().annotations.find(a => a.track_id === 'trk_2')!.review.status).toBe('pending');

    // 关键: 源数据集没被污染
    const sourceDataset = getDataset('city-road');
    expect(sourceDataset.annotations.find(a => a.track_id === 'trk_2')!.review.status).toBe('pending');
  });

  it('reset preserves activeDatasetId and speed', () => {
    useDemoStore.getState().setSpeed('2x');
    useDemoStore.getState().acceptBox('trk_2');
    useDemoStore.getState().reset();
    expect(useDemoStore.getState().activeDatasetId).toBe('city-road');
    expect(useDemoStore.getState().speed).toBe('2x');
    expect(useDemoStore.getState().demoStep).toBe(1);
    expect(useDemoStore.getState().dirty).toBe(false);
  });

  it('reset clears undo stack', () => {
    useDemoStore.getState().acceptBox('trk_2');
    expect(useDemoStore.getState().undoStack.length).toBe(1);
    useDemoStore.getState().reset();
    expect(useDemoStore.getState().undoStack.length).toBe(0);
  });

  // ── 审核动作 ───────────────────────────────────────────
  it('acceptBox sets review.status to accepted and marks dirty', () => {
    useDemoStore.getState().acceptBox('trk_2');
    const s = useDemoStore.getState();
    const ann = s.annotations.find(a => a.track_id === 'trk_2')!;
    expect(ann.review.status).toBe('accepted');
    expect(ann.review.reviewed_at).not.toBeNull();
    expect(s.dirty).toBe(true);
  });

  it('rejectBox sets review.status to rejected', () => {
    useDemoStore.getState().rejectBox('trk_5');
    const ann = useDemoStore.getState().annotations.find(a => a.track_id === 'trk_5')!;
    expect(ann.review.status).toBe('rejected');
  });

  it('correctBoxGeometry updates coords, source becomes human, status corrected', () => {
    useDemoStore.getState().correctBoxGeometry('trk_9', 0, [100, 200, 300, 400]);
    const ann = useDemoStore.getState().annotations.find(a => a.track_id === 'trk_9')!;
    expect(ann.keyframes[0]!.geometry.coords).toEqual([100, 200, 300, 400]);
    expect(ann.source).toBe('human');
    expect(ann.review.status).toBe('corrected');
  });

  // ── 撤销 ──────────────────────────────────────────────
  it('undo reverts the last accept', () => {
    const before = useDemoStore.getState().annotations.find(a => a.track_id === 'trk_2')!.review.status;
    useDemoStore.getState().acceptBox('trk_2');
    useDemoStore.getState().undo();
    const after = useDemoStore.getState().annotations.find(a => a.track_id === 'trk_2')!.review.status;
    expect(after).toBe(before);
  });

  it('undo on empty stack is a no-op', () => {
    expect(() => useDemoStore.getState().undo()).not.toThrow();
  });

  it('acceptAllRemaining accepts all pending non-rejected non-corrected', () => {
    useDemoStore.getState().rejectBox('trk_5');           // 1 个拒绝
    useDemoStore.getState().acceptAllRemaining();
    const remaining = useDemoStore.getState().annotations.filter(a => a.review.status === 'pending');
    expect(remaining.length).toBe(0);
    const accepted = useDemoStore.getState().annotations.filter(a => a.review.status === 'accepted').length;
    expect(accepted).toBe(46); // 47 - 1 rejected
  });

  it('acceptAllRemaining does NOT push to undo stack (batch op)', () => {
    const before = useDemoStore.getState().undoStack.length;
    useDemoStore.getState().acceptAllRemaining();
    expect(useDemoStore.getState().undoStack.length).toBe(before);
  });

  // ── selectDataset ─────────────────────────────────────
  it('selectDataset replaces store with new snapshot', () => {
    useDemoStore.getState().acceptBox('trk_2');
    expect(useDemoStore.getState().dirty).toBe(true);

    useDemoStore.getState().selectDataset('city-road');  // 重新选同一个 = 重置
    expect(useDemoStore.getState().annotations.find(a => a.track_id === 'trk_2')!.review.status).toBe('pending');
    expect(useDemoStore.getState().dirty).toBe(false);
  });

  // ── canAdvanceFromStep4 (防呆 helper) ────────────────
  it('canAdvanceFromStep4 returns false when focus items have pending', () => {
    expect(useDemoStore.getState().canAdvanceFromStep4()).toBe(false);
  });

  it('canAdvanceFromStep4 returns true after all focus items reviewed', () => {
    useDemoStore.getState().acceptBox('trk_2');
    useDemoStore.getState().correctBoxGeometry('trk_9', 0, [100, 200, 300, 400]);
    useDemoStore.getState().rejectBox('trk_5');
    expect(useDemoStore.getState().canAdvanceFromStep4()).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试以确认失败**

Run: `npm run test:run -- tests/store.test.ts`
Expected: FAIL — `Cannot find module '@/store/demoStore'`

- [ ] **Step 3: 写 src/store/demoStore.ts**

```ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  AnnotationSource,
  AnnotationState,
  BBox,
  DatasetId,
  DemoStep,
  PlayMode,
  ReviewAction,
  Speed,
} from '../types';
import { createSnapshot, type RevealProgress, type Snapshot } from './snapshots';
import { applyUndo, pushUndo } from './undo';
import { getDataset } from '../data';

export interface DemoStore extends Snapshot {
  // ── 编排 ────────────────────────────────────────────
  goToStep: (step: DemoStep) => void;
  togglePlayMode: () => void;
  setSpeed: (s: Speed) => void;
  pause: () => void;
  resume: () => void;

  // ── 样例 / 重置 ─────────────────────────────────────
  selectDataset: (id: DatasetId) => void;
  reset: () => void;

  // ── 审核 ────────────────────────────────────────────
  acceptBox: (trackId: string) => void;
  rejectBox: (trackId: string) => void;
  correctBoxGeometry: (trackId: string, frameIdx: number, newCoords: BBox) => void;
  acceptAllRemaining: () => void;
  selectTrack: (id: string | null) => void;
  setReviewQueueIndex: (idx: number) => void;

  // ── 撤销 ────────────────────────────────────────────
  undo: () => void;

  // ── 揭示动画进度 ────────────────────────────────────
  setRevealProgress: (p: Partial<RevealProgress>) => void;

  // ── Helpers / Selectors ─────────────────────────────
  canAdvanceFromStep4: () => boolean;
}

const initial = createSnapshot('city-road');

export const useDemoStore = create<DemoStore>()(
  immer((set, get) => ({
    ...initial,

    // ── 编排 ────────────────────────────────────────────
    goToStep: (step) =>
      set((s) => {
        s.demoStep = step;
      }),

    togglePlayMode: () =>
      set((s) => {
        s.playMode = s.playMode === 'manual' ? 'auto' : 'manual';
        s.paused = false;
      }),

    setSpeed: (speed) =>
      set((s) => {
        s.speed = speed;
      }),

    pause: () =>
      set((s) => {
        if (s.playMode === 'auto') s.paused = true;
      }),

    resume: () =>
      set((s) => {
        if (s.playMode === 'auto') s.paused = false;
      }),

    // ── 样例 / 重置 ─────────────────────────────────────
    selectDataset: (id) => {
      const fresh = createSnapshot(id);
      // 保留 speed (CLAUDE.md 决策 #7: 同样例重演也走这条, 但 speed 保留)
      const currentSpeed = get().speed;
      set(() => ({ ...fresh, speed: currentSpeed }));
    },

    reset: () => {
      const id = get().activeDatasetId;
      const fresh = createSnapshot(id);
      const currentSpeed = get().speed;
      // 保留 activeDatasetId 与 speed (spec §2.2)
      set(() => ({ ...fresh, activeDatasetId: id, speed: currentSpeed }));
    },

    // ── 审核 ────────────────────────────────────────────
    acceptBox: (trackId) =>
      set((s) => {
        const ann = s.annotations.find((a: AnnotationState) => a.track_id === trackId);
        if (!ann) return;
        const prevStatus = ann.review.status;
        const prevSource: AnnotationSource = ann.source;
        ann.review.status = 'accepted';
        ann.review.reviewed_at = Date.now();
        s.dirty = true;
        s.undoStack = pushUndo(s.undoStack, {
          type: 'accept',
          trackId,
          prevStatus,
          prevSource,
        });
      }),

    rejectBox: (trackId) =>
      set((s) => {
        const ann = s.annotations.find((a: AnnotationState) => a.track_id === trackId);
        if (!ann) return;
        const prevStatus = ann.review.status;
        ann.review.status = 'rejected';
        ann.review.reviewed_at = Date.now();
        s.dirty = true;
        s.undoStack = pushUndo(s.undoStack, { type: 'reject', trackId, prevStatus });
      }),

    correctBoxGeometry: (trackId, frameIdx, newCoords) =>
      set((s) => {
        const ann = s.annotations.find((a: AnnotationState) => a.track_id === trackId);
        if (!ann) return;
        const kf = ann.keyframes[frameIdx];
        if (!kf) return;
        const prevCoords = [...kf.geometry.coords] as BBox;
        const prevSource: AnnotationSource = ann.source;
        kf.geometry.coords = [...newCoords] as BBox;
        ann.source = 'human';
        ann.review.status = 'corrected';
        ann.review.changed_frames += 1;
        ann.review.reviewed_at = Date.now();
        s.dirty = true;
        s.undoStack = pushUndo(s.undoStack, {
          type: 'correct-geometry',
          trackId,
          frameIdx,
          prevCoords,
          prevSource,
        });
      }),

    acceptAllRemaining: () =>
      set((s) => {
        const now = Date.now();
        for (const ann of s.annotations) {
          if (ann.review.status === 'pending') {
            ann.review.status = 'accepted';
            ann.review.reviewed_at = now;
          }
        }
        s.dirty = true;
        // 注意: 批量操作不入 undoStack (spec §2.4.2)
      }),

    selectTrack: (id) =>
      set((s) => {
        s.selectedTrackId = id;
      }),

    setReviewQueueIndex: (idx) =>
      set((s) => {
        s.reviewQueueIndex = idx;
      }),

    // ── 撤销 ────────────────────────────────────────────
    undo: () =>
      set((s) => {
        const action = s.undoStack[s.undoStack.length - 1];
        if (!action) return;
        s.undoStack = s.undoStack.slice(0, -1);
        applyUndo(s.annotations, action as ReviewAction);
        // 撤销 correct-geometry 时, 如果该 track 没有其他 correct 操作, 把 status 恢复成 pending
        if (action.type === 'correct-geometry') {
          const ann = s.annotations.find((a: AnnotationState) => a.track_id === action.trackId);
          if (ann && ann.review.changed_frames > 0) {
            ann.review.changed_frames -= 1;
            if (ann.review.changed_frames === 0) {
              ann.review.status = 'pending';
              ann.review.reviewed_at = null;
            }
          }
        }
        // 简化: dirty 保持 true (即使栈空了, 用户对 store 改过仍记为 dirty)
      }),

    // ── 揭示动画 ────────────────────────────────────────
    setRevealProgress: (p) =>
      set((s) => {
        s.revealProgress = { ...s.revealProgress, ...p };
      }),

    // ── Helpers ────────────────────────────────────────
    canAdvanceFromStep4: () => {
      const s = get();
      const ds = getDataset(s.activeDatasetId);
      const focusIds = ds.demo_script.review_focus_ids;
      const focus = s.annotations.filter((a) => focusIds.includes(a.track_id));
      return focus.every((a) => a.review.status !== 'pending');
    },
  })),
);
```

- [ ] **Step 4: 运行测试以确认通过**

Run: `npm run test:run -- tests/store.test.ts`
Expected: PASS (15 tests)

如果有失败：

- "selectDataset reset dirty" 测试失败 → 检查 `selectDataset` 是否真的整体替换 (而不是 partial)
- "undo on empty stack" 抛错 → 检查 `s.undoStack[s.undoStack.length - 1]` 在空数组下返回 undefined

- [ ] **Step 5: 性能基准: 重置耗时 < 200ms**

写一个临时手测：

```bash
cat > tests/perf.test.ts <<'EOF'
import { describe, it, expect } from 'vitest';
import { useDemoStore } from '@/store/demoStore';

describe('reset performance', () => {
  it('reset finishes under 200ms (PRD §10 hard line)', () => {
    useDemoStore.getState().acceptAllRemaining();
    const t0 = performance.now();
    useDemoStore.getState().reset();
    const dur = performance.now() - t0;
    expect(dur).toBeLessThan(200);
  });
});
EOF
npm run test:run -- tests/perf.test.ts
```

Expected: PASS, 实际耗时输出在测试 log 里 (典型 < 20ms, 离 200ms 红线很远)。

- [ ] **Step 6: 提交**

```bash
git add src/store/demoStore.ts tests/store.test.ts tests/perf.test.ts
git commit -m "feat: Zustand store with state machine, reset, review, undo, advance-gate"
```

---

### Task 1.16: 占位视频生成 (供后续步骤展示画面)

**Files:**
- Create (binary): `public/mock/city-road/road_demo.mp4` (占位 30s 黑屏)
- Create (binary): `public/mock/city-road/road_thumb.jpg` (占位缩略图)
- Create: `public/mock/city-road/frames/.gitkeep` (空帧目录)

> **依赖:** 需要本地有 `ffmpeg` 命令可用。如无则 `brew install ffmpeg` (macOS) 或 `winget install Gyan.FFmpeg` (Windows)。

- [ ] **Step 1: 验证 ffmpeg 可用**

Run: `ffmpeg -version 2>&1 | head -1`
Expected: 输出 `ffmpeg version X.Y.Z` 一行。

- [ ] **Step 2: 生成 30s 黑屏 + 时间戳水印的占位视频**

```bash
mkdir -p public/mock/city-road/frames
ffmpeg -y -f lavfi -i color=c=black:s=1920x1080:d=30 \
  -vf "drawtext=text='%{pts\\:hms}':x=10:y=10:fontsize=48:fontcolor=white" \
  -c:v libx264 -pix_fmt yuv420p -crf 28 -r 30 \
  public/mock/city-road/road_demo.mp4 2>&1 | tail -5
```

Expected: 文件大小 200-600KB (黑屏压缩很狠)。`ffprobe public/mock/city-road/road_demo.mp4 2>&1 | grep "Duration"` 应输出 `Duration: 00:00:30.00`。

- [ ] **Step 3: 生成占位缩略图**

```bash
ffmpeg -y -i public/mock/city-road/road_demo.mp4 -vf "select='eq(n,0)'" -vframes 1 \
  public/mock/city-road/road_thumb.jpg 2>&1 | tail -3
```

Expected: ~10-30KB jpg。

- [ ] **Step 4: 生成 2 张占位帧 (供 Day 4 导出 zip 使用)**

```bash
ffmpeg -y -i public/mock/city-road/road_demo.mp4 \
  -vf "select='eq(n,100)+eq(n,300)'" -vsync vfr \
  public/mock/city-road/frames/%04d.jpg 2>&1 | tail -3
```

Expected: 2 张 jpg 在 frames/ 下（命名 0001.jpg / 0002.jpg）。重命名为时间戳格式：

```bash
cd public/mock/city-road/frames
mv 0001.jpg 00003333.jpg
mv 0002.jpg 00010000.jpg
cd -
```

- [ ] **Step 5: 创建占位副样例视频/缩略图（Day 5 接入时不阻塞）**

副样例视频 Day 5 才用到, 此时不必生成。但为防 import 报错, 留空目录:

```bash
mkdir -p public/mock/meeting-room/frames public/mock/retail-cam/frames
touch public/mock/meeting-room/.gitkeep public/mock/retail-cam/.gitkeep
```

- [ ] **Step 6: 提交**

```bash
git add public/mock/
git commit -m "chore: placeholder city-road video + thumb + frames (30s black + timestamps)"
```

---

### Task 1.17: 验证 Day 1 全栈可启动 + 整体提交

**Files:**
- (无新建文件, 只是验证)

- [ ] **Step 1: 跑全部单测确认绿色**

Run: `npm run test:run`
Expected: 所有测试通过 (本阶段总计约 27 个 test)。

```
 ✓ tests/deepClone.test.ts (3)
 ✓ tests/tokens.test.ts (6)
 ✓ tests/data.test.ts (4)
 ✓ tests/snapshots.test.ts (4)
 ✓ tests/undo.test.ts (4)
 ✓ tests/store.test.ts (15)
 ✓ tests/perf.test.ts (1)
```

(实际 test 数会随实现略有出入, 大约 25-35 之间。)

- [ ] **Step 2: typecheck 干净**

Run: `npm run typecheck`
Expected: 无报错输出, exit code 0。

- [ ] **Step 3: build 成功**

Run: `npm run build`
Expected: 生成 `dist/` 目录。`du -sh dist/` 应 < 800KB（无视频/字体的话；含字体则 ~1MB；目前还没有视频被打包，因为视频在 public/mock/ 下会被复制进 dist 但不会被 bundle）。

- [ ] **Step 4: 离线启动验证**

```bash
npx vite preview --port 4173 &
PREVIEW_PID=$!
sleep 2
# 用 curl 检查首页是否能正常返回
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4173/
# 期望: 200
kill $PREVIEW_PID
```

Expected: HTTP 200。

- [ ] **Step 5: 标记 Day 1 完成**

```bash
git tag day1-skeleton-complete
```

(这是给后续 day 文档作为参考点；不是强制。)

---

## Day 1 验收清单

至此 Day 1 应满足：

- ✅ npm 项目初始化, package.json 含全部依赖
- ✅ TypeScript strict + noUncheckedIndexedAccess 配置
- ✅ Vite 配置, dev server 可启动, build 可生成 dist/
- ✅ Vitest 配置, jsdom 环境就绪
- ✅ 全部 TS 类型与 zod schema (src/types.ts + src/types.zod.ts)
- ✅ 设计 token TS 镜像 + CSS 变量 + 一致性测试
- ✅ Inter / JetBrains Mono 字体本地打包 (CLAUDE.md 第 4 条)
- ✅ deepClone 工具
- ✅ Mock 主样例 city-road.json (47 标注, 3 重点项, 校验通过)
- ✅ 数据集注册 + zod 启动期校验
- ✅ Snapshot 工厂 + 隔离性测试
- ✅ 撤销栈 (栈深 20, 反向应用)
- ✅ Zustand store 完整骨架: 编排状态机 + 重置深拷贝 + 审核动作 + 撤销 + helpers
- ✅ store 性能测试: 重置 < 200ms (PRD §10 红线)
- ✅ 占位视频 + 缩略图 + 帧 (供后续步骤展示画面)
- ✅ 全部测试绿色, typecheck 干净, build 通过

---

## 后续天数 (待写入分册文件)

接下来 Day 2-3 实施 Step 4 审核工作台 (技术最重 + Demo 灵魂), Day 4 实施 Step 5 导出 (验证核心链路), Day 5-7 依次完成其余步骤、控制条、防呆与现场分发。

由于本计划 Day 1 篇幅已较大 (~1000 行), Day 2-7 拆分到独立的分册文件:
`2026-06-18-video-label-demo-day2-3-review.md` 等。

下一分册的写入由 writing-plans 技能在用户确认 Day 1 计划后继续生成。

---

## Self-Review (Day 1 范围)

### 1. Spec 覆盖检查

- ✅ §1.1 目录结构: 本 Day 1 计划覆盖了 src/types.ts / src/store/* / src/data/* / src/styles/* / src/lib/deepClone.ts / scripts/validate-fixture.mjs / 测试目录
- ✅ §2.1 单一 Zustand store: Task 1.15 完整实现
- ✅ §2.1.2 immer middleware: Task 1.15 已用
- ✅ §2.2 重置语义: Task 1.15 reset() 实现 + 1.13 snapshot 隔离测试 + 1.15 perf 测试守 200ms 红线
- ✅ §2.4 撤销栈: Task 1.14 + 1.15 实现, 栈深 20, 一键全部接受不入栈, Ctrl+Z 仅 Step 4 生效（store 不绑键，键绑定在 Day 2-3）
- ✅ §4.1 TypeScript 类型: Task 1.5
- ✅ §4.2 主样例 city-road: Task 1.11
- ✅ §4.4.3 校验脚本: Task 1.11 step 5
- ✅ §4.5.3 占位视频: Task 1.16
- ✅ §6 视觉 token: Task 1.8
- ✅ §6.2 字体本地打包: Task 1.9

**未在 Day 1 覆盖的 spec 章节** (移交后续天数):
- §3 Demo 编排状态机的 timeline 引擎 → Day 6 (`src/lib/animation/timeline.ts`)
- §5 五个步骤视图 → Day 2-5
- §6 chrome 层 (TopBar / StepPills / DemoControls) → Day 6 完整接入
- §7.1 E2E 测试 → Day 4 起
- §7.4 离线打包脚本 (start.sh / start.bat) → Day 7

### 2. 占位符扫描

- ✅ 没有 "TBD" / "TODO" / "implement later"
- ✅ 没有 "add appropriate error handling" 之类的虚步骤
- ✅ 每个 step 的代码块都是可直接运行的完整内容
- ✅ 所有期望输出都给了具体值或具体格式

### 3. 类型一致性

- ✅ `Annotation` / `Dataset` / `BBox` / `ReviewAction` / `Snapshot` 类型在 1.5 / 1.13 / 1.14 / 1.15 中使用一致
- ✅ `applyUndo(annotations, action)` 签名在 1.14 测试和 1.15 调用处一致
- ✅ `pushUndo(stack, action) → ReviewAction[]` 签名在 1.14 测试和 1.15 调用处一致
- ✅ `createSnapshot(datasetId): Snapshot` 在 1.13 实现, 1.15 用作 store initial / reset / selectDataset 来源, 一致
- ✅ `getDataset(id): Dataset` 在 1.12 实现, 1.13 / 1.15 / canAdvanceFromStep4 引用, 一致
- ✅ store action 名称 (acceptBox / rejectBox / correctBoxGeometry / acceptAllRemaining / undo / reset / selectDataset / setSpeed / goToStep / pause / resume / togglePlayMode / selectTrack / setReviewQueueIndex / setRevealProgress / canAdvanceFromStep4) 在 1.15 测试与实现一致
- ✅ CSS 变量名 (`--brand-500` 等) 在 1.8 tokens.ts / globals.css / 测试 readVar 一致

---

执行入口: 用户选择「Subagent-Driven」或「Inline Execution」后, 由对应 sub-skill 接管。
