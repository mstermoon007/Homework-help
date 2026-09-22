# P16-FOLLOWUP-D4：Generation 唯一入口

## D4-01 唯一入口

### 最终正式入口

```js
GenerationCore.execute(plan)
```

内部流程：

```js
execute(plan)
  → executeCell(cell)
```

### 成为唯一入口的标准

1. 所有调用路径汇入 `GenerationCore.execute()`
2. `api.js executeInline()` 迁移至 `GenerationCore.execute()` 后成为兼容入口
3. `runtime caller = 0`（不再有直接的 runtime 调用指向旧入口）
4. 调用链彻底重构：`GenerationCore → executeCell → Strategy → GeneratorSelector → Generator → Validator → SemanticQuestion → Presentation`

### 迁移时间表

```text
第一阶段：executeInline → GenerationCore.execute()（兼容入口）
第二阶段：所有调用迁移至 GenerationCore.execute()
第三阶段：runtime caller = 0（确认无旧调用）
第四阶段：删除 executeInline
```

---

## D4-02 最终执行链

固定执行链：

```text
GenerationCore
  │
  ▼
executeCell
  │
  ▼
Strategy
  │
  ▼
GeneratorSelector
  │
  ▼
Generator
  │
  ▼
Validator
  │
  ▼
SemanticQuestion
  │
  ▼
Presentation
  │
  ▼
HTML / SVG / Print
```

### 关键中转点

1. `executeCell(cell)` - Cell执行入口，决定生成单元格的参数
2. `Strategy` - 决定此 Cell 应该如何生成
3. `GeneratorSelector` - 选出可执行此 Cell 的 Generator
4. `Generator` - 根据 Cell 和 Strategy 生成候选题目
5. `Validator` - 验收生成题目的质量
6. `SemanticQuestion` - 完成语义验证，转换为标准题目对象
7. `Presentation` - 渲染为 HTML / SVG / Print

---

## D4-03 executeInline处理

### 现有情况

```js
api.js
executeInline()
```

### 迁移第一阶段：兼容入口

```js
executeInline
  → GenerationCore.execute()
```

成为兼容入口，确保旧代码不报错。

### 完成后

```text
runtime caller = 0
```

再删除 `executeInline`。

**原则**：先作兼容，再删除。

---

## D4-03 GenerationAPI收口

### 最终

```js
GenerationAPI.generate()
```

只负责：

```js
接收请求
  → 调用POL
  → 获得GenerationPlan
  → 调用GenerationCore
  → 返回结果
```

不得在 API 内继续塞：

```text
Strategy
Generator
Validator
Render
SVG
```

---

## D4-05 全量验收矩阵

### A. Contract

```text
PracticeRequest PASS
PracticePlan PASS
GenerationPlan PASS
Cell PASS
```

### B. 数量

测试：

```text
count=1
count=7
count=20
count=100
```

验证：

```text
planned >= generated
generated = final
Σ cells.planned = totalPlanned
```

### C. 题型

分别测试：

```text
calc
fill
choice
judge
geometry
apply
```

以及：

```text
multi-type
typeCounts
alias
invalid type
```

重点确认 canonical/alias 最终只有一套解释。

### D. 难度

测试：

```text
1
2
3
4
5
6
7
8
9
10
```

验证：

```text
Request
  ↓
POL
  ↓
Cell
  ↓
Strategy
  ↓
Generator
```

难度不丢失、不变形。

### E. 多知识点 × 多题型

例如：

```text
3 KP
×
3 types
×
20 questions
```

验证：

```text
Cell数量正确
每Cell planned正确
没有Generator自行抢量
没有题型漂移
```

### F. 失败与 Recovery

构造：

```text
某Cell planned=5
实际只能生成3
```

验证：

```text
Generation
→ shortfall=2
→ POL Recovery
```

不能：

```text
Generator自行改成其他KP
Generator自行改成其他type
Generator自行提高数量
```

