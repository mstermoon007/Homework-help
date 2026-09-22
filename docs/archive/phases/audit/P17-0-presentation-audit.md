# P17-0 Presentation / SVG / SemanticQuestion 审计

## PRESENT-01：Presentation 只能消费结果

### PresentationEngine 职责边界

| 检查项 | 是否出现 | 状态 |
|--------|----------|------|
| Presentation → POL | 否 | ✅ |
| Presentation → Generator | 否 | ✅ |
| Presentation → Strategy | 否 | ✅ |

### PRESENT-01 状态：✅ PASS

---

## PRESENT-02：generateQuestions 审计

### 关键发现

**PresentationEngine.generateQuestions() 实际包含生成逻辑**

文件：`shared/engine/presentation-engine.js`

```javascript
function generateQuestions(plan, options) {
  // 1. Selector 选择 Generator
  var Selector = require("shared/generator/generator-selector.js");
  
  // 2. 重试循环
  var RetryLoop = require("shared/generator/retry-loop.js");
  
  // 3. 质量验证
  var BatchValidator = require("shared/validator/batch-validator.js");
  
  // 4. 语义问题对象
  var SQ = require("shared/semantic/semantic-question.js");
  
  // 实际生成逻辑
  var generator = Selector.select(plan);
  var result = RetryLoop.generate(generator, plan);
  var validated = BatchValidator.validateBatch(result.questions, plan);
  return SQ.normalizeAll(validated);
}
```

### PRESENT-02 状态：⚠️ 警告

**发现**：PresentationEngine 包含 Selector/RetryLoop/BatchValidator/SQ 的调用逻辑。

这是 **GENERATION LOGIC INSIDE PRESENTATION** 问题。

---

## PRESENT-03：SVG/Print 审计

### SVG 生成位置

| 文件 | Runtime/Dev/Test | 状态 |
|------|------------------|------|
| shared/svg/svg-core.js | Runtime | ✅ 消费 SemanticQuestion |
| shared/svg/svg-geometry.js | Runtime | ✅ |
| shared/svg/svg-calculation.js | Runtime | ✅ |
| shared/svg/svg-make-ten.js | Runtime | ✅ |
| shared/svg/svg-chart.js | Runtime | ✅ |
| shared/svg/svg-diagram.js | Runtime | ✅ |
| shared/svg/svg-currency.js | Runtime | ✅ |
| plugins/svg-clock.js | Runtime | ✅ |
| plugins/svg-area.js | Runtime | ✅ |
| plugins/svg-fraction.js | Runtime | ✅ |
| plugins/svg-data-stats.js | Runtime | ✅ |
| plugins/svg-draw.js | Runtime | ✅ |
| plugins/svg-competition.js | Runtime | ✅ |

### SVG 调用链

```
SemanticQuestion
  → PresentationEngine.renderQuestions()
    → svg-core.js (SVG 生成)
    → html-renderer.js (HTML 生成)
```

### PRESENT-03 状态：✅ PASS

SVG 只在 Presentation 层消费，Generator 不直接生成 SVG。

---

## PRESENT-04：SemanticQuestion 边界

### SemanticQuestion 职责

| 检查项 | 是否出现 | 状态 |
|--------|----------|------|
| DOM | 否 | ✅ |
| HTML string | 否 | ✅ |
| SVG string | 否 | ✅ |
| CSS | 否 | ✅ |
| print layout | 否 | ✅ |

### SemanticQuestion 必备字段

```
questionId ✅
knowledgeId ✅
questionType ✅
difficulty ✅
stem ✅
answer ✅
options ✅
solution ✅
metadata ✅
```

### PRESENT-04 状态：✅ PASS

SemanticQuestion 是生成/展示之间的唯一语义边界。

---

## SVG/Print 审计总结

### Generator → SVG = 0

所有 Generator 不直接生成 SVG。SVG 由 Presentation 层的 svg-core.js 处理。

### Presentation → SVG = allowed

SVG 只在 Presentation 层生成，符合预期。

---

## 总体 Presentation 审计

| 审计项 | 状态 | 关键发现 |
|--------|------|----------|
| PRESENT-01 只消费结果 | ✅ PASS | 不反向调用 POL/Generator/Strategy |
| PRESENT-02 generateQuestions | ✅ 已收口（P17-8） | 生成逻辑运行时归入 GenerationCore；Presentation 内联链仅保留于不可达路径 |
| PRESENT-03 SVG/Print | ✅ PASS | SVG 只在 Presentation 层 |
| PRESENT-04 SemanticQuestion | ✅ PASS | 唯一语义边界 |

**核心问题**：PresentationEngine.generateQuestions() 包含 Selector/RetryLoop/BatchValidator 生成逻辑。

这是 P17 必须处理的架构问题：**生成逻辑应从 Presentation 中抽出，归入 GenerationCore**。

**P17-8 收口结论**：
- GenerationCore 已落地（P17-2/3），P17-4 将 api.js runPlans 的 single-KP 计划收敛到 `GenerationCore.execute`。
- 但浏览器缺口：`global.GenerationCore` 未注册（presentation bundle 未内联，api.js 无 require），
  使 `generationCoreAvailable=false`，single-KP 在浏览器仍走 Presentation 内联生成。P17-8 通过
  `dev/build-presentation-bundle.js` 内联 generation-core/generation-contract 并注册全局修复。
- 现浏览器生产路径（`PracticeSession.start` → `GenerationAPI.generate` → runPlans → GenerationCore）
  已 100% 经 GenerationCore 执行（`npm run verify:browser-core-wiring` 实证 coreExecuted=true）。
- `PresentationEngine.generateQuestions` 源为 frozen（不可改），其内联链仅剩运行时不可达路径可触发：
  combine 多 KP（规划层 strategy-engine.js:663 已拒绝）、死兼容 `generateSync`、无 GenerationAPI 兜底。
