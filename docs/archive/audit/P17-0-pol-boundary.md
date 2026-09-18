# P17-0 POL 边界审计

## POL-01：唯一 POL 入口

### 调用链确认

```
UI (practice.html)
  → PracticeSession.start()
    → GenerationAPI.generate(req, options)
      → PracticeOrchestrator.orchestrate(req, options, { execute: executeInline, render: renderQuestions, getRenderOptions })
        → plan(request) → 拆分cells → runCells(cells) → execute(cellReq)
          → executeInline(req, options)
            → build(request) → StrategyEngine.plan()
            → runPlans(plans)
              → PresentationEngine.generateQuestions(plan)
                → Selector → RetryLoop → BatchValidator → SemanticQuestion
```

### 验证结果

| 路径 | 文件 | 行号 | Runtime 确认 |
|------|------|------|-------------|
| PracticeSession → GenerationAPI | practice-session.js | 118 | ✅ Runtime |
| GenerationAPI → PracticeOrchestrator | api.js | 478-480 | ✅ Runtime |
| PracticeOrchestrator.orchestrate | practice-orchestrator.js | 408 | ✅ Runtime |
| orchestrate → executeInline | api.js | 481 | ✅ Runtime |
| executeInline → build | api.js | 407 | ✅ Runtime |
| executeInline → runPlans | api.js | 407 | ✅ Runtime |

### POL-01 状态：✅ PASS

**结论**：POL Runtime Entry = 1（PracticeOrchestrator.orchestrate）。

---

## POL-02：POL 权责审计

### POL 拥有的权限

| 权责 | 是否拥有 | 证据 |
|------|----------|------|
| Practice Request normalization | ✅ | practice-orchestrator.js:plan() |
| Knowledge scope | ✅ | selectedKPs |
| selectedTypes | ✅ | selectedTypes |
| Cell | ✅ | runCells(cells) |
| total quantity | ✅ | req.count |
| planned quantity | ✅ | cell.count |
| type allocation | ✅ | cell.questionType |
| difficulty coordination | ✅ | genReq.difficulty |
| capacity feasibility | ✅ | capacity-inventory.js |
| recovery coordination | ✅ | recovery 逻辑 |

### POL-02 状态：✅ PASS

---

## POL-03：POL 越权扫描

| 禁止行为 | 是否出现 | 状态 |
|----------|----------|------|
| POL → Generator.generate | 否 | ✅ |
| POL → GeneratorSelector | 否 | ✅ |
| POL → SVG | 否 | ✅ |
| POL → HTML 操作 | 否 | ✅ |
| POL → DOM | 否 | ✅ |
| POL → Print | 否 | ✅ |
| POL → Presentation | 否 | ✅ |

**POL require 清单**：
- `./practice-plan.js` ✅
- `./budget-allocation.js` ✅
- `../request/request-normalize.js` ✅
- `./knowledge-context.js` ✅
- `../capacity/capacity-inventory.js` ✅
- `../capability/knowledge-capability-view.js` ✅
- `../strategy/target-difficulty.js` ✅
- `./difficulty-orchestrator.js` ✅

### POL-03 状态：✅ PASS

---

## POL-04：POL 是否重新调度

| 检查项 | 是否出现 | 状态 |
|--------|----------|------|
| Capacity 重新分配 | 否 | ✅ |
| Generator 失败偷偷改变 Cell | 否 | ✅ |
| Recovery 越权 | 否 | ✅ |

### POL-04 状态：✅ PASS

---

## POL-05：数量权威审计

### 验证链

```
contract ≥ planned ≥ generated = final
Σ cells.planned = totalPlanned
```

| 检查项 | 状态 |
|--------|------|
| Generator 不修改 count | ✅ |
| Validator 不修改 count | ✅ |
| Presentation 不修改 count | ✅ |
| Capacity 不重新分配 count | ✅ |

### POL-05 状态：✅ PASS

---

## POL 边界总结

| 审计项 | 状态 | 关键发现 |
|--------|------|----------|
| POL-01 唯一入口 | ✅ PASS | PracticeOrchestrator.orchestrate 是唯一入口 |
| POL-02 权责完整 | ✅ PASS | 所有编排权限在 POL |
| POL-03 无越权 | ✅ PASS | 不直接访问 Generator/Selector/Validator/Presentation |
| POL-04 无重调度 | ✅ PASS | Capacity 是约束，不是调度器 |
| POL-05 数量权威 | ✅ PASS | 数量决策在 POL |

**总体判定**：POL 边界完全合规。

---

## 关键发现

### executeInline 是 POL 的执行钩子

POL.orchestrate() 接收 `execute: executeInline` 作为依赖注入。这是 POL 与生成层的唯一接口。

```
orchestrate(request, options, deps)
  → deps.execute(cellReq, ...) // 即 executeInline
```

### PresentationEngine 是生成执行层

虽然名为"Presentation"，但 `PresentationEngine.generateQuestions()` 实际承担：
- Generator 选择（Selector）
- 重试循环（RetryLoop）
- 质量验证（BatchValidator）
- 语义问题对象创建（SemanticQuestion）

这是 P17 必须处理的核心问题：**生成逻辑藏身 Presentation 层**。
