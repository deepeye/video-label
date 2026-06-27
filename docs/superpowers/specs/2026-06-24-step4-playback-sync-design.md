# Step4 播放时间回写到时间线设计

> 版本：v1.0 · 2026-06-24  
> 背景：Step4 时间线已经有播放头和已播放进度条，但浏览器实测发现，点击“播放”后 `currentTimeMs` 不会随着视频自然播放持续更新，导致进度条和播放头都停在原地。

---

## 0. 要解决的问题

当前 Step4 已具备两条能力：

- 时间线可以通过 `seekToMs + pause` 控制视频跳转并停住
- 时间线可以渲染连续的已播放进度条

但还缺少第三条能力：

- **视频在自然播放时持续把 `video.currentTime` 回写到 store 的 `currentTimeMs`**

结果是：

- `playbackState` 虽然变成了 `playing`
- 视频元素本身在播
- 但时间线播放头和进度条不会前进

这说明系统现在只有：

- `timeline/store -> video` 的单向链路

还没有：

- `video -> store` 的反向链路

---

## 1. 已确认目标

用户已确认修复后的行为应为：

- **正常播放时，进度条和播放头持续跟随视频前进**

同时保留现有行为：

- 手动点击时间线 / marker 时，视频跳到对应时间并暂停停住

---

## 2. 方案选择

采用 **方案 A：播放中的视频时间持续回写到 store，手动 seek 仍然优先**。

### 规则

- 当 `playbackState === 'playing'`：
  - 视频自然播放
  - `currentTimeMs` 持续更新
  - 播放头持续前进
  - 已播放进度条持续增长
- 当 `playbackState === 'paused'`：
  - 时间停住
  - 播放头和进度条停住
- 当用户点击时间线 / marker：
  - 立即 seek 到目标时间
  - 立即 pause
  - 停在该位置等待再次播放

核心原则：

> 手动 seek 优先级高于自动播放回写。

---

## 3. 实现设计

### 3.1 不改时间线结构

本次不需要再改 `Step4Timeline.tsx` 的 UI 结构。

它已经具备：

- 播放头
- 已播放进度条
- 事件 marker
- 手动 seek 行为

本次修复只补**播放中的回写机制**。

### 3.2 只补 `Step4VideoStage` 的播放回写链路

建议在 `Step4VideoStage` 中恢复/补上一条持续同步：

- 当 `playbackState === 'playing'`
- 监听视频当前时间变化
- 调用 `setCurrentTimeMs(Math.round(video.currentTime * 1000))`

### 3.3 优先使用视频帧回调机制

如果项目中已有接近逐帧同步的能力（例如现成的 `watchVideoFrames` / `videoFrameCallback` 封装），应优先复用。

原因：

- 比 `setInterval` 更顺滑
- 更新频率更接近真实播放帧
- 更适合进度条和播放头的连续变化

本次不建议引入新的轮询定时器。

### 3.4 暂停时停止回写

当 `playbackState === 'paused'` 时：

- 停止这条持续回写
- 防止手动 seek 后又被旧的播放监听推进

### 3.5 与现有 seek 流程的关系

现有流程保留不变：

- 时间线点击 / marker 点击 -> `seekToMs + pause`
- VideoStage 收到 `pendingSeekMs` 后跳转并停住

新增流程只是补上：

- 点击播放 -> `playbackState = 'playing'`
- VideoStage 播放视频，并持续回写 `currentTimeMs`

也就是说：

- **手动定位：store 驱动 video**
- **自然播放：video 回写 store**

形成一个完整的双向同步。

---

## 4. 文件影响范围

本次修复应尽量只触达：

- `src/steps/Step4Review/Step4VideoStage.tsx`
- 如需要，相关测试文件：
  - `tests/Step4Review.test.tsx`
  - 可选：`tests/Step4Timeline.test.tsx`

不应扩大到：

- `src/store/demoStore.ts`（除非发现必须加很小的辅助字段）
- `src/steps/Step4Review/Step4Timeline.tsx`
- `src/steps/Step5Export/*`
- E2E

这是一个**同步链路补全**，不是结构重构。

---

## 5. 测试要求

### 5.1 VideoStage 播放回写测试

补充以下断言：

- 当 `playbackState === 'playing'`
- 视频时间推进后
- `currentTimeMs` 会同步更新

### 5.2 暂停停止回写测试

补充以下断言：

- 当切换到 `paused`
- 后续播放时间推进不再继续写回 store

### 5.3 seek 后恢复播放测试

补充以下断言：

- 先手动 seek 并 pause
- 再点击播放
- 播放头和进度条重新前进

本次不强制新增 E2E，因为这是现有 Step4 聚焦测试可以覆盖的内部同步逻辑。

---

## 6. 非目标

本次修复明确不做：

- 播放器状态机重构
- 新增轮询器
- 视频缓冲/加载态 UI
- 区域框跟踪增强
- 时间线视觉重设计
- Step5 导出或别的步骤改动

这是一个**播放时间同步修复**，不是播放器功能扩展。

---

## 7. 最终结论

这次问题的本质是：

> Step4 只有“时间线控制视频”的单向链路，没有“播放中的视频回写时间线”的反向链路。

修复方案应补齐这条反向链路：

- 播放中：`video.currentTime -> currentTimeMs`
- 手动 seek：`timeline/store -> video.currentTime`
- 暂停时：停止回写

这样 Step4 的时间线才能真正成为一个完整的播放器时间线：

- 会跳
- 会停
- 也会跟着播。