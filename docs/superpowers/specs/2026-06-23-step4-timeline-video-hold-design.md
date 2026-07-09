# Step4 时间线控制视频停留设计

> 版本：v1.0 · 2026-06-23  
> 背景：视频打点工作台已上线，但 Step4 时间线交互只能改播放头/事件状态，无法真正控制视频画面停在对应时间。

---

## 0. 要解决的问题

当前 Step4 的时间线点击与事件点击会更新 store 中的 `currentTimeMs`，但 `Step4VideoStage` 没有把这次手动定位同步到 `<video>.currentTime`。

结果是：

- 时间线播放头发生变化
- 事件选择发生变化
- 但视频画面仍按自身播放节奏继续前进
- 用户无法在标注点停住视频做观察

这破坏了“时间线标注控制视频停留”的核心预期。

---

## 1. 已确认目标

用户已明确确认，修复后的行为应为：

- **点击/拖动时间线时，视频立即跳到对应时间并暂停停住**

不是“跳到后继续播”，也不是“只有点 marker 才停”。

---

## 2. 方案选择

采用 **方案 A：时间线作为单一真相源，视频被动跟随并暂停**。

### 规则

- 点击时间线空白 → 视频跳到该时刻并暂停
- 拖动创建范围事件 → 视频跟随拖拽终点，松手后停在结束位置
- 点击已有事件 marker → 视频跳到该事件锚点时间并暂停
- 点击播放按钮 → 从当前停住位置恢复播放
- 视频自然播放时 → 继续回写 `currentTimeMs`，时间线播放头跟随

核心原则：

> 手动时间线交互优先级高于自动播放。

---

## 3. 实现设计

### 3.1 不引入复杂播放器状态机

本次修复不做完整播放器状态机，只增加一套最小且稳定的同步协议。

### 3.2 Store 侧新增最小控制信号

在现有 `currentTimeMs` 之外，新增：

- `playbackState: 'playing' | 'paused'`
- `seekToMs(ms: number)` action
- `play()` / `pause()` actions

### 3.3 时间线交互改为“发意图”

现在时间线代码里直接调用 `setCurrentTimeMs(ms)` 的地方，统一改成：

- `seekToMs(ms)`
- 并把 `playbackState` 置为 `paused`

这包括：

- 点击时间线空白
- 拖动 range 结束
- 点击已有事件 marker

### 3.4 VideoStage 消费控制信号

`Step4VideoStage` 负责真正控制 `<video>`：

- 当收到新的 `seekToMs` 请求时：
  - 设置 `video.currentTime = ms / 1000`
  - 调用 `video.pause()`
- 当 `playbackState === 'playing'` 时：
  - 调用 `video.play()`
- 当 `playbackState === 'paused'` 时：
  - 调用 `video.pause()`

### 3.5 视频自然播放回写保持不变

现有视频帧同步逻辑保留：

- 视频自然播放时继续回写 `currentTimeMs`
- 时间线播放头仍能跟随视频移动

但需要避免“刚 seek 完就被旧回写覆盖”的竞态；最小做法是：

- `seekToMs` 更新时立刻同步 `currentTimeMs`
- VideoStage 收到 seek 后再写 `video.currentTime`
- 因为同时调用了 `pause()`，后续帧回写不会继续推进

---

## 4. 文件影响范围

本次修复应尽量只触达以下文件：

- `src/store/demoStore.ts`
- `src/store/snapshots.ts`
- `src/steps/Step4Review/Step4Timeline.tsx`
- `src/steps/Step4Review/Step4VideoStage.tsx`
- 对应测试文件：
  - `tests/store.test.ts`
  - `tests/Step4Timeline.test.tsx`
  - `tests/Step4Review.test.tsx`

不应扩大到 Step5、导出逻辑或其他步骤。

---

## 5. 测试要求

### 5.1 Store 测试

补充以下断言：

- `seekToMs(ms)` 会更新 `currentTimeMs`
- `seekToMs(ms)` 会把 `playbackState` 置为 `paused`
- `play()` / `pause()` 正确切换 `playbackState`

### 5.2 时间线测试

补充以下断言：

- 点击时间线空白后，store 中 `currentTimeMs` 更新，且 `playbackState === 'paused'`
- 点击已有事件 marker 后，同样进入暂停态
- range 创建完成后，结束位置成为当前时间，且进入暂停态

### 5.3 VideoStage / 集成测试

补充以下断言：

- 收到 seek 后，`video.currentTime` 被设置到目标值
- `video.pause()` 被调用
- 点击播放按钮后，`video.play()` 被调用

---

## 6. 非目标

本次修复明确不做：

- 播放器快捷键扩展
- 拖拽 scrub 时的连续逐帧预览
- 复杂播放器状态机
- 帧级吸附/时间码格式化优化
- 区域框与视频帧插值

这是一个**行为正确性修复**，不是播放器重构。

---

## 7. 最终结论

本次问题的本质不是 UI 缺一个按钮，而是：

> 时间线和视频没有建立真正的控制关系。

修复方案应把时间线交互统一收敛为“seek + pause”意图，由 store 记录，由 `Step4VideoStage` 执行。这样可以最小代价恢复用户预期：

- 点哪里，视频就到哪里
- 到了就停住
- 再点播放才继续走

这也是后续继续增强 Step4 打点体验时最稳的基础。