# P27-12 KnowledgePracticeState 最小掌握度闭环

状态：已完成（本报告随实现同批提交；commit 等用户指令）
日期：2026-09-20
前置：P25 任务书 P25-12「建立最小掌握度闭环」（无前置 P25-X 同名实现，本任务首次落地）

## 1. 目标

建立知识点级最小掌握度闭环，提供学习状态数据。任务书 P25-12 要求字段：
```
attempts / correct / incorrect
questionTypeStats / recentErrors
semanticTargetStats / misconceptionStats
```

红线（任务书 P25-12）：
- 不改 Difficulty Core
- 不创建第二套评分系统
- 只提供学习状态数据（不做复杂 AI 自适应算法）

## 2. 设计与边界

LearnerModel（M6 既有）已维护 `mastery/confidence/accuracy/recentAccuracy/recentResults/errorPatterns/recommendedDifficulty/recommendedSpiralLevel`。
P25-12 要求字段中：
- `attempts / correct / errorPatterns` **已有**（M6-R02/R06/R09）
- `incorrect / questionTypeStats / recentErrors / semanticTargetStats / misconceptionStats` **缺口**

设计原则（红线落地）：
- **不建第二套评分系统**：`mastery/confidence/recommended*` 仍是唯一评分入口，新增字段**仅统计或只读派生**，不参与评分
- **不伪造**：`semanticTarget` 在 SemanticQuestion 上无值时归入 `'null'` 桶；`misconceptionStats` 由 `errorPatterns` 经 ErrorModel.getErrorFocus 派生（与 `AdaptiveStrategy.errorFocusFor` 同源）；`recentErrors` 错因不可靠时记为 `null`（错题事实仍记录）
- **派生 vs SSOT**：`incorrect` 与 `misconceptionStats` 为派生只读视图；`errorPatterns` 仍是错因 SSOT（M6-R09 不变）

## 3. 数据模型

### 3.1 PracticeResult 新增字段（shared/learner/practice-result.js）

```
semanticTarget  // P25 新增维度（P27-12 落地）；string | null
```

取值优先级：
1. `sq.semanticTarget`（字符串）
2. `sq.semanticTargets` 数组首项（兼容多目标语义）
3. 无 → `null`

`fromLegacy` 接受 `opts.semanticTarget` 或 `question.semanticTarget`；`create` 接受 `partial.semanticTarget`。

### 3.2 KpState 新增字段（shared/learner/learner-model.js defaultKpState）

```js
{
  // ... M6 既有字段保持不变
  incorrect: 0,                     // 派生（attempts - correct），便于 UI 直接读
  questionTypeStats: {},            // {[qt]: {attempts, correct, incorrect, recentResults:[0|1], lastPracticedAt}}
  semanticTargetStats: {},          // {[st|null]: {attempts, correct, incorrect, lastPracticedAt}}
  recentErrors: [],                 // [{questionType, semanticTarget, errorType|null, correct:false, timestamp}]（cap 20）
  misconceptionStats: []            // 只读派生：ErrorModel.getErrorFocus(errorPatterns) 结果
}
```

字段语义：
- `questionTypeStats[qt].recentResults`：与 `kp.recentResults` 同语义（0/1 数组，cap 20）
- `semanticTargetStats`：以 `string` 为键；无值统一归入 `'null'` 桶
- `recentErrors`：只追加错题（`res===0`，redo 错题也追加，与 errorPatterns 同步）；正确不进
- `misconceptionStats`：normalizeKpState 每次由 errorPatterns 重新派生（不存 SSOT，伪造的 misconceptionStats 会被覆盖）

## 4. update 入口语义

LearnerModel.update 的累计分支与既有 `attempts/correct/errorPatterns` 完全同步：

| status | attempts/correct | recentResults | errorPatterns | questionTypeStats | semanticTargetStats | recentErrors |
|---|---|---|---|---|---|---|
| correct | attempts+1, correct+1 | push(1) | — | attempts+1, correct+1, push(1) | attempts+1, correct+1 | — |
| wrong | attempts+1, incorrect+1 | push(0) | recordError(etype) | attempts+1, incorrect+1, push(0) | attempts+1, incorrect+1 | push 错题摘要 |
| skipped | 不计 | 不计 | 不计 | 不计 | 不计 | 不计 |
| redo（correct） | 不重复 first-pass | push(1) | — | 不重复 first-pass，push(1) | 不重复 first-pass | — |
| redo（wrong） | 不重复 first-pass | push(0) | recordError | 不重复 first-pass，push(0) | 不重复 first-pass | push 错题摘要 |

`misconceptionStats` 不参与 update 累计——由 `normalizeKpState` 末段从 `errorPatterns` 派生（每次 normalize 重派，伪造数据自动覆盖）。

## 5. 变更清单

| 文件 | 变更 |
|---|---|
| shared/learner/practice-result.js | `semanticTarget` 字段：fromSemanticQuestion（sq.semanticTarget / sq.semanticTargets[0]）、fromLegacy、create 三入口落地；null 不伪造 |
| shared/learner/learner-model.js | defaultKpState +5 字段（incorrect/questionTypeStats/semanticTargetStats/recentErrors/misconceptionStats）；normalizeKpState 增 normalizeQtStats/normalizeStStats/normalizeRecentErrors + misconceptionStats 派生；update 入口累计 questionTypeStats/semanticTargetStats/recentErrors |
| tests/generator/p27-12-knowledge-practice-state.test.js（新） | 15 项冻结不变量测试 |
| shared/engine/strategy-engine.bundle.js | 双 bundle 重建（strategy 67 modules / presentation 24+74） |
| shared/engine/presentation-engine.bundle.js | 同上 |

**红线未触**：
- Difficulty Core（static-difficulty/target-difficulty/adaptive-strategy 推荐算法）未改
- 既有 mastery/confidence/recommended* 字段语义与算法不变
- SemanticQuestion 上未注入 semanticTarget 字段（P25-12 仅落地 PracticeResult + LearnerModel 侧；上游 SemanticQuestion 注入由后续任务接）

## 6. 验证

### 6.1 新增测试（15/15 PASS）

```
✔ #1  正确回答 → questionTypeStats[qt] 累计 1/1/0，recentErrors 空
✔ #2  错误回答 → questionTypeStats[qt] 累计 1/0/1，recentErrors 1 条带错因
✔ #3  跳过 → questionTypeStats 不动，exposureCount +1
✔ #4  重做 → questionTypeStats.attempts 不重复计入 first-pass，但 recentResults 更新
✔ #5  多题型混合 → 各桶独立
✔ #6  semanticTarget=null 归入 null 桶（绝不伪造）
✔ #7  misconceptionStats 由 errorPatterns 派生（只读视图，伪造被覆盖）
✔ #8  normalizeLearnerState 自愈：旧数据无新字段 → 默认空对象/数组
✔ #8b normalizeKpState 自愈：questionTypeStats 损坏字段被 sanitize
✔ #8c normalizeKpState 自愈：semanticTargetStats 损坏字段被 sanitize
✔ #9  PracticeResult.fromSemanticQuestion 携带 semanticTarget
✔ #9b PracticeResult.fromLegacy 与 create 携带 semanticTarget
✔ #10 recentErrors 超 cap 20 保留末段
✔ #11 红线：新增字段不参与评分（mastery/confidence 仍是唯一评分入口）
✔ #12 端到端：ResultCollector.collectCheck 多题 → state 含 questionTypeStats
```

### 6.2 全量门禁

| 门禁 | 结果 |
|---|---|
| npm test | 430/430 PASS（含 P27-12 新增 15） |
| verify（M0 网关 5 步） | 5/5 PASS |
| verify:allow-gen | 1570/1570 PASS |
| verify:syntax | 253 文件 / 0 错误 |
| check-lint | 0 违规 |
| type-contract | 0 违例（1570/1570） |
| intent-dynamic | 1299/0 违例 |
| variation-drift | 1299/0 硬违例（200 软报告） |
| semantic-families | 375/15 族（不变） |
| 双 bundle 重建 | strategy 67 modules / presentation 24+74 |

## 7. 与 P27-09/10/11 的关系

```
P27-09 VariationProfile（变式轴剖面）        ← P25-12 questionTypeStats 提供"题型分布"消费方
P27-10 MisconceptionProfile（易错点 overlay） ← P25-12 misconceptionStats 与之同源（error-model 8 错因）
P27-11 VariationDirective（错因→变式接线）   ← P25-12 recentErrors 提供错题可回溯（kpId + qt + st + etype）
P27-12 KnowledgePracticeState（本任务）       ← 闭环：状态数据落地，可被下游 UI/诊断消费
```

P27-11 的 `variation-directive.resolveForPlan` 消费链不变（仍读 `AdaptiveStrategy.errorFocusFor(kpState)` → 即 `kpState.errorPatterns`）。P27-12 的 `misconceptionStats` 是 errorPatterns 的只读派生镜像，与 `errorFocusFor` 同源——下游若需"错因聚焦列表"，仍走 `LearnerModel.getErrors` / `AdaptiveStrategy.errorFocusFor`；`misconceptionStats` 字段为 UI 直接消费提供便利视图，不替代 SSOT。

## 8. 后续接（非本任务范围）

- SemanticQuestion 注入 semanticTarget 字段（需 P25-01 TeachingSemanticProfile 扩展，非本任务）
- UI 消费 questionTypeStats/semanticTargetStats/recentErrors 展示"题型错误分布/最近错题"视图
- P25-13「下一题为什么这样出」的可解释链可消费本任务的状态数据 + P27-11 的 variationDirectives 拼装解释
