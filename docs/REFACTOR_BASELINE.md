# REFACTOR_BASELINE — 重构基线快照

> 目的：在动手重构前，对 Frozen Core、verify、Presentation Runtime 三条门禁及各关键生成组件做一次只读快照，
> 以供重构后 diff 对照。
> 协议：本文件生成过程中**未修改任何业务代码**（对 `shared/`、`plugins/`、`*.html` 零改动，纯检查与记录）。

## 1. 基底信息

| 项 | 值 |
| --- | --- |
| 记录时间 | 2026-09-06 |
| HEAD | `3f3439383f7886b2ea3fe89b7a0d21f41c5dbe0`（2026-09-05 `perf: 清理冗余校验与锁定壳，去重/随机下沉生成层引擎`） |
| git describe | `v4.2.1-29-g3f34393`（29 commits after v4.2.1 tag） |
| package version | `4.1.0` |
| 工作区改动（4，均**不在** Frozen Core baseline） | `architecture/layers.json`、`dev/check-presentation-runtime.js`、`docs/ARCHITECTURE_LAYERS.md`、`docs/DEV_LOG.md` |
| Frozen Core baseline 锚定 | `ca2a082`（2026-09-04 21:28 +08:00），version `1.0`，91 文件 |

## 2. Gate 汇总（三路门禁）

| 门禁 | 命令 | 结果 | 说明 |
| --- | --- | --- | --- |
| **Frozen Core** | `npm run verify:frozen-core`（`node dev/check-frozen-core.js --check`） | ⚠️ **DRIFT 14（既有）** | 基线 91 ↔ 当前 91 文件数一致；14 处内容漂移全部由 `ca2a082` 之后的 7 个提交（`1dfc530 … 3f34393`）引入，**非本基线会话产出**；工作区 4 个改动文件均不在基线内 |
| **verify** | `npm run verify`（`dev/verify-m0.js`，7 步聚合） | ✅ **PASS 7/7** | 错误 0；警告 23 条（全部为既有，见 §5）；总耗时 ~4s |
| **runtime** | `npm run verify:presentation-runtime` | ✅ **PASS 16/16** | C01/C02 Browser Runtime + E2E Probe；`PracticeSession.start()` 真实产题 `questions=5 html=1654`；含 `generation-engine.js:423` `require('./generator/core/rng.js')` 校验与 SVG 渲染链 |

Gate 结论：**Frozen Core 存在 14 处既有漂移，需在重构前向所有者申请授权重锚或注明 Bug Fix 编号；verify 与 runtime 三路中两路干净。**

## 3. 附加门禁（补充记录）

| 门禁 | 结果 |
| --- | --- |
| `npm test`（全量链，15 步） | ✅ exit=0（含 verify-svg 219 个 SVG、difficulty-anchor 10/10、lint 无违规） |
| `npm run verify:layers` | ✅ PASS（四层归类，254 文件已归类，155 文件登记齐全） |
| `npm run verify:m1` | ✅ PASS（M1 Unified Ontology Gate） |
| `npm run verify:m2` | ✗ FAIL（**既有漂移**：`tests/capability/knowledge-capability.test.js` 硬编码 574 vs 实际 KP 567，见 §5） |
| `node dev/check-strategy-bundle.js` | ✅ PASS（M4-19 Bundle 门禁，原生/legacy 桥接 + 迁移开关） |
| `node dev/check-strategy-config.js` | ✅ PASS（M3-00 Feature Flag：strategyEngine=false / legacyFallback=true，默认 legacy） |
| `node dev/check-strategy-plumbing.js` | ✅ PASS（M3-21 管道 567/567；M3-22 strategyTrace 11 步决策链 OK；Errors 0） |

## 4. 组件基准确认

| 组件 | 入口 / 载体 | API / 契约要点 | 探针佐证 |
| --- | --- | --- | --- |
| **GenerationEngine（真实入口）** | `shared/generation-engine.js`（`global.GenerationEngine`)；真实 UI 入口为 `shared/practice-session.js` 的 `PracticeSession.start()` → `GenerationEngine.generate()` 直通 | `build / generate / generateSync / validatePlan / render / generateAndRender / resolveGenerator / generateLegacy / renderLegacySet / pipeline / assertGenerationBoundary / rng / canonicalKey`；随机源由注入 RNG 提供，重建了去重/随机下沉（`rng.js`、`duplicate-validator`） | runtime C02-01 真实 `PracticeSession.start()` 产 5 题 + HTML 1654；C02-04 渲染含 `<svg>` → PASS |
| **StrategyEngine** | 运行时入口 `shared/strategy-engine.bundle.js`（`global.StrategyEngine`，register/plan），源引擎 `shared/strategy/strategy-engine.js` | 8 步策略决策链（题型→认知→难度三级→自适/R12-R22→数值域→题型分配/风格/复杂度→…→plan）；`question-plan.js` 输出结构 | check-strategy-plumbing M3-22 11 步决策链 OK；真实 plan `{kp:'math-g1-m1-addsub-5', count:5, difficulty:3}` 产出 full QuestionPlan（calc / cognitive=apply / difficulty=3 / spiralLevel=1 / context=complex / numberRange 1-20 / maxSteps 2） |
| **QuestionPlan** | `shared/strategy/question-plan.js` | plan 契约：`questionTypeId / cognitiveLevel / difficulty / spiralLevel / variationMode / contextType / numberRange` 等完整性校验 + forbidden 字段拦截 | golden 11/11；snapshot 漂移 0；m1 R03 Canonical Access PASS |
| **GeneratorSelector** | `shared/generator/generator-selector.js` | `selectGenerator` 按 core / native / 注册表 / 能力命中分级评估 + `instantiate` + `wrapGenerator`；匹配 16 类题型能力表 | golden 11/11（含 legacy=3 桥接用例）；check-strategy-bundle 原生/legacy 双向桥接 PASS |
| **SemanticQuestion** | `shared/semantic-question.js` | `createSemanticQuestion / normalizeSemanticQuestion / validateSchema / isValidSemanticQuestion / normalizeQuestions / validateQuestions / Schema` | verify-svg 219 个 SVG 生成校验 PASS；snapshot 漂移 0 |
| **Validator** | `shared/validator/`：`validation-pipeline.js`（4 步：schema→answer→difficulty→duplicate）、`question-validator.js`、`batch-validator.js`（8 项）、`quality-scorer.js`（6 维加权） | 生成结果校验双轨 + 批量门 + 质量评分 | snapshot 基线漂移 0；架构护栏 R4 硬规则 ERROR 0 |
| **Presentation Runtime** | `shared/presentation-engine.js`（`PresentationEngine.renderAll` 主链）+ `shared/presentation/`（`renderer.js` render 契约、`html-renderer.js`、`render-options.js`、`render-result.js`、`svg-registry.js`、`legacy-svg-adapter.js`）+ `shared/generator/legacy-adapter.js`、`assets/semantic-question-bridge.js` | HTML/SVG 双路线 + RenderResult 契约 + legacy 自动转 Semantic 桥（presentation-engine 196-198） | runtime C02-02/03/04/05 PASS；verify-svg 219 SVG PASS |

## 5. 已知偏差与技术债（全部既有，非本基线会话引入）

- **Frozen Core 漂移 14 处**（基线 `ca2a082` → HEAD 之间 7 个提交引入，文件数为 91↔91）：
  `shared/components.css`、`shared/knowledge-math.js`、`shared/generator/generator-registry.js`、
  `shared/generator/core/rng.js`、`shared/strategy/strategy-engine.js`、`shared/strategy/strategy-request.js`、
  `shared/strategy/question-plan.js`、`shared/strategy/question-type-strategy.js`、
  `shared/validator/validation-pipeline.js`、`shared/validator/duplicate-validator.js`、
  `shared/presentation/html-renderer.js`、`shared/generation-engine.js`、`shared/presentation-engine.js`、
  `shared/practice-session.js`
- **verify:m2 FAIL**：`tests/capability/knowledge-capability.test.js:29/:71` 断言 `574 === 567`（KP 数量在 G1 扩展后未同步更新硬编码期望）。
- **R4 技术债 WARNING×6**：`Math.random` 调用位于 presentation-engine.bundle / question-id / strategy-engine.bundle / plugins/math-g1-multiplication-table 的注释或休眠分支；`Math.random` 硬规则为 ERROR 0。
- **KB WARN×3**：cn/g2/N1-AlphabetOrder、cn/g2/N1-PinyinReview、en/g3/E2-WordSpelling 占位条目未声明 pluginId。
- **golden 警告 3**：math-make-ten 期望 SVG 但无、math-fraction 期望无 SVG 但有 3、math-g2-column 自身答案通过率 4/5（归一化不一致）。
- **snapshot 警告**：新增 Case 无基线比对（`math-g2-mixed|2||4`）。
- **架构护栏 WARNING 6**：practice.html 静态引入 difficulty-static.js 但 UI 不传 knowledgePointMeta（Static 休眠态，Legacy 仍默认）。

## 6. 授权流程提示

- 本基线记录 Frozen Core 处于 **DRIFT 状态**（14 处、既有）。重构若涉及上表 §5 中任一文件，须先向所有者申请授权（Bug Fix 编号）并按
  `node dev/check-frozen-core.js --baseline` 重锚，或先将 HEAD 回退到基线锚定提交后再操作。
- 重构完成后，对照本文档 §2/§3/§4 逐门禁复核：三路 Gate 应恢复「Frozen Core 干净（0 drift）/ verify PASS / runtime PASS」，组件 API 面与探针结果不允许本质性漂移除非有对应重构声明。

---

### 附：本基线使用的命令清单（零副作用）

```bash
git rev-parse HEAD
node dev/check-frozen-core.js --check          # ⚠️ 14 既有漂移
npm run verify                                  # ✅ 7/7
node dev/check-presentation-runtime.js          # ✅ 16/16
npm test                                        # ✅ exit=0
npm run verify:layers                           # ✅
npm run verify:m1                               # ✅
npm run verify:m2                               # ✗ 既有 567 vs 574
node dev/check-strategy-bundle.js               # ✅
node dev/check-strategy-config.js               # ✅
node dev/check-strategy-plumbing.js             # ✅
```

---

## 7. Refactor Step 1 执行后复核（Core Domain 收缩）

> 执行时间：2026-09-06。对标 §2/§3/§4 逐门禁复核。业务改动清单与设计决策见 `docs/DEV_LOG.md` → `[Unreleased] — Refactor Step 1：Core Domain 收缩`。

| 门禁 | Step 1 后结果 | 相对基线变化 |
| --- | --- | --- |
| **verify** | ✅ PASS 7/7（error 0；warning 22–25 随随机性波动，均为既有类型 §5） | 稳定 PASS |
| **runtime** | ✅ PASS 16/16（`PracticeSession.start()` 真实产 5 题 html=1654） | 稳定 PASS |
| **npm test** | ✅ exit=0 | 稳定 PASS |
| verify:layers | ✅ PASS | 稳定 PASS |
| verify:m1 | ✅ PASS | 稳定 PASS |
| verify:m2 | ✗ FAIL（既有 567 vs 574，见 §5） | 不变（非本步骤引入） |
| tests/strategy | ✅ 168/168 | 含 10 个新增 UNSUPPORTED_SUBJECT 回归断言 |
| M3-21 plumbing | ✅ 549/549 error 0 | 收敛为 math 域（原 567/567） |
| M4-19 bundle | ✅ PASS（75 模块重建） | bundle 已随门禁重建 |
| M3-00 config / 综合管线 | ✅ PASS | 稳定 |
| M4-R03 generator-registry | ✅ PASS（math 域绑定 549） | 探针改为限 math 域（cn/en 无 Generator 记录属预期） |
| **Frozen Core** | ⚠️ **DRIFT 16**（14 既有 + 2 新增） | 新增 `shared/strategy/comprehensive-strategy.js`、`shared/strategy/strategy-error.js`，属授权 Refactor Step 1；`api.js`、`orchestrator.js`、`strategy-engine.bundle.js` 不在 frozen 91 文件集内，无漂移 |

**行为验核（Gate）**：math 单点/多点/综合/同步 4 路径全部正常产题；cn/en 全路径（subject 缩写/全称、kp id 前缀、multi-kp 混入、comprehensive、generateSync）一律返回 `UNSUPPORTED_SUBJECT`，无 fallback。→ **Math 正常 + Chinese/English 不再进入核心生成链。**

**授权提示（更新）**：Frozen Core 现有 16 处漂移（14 既有 + 2 属本步骤）。重构后续如需让 Frozen Core 归零，须向所有者申请授权并以 `node dev/check-frozen-core.js --baseline` 重锚（含保留本步骤产物）。

---

## 8. Refactor Step 2 执行后复核（Request / QuestionPlan 数组化）

> 执行时间：2026-09-06。设计决策与业务改动清单见 `docs/DEV_LOG.md` → `[Unreleased] — Refactor Step 2`。本步对 §7 基线的跃迁：16 → 26 漂移（全为授权重构产物，非 Bug Fix）。

| 门禁 | Step 2 后结果 | 相对 §7 变化 |
| --- | --- | --- |
| **verify** | ✅ PASS 7/7 | 稳定 PASS |
| **runtime** | ✅ PASS（PracticeSession.start() 真实产题） | 稳定 PASS |
| **npm test** | ✅ exit=0（含 check-lint 0 违规） | 稳定 PASS |
| verify:layers | ✅ PASS | 稳定 PASS |
| verify:m1 | ✅ PASS | 稳定 PASS |
| verify:m2 | ✗ FAIL（既有：`check-m2-final.js:37 ORCHESTRATION_PLUGIN_IDS is not defined` 脚本缺陷 + `knowledge-capability.test.js` 567≠574） | 不变（非本步骤引入） |
| tests/strategy | ✅ **182/182**（168 + 14 新增） | 新增 S2-1..S2-4 归一 + GATE-S2-1..9 数组化断言 |
| tests/generator | ⚠️ 70/71 | 1 fail 为 Step 1 既有（registry 仅收 math + cn/en KB 遗留 pluginId，m4 红灯） |
| M3-21 plumbing | ✅ 549/549 error 0 | 稳定 |
| M4-19 bundle | ✅ PASS（strategy 75 模块重建 + presentation 8 inlined/80 delegated 重建） | bundle 已随 Step 2 重建 |
| M3-00 config / 综合管线 | ✅ PASS | 稳定 |
| **Frozen Core** | ✅ **0 DRIFT（已重锚 92 files）** | 执行后基线漂移 16→26（16 既有 + 10 本步骤）；经授权重锚 `node dev/check-frozen-core.js --baseline`，同时修 frozen 清单陈旧路径 `legacy-plugin-adapter.js`→`legacy-adapter.js`；重锚后 `--check` 0 漂移 |

**行为验核（Gate）**：`knowledgePointIds` 数组为内部唯一语义——
- 生产端（strategy-engine / comprehensive / api / orchestrator / 浏览器镜像 generate）输出计划一律 `knowledgePointIds[]`，不再携带单数字段；
- 旧调用（`knowledgePointId` 字符串 / `knowledgePoints` 复数）在 boundary intake 归一，消费端经 `planKnowledgePointIds`/`planPrimaryKpId` 读取；
- `combine=true` 多 KP → 合并单计划（全量 ids、策略决策取主 KP）；多 KP 未 combine → `INVALID_REQUEST` 含 merge 指引，杜绝静默丢弃；
- `volume`→count、`spiral_level`→spiralLevel、mode 中文别名全部生效；subject 门禁覆盖全部 kpIds。
→ **数组语义单一化 + 边界容忍，不破坏旧调用。**

**授权提示（更新，已重锚）**：Step 1 + Step 2 均已获得所有者授权提交，Frozen Core 已于 2026-09-06 以 `node dev/check-frozen-core.js --baseline` 重锚（92 files，覆盖真身 `legacy-adapter.js`），当前 0 漂移。存留红灯（非本步骤引入）与重锚建议：`verify:m2`（`check-m2-final.js:37 ORCHESTRATION_PLUGIN_IDS is not defined` + `knowledge-capability.test.js` 567≠574 硬编码）、m4 registry 断言（cn/en 遗留 pluginId vs math-only registry）、`check-generator-contract.js` 47 违规（含 math-word-problems 难度硬编码）。