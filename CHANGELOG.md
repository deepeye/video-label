# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0.0] - 2026-07-09

### Added

- Step 4 审核工作台重写为视频时间点标注工作站：支持时间点事件、区间事件、时间轴拖拽创建、右键菜单、播放头同步。
- 事件编辑器：预设事件类型、严重程度、标签、描述、可选画面区域框。
- Step 5 导出切换为事件维度统计：总计 / 点事件 / 范围事件 / 带框事件。
- PDMI 品牌标识与标题替换。
- 演示样例素材（视频 + JSON）放入 `assets/` 供客户现场展示。

### Changed

- 核心数据模型从标注框审核（`Annotation` + `ReviewRecord`）迁移为事件标记（`EventMarker`）。
- `native.json` / `coco_video.json` 导出序列化以事件列表为中心。
- Store API 更新为 `createPointEvent` / `createRangeEvent` / `updateEvent` / `deleteEvent`。

### Fixed

- 修复 Step4 重构后的 TypeScript 构建错误与废弃 review 文件残留。
- 更新 E2E 测试以适配新的 timestamping Store API（`offline`、`perf`）。

### Infrastructure

- 忽略工具产物、发布打包输出与大体积本地资源。
- 在 `CLAUDE.md` 中增加 gstack skill routing 规则。
- 新增 Step4 timestamping 设计与实现计划文档。
