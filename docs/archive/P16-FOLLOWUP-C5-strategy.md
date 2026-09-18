# P16-FOLLOWUP-C5：Strategy 归位

## C5-01 清理 Strategy 的 KBL 越权

### 发现的 KBL 超权行为

1. **comprehensive-strategy.js:26-29** `getKB()` 函数
   - 尝试读取 `global.KnowledgeBank` 或 require `knowledge-bank.js`
   - 用法：`var KB = getKB();` 后续使用 `KB` 进行题型/难度判定
   - **地位**：已废弃的兼容层，不应在新规划中使用

2. **comprehensive-strategy.js:162** `var KB = getKB();`
   - 直接使用获取的 KB 进行题型/难度判定
   - **地位**：遗留兼容代码，不应在新规划中使用

3. **strategy-engine.js:69** `var KB = require('../knowledge/knowledge-bank.js');`
   - 直接 require 知识银行
   - **地位**：已废弃的直接依赖，不应在新规划中使用

4. **strategy-engine.js:205-206** 
   - `var KnowledgePoint = require('../knowledge/knowledge-point.js');`
   - `var KB = require('../knowledge/knowledge-bank.js);`
   - **地位**：已废弃的直接依赖，不应在新规划中使用

### C5-01 干预措施

1. **comprehensive-strategy.js**: 
   - 移除 `getKB()` 函数及其调用
   - 移除 `var KB = getKB();` 及其后续使用
   - 改为通过 `KnowledgeContext.strategyView()` 或 `KnowledgeContext.kpsForGrade()` 获取所需信息

2. **strategy-engine.js**: 
   - 移除 `var KB = require('../knowledge/knowledge-bank.js');`
   - 移除 `var KnowledgePoint = require('../knowledge/knowledge-point.js');`
   - 改为通过 `KnowledgeContext` 相关接口获取所需信息

3. **其它涉及文件**: 
   - `target-difficulty.js`、`strategy-request.js` 等不涉及直接的 KBL 读取，保持不变

### C5-01 完成标志

- `comprehensive-strategy.js` 中不再包含 `getKB()` 与 `KB` 变量
- `strategy-engine.js` 中不再包含直接 `require('../knowledge/knowledge-bank.js')`
- 所有 KP 相关获取通过 `KnowledgeContext` 正规接口进行

---

## C5-02 Strategy 归位

### Strategy 最终职责

```text
输入：Cell + StrategyContext
输出：这个 Cell 应该怎么生成？
```

Strategy 决定：

```text
数字范围
运算结构
复杂度
题面形式
认知要求
约束
生成参数
```

不决定：

```text
总题量
总题型
其他 Cell
整体 Recovery
```

### Strategy 与 KBL 的边界

- **允许**：`KnowledgeContext.strategyView(kpIds)`，`KnowledgeContext.kpsForGrade(subject, grade)`
- **禁止**：`KnowledgeBank` 直接读取、`KnowledgeBank` JSON 文件直读、KPL 级别的数据直接访问

### Strategy 与 Generator 的边界

- **允许**：决定 Generator 类型、候选 Generator 排序
- **禁止**：直接实例化 Generator、直接调用 Generator.generate()

### Strategy 与 Validator 的边界

- **允许**：验收通过与否的判定依据
- **禁止**：重新规划题量、题型、难度

---

## C5-03 全面收回

### 全面收回原则

> 自 C1 合同冻结以来，所有权逐步收回：

1. **数量权** → POL（C2完成）
2. **题型权** → POL（C3完成）
3. **难度权** → POL + difficulty.js（C4完成）
4. **执行入口** → GenerationCore（C6完成）
5. **Strategy 定位** → 仅为 Cell 服务（C5完成）
6. **Generator 职责** → 只生产不决策（C7完成）
7. **Validator 职责** → 只验收不规划（C8完成）
8. **Presentation 展示** → 仅展示（C10完成）
9. **SVG后移** → GeometryIR → Validator → SemanticQuestion → Presentation（C11完成）
10. **冗余门禁清理** → 删除无效 gate/probe/bridge（C12完成）
11. **Compatibility冗余清理** → 删除无效 compatibility（C13完成）
12. **旧链接清理** → 删除 dead code / dead links（C12-01完成）

### 最终架构定图

```text
                    KBL
                     │
                KnowledgeContext
                     │
                     ↓
                     POL
        │------------------│------------------│
        范围/数量/题型/难度│            │策略决定      │生产
        Plan / Cell                │            │生产
        └────────────┬───────────┘            └──┬──────┘
                     │                    │
                GenerationPlan          Generator
                       │                    │
                       │                    │
                       ▼                    ▼
                GenerationCore          Validator
                       │                    │
                       ▼                    ▼
                SemanticQuestion     质量闸门
                       │                    │
                       ▼                    ▼
                Presentation            │
                HTML/SVG/Print          │
                               │
                               ▼
```

