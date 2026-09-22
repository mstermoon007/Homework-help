# 01-ARCHITECTURE-FROZEN — 冻结架构清单

> 状态：FROZEN（只读）
> 本文档回答：哪些东西已经冻结，不能再改。

## 1. 唯一执行链（不可重排、不可双轨）

```text
KBL
→ KnowledgeContext
→ KP × QT
→ Strategy
→ Generation Requirements
→ Generation Plan
→ Executor（唯一：shared/generation/api.js runPlans/executeInline）
→ Selector（唯一选择权威）
→ Generator
→ Validator
→ Presentation
→ Practice
```

## 2. 各层冻结项与 SSOT

| 层 | 冻结内容 | 唯一 SSOT |
| --- | --- | --- |
| KBL | 598 KP / 128 Units / 1293 Relations / 639 Allow；canonical ID `{subject}-{grade}-{book}-u{nn}-k{nnn}` | KBL Runtime |
| 题型 | 7 类 canonical：calc / fill / choice / judge / geometry / classify / apply；alias 只读合并 | `shared/knowledge/question-type-registry.js` |
| 难度 | 唯一 Difficulty 公式；静态七维目录只读 | `shared/catalog/difficulty.js`（+ `difficulty-static.js`） |
| POL | Request → Range Resolution → KP×QT Cell → Quota → Count Planning → Difficulty Coordination → Generation Plan；不负责 Render/Print/SVG/教育策略决策/Generator 选择 | `shared/orchestration/practice-orchestrator.js` + `practice-plan.js` + `budget-allocation.js` |
| Executor | 生成执行唯一入口 | `shared/generation/api.js`（`generation-engine.js` 仅薄代理，保留 `generate` 供浏览器回退） |
| 数量闭环 | requested ≥ planned ≥ generated = final；Σ cells = planned；显式组合计数不挪用 | POL Ledger |
| UI | 仅 Request 输入端；无私有题型判断、无私有 Generator | subject-types / math-types / select / practice 页 |

## 3. 禁止事项（违反即破坏冻结）

1. 重新定义七类题型或新增第二套 canonical / alias。
2. 重新建立第二套 Difficulty 公式。
3. 重新设计 POL 编排语义。
4. 建立第二 Generator Selector 或第二 Generation Plan Executor。
5. 恢复 KnowledgeBank / 旧 KBL 架构。
6. 建立旧/新双轨兼容层。
7. 创建 mock/stub 掩盖真实断链。
8. UI 层下沉业务决策（私有题型判断 → 私有 Generator）。
9. 修改 POL Ledger 不变量（requested ≥ planned ≥ generated = final）。

## 4. Print 约定（冻结）

- 统一使用 `print.js` 模块；页面不得私带 `@media print` 块。
- A4 纵向；内容宽 190mm；打印页输入元素保留原样式，仅清空 value/placeholder。
- 调用格式：`Print.open('#container', '标题', { pageType: 'type', columns: num })`。

## 5. 环境约束

- 浏览器/Node 双环境：Node 侧入口经 `dev/_bundle-env.js` 装载浏览器等价全局。
- 构建产物：`strategy-engine.bundle.js` / `presentation-engine.bundle.js`（`npm run build:strategy` / `build:presentation`）。
- 门禁链与 CI：见 `00-PROJECT-BASELINE.md` §2；修改后必须 `bash scripts/run-all-checks.sh` 全绿。
