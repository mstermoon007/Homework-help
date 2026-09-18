# KBL Baseline（M0 交付物）

状态：DRAFT — 数据基线快照，供 M1–M19 收口执行对照。数据为**先查后改**的真实扫描结果，未做任何凑数修改。

> **修订 v1.2（M8 + M6 落地，2026-09-13）**：权威 rootHash 由 `54399a926a580239…` 迁移为 `45b9a2f414f468e6…`（新发布包 `kbl-math-v1.0.0-45b9a2f4`，`latest.json` 已指向）。① 难度静态 D 归一化：`D = 1 + 9×(wsum/0.94)`（M8，与难度 M15 同源），level 10 可达；② **关系数 1293 → 1287**：移除 6 条 legacy prerequisite 成环边（M6，见 §3 质量），pre=600→594、related 693 不变，环数 10→0。本文件其余 M0 快照数据（598/128/1293/639 等）保留作为 M0 事实记录。
> **修订 v1.1（M7 落地，2026-09-12）**：权威 rootHash 由 `47ba582e…` 迁移为 `54399a926a580239…`（新发布包 `kbl-math-v1.0.0-54399a92`，`latest.json` 已指向）。生成映射由「639 全 allow」改为「**409 allow / 230 missing**」——230 条占位能力（228 unresolved + 2 TBD.probability）不再冒充 allow，由 normalize/validate/schema 三重派生门禁统一实施。本文件其余 M0 快照数据（598/128/1293/639 等）保留作为 M0 事实记录。

## 1. 权威数据量（canonical）

| 数据集 | Excel | Build | Release (kbl-math-v1.0.0-47ba582e) | Runtime | 说明 |
|---|---|---|---|---|---|
| 课程 | 19（01 课程） | - | - | - | Excel 唯一人工源 |
| 单元 | 128（02 单元） | 128（课程树 units） | 128 | - | 其中 **123 有 ≥1 KP**，**5 为 ghost（无 KP）** |
| 知识点 | 598（03 知识点） | 598 | 598 | 598（byId） | |
| 知识关系 | 1293（04 知识关系） | 1293 | 1293 | - | related 693 / prerequisite 600 |
| 生成映射 | 639（05 生成映射） | 639 | 639 | - | 全部 `permission: allow`，source=generator-registry |
| 扩展 | 598（06 扩展） | 598 | 598 | - | |
| 数据字典 | 94（07 数据字典） | - | - | - | |

rootHash（确定性）：`47ba582ea236a467b80a330a7265eff750f8e3feb379079d4b3b965218ca2c7d`
发布包：`kbl/releases/kbl-math-v1.0.0-47ba582e/`（`latest.json` 指向同一包）

## 2. 分册分布

知识点按年级：G1 57 / G2 112 / G3 21 / G4 104 / G5 160 / G6 144 = 598

单元按年级：g1 35 / g2 23 / g3 18 / g4 20 / g5 17 / g6 15 = 128
单元按册：up 58 / down 49 / mixed 18 / advance 3 = 128

KP 状态：active 571 / deprecated 25 / inactive 2 = 598

## 3. 关系质量（1287，M6 后）

- related 693、prerequisite 594
- source：legacy 1271 / kbl-seed 15 / editor 1
- 自环 0，`fromId|relation|toId` 三元组重复 0
- **M6 修复（2026-09-13）**：发现 10 条 prerequisite 成环（legacy 迁移杂边），经最小反馈边集定位后，经用户批准删 6 条篡成环父边，环数 10→0：
  `math-g3-down-u04-k001→g4-up-u06-k001`、`g2-up-u02-k002→u02-k003`、`g4-up-u03-k006→g6-up-u05-k001`、`g5-down-u02-k001→u02-k002`、`g5-down-u03-k004→g6-up-u05-k001`、`g6-down-u03-k001→u03-k002`
- 改动经 Excel 04 关系 + roundtrip（幂等 PASS）落盘，rootHash 迁移 `45b9a2f4…`

## 4. Ghost Units（5，课程树中有、无任何 KP）

| unitId | grade/book | unitName | unitType |
|---|---|---|---|
| math-g1-up-u12 | g1/up | 数学游戏 | textbook |
| math-g1-up-u13 | g1/up | 综合与实践 数学游戏（上下前后左右位置） | practice |
| math-g1-down-u08 | g1/down | 欢乐购物街（认识人民币） | practice |
| math-g1-down-u09 | g1/down | 欢乐购物街（买卖我做主 · 综合实践） | practice |
| math-g3-up-u09 | g3/up | 综合与实践 数字编码 | practice |

结论：均为 2024 人教版「综合与实践」真实教材单元，**应保留**（M3 中补 KP 或标 pending），不可简单删除。
外部源抽取 crossCheck 亦报 5 个无 KP 单元（G1-up-91/98、G1-down-91/93、G3-up-91），与上表 oldUnitId 一一对应。

## 5. 差异裁决（先查后改，不凑数）

| 声称值 | 裁决 |
|---|---|
| KP 598 vs 608 | **608 无数据支撑**。外部源 598 / 迁移抽取 598 / Excel 598 / Build 598 / Runtime 598，全一致。608 仅存在于方案文本，不照搬修数据。 |
| 单元 128 vs 149 | **149 无数据支撑**。无任何数据集存在 149。真实结构：128 课程树单元 = 123 有 KP + 5 ghost（见 §4）。 |
| 映射 639 vs 660 | **唯一真实差异**。外部源 manifest 660（pluginId 冗余行）；migration/raw 660；migration/excel-raw 639；Excel/构建/发布/运行时 639。639 为按生成契约去重的规范值，四区一致。 |

## 6. M7 已知风险（Mapping 真实性）

639 条映射 `permission` 全为 `allow`。M7 必须逐条对照 Question Type Registry + Generator Capability Registry：
真实具备生成能力 → 保持 `allow`；无能力 → `MISSING`/`FORBID`/`DEGRADE`。禁止为 PASS 而把不具能力的映射标成 allow。

## 7. 后续冻结目标（M14/M19）

- M14：相同的输入 + 相同的构建代码 → 相同的 rootHash（确定性幂等）。
- M19：冻结 Schema / ID 规则 / API / Runtime 结构 / Relation 标准 / Mapping 标准 / 难度边界；后续变更只能走 v1.0.1 / v1.1.0 / v2.0.0。

## 8. 里程碑进度（收口工程）

| 里程碑 | 结果 |
|---|---|
| M0 基线 | ✅ 本文件 + KBL_BASELINE.json（2026-09-12） |
| M1 Excel 唯一源 | ✅ `tools/kbl/roundtrip.js`：Canonical↔Excel 重建一致（剔除时间戳）+ 两次幂等 PASS，rootHash 稳定 47ba582e… |
| M4 ID 规则 | ✅ unitId/KPId 格式 0 违规、0 重复；relation 节点 0 悬空；mapping knowledgeId 0 悬空；KP.unitId 0 孤儿。规则与 `knowledge-contract.js` ID_REGEX 一致（`math-g[1-6]-(up|down|mixed|advance|comprehensive)-u\d{2}-k\d{3}`） |
| M9 Runtime 冻结 | ✅ PUBLIC_API=10 方法冻结（get/byGrade/byBook/byUnit/selectable/canGenerate/searchByName/unit/relationsFor/stats），白名单过滤后 `App.KNOWLEDGE=exposed`、`window.KnowledgeAPI=App.KNOWLEDGE` |
| M14 rootHash 幂等 | ✅ 相同输入+构建 → 相同 rootHash（roundtrip 双跑一致） |
| M16 访问审计 | ✅ verify：94 项基线内（tools 1/legacy 14/downstream 67/pages 2），无新增越权 |
| **M7（✅ 已落地）** | 639 条中 **230 条占位能力（228 unresolved + 2 TBD.probability）置 MISSING**，409 条真实能力保留 allow。根因：normalize 原以「questionType∈注册表」粗粒度算 allow，无视 per-mapping capability。修复：normalize.js / validate.js / generation-contract-schema.js 三重派生改为「questionType 覆盖 **且** capability 非占位」才 allow；validate 原「missing 禁止发布」门禁改为「missing 必须对应占位 capability」。E2E 断言已从伪造的 judge=allow（实为 TBD.probability）改为 judge=missing + 真实能力 calc=allow 双例。新 rootHash `54399a926a580239…`，`kbl:verify` ALL PASS。 |
| **M2 教材核准** | ✅ 仅作参考、不列入硬性门禁（用户 2026-09-13 指示）。5 个 ghost 单元均为 2024 人教版「综合与实践」真实教材单元（数学游戏/欢乐购物街/数字编码），名称与结构符合教材事实；未引入教材比对门禁。 |
| **M3 幽灵单元** | ✅ 复核结论：保留全部 5 个（g1-up-u12/u13、g1-down-u08/u09、g3-up-u09，均为真实教材综合与实践单元），**不删除**；补 KP 属于内容阶段非收口范围，validate 的「空单元待挂载」WARNING 常驻作为待办提醒。 |
| **M5 deprecated/inactive KP** | ✅ 25 deprecated + 2 inactive 已在数据中正确标记；`Policy.isSelectable` 排除非 active，selectable() 天然不生成（verify 已验）。处置=维持现状，无数据变更。 |
| **M8 难度隔离（D1 修复）** | ✅ `shared/catalog/difficulty-static.js:151` 已归一化 `D = 1 + 9*(wsum/0.94)`（不改 difficulty.js/TIERS）。合成回归合规：全档→level10、最大跳级+1、均值上移 0.279、严格保序。frozen-core 重锚（授权 Bug Fix）。与难度计划 M15 同源。 |
| **M10 前置** | ✅ frozen-core 重锚已将 2 个已删旧层文件（knowledge-bank/ontology）正式移出基线（79 文件）；D2 断链（3 个 dev 脚本）仍按计划留待难度 M16 数据层重建。 |
| **M6（✅ 已落地）** | prerequisite 10 条环（全 legacy）经最小反馈边集定位，用户批准**删除 6 条成环边**：经 Excel 04 关系 + roundtrip（幂等 PASS）落盘，环 10→0，pre=600→594、related 693 不变。excel/validate/import/runtime-E2E 关系计数已同步 `1293→1287`，含 4 处断言/comments 更新。rootHash 迁移 `45b9a2f4…`（同批发布 `kbl-math-v1.0.0-45b9a2f4`）。M0 快照 §1/§5 仍为 1293 事实记录。 |
| **M11 Bundle 链** | ✅ strategy-engine.bundle（62 modules/4 shims）与 presentation-engine.bundle（22 inlined/66 delegated）均重建成功，无断链。 |
| **M17 数据质量门禁（9 项）** | ✅ 新增 `dev/check-kbl-quality.js`（Q1 数量守恒 / Q2 关系行数 / Q3 ID 规则 / Q4 引用完整性 / Q5 关系质量自环·重复·环 / Q6 映射真实性 allow409·missing230 / Q7 manifest↔latest 计数 / Q8 运行时 stats / Q9 rootHash 复算），**9/9 PASS**，已接入 `kbl:verify` 链。同时修复额外第 4 个断链脚本 `check-generator-capability.js` → canonical 驱动（M2-R05 门禁 PASS；registry 464 条旧层 legacy knowledgePoints 引用标记 WARNING 非绑定，真值以 05 生成映射为准，报告刷新 v2）。 |
| **M18 Final Verify** | ✅ `npm run kbl:verify` 完整 8 段链 ALL PASS（Validate / Roundtrip / Build / Runtime E2E / Access / Capability-Gate / Quality-9 / Publish），frozen-core 无变更、check-syntax 0 错、verify:difficulty 0 问题。 |
| **M19 v1.0.0 Freeze** | ✅ 冻结声明 `docs/kbl-freeze.md`（数据基线 598/128/1287/639 + allow409/missing230；Schema/ID 不可变；Runtime 单入口 94 审计；难度边界独立；待执行清单）。 |
| M2/M3/M5/M8 | 待决策（见 checkpoint） |

## 9. 附：数据源对照

- 外部源：`/Users/zhanggaozhang/Code/Homework-Knowledge-Base`（manifest：598 KP / 128 单元 / 1293 关系 / 660 映射，rootHash 011e6475…，kbl-2026-09-11）
- migration/raw：`kps 598 / units 128 / relations 1293 / mappings 660`（外部抽取）
- migration/excel-raw：`kps 598 / units 128 / relations 1293 / mappings 639`（Excel 重导入）