# P37 变更日志（人工请求签批处置 + 旧口径债务清理战役）

> 战役性质：P36 收口后的遗留活账处置战役，不新立架构。
> 立项依据：用户 2026-10-12 指令「按照P36的序列，根据方案，逐项解决」——对 P36 收口盘点出的活账
> （H1–H5 人工请求 + practice.html 渲染路径登记项）逐项取证、签批、处置。
> 日志 append-only，六字段，最新在上。

---

## P37-02 · H4 F-TYPE-2 Frozen 归一化表修复：四死路径取证删除 + type 优先（2026-10-12）

- **modified**：
  - `shared/knowledge/question-type-registry.js`：① 删除 `RECOGNIZE_KEYWORDS` 常量及其子串启发式循环（认读 token 不再特判 geometry，未命中落到通用兜底 calc/null）；② 删除 `factor-multiple/factor/all → geometry` 三个错别名键；③ 删除 `winning → apply` 死别名键；④ 文件头归并策略注释同步。授权依据：human-data-requests §H4（用户签批「授权 Frozen 修复」）。
  - `shared/capability/capability-model.js`：`pushQt(q.rawType || q.type)` → `pushQt(q.type || q.rawType)`（type 优先，rawType 仅在 type 缺失时补充）。
  - `shared/engine/strategy-engine.bundle.js`：`dev/build-strategy-bundle.js` 重建（57 modules，16/17 确定性门禁 PASS）。
  - 新建 `tests/orchestration/p37-02-f-type-alias.test.js`（7 例）。
- **deleted**：见上——四个别名/启发式死路径均为物理删除，不留壳。
- **reason**：H4 签批授权的 F-TYPE-2 修复。**执行前按当前 375-KP 口径重新取证**：① canonical 375 KP 与运行时数据（assessment.questionTypes / generation.capabilities）**全部为规范 7 类值、零 rawType 字段、零 factor/all/winning token**——三修复点 + winning 键在当前数据上**零命中**，属防御性修复（行为零变化）；② 375 KP 对账 capability 100% ⊆ 声明题型（零不一致），6e 矩阵 1570 行复核一致——F-TYPE-2 所述「76~79/598 KP（13%）不一致」为 P13 期 598-KP 旧口径，当前体系已消解；③ 'winning' 键三方印证（kbl/ 零命中 + 生产代码仅别名键自身（P36-03 已删 reasoning.js sudoku/winning 生成分支）+ 门禁 21/22 与测试面零引用）→ 死键物理删除；④ 显式别名（oral→calc / recognize→geometry / pattern→geometry 等 canonical 裁决）不在授权范围，零连带保持。
- **tests**：定向 `node --test tests/orchestration/p37-02-f-type-alias.test.js` 7/7 PASS；`npm test` **757/757**（新增 7 例）；`node dev/check-all.js` **30 PASS / 0 FAIL / 1 SKIP**（#15 无 Chrome 正常 SKIP；6a 1570 真实生成、6b 矩阵冻结、6e、6g 泄露门禁全 PASS——题型分布零变化，1570 基线不受影响）。
- **risk**：低——当前数据零命中的防御性修复；风险仅在未来新数据携带历史 rawType/factor 族 token 时体现为正确拒绝（不再错归 geometry）。capability-model.js 既有未用变量（TYPES/qtMeta/qtypeId）为本任务外存量，登记不修。未 git commit。

---

## P37-01 · H1/H2/H3/H5 + practice.html 登记项签批处置：旧口径债务取证销账（2026-10-12）

- **modified**：
  - `docs/archive/phases/human-data-requests/README.md`：「H1–H5 催办汇总」表后追加「H1–H5 签批处置结果（P37）」节，逐项登记取证结论与签批结果；H4 标注已授权转 P37-02 执行。
  - 新建 `docs/P37/change-log.md`（本文件）。
- **deleted**：无。
- **reason**：用户 2026-10-12 指令「按照P36的序列，根据方案，逐项解决」。逐项只读取证 + AskUserQuestion 签批：
  ① **H1 取证销账（旧口径污染）**——源 Excel 实际仅 2 sheet（Sheet1 375 行无映射列 +「知识点」空表），无 sheet 4 可派生；且当前 canonical 375 KP **100% 有 allow 绑定**（mappings unique=375、缺口 0、6b 1570 行全 PASS），「243/598 缺口」为 P13 期 598-KP 旧口径，已随 P25+ 体系重建消解。签批前用户问「能否由源 Excel 派生」→ 答「不能且无需」。
  ② **H2 取证销账（旧口径污染）**——5 类缺失字段（seedDifficulty/cognitiveLevel/type/maxSteps/numberRange）为 P13 期字段体系，当前 canonical 已不含该字段集；语义由 T2 派生（qt-intent/variation-profiles）+ Difficulty Authority + `plan.constraints.numberRange`（P35-DEBT-1 接通 23 生成器）替代；G1 样本 KP 生成行正常（g1-down-u01-k001 5 行 / g1-down-u02-k002 4 行 ALLOW）。
  ③ **H3 销账（25 已接入 + 33 维持剔除）**——58 = 25 个已在当前 375 且 active+有绑定（可练）+ 33 个（7 deprecated/25 active-draft/1 inactive）源 Excel 已无行维持剔除；用户签批「维持剔除销账」，基线 375 不动。
  ④ **H4 已授权 Frozen 修复**——用户签批「授权 Frozen 修复」，转 P37-02 执行（执行前须按 375 口径重新取证三修复点 + 'winning' 键在当前体系的真实性）。
  ⑤ **H5 销账（维持现状）**——用户签批「查阅源excel，若是旧数据污染，直接清理」：三项均非 Excel 数据问题（favicon 404 维持 / adaptive UI 挂起 / 低容量 KP 不加提示文案）。
  ⑥ **practice.html 渲染路径登记项取证销账**——用户签批；现有证据已足（100 题生成 0.7s、渲染分块渐进、DocumentFragment 探针无增益），P31 收口态不动。
- **tests**：纯文档/登记改动，零生产代码；门禁状态继承 P36-03 收口态：npm test 750/750、`node dev/check-all.js` 30 PASS / 0 FAIL / 1 SKIP。
- **risk**：① H4 修复执行（P37-02）若三修复点在当前体系已不存在，则同样取证销账（'winning' 键单独评估可达性）；② 33 被剔除 KP 未来若需接入须 root Excel 补行 + 基线扩容（375→408）+ 全链重冻，属重大变更另立项；③ 未 git commit。
