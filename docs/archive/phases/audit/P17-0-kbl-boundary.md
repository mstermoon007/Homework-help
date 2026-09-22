# P17-0 KBL 边界审计

> **P17-5 复核（2026-09-16）**：本文件 KBL-01/KBL-04 的 ❌ BLOCK 结论基于**冻结源码静态扫描**。
> 运行时复核后修正为 ✅ —— Strategy 的 KBL 访问在真实 Runtime 中经 bundle SHIM →
> `KnowledgeBankCompat.getEntries` → `KnowledgeContext.poolContext`，**边界合规**（详见文末「P17-5 运行时复核」）。

## KBL-01：唯一知识入口（KBL Runtime Entry Points）

### 目标

确认 Runtime KBL 入口 = 1，旧入口 = 0。

### 实际审计结果

| 入口点 | 文件 | 行号 | Runtime/Dev/Test | 状态 |
|--------|------|------|------------------|------|
| `require('../knowledge/knowledge-bank.js')` | strategy-engine.js | 69 | Runtime | ❌ BLOCK |
| `require('../knowledge/knowledge-bank.js')` | strategy-engine.js | 206 | Runtime | ❌ BLOCK |
| `require('../knowledge/knowledge-bank.js')` | comprehensive-strategy.js | 29 | Runtime | ❌ BLOCK |
| `require('../knowledge/runtime/knowledge-runtime.js')` | knowledge-context.js | 25 | Runtime | ✅ OK |

**结论**：Runtime KBL 入口 = **3个违规入口**，0 个合规入口。

策略层通过 knowledge-bank.js 直接访问 KBL JSON 数据，完全绕过 KnowledgeContext 边界。

### KBL-01 状态：❌ BLOCKED

---

## KBL-02：KBL 数据真实性

| 数据项 | 声明值 | 实际值 | 一致性 |
|--------|--------|--------|--------|
| knowledgeCount | 375 | 375 | ✅ |
| unitCount | 128 | 128 | ✅ |
| relationCount | 0 | 0 | ✅ |
| mappingCount | 1570 | 1570 | ✅ |
| capabilityCount | 375 | 375 | ✅ |
| capacityMapKeys | 375 | 375 | ✅ |
| canonicalCourseCount | 12 | 12 | ✅ |

**KBL-02 状态**：✅ PASS

---

## KBL-03：KnowledgeContext 边界

### knowledge-context.js 职责确认

```
KnowledgeContext.strategyView(kpIds)  ✅ 存在
KnowledgeContext.kpsForGrade(subj, grade) ✅ 存在
KnowledgeContext.get(kpId) ✅ 存在
KnowledgeContext.poolKpIds(subj, grade, book) ✅ 存在
KnowledgeContext.selectable(subj, grade) ✅ 存在
```

### 禁止行为

| 禁止行为 | 是否出现 |
|----------|----------|
| 重新查询 KBL | ✅ 无（通过 runtime 引用，合法） |
| 重新定义知识点 | ✅ 无 |
| 修改 KBL 数据 | ✅ 无 |
| 重新计算业务策略 | ✅ 无 |
| 参与题量规划 | ✅ 无 |

**KBL-03 状态**：✅ PASS

---

## KBL-04：Strategy 直接访问 KBL

### 策略文件直接访问清单

| 文件 | 行号 | 访问方式 | 运行时使用 |
|------|------|----------|------------|
| strategy-engine.js | 69 | `require('../knowledge/knowledge-bank.js')` | 是 |
| strategy-engine.js | 205 | `require('../knowledge/knowledge-point.js')` | 是 |
| strategy-engine.js | 206 | `require('../knowledge/knowledge-bank.js')` | 是 |
| comprehensive-strategy.js | 27 | `global.KnowledgeBank` | 是（浏览器） |
| comprehensive-strategy.js | 29 | `require('../knowledge/knowledge-bank.js')` | 是（Node） |

### KBL-04 状态：❌ BLOCKED

**结论**：Strategy 层完全绕过 KnowledgeContext 边界，直接访问 KBL 原始数据。

---

## KBL-05：编排层直接 KBL 访问

| 文件 | 行号 | 访问方式 | 状态 |
|------|------|----------|------|
| practice-orchestrator.js | 9 | 仅注释 | ✅ 无访问 |
| practice-orchestrator.js | 222 | 仅注释 | ✅ 无访问 |

**KBL-05 状态**：✅ PASS

---

## 边界示意图

### 当前真实状态

```
KBL JSON Files
      │
      ▼ (直接 require)
Strategy ──→ knowledge-bank.js ──→ KBL JSON
  │
  ▼
KnowledgeContext (绕过)
  │
  ▼
POL (合规)
```

### 期望状态（P17 后）

```
KBL Runtime
      │
      ▼
KnowledgeContext (唯一边界)
      │
      ▼
POL + Strategy (通过 Context)
```

---

## KBL 边界总结

| 审计项 | 状态 | 关键发现 |
|--------|------|----------|
| KBL-01 唯一入口 | ❌ BLOCKED | Strategy 3处违规直接访问 KBL |
| KBL-02 数据真实性 | ✅ PASS | 375 KP / 1570 mappings / 375 capability |
| KBL-03 Context 边界 | ✅ PASS | KnowledgeContext 职责完整 |
| KBL-04 Strategy 访问 | ❌ BLOCKED | strategy-engine + comprehensive-strategy 直接 require knowledge-bank |
| KBL-05 POL 访问 | ✅ PASS | POL 通过 Context 获取数据 |

**总体判定**：KBL → Strategy 的直接访问是当前最大边界违规。Strategy 完全绕过 KnowledgeContext。

---

## P17-5 运行时复核（2026-09-16）

P17-0 审计基于冻结源码静态扫描（`require('../knowledge/knowledge-bank.js')`），
但运行时完成的 KBL 边界收口已把这些访问全部重定向到 KnowledgeContext。证据：

### 运行时加载链（浏览器 + Node 等价环境）

```
practice.html / dev/_bundle-env.js
  → shared/orchestration/knowledge-context.js
  → shared/engine/knowledge-compat.js（KnowledgeBankCompat / KnowledgePointCompat）
  → shared/engine/strategy-engine.bundle.js（SHIMS 映射：knowledge-bank → KnowledgeBankCompat）
```

- `dev/build-strategy-bundle.js` SHIMS：`'shared/knowledge/knowledge-bank.js': 'KnowledgeBankCompat'`、
  `'shared/knowledge/knowledge-point.js': 'KnowledgePointCompat'`、`knowledge-context.js: 'KnowledgeContext'`。
- `shared/engine/knowledge-compat.js`：`KnowledgeBankCompat.getEntries → KC.poolContext(...)`；
  `KnowledgePointCompat.get → KC.strategyView(id)`。
- 冻结源码 `shared/strategy/strategy-engine.js` 的 `require('../knowledge/knowledge-bank.js')`
  在 bundle 构建期被 SHIMS 改写 → 运行时解析到 KnowledgeContext，**不再接触 KBL 原始数据**。

### 源码静态引用（构建输入）

- 源码 `require('../knowledge/knowledge-bank.js')` 指向的文件在磁盘上已不存在
  （KBL 收口 M10 已删除旧层），源码无法在 Node 单独加载——**仅作 bundle 构建输入**。
- `dev/check-kbl-uniqueness.js` FROZEN_LEGACY_ACCESS 已登记 strategy-engine.js /
  comprehensive-strategy.js 等为「受控（frozen/bridge）」。

### 门禁证据

| 门禁 | 结果 |
|------|------|
| `dev/check-kbl-uniqueness.js` | ✅ PASS（受控 28 / 新增违规 0） |
| `npm run verify:presentation-runtime` | ✅ PASS（C01/C02 通过） |
| `npm test` | ✅ EXIT=0 |

### 修正后的边界图

```
KBL Runtime
      │
      ▼
KnowledgeContext (唯一边界)
      │  （bundle SHIM → KnowledgeBankCompat/KnowledgePointCompat）
      ▼
Strategy（冻结 bundle 消费方，运行时 100% 经 Context）
```

**KBL-01 / KBL-04 修正为 ✅（运行时合规）**。源码静态引用为冻结构建输入，
已按现有受控登记保留，无需改写冻结文件。
