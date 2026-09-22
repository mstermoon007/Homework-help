# 08-LEARNER — 学习状态基础设施

> 状态：FROZEN
> 涵盖：P28-31（Learner 最终定位）/ P28-32（Learner 数据链）

## 1. 一句话定位

**Learner 层 = 学习状态基础设施**：忠实记录练习事实、累计可解释统计、经唯一简单评分入口（EMA mastery + confidence）产出**非权威推荐值**。
不是完整自适应算法，不做黑盒/AI 推断；**一切教学决策（难度/螺旋/变式）在 Strategy 层消费其数据后作出**，Learner 层永不决策。

## 2. 模块定位表（5 个责任单元）

| # | 责任单元 | SSOT 位置 | 唯一职责 |
|---|---|---|---|
| 1 | KnowledgePracticeState | `shared/learner/learner-model.js`（逐 KP `KpState`） | 逐知识点学习状态：mastery(EMA)/confidence/attempts/correct/incorrect/accuracy/recentAccuracy/recentResults、errorPatterns、exposureCount/lastPracticedAt、recommendedDifficulty/recommendedSpiralLevel、questionTypeStats、semanticTargetStats、recentErrors、misconceptionStats。纯数据与更新规则，不触碰 Storage、不持有策略 |
| 2 | ErrorModel | `shared/learner/error-model.js` | 错因 SSOT：固定 8 类 + `other`；只采信 Validator/SemanticQuestion 提供的 errorType，无可靠错因一律 null（不伪造诊断） |
| 3 | PracticeResult | `shared/learner/practice-result.js` | 练习结果标准对象与三入口工厂（fromSemanticQuestion / fromLegacy / create）；`knowledgePointId` 必须来自 SemanticQuestion |
| 4 | ResultCollector | `shared/learner/result-collector.js` | 统一「批改结果 → PracticeResult → LearnerModel.update」批量链路 |
| 5 | LearnerStorage | `shared/learner/learner-storage.js` | 持久化：复用 StorageManager，`'hw-help-state'.learnerState`；损坏→默认态、Storage 不可用→内存降级 |

## 3. 数据/决策分界

Learner 层**供数不决策**：

```
生成质量判定 / 题型选择 / 数量分配  → KBL + POL + Generator + Validator（Learner 无权触达）
难度/螺旋决定公式                    → Strategy 层 adaptive-strategy.js
错因诊断                             → 只接受 Validator/SemanticQuestion 的 errorType
Learner 输出                         → 数据 + 统计 + 唯一评分(mastery·confidence) + 非权威推荐
```

- `recommendedDifficulty` / `recommendedSpiralLevel` 是默认推荐（非权威），权威值由 AdaptiveStrategy 覆盖。
- Strategy 只允许经 `LearnerModel` API 读取，禁止直读 Storage。
- Learner 只读 KBL/KnowledgeContext 只读字段；**永不写 KBL**。

## 4. 唯一评分入口

全系统「学没学会」评分只有一处：
- **mastery**：EMA（DEFAULT_ALPHA=0.3，correct→1 / 其余→0，跳过不更新）
- **confidence**：样本量×一致性（低样本防误判）

其余字段只统计/派生，不参与评分。禁止新增第二套评分。

## 5. 禁止项

| # | 禁止新增 |
|---|---|
| 1 | AI 自适应难度算法 |
| 2 | 复杂推荐模型 |
| 3 | 黑盒评分模型 |
| 4 | 第二套评分系统 |
| 5 | 伪造（错因/kpId/learner 数据） |
| 6 | 越权影响生成质量判定 |
| 7 | 写 KBL |
| 8 | 算法扩张而不收敛 |

## 6. 数据链（P28-32）

```
Question → KP → Semantic Target → Answer → Result → Error Pattern → KnowledgePracticeState
```

走完整生产链（GenerationAPI.generate → PracticeResult.fromSemanticQuestion → ResultCollector → LearnerModel），不改变主生成链。
