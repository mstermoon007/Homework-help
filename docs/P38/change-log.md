# P38 变更日志（33 KP 接入裁决与基线扩容战役）

> 战役性质：P37 收口后登记的重大变更战役——33 个被剔除 KP 的教学语义裁决与接入执行。
> 铁律：T0 数据权限（AI 不改 root Excel）；基线扩容只经人工补 Excel + 完整派生链。
> 日志 append-only，六字段，最新在上。

---

## P38-GEN-04 · k007 长方形渲染修正：square→rectangle，题面「长」与图形语义对齐（2026-10-12）

- **modified**：
  - `shared/svg/svg-geometry.js`：`rectangle(o)` 扩 `labelSides` 参数形态——除原 `false`（全不标）/ 真值（全标）外，支持 `{width:bool, height:bool}` 分别控制底边（长）与右边（宽）标注，缺省 true。向后兼容：`square` 仍经 `rectangle({width:size,height:size})` 走默认全标。用于题面仅给出一条边长的场景，避免编造第二条边数字。
  - `shared/generator/generators/semantic-relations.js`：k007 放大缩小 5 个 maker 按题面用词统一裁决——题面用「长」非「边长」的 4 个 maker（calc「长方形的长」、geometry「长方形的长占」、apply「小卡片长/某段长」、choice「原长」）graphic 从 `subtype:'square'` 改为 `subtype:'rectangle'`，params `{width:s.orig, height:Math.round(s.orig*0.6), unit, unitPx:26, labelSides:{width:true,height:false}}`——只标已知长（题面已知量），宽取视觉比例值且不标注数字（题面未给宽，禁编造），不画变换后图形（避免泄露所求边长）。题面明确「边长…正方形」的 makeScaleFill 保持 square 不变。题面/答案/解析逐字未动。
  - `tests/generation/p31-fix05-graphic-descriptors.test.js`：P38-GEN-03 专项断言中 k007 calc 的 expectSub 由 `'square'` 翻转为 `'rectangle'`（附注释说明题面「长方形」语义），测试名同步更新。
  - `shared/engine/strategy-engine.bundle.js`：重建（semantic-relations.js 改动）。
- **deleted**：无。
- **reason**：承接 P38-GEN-03 risk ② 挂账——k007 题面用「长」（非「边长」）的 maker 用 `geometry.square`（等边长正方形），图文语义不一致。五步闭环取证：① 全库扫描 5 处 `subtype:'square'`：k007 的 calc/geometry/apply/choice 题面均用「长」、fill 题面用「边长…正方形」；另 2 处（concept-meaning 角观察「正方形纸板」、money 面积单位「边长 1 厘米的正方形」）题面明确正方形，保持不变；② `svg-geometry.rectangle` 渲染器已存在且在 schema `GRAPHIC_SUBTYPES.geometry` 白名单内（square 反而不在白名单）；③ rectangle 默认同时标长/宽两边，而题面只给长、未给宽，直接用会把视觉比例值当成真实宽标注（编造教学数据），故需扩 `labelSides` 选择性标注；④ `scalePick` 仅产出 `orig`（长）与 `next`（所求），无宽字段，宽只能取视觉比例（`orig*0.6` 四舍五入）且必须不标注；⑤ 裁决口径：题面用「长」→ rectangle，用「边长」→ square，数学语义自洽（正方形说边长，长方形说长宽）。
- **tests**：定向 p31-fix05 9/9、p25-06 全绿；渲染直验：rectangle 只含长标注（如 `6cm`）、不含宽标注（如 `4cm`），`<rect>` 像素 156×104 确为不等边长方形；square 向后兼容仍标两边；端到端 k007 五题型：calc/fill/apply/choice/geometry 全部 subtype 与题面用词一致（4 rectangle + 1 square）+ SUCCESS；`npm test` **762/762**；6a 1570 PASS；6b 冻结矩阵**零 diff**（题面/答案/生成器指纹未变，graphic 不在冻结字段内）；6g AS-18 **PASS**（图形文字仅含题面已知量 s.orig，无新增未登记命中）；11 SVG 契约、12 security、16/17 bundle 确定性 PASS；`node dev/check-all.js` **30 PASS / 0 FAIL / 1 SKIP**（本地无 Chrome）。
- **risk**：① 宽取 `orig*0.6` 为纯视觉比例，不承载教学语义，若未来题面补充宽的具体数值，需改为传入真实宽并标注；② 全库其余 3 处 square 经核实验证题面均明确「正方形/边长」，无需改动；③ 未 git commit。

---

## P38-GEN-03 · 4 行 representation-conflict calc 改判辅助图：图形辅助理解算理断链接通（2026-10-12）

- **modified**：
  - `kbl/teaching/qt-intent-review.json`：新增 p38-gen03-2026-10-12 supplement，4 条 verdict=通过 + correctedAssessment（allowedRepresentations=["numeric","graphic"] / graphicRole="auxiliary"）——`math-g1-down-u06-k002|calc`（覆盖 sample-1、P31-FIX-11 两次 numeric-only 旧裁决）、`math-g2-down-u02-k005|calc`（覆盖 p31-fix11）、`math-g6-down-u04-k007|calc`、`math-g6-down-u04-k008|calc`（覆盖 P38-GEN-02）。legitimacy 维持 null（representation-conflict 旗标保留；配图授权由 correctedAssessment 承载，AI 不代写教学论述）。
  - `shared/generator/generators/semantic-relations.js`：4 个 calc maker 补挂同族已验证描述符（题面/答案/解析逐字不动）——makeAddRelCalc 双变式挂 geometry.segment/quantity-correspondence（加法总括标 ?、减法所求剩余段标 ?，参数镜像 makeAddRelFill/Apply）；makePeriodCalc 挂 diagram.pattern/auxiliary（周期组材料图，与 Fill/Choice/Geometry 同款）；makeScaleCalc 挂 geometry.square/quantity-correspondence（只画已知原长 s.orig，不画变换后图形）；makePropCalc 挂 diagram.ratio/auxiliary（两行条形：第一行总价已知、第二行红 ?，答案仅决定条宽）；同步更新 makeAddRelCalc 内 P31-FIX-11 旧口径注释。**SVG 渲染器零改动**（4 subtype 均由同族题型既有渲染）。
  - `tests/generation/p31-fix05-graphic-descriptors.test.js`：2 条 calc=false 旧断言按用户新裁决翻转为配图断言（非删除，注释附 P38-GEN-03 证据链）；新增 g6 两 KP calc 专项断言（subtype/渲染 SUCCESS/validator PASS，count=6）；intent 对齐 PASS 矩阵扩入 4 行 calc；头部补 P38-GEN-03 裁决段与不变量 #4 改写。
  - `tests/generation/p25-06-semantic-params.test.js`：P38-GEN-02 numeric-only 收口断言重写为 P38-GEN-03 四行 auxiliary 配图断言（runtime 投影 gr=auxiliary / reps=[numeric,graphic] / graphic 投影挂载）；合成 needs-review 闸门行为测试保留（机制回归）。
  - 派生/构建产物：`kbl/teaching/qt-intent.json`（4 行 humanReview 改批 p38-gen03/corrected=true，gr/reps 翻转，四问文本逐字未变）、qt-intent-sample.xlsx、P25-KP-QT-INTENT.md；`shared/knowledge/teaching/qt-intent-runtime.json` 等 build.js 镜像（rootHash 4e084d36→0c566c81）；knowledge-runtime/strategy/presentation 三 bundle；evidence-rules/variation/misconception 经派生器重跑（**4 KP 行零 diff**，画像只取题面/答案，本次仅加 data.graphic）。
- **deleted**：无（无临时脚本；P31-FIX-11/P38-GEN-02 旧账本批次 append 保留作溯源，不删不改）。
- **reason**：用户 2026-10-12 显式裁决：「这个四个 KP，明显属于图形辅助理解算法、几个图形、比例的关系，需要有图。」五步闭环取证：① 4 个 calc maker 零 graphic，而同族 fill/apply/choice/geometry 已全部配图且 4 个 SVG 渲染器均存在（segment/pattern/square/ratio），属「接口/素材已存在但 calc 未接通」真断链；② `supports.graphic=false` 全库仅派生器 5 处消费，无运行时/validator 硬卡口，correctedAssessment 是 P30-15 既有合法回流通道；③ validator checkIntentAlignment 完全 intent 驱动（L619 reps 含 graphic 放行、L642 auxiliary 强制配图），生成器 intentWantsGraphic 单点闸门已就位；④ KP 数据（T0/T1）零改动，calc 题型注册表 supports.graphic 不改（不扩大到其他 calc 行），仅 4 行逐行人工授权。
- **tests**：定向 36/36（p31-fix05 + p25-06）；`npm test` **762/762**；6a **1570/1570 PASS**；6g AS-18 **PASS**（L2 命中 26 全部已登记，0 未登记——所求量一律 ? 遮蔽、图形文字只含题面已知量，无需新增白名单）；6b P28 冻结矩阵**零 diff**（冻结证据只存题面前 36 字/答案/生成器，题面答案逐字未动；图形覆盖由 6g L2 与 SVG 契约门禁把关）；6e maker 矩阵 GEN-03 零增量（4 行本就是 confirmed，makerKey 不变）；11 SVG 契约、12 security PASS；evidence/variation/misconception 二次重跑零漂移；`node dev/check-all.js` **30 PASS / 0 FAIL / 1 SKIP**（本地无 Chrome）。
- **risk**：① 4 行 calc 配图授权逐行挂人工账本，未来新增 graphic KP×calc 仍走 needs-review 卡口，不自动放行；② k007 calc 题面称「长方形」而 square 渲染器画等边长示意（与 makeScaleGeometry 既有同款搭配，图承载原长数量语义非形状），若后续要求严格长方形需扩 geometry.square 契约，另立项；③ 4 行 legitimacy 文本仍永久 null（人工接受空问口径不变）；④ 未 git commit。

---

## P38-GEN-02 · 最后 2 行 needs-review 逐行裁决：representation-conflict numeric-only 降级成立（2026-10-12）

- **modified**：
  - `kbl/teaching/qt-intent-review.json`：新增 p38-gen02-2026-10-12 supplement，2 条 verdict=通过 逐行裁决——`math-g6-down-u04-k007|calc`（图形的放大与缩小）、`math-g6-down-u04-k008|calc`（正反比例解决问题），fromStatus=needs-review，textFrozen 冻结确认时点四问文本（trainsWhat/whyThisType/differentiation/driftRisk），**legitimacy 排除在 textFrozen 外维持 null**（人工接受空问，AI 不代写教学论述），无 correctedAssessment（机器投影 reps=[numeric]/gr=null 本就正确）。镜像两条同旗标先例：sample-1 math-g1-down-u06-k002|calc 与 p31-fix11 math-g2-down-u02-k005|calc。
  - `tests/generation/p25-06-semantic-params.test.js`：旧 P30-06 活矩阵 needs-review 样本（k007|calc）随裁决失效，按现行口径重写为 3 条（非删除）：① P38-GEN-02 收口断言（运行时投影 needs-review=0 + 2 行 confirmed numeric-only 形态）；② P30-06 闸门行为改由 KC.intentFor 注入合成 needs-review（gr=null）行验证 intent/expression/graphic 全 null + blocked 标注，finally 恢复并复验活矩阵；③ P38-07 例外分支（needs-review+gr=auxiliary → 图形机器约束挂载、意图文本仍 null）。
  - 派生重跑产物：`kbl/teaching/qt-intent.json`、`kbl/teaching/qt-intent-sample.xlsx`、`docs/archive/phases/p25/P25-KP-QT-INTENT.md`（confirmed 167→169、needs-review 2→0、抽查单 76→66 行）；`shared/knowledge/teaching/qt-intent-runtime.json`（tools/kbl/build.js）；`kbl/teaching/evidence-rules.json`（derive/apply-evidence-candidates，1570 规则不变）；`kbl/teaching/variation-profiles.json`、`kbl/teaching/misconception-profiles.json` + `shared/knowledge/teaching/misconception-profiles.json`（重跑核实，shasum 前后一致——2 行题目形态未变）。
  - 重建：`shared/knowledge/runtime/knowledge-runtime.js`、`shared/engine/strategy-engine.bundle.js`、`shared/engine/presentation-engine.bundle.js`；两 manifest rootHash 重冻（4e084d36…）。
  - `docs/archive/phases/p30/P30-KP-QT-MAKER-MATRIX.{json,md}`：--write 重冻，diff 仅 2 行 intentStatus needs-review→confirmed，byIntentStatus={confirmed:169, ai-verified:1401}（needs-review 键消失），makerKey/target 分工零漂移。
- **deleted**：无（P38-GEN-02 临时诊断在取证后已物理删除，未入库）。
- **reason**：用户选择「方案 1：镜像先例，review ledger 逐行裁决」。取证：2 行是 P38-GEN-01 后仅存的 needs-review，旗标均为 representation-conflict（KP semantic.representations=[numeric,graphic] 多表征，calc supports.graphic=false）；6a 实测生成器产出本就是纯算式无图（k007：长方形长 3 厘米按 2:1 放大 3×2=?；k008：钢笔归一问题 6÷2×4=?），题干保留比例/归一 KP 语义非普通算术退化；assessment 投影与实际产出一致，唯一缺口是第五问 legitimacy 文本被机械置 null。与 g1/g2 两条已 confirmed 的 representation-conflict 先例机器事实同构，故逐行人工接受 numeric-only 降级在 calc 成立，不改派生器规则（保留闸门对未来 graphic KP×calc 的逐行人工卡口）。**P38-GEN 序列收口：1570 行意图矩阵 needs-review 清零。**
- **tests**：`npm test` 761/761（原 759，旧 1 条样本测试重写为 3 条，净 +2）；6a 1570/1570 PASS；6b P28 冻结矩阵重冻后与裁决前**零 diff**（2 行题目指纹未变，intent 文本挂载不影响生成内容）；6e 仅 status 字段变化；6g AS-18 PASS；variation/misconception 二次重跑 shasum 一致（确定性）；`node dev/check-all.js` **30 PASS / 0 FAIL / 1 SKIP**；意图状态分布 confirmed=169 / ai-verified=1401 / needs-review=0（旗标 representation-conflict=4 保留为溯源）。
- **risk**：① 4 行 representation-conflict 全部 confirmed 后，calc×多表征 KP 的 numeric-only 降级依赖逐行人工裁决，未来新增同类 KP×calc 仍会落 needs-review 卡口（符合设计，非自动放行）；② 4 行 confirmed 的 legitimacy 文本永久为 null（人工接受空问），若未来要求 confirmed 行五问文本完整，需另立项补论述，不得 AI 私填；③ 未 git commit。

---

## P38-GEN-01 · 派生器规则改进：题型认知区间扩容，needs-review 284→2（2026-10-12）

- **modified**：
  - `shared/knowledge/question-type-registry.js`：7 题型 cognitiveLevels 扩容到全认知层级——calc/fill 增加 recognize/analyze（区间 recall..analyze），choice/judge/geometry/classify/apply 增加 analyze（区间 recognize..analyze）。用户在三方案中显式选择「方案 A：扩题型认知区间」，该指令覆盖 P30「禁改题型注册」边界并留存于本日志。
  - `kbl/teaching/qt-intent-review.json`：p38-gen01-2026-10-12 supplement 共 14 条 correctedAssessment 裁决——① 3 条三视图 KP×geometry（g4-down-u02-k002/g5-down-u01-k001/k002）持久化 P34-H1/P38-03 裁决（gr=null + reps=[numeric]，画组合体泄题），修复 P34 commit 0dae10a 直接改 qt-intent.json 破坏派生器确定性的问题；② 3 条 g4-up-u06-k001/k002/k003×judge（bar-single/bar-double 无条件产 chart，gr=auxiliary + reps 含 graphic，镜像 P30-15 fill/choice/apply 裁决）；③ 8 条扩容后新暴露行（g3-down-u05-k001×judge classify-geo 产 segment；g3-up-u04-k002×calc/fill/apply mass 度量产图；g4-down-u08-k004×fill/choice lunch-chart 产 chart；g4-up-u08-k001×fill/apply direction 产方位图）统一裁决 gr=auxiliary + reps=[numeric,graphic]——根因均为 root Excel representations 标注遗漏（KP 实际产图但 canonical reps 缺 graphic），T0 不动 Excel，以 review ledger 裁决持久化。
  - `tests/generation/p25-06-semantic-params.test.js` L167-178：P30-06 needs-review 零生成权威样本从 math-g1-up-u02-k001|calc（扩容后升级 ai-verified）改为 math-g6-down-u04-k007|calc（剩余 2 行真 representation-conflict 之一），附 P38-GEN-01 注释。
  - 派生重跑产物：`kbl/teaching/qt-intent.json`、`kbl/teaching/qt-intent-sample.xlsx`、`docs/archive/phases/p25/P25-KP-QT-INTENT.md`（derive-qt-intent.js）；`shared/knowledge/teaching/qt-intent-runtime.json`（tools/kbl/build.js 投影，非 emit-canonical.js——本次修复链中核实的正确投影入口）；`kbl/teaching/variation-profiles.json`（derive-variation-profiles.js，1323 行）；`kbl/teaching/misconception-profiles.json` + `shared/knowledge/teaching/misconception-profiles.json`（derive-misconceptions.js，同步镜像）；`kbl/teaching/evidence-rules.json`（derive/apply-evidence-candidates.js，1570 规则保留、builtFrom 指纹更新）。
  - 重建：`shared/knowledge/runtime/knowledge-runtime.js`、`shared/engine/strategy-engine.bundle.js`；`kbl/manifest/manifest.json` + `shared/knowledge/manifest/manifest.json`（rootHash 重冻）。
  - `docs/archive/phases/p30/P30-KP-QT-MAKER-MATRIX.{json,md}`：--write 重冻，diff 仅 intentStatus 字段（282 行 needs-review→ai-verified + 14 行→confirmed），makerKey/generator/level/target 分工零漂移（target=1236/format=0/target-frozen=334 不变）。
- **deleted**：临时诊断脚本 `dev/diag-p38-gen01.js`、`dev/diag-p38-gen01b.js`（用后即物理删除，未入库）。误重生成的 `kbl/teaching/kp-matrix.json`、`docs/archive/phases/p25/P25-BASELINE.md` 已 `git checkout` 还原（build-baseline 不属本派生链，A 类 KP 维持 313）。
- **reason**：承接 P38-08 澄清——141（实测全量 284：141 auxiliary + 143 null）条 needs-review 的根因是派生器 legitimacy 第五问的题型认知区间过窄，不是 Excel 数据缺口。283 行 cognitive-out-of-range（KP cognition 层级不在题型 cognitiveLevels 区间）+ 1 行（后剩 2 行）representation-conflict。取证确认 cognitiveLevels 的全部消费方（cognitive-strategy/question-type-strategy/capability-model/capability-resolver）仅做过滤/传递无硬校验，validator 用 KP 自有字段不依赖题型区间，扩容安全且消除 strategy 不必要的 understand 降级。扩容后 needs-review 284→2（剩余 g6-down-u04-k007/k008×calc 为真 representation-conflict：graphic KP 的 calc 无图表达，维持挂账）。扩容暴露 8 行「intent=null 时校验跳过→题目带图通过；intent 挂载后 gr=null→validator L619/L647 拒收」的隐性行，经逐生成器源码核实（money.js L643/stats.js L388,L475,L566,L676/position.js L578-606 均无条件产图），以 correctedAssessment 裁决持久化。关键结果：**1570 行题目指纹零变化**（P28-GENERATION-MATRIX-FROZEN --write 后与 HEAD 字节一致，git 无 diff）——生成器行为从未改变，仅意图层从「无 intent 跳过校验」转为「有 intent 显式放行同一图形」，282 行 intent 教学文本正式挂载。
- **tests**：`npm test` 759/759；6a 1570/1570 真实生成 PASS；6b 矩阵冻结 PASS（冻结文件零 diff）；6e maker 矩阵重冻 PASS（仅 status 字段变化）；6g AS-18 泄露门禁 PASS；7 教育语义 PASS；`node dev/check-all.js` **30 PASS / 0 FAIL / 1 SKIP**（#15 本地无 Chrome）；状态分布 confirmed 153→167、ai-verified 1133→1401、needs-review 284→2。
- **risk**：① 题型认知区间扩容为用户显式指令覆盖 P30 禁改边界，区间事实上失去过滤区分度，语义合法性改由五问其余四问 + validator + 6g 承担，若后续发现题型×认知层级误配需另立项收紧；② 14 条 correctedAssessment 中 11 条（3 bar judge + 8 新行）认定 root Excel representations 标注遗漏，T0 未动 Excel 而以评审账本裁决持久化，人工回流补 Excel reps 字段后可重跑派生移除裁决；③ 剩余 2 行 needs-review（g6-down-u04-k007/k008×calc，representation-conflict）维持零生成挂账，待教学裁决（去图 calc 表达是否成立）；④ P38-07 未重跑 variation/misconception 派生器，本次重跑的两份产物含对 P38-07 现行题面的补观测成分（catch-up），已由全部门禁验证一致；⑤ 未 git commit。

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
