# KBL → POL 接线改造 · Phase 1 全量审计清单

> **状态：Phase 1 COMPLETE（2026-09-13）｜Phase 2 CLOSEOUT 见文末**
> 审计时间：2026-09-13（KBL 收口冻结后，`kbl-math-v1.0.0-45b9a2f4`）
> 目标：KBL Runtime 唯一知识事实源；POL 唯一知识业务入口；Generator/SVG 本轮断开旧知识层。
> 方法：全仓 grep（require/HTML script/bundle shim/动态加载/测试/构建/冻结清单）+ 消费面精读。
> 结论先行：旧层文件已全部删除；残余引用分三类（Frozen 内嵌 require、可变代码 require、页面/bundle/缓存 404）；冻结核心不可改写 → 采用 **build 时 runtime 兼容接线**（知识模块映射到 `App.KNOWLEDGE`，非复活 KnowledgeBank）+ **Frozen pending 登记**。

---

## 0. 旧层文件与冻结现状

- 已删除（位于 `shared/knowledge/`，全部不存在）：`knowledge-bank.js`、`knowledge-math.js`、`knowledge-point.js`、`knowledge-ontology.js`、`knowledge-ontology-normalizer.js`、`knowledge-ontology-validator.js`、`ontology-operation-map.js`、`ontology-error-map.js`、`ontology-factual-map.js`、`ontology-category-map.js`、`knowledge-factual.js`。
- 目录现存（KBL 正式）：`runtime/`（唯一入口 `knowledge-runtime.js`）、`data/`、`relations/`、`index/`、`mappings/`、`manifest/`、`schema/`、`question-id.js`、`question-type-registry.js`。
- frozen-core 清单（82 项）仍列已删 2 文件：`dev/check-frozen-core.js:40-41`（`knowledge-bank.js`、`knowledge-ontology.js`）→ W12，基线 JSON 已跳过缺失文件。

---

## 1. 五类清单

### 1.1 必须迁移（迁移到 Runtime / KnowledgeContext）

| 对象 | 现状 | 目标 |
|---|---|---|
| POL 知识访问（`practice-orchestrator.js`） | `getKnowledgeBank`(37)/`getKnowledgePointAccess`(136)/`resolvePoolKps`(72) | 走 `knowledge-context.js`；predictDifficulty 改用 context |
| `generation/api.js:604` 年级池展开（`generateBudget`） | `require ../knowledge/knowledge-bank.js` | 改用 `knowledge-context.js`（runtime byGrade） |
| 页面（practice/select） | 未加载 runtime | 引入 `shared/knowledge/runtime/knowledge-runtime.js` |
| bundle 知识模块接线（build 时） | `dev/build-strategy-bundle.js` SHIMS `knowledge-bank→KnowledgeBank`(硬抛) + `knowledge-point/ontology` 缺失→null stub | 改为映射到 runtime 兼容对象（Know-ledgePointCompat/OntologyCompat），消除硬抛与 null stub |
| `capacity-inventory.js:53-75` bootstrap | 扫列表含已删 `knowledge-bank/ontology` | 移除已删 2 项 + 返回改由 runtime |

### 1.2 必须断开（可变代码，直接删除旧 require/调用）

| 文件:行 | 引用 |
|---|---|
| `shared/generator/generators/application.js:12,312` | KP require + `KP.get` |
| `shared/generator/generators/c1-number-puzzle.js:10,139` | 同 |
| `shared/generator/generators/c2-number-theory.js:11,198` | 同 |
| `shared/generator/generators/c5-c6-journey-engineering.js:16,253` | 同 |
| `shared/generator/generators/c7-clever-calc.js:15,210` | 同 |
| `shared/generator/generators/c9-comprehensive.js:19,295` | 同 |
| `shared/generator/generators/composite.js:18,37,39,61` | KP + Ontology.normalize + `resolveArithmeticSemantics(KP.get(...))` |
| `shared/generator/generators/counting.js:10,284` | KP |
| `shared/generator/generators/money.js:13,302` | KP |
| `shared/generator/generators/picture-equation.js:10,152` | KP |
| `shared/generator/generators/position.js:13,243` | KP |
| `shared/generator/generators/reasoning.js:10,235` | KP |
| `shared/generator/generators/shape.js:13,321/364/426/504` | KP |
| `shared/generator/generators/stats.js:10,215` | KP |
| `shared/generator/core/op-semantics.js:15` | `ontology-operation-map.js` |
| `shared/capability/capability-scan-context.js:17-18` | Ontology + KnowledgeBank |
| `shared/capability/knowledge-capability-view.js:36` | 守卫 require knowledge-point（改用 runtime） |
| `shared/orchestration/practice-orchestrator.js:37,136` | 守卫 require KB/KP（改 context，见 1.1） |
| `shared/generation/api.js:604` | 守卫 require KB（改 context） |

> 断链口径：POL 传入的 KP 已由 context 归一（canonical，`capabilities` 已增强），`KP.get(kp)` 是幂等重归一 → 可变生成器内 `KP.get(pkp(plan))` 直接取值；需逐文件核对 `kp` 消费字段后替换。

### 1.3 可删除（死代码 / 404 / 陈旧清单）

| 对象 | 证据 | 处置 |
|---|---|---|
| `practice.html:277`、`select.html:563` | `<script src="shared/knowledge/knowledge-bank.js">` → 404 | 删除脚本行，换 runtime |
| `sw.js:53-54` | `knowledge-bank.js`/`knowledge-math.js` 缓存项（已删） | 删除；补 runtime + svg 资产 |
| `dev/check-frozen-core.js:40-41` | 已删文件仍在冻结清单 | 移除（W12） |
| `shared/generation/orchestrator.js` | 无任何消费者 | 删除 |
| `practice-orchestrator.resolvePoolKps`(72-89) + `getKnowledgeBank`(36-39) | 唯一消费 KB；POL 池模式不激活 | 删除 |
| `generation-engine.js` 内联 buildPlans/runPlans 回退副本(89-105 等) | 与 api.js 重复、GenerationAPI 已接入 | 归并到 api.js 公共入口（保留委托） |
| W7 重复规范化（requestKpIds/requestCount/planKey ×3） | api.js:125-146 / generation-orchestrator.js:86-102 / generation-engine.js:89-105 | 抽 `shared/generation/request-util.js` |
| `scripts/migrate-knowledge-difficulty-fields.js` / `migrate-knowledge-subject.js` / `generate-knowledge-pages.js` | require 已删层 | 核对后归档（archive/） |
| D2 门禁：`dev/test-difficulty.js`、`dev/test-difficulty-static.js`、`dev/check-difficulty-anchor.js` | require 旧层，待 M16 | 保留 pending（Phase 10 记录） |
| 生成页 `knowledge/*.html`（~500） | `scripts/generate-knowledge-pages.js` 产物，静态内容 | 本轮不动（内容面，非接线面） |

### 1.4 Frozen（不可改写；运行时由 bundle 兼容接线承接，并登记 pending）

| 冻结文件 | 旧层引用 | 承接方式 |
|---|---|---|
| `shared/strategy/strategy-engine.js:69,205-206` | KB.getEntries / KP.get | build 时 knowledge-point/knowledge-bank 模块 → runtime 兼容对象 |
| `shared/strategy/strategy-resolver.js:9` | KP.get | 同上 |
| `shared/strategy/cognitive-strategy.js:18` | KP.get | 同上 |
| `shared/strategy/context-strategy.js:18` | KP.get | 同上 |
| `shared/strategy/difficulty-strategy.js:21` | KP.get | 同上 |
| `shared/strategy/number-range-strategy.js:20,59` | KP.get | 同上 |
| `shared/strategy/spiral-strategy.js:19` | KP.get | 同上 |
| `shared/strategy/structure-constraints.js:23` | KP.get | 同上 |
| `shared/strategy/question-type-allocation.js:18` | KP.get | 同上 |
| `shared/strategy/strategy-validator.js:21` | KP.get | 同上 |
| `shared/strategy/target-difficulty.js:30` | KP.get | 同上 |
| `shared/strategy/comprehensive-strategy.js:29` | 守卫 KB（global 优先） | 不触发即安全；登记 pending |
| `shared/generator/generator-registry.js:193` | KP.get | bundle 兼容接线 |
| `shared/generator/generator-selector.js:27` | KP.get | bundle 兼容接线 |
| `shared/generator/core/kp-arithmetic-semantics.js`（冻结） | 读 `kp.source.legacyType`（B5 数据形状） | 不改写；POL 传 canonical 数据，字段缺失走既有兜底；登记 pending |
| `shared/capability/capability-resolver.js:24-26` | Ontology + KP | bundle 兼容接线（Ontology.normalize 幂等透传） |

> 注：冻结文件在 Node 侧 require 已删模块即抛错——历史上已成立（B3 基线），Node 门禁均不触碰冻结实现路径；本改造不改变此性质，只保证浏览器 bundle 内冻结代码经兼容接线可运行，且数据来自 KBL Runtime 唯一事实源。

### 1.5 KBL 正式文件（事实源 / 唯一出口）

- `shared/knowledge/runtime/knowledge-runtime.js` —— 浏览器/Node 单文件入口；基座 `knowledge-contract.js | loader | relation | policy | index | query | api`。
- `shared/knowledge/data/`（6 年级 KP JSON）、`relations/`（1287）、`index/`、`mappings/`（639、generation-contract）、`manifest/`、`schema/`、`question-id.js`、`question-type-registry.js`。
- `tools/kbl/*`（validate/import-excel/export-excel/normalize/roundtrip/import/build）—— KBL 标准工具链。
- 仅允许通过 Runtime 获取知识：KP / Unit / Grade / Book / Relations / Selectable / Generation eligibility(contract) / Stats。

---

## 2. 冻结提取（`dev/check-frozen-core.js` 82 项，按层）

- strategy（21）：strategy-config, strategy-engine, comprehensive-strategy, strategy-error, strategy-request, strategy-resolver, strategy-result, strategy-validator, adaptive-strategy, cognitive-strategy, context-strategy, difficulty-strategy, static-difficulty, number-range-strategy, target-difficulty, spiral-strategy, constraint-builder, structure-constraints, question-plan, question-type-strategy, question-type-allocation
- generator（14）：generator-contract, generator-registry, generator-selector, generator-mode, retry-loop, generators/arithmetic, generators/selection, generators/complex, generators/index, core/rng, core/arithmetic-core, core/kp-complex-semantics, semantic-question-bridge, core/arithmetic-semantics, core/kp-arithmetic-semantics
- capability（3）：capability-model, capability-matrix, capability-resolver
- validator（8）：validation-pipeline, question-validator, answer-validator, difficulty-validator, duplicate-validator, batch-validator, quality-scorer
- presentation（7）：renderer, html-renderer, render-options, render-result, render-format, svg-registry, print
- svg（4）：svg-core, svg-geometry, svg-calculation, svg-make-ten
- 其他：难度 Authority（difficulty-static/difficulty）、practice-session、semantic-question-bridge、build 产物（bundle/runtime 均**非**冻结）

---

## 3. 关键决策（供执行引用）

1. **Frozen 兼容接线 = build 时，非运行时复活**：`dev/build-strategy-bundle.js`（可变）将 `knowledge-point.js/knowledge-ontology.js/knowledge-bank.js` 映射为 runtime 兼容对象（`KnowledgePointCompat={get:id→App.KNOWLEDGE.get}`、`OntologyCompat={normalize:idempotent}`、`KnowledgeBankCompat={getEntries}`）。不新增任何文件于旧层路径；`shared/knowledge/` 下不重建旧名文件。
2. **POL 唯一业务入口**：`shared/orchestration/knowledge-context.js`（新文件）做形状转换（knowledgeId→id / unitId→moduleId / gN→N）；禁止扩散到 Generator；禁止写回 KBL。
3. **难度统筹入 POL**：沿用 `difficulty-orchestrator.js`（接收/规范化/统筹/传递）；`predictDifficulty` 的 KP 访问改走 context；不复制公式。
4. **Generator 断链**：可变生成器删 require + `KP.get`；Frozen 3 文件登记 pending，不改写。
5. **禁止**：新建 KnowledgeService/Repository/Manager/Facade；复刻难度公式；把 legacy pluginId/category/operations 写回 KBL。

## 4. 零引用删除门禁（Phase 13 复核项）

删除任何文件前复查：require/import ∅、HTML script ∅、bundle 引用 ∅、dev 构建引用 ∅、test 引用 ∅、动态加载 ∅、runtime consumers = 0。
---

## 5. Phase 2 CLOSEOUT（2026-09-13）

> 主报告：`docs/pol-kbl-phase2-closeout.md`；唯一性审计：`docs/kbl-runtime-uniqueness-audit.md`

- 唯一性审计 3 项 FAIL 全部收口：FAIL-001（render.js 旧 KnowledgeBank 死代码删除）、FAIL-002（kp-semantic-validator 失效 combine 路径删除）、FAIL-003（presentation bundle 内联 KC/Runtime 副本经构建委托去重）。
- 结果：**KBL Runtime Uniqueness = PASS**（0 known / 0 new；bundle 副本 0；动态 mounts=1）。
- 死代码第二轮：删除 `svg-templates.js`（死注册表）、`check-g1-quality-matrix.js`（no-op 桩）、`test-runner.js`（0 测试空跑）；归档 `cleanup-scan.js`、`semantic-parse.js`、`clean-difficulty-consume.js`、失效 column-consistency 测试。
- 有效孤儿测试接线：`test:svg-units`、`test:difficulty-structure`、`test:sw-cache` 纳入 `npm test`。
- 文档：`技术文档--基础.md` §7 重写为 KBL Runtime Contract；`知识层架构与7类题型模型.md` 归档；Pending 重排 P0–P4。
