# P28-Generator-Matrix — Generator Registry 收口

| 项 | 值 |
|---|---|
| 任务 | P28-09 Generator Registry 收口：31 个 Generator 逐个澄清 生产使用/测试使用/历史使用/重复能力/legacy capability，并强制声明 id · semantic family · supported question types · input contract · output contract · validator · production status |
| 执行日期 | 2026-09-22 |
| 判定规则 | R1 覆盖 / R2 题型=registry / R3 声明完整 / R4 产出⊆声明 / R5 状态一致 / R6 无 legacy（统一门禁 `node dev/p28/check-generator-matrix.js`） |

## 1. 收口结论

**24 个 Generator · PRODUCTION=21 · COMBINE-ONLY=1 · DORMANT-CARRIER=2 · DORMANT-NO-BINDING=0 —— 收口冻结 ✅**

冻结证据：1570 行真实生成（P28-08）中，实际承载行合计 = 1570；历史使用集中在 `archive/legacy-tests/generator/*`（31 个 id 全量旧测试）+ `migration/excel-raw/*`（4 个）+ kbl 冻结产物。

## 2. GENERATOR_MATRIX（逐 Generator 7 项声明）

| id | semantic family | kblFamily | supported question types | input contract | output contract | validator | production status |
|---|---|---|---|---|---|---|---|
| `generator:application-word` | `application` | `word-application` | apply/fill/choice/judge/calc | plan only（不读 semanticParams）；模板+随机数驱动（模板由难度闸） | 模板题; data{mode,steps,template,numbers,relation,options,correctIndex,shownAnswer}; answer=原始 string/boolean（契约偏差，由下游归一）; graphic 矩形虚线 | pipeline(kpSemantic+TypeContract+schema) | `PRODUCTION` |
| `generator:arithmetic-addition` | `arithmetic` | `integer-arithmetic` | calc/fill/apply | plan{kp,qt,difficulty,count,seed} + constraints{numberRange,kind,maxSteps,allowBracket,allowMultDiv,scale} + semanticParams.name(key kind) | answerMode=input; prompt=算式+“=？”; data{operation,steps}; 无图形 | pipeline(kpSemantic+TypeContract[calc:expressionPresent]+schema) | `PRODUCTION` |
| `generator:arithmetic-division` | `arithmetic` | `integer-arithmetic` | calc/fill/apply | 同 arithmetic-addition（op=div；kind=div-remainder 由 name 派生） | 同上（data.operation=div） | pipeline(kpSemantic+TypeContract+schema) | `PRODUCTION` |
| `generator:arithmetic-mixed-calculation` | `arithmetic` | `integer-arithmetic` | calc/fill/apply | 同 arithmetic-addition（op=mixed；operationSet 算子集） | 同上（data.operation=mixed） | pipeline(kpSemantic+TypeContract+schema) | `PRODUCTION` |
| `generator:arithmetic-multiplication` | `arithmetic` | `integer-arithmetic` | calc/fill/apply | 同 arithmetic-addition（op=mult） | 同上（data.operation=mult） | pipeline(kpSemantic+TypeContract+schema) | `PRODUCTION` |
| `generator:arithmetic-subtraction` | `arithmetic` | `integer-arithmetic` | calc/fill/apply | 同 arithmetic-addition（op=sub） | 同上（data.operation=sub） | pipeline(kpSemantic+TypeContract+schema) | `PRODUCTION` |
| `generator:classification` | `classification` | `classification` | classify | plan + constraints{numberRange} | 分类/排序; data{mode:classify,sort{desc,count}}; answerMode=input | pipeline(kpSemantic[metaExempt]+TypeContract+schema) | `PRODUCTION` |
| `generator:code-recognition` | `code` | `number-sense` | fill/choice/judge/apply | plan + constraints + semanticParams.name（codeCategory: idcard/postal/feature/practice/life） | CODE_BANK 5 类长情境题; data{mode,codeType}; choice 附 options/correctIndex | pipeline(kpSemantic+TypeContract+schema) | `PRODUCTION` |
| `generator:composite` | `composite` | `跨族（combine 组合）` | calc/judge/fill/apply | plan.combine===true && knowledgePointIds.length≥2（supports 门 + 自有 throw guard） | calc-to-judge 组合题; data{mode:calc-to-judge,steps:1,primaryKp,operation,operands,correct,shown,composite:true} | pipeline(kpSemantic+TypeContract[booleanAnswer]+schema)+自有 guard（<2 KP 抛错） | `PRODUCTION-COMBINE-ONLY` |
| `generator:concept-meaning` | `concept` | `number-sense` | calc/fill/apply/choice/geometry/judge | plan + constraints + semanticParams.subTopic+name（次数/分数意义/角/面积/负数等 maker） | 概念题（列式/填空/判断/选择）; data{mode:concept-meaning,subType,semanticEvidence{relations,constructs},options,correctIndex} | pipeline(kpSemantic[checkSemanticEvidence]+TypeContract+schema) | `PRODUCTION` |
| `generator:counting` | `counting` | `multiplicative-relation` | apply/calc | plan + semanticParams.name（组合学 subtype 派生） | apply/calc 计数/排列组合 story; data{mode,steps,questionType} | pipeline(kpSemantic+TypeContract+schema) | `PRODUCTION` |
| `generator:decimal-number` | `decimal` | `decimal` | calc/fill/choice/apply | plan + semanticParams.name（NAME_RULES→subtype 12 分支；fail-closed 缺 name 返回[]） | 小数专项; data{mode:decimal,subType,steps,options,correctIndex} | pipeline(kpSemantic+TypeContract+schema) | `PRODUCTION` |
| `generator:fraction-number` | `fraction` | `fraction` | calc/fill/choice/apply | plan + semanticParams.name（NAME_RULES→subtype 11 分支；fail-closed） | 分数专项; data{mode:fraction,subType,steps:1,options,correctIndex} | pipeline(kpSemantic+TypeContract+schema) | `PRODUCTION` |
| `generator:money-measurement` | `money-measurement` | `unit-measurement` | fill/choice/judge/apply/calc | plan + semanticParams.name+concept（deriveMeasureKind: rmb/length/area/mass/time/capacity） | fill/choice/judge/apply/calc; data{kind,operation,originalAmount/targetUnit/fromUnit/toUnit,options}; graphic currency/rectangle | pipeline(kpSemantic+TypeContract+schema) | `PRODUCTION` |
| `generator:percent-calc` | `percent` | `percent` | calc/fill/apply | plan + constraints + semanticParams.subTopic（paramsOf→SUBTOPIC_MAKERS） | 百分数计算/互化/折扣/利率; data{mode:percent-calc,subType,...}; answerMode=input | pipeline(kpSemantic+TypeContract+schema) | `PRODUCTION` |
| `generator:picture-equation` | `picture-equation` | `number-sense` | apply/calc | plan only（不读 semanticParams） | apply/calc 看图列式; data{mode,steps,questionType,graphic{type:diagram,subtype:segment/brace/balance/scale}} | pipeline(kpSemantic+TypeContract+schema) | `PRODUCTION` |
| `generator:position-direction` | `position` | `spatial-reasoning` | choice/judge/fill/geometry/apply | plan + semanticParams.name（deriveSpatialType） | choice/judge/fill/geometry/apply; data{scene{objects,gridSize},options,isTrue,correctDirection,graphic{type:geometry,subtype:position-grid}} | pipeline(kpSemantic+TypeContract+schema) | `PRODUCTION` |
| `generator:reasoning` | `reasoning` | `multiplicative-relation / statistics-probability` | apply/calc/fill/choice | plan + semanticParams.name（推理 subtype 派生） | apply/calc/fill/choice; data{mode,steps,operation,options,correctIndex} | pipeline(kpSemantic+TypeContract+schema) | `PRODUCTION` |
| `generator:selection-choice` | `selection` | `integer-arithmetic` | choice/geometry/calc/apply | plan + constraints；不读 semanticParams | answerMode=input; prompt=算式+“=？”; data{mode:choice,steps,options,correctIndex} | pipeline(kpSemantic+TypeContract[optionsPresent/answerInOptions]+schema) | `DORMANT-CONTRACT-CARRIER` |
| `generator:selection-fill` | `selection` | `integer-arithmetic` | fill/geometry/calc/apply | plan + constraints{numberRange,maxSteps,allowBracket,allowMultDiv,scale}；不读 semanticParams | answerMode=input; prompt=算式+“=____”; data{mode:fill,steps,options,correctIndex} | pipeline(kpSemantic+TypeContract[blankPresent]+schema) | `PRODUCTION` |
| `generator:selection-judge` | `selection` | `integer-arithmetic` | judge/geometry/calc/apply | plan + constraints | answerMode=input; prompt=算式+“=shown（对还是错？）”; data{mode:judge,steps,shownResult} | pipeline(kpSemantic+TypeContract[booleanAnswer]+schema) | `DORMANT-CONTRACT-CARRIER` |
| `generator:semantic-relations` | `semantic-relations` | `ratio-proportion / multiple-ratio / unit-measurement` | calc/fill/apply/choice/geometry | plan + constraints + semanticParams.subTopic(+name)（图解加/周期规律/比例尺/比例应用/比例意义） | 图形/比例/周期; data{mode:semantic-relations,subTopic,operation/barModel/periodLength/scaleRatio/proportion,options} | pipeline(kpSemantic[operation 规则]+TypeContract+schema) | `PRODUCTION` |
| `generator:shape-recognition` | `shape` | `geometric-figure / geometric-measurement` | choice/judge/fill/calc/geometry/apply | plan + semanticParams.name（deriveShapeTypeFromName 派生具体图形） | choice4/judge/fill/geometry/calc; data{graphic{type:geometry,subtype},options,correctIndex}; 度量 calc 含列式 | pipeline(kpSemantic+TypeContract[geometry:graphicPresent]+schema) | `PRODUCTION` |
| `generator:stats` | `stats` | `statistics-probability` | apply/calc/fill/choice | plan + semanticParams.name（统计/时间/日历 subtype 派生） | apply/calc/fill/choice; data{mode:apply,graphic{type:chart},choiceForm/judgeForm/calcForm,options}; judge 经 data.judgeForm 产出 | pipeline(kpSemantic+TypeContract+schema) | `PRODUCTION` |

## 3. 使用维度审计

| 维度 | 结论 |
|---|---|
| **生产使用** | 21 个实际承载（1570 冻结行全部落于原生绑定生成器）；composite 仅 combine 场景；其余 10 个 0 产出行（见 §4） |
| **测试使用** | 直接 id 引用 14 个文件：arithmetic-addition/multiplication (p27-variation-directive)、shape (p25-07-type-contracts)、money/application/reasoning/code/percent/concept/semantic-relations/decimal/fraction (p25-09-native-bindings)、concept (p25-04/p25-06)、classification (p17-10-classify)、composite (composite)；间接经 1570 门禁全覆盖 |
| **历史使用** | `archive/legacy-tests/generator/core-generators.test.js`（31/31 全量）、registry/selector legacy tests、`migration/excel-raw/kps.json+mappings.json`（addition+selection×3+classification）、`archive/docs-2026-09/migration-reports/*`、`archive/r6-gate-cleanup/*`、kbl 冻结产物（generation-matrix/kp-matrix/教学 semantic-review） |
| **重复能力** | selection-choice（375 行 choice 载体）/ selection-judge（126 行 judge 载体）实际 0 产出——choice/judge 已由 shape/position/concept/application 等原生绑定族全覆盖；complex-calc、c1/c2/c5c6/c7/c9、equivalent-reasoning 的 apply/calc/fill/choice 全被覆盖、0 产出 |
| **legacy capability** | 能力面无旧令牌（P28-07 已清，R6 通过）；剩余：selection 族几何为名义声明、stats 欠声明 judge、classification 欠声明 fill/choice/judge/apply、application/equivalent answer 契约偏差、c9 陈旧注释 |

## 4. 状态明细

| 状态 | 数量 | 生成器 |
|---|---|---|
| PRODUCTION（1570 实际承载≥1 行） | 21 | `generator:application-word`、`generator:arithmetic-addition`、`generator:arithmetic-division`、`generator:arithmetic-mixed-calculation`、`generator:arithmetic-multiplication`、`generator:arithmetic-subtraction`、`generator:classification`、`generator:code-recognition`、`generator:concept-meaning`、`generator:counting`、`generator:decimal-number`、`generator:fraction-number`、`generator:money-measurement`、`generator:percent-calc`、`generator:picture-equation`、`generator:position-direction`、`generator:reasoning`、`generator:selection-fill`、`generator:semantic-relations`、`generator:shape-recognition`、`generator:stats` |
| PRODUCTION-COMBINE-ONLY（combine 专享） | 1 | `generator:composite` |
| DORMANT-CONTRACT-CARRIER（契约名义载体，0 产出，重复能力） | 2 | `generator:selection-choice`、`generator:selection-judge` |
| DORMANT-NO-BINDING（0 绑定 0 产出，bundled 预留） | 0 |  |

## 5. 收口发现（契约/声明漂移，不阻塞现行生产，待 P28-10 处置）

1. `generator:stats` 欠声明 judge：`data.judgeForm` 可产出 judge，能力数组无 judge（现行 routing 由 classification/shape 覆盖，不达）。
2. `generator:classification` 欠声明 fill/choice/judge/apply：经 kp=1 在 25 绑定 KP 上产出 4 类；补齐声明会改变 tiebreak 路由，需联动审计，故列入待处置。
3. selection 族几何名义声明：maker 仅产出算术形态，form-bound 门内从不命中 geometry（无害）。
4. `generator:application-word` answer 原始 string/boolean（非 `{value,acceptable}`），由下游 TypeContract/schema 归一（契约偏差）。
5. `generator:equivalent-reasoning` FINAL-20 已从 semantic-special.js 清除（0 产出死符号）。
7. 非 formBound 泛型产出（native kp=1 扩展）：arithmetic×5、selection-fill、counting、picture-equation、percent-calc、classification 在未声明 choice/fill/apply/judge 情况下仍经 kp=1 产出该类题（maker 泛化）；form-bound（calc/geometry/classify）受 form-bound 声明门约束，本次无一违例（R4 全绿）。

## 6. 门禁

- `node dev/p28/check-generator-matrix.js` —— 收口一致性门禁（R1–R6，退出码 0=冻结保持）
