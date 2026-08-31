# M3 Final Report — Strategy Engine V1

> 里程碑：M3「Strategy Engine V1 —— 从策略规划到插件接入的统一生成链路」。
> 状态：**✅ COMPLETE / FROZEN**
>
> 冻结边界：
> - 不改动任何旧插件内部逻辑（旧插件 / 旧题型 / 旧渲染 / 打印零修改）
> - Feature Flag 默认 `legacy`：strategy-v1 关闭时线上走 Legacy 路径，行为不变
> - M0 / M1 / M2 各 Gate 保持冻结与通过

## 1. 最终链路

```
用户
 ↓
practice.html          ← Feature Flag：strategy-v1 关闭则直接走 Legacy（行为不变）
 ↓
StrategyRequest
 ↓
KnowledgePoint         ← StrategyResolver（KnowledgePoint.get，唯一接入层）
 ↓
Capability             ← CapabilityResolver.getCapabilities
 ↓
StrategyEngine V1      ← 唯一入口 StrategyEngine.plan(request)，内部顺序固定
 │
 ├─ ① QuestionType     ← question-type-strategy（5 级优先级）
 ├─ ② CognitiveLevel   ← cognitive-strategy（统一三层）
 ├─ ③ Difficulty       ← static-difficulty → target-difficulty → difficulty-strategy
 ├─ ④ Structure        ← structure-constraints（difficulty-static 既有逻辑）
 ├─ ⑤ SpiralLevel      ← spiral-strategy（S1..S6 固定映射）
 ├─ ⑥ Context          ← context-strategy
 └─ ⑦ Count            ← request.count 校验
 ↓
QuestionPlan
 ↓
StrategyValidator      ← 11 项校验；失败不允许进入 Generator
 ↓
LegacyAdapter          ← QuestionPlan → 旧 Plugin options（纯映射）
 ↓
现有 Plugin            ← plugin.generate(options)，插件零修改
 ↓
现有 Render
```

## 2. 核心契约

### 2.1 StrategyRequest（`shared/strategy/strategy-request.js`）

- 必填：`knowledgePointId`
- 可选：`questionType` / `subtype` / `count` / `difficulty` / `targetDifficulty` /
  `adaptive` / `adaptiveDelta` / `allowDifficultyOverride` / `cognitiveLevel` /
  `spiral_level` / `max_spiral_level` / `settings` / `customParams` / `debug`
- 向后兼容旧 UI 参数（subject / grade / count / difficulty / subtype / questionType）
- 禁止字段：svg / html / generate / generator / render / template

### 2.2 QuestionPlan（`shared/strategy/question-plan.js`）

```
{
  knowledgePointId, questionTypeId, count,
  difficulty,        // 最终难度 1-10 整数
  cognitiveLevel,    // recognize / understand / apply
  spiralLevel,       // 1..maxSpiralLevel
  variationMode,     // prototype..transfer
  contextType,       // pure/simple/standard/complex/none
  subtype,           // legacy 子题型（可选）
  constraints: {     // Generator 可直接消费
    difficulty, questionType, cognitiveLevel, spiralLevel, contextType,
    scale, numberRange:{min,max}, maxSteps, allowBracket, allowMultDiv
  }
}
```

- 禁止字段：svg / html / generate / generator / render / template / execute

### 2.3 StrategyResult（`shared/strategy/strategy-result.js`）

- `{ plans, meta:{engine,version,generatedAt}, warnings }`
- debug 模式下额外携带 `strategyTrace`（11 步决策链，M3-22）
- 禁止字段：questions / svg / html / dom / render / renderHtml

## 3. 7 维决策规则（M3-21 验收）

| 维度 | 模块 | Plugin options 字段 |
|---|---|---|
| ① questionType | question-type-strategy | `questionType` |
| ② cognitiveLevel | cognitive-strategy | `cognitiveLevel` |
| ③ difficulty | target-difficulty + difficulty-strategy | `difficulty`、`difficultyParams.level` |
| ④ structure | structure-constraints | `difficultyParams.{steps,allowBracket,allowMultDiv,scale}` |
| ⑤ spiralLevel | spiral-strategy | `spiralLevel` |
| ⑥ context | context-strategy | `contextType` |
| ⑦ count | engine（M3-07 分配库） | `count` |

验收：`dev/check-strategy-plumbing.js` 对 574 KP 全量验证 7 维均从 Strategy 进入 Plugin options —— **574/574 通过**。

## 4. 优先级规则汇总

- **题型（M3-06）**：① 用户明确 questionType → ② Capability 支持 subtype → ③ CognitiveLevel 匹配 → ④ KP 默认题型 → ⑤ Registry 默认；KP 不支持 → 明确拒绝
- **认知层级（M3-13）**：① 用户/策略指定 → ② QuestionType 支持范围（过滤）→ ③ KP cognitiveLevel → ④ 默认 understand；输出统一三层（Registry 枚举子集，不重定义）
- **数值范围（M3-12）**：① settings → ② KP numberRangeDefault → ③ DifficultyStatic → ④ Difficulty Profile；不变式 min ≤ max
- **难度（M3-10）**：用户明确 difficulty + 允许覆盖 → targetDifficulty；否则 → StaticDifficulty；自适应开启 → +adaptiveDelta

## 5. Difficulty 规则（M3-08/09/10/11）

- **静态多维（M3-08）**：7 维（G/S/C/T/St/N/A）合成 `D = 1 + 9·wsum`，唯一入口
  `DifficultyStatic.paramsForKnowledgePoint`（禁止重实现公式）；Canonical → legacy 元数据适配
  `toEngineMeta`
- **有效难度（M3-09）**：`effective = staticLevel + adaptiveDelta`，`clamp(1, 10)`
- **目标难度（M3-10）**：显式规则（插件不得自行判断）
- **结构约束（M3-11）**：最终难度 → `{maxSteps, allowBracket, allowMultDiv, numberRange}`；
  优先 difficulty-static.js 已有逻辑，不复制 difficulty.js 结构分档
- **回归（M3-24）**：difficulty 1/3/5/7/10 → level `[1,3,5,7,10]`、steps `[1,2,3,4,5]`、
  bracket/multDiv 难度 5 起放开、scale 单调递增

## 6. Spiral 规则（M3-14）

- S1 → prototype / S2 → numeric / S3 → presentation / S4 → context / S5 → structure / S6 → transfer
- 不变式：`spiralLevel ≤ max_spiral_level`；超过 S6 固定 transfer

## 7. Context 规则（M3-15）

- QuestionType 不支持 context → `none`
- 支持 → KP contextDefault（standard 为全库默认）
- 高螺旋（≥4）/ 应用认知（apply）→ 提高一档，封顶 complex
- 枚举仅用项目已有：pure / simple / standard / complex

## 8. Count 规则（M3-07/26）

- 单知识点：`sum(plan.count) === request.count`（1/3/5/10/20 回归通过）
- 多题型分配（M3-07 库）：最大余数法，10 → 4/3/3；不变式 sum === count（9/11 即报错）

## 9. LegacyAdapter（`shared/strategy/legacy-adapter.js`）

```
QuestionPlan → {
  difficulty,
  difficultyParams: { level, scale, steps, allowBracket, allowMultDiv },
  maxNum,                 // numberRange.max
  questionType,
  subtype,
  cognitiveLevel, spiralLevel, contextType   // M3 新增
}
```

- 纯映射层，不修改插件内部逻辑；UI 透传 grade/type/settings/settingNums

## 10. Feature Flag（`shared/strategy-config.js`）

- 默认 `legacy`（线上行为零修改）；`strategy-v1` 经环境变量 / global 开关
- `practice.html`：`StrategyConfig.isStrategyV1()` 为真且插件声明 knowledgePoints 时
  走 `StrategyEngine.plan → LegacyAdapter → plugin.generate`；否则回退 Legacy
- 浏览器打包：`npm run build:strategy` → `shared/strategy-engine.bundle.js`（内置 require 注册表）

## 11. 测试结果

- `tests/strategy/*.test.js`：**173/173 通过**，覆盖：
  - M3-23 单知识点：数学×5 / 语文×5 / 英语×5（KB 英语仅 3 个 KP，后 2 个 slot 循环复用）
    × 基础(2)/中等(5)/高难(8)，逐例验证 7 维
  - M3-24 难度回归：1/3/5/7/10 五档 level/steps/numberRange/bracket/multDiv/scale
  - M3-25 题型回归：指定 / 不指定 / 非法 / KP 不支持
  - M3-26 数量回归：1/3/5/10/20
  - M3-27 螺旋/情境回归：S1..S6 全档 + 全量 574 KP 范围校验
  - M3-21 管道验收：574/574 七维进入 Plugin options
  - M3-22 Debug Trace：11 步决策链
- `npm run verify:m3` 全绿

## 12. 回归结果（M3-28）

- `npm run verify`（M0）：**7/7 PASS**（语法 / KB 契约 / 插件契约 / 难度双轨 / Golden / Snapshot / 架构护栏）
- `npm test`：全部通过，除 **4 项既有数据缺口**（非 M3 引入）——
  math-number-sense / math-geometry / math-shapes / math-unit-convert 的 g2 题目标注引用了
  KB 未登记的知识点 id（如 `math-g2-m6-angles`、`math-g2-m4-fill-unit`），与 M0 插件契约警告同源
- M1 Gate：**PASS**；M2 Gate：**PASS**
- 旧插件 / 旧题型 / 旧渲染 / 打印：零修改、零退化（practice.html 仅新增 strategy-v1 分支与公共执行函数，Legacy 路径逐行等价）

## 13. 已知限制

1. 英语 KB 仅 3 个 KP（letter-recognition / letter-sound / word-spelling），M3-23 英语 ×5 靠循环复用
2. 语文/英语题型映射以 calc/geometry 兜底，学科化题型谱系待 M4 扩展
3. numberRange 按 M3-12 优先级由 KP 声明权威（②），不随用户难度变化；难度敏感路径仅在无 KB 范围时生效（④）
4. 自适应仅 v1 线性叠加（staticLevel + delta），未接入题型偏好（typeBias）
5. 引擎 v1 单 plan 输出；M3-07 多题型分配已实现为库，未接入引擎（留给 M4 混合练习）
6. UI strategy-v1 默认休眠；插件需在 registry 声明 knowledgePoints 才会被 strategy 路径接管
   （否则回退 Legacy）；`declaredKnowledgePoints` 多 KP 时 v1 取首项

## 14. M4 输入接口

| 接口 | 位置 | 说明 |
|---|---|---|
| `StrategyEngine.plan(request)` | `shared/strategy/strategy-engine.js` | 唯一规划入口 → StrategyResult |
| `StrategyEngine.formatStrategyTrace(trace)` | 同上 | debug 决策链渲染（AI/人工排查） |
| `StrategyValidator.validatePlan(plan)` | `shared/strategy/strategy-validator.js` | 11 项 Gate |
| `LegacyAdapter.adaptPlanToLegacyOptions(plan, extra)` | `shared/strategy/legacy-adapter.js` | Plan → 插件 options |
| `QuestionTypeAllocation.allocateQuestionTypes` | `shared/strategy/question-type-allocation.js` | 多题型分配（M4 混合练习） |
| 浏览器全局 | `shared/strategy-engine.bundle.js` | `StrategyEngine` / `StrategyLegacyAdapter` / `StrategyConfig` / `StrategyValidator` 等 |
| 构建 | `npm run build:strategy` / `npm run verify:m3` | bundle 生成与 M3 全量验证 |

## 15. 状态

| 项 | 状态 |
|---|---|
| M3-01 ~ M3-28 | ✅ COMPLETE |
| M3-31 最终文档与冻结 | ✅ COMPLETE |
| **M3 整体** | **✅ COMPLETE / FROZEN** |
