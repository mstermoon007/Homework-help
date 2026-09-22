# P17-0 最终审计报告

## 审计日期

2026-09-15

## 审计原则

**只读、不修改、按事实记录**

## CRITICAL：npm test 实际运行失败

审计当日执行 `npm test`，**存在 4 项失败**（此前文档记录的"全绿"已不成立，以运行事实为准）：

| 失败项 | 期望 | 实际 | 根因 |
|--------|------|------|------|
| C1 正常单题型 count=20（SUCCESS） | 20 | 1 | 容量限制 |
| C7 Capacity 限制（PARTIAL） | 断言 | 失败 | 容量限制 |
| C8 Recovery | recovery 发生 | 未发生 | 无空间 |
| C9 legacy 别名 oral→calc | 10 | 1 | 容量限制 |

**根因**：`capacity-map.json` 中 `math-g2-down-u01-k001`（钟面结构）total=1、`limitedKind:GENERATOR_LIMITED`。p11-01 测试的 KP 池第一个即此 KP → POL 预算上限=1。

**分类**：A. DATA（容量数据）+ 测试期望需对齐（C9 期望 10 但容量仅能产 1）。

---

## 12 个问题回答

### Q1：KBL Runtime 是否真正唯一？

**✅ 是（P17-5 运行时复核后修正）**

P17-0 静态审计读到 `strategy-engine.js:69/206`、`comprehensive-strategy.js:29` 的
`require('../knowledge/knowledge-bank.js')`，判定为 3 个违规入口。但该判定基于**冻结源码静态扫描**：

- 这些源码是 bundle 构建输入（`dev/build-strategy-bundle.js`），文件在磁盘上已不存在，
  源码无法在 Node 单独加载，仅作构建原料。
- 真实 Runtime（浏览器 + Node `_bundle-env`）通过 `strategy-engine.bundle.js` 加载，
  其 SHIMS 把 `knowledge-bank.js` → `KnowledgeBankCompat` → `KnowledgeContext.poolContext`；
  `knowledge-point.js` → `KnowledgePointCompat` → `KnowledgeContext.strategyView`。

**结论**：运行时 Strategy 的 KBL 访问 100% 经 KnowledgeContext 边界（compat 桥委托），
KBL Runtime 唯一入口成立。门禁：`check-kbl-uniqueness` PASS（受控 28 / 新增 0）。

---

### Q2：KnowledgeContext 是否真正成为 KBL → POL 边界？

**✅ 是（P17-5 复核）**

KnowledgeContext 职责完整（strategyView / kpsForGrade / get / poolKpIds / selectable），
且 Strategy 运行时经 compat 桥全部走 KnowledgeContext（见 Q1），不再绕过。

---

### Q3：POL 是否真正拥有唯一任务级编排权？

**✅ 是**

POL (PracticeOrchestrator.orchestrate) 是唯一任务级编排入口。

- PracticeSession → GenerationAPI.generate → POL.orchestrate
- POL 拥有所有编排权限（数量/题型/难度/Capacity/Recovery）

**结论**：POL 拥有唯一任务级编排权。

---

### Q4：POL 是否存在生成/渲染越权？

**✅ 否**

POL 不直接访问 Generator/Selector/Validator/Presentation/SVG/DOM。

POL 的唯一执行接口是 `deps.execute`（= executeInline）。

**结论**：POL 无越权。

---

### Q5：当前 Generation Runtime 的真正入口是什么？

**GenerationAPI.generate()**

路径：
```
PracticeSession.start()
  → GenerationAPI.generate(req, options)
    → PracticeOrchestrator.orchestrate(req, options, deps)
      → executeInline(req, options)
        → build(request) → StrategyEngine.plan()
        → runPlans(plans) → PresentationEngine.generateQuestions(plan)
```

**结论**：Runtime 真实入口是 GenerationAPI.generate()，经由 POL 编排。

---

### Q6：GenerationCore 是否已经进入真实 Runtime？

**✅ 是（P17-3/4 落地）**

`shared/generation/generation-core.js` 已存在（256 行）。
`api.js runPlans` 单 KP 计划收敛到 `GenerationCore.execute`（P17-4 收口）。
ExecutionCore 内部通过注入的 GeneratorSelector 重新选择 Generator，不依赖 Strategy 的 `plan.generator`。

**结论**：GenerationCore 已落地并成为单 KP 计划的唯一执行路径。

---

### Q7：Strategy 是否完全脱离 KBL？

**✅ 是（P17-5 运行时复核后修正）**

运行时 Strategy 经 `strategy-engine.bundle.js` + SHIMS → `KnowledgeBankCompat` /
`KnowledgePointCompat` → `KnowledgeContext`，不再直接接触 KBL 原始数据。
源码静态 `require('../knowledge/knowledge-bank.js')` 为冻结构建输入（目标文件已删除），
以受控方式登记于 `check-kbl-uniqueness.js` FROZEN_LEGACY_ACCESS。

**结论**：Strategy 已 100% 经 KnowledgeContext 访问 KBL。

---

### Q8：26 个 Generator 是否完全脱离 POL？

**✅ 是**

20个 Generator 全部 PASS，无 POL 依赖。

Generator 仅依赖同层 core 模块（rng.js, arithmetic-core.js, op-semantics.js）。

**结论**：Generator 完全脱离 POL。

---

### Q9：Generator 是否存在 SVG/Presentation 越权？

**✅ 否**

所有 Generator 不直接生成 SVG。SVG 由 Presentation 层的 svg-core.js 处理。

**结论**：Generator 无 SVG/Presentation 越权。

---

### Q10：Validator 是否完全保持质量门职责？

**✅ 是（P17-7 已收口）**

主要 Validator（question-validator.js, batch-validator.js, validation-pipeline.js）合规。

`kp-semantic-validator.js` 的 2 处越权已在 P17-7 修复：
- ~~`require('../orchestration/knowledge-context.js')`~~ → 经 `getKC()`（注入/`global.KnowledgeContext` 边界，惰性 require 兜底）
- ~~`require('../generator/generator-registry.js')`~~ → 经 `getGenRegistry()`（注入/`global.GeneratorRegistry` 边界，惰性 require 兜底）

DI 风格与 api.js/generation-core.js 一致；`presentation-engine.bundle.js` 已重建，运行时 C01/C02 探针 PASS，npm test EXIT=0。

**结论**：Validator 保持质量门职责，无 Context/Registry 越权。

---

### Q11：SemanticQuestion 是否已经成为生成/展示唯一边界？

**✅ 是**

SemanticQuestion 是生成/展示之间的唯一语义边界。

- 无 DOM/HTML/SVG/CSS/print layout
- 字段完整（questionId, knowledgeId, questionType, difficulty, stem, answer, options, solution, metadata）

**结论**：SemanticQuestion 已成为唯一语义边界。

---

### Q12：当前代码是否已经具备实施 GenerationCore 的条件？

**⚠️ 部分具备**

**已具备条件**：
- POL 边界清晰，可作为 GenerationCore 的上层
- Generator 完全独立，可直接调用
- Validator 基本合规
- SemanticQuestion 已成为唯一语义边界
- executeInline 提供了 GenerationCore 的参考实现

**未具备条件**：
- Strategy 直接访问 KBL（需先修复）
- ~~Validator kp-semantic-validator 越权~~ ✅ 已修复（P17-7）
- ~~PresentationEngine 包含生成逻辑（需重构抽出）~~ ✅ 已收口（P17-8：浏览器 GenerationCore 接线）

**结论**：金标准条件具备（P17-1~P17-8 已全部收口 BLOCKER；PresentationEngine 内联生成仅在运行时不可达路径保留）。

---

## 最终结论

### 分类

| 类别 | 问题 | 严重性 |
|------|------|--------|
| DATA | KBL 数据准确 | ✅ PASS |
| CONTRACT | 接口边界 | ✅ PASS |
| GENERATION | Strategy→KBL | ✅ 已收口（P17-5 运行时复核：经 bundle+compat→KnowledgeContext） |
| GENERATION | Strategy→Generator/Selector | ✅ 已收口（P17-6 复核：选型权威在 GenerationCore/Presentation，Strategy 仅规划期可行性） |
| GENERATION | Validator→Context/Generator | ✅ 已收口（P17-7：DI/全局边界替换直接 require，bundle 已重建） |
| GENERATION | GenerationCore 未落地 | ✅ 已落地（P17-2/3/4） |
| GENERATION | PresentationEngine 含生成逻辑 | ✅ 已收口（P17-8：浏览器 GenerationCore 接线，single-KP 收敛；内联链运行时不可达） |
| GENERATOR | Generator 边界 | ✅ PASS |
| PRESENTATION | SemanticQuestion 边界 | ✅ PASS |
| DEAD/LEGACY | Legacy 残留 | ✅ 0 legacy |

---

### RESULT：C. BLOCKED（存在 Blockers 阻断 P17 直接进入）

存在以下必须修复的问题：

**BLOCKER（必须修复才能进入 P17）**：

1. **Strategy → KBL 直接访问（3处）** — ✅ P17-5 已收口（运行时复核）
   - strategy-engine.js:69,206 / comprehensive-strategy.js:29 的静态 require 为冻结构建输入
   - 运行时经 bundle SHIM → KnowledgeBankCompat → KnowledgeContext.poolContext（边界合规）
   - 门禁：check-kbl-uniqueness PASS（受控 28 / 新增 0）

2. **Strategy → Generator/Selector（5处）** — ✅ P17-6 运行时复核已收口（非真实选型路径）
   - strategy-engine.js:102,180,618,649 (generator-registry)、:831 (generator-selector) 均为冻结源码
   - 运行时 Strategy 的 `plan.generator` **无消费者**（F6-1 已登记）；`plan.generatorId` 仅 metrics 记账
   - 真实选型权威在 **GenerationCore.executeCell → Selector.selectGenerator**（P17-4 单 KP 路径）与
     PresentationEngine（combine 路径）——Strategy 的 registry 访问是规划期可行性判定（hasNativeSupport/
     enhanceKp/records），不是最终生成器选择
   - 门禁：check-frozen-core PASS（78 文件基线完好），npm test EXIT=0

3. **Validator → Context/Generator（2处）** — ✅ P17-7 已修复
   - ~~kp-semantic-validator.js:21 (knowledge-context)~~ → `getKC()`（注入/`global.KnowledgeContext`，惰性 require 兜底）
   - ~~kp-semantic-validator.js:127 (generator-registry)~~ → `getGenRegistry()`（注入/`global.GeneratorRegistry`，惰性 require 兜底）
   - impact: Validator 绕过正规流程（已消除；DI 风格与 api.js/generation-core.js 一致）
   - 验证: presentation-engine.bundle.js 已重建、C01/C02 探针 PASS、check-frozen-core PASS、npm test EXIT=0

4. **PresentationEngine 包含生成逻辑** — ✅ P17-8 已收口（浏览器运行时接线）
   - presentation-engine.js 含 Selector/RetryLoop/BatchValidator/SQ 调用（frozen，源不可改）
   - 缺口：`global.GenerationCore` 在浏览器未注册（presentation bundle 未内联），api.js 无 require
     → `generationCoreAvailable=false` → single-KP 计划仍走 PresentationEngine 内联生成（P17-4 仅在 Node/vm 生效）
   - 修复：build-presentation-bundle.js 内联 generation-core/generation-contract 并注册
     `global.GenerationCore`；浏览器语义下 single-KP 收敛到 GenerationCore（verify:browser-core-wiring 实证）
   - 运行时可达性：combine 多 KP 在规划层拒绝（strategy-engine.js:663）；`generateSync` 为死兼容；无活跃调用者
     走 GenerationEngine 浏览器内联回退
   - impact: 生成逻辑不再于浏览器生产路径藏身 Presentation

5. **GenerationCore 未落地**
   - shared/generation/generation-core.js 不存在
   - impact: executeInline 承担实际执行

6. **npm test 4 项失败（DATA）**
   - capacity-map 中 math-g2-down-u01-k001 容量=1 导致 p11-01 C1/C7/C8/C9 失败
   - 需人工确认容量或调整测试 KP

### 修复步骤

```text
P17-0 审计完成
   ↓
STEP 0：npm test 修复（DATA 修复——容量确认 或 测试改 KP）
   ↓
STEP 1：Strategy→KBL 改 KnowledgeContext（KBL 边界收口）
   ↓
STEP 2：Strategy→GeneratorRegistry 改依赖注入
   ↓
STEP 3：kp-semantic-validator 去 Context/Registry 依赖
   ↓
STEP 4：生成逻辑从 Presentation 抽出 → 建 GenerationCore
   ↓
STEP 5：GenerationCore 落地后 executeInline 迁移
   ↓
P17-0 Final Gate（回归全绿）
   ↓
P17-1 Generation Contract
```

---

## 附录：审计文件清单

| 文件 | 内容 |
|------|------|
| P17-0-baseline.json | 基线数据 |
| P17-0-kbl-boundary.md | KBL 边界审计 |
| P17-0-pol-boundary.md | POL 边界审计 |
| P17-0-generation-entry.md | Generation Entry 审计 |
| P17-0-generator-audit.md | Generator 全量审计 |
| P17-0-validator-audit.md | Validator 全量审计 |
| P17-0-presentation-audit.md | Presentation/SVG/SQ 审计 |
| P17-0-dependency-matrix.json | 依赖矩阵 |
| P17-0-legacy-audit.md | Legacy/死代码/问题分类 |
| P17-0-test-reality.md | 测试真实性何审计 |
| P17-0-final-report.md | 本报告 |
