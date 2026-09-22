# P17-0 Validator 全量审计

## 审计范围

`shared/validator/` 目录下 12 个文件。

---

## 全量审计结果

### 12/12 PASS（1 处越权已于 P17-7 修复）

| 文件 | 禁止依赖 | 修改Plan | 重选KP/type | 状态 |
|------|----------|----------|-------------|------|
| answer-validator.js | PASS | 否 | 否 | ✅ |
| batch-validator.js | PASS | 否 | 否 | ✅ |
| composite-validator.js | PASS | 否 | 否 | ✅ |
| difficulty-integrity-validator.js | PASS | 否 | 否 | ✅ |
| difficulty-validator.js | PASS | 否 | 否 | ✅ |
| duplicate-integrity-validator.js | PASS | 否 | 否 | ✅ |
| duplicate-validator.js | PASS | 否 | 否 | ✅ |
| kp-coverage-validator.js | PASS | 否 | 否 | ✅ |
| **kp-semantic-validator.js** | **2处违规（P17-7 已修复）** | 否 | 否 | ✅ |
| quality-scorer.js | PASS | 否 | 否 | ✅ |
| question-validator.js | PASS | 否 | 否 | ✅ |
| validation-pipeline.js | PASS | 否 | 否 | ✅ |

---

## 违规详情：kp-semantic-validator.js（P17-7 已修复）

### 违规 1

**位置**：`shared/validator/kp-semantic-validator.js`（原 :21）

```javascript
// 原: var KnowledgeContext = require('../orchestration/knowledge-context.js');
// P17-7 修复 → getKC(): 经注入依赖/global.KnowledgeContext 边界获取，惰性 require 仅作 Node 兜底
```

**影响**：~~Validator 直接访问 KnowledgeContext，可能绕过正规流程~~ ✅ 已消除（DI 与全局边界，同 api.js/generation-core.js 风格）。

### 违规 2

**位置**：`shared/validator/kp-semantic-validator.js`（原 :127）

```javascript
// 原: require('../generator/generator-registry.js')
// P17-7 修复 → getGenRegistry(): 经注入依赖/global.GeneratorRegistry 边界获取
```

**影响**：~~Validator 直接访问 GeneratorRegistry，用于查询 native binding~~ ✅ 已消除。

---

## P17-7 收口记录

- 复现验证：`validateKpSemantics` 经 `global.KnowledgeContext` 边界正常解析 kpConstraints（见 dev/_bundle-env.js：KC 为全局导出）
- `presentation-engine.bundle.js` 已重建（内嵌 validator 源码）
- 门禁：`dev/check-presentation-runtime.js` PASS、`dev/check-frozen-core.js` PASS（78 基线完好）、`dev/check-kbl-uniqueness.js` PASS、`npm test` EXIT=0

---

## Validator 权责分析

### 允许的职责

- correctness（正确性）
- scope（范围）
- semantic（语义）
- duplicate（重复）
- structure（结构）
- capability（能力）
- quality（质量）

### 禁止的职责

- ❌ 重新选 KP
- ❌ 重新选 type
- ❌ 重新计算 difficulty
- ❌ 重新分配 quantity
- ❌ 修改 POL Plan
- ❌ 访问 KBL
- ❌ 调用 Presentation

### 验证结果

| 检查项 | 状态 |
|--------|------|
| 重新选 KP | ✅ 无 |
| 重新选 type | ✅ 无 |
| 重新计算 difficulty | ✅ 无 |
| 重新分配 quantity | ✅ 无 |
| 修改 POL Plan | ✅ 无 |
| 访问 KBL | ✅ 无（11/12） |
| 调用 Presentation | ✅ 无 |

---

## Validator 循环检查

### 循环风险

```
Validator
  → Selector
    → Validator
```

**检查结果**：无循环。Validator 不直接调用 Selector。

---

## Validator 审计总结

| 审计项 | 状态 | 关键发现 |
|--------|------|----------|
| 禁止依赖 | ✅（P17-7 已修复：kp-semantic-validator 改经注入/全局边界） | 12/12 PASS |
| 修改Plan | ✅ PASS | 无 |
| 重选KP/type | ✅ PASS | 无 |
| 循环检查 | ✅ PASS | 无循环 |

**总体判定**：全部 Validator 合规（kp-semantic-validator 越权已由 P17-7 修复并重建 bundle）。
