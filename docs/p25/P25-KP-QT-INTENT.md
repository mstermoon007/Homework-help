# P25-KP-QT-INTENT — KP×题型×题目意图矩阵（P25-03）

> 由 `dev/p25/derive-qt-intent.js` 从 KBL 源受限推导生成；**AI 验证流程**（用户已授权）：`ai-verified` 行待人工抽查后升级 `confirmed`。未改 ALLOW、未写正式 KBL。

| 指标 | 值 |
| --- | --- |
| 覆盖 | 1570/1570 ALLOW 行（集合相等断言） |
| **confirmed（人工抽查通过）** | **95** |
| ai-verified（待抽查） | 1190（其中被「打回」3 行待修正重审） |
| needs-review（未裁决） | 285（旗标：{"cognitive-out-of-range":325,"legitimacy-cognitive-only":324,"no-type-evidence":114,"representation-conflict":4}） |
| 题型分布 | {"calc":189,"fill":375,"apply":375,"choice":375,"geometry":105,"judge":126,"classify":25} |

## needs-review 旗标语义（内容为 null 的原因，全部为机械可判定事实）

- `single-type-kp`（0）：该 KP 仅一种 ALLOW 题型，「与其他题型差异」一问无从对比 → 留待题型扩充或人工补写
- `representation-conflict`（4）：图形表征 KP × 不支持图形的题型 → 正当性存疑，是 P25-06/07 的治理输入
- `cognitive-out-of-range`（325）：KP 认知层级在该题型认知区间外 → 正当性存疑。**词表口径注意**：KBL 用 `recognize`（认识），QTR calc/fill/classify/apply 区间为 `[recall(了解), understand, apply]` 而不含 recognize——「认识级知识练计算」是否越界属课程标准解释问题，机械旗标从严标记，**交人工抽查裁决**，不静默放行
- `no-type-evidence` / `no-type-contrast`：推导证据不足

## 产物

- [qt-intent.json](../../kbl/teaching/qt-intent.json) — 1570 行意图矩阵（五问 + 逐问状态 + evidence 溯源）
- [qt-intent-sample.xlsx](../../kbl/teaching/qt-intent-sample.xlsx) — 人工抽查单（99 行，按语义族分层 + needs-review 负面样本）
