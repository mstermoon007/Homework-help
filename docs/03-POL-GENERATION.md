# 03-POL-GENERATION — 编排与生成链

> 状态：FROZEN
> 涵盖：P28-07（题型收口）/ P28-08（1570 矩阵冻结）/ P28-09（Generator Registry）/ P28-10（Generator 禁止夺权）/ P28-11（Strategy 收口）/ P28-12（POL 收口）

## 1. 题型最终收口（P28-07）

### Canonical 7 类

```
calc / fill / choice / judge / geometry / classify / apply
```

SSOT：`shared/knowledge/question-type-registry.js`

旧令牌（`oral` / `recognize` / `open`）**只存在于 `normalizeQuestionType`**，不得进入生产能力声明。

### 五面审计结论

| 面 | 约束 | 结论 |
|---|---|---|
| Registry | TYPES 恰为 7 类 | ✅ |
| Strategy | 题型集=7 | ✅ `VALID_QUESTION_TYPES = Registry.all()` |
| Generator capability | 能力声明=canonical | ✅ 31 生成器全部 canonical |
| Validator | 题型集=canonical | ✅ TypeContract `CONTRACT_MAP` 恰为 7 |
| Presentation | 题型集=canonical | ✅ 无旧令牌 |

生成器边界归一单点：`generator-selector.js` `wrapGenerator` 在进入具体 generator 前调 `normalizeQuestionType`，下游一律消费 canonical 7 类。

## 2. 1570 生成矩阵冻结（P28-08）

| 项 | 值 |
|---|---|
| 静态矩阵行 | 1570 |
| 动态能力端点 | 1570 |
| 矩阵 KP 数 | 375 |
| 规范 7 类覆盖 | calc/fill/choice/judge/geometry/classify/apply |

1570 逐行复核：真实生成 ≥1 / questionType 一致 / KP 一致 / Schema 校验 / Validator 通过 / TypeContract 不变量 / 真实 Generator / prompt 非空 / answer 非空 —— 全部 PASS。

禁 fake / placeholder / empty / fallback 题。

门禁：`node dev/p28/check-generation-matrix-freeze.js`

## 3. Generator Registry 收口（P28-09）

**31 个 Generator · PRODUCTION=21 · COMBINE-ONLY=1 · DORMANT-CARRIER=2 · DORMANT-NO-BINDING=7**

每个 Generator 必须声明：id · semantic family · supported question types · input contract · output contract · validator · production status。

### 状态分布

| 状态 | 数量 |
|---|---|
| PRODUCTION（1570 实际承载 ≥1 行） | 21 |
| PRODUCTION-COMBINE-ONLY（combine 专享） | 1（`generator:composite`） |
| DORMANT-CONTRACT-CARRIER（契约名义载体，0 产出） | 2（`selection-choice`、`selection-judge`） |
| DORMANT-NO-BINDING（0 绑定 0 产出） | 7 |

门禁：`node dev/p28/check-generator-matrix.js`

## 4. Generator 禁止夺权（P28-10）

Generator 只消费，不统筹。四轴自决禁令：

| 轴 | 禁止 | 回显约定 |
|---|---|---|
| Z1 数量 | 不得自行决定产出数量 | `length === plan.count` |
| Z2 题型 | 不得改判题型 | `questionType === plan.questionTypeId` |
| Z3 难度 | 不得决定最终难度 | `difficulty === plan.difficulty` |
| Z4 KP | 不得自行选择 KP | `knowledgePointId === plan.knowledgePointIds[0]` |

Generator 只消费：GenerationParameters / SemanticProfile / QuestionIntent / DifficultyParameters。

门禁：`node dev/p28/check-generator-noninterference.js`（8 组运行时探测，runtime=8 fail=0）

## 5. Strategy 收口（P28-11）

Strategy 只负责**如何根据计划生成**，禁止：
- 重新选 KP
- 重新分配数量
- 重新决定题型
- 重新计算难度
- 直接读取 KBL（经 KnowledgeContext 只读接口）

## 6. POL 收口（P28-12）

POL 负责：
- request normalize
- KP selection
- type selection
- quantity planning
- difficulty coordination
- QuestionPlan

POL **不负责**：HTML / SVG / 具体数字生成 / 答案验证 / 题目文字渲染。

不变量：`requested ≥ planned ≥ generated = final`。
