# P35 变更日志（难度执行端消费 + 遗留债务统一收口战役）

> 战役性质：P34-FINAL 后的收口战役——难度消费接通、历史挂账取证销账、人工请求打包。
> 波次/阶段划分见 `docs/P35/P35-TASK-BOOK.md` §4；原则「未解决问题继续保留，不遮盖」。

---

## P35-INIT · 立项建档：遗留债务全量清单 + 任务书（2026-10-11）

- **modified**：新建 `docs/P35/P35-TASK-BOOK.md`（问题清单 DEBT-1…8 + 方案 + 四阶段门禁 + 红线）；新建 `docs/P35/change-log.md`（本文件）。
- **deleted**：无（根目录杂物文件 f50aaf9fa36f1f4482b665214f418996.txt 已于同日随 P34 提交流程物理删除并入库，销账于 DEBT 之外）。
- **reason**：用户指令「统一立项为 P35，列明需要解决的问题和方案」。清单来源为 P34-14 收口时的全项目债务盘点（P32/P34 change-log 全部未销账 risk 项 + human-data-requests 汇总表），共 8 项：DEBT-1 难度执行端消费审计（大任务，最高优先）、DEBT-2 图形表达能力缺口（挂裁决）、DEBT-3 g4-down-u02-k001 组合体配图 2 条（并入 DEBT-2 裁决）、DEBT-4 开放设计类讲解深度（低优先取证）、DEBT-5 stats format 债务 8 行/4 KP（先取证）、DEBT-6 P32 13 条矩阵数据事实缺口（人工请求 H8）、DEBT-7 P28 期 H1–H5 催办汇总、DEBT-8 #15 E2E SKIP 口径项（非债务）。流程债两项已于 0dae10a 销账（37 文件提交 + 杂物删除），不入 P35 范围。
- **tests**：纯文档建档，无生产代码/T2/T3 改动，门禁状态继承 P34-14 收口态：npm test 742/742、check-all 31 项 = 30 PASS / 0 FAIL / 1 SKIP（#15 本机无 Chrome；CI 31/0/0）。
- **risk**：① DEBT-1 属大任务，题面/答案文案变化必然触发全量重冻链（任务书 §5 已列防漏清单）；② DEBT-2/3/6/7 为人工签批项，签批前零动作；③ 本战役不开新审计面，任务外新发现问题只登记不顺手修；④ 未 git commit。

---

## P35-DEBT-1 · 难度执行端消费迁移：23 生成器统一接通 numberRange（2026-10-11）

- **modified**：
  - 生成器 12 文件（`shared/generator/generators/`）：`concept-meaning.js`、`percent.js`、`semantic-relations.js`、`decimal.js`、`fraction.js`、`counting.js`、`reasoning.js`、`picture-equation.js`、`money.js`、`application.js`、`position.js`、`shape.js`。统一新增 `nrOf(plan)`/`riC(rng, lo, hi, nr)`（语义边界与 numberRange 取交集，区间失效回退语义边界）；所有数值 `ri`/`randInt` 改为 `riC`；`plan.difficulty` 仅保留于 seed 派生与 `difficulty` 元数据字段，不再参与数值/结构决策。
  - 索引选择（`ri(rng,0,N)`、`Rng.pick`、固定数组场景）保持不变，不受 numberRange 约束。
  - concept-meaning 修复 builder 签名错位：`makeByItem` 以 `builder(rng, name, nr)` 调用，4 个 builder（buildCompositionItem/buildMakeTenItem/buildBracketOrderItem/buildStepwiseItem）签名由 `(rng, nr)` 统一为 `(rng, name, nr)`；`buildNumberConceptItem` 内部调用 `buildCompositionItem(rng, name, nr)`。
  - `dev/p32/check-answer-leak.js`：白名单 token 口径漂移对齐 11 处（g2-down-u02-k005 规律符号/颜色、g3-up-u02-k004、g4-down-u04-k004 人名、g5-down-u02-k003、g6-down-u01-k005 等数值 token 随 numberRange 变化）；新增 4 条（g1-down-u04-k005/apply、g6-up-u05-k005/choice、g1-up-u03-k001/choice L2、g5-down-u03-k001/fill L2）；计数 163→167。
  - 冻结产物重冻：`docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.{json,md}`（6b）、`docs/P30/.../kp-qt-maker-matrix.{json,md}`（6e）。
  - `shared/engine/strategy-engine.bundle.js` 重建。
- **deleted**：无。
- **reason**：DEBT-1——23 生成器中仅 8 个（arithmetic×5/selection×3）真实消费 `plan.constraints.numberRange`，其余或伪消费、或直接读 `plan.difficulty`、或零分化，导致题目数值不随难度分化。统一迁移到 Strategy 产出的结构化区间通道，Generator 不自决难度（Z1–Z4 不夺权）。语义边界为硬地板/天花板，numberRange 在此范围内伸缩。
- **tests**：
  - npm test 742/742 PASS。
  - `node dev/check-all.js` = 30 PASS / 0 FAIL / 1 SKIP（#15 本机无 Chrome）。
  - 分化探针验证：decimal 低[1.1,1.5]高[1.1,9.9]、fraction 低分母 3-4 高到 9、position gridSize 低 2 高 5、shape maxDim 随 nr.max 伸缩等。
- **risk**：
  - 数值变化触发全量重冻链（6b/6e 已重冻；answer-leak 白名单已对齐）；
  - stats（结构性固定，KP 决定 STAT_THEMES）与 composite（休眠不可达）未改，stats 豁免转 DEBT-5 取证；
  - 未 git commit。

---

## P35-FMT-01 · 阶段二 FMT：DEBT-5 stats apply/classify 同核分工修复 + DEBT-4 开放类讲解取证登记（2026-10-12）

- **modified**：
  - `shared/generator/generators/stats.js`：仅 `makeClassifyShape` 的 apply 分支三变式题面改写——清单改编号呈现（`1）…；2）…`）、引导句改「待整理的材料」、任务落在「用分类结果解决问题」（汇报各项数/比较最多最少/说明整理结果），与 classify 纯分类操作分工。答案/解析/data/steps 全部不变；classify/fill/judge/choice 分支未动（P32-AS-16 的「去结论自问自答」守卫注释保留）。
  - 重冻产物：`P28-GENERATION-MATRIX-FROZEN.{json,md}`（6b，1570 行 FAIL 0）；`P30-KP-QT-MAKER-MATRIX.{json,md}`（6e，**format 债务 8 行 → 0**，target=1236/target-frozen=334 不变）；`variation-profiles.json`/`misconception-profiles.json` 派生重跑；strategy bundle 重建。
  - 无代码改动（DEBT-4 纯取证登记，见 reason③）。
- **deleted**：无。
- **reason**：
  ① DEBT-5 取证结论：8 行/4 KP（math-g3-down-u05-k002、k004；math-g4-up-u06-k004；math-g5-up-u07-k001 的 apply+classify）病句**仍存**——apply 与 classify 共享「按「criterion」分类 + 同一清单」连续 3-gram，coreSim ≈ 0.9 > 0.85 被判同核 format。按任务书方案修 maker 题面（P32-AS-16E 守卫范式：改呈现与问法，不碰答案语义）。
  ② 修后实测 coreSim：4 KP 分别 0.600 / 0.650 / 0.645 / 0.696，全部 < 0.85；6e 矩阵 format 计数 8→0，债务清零。
  ③ DEBT-4 取证登记（样例 + 现状口径，不改代码）：
  - code-recognition apply（math-g3-up-u06-k001 数字编码）：题「厨房着火应拨打哪个电话，再说出生活中常见数字编码（至少 3 个）」，讲解「根据数字编码规则：应拨打 119；常见数字编码有身份证号码、邮政编码…」——规则结论复述，无逐步设计支架。
  - reasoning 数独场景（type=sudoku）：答案文本「（推理过程略）」，讲解「数独规则：每行、每列、每个宫格内的数字都不重复，从已知数最多的行、列或宫格入手，逐个排除确定空格」——规则结论复述。
  - reasoning 必胜策略场景（type=winning）：讲解为策略结论复述（对称策略/凑 5 策略/尼姆和策略各一句结论），无逐步演示。
  现状口径：三类讲解均为「规则结论复述」；是否需逐步支架由教学评审提具体要求后另立任务，AI 不编造。
- **tests**：coreSim 探针 4/4 < 0.85；`npm test` 全绿；`node dev/check-all.js` = 30 PASS / 0 FAIL / 1 SKIP（#15 本机无 Chrome）；6a 1570 行 FAIL 0；6g answer-leak 0 未登记。
- **risk**：① apply 题面文本变化（8 行），答案/难度/题型不变；旧题面在历史练习快照中不再重现，方向为题型分工修正；② DEBT-4 仅登记未修复，待教学评审；③ 未 git commit。

---

## P35-HUMAN-01 · 阶段三 HUMAN：H7（DEBT-2/3）+ H8（DEBT-6）请求单 + H1–H5 催办汇总提交（2026-10-12）

- **modified**：`docs/archive/phases/human-data-requests/README.md`——追加 H7（三视图/组合体图形表达裁决请求：DEBT-2 维持纯文字 vs 扩 descriptor；DEBT-3 g4-down-u02-k001 2 条组合体 cube 图 去图/改图/维持）、H8（13 条矩阵数据事实缺口请求单：扩题面模板·补 ALLOW vs 接受现状登记豁免白名单，附 13 行明细表）、「H1–H5 催办汇总」节（现状/阻塞面/建议处置）；汇总表追加 H7/H8 两行、H6 状态更新为已签批完成。零代码改动。
- **deleted**：无。
- **reason**：P35 任务书阶段三 HUMAN——DEBT-2/3 整理为裁决请求单、DEBT-6 整理为人工数据请求单 H8、DEBT-7 提交一页催办汇总；三份材料提交用户逐项签批，签批前 AI 零动作（P30 §2 T0 铁律：AI 不编造数据填补）。
- **tests**：无代码门禁（纯文档/请求单）；H8 明细与 P32-AS-16H 固化表逐行核对一致；H7 选项与 H6 已签批先例的论证（组合体配图泄题/三视图配图与文字重复）保持一致引用。
- **risk**：① 三份材料均待用户签批，阶段四 CLOSE 须在 H7/H8 处置闭环或显式维持现状后方可收口；② H1–H5 维持非阻塞口径，催办不构成阻塞；③ 未 git commit。

## P35-CLOSE-01 · 阶段四 CLOSE：DEBT-3 配套图形实施——view-cards 视图卡片新 subtype + cube 去标注（2026-10-12）

- **modified**：
  - `shared/svg/svg-geometry.js`：新增 `viewCards` 渲染器（`{views:[{direction:'front'|'top'|'left', grid:[[1,1],...]}], unitPx}`——每个视图画题设方格阵列（1=有正方形，浅填充）+ 下方方向中文标注，多视图横向排列；`finish`/svgWrap 自动 viewBox），挂 `SVGGeometry.viewCards` + kebab 别名 `SVGGeometry['view-cards']`（与 position-grid 别名先例一致），经既有 svg-registry seed 链自动解析 `geometry/view-cards` descriptor。
  - `shared/generator/generators/shape.js`：① `themedItemMeta` 新增对象直通分支——nums 第 4 元可直接给完整 descriptor 对象，深拷贝直通（避免多题共享引用被下游改写），图形标签回退链 `graphicLabelOf(d)`（由 params.views 方向推导「从前面、上面看到的形状」）→ `SHAPE_FEATURES[subtype].name` → KP 名；新增 `VIEW_DIR_CN`/`graphicLabelOf` helper。② `math-g4-down-u02-k001` nums 第 2 条（「从前面看是 2 个正方形…至少由____个小正方体组成」）shape 声明 'cube' → view-cards descriptor（front 1×2 横排 + top 1×2 横排方格，params.unit=cm/unitPx=25 满足 evidence 锚定）；第 3 条（「最少用____个…拼成大正方体」）'cube' → cube descriptor 对象（edge:3, labelSides:false 去棱长数字误导）；第 1 条 cuboid 与 judge/apply 行不动；题面/答案文案零变化。
  - `tests/presentation/svg-contract.test.js`：头部加载清单加 `shared/svg/svg-geometry.js`（registry seed 一次性的前置），新增 P35-CLOSE-01 用例（descriptor→SUCCESS、4 rect、方向中文标注）。
  - `tests/generation/p28-hollow-shape-themed.test.js`：新增 P35-CLOSE-01 用例（三题型 v=i%3 轮换各命中 1 次：view-cards descriptor 字段完整 + unit=cm + geometry 标签推导；cube labelSides:false + 标签「正方体」；cuboid 维持）。
  - 冻结产物重冻：`docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.{json,md}`（6b，1570 行 0 FAIL）、`docs/P30/.../kp-qt-maker-matrix.{json,md}`（6e）。
  - `shared/engine/strategy-engine.bundle.js`、`shared/engine/presentation-engine.bundle.js` 重建。
- **deleted**：无。
- **reason**：DEBT-3 销账——用户 2026-10-12 签批方案「知识点若需要配图考察，直接建配套使用的图形式生成」「好的，按这个方案执行」。目标 KP 2 条组合体条目原配单 cube 图错配（视图推算题画成品立体图与题设无关；拼大正方体题 cube 棱长标注误导）。新建 view-cards 配套图形：画题设视图（非组合体成品），学生须据此推算小正方体个数，不泄题（正面延续 H6「组合体配图泄题」论证）。SVG 只读 type/subtype/params 渲染，不反推题目；Generator 经 descriptor 直通决定图形语义（语义生成链 Intent→Generator→GraphicDescriptor 不变）。
- **tests**：定向测试 svg-contract 9/9、hollow-shape-themed 13/13；npm test 744/744 PASS（+2 新用例）；`node dev/check-all.js` = 30 PASS / 0 FAIL / 1 SKIP（#15 本机无 Chrome）；6b/6e 重冻 1570 行 0 FAIL；6g 泄露门禁 PASS；layout.js 零改动（geometry 类型默认 medium 档位自动覆盖 view-cards，双卡 150×68px 实测合档）。
- **risk**：① judge/apply 行沿用 qMeta 派生 flat 族图（circle/square），与题面语义弱相关——系本 KP 既有形态（NO_GRAPHIC_VIEW_KPS 仅覆盖 k002/g5 两 KP，H6 签批口径未含本 KP judge/apply），本任务按签批方案不扩大，登记待后续裁决；② choice/fill 各产出 1 题（count=3 下既有去重行为，改前改后一致）；③ 未 git commit。

## P35-FINAL · 战役冻结：四阶段全过门，DEBT-1…8 全部闭环（2026-10-12）

- **modified**：`docs/P35/P35-TASK-BOOK.md`——状态行改「P35-FINAL 已冻结」；DEBT-2 节标已销账（H7 选 A 维持纯文字）、DEBT-3 节标已销账（P35-CLOSE-01 配套图形实施），清理签批前方案残留文字。零代码改动。
- **deleted**：无。
- **reason**：用户 2026-10-12 显式确认阶段四 CLOSE 过门（「好的，确认阶段四 CLOSE 过门」）。四阶段过门链：一 DIFF（P35-DEBT-1，12 生成器接通 numberRange）→ 二 FMT（P35-FMT-01，stats format 8→0 + DEBT-4 取证登记）→ 三 HUMAN（P35-HUMAN-01，H7/H8 请求单 + H1–H5 催办；签批 H7-DEBT2=A、H7-DEBT3=配套图形、H8=B 豁免登记）→ 四 CLOSE（P35-CLOSE-01，DEBT-3 view-cards 配套图形）。DEBT 终态：1 修复 / 2 维持销账 / 3 修复 / 4 取证登记 / 5 修复 / 6 豁免登记销账 / 7 催办提交（非阻塞）/ 8 口径登记。
- **tests**：收口态继承 P35-CLOSE-01 门禁证据：npm test 744/744 PASS；`node dev/check-all.js` = 30 PASS / 0 FAIL / 1 SKIP（#15 本机无 Chrome；CI 31/0/0）；6b/6e 重冻 1570 行 0 FAIL；6g PASS；375/98/373/1570 基线全程未动。
- **risk**：① 遗留登记不遮盖——DEBT-4 开放设计类讲解深度（待教学评审提要求后另立任务）、g4-down-u02-k001 judge/apply 配图弱相关（待裁决）、H1–H5 人工请求未决（非阻塞催办态）；② 全部改动未 git commit，等用户显式指令。

## 历史战役日志索引（append-only，不改写）

- `docs/P34/change-log.md`：P34 波次 1/2/3 + H1（题目语义/表述产品化修复，842 题真讲解清零，HEAD=0dae10a 入库）
- `docs/P33/change-log.md`：文档与基线对齐 + 性能 SCAN 裁决（P33-FINAL 已入库）
- `docs/P32/change-log.md`：答案系统收口（P32-FINAL；遗留：13 条矩阵缺口转 DEBT-6、stats format 债务转 DEBT-5）
- `docs/P31/change-log.md`、`docs/P30/change-log.md`、`docs/P28/`：已冻结战役档案
