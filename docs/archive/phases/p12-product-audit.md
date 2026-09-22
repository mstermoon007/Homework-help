# P12-00 产品化基线审计（只读）

> 扫描范围：`practice.html` / `select.html` / `knowledge/*.html` / `PracticeBridge` / `PracticeSession` / `GenerationAPI` / `POL` / `Presentation` / `Print` / `SW`
> 方法：静态追踪 + 现有门禁（verify:practice-page / verify:ui-boundary / verify:presentation-runtime）+ Node 浏览器等价环境（`dev/_bundle-env.js`）。
> 结论：**生产生成主链唯一**；浏览器专属面 = UI/DOM、Print、SW、sessionStorage 跨批记忆、知识页深链；Node 已覆盖生成/编排/校验/呈现等价逻辑。

---

## 1. 真实浏览器入口链（唯一）

```text
practice.html（URL 参数）
  → parseUrlParams()（subject/grade/kp/kps/qt/types/count/difficulty/book/mode/print/adaptiveMode/plugin/style/selectLevel）
  → state（页面 UI 状态：count/difficulty/typeCounts/knowledgePointIds/questionTypes/...）
  → generate()（genBtn / asmGenerateFromSelection / 深链自动生成）
  → PracticeBridge.start({ state, knowledgePoints, knowledgePointId, questionTypes, typeCounts, raw })
  → PracticeSession.start()
  → GenerationAPI.generate(req, { previousSeenKeys, previousGenerationId, renderOptions })
  → POL.orchestrate（active）/ executeInline（inactive 透明回退）
  → Strategy → Generator → Validator → SemanticQuestion → PresentationRenderer
  → Bridge.onStartFeedback → applySessionFeedback（DOM 渲染 + applyPartialNotice）
  → 练习/批改（submit）/ 打印（printFile → session.print）/ 重新生成（redoAllBtn → generate）
```

- **第二生产链检查 = 0**：页面无 `new PracticeSession().start()` / 无直接 `GenerationAPI.generate` / 无直接 `StrategyEngine.plan`；
  唯一收敛点 `shared/engine/practice-session.js:118`（`GenerationEngine.generate` 仅在 GenerationAPI 缺失时回退，且已门禁防回归）。
- 知识页入口：`knowledge/{canonicalId}.html` → `../practice.html?subject=math&grade=N&kps={canonicalId}`（深链自动生成）。
- select 入口：`CatalogUtils.buildPracticeUrl(RequestNormalize.createPracticeRequest(...))` → `practice.html?subject=&grade=&mode=&kps=&qt=&types=&count=&difficulty=&book=`。

## 2. 参数来源

| 参数 | 来源 | 消费点 |
|---|---|---|
| subject/grade | URL（select/知识页/手改） | state → Bridge → Request |
| kp/kps | URL（canonical id） | state.knowledgePointIds → POL 选区 |
| qt/types | URL（展示/推荐元数据） | state.questionTypes → POL selectedTypes（P10-2 起不做视图过滤） |
| count | UI 数量区（20/30/50/自定义） | state.count → POL 总预算 |
| typeCounts | **仅用户显式编辑**（`state.typeCountsEdited`） | Bridge → Request（未编辑传 null，POL 唯一分配） |
| difficulty | UI 难度（1–10，默认 1） | state.difficulty → POL DifficultyContext（P10-3） |
| style/selectLevel/expectedAnswerStyle | URL/UI | cell 生成上下文（P11-00） |
| adaptiveMode/adaptive | URL（adaptiveMode=new） | Bridge profile → Session req（learnerProfile 当前 UI 为 null） |
| print | URL `print=1` | 直印路径（仍经 Bridge.start 唯一入口） |

## 3. 状态来源

| 状态 | 持有者 | 生命周期 |
|---|---|---|
| 选题/题量/难度/题型 | practice.html `state`（IIFE） | 页面会话 |
| 生成会话/题目/作答 | `PracticeSession`（Bridge `_session`） | 页内，重新生成替换 |
| 跨代去重指纹 | `PracticeBridge._session._seenKeys` + sessionStorage（P11-02） | 页内 + 同标签页刷新 |
| 批改/错题 | StorageManager / LearnerModel（localStorage） | 跨页持久 |
| SW 缓存 | `sw.js` CACHE `hw-help-4.3.0`（与 APP_VERSION 同步） | 浏览器缓存 |

## 4. 已知断点 / 受控项

- **F-CAP-1（数据）**：`capacity-map.json` legacy KP 键 → POL 规划层容量封顶惰性；实际空间由 Generator/Retry/Recovery 兜底（P13-04 治理）。
- **F-TYPE-1（已加守卫）**：Strategy 退化越界题型 → POL Scope 守卫丢弃并记账（`outOfScopeDropped`）；根因数据 P13-05/P13-08。
- **adaptive/learnerProfile**：UI 当前不提供 learnerProfile（`initPracticeSession` 传 null）→ 自适应学习调整在 UI 链未启用（API 能力保留；cell 上下文已打通 P10-3/P11-00）。
- **刷新行为**：刷新后需重新生成（页面不自动恢复上次题目）；跨刷新去重依赖 sessionStorage（P11-02）→ P12-07 浏览器验证。
- **file:// 限制**：KBL Runtime 数据加载与 SW 需 HTTP 环境；E2E 必须经本地静态服务器。

## 5. 浏览器专属逻辑（Node 无法直接覆盖）

| 面 | 说明 | P12 验证 |
|---|---|---|
| DOM 渲染/批改交互 | `applyExerciseSet` / check / reveal / 错题本 | P12-01/02/04/08 |
| Partial 提示 | `applyPartialNotice`（X / Y + reason） | P12-04 |
| Print | `printFile → session.print()`（Print ✕ Generation ✕ KBL 已门禁） | P12-05 |
| SW 缓存 | `sw.js` 版本同步/升级 | P14-04/05 |
| sessionStorage 跨批记忆 | P11-02 F-DUP-2 | P12-07 |
| 深链自动生成 | URL → 自动 generate | P12-01/P13-02 |

## 6. E2E 环境方案（P12-01 起）

- 静态服务器：`python3 -m http.server`（HTTP 环境，SW/数据加载可用）。
- 浏览器：本机 Google Chrome（headless=new）+ CDP（Node ≥22 内置 WebSocket，无新依赖）。
- 驱动器：dev-only 脚本（`dev/e2e/`），不进入生产链、不新增运行时架构。

## 7. 验收

```text
生产生成主链唯一           ✅（0 第二条链）
参数/状态来源清单化         ✅
浏览器专属面清单化          ✅
已知断点登记台账            ✅（F-CAP-1 / F-TYPE-1 / adaptive / 刷新）
Node 等价环境可复用         ✅（dev/_bundle-env.js）
```
