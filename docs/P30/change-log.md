# P30 · AI 修改审计日志（Change Log）

> 战役：**P30 数学题目语义—生成—SVG 产品化最终修复**
>
> 目的：记录每一次 AI 修改的 **任务编号 / 改动文件 / 删除文件 / 原因 / 测试 / 风险**，
> 使后续任何 AI（或人）能回答「这个文件/符号为什么存在、为什么被删、当时如何验证」。
>
> 规则（与 P28 日志同口径，另加 P30 约束）：
> 1. 每次 AI 修改代码、配置或文档结构，必须在本文件 **顶部（最新在上）** 追加一条记录。
> 2. 六字段必填；确实没有填「无」，不得留空、不得编造。
> 3. 任务编号按阶段取前缀：`P30-DATA-xx`（阶段一）/ `P30-GEN-xx`（阶段二）/
>    `P30-SVG-xx`（阶段三）/ `P30-CLOSE-xx`（阶段四）；立项类无阶段任务用 `P30-INIT`。
> 4. 纯对话、只读分析、代码阅读不登记；只有产生文件改动才登记。
> 5. 修改记录是历史档案，写入后不改写数字；如需更正，追加新记录说明。
> 6. 每阶段须门禁通过并经用户确认后，才能开启下一阶段编号的任务（见 `.trae/rules/p30-repair-rules.md` §6）。

## 模板

```
### P30-XXXX-XX｜标题（YYYY-MM-DD）
- modified:
- deleted:
- reason:
- tests:
- risk:
```

---

## 记录（新 → 旧）

### P30-22-SUPP｜segment 别名补漏：stats.js + shape.js 两处 geometry.segment 补 role（2026-10-04）
- modified:
  - `shared/generator/generators/stats.js`（L352 `geo()` 返回 `{type:'geometry', subtype:'segment', role:'calculation-support', ...}`；segment 是 `SVGGeometry.segment = SVGDiagram.segment` 别名，diagram 语义取 calculation-support）
  - `shared/generator/generators/shape.js`（L511 `fracGraphic()` 返回 `{type:'geometry', subtype:'segment', role:'calculation-support', ...}`；同上 segment 别名）
- deleted: 无
- reason: P30-22 补漏。审计发现 1570 行全量中仍有 17 行 graphic 无显式 role（stats 12 行 + shape-recognition 5 行），根因是 `geometry.segment` 作为 diagram 别名存在，agent 按 type=geometry 规则补了 quantity-correspondence，但 segment 语义实为部分-整体线段图（calculation-support）。最小修正：2 处 role 改 calculation-support。
- tests: 1570 行全量审计 missing role 从 17→0；`npm test` 651/651 PASS；`node dev/check-all.js` 连续 3 次 **29 PASS / 0 FAIL / 1 SKIP / 30 项**。
- risk: ①segment 别名在 svg-geometry.js 中经 `SVGGeometry.segment = SVGDiagram.segment` 注册，descriptor 的 type='geometry' 是合法的（geometry 证据规则要求 type 恒为 geometry），role 取 calculation-support 与 diagram.brace/segment 语义对齐；②未 git commit。

### P30-22｜Generator 决定图形语义：6 个 generator 的 graphic 描述符补显式 role（2026-10-04）
- modified:
  - `shared/generator/generators/position.js`（1 处构造点 `makeGraphicForPosition` return：`role:'number-position'`，覆盖 choice/judge/fill/geometry/apply 全部 5 个 `q.data.graphic = graphic` 赋值点及兜底 graphic2；geometry.position-grid 语义为数的位置/方向，不用 type 默认映射）
  - `shared/generator/generators/money.js`（9 处：makeMeasurementGeometryQuestion 6 处 geometry（rectangle/square/segment×4）→ `role:'quantity-correspondence'`；makeGraphicForMoney 2 处——calculation.rmb → `role:'calculation-support'`、geometry.rectangle → `role:'quantity-correspondence'`；人民币轨 currency.rmb 1 处 → `role:'quantity-correspondence'`）
  - `shared/generator/generators/stats.js`（11 处：10 处 chart（bar×7/line×2/pie×1，含单式/复式条形、折线、扇形、数据收集、chart-read 兜底）→ `role:'data-comparison'`；1 处 diagram.brace（可能性推测）→ `role:'calculation-support'`）
  - `shared/generator/generators/picture-equation.js`（6 处 diagram（segment/brace/balance/segment/scale/brace）→ `role:'calculation-support'`）
  - `shared/generator/generators/application.js`（1 处 geometry.cuboid 排水法体积 → `role:'quantity-correspondence'`）
  - `shared/generator/generators/arithmetic.js`（3 处 geometry.segment 分数乘法 → `role:'quantity-correspondence'`）
  - `kbl/teaching/variation-profiles.json`（§9 重派生：derive-variation-profiles.js；representation 轴补 `data.graphic.role` 路径与取值，829+/243- 行仅限 role 维度）
  - `shared/engine/strategy-engine.bundle.js` + `presentation-engine.bundle.js`（重建，过 16/17 确定性门禁）
- deleted: 无
- reason: P30-22「Generator 决定图形语义，不让下游填默认」。graphic-renderer.js 已有 GRAPHIC_ROLES 枚举与 GRAPHIC_TYPE_ROLES 缺省映射（显式 graphic.role 优先），但 6 个 generator 的 31 处 graphic 构造点未显式设 role，下游只能按 type 默认填值。按 type→role 规则表（geometry/currency→quantity-correspondence，chart→data-comparison，diagram/calculation→calculation-support）补显式 role；position-grid 语义为「数的位置/方向」，显式用 number-position 而非 type 默认。role 放置位置遵循 shape.js 既有惯例（subtype 之后、params 之前）。
- tests: 6 文件 `node -e require` 语法 OK；`node --test tests/generator/graphic-renderer.test.js p28-geometry-native-makers.test.js generator-contract.test.js generator-mode.test.js` 32/32 PASS；`tests/generator/p27-variation-profile.test.js` 9/9 PASS（重派生后）；`node dev/check-all.js` **29 PASS / 0 FAIL / 1 SKIP / 30 项**（第 15 项浏览器 E2E 本地无 Chrome SKIP）。
- risk: ①money.js makeGraphicForMoney 2 处构造点超出任务清单行号（L332-380+L608），但属同一文件 graphic 产出点且规则表显式覆盖 calculation type，不补则仍走下游默认，与任务目的冲突，故一并补上并在此留存依据；②arithmetic.js 3 处注释称「diagram.segment」但代码实为 `type:'geometry'`，按规则表以 graphic.type 为准取 quantity-correspondence；③variation-profiles.json 重派生未触碰题型/KP/难度轴，derive 报告零生成失败行；④未 git commit。

### P30-SVG-02｜线段断链修复：line-segment renderer + generator + evidence-rules（2026-10-04）
- modified:
  - `shared/svg/svg-geometry.js`（新增 `lineSegment(o)` renderer：水平线段 + 两端端点圆点 + 可选长度标注；params: `{length(cm), labelLength, unit, unitPx}`；注册 `'line-segment': lineSegment`）
  - `shared/generator/generators/shape.js`（`generateGraphicParams()` 新增 `case 'line-segment'`：`{type:'geometry', subtype:'line-segment', role:'quantity-correspondence', params:{length:randInt(1,2), labelLength:rng()<0.7, unit, unitPx}}`）
  - `kbl/teaching/evidence-rules.json`（3 个线段 KP×5 题型共 15 条：`subtype` rectangle→line-segment；`fieldPresent` labelSides→length；shapeName 保持「线段」）
  - `kbl/teaching/variation-profiles.json` + `misconception-profiles.json`（§9 重派生：derive-variation-profiles.js + derive-misconceptions.js）
  - `shared/engine/strategy-engine.bundle.js` + `presentation-engine.bundle.js`（重建）
  - `dev/p28/check-generation-matrix-frozen.json` + `dev/p30/check-kp-qt-maker-matrix.json`（1570 行产出变化，`--write` 重冻）
- deleted: 无
- reason: 修复 P30 阶段三遗留线段断链。3 个线段 KP（math-g2-up-u05-k003/k004、math-g3-up-u07-k001）的证据规则要求 subtype=rectangle，但语义应为 line-segment；SHAPE_SUBTYPE/NAME_TO_SHAPE/SHAPE_FEATURES 中已有 `line-segment` 定义但 `generateGraphicParams` 缺 case、svg-geometry 缺 renderer，导致落入 default→rectangle。最小修改：补 renderer + generator case + 证据规则对齐。
- tests: `node --test tests/generator/p28-hollow-shape-themed.test.js` 12/12 PASS；`npm test` 651/651 PASS；`node dev/check-all.js` **29 PASS / 0 FAIL / 1 SKIP / 30 项**；`math-g2-up-u05-k003` 实产 `graphic={type:'geometry',subtype:'line-segment',role:'quantity-correspondence',params:{length:NN}}` → SVG SUCCESS。
- risk: ①未新建 line/ray/straight-line 区分，3 个 KP 统一用 `line-segment` 表达「线段可度量」语义（射线/直线在小学阶段无度量场景，当前 suffice）；②`labelLength` 默认 70% 概率显示长度标注，与 rectangle `labelSides` 行为一致；③未 git commit。

### P30-SVG-01｜阶段三：GraphicDescriptor 语义统一 + 角的度量修复 + Graphic Alignment Gate（2026-10-03）
- modified:
  - `shared/generator/graphic-renderer.js`（新增 `GRAPHIC_ROLES` 枚举：quantity-correspondence/number-position/angle-measure/fraction-part/area-measure/data-comparison/calculation-support/auxiliary；新增 `GRAPHIC_TYPE_ROLES` type→默认 role 映射；`resolveGraphicRenderer()` 返回 `role` 字段（显式 graphic.role 优先，否则 type 默认）；新增 `isValidRole()`、`resolveRoleFromIntent()`；API 导出全部新增符号）
  - `shared/svg/svg-geometry.js`（新增 `angle(o)` renderer：顶点出发两条射线 + 角度圆弧，无填充扇形；params: `{angle:deg, rayLength, labelAngle}`；注册进 `SVGGeometry`）
  - `shared/generator/generators/shape.js`（`generateGraphicParams()` 新增 `case 'angle'`：`{type:'geometry', subtype:'angle', role:'angle-measure', params:{angle:randInt(10,170), rayLength:2, labelAngle:false, unit, unitPx}}`；其余 geometry case 补 `role:'quantity-correspondence'`；`NAME_TO_SHAPE` 角正则收窄为 `/角的(度量|认识|再认识|分类)/`，避免误匹配「从不同角度观察立体图形」）
  - `kbl/teaching/evidence-rules.json`（直接编辑——无派生脚本且规则事实错误属 P30-26 断链：4 个角的度量 KP×5 题型 `subtype` rectangle→angle、移除 `labelSides` fieldPresent、新增 `params.angle` fieldPresent；`math-g5-down-u01-k001`×5 题型 `subtype` rectangle→cuboid、shapeName 角→立体图形、移除 labelSides）
  - `shared/validator/kp-semantic-validator.js`（`checkIntentAlignment` graphicRole 校验扩展 P30-27/28：carrier→必须含图、null→禁止含图、auxiliary→可选；新增 graphic.role 合法枚举校验；区分 intent.graphicRole 与 graphic.role 两个维度不强制相等）
  - `tests/generator/graphic-renderer.test.js`（`resolveGraphicRenderer` 输出断言补 `role:'quantity-correspondence'`）
  - `kbl/teaching/variation-profiles.json` + `kbl/teaching/misconception-profiles.json`（shape.js/evidence-rules 改动触发 §9 重派生：derive-variation-profiles.js + derive-misconceptions.js）
  - `shared/engine/strategy-engine.bundle.js` + `presentation-engine.bundle.js`（kp-semantic-validator 改动后重建）
  - `dev/p30/check-kp-qt-maker-matrix.json`（shape.js angle case 影响 maker 矩阵，`--write` 重冻）
  - `dev/p28/check-generation-matrix-frozen.json`（1570 行产出变化，`--write` 重冻）
- deleted: 无（P30-29 审计确认：shared/svg/ 挂载 geometry/calculation/makeTen/chart/diagram/currency，plugins/ 挂载 area/clock/competition/dataStats/draw/fraction，命名空间零重叠，无重复实现可删）
- reason: 阶段三 Generator+SVG 语义联动。P30-21/22：统一 GraphicDescriptor 为 `{type, subtype, params, role}`，role 表「图为什么存在」。P30-23：Generator 决定图形语义（shape.js 显式设 role）。P30-26：修复角的度量断链——Intent=angle-measure 但 Generator 产 rectangle graphic、SVG 无 angle renderer；新增 angle renderer + angle case + 证据规则对齐。P30-27/28：Graphic Alignment Gate——carrier 必须有图、null 禁止有图、graphic.role 合法枚举校验。P30-29：SVG 重复架构审计，确认无重复层。P30-24：SVG 只读 graphic.type/subtype/params，不猜题目/答案/KP（svg-registry 既有设计满足）。
- tests: `node --test tests/generator/p28-hollow-shape-themed.test.js` 12/12 PASS；`tests/generator/p28-geometry-native-makers.test.js` 28/28 PASS；`tests/generator/graphic-renderer.test.js` PASS；`npm test` 651/651 PASS；`node dev/check-all.js` **29 PASS / 0 FAIL / 1 SKIP / 30 项**；浏览器渲染验证：angle SVG（两射线+顶点+圆弧）在 http server 下 Chrome 渲染正确。`math-g4-up-u02-k002` 实产 `graphic={type:'geometry',subtype:'angle',role:'angle-measure',params:{angle:NN}}` → SVG SUCCESS。
- risk: ①evidence-rules.json 直接编辑（无派生脚本，规则事实错误属 P30-26 断链修复授权），已在 change-log 留存依据；②仍有 3 个线段 KP（math-g2-up-u05-k003/k004、math-g3-up-u07-k001）证据规则要求 rectangle 但语义应为 line，`line-segment` 在 NAME_TO_SHAPE/SHAPE_SUBTYPE 存在但无 generateGraphicParams case 且无 SVG renderer，属阶段三遗留线段断链，本轮不触碰（需新建 line renderer，超出角的度量 scope）；③轴对称 KP 仍用 rectangle 承载，语义可接受；④未 git commit。

### P30-GEN-10｜Semantic Equivalence：非算术 fill/choice 指纹塌缩修复（2026-10-03）
- modified:
  - `shared/validator/duplicate-validator.js`（`buildQuestionFingerprint` L107-117：`fill`/`choice` 无操作数时追加 `ph:promptHash`；有操作数时维持 operand 排序归一语义不变。`SEMANTIC_TYPES` 仍为 `{apply, geometry, judge, classify, open, recognize}`，不扩表）
  - `shared/engine/presentation-engine.bundle.js`（重建，inlined 21 / delegated 61）
- deleted: 无
- reason: P30-18 scope 界定并落地。根因：`fill`/`choice` 不在 `SEMANTIC_TYPES`，非算术题（认图/概念/统计/方位）无数字操作数时指纹不含任何语义内容，导致同 KP 同结构的不同题目（如「三角形」vs「正方形」）指纹完全相同 → RetryLoop 去重全判重复 → 容量塌缩为 1。诊断覆盖 595 行 capacityGap，确认 89 行为指纹塌缩（fill=38、choice=51；按生成器：position-direction=36、concept-meaning=19、stats=16、shape-recognition=8、reasoning=4、decimal-number=2、code-recognition=2、fraction-number=2）。修复条件：`(qt==='fill'||qt==='choice') && operands.length===0` 时附加题面哈希，算术 fill/choice（有 operands）行为不变。
- tests: 单元验证——算术 fill `3+5=___` 与 `5+3=___` 指纹相同（operand 归一保持，无 `ph:`）；非算术 fill「三角形」与「正方形」指纹互异（含 `ph:`）。`node --test tests/generator/p28-hollow-shape-themed.test.js tests/orchestration/p11-02-duplicate-contract.test.js tests/orchestration/p11-03-capacity-recovery.test.js` 32/32 PASS。`npm test` 651/651 PASS。`node dev/check-all.js` **29 PASS / 0 FAIL / 1 SKIP / 30 项**（6a/6b/6f/16/17 全 PASS，FINAL-91 只读门禁 PASS）。classify 复测：capacityGap 595→555（改善 40 行），position-direction 43→13（改善 30 行），shape-recognition 260→258（改善 2 行）。
- risk: ①指纹为运行时计算，Golden/冻结矩阵（6a/6b 均 count=1）不存储指纹，无冻结漂移；②89 行塌缩中仅 40 行容量恢复至 6，其余 49 行因变式池本身不足（generator 产出 < 6 互异题）仍有 capacityGap，属阶段四变式扩容债务，本轮不触碰；③`buildMathFingerprint` 复用 `buildQuestionFingerprint`，跨 KP 去重同步获 ph:，非算术题跨 KP 同题面仍判重（正确）；未 git commit。

### P30-GEN-09｜阶段二债务闭环：失败分类脚本接入 check-all + BASELINE 口径修正（2026-10-03）
- modified:
  - `dev/check-all.js`（Generation 段新增 6f 项：`node dev/p30/check-generation-failure-classify.js`，timeout 1200000ms；不带 --write，CI 不落盘报告，避免 FINAL-91 只读门禁误触发）
  - `docs/00-BASELINE.md`（测试口径修正：测试文件 64→63、用例 658→651、PASS 658→651、套件数 17→15、耗时说明 658→651、门禁表 658/658→651/651——P30-07 删除 teaching-semantic-profile.test.js（10 用例）后未同步基线）
- deleted: 无
- reason: 用户指令「优先解决第二阶段债务问题」。三项债务阶段归属判定：①capacityGap 595 行→关联 P30-17 表达维度+阶段四变式，阶段二不可闭环；②check-generation-failure-classify.js 未接入 check-all→P30-GEN-07 产物、P30-GEN-08 已修通 7 行 FAILED，脚本当前 pass=true（Layer A 1570/1570 全绿、Layer B 0 FAILED/0 failedPlan/0 zeroQuestion，capacityGap 595 行按 FINAL-142 仅记账不判 FAIL），属阶段二可闭环债务；③P30-17/P30-18 medium 排期→P30-17 绑 capacityGap（阶段四）、P30-18 需 scope，本轮不动。本任务闭环债务②。脚本实测耗时 17.4s（1570 行×2 层 in-process），接入 check-all 后总项数 29→30。
- tests: `node dev/p30/check-generation-failure-classify.js` 退出码 0，Layer A FAIL=0、Layer B failedPlan=0、zeroQuestion=0；`node dev/check-all.js` **29 PASS / 0 FAIL / 1 SKIP / 30 项**（6f PASS，FINAL-91 只读门禁 PASS）；`npm test` 651/651 PASS。
- risk: ①脚本 Layer A（count=1）与 6a/6b 口径重叠，check-all 增加约 17s 耗时，可接受；②capacityGap 595 行仍为阶段四变式债务，本轮不触碰；③BASELINE 测试数修正仅改文档数字，不影响任何生产代码/数据/冻结物；未 git commit。

### P30-GEN-08｜修复 count=6 下 0 题交付的 7 行 FAILED（2026-10-03）
- modified:
  - `shared/generator/generators/percent.js`（makeDiscount/makeInterest：calc 分支题面恒「现价列式/利息列式」，删除 calc 内 askSaved/askTotal 变体；关键修正：`buildBase` 的 `data.ask` 也按题型三元化——`(t === 'calc') ? 'current'/'interest' : (变体开关 ? 对应值 : 缺省值)`，否则 calc 奇数 i 仍写违例值；fill/choice/apply 的 saved/total 变体承载不变）
  - `shared/generator/generators/stats.js`（删除 4 处 `data.steps = 2;`：条形图「四个月共借书」、营养午餐「热量差千焦」、折线图「温差合计℃」、可能性「红白球次数差」——题面/答案文案不变，仅 data.steps 恢复恒 1，对齐 evidence-rules 断言）
  - `shared/engine/strategy-engine.bundle.js` + `shared/engine/presentation-engine.bundle.js`（两 bundle 重建，npm run build:strategy / build:presentation）
  - `kbl/teaching/variation-profiles.json` + `kbl/teaching/misconception-profiles.json`（题面文案变化触发 §9 重派生：derive-variation-profiles.js 生成失败行 0、derive-misconceptions.js overlay 重写、check-variation-drift.js PASS）
  - `dev/p30/reports/p30-generation-failure-classify.json`（P30-19 分类报告复跑 --write：Layer B FAILED 7→0，PARTIAL 591→595，capacityGap 598→595，zeroQuestion 行数=0，failedPlan=0，报告 PASS 退出码 0）
- deleted: 无
- reason: 用户确认「先修 7 行 FAILED（推荐）」。P30-19 分类已归因：4 行 stats apply 部分变体缺 `data.steps`（KP_SEMANTIC_EVIDENCE）+ 3 行 percent-calc 缺 `data.ask`（NON_RETRYABLE）→ 整批丢弃 0 题交付。修复定性为**接通**：generator 语义演化（calc 变体扩入 stats、ask 分化扩入 percent calc）未同步 T2 evidence-rules 断言（HEAD 观察性快照：calc 行 data.steps 恒 1、data.ask 恒 current/interest），属 P30 §4 断链修复——修 generator 对齐 T2 契约，不翻案断言（T2 是 SSOT）。修复前全量扫描 1570 行 × count=6 逐变体验证：违例面收敛到 8 行/20 变体（非全局）；99 行钉 steps=2 的行与 4 个目标 KP 零交集，删 4 处安全。
- tests: 8 目标行复验 kpSemFail=0（math-g4-down-u08-k004 / g4-up-u06-k001 / g5-down-u07-k001 / g5-up-u07-k003 apply；math-g6-down-u02-k001 / k004、math-g6-up-u05-k003 / k004 calc）；generator 定向测试 288/288；三矩阵只读复核全 PASS（count=1 口径不变，git diff=0 无需重冻）；分类报告复跑 FAILED=0 / 报告 PASS；`npm test` 651 pass / 0 fail；`node dev/check-all.js` 28 PASS / 0 FAIL / 1 SKIP。
- risk: ①capacityGap 595 行（缺口 1-2：69 / 3-4：381 / 5+：145）为 FINAL-142 变体池容量记账（shape-recognition 260 / stats 151 / concept-meaning 75 领先），属 P30-17 表达维度与阶段四变式任务关联债务，本轮不动；②percent calc 分支题面文案变化已触发剖面重派生并过漂移门禁，但 variation 三桶指纹实际变化的行数未逐一审计（依赖派生器 + 漂移门禁背书）；③删除 stats.js `data.steps=2` 使 4 个 KP 的 count=6 下可用变体骨架减少（原 2 步变体并入 1 步），capacityGap 口径 stats 147→151 轻微上升——以 T2 契约正确性优先。未 git commit。

### P30-GEN-07｜P30-19：全量真实生成矩阵失败分类（2026-10-03）
- modified:
  - `dev/p30/check-generation-failure-classify.js`（新增 dev 检查脚本，纯分类证据产出，不改生产代码：Layer A 真实整链终态（PracticeSession count=1 × d3 × freeze seed，同 6b 口径）11 类失败分类（exception/noQuestion/typeDrift/kpDrift/schema/kpSem 细分错误码/typeContract/placeholder/emptyStem/emptyAnswer/fallbackGen）；Layer B plan 级深观测（StrategyEngine.plan + presentation-engine.generateQuestions count=6 同 seed）暴露 6b 不可见的中间失败（status/retries 分布/容量缺口分桶/failedPlan/行内错误码），FAILED 行经归因重放（复刻 RetryLoop 调用）拿 attempts 真实错误码）
  - `dev/p30/reports/p30-generation-failure-classify.json`（分类报告产物，确定性内容无时间戳）
- deleted: 无
- reason: 用户指令「执行 P30-19：全量真实生成矩阵失败分类」。分类结果：Layer A 1570 行全绿（11 类失败均 0，与 6b 冻结门禁对账一致）；Layer B（count=6 用户视角）暴露两层债务：①**7 行 FAILED（0 题交付）**——4 行 stats apply（math-g4-down-u08-k004/g4-up-u06-k001/g5-down-u07-k001/g5-up-u07-k003：6 题中部分变体缺 `data.steps`（KP_SEMANTIC_EVIDENCE×10）叠加语义空间小（DUPLICATE×49+INTEGRITY×19）→ MAX_RETRIES_EXCEEDED 整批丢弃；3 行 percent-calc calc（math-g6-down-u02-k001「折扣」缺 `data.ask=current`、k004/g6-up-u05-k004「利率」缺 `data.ask=interest`，KP_SEMANTIC_EVIDENCE×6/行）→ NON_RETRYABLE 首轮即停）；②**598 行容量缺口（实产<请求 6）**——缺口 1-2 题 69 行 / 3-4 题 377 行 / 5+ 题 152 行，按生成器：shape-recognition 260、stats 147、concept-meaning 75、position-direction 43（变体池骨架数 < 请求题量，i%N 循环致同批重复，语义空间真饱和，FINAL-142 能力记账口径）；重试消耗：retries=0 一次过 659 行 / 1-2 次 258 行 / ≥3 次 653 行。归属层：①Generator maker 未满足 T2 evidence-rules 断言（percent.js/stats.js 部分变体未写 data.ask/data.steps）；②Generator 变体池容量上限（P30-17 表达维度/变式任务关联）——**修复属后续任务，本任务只产出分类证据，未动任何生产代码与 T0–T3 数据**。
- tests: 报告确定性：全量跑两次 SHA256 一致（01428af9…）；Layer A 与 6b 冻结门禁 FAIL rows=0 对账一致；`node dev/check-all.js` 28 PASS / 0 FAIL / 1 SKIP（新增脚本无副作用）。
- risk: ①分类发现 7 行 count=6 真实失败属**新增已知债务登记**（6b 冻结口径 count=1 掩盖了 count=6 下的变体债务，非回归——本次未改任何生产代码）；②598 行容量缺口是用户视角「一份练习 6 题」的真实体验债务，与 P30-17（表达维度）及阶段四变式任务关联，修复排期待 P30-20 阶段二门禁决策；③脚本退出码语义：发现 FAILED/0 题行 → 1（当前为 1），接入 check-all 需先决定债务修复或门禁口径（P30-20）。未 git commit。

### P30-GEN-06｜P30-16：KP×QT×Maker 真分工矩阵 — format 债务清零（2026-10-03）
- modified:
  - `shared/generator/generators/stats.js`（native maker 新增 fillStem/applyStem 按题型换词：等式 `=（ ）`→fill「折合____」/apply「合多少」；长条件块同义换词打散 3-gram；time-convert choice 改「换算成…是多少」；elapsed apply 换「由家动身→离家、抵达→到达」；bar-double fill 改「复式条形图显示…合计 ____ 人」；classify fill 改「已知下列事物」去共享引导前缀；probability-size 按题型换容器措辞「盒子里有/袋中有/一个盒里放着」与「任意摸出/随便摸」；clock calc/choice 分化；1亿=1万万 fill 补「等于____」）
  - `shared/generator/generators/concept-meaning.js`（k001 因数和倍数补 item.choice 专用题面，含「因数」关键词且骨架与 calc/apply 互异；makeByItem choice 优先 item.choice）
  - `shared/generator/generators/selection.js`（makeQuestion 由按 mode 分支改为按 plan.questionTypeId 分支：fill「计算：」、choice「请选择正确答案：」、judge「判断对错：」、apply/calc「直接写得数：」，解决 selection-fill 被 KP 绑定承接多题型时恒产 fill 骨架的问题）
  - `shared/generator/generators/arithmetic.js`（fill 题面加「填空：」前缀，避免 fill core 成为 calc/judge core 的子集）
  - `shared/generator/generators/picture-equation.js`（brace 分支按 qt 分化：calc 列式、fill「合起来是 ____ 个」、choice「总数是多少？」、apply 原句）
  - `shared/generator/generators/counting.js`（generic 搭配分支按 qt 分化 calc/fill/choice/apply）
  - `shared/generator/generators/semantic-relations.js`（periodic fill 引导语改「找规律：…依次重复出现」，打散与 calc 共享的「图形按…为一组重复排列」前缀）
  - `shared/generator/generators/semantic-special.js`（code-recognition practice fill 数组顺序调换，使同索引 fill/choice 场景错开，避免共享「规则+学号」骨架）
  - `shared/generator/generators/money.js`（makeMeasurementConversionQuestion 按 qt 分化：calc 列式、choice「X 换算成 Y 是多少？」、judge「判断对错：」、fill「单位换算填空：」）
  - `shared/generator/generators/position.js`（makeTranslationQuestion 按 qt 分化：fill「图形先向…平移…总共移动 ____ 格」、choice「一个图形先…再…一共平移了多少格？」、judge「…共平移 X 格，对还是错？」；shown 提前到 prompt 构造前）
  - `shared/generator/generators/percent.js`（makeChengshu variant 0 choice 改「选择：X 化成百分数是多少？」，不再是 apply 子串）
  - `shared/engine/strategy-engine.bundle.js`、`shared/engine/presentation-engine.bundle.js`（重建）
  - `docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.{json,md}`（重冻）
  - `docs/archive/phases/p28/P28-GENERATOR-MATRIX.{json,md}`（重冻）
  - `docs/archive/phases/p30/P30-KP-QT-MAKER-MATRIX.{json,md}`（重冻，format=0）
  - `kbl/teaching/variation-profiles.json`、`kbl/teaching/misconception-profiles.json`（题面文案变化，重派生）
- deleted: 无
- reason: P30-GEN-05 门禁暴露 1570 行 ALLOW 映射中同 KP 跨题型 coreStem 3-gram sim≥0.85 的 format 债务（644→0）。各题型应承担不同 Assessment Target，而非同 KP 跨题型出同骨架题。逐族按「calc=算式/列式、fill=句首空白或填空前缀、apply=情境故事、choice=结果匹配或选择问式、judge=判断对错」模式分化骨架，未新增架构/双轨，未改 T0/T1 数据。
- tests: stats 151/151 全 target 且 type-contract 0 失败；generator 测试 288/288 PASS；`dev/p27/check-variation-drift.js` PASS（硬违例 0）；`node dev/check-all.js` 28 PASS / 0 FAIL / 1 SKIP（#15 无 Chrome）；三矩阵重冻一致。
- risk: ①题面措辞变化可能影响 variation profile 硬轴（已重派生 variation-profiles + misconception-profiles，漂移门禁 0 违例）；②selection.js 由 mode 分支改为 qt 分支，selection-choice/selection-judge 生成器在被路由到非声明 qt 时也能产出对应形态题面（属修复，非回归）；③未 git commit。

### P30-GEN-04｜P30-15：Intent Alignment Validator 建立 + 34 行 KP 图形表征矛盾修复（2026-10-03）
- modified:
  - `shared/validator/kp-semantic-validator.js`（新增 checkIntentAlignment 函数：focus/representation（反向约束：allowedRepresentations 不含 graphic 时题目不应含图）/graphicRole（carrier 必须含图、null 不含图）/expressionMode 四维检查；集成进 validateKpSemantics 第 10 项，checks.intentAlignment 状态暴露；module.exports 导出）
  - `shared/schemas/semantic-question.schema.js`（L171-172 新增错误码 `KP_SEMANTIC_INTENT_ALIGNMENT`）
  - `dev/p25/derive-qt-intent.js`（① 评审回流扩展：`correctedAssessment` 裁决可覆盖 assessment 机器字段（源头教学事实裁决）；② Class B 派生规则修正：geometry×geometry 行中 concept-meaning 承载的 KP（经 GRegistry.all() 查 generator:concept-meaning 绑定）graphicRole 降为 auxiliary——不强制产图，解决「carrier 要求必含图但 concept-meaning 产纯文字概念题」矛盾）
  - `kbl/teaching/qt-intent-review.json`（新增 3 个人工评审补充批次：p30-15-2026-10-03 正方体涂色 6 行、p30-15-2026-10-03-visual-kp 28 行、p30-15-2026-10-03-class-b 28 行，共 62 条 correctedAssessment 裁决，全部 `allowedRepresentations+=graphic` + `graphicRole=auxiliary`）
  - `kbl/teaching/qt-intent.json`（重跑 derive-qt-intent.js 产出：confirmed 98→152，34 行 KP 图形表征经评审回流修正，其余行零变化）
  - `shared/engine/strategy-engine.bundle.js`（重建）
  - `shared/engine/presentation-engine.bundle.js`（重建）
- deleted: 无
- reason: 用户 P30-15 指令「建立 Intent Alignment Validator……检查 KP/题型/知识语义/训练目标/数域/运算/表达方式」。checkIntentAlignment 暴露真实数据矛盾：emit-canonical 机械派生 representations 仅 geometry 域/「graph」族补 graphic，导致 34 行视觉化 KP（正方体涂色/人民币/质量单位/统计图表/看图列式/方向辨认）被标 numeric-only，与其生成器（shape-recognition/money-measurement/stats/picture-equation/position-direction）合法产图行为矛盾。断链四要素：①端点=KBL representations（numeric-only）→ qt-intent allowedRepresentations/graphicRole → 生成器产图 → Validator 报错；②复现=math-g5-down-u09-k001「正方体涂色问题」apply 题面含正方体图但 intent.graphicRole=null；③归属层=T2 教学语义数据（qt-intent）+ 派生器规则（concept-meaning geometry 行）；④SSOT=dev/p25/derive-qt-intent.js + kbl/teaching/qt-intent-review.json。修复路径：全部经人工评审回流（correctedAssessment），不改 Excel、不改 emit-canonical 规则、不扩表。
- tests: 复现修复：p28-hollow-shape-themed.test.js 12/12 PASS（此前 maker 测试 1 失败）；矩阵冻结：dev/p28/check-generation-matrix-freeze.js FAIL rows=0，与冻结产物完全一致；`npm test` 651/651 PASS；`node dev/check-all.js` 27 PASS/0 FAIL/1 SKIP（#15 无 Chrome）。
- risk: ①graphicRole 分布变化：carrier 101→99（2 个 concept-meaning geometry KP 降 auxiliary），auxiliary 474→538（+62 行评审回流 +2 geometry 降格），null 995→933（-62）；②confirmed 行 98→152（+54 行人工核准）；③34 行 KP 的 allowedRepresentations 从 ['numeric'] 变 ['numeric','graphic']——仅影响 intent 消费（semantic-parameters.js graphic 投影），不影响 KBL canonical facts（rootHash 不变）；④Concept-meaning 2 KP（角的认识/面积的认识）graphicRole=carrier→auxiliary 反映其真实产题形态（纯文字概念题），不破坏 SVG 契约（Presentation 层独立渲染）。未 git commit。

### P30-GEN-03｜P30-14：数域错误链修复（KBL numberRange 数值上限 + maxSteps 事实边界）（2026-10-03）
- modified:
  - `tools/kbl/derive-kbl.js`（ranges() 双轨输出：max 保留为难度等级（冻结，供 R02 难度加分），新增 numMax 为数值上限；numMax 规则仅精确数值证据（「N以内」/「N～M」/「亿以内」→1e8/「万以内」→1e4/「千以内」→1e3/「一位」→10/「两位」→100/「三位」→1000），无「整数域/数」兜底（那是难度信号非数域事实）；capability.numberRange 新增 numMax 字段）
  - `tools/kbl/emit-canonical.js`（L83 generation.numberRange 改用 numMax（数值上限）而非 max（难度等级），无精确证据 → null 不猜）
  - `shared/strategy/strategy-engine.js`（L1008–1012：KBL maxSteps 事实边界 clamp——难度推导的 steps 不得超过 kp.structure.maxSteps，应用点在编排层而非 structure-constraints 模块内）
  - `shared/engine/strategy-engine.bundle.js`（重建）
  - `shared/engine/presentation-engine.bundle.js`（重建）
  - `docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.{json,md}`（重冻：1570 行产出因 maxSteps clamp 变化）
  - `docs/archive/phases/p28/P28-GENERATOR-MATRIX.{json,md}`（重生成）
  - `kbl/canonical/capability.json` / `kbl/data/math/g*/knowledge-points.json` / `shared/knowledge/data/**`（派生链重跑产物，rootHash 更新）
- deleted: 无
- reason: 用户 P30-14 指令「解决低级数域错误……不能出现 KBL：5以内 / Generator：27+2」。断链四要素：①端点=KBL canonical capability.numberRange.max（难度等级被误作数值上限）→ emit-canonical → NumberRangeStrategy → arithmetic.js；②复现=math-g1-up-u01-k002「5以内的加减法」calc 生成 9+18=27（操作数 18>5）；③归属层=KBL 派生层（T1 数据）+ Strategy 编排层；④SSOT=tools/kbl/derive-kbl.js ranges() + strategy-engine.js constraints 合并点。ranges() 原 `/数/` catch-all 把「5以内」max 从 5 覆盖为 100（definition 含「数手指」「数的组成」），且「万以内」等级 5 被 emit 当数值 5 使用（真实上限 10000）。
- tests: 幂等性：derive-kbl+derive-relations+emit-canonical+build 重跑两次 shasum 一致；端对端：`SE.plan(math-g1-up-u01-k002, calc)` → numberRange={min:1,max:5}，Generator 产出操作数全 ≤5；`npm test` 658/658 PASS；`node dev/check-all.js` 27 PASS/0 FAIL/1 SKIP（#15 无 Chrome）。
- risk: ①numMax 分布：5→3/6→2/9→2/10→6/100→11/1000→6/10000→5/1e8→3/null→337（无数域证据 KP 走 difficulty fallback，现状不变）；②max 难度等级字段未动 → seedDifficulty 分布零变化；③maxSteps clamp 改变 1570 矩阵产出（已重冻）；④Generator 结果仍可能超数域（如 4+4+2=10，操作数≤5 但和>5）——「结果数域」属 Generator 生成语义（操作数范围 vs 结果范围），不在本任务最小范围。未 git commit。

### P30-GEN-02｜P30-11：POL/Strategy 透传 intentSpec（不重新解释语义）（2026-10-03）
- modified:
  - `shared/orchestration/practice-orchestrator.js`（cellReq 白名单新增 intentSpec 透传，POL 不解释教学语义）
  - `shared/strategy/strategy-engine.js`（questionPlan 新增 intentSpec 透传字段，Strategy 不解释）
  - `shared/engine/strategy-engine.bundle.js`（重建）
  - `shared/engine/presentation-engine.bundle.js`（重建）
- deleted: 无
- reason: 用户 P30-11 指令「POL 继续负责 KP/题型/数量/难度/计划，新增 intentSpec 透传，不重新解释教学语义」。intentSpec 作为 Generation Context 字段随 cell 透传（Request→POL→Strategy→Generator），仅作元数据透传，不参与生成决策（生成决策仍由 semanticParams.intent 承载）。
- tests: `npm test` 651/651 PASS；`node dev/check-all.js` 27 PASS/0 FAIL/1 SKIP（#15 无 Chrome；#16 bundle 重建后 PASS）。
- risk: 透传字段不改变生成语义；未 git commit。

### P30-GEN-01｜P30-09/10/12：GenerationParameters 唯一入口确认 + semanticParams 结构调整 + Strategy 非法调用扫描（2026-10-03）
- modified:
  - `shared/generator/core/semantic-parameters.js`（resolve() 输出结构调整：P30-05 assessment 七字段并入 intent 块（trainsWhat/whyThisType/differentiation/driftRisk/legitimacy/targetCodes/focus/requiredRelations/requiredConstructs/allowedRepresentations/expressionModes/graphicRole 共 12 字段）；新增顶层 expression={modes:[...]} 与 graphic={role:...} 投影；移除顶层 assessment 字段；sources.intent 口径不变）
  - `tests/generator/p25-06-semantic-params.test.js`（3 个断言用例同步改断言 intent 七字段/expression/graphic 投影；needs-review 用例断言 intent/expression/graphic 全 null）
  - `dev/p30/check-intent-authority.js`（A2 断言同步：needs-review 行检查 intent/expression/graphic 全 null；权威行检查 intent 含 7 机器字段；注释同步）
  - `shared/engine/strategy-engine.bundle.js`（重建，bundle hash 与源一致）
- deleted: 无
- reason: 用户 P30-09/10/12 指令。P30-09 取证：全仓搜索 SemanticEngine/QuestionSemanticEngine/IntentEngine 零匹配；GenerationParameters 仅 3 处引用（semantic-parameters.js 本体/generator-selector.js/percent.js），唯一入口锁定。P30-10 按用户指定结构把 assessment 并入 intent，并新增 expression/graphic 顶层投影。P30-12 扫描 shared/strategy/**：未发现 Strategy→KBL 非法调用；Strategy→GeneratorRegistry/GeneratorSelector 调用属架构冻结允许边（docs/01-ARCHITECTURE.md §3 矩阵 Strategy 行 Generator 列=→），无修正。
- tests: 定向 `node --test tests/generator/p25-06-semantic-params.test.js` 24/24 PASS；门禁 `node dev/p30/check-intent-authority.js` 11/11 PASS；全量 `npm test` 651/651 PASS；`node dev/check-all.js` 27 PASS/0 FAIL/1 SKIP（#15 无 Chrome；#16 bundle 重建后 PASS）。
- risk: 结构变化仅影响 GenerationParameters 消费面；当前生产消费方仅 generator-selector.js 读取 intent.trainsWhat（未变），无 assessment 消费方；bundle 已重建，16/17 确定性门禁通过。未 git commit。

### P30-08｜阶段一门禁：八项数据/语义门禁 + 五项验证全部通过（2026-10-03）
- modified:
  - `dev/p30/check-intent-authority.js`（扩 A4 Intent 覆盖门禁：ALLOW 1570 行与 qt-intent 行集合双向一一对应；覆盖与权威分离——needs-review 计入覆盖但不具生成权威）
  - `dev/p30/check-teaching-schema.js`（**新建**：阶段电池「Teaching schema」只读门禁——S1 5 核心教学文件可解析/带 schemaVersion/集合非空（families 15、qt-intent 1570、variation 1323、misconception 313 KP、evidence 1570）；S2 6 现役保留文件（type-contracts 7、golden 1114、denials 4、intent-relations 11、kp-matrix 375、review verdicts 73）；S3 1570 行逐行 intent 五问+assessment 七键齐备、类型闭集、focus 落六类枚举（calculation/written/application/selection/geometry/classification）、graphicRole∈{carrier,auxiliary,null}；S4 基线计数 1570/375）
- deleted: 无
- reason: 用户 P30-08 阶段过门要求。八项门禁证据：①Excel source integrity=`check-kbl-lineage.js` L1（root Excel sha256 8d4ebef5…==extract 指纹）；②KBL uniqueness=`check-kbl-uniqueness.js`（known 0/new 0）；③KBL regeneration=`npm run kbl:rebuild` 全链重跑后 git 改动集逐字节恒定（CHANGESET-STABLE）+lineage 14 项；④KBL mapping=lineage L4a/L4b（canonical→kbl 发射→shared 镜像 1570 行一致）+`tools/kbl/validate.js`（allow 1570/forbid 0/missing 0）；⑤Teaching schema=新建 `check-teaching-schema.js` 5/5 项；⑥Intent status=`check-intent-authority.js` A1–A3（285 needs-review 经 1570 行 resolve 实测零权威）；⑦Semantic family coverage=`npm run verify:coverage` --strict（new declared-only 0，2 项均 known allowlist）；⑧Intent coverage=authority A4（1570 ALLOW 全有意图行、0 越权行）。
- tests: 用户指定五命令全绿：`npm test` **651/651**（63 测试文件；658 基线 + P30-06 新增 3 - P30-07 随物删除 10）；`npm run verify` M0 8/8；`npm run verify:allow-gen` 1570/1570 真实生成 PASS、FAIL 0；`npm run verify:education` PASS 939 / FAIL 0 / SEMANTIC_WARN 0；`npm run verify:golden` PASS（1114 题校验）；`node dev/check-all.js` **27 PASS / 0 FAIL / 1 SKIP**（#15 无 Chrome；CI 置 CHROME_BIN 应 28/0/0）；`dev/p30/build-baseline.js --with-tests` 基线快照 lineage 一致：375 KP/12 册/98 单元/373 relations/1570 ALLOW/7 题型，idAllCanonical、duplicateKp 0、orphanKp 0。
- risk: 两个新 P30 门禁仍为 dev 独立脚本，未编入 check-all 27 项编号（保持 P28 冻结口径），阶段过门显式执行；是否在 P30-CLOSE 并入全量门禁由收口阶段裁决。阶段一 PASS 标准达成：375 KP×7 题型×Intent 1570 行全部有明确状态（confirmed 98/ai-verified 1187/needs-review 285，无 rejected/未知），无新语义数据源、无第二套 Teaching Profile（已物理删除）、无手工派生数据（全链确定性重跑可证）。**按规则 §6，等待用户确认后方可开启阶段二 P30-GEN。**未 git commit。

### P30-07｜阶段一：物理删除第二语义运行时 TeachingSemanticProfile（2026-10-03）
- modified:
  - `dev/p28/final-31-warn-attribution.js`（仅注释：W1/W2 归因说明中对已删模块的引用改为「KBL 证据行字段为空，数据级 NEEDS_REVIEW」；W1/W2 数据级标志逻辑本就读证据字段、不依赖该模块，零行为变化）
- deleted:
  - `shared/knowledge/runtime/teaching-semantic-profile.js`（P25-01 第二套语义 read model：生产零 require——shared/dev/tools 全仓检索仅模块自引用；不在 `dev/build-knowledge-runtime.js` MODULES 七模块清单，不在 strategy/presentation 两个 bundle；其 13 核心字段中 learningTargets/knowledgeRelations/cognitiveTargets/questionIntent/variationDimensions/prerequisiteKnowledge/semanticConstraints 恒为 null 占位，operations/representations/semanticFamily/concept 已由 `shared/generator/core/semantic-parameters.js` 消费链覆盖，prerequisite 由 P30-05 assessment.requiredRelations 覆盖，misconception 由 misconception 链覆盖，contexts 由 knowledge-context/context-strategy 直读 KBL 覆盖）
  - `shared/schemas/teaching-semantic-profile.schema.js`（上述模块的私有 schema，随模块一并删除，无其他 require）
  - `tests/unit/teaching-semantic-profile.test.js`（仅守卫被删模块/schema 的 10 个用例，随物同删；非「为 PASS 删失败用例」——模块删除由用户 P30-07 指令明确授权，测试随之失去被测物）
- reason: 用户 P30-07 指令「TeachingSemanticProfile 不允许继续作为第二套语义运行时……最终只允许一个运行时语义入口 semantic-parameters.js」。按 P30 规则 §5 删除前置三方取证：①代码检索生产零消费者（唯一剩余 live 引用是本模块自身测试与 dev/p28 脚本一条注释）；②删除前后 `check-dead-code.js` 均 PASS（15 候选项矩阵不依赖该文件）；③`check-cross-layer.js` PASS 新增违规边 0；④无门禁以其存在为通过条件（check-all 27 项删除后全绿）；⑤档案（docs/archive、docs/P28/change-log.md、P28 矩阵 JSON）中的历史引用按「档案不动」保留。物理删除，无 shim/adapter/COMPAT。步骤 3「必要字段并入 semantic-parameters」经字段逐一比对认定**无需并入**：该模块所有非空投影字段在唯一语义入口均已存在真实消费，无字段因删除而丢失消费。
- tests: 删除前 check-dead-code PASS / check-cross-layer PASS（基线证据）；删除后：`npm test` 651/651 PASS（661-10 被删用例，测试文件 64→63）；`node dev/p28/check-dead-code.js` PASS；`node dev/p28/check-cross-layer.js` PASS；`npm run build:knowledge` 重建 knowledge-runtime bundle 无变化（git diff 0，证实模块从未进 runtime bundle）；`node dev/p30/check-intent-authority.js` 9/9、`check-kbl-lineage.js` 14/14；`node dev/check-all.js` 27 PASS/0 FAIL/1 SKIP（#15 无 Chrome）。
- risk: ①被删模块为 P25-01 架构件，档案/历史日志中的文字引用保留不改，历史可追溯性不受影响；②W1/W2 数据缺口审计标志仍在（只读证据字段驱动），归因能力不丢；③运行时唯一语义入口确认为 semantic-parameters.js（P30-06 已挂 intent+assessment）。未 git commit。

### P30-06｜阶段一：needs-review 不得作为生成权威 + assessment 消费挂载（2026-10-03）
- modified:
  - `shared/generator/core/semantic-parameters.js`（新增 `INTENT_AUTHORITY_STATUSES = {confirmed, ai-verified}` 白名单；`resolve()` 仅对权威行挂载 intent 五问，needs-review/未知状态行 intent 恒 null；同步挂载 P30-05 `assessment` 七机器字段（数组一律拷贝防突变）；`sources.intent` 改为可审计三态：`teaching:qt-intent:<status>` / `blocked:qt-intent:<status>` / `none`）
  - `shared/generation/api.js`（`getTrainsWhatFromIntent` Node 侧直载索引同口径加权威白名单——needs-review 行 trainsWhat 不注入 `q.semanticTarget`，该类题落既有 `plan.explainability.semanticTarget`（kp.module）兜底）
  - `tests/generator/p25-06-semantic-params.test.js`（新增 3 用例：confirmed 行 assessment 七字段+溯源、ai-verified 行挂载、needs-review 行 intent/assessment 双 null 且 sources 标 blocked）
  - `dev/p30/check-intent-authority.js`（**新建**：P30-06 门禁——A1 行数/状态闭集/counts 自洽；A2 全部 1570 行经真实 `SP.resolve()` 实测（285 needs-review 行零泄漏、1285 权威行 intent+assessment 挂载且 targetCodes 溯源）；A3 两生产读取点源码静态断言防白名单静默移除）
  - `shared/engine/strategy-engine.bundle.js`（按规则 §9 重建：含两读取点过滤，bundle 内白名单符号 2 处；presentation bundle 重建后无变化）
- deleted: 无
- reason: 用户 P30-06 任务指令「needs-review 不得作为强生成约束，仅进入审查/覆盖报告；不要让未确认的教学意图直接控制 Generator」。取证确认全项目仅两个生产读取点（semantic-parameters.resolve、api.getTrainsWhatFromIntent；strategy-engine 直读在 FINAL-22 已移除恒 null），均无 status 校验。按最小修改只加白名单一道闸，不新建语义源、不改派生数据；P30-05 的 assessment 机器约束经同一闸对 Generator 可见（权威行），语义字段被 Generator 用于改变产出的端到端断言属阶段二 P30-GEN「补齐语义消费」证据要求，本阶段只建立数据可用性与权威边界。
- tests: `node dev/p30/check-intent-authority.js` 9/9 PASS（1570 行全量实测）；`node --test tests/generator/p25-06-semantic-params.test.js` 24/24；`npm test` 661/661 PASS（658+3；首轮 crypto randInt 卡方测试 α=0.01 概率性 flake，重跑转绿，与本次改动无关）；`node dev/p28/check-generation-matrix-freeze.js` 只读复核「与冻结产物完全一致 git diff=0」1570/1570 FAIL 0（过滤仅影响 needs-review 285 行 semanticTarget 元数据注入，其非冻结字段且 explainability 兜底仍保证非空）；`npm run verify` M0 8/8；`node dev/p30/check-kbl-lineage.js` 14/14；`node dev/check-all.js` 27 PASS/0 FAIL/1 SKIP（#15 无 Chrome）。
- risk: ①needs-review 285 行的 semanticTarget 由 trainsWhat 文本变为 kp.module 兜底文本（题目/答案/难度零变化，冻结矩阵已证）；这正是用户要求的隔离，Learner 数据链测试 p28-32 对非空字符串的断言仍由兜底满足。②门禁为 dev 独立脚本，未加入 check-all 编号（保持 P28 冻结的 27 PASS 口径），阶段过门由 P30-08 显式执行。③未 git commit。

### P30-05｜阶段一：qt-intent 补机器可执行 assessment 字段（数据侧）（2026-10-03）
- modified:
  - `dev/p25/derive-qt-intent.js`（既有派生器扩展，无新派生链：读 `kbl/relations/math/relations.json` 建 `prereqByKp`（toId→fromId[]）；新增题型级闭式枚举 `EXPRESSION_MODES`（calc=expression / fill=expression,text / choice=option-selection / judge=binary-judgement / geometry=graphic-construction / classify=grouping / apply=context-word）；kpFacts 增补 representations/operations；每行产出 `row.assessment`——targetCodes=[knowledgeId]、focus=QTR 六类枚举、requiredRelations=前置 KP canonical 码排序、requiredConstructs=semantic.operations 排序、allowedRepresentations（numeric/graphic，geometry 题型不挂 numeric）、expressionModes、graphicRole（geometry 域×geometry 题=carrier，其余 graphic 支持=auxiliary，否则 null）；红线断言：focus 枚举合法、数组类型、relations 码形如 `math-g[1-6]-`，按去重 KP 汇总 requiredRelations 总数必须 == 373）
  - `kbl/teaching/qt-intent.json`（由派生器再生，1570 行全挂 assessment；实测 graphicRole null 995/carrier 101/auxiliary 474；reps numeric 995/graphic 105/numeric+graphic 470；连续两次派生含 xlsx/md 全部产物 sha256 一致）
  - `kbl/teaching/qt-intent-sample.xlsx`、`docs/archive/phases/p25/P25-KP-QT-INTENT.md`（派生器联动产物随再生）
- deleted: 无
- reason: 用户 P30-05 任务指令「在现有 qt-intent 结构上补机器可执行字段，把『这个题型应该练什么』从自然语言变成 Generator 可消费的约束」，且指定字段结构 trainsWhat/whyThisType/differentiation + assessment 七项。严格经 T2 唯一写方（既有 dev/p25 派生器）再生 JSON，零手编教学语义；生产消费挂载随 P30-06 权威闸一并完成（needs-review 行的 assessment 不可见）。
- tests: 派生器内置断言（requiredRelations 去重 KP 汇总==373、focus/码型枚举）两次运行通过且产物 sha256 恒定；`npm run verify` M0 8/8；数据侧行为经 P30-06 门禁 A2 的 1570 行 resolve 全量实测验证（见上条）。
- risk: assessment 为新增字段，旧消费者不读取故零影响；它是约束投影而非新语义源（值全部来自 canonical/relations 与既有 semantic 字段）。未 git commit。

### P30-04｜阶段一：统一教学语义数据源，删除零消费重复快照（2026-10-03）
- modified:
  - `dev/p25/build-baseline.js`（停止产出 `kbl/teaching/generation-matrix.json`：删 writeFile、头部产出说明、MD 链接改指真源 `kbl/canonical/mappings.json`、console 产出行）
- deleted:
  - `kbl/teaching/generation-matrix.json`（物理删除，无 shim：1570 映射逐行的零消费者重复快照，内容已陈旧——仍含已删除的 `generator:classification`；真源在 canonical/mappings.json，冻结证据在 P28-GENERATION-MATRIX-FROZEN.json）
- reason: P30-04 任务指令「只保留现有 5 核心语义文件……不新建 v2/第二源」。全仓 grep 取证（排除 docs/archive 历史档案）：①全仓**无** semantic-v2/intent-v2/teaching-intent 等第二源（0 命中）；②用户点名 5 核心（semantic-families/qt-intent/variation-profiles/misconception-profiles/evidence-rules）均经既有链消费；③其余 8 个 JSON 逐一取证——**活跃保留 6 个**：`type-contracts.json`（生产 `shared/generator/core/type-contract.js` selector 单点 + test p25-07）、`golden-questions.json`（M0 golden 门禁 validate-golden-dataset + test p25-16/17）、`teaching-denials.json`（生产 `capability-resolver.js` + verify:allow-gen 门禁 + test p25-06）、`intent-relations.json`（生产 `semantic-evidence.js`/`kp-semantic-validator.js` + test p25-05）、`kp-matrix.json`（M0 coverage 门禁 + golden 构建 + variation/misconception 派生输入）、`qt-intent-review.json`（derive-qt-intent 人工评审账本合并 + import-qt-intent-review 回流）；**评审记录保留 1 个**：`semantic-review.json`（P25 人工评审机读记录，生产零读取，非生成权威，属 T2 评审回流工件）；**零消费者重复快照删除 1 个**：generation-matrix.json（三方取证：grep 仅命中其生产者自身、无门禁以其存在为通过条件、档案不受影响，满足 P30 规则 §5 删除前置）。两个 xlsx（qt-intent-sample 人工抽查/import 载体、semantic-matrix P25 评审产出）为 T2 评审工件，保留。
- tests: `node --check dev/p25/build-baseline.js` OK；`node dev/p28/check-kbl-ai-boundary.js` PASS（删除后边界完好）；删除文件无任何 test/gate 引用（grep 取证）。
- risk: 被删文件由 P25 归档脚本历史产出，归档报告 docs/archive/phases/p25/P25-BASELINE.md 中的历史链接为档案内容，按「档案不动」原则保留（文件删除不影响历史阅读，真源链接在脚本侧已更正）。未 git commit。

### P30-03｜阶段一：全链重生产 KBL 衍生数据 + 确定性修复（2026-10-03）
- modified:
  - `kbl/canonical/mappings.json`（经 `tools/kbl/derive-kbl.js` 重生产：**130 行 pluginId 收敛**——105 行 geometry `generator:selection-fill`→`generator:arithmetic-mixed-calculation`，25 行 classify `generator:classification`（P28-HOLLOW-01 已物理删除的生成器）→`generator:stats`；pluginId 为「注册表内首个 capability 命中」的承载元数据，逐题型推导，非逐 KP 决策）
  - `kbl/mappings/generation-contract/math.json`、`shared/knowledge/mappings/generation-contract/math.json`（emit/build 发射副本随真源再生，105 行 geometry 收敛；classify 25 行副本在 P28 期被手改已与新真源一致）
  - `kbl/manifest/manifest.json`、`shared/knowledge/manifest/manifest.json`（rootHash `20609e50…`→`3868fe65…`；shared 侧删除墙钟 `buildAt`、`packageVersion` 改为继承 kbl 源清单稳定值）
  - `knowledge/knowledge-index.json`（`generatedAt` 由每次重建的墙钟改为 KBL 数据构建时间 `2026-09-13T14:17:27.229Z`）
  - `tools/kbl/build.js`（**确定性修复**：manifest 禁止 `new Date()` 墙钟字段，packageVersion 取自 `kbl/manifest`）
  - `dev/build-knowledge-pages.js`（**确定性修复**：knowledge-index.json 的 generatedAt 取 kbl/manifest，禁止墙钟脏 tracked 文件）
  - `dev/check-knowledge-access.js`（TOOLS 离线校验白名单加入 `dev/p30/build-baseline.js`、`dev/p30/check-kbl-lineage.js`，二者职责即逐字节审计发射镜像，与在列的 check-kbl-quality 同类）
  - `docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.json`、`.md`（按规则 §9 `--write` 重冻：逐字段比对证实 1570 行证据中**仅 105 行 pluginId 元数据变化**，实际使用 generator / prompt / answer / sample / 各项校验全部零变化，frozen=true）
- deleted: 无
- reason: P30-03 任务指令「重新生成全部 KBL 衍生数据……无非法 mapping」+ P28-05 确定性要求。血缘门禁 P30-02 锁定的 L4a 漂移证实：P28 期注册表演进（classification 删除、arithmetic-mixed-calculation 排序提前）后只手改了发射副本、未重跑派生链，导致 canonical 真源陈旧。重建按用户指定唯一链路 `npm run kbl:rebuild`（extract→derive-kbl→derive-relations→emit→build→build:knowledge）完成，无任何手工编辑派生数据；T2 陈旧快照 `kbl/teaching/generation-matrix.json`（仍含 classification）无门禁消费者，登记 P30-04 随 T2 审计处理，本轮不手改。
- tests: `node dev/p30/check-kbl-lineage.js` 12 项全 PASS；`node tools/kbl/validate.js` V1–V5 PASS；`node dev/check-kbl-quality.js` M17 10/10 PASS；`node dev/check-kbl-uniqueness.js` PASS（known 0/new 0）；`node dev/p28/check-kbl-ai-boundary.js` PASS；`npm run verify` M0 八步 8/8 PASS；`node dev/p28/check-generation-matrix-freeze.js` 只读复核「与冻结产物完全一致（git diff = 0）」1570/1570 FAIL 0；`node dev/check-knowledge-dir.js` PASS（377 文件）；`npm test` 658/658 PASS；连续两次 `kbl:rebuild` 后 git 改动集合恒定（确定性证实）。
- risk: ①105 geometry 行承载 pluginId 变为 arithmetic-mixed-calculation，但真实生成由运行时 selector 决定、不读 mapping.pluginId，冻结证据已证实题目零变化；geometry 行的生成精准性属阶段二 P30-GEN 议题，阶段一不夺权。②rootHash 变化是 130 行映射收敛的必然结果，两份 manifest 已同步且可重算。③未 git commit（用户未要求）。

### P30-02｜阶段一：锁定 Excel→KBL 唯一派生链 + 血缘门禁（2026-10-03）
- modified:
  - `dev/p30/check-kbl-lineage.js`（**新建**：血缘门禁 L1 root Excel 指纹→L2 extract/canonical 计数→L3 relations 三处相等→L4 mappings 真源/投影/镜像相等→L5 data/index 镜像相等→L6 两 manifest rootHash 可重算且计数一致；导出 `runLineageChecks` 供基线脚本复用，禁止第二套比对实现）
  - `dev/p30/build-baseline.js`（血缘段改为复用 check-kbl-lineage，删除自带比对）
  - `package.json`（新增有序命令 `kbl:extract` / `kbl:derive`（derive-kbl→derive-relations→emit→build）/ `kbl:rebuild` / `kbl:lineage`）
  - `docs/02-KBL.md`（Relations 0→**373**（R-REL-01 277/02 58/03 38，全 inferred+llm-finalized-dev）；补全唯一构建链（原链漏 derive-relations）；新增「真源 vs 发射副本」表，裁决 `canonical/relations.json` 为关系集唯一派生真源、`kbl/relations/` 与 `shared/knowledge/relations/` 仅为发射副本；白名单补 derive-relations）
- deleted: 无
- reason: P30-02 任务指令：解决 `kbl/canonical/relations.json` 与 `kbl/relations/math/relations.json` 生成职责混淆，锁定 Excel→extract-raw→derive-kbl→canonical→runtime/relations/mappings 唯一链路且全部可追溯。门禁建立当日实测：仅 L4a FAIL（25 行 canonical 残留已删除的 `generator:classification`），其余 11 项全绿——证实漂移点确在 mapping 真源，交 P30-03 重生产收敛。
- tests: `node dev/p30/check-kbl-lineage.js` 按预期 FAIL 1 项（L4a，25 行漂移，复现证据），P30-03 重建后转 PASS（见下条）。无生产代码行为变化。
- risk: 门禁为离线只读审计脚本，不参与运行时；不改任何 KBL 数据。未 git commit。

### P30-01｜阶段一：建立当前项目真实机器可读基线（2026-10-03）
- modified:
  - `dev/p30/build-baseline.js`（**新建**：确定性只读基线，输出 `dev/p30/reports/p30-baseline.json`——13 类计数（KP/课程/单元/mapping/relations/7 题型/Generator/Intent/Variation/Misconception/Evidence/Golden/SVG renderer/测试）+ 派生链血缘断言，FAIL exit 1；`--with-tests` 实测用例数）
  - `.gitignore`（忽略 `dev/p30/reports/`，机器快照不入仓）
- deleted: 无
- reason: P30-01 任务指令「生成一次机器可读基线……禁止修改任何生产文件」。实测基线（2026-10-03）：375 KP / 12 册 / 98 单元 / 373 relations / 1570 ALLOW（missing 0）/ canonical 7 题型 / 23 Generator（20 PRODUCTION+1 composite+2 dormant carrier）/ qt-intent 1570 行（confirmed 98 + ai-verified 1187 + needs-review **285** + rejected 0）/ variation 1323 行 313 KP / misconception 920 槽 375 KP / evidence 1570 / golden 1114 题 15 族 / semantic-families 15 族覆盖 375 KP / type-contracts 7 / SVG 12 描述符语义类型 + 13 渲染模块 / 64 测试文件 658 用例全 PASS / check-all 本地 27 PASS/0 FAIL/1 SKIP。
- tests: 脚本自身为只读审计；`node dev/p30/build-baseline.js --with-tests` 运行成功并生成快照，除血缘 L4a（P30-02 门禁化、P30-03 修复）外无其他 FAIL。
- risk: 仅新增 dev 离线脚本与 gitignore 一行，零生产文件/零契约/零数据影响。未 git commit。

### P30-INIT｜P30 战役立项：运行规则制定 + 开发日志建立（2026-10-03）
- modified:
  - `.trae/rules/p30-repair-rules.md`（**新建**：P30 修复运行规则——战役定性四类合法工作、T0–T3 数据权限分级、语义消费接通规则、断链/重复层处理规则、四阶段门禁、DATA/GEN/SVG/CLOSE 编号、开工 P30 五问、改后重冻/重建清单、十条红线）
  - `docs/P30/change-log.md`（**新建**：本日志）
- deleted: 无
- reason: 用户指令「新建任务，原则不变，记录开发日志……结合项目制定 P30 修复的运行规则。暂不执行任何修复任务」。规则依据立项当日对项目真实状态的只读核实：`docs/00-BASELINE.md`（375 KP / 98 Units / 1570 ALLOW / 23 Generator / 658 用例 / 27 PASS 门禁）、`docs/01-ARCHITECTURE.md`（冻结单向链与 8 条硬红线）、四份现存契约（`knowledge-contract.js` PUBLIC_API 白名单、`generation-contract.js` Cell/Plan、`generator-contract.js`、`core/type-contract.js`）、`docs/02-KBL.md`/`03-POL-GENERATION.md`/`07-SVG.md`、`dev/check-all.js` 实际 22+FINAL-91 门禁项、T2 教学语义产物清单（kbl/teaching/*.json）与变式六桶（`core/variation-apply.js`）。规则将用户 12 条总原则落为可执行门禁与红线，并登记两处已观察到的文档口径漂移（02-KBL Relations 0 vs 基线 373；03-POL 31 生成器 vs 现 23）为阶段一候选，仅登记不授权。
- tests: 无代码改动，未触发构建/测试门禁；本轮为治理文档建立，按用户要求**未执行任何修复任务**。文档数字门禁 `node dev/p28/check-doc-consistency.js` 单跑确认 PASS（新文件只引用当前基线数字）。
- risk: 零生产代码行为变化；无契约/冻结物/bundle/KBL 数据变更，无需重建或重冻。`.trae/` 不属 git 跟踪（本地 AI 规则，与 ai-coding-workflow.md 同处）；`docs/P30/` 为新增归档目录，不触碰 archive 历史。不 git commit（用户未要求）。
