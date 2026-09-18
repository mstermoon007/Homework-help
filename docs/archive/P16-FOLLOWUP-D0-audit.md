# P16-FOLLOWUP-D0：基线审计报告

## 1. KBL Runtime 状态
- Legacy binding: 0
- Capacity Map: 375 keys全canonical，legacy keys=0
- rootHash: 18a21dfba5ce951e5024dca74ad92cbeb11c43156e5aa203d3dadc7c70c7704b
- kbl:verify: 9/9 PASS
- npm test: EXIT=0

## 2. POL Contract 状态
### POL 边界（已冻结）
- KBL → POL 边界：KnowledgeContext唯一接缝
- POL → Generation 边界：strategyView 唯一入口
- POL 决策：count / typeCounts / totalPlanned / difficulty / Cell

### POL 所有入口
- practice-orchestrator.js: plan(), orchestrate()
- budget-allocation.js: allocateTypeBudgets(), allocateRecovery()
- difficulty-orchestrator.js: normalizeDifficultyInput(), resolveContext()
- knowledge-context.js: get(), strategyView(), kpsForGrade(), poolKpIds()
- practice-session.js: start(), submit(), _buildGenerationRequest()

### POL 调用链
practice-session.js:118 GenerationAPI.generate(req, genOptions)
→ generation/api.js:478-484 PO.orchestrate(...)
→ practice-orchestrator.js:408 orchestrate(...)
  → plan(request) / execute(cellReq) (= executeInline, api.js L407)
    → api.js L273/287/300/309 StrategyEngine.plan/planByType/ComprehensiveStrategy.build
      → presentation-engine.js:53 generateQuestions
        → presentation-engine.js:68 Selector.selectGenerator(L68)
          → Generator RetryLoop(L37) → BatchValidator L38/L130
            → 校验后聚合回 POL (L474-499)
              → 渲染(L559) → 账本(L578-617)

## 3. Generation 入口 状态
- GenerationAPI.generate()：唯一生成入口
- api.js executeInline()：兼容入口（计划迁移至 GenerationCore.execute()）
- GenerationCore.execute(plan)：正式执行入口
- GenerationCore.executeCell(cell)：Cell执行入口

### 26 个 Generator 状态（registry knowledgePoints绑定）
- 总绑定数：377
- 唯一 legacy id: 246
- canonical binding: 116
- 所有 26 个 generator 均有 knowledgePoints 字段
- composite generator COMPOSITE_KPS: 18条旧编排别名(m1/m0/m11等)

### Generator-Registry-Selector-Validator 关系
- generator-registry.js knowledgePoints: 377引用，246唯一legacy，116 canonical
- generator-selector.js:238 g.knowledgePoints.indexOf(primaryKp) → score.kp=0/1（恒不命中canonical 375）
- capability-resolver.js: questionType解析
- strategy-engine.js:8步固定流程（validate→resolveKP→selectKP→difficulty→cognition→context→spiral→QuestionPlan）

### Validator 入口
- shared/validator/batch-validator.js：核心校验函数
- shared/validator/kp-semantic-validator.js：语义校验
- shared/validator/scope-guard.js：范围守卫
- presentation-engine.js:38/L130: BatchValidator
- check-generator-capability.js: M2-R05 遗留WARN（已登记P16-FOLLOWUP-B6）

### SemanticQuestion 状态
- 结构：questionId、knowledgeId、questionType、difficulty、stem、answer、options、solution、metadata
- 用途：语义验证 → Presentation

### PresentationEngine 状态
- generateQuestions(L53)
- Selector(L68)
- RetryLoop(L37)
- BatchValidator(L38/L130)
- render/HTML/SVG/DOM：Presentation层职责

### SVG生成位置
- shared/generator/generators/（geometry/text/diagram题型可能直接生成svg片段）
- shared/presentation/renderer.js
- shared/presentation/html-renderer.js
- shared/presentation/render-options.js
- presentation-engine.js

### KBL 直接访问审计
- 未发现绕过 KnowledgeContext的直读 KBL 代码
- practice-orchestrator.js: 零 require('../knowledge/...') / readFileSync / JSON.parse
- knowledge-context.js:25 require('../knowledge/runtime/knowledge-runtime.js') 为经 App.KNOWLEDGE 适配入口
- budget-allocation.js / practice-plan.js / difficulty-orchestrator.js: 零 KBL 访问
- practice-session.js: 零 KBL 访问

### 旧入口
- executeInline()：兼容入口，计划迁移至 GenerationCore.execute()
- 旧Generation入口：计划迁移
- 旧Composite入口：标记D-class design alias

### 死代码/冗余门禁候选
- verify-setup.js采样（已修正为canonical代表）
- 旧bridge/compatibility/fallback
- 重复type guard / duplicate difficulty guard / duplicate quantity guard
- obsolete compatibility helper

### 共同生成内核准备状态
- KBL：已冻结（Legacy=0）
- POL：已冻结（调度职责完成）
- Generation：侧重边界整理，未新增架构层
- Strategy：归位中
- Generator：无大规模重写
- Validator：边界收口中
- Presentation/SVG：后移规划中

---

