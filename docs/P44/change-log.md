# P44 Change Log

> 年级适配审计 H9/H10 执行日志（append-only，最新在上）。
> H10 方向与位置链：H10-C 已由用户 2026-10-31 显式裁决并执行（fam_direction 升主干链 + 取消 isExcluded 排除），当前基线 relations 407。

---

## DOC-ARCHIVE-01 | 2026-10-31 | 过期历史文档归档 + README 对齐当前基线

- **modified**:
  - `README.md`：删除过期清单（P17–P23 主线、26/24 Generators、934 测试、218 文件），重写为当前基线精简版（375/98/407/1566、23 Generator、102 文件/937 用例、34 项门禁 33/0/1）。
  - `docs/P42`/`P40`/`AUDIT-LOG` 等当前文档中的历史文档引用路径同步指向 `docs/archive/phases/`（`P42-DEFECT-REGISTER.md` 基线行、`P40-TASK-BOOK.md` 两处、`p40-final-closure.md`、`AUDIT-LOG.md`、`P41-REPORT.md` 内部链接）。
- **deleted**: 无物理删除。9 份已过时历史文档移入归档区（`docs/archive/phases/`）：`p32/P32-TASK-BOOK.md`、`p33/P33-TASK-BOOK.md`、`p35/P35-TASK-BOOK.md`、`p38/P38-TASK-BOOK.md`、`p40/p40-q-baseline.md`、`p40/p40-q14-acceptance.md`、`p41/P41-REPORT.md`、`p41/P41-E-relations-research.md`、`p42/P42-BASELINE.md`。
- **reason**: 用户 2026-10-31 显式指令「整理需要保留的文档，删除死代码和完全过时的旧文档，防止 AI 自动扩展污染项目」，并裁决「全部归档到 archive」「README 重写为当前基线精简版」。死代码侧 `dev/p28/check-dead-code.js` 15 个候选全部 PASS（9 已删 / 6 已清符号 / 1 KEEP），无新增可删项，故不展开扫描。
- **tests**: `node dev/p28/check-doc-consistency.js` PASS（非 archive 文档数由 29 降至 20）；`npm test` **937/937 / 0 FAIL**；`node dev/check-all.js` **33 PASS / 0 FAIL / 1 SKIP**（#15 本机无 Chrome）。
- **risk**: 低——①纯文档移动与入口重写，生产代码/KBL/测试/门禁零改动；②历史 `change-log.md` 内旧路径按 append-only 纪律不改写，仅当前文档更新引用；③回滚 = 将 9 份文件移回原目录并还原 5 处引用与 README；④未 git commit。

---

## T-07-PROGRESS | 2026-10-31 | 族内难度改全局期望下界：capability 派生 progressLevel（126 处 needs-review）

- **modified**:
  - `tools/kbl/derive-kbl.js`：新增 `require(dev/difficulty-anchor-table.js)`（复用既有唯一锚点表，不建第二份常量）与 `attachProgressLevel()` 派生后处理——`progressLevel = max(本年级锚点下界, 族内前序 stageOrder 已出现最高 seedDifficulty)`；**只增注解，`seedDifficulty` 一分未动**。
  - `shared/validator/difficulty-integrity-validator.js`：`validateFamilyDifficultyMonotonic` 判定由「相邻 stageOrder 不得回落」改为「`seedDifficulty < progressLevel` 偏离」；行未携带 `progressLevel` 时回退前序最高难度（t14 等既有调用方行为不变）；违规对象新增 `progressLevel`/`difficultyDelta`。
  - `dev/p40/t07-family-difficulty-scan.js`：规则文案同步（输出保持 `dev/p40/out/t07-family-difficulty.json`）。
  - `kbl/canonical/capability.json`：375/375 行新增 `progressLevel`（`npm run kbl:derive` 确定性重派生，rootHash 仍 `bd24f572…`，未触发运行时副本变化）。
  - `dev/p40/out/t07-family-difficulty.json`：偏离 **53 → 126**（全局期望下界口径，原 53 为其子集）。
  - `tests/semantic/p40-t02-t07-foundation.test.js`：T-07 断言同步为 126 + progressLevel 覆盖 375 + 真实消费断言。
  - `docs/P40/p40-final-closure.md` §6、`docs/P40/P40-TASK-BOOK.md` 头部：T-07 当前口径 126（局部相邻 53 为子集），历史 change-log 数字不改写。
  - `shared/engine/presentation-engine.bundle.js`：因 validator 入 bundle，`npm run build:presentation` 重建（18 inlined / 69 delegated）。
- **deleted**: 无（未删除任何第二实现；validator 保留无 `progressLevel` 时的前序回退，不建兼容层）。
- **reason**: 用户 2026-10-31 显式裁决「建 progressLevel 作全局期望下界（126 处）」；实测原「年级锚点+stageOrder 插值」口径在 ±0/±1/±2 容差下分别命中 170/102/44 处「低于期望」，与 53 不等价，故采用可复算、无新客制常量的下界式 `max(锚点下界, 前序最高难度)`，把检查从局部相邻升级为全局期望，同时保证题目内容零变化。
- **tests**: 定向 `node --test tests/semantic/p40-t02-t07-foundation.test.js` **6/6 PASS**（progressLevel 覆盖 375/375、偏离 126、合成「高于邻接但低于期望」被真实消费检出）；`npm test` **937/937 / 0 FAIL**；`node dev/check-all.js` **33 PASS / 0 FAIL / 1 SKIP**（#15 本机无 Chrome）；6a/6b/9a/9b 不受影响（`seedDifficulty` 分布与生成矩阵零变化）。
- **risk**: 低——①纯派生注解，题面/答案/生成矩阵/KP 数/难度值零变化（6a 1566 真实生成、6b 冻结均 PASS）；②needs-review 由 53 扩到 126 是口径更完整而非新增缺陷，仍全部挂人工、不自动改数；③回滚 = 还原 4 个源码文件 + `npm run kbl:derive` + `npm run build:presentation`；④未 git commit。

---

## H10-C-H | 2026-10-31 | 方向与位置链 fam_direction 升主干 + 取消综合实践/复习排除（用户显式裁决后执行）

- **modified**:
  - **唯一改动点**：`tools/kbl/derive-relations.js` —— ①`CONCEPT_FAMILIES` 追加 `fam_direction`（stages=`[['g2','up','综合实践——方向'],['g4','up','综合实践——方向、位置'],['g6','up','确定位置']]`，ops=`['increase_complexity','abstract_up']`）；②`EXTRA_FAMILIES` 删除 `fam_direction`（12→11 项）；③**物理删除** `isExcluded()` 函数与 R-REL-02 排除判断（全库零残留）；`FAMILY_RULES` 未动。
  - **T1 重派生**：`npm run kbl:derive && npm run build:knowledge` → relations **377→407**（R-REL-01 277 / R-REL-02 **58→86** / R-REL-03 **42→44**）；新增链边 `g2-up-u04-k001→g4-up-u08-k001`（stageOrder 1→6，increase_complexity）、`g4-up-u08-k001→g6-up-u01-k001`（6→10，abstract_up）；新增 R-REL-02 28 条（综合实践/复习单元进出）。族表 **14 主干 / 11 扩展**；KP/Units/ALLOW **375/98/1566 不变**；manifest counts 375/98/407/1566，`tools/kbl/build.js` 重冻 rootHash `309ced9f…`。
  - **T2 顺延**：`dev/p25/derive-qt-intent.js` 重跑（1566/1566 行，requiredRelations 动态断言随 407 成立）；variation/misconception 未重跑（题面零变化）。
  - **计数断言同步**：`dev/verify-kbl-runtime.js`（377→407）、`dev/check-kbl-quality.js`（EXPECT.relations 407 + Q1/Q7/Q8 标签）、`dev/p30/check-kbl-lineage.js`（L6c 标签）、`dev/p25/derive-qt-intent.js`（注释 377→407）、`dev/p40/t12-regression-baseline.js`（①42→44 断言 + ④注释 377→407）；测试 `p40-t02-t07`（主干 13→14 / 扩展 12→11 / T-04 42→44 / T-06 族间边 60→82，T-07 倒挂 53 不变）、`p40-t11`（42/42→44/44）、`p40-t10`（注释 377→407）。
  - **文档当前口径**：`docs/00-BASELINE.md`（Relations 407、族表 14/11、R-REL-03 44、注释 H10-C）、`docs/02-KBL.md`（§1/§2/R-FAM-01/03/04、已知观察项）、`docs/DESIGN-REPORT.md`（17/111/113/232）；`docs/archive/phases/human-data-requests/README.md` 的 H10-C 小节改为「取证、裁决与执行」，原「维持排除」与「禁止改 isExcluded」条目标注已被用户显式指令覆盖。
- **deleted**: `tools/kbl/derive-relations.js` 中的 `isExcluded()` 函数及 R-REL-02 对它的调用（用户 2026-10-31 显式授权覆盖「改 isExcluded 属红线」）。
- **reason**: 用户 2026-10-31 裁决原话：「G2 方向实践课构成 G4「方向+位置」的自然前置。跨 G3、G5 直连 G4→G6 成立，每一个综合实践均为前一阶段的总结和回顾。不做排除，按照册、单元做综合总结。」据此 Q1/Q2/Q3 成立（3 阶段链 g2 上→g4 上→g6 上，跳过 G3/G5），Q4 取消 `isExcluded` 排除。不手改 canonical、不改 `FAMILY_RULES`。
- **tests**: 定向 `p40-t02-t07`/`p40-t10`/`p40-t11` 12/12 PASS；`npm test` **934/934 / 0 FAIL**；`npm run verify` 8/8 PASS；`t07-family-difficulty-scan` 倒挂 **53 不变**；`t12-regression-baseline` 七项全过（①44/44 ②族 22 dup=0 inv=0 ④DAG=true ⑤qt-intent 零重冻 ⑥6a FAIL=0）；`node dev/check-all.js` **33 PASS / 0 FAIL / 1 SKIP**（#15 本机无 Chrome）；T-06 族间边 **60→82**，族投影环为既有 primary-family 折叠观察项（非本次引入，KP 级 407 边 DAG 无环）。
- **risk**: 中低——①题面/答案零变化，KP/Units/ALLOW 不变；②R-REL-02 新增 28 条使综合实践/复习单元纳入册内递进，组合题合法跨册路径扩大；③回滚 = 还原族表 + 恢复 `isExcluded` + 重派生 + 反向还原断言/文档；④用户显式指令覆盖红线已在本条 reason 留痕；⑤未 git commit。

---

## H10-C | 2026-10-31 | 方向与位置链只读取证（零代码/数据动作）

- **modified**:
  - `docs/archive/phases/human-data-requests/README.md`：新增「H10-C 方向与位置链取证」小节（5 单元实测表 + 四条硬事实 + 4 条评审问题 Q1–Q4 + 裁决后动作）。
- **deleted**: 无。
- **reason**: 用户 2026-10-31 指令「好的，执行吧」，接续 H10「暂缓：方向与位置链」出只读评审材料供教研裁决。取证发现：G1–G5 无常规「位置/方向」单元，唯一常规单元为 G6 上「确定位置」；G2 上「综合实践——方向」、G4 上「综合实践——方向、位置」均为综合实践（isExcluded），G3 命中「复习与关联」、G5 命中「综合实践——探索图形」（涂色小正方体位置特征，语义不连贯）。现网 `fam_direction` 12 KP / 7 条族内边 / 零跨册边；两处跨册首 KP 端点边缺失。按「不因名称含方向/位置改族、不为图谱完整造前置」纪律，本轮**不连边、不改族**。
- **tests**: 无代码/数据改动；取证为只读脚本（canonical 三文件 + `computeStageOrders`/`reportCrossFamily`），基线 375/98/377/1566 不变。文档门禁 `node dev/p28/check-doc-consistency.js` 复跑（见下）。
- **risk**: 低——纯档案登记 + 日志；①若教研裁决「不连边」，则维持扩展族现状，缺口作教学图谱观察项；②若裁决连边，按 Q1–Q4 结果走 H10-A 同流程（377→379 或 378），须重新签批；③未 git commit。

## H10-B | 2026-10-31 | 观察物体概念链 fam_observation 升主干（用户签批后执行）

- **modified**:
  - **唯一改动点**：`tools/kbl/derive-relations.js` —— `CONCEPT_FAMILIES` 追加 `fam_observation`（stages=`[['g3','up','观察物体'],['g4','down','观察物体'],['g5','up','观察简单组合体'],['g5','down','观察物体']]`，ops=`['abstract_up','increase_complexity','increase_complexity']`），`EXTRA_FAMILIES` 同步删除该项（剩 12 项）；`FAMILY_RULES` 未动；`validateFamilyTable()` 通过（ops 3 = stages 4−1）。
  - **T1 重派生**：`npm run kbl:derive && npm run build:knowledge` → relations **374→377**（R-REL-01 277 / R-REL-02 58 / R-REL-03 **42**）；新边 3 条：`g3-up-u01-k001→g4-down-u02-k001`（stageOrder 1→4，abstract_up）、`g4-down-u02-k001→g5-up-u01-k001`（4→7，increase_complexity）、`g5-up-u01-k001→g5-down-u01-k001`（7→10，increase_complexity），均 fam_observation 且 stageOrder 严格递增；族归属纠正：`g4-down-u02-k001`、`g5-up-u01-k001` 由 fam_direction 回归 fam_observation（chainFamiliesForUnit 链族优先）。ALLOW **1566 不变**；manifest counts 375/98/377/1566，`tools/kbl/build.js` 重冻 rootHash `86cddf1f…`。
  - **T2 顺延**：`dev/p25/derive-qt-intent.js` 重跑（1566/1566 行，requiredRelations 动态断言随 377 成立）；variation/misconception 未重跑（题面零变化）。
  - **计数断言同步**：`dev/verify-kbl-runtime.js`（374→377）、`dev/check-kbl-quality.js`（EXPECT.relations 377 + Q1/Q6/Q7/Q8 标签）、`dev/p30/check-kbl-lineage.js`（L6c 标签）、`dev/p25/derive-qt-intent.js`（注释 374→377）、`dev/p40/t12-regression-baseline.js`（①39→42 断言 + ④注释 374→377）；测试 `p40-t02-t07`（主干 12→13 / 扩展 13→12 / T-04 39→42 / T-06 族间边 61→60 / T-07 倒挂 54→53，含归属纠正消解注释）、`p40-t11`（39/39→42/42）、`p40-t10`（注释 374→377）。
  - **文档当前口径**：`docs/00-BASELINE.md`（Relations 377、注明 H10-A 373→374 / H10-B 374→377、族表 13/12、R-REL-03 42、倒挂 53）、`docs/02-KBL.md`（§1/§2/R-FAM-01/03/04、已知观察项）、`docs/DESIGN-REPORT.md`（17/111/113/232）。
- **deleted**: 无。
- **reason**: 用户 2026-10-31 签批「按 A、B 分开签批的顺序执行」，H10-A 门禁过完后执行 B。G3 上「观察物体」→ G4 下「观察物体」→ G5 上「观察简单组合体」→ G5 下「观察物体」构成同概念主线（四单元精确名经取证确认），原 fam_observation 为扩展族无跨册链边，升为 CONCEPT_FAMILIES 主干链后派生器机械产出 3 条链边；不人为造前置、不改 FAMILY_RULES、不动方向与位置链（G4→G6 跳 G5 评审挂起）。
- **tests**: 定向 `p40-t02-t07`/`p40-t10`/`p40-t11` 12/12 PASS；`npm test` **934/934 / 0 FAIL**；`npm run verify` 8/8 PASS；`t07-family-difficulty-scan` 倒挂 **54→53**（fam_observation 归属纠正消解 1 处，快照已重存）；`t12-regression-baseline` 七项全过（①42/42 ②族 22 dup=0 inv=0 ④DAG=true ⑤qt-intent 零重冻 ⑥6a FAIL=0）；`node dev/check-all.js` **33 PASS / 0 FAIL / 1 SKIP**（#15 本机无 Chrome）；T-06 族间边 **61→60**（归属纠正），族投影环为既有 needs-review 观察项（fam_observation 相关环非本次引入）。
- **risk**: 低——①题面/答案零变化，ALLOW 1566 不变，组合题合法路径 +3（fam_observation 相关跨族组合）；②倒挂 54→53 与族间边 61→60 为族归属纠正的如实回落，按「实测回填」原则更新断言，非改数据；③回滚 = 还原族表两行 + 重派生 + 反向还原断言/文档；④方向与位置链仍评审挂起；⑤未 git commit。

## H10-A | 2026-10-31 | 负数概念链 fam_negative 升主干（用户签批后执行）

- **modified**:
  - **唯一改动点**：`tools/kbl/derive-relations.js` —— `CONCEPT_FAMILIES` 追加 `fam_negative`（stages=`[['g6','up','负数'],['g6','down','负数']]`，ops=`['abstract_up']`），`EXTRA_FAMILIES` 同步删除该项；`FAMILY_RULES` 未动。
  - **T1 重派生**：`npm run kbl:derive && npm run build:knowledge` → relations **373→374**（R-REL-01 277 / R-REL-02 58 / R-REL-03 **39**）；新边 `math-g6-up-u07-k001 寻找负数 → math-g6-down-u01-k001 负数的意义`（fam_negative，stageOrder 1→4 递增，op=abstract_up）；ALLOW **1566 不变**；manifest counts 375/98/374/1566，rootHash `028d0254…`。
  - **T2 顺延**：`dev/p25/derive-qt-intent.js` 重跑（1566/1566 行，requiredRelations 投影总数动态断言随 374 成立）；variation/misconception 未重跑（题面零变化）。
  - **计数断言同步**：`dev/verify-kbl-runtime.js`（373→374）、`dev/check-kbl-quality.js`（EXPECT.relations 374 + Q1/Q6/Q7/Q8 标签）、`dev/p30/check-kbl-lineage.js`（L6c 标签）、`dev/p25/derive-qt-intent.js`（注释 373→374）、`dev/p40/t12-regression-baseline.js`（①38→39 断言 + ④注释）；测试 `p40-t02-t07`（主干 11→12 / 扩展 14→13 / T-04 38→39）、`p40-t11`（38/38→39/39）、`p40-t10`（注释 373→374）。
  - **文档当前口径**：`docs/00-BASELINE.md`（Relations 374、族表 12/13、R-REL-03 39）、`docs/02-KBL.md`（§1/§2/R-FAM-03/04、已知观察项）、`docs/DESIGN-REPORT.md`（17/111/113/232）；`docs/03-POL-GENERATION.md` 为 P28 快照不改。
- **deleted**: 无。
- **reason**: 用户 2026-10-31 签批「按 A、B 分开签批的顺序执行」。G6 上「生活中的负数」（综合实践单元名含负数）→ G6 下「负数」构成同概念主线（认识→意义），原 fam_negative 为扩展族无跨册链边，升为 CONCEPT_FAMILIES 主干链后派生器机械产出该边；不人为造前置、不改 FAMILY_RULES、不动方向与位置链。
- **tests**: 定向 `p40-t02-t07`/`p40-t10`/`p40-t11` 12/12 PASS；`npm test` **934/934 / 0 FAIL**；`npm run verify` 8/8 PASS；`t07-family-difficulty-scan` 倒挂 54 不变（needs-review）；`t12-regression-baseline` 七项全过（①39/39 ④DAG=true ⑤qt-intent 零重冻 ⑥6a FAIL=0）；`node dev/check-all.js` **33 PASS / 0 FAIL / 1 SKIP**（#15 本机无 Chrome）；T-06 族间边 61 条不变，族投影环为既有观察项（fam_negative 不在任何环上，已实证）。
- **risk**: 低——①题面/答案零变化，ALLOW 1566 不变，组合题合法路径 +1（fam_negative 相关跨族组合）；②T06「族间环」needs-review 为基线既有观察（primary-family 折叠产物），非本次引入；③回滚 = 还原族表两行 + 重派生 + 反向还原断言/文档；④H10-B 观察物体链尚未执行，等签批；⑤未 git commit。

## H9 | 2026-10-31 | G6「分数乘法」4 KP 域误判修复（源 Excel 人工改判「数与代数」后执行）

- **modified**:
  - **T0（人工）**：`kbl/root/小学G1-G6数学知识点.xlsx` 行 324–327「数学分类」`图形与几何` → `数与代数`（仅人可改，AI 未触碰 Excel）。
  - **T1 重派生（脚本链）**：`npm run kbl:rebuild` → 4 KP `domain=algebra`；`allowedTypes` 5→4（去 geometry/judge、加 calc）；mappings/ALLOW **1570→1566**；relations **373 不变**。
  - **T2 教学语义（全部脚本再生，无手编 JSON）**：
    - `kbl/teaching/kp-matrix.json`（`dev/p25/build-baseline.js`）：A=312 / B=62 / C=1 / D=0。
    - `kbl/teaching/qt-intent.json`：4 KP 的 geometry/judge 意图行消失、calc 行新增；k003 等 graphicRole 回落 `null`。
    - `kbl/teaching/evidence-rules.json`：`dev/p25/derive-evidence-candidates.js` + `apply-evidence-candidates.js` 重派生；A 1315 + B/C 247 = **1562** 行（覆盖 374 KP，k004 无规则走 skip）；新增 `--refresh-stale` 仅对 `semantic.family=` 规范锚点做原子刷新（stale 3 行：k001 fill/choice/apply）；A 类死规则按 ALLOW 面脚本化剔除（k001 geometry/judge 2 行）。
    - `kbl/teaching/semantic-families.json`（`dev/p25/derive-semantic-families.js`）：375 KP / 15 族 / 多族 123 / flagged 0；k001–k003 → fraction，k004 → word-application（name 证据）。
    - `kbl/teaching/variation-profiles.json`（`dev/p27/derive-variation-profiles.js`）：A 312 × ALLOW = **1315** 剖面行；生成失败 0。
    - `kbl/teaching/misconception-profiles.json`（`dev/p27/derive-misconceptions.js`）：312 KP 有槽 / 962 slots。
    - `shared/knowledge/teaching/misconception-profiles.json`：按 P39/P42 先例由 kbl 源真值镜像同步；`tools/kbl/build.js` 重冻 manifest，rootHash `ad112c84…`。
  - **生成器（用户显式授权「先补生成器再收口」的跨层修复）**：
    - `shared/generator/generators/shape.js`：`intentWantsGraphic(plan)` 意图闸门；`makeFractionTimesIntegerQuestion` 双形态（有图/无图）；calc 分支 `计算：expr = ？`；choice 补「这样的 N 份，计算」衔接；派发 qts 含 calc。
    - `shared/generator/generators/arithmetic.js`：`fractionChoiceOptions` / `fractionMakerBase` / `makeFractionOfQuantityQuestion`（k002）/ `makeFractionTwiceQuestion`（k004）；mixed 派发按名称唯一命中（「一个数乘分数」/「解决问题」）。
    - `shared/engine/strategy-engine.bundle.js` 重建（`npm run build:strategy`，modules 65 / shims 4）。
  - **测试断言同步（按 H9 现实重写，非删用例）**：`p25-09`（ALLOW ≥1566）、`p25-14`（375/1566/312）、`p25-15`（A 313→312）、`p25-17`（1570→1566）、`p25-05`（g6-up-u02 族归属）、`p28-geometry-native-makers`（ROWS 11→7）、`p28-hollow-plan1-native`（k001 5→4 行、operation=mult、禁图）、`p40-q18`（4 行 calc/fill/choice/apply、禁图）、`p42-2c`（k003 judge→calc、图形闸门改 graphicRole=null 口径）。
  - **门禁硬编码同步**：`dev/p30/check-generation-failure-classify.js` 动态枚举行数 1570→1566；`dev/p32/check-answer-leak.js` 白名单 +1（k003 calc token「4」，B-OPERAND，175→176 条）。
  - **文档当前口径**：`docs/00-BASELINE.md`（61–63/158–160/199–200）、`docs/02-KBL.md`（13）、`docs/DESIGN-REPORT.md`（17/113/124/232）、`README.md`（68–72）、`llms.txt`（38）；`docs/03-POL-GENERATION.md` 为 P28 FROZEN 历史快照，仅加注「当前 1566」不改写历史数字。
- **deleted**: 无文件删除；仅派生器层剔除 A 类死规则 2 行（k001 geometry/judge 孤儿规则，随 ALLOW 面收敛，非手工删行）。
- **reason**: H9 源数据（T0 Excel）经人工更正后，按 `docs/archive/phases/human-data-requests/README.md` H9 步骤 2–11 执行：4 KP 由「图形与几何」改判「数与代数」，题型声明由 geometry/judge 改为 calc，生成矩阵 1570→1566，关系基线 373 不动。6b 暴露的 6 条真实生成失败经用户裁决「先补生成器再收口」，以原生分数乘整数/分数应用 maker 接通，而非降 Validator 标准或回退题型。H9-T2-01（k004 无证据规则）以四态 `skip` 如实表达，不补造语义；k001 geometry/judge 规则随 ALLOW 面由派生器剔除。
- **tests**: `npm test` **934/934 PASS / 0 FAIL**；`npm run verify:allow-gen` **1566/1566 FAIL 0**；6b `check-generation-matrix-freeze --write` 1566 行 FAIL 0；6c 23 Generator FAIL 0；6d 四轴 8/0；6e `--write` 1566（target=1219 / format=13 / target-frozen=334）；6f Layer A 1566/1566、Layer B FAILED 0 / 0 题 0；6g PASS（L1 135 白名单全登记、L2 651 SUCCESS/0 未登记）；7 教育语义 936 PASS；8 金题集 1114 PASS；18 覆盖率 5/7 implemented（2 项 known declared-only）；`node dev/check-all.js` **33 PASS / 0 FAIL / 1 SKIP**（#15 本机无 Chrome）；375/98/373 不变，ALLOW 1566。
- **risk**: ① 4 KP 全部题型题面由「看图列式」改为「口算/列式」，4×4=16 行产出变化，6b/6e/6g 已重冻并记账；② k003 calc 答案 4 恰与分配律算式操作数 4 同值，按既有 B-OPERAND 家族登记白名单（非答案复述，需评审可复核）；③ k004 `operations=[]` 无 B/C 算法锚点，证据规则覆盖 374/375，k004 走 skip 属如实留白；④ 教学语义副本按 P39/P42 先例「kbl 源为 SSOT 拉回真值」同步，未新建第二条派生链；⑤ H10 全程零写入，前置关系 373 不变；⑥ 未 git commit。
