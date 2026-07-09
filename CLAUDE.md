# CLAUDE.md

> 面向后续 Claude 会话的项目上下文与约束。详细需求见 `docs/视频语料标注平台 · 演示 Demo PRD.md`（v2.0-demo）。

## 项目定位

**纯前端视频标注流程演示系统**（Demo，非生产）。用于销售/产品在客户现场，5 分钟内走通「上传 → 元信息 → 自动标注 → 人工审核 → 导出」五步叙事。

**核心判断**：Demo 成功标准是「叙事可信 + 现场零故障 + 可反复重置」，**不是**技术真实。一切围绕「看起来在处理、实际读 Mock」设计。

## 技术栈（已锁定，禁止替换）

- **框架**：React 18 + Vite（SPA，构建为纯静态产物）
- **画布**：Konva.js（审核步骤的框拖拽 + 控制点）
- **状态**：Zustand（Demo 编排状态机 + 标注内存状态）
- **导出**：JSZip + FileSaver.js（浏览器内打包真实可下载 zip）
- **零后端、零外部网络依赖**：所有资源（视频、字体、库、Mock 数据）本地打包

## 不可逾越的约束（Hard Constraints）

1. **数据 schema 对齐生产**（PRD 第五章）。`review` 在 Demo 简化为单对象，其余字段（`track_id`、`source`、`confidence`、`keyframes[].timestamp_ms` 等）不得随意简化。导出文件必须经得起技术评估方审视。

2. **审核改动必须回写到 Zustand store**。Konva 图层只是渲染，改框/接受/否决/改标签必须同步更新内存中的标注数据。否则步骤⑤导出拿不到客户的改动 → Demo 灵魂崩塌。

3. **重置必须深拷贝初始 Mock 快照**。`reset()` 整体替换 store 为初始快照的深拷贝。改引用而非深拷贝会导致上一场残留 → 现场穿帮。

4. **零真实后端 / 零外部网络请求**。不引入任何后端调用、不依赖 CDN（含字体）。

5. **审核步骤是唯一真交互**。其余四步均为「定时器驱动的揭示动画 + 读 Mock JSON」。不要在非审核步骤引入真实计算逻辑。

## 关键设计要点

- **Demo 控制条**：贯穿全局，提供 `▶自动演示 / ⏸暂停 / ⏭下一步 / ↺重置 + 速度档(1x/2x/即时)`。状态机 `idle→step1→...→step5→done`。
- **自动模式到步骤④（审核）必须暂停**，交给客户手动操作（最需要互动的环节不抢操作）。
- **防呆**：未处理完低置信重点项时，「下一步」置灰；只在审核框上开放精简右键菜单，其余上下文不开放。
- **拖入任意视频**：用 `URL.createObjectURL` 真实播放该文件画面，但**标注框仍套用预置 Mock**（默认引导用预置样例规避「真画面 + 假框」不一致）。

## 实现顺序建议（PRD 第十一章）

1. **先建 Mock 数据集 + Demo 编排状态机**（骨架）
2. **再做步骤④审核工作台**（最重 + Demo 高点：Konva 画布 + 接受/否决/改框 + 内存状态更新）
3. **再做步骤⑤导出**（验证「客户改动 → 导出留痕」核心链路真的通）
4. **最后补步骤①②③揭示动画**（观感层，定时器读 Mock 渲染即可）
5. 控制条与重置贯穿始终，尽早接上

## 优先级（来自 PRD 第九章）

- **P0**：五步骤线性流程跑通 + 1 个城市道路样例完整 Mock + 控制条「下一步/重置」
- **P1**：标注揭示动画 + 元信息打字机揭示 + 审核真交互 + 导出真生成 zip
- **P2**：完整 Demo 控制条（自动演示/暂停/速度档）+ 3 个样例 + Ctrl+Z 单步撤销 + 防呆
- **P3**：多导出格式 + 快捷键 + 离线纯静态打包 + 暗色主题

## 性能红线（PRD 第十章，触及按 P0 缺陷处理）

- 首屏加载 ≤ 2s（劣化阈值 5s）
- 揭示动画帧率 ≥ 50fps（< 30fps 显廉价）
- 审核改框拖拽 ≥ 50fps
- 重置耗时 ≤ 200ms
- 应用打包体积 ≤ 30MB（含样例视频）

## 明确排除

无登录/账户/权限、无真实上传/分片、无真实 ffprobe / GPU 推理、无多级盲审、无训练管线回流、无持久化（Demo 状态只活在内存）、无真批量导出（仅展示入口示意文案）。

## 可灵活调整

- 揭示动画时长（默认见 `demo_script.metadata_reveal_ms / inference_reveal_ms`）
- 布局像素尺寸（步骤条 + 控制条结构必须保留）
- 快捷键裁剪（A/D 接受否决建议保留）

## 已知未决项（实施前需对齐）

- 客户拖入自有视频时「真画面 + 假框」一致性策略 → 默认引导用预置样例
- 样例视频版权 → 需销售/产品提供可商用展示素材
- 离线纯静态打包是否必须 → 取决于现场网络
- 样例行业（默认城市道路）是否需按客户行业另制 → 上线前对齐

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
