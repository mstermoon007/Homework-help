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
