# P16-FOLLOWUP-C2：收回数量权

## C2-01 唯一数量权

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

| 控制点 | 决策权 | 备注 |
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

### C2-03 容量形式冻结

Capacity 的定义冻结为**可行性约束，不是调度器**：

正确：
```text
POL
  ↓
查询 Capacity
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

---

## C2-03 量控决策审计表

| 控件 | 文件 | 当前行为 | 冻结后决策权 | 冻结状态 |
|------|------|--------|-------------|----------|
| 默认题量 | practice-orchestrator.js:217 | `count = req.count ?? req.volume ?? 20` | **POL**（保留） | ✅ 冻结 |
| 显式 typeCounts | practice-orchestrator.js:253-257 | `perTypeCount` 统一每题型数量 | **POL**（保留） | ✅ 冻结 |
| 总计划总量 | practice-orchestrator.js:305-307 | `perTypeCount` 受 `count` 约束 | **POL**（保留） | ✅ 冻结 |
| 题型预算分配 | budget-allocation.js | 在 typeCaps 约束下 Round-Robin 均衡 | **POL提供 typeCaps（约束）**（冻结） | ✅ 冻结 |
| 容量检查 | capacity-inventory.js / capacity-map.json | 375 KP 扫描， tiers分级 | **约束**（冻结，不作调度） | ✅ 冻结 |
| Generator retry | generator-selector.js / RetryLoop | `score.kp` 判定，不改变 planned/count | **受限**（冻结） | ✅ 冻结 |
| BatchValidator 收缩 | BatchValidator | D8/R8 候选耗尽 | **仅报告，不改数量**（冻结） | ✅ 冻结 |

---

## C2-04 量控决策冻结确认

经审计确认：

1. **POL 仍是唯一的数量决策入口**——`count`、`typeCounts`、`totalPlanned` 均出自 `practice-orchestrator.js` 的 `req` 参数
2. **Capacity 作为约束边界**——`capacity-inventory` 与 `capacity-map` 提供可行性判断，不作为重新分配依据
3. **Generator/Validator 仅为执行/验收**——不自行修改 `count`/`typeCounts`/`totalPlanned`
4. **Recovery 由 POL 决定**——`allocateRecovery` 为 POL 专属，Generator 仅在同一 Cell 内 `retry`

**结论**：数量权已冻结，POL 为唯一决策者。进入 C3：收回题型权。
