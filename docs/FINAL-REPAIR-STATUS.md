# FINAL-REPAIR-STATUS — 任务状态机制

> 禁止 AI 根据旧记忆重新打开已经解决的问题（FINAL-02）。
> 每项任务只能处于以下状态之一：`PENDING` / `IN_PROGRESS` / `FIXED` / `VERIFIED` / `FROZEN`。

---

## 1. 状态机

```
PENDING → IN_PROGRESS → FIXED → VERIFIED → FROZEN
                                            ↑
                              除非出现当前测试失败
                              否则禁止从 FROZEN 重新打开
```

| 状态 | 含义 | 是否可重开 |
|---|---|---|
| PENDING | 已登记，未开始 | 否（需排期） |
| IN_PROGRESS | 正在处理 | — |
| FIXED | 已改代码，待验证 | — |
| VERIFIED | 已通过定向 + 全量验证（check-all 26/0 + 相关测试） | — |
| FROZEN | 验证通过即冻结 | **仅当当前测试失败**方可重开；不得因历史对话/旧记忆重开 |

### 重开 FROZEN 的唯一条件

```
FROZEN
  ↓
出现当前测试失败（npm test 或 npm run check-all 红）
  ↓
允许重开为 IN_PROGRESS
  ↓
否则禁止重新审计
```

---

## 2. FROZEN 不变量（2026-09-22 验证通过即冻结）

> 以下项当前 check-all / npm test 全绿，已 FROZEN。AI 不得因历史对话重新审计。

| 项 | 值 | 验证依据 | 状态 |
|---|---|---|---|
| KBL 375/375 | KP=375 | `kbl/canonical/knowledge.json` knowledge[]=375 + check-all #2 | FROZEN |
| 1570 ALLOW | Mappings ALLOW=1570，矩阵冻结 FAIL=0 | `kbl/canonical/mappings.json` mappings[]=1570 + check-all #6a/#6b | FROZEN |
| 7 题型 | calc/fill/choice/judge/geometry/classify/apply | `shared/knowledge/question-type-registry.js` TYPES=7 | FROZEN |
| Difficulty | 权威链唯一 + 溯源 | check-all #10a/#10b PASS | FROZEN |
| SVG | 契约 + Sanitizer | check-all #12 PASS | FROZEN |
| Validator | AnswerValidator 无动态执行 | check-all #13 PASS + `tests/validator/` PASS | FROZEN |
| P24 UI / Presentation | 渲染 + Legacy 隔离 | check-all #11 PASS | FROZEN |
| Version | 5.0.0 三方一致 | `VERSION`=`package.json`=`version.js`=`sw.js CACHE` + check-all #1 | FROZEN |
| 31 Generator | 21 PROD + 1 COMBINE + 2 CARRIER + 7 NO-BINDING | `shared/generator/generator-registry.js` 计数=31 + check-all #6c | FROZEN |
| Sitemap 381 URL | 5 公共 + 375 KP + 1 索引 | `sitemap.xml` loc=381 + check-all #14 | FROZEN |
| Security | eval/Function 0 命中 | check-all #13 PASS | FROZEN |
| Units 98 | 12 册 unitCount 之和 | `kbl/canonical/course.json` + check-all #2 | FROZEN |
| Relations 0 | relations[]=0 | `kbl/canonical/relations.json` | FROZEN |

---

## 3. FINAL 专项任务清单

| 任务 | 内容 | 状态 | 备注 |
|---|---|---|---|
| FINAL-00 | 建立"当前唯一事实基线"读取优先级（①源码 ②root Excel ③package.json/VERSION ④测试 ⑤生成 ⑥00-BASELINE ⑦任务书） | VERIFIED | 规则落地于 `FINAL-REPAIR-BASELINE.md` §0/文件头 |
| FINAL-01 | 创建最终修复事实锁 `docs/FINAL-REPAIR-BASELINE.md` | VERIFIED | 2026-09-22 采集完成 |
| FINAL-02 | 任务状态机制 `docs/FINAL-REPAIR-STATUS.md` | VERIFIED | 本文件 |
| FINAL-03 | 禁止范围扩张 + `docs/FINAL-REPAIR-DEFERRED.md` | VERIFIED | 规则 + 延后清单（当前空） |
| FINAL-10 | 修复测试绝对路径（`tests/presentation/svg-contract*.test.js`） | VERIFIED | 改用 `path.resolve(__dirname, '../..')`；npm test 534/534 |
| FINAL-11 | 修复 Browser E2E 绝对路径（`dev/e2e/browser-e2e.js`） | VERIFIED | 删 `/Applications/Google Chrome.app/...`，改 `resolveChrome()`：CHROME_BIN→PATH(chrome→chromium→chromium-browser)；`node --check` OK + check-all 26/0 |
| FINAL-12 | 真实 Browser E2E 纳入最终门禁（首页→快速→教师→KP→7类→生成→重生成→刷新→打印） | VERIFIED | `dev/e2e/browser-e2e.js` 新增 `final-12` 9 步模式；`dev/p28/check-browser-e2e.js` wrapper（exit 2=SKIPPED / `REQUIRE_BROWSER_E2E=1` 不可用→FAIL）；check-all #17 由假单元测试改为真实浏览器；CI Node 20→22 + `REQUIRE_BROWSER_E2E=1` + `CHROME_BIN=google-chrome`。本机 9/9 步 ×2 PASS；check-all 25/0/1 SKIP（#17 本地 SKIPPED，CI 真实执行） |
| FINAL-13 | 修复 Freeze 随机污染：冻结样本固定 seed，同一 KP/QT/Difficulty/Seed/Generator/KBL 产出完全一致 prompt/answer/sample/promptLen | VERIFIED | freeze 脚本固定 seed 策略 `freeze:p28-v1\|<kp>\|<qt>\|d3` 并沿 PracticeSession→POL cellReq→QuestionPlan→presentation-engine→retry-loop 全链透传；money.js fill 分支去 `Date.now()` 模块级 RNG；application.js choice 改值约定 + 3 干扰项有界补足（修固定 seed 下 1 行稳定 0 题）。连续 4 次 freeze 1570/1570、FAIL=0、产物字节一致、git diff 增量=0（修复前 1291/1570 污染）；npm test 534/534；check-all 25/0/1 SKIP |
| FINAL-14 | 冻结检查默认只读：check 不允许修改冻结文件，仅显式 `--write` 才更新冻结数据 | VERIFIED | `dev/p28/check-generation-matrix-freeze.js` 默认只读复核（重生成 1570 行证据与冻结 JSON 逐字段逐行比对，一致→0；不一致/缺失→1，绝不写盘；比对忽略运行日期 date）；`--write` 显式重建 JSON+MD；`check-generator-matrix.js` 缺失提示同步 `--write`。防普通 CI/审计（check-all #6b 无参）产生 Git diff |
| FINAL-16 | 物理删除 Legacy Strategy 文件（strategy-request.js / strategy-config.js） | VERIFIED | 核查发现两文件非整文件死代码（request 归一化入口 + 年级难度锚点），经确认按字面删除：活符号逐字内联（normalizeRequest/validateRequest→strategy-engine.js；difficultyAnchorOf→difficulty-strategy.js），legacy 开关机器 0 调用者消亡；bundler/global 挂载/capacity-inventory/layers.json/legacy-matrix/baseline 六处引用同步；不新增 compat/bridge。bundle 62 模块重建；npm test 534/534；check-all 全绿 |
| FINAL-17 | GenerationCore 移出生产源码至 tests/fixtures | VERIFIED | 核查 production=0、bundle=0、仅 4 个 p17 测试 require；按指令迁移至 `tests/fixtures/generation-core.js`（非复制），原 `shared/generation/generation-core.js` 已删除；文件内 4 个相对 require 路径同步修正；4 个测试 require 路径 + 文件头注释同步；check-dead-code 条目改 RELOCATED；build-presentation-bundle 注释同步。npm test 534/534；check-all 全绿 |
| FINAL-20 | 生产 Bundle 只保留真实生产能力：6 个 dormant Generator 排除 + semantic-special 清死符号 | VERIFIED | 核查 1570 mapping 对 6 个 dormant generator（complex-calc/c1/c2/c5-c6/c7/c9）0 依赖、freeze evidence 0 产出、0 测试引用。semantic-special.js 经查含 code-recognition（15 行 freeze 产出）非 dormant——仅清 equivalent-reasoning 死符号（工厂+题库+导出全删）。6 个文件源码保留但 index.js 不再 require、registry 不再注册、bundle 不再打包；build-strategy-bundle 移除 global.ComplexGen 挂载；layers.json/check-dead-code/check-generator-matrix 三处清单同步。bundle 56 模块（减 6）；freeze 只读 1570/1570 PASS；npm test 534/534；check-all 全绿 |
| FINAL-22 | Strategy 权责最终锁定：清除假引用与 KBL 直读 | VERIFIED | ①13 处 require 指向不存在的 knowledge-point/bank/ontology.js（假引用，Node 直连即崩，bundle 靠 knowledge-compat 桥掩盖）→ 统一改经 KnowledgeContext（strategyView/poolContext，与桥委托等价，bundle 行为零变化）；②2 处 `require('../../kbl/teaching/*.json')` 直读 KBL → 删除（qt-intent explainability 走既有 fail-open 兜底；misconception overlay 实测 1570 全量 0 命中）。SHIMS 7→4；knowledge-compat.js 死文件删除；_bundle-env/practice.html 同步。审计确认 KP/QT/count/difficulty 无重选/重算越权 |
| FINAL-31 | 逐项处理 307 个 A 类 KP 的 914 条 WARN：逐对归因 W1-W10 + 修复（不做统计修改、不以增字段为终修） | VERIFIED | ①全量逐对归因（dev/p28/final-31-warn-attribution.js → reports/final-31-warn-attribution.json）：W4=619（已消费仅缺声明）/W5=141（4 生成器不消费 semanticParams）/W10=154（8 真运算错位+146 规则过度冻结随机值）；辅标 W1/W2 数据缺位、W3=0、W6 系统性（warn 早退零验证）、W9=858、W7/W8=0。②FINAL-31a：evidence-rules 剔除/转 fieldPresent 过度冻结断言 + validator 新增 fieldPresent 存在性断言；③FINAL-31b：semantic-evidence.js 消费处派生声明（derive 仅映射题内 data.operation 事实）+ wrapGenerator finish 单点接入 16 生成器；④FINAL-31c：application.js 模板池按 KP semanticParams.operations 过滤（修 8 对真运算错位）+ 2 个低难度乘除模板；⑤FINAL-31d/31e：freeze 全量复核暴露 6 处预存错绑（4 算术 KP + 2 统计 KP）按 KBL 语义重绑 + judge 规则行 width fieldPresent。端态：归因 PASS=772/WARN=149（全 W5 暂缓类）/FAIL=0 三轮稳定；freeze 1570/1570 FAIL=0 连跑 git diff=0（--write 重生 83 行预期差异：6 重绑 KP + application 绑定群）；npm test 534/534；check-all 25/0/1 SKIP。暂缓项登记 DEFERRED（W5/W6/W9/W1/W2/P26 derive 过滤） |
| FINAL-32 | 教育语义出题链闭合：每 A 类 KP 证明 KP→Teaching Target→Cognitive Target→Question Intent→Generation Parameters→Generator→题目结构→Semantic Evidence→Validator→SemanticQuestion 全链消费（字段存在不算，必须被消费） | VERIFIED | ①FINAL-32：4 个 W5 生成器（application-word/classification/counting/picture-equation）接入 markDerived 收口 + counting/picture-equation KP 名源修复（DEF-001/002 闭合）；②FINAL-32a：picture-equation 名源回退（variant dispatch 真缺陷登记 DEF-006）；③FINAL-32b：semantic-evidence KP 语义过滤 + generator-selector 传 plan.semanticParams.operations；④FINAL-32c：evidence-rules k002/k003 choice+judge 规则对齐实际生成 + freeze 重生；⑤FINAL-32d：Question Intent 消费链闭合——trainsWhat 经 wrapGenerator + api.js Node 侧直载 qt-intent.json 双路径注入 sq.semanticTarget。端态：归因 PASS=921/WARN=0/FAIL=0 三轮稳定；npm test 534/534；check-all 25/0/1 SKIP；freeze 只读 git diff=0。Teaching/Cognitive Target（learningTargets/cognitiveTargets）因 KBL 数据缺失（307/307 A 类 KP）断链，登记 DEF-004（P2，P25-02 人工治理，schema E05 红线禁止 AI 伪造），不在本任务范围 |
| FINAL-111 | 冻结后禁止再改源码：源码变更=重新验证，禁止偷偷修 | VERIFIED | 执行 FINAL-FREEZE：check-all 28 PASS / 0 FAIL，源码目录 clean，冻结基线 commit 4123124。在 FINAL-FREEZE.md 写入「冻结后政策」5 条规则：①源码变化=重新 check-all 28/0 ②禁止绕过验证的小修/顺手修 ③CI 只读不 repair ④改动必须登记 change-log 五字段 ⑤确定性验收（两次 check-all 一致 + git diff 零增长）。源码冻结基线=4123124。详见 change-log FINAL-111 |
| FINAL-110 | 生成最终冻结报告 docs/FINAL-FREEZE.md（24 字段） | VERIFIED | 报告已生成，19 章覆盖全部字段：版本 5.0.0 / 发布 2026-09-25 / KBL hash cee1070e / KP 375 / Units 98 / Relations 0 / Mappings 1570 / QT 7 / Generator 24 / Bundle hash 8e1b4e4f+62665dd0 / Difficulty 1-10 / Validator / SVG / Presentation / Learner / Education 921 / Golden 259(100%) / Tests 547 / E2E 9/9 / Security 4×0 / Sitemap 381 / AI-Crawler 隔离 / Performance / Git 4123124。所有数据为实测值。详见 docs/FINAL-FREEZE.md |
| FINAL-107 | 安全：eval=0 / new Function=0 / unsafe SVG=0 / unsafe HTML bypass=0 | VERIFIED | 安全门禁 6/6 PASS：eval 0 命中（536 交付文件）、new Function 0 命中；SVG 契约+Sanitizer 测试 42/42 PASS（敌意 SVG 丢弃/registry 拒收/顶层 rawSvg→GRAPHIC_INVALID/端到端干净）；HTML 渲染对抗 33/33 PASS（题目/选项/radio value 全 esc、graphicGuard 复核、schema 禁 rawHtml/rawSvg/html、print CSP script-src 'none'）；AnswerValidator 安全 15/15 PASS（23 攻击表达式全 null）。详见 change-log FINAL-107 |
| FINAL-106 | 浏览器 E2E：真实 Chrome 完成 9 步路径（首页→快速练习→教师模式→7题型→知识页→生成→刷新→再生成→打印） | VERIFIED | 真实 Chrome 执行 `dev/e2e/browser-e2e.js final-12`，steps=9, failed=0，每步 ok=true：①首页 title/入口 ✓ ②快速练习 mode=quick 生成 ✓ ③教师模式 mode=teacher 生成 ✓ ④知识页 CTA 用户点击全链 ✓ ⑤+⑥ 7 类题型 POL 全链（ledger 21/21 coverage=OK）✓ ⑦重新生成 overlap=0 ✓ ⑧刷新自动生成 hasPrevSeen ✓ ⑨打印 print=1 cards≥produced ✓。详见 change-log FINAL-106 |
| FINAL-100~105 | 核心指标验收：KBL/生成/七类题型/教育语义/Golden/测试 | VERIFIED | 逐项实测全 PASS：FINAL-100 KBL 375/98/0/1570（allow=1570 forbid=0）；FINAL-101 1570/1570 real generation；FINAL-102 7/7 题型（calc/fill/choice/judge/geometry/classify/apply）；FINAL-103 A-class 921 / SEMANTIC_PASS 921 / WARN 0 / FAIL 0；FINAL-104 Golden 259/259 evidence pass（100%，0 errors，15/15 families）；FINAL-105 npm test 547/547 + syntax 297 files 0 errors + lint 0 违规 + check-all 28 PASS。详见 change-log FINAL-100~105 |
| FINAL-92 | 连续两次全量验证：check-all × 2 + git diff × 2，结果一致且零写入（最终确定性验收） | VERIFIED | 连续两次 `CHROME_BIN=... npm run check-all` 结果完全一致：均为 **28 PASS / 0 FAIL / 0 SKIP / 28 项**，FINAL-91 只读门禁均 PASS。git diff 三次（基线 / 第一次后 / 第二次后）完全相同：20 files changed, +742/-128（均为 FINAL-70~91 既有改动，check-all 未产生任何新增变更）。结论：check-all 结果可复现、零写入，构建确定性通过最终验收。详见 change-log FINAL-92 |
| FINAL-91 | 所有 CI 检查必须只读：不得修改源码/测试/冻结文件、不得生成随机数据、不得覆盖 baseline；CI 是 verify 不是 repair | VERIFIED | 审计 check-all 子脚本写操作后，修复两处默认写盘违规：① check-generator-matrix.js 默认改为只读（仅 --write 写 archive）② check-generator-noninterference.js 默认改为只读（仅 --write 写 archive）。check-all.js 新增 FINAL-91 只读门禁：运行前后对关键目录（shared/、tests/、kbl/ 冻结数据、docs/ 非 archive、根配置）做 SHA256 快照比对，任何变更即 FAIL。报告目录（dev/reports/、dev/p26/reports/）与 archive 允许写入（审计输出/历史归档）。`npm run check-all` 实测 28 PASS / 0 FAIL，只读门禁 PASS（关键目录前后 hash 一致）。详见 change-log FINAL-91 |
| FINAL-90 | 建立唯一最终门禁：npm run check-all 一次性执行 17 项，不得存在多版本 check-all 脚本 | VERIFIED | 新增 `dev/p28/check-bundle-determinism.js`（bundle 模式验证 source==bundle、determinism 模式验证构建确定性，两模式均 PASS）；重排 `dev/check-all.js` 使 1-17 严格对应 FINAL-90 清单（version/KBL/lint/syntax/unit/generation/education/golden/difficulty/presentation/SVG/security/sitemap/crawl/browser/bundle/determinism），原 Coverage/LLM 移入附加门禁（18-22）。`npm run check-all` 实测 **28 PASS / 0 FAIL / 0 SKIP / 28 项**。全仓仅 `dev/check-all.js` 一个 check-all 系列脚本，无 -2/-final/-new/-real 变体。详见 change-log FINAL-90 |
| FINAL-83 | 当前架构文档只保留当前事实：历史数字仅限 archive/history | VERIFIED | 全仓扫描命中分类后，当前架构文档违规仅 README.md 2 处：①旧 KP 计数→375 ②旧 Generator 计数→24（GeneratorRegistry.all() 实测 24）。其余命中均合法：check-doc-consistency.js（门禁 token 清单）、dev/reports/*.json（历史审计报告）、change-log.md（审计日志豁免）、kbl/manifest/source-manifest.json（superseded.reason 历史背景）、migration/*（迁移历史）。更正后当前文档 0 违规；doc 扫描器 PASS；check-all 26/0/0。详见 change-log FINAL-83 |
| FINAL-81 | Bundle 重新构建：strategy-engine.bundle.js + presentation-engine.bundle.js，source==bundle、hash 一致 | VERIFIED | 重建前快照 hash：strategy `8e1b4e4f...`、presentation `62665dd0...`；依次跑 `node dev/build-strategy-bundle.js`（58 modules/4 shims）+ `node dev/build-presentation-bundle.js`（21 inlined/62 delegated）；重建后两 bundle SHA256 与重建前**完全相同**，`git diff --stat shared/engine/` 为空。结论：构建确定性，source==bundle，hash 一致，零产物漂移。check-all 26/0/0。详见 change-log FINAL-81 |
| FINAL-82 | 版本统一：VERSION / package.json / version.js / sw.js / index.html / README 必须一致 | VERIFIED | 逐处读取确认 6 处全部 `5.0.0`：① VERSION 文件 ② package.json version ③ shared/catalog/version.js APP_VERSION ④ sw.js CACHE=`hw-help-5.0.0`（sync-sw-version 校验与 version.js 一致，PASS）⑤ index.html 运行时从 version.js 读 APP_VERSION（fallback 5.0.0）⑥ README.md 当前版本。check-all #1 Version 门禁 PASS；check-all 26/0/0。版本 SSOT=VERSION 文件，version.js 为运行时分发源，sw.js/index.html 消费 version.js，package.json/README 为同步镜像。详见 change-log FINAL-82 |
| FINAL-80 | KBL 从 Excel 重新派生：唯一源 kbl/root/小学G1-G6数学知识点.xlsx，校验 375 KP / 98 Units / 0 forbid / 1570 mappings + hash 一致 | VERIFIED | 按 P28 流水线从 Excel 重跑 extract→derive→emit→build 全链：(i) extract-raw.json SHA256 与基线 byte 级一致（1ebb45b4...），375 行 / 12 册 / Excel fileHash 8d4ebef5...；(ii) derive 产出 knowledge=375 / units=98 / relations=0 / mappings=1570 / permission={allow:1570}（forbid=0），5 个 canonical 文件 SHA256 全部与基线一致；(iii) emit+build 后 rootHash=cee1070e... 与基线完全一致，kbl/manifest ↔ shared/knowledge/manifest 两端 rootHash 一致；(iv) check-kbl-quality M17 门禁 10/10 PASS（含 rootHash 复算 + Excel 指纹与 extract-raw 快照一致）；(v) check-all 26/0/0。结论：从 Excel 重新派生产出与冻结基线 byte 级一致，hash 稳定，零 KBL 数据改动（仅 build 时间戳刷新已回退）。详见 change-log FINAL-80。备注：tools/kbl/verify.js 预存断链（引用不存在的 check-generator-capability.js / check-f-type-2.js），与本次数据无关，KBL 完整性已由 quality gate + check-all 覆盖 |
| FINAL-72 | SVG 统一：GraphicDescriptor→GraphicRenderer→SVGRenderer 返回 SUCCESS/UNSUPPORTED/FAILED，禁止 catch→'' 吞错 | VERIFIED | 当前源码审计：统一链已在——生产面 descriptor 唯一渲染出口为 renderer.js:70（GraphicRenderer→svg-registry），页面/插件 0 处直接调 SVGGenerators 拼图入 DOM，render-format legacy `svg` 字段零 DOM 消费；registry 内 generator throw / svgWrap throw / 空输出 / 清洗拒收均显式 FAILED 带 reason+error。最小修复两处：print.js buildFromQuestions 的 `catch(e){return null}` 静默丢错改为先 console.warn 保留原始错误再回落 null（调用方 alert 行为不变）；svg-registry 头注释旧契约"无图返回 ''"订正为三态 RenderResult（零逻辑改动，print 不入 bundle、registry 注释被 bundle 构建剥离故无 bundle 影响）。svg-contract.test.js 新增 5 组 FINAL-72 用例（统一链/端到端 FAILED 不进 DOM/三态语义/print 不吞错/结构性禁 catch→''）17/17 PASS；npm test 547/547；Security 6/6；check-all 26/0/0。详见 change-log FINAL-72 + FINAL-72b |
| FINAL-70 | Validator 安全：eval=0 / new Function=0，表达式走安全 parser，恶意输入必须 FAIL 且不能执行 | VERIFIED | 以当前源码审计：全交付面（shared 含 2 bundle/plugins/feedback/sw.js/根 HTML+knowledge 376 页内联脚本）eval/new Function 0 命中；唯一求值入口 answer-validator.js = Tokenizer→Parser→AST→Evaluator（遇字母即 throw→null fail-closed）。生产代码已合规零改动；缺口在证据——`tests/validator/answer-validator.test.js` 新增 3 组 FINAL-70 对抗用例：23 个嵌入式攻击表达式（process.exit/constructor.constructor/赋值/三元/方括号/模板串/位运算/成员调用）全 null、哨兵载荷副作用零发生、子进程 `1+process.exit(123)` exit 0 证不执行。15/15 PASS；npm test 542/542；check-all 26/0/0。详见 change-log FINAL-70 + FINAL-70b |
| FINAL-71 | HTML 安全：题目/答案/解析/SVG 入 DOM 必须过明确安全边界，禁止 rawHtml/rawSvg/innerHTML 绕过 | VERIFIED | 逐汇点审计确认边界已在：题目/选项唯一经 HTMLRenderer.esc（fallback renderGeneric/select/practice 各自 esc，批改反馈 textContent）；产品无解析渲染汇点；SVG 四层收口——SemanticQuestion schema 顶层 rawSvg/svg/html=GRAPHIC_INVALID ERROR、唯一 rawSvg 通道(custom.params)→svg-registry 强制 sanitizeSvg 白名单→html-renderer graphicGuard 复核→打印 CSP `script-src 'none'`；generator-contract 禁 innerHTML/outerHTML/insertAdjacentHTML。零生产改动；`tests/presentation/renderer.test.js` 新增 5 组对抗用例（选项/属性转义、graphicGuard 丢弃、registry 拒收/中和、schema GRAPHIC_INVALID、端到端干净）33/33 PASS；#13 门禁 [1] 升级为 Node 逐行扫描实扫 536 个交付文件 0 命中、[4] 由「含字符串」假断言改为 renderer 对抗套件+CSP 真断言，Security 6/6；check-all 26/0/0。详见 change-log FINAL-71 + FINAL-71b |
| FINAL-64 | 禁止只测 API：E2E 全链产品验收（用户点击→页面→参数→Session→POL→Strategy→Generator→Validator→SemanticQuestion→Presentation→DOM） | VERIFIED | `dev/e2e/browser-e2e.js`（dev-only，零生产源码/bundle/KBL 改动）：① `HOOK_SOURCE.record` 扩展捕获 `plans`/`planKeys`/`failedPlans`/`htmlPresent` + questions 每项 `hasAnswer`/`hasPrompt`/`semanticTarget`（SemanticQuestion 契约字段存在性）；② final-12 Step 4 由「读 CTA href + URL 导航」改为「真实 CTA `<a>.click()` + 13 项逐层断言」——证明 10 层（用户点击/页面/参数/Session/Strategy/Generator/Validator/SemanticQuestion/Presentation/DOM/可交付/no JS errors）；单 KP CTA 走 executeInline 无 POL 账本是 api.js 设计（line 767-768 注释说明），POL 在 Step 5+6 验证；③ Step 5+6 增 POL 全链断言（账本 req≥planned≥gen=final + 7类题型 + SQ契约 + Presentation + DOM，10 项 checks）。Step4(10层) + Step5+6(POL) = 11 层全链。实测：`CHROME_BIN=... node dev/e2e/browser-e2e.js final-12` 9步全 ok=true；`node dev/check-all.js` **26 PASS / 0 FAIL / 0 SKIP / 26 项**（#17 真实 Chrome 跑通）；npm test 534/534。详见 `docs/P28/change-log.md` FINAL-64 + FINAL-64b |

> 任务编号沿用用户 FINAL 专项原文。新增任务在此追加，不无限扩展 P2/P3。

---

## 4. 新任务八问（开始前必须回答）

```text
① 问题是什么？
② 根因是什么？
③ 哪个文件负责？
④ 为什么这个文件负责？
⑤ 修改什么？
⑥ 删除什么？
⑦ 怎么验证？（定向 + npm test + npm run check-all 26/0）
⑧ 是否扩大范围？（是 → 拆到 DEFERRED）
```

---

## 5. 状态更新规则

- 每次任务状态变更必须更新本表对应行。
- FIXED → VERIFIED 的前提：`npm test` 全 PASS 且 `npm run check-all` = 26 PASS / 0 FAIL。
- VERIFIED → FROZEN：验证通过即冻结，无需额外动作。
- 任何 FROZEN 项如因代码修改导致测试红，须先将该项重开为 IN_PROGRESS，并在 `FINAL-REPAIR-BASELINE.md` 重新采集对应数值后才能继续。
