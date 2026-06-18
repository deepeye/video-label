# 视频语料标注平台 Demo · 系统设计

> 版本：v1.0 · 2026-06-18
> 来源 PRD：`docs/视频语料标注平台 · 演示 Demo PRD.md`（v2.0-demo）
> 受众：将实施本 Demo 的工程师（含 AI 编程助手）
> 终点：本设计文档定稿后，由 `superpowers:writing-plans` 技能产出可执行的实施计划

---

## 0. 文档导读

本文是 PRD 的**工程映射**：把 PRD 描述的产品体验，翻译为可直接落地的代码结构、状态机、数据契约、视觉规范、测试策略与交付清单。

PRD 决定「Demo 要看起来什么样」；本设计决定「代码该写成什么样才能稳住那个体验」。

读者只读本文 + PRD 即可开工，**不需要再做任何审美或架构决策**。

### 0.1 关键已锁定决策（一张表速览）

| # | 决策 | 选择 | 文档位置 |
|---|---|---|---|
| 1 | 视觉气质 | B · 现代友好（浅色 + 紫蓝渐变 + 圆角 + 柔和阴影） | §6 |
| 2 | 主战场 | 场景 A：销售主讲、5 分钟跑完、客户旁观 | §3 |
| 3 | 任意上传策略 | 假上传 2s 后弹友好 toast，自动切回预置样例 | §5.1.2 |
| 4 | 样例视频源 | CC0/Pexels 直链候选清单（附录 A） | §4.5 / 附录 A |
| 5 | 样例数量 | 1 主样例（city-road 完整）+ 2 副样例（轻量门面） | §4.2 / §4.3 |
| 6 | 自动模式到 Step 4 | 虚拟主讲按预设节奏裁决三动作，任意点击接管 | §3.4 |
| 7 | 重置范围 | 同样例重演（保留 dataset / speed），清审核记录 | §2.2 |
| 8 | 审核动作 | 极简版：✓ 接受 / ✗ 否决 / ↔ 拖框 / ↶ Ctrl+Z | §5.4 |
| 9 | 导出格式 | 原生 JSON（默认）+ COCO-Video（可选） | §5.5 |
| 10 | 离线打包 | 纯静态构建 + start.sh / start.bat | §7.4 |
| 11 | 浏览器/设备 | Chrome/Edge 最近两版、≥ 1280×720、F11 大屏适配 | §6 / §7.3 |

### 0.2 PRD 与本设计的差异

本设计完全在 PRD 范围内执行，无新增需求。以下两点对 PRD 做了**无歧义化收敛**（PRD 标注的「待决问题」）：

- **PRD 3.1 e** 客户拖入自有视频策略 → 收敛为「假上传后切回预置样例」（决策 #3）
- **PRD 3.3 e** 揭示动画时长 → 收敛为 `metadata_reveal_ms=1500 / inference_reveal_ms=2500`，受速度档 1x/2x/instant 调节
- **PRD 3.4 e** 撤销范围 → 收敛为「单步撤销，栈深 20，一键全部接受不入栈」

---

## 1. 项目结构与文件组织

### 1.1 顶层目录

```
video-label/
├── docs/
│   ├── 视频语料标注平台 · 演示 Demo PRD.md      # 现有 PRD（参考来源）
│   └── superpowers/specs/
│       └── 2026-06-18-video-label-demo-design.md   # 本文
├── public/                                         # 构建直拷贝
│   ├── mock/
│   │   ├── city-road/
│   │   │   ├── road_demo.mp4                       # CC0 占位视频（30s/1080p/30fps H.264）
│   │   │   ├── road_thumb.jpg                      # 卡片缩略图
│   │   │   └── frames/                             # 导出包用的几张样例帧
│   │   │       ├── 00003333.jpg
│   │   │       └── 00010000.jpg
│   │   ├── meeting-room/
│   │   │   ├── meeting_demo.mp4                    # 副样例（45s/720p）
│   │   │   └── meeting_thumb.jpg
│   │   └── retail-cam/
│   │       ├── retail_demo.mp4                     # 副样例（60s/1080p）
│   │       └── retail_thumb.jpg
│   └── (start.sh / start.bat 由 pack:release 注入分发包)
├── src/
│   ├── data/                                       # Mock 数据集 JSON（数据驱动核心）
│   │   ├── city-road.json                          # 主样例完整 Mock
│   │   ├── meeting-room.json                       # 副样例（简化）
│   │   ├── retail-cam.json                         # 副样例（简化）
│   │   ├── _generators/                            # 仅本地开发期，不进 dist
│   │   │   ├── city-road-fixture.ts
│   │   │   └── README.md
│   │   └── index.ts                                # 注册三个 dataset
│   ├── store/                                      # Zustand 状态层
│   │   ├── demoStore.ts                            # Demo 编排状态机 + 标注内存状态
│   │   ├── snapshots.ts                            # 初始 Mock 快照工厂（深拷贝源）
│   │   └── undo.ts                                 # 撤销栈（仅审核步骤启用）
│   ├── steps/                                      # 5 个步骤的视图，每步一个文件夹
│   │   ├── Step1Upload/
│   │   │   ├── index.tsx
│   │   │   ├── DropZone.tsx                        # 拖入 + 假上传进度
│   │   │   └── SampleCards.tsx                     # 3 个样例卡片
│   │   ├── Step2Metadata/
│   │   │   ├── index.tsx
│   │   │   └── TypewriterField.tsx                 # 打字机揭示组件
│   │   ├── Step3AutoAnnotate/
│   │   │   ├── index.tsx
│   │   │   ├── InferenceProgress.tsx
│   │   │   └── BoxRevealCanvas.tsx                 # Konva 框逐个浮现
│   │   ├── Step4Review/                            # 真交互核心
│   │   │   ├── index.tsx
│   │   │   ├── ReviewCanvas.tsx                    # Konva Stage + Transformer
│   │   │   ├── BoxLayer.tsx                        # 按 review status 渲染颜色
│   │   │   ├── QueueTrack.tsx                      # 底部横向队列卡片
│   │   │   ├── PropertyPanel.tsx                   # 右属性面板 + 大按钮
│   │   │   └── VirtualPresenter.tsx                # 自动模式下的虚拟主讲裁决
│   │   └── Step5Export/
│   │       ├── index.tsx
│   │       ├── FormatSwitch.tsx                    # 原生 JSON / COCO-Video 切换
│   │       ├── JsonPreview.tsx
│   │       └── exportZip.ts                        # JSZip + FileSaver 打包逻辑
│   ├── chrome/                                     # 全局壳：顶栏 + 步骤条 + 控制条
│   │   ├── TopBar.tsx
│   │   ├── StepPills.tsx
│   │   ├── DemoControls.tsx
│   │   └── ResetConfirm.tsx
│   ├── lib/
│   │   ├── format/
│   │   │   ├── native.ts                           # 原生 JSON 序列化
│   │   │   └── cocoVideo.ts                        # COCO-Video 序列化
│   │   ├── animation/
│   │   │   ├── timeline.ts                         # 暂停/继续/速度档兼容的调度器
│   │   │   └── speed.ts                            # 1x/2x/instant 速度档应用
│   │   ├── deepClone.ts                            # structuredClone 包装
│   │   └── ext/                                    # 浏览器特性兼容层
│   │       └── videoFrameCallback.ts
│   ├── styles/
│   │   ├── globals.css                             # CSS 变量 + 字体 @font-face
│   │   └── tokens.ts                               # 设计 token TypeScript 镜像
│   ├── App.tsx                                     # 根组件 + 步骤路由
│   ├── main.tsx                                    # Vite 入口
│   └── types.ts                                    # Dataset / Annotation / DemoState 等
├── tests/
│   ├── store.test.ts                               # 状态机 + 重置深拷贝
│   ├── format.test.ts                              # 导出 schema 一致性
│   ├── undo.test.ts
│   ├── tokens.test.ts                              # CSS 变量与 TS 镜像一致性
│   ├── performance.test.ts                         # 性能红线
│   └── e2e/                                        # Playwright 端到端
│       └── full-flow.spec.ts
├── scripts/
│   ├── verify-offline.mjs                          # 构建后断言所有请求 host = localhost
│   ├── validate-fixture.mjs                        # JSON 数据集合规性校验
│   └── pack-release.sh                             # 把 dist + start.sh 打成可分发 zip
├── .gitignore                                      # 含 .superpowers/ 与 dist/
├── package.json
├── vite.config.ts
├── tsconfig.json                                   # strict + noUncheckedIndexedAccess
├── index.html
├── README.md                                       # 「双击 start.sh 即用」说明
└── CLAUDE.md                                       # 已存在
```

### 1.2 命名/分层约定

- **每步一个文件夹**：步骤模块清晰隔离，砍/换/换样例不会牵连别的步骤
- **状态全部走 `src/store/`**：组件无状态副作用，只读 store + 派发 action（避免 CLAUDE.md 第 2 条硬约束的违反路径）
- **`src/data/*.json` 是数据驱动 schema 实例**：增加副样例 = 新增 JSON + 注册一行
- **`src/lib/format/*.ts` 与组件解耦**：纯函数 `AnnotationState → JSON`，便于在测试里跑 schema 校验
- **`tests/e2e/` 用 Playwright**：纯前端 Demo 比 Cypress 更轻、更适合 CI

### 1.3 关键文件大小预算

| 文件 | 预期 LOC | 红线 |
|---|---|---|
| `Step4Review/ReviewCanvas.tsx` | ~150 | 超过 250 拆分 |
| `store/demoStore.ts` | ~200 | 超过 300 按 slice 拆 |
| `lib/format/cocoVideo.ts` | ~100 | 超过 150 分子结构 |
| `steps/*/index.tsx` | ~80 | 超过 150 提子组件 |

### 1.4 开发期辅助：URL 参数 `?step=N`

为方便开发期调试与未来截屏文档：

- `?step=4` → 直接跳到 Step 4（已加载主样例 + 模拟揭示动画完成态）
- `?dataset=meeting-room&step=4` → 指定样例 + 步骤
- `?speed=instant` → 速度档预置

URL 参数仅在 `import.meta.env.DEV === true` 时生效；生产构建忽略，避免演示中误启用。

---

## 2. 状态管理与数据流

### 2.1 单一全局 Store（Zustand + immer）

**核心原则**：所有运行时状态只活在一个 Zustand store。组件只读 + 派发 action，禁止在组件内 setState 缓存标注数据。

#### 2.1.1 Store 切片结构

```ts
// src/store/demoStore.ts

interface DemoStore {
  // ─── 1. 编排状态机 ───────────────────────────────────────────
  demoStep: DemoStep;                       // 1 | 2 | 3 | 4 | 5
  playMode: 'manual' | 'auto';
  speed: Speed;                             // '1x' | '2x' | 'instant'
  paused: boolean;
  dirty: boolean;                           // 是否被修改过（决定重置是否需二次确认）

  // ─── 2. 当前选中的样例 ────────────────────────────────────────
  activeDatasetId: DatasetId;

  // ─── 3. 标注内存状态（核心数据） ──────────────────────────────
  // annotations 是当前 dataset 的 deep clone，会被审核操作真实修改
  annotations: AnnotationState[];

  // ─── 4. 审核步骤的 UI 子状态 ──────────────────────────────────
  selectedTrackId: string | null;
  reviewQueueIndex: number;

  // ─── 5. 揭示动画进度 ─────────────────────────────────────────
  revealProgress: {
    metadataFieldsShown: number;
    inferenceProgress: number;              // 0-1
    boxesRevealed: number;
  };

  // ─── 6. 撤销栈（仅 Step 4） ──────────────────────────────────
  undoStack: ReviewAction[];

  // ─── Actions ─────────────────────────────────────────────
  goToStep: (step: DemoStep) => void;
  togglePlayMode: () => void;
  setSpeed: (s: Speed) => void;
  pause: () => void;
  resume: () => void;

  selectDataset: (id: DatasetId) => void;
  reset: () => void;

  acceptBox: (trackId: string) => void;
  rejectBox: (trackId: string) => void;
  correctBoxGeometry: (trackId: string, frameIdx: number, newCoords: BBox) => void;
  acceptAllRemaining: () => void;
  selectTrack: (id: string | null) => void;

  undo: () => void;

  setRevealProgress: (p: Partial<DemoStore['revealProgress']>) => void;
}
```

#### 2.1.2 关键约束（落地 CLAUDE.md 硬约束）

- `annotations` 永远是 dataset 初始 Mock 的 `structuredClone()`——避免污染源数据
- 审核 actions 用 immer middleware（Zustand 自带）——保证 React 渲染按引用对比可触发更新
- Konva Transformer 的 `onTransformEnd` 必须调用 `correctBoxGeometry()`——禁止只改 Konva 节点不回写 store

### 2.2 重置语义（关键 P0 行为）

#### 2.2.1 重置流程

```
用户点 ↺ 重置
   |
   v
dirty === true ?
   ├─ true  → 弹二次确认 dialog "重置将清空当前演示进度？"
   |         确认 → 继续；取消 → 终止
   ├─ false → 直接继续
   |
   v
执行 reset()：
   1. 从 src/data/ 取当前 activeDatasetId 的 dataset
   2. structuredClone() 对 annotations 做深拷贝
   3. set({
        annotations: cloned,
        demoStep: 1,
        playMode: 'manual',
        paused: false,
        dirty: false,
        selectedTrackId: null,
        reviewQueueIndex: 0,
        revealProgress: { metadataFieldsShown: 0, inferenceProgress: 0, boxesRevealed: 0 },
        undoStack: [],
        // 保留: activeDatasetId, speed
      })
   4. 取消所有正在运行的 timeline / setTimeout
   5. requestAnimationFrame → 触发 step1 视图渲染
```

#### 2.2.2 性能预算（PRD 第十章 ≤ 200ms）

- `structuredClone()` 132 关键帧 + 47 track ≈ 3-8ms
- React 重渲染整树 ≈ 30-60ms
- Konva Stage 销毁重建 ≈ 30-50ms
- **总和 < 120ms**，留 80ms 余量

#### 2.2.3 测试守护

`tests/store.test.ts` 必含：

```ts
test('reset deep-clones annotations, source data unaffected', () => {
  const store = createStore();
  store.acceptBox('trk_2');
  store.reset();
  expect(store.annotations.find(a => a.track_id === 'trk_2')!.review.status).toBe('pending');

  // 关键：源数据集没被污染
  const sourceDataset = require('../src/data/city-road.json');
  expect(sourceDataset.annotations.find(a => a.track_id === 'trk_2').review.status).toBe('pending');
});

test('reset preserves activeDataset and speed', () => {
  const store = createStore();
  store.selectDataset('meeting-room');
  store.setSpeed('2x');
  store.acceptBox('trk_xxx');
  store.reset();
  expect(store.activeDatasetId).toBe('meeting-room');
  expect(store.speed).toBe('2x');
  expect(store.demoStep).toBe(1);
});
```

### 2.3 数据流方向（单向）

```
[src/data/*.json] ── selectDataset ──→ store.annotations (深拷贝)
                                              |
   ┌──────────────────────────────────────────┤
   ▼                                          ▼
Step 3 BoxRevealCanvas              Step 4 ReviewCanvas
(只读, 渲染框逐个浮现)              (Konva Transformer onTransformEnd
                                              ▼
                                    store.correctBoxGeometry()
                                              ▼
                                    store.annotations 被更新
                                              ▼
                                    Step 5 JsonPreview 实时反映
                                              ▼
                                    exportZip() 序列化并下载)
```

**禁止的反模式**：

- ❌ Step 4 在组件 useState 缓存「已审核的 trackId 列表」——必须读 store
- ❌ Step 5 打包时重新读 dataset JSON——必须读 store.annotations
- ❌ Konva 节点属性是真相源——store 永远是真相源

### 2.4 撤销栈

#### 2.4.1 数据结构

```ts
type ReviewAction =
  | { type: 'accept'; trackId: string; prevStatus: ReviewStatus; prevSource: AnnotationSource }
  | { type: 'reject'; trackId: string; prevStatus: ReviewStatus }
  | { type: 'correct-geometry'; trackId: string; frameIdx: number; prevCoords: BBox; prevSource: AnnotationSource };

undoStack: ReviewAction[];   // 栈深上限 20
```

#### 2.4.2 行为

- `acceptBox / rejectBox / correctBoxGeometry` → push 到栈
- `undo()` → pop 最近一个 action，按反向操作恢复 annotations
- `acceptAllRemaining()`（一键全部接受 44 个）**不入栈**——批量操作 undo 反而造成视觉灾难
- `reset()` 清空栈
- 栈达 20 个时丢弃最旧的（防内存增长）
- Ctrl+Z 仅在 Step 4 生效

### 2.5 持久化策略

**不做**。Demo 是「现场演示工具」，刷新页面应回到初始状态——这正是 PRD 第五章「Demo 状态只活在内存」的应用场景。

---

## 3. Demo 编排状态机与控制条

### 3.1 状态机图

```
                                  ┌────────────────────────────┐
                                  │  IDLE (首次打开页面)        │
                                  └─────────────┬──────────────┘
                                                │ selectDataset() / 默认 city-road
                                                ▼
                          ┌──────────────────────────────────────┐
                          │  STEP1_UPLOAD                         │
                          │  (样例选 / 假上传 / 拖文件)            │
                          └─────────────┬────────────────────────┘
                                        │ 选样例 or 假上传完成切回样例
                                        ▼
                          ┌──────────────────────────────────────┐
                          │  STEP2_METADATA_REVEAL                │
                          │  (元信息打字机揭示, ~1.5s × speed)    │
                          └─────────────┬────────────────────────┘
                                        │ 揭示完成
                                        ▼
                          ┌──────────────────────────────────────┐
                          │  STEP3_INFERENCE_REVEAL               │
                          │  (推理进度 + 框逐个浮现, ~2.5s × speed)│
                          └─────────────┬────────────────────────┘
                                        │ 揭示完成 + 1.5s 缓冲
                                        ▼
                          ┌──────────────────────────────────────┐
                          │  STEP4_REVIEW                          │
                          │  4a. AUTO_PRESENT (虚拟主讲裁决)      │
                          │      仅 playMode=auto                 │
                          │  ↓ 任意鼠标/键盘点击                   │
                          │  4b. MANUAL_REVIEW                     │
                          │  ↓ 3 重点项处理完                      │
                          │  4c. ALL_ACCEPT_PROMPT                 │
                          └─────────────┬────────────────────────┘
                                        │ 全部裁决完
                                        ▼
                          ┌──────────────────────────────────────┐
                          │  STEP5_EXPORT                         │
                          └─────────────┬────────────────────────┘
                                        │ 下载完成
                                        ▼
                          ┌──────────────────────────────────────┐
                          │  DONE (弹「重新演示」CTA)             │
                          └──────────────────────────────────────┘

任意状态:
  - [↺ 重置]    → 回 STEP1_UPLOAD（保留 activeDataset / speed）
  - [⏸ 暂停]    → 冻结自动推进（仅 playMode=auto 时有效）
  - [⏭ 下一步]  → 跳过当前揭示动画 → 进入下一步（Step 4 manual_review 未完成则置灰）
```

### 3.2 控制条按钮的行为

| 按钮 | 触发条件 | 行为 |
|---|---|---|
| ▶ 自动演示 | playMode === 'manual' | 切到 auto，从当前 step 按预设节奏推进 |
| ⏸ 暂停 | playMode === 'auto' && !paused | paused = true，所有 timeline.pause() |
| ▶ 继续 | playMode === 'auto' && paused | paused = false，timeline.resume() |
| ⏭ 下一步 | 任意（除 Step 4 manual 未完成 / Step 5 打包中） | 跳过当前揭示 → 下一 step |
| ↺ 重置 | 任意 | 见 §2.2.1 |
| 速度 1x/2x/即时 | 任意 | 修改后立即应用到当前正在播放的 timeline |

#### 3.2.1 防呆

- ⏭ 下一步在 Step 4 manual_review 阶段且仍有重点项未裁决 → 置灰 + tooltip「还有 N 个重点项待裁决」
- ⏭ 下一步在 Step 4 AUTO_PRESENT 阶段 → 加速完成虚拟主讲剩余动作（不直接跳过审核）
- ⏸ 暂停在 Step 5 打包阶段不响应（zip 生成是同步操作不可中断）
- 自动模式中的暂停/重置 → 立即停掉所有正在跑的 setTimeout / animation timeline

### 3.3 揭示动画引擎

#### 3.3.1 速度档

```ts
const baseDuration = {
  metadataReveal: 1500,
  inferenceReveal: 2500,
  boxFadeIn: 80,
  step3to4Buffer: 1500,
};

const speedMultiplier = {
  '1x': 1,
  '2x': 0.5,
  'instant': 0,        // 0 时直接 setRevealProgress(end)，跳过 timeline
};

function applySpeed(baseMs: number, speed: Speed): number {
  return baseMs * speedMultiplier[speed];
}
```

#### 3.3.2 实现选型

- 不引入额外动画库（GSAP / Framer Motion 均嫌重）
- CSS transition + Konva tween + 自写 Timeline 调度器（约 60 LOC）
- 框浮现用 `opacity` + `transform: scale()` 的 CSS transition（GPU 加速）
- 47 个框分散在 2.5s 内，平均 53ms 一个，单帧只渲染 1-2 个新框

#### 3.3.3 Timeline 抽象

```ts
// src/lib/animation/timeline.ts
class Timeline {
  schedule(at: number, fn: () => void): void;
  start(speed: Speed): void;
  pause(): void;
  resume(): void;
  cancel(): void;
  jumpToEnd(): void;       // 用于 ⏭ 下一步
}
```

### 3.4 自动模式到 Step 4 的虚拟主讲

#### 3.4.1 行为流程

```
进入 Step 4 + playMode === 'auto'
   |
   v
触发虚拟主讲 timeline:
   t=0      → 选中重点项[0] (行人#2, 0.41), 右属性面板高亮
   t=1500ms → store.acceptBox('trk_2'); 框变绿 + ✓ 动画
   t=1500ms → 选中重点项[1] (车辆#9, 0.48)
   t=3500ms → store.correctBoxGeometry('trk_9', currentFrameIdx, 收紧 ~15% 的坐标);
              视觉: 8 控制点亮起 → 框微缩 → 框变蓝
   t=3500ms → 选中重点项[2] (标志#5, 0.49)
   t=5500ms → store.rejectBox('trk_5'); 框变灰虚线 + 淡出
   t=6500ms → store.acceptAllRemaining(); 44 个高置信框集体变绿
   t=7500ms → goToStep(5)

任何中断 (鼠标点击 canvas/property panel / 任何键盘按键):
   → timeline.cancel()
   → playMode = 'manual'
   → 保留已发生的 review 改动
   → 当前选中项保留为最后正在处理的那个
```

#### 3.4.2 中断检测

```ts
const takeover = () => virtualPresenter.cancel();
canvas.addEventListener('mousedown', takeover);
panel.addEventListener('mousedown', takeover);
window.addEventListener('keydown', takeover);
```

**注意**：控制条按钮（▶ ⏸ ⏭ ↺）不算「客户接管」——它们走自己的状态机 transition。

#### 3.4.3 演示模式角标

虚拟主讲运行时，右属性面板顶部固定一个角标：

```
┌─────────────────────────────────┐
│ 🎬 演示模式自动裁决中            │ 紫蓝渐变背景 + 白字
│ 任意点击立即接管                 │
└─────────────────────────────────┘
```

接管后立即移除。

### 3.5 暂停/恢复语义边界

| 操作 | 效果 |
|---|---|
| Step 2/3 揭示动画进行中 ⏸ | timeline.pause()，进度条停在原地，已浮现的框保持 |
| Step 4 虚拟主讲进行中 ⏸ | 暂停下一个动作的 setTimeout，已选中的框保持高亮 |
| Step 5 打包动画进行中 ⏸ | 不响应（zip 生成是同步） |

### 3.6 测试要点

```ts
test('virtual presenter cancels on any user input', () => { /* ... */ });
test('next button disabled when review queue not done', () => { /* ... */ });
test('speed change applies to running timeline', () => { /* ... */ });
test('control buttons do NOT switch to manual mode', () => { /* ... */ });
```

---

## 4. 数据 schema 与 Mock 数据集

### 4.1 TypeScript 类型定义（与 PRD 第五章 1:1）

```ts
// src/types.ts

export type Speed = '1x' | '2x' | 'instant';
export type DemoStep = 1 | 2 | 3 | 4 | 5;
export type DatasetId = 'city-road' | 'meeting-room' | 'retail-cam';
export type BBox = [x: number, y: number, w: number, h: number];
export type AnnotationSource = 'machine' | 'human';
export type ReviewStatus = 'pending' | 'accepted' | 'corrected' | 'rejected';

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
  timestamp_ms: number;       // 权威主键
  frame_no: number;           // 由 timestamp 推算, 仅展示
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
```

**约束**：

- `timestamp_ms` 是关键帧权威主键，`frame_no` 由前者推算
- `review` 用单对象（PRD 第五章「Demo 简化」）
- `confidence` 允许 `null`
- `tsconfig.json` 开 `strict` + `noUncheckedIndexedAccess`

### 4.2 主样例：city-road

#### 4.2.1 元信息

```json
{
  "version": "2.0-demo",
  "dataset_id": "city-road",
  "display": "城市道路样例",
  "video_src": "/mock/city-road/road_demo.mp4",
  "thumb": "/mock/city-road/road_thumb.jpg",
  "metadata": {
    "duration_ms": 30000,
    "frame_count": 900,
    "fps": 30.0,
    "width": 1920,
    "height": 1080,
    "codec": "h264",
    "audio_tracks": 1,
    "sampled_frames": 132
  },
  "demo_script": {
    "metadata_reveal_ms": 1500,
    "inference_reveal_ms": 2500,
    "review_focus_ids": ["trk_2", "trk_9", "trk_5"]
  },
  "annotations": [ /* 47 条，见 4.2.2 */ ]
}
```

#### 4.2.2 标注分布

| 数量 | 类型 | confidence 范围 | needs_review |
|---|---|---|---|
| 3 | 重点项（低置信） | 0.41 / 0.48 / 0.49 | true |
| 28 | 高置信车辆 | 0.85 - 0.97 | false |
| 12 | 高置信行人 | 0.78 - 0.94 | false |
| 4 | 高置信交通标志 | 0.82 - 0.93 | false |
| **47** | 总计 | | |

**3 个重点项**（按虚拟主讲三动作设计）：

| track_id | label | confidence | 设计意图 | 虚拟主讲动作 |
|---|---|---|---|---|
| trk_2 | pedestrian (行人) | 0.41 | 真行人，机器没把握 | ✓ 接受 |
| trk_9 | vehicle (车辆) | 0.48 | 是车，但框偏大需收紧 | ✎ 改框（缩小约 15%） |
| trk_5 | traffic_sign (交通标志) | 0.49 | 实际是路边广告牌，误检 | ✗ 否决 |

#### 4.2.3 关键帧密度

每个 track 平均 5-8 个关键帧，分布于 0/4s/10s/15s/20s/25s/30s 等节点。47 × 6 ≈ 282 个关键帧，JSON 文件 ≈ 40-60KB（gzipped < 10KB）。

#### 4.2.4 坐标系

bbox 坐标基于 1920×1080 原视频分辨率；审核 Canvas 渲染时按 video 元素实际显示尺寸做 viewport scale。客户拖入自有视频 → 走假上传切回样例（§5.1.2）→ 永远不会出现「真画面 + 假框」。

### 4.3 副样例：meeting-room / retail-cam

#### 4.3.1 设计意图

只做门面 + 可跑通——客户切换样例后能跑完五步骤，但不为副样例精心设计重点项叙事。

#### 4.3.2 简化策略

| 字段 | 主样例 | 副样例 |
|---|---|---|
| metadata | 完整 | 完整 |
| demo_script.review_focus_ids | 3 个精心设计 | 2 个（一个 ✓ 一个 ✗，无 ✎） |
| annotations 总数 | 47 | ~15 |
| 关键帧密度 | 平均 6 | 平均 3 |
| label 类型 | 行人/车辆/标志 | meeting-room: 人/笔记本；retail-cam: 人/购物车 |

#### 4.3.3 文件大小

每个副样例 JSON < 20KB；总数据 < 100KB；配合 3 个视频（< 8MB 每个）+ 帧缩略图，整个 `public/mock/` < 25MB。

### 4.4 Mock fixture 生成与校对

#### 4.4.1 生成方式

```
src/data/
├── city-road.json              # 最终产物（手工 + 校对 + 提交 git）
├── meeting-room.json
├── retail-cam.json
└── _generators/                # 仅本地开发期，不进 dist
    ├── city-road-fixture.ts
    └── README.md
```

#### 4.4.2 生成脚本职责

- schema 正确性（types.ts 编译时校验）
- 坐标合理性：行人在画面中下、车辆在中部、标志在上部边缘
- 置信度分布：高置信 0.78-0.97 均匀，3 个重点项手动指定
- 关键帧时间戳均匀分布

#### 4.4.3 校对清单（手工 review）

- [ ] 3 个重点项 bbox 在视频对应时间戳的画面里视觉合理
- [ ] 高置信车辆框宽高比 ≥ 1.5
- [ ] 行人框宽高比 ≤ 0.6
- [ ] 没有 bbox 越界（坐标 < 0 或 > video 尺寸）
- [ ] 没有重复 track_id

`scripts/validate-fixture.mjs` 自动跑这些校验，CI 一并执行。

### 4.5 视频素材

#### 4.5.1 候选源

| 样例 | 推荐来源 | 关键词 | 时长 | 分辨率 | 编码 |
|---|---|---|---|---|---|
| city-road | Pexels Videos | "traffic road urban driving" | 30s | 1920×1080 | H.264 |
| meeting-room | Pexels Videos | "office meeting people" | 45s | 1280×720 | H.264 |
| retail-cam | Coverr | "supermarket store retail" | 60s | 1920×1080 | H.264 |

具体直链 + SHA-256 + 授权声明见**附录 A**。

#### 4.5.2 处理流程

```bash
mv ~/Downloads/city-road.mp4 public/mock/city-road/road_demo.mp4
ffmpeg -i public/mock/city-road/road_demo.mp4 \
       -vf "select='eq(n,100)+eq(n,300)'" -vsync vfr \
       public/mock/city-road/frames/%04d.jpg
```

如原视频参数不匹配 → ffmpeg 转码到目标参数。

#### 4.5.3 占位 mp4（开发期不阻塞）

真视频替换前，用 ffmpeg 生成 30s 黑屏 + 时间戳水印 mp4：

```bash
ffmpeg -f lavfi -i color=c=black:s=1920x1080:d=30 \
       -vf "drawtext=text='%{pts\\:hms}':x=10:y=10:fontsize=48:fontcolor=white" \
       -c:v libx264 -pix_fmt yuv420p public/mock/city-road/road_demo.mp4
```

#### 4.5.4 验证

```bash
ffprobe -v error -show_entries format=duration,bit_rate \
        -show_entries stream=width,height,r_frame_rate,codec_name \
        public/mock/city-road/road_demo.mp4
```

### 4.6 数据集注册

```ts
// src/data/index.ts
import cityRoad from './city-road.json';
import meetingRoom from './meeting-room.json';
import retailCam from './retail-cam.json';
import type { Dataset, DatasetId } from '../types';

export const defaultDatasets: Record<DatasetId, Dataset> = {
  'city-road': cityRoad as Dataset,
  'meeting-room': meetingRoom as Dataset,
  'retail-cam': retailCam as Dataset,
};

export const defaultDatasetId: DatasetId = 'city-road';
```

Vite 把 import 的 JSON 内联进 bundle，运行时无需异步加载。

---

## 5. 步骤模块实现细节

### 5.1 Step 1 · 上传

#### 5.1.1 视图结构

```
┌─────────────────────────────────────────────────────────┐
│ [大居中卡片]                                              │
│   ┌─────────────────────────────────────────────────┐   │
│   │  ⬇️ (illustration)                              │   │
│   │  拖入视频或选择样例                              │   │
│   │  [选择文件]  ← 渐变紫蓝按钮                      │   │
│   └─────────────────────────────────────────────────┘   │
│                                                           │
│   推荐样例（点击即用，数据已就绪）                          │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│   │ [缩略图]  │  │ [缩略图]  │  │ [缩略图]  │             │
│   │ 城市道路  │  │ 室内会议  │  │ 商超监控  │             │
│   │ 30s 1080p│  │ 45s 720p │  │ 60s 1080p│             │
│   │ [使用 →] │  │ [使用 →] │  │ [使用 →] │             │
│   └──────────┘  └──────────┘  └──────────┘             │
└─────────────────────────────────────────────────────────┘
```

当前选中样例（如 city-road）有渐变紫蓝外框 + ✓ 角标。

#### 5.1.2 拖入任意文件的处理

```
用户拖入文件
   |
   v
非视频 (mime !startsWith 'video/') → toast "请拖入视频文件，或直接选用样例"
   |
   v
视频文件 → 显示假上传进度条 (2s)
   |
   v
进度满 → 弹友好 toast (3s 自动消失):
   "为了让演示更贴近真实标注效果，已为您切换至『城市道路』样例数据。
    您上传的文件不会上传至任何服务器。"
   |
   v
selectDataset('city-road') → 自动推进到 step2
```

**关键技术点**：

- 假上传不读文件内容（不调用 FileReader），只是 setTimeout 进度条动画
- 拖入文件的 URL.createObjectURL **不创建**——既然要切回样例，就没必要分配 blob URL（避免内存泄漏 + 无需 revokeObjectURL 清理）

#### 5.1.3 测试要点

- 拖入 .png → toast，不进入假上传
- 拖入 .mp4 → 假上传 → 切回 city-road
- 点击 city-road 卡片 → 直接进 step2，无假上传

### 5.2 Step 2 · 元信息揭示

#### 5.2.1 视图

```
┌─────────────────────────────────────────────────┐
│ ② 元信息提取                                      │
│                                                   │
│ 解析中... [████████░░] 解析容器/编码/帧率           │ ← 1.5s 进度条
│                                                   │
│ ┌─────────────────────────────────────────────┐ │
│ │ 解析完成 ✓                                  │ │
│ │ 时长          00:00:30.000 (900 帧)        │ │
│ │ 分辨率        1920 × 1080                  │ │ ← 打字机逐行揭示
│ │ 帧率          30 fps (恒定)                 │ │
│ │ 编码          H.264 / yuv420p              │ │
│ │ 音轨          1 条 AAC 48kHz               │ │
│ │ 抽帧结果      场景自适应 → 132 关键帧       │ │
│ └─────────────────────────────────────────────┘ │
│              [下一步: 自动标注 →]                │
└─────────────────────────────────────────────────┘
```

#### 5.2.2 打字机揭示

每行两阶段：

1. 行框淡入（150ms）：背景从透明 → 浅紫
2. 字符逐个出现（每字符 8ms × speed）

7 行 ÷ (1500ms - 进度条 600ms) ≈ 130ms / 行；配合每行 ~20 字符 × 8ms = 160ms，自然衔接。

`speed === 'instant'` 直接全部显示，无动画。

#### 5.2.3 数据来源

```ts
const meta = store.activeDataset.metadata;
const fields = [
  { label: '时长', value: `${formatDuration(meta.duration_ms)} (${meta.frame_count} 帧)` },
  { label: '分辨率', value: `${meta.width} × ${meta.height}` },
  { label: '帧率', value: `${meta.fps} fps (恒定)` },
  { label: '编码', value: `${meta.codec.toUpperCase()} / yuv420p` },
  { label: '音轨', value: `${meta.audio_tracks} 条 AAC 48kHz` },
  { label: '抽帧结果', value: `场景自适应 → ${meta.sampled_frames} 关键帧` },
];
```

### 5.3 Step 3 · 自动标注

#### 5.3.1 视图

```
┌────────────────────────────────────────────────────────┐
│ ③ 自动标注                                              │
│                                                          │
│ 模型推理中...                                            │
│  ├ 目标检测 YOLOv8        [████████ 完成] 47 对象       │
│  ├ 多目标跟踪 ByteTrack   [██████░░ 关联中] track 12   │
│  └ 低置信对象             [3 个 已标记『需重点审核』]   │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐│
│ │ [Konva Stage 渲染视频帧 + 标注框逐个浮现]           ││
│ │   ┌────────┐                                        ││
│ │   │车 0.91 │   ┌────┐                              ││
│ │   └────────┘   │行人│  ← 0.41 红色"需重点审核"     ││
│ │                └────┘                              ││
│ └─────────────────────────────────────────────────────┘│
│                                                          │
│ [────────────────────●──────] 时间轴, track 逐条点亮     │
│        [下一步: 人工审核 →]                              │
└────────────────────────────────────────────────────────┘
```

#### 5.3.2 推理进度编排（2.5s）

| 时间窗口 | 事件 |
|---|---|
| 0-1000ms | YOLOv8 进度条 0→100%，到 100% 显 "47 对象" |
| 200-2000ms | ByteTrack 进度条 0→100%（重叠开始，制造「并行计算」感） |
| 800-2500ms | 47 个框分布式淡入（平均 53ms 间隔，单框 fade 80ms） |
| 2200ms | 3 个低置信框标红 + 抖动 |
| 2500ms | 显统计 + 「下一步」按钮亮起 |

#### 5.3.3 框淡入实现

每个框是 Konva.Group (Rect + Text)。Group 初始 `opacity: 0, scale: 0.85`，按计划时间 tween 到 `opacity: 1, scale: 1`。

低置信框 `needs_review === true` 多一个 shake 动画：x 在 `originalX ± 4` 之间抖 3 次（300ms）。

#### 5.3.4 时间轴

底部 ~30px 高水平 timeline，每个 track 是按 keyframe 时间分布画的活跃区段。47 个 track 按 y 轴分 7-8 行平铺。「track 逐条点亮」= 按浮现顺序，对应 segment 从灰 → 主题紫。

### 5.4 Step 4 · 审核（核心）

#### 5.4.1 Konva Stage 配置

```tsx
<Stage 
  width={canvasWidth} 
  height={canvasHeight}
  onClick={(e) => { if (e.target === e.target.getStage()) selectTrack(null); }}
>
  <Layer>
    {/* 视频底图: video 元素 + Konva.Image 同步绘制每帧 */}
    <Image image={videoElement} width={canvasWidth} height={canvasHeight} />
  </Layer>
  <Layer>
    {visibleAnnotations.map(a => <BoxGroup key={a.track_id} annotation={a} />)}
  </Layer>
  <Layer>
    {selectedTrackId && <Transformer ref={transformerRef} />}
  </Layer>
</Stage>
```

#### 5.4.2 视频帧同步

用 `requestVideoFrameCallback`（Chrome 83+ / Edge 84+ 原生 API）：

```ts
useEffect(() => {
  const video = videoRef.current!;
  let handle: number;
  const onFrame: VideoFrameRequestCallback = () => {
    konvaImageRef.current!.image(video);
    konvaImageRef.current!.getLayer()!.batchDraw();
    handle = video.requestVideoFrameCallback(onFrame);
  };
  handle = video.requestVideoFrameCallback(onFrame);
  return () => video.cancelVideoFrameCallback(handle);
}, []);
```

降级：浏览器无此 API → ErrorBoundary 显示「请使用最新 Chrome」遮罩。

#### 5.4.3 当前帧的可见框

```ts
const visibleAnnotations = useMemo(() => {
  const currentTimeMs = videoRef.current!.currentTime * 1000;
  return annotations.filter(a => {
    const firstKf = a.keyframes[0]!.timestamp_ms;
    const lastKf = a.keyframes.at(-1)!.timestamp_ms;
    return currentTimeMs >= firstKf && currentTimeMs <= lastKf;
  });
}, [annotations, currentTimeMs]);
```

bbox 在两关键帧间的位置：线性插值。

#### 5.4.4 框颜色编码

| review.status | 边框 | strokeWidth | 填充 | dash | shadow |
|---|---|---|---|---|---|
| pending（重点项） | --warning-500 | 2 | transparent | — | — |
| pending（高置信） | --neutral-400 | 1.5 | transparent | — | — |
| accepted | --success-500 | 2 | rgba(16,185,129,0.05) | — | — |
| corrected | --info-500 | 2 | rgba(59,130,246,0.05) | — | — |
| rejected | --rejected-stroke | 1.5 | — | [4,4] | — |
| selected | (上述任一) | (+1) | (+0.05 透明度) | — | blur:8 brand 0.4 |

label 文字：12px JetBrains Mono，背景色 = stroke 色，padding 2px 6px，圆角 3px，左上外侧 4px。

#### 5.4.5 队列轨道

底部 80px 横向轨道，3 张 review_focus 卡片 + 「一键全部接受 (44)」按钮。

| 卡片状态 | 样式 |
|---|---|
| pending | 白底 + neutral-200 描边 |
| current | 渐变紫蓝外框 + shadow-brand + ◀ 当前 |
| 已裁决 | 描边按 review.status 变色 + opacity 0.6 |

「一键全部接受」按钮在 3 个重点项全部裁决前置灰；裁决完后变成主推紫色 CTA。

#### 5.4.6 拖框 Transformer

```tsx
<Transformer
  rotateEnabled={false}
  resizeEnabled={true}
  enabledAnchors={['top-left','top-right','bottom-left','bottom-right',
                   'middle-left','middle-right','top-center','bottom-center']}
  anchorSize={8}
  anchorStroke="#F97316"
  anchorFill="white"
  borderStroke="transparent"
  onTransformEnd={() => {
    const node = transformerRef.current!.nodes()[0]!;
    const newCoords: BBox = [
      node.x(), node.y(),
      node.width() * node.scaleX(),
      node.height() * node.scaleY()
    ];
    node.scaleX(1); node.scaleY(1);
    store.correctBoxGeometry(selectedTrackId, currentFrameIdx, newCoords);
  }}
/>
```

`onTransformEnd` 时立即把 scale 合并回 width/height，保证 store 状态对得上。

#### 5.4.7 性能（PRD 第七章 7.5 切帧 ≤ 100ms）

H.264 + 30fps + 短视频，video.currentTime 设置后实测 30-60ms 完成 seek。

### 5.5 Step 5 · 导出

#### 5.5.1 视图

```
┌──────────────────────────────────────────────────────┐
│ ⑤ 导出标注结果                                         │
│                                                        │
│ 格式：( • ) 原生 JSON（含溯源）                         │
│       (   ) COCO-Video                                │
│                                                        │
│ 包含：[✓] 人工审核记录   [✓] 置信度                    │
│       [✓] 帧缩略图                                    │
│                                                        │
│ 预览（实时反映你刚才的审核改动）：                      │
│ ┌──────────────────────────────────────────────────┐ │
│ │ {                                                │ │
│ │   "version": "2.0-demo",                         │ │
│ │   "annotations": [                               │ │
│ │     {                                            │ │
│ │       "track_id": "trk_2",                       │ │
│ │       "label_id": "pedestrian",                  │ │
│ │       "source": "human",     // 你纠正过        │ │
│ │       "review": { "status": "corrected", ... }   │ │
│ │     },                                           │ │
│ │     ...                                          │ │
│ │   ]                                              │ │
│ │ }                                                │ │
│ └──────────────────────────────────────────────────┘ │
│ [↓ 下载导出包 (city_road_export.zip · ~5.2 MB)]      │
└──────────────────────────────────────────────────────┘
```

#### 5.5.2 实时预览

`<pre>` + 自写 JSON 高亮（~30 LOC）。预览只显示前 80 行 + 折叠提示。`useMemo` 依赖 store.annotations 即重算。

#### 5.5.3 zip 打包

```ts
async function exportZip(format: 'native' | 'coco-video', store: DemoStore) {
  const zip = new JSZip();
  const datasetId = store.activeDatasetId;
  const dataset = defaultDatasets[datasetId];

  const folder = zip.folder('annotations')!;
  if (format === 'native') {
    folder.file('native.json', JSON.stringify(toNative(store.annotations), null, 2));
  } else {
    folder.file('coco_video.json', JSON.stringify(toCocoVideo(store.annotations), null, 2));
  }

  const framesFolder = zip.folder('frames')!;
  for (const frame of FRAMES_TO_INCLUDE) {
    const blob = await fetch(`/mock/${datasetId}/frames/${frame}`).then(r => r.blob());
    framesFolder.file(frame, blob);
  }

  zip.file('manifest.json', JSON.stringify({
    dataset_id: datasetId,
    note: '演示数据集 · Demo Export',
    exported_at: Date.now(),
    format,
    statistics: {
      total: store.annotations.length,
      accepted: store.annotations.filter(a => a.review.status === 'accepted').length,
      corrected: store.annotations.filter(a => a.review.status === 'corrected').length,
      rejected: store.annotations.filter(a => a.review.status === 'rejected').length,
    }
  }, null, 2));

  zip.file('README.txt', README_CONTENT);

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${datasetId}_export.zip`);
}
```

#### 5.5.4 COCO-Video 序列化

```ts
function toCocoVideo(annotations: Annotation[], dataset: Dataset): CocoVideoOutput {
  const { width, height, fps } = dataset.metadata;
  const categoryMap = buildCategoryMap(annotations);

  return {
    info: { description: 'Demo Export', version: '2.0-demo', date_created: new Date().toISOString() },
    videos: [{ id: 1, file_name: dataset.video_src, width, height, frame_rate: fps }],
    categories: extractUniqueCategories(annotations),
    annotations: annotations.flatMap(a => 
      a.keyframes.map(kf => ({
        id: hash(a.track_id + kf.timestamp_ms),
        track_id: parseInt(a.track_id.replace('trk_','')),
        video_id: 1,
        timestamp: kf.timestamp_ms / 1000,
        bbox: kf.geometry.coords,
        category_id: categoryMap[a.label_id]!,
        score: a.confidence,
        // 扩展字段，COCO 社区习惯前缀 x_
        x_review: a.review,
        x_source: a.source,
      }))
    ),
  };
}
```

#### 5.5.5 性能（PRD 第十章 ≤ 1.5s）

- JSON 序列化 ~10ms
- 4-6 张 jpg fetch ~50ms 一张 = ~300ms
- JSZip 压缩 < 100ms
- **预估 500-800ms**

按钮在打包期间 disabled + spinner。

### 5.6 顶栏与控制条

#### 5.6.1 顶栏（56px）

```
┌────────────────────────────────────────────────────────────────────┐
│ ◆ Frameworks Demo  ①上传 → ②元信息 → ③标注 → ④审核 → ⑤导出  ▶⏸⏭↺ 1× │
└────────────────────────────────────────────────────────────────────┘
   16 + Logo (~140)    步骤胶囊群 (~480)              控制按钮 (~200)
```

总宽 ≈ 840px，1280px 下还有 440px 富余。

#### 5.6.2 步骤胶囊状态

| 状态 | 样式 |
|---|---|
| 已完成 | 浅灰底 + 灰文字 + ✓ 角标 |
| 当前 | 渐变紫蓝底 + 白字 + shadow-brand |
| 未到达 | 浅灰底 + 浅灰文字（disabled） |

胶囊**不可点击**——避免客户跳步导致状态错乱。

#### 5.6.3 速度档

控制按钮组最右一个下拉：「1× ▾」 → `1× / 2× / 即时`。

---

## 6. 视觉设计系统（B · 现代 SaaS）

### 6.1 颜色

#### 6.1.1 主色（紫蓝渐变）

| Token | Hex | 用途 |
|---|---|---|
| --brand-500 | #6366F1 | 主色 |
| --brand-600 | #4F46E5 | 主色 hover |
| --brand-400 | #818CF8 | 主色 disabled |
| --accent-500 | #8B5CF6 | 渐变终点 |
| --brand-gradient | linear-gradient(135deg, #6366F1, #8B5CF6) | 当前胶囊 / CTA / 演示角标 |

#### 6.1.2 中性色（zinc scale）

| Token | Hex | 用途 |
|---|---|---|
| --neutral-0 | #FFFFFF | 卡片底色 |
| --neutral-50 | #FAFAFA | 页面/画布底色 |
| --neutral-100 | #F4F4F5 | 浅区分背景 |
| --neutral-200 | #E4E4E7 | 描边 |
| --neutral-400 | #A1A1AA | 次要文字 |
| --neutral-500 | #71717A | 二级文字 |
| --neutral-700 | #3F3F46 | 主文字 |
| --neutral-900 | #18181B | 标题 |

#### 6.1.3 功能色

| Token | Hex | 用途 |
|---|---|---|
| --success-500 | #10B981 | ✓ 接受 |
| --success-50 | #ECFDF5 | accepted 框填充 |
| --warning-500 | #F97316 | ⚠ 待审核 / 重点项 |
| --warning-50 | #FFF7ED | warning 卡片背景 |
| --info-500 | #3B82F6 | ✎ 已纠正 |
| --info-50 | #EFF6FF | corrected 框填充 |
| --danger-500 | #EF4444 | 错误提示 |
| --rejected-stroke | #71717A | ✗ 否决虚线 |

#### 6.1.4 颜色使用规则

- 主色（紫）只用于「正在/即将发生的事」——避免泛滥
- 功能色（绿/橙/蓝）只用于审核状态——禁止用绿色当通用「成功」
- 暗色模式不做（P3），但 token 系统对暗色友好

### 6.2 字体

```css
:root {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', Consolas, 'PingFang SC Mono', monospace;
}
```

- Inter / JetBrains Mono 用 woff2 本地打包（CLAUDE.md 第 4 条）
- 每字体只引 400/500/600 + Latin 子集 ≈ 总 80KB
- 中文回退系统 UI 字体（不打包中文，避免 1MB+ 破坏 30MB 红线）

#### 6.2.1 字阶

| Token | size | line-height | weight | 用途 |
|---|---|---|---|---|
| --text-display | 28px | 36px | 600 | 步骤主标题 |
| --text-h2 | 20px | 28px | 600 | 卡片标题 |
| --text-h3 | 16px | 24px | 600 | 小节标题 |
| --text-body | 14px | 20px | 400 | 正文 |
| --text-body-bold | 14px | 20px | 500 | 强调正文 |
| --text-label | 12px | 16px | 500 | 字段 label |
| --text-caption | 11px | 14px | 400 | 次要说明 |
| --text-mono-sm | 12px | 18px | 400 | JSON 预览 / 数字（带 tabular-nums） |

#### 6.2.2 数字呈现

所有数字（confidence / track_id / 坐标 / 统计）开 `font-variant-numeric: tabular-nums`。

### 6.3 间距（4px 基线）

```
--space-1: 4px       --space-5: 24px
--space-2: 8px       --space-6: 32px
--space-3: 12px      --space-8: 48px
--space-4: 16px      --space-10: 64px
```

### 6.4 圆角

```
--radius-sm: 4px       小标签 / 输入框 / Konva 框 cornerRadius
--radius-md: 8px       卡片 / 按钮 / 画布外框
--radius-lg: 12px      大型容器
--radius-xl: 16px      模态框
--radius-full: 9999px  胶囊
```

### 6.5 阴影

```css
--shadow-xs:    0 1px 2px rgba(0,0,0,.04);
--shadow-sm:    0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
--shadow-md:    0 4px 6px rgba(0,0,0,.04), 0 2px 4px rgba(0,0,0,.04);
--shadow-lg:    0 10px 15px rgba(0,0,0,.08), 0 4px 6px rgba(0,0,0,.04);
--shadow-xl:    0 20px 25px rgba(0,0,0,.10), 0 8px 10px rgba(0,0,0,.04);
--shadow-brand: 0 4px 14px rgba(99,102,241,.30);
```

### 6.6 动效

```css
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

--duration-fast: 120ms;
--duration-base: 200ms;
--duration-slow: 320ms;
```

### 6.7 关键组件视觉规范

#### 6.7.1 主推 CTA

```
height: 40px
padding: 0 20px
border-radius: 8px
background: --brand-gradient
color: white
font: 14px/20px 500
box-shadow: --shadow-brand

hover:    阴影加深 + transform: translateY(-1px)
active:   transform: translateY(0)
disabled: 渐变变灰 + 阴影移除 + cursor: not-allowed
```

#### 6.7.2 次要按钮（控制条）

```
height: 32px / width: 32px (icon-only)
border-radius: 8px
background: white
border: 1px solid --neutral-200
color: --neutral-700

hover:  border 变 --brand-500
active: background --brand-50（或 --neutral-100）
```

#### 6.7.3 标注框

详见 §5.4.4。

#### 6.7.4 演示模式角标

```
position: 右属性面板顶部
padding: 8px 12px
background: --brand-gradient
color: white
border-radius: 8px
font: 13px/16px 600
```

### 6.8 Token 双层实现

```ts
// src/styles/tokens.ts
export const tokens = {
  color: {
    brand: { 500: '#6366F1', 600: '#4F46E5', 400: '#818CF8' },
    accent: { 500: '#8B5CF6' },
    neutral: { 0: '#FFFFFF', 50: '#FAFAFA', /* ... */ },
    success: { 500: '#10B981', 50: '#ECFDF5' },
    warning: { 500: '#F97316', 50: '#FFF7ED' },
    info: { 500: '#3B82F6', 50: '#EFF6FF' },
    danger: { 500: '#EF4444' },
    rejectedStroke: '#71717A',
  },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
  // ...
} as const;
```

```css
/* src/styles/globals.css */
:root {
  --brand-500: #6366F1;
  /* ... 与 tokens.ts 一一对应 ... */
}
```

测试守护：`tests/tokens.test.ts` 跑「TS tokens 与 CSS 变量值一致性校验」——避免漂移。

### 6.9 响应式与设备

- **基线**：1280×720 起步，目标 MacBook Pro 13" / Windows 笔记本 1080p
- **大屏投影**：F11 全屏，不做独立大屏视图
- **不做**：iPad / 触屏 / 手机
- **< 1280 宽**：显示遮罩「请使用宽屏（≥ 1280×720）演示」+「全屏」引导按钮
- **浏览器**：Chrome / Edge 最近两个稳定版（开发期目标 Chrome 124+ / Edge 124+）
- **CSS 安全档**：可放心用 `:has()` / container queries / `color-mix()`

### 6.10 不做的视觉特性

- 暗色模式（P3）
- 主题切换 / 自定义品牌色
- 微交互动效（按压粒子等）
- 整套图标库（只用 lucide-react 按需 tree-shake）

### 6.11 图标库

`lucide-react`：只导入用到的几个 icon（Play / Pause / SkipForward / RotateCcw / Check / X 等），最终 < 2KB tree-shaken。

不用 emoji（▶ ⏸ 等）——Windows 渲染彩色 emoji 会破坏 B 风格视觉一致性。

---

## 7. 测试、性能、交付

### 7.1 测试策略

#### 7.1.1 测试金字塔

```
       E2E (Playwright)
      ┌──────────────┐
      │  ~5 个核心流程 │
      └──────────────┘
     组件交互测试 (RTL)
   ┌──────────────────┐
   │   ~15 个组件      │
   └──────────────────┘
        单元测试 (Vitest)
   ┌──────────────────────┐
   │  ~30 个纯函数 + store │
   └──────────────────────┘
```

#### 7.1.2 必测清单（按 hard constraint 反推）

| CLAUDE.md 硬约束 | 对应测试 |
|---|---|
| #1 schema 对齐生产 | tests/format.test.ts：导出 JSON 与 PRD 第五章字段一一对应 |
| #2 审核改动回写 store | tests/e2e/full-flow.spec.ts：审核改框 → Step 5 JSON 预览 → 下载 zip 内容验证 |
| #3 重置深拷贝 | tests/store.test.ts：reset 后源数据未污染 + 多次重置不残留 |
| #4 零外部网络请求 | scripts/verify-offline.mjs：构建后 Playwright 录一遍，所有 host = localhost |
| #5 审核是唯一真交互 | tests/store.test.ts：Step 1/2/3/5 调用 acceptBox 应抛错或被忽略 |

#### 7.1.3 关键 E2E 用例

```ts
// tests/e2e/full-flow.spec.ts

test('full demo flow: upload → review → export reflects changes', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="sample-card-city-road"]');
  await page.click('[aria-label="即时"]');
  await page.click('[data-testid="next-step"]');
  await page.click('[data-testid="next-step"]');

  await page.waitForSelector('[data-testid="step4-review"]');
  await page.keyboard.press('a');                   // 接受 trk_2
  await page.keyboard.press('d');                   // 否决 trk_9
  await page.evaluate(() => 
    (window as any).__demoStore.correctBoxGeometry('trk_5', 0, [100, 200, 300, 400])
  );
  await page.click('[data-testid="accept-all-remaining"]');

  await page.waitForSelector('[data-testid="step5-export"]');
  const previewText = await page.textContent('[data-testid="json-preview"]');
  expect(previewText).toContain('"track_id": "trk_2"');
  expect(previewText).toContain('"status": "accepted"');
  expect(previewText).toContain('"track_id": "trk_5"');
  expect(previewText).toContain('"source": "human"');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('[data-testid="download-btn"]'),
  ]);
  const zipPath = await download.path();
  const zipContents = await unzipAndRead(zipPath!);
  expect(zipContents['manifest.json']).toBeDefined();

  const annotations = JSON.parse(zipContents['annotations/native.json']);
  const trk2 = annotations.annotations.find((a: any) => a.track_id === 'trk_2');
  expect(trk2.review.status).toBe('accepted');
});

test('reset returns to step 1, preserves dataset and speed', /* ... */);
test('virtual presenter cancels on click', /* ... */);
test('next button disabled when review queue not done', /* ... */);
test('offline: no external network requests', /* ... */);
```

#### 7.1.4 性能测试

```ts
// tests/performance.test.ts
test('reset takes < 200ms', async ({ page }) => {
  await page.evaluate(() => performance.mark('reset-start'));
  await page.click('[data-testid="reset-btn"]');
  await page.click('[data-testid="confirm-reset"]');
  await page.waitForSelector('[data-testid="step1-upload"]');
  const duration = await page.evaluate(() => {
    performance.mark('reset-end');
    performance.measure('reset', 'reset-start', 'reset-end');
    return performance.getEntriesByName('reset')[0]!.duration;
  });
  expect(duration).toBeLessThan(200);
});
```

### 7.2 性能预算

#### 7.2.1 PRD 第十章红线对应实现

| 红线 | 实现策略 |
|---|---|
| 首屏 ≤ 2s | Vite + code split：5 个 step 视图按 demoStep 动态 import；JSON 数据 inline；首屏 bundle < 200KB gzipped |
| 步骤切换 ≤ 100ms | 已加载的 step 视图保留在内存（不卸载） |
| 审核拖框 ≥ 50fps | Konva Layer 三层分离，onTransform 内只 setState 一次 |
| 揭示动画 ≥ 50fps | GPU 加速的 opacity + transform，不在主线程跑 layout |
| 打包 ≤ 1.5s | JSZip + 4-6 张 jpg，预估 500-800ms |
| 重置 ≤ 200ms | structuredClone ~3-8ms + 重渲染 ~30-60ms |
| 打包体积 ≤ 30MB | 见 §7.2.2 |

#### 7.2.2 包体积预算

```
最终 dist/ 总计 ≤ 30 MB:
  ├── JS bundles (gzipped):           ~280 KB
  │     React + ReactDOM:                 45
  │     Zustand + immer:                  15
  │     Konva:                           120
  │     JSZip + FileSaver:               100
  │     lucide-react:                      2
  │     业务代码:                         ~80 KB(uncompressed)
  ├── 字体 (Inter + JetBrains Mono):    ~80 KB (Latin only)
  ├── CSS:                              ~15 KB gzipped
  ├── HTML + manifest:                   ~3 KB
  ├── Mock 数据 JSON:                  ~100 KB (3 datasets)
  └── 视频 + 缩略图:                   ~24 MB (3 datasets, ~8MB each)
                                        ━━━━━━
                                        ~24.5 MB ✓ 5MB 余量
```

视频超额时压缩码率（`-crf 28`），实测 30s/1080p 可压到 4-6MB。

#### 7.2.3 CI 性能 gate

```yaml
- name: Build & check size
  run: |
    npm run build
    if [[ $(du -sb dist/ | cut -f1) -gt 31457280 ]]; then
      echo "❌ dist size exceeds 30MB"; exit 1
    fi

- name: Run E2E + performance tests
  run: npm run test:e2e

- name: Verify offline
  run: node scripts/verify-offline.mjs
```

### 7.3 错误处理

#### 7.3.1 PRD 7.4 错误状态映射

| 触发 | 实现 |
|---|---|
| 拖入非视频文件 | DropZone mime check → toast |
| 重点项未审完点下一步 | DemoControls 根据 store.canAdvanceFromStep4() 置灰 + tooltip |
| 浏览器太旧 | main.tsx 入口检测 requestVideoFrameCallback → 不存在显遮罩「建议用最新 Chrome」 |
| 重复点重置 | 见 §2.2.1 dirty 二次确认 |
| 视频加载失败 | `<video>` onError → toast「样例加载异常，点此重载」+ 重载按钮 |

#### 7.3.2 全局错误边界

```tsx
<ErrorBoundary fallback={<DemoCrashScreen />}>
  <App />
</ErrorBoundary>
```

`DemoCrashScreen`：

```
"演示遇到了意外问题
 [↻ 刷新页面] [↺ 重置 Demo]"
```

刻意没有「展开错误详情」——客户在场，不要让错误堆栈出现在屏幕上。错误信息走 console。

#### 7.3.3 防御性编程

- JSON 解析：`src/data/*.json` 用 zod 在启动时校验
- 视频元素：`onError` / `onstalled` 都注册 fallback
- Konva Stage 尺寸为 0 时不渲染

### 7.4 离线打包与现场分发

#### 7.4.1 构建流程

```bash
npm run build          # vite build → dist/
npm run pack:release   # 打包 dist/ + start.sh + start.bat + README → video-label-demo-vX.Y.Z.zip
```

#### 7.4.2 start.sh

```bash
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
PORT=8080
while lsof -i :$PORT >/dev/null 2>&1; do PORT=$((PORT+1)); done
echo "Starting demo at http://localhost:$PORT"
(sleep 1 && open "http://localhost:$PORT") &
python3 -m http.server $PORT --directory ./dist
```

#### 7.4.3 start.bat

```bat
@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -Command ^
  "$port = 8080; while ((Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue).TcpTestSucceeded) { $port++ }; ^
   Start-Process 'http://localhost:'$port; ^
   python -m http.server $port --directory './dist'"
```

#### 7.4.4 README（分发包内）

```markdown
# 视频语料标注平台 Demo · 现场分发包

## 启动方式
- macOS / Linux: 双击 start.sh（如失败：终端运行 bash start.sh）
- Windows:        双击 start.bat

浏览器自动打开 http://localhost:8080，5 秒内进入 Demo 首页。

## 系统要求
- Python 3（macOS/Windows 自带，否则 brew install python / Microsoft Store）
- Chrome 或 Edge 最近两个版本
- 屏幕宽度 ≥ 1280

## 常见问题
- 端口被占用：脚本会自动找下一个空闲端口
- 关闭：终端 Ctrl+C
```

### 7.5 实施节奏（8 工作日）

```
Day 1: 骨架
  - vite + React + TypeScript 脚手架
  - tokens.ts + globals.css
  - Zustand store 编排状态机（demoStep / playMode / speed / reset 深拷贝）
  - 数据 schema TS 类型 + city-road.json（_generators 生成 + 手工校对）
  - chrome 层（顶栏 + 步骤胶囊 + 控制条），尚未连接业务步骤

Day 2-3: Step 4 审核工作台（最重）
  - ReviewCanvas + Konva Stage + 视频帧同步
  - BoxLayer 颜色编码 + 选中态
  - Transformer 拖框 + onTransformEnd 回写 store
  - QueueTrack + PropertyPanel 大按钮
  - undo 撤销栈
  - 单元测试 + E2E 验证「审核改动 → store 改动」

Day 4: Step 5 导出（验证核心链路）
  - JsonPreview 实时反映 store
  - native.ts / cocoVideo.ts 序列化
  - JSZip 打包 + FileSaver 下载
  - E2E 验证「审核改动 → 下载 zip 包含改动」

Day 5: Step 1/2/3 + 副样例
  - DropZone + SampleCards + 友好 toast
  - TypewriterField 元信息揭示
  - InferenceProgress + BoxRevealCanvas
  - meeting-room / retail-cam 副样例

Day 6: 控制条联动 + 自动模式 + 虚拟主讲
  - DemoControls 按钮 → store actions
  - speed 档应用到 reveal 动画
  - VirtualPresenter (Step 4 自动裁决)
  - 中断检测

Day 7: 防呆 + 现场分发
  - 错误边界 + 错误状态
  - 拖入文件友好提示
  - start.sh / start.bat
  - verify-offline.mjs
  - 性能测试 + 包体积检查

Day 8 缓冲: 真视频替换 / 视觉调优 / bug 修复
```

### 7.6 验收清单

```
P0 (没有这个 Demo 演不了):
  ☐ 五步骤线性流程跑通（拖样例 → ... → 下载 zip 不报错）
  ☐ city-road 完整 Mock（47 标注 + 3 重点项）
  ☐ 控制条「下一步 / 重置」可用
  ☐ 重置后源数据未污染（自动化测试守护）
  ☐ 审核改动正确写入 store 并在导出中体现（E2E 守护）
  ☐ 零外部网络请求（verify-offline 守护）

P1 (没有这个客户看完无感):
  ☐ 自动标注框逐个浮现动画 ≥ 50fps
  ☐ 元信息打字机揭示
  ☐ 审核 ✓接受 / ✗否决 / ↔拖框 真交互
  ☐ 下载 zip 真实生成且 manifest/annotations 字段对齐 schema

P2 (有了这个客户觉得"成熟"):
  ☐ 完整 Demo 控制条（自动演示/暂停/速度档 1x/2x/即时）
  ☐ 3 个样例可切换
  ☐ Ctrl+Z 单步撤销
  ☐ 防呆提示
  ☐ 自动模式虚拟主讲（接受/改框/否决三动作）+ 任意点击接管

P3 (锦上添花):
  ☐ COCO-Video 第二格式
  ☐ 键盘快捷键 A/D/N/R/Ctrl+Z/←→
  ☐ start.sh / start.bat 现场分发
  ☐ verify-offline.mjs 自动化检查
  ☐ ?step=N URL 参数（开发调试用）
```

### 7.7 风险登记

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| 视频版权问题 | 中 | 高 | 附录 A 给 CC0 直链；销售独立确认无版权风险后才用 |
| 现场客户笔记本性能差 | 中 | 中 | 提供「即时」速度档跳过所有揭示；重置 < 200ms |
| Konva Transformer 在低端机卡顿 | 低 | 中 | 拖框时只更新一层（非整个 Stage redraw） |
| 客户拖入超大视频卡死浏览器 | 低 | 高 | 拖入文件不读内容、不创建 ObjectURL → 天然规避 |
| start.sh 在客户机器没 Python | 低 | 低 | README 给出 brew / Microsoft Store 安装指引 |
| 演示当场触发未知 bug | 低 | 极高 | 全局错误边界 + 「↻ 刷新页面」按钮，避免错误堆栈出现 |

---

## 附录 A：视频素材候选清单（销售/产品对齐用）

> 实施过程不阻塞——开发期用 §4.5.3 的占位 mp4，真视频替换后零代码改动。

### A.1 city-road（主样例，30s / 1920×1080 / H.264）

| 候选 | 来源 | URL | 授权 |
|---|---|---|---|
| 1 | Pexels Videos | https://www.pexels.com/search/videos/traffic%20road/ | Pexels License（可商用，无需署名） |
| 2 | Coverr | https://coverr.co/s?q=traffic | CC0（公有领域） |
| 3 | Mixkit | https://mixkit.co/free-stock-video/traffic/ | Mixkit License |

挑选标准：

- 时长 ≥ 30s（截取前 30s 作演示）
- 含明显车辆 + 行人 + 交通标志（贴合 47 个标注的分布）
- 1920×1080 30fps H.264（否则 ffmpeg 转码）

### A.2 meeting-room（副样例，45s / 1280×720 / H.264）

| 候选 | 来源 | URL | 授权 |
|---|---|---|---|
| 1 | Pexels Videos | https://www.pexels.com/search/videos/office%20meeting/ | Pexels License |
| 2 | Pixabay Videos | https://pixabay.com/videos/search/meeting/ | Pixabay License |

### A.3 retail-cam（副样例，60s / 1920×1080 / H.264）

| 候选 | 来源 | URL | 授权 |
|---|---|---|---|
| 1 | Coverr | https://coverr.co/s?q=supermarket | CC0 |
| 2 | Pexels Videos | https://www.pexels.com/search/videos/store%20shopping/ | Pexels License |

### A.4 验证步骤

下载后：

```bash
# 1. 查看真实参数
ffprobe -v error -show_entries format=duration -show_entries stream=width,height,r_frame_rate,codec_name <video.mp4>

# 2. 不匹配时转码到目标参数
ffmpeg -i <video.mp4> -t 30 -vf "scale=1920:1080,fps=30" -c:v libx264 -pix_fmt yuv420p -crf 28 \
       public/mock/city-road/road_demo.mp4

# 3. 抽帧（导出 zip 用）
ffmpeg -i public/mock/city-road/road_demo.mp4 \
       -vf "select='eq(n,100)+eq(n,300)'" -vsync vfr \
       public/mock/city-road/frames/%04d.jpg

# 4. 计算 SHA-256（写入 spec 附录）
shasum -a 256 public/mock/city-road/road_demo.mp4
```

下载并放置后由销售/产品在 spec 此处补充实际选用的 URL + SHA-256。

---

## 附录 B：关键依赖版本

| 依赖 | 推荐版本 | 备注 |
|---|---|---|
| react / react-dom | ^18.3.0 | LTS |
| vite | ^5.4.0 | 构建 |
| typescript | ^5.5.0 | strict + noUncheckedIndexedAccess |
| zustand | ^4.5.0 | 状态管理 |
| immer | ^10.1.0 | Zustand middleware |
| konva | ^9.3.0 | 画布 |
| react-konva | ^18.2.0 | React wrapper |
| jszip | ^3.10.0 | 打包 |
| file-saver | ^2.0.5 | 下载 |
| lucide-react | ^0.456.0 | icon 库 |
| zod | ^3.23.0 | JSON schema 校验（启动期） |
| vitest | ^2.0.0 | 单测 |
| @testing-library/react | ^16.0.0 | 组件测试 |
| @playwright/test | ^1.46.0 | E2E |

---

文档结束。后续由 `superpowers:writing-plans` 技能基于本设计产出可执行的实施计划。
