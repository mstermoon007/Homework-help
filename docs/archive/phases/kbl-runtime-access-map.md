# 清单 A：KBL Runtime Access Map（运行时知识访问地图）

> 来源：`dev/check-kbl-uniqueness.js` 静态扫描 + 动态 E2E 插桩（2026-09-13）
> 范围：生产运行链（UI → API → POL → Strategy → Generator → Validator → Presentation → Runtime）
> 图例：Source = 知识事实来源；Status = 唯一性判定

## A1. 逐层访问表

| Caller | API | Source | Layer | Status |
|---|---|---|---|---|
| `practice.html`（内联） | 无直接知识 API（经 CatalogUtils / 引擎） | — | UI | PASS |
| `select.html`（内联） | `KnowledgeContext.uiListForGrade` | KC → Runtime | UI | PASS |
| `index.html` | 无知识访问（仅 version/common） | — | UI | PASS |
| `shared/catalog/catalog-utils.js` | `KC.uiListForGrade` | KC → Runtime | UI/Catalog | PASS |
| `shared/generation/api.js` | `KC.poolKpIds`（`getDep('knowledgeContext')`） | KC → Runtime | API | PASS |
| `shared/orchestration/practice-orchestrator.js` | `KC.poolKpIds` / `KC.get` | KC → Runtime | POL | PASS |
| `shared/orchestration/practice-plan.js` | 无知识访问（纯聚合） | — | POL | PASS |
| `shared/orchestration/budget-allocation.js` | 无知识访问（纯分配） | — | POL | PASS |
| `shared/orchestration/difficulty-orchestrator.js` | 无知识访问（难度参数域） | — | POL | PASS |
| `shared/capacity/capacity-inventory.js` | `KC.kpsForGrade`（扫描）；`capacity-map.json`（派生缓存） | KC → Runtime | POL/Capacity | PASS（派生缓存非知识事实，见清单 B） |
| `shared/capability/knowledge-capability-view.js` | `KC.get` | KC → Runtime | POL/Capability | PASS |
| `shared/capability/capability-scan-context.js` | `KC.kpsForGrade` / `KC.strategyView` | KC → Runtime | Dev 扫描（E） | PASS |
| `shared/validator/kp-semantic-validator.js` | `KC.get`（+ FAIL-002 残留） | KC → Runtime | Validator | FAIL-002（惰性） |
| `shared/validator/validation-pipeline.js` | 无知识访问（编排验证层） | — | Validator | PASS |
| `shared/strategy/strategy-engine.js`（冻结） | `KnowledgePoint.get` / `KB.getEntries`（经 compat） | compat → KC → Runtime | Strategy | PASS（委托；冻结 pending） |
| `shared/strategy/*`（14 个冻结文件） | `KnowledgePoint.get`（经 compat） | compat → KC → Runtime | Strategy | PASS（委托；冻结 pending） |
| `shared/generator/generator-registry.js`（冻结） | `KnowledgePoint.get`（经 compat，resolveChain） | compat → KC → Runtime | Generator | PASS（委托；冻结 pending） |
| `shared/generator/generator-selector.js`（冻结） | `KnowledgePoint.get`（经 compat） | compat → KC → Runtime | Generator | PASS（委托；冻结 pending） |
| `shared/generator/generators/*`（14 可变） | **无知识访问**（消费 POL Practice Context） | POL → Generator | Generator | PASS |
| `shared/generator/core/op-semantics.js` | 无知识访问（内置基础运算符语义） | — | Generator | PASS |
| `shared/presentation/renderer.js` / `html-renderer.js` / `svg-registry.js` | 无知识访问 | — | Presentation | PASS |
| `shared/presentation/render.js`（旧轨工厂） | `global.KnowledgeBank.getEntries`（惰性） | 无（全局未定义） | Presentation | FAIL-001（惰性） |
| `shared/engine/generation-engine.js`（冻结） | 无知识访问（KP 语义仅数组归一） | — | Engine | PASS |
| `shared/engine/practice-session.js`（冻结） | 无知识访问（透传 KP id） | — | Engine | PASS |
| `shared/bridge/practice-bridge.js` | 无知识访问（UI 状态 → 请求翻译；模块可见性走 module-catalog 元数据） | — | Bridge | PASS |
| `shared/learner/*` | 无知识访问（学习状态按 kpId 存储） | — | Learner | PASS |

## A2. Runtime / 适配层内部

| Caller | API | Source | Layer | Status |
|---|---|---|---|---|
| `shared/orchestration/knowledge-context.js` | `App.KNOWLEDGE.get/byGrade/byUnit/selectable/unit/stats` | KBL Runtime | POL 适配 | PASS |
| `shared/engine/knowledge-compat.js` | `KC.strategyView` / `KC.poolContext` | KC → Runtime | Bridge | PASS（Delegation） |
| `knowledge-api.js`（Runtime 内部） | 组装 Query/Policy/Relation | Loader | Runtime | PASS（内部合法） |
| `knowledge-query.js` / `knowledge-relation.js` / `knowledge-policy.js` / `knowledge-index.js` | 读取 Runtime 内存模型 | Loader → KBL Data | Runtime | PASS（内部合法） |
| `knowledge-loader.js` | `DATA_FILES`（11 个） | KBL Data | Runtime | PASS（唯一数据入口） |

## A3. 动态实测（插桩）

```text
App.KNOWLEDGE 挂载次数   1
Runtime API 调用         get:5  byGrade:1
兼容桥委托               KnowledgePointCompat.get ×5
E2E                      poolKpIds=112 → plans=1 → semanticQuestions=3
旧知识全局               KnowledgeBank/Point/Ontology = undefined
```
