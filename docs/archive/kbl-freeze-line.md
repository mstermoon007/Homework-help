# KBL Freeze Line（P16-FOLLOWUP-B6 收口）

> 2026-09-15 冻结。冻结线非系统层，而是**开发约束 + 检查规则**。
> 冻结线以上（KBL 核心）未经明确授权不得修改架构、数据语义、ID 规则、Runtime 接口；
> 冻结线以下可正常开发，但任何模块不得绕过 KnowledgeContext 重新访问 KBL。

```text
                         KBL FREEZE LINE
════════════════════════════════════════════════════
人工源 Root Excel（唯一 / 只读）
   │ READ ONLY
   ▼ Extract（extract-source.js → extract-raw.json）
   │
   ▼ derive-kbl.js  ← Canonical 五类唯一派生入口
   │    course / knowledge / relations / capability / mappings
   ▼
KBL Runtime（只读镜像，rootHash 校验，10 文件）
   │ READ ONLY
   ▼
KnowledgeContext（唯一业务接缝，global App.KNOWLEDGE 单入口）
══════════════ KBL FROZEN ══════════════════════════
   ▼
POL → Strategy → Generator → Validator → SemanticQuestion → Presentation/SVG/Print
```

## 冻结规则

1. **Root 唯一**：`kbl/root/小学G1-G6数学知识点.xlsx` 是唯一人工源。
2. **Root 只读**：任何程序不得写回 Excel。
3. **Canonical 唯一派生**：只有 `tools/kbl/derive-kbl.js` 写入 canonical；禁止第二套 KBL Builder。
4. **Runtime 只读**：禁止新增 update/save/patch/modify/write 路径。
5. **KnowledgeContext 唯一业务接缝**：禁止 POL→KBL data、Generator→KBL data、UI→KBL data。
6. **禁止 Legacy 回归**：任何 legacy KP / legacy ID / old KnowledgeBank / old KBL input 进入运行数据 = 冻结线违规。
7. **KBL 不负责**：KBL 不得承担 difficulty 计算 / 题目生成 / 分配 / 渲染 / SVG / 打印 / UI 决策。

## 验证职责表（唯一负责人原则）

| 检查 | 唯一职责 | 归属 |
|---|---|---|
| `kbl:verify` | KBL 全链完整性（Root/Extract/Canonical/Runtime/rootHash/Legacy） | KBL |
| `verify-kbl-runtime` | Runtime 完整性 | KBL Runtime |
| `check-knowledge-access` | 知识访问单入口 | KBL 边界 |
| `test:pol-kbl-shape` | KBL→POL 接缝 | POL |
| `test:kbl-uniqueness` | KBL 唯一性 | KBL |
| `check-generator-capability` | Generator capability（含 legacy 绑定门禁） | Generation |
| `verify:f-type-2` | 题型链（声明 ⊆ supported） | Generation |
| `test:pol-generation` | POL→Generation | POL |
| `verify:golden` | 可复现生成 | Generation |
| `verify:frozen-core` | Frozen Core | 项目级 |

原则：**一个核心不变量只有一个主要验证负责人**。仅当两检查输入+断言+失败含义完全相同才合并；角度不同则保留（不机械删）。

## Legacy 边界定义

本冻结线所述 Legacy 特指**旧 KB 的 canonical ID 家族**（`k\d{3}` 编号，格式
`^math-g[1-6]-(up|down|mixed|advance)-u\d{2}-k\d{3}$` 之外的旧 id）。
编排别名（如 `m1-addsub-10`、`mixed-chain`，供 composite/complex 生成器路由与
Verify 采样使用）**不是 Legacy KP**，属 D 类设计别名；一旦其失去引用，逐步清除。

## 变更历史

- P16-02：`derive-kbl.js` 成为 Canonical 五类唯一派生入口（course/knowledge/relations 补齐写者）。
- P16-FOLLOWUP-B6：删除 `generator-registry.js` knowledgePoints 中 261 条 legacy KP 绑定
  （246 唯一；保留 116 canonical）；重建 strategy-engine.bundle；重建 capacity-map（375 键、
  legacy 0）；`verify-setup.js` 采样对齐 canonical；frozen-core 基线按授权更新。
- legacy 数据统计至此：Registry=0 / Bundle=0 / Capacity=0 / 运行引用=0。