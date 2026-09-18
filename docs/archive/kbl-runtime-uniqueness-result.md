# 清单 C/D：Knowledge Source Inventory + 最终唯一性结论

> 来源：`dev/check-kbl-uniqueness.js`（2026-09-13）
> 关联：`docs/kbl-runtime-uniqueness-audit.md`（主报告）｜清单 A/B 同目录

---

## 清单 C：Knowledge Source Inventory

```text
KBL Runtime（shared/knowledge/runtime/knowledge-runtime.js）
    ↓
唯一生产知识事实源（KP / Unit / Grade / Book / Relations / Selectable / CanGenerate / Stats）
    ↓
11 个 DATA_FILES（shared/knowledge/{data,relations,mappings,index,manifest}）
```

### 其他知识源清单

| # | 对象 | 类型 | 判定 |
|---|---|---|---|
| 1 | `archive/legacy-tests/*`、`archive/legacy-tools/*` | archive | 非生产 |
| 2 | `dev/*`、`tools/kbl/*`、`scripts/*` | build/test only | 非生产 |
| 3 | `docs/*`、`shared/knowledge/README.md` | docs | 非生产 |
| 4 | `shared/capacity/capacity-map.json` | 派生缓存（非知识事实） | 非第二知识源 |
| 5 | `shared/catalog/module-catalog.js`、`question-type-registry.js`、`schemas/*` | 元数据 | 非第二知识源 |
| 6 | `shared/generator/**` 绑定表（legacy ID 引用） | 绑定元数据 | 非第二知识源（B5/B6 范围外） |
| 7 | `knowledge/*.html` | 静态内容页 | 非生产运行时 |
| 8 | `shared/engine/presentation-engine.bundle.js` 内联 Runtime/Context 副本 | 同源代码副本（非独立数据） | **FAIL-003（副本，非第二数据源）** |

### 结论

```text
Second Production Knowledge Source = NO
```

---

## 清单 D：最终唯一性结论

```text
KBL Runtime Uniqueness = FAIL
```

| 维度 | 判定 | 依据 |
|---|---|---|
| Production Runtime | **PASS** | 无生产文件直读 KBL 数据 JSON；无第二生产知识源；生产路径全部到达 `App.KNOWLEDGE` |
| POL KnowledgeContext | **PASS** | 唯一适配边界；委托 Runtime + 形状投影；无数据副本 / 无查询重实现（另见 FAIL-003 副本） |
| Compatibility Bridge | **PASS** | Bridge Type = **Delegation**（`get`→`strategyView`、`getEntries`→`poolContext`、`normalize`→恒等） |
| Browser Runtime | **FAIL** | FAIL-003：presentation bundle 内联第二份 KnowledgeContext + Runtime 副本；页面序下 Runtime 副本休眠、Context 副本覆盖 `global.KnowledgeContext` |
| Generator Boundary | **PASS** | 可变生成器零知识访问（消费 POL Practice Context）；Frozen registry/selector 经 compat 委托 |
| Test Boundary | **PASS** | 测试/构建/归档/文档均分类隔离；测试未掩盖唯一性问题 |
| Second Knowledge Source | **NO** | 唯一生产知识事实源 = KBL Runtime |
| Bypass Path（活跃） | **NO** | 生产路径无绕过；FAIL-001 为惰性残留（全局未定义 + 工厂无调用方） |

---

## FAIL 明细（登记 `docs/pol-kbl-pending.md`，本次不修复）

### FAIL-001

```text
文件：     shared/presentation/render.js（148、201-202）
调用者：   createPlugin → createMathPlugin（当前无外部调用方）
知识数据： 旧 KnowledgeBank.getEntries（KP 条目）
绕过路径： global.KnowledgeBank（运行时从未定义 → _kb=null → 路径不可达）
当前入口： 无（惰性）
应经过：   KnowledgeContext → KBL Runtime（或随旧轨工厂一并退役）
风险：     低（惰性）；若未来有人定义 global.KnowledgeBank 或启用该工厂，即成真实绕过
```

### FAIL-002

```text
文件：     shared/validator/kp-semantic-validator.js（247、249）
调用者：   validateKpSemantics → checkComposite（仅 plan.combine 且 KP>1 时执行）
知识数据： 旧 KnowledgePoint.get / Ontology.normalize（未定义标识符）
绕过路径： 无实际读取；触发即 ReferenceError（combine 上游当前不可达）
当前入口： 无（惰性）
应经过：   KnowledgeContext.get + 投影视图（或删除该启发式）
风险：     中（潜在崩溃）；combine 恢复（B6 迁移）后将成为运行时错误
```

### FAIL-003

```text
文件：     shared/engine/presentation-engine.bundle.js（4116 / 4398 / 4923）
调用者：   Bundle 装载（页面序第 6 步）
知识数据： 内联第二份 knowledge-context.js + knowledge-runtime.js（同源代码，非独立数据）
绕过路径： 无（副本经同一 App.KNOWLEDGE 实例委托）
当前入口： Bundle 内 kp-semantic-validator → KC（触发副本装载）
应经过：   构建期将 KC/runtime 注册为 strategy bundle 委托模块（或纳入 strategy bundle），消除副本
风险：     中（适配器实例唯一性被破坏；Runtime 副本休眠，但若页面序变化/独立装载将挂载第二个 App.KNOWLEDGE）
```

---

## 验收对照（STEP 21）

- 合法结束状态：**FAIL**（存在 3 项，均已登记，未修复）
- 生产知识源：KBL Runtime（唯一）
- 适配边界：KnowledgeContext（唯一代码，存在 FAIL-003 副本）
- 兼容桥：Runtime delegation only
- Browser runtime：1 个 App.KNOWLEDGE 实例；旧知识全局未定义
- Generator boundary：PASS
- Second production knowledge source：NO
- Production bypass（活跃）：NO
