# P17-0 Generation Entry 审计

## GEN-01：所有生成入口清单

### 全项目扫描结果

| 入口 | 文件 | Runtime/Dev/Test | 当前状态 |
|------|------|------------------|----------|
| `GenerationAPI.generate()` | shared/generation/api.js | Runtime | ✅ 主入口 |
| `GenerationAPI.generateSync()` | shared/generation/api.js | Runtime（同步） | ⚠️ 兼容 |
| `GenerationAPI.generateBudget()` | shared/generation/api.js | Runtime | ⚠️ 预算入口 |
| `GenerationEngine.generate()` | shared/engine/generation-engine.js | Runtime（门面） | ⚠️ 委托 |
| `PresentationEngine.generateQuestions()` | shared/engine/presentation-engine.js | Runtime | ⚠️ 实际执行层 |
| `PracticeOrchestrator.orchestrate()` | shared/orchestration/practice-orchestrator.js | Runtime | ✅ POL 入口 |

### Runtime 链确认

```
PracticeSession.start()
  → GenerationAPI.generate(req, options)
    → PracticeOrchestrator.orchestrate(req, options, deps)
      → execute(cellReq, ...)
        → executeInline(req, options)
          → build(request) → StrategyEngine.plan()
          → runPlans(plans)
            → PresentationEngine.generateQuestions(plan, options)
```

### GEN-01 状态

| 目标 | 实际 | 状态 |
|------|------|------|
| Runtime Entry = 1 | GenerationAPI.generate 是唯一对外入口 | ✅ |
| POL Entry = 1 | PracticeOrchestrator.orchestrate | ✅ |
| GenerationCore = 0 | 不存在于文件系统 | ⚠️ DESIGN_ONLY |

---

## GEN-02：真正 Runtime 链（从 practice.html 反向追踪）

```
practice.html
  → <script> shared/engine/practice-session.js
    → PracticeSession.start()
      → GenerationAPI.generate()
        → PracticeOrchestrator.orchestrate()
          → execute = executeInline
            → build() → StrategyEngine.plan()
            → runPlans() → PresentationEngine.generateQuestions()
              → Selector → RetryLoop → BatchValidator → SQ
```

**确认**：从 practice.html 到 SemanticQuestion，经过 PresentationEngine.generateQuestions()。

---

## GEN-03：GenerationCore 是否进入真实 Runtime

### 检查结果

| 检查项 | 结果 |
|--------|------|
| shared/generation/generation-core.js 存在？ | ❌ 不存在 |
| shared/generation/ 目录内容 | api.js（仅此一个文件） |
| GenerationCore 被 require？ | 无任何文件 require generation-core |
| Runtime 链经过 GenerationCore？ | 否 |

### GEN-03 状态：⚠️ DESIGN_ONLY

**结论**：GenerationCore 尚未落地。当前 Runtime 通过 `executeInline` 承担执行职责。

---

## GEN-04：executeInline 详情

### executeInline 位置

```
shared/generation/api.js:407
```

### executeInline 功能

```javascript
function executeInline(request, options) {
  // 1. 学科路由
  var engine = routeBySubject(request);
  
  // 2. 构建 generationId
  var generationId = 'g-' + Date.now()...;
  
  // 3. 规划
  return build(request).then(function (built) {
    var plans = built.plans || [];
    
    // 4. 执行
    return runPlans(plans, options).then(function (run) {
      // 5. 渲染
      var renderOutline = renderQuestions(questions, ro, options.columns);
      
      return {
        questions, plans, trace, html, ...
      };
    });
  });
}
```

### GEN-04 状态

executeInline 是当前的实际生成核心。它：
- ✅ 调用 StrategyEngine.plan()（规划）
- ✅ 调用 PresentationEngine.generateQuestions()（执行）
- ✅ 调用 renderQuestions()（渲染）

---

## GEN-05：generateSync 路径

### 位置

```
shared/generation/api.js:495
```

### 功能

```javascript
function generateSync(request, options) {
  // 同步版本，仅支持 single-kp + comprehensive
  // 直接调用 PresentationEngine.generateQuestions()
}
```

### GEN-05 状态

⚠️ generateSync 绕过 POL，直接调用 PresentationEngine。

---

## Generation Entry 总结

| 审计项 | 状态 | 关键发现 |
|--------|------|----------|
| GEN-01 入口清单 | ✅ | 共5个入口，Runtime主链1个 |
| GEN-02 Runtime 链 | ✅ | 完整追踪到 SemanticQuestion |
| GEN-03 GenerationCore | ⚠️ | DESIGN_ONLY，未落地 |
| GEN-04 executeInline | ✅ | 当前实际生成核心 |
| GEN-05 generateSync | ⚠️ | 绕过POL |

**总体判定**：Runtime 入口清晰，但 GenerationCore 尚未落地，executeInline 承担实际执行。
