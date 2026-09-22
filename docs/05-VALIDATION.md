# 05-VALIDATION — 验证管线与语义治理

> 状态：FROZEN
> 涵盖：P28-15（固定 Seed）/ P28-16（Semantic PASS/WARN/FAIL）/ P28-17（A 类 KP 语义）

## 1. 验证管线

SSOT：`shared/validator/validation-pipeline.js`

分层执行（Layer 1 失败即停止）：

| 层 | 步骤 | required |
|---|---|---|
| Layer 1 critical | schema / answer / kpCoverage | 是 |
| Layer 2 structure | difficulty / composite / kpSemantic | 否 |
| Layer 3 integrity | difficultyIntegrity / duplicateIntegrity | 否 |
| Layer 4 duplicate | duplicate | 否 |

## 2. Semantic PASS/WARN/FAIL 显式分离（P28-16）

验证结果显式输出四个标签，Generation 与 Semantic 分别统计，**PASS 不含 WARN**：

| 标签 | 含义 |
|---|---|
| `generationPass` | Layer 1（schema/answer/kpCoverage）无错误 |
| `semanticPass` | Semantic 面（Layer 2/3/4）无错误且无警告 |
| `semanticWarn` | Semantic 面有警告但无错误 |
| `semanticFail` | Semantic 面有错误 |

```js
// validation-pipeline.js runPipeline 返回值
{
  valid, errors, warnings, info, score, checks,
  generationPass, semanticPass, semanticWarn, semanticFail
}
```

## 3. 固定教育语义测试 Seed（P28-15）

所有教育语义测试固定 seed / KP / type / difficulty，连续 5 次结果一致。

门禁：`node dev/p28/check-semantic-determinism-gate.js`
- D1：固定 seed 5 连跑语义快照逐字节一致
- D2：语义面 0 处自决难度
- D3：`diffLevel` / `resolveStaticDifficulty` 各恰 1 处权威定义

## 4. A 类 KP 教育语义最终治理（P28-17）

A 类 KP 必须真实证明：

```
KP → semantic target → question intent → evidence → validator
```

- 非仅字段存在
- Generator 实际消费 `sq.data.semanticEvidence`
- `kp-semantic-validator.js` 实际对照 `kbl/teaching/evidence-rules.json` 校验

## 5. 验证器清单

| 验证器 | 文件 |
|---|---|
| Schema | `shared/schemas/semantic-question.schema.js` |
| Answer | `shared/validator/answer-validator.js` |
| KP Coverage | `shared/validator/kp-coverage-validator.js` |
| Difficulty | `shared/validator/difficulty-validator.js` |
| Composite | `shared/validator/composite-validator.js` |
| KP Semantic | `shared/validator/kp-semantic-validator.js` |
| Difficulty Integrity | `shared/validator/difficulty-integrity-validator.js` |
| Duplicate Integrity | `shared/validator/duplicate-integrity-validator.js` |
| Duplicate | `shared/validator/duplicate-validator.js` |
