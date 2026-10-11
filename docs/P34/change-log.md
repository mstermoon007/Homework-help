# P34 变更日志（数据正确性战役 · 波次 1/2/3）

> append-only，最新在上。六字段：任务号+日期 / modified / deleted / reason / tests / risk。
> 战役性质：P32-FINAL 后的题目语义/表述产品化修复。波次 1（P34-01…06）、波次 2（P34-07…11）、H6 三视图去图（P34-H1）已冻结；波次 3（解析质量/变式/算术 calc/难度）用户 2026-10-11 批准，原则「未解决问题继续保留，不要遮盖」。
> 约束：原地修改既有源文件，不新建层/模块/后处理。

---

## P34-14 · 842 题无解析清零：15 生成器逐 maker 补真讲解（波次 3⑪ 第三批收口，2026-10-11）

- **modified**（15 个生成器源文件，仅填 `answer.explanation`，题面 prompt / answer.value / data 零改动）：
  - `shared/generator/generators/shape.js`、`stats.js`、`position.js`、`application.js`（波次内先期完成，359/151/119/109 全 real）
  - `shared/generator/generators/decimal.js`、`fraction.js`、`money.js`（96/80/50）：各 typed/maker 出口挂 explanation——小数按「小数点对齐/先按整数乘法/各部分关系/四舍五入/进率」等本题型算法，分数按「同分母分子相加减/先通分/除以分数等于乘倒数/约分/倒数」等算法短句 + 完整演算（修复首轮 fraction 式10：纯算式讲解汉字<4，统一给 calcItem 传算法 why）；人民币/单位换算给进率与情境列式
  - `shared/generator/generators/reasoning.js`（43）：makeTable789Question 口诀/求商/各部分关系讲解；makeReasoningQuestion 各 type（抽屉/最值/鸡兔假设法/植树/找次品三分法/握手组合/数独规则/必胜策略/烙饼统筹/数列规律/三人逻辑）逐分支用**代码内既有常量与答案**构造解题模型讲解；calc 分支补口诀/规律算法；choice 出口统一「…，正确选项是「X」。」（X=选项文本），fill 出口「…，所以空格填 X。」
  - `shared/generator/generators/semantic-special.js`（code-recognition 15）：CODE_BANK 的 item.a 本身即编码规则完整结论（身份证分段/邮编 6 位含义/特殊电话/编码四性），按题型复述——choice「按数字编码规则判断，正确选项是「X」」、fill「由编码规则可知，空格填 X」、apply「根据数字编码规则：X」
  - `shared/generator/generators/counting.js`（3）：搭配（水果×饮料）乘法原理讲解；`picture-equation.js`（3）：大括号图两部分合并用加法；`selection.js`（2 实缺 + 全分支）：按 structure.operators 给加合/去部/同数连加/想乘求除意义 + 算式 = 得数；`arithmetic.js`（mixed geometry 3）：makeFractionMultiplyGeometryQuestion 三分支（求一个数的几分之几/乘法分配律线段模型/连续求一个数的几分之几找准单位「1」）补分率列式讲解
  - `shared/generator/generators/concept-meaning.js`（7）：finishChoice 增加 explanation 参（缺省 null，其余调用行为不变）；倍数 choice（「a 的 b 倍」= b 个 a，用乘法）、面积单位 fill/choice、角定义 choice、分数单位 choice（分数单位由分母决定）补讲解
  - `shared/generator/generators/semantic-relations.js`（10）：finishChoice 增加 explanation 参；7 个 choice maker（线段图合并/周期余数定位/图形缩放/正比例归一/比例尺实际距离/解比例内项积=外项积/比例的意义两积相等）逐一补方法讲解并指认正确选项
  - `shared/engine/strategy-engine.bundle.js`（重建，16/17 确定性 PASS）
  - T2 重冻：variation-profiles.json / misconception-profiles.json（派生器复跑，生成失败 0）、golden-questions.json（两段式：覆盖 268 → 补漏 846，总 **1114 题 / 15 族**）、P28-GENERATION-MATRIX-FROZEN、P28-GENERATOR-MATRIX、P30 maker 矩阵（三 --write，FAIL 0）
- **deleted**：无
- **reason**：P34-13 收紧总闸后登记的 842 题 explanation=null 是诚实缺失（提交后不显示解析），但缺口本身需补齐。本任务立「只填 explanation」单一最小范围：讲解素材一律取自题目自身可确定信息——生成器已知 answer/data、代码内既有常量（DRAWER/DEFECT/SEQ/WIN/CODE_BANK/模板 ops）与教材级算法规则（运算意义、进率、口诀、假设法、抽屉原理等），**不读任何题外数据、不新造教学语义 JSON、不手编 T2**；choice 正确答案词取选项文本/correctExpr 而非 correctIndex。纯算式前补算法/意义短句以满足「真讲解」口径（汉字≥4），杜绝 formula-only 回潮
- **tests**：质量探针 `/tmp/p34-exp-bygen.js`（1570 ALLOW 行）——**修复前 空842/真728（P34-13 收口态），修复后 20 个生成器合计 总1570 尾0 式0 空0 真1570**，无一条 explanation=null；tests/generation 定向 **326/326**（含 reasoning/counting/picture/selection/arithmetic/concept/semantic/code 相关断言）；npm test **742/742**；6a verify:allow-gen **1570 PASS / 0 FAIL**；6b/6c/6e 重冻复核 FAIL 0；6g PASS（L1 命中 136 全白名单、L2 渲染 538 全 SUCCESS、**L3a html-renderer 零读取 explanation**、自判回放 TRUE 1485/FALSE 0/NULL 85 仅 apply/geometry）；题面/value/data 零变化；check-all **30 PASS / 0 FAIL / 1 SKIP**（#15 本机无 Chrome）
- **risk（未解决问题继续保留，不遮盖）**：
  ① 讲解为题内素材的机械复述（算法名 + 代入演算 + 结论），个性化错因诊断不在本任务范围；开放设计类（code apply 编码方案设计、数独/必胜策略）答案文本自身含规则结论，讲解复述该结论而非逐步演示，若教学评审认为需更强支架再立任务，不编造。
  ② P34-13 risk②「难度执行端消费审计」（concept/stats/semantic 不消费 numberRange）维持登记，冻结难度公式不动；P34-13 risk⑤（g4-down-u02-k001 组合体配 cube 图 2 条）、⑥（P32 遗留 13 条人工挂账）原样保留，未顺手修。
  ③ explanation 仍只走提交后通道：screen/print 答题前零携带，L3a 源码守卫持续 PASS。
  ④ 未 git commit。

## P34-13 · 解析冒充根治 + 5 族真讲解（波次 3⑪ 第二批收口，2026-10-11）

- **modified**：
  - `shared/generation/api.js`（D004 汇聚兜底收紧）：原 `explanation==null` 时无条件 `prompt.replace(/=\s*\?$/,' = '+v)`，对不以「= ?」结尾的题面（问句/情境/填空）replace 不命中，**原题面（含问号）被原样当 explanation**——这是全库 question-tail（题面复述）的总根因。改为仅对真正完整算式尾「…= ?/？」补「…= 得数」演算，其余保持 null（提交后通道按「缺失即 null」不显示解析），绝不用题面冒充
  - `shared/generator/generators/concept-meaning.js`：makeByItem 末段不再把 prompt 原文当第 5 参，改为「陈述式题面（去参考括号/疑问尾）+ 答案 + 独立概念结论（item.answer 异于答案时附「；结论」）」；choice 分支写「正确选项是「X」」；倍数 fill/apply 裸算式补「求一个数的几倍是多少，用乘法」
  - `shared/generator/generators/percent.js`：finish 不再用题面拼裸算式；9 个 maker（求百分之几/小数↔百分数/分数↔百分数互化/折扣/利率/达标率/增产降价/税率/成数/生活百分）的 calc 及共用 expl 补该课**公式名称**（求一个数的百分之几用乘法、利息=本金×利率×时间、达标率=达标人数÷总人数×100%、应纳税额=收入×税率 等，素材均取自各题既有 data/base/rate/principal）
  - `shared/generator/generators/semantic-relations.js`：finish 默认不再 `prompt+ ' = '+answer` 机械拼接（改 null）；线段图合并/周期定位（有余数除法）/解比例（内项积=外项积）/图形缩放/比例尺求实际与图上距离等裸演算 expl 补方法名
  - `shared/generator/generators/application.js`：新增 OP_MEANING（与 arithmetic 同口径运算意义）；calc 题 answer 由标量改为对象并带「运算意义：算式=得数」讲解（素材取 PROBLEM_TEMPLATES.ops），fill/apply 不动
  - `shared/engine/strategy-engine.bundle.js`（重建，16/17 确定性 PASS）
  - T2 重冻：variation-profiles.json / misconception-profiles.json（派生器复跑，生成失败 0）、golden-questions.json（两段式 1114 题/15 族）、P28-GENERATION-MATRIX-FROZEN、P28-GENERATOR-MATRIX、P30 maker 矩阵（三 --write，FAIL 0）
- **deleted**：无
- **reason**：波次 3⑪取证（4710 题）实锤 2246 题（47.7%）解析无教学内容，其中 question-tail 1573 的总根因是 api.js 汇聚层无条件抄题面（生成器写 null 即被顶替），formula-only 673 来自生成器自写裸算式。本批先收紧总闸使「题面冒充」清零，再对**有确定算式/公式素材**的 5 族（arithmetic 已在 P34-12，本批 concept/percent/semantic/application-calc）用既有 structure/data 素材补真讲解；纯概念指认题无可靠公式素材，不编造教学语义（T2 铁律），保留缺失
- **tests**：1570 行 ALLOW 口径质量探针——修复前 question-tail/formula-only 遍布（4710 口径 2246 假解析），修复后**尾 0 / 式 0 / 真讲解 728 / explanation=null 842（诚实缺失，非假冒）**；percent 44/44、arithmetic 251/251 全 real；npm test **742/742**；6a 1570 对 PASS 1570/FAIL 0；6g PASS（L1 命中 136 全白名单、L2 渲染 538 全 SUCCESS、L3a html-renderer 零读取 explanation、自判回放 TRUE 1485/FALSE 0/NULL 85 仅 apply/geometry）；题面/答案 value 零变化，去重指纹与 6b FAIL 0；check-all **30 PASS / 0 FAIL / 1 SKIP**（#15 无 Chrome）
- **risk（未解决问题继续保留，不遮盖）**：
  ① **842 题 explanation=null（提交后不显示解析），按生成器登记**：shape-recognition 292、stats 118、position-direction 97、application-word fill/apply/choice 96、decimal-number 62、fraction-number 48、money-measurement 44、reasoning 42、code-recognition 15、semantic-relations choice 10、concept-meaning 7、arithmetic-mixed 3（含 makeFractionMultiplyGeometryQuestion 3 条分数乘法 geometry，answer 无 explanation 且提前 continue）、counting 3、picture-equation 3、selection-fill 2。多为图形/统计/方位/概念的**选择与指认题**，生成器从不写讲解且无算式/公式素材；补齐需逐 maker 依据 T2 几何定义/统计概念构造，属独立教学语义工程，立 **P34-14 候选**，本轮不编造、不扩大。
  ② **⑫ 难度执行端消费审计（登记保留，不改冻结难度公式）**：难度值（practice 1–10 → sq.difficulty 1–5）传导正确，但 concept-meaning/stats/semantic-relations 等生成器不消费 plan.constraints.numberRange，题目内容不随难度分化；算术链已有正式 NumberRangeStrategy。属「执行端消费」大任务，冻结公式不动。
  ③ ③ arithmetic calc「纯算式观感」与⑪同源：算术/百分数 calc 已由运算意义讲解覆盖，无独立缺陷。
  ④ ⑧ 变式分化取证不可复现（1225 个 count=3 行全部三题互异，0 全同/0 仅 2 异），关闭。
  ⑤ g4-down-u02-k001 的 2 条组合体条目仍配 cube 图（无 T2 锚定，历史登记，不顺手修）。
  ⑥ P32 遗留 13 条矩阵数据事实缺口（人工挂账）不变。
  ⑦ 未 git commit。

## P34-12 · 算术族 5 生成器解析真讲解（波次 3⑪ 第一批，2026-10-11）

- **modified**：
  - `shared/generator/generators/arithmetic.js`：新增 OP_MEANING 运算意义词表（加/减/乘/除/混合的教学含义）；generate 内四题型分型构造 explanationText——calc=运算意义+完整演算、fill=先指认空格再代入验证、apply=情境→运算意义→列式、choice=指认正确算式+验算；替换原 L316 `prompt.replace(' = ?',' = '+answer)` 统一抄题面（calc 变裸算式、fill 留「填空：____」病句、apply/choice 留问号尾）
  - `shared/engine/strategy-engine.bundle.js`（重建）
  - T2 重冻：golden-questions.json（两段式，answer 字段含 explanation；1114 题/15 族）、variation/misconception 派生器复跑、三矩阵 --write
- **deleted**：无
- **reason**：波次 3⑪取证（4710 题全量分档）：arithmetic-addition/subtraction/multiplication/division/mixed-calculation 5 生成器 251 题 explanation 全部为「题面复述（问号尾）或裸算式」，解析零教学内容；该 5 生成器共享 arithmetic.js 同一赋值点，属一个根因。修复用生成器既有 structure 素材（operands/operators/op）构造讲解，与题面文案同层，非新教学语义数据
- **tests**：质量探针复测 5 生成器 251/251 全部转 real（尾 0/式 0）；npm test **742/742**（无旧形态断言）；6a 1570 FAIL 0；6g L1/L2/L3 未登记 0（explanation 仍走提交后通道，L3a html-renderer 零读取断言 PASS）；题面/答案 value 零变化故去重指纹与 6b 矩阵 FAIL 0；check-all **30 PASS / 0 FAIL / 1 SKIP**
- **risk**：① makeFractionMultiplyGeometryQuestion（mixed 的 g6 分数乘法 geometry 3 KP）answer 无 explanation 且提前 continue，不属本根因点，未动（登记 P34-13 候选）；② 讲解为运算意义通用陈述，具体情境的个性化说理留给后续生成器；③ 未 git commit

## P34-H1 · 三视图/搭建推算 3 KP 去图执行（人工请求 H6 签批，2026-10-08）

- **modified**：
  - `kbl/teaching/evidence-rules.json`：3 KP（g4-down-u02-k002/g5-down-u01-k001/g5-down-u01-k002）× 5 题型 15 行 required 删除 58 条 `data.graphic.*` 锚定，保留 mode/steps/shapeName=立体图形；note 追加 H6 签批溯源
  - `kbl/teaching/qt-intent.json`：3 行 geometry 的 assessment 由 graphicRole=carrier/allowedRepresentations=["graphic"] 改为 null/["numeric"]（执行中发现的第二道图形强制——KpSemantic checkIntentAlignment 对 carrier 强制有图；同一签批意图的必要配套，已回写请求单 README 备案）；其余 12 行 auxiliary 不动
  - `shared/generator/generators/shape.js`：新增 NO_GRAPHIC_VIEW_KPS 键查表（值=1 去图标记）；makeThemedShapeQuestion 对 3 KP 五题型输出 graphic=null，choice/fill 条目图形覆盖加 !noGraphic 守卫；geometry 纯文字引导「想一想，填一填：」（设问本体零改动）
  - `tests/generation/p28-hollow-shape-themed.test.js`：3 KP 断言随 H6 签批证据重写为 graphic 显式 null + geometry 无「观察下图」+ shapeName 保留，其余 67 KP 图形在场断言不动
  - `dev/check-kbl-uniqueness.js`：补 NO_GRAPHIC_VIEW_KPS 剥离规则（与 TEACHING_DENIALS/STAT_SHAPE/SHAPE_THEME 四既有「ID 引用键查表」判例同型，值=1 无 canonical 载荷）
  - `docs/archive/phases/human-data-requests/README.md`（H6 状态标已签批执行 + qt-intent 配套补记）
  - T2 重冻产物：variation-profiles.json / misconception-profiles.json / golden-questions.json（两段式，1114 题/15 族）；docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.{json,md}、P28-GENERATOR-MATRIX.{json,md}、P30 maker 矩阵
  - `shared/engine/strategy-engine.bundle.js`（重建）
- **deleted**：无
- **reason**：用户 2026-10-08「批准，按请求单执行」（人工数据请求 H6 签批，显式指令覆盖 T2 手编限制的依据留存于请求单与本条 reason）；15 行题面文字自含视图数据，cuboid 配图图文错配，组合体配图泄题（数方块即得答案）、三视图配图与文字重复，标准练习册形态为纯文字无图
- **tests**：定向（shape-themed + p25-07 type-contracts）42/42；npm test **742/742**；6a 1570 行 PASS 1570 / FAIL 0；6b 矩阵 1570/1570 FAIL 0；6c 23 Generator FAIL 0；6e maker 矩阵重冻 PASS；6g L1 未登记 0、L2 渲染 553→**538**（正好减 15 图）/未登记 0；check-all **30 PASS / 0 FAIL / 1 SKIP**（#15 无 Chrome 属正常）
- **risk**：① geometry 题型出现全库首批 3 行纯文字形态（前无先例），契约 graphicOrInstruction 与教学形态已论证、全门禁验证通过；② g4-down-u02-k001 的 2 条组合体条目无 T2 锚定，去图不经 T2，按请求单明确排除、另立任务登记（不顺手修，红线 #9）；③ 题面设问本体/答案零变化，6a/6b 指纹 FAIL 0；④ 未 git commit

## P34-H1-REQ · 三视图图形锚定删除人工数据请求单（2026-10-08）

- **modified**：`docs/archive/phases/human-data-requests/README.md`（追加 H6 节 + 汇总表一行）；新建 `docs/archive/phases/human-data-requests/p34-h1-view-graphic-anchor-removal-15.csv`（15 行明细）
- **deleted**：无
- **reason**：挂账②裁决调研后用户批准方案 B（文字三视图去图）；3 KP（g4-down-u02-k002 由平面到立体 / g5-down-u01-k001 从不同角度观察立体图形 / g5-down-u01-k002 根据平面视图搭建立体图形）× 5 题型共 15 行 evidence-rules 硬锚定 data.graphic 系列字段，T2 铁律下 AI 不得手编，须人工教学评审授权后按签批执行；已核实去图后 graphicOrInstruction 由保留的 data.shapeName 满足
- **tests**：纯文档/数据请求单，无代码变更，门禁状态不变（30 PASS / 0 FAIL / 1 SKIP）；CSV 行数校验 15；KP 名与 evidence-rules.knowledgePointName 逐一核对
- **risk**：零运行时风险（未改任何生产代码/T2/T3）；评审若驳回则维持现状（挂账继续登记）；g3-up-u01-k002/g3-up-u01-k003/g4-down-u02-k001 三同族 KP 已在请求单中明确排除，不扩大范围

## P34-CLOSE-2 · 波次 2 收口（2026-10-08）

- **modified**：`shared/engine/strategy-engine.bundle.js`（重建）；`kbl/teaching/variation-profiles.json`、`kbl/teaching/misconception-profiles.json`（派生器重跑）；`kbl/teaching/golden-questions.json`（两段式重建 1114 题/15 族）；`docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.{json,md}`、`docs/archive/phases/p28/P28-GENERATOR-MATRIX.{json,md}`、P30 maker 矩阵产物（三矩阵 --write 重冻）
- **deleted**：无
- **reason**：P34-07/08 题面改动（shape.js 去 KP 名机械前缀、geometry 标签实例化、type-contract 任务动词扩面）触发既定重冻链
- **tests**：npm test 742/742；6a 1570 对 FAIL 0；6g PASS（L1/L2 未登记 0）；三矩阵重冻 FAIL 0；check-all **30 PASS / 0 FAIL / 1 SKIP**
- **risk**：type-contract 的 TASK_VERB_RE 扩面为全局 apply contextPresent 口径放宽（新增动词均为教学任务动词，未放松为无语义词）；冻结测试 p28-hollow-shape-themed L115 断言按用户批准 A 方案随模型重写（KP 名机械前缀 → 无前缀+概念要素），复现题即本批抽样

## P34-08 · geometry 标签实例化（抽象概念 KP 图文对齐）（2026-10-08）

- **modified**：`shared/generator/generators/shape.js`（makeThemedShapeQuestion geometry 分支）：标签在 qMeta.legacyType 为 symmetry/solid 时取实际配图实例名（data.graphic.subtype → SHAPE_FEATURES 名），不再输出「观察下图（轴对称图形）/（立体图形）」却画长方形/长方体盒子
- **deleted**：无
- **reason**：原缺陷——抽象概念 KP 的 geometry 标签用概念名，配图走 generateGraphicParams default 画 rectangle/cuboid，标签与配图脱节
- **tests**：抽样复验标签与 graphic.subtype 一致；npm test 742/742；6a PASS
- **risk**：登记未决——g5-down-u01-k001 题面设问「多小正方体三视图」配 cuboid 单盒图仍非该教学模型的完整表达；T2 证据规则锚定 subtype=cuboid 不可换图，扩 GraphicDescriptor 表达三视图/组合体属结构变更（红线），挂账待用户裁决，本轮不动

## P34-07 · 去除 shape themed 题面 KP 名机械前缀（2026-10-08）

- **modified**：`shared/generator/generators/shape.js`：makeThemedShapeQuestion 的 choice/judge/fill/apply 四分支与 makeGeometryApplyQuestion 立体特征分支删除 `name + '：'` 机械前缀（judge explanation 中保留 name 作讲解语义）；`shared/generator/core/type-contract.js`：TASK_VERB_RE 补入 shape apply 场景实际任务动词（量出/画出/说一说/密铺/剪开/指出 等 20+）；`tests/generation/p28-hollow-shape-themed.test.js`：L115 冻结断言按用户批准 A 方案重写（题面不得 startsWith `KP名：` + 概念要素在场）
- **deleted**：无
- **reason**：原缺陷——「分类的含义：…」「从不同方向观察物体：…」等 KP 名机械拼入题首，是模板痕迹而非教学语言；去前缀后部分 apply 题短于 contextPresent 检测口径，补任务动词白名单为同口径修复
- **tests**：p28-hollow-shape-themed 全绿（283 行 maker 断言 + E2E）；npm test 742/742；6a PASS
- **risk**：测试断言模型变更已经用户显式批准（A 方案）；TASK_VERB_RE 为全局共享正则，已随全量 742 测试验证无放宽副作用

## P34-CLOSE-3 · 波次外登记候选清理（2026-10-08）

- **modified**：`shared/generator/generators/shape.js`、`shared/generator/generators/concept-meaning.js`、`shared/engine/strategy-engine.bundle.js`（重建）；T2 三件套（variation/misconception 重跑、golden 两段式重建 1114/15）；三矩阵 --write 重冻
- **deleted**：无
- **reason**：用户将波次 1 登记的 4 条候选发回复核，重新取证后处置（见 P34-09/10/11 与 P34-08 risk 挂账）
- **tests**：npm test 742/742；6a 1570 FAIL 0；6g 未登记 0；check-all **30 PASS / 0 FAIL / 1 SKIP**
- **risk**：无新增风险项；②图形表达能力缺口仍挂账

## P34-11 · flat 认图 choice 干扰项类型修正（2026-10-08）

- **modified**：`shared/generator/generators/shape.js`（makeRecognitionQuestion）：干扰项由 examples 物品名（平行四边形→「推拉窗」、圆→「硬币」）改为 FALSE_FEATURE_POOL 恒假特征陈述（有 5/7/10 条边、有 5/7 个角），rng 洗牌取 3
- **deleted**：examples → 干扰项的消费路径（examples 字段保留，仍为 SHAPE_FEATURES 教学素材，仅不再当选项）
- **reason**：原缺陷——正确项是特征句（「到圆心距离相等」），干扰项却是物品名，选项类型不一致；恒假池对 flat 族五图形均为假且同为特征陈述，与 P34-02 同口径
- **tests**：定向生成复验选项全为特征陈述；npm test 742/742；6a PASS
- **risk**：低；makeClassificationQuestion（图形名选项）分支类型本就一致，未动

## P34-10 · 因数 fill 双空接受因数对逆序（2026-10-08）

- **modified**：`shared/generator/generators/concept-meaning.js`：makeByItem 增 item.fillAcceptable 通道（与 fillAnswer 同型，extraAcceptable 在最终 answer 确定后并入 finish，经 P32-AS-11 过滤）；buildNumberTheoryItem（g5-down-u02-k001）fill 声明 `fillAcceptable:[fb+' 和 '+fa]`
- **deleted**：无
- **reason**：取证确认双空「__ 和 __ 是 fp 的因数」教学形式正确，真缺陷是判分——因数对无序，学生逆序填「7 和 3」原被判错（归一仅去空格不换序）
- **tests**：gradeUserAnswer 定向验证：正序/逆序/无空格均 true、错误值 false；npm test 742/742；6a/6g PASS
- **risk**：低；通道为可选字段，其余 builder 不声明时行为零变化；k002 fill 为单空单值不涉及

## P34-09 · 轴对称对称轴设问与长方形配图锚定（2026-10-08）

- **modified**：`shared/generator/generators/shape.js`（SHAPE_THEME['math-g3-down-u01-k001'] nums）：三条改为「长方形有__条（2）／长方形有 2 条对称轴，正方形有__条（4）／…等腰三角形有__条（1）」，均以长方形起句
- **deleted**：无
- **reason**：波次 2 P34-08 修了标签但取证发现设问对象仍与配图错位（问正方形/等腰三角形却画长方形）；T2 证据规则 fill/choice/geometry 三行均硬锚定 data.graphic.subtype=rectangle，图形不可换，只能让题面锚定长方形；对比句保留原三知识点且答案 2/4/1 互异保 count=3 指纹
- **tests**：定向复验三题型题面含长方形、答案与 rectangle 配图一致；npm test 742/742；6a PASS
- **risk**：低；仅动单 KP nums 三条文本，judge facts 原含「长方形 2 条、正方形 4 条」对比口径一致

## P34-CLOSE · 波次 1 收口（2026-10-08）

- **modified**：`shared/engine/strategy-engine.bundle.js`（重建）；`dev/p32/check-answer-leak.js`（WHITELIST 登记 1 条）；`kbl/teaching/variation-profiles.json`、`kbl/teaching/misconception-profiles.json`（派生器重跑）；`kbl/teaching/golden-questions.json`（两段式重建 1114 题/15 族）；`docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.{json,md}`、`docs/archive/phases/p28/P28-GENERATOR-MATRIX.{json,md}`、P30 maker 矩阵产物（三矩阵 --write 重冻）
- **deleted**：无
- **reason**：P34-01…06 源码修改后的既定重冻链——bundle 重建（E2E 走 bundle）、6g L2 巧合登记（math-g4-down-u02-k001/fill token=3，GRAPHIC-COINCIDENCE 桶：答案 3=同时看到的面数，SVG 边长标签 3cm=cuboid 边长语义无关）、calc 行变化触发变式/迷思派生器与金题集重跑、1570 行产物重冻
- **tests**：6g 泄露门禁 PASS（L1 未登记 0 / L2 未登记 0，渲染 553 SUCCESS 0 UNSUPPORTED）；6a verify:allow-gen PASS（1570 对 / FAIL 0）；矩阵重冻 FAIL rows=0、23 Generator FAIL 0、maker 矩阵 1570 行冻结；check-all **30 PASS / 0 FAIL / 1 SKIP**（#15 无 Chrome SKIP）
- **risk**：金题集重建后 total 1114 / 15 族与重建前一致，但 k001 附近行答案/题面已随源码更新，属预期漂移

## P34-06 · 负数读写分离（2026-10-08）

- **modified**：`shared/generator/generators/concept-meaning.js`（buildNegativeItem 读写分支）：calc/fill 改答数值「−5」（0 − 5 = ____），choice/apply 保留读法作答（答「负五」）；stem 保留（choice ctxSrc 回退仍消费）
- **deleted**：无
- **reason**：原缺陷——calc/fill 题面问「读作什么」但答案为数值口径混乱，读写两能力混在单一作答中；分离后 calc/fill 考写、choice/apply 考读
- **tests**：真实生成抽样验证（calc/fill 答数值 −5，apply/choice 答读法）；npm test 全绿；6a PASS
- **risk**：低

## P34-05 · 因数和倍数题面重构 + calc/fillAnswer 分型机制（2026-10-08）

- **modified**：`shared/generator/generators/concept-meaning.js`：① makeByItem calc 分支消费 `item.calc||item.stem` 与 `item.calcAnswer`，fill 分支消费 `item.fillAnswer`（与 applyAnswer 同型）；② buildNumberTheoryItem（g5-down-u02-k001 因数和倍数）题面重构：calc 改直问求积式「两个乘数都是积的因数：7 × 8 = ？（积的因数就是这两个乘数）」，choice/fill/apply 保留月饼装盒情境
- **deleted**：buildNumberTheoryItem 的 stem 分支（calc 行不再回落 stem，物理删除该复用路径）
- **reason**：原缺陷——calc 行以 6g L1 真泄露题面「56 ÷ 7 = ?」把答案 8 写进支架（AS-16 原则违背，不可白名单）；改为求积式后逐枚举 21 种 (fa,fb) 组合验证 fp 不出现在 fa×fb 题面
- **tests**：6g PASS；p28-hollow-plan1-native ROWS 断言（k001 calc 题面 /因数|倍数/）通过；npm test 全绿；6a PASS
- **risk**：makeByItem 分型机制为既有 item 字段消费约定，未引入新字段

## P34-04 · 概念题选项凑位去「都不是」（2026-10-08）

- **modified**：`shared/generator/generators/concept-meaning.js`（finishChoice）：凑位池不足 4 时按序取 FILLERS `['以上说法都不对','以上都对']` 兜底，不再生成空占位
- **deleted**：无
- **reason**：原缺陷——40 题抽样出现「都不是」凑位选项，语义空洞误导判断
- **tests**：真实生成抽样验证（「都不是」指纹归零）；npm test 全绿；6a PASS
- **risk**：低

## P34-03 · 观察物体图形与题面指代对齐（2026-10-08）

- **modified**：`shared/generator/generators/shape.js`：① shapeTheme nums 映射增加 `shape: x[3] || null` 通道；② 新增 themedItemMeta（item.shape 与 qMeta.subtype 不同且在 SHAPE_FEATURES 时产出独立 meta+graphic，choice/fill/geometry 三分支消费，覆盖 data.graphic 与题面图形名标签）；③ nums 标记：g3-up-u01-k002（cube/cuboid/cuboid）、g3-up-u01-k003（cube×3，与既有行为一致）、g4-down-u02-k001（cuboid/cube/cube——原始缺陷 KP）；g4-down-u02-k002、g5-down-u01-k001、g5-down-u01-k002 回退标签（证据规则锚定 subtype=cuboid，T2 冻结口径，留注释）
- **deleted**：无
- **reason**：原缺陷——「观察下图（正方体）」配图却画长方体/圆柱，图形与题面指代不一致；无锚定的 KP 保留标签，有锚定的回退避免 KpSemantic FAIL
- **tests**：p28-hollow-shape-themed KpSemantic 抽样通过（generation 域 326/326）；npm test 全绿；6a PASS
- **risk**：登记候选——g5-down-u01-k001「观察下图（立体图形）」cuboid 配小正方体设问为 T2 冻结现状，不在本波次处置

## P34-02 · 形状特征 choice 干扰项改恒假池（2026-10-08）

- **modified**：`shared/generator/generators/shape.js`：choice 凑位干扰项改为引用 FALSE_FEATURE_POOL（`['有5条边','有5个角','有7条边','有7个角','有10条边']`）
- **deleted**：无
- **reason**：原缺陷——judge/choice 出现「平行四边形有 4 个直角」类真特征当干扰项，干扰项与正确项冲突；17 族图形中无任何图形有 5/7/10 条边或 5/7 个角，对所有图形恒为假，且与各 features 字符串零重合
- **tests**：真实生成抽样验证（judge「有5个角」→False 正常判假）；npm test 全绿；6a PASS
- **risk**：登记候选——makeRecognitionQuestion 用 examples（推拉窗等物品名）当特征干扰项，类型不一致，波次外登记不顺手修

## P34-01 · 平行四边形特征修正（2026-10-08）

- **modified**：`shared/generator/generators/shape.js`（L72-74）：平行四边形特征 `'对角互补'` → `'有四条边和四个角'`
- **deleted**：无
- **reason**：原缺陷——对角互补为初中性质，且与同族其它图形特征表不构成可区分的真特征；低年级可感知真特征替代
- **tests**：真实生成抽样验证（choice 正确项「有四条边和四个角」）；npm test 全绿；6a PASS
- **risk**：登记候选——轴对称图形「观察下图（轴对称图形）」（g3-down-u01-k001）同类指代缺陷，波次外登记不顺手修
