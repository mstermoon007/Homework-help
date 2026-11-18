# 小学练习本 — 全项目设计报告（DESIGN-REPORT）

> 定位：面向全项目的**当前**设计总览——产品、技术栈、架构、数据、生成链路、表达、安全、离线、构建发布。
> 依据：冻结文档 `docs/00-BASELINE.md` ~ `docs/11-SECURITY.md` + **真实代码**（本报告为综合说明，非新的事实源；凡冲突以冻结文档与门禁实测为准）。
> 版本：5.3.0 ｜ 生成：2026-11-03（P46 增量更新：2026-11-15）｜ 关联：`docs/maintenance/AUDIT-LOG.md`（本次审计）。
> P46 增量：产品呈现由单页混合选择改为**家庭 / 试卷 / 教师三模式**（选择页 + 练习页），详见 `docs/P46/` 与 `docs/CHANGELOG.md` v5.3.0；本文其余章节的三模式以外设计不变。

---

## 1. 总览

| 项 | 内容 |
|---|---|
| 产品 | 小学 1–6 年级数学练习生成工具（免费、纯前端、零注册、零数据上传） |
| 线上 | [https://home.modouyu.top/](https://home.modouyu.top/)（nginx 静态托管 + HTTPS/Let's Encrypt） |
| 形态 | 纯前端静态站，**零运行时依赖**；浏览器与 Node 双环境兼容 |
| 核心功能 | 首页 → 年级/科目选择 → 题型选择 → 题目生成 → 在线练习 → 批改 → 答案显隐/错题重做 → 预览 → A4 打印 |
| 内容规模 | 375 知识点（KP）· 98 单元 · 407 前置关系 · 1566 生成矩阵 · 23 生成器 · 7 规范题型 |
| 页面 | 6 公共页 + 375 知识页 + 索引 = 382 sitemap URL |
| 学科 | 数学（G1–G6，人教版）；架构预留扩展其他学科 |

**设计原则**（源自归档《设计文档》V2.1，仍为当前依据）：知识点驱动 · 螺旋上升 · 教材同步 · 纯前端零依赖 · 家长友好 · 正确优先（「错误答案 0」为硬红线）。

---

## 2. 技术栈与工程约束

| 维度 | 选型 | 说明 |
|---|---|---|
| 语言 | 原生 JavaScript（UMD IIFE，`(function(global){…})(…)`） | 无框架、无 TypeScript；模块同时导出 `module.exports`（Node）与挂载 `window.App.*`（浏览器/SW） |
| 运行时依赖 | **0**（`package.json` `dependencies`/`devDependencies` 均为空） | 无第三方运行时包、无 CDN 脚本 |
| Node | Node ≥ 22（本机 v24） | 仅用于工具链：`node:test` 测试、KBL 派生、构建脚本、门禁 |
| 浏览器 API | `crypto.getRandomValues`（随机源）、Service Worker、CSS `@layer`、`window.print()` | **全程不使用 `Math.random`**（随机统一走 `shared/core/core.js` / `shared/generator/core/rng.js` 的 crypto 源） |
| 样式 | 纯 CSS，`@layer` 锁序 + 设计令牌（`shared/styles/tokens.css`） | 7 个样式表：tokens/base/components/styles/toolbar/pages/subjects |
| 数据 | JSON（KBL canonical）+ 由 KBL 单向生成的静态 HTML | 运行时只读副本在 `shared/knowledge/` |
| 构建 | 无应用构建步骤（静态）；仅两个**预构建 bundle** 为提交产物 | `shared/engine/strategy-engine.bundle.js`（~920 KB）、`presentation-engine.bundle.js`（~173 KB） |
| 缓存/版本 | SW `CACHE = 'hw-help-' + APP_VERSION`；HTML 资源注入 `?v=<版本>` | 版本四方一致：`VERSION` = `package.json.version` = `shared/catalog/version.js` = `sw.js CACHE` |
| 托管 | nginx 静态 + HTTPS + HTTP→HTTPS 301 | 部署为白名单打包 + 原子切换（非整目录上传） |
| 可发现性 | `sitemap.xml` / `robots.txt` / `llms.txt` / canonical / `kbgen:hash` 漂移指纹 | SEO + AI/LLM 只读消费 |
| CI/门禁 | `bash scripts/run-all-checks.sh` ≡ `npm run check-all` | 34 项，本地与 CI 完全一致 |

---

## 3. 架构：分层与唯一执行链

架构为**冻结的单向分层**（`docs/01-ARCHITECTURE.md`，FROZEN）。任何改动必须「归属层 → 唯一责任模块 → 最小修改 → 局部验证 → 全量验证」。

```text
KBL                     知识事实（KP/字段/映射/关系/ALLOW）
 ↓ KnowledgeContext     运行时只读上下文
 ↓ POL                  编排：范围解析→KP×QT Cell→配额→难度协调→Generation Plan
 ↓ Strategy             生成策略与计划结构
 ↓ Generator            生成题目（只消费，四轴不夺权）
 ↓ Validator            验证（答案/语义/难度/查重/覆盖/质量）
 ↓ SemanticQuestion     全链唯一题目对象
 ↓ Presentation         HTML 渲染 / 打印/输出
 ↓ SVG                  图形表达
```

**层级责任表（SSOT）**

| 层 | 唯一责任模块 | 不允许做 |
|---|---|---|
| KBL | `kbl/` | 编造数据；越权改题型/布局/难度；第二事实源；被 SEO/AI/LLM 反向修改 |
| KnowledgeContext | `shared/knowledge/runtime/` + `shared/orchestration/knowledge-context.js` | 持有业务决策；偏离 KBL；被当作可写源 |
| POL | `shared/orchestration/` | Render/Print/SVG/教育策略/选 Generator；破坏 `requested≥planned≥generated=final` |
| Difficulty | `shared/catalog/difficulty.js` + `difficulty-static.js` | 第二套公式；逐题特调 |
| Strategy | `shared/strategy/` | 直接产题；改 Validator 契约；双轨 |
| Generator | `shared/generator/` | 自造 KP；绕 Selector/Executor；降质量换成功；`Math.random` |
| Validator | `shared/validator/` | 放宽规则；删减检查换 PASS |
| SemanticQuestion | `shared/semantic/semantic-question.js` | 第二套题目对象；字段口径漂移 |
| Presentation | `shared/presentation/` | 下沉业务判断；私带 `@media print` |
| SVG | `shared/svg/` + `plugins/svg-*.js` | 承载文字语义；绕过 SVG 注册入口 |
| Learner | `shared/learner/` | 伪造结果；越权影响生成质量；写 KBL |
| Crawl | `sitemap.xml` / `robots.txt` / `dev/build-knowledge-pages.js` | SEO 注入虚假内容；伪造 author/rating/review |

### 3.1 真实浏览器运行时调用链（实测）

文档描述的「KBL→…→Practice」是方向性正确的**生产链**；浏览器实际路径在中介层更丰富：

```text
practice.html (UI/事件/状态)
  → PracticeBridge        shared/bridge/practice-bridge.js   （UI 指令 → session 配置；最新生成胜出；反馈钩子）
  → PracticeSession       shared/engine/practice-session.js （会话状态机；构造 GenerationRequest；submit/check/redo/print）
  → GenerationAPI         shared/generation/api.js          （唯一 Executor）
      ├─ POL（存在时）     shared/orchestration/practice-orchestrator.js（orchestrate）
      └─ 否则 inline 执行  executeInline → build → runPlans
  → StrategyEngine         shared/engine/strategy-engine.bundle.js
  → GeneratorSelector      shared/generator/generator-selector.js（入 generator 前归一题型）
  → Generators             shared/generator/generators/*
  → Validators             shared/validator/*
  → SemanticQuestion       shared/semantic/semantic-question.js
  → PresentationRenderer   shared/presentation/renderer.js → html-renderer.js
  → 打印                    shared/presentation/print.js
```

`PracticeBridge` 与 `PracticeSession` 是**有意的 UI 中介层**（多入口 seed/print/auto、请求最新胜出、反馈注册），不属于违规层。

### 3.2 跨层硬红线（8 条禁止边）

`Generator→KBL`、`Generator→POL`、`Generator→Difficulty 计算`、`Presentation→Generator`、`SVG→Generator`、`Validator→Generator`、`Learner→KBL 写`、`SEO/Crawl→KBL 写`。
门禁：`node dev/p28/check-cross-layer.js`（基于 `P28-DEPENDENCY-MATRIX.json`）。

---

## 4. 数据与 KBL（知识基线）

- **唯一事实源**：`kbl/canonical/`（`knowledge.json`/`course.json`/`relations.json`/`mappings.json`/`capability.json`）。
- **唯一构建链**（`docs/02-KBL.md` §2，P30-02 锁定）：源 Excel → `tools/kbl/extract-source.js` → `derive-kbl.js` → `derive-relations.js` → `emit-canonical.js` → `build.js` → 运行时副本 `shared/knowledge/` + 静态页 `knowledge/*.html`。**真源 vs 发射副本禁止双写**。
- **写方白名单**：KBL 唯一可写方 = 离线派生工具链（`tools/kbl/*.js` + `dev/p25|p27/*.js`）；运行时只读（`KBL_WRITER_WHITELIST` 17 条，`check-kbl-ai-boundary.js`）。
- **确定性构建**：同输入必得同输出 + `kbgen:hash` 指纹（`check-bundle-determinism` / `build-knowledge-pages --check`）。
- **概念族模型**（P40 战役二）：族表 `CONCEPT_FAMILIES`（14 主干族，含有序 stages + 演化 op；P44/H10 起含 fam_negative、fam_observation、fam_direction）与 `EXTRA_FAMILIES`（11 扩展族）声明于 `tools/kbl/derive-relations.js`（SSOT）；每 KP 得 `{familyId, stageOrder}` 回填 `capability.json`（375/375）；R-REL-03 的 44 条边携带 `evolution`。

**当前基线数字**：KP 375 · Units 98 · Relations 407 · ALLOW 映射 1566（=静态行=动态端点，FAIL=0，真实生成 1566/1566；P44/H9 源 Excel 改判后 1570→1566，P44/H10-A fam_negative +1、H10-B fam_observation +3、H10-C fam_direction 升主干链 +2 且取消 R-REL-02 排除 +28 后 373→407）。

---

## 5. 生成链路（POL → Strategy → Generator → Validator）

- **题型收口**：Canonical 7 类 `calc/fill/choice/judge/geometry/classify/apply`，SSOT `shared/knowledge/question-type-registry.js`；旧令牌 `oral/recognize/open` 仅存于 `normalizeQuestionType`，不进生产能力声明。五面审计（Registry/Strategy/Generator/Validator/Presentation）全 =7。
- **POL 职责**：request normalize、KP selection、type selection、quantity planning、difficulty coordination、产出 `QuestionPlan`；**不**产出 HTML/SVG/数字/答案/文字。不变量 `requested ≥ planned ≥ generated = final`。
- **Strategy**：按计划决定「如何生成」，不得重选 KP/数量/题型/难度，KBL 只读经 KnowledgeContext。
- **Generator Registry**：23 个 Generator = PRODUCTION 20 + PRODUCTION-COMBINE-ONLY 1（`generator:composite`）+ DORMANT-CONTRACT-CARRIER 2（`selection-choice`/`selection-judge`）+ DORMANT-NO-BINDING 0。
- **四轴不夺权（Z1–Z4）**：Generator 不得自决数量/题型/难度/KP，回显须等于计划；门禁 `check-generator-noninterference.js`（8 组运行时探测）。
- **生成矩阵冻结**：1566 逐行真实生成 ≥1、题型/KP 一致、Schema 校验、Validator 通过、TypeContract 不变量、答案非空。

---

## 6. 难度体系

- **唯一公式**：`effectiveDifficulty = clamp(baseLevel + adaptiveDelta, 1, 10)`（`shared/catalog/difficulty-static.js`）。
- **合成难度**：`composed = clamp(round(base + modeAdj + qAdj + cAdj), 1, 10)`（`shared/strategy/difficulty-strategy.js::resolveComposedDifficulty`）；`mode` profile 中 competition 未显式给难度时向年级锚点上沿抬升。
- **年级锚点表**（R5）：G1 `[1,2]` … G6 `[6,10]`，区间随年级螺旋上升。
- **Provenance**：难度权威链唯一 + 溯源，门禁 `check-difficulty-authority-gate.js` / `check-difficulty-provenance-gate.js`。
- 注：`difficulty-validator.js::computeActualDifficulty` 为**非权威启发式交叉校验**（warning-only），非第二套公式。

---

## 7. 校验体系

- 验证管线与 Semantic PASS/WARN/FAIL 显式分离（`docs/05-VALIDATION.md`）。
- 验证器清单覆盖：答案（`answer-validator.js`）、题型契约（`type-contract.js`）、难度、KP 语义（`kp-semantic-validator.js`）、查重、覆盖、质量。
- 答案：**单一判分权威** `shared/validator/answer-validator.js`（Tokenizer→Parser→AST→Safe Evaluator）由 `shared/core/check.js::computeResult` 消费；页面不另设判分。
- 教育语义固定 seed 测试 + A 类 KP 语义治理；失败分类深观测（count=6）。

---

## 8. 题目对象与表达链

- **SemanticQuestion**（`shared/semantic/semantic-question.js`）= 全链唯一题目数据契约。
- 生产链：`Generator → SemanticQuestion → Validator → PresentationRenderer → HTMLRenderer → RenderResult`。
- **唯一 Legacy 兼容边界**：`shared/presentation/render-format.js::toRenderableQuestions`（旧 `LegacyQuestion` 仅供错题/重做渲染）。
- **打印约定（冻结）**：统一 `shared/presentation/print.js`，页面不得私带 `@media print`；A4 纵向、内容宽 190mm、页边距 12mm/10mm；输入元素保留样式仅清空 value；调用 `Print.open('#container','标题',{pageType,columns})`。预览与打印同源（单一真相见 `docs/06-PRESENTATION.md` §4.1：版式常量 / 打印骨架 / 列数决策 `QuestionLayout.plan()`）。
- **横向算式作答框**：由 SemanticQuestion 声明 `response.layout`（`inline-after-equals`/`block`），Executor 归一、HTMLRenderer 只消费显式字段（不再解析题干字符串）。

---

## 9. SVG 图形

- 统一链路 + 返回契约（`docs/07-SVG.md`）；图形插件 `plugins/svg-*.js`（clock/area/fraction/data-stats/draw/competition）经 SVG 注册统一入口。
- **安全**：`SVGSanitizer` 处理 custom/illustration 的 rawSvg，禁止 raw SVG 入 DOM；全量 Contract Test。

---

## 10. 学习状态（Learner）

- 定位：学习状态**基础设施，供数不决策**（`shared/learner/`，5 个责任单元）。
- 唯一评分入口；数据/决策分界清晰；禁止伪造结果、越权影响生成质量、写 KBL。
- 自适应：`shared/strategy/adaptive-strategy.js`（预留设计，`orderByStageOrder` 等），由 UI 仅通过 learnerProfile 触发。

---

## 11. 安全与隐私

| 面 | 机制 | 门禁 |
|---|---|---|
| 表达式求值 | 无 `eval`/`new Function`；纯静态 Tokenizer→Parser→AST→Safe Evaluator | `check-no-eval.js` / `check-answer-validator-security.js` |
| HTML 边界 | 题目/答案/解析/SVG 全经安全渲染管线；print 克隆为序列化 DOM + 打印窗口 CSP 禁 script | `check-html-safety-boundary.js` |
| SVG | `SVGSanitizer` | `svg-sanitizer.test.js` |
| KBL 写保护 | 唯一可写方 = 离线白名单；运行时只读 | `check-kbl-ai-boundary.js` |
| 隐私 | 纯前端，无登录/无数据库/无第三方运行时；题目与作答**不上传**（无遥测；`shared/state/logger.js` 默认仅 console，`remote` transport 无调用方） | — |
| 历史隔离 | 六目录 `noindex,nofollow`，不进 sitemap | `check-seo-ai-history-isolation.js` |

---

## 12. 离线缓存与可发现性

- **Service Worker**（`sw.js`）：install 预缓存核心壳页（HTML/shared/assets/SVG 插件）；fetch 同源 Cache-First（导航 network-first）；activate 清理旧版本缓存；离线兜底回退 `index.html`；注册点 `shared/core/common.js::App.registerServiceWorker()`。
- **版本切换**：`CACHE='hw-help-'+APP_VERSION`；HTML 资源注入 `?v=APP_VERSION` 作为缓存键 → 升级即整体失效回填，避免新旧混排。
- **可发现性**：`sitemap.xml`（382 URL 逐条 200/无 redirect/canonical 一致/无参数）· `robots.txt`（开发/历史目录 Disallow，AI 爬虫 Allow）· `llms.txt` · 知识页为 KBL 决定性投影（`kbgen:hash` 指纹）· 375/375 页无 JS 可被抓取与读取（AI Agent 沿静态 `<a href>` BFS）。

---

## 13. 构建、测试与发布

- **测试**：`npm test` = `node --test "tests/**/*.test.js"`，当前 **993 用例 / 16 套件 / 110 文件**；目录分布 generation/orchestration/presentation/adaptive/source/validator/core/semantic。
- **门禁链**：`npm run check-all`（`dev/check-all.js`）**34 项**：SW 版本 · M0 聚合+KBL 边界 · KBL 血缘 · KBL 数据质量 · Lint · Syntax(342 文件) · Unit(993/993) · 生成（1566/矩阵冻结/Registry/四轴/分工矩阵/失败分类/答案防泄露） · 教育语义 · 金题集 · 难度权威/溯源 · 渲染/Legacy · SVG · 安全 · Sitemap(382) · 爬虫 · 浏览器 E2E(9 步) · Bundle 确定性 · 覆盖率 · LLM 可读 · 文档数字 · 死代码 · Legacy 矩阵 · 实例级质量(P42-4 难度完整性/解析质量底线 + P45 V-A~V-E) · FINAL-91 只读快照。CI 设 `REQUIRE_BROWSER_E2E=1` + `CHROME_BIN`。
- **构建**：`npm run kbl:rebuild`（extract→derive→knowledge pages）；`npm run build:strategy` / `build:presentation`（bundle）；`generate:sitemap`。
- **发布**：白名单打包 + 原子切换 + 线上三层验证（公网 curl / hash 一致 / 真实 Chrome）；回滚 = 恢复上一稳定 tar 或 `git revert`。**代码/测试/开发工具/审计文档不部署**。

---

## 14. 目录结构

```text
/                     6 公共页 + index/practice/select…  + sw.js + VERSION + robots/sitemap/llms.txt
assets/               图片与图形（webp/png）
plugins/              svg-*.js 图形插件
shared/               核心运行时代码（冻结）
  bridge/ engine/ generation/ generator/ orchestration/ strategy/ validator/
  semantic/ presentation/ svg/ knowledge/ learner/ catalog/ capability/
  capacity/ request/ schemas/ state/ core/ styles/
  engine/*.bundle.js  两个预构建 bundle（提交产物）
kbl/                  知识基线（canonical/data/teaching/import/manifest）
knowledge/            375 知识页 + 索引（由 KBL 单向生成）
tools/kbl/            KBL 提取/派生/发射/构建工具
scripts/              add-asset-version / generate-sitemap / sync-sw-version / crawl-site
dev/                  门禁/检查/构建/E2E 脚本 + p2x 阶段工具
tests/                单元与集成测试
docs/                 00-BASELINE~11-SECURITY + CHANGELOG + P28~P40 + maintenance + archive
migration/ release/ feedback/   辅助/历史目录（不部署）
```

---

## 15. 当前状态摘要（2026-11-15，P46 三模式收口后）

| 项 | 值 |
|---|---|
| 版本 | 5.3.0（`VERSION`=`package.json`=`version.js`=`sw.js CACHE` 四方一致） |
| 基线 commit | 当前（P46 三模式收口后） |
| 门禁 | `check-all` 34 PASS / 0 FAIL / 0 SKIP（34 项；本机设 `CHROME_BIN` 后含真实 Chrome E2E 三模式 + 9 步全 PASS），`npm test` 1064/1064（114 文件） |
| KBL | 375 / 98 / 407 / 1566 |
| 线上 | VERSION 5.3.0（2026-11-18 发布，`home.modouyu.top`）；dev/tests/kbl 不可达 |

---

## 16. 已知缺口与优化机会（摘要，详见审计台账）

- **已修复**：competition 难度合成的 `ReferenceError`（P1）；隔离目录文档漂移（P2）；`registry-facade` 死三元（P3）；P41-A1 `checkQuestionType` 题型字段口径（生产恒 no-op）；P41-A2 `attachMeta` 异常路径 `ReferenceError`；P41-B1 rootHash 单一权威；P41-B2 知识页 `--check` 真实漂移检测；P41-B3 随机分布测试确定化。
- **已决策**：P41-C 难度锚点权威冲突 → 选项 C（双表并存 + 显式命名），生产公式与 KBL 数据零变更（记录 `docs/maintenance/P41-C-difficulty-anchor-decision.md`）。
- **已修复（2026-11-18）**：线上 HSTS/安全响应头缺失（P3）——根因为 Certbot 重写 `home.modouyu.top` server 块时抹掉人工 `add_header`；已改为 `/etc/nginx/snippets/security-headers.conf` 片段 include（HSTS `max-age=300` + nosniff + X-Frame-Options SAMEORIGIN + Referrer-Policy），200/404 均实测携带四头，详见 `docs/maintenance/AUDIT-LOG.md` P3。续期后需复验。
- **已解除**：Browser E2E「本机无 Chrome/Chromium」——本机 Chrome 已就绪，`CHROME_BIN` 指向 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` 可跑通 34 PASS / 0 FAIL / 0 SKIP（P46-09）；CI 仍需显式配置 `CHROME_BIN`。
- **暂缓（O2/O3）**：题型谓词四处统一化（触及打包源 + bundle 重建，现由 P41-D 契约测试冻结）；`strategy-engine.js` 拆分 request-schema；gcd/`MODE_ALIAS`/常量表/标题/KP-id 解析 helper 收敛；`logger` 死 transport 清理；`version.js BUILD_DATE` 确定性；E2E 冷启动 `DevToolsActivePort` 等待窗口。
- **不建议实施**：bridge/session 合并；intent 读取点合并（会击穿 `check-intent-authority` A3b）。

### 16.1 P46 三模式遗留 / 债务登记（2026-11-15）

> 口径：**已收口** = P46-01~10 全部交付、门禁通过；**遗留** = 已登记但本轮不处理；**债务** = 需后续专门任务偿还。

| 类别 | 项 | 状态 | 说明 / 归属 |
|---|---|---|---|
| 遗留 | 门禁项数文档漂移 | 已加基线指针（P46-12） | P31/P30 规则文档顶部已加「当前实际以 `docs/00-BASELINE.md` 为准」口径提示，历史数字不改写 |
| 遗留 | 共享样式零消费者 | 登记不处理 | `shared/styles/components.css` `.type-card.competition`、`shared/styles/pages.css` `.quick-switch`：无 HTML/JS 消费者，但三方证据不足（§11.3），不强行删除 |
| 遗留 | 编排层内部模式 | 保留 | `shared/strategy` / `shared/generation` / `question-type-registry` 内 quick/teacher/competition 为编排内部能力，有生产消费者，非产品模式 |
| 遗留 | 单单元册别无真实样本 | 登记 | 真实数据中不存在「单元数 = 1」的册别，期中 `slice(0, ceil(n/2))` 在该边界退化为整册，未被真实样本覆盖 |
| 遗留 | 试卷小样本 PARTIAL | 事实，非缺陷 | 3 KP 样本下 40 题只够 39 题，页面已有「本次已生成 39 / 40 题」可见提示 |
| 债务 | 家庭专项判定为关键词规则 | 已补维护注释（P46-12）；标注化仍属长期债务 | `select.html` `FOCUS_RULES` 已补维护说明（规则来源、KP 改名时的同步要求、新增专项步骤、禁止 KP ID 硬编码）；G5/G6 六专项全空属数据事实 |
| 债务 | `version.js BUILD_DATE` 非确定性 | 沿用旧债 | `new Date().toISOString()` 参与构建，影响可复现性（见「暂缓 O2/O3」） |
| 债务 | CI 未配置 `CHROME_BIN` | 待配置 | 本地可跑 34/0/0；CI 未设环境变量时第 15 项 SKIP（33/0/1） |
| 发布 | 线上版本 | **已完成（P46-13）** | 2026-11-18 已发布 5.3.0 至 `home.modouyu.top`：566 文件 / SHA256 `32938be6…` / 原子切换 / 线上↔HEAD 8/8 MATCH / sitemap 382；回滚点 `/root/Homework-help.bak-20261118.tar.gz` |

---

## 17. 参考资料

- 基线：`docs/00-BASELINE.md` ｜ 架构：`docs/01-ARCHITECTURE.md` ｜ 领域契约：`docs/02`~`docs/11`
- 发布：`docs/CHANGELOG.md` ｜ 审计：`docs/maintenance/AUDIT-LOG.md` ｜ 审计指令：`docs/maintenance/PROJECT-AUDIT-INSTRUCTIONS.md`
- 历史设计（归档）：`docs/archive/phases/设计文档.md`、`docs/archive/phases/技术文档--基础.md`
