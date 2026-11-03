# P45 单题质量缺陷修复立项书

> 性质：P45 是 **P28-FINAL / P30-FINAL / P31 之后**的**质量修复战役**，不是新架构项目。
> 上位文件效力顺序：用户指令 ＞ `.trae/rules/ai-coding-workflow.md` ＞ `docs/01-ARCHITECTURE.md` ＞ `docs/00-BASELINE.md` ＞ 本文件。
> 本文件只登记「缺陷 → 文件/生成器/模板/描述符/Validator」映射与修复计划，**不代表已获授权改生产代码**；每个任务执行前仍须按九步流水线单独立项。

---

## 0. 立项依据

来源审计：`audit/single-question-quality-20261031/`

- 审计样本：1566 道真实生成题（375 KP 全量 ALLOW 矩阵）
- 硬缺陷：**16 类 / 51 行**（A1–A2、B1–B3、C1–C5、D1–D5、E1；C6 为边缘项，不计入 16 类）
- 扩展 WATCH：X3 干扰项 46 行、X4 解析 294 行、X9 语言格式 19 行（见附录 B，非本次 16 类硬缺陷）
- **首批范围**：仅 16 类硬缺陷；立项时用户裁决 **X3、X4 暂不纳入 P45**，**X9 保留为待定位事项**
- **后续变更**：用户 2026-11-02 指令「解冻修复A项」，X3/X4/X9/C6 已由 **P45-10** 解冻修复并收口（见 §4.3、§4.4-A）

### 0.1 基线核对（以 `docs/00-BASELINE.md` 为准）

| 项 | 值 |
|---|---|
| KP / Units / Relations / ALLOW | **375 / 98 / 407 / 1566** |
| Canonical 题型 | **7 类**（calc/fill/choice/judge/geometry/classify/apply） |
| Generator | **23**（PRODUCTION 20 / COMBINE-ONLY 1 / DORMANT-CARRIER 2） |
| 测试 | 102 文件 / 937 用例 / 0 FAIL |
| 全量门禁 | **34 项：本地 33 PASS / 0 FAIL / 1 SKIP**（#15 无 Chrome SKIP；CI 34/0/0） |
| 冻结执行链 | KBL→KnowledgeContext→POL→Strategy→Generator→Validator→SemanticQuestion→Presentation→SVG |

> 审计报告的 407/1566 与基线一致；规则文件中的 373/1570 为历史口径，不再作为依据。

---

## 1. 层归属总判定

**16 类硬缺陷的全部根因均属于 Generator 层**（`shared/generator/`）：

- 题面、答案、选项、图形描述符的生成口径都在 Generator 内；
- SVG 只按描述符绘制，不反推题目；
- Validator 只能**拦截**缺陷，**不能替代修复**；
- Presentation 只负责显示，不决定内容。

因此：

| 层 | P45 允许动作 | 禁止动作 |
|---|---|---|
| Generator | 修正模板/参数/描述符派生 | 改 KP/题型/数量/难度（Z1–Z4）；新建第二套生成器 |
| Validator | 新增拦截门禁（拒绝不合格产出） | 降标准放行；用 Validator 掩盖 Generator 缺陷 |
| SVG | 不改 | 让 SVG 反推或决定题目 |
| KBL / POL / Strategy / Difficulty | 不改 | 任何数据或决策改动 |
| Presentation | 不改 | 用排版/渲染掩盖内容缺陷 |

---

## 2. 16 类缺陷 → 生产位置映射总表

> 行号为立项当日源码定位结果；执行任务时以最新源码复核为准，行号漂移不改变归属。

| 编号 | 缺陷类 | 生产文件 | 生成器 | 模板/函数（行） | 描述符来源 | Validator 现状 | 唯一修复位置（层） |
|---|---|---|---|---|---|---|---|
| A1 | 图形数量 ≠ 答案（正方形） | `shared/generator/generators/shape.js` | `generator:shape-recognition` | `makeCountQuestion` L486–511；`generate` L1962–2023 | `generateGraphicParams` L150–175 → 单个 square；`generate()` L1982 | 无「图元数量 vs 答案」校验 | `shape.js::makeCountQuestion` + 其描述符构造（Generator） |
| A2 | 图形数量 ≠ 答案（角） | `shared/generator/generators/shape.js` | `generator:shape-recognition` | `makeCountQuestion` L486–511 | `generateGraphicParams` 单角描述符；`generate()` L1982 | 同上 | `shape.js::makeCountQuestion`（与 A1 同一函数，按 subtype 产出 N 个图元）（Generator） |
| B1 | 设问「多多少」→ 答案只给人数（fill） | `shared/generator/generators/stats.js` | `generator:stats` | `BAR_Q` L1133–1142；fill 分支 L1143–1146 | 读条形图描述符（既有） | 无「设问意图 vs 答案形态」校验 | `stats.js` 条形图题族 `BAR_Q`（Generator） |
| B2 | 设问「多多少」→ 答案只给人数（apply） | `shared/generator/generators/stats.js` | `generator:stats` | `BAR_Q` L1133–1142 | 同上 | 同上 | `stats.js` 条形图题族 `BAR_Q`（Generator） |
| B3 | 选项集中无「差值」选项（choice） | `shared/generator/generators/stats.js` | `generator:stats` | choice 分支 L1147–1157 | 同上 | 无「选项集合覆盖设问」校验 | `stats.js` choice 分支（Generator） |
| C1 | 分数结果未约分（calc 7/9+2/9→1/1） | `shared/generator/generators/fraction.js` | `generator:fraction-number` | `fs` L29–31；`calcItem` L155–160 | 无 | 无「分数既约/分母 1 折叠」校验 | `fraction.js` 输出格式化入口（Generator） |
| C2 | 同上（分母约分结果错误） | `shared/generator/generators/fraction.js` | `generator:fraction-number` | `simp`/`fs` L29–31；`calcItem` L155–160 | 无 | 同上 | `fraction.js` 输出格式化入口（Generator） |
| C3 | fill 倒数模板输出未约分 | `shared/generator/generators/fraction.js` | `generator:fraction-number` | div 分支 fill L290–293 | 无 | 同上 | `fraction.js` div-fill 模板（先 `simp` 再输出）（Generator） |
| C4 | 分数结果未约分（apply 9/1） | `shared/generator/generators/fraction.js` | `generator:fraction-number` | `applyItem` L161–172 | 无 | 同上 | `fraction.js` 输出格式化入口（Generator） |
| C5 | 分数结果未约分（calc 1/1） | `shared/generator/generators/fraction.js` | `generator:fraction-number` | `calcItem` L155–160 | 无 | 同上 | `fraction.js` 输出格式化入口（Generator） |
| D1 | 图文不符：刻度尺题配圆 | `shared/generator/generators/shape.js` | `generator:shape-recognition` | `generate` flat 采样 L1977–1981；主题 `math-g2-up-u05-k002` L1130 | `generateGraphicParams` 按 subtype 随机 | 无「题面图形要求 vs 描述符类型」校验 | `shape.js::generate` 图形选择入口（主题题禁止 flat 随机采样）（Generator） |
| D2 | 图文不符：问长方形配正方形 | `shared/generator/generators/shape.js` | `generator:shape-recognition` | `NAME_TO_SHAPE` L105–123；`getShapeMeta` L133–144 | 由 KP 名称首命中派生 | 同上 | `shape.js::themedItemMeta` + apply 分支（按题面主问对象派生，先于名称首命中）（Generator） |
| D3 | 图文不符：长方形周长配平行四边形 | `shared/generator/generators/shape.js` | `generator:shape-recognition` | `generate` flat 采样 L1977–1981；主题 `math-g3-down-u08-k003` L1705 | `generateGraphicParams` 随机 | 同上 | `shape.js::generate` 图形选择入口（与 D1 同一入口）（Generator） |
| D4 | 比例不符：8×5 题配 8×3 | `shared/generator/generators/money.js` | `generator:money-measurement` | `makeGraphicForMoney` L606–626 | 固定 `width:8,height:3,labelSides:false` | 无「描述符参数 vs 题干数据」校验 | `money.js::makeGraphicForMoney`（Generator） |
| D5 | 装饰性无关图：单位换算统一挂 8×3 | `shared/generator/generators/money.js` | `generator:money-measurement` | `makeGraphicForMoney` L606–626 | 同上 | 无「是否需要配图」判定 | `money.js::makeGraphicForMoney`（无图形需求返回 null/不挂载）（Generator） |
| E1 | 判断题题干残留 `____` | `shared/generator/core/type-contract.js` | 机械转换（作用于 money 等 fill 产出） | `finishJudge` L343–395，空位包装 L374–380 | 继承原 fill 描述符 | 无「judge 题干禁空位」校验 | `type-contract.js::finishJudge`（包装前消解空位）；`money.js:325` 为同源第二生产点，同任务核实（Generator） |

### 2.1 按根因聚合后的「唯一修复位置」清单

| 根因类 | 缺陷 | 唯一修复位置 | 任务 |
|---|---|---|---|
| R1 图形图元数量与答案脱钩 | A1、A2 | `shared/generator/generators/shape.js::makeCountQuestion` + 描述符构造 | P45-01 |
| R2 条形图设问/答案/选项三口径不一致 | B1、B2、B3 | `shared/generator/generators/stats.js` 条形图题族（`BAR_Q` + choice 分支） | P45-02 |
| R3 分数输出未统一走既约格式化 | C1–C5 | `shared/generator/generators/fraction.js` 输出格式化入口（含 div-fill 模板） | P45-03 |
| R4 主题图形题走 flat 随机采样 | D1、D3 | `shared/generator/generators/shape.js::generate` 图形选择入口 | P45-04 |
| R5 图形 subtype 由 KP 名称首命中 | D2 | `shared/generator/generators/shape.js::themedItemMeta`（题面主问对象优先） | P45-09 |
| R6 度量题统一挂固定装饰矩形 | D4、D5 | `shared/generator/generators/money.js::makeGraphicForMoney` | P45-05 |
| R7 judge 机械转换保留作答空位 | E1 | `shared/generator/core/type-contract.js::finishJudge` | P45-06 |
| R8 Validator 缺少对应门禁 | A–E 全覆盖 | `shared/validator/` 既有模块 + 既有实例门禁 | P45-07 |

> **唯一性声明**：同一根因类只允许在表中一个位置修。禁止在 Generator 修一遍、再在 Validator 加 fallback 兜一遍，形成双轨。

### 2.2 C 类修复口径：四处必须同源一致

`fs → fstr` 只是显示层替换，**不得作为验收终点**。C 类修复必须保证同一道题的四类载体一致：

| 载体 | 修复要求 |
|---|---|
| 标准答案 `answer.value` / `answer.display` | 分母为 1 时输出整数（`1` 而非 `1/1`）；非 1 时输出既约分数 |
| 解析 `answer.explanation` | 过程中的每一步结果同样既约、分母 1 折叠；禁止出现「4/4 约分得 1/1」 |
| 填空答案 `answer` / `options` | fill 倒数模板先 `simp` 再格式化；选项与答案共用同一格式化函数 |
| 内部数学值 | `simp()` 产出的 `{n,d}` 必须与展示值对应；不得展示 `1` 而内部保留 `{n:4,d:4}` |

唯一入口：`fraction.js` 内统一格式化函数（`fstr` 为唯一格式化出口）。`fs` 仅可作为「强制分数形式」的内部工具，不得直接进入题面、答案、解析、选项。验收时逐题比对四处字符串，而不是只看 `answer`。

### 2.3 A 类与 D 类：验收分离，禁止合并为一个图形修复函数

| 类别 | 验收对象 | 判定方式 | 允许改动 | 禁止改动 |
|---|---|---|---|---|
| A 类（A1/A2） | **图元数量 = 答案** | 数描述符中实际图元个数，与 `answer` 数值逐一比对 | `makeCountQuestion` 与其图元构造 | 不改图形语义、不改题型、不改题干问法 |
| D 类（D1–D5） | **图形语义 / 题干对象 / 尺寸参数 / 实际渲染四者一致** | 题干对象→描述符 subtype；题干尺寸→描述符 params；渲染结果→题面文字 | `generate` 图形选择、`getShapeMeta`、`makeGraphicForMoney` | 不改答案数值、不改计数逻辑、不改 A 类图元数量规则 |

两类的测试与门禁分开：A 类断言 `figureCount === answer`；D 类断言 `descriptor.subtype / params` 与题干语义一致。**禁止**写一个笼统的 `fixGraphic()` 同时处理 A 与 D。

---

## 3. Validator 缺口与新增门禁（只拦截，不修复）

现状（`shared/validator/`）：

- `answer-validator.js` L24–47：答案与题干/图形一致校验入口，**无图元计数、无选项语义覆盖、无 judge 空位规则**；
- `quality-scorer.js` L36–49 / L83–99：解析非空、非复述、分步、答案一致评分，**无分数既约校验、无模板检测**。

P45 需补的门禁（全部挂在既有 Validator / 既有实例门禁，不新建第二套系统）：

| 门禁 | 规则 | 覆盖缺陷 | 落地位置 |
|---|---|---|---|
| V-A 图元计数一致 | 计数题的答案必须等于描述符实际图元数（由 Generator 显式写出 `data.figureCount`，Validator 只比对） | A1、A2 | `shared/validator/answer-validator.js` 扩展 |
| V-B 设问-答案形态一致 | 题干含「多多少/少多少」时，答案与至少一个选项必须是差值形态 | B1–B3 | 同上（需 Generator 提供 `data.answerForm`） |
| V-C 分数既约 | 分数答案分母 1 必须折叠为整数；非 1 时分母与分子互质 | C1–C5 | `shared/validator/quality-scorer.js` 扩展 |
| V-D 描述符-题面一致 | 描述符 subtype 必须在题干语义允许集合内（含**图文同名**：题面主对象图形名 = 描述符 subtype）；无图形需求时不得挂装饰图 | D1–D5（含 D2 图文同名） | `shared/validator/answer-validator.js` 扩展 |
| V-E judge 无空位 | judge 题干禁止出现 `____`、`（ ）`、`( )` | E1 | 同上 |

**约束**：Validator 新增门禁会拦截现有 1566 行产出；必须**先完成 P45-01~06 的 Generator 修复**，再开门禁（P45-07），否则会把门禁失败与生成缺陷混在一起。

---

## 4. 任务拆分与阶段门禁

| 阶段 | 任务 | 范围 | 局部门禁 | 过门判据 |
|---|---|---|---|---|
| 一 建档 | P45-INIT | 本文件 + change-log | 只读核对基线 | 16 类映射齐备；每类唯一修复位置明确 |
| 二 Generator 修复 | P45-01 A 类 | `shape.js` 计数题图元与答案同源 | `tests/generation/` 定向 + `check-generator-noninterference` | 仅验 A 类：复现题由「1 个图元/答案 4」变为「4 个图元/答案 4」；不验 D 类语义 |
| 二 | P45-02 B 类 | `stats.js` 条形图设问/答案/选项 | 同上 + `check-educational-generation` | 「多多少」答案与选项均含差值 |
| 二 | P45-03 C 类 | `fraction.js` 输出格式化 | 同上 | 答案 / 解析 / 填空 / 内部数学值**四处一致**；答案 `1` 时解析不得出现 `1/1` |
| 二 | P45-04 D 类（shape） | `shape.js` 主题图形与 subtype 派生 | 同上 + SVG 契约测试 | 仅验 D 类：图形语义、题干对象、尺寸参数与实际渲染一致；不改 A 类计数规则 |
| 二 | P45-05 D 类（money） | `money.js` 描述符参数与题干联动 | 同上 | 8×5 题配 8:5 或明确不配图；单位换算不挂装饰图 |
| 二 | P45-06 E 类 | `type-contract.js::finishJudge` | 同上 | judge 题干零空位；`money.js:325` 同源点已核实 |
| 三 Validator | P45-07 门禁补齐 | `shared/validator/` + 既有实例门禁 | `tests/validator/` 定向 + 门禁 12/23 | 5 条新门禁对修复后全量零误报 |
| 四 重冻 | P45-08 全量重生成与冻结 | 1566 ALLOW 矩阵重跑、bundle 重建、矩阵重冻 | 6a/6b/16/17 + `node dev/check-all.js` | 33 PASS / 0 FAIL / 1 SKIP（CI 34/0/0）；16 类缺陷 0 命中 |

### 4.1 每个任务必须提交的「三件证据」

1. **修复前复现题**：审计 CSV 原始行（KP + 题型 + 题面 + 当前产出）；
2. **修复后定向断言**：测试中同时断言「读取了正确输入」与「产出发生对应变化」；
3. **门禁证据**：定向测试 → `npm test` → `node dev/check-all.js` → change-log。

### 4.2 最终验收标准（P45 收口口径）

| # | 判据 | 证据 |
|---|---|---|
| G1 | **16 类硬缺陷逐条复现并修复** | 每类保留「修复前复现题 + 修复后同题」；51 行命中清零 |
| G2 | **原有 34 项门禁全部达到预期状态** | 本地须 **33 PASS / 0 FAIL / 1 SKIP**；SKIP 只允许 #15 无 Chrome 环境，**不得把 SKIP 计作 PASS**；CI 设 `CHROME_BIN` 后须 34 PASS / 0 FAIL / 0 SKIP |
| G3 | **V-A～V-E 全部通过** | `tests/validator/` 定向 + 门禁 12/23；对修复后 1566 零误报、对修复前缺陷 100% 命中 |
| G4 | **1566 条 ALLOW 全量重新验证** | `npm run verify:allow-gen`；6a/6b 重冻后零 FAIL |
| G5 | **口径保持** | 375 KP / 98 Units / 407 Relations / 23 Generator / 7 题型逐项对账 |
| G6 | **无新增题型、无重复生成链路、无静默改变题型** | `check-generator-matrix`（6c）、`check-generator-noninterference`（6d）、`check-legacy-matrix`（22） |
| G7 | **生产代码 / 测试 / 文档 / 派生数据分别核对** | 四类改动各自列出文件清单与验证命令，不允许「只跑一次测试就宣布全绿」 |
| G8 | **提交干净、可追溯** | bundle 重建、矩阵重冻、GENERATOR-MATRIX 重生成、change-log 六字段完整；不自动 commit |

### 4.3 修复进度（P45-10 收口后，2026-11-02）

| 缺陷类 | 任务 | 状态 | 落地位置 | 关键证据 |
|---|---|---|---|---|
| A1 图形数量≠答案（正方形） | P45-01 | ✅ 已修 | `shape.js::makeCountQuestion` | 复现题由 1 个图元变为 `figureCount` 个，`figureCount === answer` |
| A2 图形数量≠答案（角） | P45-01 | ✅ 已修 | 同上（`subtype:'count'`，唯一产出点，schema 已登记） | 计数形态图元数=答案；T2 锚随形态降级（P45-08） |
| B1 fill「多多少」答非所问 | P45-02 | ✅ 已修 | `stats.js` 条形图题族 `BAR_Q` | 第二空输出差值；`data.answerForm` 供 V-B |
| B2 apply「多多少」答非所问 | P45-02 | ✅ 已修 | 同上 | 差值答案与设问形态一致 |
| B3 choice 无差值选项 | P45-02 | ✅ 已修 | `stats.js` choice 分支 | 选项收敛为 4 项且含正确差值项；V-B 覆盖 |
| C1–C5 分数未约分 | P45-03 | ✅ 已修 | `fraction.js` 统一格式化出口（含 div-fill 模板） | 答案/解析/填空/内部数学值四处一致；`1` 不再出现 `1/1`；V-C 覆盖 |
| D1 刻度尺题配圆 | P45-04 | ✅ 已修 | `shape.js::generate`（主题题禁 flat 随机采样） | ruler 描述符与题干两处刻度同源 |
| D2 问长方形配正方形 | P45-09 | ✅ 已修（用户 2026-11-01「授权修复D2」） | `shape.js::themedItemMeta` + apply 分支（题面主问对象派生，先于 KP 名首命中） | `math-g3-down-u03-k001` fill/geometry 均 `rectangle` + 渲染 SUCCESS；T2 锚 43 行随合法形态降级，6f Layer B FAILED 0 |
| D3 周长题配平行四边形 | P45-04 | ✅ 已修 | 同 D1 入口 | 长方形题描述符 `rectangle` |
| D4 8×5 题配 8:3 | P45-05 | ✅ 已修 | `money.js::makeGraphicForMoney` | 面积 apply `width/height` 与题干同源、`labelSides:true` |
| D5 单位换算挂装饰图 | P45-05 | ✅ 已修 | 同上（无图形需求不再挂 8×3 固定矩形） | 新建 `weighing` SVG；6g 登记 4 条巧合命中 |
| E1 judge 题干残留 `____` | P45-06 | ✅ 已修 | `type-contract.js::finishJudge` + `money.js:325` 同源点 | 核查确认 `money.js:325` 为唯一同源生产点，同任务内消解；judge 题干零空位；V-E 覆盖 |
| X3 干扰项凑位短语 | P45-10 | ✅ 已修（用户 2026-11-02「解冻修复A项」） | 新建 `shared/generator/core/distractors.js` + `concept-meaning.js`/`semantic-relations.js` 两处 `finishChoice`；`stats.js` 星期 7→4 | 35 行零「以上说法都不对/都不对（N）」；选项去重、`correctIndex` 正确；数值型按答案形态派生；天然三元域保留 3 项 |
| X4 跨 KP 解析模板 | P45-10 | ✅ 已修（同上） | `semantic-parameters.js::composeExplanation` + `concept-meaning.js` 接线 | 已有本题解析不再前置桥接句；模板仅空解析兜底（`P40-T-08` 契约同步改写） |
| X9 语言格式残留 | P45-10 | ✅ 已修（同上） | `concept-meaning.js` 6 处、`stats.js` judge 1 处、`percent.js` 4 处、`semantic-relations.js` 3 处 | 删除「（参考：…）」标签 8 行、重复「列式」8 行改「算式」、删除「（标出 Ncm）」3 行 |
| C6 分数展示边缘项 | P45-10 | ✅ 已纳入回归（量化 0 行真实复现） | `tests/generation/p45-03-fraction-format.test.js` 新增 `math-g6-up-u03-k001` | 该 KP × 4 题型 × d1-4 × v0-3 全部既约、无 `n/1`、解析含答案 |
| V-D 图文同名校验 | P45-11 | ✅ 已实现（P45-09 D2 修复后启用） | `shared/validator/answer-validator.js` V-D 段（`primaryShapeSubtypes` / `allShapeSubtypes` + `skipPrefix` 构词过滤） | D2 复现形态命中；gate 23（1566 行 p42 seed）instance fail=0；6f Layer B（count=6）FAILED 0；主题图标、复合描述符、构词成分（乒乓球/羽毛球/地球仪…）按既有作用域跳过 |
| C 技术债 `probeVaries` 前缀错位 | P45-12 | ✅ 已修 | `dev/p25/derive-evidence-candidates.js::probeVaries` 中 `probeAgg[f.path]` → `probeAgg[f.path.replace(/^data\./,'')]` | 反面采样降级恢复生效；派生 12 行新增降级 + apply 36 条 `field=true`→`fieldPresent`；基线 fail=0，全门禁 PASS |
| D16 raw 探针第二生成路径 | P45-13 | ✅ 已修 | `dev/p25/derive-evidence-candidates.js` raw 探针改经 `PracticeSession({skipValidation:true})`；`presentation-engine.js::generateQuestions` skipValidation 直调 `generator.generate`（绕开 RetryLoop/Pipeline）；`practice-orchestrator.js::orchestrate` skipValidation 跳过 cell 拆分与跨 cell 指纹去重 | raw 探针看到 Generator 全部合法形态；重跑派生 `counterDowngraded=149`（与 P45-12 一致）；apply 0 新变更；npm test 993/993；check-all 33/0/1/34 |
| D17 probeAgg/variantAgg 并存 | P45-13 | ✅ 评估完成（暂保留） | `dev/p25/derive-evidence-candidates.js` | variantAgg 的 absent 检测不可被 probeAgg 替代；暂保留，待后续锚点对账再评估合并 |
| D18 shape.js 双入口 | P45-13 / P45-NEXT-04 | ✅ 已收敛 | `shared/generator/generators/shape.js` | 两处调用均经 `resolveShapeDescriptor`，`stemGraphicPlan` 唯一入口，bundle 一致 |
| 质量族 11 行证据规则失效字段 | P45-19 | ✅ 已修 | `dev/p25/apply-evidence-candidates.js` 新增 `--prune-stale-fields=<scope>`；`kbl/teaching/evidence-rules.json` 11 行 | 剔除 22 条失效断言；门禁 2/5/6b/6f/7 全部复位；6b 只读复核与冻结产物一致（无需重冻） |
| P45 死代码与无效文件 | P45-20 | ✅ 完成 | 删除重复打包 zip、空目录壳、`.DS_Store` | 源码零死代码；check-all 33 PASS / 0 FAIL / 1 SKIP |
| 下一步待修 5 项 | P45-NEXT-01~05 | ✅ 全部处置 | `derive-evidence-candidates.js`、`apply-evidence-candidates.js`、`evidence-rules.json`、`shape.js`（仅核实） | 见 §4.5：规则补全 20 行、形态闭合判定、反面采样合并、双入口收敛、stale 锚未触发 |

> **任务号追溯缺口（2026-11-02 核对）**：`change-log` 现存记录缺 **P45-14 / 15 / 16 / 17 / 18** 五条。可证实者仅两条——P45-17（含 `P45-17-FIX`）= `apply-evidence-candidates.js::L193` 的 `lowSample` 门控；P45-18 = `strategy-engine.bundle.js` 重建（P45-19 因果链据此）。P45-14~16 全库无代码/数据/测试/文档痕迹，内容不可考，已在 change-log `P45-LOG-01` 登记追溯说明，不臆造。

**门禁与测试终态（P45-NEXT-05）**：`npm test` **993/993 PASS**；`node dev/check-all.js` **33 PASS / 0 FAIL / 1 SKIP / 34 项**（#15 无 Chrome SKIP，CI 34/0/0）；6a–6g/7/23 全 PASS；口径 375 KP / 98 Units / 407 Relations / 1566 ALLOW / 23 Generator / 7 题型不变。**16/16 硬缺陷全部修复；X 类挂起项已解冻修复；P45-19 收敛 5 个门禁 FAIL；P45-20 清理完成；P45-NEXT-01~05 全部处置完毕（无剩余待修项）**。

### 4.4 遗留债务、挂起项与并行通道登记（P45-10 收口后核对，2026-11-02）

> 本节为**登记册**，不构成执行授权；每一项须按九步流水线单独立项后才可动生产代码。
> 罗列顺序：A 挂起未执行 → B 待立项修复 → C 技术债 → D 并行通道/双入口 → E 重复实现核查结论。

#### A. 挂起未执行 → **已全部解冻修复（P45-10，用户 2026-11-02 指令「解冻修复A项」）**

| 编号 | 现状 | 影响面 | 收口结果 |
|---|---|---|---|
| X3 干扰项凑位短语 | ✅ 已修 | 35 行 + 选项数异常 11 行 | 新增唯一干扰项派生点 `core/distractors.js`；两处 `finishChoice` 接通；折线统计图 7→4 项。用户裁决口径：**4 项为常态 + 天然三元域 3 项例外** |
| X4 跨 KP 解析模板 | ✅ 已修 | 172 行（fraction 9 行随 P45-03 已消失） | 已有本题解析不再前置跨 KP 桥接句；`composeExplanation` 仅空解析兜底。用户裁决口径：**仅空解析时兜底** |
| X9 语言格式残留 | ✅ 已修（唯一拼接点已定位） | 19 行 | 「（参考：…）」8 行删标签；「重复列式」8 行定位到 `percent.js` L196/L302/L333/L374 + `semantic-relations.js` L472/L600/L752，内层改「算式：」；「（标出 Ncm）」3 行删除。**遗留待定位事项清零** |
| C6 分数展示边缘项 | ✅ 已纳入回归 | 量化 0 行真实复现 | 通过 `tests/generation/p45-03-fraction-format.test.js` 新增 `math-g6-up-u03-k001` 全 seed 面防护。用户裁决口径：**纳入并先量化** |

#### B. 待立项修复 → **已清零（P45-11）**

| 项 | 现状 | 影响面 | 收口结果 |
|---|---|---|---|
| V-D 图文同名校验 | ✅ 已实现（P45-11，D2 修复后启用） | 图形题全量 | `answer-validator.js` 新增「题面主对象图形名 = 描述符 subtype」比对：仅单图形 + 主对象位置（指示词邻近或后接「有/的」）才判定；`skipPrefix` 过滤构词成分（乒乓球/羽毛球/足球/地球仪…）；主题图标（width+size）、复合描述符（view-cards/segment/ruler）、`count` 取 `params.shape`、judge 命题文本均跳过。定向测试 7 条；gate 23（1566 行）instance fail=0；6f Layer B（count=6）FAILED 0 |

#### C. 技术债（已登记，逐项核对 2026-11-02）

| 项 | 现状 | 风险 |
|---|---|---|
| `probeVaries` 前缀错位 | ✅ **已修（P45-12）**：`probeAgg[f.path.replace(/^data\./,'')]` 与 `variantStatus` 同口径剥离前缀；重跑派生 → 12 行新增降级，`apply --refresh-value-drift` 降级 36 条 `field=true`→`fieldPresent`（barModel/calcForm/choiceForm/sort/gridFigure 等布尔标志）。基线 fail=0，全门禁 PASS | 见 D17：probeAgg 与 variantAgg 仍并存，后续可合并 |
| 71 行 stale 锚路径 | 已核实：evidence-rules.json 中 `labelSides`(84) / `steps`(559) / `angle`(20) / `length`(12) / `correctIndex`(2) / `shownAnswer`(2) 仍存在，但派生报告 A 类 1315 行 **baseline fail=0**（字段仍在产出中）。非 A 类行未覆盖 | 相关生成器再改描述符时可能重新 fail；届时须 `--refresh-stale-fields=<scope>` 原子刷新 |
| 质量族 11 行锚绑定当前产出 | **已被 P45-19 取代**：该范围 `unit/unitPx` 断言已剔除（现 4 条断言/行），刷新通道改为 `--prune-stale-fields=<scope>`；规则随之偏宽，转登 §4.5 P45-NEXT-01 | 再改质量族描述符须重跑 derive +（prune 或 refresh） |
| 变体采样范围扩大 | 已核实：325 个单样本行（samples<2）纳入 10 次变体采样，派生报告 `single-sample-declaration` 标记 | 派生器耗时上升；同 KP×QT 新产出形态须重跑 derive + scope 合并 |
| 6f capacityGap | 已核实：572 行能力缺口（FINAL-142 记账），不判 FAIL | 新增 KP/模板时复核 |
| 6g 4 条白名单 | 已登记：3 条刻度编号巧合 + 1 条称重已知重量与答案巧合 | 改答案/题面口径须重新裁决并追加 `docs/P32/change-log.md` |
| 门禁 7 固定 seed | 已核实：`edu\|<kp>\|<qt>` 确定性窗口 | 与历史非确定报告不可逐行对账（口径修正，未放宽标准） |
| Browser E2E 本地 SKIP | 环境限制：本机无 Chrome，第 15 项 SKIP | CI 设 `CHROME_BIN` 后须 34/0/0 |
| 派生器 raw 探针耦合 | ✅ **已修（P45-13）**：raw 探针统一经 `PracticeSession({skipValidation:true})`，不再直接调 `GeneratorSelector` / `gen.generate`；`rawVariantPaths/rawAbsentPaths` 为派生器内部聚合字段 | 生成器契约变更时仍须同步复核聚合口径 |
| k004 双形态 | 已核实：D2 修复后同批产出 `line-segment` 与 `ruler` 两种合法形态 | 已由 `p45-04-shape-graphic.test.js` 图文一致断言 + T2 降级覆盖 |

#### D. 并行通道 / 双入口（因缺陷累积的第二机制，非第二套生产实现）

| 位置 | 性质 | 风险 | 建议 |
|---|---|---|---|
| `dev/p25/derive-evidence-candidates.js` raw 探针 | ✅ **已修（P45-13）**：经 `PracticeSession({skipValidation:true})` 单一路径，删除原 `StrategyEngine.plan` + `GeneratorSelector` + `gen.generate` 并行调用链 | `skipValidation` 需真实绕开 RetryLoop/Pipeline + 编排层 cell/dedup，否则探针看不到全部合法形态 | 已实现：`generateQuestions` 直调 `generator.generate`；`orchestrate` 跳过 cell 拆分与跨 cell 指纹去重。重跑派生 `counterDowngraded=149`（与 P45-12 一致），apply 0 新变更 |
| `probeAgg` 单套反面采样（原 `variantAgg`） | ✅ **已合并（P45-NEXT-03）**：`variantAgg` 已不存在于代码，变体计数由 `probeAgg.variantPresent/variantValues` 承载 | 原 `variantAgg` 的 `absent` 判定改用 `probeAgg.variantPresent < variantSamples`，与 `probeAgg.present/values` 同一对象；单次 census 同时喂两套计数 | 无（重跑报告 flags/candidate/baseline 逐项一致） |
| `shape.js` 图形决策（原 `stemGraphicPlan` 双入口） | ✅ **已收敛（D18 / D18-CLEAN）**：两处调用均经 `resolveShapeDescriptor`（L1896 choice/fill/geometry、L2033 apply），`stemGraphicPlan` 仅保留唯一入口 | 无需统一 `sItem`/`item` 结构即达成单入口；bundle 内同名函数同步一致 | 无（1566 图文回归 + 6b/6f 复核随 P45-NEXT-04 完成） |

#### E. 「第二套实现」核查结论（生产层：没有）

- 未新建第二套 Generator / Renderer / Layout / Preview / 派生链 / 语义 JSON / shim；`check-all` 21（Dead Code）、22（Legacy）、16/17（bundle 确定性）均 PASS。
- 以下两处**不属于**第二套实现，仅登记以免误判：
  - `answer-validator.js` 的 V-D / V-E 是对产出的独立校验（设计上的双解释，不是第二生成器）；V-D 同名校验已于 P45-11 实现，见 §4.4-B。
  - `weighing` 是 `shared/svg/svg-geometry.js` 注册表内新增的一个图元，属既有 SVG 系统扩展，不是新渲染器；money 的三种图形也在同一 `makeGraphicForMoney` 内分支。


### 4.5 P45 下一步待修清单（已全部处置）

> 原登记 5 项，2026-11-03 处置完毕；处置结论如下，不再保留待修条目。
> 无需改动、已覆盖、环境限制、既有记账项仍不列入（清单见本节末）。

| 编号 | 问题 | 处置结论 |
|---|---|---|
| P45-NEXT-01 | 质量族 11 行证据规则偏宽，未固定 `weighing` 语义 | ✅ 已修：新增 `--refresh-incomplete` 纯追加通道，补全 20 行（11 行 weighing + 9 行 rmb），`forbidden`/锚点零变化 |
| P45-NEXT-02 | `partial-sample` 永久盲区（money fill/choice 恒 5 题） | ✅ 已修：同种子放大复采判「形态闭合」，标 `saturated-sample`；`partial=325`（全为单样本）、`saturated=396` |
| P45-NEXT-03 | `probeAgg` / `variantAgg` 两套反面采样并存 | ✅ 已合并：`variantAgg` 已无代码实体；`probeAgg.variantPresent/variantValues` 单次遍历承载；报告逐项一致 |
| P45-NEXT-04 | `shape.js` `stemGraphicPlan` 双入口 | ✅ 已收敛：两处调用均经 `resolveShapeDescriptor`，`stemGraphicPlan` 唯一入口；bundle 一致，1566 回归通过 |
| P45-NEXT-05 | 71 行 stale 锚路径（条件触发） | ✅ 未触发：本轮无生成器描述符变更，`baseline fail=0`，锚路径按原样保留（条件成立时按范围 `--refresh-stale-fields=<gen...>` 刷新） |

**不再列入（已核实无需改动）**：k004 双形态（已由图文一致断言 + T2 降级覆盖）、6f `capacityGap` 572 行（既有记账，不判 FAIL）、6g 4 条白名单（既有裁决，仅改口径时重裁）、门禁 7 固定 seed（口径已修正）、Browser E2E 本地 SKIP（环境限制，CI 设 `CHROME_BIN`）、变体采样 325 行耗时（性能观察非缺陷）、派生器 raw 探针耦合（P45-13 已修）、407/1566 与 373/1570 口径差（历史口径已在 §0.1 注明）。

---

## 5. 改后动作清单（按触发项执行）

| 触发 | 必做 |
|---|---|
| 改 `shared/generator/**` | 重建 `strategy-engine.bundle.js`、`presentation-engine.bundle.js`（E2E 走 bundle）；过门禁 16/17 |
| 改题面/答案文案 | 重跑 `dev/p27/derive-variation-profiles.js`、`derive-misconceptions.js` |
| 1566 任一行产出变化 | `check-generation-matrix-frozen --write` 重冻 + 重生成 GENERATOR-MATRIX |
| 改 Validator | 同步 `tests/validator/` 与门禁 12/23 |
| 任何修改 | 定向测试 → `npm test` → `node dev/check-all.js` → 追加 `docs/P45/change-log.md` |

---

## 6. 红线（触犯任一：停止→举证→回退→重走流水线）

1. 改 KBL / POL / Strategy / Difficulty / 7 题型集合。
2. Generator 自决 KP、题型、数量、难度（Z1–Z4）。
3. 让 SVG / Presentation 反推或决定题目内容。
4. 新建第二套生成器、第二套 Validator、第二套语义/题型/图形系统。
5. 建 shim / adapter / COMPAT / BRIDGE 双轨；同一根因在两处修。
6. 为让 1566 全量通过而降 Validator 标准、加 fallback 吞错、`catch → ''`。
7. 为测试 PASS 改测试标准或删失败用例。
8. 顺手重构、连锁修无关缺陷、展开全量二次审计。
9. 改完不重建 bundle、不重冻矩阵、不记 change-log 即交付。
10. 未获用户确认即跨阶段执行。

---

## 7. 待定位 / 未决项（本立项登记，不纳入 16 类首批任务）

| 项 | 现状 | 处理方式 |
|---|---|---|
| E1 同源第二生产点 | `money.js:325` 直接构造 `判断对错：X = ____ Y` | **P45-06 已核查**：为 E1 唯一同源生产点，已同任务消解，未另立任务、无遗漏 |
| X9「重复列式」8 行 | **已定位并修复（P45-10）**：`percent.js` L196/L302/L333/L374 + `semantic-relations.js` L472/L600/L752 | 已随 P45-10 收口，见 §4.4-A |
| X3「以上说法都不对」35 行 | **已修复（P45-10）**：唯一派生点 `core/distractors.js`，两处 `finishChoice` 接通 | 用户 2026-11-02「解冻修复A项」，见 §4.4-A |
| X4 跨 KP 解析模板 172 行 | **已修复（P45-10）**：`semantic-parameters.js::composeExplanation` 仅空解析兜底 | 用户裁决「仅空解析时兜底」，见 §4.4-A |
| C6 边缘项 | **已纳入回归（P45-10）**：量化 0 行真实复现，P45-03 KPS 新增 `math-g6-up-u03-k001` | 用户裁决「纳入并先量化」，见 §4.4-A |

---

## 附录 A：审计口径

- 硬缺陷等级：PASS / WATCH / FAIL / NA / UNVERIFIED；本文件 16 类均为 FAIL 级或高严重度 WATCH 升级项。
- 16 类对应 51 行命中；同一类可跨多个 KP/题型。
- 缺陷判定以「学生实际看到并作答的题面 + 答案 + 图形 + 选项」为准，不以内部字段自洽为准。

## 附录 B：WATCH 项映射（非 16 类，供后续战役参考）

| 编号 | 行数 | 生产文件/函数 | 生成器 | 备注 |
|---|---|---|---|---|
| X3 | 35 | `concept-meaning.js::finishChoice` + `semantic-relations.js::finishChoice` → `core/distractors.js` | `generator:concept-meaning` / `semantic-relations` | **P45-10 已修**：凑位短语清零，按答案形态派生干扰项 |
| X3 | 11 | 多生成器 choice 分支 | 多生成器 | **P45-10 已修**：仅折线统计图 7→4；其余为天然三元域，用户裁决保留 3 项 |
| X4 | 172 | `semantic-parameters.js::composeExplanation` + `concept-meaning.js` | `generator:concept-meaning` | **P45-10 已修**：仅空解析兜底 |
| X4 | 9 | `fraction.js` 输出格式化 | `generator:fraction-number` | 与 C1–C5 同源，随 P45-03 一并消失 |
| X9 | 8 | `concept-meaning.js` L838/L850/L865/L955/L962/L988 等 6 处 | `generator:concept-meaning` | **P45-10 已修**：删除「（参考：…）」标签，保留算式 |
| X9 | 3 | `stats.js` judge | `generator:stats` | **P45-10 已修**：题面零「（标出 Ncm）」 |
| X9 | 8 | `percent.js` L196/L302/L333/L374 + `semantic-relations.js` L472/L600/L752 | `generator:percent` / `semantic-relations` | **P45-10 已修**：内层「列式：」改「算式：」，题面零重复列式 |
