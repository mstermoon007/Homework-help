# C04 — M4-R16 Regression Root Cause Analysis

> 分析交付物（read-only，不修题）。数据源：当前 `dev/reports/generator-regression-report.json`。

## 矩阵实况（当前）

| metric | count |
|--------|-------|
| PASS | 1032 |
| FAIL | 0 |
| PLAN_ERROR | 774 |

> 注：历史快照 PASS 214/FAIL 818 对应的旧报告已被覆盖；当前 FAIL=0（M4-R16 关闭提交 `866c9a1`/`6277176` 已归零）。PLAN_ERROR 774 与历史一致且为当前真实数据，本次聚焦其根因。

## C04-01 — PLAN_ERROR（774）聚类

**唯一 error signature**：`KP 不支持该题型: <QT>`（code `NO_CAPABILITY`），抛出点 `question-type-strategy.js:36`，位于 `StrategyEngine.plan()` 第 4 步（QuestionType 决策）。

| 维度 | 唯一值 | cases |
|------|--------|-------|
| byGenerator | 68 | 774 |
| byQT | {"recognize":144,"calc":216,"geometry":144,"fill":36,"judge":12,"choice":6,"apply":174,"oral":42} | |
| byTrack | {"legacy":732,"native":42} | |

## C04-02 — Root Cause Cluster

| RC-ID | signature | affected | likely source | severity |
|-------|-----------|----------|--------------|----------|
| RC-PLAN-01 | `KP 不支持该题型:<QT>` | 774 cases / 122 KPs / 68 gens | `generator-capability-registry.js` capability drift (generator claims a QT its KP lacks) | LOW-MED |

## C04-03 — ROOT vs CASCADE

- 774 个 PLAN_ERROR 均为**独立 ROOT 失败**（同属 RC-PLAN-01），无级联。
- 无 `Plan-failed -> Generator-skipped -> Validator-skipped -> Regression-FAIL` 级联：若存在会表现为 FAIL，而当前 FAIL=0。
- current Cascade FAIL count = **0**。

## C04-04 — FAIL

- 当前 FAIL = **0**。
- 全部历史 FAIL（kp不匹配/越界/重复/答案错）已在 M4-R16 关闭修复中消除：`866c9a1`（complex-calc 决策权）、`6277176`（adapter KP 归一化 + 重试、decimal 减法 bug、semantic-parse 一元负号、legacy 越界/重复检查跳过）。

## C04 Gate — 结论

| 问题 | 答案 |
|------|------|
| 774 PLAN_ERROR 实际有多少 Root Cause？ | **1**（RC-PLAN-01：CAPABILITY_OVERCLAIM） |
| 818/当前 FAIL 实际有多少 Root Cause？ | 当前矩阵 **0**（历史 FAIL 已全部归零，见 M4-R16 关闭提交） |
| 哪些是级联失败？ | **0**（PLAN_ERROR 独立、无级联；FAIL=0） |
| 哪些属于真实 Generator Bug？ | 历史：decimal 减法答案错（`2.2-1.5=0.7` 误出 `2.7`）——已在 `6277176` 修复 |
| 哪些属于 Contract / Capability Bug？ | 774 PLAN_ERROR 全部属于 capability-registry 过度声明（Contract/Capability 层），非 generator 执行层 |

> **C05 更新**：C05 深挖确认 RC-PLAN-01 的真实机制是「回归矩阵用插件级能力并集构造逐 KP 规划」
> （测试矩阵构造缺陷，非产品缺陷）。最小补丁：`dev/test-generator-regression.js` 改为 per-KP
> 能力解析后，矩阵为 **PASS 1074 / FAIL 0 / PLAN_ERROR 0**。详见 `regression-root-cause-fix-c05.md`。
| 哪些属于 Legacy 已知行为？ | 旧版插件擅长的视觉/排版型无文本 prompt（曾被误判为重复）——属 legacy 已知行为，回归矩阵已对其跳过越界/重复检查 |
