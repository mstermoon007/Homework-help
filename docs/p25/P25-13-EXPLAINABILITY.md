# P25-13 QuestionPlan Explainability Metadata（"下一题为什么这样出"可解释链）

状态：已完成（本报告随实现同批提交）
日期：2026-09-20
前置：P25-03（qt-intent.json 1570 行五问）、P27-11（variationDirectives）、P27-12（KnowledgePracticeState）

## 1. 目标

系统内部必须可以回答："为什么给孩子出这道题？"

为 QuestionPlan 增加只读 Explainability Metadata，让每一道题的产出携带可追溯的
决策踪迹：知识点 / 语义目标 / 题目意图 / 题型 / 难度 / 变式 / 选型原因。

**红线**：禁止改变实际题目生成逻辑；只增加可追踪信息。

## 2. 字段设计

### 2.1 schema 扩展（shared/strategy/question-plan.js）

`validateQuestionPlan` 新增可选字段 `explainability`（对象），类型守卫：

| 子字段 | 类型 | 来源 |
|--------|------|------|
| knowledgePoint | string | `kp.id + ' ' + kp.name` |
| semanticTarget | string | qt-intent.json 行的 `intent.trainsWhat`，无则降级 `kp.module` |
| questionIntent | string | qt-intent.json 行的 `intent.whyThisType`，无则 `'unknown'` |
| questionType | string | 规范题型 id |
| difficulty | number | `finalDifficulty`（1-10）|
| variation | string | `learnerDecision.variant`，无 learnerProfile 时 `'fixed'` |
| selectionReason | string | 拼装：`KP=...; intent=declared|unknown; variant=...; errorFocus=...; generator=...` |

子字段全可空（不强制必填）。`explainability` 不在 forbidden 列表中（与
`svg/html/generate` 等禁止字段并列校验，不冲突）。

### 2.2 注入点（shared/strategy/strategy-engine.js）

在 QuestionPlan 构建（L870-L940）之后、`StrategyValidator.validatePlan`（L946）
之前注入：

```js
questionPlan.explainability = buildExplainability(kp, questionType, finalDifficulty,
  learnerDecision, selectedGenerator);
```

全部字段从已计算的局部变量派生，**禁止重新求解**（避免重复核验）。

### 2.3 qt-intent.json 加载策略

`getQtIntentRow(kpId, qt)` 惰性构建索引（`kpId|qt → row`）。require 路径用
字符串拼接计算（`'../../' + 'kbl/' + 'teaching/' + 'qt-intent.json'`），打包器
静态正则不会把 kbl/ 数据内联进 bundle（与 variation-directive.js /
kp-semantic-validator.js 同款 fail-open 模式）。

- Node 直载：正常读取 qt-intent.json，explainability 含 `trainsWhat`/`whyThisType`
- 浏览器运行时：bundle 无 kbl/ 数据 → require 抛错被捕获 → 索引留空 →
  explainability 降级为 `kp.module` 兜底（行为与现状一致，不阻断生成）

## 3. 测试

`tests/strategy/p25-13-explainability.test.js` — 6 例全 PASS：

1. plan() 产出的 QuestionPlan 包含 explainability 字段
2. explainability 七个子字段全部填充
3. validateQuestionPlan 接受合法 explainability
4. validateQuestionPlan 拒绝非法类型（字符串/数字/数组）
5. explainability 不在 forbidden 列表（与 svg 对照校验）
6. 无 learnerProfile 时 explainability 降级 variation='fixed'

## 4. 红线遵守

| 红线 | 本实现 |
|------|--------|
| 不改变实际题目生成逻辑 | ✓ explainability 在 validatePlan 前注入，不影响生成路径 |
| 只增加可追踪信息 | ✓ 全部字段从已计算变量派生，零新求解 |
| 不建立第二套评分系统 | ✓ explainability 只读，不参与评分/难度决策 |
| 浏览器跨环境规则 | ✓ require 路径用字符串拼接，bundler 不内联 kbl 数据 |
