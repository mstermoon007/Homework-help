# 生成器 · SVG · 编排层 统一性审计报告（完整版）

> 审计时间：2026-09-13（KBL 收口 M0–M19 冻结后）
> 范围：`shared/generator/`（生成器层） × `shared/svg/ + shared/presentation/ + plugins/svg-*`（SVG/渲染层） × `shared/engine + shared/orchestration + shared/generation`（编排层）
> 方法：源码走查 + require 消费链追踪 + 基线数据对比（canonical KBL vs legacy KP vs 契约）+ 关键论断实测验证（Node 探针 + 页面 script 装配序核对）
> 关联：难度计划 Phase E「断链接线收敛」、KBL M10（旧层删除）、`migration/knowledge-access-expectations.json`（downstream-pending 基线）
> 基线：快照 `kbl-math-v1.0.0-45b9a2f4`（容 `selectable` 598 KP / 128 unit / 1287 relations / 639 mappings）

---

## 0. 结论先行（TL;DR）

- **唯一难度裁决约束成立（绿灯）**：`1 + 9×wsum` 权重（0.12/0.15…/WSUM_MAX=0.94）仅存在于 `shared/catalog/difficulty-static.js` / `difficulty.js`，编排层无一处复制公式（全仓扫证）。
- **新渲染主链自洽（绿灯）**：`PresentationRenderer.renderAll → GraphicRenderer → SVGRenderer → HTMLRenderer`，`graphicOf` 的 `data.graphic` 兜底使现状可运行；`verify-svg` 162 例全绿。
- **系统性统一欠账集中在「KBL 收口删除旧知识层后的接线残骸」**：页面 404 + bundle 硬抛（运行时 BLOCKER）；Node 门禁崩溃（B3 波及 9 文件，其中 3 个冻结）；canonical 单出口 `knowledge-runtime.js` 未被任何页面/编排链引用。
- **第二大欠账是渲染层内部多轨/枚举漂移**：graphic type 四处枚举不一致、legacy 渲染轨丢描述符图、svg-templates 死代码、双时钟等。
- **关键实证**：canonical runtime 数据键为字符串年级 `"g1"…"g6"`、KP 主键为 `knowledgeId`（形如 `math-g4-down-u01-k001`）；而策略/池路径消费数字年级 + `id` + `moduleId` —— 兼容桥必须做 `数字年级→"g"+n` 与 `knowledgeId→id / unitId→moduleId` 映射（详见 §4.2）。

---

## 1. 三层源码地图

### 1.1 生成器层 `shared/generator/`

| 文件 | 角色 | 冻结 |
|---|---|---|
| `generator-contract.js` | 生成器契约/校验（FORBIDDEN_PATTERNS 禁参数消费） | ✅ |
| `generator-registry.js` | `buildRecords()` 加载 26 个 native core Generator，加载时归一到 7 类；`forKnowledgePoint()`/`enhanceKp()` | ✅ |
| `generator-selector.js` | `selectGenerator()` 7 维优先级打分选生成器 | ✅ |
| `generator-mode.js` / `retry-loop.js` | 模式 / 重试 | ✅ |
| `registry-facade.js` | `resolve({subject,capability,questionType})` token 匹配（**与 selector 双路径**） | ❌ |
| `semantic-question-bridge.js` | SQ → Question 转换（渲染/判定收敛点） | ✅ |
| `graphic-renderer.js` | SVG 门面（`GRAPHIC_RENDERERS` 16 键） | ❌ |
| `generators/*` | 26 个生成器实现（含 `composite.js`、`kp-arithmetic-semantics` 等） | 部分 |
| `core/op-semantics.js:15` | 运算语义 → require 已删 `ontology-operation-map.js` | ❌ |

### 1.2 SVG/渲染层

- 新轨：`shared/presentation/renderer.js`（✅冻）→ `graphic-renderer.js` → `svg-registry.js`（✅冻，`SUBJECT_TO_TYPE` 12 键）→ `shared/svg/svg-*.js` + `plugins/svg-*.js` → `html-renderer.js`（✅冻）。
- 旧轨（bundle 内）：`presentation-engine.renderQuestions → RenderFormat.toRenderableQuestions → PluginUtil.renderGrid/renderCard`（只读 `q.svg`，描述符图不渲染）。
- 浏览器挂载序（`practice.html:306-339`）：svg-registry → graphic-renderer → svg-core/geometry/calculation/make-ten/chart/diagram/currency → svg-templates → plugins（clock/area/fraction/data-stats/draw/competition）→ html-renderer → renderer。

### 1.3 编排层

- 活跃主链：`select.html → RequestNormalize → practice.html → practice-bridge.js → practice-session.js → generation/api.js generate → PracticeOrchestrator.orchestrate → executeInline → PresentationEngine.generateQuestions → StrategyEngine`。
- 死代码：`generation/orchestrator.js`（无 require、无 script 引入）；`practice-orchestrator.resolvePoolKps`（72-89，唯一消费 getKnowledgeBank）。
- 内联回退：`generation-engine.js` 内嵌 build/runPlans 副本（GenerationAPI 为 null 时启用）。

---

## 2. 页面 script 装配序（batch A 接线基座）

`practice.html:270-340` 实际顺序：

```
common.js → difficulty.js → difficulty-static.js → print.js
→ knowledge-bank.js(已删)［404 @277］
→ module-catalog.js → catalog-utils.js
→ strategy-engine.bundle.js［知识 shim 依赖全局，见 §4.3］
→ presentation-engine.bundle.js［委托 strategy bundle __req］
→ storage/error-model/practice-result/learner-model/learner-storage/result-collector
→ render-options/render-result → svg-registry.js → graphic-renderer.js
→ svg-core/geometry/calculation/make-ten/chart/diagram/currency
→ svg-templates.js → plugins/svg-clock|area|fraction|data-stats|draw|competition
→ html-renderer.js → renderer.js
→ generation-engine.js → practice-plan/budget-allocation/practice-orchestrator
→ generation/api.js → comprehensive-strategy.js → practice-session.js → practice-bridge.js
```

- `select.html:563` 也存在 `knowledge-bank.js` 404 引入；`select.html` 还加载 `request-normalize.js`（practice.html 没有）。
- `index.html` 仅加载 `version.js` + `common.js`（1479-1480），**不**加载知识/bundle —— index 不受 B1/B2 影响。

---

## 3. 统一性发现清单

### 3.1 BLOCKER（运行时崩/断链，多源于旧层删除）

| # | 发现 | 证据 | 归属 |
|---|---|---|---|
| B1 | `practice.html:277`、`select.html:563` 仍 `<script src="shared/knowledge/knowledge-bank.js">` → 浏览器 404 | 实测 grep + 装配序核对 | 页面（可变） |
| B2 | `strategy-engine.bundle.js:41-43` `knowledge-bank` shim 缺全局时 **throw** → 快速/教师/竞赛池模式硬崩 | bundle def: `if (global.KnowledgeBank == null) throw` | bundle（口径可变，可重编） |
| B3 | Node 侧多文件 require 已删层 → 门禁崩溃：`strategy-engine.js:205`、`capability-resolver.js:24-26`（**冻结**）、`generator-selector.js:27`（**冻结**）、`generator-registry.js:193/231`（**冻结**）、`kp-semantic-validator.js:22-23`、`capability-scan-context.js:17-18`、`capacity-inventory.js:53-75`（bootstrap 扫边无守卫）、`composite.js:18/39`、`op-semantics.js:15`（→ 已删 ontology-operation-map） | require 链实测 | 冻结+可变混合 |
| B4 | canonical 单出口 `knowledge-runtime.js` 未被 practice/select/index 引入，编排链 0 处 require | grep 全仓 | 页面（可变） |
| B5 | generator 数据形状 mismatch：`generator-selector` 读 `kp.legacy.category`(217)/`kp.pluginId`(96-98)/`kp.operations`(245)；`kp-arithmetic-semantics` 读 `kp.source.legacyType`；canonical KP 均无这些字段 → 选择器优先级①原生绑定永不命中 | 数据对比（canonical KP 无 legacy/pluginId/operations 键） | 冻结 selector |
| B6 | registry `knowledgePoints` 464 条 legacy ID → `forKnowledgePoint(canonicalId)` 恒空数组 | 数据对比 | 冻结 registry（数据记 WARNING） |
| B7 | 映射 `pluginId`（93 个，如 `math-g1-multiplication-table`）与 generator id（26 个 `generator:*`）重叠=0，无解析代码；`capability-scan-context` 被迫自行改写 | 数据对比 | 可变为主 |
| B8 | 契约 228/639 行 `capability="unresolved"`（数据质量洞） | 数据对比 | 派生门禁（validate 已挡 allow，missing 合法） |

### 3.2 WARNING（多轨/漂移/死代码）

| # | 发现 | 证据 | 归属 |
|---|---|---|---|
| W1 | 渲染双轨：legacy 轨只认 `q.svg`，position-grid/currency/diagram 描述符图在旧轨永不渲染 | render-format.js:79 | 冻结旧轨 |
| W2 | graphic type 四处枚举不一致：schema `GRAPHIC_TYPES`(geometry/chart/diagram/currency/number-line/grid/custom) vs `GRAPHIC_RENDERERS`(16 键，含 make-ten/makeTen 并存) vs `SUBJECT_TO_TYPE`(12 键，无 core/number-line/grid) vs KP 数据（9 number-line + 4 grid 知识点无渲染器） | 四源 diff | 冻结+可变 |
| W3 | `data.graphic` 绕过 schema 校验（生成器写 raw.data.graphic，sq.graphic 恒 null，graphicOf 兜底） | semantic-question.js:414-425 | 可变 semantic-question |
| W4 | `svg-templates.js` 死注册表；`STYLE_TO_TEMPLATE` 无 `sort`（question-style-strategy.js:34 classify→style='sort' 失配）；全库无消费者 | grep | 可变（可删/修） |
| W5 | `render.js:87-123` 与 `plugins/svg-clock.js` 双时钟实现 | 读源码 | 可变 |
| W6 | `sw.js` 缓存名单：含已删 `knowledge-bank.js`/`knowledge-math.js`（53-54）+ 缺 `svg-chart/diagram/currency/svg-registry/graphic-renderer/html-renderer` | 读源码 | 可变 |
| W7 | 编排层规范化重复 3 份（verbatim）：`api.js:125-146`/`generation-orchestrator.js:86-102`/`generation-engine.js:89-105`（requestKpIds/requestCount/planKey）；`MODE_ALIAS+normMode` 3 处；subject 域门 2 处 | diff | 可变 |
| W8 | `request-normalize.js` 仅 select.html 加载；practice.html 深链时别名（oral/vertical/recognize/sort…）未归一 | 读源码 | 可变 |
| W9 | `DifficultyOrchestrator` practice.html 未加载 → POL 内联 raw clamp `Math.min(10,Math.max(1,…))`；`getKnowledgePointAccess` 浏览器为 null → `predictDifficulty` 回落难度=3（P0-02 用户难度对齐静默降级中档） | 读源码 | 可变 |
| W10 | `generation/orchestrator.js` 死代码（无消费者） | grep | 可变（可删） |
| W11 | SQ→Question 两套转换：冻结 `semantic-question-bridge.js` vs 未冻结 `practice-session.js:_sqToLegacyQuestion`（形状不同） | 读源码 | 冻结 vs 可变 |
| W12 | frozen-core 清单 M1 仍列已删 `knowledge-bank.js`/`knowledge-ontology.js`（基线防护已跳过缺失文件，列表与事实矛盾） | 读源码 | dev 门禁（可变） |
| W13 | `practice-orchestrator.resolvePoolKps`（72-89）死代码（唯一消费 getKnowledgeBank） | 读源码 | 可变 |
| W14 | `dataStats → svg-datastats` 模块标签与实际文件名 `svg-data-stats.js` 不一致 | 读源码 | 可变 |
| W15 | 生成器按难度自调图参（position gridSize、money maxYuan、shape dims、application）且 FORBIDDEN_PATTERNS 禁生成器调参数接口 → 与唯一难度裁决存在张力（设计留白，非违规） | 读源码 | 冻结生成器 |

### 3.3 INFO（确认项 / 一致性提示）

- 难度公式约束成立（编排层零复制权重）。
- 新渲染主链统一自洽；`verify-svg` 162 全绿；frozen-core 无变更；access 审计 PASS（69 基线命中全分类）。
- `sw.js`/svg-chart/diagram/currency 未冻结又未入缓存，风险暴露面不一致（W6/W14 佐证）。
- 本审计会话零文件改动（`git status` 变更均来自此前里程碑）。

---

## 4. Canonical Runtime 地形（新实证，批 A/B 实现基座）

### 4.1 公开 API 面（`App.KNOWLEDGE`，装于 `knowledge-runtime.js`）

实测方法集：`get / byGrade / byBook / byUnit / selectable / canGenerate / searchByName / relationsFor / unit / stats`。
契约白名单（PUBLIC_API，`knowledge-runtime.js:44-46`）：`get, byGrade, byBook, byUnit, selectable`。

### 4.2 数据键形状（与 legacy 的差异点）

| 维度 | canonical（实测） | legacy（策略/池路径消费） | 兼容桥映射 |
|---|---|---|---|
| 年级粒度 | `grade="g4"`（字符串，`byGrade("g4")` → 104；`byGrade(4)` → 0） | 数字 1–6 | 数字 n → `"g"+n` |
| KP 主键 | `knowledgeId="math-g4-down-u01-k001"`（`get(knowledgeId)` → KP；`get(id)` → null） | `id` | `knowledgeId → id` |
| 单元 | `unitId="math-g4-down-u01"`、`unitName` | `moduleId`/`moduleName` | `unitId → moduleId` |
| 题型 | `type="brace-addsub"`（canonical 语义题型） | `type`+`pluginId` | 直接透传 type；pluginId 无对应 |
| 年级统计 | `stats.byGrade`：g1:57 g2:112 g3:21 g4:104 g5:160 g6:144 = 598 | — | — |
| 可选性 | `selectable({grade:"g4"})` → 104（Policy 可练门禁） | — | getEntries 采用 byGrade + subject 过滤 |

canonical KP 键全集：`knowledgeId, subject, grade, book, unitId, unitNo, knowledgeNo, unitName, module, name, aliases, type, semantic, content, assessment, generation, weight, status, publication, difficultyAnnotation, source, meta`。
`unit(unitId)` → `{unitId, grade, book, unitNo, unitName, unitType, status, knowledgePointCount, knowledgePoints}`；`byUnit(unitId)` → 3 KP；`relationsFor(id)` → `{outgoing, incoming}`（无 prerequisite/related 命名）。

### 4.3 Bundle 接线机理（决定批 A 重构面）

`dev/build-strategy-bundle.js`（可变）：
- `SHIMS`（46-54）：`common.js→PluginUtil`、`difficulty.js→App.Difficulty`、`difficulty-static.js→App.DifficultyStatic`、`knowledge-bank.js→KnowledgeBank`、`node:path/fs→内置 shim`。
- shim 发码（151-156）：`__defs[id]=function(m){ if(global.X==null) throw …; m.exports=global.X; }` —— 即 B2 硬抛来源。
- 缺失模块兜底（88-92 收集、166 发码）：`module.exports = null` —— 已删的 `knowledge-point.js` / `knowledge-ontology.js` 在 bundle 内即如此（`strategy-engine.bundle.js` 内 `__defs["shared/knowledge/knowledge-point.js"]`、`…knowledge-ontology.js` 均为 null）。
- `capability-resolver.js`（冻结、磁盘存在）被 generator-registry 传递引入并内联，其 `Ontology.normalize`(34/93)/`KnowledgePoint.get`(55) 在浏览器指向 null stub → 当前全局能力决策实际失效。
- `dev/build-presentation-bundle.js`（可变）：只内联 strategy bundle 未提供的模块，知识/generator 模块**委托** `global.StrategyBundle.req()` —— 故一套知识兼容 shim 同时修复两个 bundle。

### 4.4 兼容桥需求面（批 A 的 compat 最小契约）

bundled 模块实际消费（`strategy-engine.js` 池路径 + `capability-resolver` + `generator-*`）：
1. `KnowledgeBank.getEntries(subject, grade)` → entries（`poolEntries` @strategy-engine.js:69）；entry 字段消费点：`id`(101/430)、`name`(431/504)、`moduleId`(506 过滤 @unitId)、`type`(121)、`weight`(151，缺省 1)、`category|moduleId |`(230 兜底)。
2. `KnowledgePoint.get(id)` → canonical KP（空 → 调用方 guard 返回 INVALID/null；`strategy-resolver.js:17`、`capability-resolver.js:55`、`generator-registry.js:195` 等）。
3. `Ontology.normalize(kp)` → 幂等透传（canonical KP 已归一；调用方均 try/catch 包裹，`capability-resolver.js:34`）。

> 即：compat 桥 = `getEntries`（数字年级→`"g"+n`、`knowledgeId→id`、`unitId→moduleId`）+ `get`（直通 `App.KNOWLEDGE.get`）+ `normalize`（透传）三方法的全局对象；页面在 bundle 前加载 `knowledge-runtime.js` + compat 桥即可消除 B1/B2/B4 且让池模式走 canonical KP。

---

## 5. 推荐统一动作（分批，标冻结/可变）

**批 A — 浏览器接线（消除 BLOCKER，可变为主）**
1. practice/select/index 引入 `knowledge-runtime.js` 单出口（B4）；移除 404 的 knowledge-bank.js 引入（B1）。
2. `shared/bridge/` 新增 compat 桥（§4.4 三方法），bundle 前加载（mutable）。
3. `dev/build-strategy-bundle.js` SHIMS 增补 `knowledge-point.js→KnowledgePointCompat`、`knowledge-ontology.js→KnowledgeOntologyCompat`（去 null stub），重编 strategy/presentation 两 bundle（B2）。
4. `sw.js`：删已删文件（53-54）、补 svg-chart/diagram/currency/svg-registry/graphic-renderer/html-renderer（W6）。

> 注：B5/B6 的 generator 绑定数据（legacy 字段/ID）**不**在批 A 范围——批 A 只恢复「读 canonical 数据」链路，binding 表的 legacy→canonical 迁移仍归批 B 决策。

**批 B — Node 门禁与冻结缺口（需授权 re-baseline 的部分）**
5. `generator-selector`/`generator-registry`/`composite`/`op-semantics`/`capability-resolver`/`kp-semantic-validator`/`capacity-inventory` 改走 runtime 单出口（B3/B5/B6，3 个冻结需授权）→ frozen-core re-baseline；或按 Phase E 门禁记录为 known-pending（保持现状）。
6. generator 绑定数据迁移：legacy 字段/ID（`pluginId` 93 个、legacy.id 464 条）→ canonical 契约（B5/B6/B7）——「数据迁移 vs 维持 known-pending」二选一并择时。
7. frozen-core 清单移除已删 2 文件（W12）。

**批 C — SVG/渲染统一（先定权威枚举再改）**
8. 归一 graphic type 单一权威（以 `GRAPHIC_RENDERERS` + `SUBJECT_TO_TYPE` 修订 schema `GRAPHIC_TYPES`，补 number-line/grid 渲染器或以别名归并）（W2）。
9. `data.graphic` 纳入 schema 校验；生成器统一写 `raw.data.graphic` → `sq.graphic`（W3）。
10. 删/修 `svg-templates.js`（补 `sort` 或整体移除）（W4）；合并双时钟（W5）；`dataStats` 命名对齐（W14）。

**批 D — 编排统一（去重 + 深链归一）**
11. 抽公共 `request-util.js`（requestKpIds/requestCount/planKey/MODE_ALIAS/subject-gate），api.js/generation-engine 引用（W7）。
12. practice.html 深链入口接入 `request-normalize`（W8）；practice.html 加载 `DifficultyOrchestrator` 或落地无回落策略（W9）。
13. 删死代码 `generation/orchestrator.js` + `resolvePoolKps`（W10/W13）。

> 注：B5/B6 与映射 pluginId（B7）本质同根——generator 绑定数据需从旧层 KP 字段/legacy ID 迁移到 canonical 契约——建议与批 B 一并决策「数据迁移 vs 维持 Phase E known-pending」。

---

## 6. 建议决策点

1. 批 A 是否现在做？（页面+compat+sw 可变、bundle 可变，工作量小、收益立即；B1/B2/B4 消除）
2. 批 B 涉冻结文件的授权 re-baseline，是否现在做，还是维持 Phase E known-pending 基线记录？
3. 批 C 的 graphic 权威枚举：以现有哪套为基准修订？（推荐以 `GRAPHIC_RENDERERS` + `SUBJECT_TO_TYPE` 合流，schema 降级为派生校验）
4. 批 D 去重/清理是否本轮一并执行？

---

## 7. 验证计划（每批落地后复跑）

- 批 A：`node dev/build-knowledge-runtime.js` + `node dev/build-strategy-bundle.js` + `node dev/build-presentation-bundle.js`（三重建）；浏览器式冒烟：Node 沙箱装载 knowledge-runtime + compat + strategy bundle，对快速/教师/竞赛池请求跑 `StrategyEngine.plan`，断言 kp 非空且不抛（§4.4 面全覆盖）。
- 全量：`node scripts/difficulty/frozen-core-baseline.js`（或等效 frozen 门禁）＋ `npm run verify`（kbl:verify 8 段链）＋ `verify-svg` 162 例 ＋ difficulty 合成回归（保序/|Δlevel|≤1）。
- 批 B re-baseline 后：`dev/check-frozen-core.js --baseline` 重锚 + access 审计（69 基线）重跑。