# P27-11 Learner Error Model 接线（Misconception→NextVariation）

状态：已完成（本报告随实现同批提交）
日期：2026-09-20
前置：P25 任务书 P25-11 缺口（error-model.js 有 8 类错因记录链、无消费链：未接到 Misconception→NextVariation）

## 1. 目标

接通 error-model 的记录链到变式决策链：
```
LearnerModel.getErrors（已有记录链）
  → MisconceptionProfile overlay（P27-10）× triggerPattern 过滤 → 变式指令
  → AdaptiveStrategy R18 变体转向（数据驱动，非硬编码）
  → QuestionPlan.variationDirectives 挂载
  → Generator 通用消费（numeric 轴 → 运算数收窄）
```
红线：不加 KP ID 分支、改 shared/ 必重建双 bundle。

## 2. 消费链全貌

```
LearnerModel.getErrors（error-model 8 错因聚焦，已有记录链）
  → shared/strategy/variation-directive.js resolveForPlan：
      KP 的 MisconceptionProfile（P27-10 overlay）× triggerPattern
      （计划期可判定谓词：题型 ∈ canonical 7 类 + 运算标签归一）→ 变式指令
  → AdaptiveStrategy.resolve：指令转向 R18 六变体（数据驱动，非硬编码）
  → StrategyEngine：指令挂 QuestionPlan.variationDirectives（trace.learner 同步可溯）
  → Generator 通用消费：axis='numeric' → 运算数收窄 numberRange 下半区
      （题面报告 numberRange 保持原值，validator check#4 边界不动）
```

## 3. 变更清单

| 文件 | 变更 |
|---|---|
| shared/strategy/variation-directive.js（新） | 指令解析唯一入口；overlay 计算路径 require（evidence-rules 先例，浏览器 fail-open）；normalizeOps 归一符号/标签/KBL 运算名三种形态 |
| shared/strategy/adaptive-strategy.js | variantFor 增第 4 参（有错因聚焦 + 有指令 → 指令转向）；resolve 回传 variationDirectives |
| shared/strategy/strategy-engine.js | 语义解析块上提至 learnerDecision 前；运算 token 回退链 `arithSem → complexSem → kp.operations`（KBL 事实标签）；指令挂 questionPlan + trace |
| shared/generator/generators/arithmetic.js | 通用消费：axis='numeric' 指令 → genRange 收窄下半区（无 KP 分支）；报告 numberRange 不变 |

## 4. 端到端实测（math-g2-up-u07-k001 × calc × 口诀混淆）

learnerProfile 携带 `errorPatterns.口诀混淆` → plan.variationDirectives = `[{errorType:
口诀混淆, variant: 数值, axis: numeric, basis: semantic.operations∋乘除; grade=g2≤g3（表内段）}]`，
plan.variant 由「迁移」（高掌握默认）转向「数值」，12 题运算数全部落入 [1,50] 下半区、
题面 numberRange 仍报告 [1,100]。

**关键修正**（端到端首跑 0 指令的根因）：该 KP `source.legacyType='calculation'` 不在
kp-arithmetic-semantics 任何 profile → arithSem/complexSem 均 null → 运算谓词无从命中。
修复为回退链追加 `kp.operations`（KBL 事实字段，["multiplication","division"]，与
trigger 词汇同源）——数据驱动，非 KP ID 分支。

## 5. 浏览器降级边界（先例一致）

overlay 经计算路径 require，bundle 不内联 kbl 数据（check-kbl-uniqueness 门禁）→
浏览器 fail-open（无指令=现状行为）。完整消费链由 Node 测试与 dev 门禁覆盖；
测试环境通过 `StrategyBundle.modules` 注册表注入 overlay 模拟数据可得（不触碰 bundle 文件）。
与 P25-04 evidence-rules、P25-07 type-contracts 的「教学语义 Node/门禁侧全链、浏览器优雅降级」
先例完全一致。

## 6. 交付文件

**新增**
- shared/strategy/variation-directive.js —— Misconception→NextVariation 指令解析
- tests/generator/p27-variation-directive.test.js（8）

**修改**
- shared/strategy/adaptive-strategy.js —— R18 指令转向 + variationDirectives 回传
- shared/strategy/strategy-engine.js —— 指令解析（运算 token 回退链）+ plan/trace 挂载
- shared/generator/generators/arithmetic.js —— numeric 轴通用消费
- shared/engine/strategy-engine.bundle.js、presentation-engine.bundle.js —— 双 bundle 重建

## 7. 遗留与边界

- 浏览器侧指令链 fail-open（数据不内联 bundle）——如需浏览器生效，需后续在
  knowledge-runtime/页面脚本层注入 kbl/teaching 数据（独立专项，不在本次范围）。
- 生成器消费当前落地 arithmetic 族（numeric 轴）；context/representation 轴的消费面
  留给后续（指令已随 plan 下发，生成器侧按轴扩展即可，无需改 strategy 层）。
