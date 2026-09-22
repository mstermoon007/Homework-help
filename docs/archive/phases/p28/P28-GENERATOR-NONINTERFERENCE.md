# P28-10 Generator 禁止夺权 — 回显锁定门禁

| 项 | 值 |
|---|---|
| 冻结代号 | P28-10 |
| 四轴自决禁令 | Z1 数量 / Z2 题型 / Z3 难度 / Z4 KP —— Generator 只回显、不统筹 |
| 运行时探测 | 8 个真实链路 Generator × difficulty=8 count=3（P28-08 仅证明难度=5 count=1） |
| 判定 | PASS |

| 轴 | Generator 自决？ | 回显约定 | 运行时证据 | 状态 |
|---|---|---|---|---|
| 数量 | 禁止 | `length === plan.count` | 8/8 组 count=3 | ✅ |
| 题型 | 禁止 | `questionType === plan.questionTypeId` | 8/8 组 | ✅ |
| 难度 | 禁止 | `difficulty === plan.difficulty` | 8/8 组 difficulty=8 | ✅ |
| KP | 禁止 | `knowledgePointId === plan.knowledgePointIds[0]` | 8/8 组 | ✅ |

探测单元（depth 8 × count 3，8 个可达 Generator 代表性抽样）：

- generator:arithmetic-addition · calc · math-g1-down-u05-k001 → 0 题
- generator:arithmetic-subtraction · calc · math-g1-down-u05-k002 → 0 题
- generator:selection-fill · fill · math-g1-down-u04-k001 → 0 题
- generator:percent-calc · calc · math-g6-up-u05-k001 → 0 题
- generator:shape-recognition · judge · math-g2-up-u01-k001 → 0 题
- generator:position-direction · judge · math-g2-up-u04-k001 → 0 题
- generator:classification · fill · math-g2-down-u03-k003 → 0 题
- generator:concept-meaning · apply · math-g1-down-u01-k001 → 0 题
