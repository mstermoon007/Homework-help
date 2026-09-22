# POL Contract — 标准练习编排层契约（Phase 5 冻结）

> 冻结时间：2026-09-13（Phase 5：Standard Practice Orchestration Contract）
> 关联：`docs/pol-kbl-stable-baseline.md`、`docs/pol-kbl-pending.md`、`docs/pol-kbl-shape-drift-audit.md`
> 原则：能合并不新增、能删除不保留；Support < Core；POL 是运行时编排边界，不是新业务层。

---

## 1. 定义

> **标准编排层（POL）是练习任务的唯一业务编排边界**：把用户练习请求标准化为 **Practice Plan**，
> 统一协调范围、知识点、题型、总题量、容量、最低配额、分配、模式与难度上下文，
> 然后调用既有 Strategy / Generator 链完成生成。

一句话：`请求 → 编排 → 策略 → 生成 → 校验 → 语义题 → 渲染 → 练习/打印`，其中编排 = POL。

## 2. 四个编排对象（冻结）

| 对象 | 回答 | 现有等价物（直接复用，不新增） |
|---|---|---|
| **Practice Request** | 用户想做什么 | `RequestNormalize` 归一后的请求（UI/URL → 标准请求） |
| **Practice Plan** | 这次练习如何组织 | `PracticeOrchestrator.plan()` 输出（requestedCount/feasibleTypes/typeCaps/kpTypeMatrix/kpDistribution/difficulty/targetTotal/coverageStatus） |
| **Generation Plan** | 策略如何生成 | Strategy `QuestionPlan`（既有，冻结） |
| **Question Set** | 最终题目集合 | `GenerationResult.questions`（Validator → SemanticQuestion） |

## 3. 职责域与排除项

**POL 管（5 域）**

```text
① Request 编排：标准化 / 模式 / 年级学科 / 范围
② 练习任务编排：一次练习如何组织
③ 题目编排：KP 选择 / 题型选择 / 总题量 / Capacity / 最低配额 / Allocation / 顺序
④ Difficulty Context：接收 / 规范化 / 统筹 / 传递（不计算）
⑤ Practice Plan：编排结果（唯一产物）
```

**POL 不管（明确排除）**

```text
✗ KBL 数据（KBL Runtime 唯一事实源）
✗ 难度计算（Difficulty Authority 唯一公式）
✗ 题目生成（Generator）
✗ 质量判定（Validator）
✗ Composite 实现（Pending 最小接口，见 P1）
✗ 渲染 / SVG（Presentation）
✗ 打印实现（Practice Output）
✗ 在线练习状态（PracticeSession / UI）
```

## 4. Contract 表（能力 × 层）

| 能力 | POL | Strategy | Generator | Validator | Presentation |
|---|---:|---:|---:|---:|---:|
| 用户请求标准化 | ✅ | | | | |
| 范围组织 | ✅ | | | | |
| 题型选择 | ✅ | 协同 | | | |
| 总题量 | ✅ | | | | |
| Type Budget | ✅ | | | | |
| KP Budget | ✅ | | | | |
| Capacity | ✅ | | | | |
| 最低题型配额 | ✅ | | | | |
| 难度参数透传 | ✅ | 协同 | | | |
| 难度计算 | ❌ | 既有权威 | | | |
| 生成策略 | | ✅ | | | |
| 具体题目生成 | | | ✅ | | |
| 题目质量判断 | | | | ✅ | |
| SemanticQuestion | | | | ✅ | |
| SVG/HTML 渲染 | | | | | ✅ |
| 页面展示 / 打印 | | | | | ✅ |

## 5. 唯一入口链（生产）

```text
UI（practice.html / select.html）
  ↓ PracticeBridge.start（UI 状态 → 标准请求）
PracticeSession（会话状态；不参与编排）
  ↓ GenerationAPI.generate
PracticeOrchestrator.orchestrate（POL 唯一入口）
  ↓ plan() → Practice Plan
executeInline（POL inactive 时透明回退：combine / comprehensive / no-types / no-kp / 非 math）
  ↓
Strategy → Generator → Validator → SemanticQuestion → Presentation → Practice UI / Print
```

- `executeInline` 是 POL 的**透明回退**（保留既有模式语义），不是第二编排层。
- 不新增 `createPracticeRequest/createPracticePlan` 函数：等价物已存在（见 §2）。

## 6. 题量编排规则（冻结）

```text
count = Total Practice Budget（整次练习总预算）
1) count ≥ 题型数 N：每题型保底 1，剩余按 Round-Robin 给「当前最少且未达容量」的题型 +1
2) count < N：无法完整覆盖，最多交付 count 题（每题型 ≤1），coverageStatus=TYPE_COVERAGE_INFEASIBLE
3) 容量封顶：题型容量耗尽 → 收敛于 plannedTotal，coverageStatus=CAPACITY_LIMITED
4) 守恒：Σ typeCounts.count = plannedTotal ≤ count；Σ cells.count = Σ typeCounts.count
5) 显式组合（typeCounts/perTypeCount）权威：不再被均衡重算覆盖，仅受容量封顶
```

实现：`shared/orchestration/budget-allocation.js`（纯函数；Capacity 由 POL 注入）。

**P10-1 冻结（UI 唯一输入，POL 唯一分配）**：UI 仅提交用户输入（selectedTypes/selectedKPs/count/difficulty）；
分题型数量仅在用户显式编辑时以 `typeCounts` 传递（`state.typeCountsEdited`）；未编辑时由 POL 统一分配。
验收：`tests/orchestration/p10-count-contract.test.js`（8 用例）。

## 7. 多 KP / 范围规则（冻结）

```text
范围（unit/module）→ KnowledgeContext.poolKpIds → KP 候选
Capacity（capacity-inventory，Node；浏览器 Infinity 由 recovery 兜底）
能力可行题型（knowledge-capability-view：ALLOW → DEGRADE → 兜底）
→ Type Budget × KP Budget → cell(kpId × questionType × count) → Strategy
```

- POL 不复制 KBL 事实；KP 访问一律经 `KnowledgeContext`（KBL Runtime 唯一事实源）。
- POL 不按 moduleId 做题型路由（题型选择归 Strategy）。

## 8. Difficulty 规则（冻结）

```text
Request.difficulty（number/object/null 均可）
  ↓ DifficultyOrchestrator.normalizeDifficultyInput（只归一，不算）
POL Difficulty Context（requested/min/max/tolerance/source + 容量维度对齐）
  ↓ 传递
Strategy（既有权威：static → target → 合成）
```

- 不复制公式（`difficulty-static.js` / `difficulty.js` 唯一裁决）。
- POL 的 `predictDifficulty` 仅用于容量分桶/账本标记，绝不复写 `genReq.difficulty`。
- DRIFT-11（Target 全局兜底缺失）归 Phase 6，不在本层处理。
- 产品语义与责任层见 §14（P10-3 冻结）。

## 9. Session / Render / Print 边界

| 层 | 归属 | 说明 |
|---|---|---|
| 在线练习状态（当前题/答题/提交/结果） | `PracticeSession`（既有） | POL 不接管 UI 状态 |
| 渲染 / SVG / HTML | `Presentation`（既有） | POL 仅通过注入回调 `deps.render` 组装输出，不实现渲染 |
| 打印 | `Practice Output`（print.js） | POL 不涉及打印布局/CSS |

## 10. 5.1 审计发现与处置

| # | 发现 | 判定 | 处置 |
|---|---|---|---|
| A1 | POL 是 `GenerationAPI.generate` 外层唯一入口（`api.js:471-479`）；`executeInline` 为 inactive 透明回退 | 合规 | 契约固化（§5） |
| A2 | comprehensive 无显式 bail（依赖 no-types 自然回退）；带题型白名单时可能误入 POL 池路径 | 路由漂移 | **已修复**：POL `plan()` 增显式 comprehensive 回退（对齐 api.js `isComprehensive`） |
| A3 | UI 重复题型预算：`practice.html syncTypeCounts/splitEqual` 始终生成等分 `typeCounts` 并以显式组合传给 POL → 覆盖 POL 最低配额/容量分配 | 职责重复（中） | **登记待决策**（改动涉及默认分配与 UI 展示一致性；见 pending） |
| A4 | 默认值多处：count（UI 20 / bridge DEFAULTS / POL 20 / session 10）、difficulty（UI 1 / POL 3 / session 3） | 请求兜底差异 | 契约固化：POL 权威默认 20；UI 默认属请求编排；session 10 为 frozen 兜底 |
| A5 | POL 通过注入回调调用渲染与输出选项归一（不实现渲染） | 合规 | 边界说明（§9） |
| A6 | Session / Print 职责独立 | 合规 | 契约固化（§9） |
| A7 | W7 编排规范化重复（api.js / generation-engine frozen） | 受控例外 | 维持现状（frozen 不可改） |
| A8 | DRIFT-11：POL 取 frozen Target 缺全局兜底 → 预测恒回落 3 | 已登记 | Phase 6（P2） |

## 11. 默认值政策

| 字段 | 权威默认 | 说明 |
|---|---|---|
| `count` | POL：`req.count ?? volume ?? 20`（≥1 取整） | UI 默认 20 与 bridge DEFAULTS 属请求编排；session 10 为 frozen 兜底 |
| `difficulty` | 未显式 → POL 预测（容量维度）/ 生成由 Strategy 合成 | 用户显式值只透传，不改写 |
| `mode` | UI：native / multi-kp / adaptive；POL 不改变模式语义 | comprehensive/combine 显式回退 |
| 题型 | `RequestNormalize.normalizeQuestionTypes` 唯一归一 | POL 只消费 canonical 题型 |

---

## 12. Generation 接入契约（Phase 6 冻结）

### 12.1 唯一入口链（生产）

```text
PracticeBridge（UI 状态 → 标准请求）
  ↓
PracticeSession（会话状态）
  ↓ GenerationAPI.generate（唯一生成入口；生产调用者仅 practice-session）
PracticeOrchestrator.orchestrate（唯一编排入口）
  ↓ plan() → Practice Plan（cell: kpId × questionType × count）
executeInline（POL inactive 透明回退）
  ↓
Strategy → Generator → Validator → SemanticQuestion → Presentation → Practice Output
```

### 12.2 生成对象契约

| 对象 | 产生者 | 消费者 | 职责 |
|---|---|---|---|
| Practice Request | UI/Bridge（RequestNormalize） | POL | 用户请求 |
| Practice Plan | POL（`plan()`） | Strategy（cell 执行） | 练习任务编排 |
| Generation Plan | Strategy（QuestionPlan） | Generator | 生成策略 |
| Question Set | Generator/Validator | Session/Presentation | 最终题目 |
| GenerationResult | Generation 链（api/POL） | Session | 生成结果状态 |

### 12.3 计数语义（复用现有，不新增对象）

```text
GenerationResult.requestedCount  请求题量（count）
GenerationResult.producedCount   实际产出（= 交付题目数）
GenerationResult.status          SUCCESS | PARTIAL | FAILED
GenerationResult.orchestration   POL 账本（POL 路径）：
  requestedCount / plannedCount / generatedCount / finalCount
  budgetRecovered / coverageStatus / reason
  exhaustedTypes / exhaustedKps / capabilitySkips / difficultyContext
```

- 语义等价：`generatedCount` = 通过 Validator 的题目数（校验在 RetryLoop 内完成）→ 即 validated 口径。
- 缩水必须显式：产出 < 请求 → `status=PARTIAL` + `reason`（`PARTIAL_TYPE_COVERAGE` /
  `PARTIAL_CAPACITY` / `PARTIAL_GENERATION_SPACE` / `PARTIAL_DEDUP` / `PARTIAL_EXPLICIT_COMPOSITION`）。

### 12.4 Retry / Recovery / Capacity 语义

| 情况 | 机制 | 结果语义 |
|---|---|---|
| A 暂时生成失败 | RetryLoop 局部重试（保留有效题、只补失败位） | 成功/部分成功（retries 计数） |
| B 单 KP 空间耗尽 | POL Recovery（≤3 轮，按容量重分配已存在预算；无进展即终止） | `budgetRecovered` + `exhaustedKps` |
| C 全范围耗尽 | RetryLoop 返回 `GENERATION_SPACE_EXHAUSTED` + safeQ | Presentation 交付 PARTIAL（不整批归零）；无题才失败 |

- Generator 只报告「本生成器无法继续生成」，不重新决定整次练习分配（Capacity 归 POL）。

### 12.5 Phase 6 审计发现

| # | 发现 | 判定 | 处置 |
|---|---|---|---|
| F6-1 | Presentation `generateQuestions` 重新 `selectGenerator(plan)`（Strategy 的 `plan.generator` 无消费者） | 双重选择（frozen；确定性输入，Golden/E2E 未现分歧） | 登记受控例外（frozen 不可改；`plan.generator` 仅信息性） |
| F6-2 | `generation-engine.js` 内联 build/runPlans 回退（frozen） | GenerationAPI 存在时不触发 | 受控例外（既有登记） |
| F6-3 | UI 读 `GeneratorRegistry` 仅用于可练展示（非生成决策） | 合规 | 契约说明 |
| F6-4 | W7 重复规范化（api.js / generation-engine frozen） | 受控例外 | 维持现状 |

---

## 13. Scope Contract（题型 × 知识点，P10-2 冻结）

### 13.1 产品语义

```text
selectedTypes = 本次练习允许使用的题型集合（不是"每题型各 N 题"）
selectedKPs   = 本次练习生成范围（不是"每 KP 各 N 题"）
Type × KP     = POL 内部编排单元（cell）；用户不直接控制 cell 数量
```

### 13.2 责任层

| 判断 | 责任层 | 说明 |
|---|---|---|
| 题型/知识点选择表达 | UI | 只提交选择；不做静态表过滤 |
| 可生成范围（题型 × KP） | POL（knowledge-capability-view：ALLOW→DEGRADE→兜底） | UI 不再持有 TYPE_MODULES 静态过滤表 |
| 生成执行 | Strategy → Generator | 消费 cell，不重新解释范围 |
| 空选语义 | 未选题型 → POL `no-types` 回退；未选 KP + 年级 → POL 池展开 | 冻结 |

### 13.3 验收断言（`tests/orchestration/p10-2-scope-contract.test.js`，5 用例）

```text
① 1×1 / 多×1 / 1×多 / 多×多：cell.questionType ∈ selectedTypes；cell.kpId ∈ selectedKPs
② 真实生成 E2E：semanticQuestion.questionType ∈ selectedTypes；KP ∈ selectedKPs
③ Σ cells = Σ typeCounts = plannedTotal ≤ requestedCount
④ 非法组合：不崩溃、不伪造；守恒仍成立
⑤ 空选：no-types / 池展开语义稳定
```

### 13.4 P10-2 清理记录

- 移除 UI legacy 静态过滤：`kpVisibleInQT` + `TYPE_MODULES` 视图过滤（UI 只表达选择）。
- 修复可练判定键错配：`avail = !!pIdx[e.id]`（canonical 绑定；旧 `pluginId/grades` 判定随 legacy 轨道失效）。
- 删除死包装：`PracticeBridge.kpVisibleInType` / `allocateKpRatio`（零消费者）。
- P10-3 追加：旧 allocation 模块 `shared/strategy/question-type-allocation.js` 全项目零消费者 → 物理删除（bundle 59 模块 / Frozen Core 重锚 78 文件）。

## 14. Difficulty Contract（难度产品语义，P10-3 冻结）

### 14.1 产品语义

```text
difficulty = 用户要求的目标难度（唯一来源：UI 选择）
  不是：Generator 最终实际难度 / 预测难度 / 自适应修正值 / 题目结构复杂度
```

### 14.2 责任层

| 层 | 允许 | 禁止 |
|---|---|---|
| UI | 产生用户目标难度（1–10） | 计算/改写 |
| Practice Request | 原样保存 `difficulty` | 用默认值覆盖显式值 |
| POL | 读取 / 规范化（仅归一格式）/ 记录 / 传递 | 重新计算、重新选择、偷偷降级、替换用户值 |
| Difficulty Authority | 定义 / 计算（static → target → 合成） | 丢失用户目标 |
| Strategy | 消费既有结果 | 把用户目标与 `adaptiveDelta`/执行参数混成一个字段 |
| Generator | 按既有参数执行 | 重新解释用户目标难度 |

- `targetDifficulty` = 既有难度目标体系；`adaptiveDelta` = 既有自适应机制；`params` = Difficulty Authority 计算结果；三者与用户目标 `difficulty` 字段分离。
- 默认值仅当 `difficulty == null / undefined` 时生效；分层默认（UI 1 / normalize 6 / session·static·POL 3 / pool gradeMid）不强行统一。
- POL 不计算 `adaptiveDelta`；cell 执行必须携带 adaptive/learner 上下文（P10-3 修复，见 14.4）。

### 14.3 验收断言（`tests/orchestration/p10-3-difficulty-contract.test.js`，5 用例）

```text
① 用户难度 1/3/5/7/10：Request → POL ctx(requested/target/source=user) → Generation Plan 全链相等
② 多维组合：Type × KP × count(10/20/30/50) × difficulty 下用户值保持
③ 默认仅在 null 生效：显式 1 不被默认 3/6 覆盖；null/undefined → ctx.source=auto
④ cell 难度上下文：adaptive/adaptiveMode/adaptiveDelta/learnerProfile/allowDifficultyOverride/customParams/settings 随 cell 传递
⑤ 浏览器等价真实链路：difficulty 1/5/10 生成 SemanticQuestion 且 KP 归属正确
```

### 14.4 P10-3 清理记录

- **F-ADAPT-1 修复**：POL `cellReq` 白名单补全难度/生成语义字段（`subtype/cognitiveLevel/spiralLevel/max_spiral_level/customParams/settings/allowDifficultyOverride/adaptive/adaptiveMode/adaptiveDelta/learnerProfile`）；此前 adaptive 上下文在 POL cell 边界丢失。
- 旧 allocation 模块 `shared/strategy/question-type-allocation.js` 物理删除（零消费者；bundle 重建 59 模块；Frozen Core 授权重锚 78 文件）。
- 难度模块零消费者核验：`adaptive-strategy` / `difficulty-strategy` / `target-difficulty` / `difficulty-validator` / `difficulty-integrity-validator` 导出均为同文件内部使用或生产消费，无死代码。

## 15. Generation Cell Context Contract（P11-00 冻结）

### 15.1 投影规则（Request → PracticePlan → Cell Request）

```text
[生成上下文] cell 必须完整继承（会改变题目生成语义）：
  subject / grade / difficulty / selectLevel / style / expectedAnswerStyle
  subtype / cognitiveLevel / spiralLevel / max_spiral_level
  customParams / settings / allowDifficultyOverride
  adaptive / adaptiveMode / adaptiveDelta / learnerProfile

[规划上下文] cell 不得继承（只属于多 KP 合并/计划级语义）：
  combine / planLevel / 父级 typeCounts / perTypeCount / 父级 count

[选区收窄] cell 是编排单元：knowledgePointIds=[cell.kpId]、questionTypes=[cell.questionType]、
  count=cell.count；所有 cell 必须落在 selectedKPs × selectedTypes 内。
```

- 不变式：**Context Loss = 0**——任何会改变生成语义的请求字段，要么随 cell 传递，要么被显式排除；不存在静默丢弃。
- 契约落点：`shared/orchestration/practice-orchestrator.js` 头注释（Generation Cell Context Contract 节）+ cellReq 白名单。
- 禁止：新增 Context Service / Manager / Adapter；新增 Request 生成语义字段时同步更新白名单与本契约。

### 15.2 验收断言（`tests/orchestration/p11-00-generation-context.test.js`，4 用例）

```text
① Context Loss = 0：生成上下文逐字段完整继承到每个 cell
② 规划级字段不下沉：planLevel/perTypeCount 不进入 cell；cell 预算为自身单题型预算
③ 选区收窄：所有轮次（含 recovery）cell ∈ selectedTypes × selectedKPs
④ 真实执行链：cellReq 进入 Strategy 后用户难度保持（1/5/10）
```

## 16. P10 Input Orchestration Contract（输入编排冻结总表）

| 产品输入 | 最终责任 | 语义 |
|---|---|---|
| COUNT | POL 唯一分配 | 用户总预算；min-1 保底 + Round-Robin + 容量封顶 + Σ 守恒 |
| TYPE | 用户允许集 | selectedTypes = 允许使用的题型集合（非每题型 N 题） |
| KP | 用户生成范围 | selectedKPs = 生成范围（非每 KP N 题） |
| TYPE × KP | POL 内部 cell | 编排单元；用户不直接控制 cell 数量 |
| DIFFICULTY | POL 只统筹传递 | 用户目标难度；Difficulty Authority 定义/计算 |
| ADAPTIVE | 生成上下文 | cell 必须完整继承（§15） |
| GENERATION | Generator 唯一生产 | 消费 cell，不重新解释范围/难度 |

- 冻结链：`UI → Practice Request → POL → Generation Plan → Cell Request → Strategy → Generator`。
- 语义完整、单向、不可偷偷重解释；任何变更须同步 §14/§15/§16 与对应验收断言。

## 17. Coverage & Quota Contract（生成覆盖率 + 配额正确性，P11-01 冻结）

### 17.1 数量不变量

```text
requestedCount ≥ plannedCount ≥ generatedCount = finalCount
禁止：generated > planned / final > generated / planned > requested
正常：requested = planned = generated = final（SUCCESS）
容量/去重不足：requested = planned > generated = final（PARTIAL）
```

### 17.2 配额守恒

```text
Σ cell.count = Σ typeCounts = plannedCount（含 recovery 轮次）
count ≥ selectedTypes.length → 每个可行 selectedType ≥ 1（canonical 7 题型）
count < selectedTypes.length → TYPE_COVERAGE_INFEASIBLE，requestedCount/request.count 保持用户值（不改写）
Recovery：不突破 selectedKPs × selectedTypes，不突破 plannedCount / requestedCount，不增加用户总题量
```

- canonical 题型 = 7：`calc / fill / choice / judge / geometry / classify / apply`；`oral`（口算）等旧别名由 `request-normalize` 归一（不丢失、不新增题型）。第 7 类 `classify` 的载体与真实生成收口于 P17-10。
- 覆盖率契约按 **可行题型**（capability eligible）判定；不可行类型不分配（capability/绑定数据治理归 P11-05/P11-06）。

### 17.3 验收断言（`tests/orchestration/p11-01-coverage-quota.test.js`，9 用例）

```text
C1 单题型 20：requested = planned = generated = final（SUCCESS）
C2 6 题型 × 6：每题型 = 1，Σ = 6
C3 6 题型 × 20：Σ = 20，每题型 ≥ 1
C4 6 题型 × 50：Σ = 50，每题型 ≥ 1
C5 多 KP × 多 Type：Σ cell.count = Σ typeCounts = plannedCount；cell ⊆ 选区
C6 count < 题型数（6×5）：TYPE_COVERAGE_INFEASIBLE 且 count 不改写
C7 Capacity 限制：requested ≥ planned ≥ generated = final，status = PARTIAL
C8 Recovery：轮次有界、cell ⊆ 选区、不突破 plannedCount/requestedCount
C9 legacy 别名 oral → calc（不静默丢弃）
```

## 18. Duplicate Contract（重复题治理，P11-02 冻结）

### 18.1 产品语义（用户确认 A）

```text
同批 / Recovery：严格唯一（questionFingerprint v2 权威键）
重新生成（含刷新/同页再次生成）：尽量避开上一批；空间不足 → PARTIAL/FAILED，不复用旧题
重复 ≠ 容量：重复候选 → Retry/Recovery → 有界终止 → PARTIAL（不新增独立去重架构）
```

### 18.2 状态流（冻结）

```text
questionFingerprint v2（duplicate-validator.buildQuestionFingerprint 唯一实现）
  → cell 内：validation-pipeline seenKeys（事务化）+ RetryLoop（丢弃/补位）
  → POL：acc.seenKeys 跨 cell / Recovery 累积；初始集以 options.previousSeenKeys 播种（F-DUP-1 修复）
  → 跨代：PracticeSession.previousGeneration.fingerprints（Bridge session._seenKeys）
  → 跨刷新（同标签页）：Bridge sessionStorage 最小记忆（FIFO ≤800，异常静默）
```

- `canonicalKey` 仅诊断；`mathFingerprint` 仅同一练习内跨 KP 同数学判重（同 KP 不判）——均非第二身份算法。

### 18.3 验收断言（`tests/orchestration/p11-02-duplicate-contract.test.js`，10 用例）

```text
D1 批内唯一；D2 多 KP 唯一；D3 多 Type 唯一；D4 别名链无重复 cell/题
D5 重复候选丢弃 + 新题补位仍满足预算；D6/D7 Recovery 跨轮/多轮 Union 唯一且有界
D8 候选耗尽 → PARTIAL/FAILED 不死循环、零复用
D9 重新生成避开上一批（大空间 overlap=0；小空间零复用）
D10 finalCount = unique(finalQuestions).length 且满足 §17 数量不变量
```

## 19. Capacity / Recovery / Partial Contract（P11-03 冻结）

### 19.1 语义

```text
Capacity   = 当前 KP × Type × Difficulty 约束下「还有多少可生成空间」
             不是 requestedCount / plannedCount / retry 次数
RetryLoop  = 单 Cell 内部尝试（POL 不重试同一 cell）
POL Recovery = Cell / Range 层面重新安排（≤ 3 轮；每轮 progress = 新增唯一题 > 0，否则立即停止）
状态：SUCCESS（final = requested）/ PARTIAL（0 < final < requested）/ FAILED（final = 0）
```

- Recovery 不改变 count / selectedTypes / selectedKPs / difficulty；不突破 plannedCount / requestedCount；
  在 typeCaps headroom 内分配缺口（`allocateRecovery`），Cell ⊆ selectedKPs × selectedTypes。
- **重复 ≠ Capacity**：重复候选 → Retry → Recovery → 有界终止；**Capacity ≠ Failure**：有题 → SUCCESS/PARTIAL，零题 → FAILED。
- 全范围耗尽不偷换 KP/Type、不改 Difficulty、不扩 count、不绕 Validator。

### 19.2 Scope 守卫（P11-03 新增，冻结）

```text
生成结果 questionType ∉ selectedTypes → POL 聚合层丢弃（outOfScopeDropped 记账）
缺口如实走 Recovery/PARTIAL；不把越界题交付用户（不偷换 Type）
```

- 背景（F-TYPE-1）：冻结 Strategy 在「capability 声称可行但无实际 generator 绑定」的 KP×Type 上会退化产出
  越界题型（实测 fill cell → geometry / calc cell → choice）。数据治理归 P11-05/P11-06；POL 守卫保证产品承诺。

### 19.3 验收断言（`tests/orchestration/p11-03-capacity-recovery.test.js`，10 用例）

```text
R1 正常容量 20/20 SUCCESS；R2 单 Cell 容量不足 → 8/20 PARTIAL（规划封顶 unit + 实际短产）
R3 Retry 边界（POL 不重试同一 cell）；R4 Recovery 有效（+5）；R5 无进展立即停止
R6 Recovery ≤ 3；R7 多 Cell 转移（A 耗尽 B 承接）；R8 全范围耗尽 → FAILED
R9 部分可交付 → PARTIAL；R10 真实 API E2E（状态/数量/归属一致）
```

### 19.4 P11-03 审计发现（数据治理，已登记）

- **F-CAP-1**：`capacity-map.json`（派生缓存）仍以 legacy KP id 为键（canonical 命中 0/112）→ POL 规划层
  容量封顶当前实际惰性（typeCaps 缺失 → 不受限）；生成空间由 Generator/Retry/Recovery 兜底。归 P11-05/P11-06。
- **F-TYPE-1**：见 19.2；归 P11-07（Generator 语义质量）做绑定数据一致性治理。
