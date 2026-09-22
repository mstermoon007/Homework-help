# P25-05 意图×证据一致性门禁

状态：已完成
日期：2026-09-19
前置：P25-03（意图矩阵 1570 行）、P25-04（证据验证第 7 检查）

## 1. 目标

把 P25-03 的意图矩阵（每 KP×QT 的 trainsWhat）与 P25-04 的证据声明（semanticEvidence.relations）
串成闭环：题目声明的语义关系必须属于该 KP 语义家族允许的关系集，禁止跨家族矛盾
（如「意图说训练倍的比较，证据却声明加法合并」）。

## 2. 机制

### 2.1 映射表 `kbl/teaching/intent-relations.json`
基于 KBL 语义事实（semantic.family / operations / type）派生 allowedRelations，
不做题面 NLP。规则 `when` 条件：
- `hasOperation`：KP operations 含某运算
- `category`：KP type（calculation/geometry/statistics...）
- `operationsEmpty`：operations 是否为空
- `family`：semantic.family（fraction/percent/decimal）

匹配所有规则的 allow 并集 = allowedRelations。

`forbiddenAcrossFamilies` 双向禁表兜底：
- geometry 禁算术关系（add-combine/sub-take-away/multiply-by-times/divide-share/unit-one...）
- algebra-arithmetic 禁几何关系（vertex-rays/area-surface/length-measure/angle-observe/shape-identify...）

### 2.2 验证器第 8 检查 `checkIntentEvidenceConsistency`
落位：shared/validator/kp-semantic-validator.js；新错误码 `KP_SEMANTIC_INTENT_CONFLICT`。
三态：
| 态 | 条件 |
|----|------|
| skip | 题目未声明 relations；或 KC 不可用；或规则表为空（bundle 未内联数据）|
| pass | 声明关系全部在 allowedRelations 内 |
| fail | 存在跨家族矛盾关系（ERROR，detail.conflicts 可溯源）|

**防御性 skip（重要）**：当 KC 不可用或规则表为空时返回 skip 而非 fail——
避免在无法判定的环境中误杀合法题目。这与 P25-04 第 7 检查「空规则=全 skip」同源。

## 3. 关键工程发现

### 3.1 bundle 内联规则数据 require 失败
intent-relations.json 与 evidence-rules.json 一样用计算路径 require
（`'../../' + 'kbl/' + 'teaching/' + ...`），打包器静态正则不匹配 → 不内联。
bundle 运行时 `__req` 找不到该 id → catch → 规则表空。

P25-04 第 7 检查不受影响：空规则 = 无规则匹配 = 全 skip。
P25-05 第 8 检查初版 bug：空规则 → allowed={} → 所有 relations 判 conflict → fail →
题目被验证管道丢弃 → PracticeSession 报「没有可生成的题目」。
修复：规则表为空时 skip。

### 3.2 PracticeSession 走 bundle 内联 validator
PracticeSession → PresentationEngine（bundle）→ retry-loop（bundle 内联）→
validation-pipeline（bundle 内联）→ kp-semantic-validator（bundle 内联）。
因此 dev 测试必须重建 presentation bundle 才生效；仅改源码不重建 bundle，
运行时行为不变。

## 4. 验证（全绿）

| 门禁 | 结果 |
|------|------|
| npm test | 269/269（P25-04 10 + P25-05 10 新增）|
| verify | 5/5 |
| syntax | 228 文件 / 0 |
| lint | 0 |
| kbl-uniqueness | PASS |
| allow-gen | 1570/1570 |

端到端实证：
- 几何 KP（角）声明 add-combine → fail（跨家族矛盾）
- 算术 KP（倍）声明 vertex-rays → fail
- 倍×[multiply-by-times, times-compare] → pass
- 分数×[unit-one, equal-partition] → pass
- 4 代表 KP 规则行 evidence=pass 且 intent=pass

## 5. 边界

- 同家族内不做细分裁决（如几何 KP 同时声明 vertex-rays 和 area-surface 均 pass），
  避免过度门禁；细分由 P25-04 evidence-rules.json 的 required/forbidden 承担。
- bundle 环境下 intentConsistency 恒为 skip（数据未内联），门禁效力在 Node 源码路径
  （dev 门禁 / CI）生效；这是证据/意图数据不落 bundle 的统一设计（见 P25-04）。
