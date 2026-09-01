# M1-M4 旧债务扫描 — 2026-09-01（当前态）

> 扫描方式：结合历史 audit（R-A07..R-A11）+ m4-final-gate.json + m4-r20-responsibility-report.json，
> 并对每项**在当前工作树（HEAD=6277176）实测复验**（冻结核心 93/93 无变更，M1/M2/M3/M4 gate 均 exit=0）。

## 0. 门禁总览（当前实测）

| Gate | 状态 | 说明 |
|------|------|------|
| verify:m1 | exit 0 | M1 Ontology 统一门禁 PASS |
| verify:m2 | exit 0 | M2 统一门禁 PASS |
| verify:m3 | exit 0 | M3 Strategy→Plugin 管道 PASS |
| verify:m4 | exit 0 | M4 全门禁 PASS（含 R17/R18/R20/R21） |
| check-frozen-core | 93/93 | 无变更 |
| test:regression | PASS 1032 / FAIL 0 / PLAN_ERROR 774 | 回归已绿（FAIL=0） |

**结论：历史 P0 阻塞（P0-001 浏览器运行时、M4-R02 adapter 契约、M4-R16 回归、P-012 基线）均已关闭。**
未关闭的均为 **已记录但非阻塞** 的技术债（多数属 `KNOWN_DEBT` / `needs-fix` / 迁移剩余）。

---

## 1. 已关闭（历史债务 → 现已解决）

| 债务 | 历史状态 | 当前实测 | 关闭提交 |
|------|---------|---------|---------|
| **P0-001** PresentationEngine 浏览器未加载，live generate() 静默空集 | P0 阻塞 | practice.html 现加载 `presentation-engine.bundle.js`（C01 提供 global.PresentationEngine） | cae0ad7 |
| **M4-R02** adapter `svg:` FORBIDDEN + `answerMode:'choice'` | P0 阻塞 | adapter 已无 `svg:`/`answerMode:'choice'`，`mapInputType` 收敛到 read-aloud/input | 00ffc51 |
| **M4-R16** 回归永不绿（818 FAIL） | P0 阻塞 | **FAIL=0**，PASS 1032 | 866c9a1 + 6277176 |
| **P-012** 冻结基线锚到脏工作树 | KEEP_OPEN | 基线已重锚定到干净 HEAD，93/93 无变更 | 866c9a1 |
| **M4-R18** complex 决策权冲突 | 已记录 | complex-calc 唯一 owner，180 样例自洽 | 866c9a1 |
| **Legacy 依赖**（可下线 3/100） | FAIL | `check-legacy-dependencies.js` PASS（0 legacy 执行引用） | — |

---

## 2. 未关闭的旧债务（仍存在）

### A. M4 final gate 记录的固有 FAIL 项（4 项）
来源 `dev/reports/m4-final-gate.json`（R26 快照）。这些项 gate PASS 属「盘点完成、整改清单产出」，**整改未完成**：

| # | 债务 | 当前量 | 波及 | 类型 |
|---|------|--------|------|------|
| M4-A1 | **Generator 自判全局难度**（difficulty-decision 命中 CORE 职责） | 19 插件 | math-area/data-stats/decimal/fraction/g4-vertical/g6-calc/g6-oral/geometry/logic-reasoning/make-ten/money/number-sense/oral/patterns/picture-equations/shapes/statistics/unit-convert/word-problems | Contract/Capability 违规（legacy 已知行为） |
| M4-A2 | **Generator 读取全局自适应**（global-adaptive） | 1 插件 | math-comprehensive | Contract/Capability 违规 |
| M4-A3 | **KP 强依赖具体 Plugin（未迁移 KP）** | **550 KP / 94 插件** | 数学为主 | 迁移剩余（核心债务源） |
| M4-A4 | **SemanticQuestion Validator 未接入**（`dev/validate-question.js` 缺失） | 1 缺口 | M4-R21 | 基础设施缺口 |

### B. M4-R20 职责盘点 `needs-fix`（25 插件）
来源 `m4-r20-responsibility-report.json`：compliant 68 / **needs-fix 25** / 待删 1 / 未分类 3。
典型命中：`dom-manipulation`（插件自操作 DOM，如 english-alphabet:118-120、math-area:314-316）+ `difficulty-decision`（见 M4-A1）。
> legacy 插件自带 DOM/SVG 渲染契约，属已知 legacy 行为；native 化后应由 generator 数据 + 渲染层接管。

### C. 迁移剩余（R21 状态机）
- **未迁移 KP = 550**（强依赖具体插件）→ 全部 legacy；仅 21 个 KP（ALL_MIGRATED）走 native。
- 状态机：analyzed 65 / candidate-generator 15 / verified 14 / adapter 3 / removed 3；**已可下线 0**。
- 15 个 needsRegression 插件（visual/geometry/apply）无 native 覆盖，为已知边界外限制。
- decommission-log：`math-oral` blocked（safetyPassed=false，即无法安全下线）→ **未下线**。

### D. 运行时/架构 KNOWN_DEBT

| ID | 债务 | 位置 | 影响 |
|----|------|------|------|
| KD-1 | **双轨难度中心 dormant**：`difficulty-static.js` 仍被 practice.html:163 加载 | practice.html:162-163 | legacy 静态难度中心与策略层双主，Static 休眠（difficultyParams==null） |
| KD-2 | **capability-resolver 无独立全局** | strategy-engine.bundle.js 内嵌 | 仅 `catalog-utils.js:65` 引用 `window.CapabilityResolver`（UNKNOWN 兜底） |
| KD-3 | **Math.random 技术债（R4 架构规则 WARNING）** | shared/question-id.js:8, bundle, `_template.js:22`, g1-multiplication-table.js:12 | 随机源未统一走注入 RNG |

### E. 运行时/产物同步债务（新发现）

| ID | 债务 | 状态 | 影响 |
|----|------|------|------|
| KD-4 | **`shared/strategy-engine.bundle.js` 在 HEAD(6277176) 为陈旧产物**：未包含 M4-R16 adapter 修复（KP 归一化 + 重试 `checkBatchQuality`），仅 dev gate（`build-strategy-bundle.js`）会从源码重建 | 实测：HEAD bundle 无 `checkBatchQuality`；工作树重建后已含（verify:m3/m4 触发） | **浏览器运行时（practice.html:174 加载 bundle）会跑旧 adapter**——M4-R16 的 kp不匹配/回归修复未打进发布产物。门禁因先重建 bundle 再校验而掩盖了该漂移 |

> 修复方向（未执行，仅记录）：提交重建后的 `strategy-engine.bundle.js`，或让 `test:regression`/冻结校验对**已提交产物**而非临时重建结果做断言，杜绝「源码已修、产物陈旧」的静默漂移。

### F. 低危 / 误报（可保持开放）
- **phantom `require('../render.js')`**（presentation-engine.js:180,204）— masked by PluginUtil guard，LOW。
- **死代码 `generateViaEngine()`**（practice.html:376/388/403）— never invoked，可删除。
- **docs/seo-monitoring.md:21** 引用缺失脚本 `enrich-knowledge-bank.js`。
- **arithmetic.js:63-65** 低危 fallback 操作重判（仅 plan 缺 operation 时）。

---

## 3. 债务量化汇总

| 类别 | 数量/项 | 优先级 |
|------|--------|--------|
| 冻结层/运行时 P0 | 0 | — |
| Contract/Capability 违规（A1+A2） | 20 插件 | 中（legacy 已知） |
| 未迁移 KP（A3） | 550 KP / 94 插件 | **高（长期）** |
| Validator 缺口（A4） | 1 | 中 |
| R20 needs-fix 插件 | 25 | 中 |
| 未下线插件 | 100 中 0 可下线（math-oral blocked） | 低 |
| 运行时 KNOWN_DEBT | 3（双轨难度/cap-resolver global/Math.random） | 低 |
| **产物同步漂移（KD-4）** | **1（bundle 陈旧，浏览器跑旧 adapter）** | **高（发布风险）** |
| 低危/误报 | 4（phantom/死代码/文档/fallback） | 低 |

---

## 4. 结论

M1-M4 的**阻塞型债务已全部关闭**（冻结层无 P0；npm test / verify:m1..m4 / 回归 / frozen-core 全绿）。

存留债务以**迁移剩余 + 职责合规**为主，均非阻塞、属已知 legacy 行为或长期技术债：
1. **550 未迁移 KP** 是核心债务源（需 native 生成器覆盖，visual/geometry/apply 15 插件为边界外）。
2. **20 插件 Contract/Capability 违规**（自判难度/全局自适应）——legacy 已知，native 化后收敛。
3. **Validator 未接入** + **R20 25 个 needs-fix 插件** 为待整改基础设施/职责项。
4. **产物同步漂移（KD-4）**：提交态 `strategy-engine.bundle.js` 陈旧，浏览器会跑旧 adapter——发布前需重建产物，属高优先。
5. 运行时 KNOWN_DEBT（双轨难度/cap-resolver global/Math.random）+ 低危幽灵引用为低优先。

> 注：此处仅扫描记录，未做任何修改（read-only）。
