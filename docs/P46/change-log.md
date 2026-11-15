# P46 三模式交互升级变更日志

> 规则：最新记录在上，append-only；每任务登记 modified / deleted / reason / tests / risk。
> 阶段任务与验收口径见 `docs/P46/P46-TASK-BOOK.md`；每阶段过门须用户确认。

## P46-11｜版本升级 5.3.0 与全项目文档一致性收口（2026-11-15）

- **modified**：版本四方 `VERSION` / `package.json` / `shared/catalog/version.js` / `sw.js CACHE` 由 5.2.1 → **5.3.0**；`docs/00-BASELINE.md` 版本号与 SW 缓存名；`README.md` 版本号、测试实际数（110 文件/993 用例 → **114 文件/1064 用例**）、首段产品描述补三模式；`docs/CHANGELOG.md` 顶部新增「v5.3.0 — P46 三模式交互升级」；`docs/DESIGN-REPORT.md` 版本行与增量说明、§15 当前状态摘要（日期/门禁 34-0-0/测试 1064）、§16「Browser E2E 本机无 Chrome」改为**已解除**、新增 §16.1「P46 三模式遗留 / 债务登记」表（9 项）。
- **deleted**：无。
- **reason**：用户显式指令「升级版本号，整理项目全部文档保持项目信息的一致性，并整理挂起、债务、遗留项」。语义化版本判定：新增三模式产品能力、向后兼容 → minor，5.2.1 → 5.3.0。文档一致性以 `docs/00-BASELINE.md` 为唯一事实源，历史冻结文档（P30/P31 规则、旧 CHANGELOG 条目、P46 历史 change-log）不改写。
- **tests**：`npm test` **1064 PASS / 0 FAIL**（114 文件）；`CHROME_BIN=… node dev/check-all.js` **34 PASS / 0 FAIL / 0 SKIP**（含 16/17 bundle 确定性与 20 Doc 历史数字扫描，验证版本升级无回归）。
- **risk**：仅版本常量与文档变更，无生产逻辑改动；线上仍为 5.2.0，发布需单独授权；遗留/债务共 9 项已集中登记于 `docs/DESIGN-REPORT.md` §16.1（4 遗留 / 3 债务 / 1 事实 / 1 发布）。未 git commit。

## P46-10｜最终全量门禁与冻结收口（2026-11-15）

- **modified**：`docs/00-BASELINE.md` — Version 表新增两行事实：「产品模式 家庭 home / 试卷 exam / 教师 teacher（URL `mode` + `practiceKind`/`practiceFocus`/`examType`/`unitIds`）」与「试卷题量 固定 40 题（POL 模板，页面只读，容量不足显示 PARTIAL 提示）」。除此之外未改任何生产代码。
- **deleted**：无。
- **reason**：P46 三模式全部落地（P46-01~09），按任务书执行最终门禁与冻结收口，将产品形态事实写入唯一基线；门禁项数经实测为 34 项，与基线既有「合计 34 项」一致，无需改口径。
- **tests**：定向 6 文件 **109 PASS / 0 FAIL**；`npm test` **1064 PASS / 0 FAIL**；`CHROME_BIN=… node dev/check-all.js` **34 PASS / 0 FAIL / 0 SKIP / 34 项**（含 6a 1566 真实生成、6b 矩阵冻结、15 真实浏览器三模式、16/17 bundle 确定性、21/22 死代码与 Legacy）；KBL 实测 **KP 375 / Units 98 / Relations 407 / ALLOW 1566**（course 逐册 unitCount：g1上6 g1下8 g2上8 g2下7 g3上9 g3下8 g4上9 g4下10 g5上9 g5下11 g6上7 g6下6，与 P46-06 范围算法核验一致）；七题型集合未变。
- **risk**：交付区无临时探针/调试日志/规划外文件（`git status` 仅 P46 规划内 12 个 modified + 4 个新增测试 + `docs/P46/`）；版本号仍为 5.2.1，未升版、未 commit（按任务书另行指令执行）。
- **冻结记录（P46-FINAL）**：产品三模式 = 家庭（计算/应用题 + 五项计算专项 + 单元多选）/ 试卷（单元·期中·期末，固定 40 题，期中取前半册 `ceil(n/2)`）/ 教师（课本顺序章节 + KP 多选 + 七题型 + 配比）；请求契约 `mode/practiceKind/practiceFocus/examType/unitIds`；规划级 `examType` 仅 POL 消费；E2E 路径 = select 三模式 → 首页 → 家庭 → 试卷三类型 → 教师 → KP → 七类 → 重生成 → 刷新 → 打印。
- **未授权遗留项（登记不处理）**：① `docs/P31/p31-layout-rules.md` 与 P30 规则文档的门禁项数（30/27）属历史冻结口径，按 append-only 不改，当前事实以基线 34 项为准；② `.type-card.competition`、`.quick-switch`、Strategy/Generation 内部 quick/competition 编排模式保留（三方零消费证据不足，P46-08 已登记）；③ 「单元数=1 的册别」真实数据不存在，未编造样本；④ 试卷在 3 KP 小样本下 PARTIAL 39/40 属真实容量不足，非缺陷，已有可见提示；⑤ 版本号与发布未执行。

## P46-09｜真实浏览器三模式验收与断链修复（2026-11-15）

- **modified**：`dev/e2e/browser-e2e.js` — `runScenario` 的 dom 采集扩展 `countValue / countReadOnly / ratioText / ratioTotal`；新增 Step 0「select 三模式」（mode 选项 home/exam/teacher、stage 显隐、未选单元开始禁用、选单元后 href 含 `examType=unit&count=40`；分步 await 以等待异步 `ensureKnowledge`）；新增 Step 2b「试卷模式」（unit/midterm/final 各跑一次，URL 故意 `count=7` 验证归一 40、标题正确、题量只读、固定 40 或明确容量不足且有可见提示、总题量显示 40）；Step 2 家庭模式断言沿用。`dev/check-all.js` / `dev/p28/check-browser-e2e.js` — 第 15 项文案更新为「真实浏览器 三模式 + 9 步路径」。`practice.html` — `finalizeRender()` 末尾重放 `applyPartialNotice(null)`。
- **deleted**：无。
- **reason**：P46 三模式必须在真实 Chrome 走通选择页→家庭→试卷→教师全路径。验收中发现真实断链：逐块渲染的 `updateGenProgress(39,39)` + `hideGenProgress()` 覆盖了生成反馈阶段的 PARTIAL 提示，导致「试卷要求 40 题、容量不足只出 39 题」时用户无任何说明（静默少题，违反「明确容量不足」口径）。归属唯一层 Presentation（practice.html 渲染层），以最终态重放提示修复，未改 POL/Generator 配额算法。
- **tests**：真实 Chrome（CHROME_BIN 指向本机 Google Chrome）`node dev/p28/check-browser-e2e.js` exit=0，0 失败步骤；Step 2b 三类型均 `status=PARTIAL / produced=39 / ratioTotal=40 题 / gp.hidden=false / gp.text=本次已生成 39 / 40 题 · 部分题型/知识点暂无足够题目`；`npm test` 1064 PASS / 0 FAIL；`CHROME_BIN=… node dev/check-all.js` **34 PASS / 0 FAIL / 0 SKIP**（第 15 项真实浏览器 PASS，达成 CI 口径）。
- **risk**：PARTIAL 提示文案与进度条复用既有 UI，不新增组件；修复只影响渲染最终态，SUCCESS 路径 `applyPartialNotice` 首行即 return，行为不变；E2E 新增两步使路径由 9 步扩为「三模式 + 9 步」，门禁仅校验退出码，不影响其他项。基线文档 34 项口径与 P31 规则文档 30 项口径的漂移留待 P46-10 收口。未 git commit。

## P46-08｜旧模式物理清理（2026-11-15）

- **modified**：`dev/e2e/browser-e2e.js` — Step 2 由 `mode=quick` 切换为 `mode=home&practiceKind=calc&practiceFocus=all`，步骤标签「快速练习」→「家庭练习」（定点更新仍指向旧模式的唯一入口）。`shared/bridge/practice-bridge.js` — 顶部 GenerateInstruction 契约注释更新：`mode` 改为产品三模式 home/exam/teacher 并注明内部编排模式另见 PracticeOrchestrator，补 `practiceKind / practiceFocus / examType` 字段说明，`knowledgePoints` 注释「快速模式」→「multi-kp 编排模式」。`tests/presentation/select-page-contract.test.js` — 新增 P46-08 五条清理证据断言。
- **deleted**：`select.html` 竞赛模块卡死 CSS 4 条（`.module-card`、`.mc-icon`、`.mc-desc`、`.module-card.on .mc-desc`）—— 全项目 HTML/JS 零消费者，物理删除。
- **reason**：P46 产品三模式上线后，旧 quick/competition 产品入口与专属样式不得留残；按 §11.3，对不满足「生产代码零消费者 + 无门禁依赖 + 测试三方印证」的候选一律保留并登记，不强行扩删。
- **保留并登记（不删）**：`shared/strategy/strategy-engine.js`、`shared/generation/api.js`、`shared/knowledge/question-type-registry.js` 内的 quick/teacher/competition **编排内部模式**（有生产消费者，属合法能力）；`shared/styles/components.css` 的 `.type-card.competition`、`shared/styles/subjects.css` 的 `.type-card:not(.competition)`（三级页/通用样式依赖）；`shared/styles/pages.css` 的 `.quick-switch`（首页快速切换控件，非产品模式）；SVG competition 图形类型（合法渲染类型）。均在三方证据不足前不删。
- **tests**：定向 `node --test tests/presentation/select-page-contract.test.js` 60/60 PASS（新增 5 条：无 `.module-card` 死 CSS、全站页面/E2E 无 mode=quick|competition、E2E 已切 mode=home、Strategy 内部模式未被误删、竞赛 KP 过滤保留）；`node --check dev/e2e/browser-e2e.js` 通过；`npm test` 1064 PASS / 0 FAIL；`node dev/check-all.js` 33 PASS / 0 FAIL / 1 SKIP（含 21 Dead Code、22 Legacy、16/17 bundle 确定性）。
- **risk**：清理只涉及产品入口与死样式，KBL/POL/Strategy/Generator/Validator/难度未改；E2E Step 2 行为变更待 P46-09 在真实 Chrome 下复验（本机无 Chrome，第 15 项 SKIP 属既有口径）。未 git commit。

## P46-07｜练习页三模式控制、标题与计划预览（2026-11-15）

- **modified**：`practice.html` — `parseUrlParams` 新增 `practiceKind/practiceFocus/examType` 解析，`examType` 白名单 unit/midterm/final，合法时 `count` 归一为 40；`state` 新增 `examType` 并在 boot 赋值；新增 `isExamMode`；boot 恢复上次设置时排除试卷模式；`setCount` 试卷模式直接返回；`syncCountUI` 试卷模式 `readOnly` + `aria-readonly` + 提示「试卷固定 40」；`deriveTypeName` 新增 `EXAM_TITLE`（单元/期中/期末测试）与 `FOCUS_TITLE`（五项计算专项）及家庭大类标题，屏幕 `#sheetTitle` 与打印共用同一 `buildTitle`；`ratioPolView` 预览签名加入 `difficulty` 与 `examType`，并透传 `examType`；`renderKpRatio` 试卷分题型输入 `readonly`，`onCommit` 拦截不回写显式 `typeCounts`，并展示 `quotaAdjustments` 容量重分配明细；`initPracticeSession` 透传 `examType`。`shared/catalog/catalog-utils.js` — `capabilityPlanView` 透传 `examType`，返回新增 `quotaAdjustments`、`examType`、`targetTotal`。`shared/bridge/practice-bridge.js` — `plan()` 的 profile 新增 `examType` 透传（页面 state → profile → sessionConfig）。
- **deleted**：无。
- **reason**：练习页须按三模式呈现：试卷固定 40 题、题量与分题型只读（POL 模板分配）、标题使用产品语义（单元/期中/期末、计算专项、应用题）；预览须与真实生成共用同一 POL 模板，难度或试卷类型变化必须触发重算。
- **tests**：新增 `tests/presentation/practice-page-contract.test.js` 17 条（页面结构 14 条 + 共享层 `capabilityPlanView` 3 条：考试透传与 quotaAdjustments、count=1/50 均规划 40、非试卷不改题量）；定向 17/17 PASS；`npm test` 1059 PASS / 0 FAIL；`node dev/check-all.js` 33 PASS / 0 FAIL / 1 SKIP（含 16/17 bundle 确定性与 6a/6b 1570 矩阵无漂移）。
- **risk**：仅改页面与预览透传，KBL/POL/Strategy/Generator/Validator/难度公式未改；试卷题量 40 由页面归一 + POL 强制双保险；`quotaAdjustments` 仅展示不参与决策；练习页三模式观感与真实浏览器打印一致性待 P46-09 验收。未 git commit。

## P46-06｜试卷范围与摘要交互（2026-11-15）

- **modified**：`select.html` — 新增 `examScopeBuckets(entries)`（单元测试=所选单单元且未选返回空；期中=`slice(0, Math.ceil(n/2))` 前半册；期末=整册）与 `examScopeKps(entries)`（按 KP id 去重收集），作为试卷范围的唯一来源；`renderExam` 改为三分支渲染：单元测试展示单选卡，期中/期末展示只读 `data-scope-unit` 范围卡（不绑定点击），标题显示「期中范围 · 前半册 / 期末范围 · 全册（N 个单元 · M 个知识点）」；`collectKps` 试卷分支改为 `out = examScopeKps(entries)`，与摘要共用同一 KP 池；`renderSummaryBody` 试卷摘要新增「覆盖 N 个单元（前半册/全册）」「单元名列表」「知识点 N 个 · 40 题」，单元测试摘要显示所选单元名；`updateStartBtnUrl` 试卷空态细分为「未选测试单元」与「范围为空」两档提示。
- **deleted**：无。
- **reason**：期中/期末必须自动确定范围且不跨册，单元测试必须显式选单元；范围算法只允许一处实现，避免摘要显示与请求 KP 池不一致（任务书验收断言）。
- **tests**：定向 `node --test tests/presentation/select-page-contract.test.js` 55/55 PASS（新增 P46-06 十条：范围算法单点、奇数向上取整、未选单元不放行、KP 去重、collectKps 复用、范围卡只读、摘要覆盖与 40 题、单元名回显、两档空态、范围标题计数；并同步修正 P46-04/P46-05 两条旧断言到新模型，未删用例）；`npm test` 1041 PASS / 0 FAIL；`node dev/check-all.js` 33 PASS / 0 FAIL / 1 SKIP。
- **risk**：仅改 select.html UI 范围与摘要，KBL/POL/Strategy/Generator/Validator/难度未改；真实数据核对——奇数单元册别 g2下=7、g3上=9、g4上=9、g5上=9、g5下=11、g6上=7（期中向上取整），偶数册别 g1上=6、g1下=8、g2上=8、g3下=8、g4下=10、g6下=6；「单元数=1 的册别」真实数据中不存在，不编造样本，`ceil(1/2)=1` 逻辑上退化为整册。POL 计划预览与 quotaAdjustments 展示留待 P46-07；试卷范围交互待 P46-09 真实浏览器验收。未 git commit。

## P46-05｜家庭模式专项与空能力交互（2026-11-15）

- **modified**：`select.html` — 新增 `FOCUS_RULES`（凑十/破十/口算加减/口算乘除/竖式笔算五条关键词规则）与 `focusMatch(kp, focusKey)`，判定输入仅 `kp.name + kp.unit`，不硬编码任何 KP ID；新增 `homePool(entries)` 家庭候选池（竞赛过滤 → 册别 → 大类能力 calc/apply → 计算专项）；新增 `focusAvailable(entries, focusKey)` 供专项卡计数（只按册别+大类，不受已选单元影响，避免计数抖动）；`renderHome` 专项卡显示可用知识点数、0 时 `disabled` + 「本年级暂无」且不绑定点击，当前专项失效时自动回退「计算综合」，单元卡数量与可用性改按当前大类+专项统计、0 时置灰；切换大类/专项清空已选 `homeUnitIds`；`collectKps` 家庭分支改为 `homePool` + 单元过滤；`updateStartBtnUrl` 新增空态门禁（家庭无可用 KP、试卷单元测试未选单元 → 禁用开始并给出行内提示）；`renderSummaryBody` 家庭摘要新增「知识点 N 个可生成 / 当前范围暂无」。
- **deleted**：无（P46-04 遗留的专项骨架注释「P46-05 接通」已随实现移除）。
- **reason**：家庭模式需按计算专项真实裁剪 KP 范围，并在无能力时明确空态；专项不得成为第二套题型系统，故仅作 UI 层范围筛选（关键词规则），不进入生成链，calc/apply 题型集合不变。
- **tests**：定向 `node --test tests/presentation/select-page-contract.test.js` 45/45 PASS（新增 P46-05 十二条：规则表齐全、无 KP ID 硬编码、大类能力过滤、collectKps 复用 homePool、空能力置灰、自动回退、单元卡计数、两类空态门禁、切换清空单元、disabled 不绑事件、摘要知识点数）；`npm test` 1031 PASS / 0 FAIL；`node dev/check-all.js` 33 PASS / 0 FAIL / 1 SKIP。
- **risk**：专项判定为名称/单元关键词，属 UI 筛选口径，KBL/Generator/Validator/难度未改；真实数据核对结果——g1 凑十 1 / 破十 1 / 加减口算 7 / 竖式 3，g2 加减口算 1 / 竖式 3，g3 四则口算 2 / 笔算 2，g4 四则口算 1 / 笔算 1，g5–g6 六专项全空（作为空能力样本）。任务书预留的「部分单元支持 apply」样本在真实数据中不成立（各年级 apply 覆盖单元数=总单元数），故改为以「按单元多选后 apply KP 数小于全册」验证范围裁剪；不编造数据。专项筛选行为待 P46-09 真实浏览器验收。未 git commit。

## P46-04｜选择页与请求边界一次性切换三模式（2026-11-14）

- **modified**：`select.html` — DOM：`stageQuick`→`stageHome`（大类卡 homeKindGrid + 计算专项卡骨架 homeFocusGrid + 单元多选 homeUnitGrid），`stageCompetition`→`stageExam`（试卷类型 seg examTypeSeg + 单元单选 examUnitGrid），册别控件拆为 bookWrapHome/Exam/Teacher（exam 无"不限"），三个开始按钮合并为单一 `startBtnPractice`；CSS：`#typeGridQuick`→`#homeKindGrid,#homeFocusGrid,#teacherTypeGrid`，`#unitGridQuick`→`#homeUnitGrid,#examUnitGrid`；JS 全部重写：`MODE_DESC` 改 home/exam/teacher，`state` 三模式独立（homeBook/homeKind/homeFocus/homeUnitIds、examBook/examType/examUnitIds、teacherBook/teacherUnitIds/teacherKps/teacherTypes），URL 初态白名单改三模式，`unitBuckets` 改按 `unitId` 分桶 + `unitNo` 课本顺序升序，新增 `renderHome/renderExam`，`renderTeacher` 切换 unitId 匹配，`collectKps` 三模式分支（home 按大类+单元；exam 按试卷类型范围，count=40、types=七题型；teacher 显式 KP），`updateStartBtnUrl` 透传 practiceKind/practiceFocus/examType/unitIds，`renderSummaryBody` 三模式摘要，册别/试卷类型事件绑定。`tests/presentation/select-page-contract.test.js` — 按新契约重写（33 用例：三模式 ID、无旧 DOM、unitId 分桶、课本顺序、试卷 count=40、状态隔离等）。`tests/orchestration/request-contract.test.js` — 默认 mode `quick`→`home`，URL 示例改 `mode=home`。
- **deleted**：select.html 内 `stageQuick`、`stageCompetition`、`startBtnQuick/Teacher/Competition`、`typeGridQuick`、`unitGridQuick`、`compModuleGrid`、`bookSegQuick`、`bookWrapQuick` 等旧 DOM；JS 内 `quickBook/quickUnits/quickTypes`、`competitionModules`、`QUICK_TYPE_DEFS`、`renderQuick`、`renderCompetition`、`competitionModulesFor`、`unitKey/unitNameOf` 复合 key 辅助函数。
- **reason**：P46 产品只保留家庭/试卷/教师三模式；旧 quick/competition 产品入口必须物理删除不留双轨。选择页只做模式/范围/题型选择，题量难度仍在练习页；家庭专项筛选（P46-05）、试卷期中/期末范围细化（P46-06）、练习页三模式控件（P46-07）在后续任务接通。
- **tests**：定向 `node --test tests/presentation/select-page-contract.test.js` 33/33 PASS；`npm test` 1019 PASS / 0 FAIL；`node dev/check-all.js` 33 PASS / 0 FAIL / 1 SKIP。
- **risk**：select.html 未改 KBL/Generator/Validator/难度；`unitBuckets` 仅展示排序不进生成链；试卷 count=40 由页面 + POL 双重强制；家庭专项 homeFocus 仅 UI 骨架与状态，真实 KP 范围筛选在 P46-05 接通；死 CSS `.module-card` 留待 P46-08 清理；E2E 脚本（browser-e2e.js）旧模式引用留待 P46-09 更新。未 git commit。

## P46-03｜examType 会话透传与规划边界（2026-11-14）

- **modified**：`shared/bridge/practice-bridge.js` — `sessionConfig` 新增 `examType` 字段从 profile 透传至 config；`shared/engine/practice-session.js` — config 构造新增 `examType`（缺省 null），`_buildGenerationRequest` 在非 null 时写入 req。新增测试 `tests/orchestration/p46-exam-transport.test.js`（5 用例：Bridge 透传、缺省 null、Session req 携带、null 不写入、集成不进 cell）。
- **deleted**：无。
- **reason**：试卷模板需经完整产品链传递；examType 是规划级字段，必须到 POL 但不得进入 cell/Generator（POL cellReq 白名单已显式排除）。
- **tests**：定向 5/5 PASS；`npm test` 1017 PASS / 0 FAIL；`check-all` 33 PASS / 0 FAIL / 1 SKIP。
- **risk**：PracticeSession 内部 `single-kp/multi-kp/adaptive` 模式未变；examType 不影响 Strategy 模式选择；cellReq 不含 examType 有集成测试断言；KBL/bundle/矩阵无漂移。未 git commit。

## P46-02｜POL 试卷模板与确定性重分配（2026-11-14）

- **modified**：`shared/orchestration/practice-orchestrator.js` — 文件头契约登记 `examType` 为规划上下文（不进 cell）；新增 `EXAM_TYPES / EXAM_TEMPLATE / EXAM_TOTAL / EXAM_REALLOC_PRIORITY` 常量与 `examAllocation(feasibleTypes, typeCaps)` 函数（固定 40 题 + 七题型基准配额 + 不可行/容量不足题型按优先级循环补 1 题重分配）；`plan()` 合法 `examType` 时强制 count=40、优先使用 `examAllocation`、视为显式组合（recovery 不跨题型补齐）、result 增加 `quotaAdjustments` 与 `examType`；API 导出 `examAllocation/EXAM_TEMPLATE/EXAM_TOTAL/EXAM_TYPES`。新增测试 `tests/orchestration/p46-exam-allocation.test.js`（9 用例）。
- **deleted**：无。
- **reason**：试卷模式需固定题量与题型配额；直接下发同一份 typeCounts 会因部分单元题型不可行导致 plannedTotal 不足且无说明，故在 POL 规划层做确定性重分配并输出调整明细。
- **tests**：定向 9/9 PASS；编排层回归 54/54；`npm test` 1012 PASS / 0 FAIL；`check-all` 33 PASS / 0 FAIL / 1 SKIP。
- **risk**：仅 `examType` 合法时触发，非试卷路径（含显式 typeCounts）行为完全不变；`examAllocation` 不写 KBL、不进 Generator；cellReq 白名单不含 examType；1566 矩阵与 bundle 确定性无漂移。未 git commit。

## P46-01｜KnowledgeContext 课本顺序只读投影（2026-11-14）

- **modified**：`shared/orchestration/knowledge-context.js` — `uiKp` 新增 `unitId / unitNo / knowledgeNo / sourceIndex` 四个只读字段（unitNo 即 runtime emitted canonical 的单元序号，等价 canonical.unit.unitOrdinal）；`uiKp(null/undefined)` 判空不变，空对象返回全 null 投影，`id` 由直接赋值改为 `!= null ? : null` 消除 undefined；新增纯函数 `parseKnowledgeNo / compareKnowledgeNo / compareByTextbookOrder / sortByTextbookOrder` 并导出；`uiListForGrade` 返回前按课本顺序（册别 up→down→unitNo→knowledgeNo 数值→sourceIndex）排序，并注入 sourceIndex。新增测试 `tests/orchestration/knowledge-context-ui.test.js`（10 用例）。
- **deleted**：无。
- **reason**：P46 教师模式要求按课本顺序展示单元与 KP；当前 `select.html` 的 `unitBuckets()` 按单元中文名排序不符合课本顺序。本任务只在 KnowledgeContext UI 投影层补字段与排序纯函数，不改 KBL、不进生成链、不改 select.html（留给 P46-04）。
- **tests**：定向 `node --test tests/orchestration/knowledge-context-ui.test.js` 10/10 PASS；编排层回归（pol-generation / p10-count / p10-2-scope / p11-00 / p11-02）35/35 PASS；`npm test` 1003 PASS / 0 FAIL（原 993 + 新增 10）；`node dev/check-all.js` 33 PASS / 0 FAIL / 1 SKIP（#15 无 Chrome）。
- **risk**：`uiListForGrade` 返回顺序由 runtime 原始顺序变为课本顺序，唯一生产消费者为 `select.html` 的 `fullKPEntries`（仅展示），不进入生成链；bundle/strategy 未改，16/17 确定性 PASS；KBL hash 不变，375/98/407/1566 与 1566 ALLOW 矩阵无漂移。未 git commit。

## P46-INIT｜三模式交互升级完整开发任务书建档（2026-11-14）

- **modified**：新建 `docs/P46/P46-TASK-BOOK.md`（家庭/试卷/教师三模式交互、请求契约、POL 试卷配额、P46-01～10 实施任务、旧模式清理、真实浏览器矩阵与最终冻结收口）；新建 `docs/P46/change-log.md`（本文件）。
- **deleted**：无。
- **reason**：用户明确要求将三模式方案细化，补充项目升级整改后的清理与收口，并形成完整交互升级开发文档；本次仅建档，不授权生产代码实施。
- **tests**：纯文档变更，未运行测试或门禁，未声明任何新 PASS 结果；当前基线仍引用 `docs/00-BASELINE.md` 的 993 PASS / 0 FAIL、34 项门禁口径。
- **risk**：无生产代码、KBL、bundle、冻结矩阵或生成物改动；任务书状态为“待用户确认”，后续须从 P46-01 开始并逐阶段签收；未 git commit。
