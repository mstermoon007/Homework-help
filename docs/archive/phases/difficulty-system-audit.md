# DIFFICULTY-SYSTEM-AUDIT.md — M0 冻结资产与现状审计

> 执行人：opencode  |  日期：2026-09-12  
> 对应计划：「难度系统整理、统一、收口和编排接线」M0–M20  
> 状态：**KBL 收口 M0–M19 ✅；难度侧：D1 公式修复 ✅、D2 断链 ✅ RESOLVED、M16 测试矩阵 ✅ 重建（Phase 8，2026-09-13）；M5–M14/M17–M20 待难度计划执行**

---

## 一、难度权威边界（M1 确认）

| 层级 | 文件 | 权限 |
|---|---|---|
| **Difficulty Core** | `shared/catalog/difficulty.js` | 定义 1–10 难度 → 结构分档（TIERS）、scale、paramsFor、strategyFor、consume |
| **Difficulty Static** | `shared/catalog/difficulty-static.js` | 8 维静态多维公式，KP → level，唯一计算处 |
| **Strategy Static adapter** | `shared/strategy/static-difficulty.js` | 将 canonical KP → legacy 元数据形状，桥接 DifficultyStatic |
| **Strategy Target** | `shared/strategy/target-difficulty.js` | 用户难度 override 判定 + adaptive delta 叠加 + composed 合成 |
| **Strategy Difficulty (effective/composed)** | `shared/strategy/difficulty-strategy.js` | applyEffective / resolveComposedDifficulty（mode+问题+复合复杂度） |
| **Adaptive Strategy** | `shared/strategy/adaptive-strategy.js` | Learner adjustment → effective difficulty（mastery/confidence/streak） |
| **Strategy Engine (wiring)** | `shared/strategy/strategy-engine.js` | 串联：static → target → adaptive → composed → structure/constraints |
| **Orchestration (budget only)** | `shared/orchestration/practice-orchestrator.js` | 用 difficulty 查询容量桶，**绝不重写** genReq.difficulty |
| **Presentation (plugin consume)** | `shared/presentation/render.js` | 通过 `DifficultyStatic.paramsForKnowledgePoint` 或 `Difficulty.paramsFor` 获取插件参数 |
| **UI** | `practice.html` | URL 参数 `difficulty`（1–10，默认 1） |
| **Normalize** | `shared/request/request-normalize.js` | easy→4 / normal→6 / hard→9；缺省 6 |

**硬约束（M0 冻结，M18 不可变）：**
- 编排层不得出现 `1 + 9 * ...`，不得复制权重/公式
- `DifficultyStatic.paramsFor` / `DELTA_RULES` / 权重/难度档位公式只存在于 `shared/catalog/difficulty*.js`
- `allowDifficultyOverride` 语义保持（target-difficulty.js:58–74）
- Mode（Quick/Teacher/Competition）不得新建难度定义
- Structure 消费必须走 `Difficulty.paramsFor('math', finalLevel)`（structure-constraints.js:69）
- 所有生成请求只有一个 DifficultyContext（M4 输出）

---

## 二、冻结资产清单（Difficulty 消费路径）

### 2.1 核心公式入口

| 入口 | 文件:行 | 职责 |
|---|---|---|
| `Difficulty.createProfile(base, delta, opts)` | difficulty.js:86–98 | `clamp10(base + delta)` → {effectiveLevel, scale, structure, typePreference} |
| `Difficulty.paramsFor(subject, level, delta)` | difficulty.js:221–225 | 科目 + 难度 → {level, scale, steps, allowBracket, allowMultDiv} |
| `Difficulty.consume(options)` | difficulty.js:157–166 | 插件统一消费入口；`hasOwnLevel` 时跳过通用难度 |
| `DifficultyStatic.paramsForKnowledgePoint(kpMeta, qt, custom)` | difficulty-static.js:123–165 | 8 维公式 → {difficulty, level, scale, ...staticMeta} |
| `applyEffective(base, adaptiveDelta)` | difficulty-strategy.js:34–45 | `clamp(base + delta, 1, 10)` |
| `resolveComposedDifficulty(options)` | difficulty-strategy.js:150–198 | `base + modeAdj + qAdj + cAdj` → composedDifficulty |

### 2.2 Strategy 调用链（strategy-engine.js:690–907）

```
request.difficulty
    ↓
StaticDifficulty.resolveStaticDifficulty(kp, qt)          → staticProfile.level
    ↓
TargetDifficulty.resolveTargetDifficulty({
    difficulty: request.difficulty,
    adaptive: request.adaptive,
    adaptiveDelta: request.adaptiveDelta,
    allowDifficultyOverride: request.allowDifficultyOverride,
    mode
})                                                        → {effectiveDifficulty, composedDifficulty, adaptiveDelta}
    ↓
AdaptiveStrategy.resolve({learnerProfile, staticProfile}) → effectiveDifficulty（若 adaptive=true）
    ↓
StructureConstraints.resolveStructureConstraints({finalDifficulty})
    → Difficulty.paramsFor('math', finalLevel)            → {maxSteps, allowBracket, allowMultDiv, numberRange}
    ↓
ComplexityStrategy.resolveComplexity({difficulty: finalDifficulty, spiralLevel})
    → {tier: simple|standard|complex, rangeBoost, multiStep, mixLevel}
    ↓
QuestionPlan.difficulty = finalDifficulty
QuestionPlan.adaptiveDelta = difficulty.adaptiveDelta      （仅 adaptive=true）
QuestionPlan.targetDifficulty = difficulty.targetDifficulty （仅 adaptive=true）
```

### 2.3 Orchestration（practice-orchestrator.js:206–340）— 统筹不计算

```
req.difficulty → userDifficulty（用于容量桶查询）
    ↓
capacityByType(kpIds, capMap, difficulty)                → 按难度分桶（1-3/4-6/7-10）查容量
    ↓
BudgetAllocation.allocateTypeBudgets({typeCaps})         → 题型预算（纯数量，不触碰难度值）
    ↓
genReq = Object.assign({}, req)                          → 原样传递 difficulty，不重写
```

### 2.4 Presentation / 插件消费

```
render.js: createPlugin wrapper (line 246–278)
    if (opts.difficultyParams == null) {
        if (opts.knowledgePointMeta && DifficultyStatic.paramsForKnowledgePoint) {
            opts.difficultyParams = DifficultyStatic.paramsForKnowledgePoint(meta, qt, custom);
        } else if (Difficulty.paramsFor) {
            opts.difficultyParams = Difficulty.paramsFor(subject, level);
        }
    }
    → plugin.generate(opts)  // opts.difficultyParams 最终注入
```

### 2.5 UI 入口

| 入口 | 位置 | 默认值 |
|---|---|---|
| `practice.html` URL `?difficulty=N` | practice.html:375–381 | 默认 1 |
| `RequestNormalize.createPracticeRequest` | request-normalize.js:115 | `normalizeDifficulty(opts.difficulty)` → 缺省 6 |
| `practice.html` localStorage 回填 | practice.html:1521 | 无 `?difficulty` 时读 `ls.difficulty` |

---

## 三、缺陷与观察（⚠️）

### D1 — 9/10 问题（M15 核心修复项）

**位置：** `shared/catalog/difficulty-static.js:151`

```js
var wsum = 0.12*G + 0.15*S + 0.12*C + 0.08*T + 0.12*St + 0.08*N + 0.12*A + 0.15*Comb;
var D = 1 + 9 * wsum;
var level = clamp10(Math.round(D));
```

**问题：** 权重和 = 0.12+0.15+0.12+0.08+0.12+0.08+0.12+0.15 = **0.94**

公式 `D = 1 + 9 × wsum` 的理论最大值 = 1 + 9 × 0.94 = **9.46 → rounds to 9**

→ **静态多维公式永远无法产出 level=10**

**修复方案（M15，用户已批准）：** 将公式改为归一化形式：

```js
var WSUM_MAX = 0.94; // 0.12+0.15+0.12+0.08+0.12+0.08+0.12+0.15
var D = 1 + 9 * (wsum / WSUM_MAX);
```

- 归一化保持相对权重不变（所有 KP 之间的相对顺序严格保持）
- 全档 KP（所有维度满值）→ D = 10，结构 tier 5（steps=5, nested, altOps）可达
- 中低档 KP：D 值上移约 0.57×wsum（最大 +0.54），少量边界 KP 可能 bump +1 级
- **回归标准：** 新旧分布对比；若整体上移超过预期阈值则暂停

**✅ 已落地（2026-09-13，KBL M8 / 难度 M15 前置）：** `shared/catalog/difficulty-static.js:151` 按上述归一化修复；合成回归（3^8 栅格 + 20.6 万随机点 + 20 万序对数）通过：全档 → level 10（修复前 9）；最大单级跳 +1、无 ≥2 级跳；均值 |Δlevel| 0.279 ≤ 0.5；相对顺序严格保序；纵坐标 level 9 → level 10 部分迁移。frozen-core 重锚（授权 Bug Fix）。D2 断链（3 个 dev 脚本依赖已删知识层）仍按计划待 M16 数据层重建。

### D2 — Node 侧 strategy/knowledge 断链（KBL 遗留）

- `shared/strategy/strategy-resolver.js:9` requires 已删除的旧知识点入口模块（`shared/knowledge` 下，post-KBL 收口时移除）
- 旧知识库入口模块（`shared/knowledge` 下，post-KBL 收口时移除）已删除，3 个 dev 脚本仍引用：
  - `dev/test-difficulty.js`
  - `dev/test-difficulty-static.js`
  - `dev/check-difficulty-anchor.js`
- `npm test` 执行这些脚本 → **目前会抛 MODULE_NOT_FOUND**
- `npm run verify:difficulty-anchor`（→ `check-difficulty-anchor.js`）同样失败
- 浏览器不受影响（bundle 嵌入旧知识层）
- **影响范围：** M16 测试矩阵重建必须基于新 KBL 数据层（`shared/knowledge/data/math/`），不能沿用已删 bank

### D3 — Normalize 默认值 vs UI 默认值不对齐

- `request-normalize.js:50` `normalizeDifficulty(d)` 缺省返回 **6**
- `practice.html:376` URL `difficulty` 缺省为 **1**
- 两个路径独立：normalize 用于 page→request 构造；practice.html 从 URL 独立读取
- 不是 bug（两者语义不同），但记录不对齐供后续 UI 统一参考

### D4 — Static 在 practice.html 路径休眠

- `practice.html:275` 加载 `difficulty-static.js`（`<script>`）
- `render.js:262` 仅当 `opts.knowledgePointMeta` 非空时调用 `DifficultyStatic.paramsForKnowledgePoint`
- practice.html 不传 `knowledgePointMeta` → Static 休眠，Legacy 默认（`Difficulty.paramsFor`）
- **设计预期：** M1–M7 后编排层成为唯一 difficulty 消费者，render 被绕过

### D5 — compositeComplexityOf 直连 generator 语义

- `difficulty-strategy.js:112` require `../generator/core/kp-complex-semantics.js`
- 策略层直连 generator 语义模块（非 Frozen Core 违规，但属跨层依赖）
- **M13 要求：** composition 保留在 strategy 内，不得泄漏进 orchestration

---

## 四、M1–M20 任务映射（冻结资产 → 实施文件）

### M0 — 本审计文档（已完成 ✅）

交付物：`docs/difficulty-system-audit.md`（本文件）

---

### M1 — 权威边界确认（本审计第一节，已完成 ✅）

- Difficulty Core = `shared/catalog/difficulty.js`
- Static Core = `shared/catalog/difficulty-static.js`
- Strategy 负责 base + 题型/复杂度/mode/adaptive 修正
- 编排层只做参数整理、分配、传递，不计算难度

---

### M2 — Request 难度参数扩展（已完成 ✅）

**目标：** 编排层 PracticeRequest 增加 `difficulty:{requested,min,max,tolerance,source}` 字段

**已完成改动：**

| 文件 | 改动 |
|---|---|
| `shared/orchestration/practice-orchestrator.js` | `plan()` 难度读取改经 `DifficultyOrchestrator.normalizeDifficultyInput`（number/object/scope.difficulty 均归一）；输出 `plan.difficultyContext`；orchestrate 结果与账本（ledger.difficultyContext）暴露 |
| `shared/request/request-normalize.js` | 新增 `normalizeDifficultyParam(d)`；`createPracticeRequest` 附加 `difficultyParam`（与 `difficulty` number 并存，完全向下兼容） |

**兼容规则（已生效）：**
- `request.difficulty` 为 number → `{requested: N, source: 'user'}`
- `request.difficulty` 为 object → `{requested, min, max, tolerance, source}` 原样归一
- `request.difficulty` 为 null / 缺省 → `{requested: null, source: 'auto'}`（生成难度由策略决定）
- `req.scope.difficulty`（旧路径）同样归一

---

### M3 — difficulty-orchestrator.js（已完成 ✅）

**新建：** `shared/orchestration/difficulty-orchestrator.js`（挂 `App.DifficultyOrchestrator` / `module.exports`，双入口）

**职责（已实现，只做参数整理，不计算）：**
- `normalizeDifficultyInput(req)` — 三种形态 → 参数域 `{requested,min,max,tolerance,source}`
- `resolveContext(input, base)` — → `DifficultyContext`
- `validateConstraints(ctx)` — 约束一致性校验（不抛错，返回违反项数组）

**禁止项已满足（静态扫描无 `paramsFor` / `1 + 9 *` / 权重）：**
- 不调用 `Difficulty.paramsFor` / `DifficultyStatic.paramsForKnowledgePoint`
- 不复制 `DELTA_RULES` / 权重表 / 档位公式
- 无任何难度计算

---

### M4 — DifficultyContext 数据结构（已完成 ✅）

**输出：** `DifficultyContext = {requested, base, target, min, max, tolerance, source}`

| 字段 | 类型 | 来源 | 语义 | 现值 |
|---|---|---|---|---|
| `requested` | number\|null | 用户 | 用户显式选择的难度值（1–10） | number/null |
| `base` | number\|null | static-difficulty | KP 静态难度（**M5 接入前暂为 null**） | null |
| `target` | number\|null | 编排层 | 最终难度目标 = requested override base | requested ?? base |
| `min` | number\|null | 用户 | 难度下限约束（纯携带，不参与计算） | number/null |
| `max` | number\|null | 用户 | 难度上限约束（纯携带，不参与计算） | number/null |
| `tolerance` | number | 用户 | 容差范围（>=0，仅约束） | number |
| `source` | string | 编排层 | `'user'` / `'static'` / `'auto'` | string |

**验证（node -e 冒烟）：** number / 结构化对象 / null / scope.difficulty 四形态归一正确；`validateConstraints` 对 min>max、requested 越界、负容差给出违反项；practice-orchestrator 全链路输出 `difficultyContext` 至结果与账本不回归。

---

### M5 — 接通 DifficultyStatic（编排层 base 来源）

**文件改动：**
- `shared/orchestration/practice-orchestrator.js` 或新 `difficulty-orchestrator.js`：在 KP 选定后，调用 `StaticDifficulty.resolveStaticDifficulty(kp)` 取 `base`，填入 DifficultyContext.base
- **不改** `shared/catalog/difficulty-static.js`（Frozen Core）

---

### M6 — 接通 Strategy difficulty

**改动：** StrategyEngine.plan 接收 DifficultyContext（而非各自独立解析 difficulty 字段）

- `shared/strategy/strategy-engine.js`：接受 DifficultyContext，传递给 target-difficulty / adaptive-strategy
- Strategy 层**只读取** DifficultyContext，不回写

---

### M7 — adaptive delta 透传

- `shared/strategy/adaptive-strategy.js` 的 `adj`（mastery-based）结果 → 回传 DifficultyContext
- 编排层保存 adaptiveDelta，不重新计算，直接传递给 strategy 下次请求
- 确保 `adaptiveDelta` 在 QuestionPlan 中保留（strategy-engine.js:905）

---

### M8–M10 — 难度 × 题型分配 / KP 容量 / 题量预算

**核心逻辑：** 编排层分配题型/KP/题量时，携带 DifficultyContext（用于容量桶查询和预算平衡）

- `shared/orchestration/practice-orchestrator.js:206-214` — `difficulty` 已用于 `capacityByType`（保持）
- `shared/orchestration/budget-allocation.js` — 新增 difficultyContext 透传（纯数据，不做难度计算）
- `shared/orchestration/practice-plan.js` — GenerationTask 携带 difficultyContext

---

### M11 — Composite 模式统一协议

- Comprehensive / multi-kp 模式同样走 DifficultyContext 协议
- `shared/strategy/comprehensive-strategy.js` — build(request) 接受 difficultyContext，传递给子 plan

---

### M12 — Structure 约束用 finalLevel 重取 paramsFor

- `shared/strategy/structure-constraints.js:69` 已正确：`Difficulty.paramsFor('math', finalLevel)`
- M12 确认：当 finalDifficulty ≠ staticLevel 时，必须 re-fetch（已实现，冻结确认）

---

### M13 — Generator 单一 difficulty 输入

- `shared/presentation/render.js` 的 `createPlugin` wrapper：统一使用 `opts.difficultyParams`
- Generator 不再自行调用 `DifficultyStatic`（现有路径已走 difficultyParams 注入；确认冻结）
- `difficulty-strategy.js` 的 `compositeComplexityOf`（112行 require kp-complex-semantics）保持在 strategy 层

---

### M14 — 重复参数分类

**已识别的参数传递重复点（inventory）：**

| 参数 | 位置 A | 位置 B | 分类 |
|---|---|---|---|
| `difficulty` | request.difficulty | QuestionPlan.difficulty | 透传（A→B，同值） |
| `adaptiveDelta` | request.adaptiveDelta | QuestionPlan.adaptiveDelta | 透传（A→B，同值） |
| `staticLevel` | staticProfile.level | trace.staticDifficulty | 追踪副本（非计算重复） |
| `effectiveDifficulty` | difficulty.effectiveDifficulty | QuestionPlan.difficulty（经 composed 覆盖后） | 计算产物透传 |
| `composedDifficulty` | difficulty.composedDifficulty | QuestionPlan.difficulty | 统一入口（M13 后单一） |
| `paramsFor` 输出 | difficulty.js paramsFor | render.js paramsFor | 消费者重复调用（M13 确认 render 只读不改） |

→ **A/B/C/D/E 分类结果：** 无真正重复计算（diff 参数只有一条计算路径）；B 类（透传副本）保持现状

---

### M15 — 9/10 问题最小修复

**修复：** `shared/catalog/difficulty-static.js:151`

```js
// BEFORE (weights sum 0.94)
var wsum = 0.12*G + 0.15*S + 0.12*C + 0.08*T + 0.12*St + 0.08*N + 0.12*A + 0.15*Comb;
var D = 1 + 9 * wsum;

// AFTER (normalized to sum=1.0)
var WSUM_MAX = 0.12 + 0.15 + 0.12 + 0.08 + 0.12 + 0.08 + 0.12 + 0.15; // = 0.94
var wsum = 0.12*G + 0.15*S + 0.12*C + 0.08*T + 0.12*St + 0.08*N + 0.12*A + 0.15*Comb;
var D = 1 + 9 * (wsum / WSUM_MAX);
```

**回归标准（M16 旧分布 → 新分布）：**
- 旧分布：全体 KP 的 D 分布直方图（level 1–9 only）
- 新分布：全体 KP 的 D 分布（level 1–10）
- 核心检查：level ≤ 8 的 KP 变化 ≤ 0.5 级（大量 KP 仅微移）；level 9 KP 部分升 10；整体上移不超过阈值
- 若整体上移过大 → **暂停**，改用更温和方案（如仅对 level 9 的 KP 补偿）

**辅助修复：** 清理 3 个断链 dev 脚本（见 D2），改用新 KBL 数据层

---

### M16 — 测试矩阵

**新建：** `tests/difficulty/` 目录

| 测试文件 | 职责 |
|---|---|
| `difficulty-static-weights.test.js` | 权重和 = 1.0；level 1–10 可达性 |
| `difficulty-context-flow.test.js` | DifficultyContext 各字段正确传递 |
| `difficulty-orchestrator-normalize.test.js` | number/object/null 输入 → 正确 context |
| `difficulty-structure-fetch.test.js` | finalLevel ≠ staticLevel 时 paramsFor 重取正确 |
| `difficulty-distribution-regression.test.js` | 新旧分布对比（M15 回归） |

**npm scripts：**
```json
"verify:difficulty-system": "node --test tests/difficulty/*.test.js && node dev/check-difficulty-dual.js"
```

---

### M17 — 一致性断言

在 tests/difficulty/ 中加入：
- 所有 KP 的 difficulty ∈ [1,10]
- DifficultyContext 各字段类型/范围
- QuestionPlan.difficulty === DifficultyContext.target（传递完整性）
- structure-constraints 的 finalLevel 与 QuestionPlan.difficulty 一致

---

### M18 — Frozen Core 回归（M0–M7 不变）

**回归检查（M18 gate）：**
- `dev/check-difficulty-dual.js` → ✅ 无新增 errors
- M0–M7 涉及的文件（见第二节清单）的函数签名/导出不变
- strategy-engine.js trace 输出格式不变（不改 debug 输出字段）
- practice.html URL 参数兼容不变（difficulty 仍为 1–10 number）

---

### M19 — E2E 用例（Case A–E）

| Case | 输入 | 预期 |
|---|---|---|
| A: 用户显式难度 | `{difficulty: 7, knowledgePointIds: ["math-g1-advance-u01-k001"]}` | targetDifficulty=7, composedDifficulty≥7（mode+complexity 叠加后） |
| B: 无难度 | `{knowledgePointIds: [...]}` | source='static', target=staticLevel |
| C: 自适应 | `{difficulty: 5, adaptive: true, adaptiveDelta: 1}` | targetDifficulty=5, effectiveDifficulty=6（delta叠加） |
| D: 容差约束 | `{difficulty: {requested: 7, min: 5, max: 9, tolerance: 2}}` | final ∈ [5,9] |
| E: Competition 模式 | `{mode: 'competition', grade: 3}` | 未显式难度 → 年级锚点上沿 [3,5] → target=5（anchor-top） |

---

### M20 — 验证后清理（在 M19 全绿后执行）

| 清理项 | 文件 |
|---|---|
| 旧知识层引用删除 | `dev/test-difficulty.js`、`dev/test-difficulty-static.js`、`dev/check-difficulty-anchor.js` → 重建或删除 |
| `migration/knowledge-access-expectations.json` 更新 | 难度相关脚本归位后更新 94 项基线 |
| `npm test` 修复 | 替换旧 knowledge-bank 引用 → 新 KBL 数据层 |

---

## 五、执行顺序（依赖图）

```
M0 ✅ (本审计)
M1 ✅ (权威边界已在审计中确认)
M2 (Request 扩展) → M3 (difficulty-orchestrator.js) → M4 (DifficultyContext)
M5 (接通 Static) → M6 (接通 Strategy) → M7 (adaptive delta 透传)
M8-M10 (分配/容量/预算) → M11 (Composite) → M12 (Structure 确认) → M13 (Generator 单一输入)
M14 (参数分类) → M15 (9/10 修复 + 分布回归) → M16 (测试矩阵) → M17 (一致性断言)
M18 (Frozen Core 回归，贯穿全程) → M19 (E2E) → M20 (清理)
```

---

## 六、关键行号速查

| 内容 | 文件:行 |
|---|---|
| 9/10 权重缺陷 | `shared/catalog/difficulty-static.js:151` |
| paramsFor('math', level) | `shared/catalog/difficulty.js:221-225` |
| difficultyToStructure 五档 | `shared/catalog/difficulty.js:27-33` |
| 结构 tier → complexityScore 单调性 | `shared/catalog/difficulty.js:53-58` |
| target-difficulty allowOverride | `shared/strategy/target-difficulty.js:58-74` |
| composed difficulty 四路合成 | `shared/strategy/difficulty-strategy.js:150-198` |
| strategy-engine 难度串联 | `shared/strategy/strategy-engine.js:690-907` |
| adaptive-adjustment delta | `shared/strategy/adaptive-strategy.js:174-182` |
| orchestration 难度仅查容量桶 | `shared/orchestration/practice-orchestrator.js:206-214` |
| render.js 插件 difficultyParams 注入 | `shared/presentation/render.js:246-278` |
| practice.html difficulty 默认 1 | `practice.html:375-381` |
| normalize 默认 6 | `shared/request/request-normalize.js:49-55` |
| strategy-config 年级锚点 | `shared/strategy/strategy-config.js:17-24` |
| check-difficulty-dual 通过（1 warning） | `dev/check-difficulty-dual.js`（需运行） |
| 3 个断链 dev 脚本 | `dev/test-difficulty.js`, `dev/test-difficulty-static.js`, `dev/check-difficulty-anchor.js` |


---

## Phase 8 收口记录（2026-09-13）

> 审计：`docs/pol-kbl-phase8-difficulty-audit.md`｜契约：`docs/pol-contract.md` §8

- **D2 → RESOLVED**：删除 3 个断链脚本（`dev/test-difficulty.js` / `test-difficulty-static.js` / `check-difficulty-anchor.js`）
  与 `dev/r2-difficulty-anchor-apply.js`、`verify:difficulty-anchor` 脚本。
- **M16 → 完成**：新增 `tests/difficulty/`（6 文件 23 用例）：
  - `difficulty-static-weights`（公式/权重/可达性/单调）
  - `difficulty-context-flow`（POL Context → Strategy 贯通）
  - `difficulty-orchestrator-normalize`（number/object/null → 参数域）
  - `difficulty-structure-fetch`（finalLevel ≠ staticLevel → paramsFor 重取）
  - `difficulty-distribution-regression`（total=598 / usable=567 / missing=31 SKIP+WARN）
  - `difficulty-anchor`（年级锚点门禁重建；已知例外 `math-g4-up-u09-k001` 登记）
- **DRIFT-11 → RESOLVED**：POL `getTargetDifficulty()` 全局兜底；浏览器等价环境预测生效。
- **DifficultyContext 接线 → RESOLVED**：practice.html 加载 `difficulty-orchestrator.js`（先于 POL）。
- **死代码**：`render.js _wrapDifficultyParams`（死工厂消费）、`difficulty-orchestrator.validateConstraints` 删除。
- **双 validator**：职责互补（仅 spiral 重叠）→ 保留双层并文档化。
- **数据事实**：canonical `seedDifficulty` 567/598 有值；31 缺失（SKIP+WARN，不伪造）；
  锚点越界 1 例（`math-g4-up-u09-k001` seed=3 vs G4 [4,7]，登记为已知例外）。
