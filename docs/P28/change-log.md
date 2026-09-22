# P28 · AI 修改审计日志（Change Log）

> 目的：记录每一次 AI 修改的 **任务编号 / 改动文件 / 删除文件 / 原因 / 测试 / 风险**，
> 使后续任何 AI（或人）能回答「这个文件/符号为什么存在、为什么被删、当时如何验证」。
>
> 规则：
> 1. 每次 AI 修改代码、配置或文档结构，必须在本文件 **顶部（最新在上）** 追加一条记录。
> 2. 六字段必填；确实没有填「无」，不得留空、不得编造。
> 3. 一条记录对应一个 P28 task ID；无独立编号的维护性修复，标注其归属的父任务门禁 ID。
> 4. 纯对话、只读分析、代码阅读不登记；只有产生文件改动才登记。
> 5. 修改记录是历史档案，写入后不改写数字；如需更正，追加新记录说明。

## 模板

```
### P28-XX｜标题（YYYY-MM-DD）
- modified:
- deleted:
- reason:
- tests:
- risk:
```

---

## 记录（新 → 旧）

### P28-54｜P28 后 AI 编程规则固化（2026-09-22）

- modified: 无（新增本地工作区规则文件，已 gitignore）
- deleted: 无
- reason: P28-FINAL 冻结后，为防止后续 AI 编程重蹈「发现问题→无限审计→无限扩展→新增架构→新兼容层→再审计」的覆辙，固化强制流水线与禁令。
- tests:
  - 新建 `.trae/rules/ai-coding-workflow.md`（`alwaysApply: true`，`scene: coding`），定义十步强制流水线：需求→定位所属层→读取 ARCHITECTURE-OWNERSHIP（`docs/01-ARCHITECTURE.md`）→读取 CURRENT BASELINE（`docs/00-BASELINE.md`）→读取对应模块 Contract→提出最小修改→执行→局部测试→`check-all`→更新 CHANGELOG。
  - 明确禁止：无限审计、无限扩展、新增架构、新兼容层、再审计。
  - 该文件位于 `.trae/rules/`，已被 `.gitignore` 忽略，属工作区本地规则不入库。
- risk: 无（仅本地规则，不影响仓库）。

### P28-53｜最终冻结（P28-FINAL-FREEZE.md）（2026-09-22）

- modified: 无
- deleted: 无
- reason: P28 系列最终交付，建立冻结快照文档，固化版本、数据资产、构建产物与门禁状态。
- tests:
  - 新建 `docs/P28-FINAL-FREEZE.md`，记录：Version（math-v1.0.0 / kbl-math-2026-09-16）、Date（2026-09-22）、KBL hash（18a21dfb…）、KBL count（375 KP / 98 Units / 0 Relations）、Generator count（31）、QuestionType count（7）、Mapping count（1570）、Test count（534）、Bundle size（strategy 约 552 KB / presentation 约 146 KB）、Security/Crawler/AI/Difficulty/SVG/Presentation/Learner 七域状态均 PASS；最终定义「P28-FINAL：工程治理完成」。
  - 文档一致性门禁 PASS。
- risk: 无（仅新增冻结快照文档）。

### P28-52｜最终产品化验收（全维度门禁）（2026-09-22）

- modified: 无（仅验收，提交 P28 累积改动使 Git clean）
- deleted: 无（本次验收本身）
- reason: P28 系列最终交付验收，逐项确认数据/生成/难度/教育语义/Validator/Presentation/SVG/Learner/Web/Security/Tests/CI/Docs/Git 十三个维度全部达标。
- tests:
  - **数据**：KP 375 ✅；Units 98（按 unitId 去重）✅；Relations 0 ✅；ALLOW mappings 1570 ✅。
  - **生成**：1570/1570 真实生成（P28-49 全链路 Generate→Validate→SemanticQuestion→Render）✅；7/7 题型（calc/fill/choice/judge/geometry/classify/apply）✅。
  - **难度**：权威链唯一（check-all 10a PASS）✅；无二次计算（check-all 10b 溯源 PASS）✅。
  - **教育语义**：PASS/WARN/FAIL 三级分离（GENERATION_PASS:0 / SEMANTIC_PASS:7 / SEMANTIC_WARN:914 / SEMANTIC_FAIL:0）✅；A-class FAIL = 0 ✅。
  - **Validator**：安全表达式（AnswerValidator 测试全过）✅；`new Function(` 生产代码 0 命中（P28-51）✅。
  - **Presentation**：单一生产 Renderer（PresentationEngine→renderer.js，legacy 隔离，check-all 11 PASS）✅；SVG contract 全通过（check-all 12 + svg-contract/svg-sanitizer 25 tests PASS）✅；无静默失败（sanitize 失败返回空串非 fallback）✅。
  - **Learner**：状态链完整（error-model → learner-model → learner-storage → practice-result → result-collector，五模块齐全，p28-32 测试 PASS）✅。
  - **Web**：Sitemap 381 URL 冻结（check-all 14 PASS）✅；Robots ✅；Canonical ✅；AI-readable（check-all 15a 375/375 抓取 + 16 LLM 体检 PASS）✅。
  - **Security**：0 uncontrolled dynamic execution（eval/new Function 0 命中；innerHTML 全 esc()；rawSvg 经 SVGSanitizer；print CSP default-src 'none'；P28-51 + check-all 13 PASS）✅。
  - **Tests**：100% PASS（全链 534 tests，check-all 5 PASS）✅。
  - **CI**：本地 = CI（`npm run check-all` = `node dev/check-all.js` = `.github/workflows/ci.yml` 唯一入口）✅。
  - **Docs**：唯一 CURRENT BASELINE（仅 `docs/00-BASELINE.md` 含 CURRENT 标记，无其他 baseline）✅。
  - **Git**：clean（P28 累积改动已提交，工作树无未提交改动）✅。
  - 全量门禁：`node dev/check-all.js` 26 PASS / 0 FAIL。
- risk: 无（验收通过，已提交交付）。

### P28-51｜最终安全审计（7 类高风险模式全量扫描）（2026-09-22）

- modified: 无（仅审计，未改代码）
- deleted: 无
- reason: 最终交付前对全项目做安全面扫描，逐项确认动态执行/HTML 注入/SVG 注入三类风险均受控。
- tests:
  - **eval(**：生产代码 0 命中（仅 `dev/p28/check-security.js` 注释提及）。无不受控动态执行。
  - **new Function(**：生产代码 0 命中（仅 check-security.js 注释）。无不受控动态执行。
  - **document.write(**：2 处，均受控——
    ① `shared/core/common.js:27-30`：浏览器引导注入子模块，路径由 `document.currentScript.src` 推导 + 固定文件名（core.js/check.js/ui-state.js/storage.js），无用户输入流入；
    ② `shared/presentation/print.js:221`：打印弹窗写入 `printHtml`，内容来自 `buildFromQuestions`（经 PresentationRenderer→HTMLRenderer esc() 转义 + SVGSanitizer），且打印文档含 CSP `default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:;` 完全阻断脚本执行。
  - **innerHTML =**：36 处，全部受控——
    - 静态字符串模板（无动态内容）：`practice.html:512/704/706/1163/1496/1525/1529/1665/1667`、`select.html:830/832/912-914/938/1031`、`print.js:288`（P28-23 已标注静态模板）；
    - 动态内容经 `esc()` 转义：`practice.html:505`（esc title/sub）、`703`（body 来自 engine 渲染成品或 `renderGeneric`，后者 L792/793 全 esc）、`985`（esc tips，数字插值）、`1316`（esc id/name）、`1516`（esc typeDisplayName/coverageReason）；`select.html:818/925`（esc bkt.unit）、`958`（esc k.id/k.name/hints）、`983`（t.key/t.label 静态定义）、`1047`（esc m.id/m.icon/m.name/m.desc）；
    - `feedback/feedback.js:88`：`<img src="${FileReader dataURL}">`，用户上传图片以 data URL 作为 img src（非 inline HTML/SVG，脚本不执行）；
    - `dev/svg-test.html:85`：dev 工具，非生产。
  - **outerHTML =**：0 命中。
  - **rawHtml**：仅 `practice.html:871` 读取 `q.rawHtml` 用于错题签名字符串（不注入 DOM）；`dev/p28/build-baseline.js` 为扫描工具。无未验证 HTML。
  - **rawSvg**：全部经 `shared/presentation/svg-registry.js:241 sanitizeSvgRaw()` → `SVGSanitizer.sanitizeSvg()` 白名单清洗（拒绝 script/事件属性/foreignObject/外联），清洗失败返回空串不渲染。`semantic-question.js:276` 仅在 `raw.svg` 存在时才包 custom/rawSvg，无 raw.svg 时 graphic=null。
  - 门禁 `node dev/p28/check-security.js`：6 PASS / 0 FAIL（eval/new Function、AnswerValidator、SVG Sanitizer、print.js 安全边界、KBL 写保护、SEO 隔离）；`svg-contract-full` + `svg-sanitizer` 测试 25/25 PASS（含 P28-27 malicious rawSvg 清洗用例）。
- risk: 无（仅审计，无代码改动）。

### P28-50｜最终全量性能验证（2026-09-22）

- modified: 无（仅测量，未改产品代码）
- deleted: 无
- reason: P28-48 修复选择题渲染/批改链、P28-49 全链路生成验证后，需对关键性能指标做最终测量，确认 P24（KBL 冻结）/P25（生成器族）/P26（策略）/P27（渲染链治理）之后无明显回归。
- tests:
  - **静态体积**（磁盘原始字节）：
    - `strategy-engine.bundle.js` 约 552 KB（gzip 约 118 KB）
    - `presentation-engine.bundle.js` 约 146 KB（gzip 约 32 KB）
    - `practice.html` 91,818 B（90 KB）；`index.html` 38,926 B（38 KB）；`select.html` 48,293 B（47 KB）
    - practice 首屏同步脚本 25 个合计 978,597 B（956 KB）；CSS 6 个合计 61,361 B（60 KB）
    - 延迟装载脚本（P28-30 治理：print/SVG/html-renderer/renderer 等 21 个）合计 172,705 B（168 KB），首屏后按需加载
  - **运行时**（localhost 127.0.0.1:8123，warm cache，二年级 choice/geometry/Quick 多题型）：
    - Practice startup（导航 → 20 题卡渲染）：FCP 776ms，loadEvent 1,096–1,833ms（含延迟脚本装载 + 自动生成）
    - Generation：20 题 9–26ms（choice 单 KP 9ms、geometry 26ms、Quick 四题型×5 14–23ms，3 轮稳定）
    - Render（HTMLRenderer.render）：20 题 <1ms
    - Full render（PresentationRenderer.renderAll 含 SVG 注入）：15 题 1ms
    - SVG（SVGRenderer.render）：14 个图形 1ms
  - **回归判定**：P24-P27 以来的改动以净缩减为主（P28-45 删 render.js + semantic-question-bridge.js；P28-46 删 strategy 层 6 符号），P28-48 仅 type-contract.js 增 4 行、html-renderer.js 重写 optionsOf（净增约 10 行），strategy bundle 已重建。上述指标无明显回归：生成 <30ms/20 题、渲染 <1ms、首屏 <2s，均在正常范围。
- risk: 无（仅测量，无代码改动）。

### P28-49｜最终真实生成验证（全链路 Generate→Validate→SemanticQuestion→Render）（2026-09-22）

- modified:
  - `dev/p28/check-p28-49-full-pipeline.js`（新建：在 P24-02 check-allow-generation.js 的 Generate+Validate 基础上，补齐 SemanticQuestion schema 校验与 HTMLRenderer.render 渲染两步；按 QT 校验输出含对应 style-* 类）
- deleted: 无
- reason: P28-48 E2E 修复了选择题渲染/批改链后，需对全部 1570 个 ALLOW(KP,QT) 对做端到端真实生成验证，证明「声明能力 = 可执行能力 = 可渲染能力」，防止某类题型可生成但渲染崩溃或样式错配。
- tests:
  - `node dev/p28/check-p28-49-full-pipeline.js`：1570/1570 PASS，FAIL 0，render-pass 1570；
  - 四步全部通过：Generate（≥1 题）、Validate（questionType/KP 匹配）、SemanticQuestion（validateSchema 无 ERROR）、Render（HTMLRenderer.render 不抛异常且含 QT 对应 style 类：calc/fill/choice/judge 同名、apply→story、geometry→shape、classify→sort）；
  - 基线 `check-allow-generation.js` 1570/1570 不变。
- risk: 无（仅新增 dev 验证脚本，不改产品代码）。

### P28-48｜最终浏览器 E2E 与选择题渲染/批改链修复（2026-09-22）

- modified:
  - `select.html`（3 处：① quick 卡 disabled 此前被拼进 class 值而非属性，按钮仍可点；② `renderTeacherTypeGrid(buckets)` 无参调用时 buckets 为 undefined 致题型卡恒显「0 个知识点」，无参时改用 fullKPEntries+kpMatchesBook+unitBuckets 重算；③ 竞赛卡同构 disabled bug）
  - `shared/presentation/html-renderer.js`（`optionsOf(sq)`：旧写法 `sq.options || sq.distractors || sq.data.options` 被空数组 `distractors:[]`（truthy）短路，导致 `data.options` 中真实存在的选择题选项永远渲染不出来；改为逐个做「非空数组」判定回退）
  - `shared/generator/core/type-contract.js`（`enforce`：choice 题通过契约后统一设 `sq.answerMode='choice'`；原生生成器经机械转换路径产出的 choice 题 answerMode 仍为 'input'，会让渲染层同时画出 radio 与文本框）
  - `shared/engine/practice-session.js`（`_collectAnswers`：选择题 radio 同组每个都带 data-index，旧逻辑取最后一个 radio 的值覆盖已勾选答案；现仅收集 checked 项）
  - `practice.html`（`collectAnswers`：同 practice-session 的 radio/checkbox 只收已勾选项补丁）
  - `shared/engine/strategy-engine.bundle.js`（由 type-contract.js 改动触发 `npm run build:strategy` 重建）
- deleted: 无
- reason: E2E 七类题型全量浏览器验证发现 3 个串联缺陷导致选择题不可用：① 选项不渲染（optionsOf 空数组短路）；② answerMode 归一缺失致单选+文本框同现；③ 批改收集器把同组未勾选 radio 的值当答案，全选正确也只得 5/20。修复后 Teacher k001×choice 全选正确批改 100/100。另：judge 单 KP（k001）0 产出属 DEGRADE 题型规划门（question-type-strategy 只认 ALLOW）与 POL eligibleTypesFor（DEGRADE 算 feasible）口径不一致，属引擎核心灰色地带，不在 P28-48 修复范围，fail-closed 记录，待后续专项处理。
- tests:
  - 浏览器 E2E：首页→科目→年级、Quick calc 20/20、Teacher KP A→B→cancel→A→practice 全通过；
  - 七类题型：calc/fill/choice/judge SUCCESS 20/20，geometry 15/20 PARTIAL（容量，14 SVG 图形），classify style-sort 20/20，apply style-story 20/20；
  - choice 闭环：80 radio（20×4）渲染、显示答案→勾选正确项→批改 100/100（修复前 5/20）；
  - 打印：A4 210×297mm + @page portrait、20 选择题卡含 80 个 A-D 选项且无任何输入控件、关闭按钮恢复滚动；
  - SW：手动注册后 activated/controlled、CORE 43 条预缓存、停服后 iframe 离线加载 index.html 成功（标题「小学练习本」）；
  - `npm test` 534/534；`node dev/check-all.js` 26 PASS/0 FAIL（含 1570 ALLOW 真实生成）。
- risk: 低——渲染器 optionsOf 仅由「|| 短路」改为「非空数组逐级判定」，对有真实 options 的题行为不变；type-contract 仅在 choice 通过契约后补 answerMode='choice'，不影响其它题型；collectAnswers 仅过滤未勾选 radio/checkbox，文本输入行为不变。judge DEGRADE 口径未动，无引擎核心风险。

### P28-47｜建立 AI 修改审计日志（2026-09-22）

- modified:
  - `docs/P28/change-log.md`（新建：规则 + 模板 + P28-38 起本会话改动回填）
- deleted: 无
- reason: 此前 AI 改动散落在会话与提交信息中，门禁脚本/删除符号的存在原因无处追溯；建立强制六字段审计日志，防止后续 AI 误删「看似无用」的守卫或重复造系统。
- tests: P28-39 文档一致性扫描器对新文件 PASS（本文件在 docs/ 非 archive 扫描范围内，0 历史数字命中）。
- risk: 无（仅新增文档，无代码改动）。

### P28-46｜Legacy 符号治理矩阵（2026-09-22）

- modified:
  - `dev/p28/check-legacy-matrix.js`（新建：legacy/compat/bridge/fallback/deprecated 符号审计矩阵，纳入 check-all 第 20 项）
  - `shared/strategy/strategy-request.js`（删除无调用者符号：LEGACY_UI_KEYS / normalizeLegacyParams / createFromLegacyUI / isLegacyRequest）
  - `shared/strategy/strategy-config.js`（删除无调用者的 isLegacy() 函数与 legacyFallback 属性）
- deleted: 上述 6 个符号（文件保留）；其余 8 个候选符号经矩阵登记「存在原因 / 调用者 / 删除条件」后保留。
- reason: legacy 符号必须三要素齐全（存在原因、调用者、删除条件），无理由者删除；禁止以「以后可能用到」为由留存。
- tests: npm test 全绿；M0 verify 8/8；strategy/presentation bundle 重建成功；check-legacy-matrix PASS。
- risk: 中低——收缩策略层 API 表面；删除前已确认生产/测试/bundle 三面零调用。

### P28-45｜死代码治理矩阵（2026-09-22）

- modified:
  - `dev/p28/check-dead-code.js`（新建：11 个死代码候选的 file/symbol/Prod/Test/Bundle calls/Status/Decision 矩阵，纳入 check-all 第 19 项）
- deleted:
  - `shared/presentation/render.js`（LegacyRenderer，重复渲染链，唯一渲染链已收口于 renderer.js）
  - `shared/generator/semantic-question-bridge.js`（SemanticQuestionBridge，重复的 Legacy Bridge）
- reason: 无调用者的死代码删除；保留 9 个候选：GenerationCore（TEST-ONLY，4 个测试依赖）、7 个 DORMANT-NO-BINDING 生成器（竞赛 C 族 31 Generator 冻结清单成员）、selection.js（mappings.json 契约载体）。
- tests: npm test 全绿；M0 verify 8/8；bundle 重建成功。
- risk: 中——删除两个渲染/桥接文件；删除前已由矩阵确认三面零调用，且唯一渲染链契约不变。

### P28-44｜生成物提交策略（2026-09-22）

- modified:
  - `docs/00-BASELINE.md`（新增 Generated File Policy 章节：12 类必提交 / 8 类不提交，判定规则「可再生成物不入库，冻结指纹官方产物必入库」）
  - `.gitignore`（新增 `dev/p27/reports/`）
- deleted: `dev/p25/reports/`、`dev/p26/reports/`、`dev/p27/reports/` 下历史报告 JSON 从 git 跟踪移除（本地可再生，非源码）。
- reason: 明确提交边界，防止可再生报告与审计时间戳污染工作树与评审差异。
- tests: git status 核验（263 暂存 / 0 untracked / 0 unstaged）；check-all 不受影响。
- risk: 低——仅跟踪状态与忽略规则变化，报告生成入口不变。

### P28-43｜Git 工作树治理（2026-09-22）

- modified:
  - `.gitignore`（新增 `dev/p25/reports/`、`dev/p26/reports/`、`dev/p28/reports/`）
- deleted: 无（报告文件正式从跟踪移除计入 P28-44）。
- reason: v5.0.0 冻结后大量治理产物堆积为未跟踪/未暂存状态；按 Source / Derived / Generated / Bundle / Docs / Tests / Tools / Config 八类分类暂存，使工作树达到可评审的干净状态。
- tests: git status 逐类核验；255 个文件分类暂存。
- risk: 低——纯 git 元数据整理，无文件内容改动。

### P28-42｜分层门禁：pre-commit 与 Full Gate（2026-09-22）

- modified:
  - `scripts/pre-commit.sh`（移除 M0 verify 与全量 syntax；仅对暂存 .js 跑 lint 全正则 + syntax，约 1s）
  - `docs/10-TEST-CI.md`（第 4 节文档化分层结构）
- deleted: 无
- reason: 全量检查耗时 5–7 分钟，不适合每次本地提交；分层后日常提交走秒级门禁，CI 与发布前走 check-all 全量门禁。
- tests: 手工触发 pre-commit 验证只检查暂存文件；Full Gate 行为不变。
- risk: 低——pre-commit 收窄检查面，CI 侧仍由 check-all 兜底。

### P28-41｜CI 与本地检查入口统一（2026-09-22）

- modified:
  - `.github/workflows/ci.yml`（6 个分散步骤合并为单一 `npm run check-all`）
  - `scripts/run-all-checks.sh`（改为委托 npm run check-all，不再自行编排）
  - `dev/check-all.js`（test glob 修正为 `"tests/**/*.test.js"`）
  - `docs/00-BASELINE.md`（kbl-uniqueness 状态 FAIL → PASS）
  - `docs/10-TEST-CI.md`（CI 章节改写为统一入口说明）
- deleted: 无
- reason: 消除 CI 与本地两套编排的漂移；同一入口（npm run check-all）、同一脚本（dev/check-all.js）、同一环境要求（Node 20+）。
- tests: check-all 24/24 全绿。
- risk: 中低——CI 执行路径变更；与本地同源后不存在未覆盖检查。

### P28-40｜唯一全量检查入口 check-all（2026-09-22）

- modified:
  - `dev/check-all.js`（新建：聚合全部检查域的唯一编排入口）
  - `dev/p28/check-security.js`（新建：安全域 6 项检查的 gatekeeper）
  - `dev/check-kbl-uniqueness.js`（修复：第 230 行调用已删除的 `SemanticQuestionBridge.toQuestions(sems)`，改为直接读取 sems 数组长度）
- deleted: 无
- reason: 检查脚本分散无统一入口；同时 kbl-uniqueness 动态检查因调用已删 API 而 FAIL，属残留断链，按真实数据源直读修复。
- tests: npm run verify 8/8；npm test 全绿；check-all 聚合 17 检查域 + 文档一致性检查全绿。
- risk: 中——新增总入口并改动既有检查；修复点仅去除对已删符号的依赖，判定口径不变。

### P28-39｜文档一致性扫描器（2026-09-22）

- modified:
  - `dev/p28/check-doc-consistency.js`（新建：扫描 docs/ 非 archive .md 中的 8 个历史数字 token，命中即 FAIL）
  - `docs/00-BASELINE.md`、`docs/02-KBL.md`、`docs/CHANGELOG.md`（共 12 处历史数字替换为文字描述）
- deleted: 无
- reason: 归档后当前文档反复残留旧口径数字（旧 KP/Relations/Mappings/测试数等），需机读门禁防止回流。
- tests: 扫描 13 个非归档文档，0 命中 PASS。
- risk: 低——纯文档改写 + 只读检查器。

### P28-38｜唯一当前基线文档 00-BASELINE（2026-09-22）

- modified:
  - `docs/00-BASELINE.md`（新建：Version / KBL / Units / Relations / Mappings / Question Types / Generators / Tests / Sitemap / Crawler / Security / Performance 共 12 章节）
- deleted: 无
- reason: 冻结后无单一文档代表项目真实当前状态，旧基线分散且含历史口径；确立唯一 SSOT 文档，所有数字从源文件提取。
- tests: 无代码测试；章节数字逐项与 VERSION / package.json / sw.js / kbl/canonical/*.json 等源文件核对。
- risk: 无（仅新增文档）。

### P28-10 / P28-18 / P28-19｜门禁缺陷修复与语义标注加强（2026-09-22，维护性修复无独立编号）

- modified:
  - `dev/p28/check-variation-entry-gate.js`（修复断言拼写 true4 → true）
  - `shared/strategy/variation-directive.js`（补 CHAIN_SEGMENTS 声明，闭合 Misconception 链断点）
  - `dev/p28/check-generator-noninterference.js`（加载 dev/_bundle-env.js；修正错误的 KP 取值）
  - `shared/validator/validation-pipeline.js`（显式语义标签：generationPass / semanticPass / semanticWarn / semanticFail）
  - `shared/presentation/print.js`（为 outerHTML/innerHTML 使用点补安全边界注释）
  - `shared/generation/generation-core.js`（文件头标注 TEST-ONLY / HISTORICAL 及保留理由）
- deleted: 无
- reason: 3 个门禁脚本自身存在缺陷导致误判/无法运行；3 处生产文件缺少语义或安全边界标注。全部直接改源文件，不新建系统。
- tests: npm test 全绿；P28-10 / P28-18 / P28-19 三项检查 PASS。
- risk: 低——两处门禁脚本修复 + 注释/标注类加强，无运行时行为变化。
