# P17-0 Legacy / 死代码 / 测试真实性审计

## LEGACY-01：Legacy 残留

### 扫描结果

| 检查项 | 结果 |
|--------|------|
| legacy registry records | 0 ✅ |
| legacy bindings | 0 ✅ |
| 总 KP bindings | 116 ✅ |
| capability-map legacy keys | 0 ✅ |
| 旧插件轨道（MATH-14） | 已删除 ✅ |

**LEGACY-01 状态**：✅ PASS

---

## LEGACY-02：死代码 / 冗余

### 变更状态（与 HEAD 对比）

工作区存在未提交删除的适配层文件（WIP 清理中）：

```
D shared/generation/adapters/capability-service.adapter.js
D shared/generation/adapters/knowledge-graph-service.adapter.js
D shared/generation/adapters/module-catalog-service.adapter.js
D shared/generation/dto.js
D shared/generation/orchestrator.js
D shared/generation/rollback-manager.js
D shared/generation/services/capability-service.js
D shared/generation/services/knowledge-graph-service.js
D shared/generation/services/module-catalog-service.js
```

这些文件已在工作区删除（git status 为 D），说明是合理清理。

**LEGACY-02 状态**：✅ 清理中（WIP）

---

## TEST-01：测试真实性审计

### npm test 实际运行结果

**关键事实**：npm test **未全绿**。P11-01 编排测试有 4 项失败：

| 失败项 | 期望 | 实际 | 根因 |
|--------|------|------|------|
| C1 正常单题型 count=20 | 20 | 1 | `math-g2-down-u01-k001` 容量 total=1 |
| C7 Capacity 限制 | PARTIAL | 失败 | 同上 |
| C8 Recovery | recovery 发生 | 未发生 | 无 recovery 空间 |
| C9 legacy 别名 oral→calc | 10 | 1 | 同上（该 KP 容量 1） |

### C1 失败根因

```
capacity-map.json
  math-g2-down-u01-k001:
    total: 1
    tier: VERY_LOW
    byType: { calc: 1, fill: 1, choice: 1, apply: 3 }
    limited: true
    limitedKind: GENERATOR_LIMITED
```

该 KP（钟面结构）因 capacity-inventory.js:120 无原始计数佐证，默认归为 GENERATOR_LIMITED，容量收敛为 1。

而测试 p11-01 用 `KPS = KC.poolKpIds(grade 2).slice(0,3)` 选中的第一个 KP 恰是此限制 KP，导致预算上限 1。

### 测试与事实偏差

测试文件注释声明 "canonical 题型为 6"，但实际代码 canonical = 7（含 classify）。

| 声明 | 实际 | 偏差 |
|------|------|------|
| canonical 6 题型 | canonical 7 题型（calc/fill/choice/judge/geometry/classify/apply） | 测试文档过时 |
| oral → calc 别名 | 仍有效 | 测试期望与容量数据冲突 |

### TEST-01 状态：⚠️ 4 测试失败，需修复测试期望或容量数据

---

## 问题分类（FINAL）

| 类别 | 问题 | 状态 |
|------|------|------|
| A. DATA | `math-g2-down-u01-k001` 容量=1（GENERATOR_LIMITED） | ⚠️ 数据问题，需人工确认 |
| B. CONTRACT | canonical 题型 6 vs 7 文档过时 | ⚠️ 契约文档需对齐 |
| C. GENERATION | Strategy→KBL 直接访问 3处 | ❌ BLOCK |
| C. GENERATION | Validator→Context/Generator 2处 | ❌ BLOCK |
| C. GENERATION | PresentationEngine 含生成逻辑 | ⚠️ BLOCK |
| C. GENERATION | GenerationCore 未落地 | ⚠️ BLOCK |
| D. GENERATOR | 边界合规 | ✅ PASS |
| E. PRESENTATION | SVG/SQ 边界 | ✅ PASS |
| F. DEAD/LEGACY | legacy=0 | ✅ PASS |