# P25-BASELINE — 教学语义专项基线（P25-00）

> 由 `dev/p25/build-baseline.js` 只读生成；可重复运行，结果仅随数据源变化。
> 本文件为 P25 专项的事实快照，不引入任何新语义结论；A/B/C/D 分级为**草拟**（`draftSemanticLevel`），须经 P25-02 人工治理确认。

## 0. 基线快照与不变式

| 项 | 值 | 来源 |
| --- | --- | --- |
| KP 总数 | **375** | kbl/canonical/knowledge.json (generatedAt 2026-09-16T03:45:35.380Z) |
| ALLOW 映射 | **1570**（permission 全 allow） | kbl/canonical/mappings.json (generatedAt —，与 generation-contract/math.json 同源同计数) |
| capability 视图 | 375 | kbl/canonical/capability.json |
| runtime 语义库 | 375（semantic/assessment 块） | kbl/data/math/g1..g6（与 runtime 副本逐字节一致） |
| 原生 Generator 记录 | 27（其中 16 个有 KP 绑定，绑定 KP 共 120 个） | shared/generator/generator-registry.js CORE_RECORDS |
| 规范题型 | calc / fill / choice / judge / geometry / classify / apply | question-type-registry |

不变式校验：KP=375 ✔ / ALLOW=1570 ✔ / capability 覆盖 375 ✔ / 语义库覆盖 375 ✔ / 映射无空 pluginId ✔

## 1. KP 总表与字段口径（对应指令第 1/2 项）

全量 375 行见 [P25-KP-MATRIX.json](./P25-KP-MATRIX.json)。字段口径：`grade/book/unitId/unitNo/unitName/module(domain)/name/description(definition)/cognitiveLevel/seedDifficulty/numberRange/maxSteps/questionTypes(allowedTypes)/semanticFamily/operations/representations/assessmentQuestionTypes/misconceptionSlots(现 assessment.errors 空槽)/generatorBindings(registry 原生绑定)/canonicalPlugins(canonical 粗派生承载)/allowByQuestionType/draftSemanticLevel/draftBasis`。

### 分布

- 草拟分级：{"D":93,"B":41,"C":166,"A":75}
- domain 分布：{"geometry":101,"algebra":189,"practice":60,"statistics":25}
- 年级·册分布：{"g1-down":25,"g1-up":14,"g2-down":32,"g2-up":28,"g3-down":35,"g3-up":36,"g4-down":41,"g4-up":28,"g5-down":44,"g5-up":36,"g6-down":29,"g6-up":27}

## 2. 1570 条 KP×QuestionType 映射（对应指令第 3 项）

全量 1570 行见 [P25-GENERATION-MATRIX.json](./P25-GENERATION-MATRIX.json)（每行含 knowledgeId/questionType/capability/permission/pluginId/coefficient/derivation/draftSemanticLevel）。

- 按题型分布：{"apply":375,"choice":375,"fill":375,"geometry":105,"judge":126,"calc":189,"classify":25}
- 按草拟分级×题型：{"D":{"apply":93,"choice":93,"fill":93,"geometry":76,"judge":73,"calc":3},"B":{"apply":41,"calc":35,"choice":41,"fill":41,"geometry":5,"judge":4},"C":{"apply":166,"calc":136,"choice":166,"fill":166},"A":{"apply":75,"calc":15,"choice":75,"fill":75,"classify":25,"judge":49,"geometry":24}}

## 3. 承载模型：每条映射实际使用的 Generator（对应指令第 4 项）

「实际使用」需分三层表述（这是本基线的关键口径修正）：

1. **canonical 粗派生承载**（mappings.json / generation-contract 的 pluginId，kbl-derived）：仅 5 种——arithmetic-addition(939)、classification(25)、selection-choice(375)、selection-fill(105)、selection-judge(126)。这是派生期的粗粒度归类，**不是运行时实际路由**。
2. **registry 原生语义绑定**（CORE_RECORDS.knowledgePoints）：语义专项路由 SSOT，16 个 Generator 绑定 120 个 KP。逐 Generator 见 generatorIndex.registryGenerators。
3. **运行时实证**：selector 按能力评分路由（kp > capability > qt），P24-02 `verify:allow-gen` 已实证 **1570/1570 全部可真实生成 ≥1 题**。静态基线不重跑生成，以该门禁为运行时事实引用。

## 4. 每 Generator 支持的语义族（对应指令第 5 项）

Generator 的「语义族」以其 questionTypes/capabilities + 所绑定 KP 的 semantic.family 与草拟分级刻画；registryGenerators.boundKpDraftLevels 给出每 Generator 服务 KP 的 A/B/C/D 构成。专项语义（百分数/分类/图形/统计/推理/计数/看图方程/应用题等）由专项 Generator 承载，算术族由 arithmetic/complex + core resolver 注入运算语义，其余 KP 依赖通用兜底 + selector 路由。

## 5. 现有 semantic resolver / profile（对应指令第 6 项）

- `shared/generator/core/arithmetic-core.js` — M4-R06 核心算术抽取件 (P7 Task 4.3 配置化)
- `shared/generator/core/kp-arithmetic-semantics.js` — M4-R17 KP 级算术语义解析
- `shared/generator/core/kp-complex-semantics.js` — M4-R18 KP 级复杂运算语义解析
- `shared/generator/core/op-semantics.js` — 操作 ID → 符号 查询助手
- `shared/generator/core/rng.js` — M4-R06 核心随机源（可复现，禁止 Math.random）

- 专项注入点：`kp-arithmetic-semantics.js` 的 `CANONICAL_KP_OVERRIDES`（当前 1 条：math-g5-up-u02-k002 → dec-mult，`knowledgePoints:[]` 形态以过 kbl-uniqueness 门禁）；`percent.js` 以 KP 尾缀 '001'~'006' 分派 6 个子类型 maker（P24-02）。
- 已知债务：尾缀分派是事实上的 KP 硬编码，列入 P25-06 审计项。

## 6. Validator 现有语义验证能力（对应指令第 7 项）

- `shared/validator/answer-validator.js` — M5-R06 Answer Validator
- `shared/validator/batch-validator.js` — M5-R15 Batch Question Validator
- `shared/validator/composite-validator.js` — M8-R02 Composite Integrity Validator
- `shared/validator/difficulty-integrity-validator.js` — M8-R03 Difficulty Integrity Validator
- `shared/validator/difficulty-validator.js` — M5-R09 Difficulty Validator
- `shared/validator/duplicate-integrity-validator.js` — M8-R04 Duplicate Integrity Validator
- `shared/validator/duplicate-validator.js` — M5-R10 Duplicate Validator
- `shared/validator/kp-coverage-validator.js` — M8-R01 KP Coverage Validator
- `shared/validator/kp-semantic-validator.js` — P0-05 KP 语义验证器
- `shared/validator/quality-scorer.js` — M5-R18 Question Quality Score
- `shared/validator/question-validator.js` — M5-R04 Validator 核心接口
- `shared/validator/validation-pipeline.js` — M5-R13 Validation Pipeline

- 语义验证核心：`kp-semantic-validator.js` 六项检查 = ① KP identity（question.knowledgePointIds 与 Plan 一致）② questionType ∈ KP 允许范围 ③ operation 与 KP 一致（经 arithmetic/complex resolver）④ numberRange ⑤ maxSteps/structure ⑥ factualContent/graphicType 出现性。
- P25-04 将在其上扩展 `SEMANTIC_PASS/WARN/FAIL` 语义证据层（不做任何放宽）。

## 7. Learner / error-model 记录能力（对应指令第 8 项）

- `shared/learner/error-model.js` — M6-R09 错因（Error Pattern）模型
- `shared/learner/learner-model.js` — M6-R02 / R06 / R07 / R08 / R11 / R26
- `shared/learner/learner-storage.js` — M6-R03 Learner Model Storage
- `shared/learner/practice-result.js` — M6-R04 练习结果标准对象
- `shared/learner/result-collector.js` — M6-R05 练习结果收集器

- 持久化：复用 StorageManager，唯一 key `hw-help-state.learnerState`。
- P25-11 接线要求：错误反馈可回溯 knowledgePointId + questionType + semanticTarget（semanticTarget 为 P25 新增维度）。

## 8. 深语义 / 结构 / 兜底 KP 清单（对应指令第 9/10/11 项）

草拟口径（以 registry 原生绑定为主证据，详见脚本注释）：**A 深语义型** = 原生绑定专项语义 Generator；**B 结构语义型** = 原生绑定算术/复杂数计算族（resolver 注入运算语义）；**C 通用基础型** = 无原生绑定（通用兜底 + selector 路由）；**D 待专项治理型** = 无原生绑定但 domain 为几何/统计或表征含 graphic（概念丰富、生成器通用 → P25-02 重点）。

| 级别 | 数量 | 说明 |
| --- | --- | --- |
| A 深语义型 | 75 | 全表见 P25-KP-MATRIX.json（draftSemanticLevel=A） |
| B 结构语义型 | 41 | 同上（=B） |
| C 通用基础型 | 166 | 同上（=C） |
| D 待治理型 | 93 | 同上（=D）；P25-02 优先治理对象 |

A 类样例（前 20）：math-g2-down-u01-k001, math-g2-down-u01-k002, math-g2-down-u04-k005, math-g2-up-u01-k001, math-g2-up-u01-k002, math-g2-up-u01-k003, math-g2-up-u01-k004, math-g2-up-u01-k005, math-g2-up-u01-k006, math-g2-up-u07-k001, math-g3-down-u03-k001, math-g3-down-u05-k001, math-g3-down-u05-k002, math-g3-down-u05-k003, math-g3-down-u05-k004, math-g3-down-u08-k001, math-g3-up-u06-k001, math-g3-up-u08-k001, math-g4-down-u01-k001, math-g4-down-u02-k001 …

D 类全列：math-g1-down-u01-k001, math-g1-down-u06-k002, math-g1-down-u07-k001, math-g1-down-u07-k002, math-g1-down-u08-k001, math-g1-up-u03-k002, math-g2-up-u04-k003, math-g2-up-u04-k004, math-g2-up-u05-k001, math-g2-up-u05-k002, math-g2-up-u05-k003, math-g2-up-u05-k004, math-g2-up-u05-k005, math-g2-up-u06-k001, math-g2-up-u08-k001, math-g3-down-u01-k001, math-g3-down-u01-k002, math-g3-down-u01-k003, math-g3-down-u01-k004, math-g3-down-u03-k002, math-g3-down-u03-k003, math-g3-down-u03-k004, math-g3-down-u04-k001, math-g3-down-u04-k002, math-g3-down-u04-k003, math-g3-down-u04-k004, math-g3-down-u04-k005, math-g3-down-u08-k003, math-g3-down-u08-k006, math-g3-up-u01-k001, math-g3-up-u01-k002, math-g3-up-u01-k003, math-g3-up-u03-k001, math-g3-up-u03-k002, math-g3-up-u03-k003, math-g3-up-u03-k004, math-g3-up-u07-k001, math-g3-up-u07-k002, math-g3-up-u07-k003, math-g3-up-u07-k004, math-g3-up-u09-k001, math-g4-down-u02-k002, math-g4-down-u02-k003, math-g4-down-u05-k001, math-g4-down-u05-k002, math-g4-down-u05-k003, math-g4-down-u05-k004, math-g4-down-u05-k005, math-g4-down-u05-k006, math-g4-down-u07-k003, math-g4-down-u07-k004, math-g4-down-u07-k005, math-g4-down-u10-k001, math-g4-up-u02-k001, math-g4-up-u02-k002, math-g4-up-u02-k003, math-g4-up-u05-k001, math-g4-up-u05-k002, math-g4-up-u05-k003, math-g4-up-u05-k004, math-g4-up-u09-k001, math-g5-down-u01-k002, math-g5-down-u01-k003, math-g5-down-u03-k001, math-g5-down-u03-k002, math-g5-down-u03-k003, math-g5-down-u11-k001, math-g5-up-u01-k001, math-g5-up-u01-k003, math-g5-up-u04-k001, math-g5-up-u04-k002, math-g5-up-u08-k001, math-g5-up-u08-k002, math-g5-up-u08-k003, math-g5-up-u08-k004, math-g5-up-u09-k001, math-g6-down-u03-k005, math-g6-down-u03-k006, math-g6-down-u04-k007, math-g6-down-u04-k008, math-g6-down-u06-k001, math-g6-up-u01-k001, math-g6-up-u01-k002, math-g6-up-u01-k003, math-g6-up-u02-k002, math-g6-up-u02-k003, math-g6-up-u02-k004, math-g6-up-u04-k001, math-g6-up-u04-k002, math-g6-up-u04-k003, math-g6-up-u04-k004, math-g6-up-u04-k005, math-g6-up-u06-k001

## 9. P25-02 交接

- 本基线的 `draftSemanticLevel/draftBasis` 仅为启发式初判，全部视为 `NEEDS_REVIEW`。
- 下一步：`dev/p25/draft-semantic-matrix.js` 基于 A/D 类优先产出人工评审矩阵（xlsx + review json），人工确认前不写入任何正式数据（不改 root Excel / 不改 kbl/canonical）。

## 10. 复现

```bash
node dev/p25/build-baseline.js   # 只读；产出 docs/p25/ 三件套
```
