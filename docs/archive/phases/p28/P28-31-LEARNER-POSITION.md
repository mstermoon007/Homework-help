# P28-31 Learner 最终定位 — 学习状态基础设施（FROZEN）

| 项 | 值 |
|---|---|
| 任务 | P28-31 Learner 最终定位（KnowledgePracticeState / ErrorModel / PracticeResult / ResultCollector / LearnerStorage） |
| 状态 | **FROZEN（只读契约）** |
| 建立 | 2026-09-21 |
| 依据 | `docs/ARCHITECTURE-OWNERSHIP.md` Learner 层行；`docs/p27/P27-12-KNOWLEDGE-PRACTICE-STATE.md`；M6-R03/R04/R05/R06/R07/R08/R09/R10/R11/R26；P25-12 红线 |
| 用途 | 后续任何 Learner 改动必须先与本定位对齐；防止「产品化」名义的越界（见 §4 禁止项） |

## 0. 一句话定位

**Learner 层 = 学习状态基础设施**：忠实记录练习事实、累计可解释统计、经既有的唯一简单评分入口（EMA mastery + confidence）产出**非权威推荐值**。
它不是完整自适应算法，不做任何黑盒/AI 推断；**一切教学决策（难度/螺旋/变式）在 Strategy 层消费其数据后作出**，
Learner 层自己**永不决策**。

## 1. 模块定位表（5 个责任单元）

| # | 责任单元 | SSOT 位置 | 唯一职责 | 数据流向 |
|---|---|---|---|---|
| 1 | **KnowledgePracticeState** | `shared/learner/learner-model.js` 内逐 KP 状态对象（`KpState`，含 P27-12 统计画布）——**非独立文件** | 逐知识点学习状态：mastery(EMA)/confidence/attempts/correct/incorrect/accuracy/recentAccuracy/recentResults、errorPatterns、exposureCount/lastPracticedAt、recommendedDifficulty/recommendedSpiralLevel、questionTypeStats、semanticTargetStats、recentErrors、misconceptionStats（只读派生）。纯数据与更新规则，**不触碰 Storage、不持有策略** | 写入：LearnerModel.update/upsert；读取：Strategy(经 LearnerModel API，R11) / UI |
| 2 | **ErrorModel** | `shared/learner/error-model.js` | 错因（Error Pattern）SSOT：固定 8 类 + `other`，count/recentCount/lastOccurredAt/confidence、近期衰减；错因**只采信自 Validator/SemanticQuestion 提供的 errorType**，系统无可靠错因一律返回 null（R10 不伪造诊断） | 记录：LearnerModel.update；读取：getErrorFocus / resolveErrorType |
| 3 | **PracticeResult** | `shared/learner/practice-result.js` | 练习结果标准对象与三入口工厂（fromSemanticQuestion / fromLegacy / create）；`knowledgePointId` **必须来自 SemanticQuestion，禁止 UI 猜测**；status 归一 correct/wrong/unanswered/skipped/redo；errorType 经 ErrorModel 归一 | 产出：PracticeSession 批改→ResultCollector；消费：LearnerModel.update |
| 4 | **ResultCollector** | `shared/learner/result-collector.js` | 统一「批改结果 → PracticeResult → LearnerModel.update」批量链路（correct/wrong/unanswered/redo/skip 全覆盖；跳过仅计曝光） | 入口：PracticeSession 批改回写；出口：LearnerModel.update → LearnerStorage |
| 5 | **LearnerStorage** | `shared/learner/learner-storage.js` | 持久化：复用 StorageManager，存放于 `'hw-help-state'.learnerState`；损坏→默认态、Storage 不可用→内存降级（隐私模式）；load/save/getKnowledgePoint/updateKnowledgePoint/clear | 读取：PracticeSession（feedLearnerModel 读旧态）/ Strategy（learnerProfile snapshot） |

## 2. 数据/决策分界（关键边界）

Learner 层**供数不决策**：

```
生成质量判定 / 题型选择 / 数量分配        → KBL + POL + Generator + Validator（Learner 无权触达）
难度/螺旋决定公式（R13/R14/R16）         → Strategy 层 adaptive-strategy.js（mastery band + confidence 防低样本）
错因诊断                                 → 只接受 Validator/SemanticQuestion 提供的 errorType（R10）
Learner 输出                             → 数据 + 统计 + 唯一入口评分（mastery·confidence）+ 非权威推荐（recommendDefaults，可被 AdaptiveStrategy 覆盖）
```

- `recommendedDifficulty / recommendedSpiralLevel` 是 **recommendDefaults 启发表**（确定性带域 + 置信度衰减）的默认推荐，**非权威**；权威值由 AdaptiveStrategy（Strategy 层）覆盖。Learner 不实现难度决策。
- Strategy 只允许经 `LearnerModel` API 读取（R11），禁止直接读 Storage。
- Learner 只读 KBL/KnowledgeContext 的只读字段与 SemanticQuestion 契约；**永不写 KBL**（CROSS-LAYER-MATRIX 第 7 条）。

## 3. 唯一评分入口

全系统关于「学没学会」的评分只有一处输入：
- **mastery**：EMA（M6-R07，DEFAULT_ALPHA=0.3，correct→1 / 其余→0，跳过不更新）
- **confidence**：样本量×一致性（M6-R08，低样本防误判）

P27-12 新增字段（questionTypeStats/semanticTargetStats/recentErrors/misconceptionStats）均为**纯统计或只读派生**，**不参与评分**。禁止在 Learner 层新增任何第二套评分/质量分。

## 4. 禁止项（越界即回退）

为实现「学习状态基础设施」定位，以下功能**不得以任何「产品化」名义新增**：

| # | 禁止新增 | 说明 |
|---|---|---|
| 1 | **AI 自适应难度算法** | 难度调整=Strategy 层既有 R13 限幅 [-2,+2] 规则；Learner 只供 mastery/confidence 数据。禁止在 Learner 层塞模型/自学习 |
| 2 | **复杂推荐模型** | 不出推荐引擎、不引入推荐排序/召回；recommendDefaults 带域启发即上限 |
| 3 | **黑盒评分模型** | 不引入对结果「打分」的不可解释模型；mastery/confidence 是唯一可解释评分入口（公式固定、可逐项核对） |
| 4 | **第二套评分系统** | P25-12 红线：KpState 其余字段只统计/派生，不参与任何评分 |
| 5 | **伪造** | 不伪造错因（R10）、不伪造 knowledgePointId、不伪造 learner 数据；System 无可靠信号一律 null |
| 6 | **越权影响生成质量判定** | Learner 数据可被 Strategy 用作难度/螺旋**输入**，但不得直接决定题型/数量/生成成败/质量判定（ARCHITECTURE-OWNERSHIP Learner 行） |
| 7 | **写 KBL** | Learner 任何输出不得写入 kbl/ 或 KnowledgeContext（只读） |
| 8 | **算法扩张而不收敛** | 非任务要求的新增统计桶/字段须先论证可解释性与唯一入口，再走 P28-01 流水线；禁止盲目深化 |

## 5. 授权读写路径（唯一）

```
写（唯一入口链）：PracticeSession 批改
  → ResultCollector.collect/collectCheck
  → PracticeResult（fromSemanticQuestion，kpId 必须来自 sq）
  → LearnerModel.update（EMA + 统计 + errorPatterns）
  → LearnerStorage.save（'hw-help-state'.learnerState）

读（唯一合法方）：
  Strategy：LearnerModel.get / normalizeKpState / getErrors（R11，禁止直读 Storage）
  UI：LearnerStorage.getKnowledgePoint / LearnerModel.getState（渲染学习状态视图用）
```

## 6. 验证口径

- 后续 Learner 改动：对照 §1 定位表确认归属唯一模块 → §4 无命中 → 走 P28-01（最小修改 → 局部验证 → 全量验证）。
- 回归门禁：`npm test`（含 `tests/learner/learner-model.test.js`、`tests/learner/learner-storage.test.js`、`tests/generator/p27-12-knowledge-practice-state.test.js`）+ `bash scripts/run-all-checks.sh` 全绿。
- P28-31 本任务为定位收敛：**零生产行为变更**，仅新增本契约与模块头部锚定注释；全量回归见 §7。

## 7. 验证结果（P28-31）

| 门禁 | 结果 |
|---|---|
| npm test | 529/529 PASS（含 learner 专项：`learner-model.test.js` / `learner-storage.test.js` / `p27-12-knowledge-practice-state.test.js` / `adaptive-strategy.test.js`） |
| verify 网关（M0 8 步） | 8/8 PASS，0 错误 0 警告 |
| verify:allow-gen | 1570/1570 PASS |
| verify:syntax | 281 文件 / 0 错误 |
| check-lint | 0 违规 |
| run-all-checks.sh | 全绿 |

> P28-31 为**定位收敛**：零生产行为变更（仅注释锚定 + docs 契约），行为回归全绿即定位已确认。