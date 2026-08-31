# M1-02 Semantic Governance Report（Operation / Factual / Error）

> M1-02.1 ~ M1-02.3 完成 + M1-02.4~M1-02.13 收尾/冻结。
> 仅治理 Ontology 数据，**未接入线上生成**，**未修改任何业务生成逻辑**。
> 本阶段严格锁定在 M1 范围，未扩张至 Strategy Engine / Planner / Difficulty / Learner 等后续模块。

## 1. M1-02 Objective

对 574 个知识点（math 556 / cn 15 / en 3）执行第一轮核心语义治理：建立 Operation、Factual Content、Error 三套 Ontology Vocabulary，通过 Normalizer 注入 Canonical Ontology，可审计、可重复、可回滚。不填满所有字段，只确保「Schema 建立 + 三套 Ontology 建立 + 574 扫描 + 可审计 + 非法数据 = 0」。

## 2. Execution Scope

- ✅ M1-02.1 Operation Ontology
- ✅ M1-02.2 Factual Content Ontology
- ✅ M1-02.3 Error Ontology
- ✅ M1-02.4 综合语义治理检查（dev/check-ontology-semantic.js）
- ✅ M1-02.5 最终质量分级（A/B/C/D，不重设计）
- ✅ M1-02.6 生成最终治理报告（ontology-semantic-governance.json，574 KP 全覆盖）
- ✅ M1-02.7 综合 Gate（dev/verify-m1-semantic.js）
- ✅ M1-02.8 package.json 统一入口（verify:m1 指向 verify-m1-semantic.js）
- ✅ M1-02.9 M0 回归（npm run verify = 7/7 PASS）
- ✅ M1-02.10 M1 全量测试（Ontology tests 38 PASS / 0 FAIL）
- ✅ M1-02.11 架构差异审计（仅记录不处理）
- ✅ M1-02.12 本最终报告
- ✅ M1-02.13 最终冻结检查

## 3. Operation Ontology

- Canonical Vocabulary：**18**
- Alias 规则：**54**（normalize / hasAliasCycle）
- Alias Cycle：**0**
- 574 覆盖率：**221 / 574（39%）**
- Unresolved（允许，可追踪）：**353**
- **Invalid Canonical Operation：0** / **Unknown Canonical：0**

未治理的 353 个为题型包装型（choice/judge/matching）、综合练习、竞赛类插件，按原则 #3 不猜测其操作语义。

## 4. Factual Content Ontology

- Fact Types：formula / rule / concept / vocabulary / unit / table / classification / relationship / notation / range / system / count / alphabet
- 覆盖率：**22 / 574（4%）**；Empty：552
- **策略字段污染（Strategy Field Contamination）：0**
- **Invalid：0**
- 置信度 high/medium/low/unverified：**7 / 14 / 1 / 552**

仅纳入有稳定教学依据的 facts（乘法表 1-9、人民币单位 元角分、字母 26、拼音声韵调、常见单位集合等）。空事实合法——「空事实优于错误事实」。

## 5. Error Ontology

- Categories：concept / operation / calculation / notation / unit / reading / writing / structure / reasoning / attention
- **Unique Error Patterns：10**
- 覆盖率：**48 / 574（~8%）**；Without：526
- **Invalid：0** / **Duplicate：0** / **Unknown Category：0**
- Categories 实际分布：calculation 32 / notation 15 / unit 9 / reading 5 / writing 2 / operation 3 / concept 1

仅纳入稳定公认错误模式（进位遗漏、数位对齐、单位混淆、标调错误、口诀混淆等）。不批量制造、不写具体题目答案。

## 6. 574 KP Governance

逐 KP 记录于 `dev/reports/ontology-semantic-governance.json`，结构：

```json
{
  "version": 1,
  "generatedAt": "<ISO>",
  "total": 574,
  "operation": { "covered": 221, "unresolved": 353, "invalid": 0, "canonical": 18, "aliases": 54 },
  "factualContent": { "present": 22, "empty": 552, "invalid": 0, "confidence": {...} },
  "errors": { "withErrors": 48, "without": 526, "invalid": 0, "unique": 10, "categories": {...} },
  "quality": { "A": 22, "B": 20, "C": 532, "D": 0 },
  "unresolved": { "operations": 353, "factualEmpty": 552, "errorEmpty": 526, "qualityC": 532 },
  "warnings": [...],
  "records": [ { "knowledgePointId", "operations", "factualContent", "errors", "grade" }, ... ]
}
```

每个 KP 均可追溯其 operations / factualContent / errors / quality 来源（maps + legacy）。

## 7. A/B/C/D Quality Distribution

- **A（核心语义完整可靠）**：22 — Operation + Fact + Error 均有可靠证据
- **B（核心生成语义基本完整）**：20 — Operation 明确，Fact/Error 部分
- **C（可归一化但核心语义缺口）**：532 — 仅有 Operation
- **D（冲突/非法/无法解释）**：0

D = 0 ⇒ 无语义冲突进入后续 Strategy Engine。禁止为冲等级而猜测补数据；资料不足即保持 C。

## 8. Test Results

| 项目 | 结果 |
|---|---|
| `node --test tests/ontology/*.test.js` | **38 PASS / 0 FAIL** |
| `verify:m1:ontology` | PASS（Schema 0 ERROR） |
| `verify:m1:operation` | PASS（0 invalid / 0 alias cycle） |
| `verify:m1:factual` | PASS（0 invalid / 0 污染） |
| `verify:m1:error` | PASS（0 invalid / 0 dup / 0 unknown cat） |
| `verify:m1`（综合 Gate） | PASS |

## 9. M0 Regression

`npm run verify` = **7/7 PASS**：

- 语法检查：227 文件，0 错误
- 知识库契约：574 KP，ERROR 0
- 插件契约：99 插件，ERROR 0
- 难度双轨：Legacy 锁定 / Static 独立可用，0 问题
- Golden Path：11/11
- Snapshot 基线：9 Case，漂移 0
- 架构护栏：硬规则 ERROR 0

确认 `practice.html` / `difficulty.js` / `difficulty-static.js` / `knowledge-bank.js` / 插件 / SVG 均无因 M1 治理产生的业务行为变化。

## 10. Architecture Compliance

- 未修改 `practice.html`、`shared/difficulty*.js`、`shared/knowledge-bank.js` 查询语义、任一插件 `generateQuestions`、`shared/svg/*`、`shared/storage.js`。
- 全部新增/修改位于 Ontology 层 + `dev/` + `tests/`，未接入 UI。
- 新代码未使用 `Math.random`；Normalizer 对同一输入产生相同输出（可重复）。
- 事实优先推断从严，无按名称猜测的伪造事实。
- Ontology 与 Generator 严格分离。

## 11. Known Technical Debt（仅记录，不处理）

1. `difficulty-static.js` 仍为休眠态（`knowledgePointMeta` 未从 UI 进入生成链）→ Static Difficulty = dormant / Legacy Difficulty = online。
2. SVG 共享模块（svg-geometry / svg-calculation / svg-make-ten / svg-chinese / svg-en）尚未全部进入生产页面。
3. `math-g2-column` 竖式自身答案检查问题：`"6……6"` 未通过自身 check。
4. KnowledgePointId 漂移：`math-unit-convert` / `math-geometry` / `chinese-pinyin` 的 `knowledgePointId` 与 KnowledgeBank 不匹配。

上述均在各 `*governance.json` / `operation-inventory.json` 中可追溯，不在 M1 顺手修复。

## 12. Explicit Non-Goals

本阶段明确**未做**（仅记录，不解决）：

- ❌ Strategy Engine / Question Planner
- ❌ Difficulty Strategy / Learner Model
- ❌ Generator 改造 / practice.html 改造
- ❌ Legacy Adapter 接入线上
- ❌ Question Type Ontology 扩展 / Context Ontology 扩展 / Cognition Ontology 重构
- ❌ Knowledge Capability / Runtime Resolver
- ❌ 修改 KnowledgeBank 原始数据

## 13. M1 Freeze Decision

执行 `npm run verify && npm run verify:m1:ontology && npm run verify:m1:operation && npm run verify:m1:factual && npm run verify:m1:error && npm run verify:m1` 全部 PASS ⇒ **M1 = COMPLETE / FROZEN**。

```text
M0 Baseline                     FROZEN ✅
M1-01 Ontology Schema           FROZEN ✅
M1-02.1 Operation               FROZEN ✅
M1-02.2 Factual Content         FROZEN ✅
M1-02.3 Error                   FROZEN ✅
M1-02 Final Governance          FROZEN ✅
                 ↓
          M1 COMPLETE / FROZEN
                 ↓
        再启动下一阶段设计
```

**M1 完成定义**：Schema 已建立 + Operation/Factual/Error Ontology 已建立 + 574 KP 已扫描 + 所有数据可审计 + 非法数据 = 0 + M0 = PASS + 线上生成逻辑 = 0 修改。非「574/574 所有字段填满」。
