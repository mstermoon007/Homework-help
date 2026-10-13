# P40 最终收口记录（两役机判收口 + 用户签收）

> 性质：P40 任务书 §4 `P40-FINAL` 收口记录。追加式变更见 `docs/P40/change-log.md`。
> 状态：**机判面全部收口完成；两战役关闭待用户人工签收（不代签）。**
> 版本：v5.2.0 ｜ 生成日期：2026-10-13。

---

## 1. 收口结论

P40 两大战役——**战役一 P40-Q（单题内容质量深化）** 与 **战役二 P40-T（子父知识点包含深化）**——的**实现、数据、文档、门禁**四面全部收口；经全量门禁实测，**机判面零 FAIL**。

剩余项均为**人工评审（needs-review）**，按任务书纪律「不自动改数、AI 不代替人工」挂账，待用户签收后正式关闭。详见 §6。

| 战役 | 机判状态 | 关闭条件 |
|---|---|---|
| 战役一 P40-Q | 七项验收全过（`p40-q14-acceptance.md`） | 用户完成 ② 163 题人工评审签收 |
| 战役二 P40-T | S0-S3 全 14 任务完成，门禁全过 | 用户完成 T-14 链路图人工签收 |
| P40-FINAL | 两役收口 + 00-BASELINE 对齐 + 日志收口 | 本记录签收 |

---

## 2. 机判证据（收口时点实测）

| 面 | 命令 | 实测 |
|---|---|---|
| 单元/集成测试 | `npm test` | **864/864 PASS / 0 FAIL**（15 套件 / 89 测试文件） |
| 全量门禁 | `node dev/check-all.js` | **30 PASS / 0 FAIL / 1 SKIP**（#15 无 Chrome SKIP；CI 设 `CHROME_BIN` 为 31/0/0） |
| 语法 | `dev/check-syntax.js` | 323 文件 0 错误 |
| 文档历史数字 | `dev/p28/check-doc-consistency.js` | **PASS**（非 archive 文档零命中） |
| 死代码矩阵 | `dev/p28/check-dead-code.js` | PASS（15 候选全核实） |
| Legacy 治理矩阵 | `dev/p28/check-legacy-matrix.js` | PASS（5 项全核实） |
| 1570 真实生成 | `npm run verify:allow-gen` / 6a | 1570/1570 零 fake/placeholder/fallback |
| 答案防泄露 | 6g（AS-18） | PASS |
| Bundle 确定性 | 16/17 | source==bundle、重跑 hash 不变 |

定向：`tests/semantic/p40-t02-t07-foundation.test.js`（T-02~T-07 地基验收）**6/6**。

---

## 3. 基线恒定（收口核对）

| 项 | 值 | SSOT |
|---|---|---|
| KP / Units / Relations / ALLOW | **375 / 98 / 373 / 1570** | `docs/00-BASELINE.md` |
| Canonical 题型 | 7 类 | `kbl/canonical` |
| Generator 总数 | **23** | `shared/generator/generator-registry.js` |
| canonical rootHash | `3df605b9f42bf8ef836a1927262a78ef04b7a532e24e5c9c3984aa578806dba5` | `kbl/manifest` |

T-05 回填 `familyId`/`stageOrder` 至 `capability.json` 375/375（加字段不增边），基线数字全程未变。

---

## 4. 本轮口径统一（陈旧「当前口径」→ 现网实测）

| 文件 | 项 | 旧（陈旧） | 新（现网实测） |
|---|---|---|---|
| `dev/p28/check-doc-consistency.js` | Relations 描述 | 当前 0 | 当前 373 |
| 同上 | Generator 描述 | 当前 31 | 当前 23 |
| 同上 | 测试数描述 | 当前 534 | 当前 864 |
| 同上 | 语法文件数描述 | 当前 286 | 当前 323 |
| `docs/10-TEST-CI.md` | `tests/generation` 文件数 | 28 | 42 |
| 同上 | `tests/orchestration` 文件数 | 22 | 23 |
| 同上 | `tests/validator` 文件数 | 3 | 4 |
| 同上 | `tests/semantic` 文件数 | 1 | 3 |
| 同上 | 语法文件数 | 299 | 323 |
| 同上 | 全链测试数 | 762/762 | 864/864 |

> `docs/P40/P40-TASK-BOOK.md` §0「立项当日基线口径（全程不变）」的 762/762 为**立项时点快照**，按纪律保留不改。

---

## 5. 陈旧无效文件清理

| 对象 | 数量 | 理由 |
|---|---|---|
| `.trae/documents/*.md` | 6 | 已完结战役的旧实施计划稿（P25-13~18 收尾、P26 SEO/AI、integer-arithmetic name 迁移、FINAL-32 语义链、答案系统审计、生成质量收口工程 V4.3.0 C1-C5）；结论均已沉淀入现行文档与 `docs/archive/`，属无效旧记忆（gitignored AI 工具记忆，不入库） |
| `.DS_Store` | 12 | macOS 目录元数据垃圾（全库清扫） |

> 保留：`.trae/rules/`（`ai-coding-workflow.md` 等为任务书声明之上位规则）、`.trae/skills/`；`dev/p40/out/*`（签收证据，9 件）；`release/`（v5.2.0 当前发布物）；`dev/*/reports/`（门禁可再生输出）。tracked 文件经扫描全部有引用，无孤儿。

---

## 6. 待用户签收清单（needs-review 挂账，AI 不自动处置）

| # | 项 | 证据 | 状态 |
|---|---|---|---|
| 1 | 战役一 Q-14 复现题集人工评审（163 题，覆盖 G1-G6×7 题型） | `dev/p40/out/q01-review.md` | ⏳ 待签收 |
| 2 | 战役二 T-14 三主线（加法/分数/面积）全链链路图人工评审 | `dev/p40/out/t14-mainline-audit.md` | ⏳ 待签收 |
| 3 | T-07 族内难度递进倒挂 54 处裁决（三主线含 13 处） | `dev/p40/out/t07-family-difficulty.json` | ⏳ 待裁决 |
| 4 | T-06 族间投影环观察项（`fam_multiply ⇄ fam_divide` 等 primary-family 折叠；KP 级 canonical 前置为无环 DAG） | `docs/P40/change-log.md`（T-06） | ⏳ 观察 |
| 5 | T-08 解释承上启下抽样 20 题人工评审 | `dev/p40/out/t08-explanation-samples.md` | ⏳ 待签收 |

---

## 7. 签收栏

| 战役 | 结论 | 签收 | 日期 |
|---|---|---|---|
| 战役一 P40-Q | 机判七项全过，待人工评审 | ☐ | |
| 战役二 P40-T | 机判全过，待人工签收 | ☐ | |
| P40-FINAL | 两役收口完成 | ☐ | |

> 用户签收后：本记录补记签收日期，任务书头部执行状态转「已签收关闭」，change-log 追加收口条目。
