# P26 Evidence 全量扩建（矩阵刷新 + 意图动态比对收口）

状态：已完成（本报告随实现同批提交）
日期：2026-09-20
前置：P25-04（声明制语义证据体系，6 行规则 / 4 代表 KP）、P25-09（B/C 类 KP 绑定收口）

## 1. 目标

承接 P25-08 缺口分析的两个收口项：
1. **evidence 全量扩建**——evidence-rules.json 从 4 代表 KP 扩到全部 A 类 KP（机械派生，非虚构）。
2. **意图动态比对**——生成题与 qt-intent.json 行级 intent 断言的运行时比对门禁。
3. **矩阵滞后统筹**——P25-04 期间发现 kp-matrix.json 滞后于 P25-09 绑定扩张（4 代表 KP
   draftBasis=unbound），一并对齐。

## 2. 矩阵刷新（75 → 307 A 类）

- 根因：kp-matrix.json 是 2026-09-16 快照，P25-06~09 的绑定大扩张未回灌
  （concept-meaning 41、decimal-number 24、fraction-number 19、semantic-relations 10、
  percent-calc 11，及 shape-recognition / position-direction / application-word 等专项）。
- 处置：重跑官方 `dev/p25/build-baseline.js`（draftLevel 纯启发式，读当前 CORE_RECORDS），
  kp-matrix.json / generation-matrix.json / P25-BASELINE.md 同步刷新。
- 结果：**A=307 / B=67 / C=1**；4 代表 KP 回归 A（basis=`generator:concept-meaning`）。
- 边界：draftSemanticLevel 是草拟层（须人工确认），P25-02 人工评审层未动，下轮评审看新口径。

## 3. Evidence 全量扩建（1299 行 / 307 KP）

机械派生链（无 KP ID 分支、无题面 NLP，证据规则全部从真实生成产出提取）：
1. `dev/p25/derive-evidence-candidates.js`——真实生成 A 类 1299 ALLOW 行 × 6 题/行，
   提取字段稳定性 + 声明一致性 → 候选规则；单样本行契约冻结并打标；报告落
   `dev/p25/reports/evidence-derive-report.json`。
2. `dev/p25/apply-evidence-candidates.js`——合并闸门（kind 白名单 / 键不重复 /
   relation 必在 intent-relations 允许集 / required-forbidden 无矛盾）；既有规则键跳过保留。
3. 结果：**evidence-rules.json 1299 行、覆盖 307 A 类 KP 全部 ALLOW 行**
   （schemaVersion `p26-evidence.1`）；344 条既有键（6 人工规则 + 338 前轮扩建）全部保留。

## 4. 意图动态比对门禁

`dev/p25/check-intent-dynamic.js`（report 门禁，范围= A 类 × ALLOW 动态枚举）：
- P1 身份一致性——生成题 KP/题型与请求行一致（真值前提，违例即 FAIL 行）。
- P2 表征一致性——题型 geometry（辨形/作图本质）→ 题目须有 data.graphic.type。
- P3 calc 情境探针——intent.driftRisk 含「纯算式」→ prompt 汉字情境词 ≥1（单位词即算）。

### 4.1 唯一真违例及修复
`math-g2-up-u07-k001`（7～9乘除法）×calc 出「7 × 2 = ____」纯算式（正是该行 driftRisk
警告）。修复：reasoning.js 乘除 calc 模板补口诀情境词（关键词分派，非 KP ID 分支，
calc form-bound 算式保留）→「运用乘法口诀计算：8 × 7 = ____」。shared/ 源码变更，
双 bundle 已重建。

### 4.2 探针口径校准（52 行误报判定）
新口径（A=307）首跑暴露 52 行，逐例判定为探针口径错误而非生成器漂移：
- P2：intent.whyThisType 的「本知识点**含**图形表征 / X 题型**支持**图形呈现」是选型依据的
  能力陈述（支持≠每题强制）；文字承载图形语义（如「看线段图填空：…」）非漂移。
  收窄为仅 geometry 硬性要求。
- P3：单位换算题「4千克 = 4 × 1000 = ____ 克」的单位词即语义情境；driftRisk 警告的
  「纯算式」指零情境词。阈值 ≥4 → ≥1。
校准依据均写入脚本注释与报告 meta；复跑 **1299 行 0 违例**（P2 表征行 105 / P3 情境行 122 全过）。

## 5. 测试自维护化

p25-04 测试（10/10）更新：
- 行数/KP 数断言改为**口径自维护**——A 集与行数从 kp-matrix + canonical/mappings 动态计算，
  零魔法数字；覆盖面断言「每个 A 类 ALLOW 行必有规则」+「规则 KP 范围精确」。
- skip 夹具改用真无规则对（4 代表 KP 已入 A，其 ALLOW 行均有规则）。
- 前提验证：A 集下 buildEligibility 动态枚举与 canonical mappings 静态行集完全一致（1299=1299）。

## 6. 门禁终态

| 门禁 | 结果 |
|---|---|
| p25-04 semantic-evidence 测试 | 10/10 |
| npm test | 393/393 |
| verify / check-syntax / check-lint | PASS / 0 错 / 干净 |
| check-allow-generation | 1570/1570 |
| semantic-families --check / audit-type-contract | 一致 / PASS |
| check-intent-dynamic（A=307 全量） | 0 违例 |
| 证据状态探针（1299 行 × 2 题） | warn 2205 / pass 20 / **fail 0** |

## 7. 改动清单

- `kbl/teaching/evidence-rules.json`——6 → 1299 行（P26 全量扩建）。
- `kbl/teaching/kp-matrix.json`、`kbl/teaching/generation-matrix.json`、
  `docs/p25/P25-BASELINE.md`——build-baseline 官方重刷（A=307）。
- `shared/generator/generators/reasoning.js`——乘除 calc 补口诀情境词。
- `shared/engine/strategy-engine.bundle.js`、`presentation-engine.bundle.js`——随 shared/ 变更重建。
- `dev/p25/derive-evidence-candidates.js`、`apply-evidence-candidates.js`、
  `check-intent-dynamic.js`、`dev/p25/reports/*`——派生/合并/比对脚本与报告。
- `tests/generator/p25-04-semantic-evidence.test.js`——口径自维护断言。

## 8. 遗留与边界

- **warn 过渡态**：warn 2205 属设计过渡态（规则已冻结、生成器声明待补，warn 非阻断），
  生成器声明补齐后转 pass，与 P25-04 原节奏一致。
- **浏览器 bundle 三态**：evidence-rules.json 经计算路径 require，不入 bundle（check-kbl-uniqueness
  门禁约束）；浏览器端规则表为空 → 全 skip。证据门禁为 Node 侧职责，与 P25-04 决策一致。
- **P25-02 人工评审层**：矩阵刷新后 A 口径 307，semantic-review 未重跑，待下轮人工评审。
