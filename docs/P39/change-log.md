# P39 变更日志（死代码清理战役）

> 战役性质：P37/P38 收口后用户指令「清理最近决策产生的无效死代码」——rawType 死链全链清零
> （P37-02 F-TYPE-2 修复③的直接后续：rawType 语义死亡 → 消费链 + 数据字段物理删除）。
> 铁律：三方印证后物理删除不留壳；断言随证据重写为防双轨负断言；重建 bundle + 全量门禁。
> 日志 append-only，六字段，最新在上。

---

## P39-10 · 小版本标记 v5.1.0 → v5.2.0（2026-10-12）

- **modified**：
  - `shared/catalog/version.js`：`APP_VERSION = '5.2.0'`（版本 SSOT）。
  - `sw.js`：`const CACHE = 'hw-help-5.2.0'`（与 APP_VERSION 同步，scripts/sync-sw-version.js 校验面）。
  - `package.json`：`version = 5.2.0`。
  - `VERSION`（根文件）：`5.2.0`（00-BASELINE §Version 三方一致口径：VERSION = package.json = version.js = sw.js CACHE）。
  - `docs/00-BASELINE.md` §Version：版本号与 SW 缓存名两行 → 5.2.0。
  - `docs/CHANGELOG.md`：「未发版 — P34–P39」节正名为 **v5.2.0 — P34~P39 收口（2026-10-12）**。
- **deleted**：无。
- **reason**：用户显式指令「做一次小版本更新标记」。v5.1.0（P30/P31/P32 收口）以来累计 P33（仓库清理/部署/IndexNow/百度提交）~P39（rawType 死链清零、图形子类型白名单对齐、107 图形断链修复（P38）、needs-review 意图行清账、文档口径全量对齐、开发文档/文件清洗、四面断链核查零断链），按语义化版本取 minor（无破坏性变更）→ **5.2.0**。代码注释中的 V5.1.0 字样为历史特性引入标记，不随 bump 改写。
- **tests**：`node scripts/sync-sw-version.js` **PASS**（'hw-help-5.2.0' 与 APP_VERSION '5.2.0' 一致）；`check-bundle-determinism --mode bundle` **PASS**（presentation-engine 7ca84aa8…稳定，version.js 不在 bundle 构建清单，无需重建）；`--mode determinism` **PASS**；`node dev/p28/check-doc-consistency.js` **PASS**；`node dev/check-syntax.js` 299 文件 0 错误；`npm test` **762/762 PASS**。
- **risk**：① 版本升级即 SW 缓存键变更（hw-help-5.1.0 → hw-help-5.2.0），部署后客户端首次访问将全量重建缓存（预期行为，activate 自动清理旧版本缓存）；② CHANGELOG 中 v5.2.0 节日期取发版标记日 2026-10-12（P34 实际开始更早）；③ 全量 check-all 未在本条内重跑（版本标记仅触版本面 6 文件，定向门禁已全过；提交前建议随 P39 收口跑一次全量）；④ 未 git commit。

---

## P39-09 · 删除后断链专项核查 + 清洗记录收口（2026-10-12）

- **modified**：`docs/P40-PREP.md`（§2.2 候选清单转为**处置记录**——8 行逐项标注处置结果与 P39-06~08 证据锚点，防后续会话误判存在未处置项；§3 更新「文件清洗部分已执行完毕、KBL 派生器重构部分未立项」）；`docs/CHANGELOG.md`（未发版 P39 节标题与内容扩充，补 P39-05~09 文档/文件清洗摘要）。
- **deleted**：无。
- **reason**：用户显式指令「检查是否有断链」——P39-06~08 三轮删除后的专项核查 + 记录收口。四面扫描结论（**零断链**）：① 活代码面（dev/scripts/tools/shared/plugins/HTML）对已删路径零引用（唯一命中 `dev/p28/reports/dependency-matrix.json` 为 build-baseline.js:419 **纯输出**产物，无读取方，可再生）；② 运行时 sw.js 缓存清单零命中；③ SEO 文件 robots.txt:15 / llms.txt 的 `archive/` 隔离声明为 P28-34 隔离门禁（P28-34）**断言对象**，目录删除后声明保留正确（删声明反而断门禁）；④ 现行文档 file:/// 链接零断链（唯一命中为 P39-06 日志对断链事实的文字描述本身）。package.json scripts 零命中。全量 check-all 30 PASS / 0 FAIL / 1 SKIP（2026-10-12 实测）已覆盖 16/17 bundle 一致性。
- **tests**：`node dev/p28/check-doc-consistency.js` **PASS**；断链核查本身即本轮测试（四面 grep + git status 12 D + R 记录确认）。
- **risk**：① P40-PREP §1（KBL 派生器重构准备）仍未立项，不得因 §2.2 收口而误读全稿已执行；② robots/llms 的 archive 隔离声明若未来彻底放弃 archive 路径需与 P28-34 门禁同步改口径；③ 未 git commit。

---

## P39-08 · 剩余清洗候选处置（release/、dev/reports/、kbl/releases/、.DS_Store 全库清扫）（2026-10-12）

- **modified**：无。
- **deleted**：
  - `release/` 整目录（9 文件：5.0.0/5.0.1/5.1.0 三版 tar.gz + sha256 + RELEASE-MANIFEST，gitignored 本地打包产物）——部署打包可再生（publish 脚本产物）。
  - `dev/reports/` 整目录（49 文件门禁输出报告，gitignored）——门禁重跑即再生（已实证：check-kbl-uniqueness 清扫后重跑自动重建报告）。
  - `kbl/releases/` 整目录（**12 tracked 文件**：v1.0.0-18a21dfb 快照 11 文件 + latest.json 指针，git rm 记录 D 状态）——三方印证：① 生产代码零消费者（`tools/kbl/publish.js` 为唯一**写方**非消费者，重发布即重建快照）；② 门禁不以存在为通过条件（`dev/check-kbl-uniqueness.js:53` 仅列 EXCLUDE_DIRS 排除扫描项，latest.json 零读取方）；③ 测试面零引用（全库 grep 命中仅冻结档案 docs/archive/phases/* 与报告产物）。**P40-PREP §2.2 中"tracked 快照需单独裁决"项就此销账。**
  - 全库 `.DS_Store` 清扫归零（macOS Finder 噪声，gitignored；排除 node_modules/.git）。
- **reason**：用户显式指令「继续处置剩余候选（release/ 本地产物、dev/reports/、kbl/releases/ tracked 快照裁决、.DS_Store 全库清扫）」——P40-PREP §2.2 候选清单收尾执行，P39-07 risk③ 登记项全部销账。
- **tests**：`node dev/check-kbl-uniqueness.js` **PASS**（known 0 / new 0，EXCLUDE_DIRS 语义不受目录删除影响）；`node dev/p28/check-dead-code.js` **PASS**（15 候选）；`node dev/p28/check-legacy-matrix.js` **PASS**（5 候选）；`node dev/p28/check-doc-consistency.js` **PASS**；`npm run verify` M0 **PASS**（6.3s，8/8）；git status 确认 kbl/releases 12 文件 D 记录。02-KBL §4 白名单表 publish.js→kbl/releases 行为「写方→产物目录」职责映射，产物删除后语义仍正确，无需改写。
- **risk**：① kbl/releases 为 tracked 永久删除（git D 记录，未 commit 前可恢复）——快照可由 publish.js 随时再生，历史版本如需回溯可经 git 历史找回；② release/ 本地 tar 删除后 5.x 历史版本包不可本地再生（需重新打包），如需保留回滚包应在下次发布前重新生成；③ dev/reports/ 由门禁按需再生，无需保持；④ 至此 P40-PREP §2.2 候选清单**全部处置完毕**，项目文件清洗准备项清零；⑤ 未 git commit。

---

## P39-07 · 根 archive/ 隔离快照整体清除（2026-10-12）

- **modified**：无。
- **deleted**：根 `archive/` 整目录物理删除（gitignored 本地隔离快照，**96 文件 / 1.1M**，零 tracked）——6 目录：
  - `legacy-tests/`（48 文件，304K）：P28 Legacy 治理期隔离的旧测试
  - `r6-gate-cleanup/`（21 文件，236K）：R6 门禁清理期快照
  - `g1-curriculum-2026/`（4 文件，260K）：G1 课程旧版材料
  - `difficulty-refactor-20260829/`（13 文件，156K）：难度重构期（2026-08-29）快照
  - `legacy-tools/`（9 文件，116K）：旧工具链隔离
  - `plugins-removed/`（1 文件，8K）：移除插件隔离
  - 空壳 `archive/` 目录本身随之删除（不留壳纪律）；`.gitignore:38 /archive/` 条目**保留**（配置级防护：防未来同名目录误入版本库，非死代码）。
- **reason**：用户显式指令「继续清理根 archive 下的其余 6 个目录」——对 P39-06 risk③ 中登记待裁决项的裁决执行。取证：① 6 目录全部 gitignored（.gitignore:38 /archive/），git 零 tracked；② 全库引用面 grep 命中仅在 `docs/archive/phases/` 冻结档案（P28-LEGACY-ISOLATION.json 等 P28 快照 + 历史阶段报告），零生产代码/门禁/现行文档引用（P30 判例：冻结档案历史保留不影响删除）；③ 六目录隔离门禁（P28-34）断言为 llms.txt/robots/sitemap 文本层 + 目录内 html meta 扫描，不依赖目录存在。
- **tests**：`node dev/p28/check-seo-ai-history-isolation.js` **PASS**（382 sitemap 不变，ARCHIVE: 0，robots/llms 断言完好）；`node dev/p28/check-dead-code.js` **PASS**（15 候选全 verified，不受影响）；`node dev/p28/check-legacy-matrix.js` **PASS**（5 候选 verified）；`node dev/p28/check-doc-consistency.js` **PASS**。
- **risk**：① 6 目录为 gitignored 永久删除（不在版本库、不可再生）——均为历史战役隔离物，其有效结论已在 P28 冻结档案与现行文档沉淀；② docs/archive/phases/ 冻结档案中的历史路径引用（P28-LEGACY-MATRIX 等）指向已删目录——档案快照本不作当前依据（P30 判例）；③ P40-PREP §2.2 候选清单中根 archive/ 行已处置完毕，剩余候选（release/、dev/reports/、kbl/releases/、.DS_Store 全库清扫）仍待后续指令；④ 未 git commit。

---

## P39-06 · 陈旧无效文档清洗（2026-10-12）

- **modified**：`docs/archive/phases/audit/answer-system-audit-report.md`（P32 期答案系统审计报告归档接收，与 P17-0-* 审计先例同目录；git rename 记录保留溯源）。
- **deleted**：
  - `docs/audit/answer-system-audit-report.md`——**现行文档面移除**（git mv 归档至 docs/archive/phases/audit/，非物理销毁）；`docs/audit/` 空目录随之删除。
  - `docs/.DS_Store`——docs 目录卫生（macOS Finder 噪声，untracked）。
  - `archive/docs-2026-09/` 整目录 **49 文件物理删除**（gitignored 本地快照，1.3M）——2026-09 旧时代陈旧文档：旧架构文档（FROZEN_CORE/API/module-map/generation-flow 等）、迁移期报告（migration-reports 全套 + audit-json）、旧草稿（G1_MATH_FILL_DRAFT/APPLIED-DRAFTS-NOTES）、MEMORY.md/FEATURE_STATUS 等旧记忆污染源；其结论均已沉淀于现行 docs/ 与 docs/archive/phases/（P28-44、02-KBL §6）。
- **reason**：用户显式指令「任务序列依旧是 P39，先按照文档清洗内容，执行且删除陈旧无效文档」——按 `docs/P40-PREP.md` §2.2 候选清单文档类执行（P39-05 准备稿 → 本条落地）。取证：① docs/ 非 archive 全树 31 文件逐一过目，唯一陈旧项为 docs/audit 审计报告；② 该报告全库引用面 = P32 任务书/P32 日志（历史记录文本引用）+ P40-PREP（候选清单）+ .trae/documents（AI 工具目录），零生产/门禁引用；③ docs-2026-09 为 gitignored 中间期快照，六目录隔离无运行时消费。根 archive/ 其余 6 目录（legacy-tests/legacy-tools/plugins-removed/g1-curriculum-2026/difficulty-refactor-20260829/r6-gate-cleanup）为代码/工具/课程数据非文档，本次不动待后续裁决；release/、dev/reports/、kbl/releases/ 均非文档，不在本条范围。
- **tests**：`node dev/p28/check-doc-consistency.js` **PASS**（现行非 archive 文档 18 个，历史数字 0 命中）；`node dev/check-knowledge-access.js` **PASS**（migration 活门禁基线不受影响）；归档目标 docs/archive/phases/audit/ 存在性核实后执行。
- **risk**：① docs-2026-09 为 gitignored 永久删除（不在版本库、不可再生）——删除前已逐一核对 49 文件清单全部为旧时代文档，无现行数据混入；② P32 文档中的 file:/// 旧路径引用断链（历史记录内文字引用，archive 内文档本不作当前依据）；③ 根 archive/ 其余 6 目录与 release/、kbl/releases/ 快照去留仍待用户后续裁决（P40-PREP §2.2 已登记）；④ 未 git commit。

---

## P39-05 · 开发文档全量口径对齐 + P40 准备稿（2026-10-12）

- **modified**：
  - `docs/00-BASELINE.md`：测试口径 63 文件/651 用例 → **71 文件/762 用例**（实测 npm test 762/762、15 套件）；测试目录分布 13 目录旧表 → 现行 8 目录实盘（generation 28/orchestration 22/presentation 8/adaptive 4/source 4/validator 3/core 1/semantic 1）；`npm test` 耗时行 651→762；门禁链 10 项旧表重写为 check-all **31 项**权威清单（与 dev/check-all.js run() 逐一对应，syntax 286→299 实测，FINAL-91 注明点文件过滤）。
  - `docs/10-TEST-CI.md`：检查域清单「24 项」→ **31 项**表（17 核心 + 附加 + FINAL-91，与 check-all.js 对齐）；#5 534→762、#14 381→382、#4 286→299；Browser E2E 表述 #17→#15；测试目录分布同步 8 目录实盘；§4「24 项」→31 项。
  - `docs/09-WEB-AI.md`：Sitemap 冻结 381 条/5 公共页 → **382 条/6 公共页**（index/math-types/subject-types/select/practice/faq，实测 grep sitemap 382 loc）。
  - `docs/04-DIFFICULTY.md`：`diffLevel(` 权威位置 `shared/catalog/core/core.js`（不存在）→ `shared/core/core.js`（grep 实证）。
  - `docs/07-SVG.md`：契约测试路径 `tests/svg/*`（目录不存在）→ `tests/presentation/svg-contract.test.js / svg-contract-full.test.js / svg-sanitizer.test.js` + `tests/generation/graphic-renderer.test.js`（实盘核实）；图形族 make-ten→makeTen（与 svg-contract-full.test.js 实参对齐）。
  - `docs/01-ARCHITECTURE.md`：Presentation SSOT 列补 `layout`（P31-02 迁入的排版决策中心，此前表内缺位）。
  - `docs/CHANGELOG.md`：顶部新增「未发版 — P34–P39」摘要节（四役主线 + 当前门禁口径 762/762、31 项）；v5.1.0 门禁行自相矛盾订正（原文「30 项…CI 31 PASS」→ 31 项统一口径，P32 加入 6g 定稿时点注明）。
  - `docs/P40-PREP.md`：**新建准备稿**——①KBL 派生器数据清洗重构准备清单（现状链路图 + 5 个已取证清洗点 + 红线边界 + 草案切分 + 门禁）；②项目文件清洗候选清单（P39 方法论 + 8 项候选含消费关系核实 + 防误删负面清单）；③两役先后依赖。文中明确「非任务书、未立项、编号待用户指令」。
- **deleted**：无。
- **reason**：用户显式指令「整理项目的开发文档，保持开发进度和内容的前后一致性，防止 AI 旧记忆恢复无效内容；并为 KBL 层数据清洗重构派生器、项目文件清洗做准备」。属 P39 死代码清理战役收口后的文档一致性延展任务（用户指令授权），P33-03 文档对齐先例的增量执行。全部数字经实跑核实：npm test 762/762、check-syntax 299、sitemap 382、M0 8/8、kbl-dir 377（375 KP + 索引 html/json，原数字仍正确未改）。change-log 历史（P28~P38）与 docs/archive/ 冻结历史一律未改写；扫描确认其余旧口径命中均为 append-only 历史记录合法保留。
- **tests**：`node dev/p28/check-doc-consistency.js` **PASS**（18 个非 archive 文档，历史数字 0 命中）；M0 `npm run verify` 8/8 PASS 复核基线未动；纯文档改动，生产代码/测试/KBL 零触碰。
- **risk**：① `docs/P40-PREP.md` 为准备稿，两役未立项，不得被当作执行授权；其中候选清单每项均标注「需清洗时逐项核实」；② 00-BASELINE 门禁链表若未来门禁增删须同步（该表已注明与 check-all.js 对应）；③ 未 git commit。

---

## P39-04 · GRAPHIC_TYPES 类型级死条目物理删除（2026-10-12）

- **modified**：
  - `shared/schemas/semantic-question.schema.js`：`GRAPHIC_TYPES` 物理删除 2 个类型级死条目 `number-line` / `grid`（附 P39-04 取证注释）；同文件 P39-03 注释计数订正「删 11 个」→「删 13 对」（与 P39-03 change-log 的 append-only 订正对齐）。
  - `shared/engine/presentation-engine.bundle.js`：重建（schema 内嵌，25 modules）。
- **deleted**：`GRAPHIC_TYPES` 中 `number-line`（数轴）、`grid`（网格/方格）2 个类型条目。
- **reason**：用户显式指令「对死代码直接做物理删除」——P39-03 risk ② 登记项（类型层未动）的落地执行。删除证据（三层全零）：① 渲染派发零入口（`GRAPHIC_RENDERERS` 派发表无此二类型，类型级不可分发）；② 全库零产出（generators/plugins 无 `type:'number-line'`/`type:'grid'` 描述符）；③ 全库零消费者（tests/schemas/validator/semantic/kbl/teaching 中零引用）。P39-03 已删其 subtype 整行，本次删除后图形类型白名单 = 在产 4 类（geometry/chart/diagram/currency）+ `custom` 架构保留项（svg-legacy 透传通道），类型与子类型两层均收敛为「登记 = 可分发 + 在产」。
- **tests**：类型层双向验证：在产 4 + custom 全部放行 5/5 ✓，`number-line`/`grid` 正确拒绝 2/2 ✓（未来产出将触发 WARNING）；子类型层无回归 22/22 ✓；定向 tests/presentation + tests/semantic **194/194**；`npm test` **762/762**；`node dev/check-all.js` **30 PASS / 0 FAIL / 1 SKIP**（21 Dead Code / 22 Legacy 矩阵 PASS）。基线 375/98/373/1570 不变。
- **risk**：① schema 对外导出 `GRAPHIC_TYPES` 数组本身未改结构（仍为数组引用），消费方（isValidGraphicType L279）行为变化仅为白名单收窄，warning-only 不 FAIL；② 未来若真实需求接入数轴/网格题型，需 root Excel 基线扩容 + 渲染器新 建 + 白名单扩行，属正常立项流程不受影响；③ 未 git commit。

---


## P39-03 · 白名单死条目删除（13 对）+ FINAL-91 门禁 .DS_Store 误报根治（2026-10-12）

- **modified**：
  - `shared/schemas/semantic-question.schema.js`：`GRAPHIC_SUBTYPES` 物理删除 13 对死条目——geometry: `polygon/line/point`；diagram: `flow/tree/venn/mindmap`；`number-line` 整行（integer/fraction/decimal）；`grid` 整行（dot/square/isometric）。白名单收紧为「登记 = 可渲染 + 在产」。附 P39-03 取证注释（四层全零证据 + 起源 135ca55 v4.0.0）。
  - `dev/check-all.js`：FINAL-91 快照 walk 加点文件过滤（`e.name.startsWith('.')` skip）——快照面回归「源码/测试/冻结文件」设计意图，根治 macOS Finder/Spotlight 元数据写入造成的瞬态假差异。附监视路径点文件盘点依据（全部为 .DS_Store，无合法点文件漏快照）。
  - `shared/engine/presentation-engine.bundle.js`：重建（schema 内嵌）。
- **deleted**：`GRAPHIC_SUBTYPES` 中 13 对 (type,subtype) 白名单条目（见 modified ①）。
- **reason**：用户显式指令「删除清理死条目，修复门禁，序列计入 P39」——P39-02 risk ①② 两项待裁决的落地执行。删除侧证据（四层全零）：① 产出方零（13 对组合全库 grep 包括 generators/plugins/tests/semantic/engine）；② 渲染器零（svg-geometry/svg-diagram/svg-chart 注册表逐一比对 + `number-line`/`grid` 在 GRAPHIC_RENDERERS 派发表类型级无入口，不可分发）；③ T2 冻结数据零（golden-questions 等 subtype 字段精确检索 0 条）；④ 外部消费零（GRAPHIC_SUBTYPES 导出仅 schema 自身 + bundle 内嵌副本）。门禁侧根因：FINAL-91 快照 readdirSync 无点文件过滤，`tests/.DS_Store`(20:53:24)/`shared/.DS_Store`(20:54:27) 写入落在失败运行窗口内实锤；门禁 16/17 确定性重建字节一致对 hash 快照不可见，已排除。
- **tests**：双向口径验证：22 个在产组合全部放行 ✓ + 13 对死条目全部正确拒绝 ✓（未来产出将触发 WARNING 而非静默放行）；定向 tests/presentation + tests/semantic **194/194**；`npm test` **762/762**；`node dev/check-all.js` **30 PASS / 0 FAIL / 1 SKIP**（FINAL-91 本轮及预期后续运行稳定 PASS；6a 1570、6b/6e 矩阵、6g 泄露、16/17 bundle 确定性、21/22 死代码与 Legacy 全过）。基线 375/98/373/1570 不变。
- **risk**：① **计数订正**：P39-02 risk ② 记「死条目 11 个」系误数——精确为 13 对（当时遗漏 grid/square），按 append-only 原则不改写历史，以本条为准；② `GRAPHIC_TYPES` 类型层未动（`number-line`/`grid` 仍为合法类型，仅无 subtype 行），未来若有代码产出这两类型将收到 subtype WARNING，属正确契约反馈；③ 磁盘上的 .DS_Store 物理文件未删（Finder 浏览即再生），仅从 FINAL-91 快照面排除，仓库卫生不受影响；④ 未 git commit。

---


## P39-02 · schema 图形子类型白名单与生产真值对齐 + P33→HEAD 全量死代码扫描清零（2026-10-12）

- **modified**：
  - `shared/schemas/semantic-question.schema.js`：`GRAPHIC_SUBTYPES` 白名单补齐 9 个在产子类型——geometry += `square/cube/cuboid/star/view-cards/segment`，diagram += `pattern/groups/ratio`（附三方对账依据注释）。
  - `shared/engine/presentation-engine.bundle.js`：重建（schema 内嵌，25 modules）。
- **deleted**：无（本轮扫描未发现可物理删除的死符号/死文件；详见 reason 扫描清单）。
- **reason**：用户指令「接续 P39 序列，从上次上传服务器的节点（P33 部署 v5.1.0，commit c72bb11）到项目目前进度的过程中产生的死代码和无效代码进行清理」。五步闭环取证：
  - ① 扫描面 = `git diff c72bb11..HEAD` 86 个提交文件 + 19 个未提交文件（P34~P38-GEN-04 全部工作）。
  - ② 六维扫描结果：**顶层死函数 0**（33 个变更 shared 源文件符号级提取 × 全库引用计数）；**零消费导出 0**；**死注释块 0**（全部为项目审计溯源注释惯例）；**catch 吞错 0**（红线模式扫描）；**孤儿文件 0**（5 个候选 svg-chart/svg-currency/svg-make-ten/learner-storage/version.js 均经 script 标签/派发表/构建脚本核实为活）；**临时脚本残留 0**（dev/p25/p27/p28/p32 全部为 T1/T2 派生白名单与正式门禁）。
  - ③ 唯一真发现 = schema 白名单漂移（P34~P38 断链修复在产 21 个 (type,subtype) 组合，白名单仅登记 12 个）：缺失 9 项导致 `semantic-question.js` L437 校验器对每道带图题误发「未知 subtype」WARNING（warning-only 不 FAIL，故此前门禁未拦截）。本项属「窗口期产生的无效契约状态」，本轮对齐。
  - ④ 白名单反向死条目 11 个（geometry/polygon、geometry/line、geometry/point、diagram/flow、diagram/tree、diagram/venn、diagram/mindmap、number-line/integer/fraction/decimal、grid/dot、grid/isometric——无渲染器且零产出）经核为 **P33 前历史存量**，warning-only 零运行时影响，按「登记不修」纪律不在本轮顺手删（若未来要求契约最小化可另立项）。
  - ⑤ 门禁 21（死代码矩阵 15 候选）/ 22（Legacy 矩阵 5 候选）均 PASS，历史候选全部已处置，无新增。
- **tests**：定向 tests/presentation + tests/semantic **194/194**；白名单对账复验 21/21 产出组合全登记；`npm test` **762/762**；`node dev/check-all.js` **30 PASS / 0 FAIL / 1 SKIP**（6a 1570、6b/6e 矩阵、6g 泄露、16/17 bundle 确定性、21/22 死代码与 Legacy 全过）。基线 375/98/373/1570 不变。
- **risk**：① 首次 check-all 曾报 FINAL-91 只读门禁 FAIL（32 项），复跑恢复 PASS——定性为运行期间被监视目录内 `shared/.DS_Store`（macOS Finder 噪声文件，位于 hash 快照路径 shared/ 内）发生写入的瞬态误报，非代码问题；如需根治可将 `.DS_Store` 排除出 FINAL-91 快照（涉门禁自身，登记待裁决不顺手修）；② 白名单死条目 11 个保留（历史存量）；③ 未 git commit。

---


## P39-01 · rawType 死链全链清零 + capability-model 死符号清理（2026-10-12）

- **modified**：
  - `shared/capability/capability-model.js`：删未用变量 `TYPES`、未用参数 `qtMeta`、未用参数 `qtypeId`（inferDifficultyRange 单参化）；`pushQt(q.type || q.rawType)` → `pushQt(q.type)`；注释更新为「rawType 全链清零」口径。
  - `shared/strategy/question-type-strategy.js`：`getDefaultFromKP` 中 `qts[i].rawType || qts[i].type` → `qts[i].type`。
  - `shared/strategy/static-difficulty.js`：`q.type || q.rawType` → `q.type`。
  - `shared/orchestration/knowledge-context.js`：`projectQuestionTypes` 输出对象删 `rawType` 派生字段。
  - `tools/kbl/emit-canonical.js`：assessment.questionTypes 投影删 `rawType: null` 数据字段（T1 派生器）。
  - `tests/orchestration/p37-02-f-type-alias.test.js`：P37-02 ③ 组两个测试重写为 P39-01 防双轨负断言（rawType 不参与解析 / type 缺失不兜底 / 5 文件代码模式零引用）。
  - `shared/engine/strategy-engine.bundle.js`：重建（57 modules，16/17 确定性 PASS）。
  - `shared/knowledge/teaching/misconception-profiles.json`：**历史镜像漂移修正**（非本轮行为变化）——kbl/teaching 源（SSOT）= 917 slots，HEAD 的 shared 副本 = 923（P32 期 46490ec 起未随源重冻，漂移 +6 个 axis=representation slot）；本轮 `kbl:derive` 的 build.js 镜像将副本拉回源真值（-6 slot：概念混淆×3 + 格式错误×3，droppedByAxisEvidence 707→713）。三方对账：kbl源==工作区 true，kbl源==HEAD false。
- **deleted**：T1 数据 `rawType` 键——kbl/canonical 与 shared/knowledge/data/math/g1~g6 全部 assessment.questionTypes 元素的 `rawType: null`（1570/1570 行）经 `npm run kbl:derive` 重建清零；rootHash 更新（af40e17a… → 82c59dfe…）。
- **reason**：用户指令「清理最近决策产生的无效死代码」。取证链：P37-02 裁决「已归一化 type 是题型唯一权威」→ rawType 失去存在理由；实测 canonical + 运行时 6 年级 assessment.questionTypes 共 1570 行 rawType **全部为 null**（零非空值），全部消费方（capability-model / question-type-strategy / static-difficulty / knowledge-context 输出）中 rawType 表达式行为恒等 type——纯冗余死链。capability-model 三死符号为 P37-02 登记不修的任务外存量，本轮转正清理。
- **tests**：定向 `tests/orchestration/p37-02-f-type-alias.test.js` 8/8（含 3 个新 P39-01 负断言）；`npm test` **758/758**；`node dev/check-all.js` **30 PASS / 0 FAIL / 1 SKIP**（6a 1570 真实生成、6b/6e 矩阵、6g 泄露、16/17 bundle 确定性全过——证明行为零变化）；基线对账 375/98/373/1570 不变；门禁 21/22 死代码与 Legacy 矩阵 PASS。
- **risk**：① 行为零变化由 6a/6b/6e 与 758 测试证明，但 canonical rootHash 变化（合法：T1 派生器修改 + 同源重跑确定性一致）；② strategyView 视图少 rawType 字段，全库消费方已同步清零（防双轨断言封死复活路径）；③ 未 git commit。

---
