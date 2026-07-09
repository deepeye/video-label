# Step4 右键新增点事件（click 与 mousedown 事件冲突修复）设计

> 版本：v1.0 · 2026-06-24  
> 背景：浏览器验证发现，右键菜单中的“新增点事件”按钮的 `onClick` 回调在某些浏览器/时序下无法触发，因为与父级容器上的 `onMouseDown` / `onClick` 等事件同时被触发，导致菜单已经关闭或回调未执行，用户感受为“点击没有反应”。

---

## 0. 要解决的问题

当前 Step4 时间线右键菜单中：

- 菜单项 `新增点事件` 使用 `onClick` + `event.stopPropagation()`
- 时间线容器同时绑定了 `onMouseDown`（浏览态 scrub、范围态 drag）
- 同时容器也绑定了 `onClick`（点模式新增、关闭菜单）

导致在菜单项上点击时：

1. `onMouseDown` 在容器上先触发（因为事件冒泡）
2. 容器的 `onMouseDown` 中调用了 `closeContextMenu()`
3. 菜单在鼠标移动/松开之前就被移除
4. 所以菜单项的 `onClick` 无法触发

结果是：

- 函数 `createPointEvent` 从未被调用
- 事件列表中没有任何新增卡片
- 用户完全看不到任何反馈

---

## 1. 已确认根因

**mousedown 阶段 menu 被关掉**，导致后面 menuitem 的 click 事件没有机会触发。

表现：

- 右键弹出菜单正常
- 点击菜单项看起来“点中了”
- 但 store 无变化
- 右侧列表也不会有任何新增卡片

---

## 2. 方案选择

采用 **方案 A：将菜单项的回调从 onClick 迁移到 onMouseDown，并在菜单项上阻止冒泡，确保先执行创建，再关闭菜单**。

### 流程修正

```
用户点击菜单项：
  onMouseDown (menuitem)
    ├─ 阻止冒泡 (stopPropagation)
    ├─ 执行 createPointEvent(...)
    ├─ 关闭菜单 closeContextMenu()
    └─ return
```

### 优点
- 直接在 mousedown 阶段完成所有逻辑，不再依赖 click 事件
- 不需要改动容器上的 mousedown/click 行为
- 修复范围极小，只改菜单项两行

### 其它方案
#### 方案 B：在容器 mousedown 中排除菜单项
- 容器 mousedown 检查 `event.target` 是否是菜单项
- 如果是则 skip 掉 `closeContextMenu()` 和 scrubbing
- 缺点：逻辑分散，后续维护成本更高

#### 方案 C：将菜单渲染到 body 外套 Portal
- 使用 React Portal 将菜单渲染到 body 之下
- 鼠标事件不会冒泡到时间线容器
- 缺点：改动偏大，对 demo 来说不必引入 Portal 概念

---

## 3. 实现边界

本次修复只触达：

- `src/steps/Step4Review/Step4Timeline.tsx`
- `tests/Step4Timeline.test.tsx`

不改 store 结构。

---

## 4. 测试要求

补充一条 focused 测试：

```tsx
it('can create two point events from two separate right-click menu invocations', () => {
  render(<Step4Review />);
  const surface = screen.getByTestId('step4-timeline-surface');
  mockTimelineRect(surface);

  // 第一次
  fireEvent.contextMenu(surface, { clientX: 120, clientY: 18 });
  fireEvent.click(screen.getByRole('menuitem', { name: '新增点事件' }));

  // 第二次
  fireEvent.contextMenu(surface, { clientX: 120, clientY: 18 });
  fireEvent.click(screen.getByRole('menuitem', { name: '新增点事件' }));

  const state = useDemoStore.getState();
  expect(state.events).toHaveLength(2);
  expect(state.events[0]).toMatchObject({ mode: 'point', timeMs: 12_000 });
  expect(state.events[1]).toMatchObject({ mode: 'point', timeMs: 12_000 });
  expect(state.selectedEventId).toBe(state.events[1]?.id);
});
```

---

## 5. 最终结论

这次修复的本质是：

> 菜单项的 `onClick` 被容器的 `onMouseDown` 提前拦截并关闭菜单，导致 click 从未触发。

修复方案是将菜单项的动作提前到 `onMouseDown` 阶段执行，同时在菜单项上阻止事件冒泡，确保浏览器中点击菜单项能真正走完创建流程，且同一时间点能够连续添加多个点事件。