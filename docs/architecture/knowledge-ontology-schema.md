# Knowledge Ontology Schema（M1-01）

> M1-01 产出。在已冻结的 M0 基线之上，建立 **Legacy Knowledge Point → Canonical Knowledge Ontology**
> 的统一、稳定、可验证、可扩展的知识点本体模型。本阶段只建 Schema / Normalizer / Validator / 覆盖报告，
> 不触达题目生成，不接入线上流程。

## 1. 设计目标

- 将分散在 `KnowledgeBank` 各科目分片中的 Legacy 知识点，归一化为统一结构（Canonical KnowledgePoint）。
- 为后续 M1-02 数据治理、M1-03 能力模型、M1-04 题型策略、M1-05 难度计算、M1-06 KnowledgeResolver
  与 M2 Strategy Engine 提供稳定的输入契约。
- 建立「事实 / 能力边界 / 派生指标」的清晰边界，避免把生成策略塞进知识点数据。

## 2. Canonical Schema（v1）

```javascript
{
  id: "math-g2-m1-mult-table",          // 必须与 KnowledgeBank 当前 ID 一致（M1-01 不改 ID）
  subject: "math",                      // math | cn | en
  grade: 2,                             // 1..6，由 id 解析（g{n} 段）

  module: { id: "m1", name: "口算练习" }, // 由 id 的 module 段解析，name 取自 module-catalog

  identity: { id, name, description },   // “这是哪个知识点？”

  source: { pluginId, legacyType },     // 回指 Legacy 插件与 opts.type

  semantics: {                          // 未来核心：事实 + 操作
    operations: [],                     // 标准 operation 枚举（见 §6）
    factualContent: {}                  // 公式/单位/词表/概念事实，不含随机数/用户态
  },

  structure: {                         // 能力边界（不是最终出题结构）
    minSteps: 1, maxSteps: 1,
    allowBracket: false, allowMultDiv: false
  },

  cognition: { level: 0.67, targets: [], raw: "掌握" }, // 认知层级（数值；raw 保留原中文）

  presentation: {
    questionTypes: [ { type, weight, rawType, cognitiveLevels, difficultyFactor } ],
    graphicType: null
  },

  numeric: { range: { min, max }, integerOnly: true, decimalPlaces: 0 },

  context: { defaults: [], allowPure: true, allowContextual: true },

  errors: [],                          // 兼容字符串数组或 {id,description}

  spiral: { level: 1, maxLevel: 1 },   // 螺旋阶段（非 difficulty，非 user mastery）

  metadata: { weight: 1, version: 1 }, // weight 兼容综合练习抽题

  legacy: { ... }                      // 原始未映射字段（description/example/prerequisites/...）保留，不丢失
}
```

## 3. 字段定义（要点）

| 字段 | 含义 | 来源 |
|---|---|---|
| identity | 知识点身份 | Legacy `id`/`name`/`description` |
| semantics.operations | 标准操作枚举 | 见 §6（当前 Legacy 无此字段 → 空） |
| semantics.factualContent | 知识点事实 | 公式/单位/词表/概念（当前 Legacy 无 → 空） |
| structure | 允许的结构边界 | Legacy `max_steps_default` → `maxSteps` |
| cognition | 认知层级 | Legacy `cognitive_level`（中文）→ 数值映射 |
| presentation.questionTypes | 适配题型 | Legacy `applicable_question_types`（coefficient→weight） |
| numeric | 数值范围 | Legacy `number_range_default`（对象 {min,max} 或标量） |
| context | 情境类型 | Legacy `context_default`（pure/simple/standard/complex） |
| errors | 常见错误模式 | Legacy `common_errors`（当前无 → 空） |
| spiral | 螺旋阶段 | Legacy `spiral_level` / `max_spiral_level` |
| metadata.weight | 抽题权重 | Legacy `weight`（不变，综合练习行为不变） |

## 4. Legacy → Canonical 映射

```text
id                      → id + subject + grade + module.id（全部由 id 三段式解析）
name                    → identity.name
description             → identity.description（同时保留 legacy.description）
pluginId                → source.pluginId
type                    → source.legacyType
spiral_level            → spiral.level
max_spiral_level        → spiral.maxLevel（缺省取 level）
cognitive_level(中文)    → cognition.level(数值) + cognition.raw
applicable_question_types → presentation.questionTypes（coefficient→weight，别名归一）
number_range_default    → numeric.range（{min,max} 或标量→{1,max}）
max_steps_default       → structure.maxSteps
context_default         → context.defaults（pure→allowContextual=false）
weight                  → metadata.weight
example/prerequisites/related/status/category/... → legacy.*（保留，不丢失）
```

## 5. 哪些是事实 / 能力边界 / 派生

- **事实（factualContent）**：公式、口诀范围、单位、词表、概念关系。不随用户/生成变化。
- **能力边界（structure/cognition/presentation/numeric/context）**：该知识点“允许”的结构与呈现范围，
  不是每次具体生成结果。最终几步、几个选项由 M2 Strategy Engine 决策。
- **派生（Difficulty / Learner）**：难度由「Ontology + QuestionType」经 Difficulty 引擎计算；
  用户掌握度属于未来 Learner Model。两者都不属于 Ontology 本身。

## 6. Operation 标准枚举（M1-01 建立）

```text
add subtract multiply divide
compare order
compose decompose
measure convert
identify classify
read write
calculate reason
represent model
```

规则：稳定英文标识；不允许插件自行创造同义词；未确认的 operation 不得强行归类（当前 Legacy 无
operations 字段，归一化后为空数组，由 M1-02 治理）。`multiply` 为统一命名（不另立 `multiplication`）。

## 7. Ontology 与周边的关系

```text
KnowledgeBank          = 知识点目录 / 来源数据（继续返回 Legacy 原对象，API 不变）
Knowledge Ontology     = 标准化教学实体（本文件 + normalizer + validator）
Strategy Engine (M2)   = 根据 Ontology 决策出题（M1-01 不实现）
Difficulty (M0)        = 根据 Ontology + QuestionType 等计算的派生指标
Learner Model (未来)    = 用户实际掌握状态（不写入 Ontology / KnowledgeBank）
```

边界（M1-01 严禁跨入）：
- Ontology 可读取 KnowledgeBank、做数据转换、做 Schema 验证、输出 Canonical Model。
- Ontology **不**调用 `Plugin.generateQuestions()`、不渲染、不碰 DOM、不读写 `StorageManager` 用户数据。

## 8. 一致性说明（与既有引擎）

Normalizer 对 `cognitive_level` / `number_range_default` / `context_default` / `spiral_level` /
`max_steps_default` / `applicable_question_types` 的解析，严格对齐 `shared/difficulty-static.js`
既有的 `COGNITIVE_MAP` / `calcNumberScore` / `getContextScore` / 螺旋与步骤公式，避免重新猜测语义。

## 9. 574 知识点覆盖现状（M1-02 输入）

`node dev/check-ontology-schema.js` 扫描 574 个知识点，结果：0 ERROR / 574 WARNING。覆盖情况：

```text
identity                     574/574
structure                    574/574
cognition                    574/574
presentation.questionTypes   574/574
numeric                      574/574
context                      574/574
spiral                       574/574
semantics.operations           0/574   ← M1-02 需补 operation 标注
semantics.factualContent       0/574   ← M1-02 需补事实数据
errors                         0/574   ← M1-02 需补常见错误模式
```

## 10. 测试

```bash
node --test tests/ontology/*.test.js     # 19 用例全过
node dev/check-ontology-schema.js        # 574 扫描 + 覆盖报告
npm run verify:m1:ontology               # 同上（npm 入口）
```
