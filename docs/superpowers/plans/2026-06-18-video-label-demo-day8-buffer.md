# Day 8 缓冲计划 · 真视频替换 + 视觉调优 + bug 修复

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**前置:** Day 1-7 已完成（Demo 功能 + 防呆 + 现场分发 全部就位，所有测试绿色）。

**Goal:** 缓冲日，吸收开发期溢出 + 接入真视频素材 + 视觉细节打磨 + 性能微调 + 修复未决 bug。

**Architecture:** 本日是「按实际需要执行」，不是固定流程。任务列表是**菜单**而非顺序——按你/销售当下的优先级挑做。如果 Day 1-7 一切顺利，本日可能只用半天。

**关键产出文件:**
- `public/mock/city-road/road_demo.mp4`（真视频替换）
- `public/mock/meeting-room/meeting_demo.mp4`（真视频替换）
- `public/mock/retail-cam/retail_demo.mp4`（真视频替换）
- `public/mock/<dataset>/road_thumb.jpg` 等（基于真视频抽取的缩略图）
- `public/mock/city-road/frames/<timestamp>.jpg`（基于真视频抽取的导出包帧）
- `docs/superpowers/specs/2026-06-18-video-label-demo-design.md`（附录 A 补充实际选用的素材直链 + SHA-256）
- 视觉/性能/bug 相关代码改动（按需）

---

## Day 8 任务菜单（按优先级）

### Track A · 真视频替换（建议优先做）

如果你/销售已经下载好了真视频素材，按这条 track 执行，让 Demo 看起来「不再是黑屏」。

#### Task 8A.1: 真视频导入 + 转码

**前置:** 你/销售已经从 spec 附录 A 列出的 CC0 / Pexels / Coverr 来源下载了 3 段视频，放在某个目录里（假设 `~/Downloads/demo-videos/`）。

- [ ] **Step 1: 验证下载视频的真实参数**

对每个视频跑：

```bash
ffprobe -v error -show_entries format=duration,bit_rate \
        -show_entries stream=width,height,r_frame_rate,codec_name \
        ~/Downloads/demo-videos/city-road-source.mp4
```

记下实际 duration / width / height / fps / codec。

- [ ] **Step 2: 转码到 spec §4.5.1 目标参数**

如果原视频参数不匹配，用 ffmpeg 转码：

```bash
# city-road: 30s / 1920×1080 / 30fps / H.264
ffmpeg -y -i ~/Downloads/demo-videos/city-road-source.mp4 \
       -t 30 -vf "scale=1920:1080:flags=lanczos,fps=30" \
       -c:v libx264 -pix_fmt yuv420p -crf 28 -preset slow \
       -an \
       public/mock/city-road/road_demo.mp4

# meeting-room: 45s / 1280×720 / 30fps / H.264
ffmpeg -y -i ~/Downloads/demo-videos/meeting-room-source.mp4 \
       -t 45 -vf "scale=1280:720:flags=lanczos,fps=30" \
       -c:v libx264 -pix_fmt yuv420p -crf 28 -preset slow \
       -an \
       public/mock/meeting-room/meeting_demo.mp4

# retail-cam: 60s / 1920×1080 / 30fps / H.264
ffmpeg -y -i ~/Downloads/demo-videos/retail-cam-source.mp4 \
       -t 60 -vf "scale=1920:1080:flags=lanczos,fps=30" \
       -c:v libx264 -pix_fmt yuv420p -crf 28 -preset slow \
       -an \
       public/mock/retail-cam/retail_demo.mp4
```

`-an` 删音频 (Demo 不需要)，`-crf 28` 中等质量，3 段视频总和应在 15-25 MB。

- [ ] **Step 3: 抽取卡片缩略图**

```bash
ffmpeg -y -i public/mock/city-road/road_demo.mp4    -vf "select='eq(n,15)'" -vframes 1 -q:v 5 public/mock/city-road/road_thumb.jpg
ffmpeg -y -i public/mock/meeting-room/meeting_demo.mp4 -vf "select='eq(n,30)'" -vframes 1 -q:v 5 public/mock/meeting-room/meeting_thumb.jpg
ffmpeg -y -i public/mock/retail-cam/retail_demo.mp4 -vf "select='eq(n,60)'" -vframes 1 -q:v 5 public/mock/retail-cam/retail_thumb.jpg
```

- [ ] **Step 4: 抽取导出包用的关键帧 (city-road 主样例)**

```bash
ffmpeg -y -i public/mock/city-road/road_demo.mp4 \
       -vf "select='eq(n,100)+eq(n,300)'" -vsync vfr -q:v 5 \
       public/mock/city-road/frames/%04d.jpg
cd public/mock/city-road/frames
mv 0001.jpg 00003333.jpg
mv 0002.jpg 00010000.jpg
cd -
```

- [ ] **Step 5: 计算 SHA-256 写回 spec 附录 A**

```bash
shasum -a 256 \
  public/mock/city-road/road_demo.mp4 \
  public/mock/meeting-room/meeting_demo.mp4 \
  public/mock/retail-cam/retail_demo.mp4
```

把 3 个 SHA-256 值 + 你/销售实际选用的源 URL 补到 spec 文件 `docs/superpowers/specs/2026-06-18-video-label-demo-design.md` 的「附录 A」相应小节，覆盖原候选 URL 列表中那条。

- [ ] **Step 6: 验证 fixture 坐标与真视频画面匹配 (人工 review)**

启动 dev → /?step=4 → 检查标注框是否大致落在合理位置:

- city-road 的 trk_2 (行人) 是否真的盖住一个行人?
- 高置信车辆框是否真的盖住车辆?
- trk_5 (交通标志, 实际是误检为路边广告牌) 是否真的盖住一个像广告牌的物体?

如果**完全不匹配** (例如 trk_2 的 y 坐标对应天空), 说明 fixture 坐标是按占位黑屏画的, 真视频画面位置不同。两种处理:

a) 接受不一致 + 在角落加水印「演示标注数据」(成本最低)
b) 修改 city-road-fixture.ts 把关键坐标重新调一下，对齐真视频里的物体位置 (1-2 小时手工活)

如果选 b)：

```bash
# 反复调整 fixture, 重新生成 + 校验:
npx tsx src/data/_generators/city-road-fixture.ts > src/data/city-road.json
node scripts/validate-fixture.mjs
```

调到主样例 47 标注 + 3 重点项视觉合理。

副样例 (meeting-room / retail-cam) 因为只是门面，可以接受 (a) 不调整。

- [ ] **Step 7: 验证 dist 大小仍 < 30MB**

```bash
npm run build
npm run size:check
```

Expected: dist 体积应在 22-28 MB 之间。**如果超过**：

- 进一步压缩视频: `-crf 32` (画质降一点) 或 `-preset slower` (压得更狠)
- 副样例视频可降到 720p 减小体积

- [ ] **Step 8: 跑全部测试 (单测 + E2E)**

```bash
npm run test:run
npm run test:e2e
```

Expected: 全绿。如果有 E2E 失败（例如视频加载时长变化导致 timeout），把 timeout 调宽一点。

- [ ] **Step 9: 提交**

```bash
git add public/mock/ docs/superpowers/specs/2026-06-18-video-label-demo-design.md src/data/
git commit -m "feat: replace placeholder videos with real CC0 demo footage"
```

---

### Track B · 视觉细节打磨

#### Task 8B.1: 步骤胶囊已完成态加 ✓ 角标动画

> 当前 StepPills 在已完成态显示 ✓，但是静态出现。可以加一个简短的「弹入」动画让步骤切换更有仪式感。

- [ ] **Step 1: 在 StepPills.tsx 给 ✓ 角标加 transform: scale 弹入**

修改 src/chrome/StepPills.tsx 中的 `{isCompleted && <span ...>✓</span>}`：

```tsx
{isCompleted && (
  <span
    style={{
      marginLeft: 4,
      color: tokens.color.success[500],
      display: 'inline-block',
      animation: 'check-pop 320ms var(--ease-spring)',
    }}
  >
    ✓
  </span>
)}
```

在 globals.css 末尾追加：

```css
@keyframes check-pop {
  0%   { transform: scale(0); opacity: 0; }
  60%  { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(1); }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/chrome/StepPills.tsx src/styles/globals.css
git commit -m "polish: animated checkmark on completed step pills"
```

---

#### Task 8B.2: 标注框接受/否决/纠正时的颜色过渡

> 当前框颜色变化是瞬间切换的。加 200ms 过渡让审核操作更"丝滑"。

- [ ] **Step 1: 在 BoxLayer.tsx 的 `<Rect>` 加 perfectDrawEnabled={false} (Konva 性能优化) 并通过 useState + useEffect 做 stroke 颜色过渡**

由于 Konva 不直接支持 CSS transition, 实现颜色过渡需要 Konva tween。简化做法: 用一个 ColorTransition 助手:

```tsx
// src/steps/Step4Review/colorTween.ts
import type Konva from 'konva';

const TWEEN_MS = 200;

export function tweenStroke(node: Konva.Rect | Konva.Group, fromColor: string, toColor: string) {
  // Konva 自带 To
  // 简化: 直接 set, Konva 没有原生 stroke color tween, 留给 v2 优化
  // 这里只是把 strokeWidth 做一个短的 0.85→1 弹性, 视觉上有"反馈"
  node.scaleX(0.97);
  node.scaleY(0.97);
  const tween = new (window as any).Konva.Tween({
    node,
    duration: TWEEN_MS / 1000,
    scaleX: 1,
    scaleY: 1,
    easing: (window as any).Konva.Easings.EaseOut,
  });
  tween.play();
  void fromColor;
  void toColor;
}
```

> **诚实说**: Konva 的颜色 tween 会增加可观工作量，且单测和 E2E 都难校验。**Day 8 缓冲日的建议是放弃这个细节**——视觉冲击不大，性价比低。

**替代方案: 给框添加 CSS 风格的轻微"脉冲"动画**

在 globals.css 加：

```css
@keyframes box-pulse {
  0% { transform: scale(0.98); }
  50% { transform: scale(1.02); }
  100% { transform: scale(1); }
}
```

但 Konva canvas 元素 CSS transform 影响整个 canvas 而不是单个 box，所以也不好用。

**最终建议: 跳过这个任务**，把时间投入到 Track A (真视频) 或 Track C (bug 修复)。

---

#### Task 8B.3: Step 5 下载按钮加打包动画

> 当前按钮在 downloading 时只显示 "⏳ 打包中..."。可以加一个进度旋转图标。

- [ ] **Step 1: 在 Step5Export/index.tsx 中给下载按钮加 spinner**

修改下载按钮的 children：

```tsx
{downloading ? (
  <>
    <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
    {' 打包中...'}
  </>
) : (
  `↓ 下载导出包 (${dataset.dataset_id}_export.zip)`
)}
```

globals.css 加：

```css
@keyframes spin {
  from { transform: rotate(0); }
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/steps/Step5Export/index.tsx src/styles/globals.css
git commit -m "polish: spinner animation on download button while packaging"
```

---

### Track C · Bug 修复菜单

#### 已知潜在 bug 与修复方案

下面列出 Day 1-7 实施过程中可能遇到的 bug。**只在实际碰到时才执行对应修复**。

#### Bug C.1: VirtualPresenter 在 paused→resume 后从头跑

**现象:** 自动模式 → 暂停遮罩 → 继续后, VirtualPresenter 从 t=0 重新开始, 而不是从暂停点继续。

**原因:** Day 6 Task 6.6 简化为 paused 时 cancel timeline。

**影响:** 暂停期间已发生的审核动作 (例如 trk_2 已被接受) 被重新执行 (acceptBox 是幂等的, 实际 status 不变, 但视觉上 trk_2 被重新选中并"再接受一次", 略尴尬)。

**修复:**

- [ ] **Step 1: 在 store 加 `lastVirtualPresenterStep` (1-7 表示已执行到第几步)**

```ts
// src/store/snapshots.ts: Snapshot interface 加
lastVirtualPresenterStep: number; // 0 表示未开始, 7 表示已完成 goToStep(5)

// createSnapshot 初始为 0
```

- [ ] **Step 2: VirtualPresenter 启动 timeline 时, 从 lastVirtualPresenterStep 之后的位置开始**

```tsx
// 大致逻辑:
const startFromStep = useDemoStore.getState().lastVirtualPresenterStep;
const SCHEDULED_STEPS = [
  // [step编号, atMs, fn]
  [1, T.selectFirst,  () => store.selectTrack(focusIds[0]!)],
  [2, T.acceptFirst,  () => { store.acceptBox(focusIds[0]!); store.markVirtualPresenterStep(2); }],
  [3, T.selectSecond, () => store.selectTrack(focusIds[1]!)],
  [4, T.correctSecond, () => { correctTighten(focusIds[1]!); store.markVirtualPresenterStep(4); }],
  // ...
];
SCHEDULED_STEPS
  .filter(([step]) => step > startFromStep)
  .forEach(([_step, at, fn]) => tl.schedule(at - alreadyElapsedFor(startFromStep), fn));
```

**这个修复涉及范围中等**——store schema 变化 + VirtualPresenter 逻辑改写 + 测试更新。**只在客户实际反馈"暂停后体验奇怪"时才做**。

- [ ] **Step 3 (如修复): 提交**

```bash
git commit -m "fix: VirtualPresenter resumes from last completed step instead of restart"
```

---

#### Bug C.2: dev 模式下 ResizeObserver 在快速切换 step 时报错

**现象:** 在 step 3 → step 4 切换的瞬间, console 出现 `ResizeObserver loop completed with undelivered notifications` 警告。

**原因:** Konva 容器的 ResizeObserver 在组件 unmount 后还在被通知。

**修复:**

- [ ] **Step 1: 在 ReviewCanvas / BoxRevealCanvas 里 ResizeObserver 创建处加 try/catch**

```tsx
const obs = new ResizeObserver((entries) => {
  try {
    const entry = entries[0];
    if (!entry) return;
    setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
  } catch {
    // ignore — 组件已卸载
  }
});
```

或者在 unmount 时先 disconnect:

```tsx
return () => {
  obs.disconnect();
};
```

(Day 2-3 已实现 disconnect, 这里只需补 try/catch.)

- [ ] **Step 2 (如修复): 提交**

```bash
git commit -m "fix: silence ResizeObserver loop warning during step transitions"
```

---

#### Bug C.3: Step 4 视频在某些 Chrome 版本不自动播放

**现象:** 即使 muted + autoplay + playsInline 都加了, Chrome 在某些设置下仍拦截自动播放。

**检测:** 在 ReviewCanvas useEffect 里, `video.play()` 返回的 promise reject 时记录。

**修复:**

- [ ] **Step 1: 在 ReviewCanvas.tsx 检测 play 失败, 显示一个浮层「点击播放」**

```tsx
const [needsPlayClick, setNeedsPlayClick] = useState(false);

useEffect(() => {
  const video = videoRef.current;
  if (!video) return;
  video.play().catch(() => setNeedsPlayClick(true));
}, []);

// JSX 内:
{needsPlayClick && (
  <button
    onClick={() => {
      videoRef.current?.play();
      setNeedsPlayClick(false);
    }}
    style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}
  >
    ▶ 点击播放视频
  </button>
)}
```

- [ ] **Step 2 (如修复): 提交**

```bash
git commit -m "fix: handle Chrome autoplay block with manual play button overlay"
```

---

#### Bug C.4: 字体下载失败 (Day 1 Task 1.9 字体源被墙)

**现象:** dev 启动后, 浏览器看到不是 Inter 字体而是系统默认字体。

**原因:** 当时下载的字体文件不存在 / 0 字节 / 损坏。

**修复:**

- [ ] **Step 1: 检查字体文件**

```bash
ls -la public/fonts/
file public/fonts/Inter-Regular.woff2
```

- [ ] **Step 2: 如果损坏, 重新下载** (Day 1 Task 1.9 给了多个备用源)

或者直接把 Google Fonts 的 woff2 通过 VPN 下载到本地后 scp 进 public/fonts/。

- [ ] **Step 3 (如修复): 提交**

```bash
git commit -m "fix: re-download corrupted font files"
```

---

### Track D · 性能微调

#### Task 8D.1: 检查 dist 是否过大

- [ ] **Step 1: 跑 vite build --mode=production 后看输出**

```bash
npm run build
ls -lh dist/assets/
```

如果某个 chunk 异常大 (例如 konva-vendor > 200KB gzipped), 检查是否引入了不必要的子模块。

- [ ] **Step 2: 跑 vite-bundle-visualizer 看依赖图 (可选)**

```bash
npm install --save-dev rollup-plugin-visualizer
```

vite.config.ts 里加:

```ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({ filename: 'dist/stats.html', open: false }),
  ],
  // ...
});
```

`npm run build` 后打开 `dist/stats.html` 看 chunk 组成。如果发现某个第三方库占比异常, 考虑替换或 dynamic import。

- [ ] **Step 3 (如发现优化机会): 实施 + 提交**

---

#### Task 8D.2: 拖框性能基准 (实测 fps)

- [ ] **Step 1: 启动 dev → /?step=4 → Chrome DevTools → Performance**

录制 5 秒, 期间快速拖动 trk_2 框的右下角控制点。

- [ ] **Step 2: 看 FPS 曲线**

Expected: 50-60 fps 持续, 偶尔掉到 40-50fps 可接受。

如果 < 30fps 持续：

- 检查 Konva Layer 是否真的分了 3 层 (视频底图 / 框 / Transformer)
- 检查 BoxLayer 的 Group 是否对每个标注都不必要地重渲染 (用 React.memo)

```tsx
const MemoBoxGroup = React.memo(BoxGroup);
```

- [ ] **Step 3 (如优化): 提交**

```bash
git commit -m "perf: memoize BoxGroup for smoother drag at 50+ fps"
```

---

### Track E · 文档更新

#### Task 8E.1: 更新 README.md

> 当前 README 是默认占位 (14 字节)。Demo 完成后写一份给销售/产品/客户看。

- [ ] **Step 1: 重写根目录 README.md**

```markdown
# 视频语料标注平台 · 演示 Demo

纯前端视频标注流程演示系统。让销售/产品在客户现场，5 分钟内走通「上传 → 元信息 → 自动标注 → 人工审核 → 导出」五步叙事。

## 现场演示

下载分发包后双击启动:

- macOS / Linux: `start.sh`
- Windows:        `start.bat`

详见包内 `README.md`。

## 开发

```bash
npm install
npm run dev          # 启动 dev server
npm run test         # watch 单测
npm run test:e2e     # E2E
npm run build        # 构建 → dist/
npm run pack:release # 打包成可分发 zip → release/
```

## 项目结构

- `src/store/` — Zustand 全局状态 + 编排状态机
- `src/steps/` — 5 个步骤的视图，每步独立文件夹
- `src/chrome/` — 顶栏 / 步骤胶囊 / 控制条 / 错误边界
- `src/data/` — Mock 数据集（3 样例 + 生成器）
- `src/lib/` — 共享工具（Timeline / interpolate / format）
- `tests/` — 单测 + E2E（Playwright）
- `docs/superpowers/` — 设计文档 + 实施计划

## 文档

- 产品 PRD: `docs/视频语料标注平台 · 演示 Demo PRD.md`
- 系统设计: `docs/superpowers/specs/2026-06-18-video-label-demo-design.md`
- 实施计划: `docs/superpowers/plans/2026-06-18-video-label-demo*.md`
- 项目约束: `CLAUDE.md`

## 许可

内部演示用途。视频素材授权见 `public/mock/<dataset>/` 目录下的来源说明（CC0 / Pexels License / Coverr License）。字体授权见 `public/fonts/LICENSE.txt`（SIL OFL）。
```

- [ ] **Step 2: 提交**

```bash
git add README.md
git commit -m "docs: write project README with dev / build / package instructions"
```

---

### Track F · 收尾验收

#### Task 8F.1: 最终全量回归

- [ ] **Step 1: 全部测试绿色**

```bash
npm run test:run     # 单测
npm run test:e2e     # E2E
```

Expected: 全绿。预期总数 70+ 个测试。

- [ ] **Step 2: 性能检查**

```bash
npm run typecheck
npm run build
npm run size:check
node scripts/verify-offline.mjs
```

Expected: 全部 OK。

- [ ] **Step 3: 端到端手动验证 (含真视频)**

启动 dev → / → 完整流程 (用真视频, 每个样例都过一遍):

1. ✅ city-road 主样例完整自动演示 7-8s
2. ✅ city-road 手动审核 (A/D + 拖框) → 导出 zip → 解压验证
3. ✅ 重置 → meeting-room → 完整流程 (副样例 2 重点项)
4. ✅ 重置 → retail-cam → 完整流程
5. ✅ 离线模式 (拔网线) 完全可用

- [ ] **Step 4: release zip 最终验证**

```bash
npm run pack:release
```

把生成的 `release/video-label-demo-v0.1.0.zip` 拷贝到一台**全新的电脑**（销售的笔记本/Windows 测试机/虚拟机），断网，双击 start 脚本，验证全流程跑通。

- [ ] **Step 5: 提交最终 tag**

```bash
git tag v0.1.0-release
```

如果 package.json version 还是 0.1.0, 也可以这时候 bump 到 1.0.0:

```bash
npm version 1.0.0 --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: release v1.0.0"
git tag v1.0.0
```

---

## Day 8 验收清单

实际你只需做以下中**适用的部分**——这是缓冲日，不是必做清单：

- ⬜ Track A: 真视频替换（如已有素材）
- ⬜ Track B: 视觉细节打磨（按精力）
- ⬜ Track C: bug 修复（按实际碰到的）
- ⬜ Track D: 性能微调（如有需求）
- ⬜ Track E: README 更新（建议必做）
- ⬜ Track F: 最终回归（建议必做）

**最低标准 (建议):** 至少完成 Track E + F；Track A 取决于素材就位时间。

---

## 整体计划总览

至此 Day 1-8 全部分册完成：

| Day | 主题 | 文件 |
|---|---|---|
| 1 | 骨架（npm + TS + Vite + tokens + store + Mock） | `2026-06-18-video-label-demo.md` |
| 2-3 | Step 4 审核工作台（Konva + Transformer + 队列 + 键盘） | `...-day2-3-review.md` |
| 4 | Step 5 导出（序列化 + JSZip + E2E） | `...-day4-export.md` |
| 5 | Step 1/2/3 + 副样例（揭示动画 + Timeline 调度器） | `...-day5-steps123.md` |
| 6 | 控制条联动 + 自动模式 + 虚拟主讲 | `...-day6-controls.md` |
| 7 | 防呆 + 错误边界 + 现场分发 + 离线验证 | `...-day7-polish.md` |
| 8 | 缓冲（真视频 + 视觉打磨 + bug） | `...-day8-buffer.md`（本文件） |

---

## Self-Review (Day 8 范围)

### 1. Spec 覆盖

- ✅ §4.5 真视频素材替换流程（Track A）
- ✅ 全部硬约束在前 7 天已守护，Day 8 不引入新约束
- ✅ §7.6 验收清单的 P3 项（多导出格式、键盘快捷键、离线打包、暗色主题等）已全部在前 7 天落地或显式标为不做

### 2. 占位符扫描

- ✅ 所有任务都有具体 step，无 "TBD"
- ⚠ Task 8B.2「颜色过渡」在分析后**显式跳过**（说明了原因），不是占位符

### 3. 类型一致性

- ✅ 涉及 store 的 Bug C.1 修复保持原签名兼容（只新增 lastVirtualPresenterStep 字段）
- ✅ 视频文件路径与 Day 1 占位视频路径一致（`public/mock/<dataset>/road_demo.mp4` 等）

---

## 整体 Self-Review (跨 Day 1-8)

### Spec 章节覆盖映射

| Spec 章节 | 实施天 | 任务 |
|---|---|---|
| §0 决策一览 | Day 0 (设计) | (作为输入) |
| §1.1 目录结构 | Day 1-7 | 各 day 渐进创建 |
| §1.4 ?step= URL 参数 | Day 2-3 | Task 2.2 |
| §2.1 单一 Zustand store | Day 1 | Task 1.15 |
| §2.2 重置语义 | Day 1 | Task 1.15 |
| §2.3 数据流 | Day 1-4 | 横向 |
| §2.4 撤销栈 | Day 1 | Task 1.14 + 1.15 |
| §3.1 状态机 | Day 6 | Task 6.2 / 6.3 |
| §3.2 控制条按钮 | Day 6 | Task 6.3 |
| §3.3 揭示动画引擎 | Day 5 | Task 5.1 |
| §3.4 虚拟主讲 | Day 6 | Task 6.5 |
| §3.5 暂停语义 | Day 6 | Task 6.6 |
| §4.1 TS 类型 | Day 1 | Task 1.5 + 1.6 |
| §4.2 主样例 | Day 1 | Task 1.11 |
| §4.3 副样例 | Day 5 | Task 5.12 + 5.13 |
| §4.4 fixture 校验 | Day 1 | Task 1.11 step 5 |
| §4.5 视频素材 | Day 8 (Track A) | Task 8A.1 |
| §5.1 Step 1 上传 | Day 5 | Task 5.3-5.6 |
| §5.2 Step 2 元信息 | Day 5 | Task 5.7-5.8 |
| §5.3 Step 3 自动标注 | Day 5 | Task 5.9-5.11 |
| §5.4 Step 4 审核 | Day 2-3 | 全部 |
| §5.5 Step 5 导出 | Day 4 | Task 4.2-4.8 |
| §5.6 顶栏控制条 | Day 2-3 / Day 6 | Task 2.1 + 6.3 |
| §6 视觉系统 | Day 1 | Task 1.8 (token 一次到位) |
| §6.9 响应式 | Day 2-3 | Task 2.2 (1280 遮罩) |
| §6.11 lucide-react icon | Day 6 | Task 6.3 |
| §7.1 测试金字塔 | Day 1-7 | 横向 |
| §7.2 性能预算 | Day 1 / Day 7 | perf 单测 + E2E |
| §7.3 错误处理 | Day 7 | Task 7.1-7.3 |
| §7.4 离线分发 | Day 7 | Task 7.7-7.8 |
| §7.5 实施节奏 | (本计划本身) | — |
| §7.6 验收清单 | Day 8 | Task 8F.1 |
| §7.7 风险登记 | (各 day 内嵌缓解) | — |

### CLAUDE.md 硬约束守护映射

| 硬约束 | 守护机制 | 任务 |
|---|---|---|
| #1 schema 对齐生产 | format.test.ts | Day 4 Task 4.2 |
| #2 审核改动回写 store | Step4Review.test.tsx + E2E full-flow | Day 2-3 Task 3.2 + Day 4 Task 4.10 |
| #3 重置深拷贝 | store.test.ts + perf.test.ts | Day 1 Task 1.13 + 1.15 |
| #4 零外部网络请求 | verify-offline.mjs + E2E offline.spec.ts | Day 7 Task 7.6 + 7.10 |
| #5 审核是唯一真交互 | (设计层守护，无 mock 计算) | (横向) |

---

执行入口（任何分册都适用）：用户选择「Subagent-Driven」或「Inline Execution」后，由对应 sub-skill 接管。
