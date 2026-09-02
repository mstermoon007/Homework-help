# 项目开发日志（Dev Log）

> 版本演进完整记录。格式参照 Keep a Changelog，版本号遵循语义化版本（大版本.功能.修复）。
> 每个大版本的完整变更以 Git 标签为锚点（`git log V2.1..V3.0` 可查看全部提交）。
> 当前文档是整理后的统一开发日志，替代根目录 `CHANGELOG.md`、各内存/总结文档中的历史记录部分，
> 以及 V4.0.2 起并入的各一次性工作报告（架构里程碑 / 迁移审计 / 债务扫描）。

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
