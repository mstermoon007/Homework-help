# P0-01 · 审计现有生成链（POL 冻结前基线）

> 范围：仅审计，不改代码。本报告是 P0-02（KD 冻结）之前的事实基线。
> 审计对象：`GenerationAPI (api.js) → POL (practice-orchestrator) → strategy-engine → generator-registry/selector → generator → validator → semantic/validator → presentation`。
> 方法：先读运行时代码，再对照四层契约（KBL 只提供事实 / POL 只编排 / GVS 只执行策略与生成 / SVS 只提供服务）。审计结论以「证据 + 文件:行号」落底。

---

## 一、结论速览

| # | 现状事实 | 分层归属 | 判定 |
|---|---------|---------|------|
| A1 | `practice.html` 经 `officialize → GenerationAPI` 收敛为**唯一入口** | SVS | ✅ 符合 |
| A2 | 入口把请求委托给 **POL `.orchestrate`**（不再自行选 Generator / 决定难度） | SVS→POL | ✅ 符合 |
| A3 | POL 负责范围/KP×QT/KP×QT×数量/预算/难度参数/恢复——**不实现任何 Generator** | POL | ✅ 符合 |
| A4 | POL 有**内联 build/runPlans 回退副本**（pol 不可用时的冗余实现） | POL→GVS 跨界 | ⚠️ 重复 |
| A5 | 难度归一/预测在 POL 侧（`difficulty-orchestrator`），只给参数不动公式 | POL | ✅ 符合（唯一难度 Authority 在 GVS 侧难度策略） |
| A6 | 题型分布由 POL 预算分配器决定（`BudgetAllocation`），非 Generator 自行决定 | POL | ✅ 符合 |
| A7 | Generator 由 `generator-registry` + `generator-selector` 按「策略×题型×KP 可行性」选择 | GVS | ✅ 符合 |
| A8 | 策略由 `strategy-engine` 决定，POL 只注入难度参数（不反向 require 上层） | GVS | ✅ 符合 |
| A9 | 未见「第二套 Strategy / Difficulty / Generator」注册体在运行时代码中被调用（registry 是唯一集合） | GVS | ✅ 符合 |

**总体判定**：V5.0.0 已基本实现「POL 编排 → GVS 生成 → SVS 服务」三层链，KBL 作为事实源由 `practice-orchestrator.resolvePoolKps` / `KnowledgeContext` 供给。剩下的是**重复实现边界**问题（A4），不是架构错位问题。

---

## 二、逐问审计（对应 POL 契约问题的六问）

### Q1：KP 数据从哪里进入生成链？
```
practice.html → GenerationAPI.generate(req) → POL.orchestrate(req) → plan()
                                        → resolvePoolKps(req) → KnowledgeContext.strategyView(kpId)
```
- 证据：`shared/generation/api.js`（入口收敛点）；`shared/orchestration/practice-orchestrator.js` `resolvePoolKps`(72-89)、`plan()`(430+)。
- 分层判定：✅ **KBL 是唯一事实源**；POL 通过 `KnowledgeContext` 读取，不二次计算。

### Q2：当前题型从哪里进入生成链？
```
req.questionTypes / req.typeCounts → POL.plan() → feasibleTypes → BudgetAllocation 分配 typeCounts
```
- 证据：`practice-orchestrator.js` `explicitTypeCountsEntries` / `explicitTypeCounts`(258-326) + `BudgetAllocation.allocateTypeBudgets`。
- 分层判定：✅ 题型选择与数量分配全部在 **POL 层**，Generator 侧只读 `questionType` 字段。

### Q3：当前难度从哪里进入生成链？
```
req.difficulty → DifficultyOrchestrator.normalizeDifficultyInput() → predictDifficulty → 只作容量/账本对齐
```
- 证据：`practice-orchestrator.js` `DifficultyOrchestrator` 注入(L234-248)、`predictDifficulty`(168-196)。
- 分层判定：✅ **POL 只做参数整理**（normalize/预测/传递），不实现难度公式；难度真实计算仍在 GVS 难度策略。符合「统筹，不计算」。

### Q4：当前 Generator 由谁选择？
```
strategy-engine 产出 Final Strategy → generator-registry（BY_STRATEGY × BY_QUESTION_TYPE 索引）→ generator-selector 按候选过滤
```
- 证据：`shared/strategy/strategy-engine.js`、`shared/generator/generator-registry.js`、`shared/generator/generator-selector.js` `selectGenerator(plan, options)`(199)。
- 分层判定：✅ 选择权在 **GVS**，POL 不选 Generator。

### Q5：当前 Strategy 由谁决定？
- 证据：`shared/strategy/strategy-engine.js`（`resolvePartnerSelectors` / `strategySelector` 收敛点，统计分析文件 header 注释 1-30）。
- 分层判定：✅ **GVS 内 strategy 域**统一决策；POL 仅注入难度参数，从不 require 上层。

### Q6(a)：是否存在重复题型判断？
- 观察：题型「可行性/filter」判断只在 `practice-orchestrator`（POL）一处；`generator-selector` 只做「候选 Generator ∩ 策略支持」过滤，不做第二次可行性判定。
- 判定：✅ 未发现重复题型判断入口。

### Q6(b)：是否存在 Generator 自行决策？
- 观察：`generator-selector.js` 头注释「Generator 只负责实际怎么生成」；POL 已把 count/type/difficulty 全部定好再入 cell。未发现 Generator 内自行 re-budget。
- 判定：✅ 无越权（如需复核可对 generator/* 做一次 keyword 扫描，见 §五 遗留项）。

### Q7：是否存在 POL 生成题目？
- 观察：POL 是纯编排（plan + runCells → executeInline 委托），无内联题库逻辑。
- 判定：✅ 无 POL 生成。**唯一跨界点**是 §三 A4 的「内联回退副本」。

---

## 三、唯一需要处理的重复实现边界（P0-02 输入）

**A4：POL 内联 build/runPlans 回退副本**
- `practice-orchestrator.js` 在 POL 编排路径内维护一份 `buildPlans` / `runPlans` 副本（当指定依赖不可用时回退），与 `shared/generation/api.js` 的真实生成入口存在**重复实现**。
- 风险：两副本若漂移 → 同级请求走不同计划 → 违反「唯一收敛点」。
- 处理原则（符合冻结纪律）：**不新增**；若副本仅为「POL 不可用时的兜底」且实际从不触发（api.js 常驻），应标记为 Frozen + 单一权威入口流转，而非再写第三份。

---

## 四、链路完整性确认

已确认图层边界可独立验证（本仓库已有成熟门禁，见 `docs/pol-kbl-stable-baseline.md` / `docs/P16-FOLLOWUP-D2-contract.md`）：
- KBL 事实 → POL 编排 → GVS 生成 → SVS 服务：链上每层只读上一层产物，方向单一。
- `GenerationAPI` 为浏览器（`practice.html`）与 Node（`dev/` / `tests/`）的**同一收敛点**（`shared/generation/api.js`）。

---

## 五、遗留观察项（不阻塞，仅记录，进入 P0-02 决策）
1. `generator/*` 内是否仍有任何 generator 自行读难度/题型预算（应以 POL 传入字段为准）——建议 P0-02 加一条「generator 无自主决策」门禁探针。
2. `resolvePoolKps` 目前被编排层调用（POL），但若 POL 后续改为「只看选区、不解析池」，需确认无第二解析点（当前唯一）。
3. `shared/` 下是否存在 Frozen 侧已被替代但尚未删除的旧入口（如 `generation/resources/api.js` 冷却枚举）——拦截于新链验证通过后按纪律删除。

---

*P0-01 审计完成，此为 P0-02 修改的前置基线。*
