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
