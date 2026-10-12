# P38 变更日志（33 KP 接入裁决与基线扩容战役）

> 战役性质：P37 收口后登记的重大变更战役——33 个被剔除 KP 的教学语义裁决与接入执行。
> 铁律：T0 数据权限（AI 不改 root Excel）；基线扩容只经人工补 Excel + 完整派生链。
> 日志 append-only，六字段，最新在上。

---

## P38-08 · needs-review 根因澄清：派生器规则覆盖不足，非 Excel 数据问题（2026-10-12）

- **modified**：无（纯登记/澄清，零代码改动）。
- **deleted**：无。
- **reason**：用户澄清「源 Excel 是早已确定的内容，若有不匹配提示即可」——纠正 P38-03/P38-07 中「待人工评审回流」的误导性表述。经核实 `dev/p25/derive-qt-intent.js` 源码：needs-review 状态完全由派生器推导逻辑决定（L200 whyThisType 推导失败→needs-review、L221/223 differentiation 失败→needs-review、L247 legitimacy 失败→needs-review、L282 任一问 needs-review→整行 needs-review），**与 root Excel 无关**。Excel 字段（KP 名/概念/单元/年级）早已确定且不动，needs-review 是派生器的推导规则覆盖不到某些 KP×QT 组合导致的，属规则缺口非数据缺口。正确处置路径：① 派生器推导失败时输出缺什么证据（已有 flags.push 标记）；② AI 改进派生器推导规则覆盖面（扩正则/匹配逻辑）；③ 重跑 `derive-qt-intent.js` → needs-review 行升级 ai-verified → intent 文本挂载。P38-07 已将 assessment（已成功推导）与 intent 文本（推导失败）分离——assessment 挂载使配图生效，intent 文本缺口可通过改派生器规则填补。P38-03 risk① 与 P38-07 reason 中「待人工评审回流」表述订正为「待派生器规则改进后重跑派生」。
- **tests**：纯登记澄清，零代码；门禁状态继承 P38-07 收口态（check-all 30/0/1）。
- **risk**：零（纯文档澄清，无门禁影响）。后续若改进派生器推导规则填补 141 行 intent 文本缺口，需走 P38-GEN 序列立项（改派生器 → 重跑 → 升级 status → 重建 bundle → 门禁）。

---

## P38-07 · 141 条 needs-review 意图行全部配图：闸门放开 + Generator 既有逻辑覆盖（2026-10-12）

- **modified**：
  - `shared/generator/core/semantic-parameters.js` L300-335：P30-06 权威闸门条件扩展——needs-review 且 assessment.graphicRole!=null 的行，assessment 机器约束（graphicRole）挂载，使 validator auxiliary 强制配图闸门生效 + Generator intentWantsGraphic 返回 true；intent 教学文本（trainsWhat 等）仍不挂载，待人工评审回流。用户显式指令覆盖 P30-06。
  - `shared/engine/strategy-engine.bundle.js`：重建。
  - `shared/engine/presentation-engine.bundle.js`：重建。
  - `docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.{json,md}`：重冻（+29 新配图图形）。
  - `shared/knowledge/mappings/generator-matrix/P30-GENERATOR-MATRIX.json`：重冻（6e）。
- **deleted**：无。
- **reason**：用户指令「不动原始 Excel。以上 KP 中涉及的问题需要全部配图。且是多样性图」。141 条 needs-review 行（99 KP，全 auxiliary role）此前因 P30-06 权威闸门 assessment 不挂载 → intent.graphicRole=null → validator 禁图 → Generator 不配图。本任务放开闸门：needs-review 行的 assessment.graphicRole 挂载（auxiliary），validator auxiliary 强制配图生效，Generator intentWantsGraphic=true。实测 141/141 全部自动配图（Generator 既有逻辑覆盖，同 KP 的 confirmed/ai-verified 行已有配图逻辑，needs-review 题型复用同一生成器自动生效），无需额外改 Generator。多样性：28 种 type/subtype 组合（triangle/rectangle/square/circle/parallelogram/trapezoid/cube/cuboid/cylinder/cone/position-grid/angle/line-segment/translationDemo/rotationDemo/view-cards + diagram groups/segment/ratio/brace/balance）。intent 教学文本不动（待人工评审）。
- **tests**：`npm test` 759/759；6g 泄露门禁 PASS（L2 渲染 645 全 SUCCESS/0 未登记，自判回放 TRUE 1485/FALSE 0）；矩阵重冻 1570/1570 FAIL 0；GENERATOR-MATRIX 23 FAIL 0；6a 1570/1570 PASS；`node dev/check-all.js` 30 PASS / 0 FAIL / 1 SKIP。
- **risk**：① P30-06 权威闸门被用户指令覆盖，needs-review 行 assessment 挂载但 intent 文本不挂载——人工评审回流后需对齐 intent 文本与 assessment 口径；② 141 行配图依赖 Generator 既有逻辑（同 KP 其他题型已有图），若未来 Generator 重构移除配图逻辑需同步核实 needs-review 行影响；③ 未 git commit。

---

## P38-06 · role 体系双轨统一：auxiliary 收紧为必须配图 + 两轨语义注释归一（2026-10-12）

- **modified**：
  - `shared/validator/kp-semantic-validator.js` L625-665：graphicRole 对齐注释重写（两轨维度区分 + carrier 仅 Intent 层 + auxiliary 两轨语义不同）；auxiliary 从「不约束有无」收紧为「必须含 graphic」（与 carrier 同等强制约束）。
  - `shared/generator/graphic-renderer.js` L21-37：GRAPHIC_ROLES 注释重写（P38-06 双轨统一，carrier 仅 Intent 层不在本枚举，auxiliary 两轨语义区分）。
  - `shared/engine/strategy-engine.bundle.js`：重建（含 validator 闸门改动）。
  - `shared/engine/presentation-engine.bundle.js`：重建（graphic-renderer.js 改动被内联）。
- **deleted**：无。
- **reason**：用户指令「根据题目对图形的需求，评审适合项目的改动方案。要求以图为核心的题必须配图、需要参考图的题目也需要配图、完全文本的题目做无图处理」。评审结论：当前 validator carrier→必须配图（96 条全 geometry）、null→禁图（936 条）已满足要求；但 auxiliary→不约束有无（538 条）与用户要求「需要参考图的题目也需要配图」不符。实测 397 条 auxiliary 权威行（314 ai-verified + 83 confirmed）全部配图（断链清零后无遗漏），收紧安全。方案 Y+（显式分层 + auxiliary 强制配图）：不改 T2 数据，不改 Generator 产出，仅收紧 validator 约束 + 注释归一。carrier 在 Generator 侧零使用确认为「仅 Intent 层」设计而非死枚举。
- **tests**：`npm test` 759/759；`node dev/check-all.js` 30 PASS / 0 FAIL / 1 SKIP（16/17 bundle 确定性通过）。
- **risk**：① auxiliary 收紧为必须配图后，未来新增 auxiliary 意图行需确保 Generator 产出 graphic，否则 validator 拒收；② 141 条 needs-review auxiliary 行在运行时投影中 assessment=null（权威闸门依法不挂载），不受本收紧影响，评审回流后若升级为 auxiliary 权威行需确保配图；③ carrier 在 Generator 层零产出维持，两轨 auxiliary 语义不同（Intent=需参考图，Generator=非核心载体），注释已明确区分；④ 未 git commit。

---

## P38-05 · makeAreaGeometry winner 随机缺陷修复：答案数学错误清零（2026-10-12）

- **modified**：
  - `shared/generator/generators/concept-meaning.js` L406-413：makeAreaGeometry winner 选取逻辑修复——原 `Rng.pick(rng, [['甲',a],['乙',b]])` 随机选但 b≤a-2 恒小于 a → 约 60% 答案数学错误（实测 10 题 6 题错）；改为 a/b 同范围 [4,9] 随机、避免相等、winner 取面积大者（格数多者），答案恒正确。实测 10/10 全正确。
  - `dev/p32/check-answer-leak.js` L105：WHITELIST 新增 g3-down-u04-k001/geometry/乙 L1 白名单（与甲同口径对称登记，P38-05 修复后 b>a 时答案为乙，题面含「乙」字为图形标签非答案复述）。
  - `shared/engine/strategy-engine.bundle.js`：重建。
  - `docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.{json,md}`：重冻（题面 a/b 范围变化）。
  - `shared/knowledge/mappings/generator-matrix/P30-GENERATOR-MATRIX.json`：重冻（6e）。
- **deleted**：无。
- **reason**：P38-03 登记的既有缺陷（P35/P36 commit b897096 引入），6g 自判回放用标准答案作答 → grade=true 放行，数学错误无门禁拦截。用户指令「按照顺序执行」。修复方案 B：a/b 同范围随机 + winner 取大者，保留题目随机性，答案恒正确。
- **tests**：`npm test` 759/759；6g 泄露门禁 PASS（L1 136/0、自判回放 TRUE 1485/FALSE 0）；矩阵重冻 1570/1570 FAIL 0；GENERATOR-MATRIX 23 FAIL 0；6a 1570/1570 PASS；`node dev/check-all.js` 30 PASS / 0 FAIL / 1 SKIP。
- **risk**：① 题面 a/b 范围从 6-9/3-a-2 改为 4-9/4-9，固定 seed 题面变化已重冻矩阵；② 6g 不校验答案数学正确性（只校验提交答案==标准答案），修复后 grade 仍 true 但答案正确；③ 未 git commit。

---

## P38-04 · change-log P38-03 表述订正：27→141 数字 + 6g 行为修正（2026-10-12）

- **modified**：
  - `docs/P38/change-log.md` P38-03 条目 reason/risk 两字段：① needs-review 挂数 27→141（实际 141 条全 auxiliary role，覆盖 g1-g6 100+ KP 的 judge/fill/choice/apply，附代表性 KP 清单）；② makeAreaGeometry 6g 行为「NULL 不校验」→「grade=true 放行」（6g 自判回放用标准答案作答，自身匹配，数学错误无门禁拦截）；③ 错误率 50%→60%（实测 10 题 6 题错）。
- **deleted**：无。
- **reason**：P38-03 reason/risk 两处表述失实——27 是断链候选中间态数字（运行时投影接通后 27），不是 needs-review 总数（实际 141 条）；「6g NULL 不校验」表述不准确，实际是 6g 返回 grade=true 放行。用户指令「检查问题」后要求「按照顺序执行」。
- **tests**：纯文档订正，零生产代码；门禁状态继承 P38-05/06 收口态（check-all 30/0/1）。
- **risk**：零（纯文档，无门禁影响）。

---

## P38-03 · 107 条真断链清零：T2 意图运行时投影 + 六生成器配图 + SVG 渲染器扩族（2026-10-12）

- **modified**：
  - **T1/T2 构建层（P38-DATA-01）**：`tools/kbl/build.js` 新增 qt-intent 运行时投影（仅 status+assessment 机器约束字段，T2 全文 3.9MB 不上运行时）；`tools/kbl/validate.js` DATA_FILES 清单补 `teaching/qt-intent-runtime.json`（与 build.js DATA_RELS 口径对齐，修 rootHash 重算分歧）；产物 `shared/knowledge/teaching/qt-intent-runtime.json`（新建，514K）；两 manifest（`kbl/manifest/`、`shared/knowledge/manifest/`）重冻。
  - **T3 运行时层**：`shared/knowledge/runtime/` 五文件接通 intentFor——`knowledge-contract.js`（PUBLIC_API 白名单 + intentFor）、`knowledge-loader.js`（CACHE 补 qtIntents）、`knowledge-query.js`（Query.intentFor）、`knowledge-api.js`（暴露）、`knowledge-runtime.js`（聚合文件内嵌三处副本同步：PUBLIC_API + Query 函数 + 表项）；`dev/verify-kbl-runtime.js` 补 3c intentFor 三断言（43 项全绿）。
  - **编排层（uniqueness 修复）**：`shared/orchestration/knowledge-context.js` 新增 `intentFor(kpId, qt)` 只读代理（镜像 P30-31 misconceptionsFor 先例），API 表导出。
  - **Generator 层（P38-GEN）**：六生成器补图/闸门——`position.js`（四 maker 补 graphic，30 条断链）、`application.js`（buildRelationGraphic 单点收口，31 条）、`arithmetic.js`（buildCalcGraphic + 意图闸门，12 条）、`semantic-relations.js`（buildBase 单点意图闸门 intentWantsGraphic，剥离未授权 maker 挂图，修 6g GEN-FAIL 6 行根因：k004/k005 意图 ai-verified 但 graphicRole=null，运行时投影接通后 validator KP_SEMANTIC_INTENT_ALIGNMENT 激活，无条件挂图全拒）、`shape.js`（视图推算路径补图，12 条）、`concept-meaning.js`（面积/角路径补图，10 条）；`shared/generator/core/semantic-parameters.js` getIntent 消费口从直连 `App.KNOWLEDGE` 改道 KnowledgeContext 单一入口（kbl-uniqueness app-knowledge-direct 禁令，P-production 不得绕过编排层）。
  - **SVG 层**：`shared/svg/svg-diagram.js` 新增 groups（份数组图）/ratio（成比例条形图）子类型；`shared/svg/svg-geometry.js` 新增 star（五角星）子类型；均挂既有注册机制，无新渲染器/新层（浏览器经 practice.html 独立 script 加载，无需重建 presentation bundle）。
  - **门禁层**：`dev/p32/check-answer-leak.js` WHITELIST 登记 4 条 L2 GRAPHIC-MATERIAL（g2-down-u02-k005 fill/choice『□』序列材料、g3-down-u04-k001 geometry『甲』『乙』view-cards 方向标签——题面材料非答案复述，乙为对称防御性登记）；bundle `shared/engine/strategy-engine.bundle.js` 重建（含闸门与新消费口）。
  - **测试随证据重写（不删测试，依据留存）**：`tests/generation/p28-hollow-shape-themed.test.js`（H6 断言按用户指令覆盖拆分：geometry 维持纯文字 role=null numeric-only + 无「观察下图」；其余题型断言图在场——T2 现行 ai-verified auxiliary 授权）、`tests/generation/p31-fix05-graphic-descriptors.test.js`（P31 销账裁决基于旧 T2，现行 T2 已授权 fill/choice/apply 配图，重写为「calc 不带 + 授权行带」双断言）、`tests/generation/p25-06-semantic-params.test.js`（confirmed 拆双路径：bundle-env 运行时投影行 + Node 直连兜底行，ai-verified 更新）。
- **deleted**：临时脚本 5 个（`dev/_p38-audit.js`、`dev/_p38-broken.json`、`dev/_p38-smoke-sr.js`、`dev/_p38-smoke-shape.js`、`dev/_p38-smoke-cm.js`）——审计判据与 0 断链结论已留存本条目；无生产代码删除。
- **reason**：用户指令「先修复107条真断链，根据生成需求新建或者加强原有SVG。达到图文的正常使用」（2026-10-12）。断链定义：intent.graphicRole != null 且 Generator 未产出 graphic 且无 graphicOrInstruction 兜底。审计判据演进：原始 107 → bundle 重建后 73 → 运行时投影接通 27 → **0**（P30-06 权威口径：仅 confirmed/ai-verified 行具生成权威，needs-review 行依法不产出图形）。**H6 显式覆盖**：用户本指令构成对 P34-H1「三视图 3 KP 纯文字」签批的覆盖，fill/choice/judge/apply 补题设视图卡/原材料图（只画题面已述视图，不画组合体成品防泄题），geometry 维持纯文字。**剩余 141 条 needs-review 行挂账待人工评审**（T2 AI 不可修，全 auxiliary role，覆盖 g1-g6 100+ KP 的 judge/fill/choice/apply，代表性 KP：g3-down-u04-k004/005 比例概念 judge、g4-down-u05-k001-006 三角形族 judge、g5-up-u06-k001-006 圆概念 judge、g6-down-u04-k008 fill/choice 等），评审回流后方可配图。**既有缺陷登记（P38-05 修复）**：`concept-meaning.js` makeAreaGeometry L405-422 `Rng.pick(rng, [['甲',a],['乙',b]])` 随机选 winner 但 b≤a-2 恒小于 a → 约 60% 答案数学错误（实测 10 题 6 题错，P35/P36 commit b897096 引入；6g 自判回放用标准答案作答 → grade=true 放行，数学错误无门禁拦截）。
- **tests**：定向烟测三套全绿（semantic-relations 128、shape 72、concept-meaning 60 PASS/0 FAIL）；重写测试 47/47；`node dev/verify-kbl-runtime.js` 43 项；`node dev/verify-m0.js` 8/8（kbl-validate/uniqueness 修复后）；6g 泄露门禁（L1 136/0、L2 渲染 616 全 SUCCESS、自判回放 TRUE 1485/FALSE 0）；矩阵重冻 1570/1570 FAIL 0；GENERATOR-MATRIX 23 生成器 FAIL 0；6a 1570/1570 PASS；`npm test` **759/759**；`node dev/check-all.js` **30 PASS / 0 FAIL / 1 SKIP**（第 15 项无 Chrome SKIP 属正常）。
- **risk**：① 141 条 needs-review 意图行挂账（全 auxiliary role），对应 KP×QT 仍无图（权威闸门依法拦），待人工评审回流；② makeAreaGeometry winner 随机缺陷已登记（P38-05 修复），geometry 面积比较题存在约 60% 答案错误风险（实测），6g 自判回放 grade=true 放行不拦截，需立项修复；③ T2 投影为构建期字段投影（同源确定性），未引入第二事实源，但 knowledge-runtime.js 聚合文件三副本需同步维护（本次三处 bug 均源于副本漂移，已全部修复）；④ 测试双源现实：semantic-parameters 在 bundle-env（投影行）与 Node 直连（全量 T2 行）行为有意差异，两条路径分别有断言覆盖；⑤ 未 git commit，等待用户显式指令。

---

## P38-02 · 33 KP 逐项裁决定稿：全部销账，基线不变（2026-10-12）

- **modified**：
  - `docs/P38/P38-TASK-BOOK.md`：改写为终态定稿——终态分桶表（33 = 4 同名覆盖 + 7 DEPRECATED + 15 A 组 + 5 B' 组 + 2 C 组 + 1 连续两问，全部销账）+ A 组 15 条定义证据 + 取证修正记录。
- **deleted**：无。
- **reason**：用户逐项裁决（AskUserQuestion 两轮）：① A 组 15 个确认销账；② B 组 6 个初裁「确认新增」**后经取证修正推翻**——主题检索正则漏检「7～9的乘、除法」（math-g2-up-u07-k001，KP 名不含「口诀」字样），canonical 已含该单元（定义「掌握7、8、9的乘法口诀……用乘法口诀求商」），B 组 5 个改判语义已承载销账；③ C22「选择一种运算解决问题」、C23「设计导游路线」裁决销账；④ 唯一真缺候选「解决连续两问的问题」终裁销账不新增（现有 u07-k002「解决问题」够用），基线 375/98/373/1570 不变。
- **tests**：纯文档/登记改动，零生产代码；门禁状态继承（npm test 757/757、check-all 30 PASS / 0 FAIL / 1 SKIP）。33 KP 全量逐条核对以 extract-raw.json（fileHash 8d4ebef5…）与 canonical/knowledge.json 为准，无 AI 编造语义。
- **risk**：① 教学语义完整性确认：33 个旧 KP 内容在现行 375 体系内无缺口（除用户裁决放弃的连续两问/路线设计/运算选择三个开放性粒度点）；② 取证教训登记：KP 主题检索必须以 extract-raw 全量名单逐条核对，禁止关键词正则过滤定缺（防漏检重犯）；③ 未 git commit。

---

## P38-01 · 33 KP 接入立项：取证分桶 + 22 KP 语义裁决材料生成（2026-10-12）

- **modified**：
  - 新建 `docs/P38/P38-TASK-BOOK.md`（战役章程 + 22 KP 裁决材料：A 组 15 建议销账含逐条定义证据 / B 组 6 真缺 / C 组 2 模糊）。
  - 新建 `docs/P38/change-log.md`（本文件）。
- **deleted**：无。
- **reason**：用户指令「开始 33 KP 接入立项」+ 三项签批（DEPRECATED 7 个销账不接入 / 语义近似 AI 提证据→用户逐项裁决 / 一次性执行）。取证结论：33 KP 与 root Excel 对照——4 个同名已覆盖（倍的认识/时间单位换算/逐层分类/用字母表示数，仅旧 598 ID 不同）、7 个 DEPRECATED 销账、剩余 22 个进入裁决材料。
- **tests**：纯只读取证 + 建档，零生产代码改动；门禁状态继承 P37 收口态（check-all 30/0/1）。
- **risk**：① 裁决结果决定基线扩容规模（预计 375→381~383 / 98→99 / 1570→按新矩阵推导）；② root Excel 补行为 T0 人工动作，AI 不得代写；③ 新单元命名需对齐现行「1～6的表内乘法」形态；④ 未 git commit。

---
