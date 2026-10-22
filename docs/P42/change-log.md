# P42 Change Log

> 质量缺陷修复战役日志（append-only，最新在上）。缺陷登记与批次记录 SSOT：`docs/maintenance/P42-DEFECT-REGISTER.md`（§0.x）。
> 基线口径：375 KP / 98 Units / 373 Relations / 1570 ALLOW——全程零变动。

---

## P42-11 | 2026-10-19 | 推送前整理：当前态文档关键数据对账 + 死代码 pickOpt 清理

- **modified**:
  - `docs/00-BASELINE.md`：测试 894→936 用例、93→101 文件、generation 44→52、耗时 8–9s→约 18s、门禁口径 33 项(32+1)→34 项(33+1，CI 34/34)、Syntax 328→342、门禁表补第 23 项 Instance Gates（P42-4 新增未同步）
  - `docs/10-TEST-CI.md`：Syntax 342 文件、Unit 936/936
  - `docs/DESIGN-REPORT.md`：936 用例/16 套件/101 文件、Syntax 342、936/936
  - `dev/p28/check-dead-code.js`：[15] pickOpt 候选 KEEP→REMOVE-SYMBOL 口径转正（P42-10）
  - `shared/core/check.js`：pickOpt/__pickOpt 物理删除（函数 + PluginUtil.pickOpt + global.__pickOpt + module.exports.pickOpt），头注释留痕
  - `shared/core/common.js`：头注释去 pickOpt 字样
- **deleted**: `shared/core/check.js` 内 pickOpt 符号族（~20 行：函数体 + 双全局挂载 + 导出键）
- **reason**: 推送前整理（用户指令「整理上次推送到目前为止」）。①对账实测：KP=375 / Units=98 / Relations=373 / ALLOW=1570、版本四方 5.2.0 全一致零漂移；当前态文档过程性数字 stale（P42 新增 8 测试文件 + check-all 第 23 项未同步基线），按实测对齐；②死代码矩阵唯一遗留 KEEP 候选 [15] pickOpt——其操作的 .opt 类已随 P28-UI-PRINTSTYLE-CLEANUP-01 删除（零产出方），prod/test/bundle 三方零调用（门禁工具 + 全库检索双印证），按 P30 §5 物理删除转正；另一 KEEP 为 DORMANT-CONTRACT-CARRIER 冻结载体，按 P28 判例不翻案
- **tests**: `npm test` **936/936**；`node dev/check-all.js` **33 PASS / 0 FAIL / 1 SKIP / 34 项**（文档改动后复跑：第 20 项 Doc ✓、第 21 项 Dead Code KEEP 2→1 ✓）；strategy/presentation 两 bundle 零命中 pickOpt（未内联 check.js），无需重建；基线 375/98/373/1570 零变动
- **risk**: 低——①历史快照（AUDIT-LOG / P41-REPORT / P41 报告）按「阶段快照不改」纪律保留未动；②pickOpt 删除有门禁矩阵登记 + 全库检索双证据，非无据清理；③未 git commit

---

## P42-10 | 2026-10-19 | shared/core/common.js 聚合入口 Node 侧按需化解耦（方案 1）

- **modified**:
  - `shared/core/common.js`：Node require 序列 4→1（仅保留 `./core.js`）；check.js / ui-state.js / storage.js 从 Node 加载序列摘出；浏览器 document.write 注入分支不变（页面聚合入口职责冻结，零页面改动）；头部注释同步
  - `shared/engine/practice-session.js`：computeResult 消费改经 `Check`（Node 直接 require '../core/check.js' 模块导出，浏览器仍走 common.js 注入的 global.PluginUtil）；零消费的 `var PluginUtil`（require common.js）随解耦物理删除——本文件对 common.js 的依赖解除
  - `tests/core/compute-result.test.js`：computeResult 来源契约更新为 check.js 模块导出（保留 common.js require 以维持 defaultQCheck/normalizeAns 删除残留断言经 global.PluginUtil）
- **deleted**: 无文件删除；`practice-session.js` 内 `var PluginUtil = … require('../core/common.js')` 零消费声明物理删除
- **reason**: 链路分析实证：`shared/catalog/difficulty.js` 仅消费 `PluginUtil.diffLevel/diffScale/diffMax`（core.js 纯函数），经 common.js 聚合入口被迫把 check/ui-state/storage 拖进 Node 加载闭包，并被 strategy 全部 21 文件与 generator 大量模块传递继承（最长链 16 节点）。方案 1（用户裁决 2026-10-19，原口头编号「P42-9」经确认顺延为 P42-10）：common.js Node 序列按需化，消费方直取所需模块；方案 2/3 不做，presentation-engine 保持现状。消费矩阵核实：check.js 唯一 Node 生产消费方 = practice-session（computeResult）；ui-state/storage Node 零生产消费方（learner-storage 自带惰性 require、ui-state 测试直取模块）——摘除零断链
- **tests**: 定向 `node --test tests/core|orchestration|source` **172/172**；`npm test` **936/936**；`node dev/check-all.js` **33 PASS / 0 FAIL / 1 SKIP / 34 项**（第 15 项真实浏览器 E2E 本机无 Chrome SKIP 属正常）；第 16/17 项 bundle 确定性 ✓ 实证 strategy/presentation 两 bundle 均不内联 common.js（外部全局引用注册），无需重建；基线 375/98/373/1570 零变动；题面/答案文案零触碰（variation/misconception 派生无需重跑）
- **risk**: 低——①浏览器路径零改动（document.write 注入 4 子模块不变，页面/E2E 行为不变）；②Node 加载序变化仅影响测试与构建侧（strategy/generator 链不再拖 state/validator 模块）；③`Check` 环境分支与文件既有 GenerationEngine/Print/resolveLayout 解析模式同款，非双轨兼容层；④未 git commit

---

## P42-9 | 2026-10-19 | explanationQuality 弱判定只读审计（025 重定性为判据④重构；零代码改动）

- **modified**:
  - `docs/maintenance/P42-DEFECT-REGISTER.md`（§0.17 + 批注链）：弱判定盘点、1570 面实测、链路诊断、025 重定性——**生产代码零触碰**
- **deleted**: 无
- **reason**: 用户质询「最小修改是否已造成大量包含子集、不解决问题的链路」——经盘点与实测质疑成立，P42-8 拟议的「025 分段匹配判据扩展」作废（上限 5 行收益 vs ④三态膨胀+噪声升高）。1570 面实测：④子串对长度≤2 短答案面 **936/1570（59.6%）近乎恒真**；③仅靠等号命中 **518/1570（33.0%）**；explanationQuality 为七维唯一弱判定维且是纯观测器（不回流生成/校验决策），0.5/0.6 阈值实际测「①②+答案形态可达性」而非解析质量——观测链上无修复通道，内容修复只能在生成模板层（P42-7 判例）。watch 16 行维持 025 终态登记；025 重定性为「explanationQuality 判据④重构」（短答案恒真治理+③等号收敛+结构化评分），携实测数据独立立项。
- **tests**: 零代码改动（scorer/tests/bundle/KBL/T2 零触碰）；1570 面只读重放（seed 协议不变）；`node dev/check-all.js` **34 PASS / 0 FAIL / 0 SKIP / 34 项**（register 文档变更后全量复跑实证）。
- **risk**: 无新增——纯分析批次；§0.17 数字（59.6%/33.0%）为实测记录非 stale 断言（第 20 项扫描已过）；未 git commit。

---

## P42-8 | 2026-10-19 | watch A 类符号答案归一（scorer 字符集缺口，watch 25→16）

- **modified**:
  - `shared/validator/quality-scorer.js`（L48，1 行）：`normalizeExplText` 保留集补 `< > ☆`（实证最小集）——A 类 9 行（fill 4 + choice 4 答案值 `<`、geometry 1 答案值 `☆`）根因：符号被删 → normAns 空串 → 判据④跳过；解析实际含符号，scorer 侧缺口非模板缺位
  - `tests/validator/p40-q10-explanation-quality.test.js`（+1 用例）：fill `<` 答案解析含 `<` → ④命中 1.0；geometry `☆` 无③步骤词 → 0.75
- **deleted**: 无
- **reason**: §0.15 余 25 watch 行取证分类（用户裁决立项）——A 类 symbol-empty 9 行为 scorer 字符集缺口（可修）；B 类 text 16 行（apply 9 开放式答案④结构性不可达 + fill 7 多段答案全串匹配过严）属 025「非数值答案自动真值/结构化评分」语义增强范畴，维持登记不顺手扩（P30 纪律），025 处置依据升级为有明确 16 行实证清单。
- **tests**: presentation-engine.bundle.js 重建（18 inlined）；Instance Gates 复跑 **watch 25→16 零降级**（对账自洽：A 类 9 行 0.5→0.75 + 12 行 0.75→1.0，0.5 无新增 16=25−9；「从严方向」实测零回归；分布 1.0 939/0.75 615/0.5 16；余 watch apply 9 + fill 7 = B 类）；`npm test` **936/936**（935+1）；`node dev/check-all.js` **34 PASS / 0 FAIL / 0 SKIP / 34 项**（第 16 项 bundle hash ✓、第 23 项 Instance ✓）。
- **risk**: 低——①字符集补符号影响 ②重述/④子串两消费方（更精确匹配）；②实测 1570 面零降级；③T2 派生/6b/6e/rootHash/golden 零影响（scorer 不改生成产物）；④未 git commit。

---

## P42-7 | 2026-10-19 | judge 27 行结论词模板缺口根因修复（watch 52→25，judge 清零）

- **modified**:
  - `shared/generator/generators/shape.js`（L1844，1 行）：judge misconception 判定分支解析尾补「，说法错误。」——该分支原为 `'「'+shown+'」——'+w.m` 纯批评句无结论词（true 分支 L1840 已有「说法正确」）；23 个 watch KP 根因
  - `shared/generator/generators/position.js`（L407，1 行）：平移 judge false 分支解析尾补「，说法错误。」（true 分支 L406 已有「答案正确」；方向分支 L125/126 本有结论词非缺口）；4 个 watch KP 根因
  - `data.misconception` 数据字段零触碰（下游消费零影响）
- **deleted**: 无
- **reason**: §0.14 新观察「judge 27 行结论词模板缺口」（生成器模板层，用户裁决立项）。27 watch KP 生成器映射取证收敛至 2 个根因模板（shape-recognition 23 + position-direction 4），两处均为 false 分支解析缺结论词——P42-6 判据④′口径下 0.5 的模板层根因。修复=解析尾补结论词（④′否定词命中且与 value=false 一致），非硬编码 KP/答案。
- **tests**: 验证面实测 2 KP quality 0.5→0.75；重冻链——strategy-engine.bundle.js 重建（65 modules；教训实证：`_bundle-env` 走 bundle，改 generator 不重建则修复不生效）、T2 派生重跑（variation+misconception）、T3 镜像同步、`tools/kbl/build.js` rootHash a83db4cf… 不变（canonical 零变动）、6b --write（1570/1570 FAIL rows=0）、6e --write、P2 面审计复跑基线不变（watch 组 164）；`npm test` **935/935 零失败**（无文案精确断言，无需重写）；Instance Gates 复跑 **watch 52→25、judge 清零**（27=22→0.75+5→1.0 对账自洽；分布 1.0 927/0.75 618/0.5 25；余 25 行非 judge 存量）；`node dev/check-all.js` **34 PASS / 0 FAIL / 0 SKIP / 34 项**（第 16 项 bundle hash ✓、第 23 项 Instance ✓、FINAL-91 PASS）。
- **risk**: 低——①改动面 2 行文案尾补；②judge true 分支/方向分支零触碰；③golden-questions.json 零变动（不重跑 build）；④基线 375/98/373/1570 零变动；⑤未 git commit。

---

## P42-6 | 2026-10-19 | judge 判据④′落地（029 门禁 judge 结构性不可达闭合）

- **modified**:
  - `shared/validator/quality-scorer.js`（唯一生产改动，~15 行）：新增 `boolConclusionConsistent(normExpl, boolVal)`——judge 布尔答案判据④′（解析含与答案一致的结论词；否定词优先：错误|不对|不正确|不成立 防止「不对」含「对」子串误判；词集取自 judge 解析实证形态「说法正确/错误」，不用 √/× 符号——normalizeExplText 删符号）；判据④分支化：布尔走④′ / 非布尔走原④（else-if 等价，非 judge 行零变化）
  - `tests/validator/p40-q10-explanation-quality.test.js`（+2 用例）：④′正例（true+「说法正确」、false+「说法错误」→ 0.75，③不可达上限）+ 负例回归（结论相反→0.5、无结论词→0.5 诚实缺位、否定词优先「不对」+false→0.75、非布尔原④→1 保护）
  - `dev/p42/check-instance-gates.js`（头注释口径）：watch 存量 133→52、judge 行不再结构性不可达（阈值 0.5/0.6 不动）
- **deleted**: 无
- **reason**: §0.12 新发现登记「quality-scorer 判据④对 judge 题结构性不可达」（用户裁决立项，四项按需立项残余之一）。judge 答案 true/false 使原④「解析含答案值子串」数学上恒 false，judge 解析质量被系统性低估 0.25。④′以「结论词与答案一致」为布尔答案的④语义等价物；27 行真·无结论词 judge（解析有否定理由但字面无标准结论词）诚实保留 watch 不硬凑——生成器模板补结论句属另一范围，仅登记。
- **tests**: 定向 `node --test tests/validator/p40-q10-explanation-quality.test.js tests/generation/p42-4-instance-gate.test.js` **14/14**；presentation-engine.bundle.js 重建（18 inlined）；Instance Gates 复跑 **watch 133→52**（分布 1.0 909→922 / 0.75 528→596 / 0.5 133→52；judge 81 行④′命中消除、13 行升 1.0、27 行诚实保留、非 judge 25 行不变——机器对账自洽）；`npm test` **935/935**（933+2）；`node dev/check-all.js` **34 PASS / 0 FAIL / 0 SKIP / 34 项**（第 16 项 bundle hash ✓、第 23 项 Instance exit 0 ✓、FINAL-91 PASS）。
- **risk**: 低——①非 judge 行分支等价有回归用例；②judge ③不可达维持 0.75 上限不虚高；③watch 不阻断；④词集最小无凑分；⑤6a/6b/rootHash 零影响（评分不改生成产物）；⑥未 git commit。

---

## P42-5 | 2026-10-19 | 027 残余闭合：golden build 写入前接入独立真值门

- **modified**:
  - `dev/p25/build-golden-dataset.js`（T2 派生脚本层，生成/写盘行为零变化）：①require P42-1C SSOT `dev/p42/truth-verifier.js`；②新增 `truthGate(sq)`——stem/answer 归一化与记录提取链同构（门审对象=即将写入的 structure.stem/structure.answer），`auditQuestion` FAIL→拒收 / UNVERIFIED+PASS→放行（与 SEMANTIC_PASS「不伪造收录」同口径；UNVERIFIED=诚实缺位不判错，P42-1D 口径）/ 门自身异常→UNVERIFIED 放行并记 `GATE-ERROR`；③两处采集点（collectOne + 主循环）在 SEMANTIC_PASS 后追加该门 + `truthRejected` 计数，两模式结尾打印「真值门拒收（FAIL）：N 题」；④产物 schema 零变化（不新增记录字段）；⑤底部 IIFE 包 `if (require.main === module)` + `module.exports = { truthGate }`（require 侧只取门，主流程不执行）
  - 测试：`tests/generation/p42-5-golden-truth-gate.test.js`（新建，4 用例）——门控制组（PASS 放行 / P42-005 形态假等式 FAIL 拒收 / 代数式与无断言解析 UNVERIFIED 放行 / 验证器异常放行并记 GATE-ERROR）+ 现存 golden 1114 题全量过门 `accepted=false` 必须为空（P42-1D 审计口径测试化，防未来重生成冻结入真缺陷）
- **deleted**: 无
- **reason**: P42-027 残余「golden build 步骤强制接入重算器」（用户裁决立项；四项按需立项残余之一）。现存数据已由 P42-1D 全量独立审计闭合（PASS 559 / FAIL 0 / UNVERIFIED 555），本批补上防再发的结构性防线：未来任何 golden 重生成，写入前必过独立数学重算门，假等式在入口即被拒收。零生产链改动（派生脚本层）；**不重跑 build**（脚本无 seed，重跑将改变抽样且属数据变动；现存 1114 题测试化断言 FAIL=0 与 1D 一致）。
- **tests**: 冒烟（require 守卫 + 4 控制组 + 标识符 charCode 机器核验同形无混）；定向 `node --test tests/generation/p42-5-golden-truth-gate.test.js` **4/4**；`npm test` **933/933**（基线 929 + 本批 4）；`node dev/check-all.js`（CHROME_BIN=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome）**34 PASS / 0 FAIL / 0 SKIP / 34 项**（FINAL-91 PASS）。
- **risk**: 低——①门只在 golden build 未来重跑时生效，现存数据零变动（golden-questions.json 未重生成，rootHash/6a/6b/6e 零影响，check-all 全绿实证）；②UNVERIFIED 放行口径与 1D 一致（555 题诚实缺位），FAIL 拒收严格（1 例实测拒收）；③门异常放行而非阻塞派生（审计工具故障不阻断 T2 生成，failures 明细可查）；④dev/p25 脚本属 T2 唯一可写方白名单成员，本批只改其校验逻辑未改写路径；⑤未 git commit。

---

## P42-4 | 2026-10-19 | 031/032 生成器真值根因修复 + 028/029 实例级门禁落地

- **modified**:
  - 生产（2 生成器 + 1 validator 导出，全部根因式最小修改）：
    - `shared/generator/generators/concept-meaning.js`：①makeByItem 抽取块重构为双通道守卫（P42-031）——`exprAnsFromTail` 仅从「=」尾提取（纯整数 /「商……余数」/ 前导数字且非未完链式）、`exprFormOk` 纯算式形态（首字符数字/负号、无句读、无空位），守卫 `(exprFormOk || exprAnsFromTail != null)`：句子型支撑串（教学指令句）→ expr 置 null 诚实退化「答案是 X」，源数据「=」右值恒真形态（如「参考：80 × 2 = 160」）保留；附带收口伪等式「10 + 15 = a + 15（岁）」。②makeAngleFill（P42-029 登记样本 math-g3-up-u07-k002 fill）解析补答案值「横线里填 2」
    - `shared/generator/generators/fraction.js`：nature/calc 约分列式右值 `cr.n` → `ca`（本步商 cn/g2，P42-032，用户裁决非 gcd 口径）；gcd(ca,cb)=1 时输出逐字节不变
    - `shared/validator/quality-scorer.js`：module.exports 补导出 `scoreExplanationQuality`（029 门禁与测试需具名消费；**连带重建 presentation-engine.bundle.js**——该 validator 被 bundle 内联，run 1 门禁第 16 项就地暴露 stale，官方脚本重建 +1 行后 run 2 全绿）
  - 门禁：`dev/p42/check-instance-gates.js`（新建，lib+CLI）——Section A 028 `DI.validateDifficultyIntegrity(q,{})` errors→FAIL；Section B 029 `QS.scoreExplanationQuality(q)` 分级（`QUALITY_FLOOR=0.5` FAIL / `QUALITY_TARGET=0.6` watch）；1570 面重放（同审计 seed 协议），证据 `dev/p42/out/p42-4-instance-gate.json`，fail>0 exit 1；`dev/check-all.js` 第 22 项后插入第 23 项 Instance（33→34 项）
  - 测试：`tests/generation/p42-1b-explanation-equation-truth.test.js` 扩展（FAMILIES +3 行 k003 calc/fill/apply + P42_031_SAMPLES 3 例断言）；`tests/generation/p42-4-fraction-simplify-truth.test.js` 新建（全 seed 面 d1..4×v0..3 列式逐行真值 + 6/12 登记样本回归）；`tests/generation/p42-4-instance-gate.test.js` 新建（028 分类 / 029 五档分级 / 029 样本质量分 ≥0.6）；`tests/generation/p42-1c-truth-verifier.test.js` P42-013 断言携复现依据重写（PASS→UNVERIFIED：031 守卫诚实退化、P42-011 口径，另加「任何登记例不得 FAIL」硬底线）
  - 重冻链（答案文案变更触发，2C 先例全套）：`dev/p27/derive-variation-profiles.js` + `derive-misconceptions.js` 重跑（`kbl/teaching/variation-profiles.json` 1323 行 + `misconception-profiles.json` 375 KP/971 slots）→ `shared/knowledge/teaching/misconception-profiles.json` T3 镜像 + `tools/kbl/build.js` manifest rootHash 重冻（`a83db4cf…` 未变，kbl/manifest 与 shared/knowledge/manifest 双落）；6b `--write`（`P28-GENERATION-MATRIX-FROZEN.{json,md}`：1570/1570、FAIL rows=0）+ 6e `--write`（`P30-KP-QT-MAKER-MATRIX.json`）；`strategy-engine.bundle.js` 重建；`dev/p42/out/p42-1c-truth-audit.json` 复跑（**FAIL 4→0**）、`p42-2b-participation-audit.json` 复跑（基线不变 14 alert + 164 watch）
- **deleted**: 无
- **reason**: P42-4 批次四缺陷（031/032 高严重级生成器真值 + 028/029 覆盖缺口）经用户批准最小方案执行。031：句子型支撑串被整体当算式拼假等式（与 003~009 同拼接点、1B 未覆盖的「句子非算式」姊妹形态）；032：约分列式模板把本步除数与最简分子混用（gcd>1 时假等式，如 6 ÷ 2 = 1）。028 定性：登记建议「pipeline required:true」为空操作（Layer 2/3 `stopOnFailure:false`、`layerHasErrors` 从不使用、6a 不跑 pipeline）→ 唯一路径为 check-all 新门禁项（1570 面 diffFail 0/diffWarn 0 即时绿）。029 定性：judge 布尔答案使判据④「解析含答案值」结构性不可达（硬 0.6 对 judge 数学上不可能达标）→ 分级门禁（硬底线 0.5 当前 0 违规 / watch 0.6 带 133 行记录级）+ 修复登记样本行。三项用户裁决：032 右值=本步商 ca；029 分级门禁+修样本行；028/029 合一文件一项。
- **tests**: 定向 `p42-1b`（3/3）+ `p42-4-fraction-simplify-truth`（2/2）+ `p42-4-instance-gate`（3/3）+ `p42-1c-truth-verifier`（9/9）；`npm test` **929/929**（基线 923 + 本批净增 6）；`node dev/check-all.js`（CHROME_BIN=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome）**34 PASS / 0 FAIL / 0 SKIP / 34 项**（第 23 项 Instance 首跑 0 fail / 133 watch；FINAL-91 PASS；run 1 第 16 项暴露 presentation bundle stale——quality-scorer 补导出后未重建，官方重建后 run 2 全绿）。面实测：028 diffFail 0 / diffWarn 0；029 质量分布 1.0→909 / 0.75→528 / 0.5→133（watch）。
- **risk**: 低-中——①031 守卫致解析丰富度退化面：句子前缀支撑串行不再产等式（1 例实证 P42-013，UNVERIFIED 诚实退化口径已携复现依据登记于测试与 register §0.12，真值不损）；②fraction 右值改动 gcd=1 面逐字节不变、gcd>1 面题干由假等式变真等式（6b/6e 重冻一致、6g AS-18 无新增命中）；③T2 派生重跑 + T3 镜像 + rootHash 重冻（`a83db4cf…` 未变，基线 375/98/373/1570 零变动）；④watch 133 行记录级不阻塞；⑤judge ④ 结构性不可达登记新发现留待按需立项（不顺手修）；⑥未 git commit。

---

## P42-3 | 2026-10-19 | P1 复用指标分级阈值治理 + P42-030 CI Chrome 闭合

- **modified**:
  - `dev/p42/participation-checker.js`：P1 告警单一硬编码「组内 ≥2 KP」治理为具名分级阈值 `REUSE_THRESHOLDS`——精确组 `EXACT_ALERT_MIN_KP=2` alert（维持基线 §3 口径）；模板组 `TEMPLATE_ALERT_MIN_KP=10`（≥2 watch / ≥10 alert，依据=精确组历史最大扇出 9，归一后仍跨 ≥10 KP=模板签名缺失强信号）；`reuseMetrics` 返回扩展 `{ groups, alerts, watch }`，组集合零丢失仅分级
  - `dev/p42/audit-participation-face.js`：P1 输出增 watch 层（console + JSON `templateWatchGroups`/`templateWatchMaxFanout` + `templateWatch` {key,kpCount} 明细）
  - `tests/generation/p42-2b-participation-checker.test.js`：P1 断言随治理决策重写（模板 3 KP→watch；新增 10 KP alert + alert/watch 互斥控制组；精确组语义保留）
  - `dev/p42/out/p42-2b-participation-audit.json`：1570 面复跑刷新（face 1570/sessionErrors 0；P1 精确 62 / 模板 alert 14〔全部跨年级〕+ watch 164；P2 候选 14=§0.10 残留；P3 numeric 191/text 97/short-text 59/fraction 21/placeholder 7）
- **deleted**: 无
- **reason**: 优先级表 P42-3 残余（阈值治理 + 030）。模板组单一 ≥2 告警 178 组中 91 组为 2-KP 自然撞车噪声、无行动意义，治理为 ≥2 watch / ≥10 alert（分级模型经用户批准）；030 的 CI 配置自 FINAL-12（commit 6923761）已在位（ci.yml `REQUIRE_BROWSER_E2E=1` + `CHROME_BIN=google-chrome`，环境要求见 docs/10-TEST-CI.md），本批补齐含 Chrome 环境 33/33 实测证据闭合（第 15 项 9 步 E2E 首次本地真实执行）。
- **tests**: 定向 `node --test tests/generation/p42-2b-participation-checker.test.js` **6/6**；`npm test` **923/923**；`node dev/check-all.js`（CHROME_BIN=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome）**33 PASS / 0 FAIL / 0 SKIP / 33 项**（P42 战役首次满编，FINAL-91 PASS；首轮 run 的 E2E timeout + register 差异甄别为双 check-all 实例并发瞬态，单实例重跑通过）。
- **risk**: 低——零生产链改动（dev/p42 审计层 + 测试）；阈值 10 有面实测依据；023 残余「模板 KP 签名」与 025 残余「非数值答案自动真值」均明确登记留待按需立项；未 git commit。

---

## P42-2C | 2026-10-18 | P42-033 跨 KP 错挂家族根因修复（14 KP 组 33 行）

- **modified**:
  - 生产（7 生成器，全部信号式收窄，无 KP 白名单硬编码）：
    - `shared/generator/generators/semantic-relations.js`：新增正/反比例名称信号分派（`makeInversePropTyped` / `makeDirectPropApply`；名称含「反比例」仅 k005、含「正比例」仅 k004，k008 零变化）替换跨 KP 错挂模板；k005|choice 补题面（此前 buildBase 空串被校验拒绝 0 产出）；行船答案单位「条」收口（初次收口误沿用货运模板「次」，批次自引入缺陷 #1）
    - `shared/generator/generators/arithmetic.js`：k003 四题型意图闸门镜像配图（fill/choice→balance、calc/judge→groups，role=calculation-support，镜像通用路径 P38 `intentWantsGraphic` 模式；此前 maker 零 graphic 被 `KP_SEMANTIC_INTENT_ALIGNMENT` 拒绝 0 产出）；judge 题面前缀「用运算律简便计算：」（finishJudge V5.1.0 冻结行为覆盖 explanation，token 通道改走题面前缀）
    - `shared/generator/generators/position.js`：translation/rotation/clockHand 三 helper unitPx 30/34→35（对齐 T2 平移族冻结值 35；零外溢已验证——30 为质量单位族 rectangle 专属冻结值〔g3-up-u04-k002/3/4〕，translationDemo/rotationDemo 无 30/34 冻结行）
    - `shared/generator/generators/fraction.js`：约分/通分 fill 名称门控（脱离「分数的基本性质」模板；名称含「约分/通分」canonical 唯一命中 g5-down-u04-k005）；解析补等值等式「约分：2/10 = 1/5，分子分母同时除以公因数 2」（初次收口解析无等式 → 独立真值验证器 checked=0 UNVERIFIED，P42-011 反例暴露，批次自引入缺陷 #2）
    - `shared/generator/generators/reasoning.js`：7~9 乘除法除法 token 奇偶轮换（calc/choice i=0 落除法半边、apply 三形态轮换前移一位落平均分）；优化/统筹名称信号（「最优/策略」入 optimization 分派，「找次品的基本策略」被 find-defect 先命中零外溢）
    - `shared/generator/generators/shape.js`：平行与垂直 KP 语义参与（角度拼合之外补平行/垂直内容）
    - `shared/generator/generators/application.js`：不规则物体体积 KP 语义参与（替换整数加法错挂）
  - T2（P40 先例 commit 62df71f 口径就地修正，派生器 derive/apply 不支持行内更新——键冲突即失败）：`kbl/teaching/evidence-rules.json` 7 行 15 断言，before→after 全量披露：
    1. `math-g5-up-u04-k001|geometry` data.graphic.subtype `position-grid`→`translationDemo`；删 data.graphic.params.gridSize/showGrid/gridColor（修复后产出无此三字段）；data.shapeName `空间`→`平移`（同 KP choice/fill/judge 三行既有规则即「平移」且 PASS）
    2. `math-g5-up-u04-k001|apply` 同上 5 处（data.mode/steps/graphic.type/unitPx 四断言仍真保留）
    3. `math-g5-down-u08-k002|apply` 删 data.steps=1（优化 maker steps 按 variant 3/2/2 变动，非稳定字段；冻结自修复前单一 variant 口径）
    4. `math-g6-down-u04-k004|apply` data.proportion `inverse`→`direct`（旧值冻结自排队反比例错挂缺陷产出；修复后真实产出 direct，同 KP calc/fill/choice 规则即 direct 且 PASS）
    5. `math-g6-down-u04-k005|calc` data.proportion `direct`→`inverse`（旧值冻结自正比例错挂缺陷产出；在反比例题上声明 direct=假语义，不可反向适配生成器，故改 T2）
    6. `math-g6-down-u04-k005|fill` 同上
    7. `math-g6-down-u04-k005|choice` 同上
  - T2 派生重跑（答案文案变更触发）：`kbl/teaching/variation-profiles.json` + `kbl/teaching/misconception-profiles.json`（`dev/p27/derive-variation-profiles.js` / `derive-misconceptions.js`）
  - T3：`shared/knowledge/teaching/misconception-profiles.json` 镜像同步（kbl 源为 SSOT 拉回真值）+ `tools/kbl/build.js` manifest rootHash 重冻（`a83db4cf…`，kbl/manifest 与 shared/knowledge/manifest 双落）
  - 冻结产物重冻/刷新：`docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.{json,md}`（6b --write：1570/1570、FAIL rows=0、frozen=true、kpSemFail=0）；`docs/archive/phases/p30/P30-KP-QT-MAKER-MATRIX.json`（6e --write）；`dev/p42/out/p42-2b-participation-audit.json`（P2 面审计复跑）
  - 门禁注册表：`dev/p32/check-answer-leak.js` AS-18 白名单 174→175 条——新增 `['math-g6-up-u02-k003','fill','0.25','L1','B-OPERAND']`（该行此前被意图闸门拒绝 0 产出，修复后首进扫描；分配律填空空位求公因数，0.25 为题面已给展开左半的算式操作数，非答案复述）
- **deleted**: 无（未删除任何文件/符号；P42-033 修复走接通不改架构）
- **reason**: 登记 P42-033（14 KP 组 33 行跨 KP 错挂，§0.9 面审计新发现、优先级表原列 P42-3）经用户签收 P42-2B 后提前立项修复。根因结构：模板按题型/算子复用、KP 语义区分度缺失。修复策略信号式收窄——KP 名称信号分派（canonical 名称唯一性先核实）、意图闸门镜像、T2 冻结值对齐；其中 3 行（k003 四题型 + k005|choice）此前为「0 产出」形态（生成即被校验拒绝），修复后首产。验收口径：33 行登记 seed 反例断言 + token 回指断言 + 同面 P2 差分清零。
- **tests**: 定向 `node --test tests/generation/p42-2c-cross-kp-family.test.js` **7/7**（33 行 token 回指 + k003 图形闸门 + mixed 同族 7 KP 零变化面）；`tests/generation/p42-1c-truth-verifier.test.js` **9/9**（含 P42-011 反例回归）；`npm test` **923/923**（基线 916 + 2C 新增 7）；`node dev/check-all.js` **32 PASS / 0 FAIL / 1 SKIP**（与基线持平）；6b `frozen=true` / kpSemFail=0 / 退出码 0；6e 只读复核 PASS；6g AS-18 PASS（L1 白名单 134 / 未登记 0）。
- **risk**: 中——①T2 就地修正 7 行属「不可由脚本再生」的手工修正（P40 先例口径），已全量披露 before/after；若未来重跑 `derive-evidence-candidates.js`+`apply-evidence-candidates.js`，键冲突即失败不会覆盖，但行内更新需重走本披露流程；②unitPx 30/34→35 与 proportion 翻转均为「生成器真值 vs 冻结于缺陷产出的规则」冲突之双向裁决，选择改 T2 而非回退生成器（反向适配=假语义），已逐条给出同 KP 旁证（同 KP 其他题型规则与修复后产出一致）；③33 行中 5 行（k003×4 + k005|choice）为「0 产出→首产」新增面，6g 白名单已登记 1 条形式固有命中；④未 git commit。
