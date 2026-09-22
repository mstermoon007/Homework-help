# P17-0 Generator 全量审计

## 审计范围

`shared/generator/generators/` 目录下 19 个模块文件（产出 26 个 generator 记录）。

---

## 全量审计结果

### 全部 PASS（19/19）

| 模块 | 禁止依赖 | HTML/SVG | 输入契约 | 输出契约 |
|------|----------|----------|----------|----------|
| arithmetic.js | PASS | 否 | plan+context → SQ[] | SemanticQuestion[] |
| selection.js | PASS | 否 | plan+context → SQ[] | SemanticQuestion[] |
| complex.js | PASS | 否 | plan+context → SQ[] | SemanticQuestion[] |
| shape.js | PASS | 否 | plan+context → SQ[] | data.graphic 描述符 |
| position.js | PASS | 否 | plan+context → SQ[] | data.graphic 描述符 |
| money.js | PASS | 否 | plan+context → SQ[] | data.graphic 描述符 |
| application.js | PASS | 否 | plan+context → SQ[] | SemanticQuestion[] |
| counting.js | PASS | 否 | plan+context → SQ[] | SemanticQuestion[] |
| composite.js | PASS | 否 | plan+context → SQ[] | SemanticQuestion[] |
| picture-equation.js | PASS | 否 | plan+context → SQ[] | data.graphic 描述符 |
| reasoning.js | PASS | 否 | plan+context → SQ[] | SemanticQuestion[] |
| stats.js | PASS | 否 | plan+context → SQ[] | data.graphic 描述符 |
| classify.js | PASS | 否 | plan+context → SQ[] | SemanticQuestion[] |
| semantic-special.js | PASS | 否 | plan+context → SQ[] | SemanticQuestion[] |
| c1-number-puzzle.js | PASS | 否 | plan+context → SQ[] | SemanticQuestion[] |
| c2-number-theory.js | PASS | 否 | plan+context → SQ[] | SemanticQuestion[] |
| c5-c6-journey-engineering.js | PASS | 否 | plan+context → SQ[] | SemanticQuestion[] |
| c7-clever-calc.js | PASS | 否 | plan+context → SQ[] | SemanticQuestion[] |
| c9-comprehensive.js | PASS | 否 | plan+context → SQ[] | SemanticQuestion[] |
| index.js | PASS | 否 | 聚合索引 | BY_ID 映射 |

---

## Generator 边界分析

### 允许依赖

- `../core/rng.js` — 随机数
- `../core/arithmetic-core.js` — 算术核心
- `../core/op-semantics.js` — 运算语义

### 禁止依赖（均未出现）

- Strategy ❌
- Orchestrat ❌
- Presentation ❌
- SVG ❌
- Validator ❌（仅 RetryLoop 间接触发）
- knowledge-bank ❌
- POL ❌

### 输出契约

所有 Generator 输出统一为 SemanticQuestion[]：

```javascript
{
  knowledgePointId: string,
  questionType: string,
  difficulty: number,
  difficultyParams: object,
  numberRange: object,
  spiralLevel: number,
  context: object,
  seed: number,
  prompt: string,
  answer: { value, acceptable, explanation },
  answerMode: string,
  hint: string,
  data: { mode, steps, ... }
}
```

---

## 特殊 Generator

### generator:composite

| 检查项 | 结果 |
|--------|------|
| supportsComposite | 仅 3 个 Generator 支持 |
| COMPOSITE_KPS | 特殊设计别名 |
| 18 special aliases | 设计别名，非 legacy KP |
| 成为第二个 POL | 否 |

**结论**：Composite 只是特殊生成策略，不是第二个 POL。

---

## Generator 审计总结

| 审计项 | 状态 | 关键发现 |
|--------|------|----------|
| 禁止依赖 | ✅ PASS | 19/19 模块无禁止依赖 |
| HTML/SVG | ✅ PASS | 零直接 HTML/SVG/DOM 生成 |
| 输入契约 | ✅ PASS | 统一 plan+context 契约 |
| 输出契约 | ✅ PASS | 统一 SemanticQuestion[] |
| Composite | ✅ PASS | 不是第二个 POL |

**总体判定**：Generator 边界完全合规。
