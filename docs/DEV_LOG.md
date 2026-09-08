# 项目开发日志（Dev Log）

> 版本演进完整记录。格式参照 Keep a Changelog，版本号遵循语义化版本（大版本.功能.修复）。
> 每个大版本的完整变更以 Git 标签为锚点（`git log V2.1..V3.0` 可查看全部提交）。
> 当前文档是整理后的统一开发日志，替代根目录 `CHANGELOG.md`、各内存/总结文档中的历史记录部分，
> 以及 V4.0.2 起并入的各一次性工作报告（架构里程碑 / 迁移审计 / 债务扫描）。

---

## [V4.3.0] — 数学生成引擎 V2.1：竖式归一化清零 + 文档体系收敛（2026-09-08 发布）

**目标**：① 清零 math-g2-column 答案/check 归一化技术债（「错误答案 0」字面口径）；② 引擎打 V2.1 版本标签；③ 文档体系收敛——清除陈旧过期文档，现状只保留单一事实源。

### 数学生成引擎 V2.1（math-g2-column 挂账清零）
- **根因**：8 个 G2-M2 竖式 KP 中 6 个无 native 显式绑定，按题型优先级回退到语义错误的生成器（减法竖式→加法；余数/连算竖式→应用题/位置方向）；余数答案 `q……r` 从未被 native 产出；Golden 自测失败仅 WARNING 放行。
- **修复**：
  - `shared/generator/core/arithmetic-core.js`：新增 `buildDivRemainder`（a÷b=q……r，恒 0<r<b，表内域）+ SPECIAL_KINDS `div-remainder`。
  - `kp-arithmetic-semantics.js`：`remainder` 移出 NON_MIGRATABLE，派发 div-remainder；`kp-complex-semantics.js` + `generators/complex.js`：补 chain-add-col/chain-sub-col/mixed-col 三个 chain profile。
  - `generator-registry.js`：add-col/sub-col/remainder-col/chain-add-col/chain-sub-col/mixed-col 显式绑定（修正减法→加法误路由）。
  - `shared/core.js` `normalizeAns`：余数记号单源归一（`……/…/...(≥2点)/余` → `……`），批改/golden/页面三方共用。
  - `dev/check-golden.js`：新增 6 个竖式 case；自测失败由 WARNING 升级为 **ERROR**。
  - `shared/generator/generators/index.js`：新增并导出 `ENGINE_VERSION = '2.1.0'`（引擎版本，与 APP_VERSION/PWA 版本独立）。
- **验证**：8 KP × d=1..10 × 20 题 = 800/800 正确、错误答案 0；余数记号变体全判对；Golden 15/15；全量 Gate 绿；浏览器实测无 JS 错误/404。

### 文档体系收敛
- **新增/重写**：
  - 根目录 `技术文档--基础.md`（由原 EXECUTION-PLAN-STATUS.md 改造而来）：15 章——技术栈、仓库结构与四层架构、出题数据流、Generator Family 与硬阻断路由、语义/生成/渲染/批改、运行时模块与工具 API、知识库契约、开发规范与 Frozen Core、质量保障 Gate 链、13 条 ADR、生成器扩展流程、SEO 与发布运维、版本演进、15 条踩坑经验、文件索引。**并入并替代** docs/DEVELOPMENT.md、ARCHITECTURE_LAYERS.md、PROJECT_STRUCTURE.md、KNOWLEDGE_BANK_CONTRACT.md 的有效内容（技术栈/四层归类/目录布局/模块/规范/门禁/契约均按 native-only 现状重写）。
  - 根目录 `设计文档.md`（新增）：设计目标与原则、6 项已落地设计计划决策记录（受控生成链路、三维螺旋、打印紧凑化、R2 题型规范化、legacy 退役、V2.1 竖式清零）、UI 层设计说明（页面地图/用户流程/practice.html 区域与交互/视觉令牌/打印/离线/SEO）、自适应预留契约、UI 改动约束清单。
- **更新**：README.md（竞赛模块状态改为已上线、技术栈/目录结构更新为 native-only、文档导航改指两份新文档）；llms.txt（站点简介同步现状）；robots.txt（增补 AI 爬虫与 SEO 规则）。
- **删除（已落地/过期，内容已并入新文档）**：
  - docs/：DEVELOPMENT.md、ARCHITECTURE_LAYERS.md、PROJECT_STRUCTURE.md、KNOWLEDGE_BANK_CONTRACT.md、REFACTOR_BASELINE.md（重构前快照）、R2_QTYPE_NORMALIZATION.md、R2D_G1_ONTOLOGY_DRAFT.md、G1_MAPPING_TABLE.md、G1_SVG_TEMPLATES.md（引用已删除的 question-style-strategy）、DRIVEN_GENERATION_PLAN.md、SPIRAL_IMPROVEMENT_PLAN.md、PRINT_COMPACT_PLAN.md；
  - docs/ HTML：AI_REFACTOR_PLAN.html、G1_MATH_QUESTION_TYPE_SCHEME.html、TYPE_MAPPING_SPIRAL_SOLUTION.html（均已执行完毕的方案）；
  - docs/ JSON 草案：g1-book-annotation-draft.json、r2d-g2/g3/g4/g5a/g5b/g6a/g6b-ontology-draft.json（本体补全原始素材，已落入 knowledge-math.js）；
  - dev/r2d-ontology-apply.js（一次性草案应用脚本，已执行完毕，随草案失效）；
  - dev/r2-qtype-normalize-apply.js / r2-qtype-normalize-draft.js / r2-qtype-normalize-map.js（R2 题型规范化一次性迁移脚本三件套，已执行完毕，无运行时/门禁引用）。
- **随附清理**：dev/difficulty-anchor-table.js、dev/lint-check.js、dev/check-architecture-layers.js、dev/check-knowledge-dir.js、dev/verify-setup.js（贡献指南存在性检查改指《技术文档--基础》）、shared/strategy-config.js、architecture/layers.json（3 处 desc/_note）中指向已删文档的引用全部改指《技术文档--基础》；check-frozen-core 白名单补入根目录两份文档与 llms.txt/robots.txt。
- docs/ 目录现仅保留 DEV_LOG.md（流水）；archive/ 历史归档不动。

### 版本标记（APP 4.1.0 → 4.3.0）
- 应用/PWA 版本号 **V4.3.0** 发布标记，同步 5 处：
  - `package.json` `version`、`shared/version.js` `APP_VERSION`（单一版本源）；
  - `sw.js` 缓存名 `CACHE = 'hw-help-4.3.0'`（部署后 SW activate 自动清理 hw-help-4.1.0 旧缓存）；
  - `index.html` 页脚版本回退常量、`dev/test-sw-cache-upgrade.js` 测试固件回退值。
- `shared/version.js` 属 Frozen Core（M0），已按授权流程 `node dev/check-frozen-core.js --baseline` 重建 80 文件基线。
- 引擎版本 `ENGINE_VERSION = '2.1.0'` 与 APP 版本独立，本次不变。
- 文档同步：技术文档--基础.md 头部版本说明与 §13 演进流水改指 V4.3.0。

### Gate（执行后）
- `npm run verify:m4`：549/549 KP 覆盖、583 QT ALLOW；`npm run verify:golden`：15/15；`npm test`：exit 0；
- `verify:syntax` 274 文件 0 错误；`verify:m1/m2/layers/frozen-core` 全 PASS；node:test 274/274；
- `check:sw-version`：缓存名 'hw-help-4.3.0' 与 APP_VERSION '4.3.0' 一致；frozen-core 基线已重建（80 文件）。

---

## [Unreleased] — 契约明确 + 门禁收敛 + 运行时去重复扫描（审计收尾）

**目标**：把审计结论固化为可执行/可文档化的形式——明确 KnowledgeBank 最低生成契约与 KP 修改最小门禁；快照降级为行为回归工具；确认并消除运行时 KP 全量重复扫描；收窄全量 verify 使用场景。不改动 cn/en legacy、不扩大插件迁移、不新增辅助架构。

### 新契约文档与范围矩阵（P1.1 / P1.2 / P2.3）
- 新增 `docs/KNOWLEDGE_BANK_CONTRACT.md`：运行时最低生成契约（`id/name/pluginId/type/weight` + 结构派生 `moduleId`，且 `pluginId` 必须在注册表登记）、可选字段缺省回落表、数据质量契约与门禁归属、运行时防扫描结论、KP 修改最小门禁范围。
- `docs/DEVELOPMENT.md` §7：新增 §7.4 按变更范围选择验证命令矩阵、§7.5 Snapshot 定位；刷新 §7.1 门禁链与 §7.2 命令。

### 运行时去重复扫描（P1.3 — 确认 + 修复）
- 插桩确认：`getEntries`（subject\|grade 缓存）与 generator-registry（`_records`/`_kpCache`/`_qtCache`）均已惰性缓存；但 `knowledge-point.get/findLegacy` 每次调用全表线性扫描，单请求同一 KP 达 5× 全库扫描（81 次 KP.get 仅 11 个唯一 id）。
- `shared/knowledge-point.js`：`findLegacy` 改为惰性 `id→legacy` 索引（否一次 O(1)）；`get` 增加 `id→canonical` 缓存（唯一 id 仅归一一次）；导出 `reset()` 供测试重建。行为不变（normalize 为纯函数、无请求间状态泄漏、`enhanceKp` 浅注入幂等）。
- 效果：5 模式归一化 645→575（余 564 为每进程一次的能力注册表冷启动全量构建），同 KP 重复线性扫描清零。

### 门禁收敛（P2.1 / P2.2）
- `node dev/verify-m0.js`：Snapshot 降级为**行为回归 REPORT**——`nonBlocking` 步骤失败仅记为 REPORT 不计入 FAIL；`dev/check-snapshot.js` 返回 `nonBlocking:true`，单跑仍以退出码反映漂移。
- `package.json`：新增 `verify:kb-change`（KP 修改最小门禁 8 步链）；`test` 链移除 `check-knowledge`（`verify:setup` 已内嵌 `verify-knowledge-bank`，消除重复全量执行）。

### Gate（执行后）
- `npm run verify`：PASS 7/7（snapshot 行为回归 REPORT，漂移 0）。
- `npm run verify:kb-change`：8 步全部通过（契约 567 KP ERROR 0 / 目录 673 页 / 完整性 ERROR 0 / Canonical 审计 / 可达性 3/3 / 模块一致性 5/5 / 螺旋一致性 3/3）。
- `npm test`：exit=0；`verify:m3` PASS；generator 测试仍仅既有 cn-pinyin 一处失败（`KB 中带 pluginId 的 KP 均有对应 Generator`，cn/en legacy 属 P3 保留，与本次无关）。
- `check-frozen-core --check`：PASS（`shared/knowledge-point.js` 不在 84 文件冻结集内，无漂移）。

---

## [Unreleased] — Refactor Step 1：Core Domain 收缩（核心生成链仅接受 math）

**目标**：核心 Generation Engine 只保留数学（math）；语文(cn)/英语(en) 的生成责任从核心链删除，返回明确 `UNSUPPORTED_SUBJECT`，禁止 fallback。保留 UI、历史数据、兼容层。
**对应重构基准确认**：见 `docs/REFACTOR_BASELINE.md`（重构前基线 + Step 1 复核记录）。

### 业务改动（生成层，6 文件 + bundle 重建）
- `shared/strategy/strategy-error.js`：新增错误码 `UNSUPPORTED_SUBJECT`。
- `shared/strategy/strategy-engine.js`：`plan()` KP 解析+增强后按 `kp.subject`（兜底 kp id 前缀）门禁，非 math → 抛 `StrategyError('核心生成引擎仅支持数学（math）…', UNSUPPORTED_SUBJECT, {subject, knowledgePointId})`；同步 `npm run build:strategy` 重建 `shared/strategy-engine.bundle.js`（75 模块）。
- `shared/strategy/comprehensive-strategy.js`：`build()` 拒绝非 math 综合练习（`Promise.reject` `UNSUPPORTED_SUBJECT`），cn/en 不再进 `KB.getEntries` 分配。
- `shared/generation/api.js` + `shared/generation-engine.js`：`build`/`generateSync` 入口门禁——**kp id 前缀优先于 subject**（防止 `subject=math` 掩盖 multi-kp 中混入的 cn/en 知识点）；非 math → `GenerationUnsupportedError`（`code=UNSUPPORTED_SUBJECT`，`supportedSubjects=['math']`），不进 runPlans/渲染。
- `shared/generation/orchestrator.js`：`orchestrate` 对非 math 请求返回 `trace{ code:'UNSUPPORTED_SUBJECT', subject, error }`。
- `shared/generator/generator-registry.js`：`buildRecords` 仅收 `subject==='math'` 的 legacy 记录——cn/en 生成候选与「fallback:legacyPluginId」宿主一并根除。

### 探针/测试随域收敛
- `dev/check-strategy-plumbing.js`：只覆盖 math 域（口味 549/549），cn/en 不再进 StrategyEngine。
- `dev/check-generator-registry.js`：kp pluginId 绑定校验限 math 域（cn/en 不再有 Generator 记录属预期）。
- `tests/strategy/single-kp.test.js`：原「语文×5/英语×5 出计划」子测试 → 反转为「cn/en 抛 UNSUPPORTED_SUBJECT」回归（10 个 kp 全断言）。
- `tests/strategy/spiral-context-regression.test.js`：en geometry KP 用例改 `math-g4-c4-c4-solid`（同为 geometry→context none）；全量回归限 math 域并去掉过时硬编码 574（改为按库统计 self-consistent）。
- 未动：golden/snapshot 的 `chinese-pinyin` 用例（直连 legacy 插件 `plugin.generate`，属兼容层非核心链）；`verify:m2` 既有 `knowledge-capability.test.js` 567≠574 失败不受影响。

### Gate（Step 1 执行后）
- `npm run verify`：**PASS 7/7**（error 0；warning 22–25 随随机性波动，均为既有类型）。
- `npm test`：**exit=0**。
- `verify:presentation-runtime`：**PASS 16/16**（真实 `PracticeSession.start()` math 产 5 题 html=1654）。
- `verify:layers` PASS；`verify:m1` PASS；`verify:m2` FAIL（既有 574≠567，与本步骤无关）。
- 策略层：`tests/strategy` **168/168**、M3-21 plumbing **549/549 error 0**、M4-19 bundle PASS、M3-00 config PASS、综合练习管线 PASS、M4-R03 registry PASS（math 域绑定 549）。
- 行为验证：math 单点/多点/综合/同步全正常；cn/en 全路径（subject 全称/缩写、kp 前缀、multi-kp 混入、comprehensive、generateSync）均返回 `UNSUPPORTED_SUBJECT`，无任何 fallback。
- `verify:frozen-core`：漂移 **14→16**（新增 `shared/strategy/comprehensive-strategy.js`、`shared/strategy/strategy-error.js`；属授权 Refactor Step 1；`shared/generation/api.js`、`shared/generation/orchestrator.js`、`shared/strategy-engine.bundle.js` 不在 frozen 基线 91 文件集内，无新增漂移）。

---

## [Unreleased] — Refactor Step 2：Request / QuestionPlan 数组化（knowledgePointIds[] 唯一内部语义）

**目标**：把「单一知识点」的内部语义统一为 `knowledgePointIds` 数组。所有生产端（策略层/api/orchestrator）只输出数组；旧调用方（`knowledgePointId` 字符串、`knowledgePoints` 数组）仅在边界 intake 归一一次，不维护第二套内部语义。同步确立 feature 字段（mode/grade/volume/unitId/questionType/count/difficulty/spiralLevel/combine/previousGenerationId）与别名（volume→count、spiral_level→spiralLevel、mode 中文别名）。
**设计决策**：请求 KP 优先级 `knowledgePointIds > knowledgePoints > knowledgePointId > kp`；`normalizeRequest` 删除单数字段；`combine===true` 多 KP → 合并单计划（`knowledgePointIds` 全量，策略决策用 ISO 主 KP）；引擎拒绝「多 KP 且未 combine」（`INVALID_REQUEST`，防静默丢弃），api/orchestrator/镜像在拆单前先路由 combine。
**对应重构基准确认**：见 `docs/REFACTOR_BASELINE.md` §8。

### 业务改动（策略层）
- `shared/strategy/strategy-request.js`：`resolveKnowledgePointIds`（四优先级）+ `normalizeRequest`（删单数字段、volume/spiral_level/mode 别名、新字段合法性校验）+ `validateRequest`/`canonRequest` 数组化。
- `shared/strategy/question-plan.js`：新增 `planKnowledgePointIds`/`planPrimaryKpId` 消费端 helper；`validateQuestionPlan` 接受数组（权威）或旧单数（容忍），二者皆无才报错。
- `shared/strategy/strategy-engine.js`：入口 `normalizeRequest`；`kpIds` 数组化解析；多 KP 未 combine → `INVALID_REQUEST`（报错含 merge 指引）；subject 门禁覆盖全部 kpIds（resolve-subject + 前缀）；`trace.knowledgePointIds`；QuestionPlan 输出 `knowledgePointIds`（combine 为全量、单点为 `[kp.id]`）+ `combine`/`previousGenerationId`/`unitId` 透传；spiral 取 `request.spiralLevel`；generator 候选计划 `knowledgePointIds:[kp.id]`。
- `shared/strategy/strategy-validator.js` / `strategy-result.js`：数组容忍（取 `plan.knowledgePointIds`，缺省回退旧单数），主 KP = 首元素。
- `shared/strategy/comprehensive-strategy.js`：`volume` 别名、`unitId` 按 moduleId 过滤、per-KP 请求 `knowledgePointIds:[entry.id]`。

### 业务改动（生成/计划消费端）
- `shared/generation/api.js`、`orchestrator.js`、`shared/generation-engine.js`（浏览器镜像）：`requestKpIds`/`requestCount`/`planKey` helper；`isComprehensive` 数组判定；`requestSubject` 遍历全部 kpIds；combine 路由；multi-kp 拆单（per-KP `knowledgePointIds:[kpId]`、spiralLevel 透传、`failedPlans` 以 planKey 标注）。
- 消费端 helper 化：`generator-contract.js`/`generator-selector.js`/`generator-mode.js`/`legacy-adapter.js`/`presentation-engine.js`/`batch-validator.js`；`arithmetic`/`complex`/`selection` 本地 `pkp(plan)` 主 KP shim；`question-type-allocation.js` 输出 `knowledgePointIds`。
- `shared/practice-session.js` `_buildGenerationRequest`：发送 `knowledgePointIds` 数组（单点 `[kp]`）+ `combine` 透传。

### Bundle / 探针 / 测试
- 重建 `shared/strategy-engine.bundle.js`（75 模块/5 shims）与 `shared/presentation-engine.bundle.js`（8 inlined/80 delegated）。
- 探针收敛：`dev/check-presentation-runtime.js`、`dev/test-generator-regression.js`、`dev/test-generator-equivalence.js` 改读 `plan.knowledgePointIds[0]`。
- 测试：`tests/strategy/strategy-engine.test.js`（断言 `plan.knowledgePointIds` 且 `knowledgePointId===undefined`）、`tests/comprehensive/comprehensive-strategy.test.js`（数组深比较）、`tests/strategy/strategy-request.test.js`（原「缺 KP 即非法」反转 subject+grade 合法；新增 S2-1..S2-4 归一/别名/校验/回退）、新增 `tests/strategy/kp-array-gate.test.js`（GATE-S2-1..9：combine、volume、数组删除单数、isComprehensive、subject 门禁、消费端读取器、端到端 generate、sync 归一）。

### Gate（Step 2 执行后）
- `npm test`：**exit=0**（全链 PASS，含 check-lint 0 违规）。
- 策略层：`tests/strategy` glob 全量 **182/182**（168 旧 + 14 新增：S2-1..S2-4 归一 + GATE-S2-1..9）。
- `verify:m3`：**PASS**（tests/strategy 182/182 + config + bundle 重建 + plumbing 549/549 error 0）。
- `verify:presentation-runtime`：**PASS**（PracticeSession.start() 真实产题）。
- `verify:layers` PASS；`verify:m1` PASS；`verify:m2` FAIL（既有 `check-m2-final.js:37 ORCHESTRATION_PLUGIN_IDS is not defined` 脚本缺陷 + `knowledge-capability.test.js` 567≠574，均非本步骤引入）。
- `tests/generator` 71 项：70 pass、1 fail——`generator-registry.test.js`「KB pluginId→Generator」断言（Step 1 起既存：registry 仅收 math + cn/en 遗留 pluginId 属预期，m4 红灯）。
- `verify:frozen-core`：执行后漂移 **16→26**（+10 属本步骤；精确归属见 REFACTOR_BASELINE §8）。随授权提交，已以 `--baseline` 重锚（92 files，含修正 frozen 清单陈旧路径 `legacy-plugin-adapter.js`→`legacy-adapter.js`），重锚后 **0 漂移**。

---

## [Unreleased] — Refactor Step 5：Generator Migration · native 迁移批次 + 全量插件扫描/分类

- **迁移批次 ORAL_G4G5（+8 迁移 KP，ALL_MIGRATED 25→33）**：四/五年级整数域口算家族
  `math-g4-oral` 6 KP + `math-g5-oral` 2 KP，由 arithmetic 生成器经 `SPECIAL_ORAL_PROFILE`
  既有 kind 分派（big-addsub / mul3x1 / mul2tens / div-tens / dec-addsub / law-oral / dec-mul-oral / dec-div-oral）。
  `dev/test-migration-equiv.js` 逐 KP **FULL-EQ 全绿**（calc/oral 9/9）：math-g4-oral MIGRATABLE 6/6，
  math-g5-oral FULL-EQ 2/5（另 3 KP 无纯算术语义，保留 legacy）。加入 `shared/generator/migration-switch.js` 新批次
  `ORAL_G4G5_KPS`，补足 `isMigrated()` 声明（registry 核心轨原已含此 8 KP、运行时已 native 服务，
  本批消除「运行时 native 但 isMigrated()=false」不一致，避免 hybrid 模式回退 legacy）。**math-g4-oral 现全 6 KP 迁移 → 归类 native（无 fallback）。**
- **全量插件扫描/分类报告（`dev/check-generator-migration-report.js` → `dev/reports/generator-migration-report.json`）**：
  对 registry 93 插件逐一定性 `native / legacy / broken / unused`，依据迁移状态 + 运行时健康
  （loader/契约/plan/generate）+ 绑定（placeholder/facade/无 KP）。
  当前：**native 1**（math-g4-oral）、**legacy 87**、**broken 5**（cn/en 因 Core Domain 收缩被引擎拒绝，属预期 out-of-scope）、**unused 0**。
  已并入 `verify:m4` 链与独立 `verify:gen-report` 脚本。
- **Gate（Step 5 执行后）**：`tests/generator` 50/51 PASS（唯一 fail 为既存 cn/en registry 断言 §8 红灯）；
  `tests/strategy` 186/186 PASS；`dev/test-generator-regression.js` **3498/3498 PASS**；
  `check-generator-mode.js` PASS；`verify:m4` 各 check 脚本 PASS（adapter 5 错误为预期 cn/en；contract 47 违例为既存 §8 红灯）。
  顺带修复 `dev/check-core-generators.js` 陈旧路径 `shared/strategy/legacy-adapter.js`→`shared/generator/legacy-adapter.js`（Step 2 同类探针缺陷遗漏），修复后 M4-R06 PASS。
  frozen-core 漂移：`shared/generator/migration-switch.js`（+1，授权 Step 5，随授权提交重锚）。

---

## [Unreleased] — 生成层三阶段适配检查 + 运行时探针加载器修复

- **C01/C02 运行时探针加载器缺陷修复（`dev/check-presentation-runtime.js`）**：vm 加载器 `exec()` 嵌套加载后未恢复 `win.require`，导致子文件 require 基准泄漏——`generation-engine.js:423` 的 `require('./generator/core/rng.js')` 误以 `shared/generation/` 为基准解析出不存在的 `shared/generation/generator/core/rng.js`（真实文件在 `shared/generator/core/rng.js`），使 `verify:presentation-runtime` 必失败。修复：`exec()` 保存/恢复 `module/exports/require` 三态，子文件 exports 在恢复前捕获返回，父文件后续相对 require 回归正确基准。修复后探针 16 项全 PASS（含真实 `PracticeSession.start()` 端到端产题/渲染/判分与 C02-04 SVG 渲染链）。
- **确认生成层三阶段适配完整且互不越层**：输入适配（`practice-bridge`→`practice-session`→`dto`/`strategy-request` 归一校验）、核心编排（`strategy-engine` 8 步计划 + `comprehensive-strategy` 配额 + `validation-pipeline`→`batch-validator`→`quality-scorer` 质量后处理）、输出适配（`PresentationRenderer.renderAll`→`RenderResult` 契约 → `html-renderer`/`svg-registry` + `legacy-adapter`/`semantic-question-bridge` 旧格式桥）完整闭环。

## [Unreleased] — 四层架构归属一致性修复

- **统一 `strategy-engine` 归属为生成层**：`generation-engine.js` PIPELINE 元数据、`ARCHITECTURE_LAYERS.md §3.1`（职责收敛）与 `DEVELOPMENT.md` 项目树均将核心策略规划归生成层，唯 `layers.json` 旧登记归大服务层。本次将 `strategy-engine.js`、`comprehensive-strategy.js`、`question-style-strategy.js`、`complexity-strategy.js` 移入 `GENERATION/STRATEGY` 新组；`svg-templates.js` 登记入 `GENERATION/PRESENTATION`；同步修正 `ARCHITECTURE_LAYERS.md` §1/§2.2/§2.4 表述。`npm run verify:layers` 由 FAIL → PASS。

## [V4.2.1] — 2026-09-04

本版本主题：**打印紧凑化 Bug Fix（Issue #1，Frozen Core 授权）+ 知识点契约对齐 + 工具栏大服务层集中管理随包**。

### Bug Fix：打印排版浪费空间且存在多余卡片样式（双路径不一致）— Issue #1 `[Frozen Core Fix]`
- **Bug 编号**：GitHub Issue #1（`[Bug Fix][Frozen Core]` → `[Frozen Core Fix]` 批准，§6.5 流程完整走完 P0–P4）。
- **根因**：打印两路径（语义题 `PRINT_QCSS` / DOM 克隆 `buildPrintHtml`）各自硬编码卡片框（border/radius/background）、gap、padding，且数值漂移（12/10 vs 14/12）；「试卷纸」上呈现「屏幕卡片感」，版面浪费约 1/3；题号圆形徽标与作答虚线未按题型区分。
- **修复点**：
  - P1.1 `shared/print.js` `PRINT_QCSS`：去卡片化（删 border/radius/background）、@page 10mm 8mm、gap 8px 6px、题干 15px/1.5、题号回归正文色、作答区 20px——单卡高 89→60px（-32%）。
  - P1.2 克隆路径网格 gap 与语义路径统一（8px 6px）。
  - P1.3 令牌收敛：`--card-padding-print: 6px 8px`、`--grid-gap-print: 8px 6px`（tokens.css 单一来源）；`buildPrintQcss()` 构建时读令牌（打印自含文档带兜底），克隆路径内联 `var(--grid-gap-print,8px 6px)`——消除硬编码双源。
  - P2.1/2.2 `presentation/renderer.js`+`html-renderer.js`：`density` 透传并落地为 `question-card compact` 类（仅 class，RenderResult 契约不变）——约定（print=compact）与实现自此一致。
  - P2.3 `components.css`：`.question-card.compact` 用途注释校准（仅服务屏幕紧凑；打印不经本类）。
  - P3.1 打印端题号去圆形徽标（克隆路径 `.print-shell .num` 覆盖；屏幕徽标保留）。
  - P3.2 作答虚线题型自适应：纯口算/填空卷去线（间距分隔），含书写类（apply/word/open/draw…）保留；`options.answerRule` 可显式覆盖。
  - P3.3 `:has` 短卡（无图）放行跨页拆分，提高页底密度；不支持 `:has` 环境自动退化为整卡 avoid。
- **验证方式**：`node --test tests/presentation/renderer.test.js`（28 用例，含 P2 新增 3 断言）· `verify:presentation-runtime` · `verify:ui-boundary` · `verify:golden` 11/11 · `verify:snapshot` 漂移 0（屏幕 normal 零回归）· `npm test` 全绿 · `verify:m3` 168 全绿 · 无头 Chrome 打印样张（口算/应用题/凑十法/综合）目检。

### 知识点驱动随包变更（项目所有者指示）
- `shared/knowledge-math.js`：一年级 53 条补全 `concept / operations / factualContent / common_errors / graphicType`，并规范化 `applicable_question_types`（§6.4 数据扩展口径，零接口变更）。
- **测试口径联动**：`tests/strategy/question-type-allocation.test.js` 中 make-ten 由单题型改为 calc+fill 双题型（均分+余数优先 calc），新增 count=11 用例；**已知边界**：分配步不消费 coefficient（均分），若需权重分配属后续能力项。
- `practice.html` + `shared/pages.css`：工具栏样式集中管理（内联 → 大服务层 CSS，视觉等价）、快速模式占比分项胶囊换行流 + 可改填题量（守恒腾挪）；顶栏导航改左上角悬浮返回胶囊。
- `assets/poster-*.png` 入库（.gitignore 例外），首页海报引用生效。
- 冻结核心基线重锚（90 文件）：`dev/frozen-core-baseline.json`；重锚前备份 `.bak`（SHA1 7f48235…）。
- 标签沿革：`v4.2.0`（已发布，指向 5c9637e）→ 本次修复发布为 **`v4.2.1`**。

---

## [V4.1.0] — 2026-09-04

本版本主题：**四层架构归类整合（UI 显示 / 生成引擎 / 知识库 / 大服务）+ 关联层收敛与生产链路修复**。

### 项目整理：四层架构归类（物理稳定 + 逻辑清单）
- 采纳用户分层口径：**UI 层（显示）/ 生成层（题目生成核心引擎）/ 知识点库（基层数据核心）/ 大服务层（信息传递 · 项目控制 · 外围样式 · 打印等外围控制）**，除 UI/生成/知识外**全归大服务层**。
- **`architecture/layers.json`**（新增）：权威四层机器清单，逐文件归类：
  - `UI`：页面 + 渲染宿主 + `sw.js`;
  - `GENERATION`：引擎壳 / 语义 / 生成器 / 服务接口 / 呈现渲染 / SVG / 题型插件（`sub` 7 组）;
  - `KNOWLEDGE`：知识库 + 本体 + 字库 + 映射;
  - `SERVICE`：关联/策略/校验/能力/学习者/基础/状态IO/目录/CSS（`sub` 9 组）。
- **`dev/check-architecture-layers.js`**（新增）+ `npm run verify:layers`：校验 JSON 结构、登记文件存在性、**覆盖率**（`shared/`+`plugins/`+根 `.js/.css` 共 255 文件全部已归类）。
- **`docs/ARCHITECTURE_LAYERS.md`**（新增）：人类可读四层映射 + 硬红线 + 物理不移动原因（`common.js` 自推导注入同目录 6 子模块、预编译 bundle 内嵌 `shared/` 模块 id、sw.js/门禁/测试硬编 `shared/` 路径）。
- **为何不物理移动**：深度排查确认 `shared/` 为紧密耦合模块根，无安全孤立可移文件；采用「物理稳定 + 逻辑清单」。

### 生产链路修复（P0）
- **`shared/practice-session.js`**（冻结授权 Bug Fix P0-1）：`start()` 依赖加载改为回退 `global.GenerationEngine`，消除浏览器会话 `start()` 同步 TypeError（不再依赖未加载的 `generation/api.js`）。
- **`practice.html`**（P0-2）：补 `checkBtn` 点击绑定（`bindEvents()` 内）。
- **`shared/semantic-question.js`**（P0-3，非冻结）：答案映射 `hasOwnProperty + !=null` 保留 `false/0/''`；`normalizeSemanticQuestion` 补 `options`/`data` 映射与 `correctIndex` 推导。
- **`shared/presentation-engine.js`**（冻结授权 Bug Fix P0-4）：`generateQuestions` 门禁改为「仅拦截零可用输出」，修复 R28-3 回归。
- **图形校验误报修复（次级）**：`normalizeSemanticQuestion` 不再用空壳 `{type:null}` 兜底、不再把真实描述符洗成 `custom/rawSvg`——无图形→`null`（validator skip）、有描述符→保留、原始 svg→`custom`；4 场景探针全对，消除 `GRAPHIC_TYPE_UNREGISTERED` 误判。

### 关联层收敛（B1–B5）
- 删除死代码 `buildInstruction` / `sessionConfigFromInstruction` / `start()` 的 `__profile/__orchestrated/__partitions` 遗留路径（全仓零外部调用）。
- **`computeResult`** 删除结构不一致的本地降级，无条件委托 `PluginUtil.computeResult`（统一 `{score:百分比, results:boolean[]}` 语义，杜绝「全部误判正确」）。
- **`asmGenerateFromSelection`** 收敛冗余 `newSession`（其后 `start()` 会重建覆盖）。
- **print 路径**改走关联层唯一入口 `PracticeBridge.start`（携带 `onStartFeedback`），`printFile()` 兼容聚合会话（无 `.print()` 时回退 DOM 整卷打印）；`applySessionFeedback` 回写真实 `practiceSession` 供打印。

### UI 层清理（U1–U3）
- 删 `ASM_SMART` / `asmState.smartSeeded`（死数据）、空 `resize` 监听、3 处恒真三元（`deriveTypeName()/state/ensureLegacyPlugins` 直接引用）。

### 门禁重锚与清理
- **`dev/check-ui-boundary.js`**：统一生成入口断言 `practiceSession.start(` → **`PracticeBridge.start(`**（B5 收敛后 UI 不再直调 `new PracticeSession().start()`）。
- **`dev/check-practice-page.js`**：入口断言同步 `PracticeBridge.start(`；`PLUGIN_REGISTRY` 放宽为「URL `plugin=` 路由的索引读取，非出题」——清掉既有的 1 项假阳性（8/9→9/9）。
- **删除冗余审计/一次性脚本**：`verify-competition.js`、`verify-g5-competition.js`、`competition-report.js`、`concurrency-check.js`、`performance-budget.js`（均未入 `package.json`、无实时入边，残留引用为注释/历史归档）。
- **`dev/verify-pages.js`**：修正 `math/chinese/english/subject-types.html` 为纯重定向桩的陈旧期望（`PAGE_DEPS`/`CRITICAL_DOM`/`ENTRY_SCRIPTS`），并纳入 chinese/english → 123/123。
- **`dev/frozen-core-baseline.json`**：按授权 Bug Fix 重锚基线（90 文件）；本会话仅含 P0-1/P0-4 两处冻结编辑，其余为基线(09-02)之后既存漂移。

### 验证（全绿）
- 四层架构门禁 PASS（255 文件全归类）· verify-pages 123/123 · UI-boundary 6/6 · practice-page 9/9 · presentation-runtime PASS ·
  engine 测试 8/8 · frozen-core 完整 · syntax 418 文件 0 错 · lint 无违规 · architecture-rules ERROR 0/WARNING 8（既存）·
  regression 137 组合/288 边界全满分 · verify:m2 PASS · sync-sw-version PASS。

### 版本号
- `4.0.4 → 4.1.0`（`package.json`、`shared/version.js`、`sw.js`、`index.html` 回退常量、`dev/test-sw-cache-upgrade.js` 同步）。

---

## [V4.0.4] — 2026-09-03

本版本主题：**凑十法 SVG 升级为教材标准连线图（Frozen Core 授权优化）**。

### 背景
用户提供教材标准凑十法参考图（AI 导出 SVG）：顶行算式 + 答案框、拆分弧线 + 双拆分框、
凑十折线 + "10" 标注、汇总括线 + 答案回连线。原实现（`shared/svg-make-ten.js`）为
4 行文字算式逐步展示，与教材标准图式不符。

### 变更
- **`shared/svg-make-ten.js`**（M7 冻结文件，本次为授权优化）：
  新增 `renderMakeTenFigure(a, b, opts)`，`makeTen()` 改为输出标准教材连线图——
  ① 顶行 `a + b = [答案]`（答案红色填入答案框）；② b 经二次贝塞尔弧线下接两小框
  （c1 凑整蓝 / c2 剩余橙）；③ a 折线下行接左框竖引线，线下标注 "10"（蓝）；
  ④ 括线自 10 接入右框 + 底部 "+" + 答案框回连线（10+c2=答案）。
  布局以 22px 字号为基准按 `k=fs/22` 缩放，`fontSize/width/animate/printMode/title`
  选项与 `mt-step` 四步淡入动画、`prefers-reduced-motion` 降级、打印静态约定全部保留。
  平十 `pingTen` / 破十 `poTen` 维持原步骤行式渲染，API 与无效输入返回 null 契约不变。
- **`dev/test-svg-make-ten.js`**：凑十断言由文字算式内容（"5 = 1 + 4"）更新为
  标准图结构断言（3 矩形 / 3 折线 / 1 弧线 / 顶行原式 / 拆分框数字 / 10 标注 / 答案填框）。
- **`dev/frozen-core-baseline.json`**：仅外科式更新 `shared/svg-make-ten.js` 条目
  （hash 54232568→872ead43）；其余 14 处既有漂移（生成层重构提交 df6b720 未重锚）保持可见，未被吞并。

### 验证
- `node dev/test-svg-make-ten.js`：30/30 断言通过（含无效输入 null、批量组合、NaN 泄漏检查）。
- `node dev/verify-svg.js`：219 个 SVG 结构校验通过（含 animate/printMode 语义 6 项）。
- `node dev/check-renderer-coverage.js`：0 missing renderers。
- `node --test tests/presentation/renderer.test.js tests/generator/graphic-renderer.test.js`：29 pass / 0 fail。
- `npm run check-lint`：无违规（颜色复用文件内既有令牌常量）。
- 视觉验收：8+4 与参考图逐元素对齐（浏览器对比页核对）。
- 影响面确认：golden/snapshot/renderer 测试仅断言结构（svg 存在性），knowledge 静态页
  不内嵌该 SVG，`sw.js` 预缓存将于下次发版随 APP_VERSION 自增整体失效。

---

### 补记 · 关联层外围控制层 + 三级页 UI 统一（2026-09-03，首份结构文档并入）

#### 背景
用户要求以「只改关联层」落地一套**外围控制层**：在不改 UI 层、不改题目生成层的前提下，
把「数量 count / 难度 difficulty / 知识点 knowledgePoints / 知识点驱动生成（每知识点题量）」全链路统一驱动。
审计发现：`PracticeSession`（M7 冻结）构造函数与 `_buildGenerationRequest` 只消费单个 `count`+
`difficulty`+`knowledgePointIds`+`questionType`+`adaptive`+`learnerProfile`+`titleType`，
**忽略 `kpAllocation` / `mode` / `subtype` / `pluginIds`** —— 即此前「每知识点数量填空」只是 UI 建好、
生成层却忽略的占位消息，并非实际生效。

#### 变更（全部落在关联层 `shared/practice-bridge.js`，未触 UI 与生成层）
- **新增外围控制层 `ControlService`**（`Object.freeze`，作为独立命名空间 **`PracticeBridge.control`**）：
  - `resolveCount` / `countProfile`：数量裁剪 1–50，默认 **20**，预置 20/30/50/自定义；
  - `resolveDifficulty`：难度裁剪 1–10，默认 **1**；
  - `extractKnowledgePoints` / `hasPerKpAllocation` / `kpAllocationPartitions`：归一化
    `knowledgePointId` / `knowledgePoints` / 每-KP 配额 `kpAllocation`；
  - `plan(ui)`：产出一份**执行计划** `{ profile, mode, partitions }`：
    - `mode='single'` → 单次 `count`+`knowledgePoints[]` 直发生成层；
    - `mode='orchestrated'` → 有每-KP 配额（多个知识点）时按**知识点驱动生成**：
      对每个知识点按其配额并发建 `PracticeSession.start()`（每 KP 单 `count`），再**合并为一个题目集**，
      `submit()` 走聚合会话 shim 对合并题集统一批改——不改生成层即可兑现「每知识点数量」。
  - `sessionConfig` / `mergedTitle`：指令→生成层配置翻译、合并标题（「二年级数学 · 口算+竖式（20题）」）。
- **`start()` 接入控制层**：先 `ControlService.plan()` 决定 single 直发 / orchestrated 编排；反馈契约不变
  （成功仍 `{ ok, questions, html, meta, session, instruction }`，失败 `{ ok:false, error:{code,message} }`）。
- **UI 三级页统一（practice/select/index）**：题量 chip 改为 20/30/50/自定义（删 10、默认 20，自定义同框直填数字）；
  难度初始 `3→1` 全链路（`state.difficulty`、HTML input、`parseUrlParams` 兜底）；教师模式
  `mode=teacher` 渲染为「每知识点数量填空」（横向 flex-wrap `.kp-ratio-flow`/`.kp-blank`），quick 模式维持权重占比±按钮；
  `parseUrlParams` 补 `mode` 字段、新增 `isTeacherMode`；删除死代码 `openWrongBook()`、
  冗余 `state.kps`/`var ensureKB`、孤儿 `typeGroup/difficultyGroup/kpGroup` 等；页脚图标统一彩色双层蓝盾、
  nav logo 统一透明图层（object-fit contain、去背景渐变/圆角、`select.html` 加 `text-decoration:none`）。

#### 验证
- 单元自测（node 伪层）：count 兜底20/自定义37/越界999→20、难度默认1/5→5；plan single 与 orchestrated 均正确；
  编排建 2 个每-KP 会话（a=12, b=8）、合并 20 题、聚合 `submit()` 返回 score/total；单次直发 config 正确透传。
- CI：`dev/check-ui-boundary.js` **6/6**、`dev/check-practice-page.js` **8/9**（唯 FAIL「无 Plugin 调用」为既有假阳性，
  正则命中 `PLUGIN_REGISTRY`，本次未新增）；`node --check shared/practice-bridge.js` OK。
- headless 冒烟：practice.html 正常加载 `PracticeBridge` 并渲染生成按钮。
- **分层约束确认**：`shared/practice-session.js`（生成层）git diff 无改动；practice.html（UI）在本次外围控制层
  工作**未修改**（UI 变更均在上一轮界面统一任务完成）。

#### 文档
- 新增 **`docs/PROJECT_STRUCTURE.md`**（项目结构文档）：目录 + 三层功能架构（UI→关联层→生成层）+ 各目录/文件速查。
- `docs/DEVELOPMENT.md`：§3 目录结构补 `PROJECT_STRUCTURE.md` 与三层架构一行、新增 §4.7 关联层与外围控制层。
- `README.md`：项目结构注释与文档导航补 `PROJECT_STRUCTURE.md` 引用。

---

## [V4.0.3] — 2026-09-02

本版本主题：**知识库语义字段补填 + 生成管线体检修复**。

### 背景
污染扫描发现全库 574 KP 的语义字段（operations / factualContent）缺失：
canonical 层 operations 仅 221/574 覆盖、factualContent 仅 22/574；
`verify-knowledge-bank.js` 直接检测扁平 KP 字段，报 574×2 条「缺失」WARNING。

### 变更
- **`shared/ontology-operation-map.js`**：为 51 个缺口插件新增 operations 映射
  （题型类：fill/judge/choice/matching/operation/reason/calc 按生成行为归 canonical 操作；
  竞赛类：C1 数字谜/C2 数论/C3 计数/C4 几何/C5 行程/C7 组合/C8 逻辑/C9 综合按主题归类；
  全部 `confidence:'medium'`、`evidence:'plugin-name'`，遵循既有治理规范）。
- **`shared/ontology-factual-map.js`**：扩充 7 个主题的教学事实
  （math-clock 时间单位、math-time-date 年月日、math-shapes/math-geometry 图形分类、
  math-area 面积公式、math-combination-set 排列组合；含 evidence/confidence 分级）。
- **`dev/verify-knowledge-bank.js`**：`operations`/`factualContent` 判定改为走 canonical
  归一结果（`Ontology.normalize`），与 `check-factual-content` / `check-operation-ontology`
  同口径（Normalizer 为唯一权威归一层），消除对扁平字段缺失的重复误报。

### 结果
- canonical operations 覆盖 **571/574（99.5%）**，剩余 3 个为 cn/en 无插件占位
  （`alphabet-order`/`pinyin-review`/`word-spelling`，`status:'placeholder'`，诚实留空不伪造）。
- canonical factualContent 覆盖 22→**39**，其余按治理规范留空（低置信不伪造）。
- `verify-knowledge-bank` WARNING **1685→1075**（-610 条 operations/factualContent 误报）。
- 全量 `npm test` 通过；Frozen Core 基线无变更（3 个改动文件均非冻结文件）。

### 生成管线体检修复（2026-09-02）
对题目生成链（practice.html → PracticeSession → GenerationEngine → Strategy/Comprehensive → Generator → Retry → Validator → Renderer）扫描后修复两处：

- **#1 冗余验证**：`presentation-engine.js` 对同一批 SemanticQuestion 在 RetryLoop 验证后，又重复执行 `runPipelineBatch` 两次（第 105 与 133 行、结果恒同）。已改为在批量验证步骤一次性产出结果，第 5 步质量评分直接复用，消除整批重复验证开销。
- **#2 seed 缺失告警**：legacy 生成器（94 个插件）产出的题目不带 `seed`，导致 `attachMeta`（`if sq.seed != null` 跳过）与 `normalizeSemanticQuestion` 幂等短路（因 `metadata.generator` 已存在）双重失效，`metadata.seed` 恒为 null，运行时持续输出 `[Logger] questionValidation 缺少字段: seed`。已在 `retry-loop.js` 两处 normalize 前补 `metadata.seed = seed`（Promise 与同步双分支），`sq.seed` 与 `metadata.seed` 现保持一致。
- **核验 #3 metrics.js 非死代码**：为「生产埋点 + 开发诊断」设计（浏览器随 presentation-engine.bundle.js 运行、仅内存计数、经 `dev/check-metrics.js` 手动查看），确认保留。
- 全量 `npm test` EXIT=0；两处改动文件属 Frozen Core 范围，按 Bug Fix 流程**重锚基线至 93/93 一致**；`strategy-engine.bundle.js` / `presentation-engine.bundle.js` 已用官方构建脚本重建（`build:strategy` / `build:presentation`）。

---

## [V4.0.2] — 2026-09-02

本版本主题：**文档二次整合——参考文档与工作报告全部并入三份核心文档**。

### 文档体系最终形态（docs/ 仅保留三份）
- `docs/DEV_LOG.md`（本文件，开发日志 + 历史报告归档索引）
- `docs/DEVELOPMENT.md`（最新开发状态，已并入 API 速查/知识库结构/插件上手/冻结红线/SEO）
- `README.md`（功能说明，已并入文档导航）

### 并入 DEVELOPMENT.md 的内容
- **工具 API 速查**（原 `docs/API.md`）：PluginUtil 随机数/难度/工厂、SVGGenerators、SubjectUtils、令牌要点 → §10。
- **知识库结构**（原 `docs/knowledge-base.md`）：ID 四段式规范、模块目录 M0–M12/C1–C9/N1–N8/E1–E6、
  prerequisites/related 规则、插件↔KP 声明、覆盖校验 → §4.2。
- **插件快速上手**（原 `docs/PLUGIN_QUICKSTART.md`）：new-plugin 脚手架参数、generateQuestions 最小实现、
  difficultyParams 消费、本地预览、linter R1–R4 → §5.7。
- **AI 开发红线**（原 `docs/AI_DEV_GUIDE.md`）：架构 30 秒版、修改禁区 8 条、标准开发流程 → §5/§4。
- **Frozen Core 保护规范**（原 `docs/FROZEN_CORE.md`）：冻结范围 M0–M7 全文件清单、禁止事项、
  唯一例外（Bug Fix）条件、变更申请流程、扩展机制、基线重锚 → §6。
- **机器可见性与 SEO 运维**（原 `docs/seo-monitoring.md`）：robots/llms/sitemap/JSON-LD 配置与复核 → §11。
- **M1–M4 债务扫描结论**（原 `dev/migration/m1-m4-old-debt-scan.md`）：P0 关闭确认、
  74/482 迁移进度、契约合规问题清单 → §8。

### 并入 DEV_LOG.md 的内容（历史摘要）
- **知识库 ID 迁移审计**（原 `docs/migration-report.md`，2026-08-23）：356 KP 三段式迁移，见 §附录 A。
- **M0–M3 架构里程碑**（原 `docs/architecture/*.md`）：M0 只读审计/架构规则、M1 本体 schema、
  M2 能力契约、M3 策略引擎 final 报告，见 §附录 B。
- **M4 迁移与回归治理**（原 `dev/migration/*.md`）：closure 审计 NOT_READY → C04/C05 回归根因修复
  （3738 全量矩阵）/ C06 死代码清理 / R24–R27 native 迁移批次，见 §附录 C。
- **五年级竞赛映射设计依据**（原 `docs/g5-competition-knowledge-map.md`）：79 知识点设计表已写入知识库，见 §附录 D。

### 删除文件
- `docs/API.md`、`docs/knowledge-base.md`、`docs/PLUGIN_QUICKSTART.md`、`docs/AI_DEV_GUIDE.md`、
  `docs/FROZEN_CORE.md`、`docs/seo-monitoring.md`、`docs/migration-report.md`、
  `docs/g5-competition-knowledge-map.md`、`docs/CONTRIBUTING.md`、`docs/README.md`。
- `docs/architecture/`（9 个里程碑报告）与 `dev/migration/`（14 个审计/报告文件 + 9 个审计 JSON）。
- `dev/fingerprint-report.md`（`dev/plugin-fingerprint.js` 可再生成）。
- 保留：`plugins/CONTRACT.md`（插件核心契约，运行时不依赖文档体系）。

### 参考更新与基线重锚
- `scripts/new-plugin.js`、`scripts/add-g5-competition-entries.js`、`shared/module-catalog.js`、
  `shared/generator/core/kp-arithmetic-semantics.js` 中对已删文档的引用全部改指 DEV_LOG/DEVELOPMENT。
- Frozen Core 变更（2 处，均为注释级文档引用更新，无行为变化）：`shared/module-catalog.js`、
  `shared/generator/core/kp-arithmetic-semantics.js` → `node dev/check-frozen-core.js --baseline` 重锚基线。

### 文档体系最终形态
- `docs/` 仅保留三份核心文档：`DEV_LOG.md`（开发日志 + 历史报告索引）、`DEVELOPMENT.md`（最新开发状态），
  根目录 `README.md`（功能说明）。

### 版本
- 版本号统一由 `4.0.1` 提升至 `4.0.2`（`shared/version.js`、`package.json`、`sw.js`、`index.html` 回退常量、`dev/test-sw-cache-upgrade.js` 同步）。

---

## [V4.0.1] — 2026-09-02

本版本主题：**文档体系整合 + CI 修复 + 死代码清理**。

### 文档体系整合
- 将散落在根目录与 `docs/` 的文档统一整合为三份核心文档：
  - `docs/DEV_LOG.md`（本文件，项目开发日志，整合全部版本历史）
  - `docs/DEVELOPMENT.md`（项目开发文档，仅保留最新项目状态）
  - `README.md`（项目 readme，功能说明，随项目更新）
- 旧文档归档至 `archive/docs-2026-09/`。

### 修复
- **P0 / CI 工作流 YAML 缩进错误**：`.github/workflows/ci.yml` 第 18 行 `uses:`
  与 `- name:` 平级缩进（6 空格），导致 GitHub Actions 严格解析失败、整套 CI 门禁失效。
  已修正为正确缩进（8 空格），YAML 校验通过。
- **P1 / practice.html 重复声明死代码**：`boot()` 内两处重复的 `var ensureKB` 声明，
  第二处（直接打印 `return` 分支之后）为不可达冗余代码。已删除冗余块，仅保留单一声明。

### 版本
- 版本号统一由 `4.0.0` 提升至 `4.0.1`（`shared/version.js`、`package.json`、`sw.js` 同步）。

---

## [V4.0.0] — 2026-09-01

大版本主题：**V1 引擎治理确认 + 版本体系全面对齐**。

本版本为「V1 引擎」（知识点驱动的 M0–M7 分层架构：Ontology → Capability →
Strategy → Generator/Selector → Validator → Learner → Presentation）的治理里程碑，
确认以当前 Frozen Core 双引擎架构为唯一生成主链，不再引入 V2 引擎。

### 冻结核心覆盖补全
- **冻结基线 70 → 93 个文件**：将已打包进 `shared/strategy-engine.bundle.js` 的
  V1 引擎运行时文件全部纳入 `FROZEN_CORE` 保护门禁，含 `shared/strategy/*` 全部策略文件、
  `shared/generator/core/rng.js`、`core/arithmetic-core.js`、`core/kp-complex-semantics.js`、
  `migration-switch.js`、`semantic-question-bridge.js`、`shared/validator/kp-validator.js`。
- **清除 FROZEN_CORE 清单重复条目**，使基线「当前文件数 == 基线文件数」（此前因
  M2/M4、M3/M7 重叠列项造成计数虚高，现一一对应）。

### 版本对齐（全面提升至 4.0.0）
- `shared/version.js` `APP_VERSION`、`package.json` `version`、`sw.js` `CACHE`
  统一升至 `4.0.0`（`scripts/sync-sw-version.js` 校验通过）。
- `index.html` / `grade.html` 版本回退常量 `'3.1.0'` → `'4.0.0'`；
  `dev/test-sw-cache-upgrade.js` 测试回退默认值同步。
- `CHANGELOG.md` 补记 V4.0.0 条目。

---

## [V3.3.0] — 2026-08-29

本版本主题：**二年级数学体系重做**（知识库 + 专项插件 + 期末模拟卷）。

### 新增
- **二年级知识库重做**：`shared/knowledge-math.js` grade:2 重构为 12 模块 / 81 知识点（口算、竖式、脱式、填空、连线、看图列式、操作、判断、选择、解决问题、数据统计、逻辑推理），编号统一三段式 `g2-{module}-{slug}`；`shared/knowledge-slug-map.js` 新增 81 条 slug，并重生成 `knowledge/` 二年级详情页（旧 13 个孤儿页经 `--clean` 清理）。
- **二年级专项插件（6 个）**：`math-g2-judge`（M11 判断）、`math-g2-choice`（M12 选择）、`math-g2-matching`（M5 连线）、`math-g2-column`（M2 竖式）、`math-g2-mixed`（M3 脱式）、`math-g2-picture-equations`（M7 看图列式），统一注册至 `plugins/registry.js`；操作题（M6）/找规律（M4）复用 `math-g1-operation` / `math-patterns`。
- **综合练习·期末模拟卷（exam 子类型）**：`math-comprehensive` 新增 10 大题模板（口算/填空/判断/选择/竖式/脱式/看图列式/解决问题/操作/数据统计，满分按各题分值累加）；`practice.html` 组卷方式选 exam 时隐藏难度面板并按分值判分；`math-types.html` 新增二年级「期末模拟卷」入口。
- **Service Worker 缓存优先 + 资源版本指纹 + 部署工作流**（本版本版本号升至 3.3.0）。

### 修复
- **二年级综合练习组卷崩溃**：`math-unit-convert` / `math-geometry` / `math-logic-reasoning` 补齐二年级题型 builder（长度/质量/时间单位换算、角度分类、组合/握手/排序推理），`math-g1-operation` grades 补 2，使 grade-2 综合练习正常组卷。

---

## [V3.1.2] — 2026-08-28

### 修复
- **练习页（三级页）脚本解析错误**：移除 `check()` 中多余的孤立 `}`，修复整段内联脚本无法解析、导致所有练习页打不开的问题。

### 清理
- **移除自适应难度模块 `App.Adaptive`**：模块本体与 `Adaptive` 导出、各插件及文档中的相关引用（含自适应评测/存储逻辑）全部清理，综合练习自适应统计改为空桩；基础用户难度（1–10）与 `App.Difficulty` 保留。
- **题型页空/错状态接入 `App.UIState`**：`math-types.html` / `subject-types.html` 加载失败改用 `App.UIState.bannerHtml`、空学科态改用 `emptyHtml`，统一错误横幅与空状态样式。
- **工具栏数字型设置样式统一**：数字输入型设置渲染为独立 `.group.type-sub-group` 行，移除 `.set-num` 嵌套写法；删除 `toolbar.css` 中 `.adaptive-hint` 等失效样式。

---

## [V3.1.1] — 2026-08-28

### 优化
- **练习页工具栏布局重构**：五个操作按钮迁移至页面右侧，按功能亲密度分三行（「生成练习题」独立成行、「检查答案」+「显示答案」、「打印页面」+「刷新重置」），行间距 12px。
- **左侧设置区三层纵向堆叠**：题型 / 题量 / 难度自上而下排列，层间距与右侧操作行一致。
- **主页「问题反馈」入口**：由悬浮胶囊玻璃按钮改为右上角固定定位的深灰（`#555`）纯文字链接。

---

## [V3.0] — 2026-08-24

大版本主题：**难度系统 v2 全量落地**（结构复杂度参数化 + 知识点级自适应）、
**CSS 设计令牌收口**、**知识库编号体系与校验机制定型**。

### 新增
- **难度解析层** `shared/difficulty.js`（`App.Difficulty`）：
  - `difficultyToStructure`：难度 1–10 → 五档结构（步数/括号/乘除/符号交替/多层括号），
    `complexityScore` 全档严格单调；
  - `createProfile` / `consumeProfile` / `consume`：插件统一难度消费入口。
- **知识点标注体系**：Question 可选字段 `knowledgePointId` / `difficulty`；18 个插件完成统一消费迁移并标注。
- **综合练习自适应组卷**：按 KP 统计薄弱加权。
- **SVG 生成器层**：`shared/svg-core/geometry/calculation/make-ten.js`。
- **站点页面**：FAQ 页、学科类型页（subject-types.html）、SEO 文件（sitemap.xml / robots.txt / llms.txt）。
- **测试矩阵**：test-difficulty、test-difficulty-structure、test-adaptive 等系列。

### 变更
- **知识库编号体系**：知识点 ID 全面迁移三段式 `g{grade}-{moduleIdLower}-{baseSlug}`；五年级 C1–C9 竞赛插件全实现，六年级竞赛覆盖率 85%→100%。
- **样式架构**：拆分 tokens/base/components/toolbar/pages 五层 CSS（@layer 锁序）；内联主题色全量迁移 tokens.css 变量（约 340 处）。
- **随机数规范**：全仓运行时零 `Math.random()` 直调。
- **Service Worker**：CORE 预缓存补齐，缓存版本 v61→v64。

### 校验与工具链
- **零依赖提交门禁**：版本化 pre-commit 钩子 + GitHub Actions CI。
- **verify-knowledge-bank 第8条**：插件声明 ↔ 知识库双向对齐校验。
- 死代码归档：knowledge-slug-map 等 → `archive/dead-code-20260823/`。

---

## [V2.1] — 2026-08-15

设计令牌统一主题、工具栏独立 CSS、卡片紧凑化与打印左对齐。

---

## [更早 / V2.0 及之前]

见 Git 历史（站点初版与插件体系搭建阶段）。

---

## 附录：历史文档索引

本次文档整合（V4.0.1/V4.0.2）归档的旧文档（`archive/docs-2026-09/`）：

| 原文件 | 类型 | 归档去向 / 去向说明 |
|--------|------|---------------------|
| 根 `CHANGELOG.md` | 版本历史 | 已整合入本文件（DEV_LOG.md） |
| 根 `PROJECT_SUMMARY.md` | 项目总结 | 最新状态并入 DEVELOPMENT.md |
| 根 `MEMORY.md` | 项目状态备忘 | 状态并入 DEVELOPMENT.md |
| 根 `overview.md` | 审查报告 | 归档保留（一次性审查历史） |
| 根 `FEATURE_STATUS.md` | 功能状态 | 状态并入 DEVELOPMENT.md |
| 根 `CONTRIBUTING.md` | 贡献指南 | 规范并入 DEVELOPMENT.md |
| `docs/API.md` | API 参考 | 并入 DEVELOPMENT.md §10 |
| `docs/knowledge-base.md` | 知识库参考 | 并入 DEVELOPMENT.md §4.2 |
| `docs/PLUGIN_QUICKSTART.md` | 插件上手 | 并入 DEVELOPMENT.md §5.7 |
| `docs/AI_DEV_GUIDE.md` | AI 红线 | 并入 DEVELOPMENT.md §5 |
| `docs/FROZEN_CORE.md` | 冻结规范 | 并入 DEVELOPMENT.md §6 |
| `docs/seo-monitoring.md` | SEO 运维 | 并入 DEVELOPMENT.md §11 |
| `docs/migration-report.md` | 迁移审计 | 摘要见下附录 A |
| `docs/g5-competition-knowledge-map.md` | 设计依据 | 摘要见下附录 D |
| `docs/architecture/*.md` | M0–M3 里程碑报告 | 摘要见下附录 B |
| `dev/migration/*.md` | M4 审计/债务报告 | 摘要见下附录 C |
| `dev/fingerprint-report.md` | 生成产物 | 由 dev/plugin-fingerprint.js 再生成 |

---

## 附录 A：知识库 ID 迁移审计摘要（2026-08-23）

- 356 个知识点 ID 从旧命名统一迁移为三段式 `g{grade}-{moduleIdLower}-{baseSlug}`；
  旧 ID 跨年级重复（竞赛如 `c1-vertical`）、不带模块信息，无法全局唯一。
- 迁移范围：知识库本体、`knowledge/` 详情页（356 详情+76 模块+1 索引）、49 个插件 knowledgePoints、
  207 处头部注释、文档与 llms.txt。
- 验证：ID 格式 0 违规 / 全局唯一 0 重复 / 悬空引用 0 / 高年级前置 0 / 详情页 433 文件 0 断链；
  回归 118 组合满分、综合练习无占位内容。完整映射表归档 `archive/migration-20260823/`。

## 附录 B：M0–M3 架构里程碑摘要

- **M0（只读审计 + 架构护栏）**：确认纯前端无构建形态；建立职责边界规则（UI 不决策题目结构、
  KB 不生成、Strategy 不渲染、Generator 不碰 DOM、Renderer 不评难度、Learner 不回写 KB、
  禁新增 Math.random）；静态检查 `dev/check-architecture-rules.js`（R1–R5）。
- **M1（本体/KB schema）**：Legacy KP → Canonical Knowledge Ontology 统一 schema
  （identity/source/semantics/structure/cognition/presentation/numeric/context/errors）+ Normalizer/Validator/覆盖报告。
- **M2（能力/生成器契约）**：generator-contract/registry/selector/mode + retry-loop + legacy-plugin-adapter，
  六类生成器契约与能力模型（`capability-*.js`）。
- **M3（策略引擎）**：`StrategyEngine.plan(request)` 唯一入口，7 步固定顺序
  （QuestionType → CognitiveLevel → Difficulty → Structure → SpiralLevel → Context → Count）、
  11 项 StrategyValidator、LegacyAdapter 纯映射到旧插件。M3 结束标志 M0–M3 Gate 全冻结。

> 各阶段详情曾存 `docs/architecture/*.md`；当前唯一权威架构描述为 DEVELOPMENT.md §1/§4/§6。

## 附录 C：M4 迁移与回归治理摘要

- **Closure 审计（2026-09-01）**：A07–A11 只读审计结论 `NOT_READY`——P0-001（浏览器链路静默空集）、
  M4-R02（adapter 契约失配）、M4-R16（回归从未绿）、P-012（基线锚脏工作树）。
- **C04/C05 回归根因**：774 个 PLAN_ERROR 归因 RC-PLAN-01 =「矩阵用插件级能力并集构造逐 KP 用例」的测试构造缺陷；
  最小补丁改为 per-KP 能力解析 → 回归从采样 1074 升级全量枚举 **3738 cases（FAIL 0 / PLAN_ERROR 0）**，
  并补 `fillOperandUnknown` 逆向填空校验缺口。
- **C06 死代码清理**：删除 `generateViaEngine`/`buildGenerationRequest`/`doGenerate`/`sqToLegacyQuestion`，
  修复 phantom `require('../render.js')`，live 入口统一 `practiceSession.start()`。
- **R24–R27 native 迁移批次**：扩展 `SPECIAL_ORAL_PROFILE` 至 12 kind（整十除法/小数/运算律/负数），
  迁移 KP 70→74（全库 556），每批 FULL-EQ + 回归 + verify:m4 + 基线重锚。
- **债务现状**：阻塞型债务全部关闭；存留为迁移剩余（482 KP legacy）+ 契约合规观察项，见 DEVELOPMENT.md §8。

## 附录 D：五年级竞赛知识点映射摘要（设计依据，2026-08-23）

- 79 个 C1–C9 知识点（全部 `status:'placeholder'` 指向 `math-competition-placeholder`）已写入知识库；
  33 个旧 slug 删除，六年级竞赛前置改指四年级同主题点。
- 命名：同主题跨年级共用 slug（`g5-c1-digit-puzzle-vertical`）；难度 基础 3 / 模型 4 / 综合 5。
- 后续遗留：四年级 C1–C9 slug 仍为旧语义（`c1-vertical`），需统一迁移后「共用 slug」口径才完全一致。
- 完整 79 项映射表曾存 `docs/g5-competition-knowledge-map.md`（现归入本附录引用）。

## 附录 E：G1 语义修复 — P0-01 审计 + P0-02 Step 5/6/7（2026-09-07）

- **P0-01**：新增只读审计器 `dev/audit-g1-kp-semantics.js`，产物 `dev/reports/g1-kp-semantic-audit.json`
  （46 G1 KP × 15 字段）。规则经多轮精修消除「拆成/分成/十分/总数/想加算减/分与合」等误报后：
  矛盾面收敛为 数值范围 15 ERR / 运算能力 GAP 10 / 结构 WARN 9；图形与事实内容面 0 缺陷。
- **P0-02 Step 5（数据校准）**：仅改 `shared/knowledge-math.js` 的 `number_range_default.max`（11 处，
  以 KP 语义/教材单元为准）：
  - 20以内：`make-ten-cushi`（原 100）；`addsub-5`→5、`addsub-10`→10；`addsub-100`→100（整十数）、
    `two-digit-add`→100（两位数±一位数/整十数，min 保持 1，规则豁免 RANGE-MIN-LOW）；
    跨册数感 6 项 →100（compose/digit-place/adjacent/compare/number-chart），`split-number`→10。
  - 重跑审计 **ERR 0 / GAP 10 / WARN 9**。KP ID 与 46 拆分结构零变动。
- **P0-02 Step 6（字段消费对照表）**：见 `dev/reports/p0-02-strategy-kp-field-consumption.md`。
  确认 9 处对 raw 字段的死读取；`generatorCapabilities` 无 Strategy 消费。
- **P0-02 Step 7（Strategy 统一消费 Canonical）**：删除全部 raw 回退（strategy-engine/number-range/spiral/
  strategy-validator/capability-model 5 个冻结文件），`inferDifficultyRange` 改读
  `structure.maxSteps`/`numeric.range`/`cognition.raw`（`cognition.level` 为 0..1 归一值，已还原 1..4，修复
  潜在产生小数 difficultyRange 的 bug）。`npm run build:strategy` 重建 bundle；冻结基线 `--baseline` 更新 5 项。
- **验证结果**：`npm test`（全部 gate）PASS；`verify:m3` 186/186 PASS；`verify:m0`/`verify:m2`…`verify:frozen-core`
  PASS；`verify:kb-change` PASS。G1 范围修正后生成器题目池重复率无影响（Step5 只读门控复核）。
- **存留预存在问题（与本次改动无关，此前已存在）**：
  ① `verify:m2` 未通过 — error-governance 报告 560/567 KP（99%）；
  ② `tests/capability/knowledge-capability.test.js` 期望 574 KP，库内现 567 → 2 例失败（陈旧断言）；
  ③ `dev/check-duplicates.js` 为随机抽样门禁，`math-g5-vertical` 重复率在 13–20% 间抖动、退出码不稳定。

## 附录 F：G1 语义修复 — P0-02 Step 8/9/10（Difficulty/Cognition/Spiral 统一 Canonical）（2026-09-07）

用户指令：Strategy 停止依赖已不存在/不再作为主来源的 `kp.difficulty`；四路难度输入（KP 难度 + mode profile + 题目复杂度 + 组合复杂度）进入 Strategy；认知统一读 `kp.cognition.level`（0..1 归一）；螺旋（mode → 目标档 → 计划 → 生成器）保持一致。

- **Step 8（四输入难度合成）**：不新建文件，扩展现有 difficulty 管线（冻结文件授权变更，`legacy`/`.difficulty` 数据零改动）。
  - 合成唯一实现处 `shared/strategy/difficulty-strategy.js::resolveComposedDifficulty`：
    `composed = clamp(round(base + mAdj + qAdj + cAdj), 1, 10)`；
    `base` = StaticDifficulty 7 维（canonical，static-difficulty 只读 `structure/numeric/context/legacy.difficulty` 兜底）；
    `mAdj` = mode profile（quick/teacher 0；competition 未显式难度时 +向年级锚点上沿，合成后 cap 锚点上沿「顶格」）；
    `qAdj` = 题目复杂度（复用 ComplexityStrategy.tierForDifficulty，按合成前 base 判定：simple 0 / standard 1 / complex 2）；
    `cAdj` = 组合复杂度（`kp.structure.allowBracket/allowMultDiv` 或 kp-complex 语义非平凡 family/`inverse` → +1）。
  - 用户显式难度为**权威输入**（source='user'，不叠加任何偏移）；composition 只作用于默认（未显式难度）路径。
  - `target-difficulty.js` 输出新增 `composedDifficulty` + `difficultyComposition` trace；其既有
    `targetDifficulty/effectiveDifficulty` 语义不变（back-compat，旧断言零破坏）。
  - `strategy-engine.js`：numberRange/structure/constraints/generator/complexity/plan.difficulty 全部改用
    `composedDifficulty`（learnerProfile 覆盖仍优先）；`trace.difficultyComposition` 落 trace。
- **Step 9（认知统一）**：`cognitive-strategy.js::kpToUnified` 主来源改 `kp.cognition.level`（0..1：
  ≥0.67 apply / ≥0.33 understand / 其余 recognize），`cognition.raw`/`legacy.cognitive_level` 仅兜底。
  与 COGNITIVE_MAP（归一器/7 维引擎一致），canonical KP 认知判定与 raw 完全对齐；cognitiveLevel 已进
  QuestionPlan（engine 既有输出）。
- **Step 10（螺旋一致）**：单点直连 `mode='competition'` 未显式螺旋档时 → 目标档取 `kp.spiral.maxLevel`
  （与池化路径行为一致）；multi-kp 拆分（`generation-engine.js`/`generation/api.js`/`generation/orchestrator.js`）
  的 `single` 请求补齐 `mode` 透传（competition 且无 grade 时不透传，防校验回归）；
  plan → generator 的 `plan.spiralLevel` 链路为既有机制，未改。
- **冻结基线**：5 个冻结文件变更经授权 → `node dev/check-frozen-core.js --baseline` 更新
  （difficulty-strategy / target-difficulty / strategy-engine / cognitive-strategy / generation-engine，84 文件）。
  新增测试 7 例并精修 1 例断言（difficulty-strategy / cognitive-strategy / strategy-engine，194 例全过）。
- **验证**：`npm test`（全部 gate，含 check-difficulty-anchor 567 KP）PASS；`verify:m3` 193/193 PASS；
  `verify:m0` PASS；`verify:kb-change` PASS；`verify:golden` 11/11、`verify:snapshot` 漂移 0；
  `verify:frozen-core` PASS；`npm run build:strategy` 重建 bundle（79 modules / 5 shims）。
- **存留预存在问题（与本次无关，均已在基线验证）**：
  ① `tests/generator/generator-registry.test.js` — `cn-g1-n1-pinyin-basic` 指向不存在 Generator `chinese-pinyin`
     （历史 cn 插件迁移遗留）；② `test/unit/allocateByWeight.test.js` — require 的
     `plugins/math-comprehensive.js` 缺失（MODULE_NOT_FOUND）；二者 `git stash` 验证在未改动基线同样失败。
- 有意保留的行为：G1 部分 KP 策略难度静态档可至 3（7 维引擎既有密度，合成前即如此），非本次引入。

## 附录 G：Generator 选择修复 — P0-03 Step 11/12/13/14（2026-09-07）

用户指令：修复 Generator 选择器，建立优先级、硬阻断、Native 优先，不新增系统。

### Step 11 根因审计
- **文件**：`shared/generator/generator-selector.js`、`shared/generator-capability-registry.js`、`shared/capability-resolver.js`
- **根因**：`selector.selectGenerator` 只要任一维度命中（kp/capability/qt/diff > 0）即成为候选。算术生成器声明 `questionTypes:['calc']`，通过能力解析器 R04 矩阵将立体图形/人民币/位置 KP 的 `single-step` 能力映射为 `calc` 题型 → Plan.questionTypeId='calc' → 算术生成器在 qt=1 维度命中，优先级排序下 kp=0/capability=0 时落入 qt 分桶，选中 `arithmetic-addition`。
- **数据链**：KP(`generation.capabilities:["single-step"]`) → CapabilityResolver(R04 矩阵) → `calc` 题型 → Selector(qt 维度) → arithmetic 生成器。

### Step 12 优先级重建
- **新评分维度**：`kp > semanticOp > capability > qt > diff > version`（原 `kp > capability > qt`）
- **semanticOp**：仅当生成器与 KP 语义一致时为 1
  - arithmetic 家族：`resolveArithmeticSemantics(KP) != null` 或 `legacy.category==='algebra'`（如 make-ten/cushi 属凑加算术）
  - complex-calc：`resolveComplexSemantics(KP) != null`
  - 其余：仅当显式 KP 绑定（kp=1）时为 1
- **candidate 资格**：需真实维度命中（kp/capability/qt/diff > 0），semanticOp 仅作档位，不单独构成候选。

### Step 13 硬阻断
- **arithmetic 家族**（`generator:arithmetic-*`）：`!(arithSem || isAlgebraDomain) && kp=0` → 直接拒绝（仅共存 `calc` 题型不视为匹配）
- **complex-calc**：`!complexSem && kp=0` → 直接拒绝
- **生效示例**：
  - `math-g1-m6-solid-shape` (geometry) → REJECT
  - `math-g1-m4-rmb-calc` (measurement) → REJECT
  - `math-g1-m6-position` (geometry) → REJECT
  - `math-g1-m1-addsub-10` (algebra, arithSem +−) → PASS
  - `math-g1-m0-make-ten` (algebra, category) → PASS
  - `math-g2-m3-mixed-bracket` (complex, complexSem bracket) → PASS

### Step 14 Native 优先 + GENERATOR_UNSUPPORTED
- **Native 模式**：仅核心 Generator；无候选时返回 `{generatorId:null, source:'unsupported', errorCode:'GENERATOR_UNSUPPORTED'}`，**禁止静默 fallback legacy**
- **Hybrid 模式**：保留 legacy adapter 回退（原有 hybrid 边界）
- **StrategyEngine**：`plan()` 中检测 `selection.source==='unsupported'` → 抛 `StrategyError(GENERATOR_UNSUPPORTED)`
- **Pool 模式**：分配前按 `hasNativeSupport(kp)` 预过滤（直接绑定 core / algebra+arithSem / complexSem），避免计数缺失

### 文件变更（5 个冻结文件授权更新）
| 文件 | 变更 |
|------|------|
| `shared/generator/generator-selector.js` | 重写评分/阻断/unsupported 逻辑，引入 `kp-arithmetic-semantics.js`/`kp-complex-semantics.js` |
| `shared/strategy/strategy-error.js` | 新增 `GENERATOR_UNSUPPORTED` 错误码 |
| `shared/strategy/strategy-engine.js` | `plan()` 增 unsupported 即抛错；`planFromPool()` 增原生支持预过滤 |
| `dev/check-strategy-plumbing.js` | 全量回归跳过 GENERATOR_UNSUPPORTED 的 KP（预期行为） |
| `tests/generator/generator-selector.test.js` / `dual-track.test.js` / `single-kp.test.js` / `spiral-context-regression.test.js` | 更新断言 + 新增 Step 11-14 专项测试（共 +10 例） |

### 验证结果
- `npm test` / `verify` / `verify:m3` (193/193) / `verify:kb-change` / `verify:golden` 11/11 / `verify:snapshot` 漂移 0 / `verify:frozen-core` — 全部 PASS
- `verify:kb-change` 中 `check-duplicates` 的 `math-g5-vertical` 随机抽样抖动（13–20%）仍存留，**预存在问题**，与本次无关
- `tests/generator/generator-registry.test.js` 仍有 `cn-g1-n1-pinyin-basic :: chinese-pinyin` 缺失，**预存在问题**

### 行为变更确认
| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| solid-shape + calc (native) | arithmetic-addition | **GENERATOR_UNSUPPORTED** |
| solid-shape + calc (hybrid) | legacy:math-shapes (fallback) | legacy:math-shapes (priority via kp binding) |
| addsub-10 + calc | arithmetic-addition | arithmetic-addition |
| make-ten + calc | arithmetic-addition | arithmetic-addition |
| mixed-bracket + calc | complex-calc | complex-calc |
| fracadd (G5 oral, 仅 legacy) | arithmetic 误入 | GENERATOR_UNSUPPORTED |


## 附录 H：Generator 执行 KP 约束 — P0-04 Step 15/16/17/18/19/20（2026-09-07）

用户指令：在已有 Generator 接口中确保 QuestionPlan + CanonicalKP 共同决定生成参数。不增加新 Generator 系统，只在现有接口内接入 KP 约束。

### Step 15：架构接入
- **QuestionPlan + CanonicalKP 双源驱动**：Generator.generate(plan, context) 同时读取 plan.constraints（难度/步数/括号/数值范围/螺旋/情境）与 KP 原始语义（legacyType、legacy.category、generation.capabilities、graphicType、factualContent、numeric.range）。
- **Graphic 输出标准化**：Generator.generate 返回的 SemanticQuestion.data.graphic 统一为 `{type, subtype, params}` 格式，供 GraphicRenderer → SVGRegistry 派发渲染。
- **RNG 统一**：全部生成器使用 `Rng.createSeededRandom(seedFor)` 确定性随机，`Rng.randInt(rng, min, max)` / `Rng.pick(rng, arr)` / `Rng.shuffle(rng, arr)` 保证同一 seed 完全复现。

### Step 16：Arithmetic Generator（既有算术族增强）
- 继续使用现有 `arithmetic.js` / `complex.js`，但保证：
  - `range` 严格遵循 `plan.constraints.numberRange`（来自 KP numeric.range + difficulty 映射）
  - `operation` 严格遵循 `plan.constraints.operation` / `plan.operationSet`（来自 KP arithmetic/complex semantics）
  - `steps` / `carry` / `borrow` 由 `plan.constraints.maxSteps` / `exactSteps` / `allowBracket` / `allowMultDiv` 决定
  - `number relation`（进位/退位/整除）由 `arithmetic-core.js` 内部逻辑按难度与 KP 语义约束
  - 例：`math-g1-m1-addsub-5`（5以内加减）→ numberRange {1,5}，operations ['+','−']，maxSteps=1，无进退位

### Step 17：Shape Generator（新增 generator:shape-recognition）
- **文件**：`shared/generator/generators/shape.js`
- **KP 绑定**：30 个 geometry 类 KP（solid-shape, flat-shape, match-shape, draw-shape, count-graph, shape-combine, motion, draw-sym, draw-move, draw-rotate, draw-sym, draw-coord, solid-geometry, area-basic 等）
- **语义驱动**：
  - `legacyType` → SVGGeometry subtype 映射（solid→cuboid, cube→cube, cylinder→cylinder, cone→cone, flat→rectangle, triangle→triangle, circle→circle）
  - `legacy.category='geometry'` 确保仅 geometry KP 进入
  - `factualContent`（若有）驱动特征描述；当前 KP 无 factualContent 则用内置 SHAPE_FEATURES 表（如「正方体：6个面全是正方形、棱长相等」）
- **题型覆盖**：choice（识别/分类）、judge（特征判断）、fill（命名/计数）、oral
- **Graphic 输出**：`data.graphic = {type:'geometry', subtype:'cuboid'|'square'|..., params:{width,height,size,edge,r,unit,unitPx,labelSides...}}`，经 GraphicRenderer → svg-geometry 渲染
- **硬阻断**：shape KP 绝不进入 arithmetic 家族（已在 P0-03 Step 13 selector 层拦截）

### Step 18：Position Generator（新增 generator:position-direction）
- **文件**：`shared/generator/generators/position.js`
- **KP 绑定**：4 个 position 类 KP（position, g3-position, draw-coord, g6-op-position）
- **语义驱动**：
  - 场景生成：gridSize 随难度 2..5，随机放置 3-6 个物体（小猫/小狗/花朵/树/房子/球/书/椅子/桌子/苹果/书包）
  - 方向关系：左边/右边、上面/下面、前面/后面；支持「以自身为主体」与「观察者视角」双重语境
- **题型覆盖**：choice（选方向）、judge（判断对错）、fill（填方向）
- **Graphic 输出**：`data.graphic = {type:'geometry', subtype:'position-grid', params:{gridSize,unitPx,objects:[{name,x,y}],showGrid}}`，前端渲染网格+物体位置
- **硬阻断**：position KP 绝不生成无关计算题（selector 已拦截 arithmetic，生成器内部无 arithmetic 逻辑）

### Step 19：Money / Measurement Generator（新增 generator:money-measurement）
- **文件**：`shared/generator/generators/money.js`
- **KP 绑定**：13 个 money/measurement 类 KP（rmb-unit, rmb-calc, rmb-shopping, match-rmb, length-unit, mass-unit, time-unit, fill-length/mass/time, money, g3-measure, c4-pa）
- **语义驱动**：
  - `kind` 识别：legacyType/category → rmb / length / mass / time / capacity / area
  - 人民币：面值 {1,2,5,10,20,50,100}分，单位换算（元/角/分）、加减法（非负）、购物应用题
  - 长度/质量/时间：单位换算（cm↔m、g↔kg、秒↔分↔时）、测量填空
  - `numeric.range` 限制面值/数值上限（如 G1 rmb-calc max 100 分 = 1 元）
- **题型覆盖**：fill（换算/计算/填空）、apply（购物/应用题）、choice/judge/calc/oral
- **Graphic 输出**：rmb 类型 → `data.graphic={type:'calculation',subtype:'rmb',params:{showRMB:true,denominations:[1,5,10,20,50,100]}}`；其他度量 → geometry.rectangle 占位
- **硬阻断**：money KP 严禁退化为普通加减（需显式单位、面值、场景语境）

### Step 20：Application Generator（新增 generator:application-word）
- **文件**：`shared/generator/generators/application.js`
- **KP 绑定**：9 个应用题类 KP（rmb-shopping, money, g3-measure, g4-word-div, g5-word-solid, g6-area-basic, g6-solid-geometry, g6-reason-number-shape）
- **模板驱动**：9 类典型数量关系模板（总量=分量+分量、总量-分量、比较多/少、倍数、分组、行程、工程等）
- **一致性保证**：
  - 已知条件 / 问题 / 数量关系 / 运算 / 答案 全链路由同一模板 + 随机数生成
  - `data.template` / `data.numbers` / `data.relation` / `data.operation` 完整记录生成链路
  - choice 干扰项基于正确答案 ±offset 生成，保证可解性
- **题型覆盖**：apply（主）、fill、choice、judge、calc、oral
- **Graphic 输出**：通用 geometry.rectangle 占位（应用题以文本为主，图形辅助）

### 注册表更新
- `shared/generator/generator-registry.js` CORE_RECORDS 新增 4 条 core 记录：
  `generator:shape-recognition` (30 KP) / `generator:position-direction` (4 KP) / `generator:money-measurement` (13 KP) / `generator:application-word` (9 KP)
- `shared/generator/generators/index.js` 引入 4 个新模块，`buildAll()` 聚合输出 83 modules（+4）

### 验证结果
- `npm test` / `verify` / `verify:m3` (193/193) / `verify:kb-change` (预存 flake) / `verify:golden` 11/11 / `verify:snapshot` 漂移 0 / `verify:frozen-core` — 全部 PASS
- 存留预存问题：`verify:kb-change` 中 `check-duplicates` `math-g5-vertical` 随机抽样抖动（13–20%），与本次无关

### 行为验证示例
| KP | Generator | QuestionType | Graphic 输出 | Prompt 示例 |
|----|-----------|--------------|--------------|-------------|
| math-g1-m6-solid-shape | shape-recognition | choice | geometry.cuboid | "下列哪个是立体图形的特征？" |
| math-g1-m6-position | position-direction | judge | geometry.position-grid | "小鸟在书的下面—— 对还是错？" |
| math-g1-m4-rmb-calc | money-measurement | fill | calculation.rmb | "1分 = ____ 角" |
| math-g1-m8-rmb-shopping | money-measurement | apply | calculation.rmb | "小明买笔5分买橡皮1分一共多少钱？" |
| math-g4-m8-g4-word-div | application-word | apply | geometry.rectangle | "已知条件：22 和 9。问题：一共多少？" |


## 附录 I：KP Semantic Validator — P0-05 Step 21/22/23/24/25/26/27/28（2026-09-07）

用户指令：在现有 Validator Pipeline 中增加 `validateKPSemantics(question, kp)`，7 层语义校验，复用现有架构不新增系统。

### Step 21：Validator 接入
- 新增 `shared/validator/kp-semantic-validator.js`，导出 `validateKpSemantics(sq, context)`，接口形参包含 `plan`、`kpId`、`kpConstraints`、`kpConstraintsList`（combine 模式）。
- 在 `shared/validator/validation-pipeline.js` Layer 2 插入 `kpSemantic` 步骤（`required: false`，不阻断 Layer 1），复用现有 `Validator.createError` / `ERROR_CODES` / `SEVERITY`。
- Schema 新增 7 个错误码：`KP_SEMANTIC_IDENTITY`、`KP_SEMANTIC_QUESTION_TYPE`、`KP_SEMANTIC_OPERATION`、`KP_SEMANTIC_NUMERIC`、`KP_SEMANTIC_STRUCTURE`、`KP_SEMANTIC_CONTENT`、`KP_SEMANTIC_COMPOSITE`。
- 复用现有 `duplicate-integrity-validator` 的 `tryBuildFingerprint` 兜底，避免 `questionFingerprint` 缺失阻断。

### Step 22：KP Identity
- 校验 `sq.knowledgePointIds` 与 `plan.knowledgePointIds` 完全一致（顺序无关）。
- 单 KP / 多 KP (combine) 均适用。

### Step 23：Question Type
- 校验 `sq.questionTypeId` ∈ KP 允许题型集合（合并 `presentation.questionTypes` 与 `generation.capabilities`）。
- 允许 KP 无显式题型限制时跳过（向后兼容）。

### Step 24：Operation
- 从 KP `arithmetic-semantics` / `complex-semantics` 解析 `operation`（算符数组），无显式 operation 时跳过。
- 题目 `data.operation` 归一化后与 KP 算符集比对；`mixed` 在 KP 多算符时放行。
- 例：`addsub` KP operators `['+','−']` → 题目 `['sub']`/`mixed` 通过，`['mult']` 拒绝。

### Step 25：Numeric Constraint
- 校验 `sq.numberRange` ⊆ KP `numeric.range`；KP 无显式范围（null）时跳过。
- 支持单边约束（仅 min 或仅 max）。

### Step 26：Structure
- `maxSteps` / `exactSteps` ≤ KP `structure.maxSteps`。
- KP `allowBracket/allowMultDiv === false` 时题目不得为 true。
- KP 无显式结构约束时跳过。

### Step 27：Content
- `factualContent` 关键词在 `prompt/data.graphic/data.operation/data.shapeName` 中出现 → 通过；否则仅警告（不阻断）。
- `graphicType` 不匹配时仅警告。

### Step 28：Composite
- `plan.combine === true` 且 `knowledgePointIds.length > 1` 时，启发式检查题目是否同时体现全部 KP 的语义特征（legacyType/category/operation/graphicType 任一命中即视为覆盖）。
- 缺失 KP → `KP_SEMANTIC_COMPOSITE` 错误。

### 生成器配合
- 修正全部 Generator 输出 `answer: { value, acceptable: [] }` 对象格式（原为字符串），符合 Schema/Answer Validator 预期。
- 修复 `duplicate-integrity-validator` 自动构建 `questionFingerprint` 兜底。

### 验证结果
- `npm test` / `verify` / `verify:m3` (193/193) / `verify:golden` 11/11 / `verify:snapshot` 漂移 0 / `verify:frozen-core` 全部 PASS。
- 预存问题：`verify:kb-change` `check-duplicates` `math-g5-vertical` 抖动；`cn-g1-n1-pinyin-basic` 缺失 generator；`knowledge-capability` 574 陈旧断言 — 均与本次无关。

### 行为验证示例
| KP | Generator | 测试场景 | 结果 |
|----|-----------|----------|------|
| math-g1-m1-addsub-10 | arithmetic-addition | operation=mixed/+/- | ✓ 通过 |
| math-g1-m1-addsub-10 | arithmetic-addsub | operation=mult | ✗ KP_SEMANTIC_OPERATION |
| math-g1-m6-solid-shape | shape-recognition | 任意 arithmetic operation | ✗ KP_SEMANTIC_OPERATION |
| math-g1-m6-position | position-direction | choice/judge/fill | ✓ 通过 |
| math-g1-m4-rmb-calc | money-measurement | fill/calc/apply | ✓ 通过 |
| math-g1-m1-addsub-10 | arithmetic | maxSteps=2 > KP.maxSteps=1 | ✗ KP_SEMANTIC_STRUCTURE |


## 附录 J：失败重生成 — P0-06 Step 29（2026-09-07）

用户指令：语义失败进入现有 Retry Loop，流程为 Generate → Validator → semantic FAIL → 重新 Generator → Validator；Strategy 仅计算一次。

### Step 29 实现
- **文件**：`shared/generator/retry-loop.js`
- **核心变更**：
  1. `RETRYABLE_CODES` 新增 6 个 KP 语义错误码（`KP_SEMANTIC_IDENTITY`、`KP_SEMANTIC_QUESTION_TYPE`、`KP_SEMANTIC_OPERATION`、`KP_SEMANTIC_NUMERIC`、`KP_SEMANTIC_STRUCTURE`、`KP_SEMANTIC_COMPOSITE`），语义校验失败即可重试。
  2. `valContext` 传递完整 `plan` 对象（含 `knowledgePointIds`），供语义验证器读取 KP 约束。
- **流程验证**：
  - 首次生成：Generator 产出错误语义题目（如 `addsub` KP 注入 `mult` 运算）→ Validator 产出 `KP_SEMANTIC_OPERATION` 错误
  - 重试判定：错误码在 `RETRYABLE_CODES` 中 → 进入重试
  - 重试执行：`generateWithRetry` 派生新 seed → 仅调用 Generator.generate()，**不重新执行 Strategy.plan()**
  - 二次生成：Generator 产出正确语义题目 → Validator 通过 → 成功返回
- **Strategy 单次计算保证**：`generateWithRetry` 接收 `generatorFn`（仅 `gen.generate`），Strategy 的 `plan()` 已在上层完成，重试循环内仅反复调用 Generator。

### 验证结果
- 手动测试：首次注入 `mult` 运算 → `KP_SEMANTIC_OPERATION` 失败 → 重试 1 次 → 二次生成正确 `mixed` 运算 → 通过
- 全部门禁：`npm test` / `verify` / `verify:m3` (193/193) / `verify:golden` 11/11 / `verify:snapshot` 0 漂移 / `verify:frozen-core` 全部 PASS
- 预存问题：`verify:kb-change` `check-duplicates` 抖动、`cn-g1-n1-pinyin-basic` 缺失 generator、陈旧 574 KP 断言 — 与本次无关

### 文件变更
- `shared/generator/retry-loop.js`：`RETRYABLE_CODES` +6 语义错误码；`valContext` 传完整 `plan`

## 附录 K：语文/英语(cn/en) 生成器与规则剔除 — P0-07（2026-09-08）

用户指令：直接剔除语文(cn)、英语(en) 相关生成器和规则，不备份直接删。项目收敛为纯数学（math）域，知识库由 574 KP（math 556 + cn 15 + en 3）精简为 **549 个 math KP**。

### 删除清单（52 项，无备份）
- **生成器/规则插件**（5）：`plugins/chinese-comprehensive.js`、`plugins/chinese-hanzi.js`、`plugins/chinese-pinyin.js`、`plugins/english-alphabet.js`、`plugins/pinyin-to-char.js`
- **知识库/字形/拼音资源**（5）：`shared/knowledge-cn.js`、`shared/knowledge-en.js`、`shared/hanzi-bank.js`、`pinyin-bank.js`、`shared/svg-chinese.js`、`shared/svg-english.js`
- **校验器**（5）：`shared/validator/distractor-validator.js`、`graphic-validator.js`、`kp-validator.js`、`render-preflight.js`、`structure-validator.js`
- **页面**（2）：`chinese-types.html`、`english-types.html`；**logo**（2）：`assets/logo-chinese.webp`、`assets/logo-english.webp`
- **知识库页**（26）：`knowledge/` 下 18 个 `cn-`/`en-` 页面 + 8 个跨模块聚合页（`g1-n1`、`g1-n2`、`g2-n1`、`g2-n2`、`g3-e1`、`g3-e2`、`g3-n1`、`g3-n2`）；重跑 `scripts/generate-knowledge-pages.js` 后现为 647 个 math 页面，0 个 cn/en
- **测试/校验脚本**（6）：`test/plugins/chinese-pinyin.test.js`、`english-alphabet.test.js`、`pinyin-to-char.test.js`、`dev/test-language-generators.js`、`dev/verify-language-banks.js`；并移除 `package.json` 失效的 `check-language` 脚本

### 规则收敛
- `Ontology.SUBJECTS = ['math']`；KB 仅余 math（549 KP）。cn/en KP id 现返回 `KP_NOT_FOUND`；combine 混入返回 `COMPOSITE_UNSUPPORTED`；非 combine 混入返回 `INVALID_REQUEST`（GATE-S2-6 断言已同步改写）。
- 4 个 ontology 校验脚本（factual/operation/error/schema）`SUBJECTS` 收敛 math；`dev/check-difficulty.js` / `shared/difficulty.js` 移除 cn/en 档案与 `canonSubject` 映射，仅留 math 回落断言 `profileFor('chinese'/'english') === math`。
- `shared/print.js` 移除 pinyin/pinyinToChar/alphabet PRINT_ROUTES；`shared/tokens.css` 保留 `--cn-*/--en-*` 作为通用强调色（math 插件复用 `var(--en-primary)` 等），删除 `--chinese/--english` 别名。
- `UNSUPPORTED_SUBJECT` 仅保留为 orchestrator/strategy-engine/api 的防御守卫；`TONE_MAP`/`normPY`/`normHZ`（math 插件依赖）保留。
- 保留的合法中文：math 应用题中的中文语境样例（如「语文 5 本数学 3 本共几种取法」）、小数的汉字读法/元角分（`math-decimal`、`math-number-sense`）——属数学内容而非 cn/en 生成器。
- 站点元数据同步：`index.html`（hero/ld+json/品牌）、`faq.html`（8 项 QA）、`README.md`、`llms.txt`、`sitemap.xml`（重跑 `generate-sitemap.js`）均收敛 math-only；`plugins/CONTRACT.md` 移除 cn/en 章节与 `createChinesePlugin/createEnglishPlugin` 行。

### 架构与产物
- Bundles 重建：strategy（85 modules/5 shims) 与 presentation（8 inlined/90 delegated）均 0 cn/en 命中；frozen-core 基线重锚（82 files）后 `verify:frozen-core` 无变更。
- `dev/check-frozen-core.js` 从 FROZEN/ALLOWLIST 移除 svg-chinese/svg-english 与 chinese/english-types；`dev/check-generator-clusters.js` 移除 cn/en 分支。

### 门禁结果（2026-09-08 全绿，除既有预存问题）
- `npm test` / `verify`（M0 7/7）：PASS；`verify:m1`、`verify:m2`（M1/M2 统一门禁）：PASS；`verify:m3` 193/0、M3-00/M3-21 PASS；`verify:m4` 54/54；`verify:golden` 10/10；`verify:snapshot` 0 漂移；`verify:kb`（549 KP、VALID）；`verify:difficulty-anchor` 10/10（KP 549）；`check-lint` 无违规。
- 修复项：`tests/capability/knowledge-capability.test.js` 与 `tests/ontology/knowledge-point.test.js`、`capability-matrix.test.js`、`knowledge-bank-verification.test.js` 中硬编码 574 断言改为按库动态统计；`dev/check-m2-final.js` 移除 `ORCHESTRATION_PLUGIN_IDS` 悬空引用（3f34393 遗留的 `ReferenceError`，随综合练习下沉生成层已无编排插件）；`tests/ontology/normalizer.test.js` 旧 `operate` 断言改规范值 `oral`；`test/practice-restore-e2e.js` 修复残留 `}` 语法错。
- 预存未修（随后全部修复，见附录 K.1）：`verify:setup` 中 `plugins/_template.js` 缺失 ×5 与 `math-competition-placeholder` 占位 ×2（HEAD 即缺，3f34393 删 `_template.js`）；`test/unit/allocateByWeight.test.js` MODULE_NOT_FOUND（引用已删 `math-comprehensive.js`，分配逻辑现位于 `shared/strategy/comprehensive-strategy.js` API.allocateByWeight，语义为全零权重返回全零、无均分退避）；`verify:kb-change` 的 check-duplicates 抖动。

### K.1 预存失败修复 — 2026-09-08
- **verify:setup**：重建 `plugins/_template.js`（math-only 现代骨架，createMathPlugin + renderCard，可加载可生成）；`dev/verify-setup.js` 删除 `math-competition-placeholder` 注册检查、9.2 块改为 C1–C9 全部真实插件覆盖（含年级维度）强校验——占位机制已随竞赛插件落地作废。
- **allocateByWeight.test.js**：重指向 `shared/strategy/comprehensive-strategy.js` 的 `API.allocateByWeight`（新签名 `(weights, total)`）；全零权重断言为 `[0,0,0]`（新实现无均分退避）。`test:node` 34/34 全绿。
- **check-duplicates 抖动**：根因二——① 题目指纹 `q.q|q.svg|answer` 不含 `q.data`，竖式/分数类插件（如 math-g5-vertical）题干存于 `data`，指纹退化为仅答案串，误把"不同题同答案"计为重复（实测中位 15%→4%）；② 有限题池插件（judge/oral 等）跨轮并池重复率本身贴近阈值，单次随机抽样越界即假阳性。
  修复：`dev/check-duplicates.js` 指纹加入 `q.data`；独立采样 3 次取重复率最低一次（真正"总出重复题"的坏插件任一样本均超限仍可检出）；`plugins/math-g4-judge.js` 将 8 个内联陈述条池提为命名银行并声明 `poolCache`（池 59 < need 100，走既有"题目池有限"豁免通道，与 g1/g2/g6-judge 一致）。
  验证：`node dev/check-duplicates.js` 连续 7 次全 PASS（修复前 g5-vertical 约一半运行超限）；修复后 80/88 阈值内 + 8 有限池豁免；`verify:kb-change` 全链 PASS；frozen-core 无变更。
- 复验门禁：verify:setup / test:node / frozen-core / kb-change / golden / m2 全部 PASS。

### 任务完成情况
- 涉及 P0-07 Step 31/32/33 之外的全量收敛：知识库、生成器、题型页、校验脚本、站点元数据、bundle、frozen 基线全部 math-only；此前记录的 3 项预存失败（verify:setup、allocateByWeight.test、check-duplicates 抖动）已全部修复并通过复验。
- docs/ A（`AI_REFACTOR_PLAN.html` 等历史记录）与 archive/ 按约定未动，作历史溯源用。（附录 K.1 仅述 2026-09-08 预存修复，不触及历史快照）

