# P25-14 375 KP 教育覆盖率报告

状态：已完成（本报告随实现同批提交）
日期：2026-09-20
前置：P25-03/04/05/06/07 + P27-09/10/11/12（全部教学语义扩展层落地）

## 1. 目标

任务书 P25-14 红线："禁止用'有字段'冒充'已实现'。只有实际被 Generator + Validator
消费的数据才计为 implemented。"

7 维覆盖率统计：
1. KP semantic coverage
2. QuestionType semantic coverage
3. Generator semantic coverage
4. Evidence coverage
5. Variation coverage
6. Misconception coverage
7. Learner feedback coverage

## 2. 实现

### 2.1 脚本

`dev/p25/build-coverage-report.js`

用法：`node dev/p25/build-coverage-report.js [--strict]`
产出：`dev/p25/reports/coverage-report.json` + stdout 摘要

### 2.2 「被消费」判定

对每个 kbl/teaching/*.json 数据文件，扫描生产代码（shared/generator、
shared/validator、shared/strategy、shared/learner、shared/engine 下的 .js）
是否引用该文件。引用模式覆盖：

- 完整文件名 `X.json`（直接 require 路径）
- 带引号的 base name `'X'` / `"X"`（loadTeaching('X') 函数参数模式）

仅当生产代码至少有一处读引用，才计 `consumedByProduction: true`，否则
`status: 'declared-only'`。

### 2.3 字段级辅助证据

每个维度附加代表性字段名检测（属性访问 `.field` 或 `['field']`），作为辅助
证据。避免通用字段名误判（如 `axis`、`variant` 不单独作为消费凭证）。

## 3. 当前基线快照

```
基线：KP=375 / ALLOW=1570 / A 类=307
------------------------------------------------------------
✓ QuestionType semantic coverage — implemented 2/2
    qt-intent.json → 3 处消费（strategy-engine + semantic-parameters）
✓ Generator semantic coverage — implemented 2/2
    semantic-families.json → 2 处消费（semantic-parameters）
    generator-registry.js → 27 处消费
✓ Evidence coverage — implemented 1/1
    evidence-rules.json → 4 处消费（kp-semantic-validator）
✓ Misconception coverage — implemented 2/2
    misconception-profiles.json → 2 处消费（variation-directive）
✓ Learner feedback coverage — implemented 2/2
    learner-model.js → 6 处消费
    practice-result.js → 3 处消费
⚠ KP semantic coverage — implemented 0/1
    ✗ kp-matrix.json（declared-only；dev 基线报告产物，非生产消费对象）
⚠ Variation coverage — implemented 1/2
    ✓ variation-directive.js → 3 处消费
    ✗ variation-profiles.json（declared-only；P27-09 观察产物，仅 dev/test 消费）
------------------------------------------------------------
维度总数：7，全 implemented：5
declared-only 字段 2 项（均为 dev-only 基线/观察产物）
```

## 4. 2 项 declared-only 评估

### 4.1 kp-matrix.json

P25-00 基线矩阵，汇总 375 KP 的 draftSemanticLevel（A/B/C/D）、domain、
gradeBook 分布。生产运行时使用 `KnowledgeContext` 直读 `kbl/root/*` 与
`kbl/data/*`，不读 kp-matrix.json。该文件是 dev 报告产物，declared-only
是正确状态。

### 4.2 variation-profiles.json

P27-09 VariationProfile（5 观察轴：unknown/numeric/context/representation/
structure）。当前消费方仅在 dev/p27/ 与 tests/，生产运行时由
`variation-directive.js` 直接读 `misconception-profiles.json`（P27-10）转向
变式，未读 variation-profiles.json。该文件为 dev 观察产物，declared-only
是当前真实状态。

如后续 P28 将 VariationProfile 接入生产决策，应同步更新本报告。

## 5. 测试

`tests/generator/p25-14-coverage.test.js` — 5 例全 PASS：

1. 脚本产出 coverage-report.json
2. 含 7 维覆盖率统计
3. 基线数字匹配 375 / 1570 / 307
4. 每个 dimension fields 含 status 字段
5. 至少 5/7 维全 implemented（允许 2 项 dev-only declared-only）

## 6. CI 集成（B4 接线）

`--strict` 模式：任一 declared-only 字段 → exit 1。当前基线有 2 项已知
declared-only（kp-matrix.json + variation-profiles.json），CI 接线时需用
allowlist 豁免，或仅对新增 declared-only 字段阻断。
