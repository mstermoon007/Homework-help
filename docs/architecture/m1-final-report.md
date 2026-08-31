# M1 Final Report — Knowledge Ontology 正式化

> 里程碑：M1「知识点本体正式化」收尾（M1-01 + M1-02.1~M1-02.3 + M1-R01~M1-R14）。
> 574 个 KnowledgePoint 已具备完整、统一、可审计的 Canonical 描述。
> **未接入线上生成、未修改任何业务生成逻辑、KnowledgeBank 查询语义零修改。**

## 1. M1 Objective

把 574 个知识点（math 556 / cn 15 / en 3）从「Legacy 富字段」升级为「Canonical KnowledgePoint 五类模型」，建立统一 Schema、完整性验证器、Canonical 访问层与综合 Gate，使任何题目生成请求都能拿到标准 KnowledgePoint，且所有数据可审计、可重复、可回滚。

## 2. M1 Scope

纳入：
- M1-01 统一 Ontology Schema
- M1-02.1 Operation / M1-02.2 Factual / M1-02.3 Error
- M1-R01 正式 Schema 文件落地
- M1-R02 KnowledgeBank 完整性验证器
- M1-R03 Canonical 访问层
- M1-R04 Knowledge 概念字段建模（concept / prerequisites）
- M1-R05 Generation Capability 建模
- M1-R06 574 完整扫描 + inventory
- M1-R07 五类 Coverage Report
- M1-R08/R09 统一 Gate + npm 命令
- M1-R10~R14 回归 / 测试 / 审计 / 冻结

## 3. KnowledgePoint 5-category Model

| 类 | Canonical 字段 |
|---|---|
| ① Identity | id, subject, grade, module{id,name}, identity{id,name,description} |
| ② Knowledge | knowledge.{concept, operations, factualContent, prerequisites} |
| ③ Difficulty | spiral{level,maxLevel}, cognition.level, numeric.range, structure.maxSteps |
| ④ Assessment | presentation.questionTypes, context.defaults, errors[] |
| ⑤ Generation | generation.capabilities[] |

单一事实来源：`shared/schemas/knowledge-point.schema.js`（VERSION=1）。`knowledge-ontology.js` 引用该 Schema，不复制逻辑。

## 4. Identity

- 574 / 574 完整（id / name / subject / grade / module 均由 Legacy → Normalizer 推导）。

## 5. Knowledge

- operations：**221 / 574（39%）** 已治理（M1-02.1，18 canonical + 54 aliases）
- factualContent：**22 / 574（4%）** 已治理（M1-02.2，0 策略字段污染）
- concept：**0 / 574** 显式建模（Canonical 字段存在；legacy 无该字段 → 默认 null，不猜测）
- prerequisites：**559 / 574** 从 Legacy 透传；无法确认者保留 `[]`
- 严禁：根据名称/年级/模块/插件名自动推断先修关系（属教育知识图谱，不在 M1）。

## 6. Difficulty

- 574 / 574 完整：spiralLevel、maxSpiralLevel、cognitiveLevel、numberRangeDefault、maxStepsDefault 均由 Legacy 字段对齐 `difficulty-static.js` 语义映射。

## 7. Assessment

- questionTypes：**574 / 574**
- context：**574 / 574**
- errors：**48 / 574（10 unique patterns）**（M1-02.3，0 invalid / 0 dup / 0 unknown category）

## 8. Generation

- capabilities：**574 / 574** 由既有数据推导：
  - `applicable_question_types` / `type` → capability（calc→calculation, fill→fill, choice→choice, apply→contextual, …）
  - `max_steps_default > 1` → `multi-step`，否则 `single-step`
- 仅能力声明，**不含** generateFunction / generator / pluginFunction / strategy / difficulty strategy。

## 9. 574 KP Coverage

| 维度 | 覆盖 |
|---|---|
| Identity | 574 / 574 |
| Difficulty | 574 / 574 |
| Knowledge.operations | 221 / 574 |
| Knowledge.factualContent | 22 / 574 |
| Knowledge.concept | 0 / 574（字段存在，数据 null） |
| Knowledge.prerequisites | 559 / 574 |
| Assessment.questionTypes | 574 / 574 |
| Assessment.context | 574 / 574 |
| Assessment.errors | 48 / 574 |
| Generation.capabilities | 574 / 574 |

未达 100% 的维度（operations / factualContent / errors / concept）**不强行猜测补齐**，按 UNKNOWN 保留空值，符合 M1 原则。

## 10. Validation Results

- Schema 扫描（M1-01）：**ERROR 0 / WARNING 574**
- Operation Gate：**0 invalid / 0 alias cycle / 221 governed**
- Factual Gate：**0 invalid / 0 策略字段污染**
- Error Gate：**0 invalid / 0 dup / 0 unknown category / 10 unique**
- KB 完整性验证（M1-R02）：**ERROR 0 / WARNING 1685**
- Canonical Access（M1-R03）：`KnowledgePoint.get(id)` 冒烟测试 PASS；未知 id 返回 null
- 综合 M1 Gate（verify:m1）：**PASS**

## 11. Test Results

`node --test tests/ontology/*.test.js`：

- schema / normalizer / validator / compatibility / operation / factual-content / errors
- 新增：knowledge-point / generation-capability / knowledge-bank-verification

合计：**49 PASS / 0 FAIL**（含真实 math/cn/en、Legacy→Canonical、重复调用一致、无 Math.random）。

## 12. M0 Regression

`npm run verify` = **7/7 PASS**：语法检查 234 文件 0 错、KB 契约 574 ERROR 0、插件契约 99 ERROR 0、难度双轨 0 问题、Golden 11/11、Snapshot 漂移 0、架构护栏 ERROR 0。

## 13. Architecture Compliance

- 未修改 `practice.html` / `shared/difficulty.js` / `shared/difficulty-static.js` / `shared/knowledge-bank.js` / `plugins/*` / `shared/render.js` / `shared/svg/*`。
- `KnowledgeBank` 所有既有查询方法（findGrade / getEntries / getCoverage / coverageFromRegistry / ensureKnowledgeData）行为不变；新增访问层 `shared/knowledge-point.js` 为只读封装，无缓存、无语义变化、不接入 UI。
- 仅 Ontology 层（knowledge-ontology*.js、schemas/knowledge-point.schema.js、knowledge-point.js、operation/factual/error 字典与 maps）与 `dev/` 工具、测试被新增/修改。
- 新代码无 `Math.random`，Normalizer 同输入同输出（可重复）。

## 14. Known Warnings

- 1685 条 KB 完整性 WARNING（缺 spiral_level / cognitive_level / number_range / max_steps / applicable_question_types / context_default / operations / factualContent 等）——属数据稀疏，非错误，不阻断。
- concept 全量为 null（legacy 无该字段），prerequisites 多数透传空数组。
- M0 已知技术债（与 M1 无关，未顺手修复）：difficulty-static 休眠、SVG 共享模块未全入生产页、math-g2-column 答案 `"6……6"`、knowledgePointId 漂移（math-unit-convert / math-geometry / chinese-pinyin）。

## 15. Known Technical Debt

- `KnowledgePoint` 的 `concept` 维度待后续（知识图谱阶段）填充，当前不猜测。
- Factual/Error 覆盖率低（4% / 8%）属首轮治理，按证据逐步扩充，不批量伪造。
- 建议后续（M2+）阶段再建设 Strategy Engine / Question Planner / Difficulty Strategy / Learner Model。

## 16. Explicit Non-Goals

本里程碑**未做**（仅记录，不解决）：
- ❌ Strategy Engine / Question Planner
- ❌ Difficulty Strategy / Adaptive Difficulty / Spiral Strategy
- ❌ Error-aware Generation / 新题目生成算法
- ❌ Plugin 改造 / Legacy Adapter 接线上
- ❌ practice.html 接入 Ontology / difficulty-static 接入 UI
- ❌ 修改 KnowledgeBank 原始数据

## 17. M1 Freeze Decision

执行：
```
npm run verify            -> 7/7 PASS
npm run verify:m1         -> PASS
```
且满足：

- Schema Error = 0
- KB Contract Error = 0
- Operation Error = 0
- Factual Error = 0
- Error Ontology Error = 0
- Canonical Access Error = 0
- Generation Capability Error = 0

WARNING 允许存在。

```text
┌─────────────────────────────────┐
│ M0 Baseline                     │ FROZEN ✅
│ M1-01 Ontology Schema           │ FROZEN ✅
│ M1-02.1 Operation               │ FROZEN ✅
│ M1-02.2 Factual Content         │ FROZEN ✅
│ M1-02.3 Error                   │ FROZEN ✅
│ M1-R01~R14 五类模型 + Gate      │ FROZEN ✅
└─────────────────────────────────┘
                 ↓
          M1 = COMPLETE / FROZEN
                 ↓
        再启动下一阶段设计（M2）
```

**M1 完成定义**：Schema 已建立 + Operation/Factual/Error Ontology 已建立 + 574 KP 已扫描 + 五类模型完整 + 所有数据可审计 + 非法数据 = 0 + M0 = PASS + 线上生成逻辑 = 0 修改。非「574/574 所有字段填满」。
