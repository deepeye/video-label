# 视频语料标注平台 · 演示 Demo（PDMI 品牌版）

纯前端视频标注流程演示系统。让销售/产品在客户现场，5 分钟内走通「上传 → 元信息 → 自动标注 → 人工审核 → 导出」五步叙事。

## 现场演示

下载分发包后双击启动:

- macOS / Linux: `start.sh`
- Windows:        `start.bat`

详见包内 `README.md`。

## 开发

```bash
npm install
npm run dev          # 启动 dev server (localhost:5173)
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

内部演示用途。视频素材授权见 `public/mock/<dataset>/` 目录下的来源说明。字体授权见 `public/fonts/LICENSE.txt`（SIL OFL）。
