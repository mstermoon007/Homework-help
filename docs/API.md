# PluginUtil / App 工具 API 速查

> 来源：`shared/common.js`。插件内通过 `PluginUtil.*` 调用；
> dev/ Node 脚本 `require('../shared/common.js')` 复用同一实现。

## 随机数（批次1规范：运行时禁止直接 Math.random()）

| 函数 | 签名 | 说明 |
| --- | --- | --- |
| `randInt` | `(min, max) → int` | 闭区间整数随机；crypto.getRandomValues 优先，Math.random 兜底（唯一豁免位置） |
| `shuffle` | `(arr) → arr'` | Fisher-Yates 洗牌，返回**新数组**不改原数组；禁止 sort 随机比较器 |
| `rand` | `(arr) → item` | 从数组等概率取一个元素 |

概率判断约定：`randInt(0, 1) === 0`（50%）、`randInt(1, 100) <= p`（p%）。

## 难度系统

| 函数/对象 | 签名 | 说明 |
| --- | --- | --- |
| `diffLevel` | `(d) → 1..10` | 归一化难度，非法回退 3 |
| `diffScale` | `(level) → number` | 缩放系数 `1+(level−3)×0.2`（3→1.0、10→2.4） |
| `diffMax` | `(base, level) → int` | 基准最大数 × scale |
| `App.Adaptive.record` | `(subject, grade, pluginId, correct, total, context?)` | v2：context 支持 `knowledgePointId`（仅 competition/comprehensive 插件生效）与平行数组 `questionDifficulties`+`correctFlags`（齐备才启用难度加权） |
| `App.Adaptive.computeAdjustment` | `(subject, grade, pluginId, kpId?) → {difficultyDelta, typeBias, rate, emaRate, lastRate, sessions}` | 基于 EMA 平滑率（`0.4×本次+0.6×上次`）+ lastRate：≥0.85且全对→+2；≥0.8→+1；≤0.5→−2；≤0.65→−1 |
| `App.Adaptive.getPrerequisiteStatus` | `(knowledgePointId) → {ready, items[]}` | 前置知识点历史掌握情况（加权正确率，达标线 0.7）；无前置 ready=null |
| `App.Adaptive.adjustedDifficulty` | `(base, delta) → 1..10` | 基础难度叠加调整量并钳制 |

存储：`localStorage['hw_adaptive_v2']`，桶为 `{ ema, sessions[] }`；主键
`(subject:grade:pluginId[:kpId])`；首次读取自动迁移 v1 并清除旧键。
| `App.Difficulty.difficultyToStructure` | `(level) → {steps, allowBracket, allowMultDiv, complexityScore, …}` | 难度→结构五档映射；complexityScore 全档严格单调（测试 dev/test-difficulty-structure.js） |
| `App.Difficulty.createProfile` | `(baseLevel, delta, opts?) → profile` | 合并用户选择/自适应/插件选项 → `{effectiveLevel, scale, structure, typePreference}` |
| `App.Difficulty.consumeProfile` | `(profile, pluginType) → params` | 按插件类型（expression/geometry/application/oral/默认）翻译为生成参数 |

## 渲染与工厂

| 函数 | 签名 | 说明 |
| --- | --- | --- |
| `renderCard` | `(q, idx, opts?) → HTML` | 标准题目卡片；样式全部走 shared/components.css 类 + tokens 变量 |
| `createPlugin` | `(config) → plugin` | 插件工厂：包装 generate/render/check、注册 moduleId、校验 knowledgePoints；声明以 `plugin.declaredKnowledgePoints` 暴露供静态校验 |

## 样式令牌要点

- 唯一来源：`shared/tokens.css`（@layer 锁定 tokens → base → components → toolbar → pages）。
- 内联样式颜色必须写 `var(--ink)` 等；SVG 表现属性（`fill=`/`stroke=`）不支持 var()，
  保持字面量或改写在 style 属性上。
