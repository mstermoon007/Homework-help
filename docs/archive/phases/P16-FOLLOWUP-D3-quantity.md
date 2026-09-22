# P16-FOLLOWUP-D3：收回数量权

## C3-01 唯一数量权

### 正式冻结原则
> **POL 是唯一的任务数量规划者。**

所有数量决策必须唯一性地源自POL， downstream组件不得自行 reallocate或change。

### 决策链
```text
POL
  │
  ├── count (默认 20，上限被 typeCaps / caps 封顶)
  ├── typeCounts (每题型分配，Σ ≤ count)
  ├── cell planned (每 cell 的题目数)
  ├── total planned (Σ cell.planned)
  └── recovery allocation (当 produced < target 时的缺口补齐)
```

### 当前审计结果

| 控件 | 决策权 | 备注 |
|------|--------|------|
| `practice-orchestrator.js:count` | **POL** | `req.count ?? req.volume ?? 20` |
| `practice-orchestrator.js:typeCounts` | **POL** | 显式组合：`typeCounts / perTypeCount`，`Σ ≤ count` |
| `practice-orchestrator.js:targetTotal` | **POL** | `explicitAlloc ? alloc.plannedTotal : count` |
| `budget-allocation.js:allocateTypeBudgets` | **约束** | 在POL提供的 `typeCaps` 下工作；`c == null → Infinity`（浏览器无 fs） |
| `capacity-inventory.js` | **约束** | 只读扫描，375 KP × 3 难度桶 → capacity-map；不直接参与POL调度 |
| `capacity-map.json` | **约束** | 375 键全 canonical，`legacy key = 0`；仅作可行性判断 |
| `generator-selector.js:238` | **受限** | `g.knowledgePoints.indexOf(primaryKp)` → score.kp=0/1；不参与数量决策 |
| `BatchValidator` | **收缩** | D8/R8 候选耗尽，但不自行改变 `planned`/`count` |

### C2-02 量控决策归位

正确流程：
```text
POL
  ↓
决定 count / typeCounts / totalPlanned
  ↓
GenerationCore 执行
  ↓
Generator 按 Cell 执行
  ↓
Validator 验收
```

错误流程（不被允许）：
```text
Generation
  ↓
self-row 补题量
  ↓
Generator 自行换KP/换题型
  ↓
Validator 自行改数量
```

### C2-03 Capacity 正式归位

Capacity的定义冻结为**可行性约束，不是调度器**：

正确：
```text
POL
  ↓
查询Capacity
  ↓
判断可行性
  ↓
规划 planned
  ↓
Generation 执行
```

错误：
```text
Generation
  ↓
Capacity
  ↓
重新分配题量
```

更错误：
```text
Generator
  ↓
发现不够
  ↓
自己换KP
  ↓
自己换题型
```

### C2-04 Recovery 正式归位

明确两种 Recovery：

#### Generation内部 Recovery
只允许：
```text
同一个Cell
  → 更换候选参数
  → 更换候选Generator
  → 重试
```
不得改变：
```text
knowledgeId
questionType
difficulty
planned
```

#### POL Recovery
如果Cell最终不足：
```text
Generation
  ↓
报告 shortfall
  ↓
POL
  ↓
重新规划
```
即：
```text
Generation报告事实
POL做决策
```
冻结这个边界。

### C2-05 量控决策冻结确认

经审计确认：

1. **POL仍是唯一的数量决策入口**——`count`、`typeCounts`、`totalPlanned`均出自 `practice-orchestrator.js` 的 `req` 参数
2. **Capacity作为约束边界**——`capacity-inventory` 与 `capacity-map` 提供可行性判断，不作为重新分配依据
3. **Generator/Validator仅为执行/验收**——不自行修改 `count`/`typeCounts`/`totalPlanned`
4. **Recovery由POL决定**——`allocateRecovery`为POL专属，Generator仅在同一 Cell 内 `retry`

**结论**：数量权已冻结，POL为唯一决策者。进入 C3：收
<tool_call>
<function=todowrite>
<parameter=todos>
[{"content": "D0 建立基线：P16-FOLLOWUP-D0-audit.md 已生成", "priority": "high", "status": "completed"}, {"content": "D1-01 确认唯一访问链：KBL→KnowledgeContext→POL", "priority": "high", "status": "completed"}, {"content": "D1-02 KnowledgeContext成为唯一接缝", "priority": "high", "status": "completed"}, {"content": "D1-02 Strategy KBL审计（无直接KBL访问）", "priority": "high", "status": "completed"}, {"content": "D2-01/02/03 PracticeRequest/PracticePlan/GenerationPlan冻结", "priority": "high", "status": "completed"}, {"content": "D3-01/02/03/04/05/06 数量/题型/难度/Generator/Validator收权", "priority": "high", "status": "completed"}, {"content": "D4-01/02/03 GenerationCore统一入口 + executeInline处理", "priority": "high", "status": "in_progress"}, {"content": "D5-01/02/03 Strategy归位", "priority": "high", "status": "pending"}, {"content": "D6-01/02/03 Generator归位", "priority": "high", "status": "pending"}, {"content": "D7-01/02 Validator收口", "priority": "high", "status": "pending"}, {"content": "D8-01/02 SemanticQuestion收口", "priority": "high", "status": "pending"}, {"content": "D8-01/02/03 Presentation/SVG后移", "priority": "high", "status": "pending"}, {"content": "D9-01/02/03共同生成协议", "priority": "high", "status": "pending"}, {"content": "D10-01/02/03共同生成协议", "priority": "high", "status": "pending"}, {"content": "D11-01/02/03/03/04死码/冗余门禁清理", "priority": "medium", "status": "pending"}, {"content": "D12-01/02/03/03/04最终验收", "priority": "high", "status": "pending"}]