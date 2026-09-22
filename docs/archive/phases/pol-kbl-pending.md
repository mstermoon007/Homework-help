# KBL → POL 接线改造 · Pending 登记（需后续决策/迁移）

> 关联：`docs/pol-kbl-phase1-inventory.md`（Phase 1 清单）、`docs/pol-kbl-phase2-closeout.md`（Phase 2 主报告）、
> `docs/kbl-runtime-uniqueness-audit.md`（唯一性审计）、`docs/unified-layer-audit.md`（跨层审计 B/W 清单）
> 原则：冻结核心（Frozen Core 79 文件）不得擅自重构；数据迁移与冻结形状漂移显式登记。
> 更新：2026-09-13（Phase 2 收口后重排优先级）

---

## 优先级总览

| 优先级 | 事项 | 性质 | 状态 |
|---|---|---|---|
| ~~**P0**~~ | ~~冻结形状漂移默认值（spiral / allowBracket 等）~~ | 主链稳定性 | **RESOLVED（Phase 3）** |
| **P1** | Composite Combine（含绑定迁移） | 功能恢复 | 待决策（先确认是否继续） |
| ~~**P1a**~~ | ~~POL Contract 收口：UI 重复题型预算~~ | 职责重复 | **RESOLVED（P10-1）** |
| ~~**P2**~~ | ~~D2 难度门禁 / M16（含 DRIFT-11）~~ | 门禁与编排协调 | **RESOLVED（Phase 8）** |
| **P3** | G1 Matrix 迁移 | 质量门禁重建 | 待排期 |
| ~~**P4**~~ | ~~B5/B6/B7 Generator 绑定迁移~~ | 数据迁移 | **RESOLVED（P9-9）** |
| **P1b** | ~~知识内容页 canonical 重建~~ | 外围治理 | **RESOLVED（P9-10 G1-E）** |

---

## P0 — 冻结形状漂移（RESOLVED，Phase 3）

Phase 3 已将 KBL canonical → Practice Context 的字段形状、默认值、缺省行为固化为显式契约
（审计：`docs/pol-kbl-shape-drift-audit.md`；测试：`npm run test:pol-kbl-shape`）：

- 三视图（adaptKp / strategyView / uiKp）键恒存在、无 undefined；缺失统一 null。
- 显式边界默认：`spiral={1,1}`、`allowBracket/allowMultDiv=false`、`structure.maxSteps=1`（缺失时）、
  `numeric.range={min:null,max:null}`（缺失时）、`cognition.level=0`（未知/缺失，不猜测）。
- frozen consumer 顶层别名：`pluginId` / `graphicType` / `operations`（与嵌套字段一致）。
- 消费方纠正：POL `predictDifficulty` 与 Validator `getKpConstraints` 改走 `strategyView`。
- 死占位字段已删除（gradeOverride / targets / prerequisites / bankRef / exerciseTypes / metadata.version /
  numeric.integerOnly / decimalPlaces / structure.minSteps）。

> 非阻塞增强（不属 drift）：螺旋/结构的**真实语义值**需 KBL Schema 扩展承载（如 `difficultyAnnotation.spiral`
> 或新字段），未来按 KBL 工具链流程单独授权；当前 `{1,1}/false` 为显式契约默认。

## P1 — Composite Combine（Phase 4 判定：Pending，最小接口保留）

**状态**：`Composite = Pending`
**Reason**：① 无生产 UI 入口（combine 无控件/深链，仅 API 级标志）；② combine 生成依赖 B6 绑定迁移
（`registry.knowledgePoints` legacy ID 与 canonical 不匹配）→ Strategy 层显式 `COMPOSITE_UNSUPPORTED`。

Phase 4 处置：
- `composite.js` 最小化重写：保留最小接口（`supportsComposite` + combine calc-to-judge），
  修复 Phase 1 遗留的 `srcKp` 未定义 ReferenceError，删除两个不可达模式（measure-to-calc / shape-to-apply，
  依赖恒为 null 的 category）；judge 答案修正为布尔。
- 保留：combine 标志链路（Bridge → Session → API/Engine → Strategy，含 C1-T5/T6 测试）、
  frozen combine 校验与 `generator:composite` 注册（frozen registry 装载依赖）。
- **不新增** Composite Service/Controller/Manager/Registry；不重新引入 `kpConstraintsList`（仍全仓 0 注入）。
- **Composite Knowledge Access = 0**：由 `test:kbl-uniqueness` 全生产面扫描覆盖（composite.js 零知识访问），
  不新增独立门禁（反膨胀）。
- 最小契约测试：`tests/generator/composite.test.js`（6 用例）。

**恢复条件**：B6 绑定迁移完成（canonical 绑定）+ 若需多模式则补 KBL 语义类别（`semantic.category` 已在 canonical，
但生成器已按 Phase 1 断链不再查询，恢复需在 Context 边界提供）。

## P1a — POL Contract 收口（RESOLVED，P10-1）

- 根因：practice.html `syncTypeCounts/splitEqual` 在用户未编辑时也生成等分 `typeCounts` 并作为显式组合传给 POL。
- 修复：新增 `state.typeCountsEdited`（仅 `setTypeCount` 用户编辑置真）；`buildTypeCounts` 未编辑时
  `state.typeCounts=null` → 请求不携带分题型数量 → **POL 成为唯一分配者**；
  `perTypeCount` 仅保留为 UI 展示/编辑预览（不再写请求）。
- 契约测试：`tests/orchestration/p10-count-contract.test.js`（8 用例：守恒/最低覆盖/不超预算/
  count<题型数/不重解释 count/容量受限/POL 集成）。


## P2 — D2 难度门禁 / M16（RESOLVED，Phase 8）

- **DRIFT-11 RESOLVED**：POL `getTargetDifficulty()` 增 `global.TargetDifficulty` 兜底；
  浏览器等价环境实测预测生效（g6 探针预测 5 ≠ 兜底 3）。
- **DifficultyContext 接线 RESOLVED**：practice.html 加载 `difficulty-orchestrator.js`（先于 POL）；
  `difficultyContext` 由 `resolveContext` 产出（requested/target/source 正确）。
- **D2/M16 RESOLVED**：新增 `tests/difficulty/`（6 文件 23 用例，KBL canonical 数据源；
  total=598 / usable=567 / missing=31 SKIP+WARN；anchor 门禁重建）；
  `npm run test:difficulty` 并入 `npm test`；删除 3 个断链旧脚本 + `verify:difficulty-anchor`。
- **死代码清理**：`render.js _wrapDifficultyParams`（死工厂难度消费）、
  `r2-difficulty-anchor-apply.js`、`difficulty-orchestrator.validateConstraints` 已删除。
- **双 validator 结论**：layer2（M5-R09）与 layer3（M8-R03）职责互补，仅 spiral 一项重叠
  （layer2 WARN 启发式 / layer3 ERROR 结构期望）→ 保留双层并文档化（不动 frozen）。

## P3 — G1 Matrix 迁移

- Phase 2 已删除 no-op 占位 `dev/check-g1-quality-matrix.js`（legacy ID + 旧容量基线 + combine）。
- 迁移时按 canonical ID 重建质量矩阵门禁（容量基线需重新锚定）。

## P4 — B5/B6/B7 Generator 绑定迁移（RESOLVED，P9-9）

- **迁移方式**：以 canonical 生成映射（`shared/knowledge/mappings/generation-contract/math.json`，639 条）
  的 `capability` → generator id（`arithmetic.multiplication` → `generator:arithmetic-multiplication`）
  重建 26 个 generator 的 `knowledgePoints` 绑定（permission=allow 共 409 条 → 377 去重绑定）。
- **改动范围**：仅 `generator-registry.js` 的绑定数组（数据）；Frozen Core 授权数据迁移 → 基线重锚。
- **结果**：legacy KP 残留 464 → **0**；乘法 KP → 乘法 Generator（Phase 8 暴露问题消失）；
  `kp-semantic-validator.checkOperation` 自愈降级对有绑定 KP 自动恢复 ERROR（9-4 验证通过）。
- **B7**：pluginId 不再参与运行时解析（绑定经 capability 派生），映射中的 pluginId 仅为历史元数据。
- **残留数据缺口（登记，不盲填）**：243/598 KP 无 allow 绑定（含 73 个无映射行 KP），
  属生成映射数据治理（Excel sheet 4），后续按需单独授权补齐。

---

## 受控例外（长期保留，非待办）

### Frozen 兼容接线

- `shared/engine/knowledge-compat.js`：旧模块名 → KBL Runtime 委托
  （`knowledge-bank.js` → `KnowledgeBankCompat.getEntries`；`knowledge-point.js` → `KnowledgePointCompat.get`；
  `knowledge-ontology.js` → `KnowledgeOntologyCompat.normalize`）。
- `dev/build-strategy-bundle.js` SHIMS 映射三模块 + `knowledge-context.js`（global `KnowledgeContext` 委托）。
- 边界：不持有数据、不写回 KBL、仅供 bundle 冻结消费方；access 审计归类 `compat-bridge`。
- 载入顺序：`knowledge-runtime → knowledge-context → knowledge-compat → strategy bundle`。

### Generation 接入受控项（Phase 6）

- **F6-1**：Presentation `generateQuestions` 重新 `selectGenerator(plan)`（Strategy 的 `plan.generator` 无消费者）
  → 双重选择；frozen 不可改，确定性输入，Golden/E2E 未现分歧。
- **F6-2**：`generation-engine.js` 内联 build/runPlans 回退（frozen）→ GenerationAPI 存在时不触发。
- **F6-4**：W7 重复规范化（api.js / generation-engine frozen）→ 维持现状。

### 其他受控项

- **F-404-1（P14-05 已修复，frozen 授权 Bug Fix）**：`shared/core/common.js` 浏览器动态注入路径错误
  （3×404）→ 修正 + `--baseline` 重锚（78 文件）；真实 404 清零。
- **F-PRINT-1（P12-05 发现，frozen API 不一致）**：`PracticeSession.print()` / `Print.openFromQuestions()` 在
  Engine 产物路径同步返回 `undefined`（`shared/presentation/print.js` / `shared/engine/practice-session.js` 均 Frozen Core），
  而 UI 曾以 `.print().catch(...)` 消费 → 点击打印抛 `TypeError`。UI 调用点已改 `Promise.resolve(...)`（P12-05 最小修复）；
  frozen 侧返回值归一（Promise）需授权后处理，暂不修改。
- **F-CAP-1（已收口 P13-04）**：capacity-map 已 canonical 重建（598/598）；扫描 CLI 经 `dev/_bundle-env.js`
  在 Node 可运行；`dev/build-capacity-map.js` 为重建入口；POL 规划层容量封顶生效（`npm test` PASS，rootHash 未变）。
- **F-TYPE-2/F-TYPE-3（P13-08 发现，P14 根因审计完成）**：根因 = Frozen `question-type-registry`
  归一化误映射（RECOGNIZE_KEYWORDS→geometry、factor-multiple/factor/all→geometry）+ `capability-model`
  rawType 优先 → 76~79/598 KP（13%）capability supported 与声明题型不一致 → 多题型请求单题型产出 /
  越界丢弃。审计：`docs/f-type-2-root-cause.md`；受影响清单：`docs/human-data-requests/f-type-2-affected-kps.csv`；
  修复需 Frozen 授权（方案 B：归一表修正 + type 优先 + 重锚 + 全量回归），登记 H4。
- **F-TYPE-1（P11-03 发现，生成语义）**：冻结 Strategy 在「capability 声称可行但无实际 generator 绑定」的
  KP×Type 上退化产出越界题型（fill cell → geometry、calc cell → choice）。POL 已加 Scope 守卫（越界丢弃 +
  `outOfScopeDropped` 记账，缺口走 Recovery/PARTIAL）；根因（绑定/能力数据不一致）归 P11-05/P11-07。
- **P11-01 发现（canonical 题型 = 6）**：`oral`（口算）为 legacy 别名 → `calc`（`question-type-registry` / `request-normalize`）；
  全库 598 KP 对 calc/fill/choice/judge/geometry/apply 均 eligible，oral 无独立题型语义。
  → 覆盖率契约以 6 题型为准（`p11-01` C9 验证别名不丢失）；select.html `QUICK_TYPE_DEFS` 中 `types:['calc','oral']`
  的 legacy 别名冗余，归 P13-04/P11-05 清理（当前无行为影响）。
- W7 编排规范化重复：`generation-engine.js`（冻结）无法改写 → 保持现状（避免半侧重构）。
- `capacity-inventory.js` 容量扫描 CLI：bootstrap 需加载冻结 strategy/generator（Node 侧不可加载）→
  扫描功能待冻结兼容或 Node 侧接线方案；运行时读派生缓存 `capacity-map.json`（非知识事实）。
- `shared/engine/strategy-engine.bundle.js` 内嵌 generator 绑定表（legacy ID，元数据）：
  非知识事实源，随 P4 迁移后消除。

## 已收口（Phase 2，2026-09-13）

- **FAIL-001** `render.js` 旧 `global.KnowledgeBank.getEntries` 死代码 → 删除（0 调用方路径）。
- **FAIL-002** `kp-semantic-validator.js` 失效 combine 路径（未定义引用）→ 删除（`kpConstraintsList` 全仓 0 注入）。
- **FAIL-003** `presentation-engine.bundle.js` 内联第二份 KC/Runtime 副本 → 构建委托去重
  （strategy bundle 注册 KC shim；presentation bundle 内联模块 31→22）。
- 死代码：`svg-templates.js`、`check-g1-quality-matrix.js`（no-op）、`test-runner.js`（0 测试）删除；
  `cleanup-scan.js`、`semantic-parse.js`、`clean-difficulty-consume.js`、column-consistency 失效测试归档。
- 唯一性门禁：`npm run test:kbl-uniqueness` 已并入 `npm test`（**KBL Runtime Uniqueness = PASS**）。

## 人工数据需求（汇总入口）

- `docs/human-data-requests/README.md`（H1 映射 Excel / H2 G1 字段策略 / H3 58 KP 状态 / H4 F-TYPE-2 授权 / H5 可选）
- 问题全量归类：`docs/issue-register.md`（已收口 18 / 受控 7 / 待授权 2 / 待人工 3 / 观察 3）

## P13 人工清单（需原始数据/产品决策）

- **P13-05**：243 Generation Mapping GAP（170 有行无 allow + 73 无映射行）→ 需 Excel sheet 4。
- **P13-06**：G1 缺失字段（seedDifficulty 31 / cognitiveLevel 31 / type 32 / maxSteps 32 / numberRange 11）
  经对照原始数据全部「确实缺失」→ 需业务确认策略（合法为空 / 补齐 / 保持缺失）。
- **P13-07**：58 非发布 KP（deprecated-draft 25 / active-draft 31 / inactive-draft 2）→ 需产品状态决策。

## 已知约束（实现注意事项）

- `dev/build-strategy-bundle.js` 的 `stripComments` 对 `/*` 敏感：共享层注释中禁止出现
  `/*` 字面量（如 `tools/kbl/*`），否则会吞掉后续代码导致 bundle 语法错误。
- Node 侧不可直接 require 冻结 Strategy/Generator（其 `knowledge-point` 依赖仅 bundle 兼容桥可解析）；
  相关 dev 门禁统一经 `dev/_bundle-env.js` 装载浏览器等价环境。
