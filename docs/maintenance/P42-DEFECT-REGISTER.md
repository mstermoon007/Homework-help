# P42-DEFECT-REGISTER — 质量缺陷登记

> 审计日期：2026-10-14 | 版本：5.2.0 | 基线：P42-BASELINE.md  
> P42-1A 复核：2026-10-18（seed 逐一复现 + 独立数学重算，见 §0；复核时 git 顶端 `b65e83d`）  
> P42-1B 修复：2026-10-18（P42-003~009 已修复，见 §0.5；`concept-meaning.js` makeByItem 解析拼装 + 新增真值回归测试）  
> P42-1C 验证器：2026-10-18（独立数学真值验证器 + 1570 全量面审计，见 §0.6；面审计新发现 P42-031/032）  
> P42-5 真值门：2026-10-19（golden build 写入前接入独立重算器，027 残余闭合，见 §0.13）  
> P42-6 判据④′：2026-10-19（judge 布尔答案判据④′落地，watch 133→52，见 §0.14）  
> P42-7 结论词补齐：2026-10-19（§0.14 新观察 judge 27 行结论词模板缺口根因修复，watch 52→25，见 §0.15）  
> P42-8 符号答案归一：2026-10-19（watch A 类 9 行 scorer 字符集缺口修复，watch 25→16，B 类 16 行归 025，见 §0.16）  
> P42-9 弱判定审计：2026-10-19（零代码改动——④子串对 59.6% 短答案面恒真、③仅等号命中 33%，explanationQuality 阈值语义与设计意图漂移，025 重定性为判据重构，见 §0.17）  
> **025 处置终态：暂不立项执行**（用户指令 2026-10-19「执行即可，暂不做独立立项」）——判据④重构维持登记缓办，watch 16 行维持 025 终态登记。  
> P42-10 common.js 解耦：2026-10-19（方案 1——common.js Node 聚合序列 4→1，check/ui-state/storage 摘出由真实消费方直取，practice-session 解除对 common.js 依赖，浏览器分支零改动；缺陷登记零触碰，详见 docs/P42/change-log.md P42-10）  
> P42-11 推送前整理：2026-10-19（当前态文档对账——测试 936/101、门禁 34 项、Syntax 342 按实测对齐，375/98/373/1570 与版本四方零漂移；死代码 [15] pickOpt 三方零调用物理删除，详见 docs/P42/change-log.md P42-11）  
> 状态含义：`已证实` = 可复现样本+根因定位；`疑似` = 现象明确但根因未定位；`覆盖缺口` = 无自动验证手段；`待人工` = 需教学专家判断；`误报` = 复核后判定原审计 FAIL 为审计工具解析缺陷所致，生成器产出数学正确

---

## §0 P42-1A 逐例复核记录（2026-10-18）

> 复核口径：以登记复现命令（`count:1`，seed `p42|<kp>|<qt>|d3`）逐一复现出与登记所引完全一致的样本，对**题干 / 答案 / 解析**三者分别独立数学重算后判定。带余除法按「商……余数」记法判定，分数按等值分数判定，百分数按 0.xx=xx% 判定，多步/链式算式整体求值，不以子串截断判定。git 顶端 `b65e83d` 与审计时一致，排除代码变动因素。
> 原始表（§1 下首表）为审计当日记录，保留不改；本节结论为准。

### §0.1 结论汇总（18 例 → 7 例确认 / 11 例误报）

| 编号 | 复核判定 | 独立重算要点 |
|---|---|---|
| P42-001 | **误报** | 20÷3=6 余 2 ✓；解析完整为 `20 ÷ 3 = 6……2`，审计截断余数后按浮点除法误判 |
| P42-002 | **误报** | 19÷6=3 余 1 ✓；同上（`19 ÷ 6 = 3……1`） |
| P42-003 | **确认** | 答案 39 ✓；解析尾句 `先算 5 + 8 = 39` ✗（应 13） |
| P42-004 | **确认** | 答案 28 ✓；解析尾句 `第一步 15 + 18 = 28` ✗（应 33） |
| P42-005 | **确认** | 答案 9 ✓；解析尾句 `9 × 2 = 9` ✗（应 18） |
| P42-006 | **确认** | 答案 19 ✓；解析尾句 `如 19 ÷ 2 = 19` ✗（应 9……1） |
| P42-007 | **确认** | 答案 10 ✓；解析尾句 `10 ÷ 2 = 10` ✗（应 5） |
| P42-008 | **确认** | 答案 13 ✓；解析尾句 `如 5 × 6 = 13` ✗（应 30） |
| P42-009 | **确认** | 答案 19 ✓；解析尾句 `如 5 × 6 = 19` ✗（应 30） |
| P42-010 | **误报** | 1/3=5/15 ✓；解析完整为 `1/3 = 5/15`，审计把分母 `/15` 截成分子右值 |
| P42-011 | **误报** | 1/5=2/10 ✓；同上（`1/5 = 2/10`） |
| P42-012 | **误报** | 1/6=3/18 ✓；同上（`1/6 = 3/18`） |
| P42-013 | **误报** | 3×5+1=16 ✓；解析完整为 `3a + 1 = 3 × 5 + 1 = 16`，审计子串匹配出 `5 + 1 = 16` |
| P42-014 | **误报** | 2/10=0.2=20% ✓；解析完整为 `二成 = 2/10 = 20%`，审计剥离 `%` 后判 0.2≠20 |
| P42-015 | **误报** | 3.5/10=0.35=35% ✓；同上（`三成五 = 3.5/10 = 35%`） |
| P42-016 | **误报** | 1/10=0.1=10% ✓；同上（`一成 = 1/10 = 10%`） |
| P42-017 | **误报** | 3/4÷1/4=3 ✓；解析 `除数 = 被除数 ÷ 商：3/4 ÷ 1/4 = 3` 方法与数值均正确；审计把 `÷` 当链式除法算得 0.1875 |
| P42-018 | **误报**（且样本归属有误） | 3/6×2=6/6=1 ✓；解析 `3/6 × 2 = 6/6，约分得 1` 正确，审计把 `6/6` 截成 `6`。**归属修正**：样本实属 `math-g6-up-u02-k001`（分数乘整数，`shape.js makeFractionTimesIntegerQuestion`），非登记所写 `math-g6-up-u03-k002` |

### §0.2 复现证据（count=1，与登记样本逐字一致）

| 编号 | 题干 | 答案 | 完整解析（复核实取） |
|---|---|---|---|
| 001 | 填空：____ ÷ 3 = 6……2 | 20 | 空格里填 20：20 ÷ 3 = 6……2，等式成立 |
| 002 | 填空：____ ÷ 6 = 3……1 | 19 | 空格里填 19：19 ÷ 6 = 3……1，等式成立 |
| 003 | 先算小括号里面的：(5 + 8) × 3 = 13 × 3 = ？（先算 5 + 8 = 13） | 39 | …结合起来看：**先算 5 + 8 = 39**。 |
| 004 | 按脱式计算规范一步一步算：15 + 18 − 5 = 33 − 5 = ？（第一步 15 + 18 = 33） | 28 | …结合起来看：**第一步 15 + 18 = 28**。 |
| 005 | 用一个数依次乘 1、2、3……可以找它的倍数：9 × 2 = 18，9 × 3 = 27。9 最小的倍数是多少？ | 9 | …结合起来看：**9 × 2 = 9**。 |
| 006 | 不是 2 的倍数的数是奇数，如 19 ÷ 2 = 9……1。下面哪个数是奇数？ | 19 | …结合起来看：不是 2 的倍数的数是奇数，**如 19 ÷ 2 = 19**。 |
| 007 | 10 ÷ 2 = 5 没有余数，____ 是 2 的倍数 | 10 | …结合起来看：**10 ÷ 2 = 10**，所以答案是 10。 |
| 008 | 一个数只有 1 和它本身两个因数就是质数（如 5 × 6 = 30，30 有多个因数，是合数）。下面哪个数是质数？ | 13 | …结合起来看：**如 5 × 6 = 13**。 |
| 009 | 在 19、12、15 中，____ 只有 1 和它本身两个因数，是质数。 | 19 | …结合起来看：**如 5 × 6 = 19**，所以答案是 19。 |
| 010 | 分数的基本性质，在 ____ 里填数：1/3 = ____/15 | 5 | 分数的基本性质：分子分母同时乘 5，1/3 = 5/15，所以填 5。 |
| 011 | 分数的基本性质，在 ____ 里填数：1/5 = ____/10 | 2 | …同时乘 2，1/5 = 2/10，所以填 2。 |
| 012 | 分数的基本性质，在 ____ 里填数：1/6 = ____/18 | 3 | …同时乘 3，1/6 = 3/18，所以填 3。 |
| 013 | 当 a = 5 时，3a + 1 = 3 × 5 + 1 = 多少？ | 16 | …结合起来看：当 a = 5 时，3a + 1 = 3 × 5 + 1 = 16。 |
| 014 | 列式：把二成改写成百分数，2 ÷ 10 = （ ）%（只填数字）。 | 20 | 成数表示十分之几，也就是百分之几十：二成 = 2/10 = 20% |
| 015 | 三成五 = ____%（只填数字） | 35 | …三成五 = 3.5/10 = 35% |
| 016 | 农业收成常用「成数」表示：一成改写成百分数是多少？（只填数字） | 10 | …一成 = 1/10 = 10% |
| 017 | 在 ____ 里填上合适的数：3/4 ÷ ____ = 1/4 | 3 | 除数 = 被除数 ÷ 商：3/4 ÷ 1/4 = 3。 |
| 018 | 看图填空：分数条…合起来是 3/6 × 2 = ____（KP=math-g6-up-u02-k001） | 1 | 分数乘整数，用分子乘整数的积作分子、分母不变：3/6 × 2 = 6/6，约分得 1 |

> 批内发生率佐证（count=10/30 批量复现）：003/004/005/006/007/009 各批全部实例同型错误（10/10 或批内全量），008 批仅产出 1 例亦错——属模板级系统缺陷，非个例。

### §0.3 确认缺陷（003~009）统一根因

7 例同源：`shared/generator/generators/concept-meaning.js` `makeByItem` 解析拼装段（约 1152-1181 行）。

- 各 builder（`buildBracketOrderItem` / `buildStepwiseItem` / number-theory 倍数·奇偶·质数分支）产出的**题干均正确**（含正确的中间结果，如 `（先算 5 + 8 = 13）`）。
- 缺陷在解析拼装两处：
  1. **calc 路径（~1167-1168）**：`explanation = expr + ' = ' + answer` —— 把**最终答案**填为提取支撑算式的右值；即使算式自带正确中间结果 `exprAns`（003 的 13、004 的 33、005 的 18）也被忽略。
  2. **exprAns 失败回退（~1163-1164）**：支撑算式尾部非纯数字时（006 的 `9……1` 带余形、008/009 的尾部含说明文字 `30，30 有多个因数，是合数`），`exprAns` 解析失败，回退取最终答案，再经 fill/calc 拼接写出错误等式。
- `semantic-parameters.js:513` 的「结合起来看」桥接前缀仅拼接 `current`（生成器原解析），非缺陷源。
- **P42-1B 修复范围据此收敛为单一模块**：`concept-meaning.js makeByItem` 解析拼装（calc/fill 两分支 + exprAns 回退），不涉及 KBL/难度/题型。修复需同时覆盖 003~009 七个模板形态并各配失败反例+正向回归。

### §0.4 审计工具解析缺陷清单（供 P42-1C 真值验证器规避，均为本轮误报成因）

1. **带余除法**：`商……余数` 记法被截断为 `商`，再按浮点除法判定（001/002）。
2. **分数截断**：`a/b` 形态在等式右值位置被截成 `a`（010/011/012/018）。
3. **子串误匹配**：多步/链式算式内嵌的单步等式被独立摘出判定（013：`3 × 5 + 1 = 16` 内摘出 `5 + 1 = 16`）。
4. **百分号剥离**：`20%` 被剥成 `20` 参与数值比较（014/015/016）。
5. **÷ 语义**：`a/b ÷ c/d` 被当连除链计算（017：算得 (3/4)/1/4=0.1875）。

> P42-1C 扩展重算器时，以上五类为**必须正确处理的最小集**；处理不了的样本须记 UNVERIFIED，不得复刻同类误报。

### §0.5 P42-1B 修复记录（2026-10-18）

**改动范围（唯一）**：`shared/generator/generators/concept-meaning.js` `makeByItem` 解析拼装段（约 1154-1193 行）。题面/答案/题型/难度/KBL 零改动。

修复三点（对应 §0.3 两处缺陷 + count=10 批量发现的同根因第二变体）：

1. **exprAns 提取扩展**：支撑算式右值不再只认纯整数——接受「整数」「整数……余数」（带余除法记法，其后允许跟教学尾注如 `。下面哪个数是奇数`）、「前导整数+尾注」（`30，30 有多个因数`、`5 没有余数`）；前导整数后紧跟运算符/省略号（`33 − 5` 未完链式）不提取，保持既有整体等式回退。supCore 尾部标点剥离由 `？?` 扩展为 `？?。！!`。
2. **calc 右值修正**：exprAns 与最终答案不同时，解析写 `expr = exprAns，所以答案是 answer`（不再把最终答案填作中间步骤右值）；相同（含负号记法归一）时维持原拼接。
3. **空位守卫（第二变体）**：支撑串含 `____`（整句题干非算式）时不拼接任何等式，诚实退化为「答案是 X」——消除 count=10 批量发现的 `____ 不是 2 的倍数 = 23` 假等式。

**失败反例 → 正向回归**：`tests/generation/p42-1b-explanation-equation-truth.test.js`（新增）
- Part 1 七缺陷族全 seed 面（7 KP×题型 × d1..4 × v0..3 = 112 题）：解析内数值等式逐段独立重算必须成立（÷ 支持「商……余数」）、空位不得被拼成等式。修复前 **FAIL**（112/112 假等式，如 `先算 4 + 2 = 24` 实为 6）；修复后 PASS。
- Part 2 七个登记种子（`p42|kp|qt|d3`，count=1）经 PracticeSession 全链复现：修复后解析逐字为——

| 编号 | 修复后解析尾句（答案不变） |
|---|---|
| 003 | 先算 5 + 8 = 13，所以答案是 39。 |
| 004 | 第一步 15 + 18 = 33，所以答案是 28。 |
| 005 | 9 × 2 = 18，所以答案是 9。 |
| 006 | 不是 2 的倍数的数是奇数，如 19 ÷ 2 = 9……1，所以答案是 19。 |
| 007 | 10 ÷ 2 = 5，所以答案是 10。 |
| 008 | 如 5 × 6 = 30，所以答案是 13。 |
| 009 | 如 5 × 6 = 30，所以答案是 19。 |

**门禁证据**：`npm test` 896/896 PASS；`node dev/check-all.js` **32 PASS / 0 FAIL / 1 SKIP / 33 项**（与 P42-BASELINE 持平）；`npm run build:strategy` 重建 bundle 后 16/17 确定性门禁 PASS；6a/6b（1570 真实生成 + 矩阵冻结）PASS——解析不入 questionFingerprint，矩阵零影响（实跑证明）。

**登记状态**：P42-003~009 标记为**已修复**（本节为准）；P42-001/002、010~018 维持误报；P42-019 及之后各行不变。

### §0.6 P42-1C 记录（2026-10-18）：独立真值验证器 + 1570 全量面审计

**交付物（全部位于 dev/ 审计层与 tests/，零生产链改动）**：

1. `dev/p42/truth-verifier.js` —— 独立数学真值验证器（只读，非生产链）：
   - 精确有理数运算（整数/小数/分数原子/百分数原子/括号；交叉相乘判等，不用浮点）；
   - 等式逐「=」分段取相邻对，左段取尾部完整表达式，**不做跨段子串匹配**（规避 §0.4 之 3）；
   - 「商……余数」仅对单步除法断言验证 b×q+r=a 且 0≤r<b（规避 §0.4 之 1）；
   - 分数原子整体求值（规避 §0.4 之 2/5）、百分数原子 =值/100（规避 §0.4 之 4）；
   - 不可判定一律 UNVERIFIED（跳过不判错）：含拉丁字母（代数式）、不可解析、未完链式、位值短语（「1 个十和 7 个一」）、比号 ∶ 比例式、复合数（「12万3千」）；
   - 精确支持的扩展记法：全角运算符 ＋－＊／＝、万/亿计数单位（其后无数字时精确缩放）；
   - 空位代入一致性：恰一空位且答案为标量/分数时代入；空位后随「/N」为**分子位**（分数答案须分母吻合才代入分子 a，防「6/12/12」伪影；标量答案即分子直接代入）；
   - judge 题干等式是「被判断对象」非真值声明 → 题干跳过记 UNVERIFIED（「断言真假 ↔ 答案布尔一致性」属新语义校验，留待后续批次）。
2. `tests/generation/p42-1c-truth-verifier.test.js` —— 9 组断言：§0.4 五类最小集逐类 PASS/FAIL 控制组、边界 UNVERIFIED、空位代入、judge 题干、分子位空位，及 18 例登记样本全链判定。
3. `dev/p42/audit-truth-face.js` —— 1570 确定性面审计（seed `p42|<kp>|<qt>|d3`，count=1，d3），结果落 `dev/p42/out/p42-1c-truth-audit.json`；FAIL>0 时 exit 1（有意设计）。

**18 例登记样本**：P42-001~018 经 PracticeSession 确定性复现后 `auditQuestion` 逐例 **PASS**（7 例 1B 修复后解析等式为真；11 例原误报在独立验证器下确认为真等式）。

**1570 全量面结果**（首轮 38 FAIL → 验证器补齐六类解析盲区后收敛，两轮复跑数字稳定）：

| 指标 | 值 |
|---|---|
| PASS | 769 |
| FAIL | **4（全部为真缺陷 → 登记 P42-031/032，按纪律不顺手修）** |
| UNVERIFIED | 797 |
| 有断言题数 | **773/1570**（PASS 769 + FAIL 4；P42-0 审计口径仅 457 例可脚本自检） |
| 覆盖子句 | 1031（题干 228 + 解析 803） |

首轮 38 FAIL 甄别：**34 条为验证器解析盲区**（全角运算符未归一 21、万/亿单位 2、位值短语裸原子截取 1、比号 ∶ 截断 8、judge 题干断言语义 1、分子位空位代入伪影 1），已全部修复并配 ⑧ 组回归断言（修复前 FAIL → 修复后正确档位）；其余 **4 条为真缺陷**，登记 P42-031（`concept-meaning.js` 同拼接点新变体 ×3 题型行）与 P42-032（`fraction.js` 约分列式右值混用 ×1 题型行），留待后续批次修复。

### §0.7 P42-1D 记录（2026-10-18）：Golden Dataset 独立真值校验

**交付物（dev/ 审计层，零生产链改动）**：`dev/p42/audit-golden-truth.js` —— 对 `kbl/teaching/golden-questions.json` 全量 1114 题逐题调用 P42-1C truth-verifier（题干空位代入一致性 + 解析等式真值，judge 题干跳过语义沿用），结果落 `dev/p42/out/p42-1d-golden-truth-audit.json`；FAIL>0 时 exit 1。

**结果**：

| 指标 | 值 |
|---|---|
| PASS | 559 |
| FAIL | **0** |
| UNVERIFIED | 555 |
| 覆盖子句 | 723（题干 186 + 解析 537） |

**结论**：金题集独立数学重算**零缺陷**——P42-027「系统性错误会被冻结入金标」的覆盖缺口以审计证据闭合（现存数据无系统性错误）；「golden build 步骤强制接入重算器」属派生链改动，登记维持原建议、留待按需立项。UNVERIFIED 555 题为解析无等式断言/汉字成数/代数式等不可解析形态，符合「处理不了记 UNVERIFIED 不判错」纪律，无复刻误报。

**门禁误报记录**：本脚本首版曾触发 P28-33 KBL 写边界门禁两层启发式误报——① `dataset: 'kbl/…'` 标注内联在 writeFileSync 参数表达式内，被 argExpr 跨行提取后判为 kbl 写路径；② 输出文件名 `p42-1d-golden-truth-audit.json` 的标识符 token `golden` 与读取 kbl 的种子变量名撞名。修复：payload 提取为独立变量 + 读取变量改名 `goldenData`（脚本头注释已记规避要点）；门禁本身零改动。修复后 check-all 32 PASS / 0 FAIL / 1 SKIP 与基线持平。

### §0.8 P42-2A 记录（2026-10-18）：教学目标匹配缺陷修复（P42-019 + 020~022）

**范围定位**：登记优先级表 P42-2 组 = 019（apply 问「后一个」答双值）+ 020~022（G2 度量单位超纲）；024 待人工不动。

**改动范围（两处单点根因，零第二套语义表）**：

1. `shared/generator/generators/concept-meaning.js` 顺序分支（P42-019）：
   - 复用 P32-AS-11 分型答案机制：`applyAnswer: String(cur + 1)` 收敛为单一结论；`conclusion: false` 显式关闭 makeByItem 对 stem 双值变体的「；」附注（conceptConclusion 守卫扩 `item.conclusion !== false` 一处——该机制面向独立概念结论，builder 显式关闭属既有逃生口，非新兼容层）；
   - 情境句按 P32-AS-16 口径：删完整证明（前/后双参考），内嵌前向 scaffold `（cur + 1 = ？）`，使解析列式随题问切到前向算式。
   - 命中面（canonical 扫描证实）：仅 `math-g1-down-u03-k005 数的顺序`；G3/G4 运算顺序 KP 属 arithmetic 域不路由此分支，行为零变化。
2. `shared/generator/generators/money.js`（P42-020~022）：
   - `getMoneyMeta`：KP 名称显式列举 ≥2 个本族单位时认领为该 KP 显式单位集合 `kpUnits`（长单位名优先认领 + 占位符顶替已认领段，防「千米」吞出「米」）；
   - `makeMeasurementConversionQuestion`：`meta.kpUnits` 存在且命中 ≥2 单位时收窄换算双方 ⊆ 该集合；名称无 ≥2 单位信号 → `null`，维持族级全表（行为零变化）。
   - 数据合规：单位白名单信号只取自 KBL KP 名称本身（T1 数据信号 → 运行时投影），未内联第二套语义表，符合 P30 §3。
   - 命中面：仅 `math-g2-up-u05-k001 认识厘米和米`（认领 厘米/米）；其余度量 KP（测量方法/合适的长度单位/时间单位换算/面积族等）名称无 ≥2 单位信号。

**失败反例 → 正向回归**：`tests/generation/p42-2a-teaching-goal-match.test.js`（新增，5 测试）
- Part 1（019）：登记种子 PracticeSession 复现断言（answer=`77`、解析列式前向 `76 + 1`、无「75 和 77」双值污染、无后向参考式）+ 全 seed 面 d1..4×v0..3=16 样本 generator 直调 + calc/fill 正向对照（双值语义不变）。
- Part 2（020~022）：登记种子 choice/fill/judge d3 断言无超纲单位（`/毫米|千米|分米/`）+ 全 seed 面 4 题型×d1..4×v0..3=64 样本。
- 咬合证明：修复前旧代码 5/5 FAIL → 修复后 5/5 PASS。

**修复后样本**：`p42|math-g1-down-u03-k005|apply|d3` → prompt=`发牌时数到 76，它前一个是 75，后一个数是多少？（76 + 1 = ？）`，ans=`77`，解析=`…题意：…（76 + 1 = ？）。 列式：76 + 1，计算：76 + 1 = 77。答：77。`；`p42|math-g2-up-u05-k001|choice|d3` → 换算双方仅 厘米↔米（如 `6厘米 换算成 米 是多少？`）。

**改后动作链（P30 §9 全触发）**：
- `npm run build:strategy` 重建 strategy-engine.bundle.js（测试/审计走冻结 bundle）；
- 改题面/答案文案 → 重跑 `dev/p27/derive-variation-profiles.js` + `dev/p27/derive-misconceptions.js`（slots 969→971：概念混淆 +1、格式错误 +1）；
- T2 镜像同步：P40-T-03 断言要求 build emit 前源↔副本一致（P39 先例：build.js 镜像拉回源真值），按源真值同步 `shared/knowledge/teaching/misconception-profiles.json` 后 `tools/kbl/build.js` 重冻通过，rootHash=`77f69012…`（两 manifest 回填）；
- 6e maker 分工矩阵重冻（`dev/p30/check-kp-qt-maker-matrix.js --write`）；6b 生成矩阵重冻（`dev/p28/check-generation-matrix-freeze.js --write`，1570 行 / FAIL 0）。

**门禁证据**：`npm test` **910/910 PASS**（905 + 新增 5）；`node dev/check-all.js` **32 PASS / 0 FAIL / 1 SKIP / 33 项**（与基线持平）。

**登记状态**：P42-019、P42-020~022 标记为**已修复**（本节为准）；P42-024 维持待人工；P42-023/025/030 维持 P42-3 组。

### §0.9 P42-2B 记录（2026-10-18）：教学目标本质参与度检查器 + 1570 面审计（新发现 P42-033）

**定位**：基线 §6.3 缺口 3（`kp-semantic-validator` 仅声明制检查——KP ID/题型/运算/范围/结构/证据声明/intent 对齐，不验证「目标 KP 必须参与解题」）+ 基线 §7 P42-2 建议（「KP 必用性」静态规则先行）；同批交付登记 P42-023（跨 KP prompt 复用指标）与 P42-025（apply 答案结构化分类）工具。

**交付物（dev/ 审计层，零生产链改动）**：

- `dev/p42/participation-checker.js` —— 三族静态规则纯函数：
  - **P1 复用指标** `reuseMetrics`：prompt 精确分组 + 数字归一模板分组，组内 ≥2 KP 告警；
  - **P2 概念回指差分** `differentialCheck`：KP 名称概念词提取（教学功能词剥离、META 活动词逃逸、记法/符号映射：加减乘除符号/小数/分数/百分数/人民币/长度/质量/时间单位）→ 检索域 = 题干+选项+解析+答案值+data 关键字段 → 差分判定（同 KP 内有行回指、有行不回指 → 不回指行 FAIL 候选；全 KP 零回指或名称无内容词 → UNVERIFIED，高精度优先，避免全量关键词匹配的误报海）；
  - **P3 apply 答案结构化分类** `classifyApplyAnswer/classifyApplyFace`：placeholder/numeric/fraction/percent/definition/short-text/text，仅计数不判真伪。
- `tests/generation/p42-2b-participation-checker.test.js`（6 测试）：概念词提取控制组、记法/META 逃逸控制组、差分判定控制组、P1 告警口径、P3 六形态、真实生成面接线抽样。
- `dev/p42/audit-participation-face.js`：1570 确定性面审计（seed `p42|<kp>|<qt>|d3`，与 1C 同面可对比），结果落 `dev/p42/out/p42-2b-participation-audit.json`。

**面审计结果（1570 面）**：

| 族 | 结果 |
|---|---|
| P1 精确组 | **64 组**（与基线 §3「64 组」口径完全吻合），最大扇出 9 KP |
| P1 模板组 | 179 组（数字归一后），最大扇出 61 KP、跨年级 118 组 |
| P2 | KP 口径 withSignal 167 / noSignal 42 / noHit 166（后两类按设计记 UNVERIFIED 覆盖缺口）；候选 **47 行** → 甄别 **真缺陷 33 行（14 KP 组，登记 P42-033）+ 弱参与 2 行 + 工具字面误报 12 行** |
| P3 | apply 375 行：numeric 184 / text 97 / short-text 66 / fraction 21 / placeholder 7 |

**P2 候选甄别明细**：

- **真缺陷 33 行 / 14 KP 组**（全清单见 P42-033 条目）：图形运动 6 KP 全部 serve 方向位置题；乘除法 KP 全乘法除法零出现；平行与垂直 KP 全角度拼合；体积 KP 全整数加法（跨学段错位最严重）；混合运算 KP 全整数算术；正/反比例概念互串（解析明写对方概念）；最优策略 KP 全数列题；约分与通分 1 行题面明写「分数的基本性质」（k004 独立 KP 内容）。
- **弱参与边界 2 行**（不判缺陷，待人工）：`math-g1-up-u05-k001` 凑十法 choice（凑十过程零呈现）、`math-g5-down-u04-k003` 真分数和假分数 apply（产 5/8 未辨真假）。
- **误报 12 行**（工具字面局限，不登记缺陷）：g4-down-u05-k003 ×4（3-4-5 短边之和为三角形三边关系实例参与）、g6-up-u04-k001 ×3（「圆」单字被保守过滤，行内容即圆）、g3-up-u06-k001 ×1（110 报警编码为 G3 编码主题本质参与）、g5-up-u06-k005 ×1（估算方法参与）、g6-up-u02-k001 ×1（4/6×2 分子乘整数实例参与）、g5-down-u04-k005 choice ×1（解析明写「约成 4/5」，「约成」未匹配 token「约分」）、g6-down-u04-k004 calc ×1（正比例应用题解析用「归一」表述，实质参与成立）。

**已知局限（登记，不在本批修复）**：① 单字概念词保守丢弃（数/形/点等单字正查噪声大）；② 名称无信号 42 KP 与全零回指 166 KP 记 UNVERIFIED——差分判定以高精度为先；③ 记法映射覆盖有限（「约成/约分」类近义词未入映射）；④ P1 模板组数字归一仍可能含残留变体。

**纪律**：零生产链改动（仅 dev/ 审计层 + tests/）；真缺陷只登记不顺手修；功能词表/META 词表/记法映射属审计工具解析知识，不内联 shared/（P42-1C truth-verifier 先例）；基线口径 375/98/373/1570 零变动。

**门禁证据**：回归 `node --test tests/generation/p42-2b-participation-checker.test.js` **6/6 PASS**；`npm test` **916/916**（910+6）；`node dev/check-all.js` **32 PASS / 0 FAIL / 1 SKIP**（与基线持平）。

---

### §0.10 P42-2C 记录（2026-10-18）：P42-033 跨 KP 错挂家族根因修复

**修复口径**：信号式收窄——KP 名称信号分派（canonical 名称唯一性先核实）、意图闸门镜像、T2 冻结值对齐；零 KP 白名单硬编码、零答案绕过。33 行逐行经登记 seed（`p42|<kp>|<qt>|d3`）反例断言 + token 回指正向断言（`tests/generation/p42-2c-cross-kp-family.test.js` 7 用例，含 mixed 同族 7 KP 零变化面）。

**modified（7 生成器）**：
- `semantic-relations.js`：正/反比例名称信号分派 maker（makeInversePropTyped / makeDirectPropApply，替换跨 KP 错挂模板）+ k005|choice 补题面（此前 0 产出）+ 行船答案单位「条」收口
- `arithmetic.js`：k003 四题型意图闸门镜像配图（balance/groups，role=calculation-support；此前 0 产出）+ judge 题面前缀「用运算律简便计算」（token 进检索域）
- `position.js`：translation/rotation/clockHand 三 helper unitPx 30/34→35（对齐 T2 平移族冻结值；已验证零外溢——30 为质量单位族 rectangle 专属，translationDemo/rotationDemo 无 30/34 冻结行）
- `fraction.js`：约分/通分 fill 名称门控（脱离「分数的基本性质」模板）+ 解析补等值等式
- `reasoning.js`：7~9 乘除法除法 token 奇偶轮换（calc/choice/apply 三题型）+ 最优/统筹名称信号 + apply 形态轮换前移
- `shape.js`：平行与垂直 KP 语义参与
- `application.js`：不规则物体体积 KP 语义参与

**T2/T3 与冻结产物**：
- `kbl/teaching/evidence-rules.json` 7 行 15 断言就地修正（P40 先例 commit 62df71f 口径；逐条 before/after 见 `docs/P42/change-log.md`）：g5u4k1 geometry/apply 场景兜底签名（position-grid/gridSize/showGrid/gridColor/shapeName「空间」）→ 修复后 translationDemo 真实签名（shapeName「平移」）；g5d8k2|apply 删 data.steps（按 variant 3/2/2 变动非稳定字段）；k004|apply proportion inverse→direct、k005 calc/fill/choice direct→inverse（旧值冻结自修复前错挂产出，反向适配生成器=假语义，故改 T2）
- 派生重跑：variation-profiles + misconception-profiles（答案文案变更触发）；T3 镜像同步（misconception-profiles）+ build.js rootHash 重冻（a83db4cf…）
- 6b 重冻：1570/1570、FAIL=0、frozen=true、kpSemFail=0；6e 只读复核通过；6g AS-18 白名单 +1 登记（g6-up-u02-k003 fill「0.25」——此前该行被意图闸门拒绝 0 产出，修复后首进扫描；分配律填空空位求公因数，0.25 为题面已给展开左半操作数，B-OPERAND 非答案复述）
- P2 面审计复跑：候选 47→**14**（33 缺陷行差分清零，残留 = 2 弱参与 + 12 工具误报，与 §0.9 甄别一致）

**收口过程中修正的批次自引入缺陷 2 例**（各配反例）：
1. k005|choice 行船选项单位「次」→「条」：题面问「多少条船」，初次收口误沿用货运模板单位（探针取证后修正）
2. 约分 fill 解析无等值等式 → 独立真值验证器 checked=0 UNVERIFIED（P42-011 反例暴露）→ 解析改写为「约分：2/10 = 1/5，分子分母同时除以公因数 2」（与同文件 calc 分支文案同形）

**门禁证据**：定向 7/7 + 1C 回归 9/9；`npm test` **923/923**（916+7）；`node dev/check-all.js` **32 PASS / 0 FAIL / 1 SKIP**（与基线持平）。

**risk**：①T2 就地修正不可再生（derive/apply 派生器键冲突即失败、不支持行内更新），已按 P40 先例在 change-log 全量披露 before/after；②改后行为仅限登记 33 行及其同 maker 相邻行（探针取证 mixed 面零变化）；③未 git commit。

---

### §0.11 P42-3 记录（2026-10-19）：P1 复用指标分级阈值治理 + P42-030 CI Chrome 闭合

**范围定位**：优先级表 P42-3 组残余 = 阈值治理（023/025 工具收口）+ 030（CI Chrome）；分级阈值模型经用户批准。

**交付物一：P1 阈值治理（dev/p42 审计层，零生产链改动）**

- `dev/p42/participation-checker.js`：单一硬编码「组内 ≥2 KP 告警」治理为具名分级阈值 `REUSE_THRESHOLDS`——精确组 `EXACT_ALERT_MIN_KP=2` alert（维持基线 §3 已知设计口径）；模板组 `TEMPLATE_ALERT_MIN_KP=10`：≥2 watch（记录级）/ ≥10 alert。阈值 10 依据：精确组历史最大扇出 9，数字归一后仍跨 ≥10 KP = 超出任何同字面共享的模板签名缺失强信号；2~9 KP 模板组多为小数字域自然撞车（面实测 2-KP 组 91 个）。`reuseMetrics` 返回扩展 `{ groups, alerts, watch }`（组级 `alert`/`watch` 布尔），组集合零丢失仅分级。
- `dev/p42/audit-participation-face.js`：P1 console + JSON 增 watch 层（summary 增 `templateWatchGroups`/`templateWatchMaxFanout`；`templateWatch` 落 {key, kpCount} 明细）。
- `tests/generation/p42-2b-participation-checker.test.js`：P1 断言随治理决策重写（旧「模板 3 KP 告警」→ watch；新增 ≥10 alert、alert/watch 互斥控制组；精确组语义保留）。

**面实测（治理后复跑，seed `p42|<kp>|<qt>|d3`，1570/1570，sessionErrors 0）**：

| 层 | 组数 | 口径 |
|---|---|---|
| 精确 alert | 62（最大扇出 9） | ≥2 KP（基线 §3 口径） |
| 模板 alert | **14**（全部跨年级，最大扇出 61） | ≥10 KP |
| 模板 watch | 164（最大扇出 9） | 2~9 KP（记录级） |

治理前模板告警 178 组（2B 口径）→ 14 行动级 + 164 记录级（降噪 92%）；P2 候选 14（= §0.10 残留：2 弱参与 + 12 工具误报）不变；P3 分类如实记录 2C 后小漂移（numeric 191 / text 97 / short-text 59 / fraction 21 / placeholder 7）。

**交付物二：P42-030 闭合（证据 + 登记，零代码改动）**

- CI 配置核实在位：`.github/workflows/ci.yml` 自 FINAL-12（commit 6923761）起即设 `REQUIRE_BROWSER_E2E=1` + `CHROME_BIN=google-chrome`；环境要求已文档化（`docs/10-TEST-CI.md` §Browser E2E 语义表）。
- 含 Chrome 环境实测（030 验收「发布前必须在含 Chrome 环境跑满 33/33」）：macOS 本机 Chrome（`CHROME_BIN=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`）——单跑 9 步 E2E **PASS**（打印 10 卡、五断言全过）；全量 `node dev/check-all.js` **33 PASS / 0 FAIL / 0 SKIP / 33 项**（第 15 项首次本地真实执行，P42 战役首次满编；FINAL-91 只读门禁 PASS）。
- 过程记录：首轮全量 run 出现 `E2E ERROR: timeout: index ready` + FINAL-91 register 差异——甄别为**两个 check-all 实例并发**的瞬态（旧后台任务未被会话重启回收，两 E2E 实例抢端口/资源；register 批注编辑恰落两实例快照窗口之间），非产品缺陷；单实例重跑即 33/0/0，单跑 E2E 亦 PASS。

**登记状态**：P42-030 → **已闭合**；P42-023 → 指标化（2B）+ 阈值治理（本批）完成，「模板 KP 签名」属生成器模板改造留待按需立项；P42-025 → 分类工具 + 概念覆盖差分（均 2B）在位，非数值答案自动真值/结构化评分属语义增强留待按需立项。

**门禁证据**：定向 `node --test tests/generation/p42-2b-participation-checker.test.js` **6/6**；`npm test` **923/923**；`node dev/check-all.js`（CHROME_BIN 就位）**33 PASS / 0 FAIL / 0 SKIP / 33 项**。

**risk**：低——零生产链改动（checker/audit 均 dev/ 审计层 + 测试）；阈值 10 为面实测数据依据非拍定；面审计 exit 1 为既定语义（P2 候选>0 须甄别）。未 git commit。

---

### §0.12 P42-4 记录（2026-10-19）：031/032 生成器真值根因修复 + 028/029 实例级门禁落地

**范围定位**：优先级表 P42-1 组 031、P42-1(并行) 组 028/029/032；三项用户裁决——032 列式右值=本步商 ca（非 gcd 口径）、029 分级门禁（硬底线 0.5 + watch 0.6）+ 修登记样本行、028/029 门禁合一文件一项（check-all 33→34 项）。

**交付物一：P42-031 修复（concept-meaning.js makeByItem 纯算式形态守卫）**

- 根因：句子型支撑串（教学指令句，如「仿照 7 ÷ 2 的做法……看余数是不是 0」）被整体当算式——旧「含运算符+数字」粗判放行 → eqTail 无 `=` 可提取 → exprAns 回退最终答案 → 拼出假等式「…看余数是不是 0 = 28」。与 003~009 同拼接点，1B 空位守卫未覆盖的「句子非算式」姊妹形态。
- 修复：抽取块重构为双通道守卫——`exprAnsFromTail` 仅从「=」尾提取（纯整数 /「商……余数」/ 前导数字且非未完链式）；`exprFormOk` 纯算式形态（首字符数字/负号、无句读逗号、无空位）；守卫 `(exprFormOk || exprAnsFromTail != null)`：句子型支撑串 → expr 整体置 null，诚实退化「答案是 X」；例外保留「支撑串自带 = 右值」（源数据等式恒真，如「参考：80 × 2 = 160」）。
- 附带收口：同守卫修掉 1C 审计 UNVERIFIED 未标 FAIL 的伪等式「10 + 15 = a + 15（岁）」（用字母表示数 calc 行）。

**交付物二：P42-032 修复（fraction.js nature calc 列式右值）**

- 根因：模板「列式：cn ÷ g2 = cr.n」把本步除数 g2 与最简分子 cr.n 混用——gcd(ca,cb)>1 时（6/12：g2=2，simp→1/2）写出假等式「6 ÷ 2 = 1」（真值 6÷2=3）。
- 修复（用户裁决非 gcd 口径）：右值 cr.n → ca（本步商 cn/g2）；gcd(ca,cb)=1 时 cr.n===ca，输出逐字节不变。

**交付物三：028/029 实例级门禁（dev/p42/check-instance-gates.js，check-all 第 23 项）**

- 028 定性：登记建议「pipeline `difficultyIntegrity required:true`」经证实为**空操作**——validation-pipeline.js Layer 2/3 `stopOnFailure:false`，`layerHasErrors` 从不使用；且 6a 不跑 pipeline——唯一强制路径为新 check-all 门禁项。
- 029 定性：judge 布尔答案（value=true/false）使 quality-scorer 判据④「解析含答案值子串」**结构性不可达** → 硬 0.6 对 judge 数学上不可能达标 → 用户裁决分级门禁。
- 门禁实现：lib+CLI 双形态；Section A 028 = `DI.validateDifficultyIntegrity(q,{})` errors→FAIL；Section B 029 = `QS.scoreExplanationQuality(q)`，`QUALITY_FLOOR=0.5`（<0.5 FAIL）/ `QUALITY_TARGET=0.6`（[0.5,0.6) watch 记录级）；1570 面重放（同审计 seed 协议）；证据 `dev/p42/out/p42-4-instance-gate.json`；fail>0 exit 1。
- 029 登记样本修复：`math-g3-up-u07-k002` fill「一个角有 1 个顶点和 ____ 条边」解析补答案值（concept-meaning.js makeAngleFill）→ 质量分 ≥0.6。

**面实测（run 2，seed `p42|<kp>|<qt>|d3`）**：028 diffFail 0 / diffWarn 0；029 硬底线 0 违规 / watch **133**（质量分布 1.0→909、0.75→528、0.5→133；登记样本修复前测量为 130 行 <0.6）；genErr 0 / qFail 0。1C 面审计复跑 **FAIL 4→0**（031/032 缺陷行清零）；P2 面审计复跑基线不变（14 alert + 164 watch）。

**预期调整（携复现依据重写，非删用例）**：`tests/generation/p42-1c-truth-verifier.test.js` P42-013（math-g5-up-u05-k003 calc 用字母表示数）旧解析「当 a = 5 时，3 × 5 + 1 = 16」为真等式 → PASS；031 守卫后句子前缀支撑串不再拼接等式，诚实退化「答案是 16。」→ 无可验证等式 → **UNVERIFIED**（P42-011 口径：诚实退化预期态，非 FAIL；真值不损，验证器对该链式形态的判定能力由 Part 1 ③ 保有）。断言携 npm test 失败原文重写，另加「任何登记例不得 FAIL」硬底线。

**新发现登记（不顺手修）**：quality-scorer 判据④对 judge 题的结构性不可达——若未来追求 judge 解析质量量化，需另立「judge 解析判据集」（如判据④′：解析含对错结论词 + 依据值），属语义增强，留待按需立项。

> **P42-6（2026-10-19）：判据④′已落地闭合**——quality-scorer 新增 `boolConclusionConsistent`（judge 布尔答案：解析含与答案一致结论词，否定词优先），复跑 watch 133→52（judge 81 行消除 / 13 行升 1.0 / 27 行真·无结论词诚实保留），见 §0.14。

**登记状态**：P42-031 → **已修复**；P42-032 → **已修复**；P42-028 → **已闭合**（check-all 第 23 项强制）；P42-029 → **已闭合**（分级门禁 + 样本行修复）。

**门禁证据**：定向 `tests/generation/p42-1b-explanation-equation-truth.test.js`（扩展后 3/3）+ `p42-4-fraction-simplify-truth.test.js`（2/2）+ `p42-4-instance-gate.test.js`（3/3）+ `p42-1c-truth-verifier.test.js`（9/9）；`npm test` **929/929**；`node dev/check-all.js`（CHROME_BIN 就位）**34 PASS / 0 FAIL / 0 SKIP / 34 项**（第 23 项 Instance 首跑 0 fail / 133 watch；FINAL-91 PASS）。过程记录：run 1 第 16 项 Bundle FAIL——presentation-engine.bundle.js 内联 `shared/validator/quality-scorer.js`，本批为其补导出后 bundle 未重建（改后动作清单遗漏项，门禁就地暴露），官方脚本重建（+1 行导出）后 run 2 全绿；门禁按设计工作，非产品缺陷。

**risk**：低-中——①031 守卫致解析丰富度退化面：句子前缀支撑串行不再产等式（登记样本实证 P42-013，UNVERIFIED 口径已登记）；②fraction 右值改动在 gcd=1 面（多数）逐字节不变、gcd>1 面题干从假等式变真等式（6b/6e 已重冻、6g AS-18 无新增命中）；③T2 派生重跑 + T3 镜像 + rootHash 重冻（`a83db4cf…` 未变，基线 375/98/373/1570 零变动）；④watch 133 行为记录级不阻塞，judge ④ 结构性不可达登记留待按需立项；⑤未 git commit。

---

### §0.13 P42-5 记录（2026-10-19）：027 残余闭合——golden build 写入前独立真值门

**范围定位**：四项「按需立项」残余经用户裁决立项 027 残余（golden build 步骤强制接入重算器）；其余三项（023 模板 KP 签名 / 025 非数值答案评分 / judge 判据④′）维持登记不动。

**改动范围（T2 派生脚本层，生成/写盘行为零变化）**：

1. `dev/p25/build-golden-dataset.js`：
   - require P42-1C SSOT `dev/p42/truth-verifier.js`；新增 `truthGate(sq)`——stem/answer 归一化与记录提取链同构（门审对象 = 即将写入的 structure.stem/structure.answer）；`auditQuestion` **FAIL → 拒收**（与 SEMANTIC_PASS「不伪造收录」同口径）/ **UNVERIFIED+PASS → 放行**（诚实缺位不判错，P42-1D 口径）/ 门自身异常 → UNVERIFIED 放行并记 `GATE-ERROR`；
   - 两处采集点（collectOne + 主循环）在 SEMANTIC_PASS 之后追加该门 + `truthRejected` 计数，两种模式结尾打印「真值门拒收（FAIL）：N 题」；
   - 产物 schema 零变化（不新增记录字段）；底部 IIFE 包 `if (require.main === module)` + `module.exports = { truthGate }`（require 侧只取门，主流程不执行）。
2. `tests/generation/p42-5-golden-truth-gate.test.js`（新建，4 用例）：门控制组（PASS 放行 / P42-005 形态假等式 FAIL 拒收 / 代数式与无断言解析 UNVERIFIED 放行 / 验证器异常放行记 GATE-ERROR）+ **现存 golden 1114 题全量过门 `accepted=false` 必须为空**（1D 审计口径测试化）。

**不重跑 build 的裁决**：脚本无 seed，重跑将改变抽样且属数据变动；现存 1114 题已由 1D 审计闭合（PASS 559 / FAIL 0 / UNVERIFIED 555），本批交付的是**防再发结构防线**——未来任何 golden 重生成，假等式在写入入口即被拒收。golden-questions.json 本批零变动。

**工程核验记录**：编辑过程渲染层出现同形字符疑云，以 charCode 机器核验收口——`truthGate`(74,72,75,74,68,47,61,74,65)/`truthRejected`(…52,65,6a…)/`truth-verifier.js` 全部同一拼写无同形异码；require 冒烟 4 控制组 + 守卫生效；change-log 编辑曾吞 P42-4 标题行（Edit new_string 未回填），已补回并机器核验 4 H2 六字段齐全。

**登记状态**：P42-027 → **已闭合**（1D 审计证据 + P42-5 写入前门，双层防线齐备）；四项按需立项残余剩 3 项（023 模板 KP 签名 / 025 非数值答案评分 / judge 判据④′）。

**门禁证据**：定向 `node --test tests/generation/p42-5-golden-truth-gate.test.js` **4/4**（含 1114 题全量面 FAIL=0）；`npm test` **933/933**（929 + 4）；`node dev/check-all.js`（CHROME_BIN 本机 Chrome）**34 PASS / 0 FAIL / 0 SKIP / 34 项**（FINAL-91 PASS）。

**risk**：低——零生产链改动；现存数据零变动（rootHash/6a/6b/6e/双 bundle 零影响，check-all 全绿实证）；UNVERIFIED 放行口径与 1D 一致；门异常放行不阻塞派生（failures 明细可查）；未 git commit。

---

### §0.14 P42-6 记录（2026-10-19）：judge 判据④′——029 门禁 judge 结构性不可达闭合

**范围定位**：§0.12「新发现登记」（quality-scorer 判据④对 judge 题结构性不可达）经用户裁决立项；四项按需立项残余之一（其余三项中 027 已于 §0.13 闭合，剩 023/025）。

**改动范围（1 生产模块 + 1 测试 + 1 门禁注释）**：

1. `shared/validator/quality-scorer.js`（唯一生产改动）：新增 `boolConclusionConsistent(normExpl, boolVal)`——judge 布尔答案判据④′（解析含与答案一致的结论词）；**否定词优先**（错误|不对|不正确|不成立，防「不对」含「对」子串误判），词集取自 judge 解析实证形态（「说法正确/错误」3 例抽样），不用 √/× 符号（normalizeExplText 删符号）；判据④分支化：布尔走④′，非布尔走原④（非 judge 行零变化，else-if 等价结构）。
2. `tests/validator/p40-q10-explanation-quality.test.js`：+2 用例——④′正例（true+「说法正确」/false+「说法错误」→ 0.75）与负例回归（结论相反→0.5 / 无结论词→0.5 / 否定词优先「不对」+false→0.75 / 非布尔原④→1）。
3. `dev/p42/check-instance-gates.js` 头注释口径更新（watch 存量 133→52；阈值 0.5/0.6 不动）。

**重冻链**：presentation-engine.bundle.js 重建（内联 quality-scorer）；6a/6b/rootHash 零影响（评分不改生成产物，check-all 全绿实证）。

**复跑证据（Instance Gates 1570 面，seed 协议不变）**：watch 133→**52**，分布 1.0 909→922 / 0.75 528→596 / 0.5 133→52。机器对账：judge 108 个 0.5 行中 **81 个④′命中升 0.75**；13 个原 0.75 judge 行（解析含③词表词）升 **1.0**；**27 个 judge 真·无结论词诚实保留 0.5**（抽样 3 例证实：解析有否定理由但字面无标准结论词，如「斜放量不准」「不能度量」——属生成器模板语义缺口，登记不顺手修）；非 judge 25 行（apply 9/fill 11/choice 4/geometry 1）不变。FAIL 0 / watch 52 不阻断（exit 0）。

**登记状态**：judge 判据④′ → **已闭合**；按需立项残余剩 **2 项**（023 模板 KP 签名 / 025 非数值答案评分）+ 新观察「judge 27 行结论词模板缺口」（属生成器模板层，登记不顺手修）。

**门禁证据**：定向 14/14（p40-q10 含④′ 2 例 + p42-4-instance-gate）；`npm test` **935/935**（933+2）；`node dev/check-all.js`（CHROME_BIN 本机 Chrome）**34 PASS / 0 FAIL / 0 SKIP / 34 项**（第 16 项 bundle hash、第 23 项 Instance watch 52 不阻断、FINAL-91 PASS）。

**risk**：低——①非 judge 行走原④分支逻辑等价（回归用例保护）；②judge ③不可达维持（0.75 上限不虚高）；③27 行 judge watch 诚实缺位不阻断；④词集最小（否定 4 词+肯定 3 词），无凑分硬编码；⑤未 git commit。

---

### §0.15 P42-7 记录（2026-10-19）：judge 27 行结论词模板缺口根因修复（watch 52→25）

**范围定位**：§0.14 新观察「judge 27 行结论词模板缺口」（生成器模板层）经用户裁决立项。27 个 watch judge KP 生成器映射取证收敛：**shape-recognition 23 + position-direction 4，仅 2 个根因模板**。

**根因（两处 false 分支解析无结论词，true 分支均已有）**：
1. `shared/generator/generators/shape.js` L1844——judge misconception 判定分支 `explanation='「'+shown+'」——'+w.m`（批评句尾无结论词）；true 分支 L1840 含「说法正确」。
2. `shared/generator/generators/position.js` L407——平移 judge false 分支 `'…格数应是 X 格，不是 Y 格。'` 无结论词；true 分支 L406 含「答案正确」；方向分支 L125/126 均有结论词（非缺口）。

**最小修改（2 文件各 1 行）**：两 false 分支解析尾补「，说法错误。」（修复后④′否定词命中且与 value=false 一致）；`data.misconception` 数据字段不动（下游消费零影响）。验证面实测：两 KP quality 0.5→0.75。

**重冻链（改 shared/generator + 解析文案变更，P42-4 先例全套）**：strategy-engine.bundle.js 重建（65 modules；**教训实证：`_bundle-env` 走 bundle，改 generator 不重建则修复不生效**）；T2 派生重跑（variation + misconception）；T3 镜像（misconception-profiles.json 同步）；`tools/kbl/build.js` rootHash **a83db4cf… 不变**（canonical 层零变动）；6b --write（1570/1570、FAIL rows=0）；6e --write（P30-KP-QT-MAKER-MATRIX.json）；P2 面审计复跑基线不变（模板 watch 组 164）；npm test **935/935 零失败**（无文案精确断言，无需重写用例）。

**复跑证据（Instance Gates 1570 面）**：watch **52→25**——judge **清零**（27 = 22 行→0.75 + 5 行→1.0 对账自洽）；分布 1.0 922→927 / 0.75 596→618 / 0.5 52→25；余 25 行 apply 9/fill 11/choice 4/geometry 1（非 judge 存量，登记不动）。`node dev/check-all.js` **34 PASS / 0 FAIL / 0 SKIP / 34 项**（第 16 项 bundle hash ✓、第 23 项 Instance ✓、FINAL-91 PASS）。

**登记状态**：judge 27 行结论词模板缺口 → **已闭合**；029 门禁 judge 维度全清；watch 存量 25 行（apply/fill/choice/geometry）属非 judge 语义缺位，维持登记。按需立项残余仍 **2 项**（023 模板 KP 签名 / 025 非数值答案评分）+ 024 待人工。

**risk**：低——①改动面小（2 行文案尾补）；②judge true 分支/方向分支零触碰；③golden-questions.json 零变动（不重跑 build）；④基线 375/98/373/1570 零变动；⑤未 git commit。

---

### §0.16 P42-8 记录（2026-10-19）：watch A 类符号答案归一（watch 25→16，B 类 16 行归 025）

**取证（25 行全量分类）**：25 watch 行按答案值类型收敛为两类——
- **A 类 symbol-empty（9 行）**：fill 4 + choice 4（每 KP 一对，答案值 `<`）+ geometry 1（`☆`）。根因：`normalizeExplText` 保留集不含 `< > ☆` → 答案值归一后**空串** → 判据④ `normAns !== ''` 跳过。解析实际含符号（「答案是 <」「→「☆」」）——scorer 侧缺口非模板缺位。
- **B 类 text（16 行）**：apply 9（开放式答案「举例合理即可」——④ 结构性不可达）+ fill 7（多段/形态答案「二月，18本」「30℃，周六」「2/4」——④ 全串匹配对多段答案过严）。均属 025「非数值答案自动真值/结构化评分」语义增强范畴，**维持登记不顺手扩**。

**改动（1 生产模块 1 行 + 1 测试 1 用例）**：
1. `shared/validator/quality-scorer.js` L48：`normalizeExplText` 保留集补 `< > ☆`（实证最小集）。
2. `tests/validator/p40-q10-explanation-quality.test.js`：+1 用例（fill `<` 答案解析含 `<` → ④命中 1.0；geometry `☆` 无③步骤词 → 0.75）。

**重冻**：presentation-engine.bundle.js 重建（18 inlined；strategy bundle 不含 quality-scorer 零改动）。T2 派生/6b/6e/rootHash/golden 零影响（scorer 不改生成产物）。

**复跑证据（Instance Gates 1570 面）**：watch **25→16**——A 类 9 行全消**零降级**（对账自洽：9 行 0.5→0.75 + 12 行 0.75→1.0，0.5 无新增 16=25−9）；分布 1.0 927→939 / 0.75 618→615 / 0.5 25→16；余 watch 构成 apply 9 + fill 7（B 类）。「从严方向」（normAns 含符号的行归一更严）实测零回归。`npm test` **936/936**（935+1）；`node dev/check-all.js` **34 PASS / 0 FAIL / 0 SKIP / 34 项**（第 16 项 bundle hash ✓、第 23 项 Instance watch 16 不阻断 ✓）。

**登记状态**：watch A 类 scorer 缺口 → **已闭合**；watch 存量 16 行（apply 9 + fill 7）**全部归 025**（开放式/多段答案判据语义扩展），025 的处置依据由「按需立项」升级为「有明确 16 行实证清单」。按需立项残余仍 **2 项**（023 / 025）+ 024 待人工。

**risk**：低——①字符集补符号影响面：②重述/④子串两消费方，符号参与归一为更精确匹配；②实测 1570 面零降级；③未 git commit。

---

### §0.17 P42-9 记录（2026-10-19）：explanationQuality 弱判定只读审计（025 重定性为判据重构；零代码改动）

**立项背景**：P42-8 签收后拟执行「025 分段匹配子集」（fill 7 行拆段全命中），用户质询「最小修改是否已造成大量包含子集、不解决问题的链路」——经盘点与 1570 面实测，质疑成立，P42-9 改定性为只读审计，**分段匹配判据扩展方案作废**。

**盘点（scorer 全文，shared/validator/quality-scorer.js 268 行）**：
- 七维中**唯一弱判定维 = explanationQuality**；其余六维（correctness/knowledge/difficulty/structure/render/uniqueness）全部消费 pipeline validationResult.checks 真值判定。
- explanationQuality 是**纯观测器**：分数仅用于 QA 统计与 Instance Gates 第 23 项 B 节观测，**不回流任何生成/校验决策**——改判据只能改变「谁被计入 watch」，不能改变解析内容。
- 弱判定四判据：①非空（强）；②复述判定（前缀 indexOf×2+尾正则）；③步骤词表（21+ 词）；④/④′子串/词表。历次增补（P42-6 ④′/P42-8 字符集）性质为「观测器失明修复」（对特定答案形态结构性不可达）；拟议分段匹配属「观测器能力扩展」——**边际收益 5 行、误判噪声升高（成分出现≠成分被解释）、判据膨胀至三态**，故作废。

**1570 面实测（弱判定命中面量化，2026-10-19）**：
- **④ 子串匹配对短答案近乎恒真**：normAns 归一后长度 ≤2 的面 **936/1570（59.6%）**（单/双字符答案如 '2'、'35'、'<'、'☆'——解析含单字符子串几乎必然 true）→ ④ 对近六成面白送 0.25 分。
- **③ 词表最宽路径弱命中**：仅靠「含 = 号」命中（无其他任何步骤词）的面 **518/1570（33.0%）**。
- **阈值语义漂移结论**：explanationQuality 的真实区分力集中在 ①②（非空/非复述）；③④ 在主流形态（数值答案+含等号解析）上结构性白给 → **Instance Gates 的 0.5/0.6 阈值实际测的是「①② 成立 + ④ 答案形态可达性」，与「解析质量」设计意图漂移**。watch 清单（现 16 行）本质是「答案形态不可达行」清单，非「解析质量差」清单。

**链路诊断（「不解决问题的链路」）**：观测链 Instance Gates（观测）→ quality-scorer（观测器）→ watch 清单（标注）——链上**无修复通道**；修复只能发生在 shared/generator 模板层（判例：P42-7 judge 27 行模板修复后 judge 维清零）。watch 16 行（fill 7 多段/形态答案 + apply 9 开放式答案）的根因在答案值形态与解析内容的形态差，属内容层问题。

**处置决定（用户裁决）**：
1. **P42-9 零代码改动**；「025 分段匹配」方案作废（本节存档其取证：g4-up-u06/g4-up-u07/g5-down-u07×3 共 5 行分段可命中，g3-down-u06/g5-down-u04 共 2 行语义等价字面不同不可命中——即判据扩展上限 5 行，代价为④三态膨胀+噪声升高）。
2. watch 16 行维持 025 终态登记（apply 9 开放式自动判定不可达；fill 7 形态差属结构化评分范畴）。
3. **025 重定性**：由「非数值答案自动真值/结构化评分」升级为「**explanationQuality 判据④重构**」——范围：短答案（长度≤2）④恒真治理 + ③等号弱命中收敛（等号需伴随完整等式/右值）+ 多段/开放式答案结构化评分；携本节实测数据（59.6%/33.0%）为设计输入；**须独立立项**并与 6b 冻结面/Instance Gates 阈值联动评估（判据行为变化会改变 1570 面 qPass/qWatch 分布，须全套门禁）。
4. 按需立项残余保持 **2 项**（023 模板 KP 签名 / 025〔已重定性〕）+ 024 待人工。

**门禁证据**：零生产代码改动（scorer/tests/bundle/KBL/T2 全部零触碰）；1570 面实测为只读重放（seed 协议 `p42|<kp>|<qt>|d3`）；`node dev/check-all.js` **34 PASS / 0 FAIL / 0 SKIP / 34 项**（register 文档变更后全量复跑）。

**risk**：无新增——纯分析批次；唯一风险为 §0.17 数字被第 20 项历史扫描误读（已核对：59.6%/33.0% 为实测记录非 stale 断言）；未 git commit。

---

## 缺陷清单

### P42-001 ~ P42-018：解释内等式右值错误（R7 重算 FAIL）

> P42-1A 复核（2026-10-18）：本组 18 例中仅 **003~009 共 7 例确认**（根因统一收敛至 `concept-meaning.js makeByItem` 解析拼装，见 §0.3）；**001/002、010~018 共 11 例为误报**（审计工具解析缺陷，见 §0.4），原表保留作审计历史证据。**P42-1B（同日）**：确认的 7 例已修复并配真值回归测试（见 §0.5）。

| 编号 | 严重级 | 质量维度 | 复现样本 (seed `p42|kp|qt|d3`) | 根因层 | 证据 | 影响范围 | 建议最小修改 | 回归测试要求 |
|---|---|---|---|---|---|---|---|---|
| P42-001 | 高 | 正确性 | `math-g2-down-u02-k001` fill `____ ÷ 3 = 6……2` ans=20 expl=`20 ÷ 3 = 6` (calc 6.67) | Generator (arithmetic/division) | eqcheck: LHS≠RHS | G2 除法带余 | 修正解释生成：带余除法应写 `20 = 3 × 6 + 2` 或显式标注余数 | 新增测试：除法带余解释必须含被除数/商/余数且等式成立 |
| P42-002 | 高 | 正确性 | `math-g2-down-u02-k002` fill `____ ÷ 6 = 3……1` ans=19 expl=`19 ÷ 6 = 3` (calc 3.17) | Generator (arithmetic/division) | 同上 | 同上 | 同上 | 同上 |
| P42-003 | 高 | 正确性 | `math-g3-up-u02-k003` calc `(5 + 8) × 3 = 13 × 3 = ?` ans=39 expl=`5 + 8 = 39` (calc 13) | Generator (arithmetic/bracket) | expl 步骤解析错误：第一步 5+8 写成了 39 | G3 括号运算 | 修正步骤拼接：第一步结果应为 13，而非最终答案 | 加法/乘法/括号混合：每步中间结果重算校验 |
| P42-004 | 高 | 正确性 | `math-g3-up-u02-k004` calc `15 + 18 − 5 = 33 − 5 = ?` ans=28 expl=`15 + 18 = 28` (calc 33) | Generator (arithmetic/multi-step) | 同 P42-003 | G3 脱式计算 | 同上 | 同上 |
| P42-005 | 高 | 正确性 | `math-g5-down-u02-k002` calc `9 × 2 = 18, 9 × 3 = 27. 9 最小的倍数？` ans=9 expl=`9 × 2 = 9` (calc 18) | Generator (concept-meaning/倍数) | 倍数概念题：第一步乘积写成了最终答案 | G5 倍数 | 修正模板：`answer` 与 `explanation` 变量分离 | 倍数/因数/质数题模板独立测试 |
| P42-006 | 高 | 正确性 | `math-g5-down-u02-k004` calc `不是 2 的倍数的数是奇数，如 19 ÷ 2 = 9……1。下面哪个数是奇数？` ans=19 expl=`19 ÷ 2 = 19` (calc 9.5) | Generator (concept-meaning/奇偶) | 举例等式直接把被除数写成了商 | 同上 | 同上 | 同上 |
| P42-007 | 高 | 正确性 | `math-g5-down-u02-k004` fill `10 ÷ 2 = 5 没有余数，____ 是 2 的倍数` ans=10 expl=`10 ÷ 2 = 10` (calc 5) | Generator (concept-meaning/倍数) | 同上 | 同上 | 同上 | 同上 |
| P42-008 | 高 | 正确性 | `math-g5-down-u02-k005` calc `5 × 6 = 30，30 有多个因数，是合数。下面哪个数是质数？` ans=13 expl=`5 × 6 = 13` (calc 30) | Generator (concept-meaning/质数) | 举例乘法右值写成了最终答案 | 同上 | 同上 | 同上 |
| P42-009 | 高 | 正确性 | `math-g5-down-u02-k005` fill `在 19、12、15 中，____ 只有 1 和它本身两个因数，是质数。` ans=19 expl=`5 × 6 = 19` (calc 30) | Generator (concept-meaning/质数) | 同上 | 同上 | 同上 | 同上 |
| P42-010 | 高 | 正确性 | `math-g5-down-u04-k004` fill `分数基本性质：1/3 = ____/15` ans=5 expl=`1/3 = 5` (calc 0.33) | Generator (fraction/基本性质) | 分数扩分解释写成了分子，非等式 | G5 分数 | 修正：应写 `1/3 = 5/15` 或 `1×5 / 3×5` | 分数基本性质模板重算校验 |
| P42-011 | 高 | 正确性 | `math-g5-down-u04-k005` fill `1/5 = ____/10` ans=2 expl=`1/5 = 2` (calc 0.2) | 同上 | 同上 | 同上 | 同上 | 同上 |
| P42-012 | 高 | 正确性 | `math-g5-down-u04-k006` fill `1/6 = ____/18` ans=3 expl=`1/6 = 3` (calc 0.167) | 同上 | 同上 | 同上 | 同上 | 同上 |
| P42-013 | 高 | 正确性 | `math-g5-up-u05-k003` calc `a=5 时 3a+1 = 3×5+1 = 16` ans=16 expl=`5 + 1 = 16` (calc 6) | Generator (concept-meaning/用字母) | 代入步骤丢失乘法 | G5 代数 | 修正：步骤应含 `3×5=15` | 含字母式子计算题模板校验 |
| P42-014 | 高 | 正确性 | `math-g6-down-u02-k002` calc `二成改写成百分数 2÷10=（ ）%` ans=20 expl=`2/10 = 20` (calc 0.2) | Generator (percent-calc/成数) | 百分数换算解释写成了百分数值，非等式结果 | G6 百分数 | 修正：应写 `2/10=0.2=20%` 或分两步 | 成数/百分数/折数互化模板校验 |
| P42-015 | 高 | 正确性 | `math-g6-down-u02-k002` fill `三成五 = ____%` ans=35 expl=`3.5/10 = 35` (calc 0.35) | 同上 | 同上 | 同上 | 同上 | 同上 |
| P42-016 | 高 | 正确性 | `math-g6-down-u02-k002` apply `一成改写成百分数` ans=10 expl=`1/10 = 10` (calc 0.1) | 同上 | 同上 | 同上 | 同上 | 同上 |
| P42-017 | 高 | 正确性 | `math-g6-up-u03-k002` fill `3/4 ÷ ____ = 1/4` ans=3 expl=`3/4 ÷ 1/4 = 3` (calc 0.1875) | Generator (fraction/除法) | 方程求解步骤：除数倒数相乘但解释写反 | G6 分数除法 | 修正：`3/4 ÷ 3 = 1/4` 或 `3/4 ÷ (1/3) = 1/4` 显式展示倒数 | 分数除法方程求解模板校验 |
| P42-018 | 中 | 正确性 | `math-g6-up-u03-k002` fill `分数条 3/6 × 2 = ____` ans=1 expl=`3/6 × 2 = 6` (calc 1) | Generator (fraction/分数条) | 乘法右值写成了 6 而非 1 | 同上 | 修正解释模板 | 分数条可视化题模板校验 |

---

### P42-019：Apply 问“后一个”但答案含“前一个+后一个” (D2)

| 编号 | 严重级 | 质量维度 | 复现样本 | 根因层 | 证据 | 影响范围 | 建议最小修改 | 回归测试要求 |
|---|---|---|---|---|---|---|---|---|
| P42-019 | 中 | 教学目标 | `math-g1-down-u03-k005` apply `发牌时数到 76，它前一个是 75，后一个数是多少？` ans=`75 和 77` | Generator (concept-meaning:802-804) | apply 模板只问“后一个”，复用 stem 的双值答案 | G1 数的顺序 | 修正 apply 模板：仅输出后一个数 `cur+1` | Apply 类模板：prompt/answer 字段一致性断言 |

> **P42-2A（2026-10-18）：已修复**——apply 分型答案 `applyAnswer=cur+1` 单一结论 + `conclusion:false` 关闭双值附注 + 情境句内嵌前向 scaffold（见 §0.8）；回归 `tests/generation/p42-2a-teaching-goal-match.test.js`。

---

### P42-020 ~ P42-022：度量单位超出 KP 显式范围 (教学目标匹配)

| 编号 | 严重级 | 质量维度 | 复现样本 | 根因层 | 证据 | 影响范围 | 建议最小修改 | 回归测试要求 |
|---|---|---|---|---|---|---|---|---|
| P42-020 | 中 | 教学目标 | `math-g2-up-u05-k001` (认识厘米和米) q=choice/fill/judge 换算 `千米<->毫米` | Generator (money.js:262-281) | `NAME_TO_MEASURE` 命中 `length` 后从全表 LENGTH_UNITS 随机抽，未过滤 KP 白名单 | G2 长度单位 | 在 `getMoneyMeta` 或 `makeMeasurementConversionQuestion` 增加 KP→允许单位集合映射，过滤 fromUnit/toUnit | 单位换算题：fromUnit/toUnit 必须 ⊆ KP 显式单位集合 |
| P42-021 | 中 | 教学目标 | 同上 | 同上 | 同上 | 同上 | 同上 | 同上 |
| P42-022 | 中 | 教学目标 | 同上 | 同上 | 同上 | 同上 | 同上 | 同上 |

> **P42-2A（2026-10-18）：已修复**——`getMoneyMeta` KP 名称显式单位认领（≥2 单位，长名优先+占位防吞）+ `makeMeasurementConversionQuestion` 收窄换算双方 ⊆ KP 单位集合（见 §0.8）；仅 `认识厘米和米` 命中，其余度量 KP 行为零变化；回归 `tests/generation/p42-2a-teaching-goal-match.test.js`。

---

### P42-023：Prompt 跨 KP/年级/题型复用 (覆盖缺口/疑似)

| 编号 | 严重级 | 质量维度 | 复现样本 | 根因层 | 证据 | 影响范围 | 建议最小修改 | 回归测试要求 |
|---|---|---|---|---|---|---|---|---|
| P42-023 | 低 | 覆盖缺口 | 64 组共享 prompt（如「下面哪个算式等于 4？」跨 5 个 KP、G1-G6） | Generator (template 共享) | `concept-meaning`/`arithmetic` 等模板按题型/算子复用，KP 区分度依赖 `semanticEvidence` | 全类 | **不建议立即修** — 属模板复用设计；需先引入“KP 本质参与度”指标量化 | 新增指标：同 prompt 跨 KP 计数，阈值告警 |

> **P42-2B（2026-10-18）：复用指标工具已交付**——`dev/p42/participation-checker.js` `reuseMetrics`（精确分组 + 数字归一模板分组，组内 ≥2 KP 告警）经 1570 面实跑：精确组 64 组（与基线 §3 吻合，最大扇出 9 KP）、模板组 179 组（最大扇出 61 KP、跨年级 118 组），见 §0.9 与 `dev/p42/out/p42-2b-participation-audit.json`。指标化完成；「阈值治理/模板 KP 签名」留待后续批次。

> **P42-3（2026-10-18）：阈值治理完成**——`reuseMetrics` 单一硬编码「≥2 KP 告警」治理为具名分级阈值（`REUSE_THRESHOLDS`）：精确组 ≥2 alert（维持基线 §3 已知设计口径，稳态 62 组）；模板组 ≥2 仅 watch（记录级）/ ≥10 升 alert（超过精确组历史最大扇出 9 = 数字归一后仍广泛共模板的签名缺失强信号）。治理后 1570 面复跑：模板告警 178→**14**（全部 ≥10 KP 且跨年级）+ watch 164（2~9 KP），组集合零丢失仅分级（2-KP 自然撞车噪声 91 组降为记录级）。「模板 KP 签名」属生成器模板改造，留待按需立项（§0.11）。

---

### P42-024：开放式 Apply 答案显式占位 (待人工)

| 编号 | 严重级 | 质量维度 | 复现样本 | 根因层 | 证据 | 影响范围 | 建议最小修改 | 回归测试要求 |
|---|---|---|---|---|---|---|---|---|
| P42-024 | 低 | 待人工 | 5 例：`举例合理即可`×3 / `如自行车车架...`×1 / `举例合理即可`近义×1 | Generator (shape-recognition/concept-meaning) | 几何认识/现实举例类 KP，本质为开放性观察题 | G1/G4/G6 几何认识 | **教学判断** — 此类题是否应标记 `answerMode:read-aloud` 或 `answerMode:none`？ | 人工审阅确认：是否保留、改为口述/不评分、或增加结构化评分量表 |

---

### P42-025：Apply 非数值答案占比 192/1570 (覆盖缺口)

| 编号 | 严重级 | 质量维度 | 复现样本 | 根因层 | 证据 | 影响范围 | 建议最小修改 | 回归测试要求 |
|---|---|---|---|---|---|---|---|---|
| P42-025 | 中 | 覆盖缺口 | `concept-meaning` apply 全量 192 题答案非纯数值（定义/举例/比较/分数/比率） | Generator (concept-meaning apply 分支) | 设计为“概念理解/解题思路”题，非计算题 | 所有 apply 类 KP | **工具缺口** — 无自动验证此类答案的方法 | P42-2 引入“答案结构化评分”/“关键概念覆盖”自动检查 |

> **P42-2B（2026-10-18）：结构化分类工具已交付**——`dev/p42/participation-checker.js` `classifyApplyAnswer/classifyApplyFace` 七形态经 1570 面实跑：apply 375 行 = numeric 184 / text 97 / short-text 66 / fraction 21 / placeholder 7，见 §0.9。仅计数不判真伪；「答案与题问的关键概念覆盖检查」由 P2 概念回指差分承担（其产出即 P42-033 家族）。

> **P42-3（2026-10-18）：工具缺口收口**——分类工具（2B）+ 概念覆盖差分（2B，产出 P42-033 已于 2C 修复）两条自动化路径均在位；非数值答案的自动真值/结构化评分属语义增强，留待按需立项。治理后复跑 P3 计数如实记录 2C 后小漂移：numeric 191 / text 97 / short-text 59 / fraction 21 / placeholder 7（§0.11）。

---

### P42-026：无端到端数学真值门禁 (系统性覆盖缺口)

| 编号 | 严重级 | 质量维度 | 复现样本 | 根因层 | 证据 | 影响范围 | 建议最小修改 | 回归测试要求 |
|---|---|---|---|---|---|---|---|---|
| P42-026 | 高 | 正确性 | 1570 题中仅 457 题 (29%) 可脚本重算；word/geometry/choice 选项真值/分数/几何/近似数 1113 题无任何独立重算 | Validator (answer-validator:31) | `computeExpectedAnswer` 仅支持纯算式 tokenizer/parser；word problem 返回 null → `ANSWER_UNVERIFIED` | 全类 | 新增重算器：word-problem (解方程/比例/行程)、geometry (面积/周长/角度)、choice (选项逐个重算)、fraction/percent/decimal 结构化求值 | 新增 check-all gate：`dev/check-math-truth.js` 先 advisory 再 required |

---

### P42-027：Golden Dataset 无独立重算 (系统性覆盖缺口)

| 编号 | 严重级 | 质量维度 | 复现样本 | 根因层 | 证据 | 影响范围 | 建议最小修改 | 回归测试要求 |
|---|---|---|---|---|---|---|---|---|
| P42-027 | 高 | 正确性 | `kbl/teaching/golden-questions.json` 直接存生成器产出，`dev/p25/validate-golden-dataset.js` 仅结构校验 | Data Pipeline (P25) | 系统性错误会被冻结入金标 | 所有依赖 golden 的回归 | Golden 写入前强制走独立重算；现存 golden 全量重算一次并修正 | Golden build 步骤接入 `answer-validator` 扩展重算器 |

> **P42-1D（2026-10-18）：现存 golden 全量独立重算已执行**——`dev/p42/audit-golden-truth.js` 用 P42-1C truth-verifier 对 1114 题逐题重算（题干空位代入 + 解析等式真值）：PASS 559 / **FAIL 0** / UNVERIFIED 555，覆盖子句 723，证据 `dev/p42/out/p42-1d-golden-truth-audit.json`（见 §0.7）。缺口以审计证据闭合；「golden build 步骤强制接入重算」属派生链改动，留待后续批次按需立项。

> **P42-5（2026-10-19）：残余「golden build 接入重算」已闭合**——`dev/p25/build-golden-dataset.js` 写入前真值门落地（truthGate：FAIL 拒收 / UNVERIFIED+PASS 放行 / 门异常记 GATE-ERROR 放行），现存 1114 题全量过门 FAIL=0 测试化（`tests/generation/p42-5-golden-truth-gate.test.js`，4/4）；不重跑 build（现存数据 1D 已闭合，防再发防线见 §0.13）。

---

### P42-028：实例级难度一致性无强制门禁 (系统性覆盖缺口)

| 编号 | 严重级 | 质量维度 | 复现样本 | 根因层 | 证据 | 影响范围 | 建议最小修改 | 回归测试要求 |
|---|---|---|---|---|---|---|---|---|
| P42-028 | 中 | 难度一致性 | 1570 题 `difficulty-integrity-validator` 全 PASS 但为 Layer 3 advisory (`required:false`)，未在 check-all 强制；family 单调性仅 `needs-review` | Validator / Gate | 9a/9b 仅定义级；实例级声明 vs 结构/螺旋/认知无强制复核 | 全类 | `validation-pipeline.js` 将 `difficultyIntegrity` `required:true`；或新增专用 gate `check-difficulty-instance.js` | check-all 新增第 N+1 项：实例级难度完整性 |

> **P42-4（2026-10-19）：已闭合**——登记建议之一「pipeline `difficultyIntegrity required:true`」经定性为**空操作**（validation-pipeline.js Layer 2/3 `stopOnFailure:false`，`layerHasErrors` 从不使用；6a 亦不跑 pipeline），改走 check-all 新增第 23 项 `dev/p42/check-instance-gates.js`（合一文件承载 028+029，用户裁决）：Section A 逐实例 `validateDifficultyIntegrity`，errors→FAIL；1570 面 diffFail 0 / diffWarn 0 即时绿；回归 `tests/generation/p42-4-instance-gate.test.js`（见 §0.12）。

---

### P42-029：Explanation 质量（非重述/含答案/关键步骤）无量化门禁 (覆盖缺口)

| 编号 | 严重级 | 质量维度 | 复现样本 | 根因层 | 证据 | 影响范围 | 建议最小修改 | 回归测试要求 |
|---|---|---|---|---|---|---|---|---|
| P42-029 | 中 | 正确性/教学 | 1 例 `explanation_missing_answer` (`math-g3-up-u07-k002` fill `一个角有 1 个顶点和 ____ 条边` ans=2 expl=线段/射线/直线定义，**未含答案 2**) | Validator (quality-scorer:151-152) | `scoreExplanationQuality` 仅启发式：非空、非重述、含步骤标记、含答案子串；未纳入 gate | 全类 | 将 `explanationQuality` 纳入 `validation-pipeline` Layer 2 或 3，阈值 ≥0.6 | check-all 新增解释质量门禁 |

> **P42-4（2026-10-19）：已闭合**——分级门禁落地（用户裁决）：`dev/p42/check-instance-gates.js` Section B，硬底线 0.5（<0.5 FAIL）/ watch 0.6（[0.5,0.6) 记录级）；judge 布尔答案使判据④「解析含答案值」结构性不可达，硬 0.6 对 judge 数学上不可能达标（新发现登记，不顺手修，见 §0.12）。登记样本 `math-g3-up-u07-k002` fill 解析补答案值（concept-meaning.js makeAngleFill），质量分 ≥0.6 有回归断言。1570 面：0 违规 / watch 133。

---

### P42-030：Browser E2E 环境缺失 (BLOCKED)

| 编号 | 严重级 | 质量维度 | 复现样本 | 根因层 | 证据 | 影响范围 | 建议最小修改 | 回归测试要求 |
|---|---|---|---|---|---|---|---|---|
| P42-030 | 中 | 门禁完整性 | Gate 15 `check-browser-e2e.js` exit=2 SKIP (无 Chrome/Chromium) | Environment | `REQUIRE_BROWSER_E2E=1` 且无 Chrome → exit=1 FAIL | 发布流水线 | CI 配置 `CHROME_BIN=/usr/bin/google-chrome`；文档记录环境要求 | 发布前必须在含 Chrome 环境跑满 33/33 |

> **P42-3（2026-10-19）：已闭合**——CI 配置核实在位：`.github/workflows/ci.yml` 自 FINAL-12（commit 6923761）起即设 `REQUIRE_BROWSER_E2E=1` + `CHROME_BIN=google-chrome`（ubuntu-latest 预装），环境要求已文档化（`docs/10-TEST-CI.md` §Browser E2E 语义）。含 Chrome 环境实测：macOS 本机 Chrome（CHROME_BIN 指向）单跑 9 步 E2E **PASS**（打印 10 卡、断言全过）+ 全量 `node dev/check-all.js` **33 PASS / 0 FAIL / 0 SKIP**（第 15 项首次本地真实执行，P42 战役首次满编）。登记状态 BLOCKED → 已闭合。

---

### P42-031：句子型支撑串被整体当算式拼「= 答案」 (P42-1C 面审计新发现)

| 编号 | 严重级 | 质量维度 | 复现样本 (seed `p42|kp|qt|d3`) | 根因层 | 证据 | 影响范围 | 建议最小修改 | 回归测试要求 |
|---|---|---|---|---|---|---|---|---|
| P42-031 | 高 | 正确性 | `math-g5-down-u02-k003` calc/fill/apply，ans=28/27/48，expl=`……把每个选项除以 2，看余数是不是 0 = 28。` | Generator (concept-meaning makeByItem ~1157/1180/1188) | 支撑串「仿照 7 ÷ 2 的做法……看余数是不是 0」是**教学指令句**（仅内嵌示例 7 ÷ 2）：1157 行「含运算符+数字」粗判放行 → eqTail 无 `=` 可提取 → 1180 行 exprAns 回退=答案 → 1188 行拼出假等式「…看余数是不是 0 = 28」。**与 003~009 同拼接点，1B 未覆盖「句子非算式」形态** | `math-g5-down-u02-k003` 三题型行（`dev/p42/out/p42-1c-truth-audit.json` FAIL 明细）；同形态支撑串的其它 KP 需在修复时一并排查 | exprCand 须为算式形态（如首字符为数字/负号、无句读逗号）才允许等式拼接；否则诚实退化「答案是 X」（与 1B 空位守卫同思路） | 1B 回归面补「句子支撑串」形态：解析内不得出现「非算式句 + = 数字」假等式 |

> **P42-4（2026-10-19）：已修复**——makeByItem 纯算式形态守卫（`exprFormOk` + `exprAnsFromTail` 双通道，见 §0.12）：句子型支撑串诚实退化「答案是 X」，源数据「=」右值恒真形态保留；附带收口伪等式「10 + 15 = a + 15（岁）」。回归：p42-1b FAMILIES +3 行（k003 calc/fill/apply 全 seed 面）+ P42_031_SAMPLES 3 例；1C 面审计复跑 FAIL 4→0；1 例丰富度退化（P42-013 UNVERIFIED）携复现依据重写断言并登记口径。

---

### P42-032：约分列式右值混用「本步商」与「最简分子」 (P42-1C 面审计新发现)

| 编号 | 严重级 | 质量维度 | 复现样本 (seed `p42|kp|qt|d3`) | 根因层 | 证据 | 影响范围 | 建议最小修改 | 回归测试要求 |
|---|---|---|---|---|---|---|---|---|
| P42-032 | 高 | 正确性 | `math-g5-down-u04-k006` calc，prompt=`约成最简分数（分子分母同除以 2，列式：6 ÷ 2 = 1）：6/12 = ？`，ans=1/2 | Generator (fraction.js nature/calc ~334-338) | 题干模板「列式：`cn ÷ g2` = `cr.n`」把**本步除数 g2** 与**最简分子 cr.n** 混用：gcd(ca,cb)>1 时（6/12：g2=2，simp→1/2）写出假等式 6 ÷ 2 = 1（真值 6÷2=3，或同除以 6 得 1）；gcd(ca,cb)=1 的抽样恰巧正确，属隐性模板缺陷 | fraction nature/calc 全部 gcd(ca,cb)>1 的抽样（题干假等式；解析「6/12 = 1/2」本身为真不受影响） | 列式右值改为本步商 `cn/g2`（=ca），或「同除以」口径改用 gcd（`cn ÷ gcd = cr.n`）——二选一由修复批次裁决，登记不改 | 约分模板题干列式真值断言，须含 gcd(ca,cb)>1 用例（如 6/12） |

> **P42-4（2026-10-19）：已修复**——列式右值 cr.n → ca（本步商，用户裁决非 gcd 口径，fraction.js nature/calc）：gcd(ca,cb)=1 时输出逐字节不变；回归 `tests/generation/p42-4-fraction-simplify-truth.test.js`（全 seed 面 d1..4×v0..3 列式逐行真值 + 6/12 登记样本 PracticeSession 复现，见 §0.12）。

---

### P42-033：目标 KP 零参与——跨 KP 错挂家族 (P42-2B 面审计新发现)

| 编号 | 严重级 | 质量维度 | 复现样本 (seed `p42|<kp>|<qt>|d3`) | 根因层 | 证据 | 影响范围 | 建议最小修改 | 回归测试要求 |
|---|---|---|---|---|---|---|---|---|
| P42-033 | 高 | 教学目标 | 14 KP 组 33 行（下表全清单；证据 `dev/p42/out/p42-2b-participation-audit.json` p2.candidates） | Generator（模板按题型/算子复用，KP 语义区分度缺失） | P2 概念回指差分：同 KP 内有行回指名称概念、有行不回指；不回指行题干/选项/解析/答案均无目标 KP 概念词或记法 | 33 行 / 1570 面 | 逐 KP 组定位模板分支（图形运动族挂方向位置模板、体积 KP 挂整数加法模板、正/反比例互串等）；根因修复，禁止硬编码 KP 白名单绕过 | 每组 ≥1 反例 seed 断言 + 修复后同面复跑 P2 差分清零（`node dev/p42/audit-participation-face.js`） |

**33 行全清单**（14 KP 组；样例 prompt 截取自审计面）：

| KP | 名称 | 行数 | 错挂形态（样例） |
|---|---|---|---|
| math-g3-down-u01-k002 | 平移 | 2 | 方向位置题：`观察下图，小猫在桌子的什么方向？`（geometry/apply 两行） |
| math-g3-down-u01-k003 | 旋转 | 2 | 同上（`球在书包的什么方向`） |
| math-g4-down-u07-k003 | 平移 | 2 | 同上（`花朵在小猫的什么方向`） |
| math-g4-down-u07-k004 | 平移的画法 | 2 | 同上（`球在小猫的什么方向`） |
| math-g4-down-u07-k005 | 运用平移解决问题 | 2 | 同上（`小狗在苹果的什么方向`） |
| math-g5-up-u04-k002 | 旋转 | 2 | 同上（`房子在小鸟的什么方向`） |
| math-g2-up-u07-k001 | 7～9的乘、除法 | 3 | 全乘法（`8 × 8`、`哪个算式等于 63`、月饼 2×9），除法零出现 |
| math-g4-up-u05-k001 | 平行与垂直 | 3 | 全角度拼合（`两个直角拼起来是____度`），平行/垂直零参与 |
| math-g5-down-u03-k006 | 不规则物体的体积 | 4 | 全整数加法（`____ + 10 = 17`、电风扇 27+1、节水 14+11 / 11+5），跨学段错位最严重 |
| math-g6-up-u02-k003 | 分数、小数混合运算及运算律 | 4 | 全整数算术（`____ − 6 + 10 = 15`、`哪个算式等于 4`、`10 + 9 = 20` judge、`把 3 加 4`） |
| math-g6-down-u04-k004 | 正比例 | 1 | 反比例内容挂正比例 KP：排队题解析明写「每行人数与行数**成反比例**」 |
| math-g6-down-u04-k005 | 反比例 | 3 | 正比例内容挂反比例 KP：钢笔归一（48÷6=8, 3×8=24）、汽车速度解析明写「**成正比例**」、苹果单价 |
| math-g5-down-u08-k002 | 最优策略的规律 | 2 | 数列题（`数列 2, 4, 6, 8 的下一项`），策略思想零参与 |
| math-g5-down-u04-k005 | 约分与通分 | 1 | 题面明写「**分数的基本性质**」（k004 独立 KP 内容）：`分数的基本性质，在 ____ 里填数：1/5 = ____/10` |

> 甄别说明：k004 正比例 calc 行（钢笔 12÷4 归一）为正比例内容实质参与、仅缺字面 → 判误报不入本表；k005 choice「与 16/20 大小相等」解析明写「约成 4/5」→ 判误报。弱参与边界 2 行（凑十法 choice、真分数和假分数 apply）不判缺陷，见 §0.9。
>
> **P42-2C（2026-10-18）已修复**：33 行逐组信号式收窄（7 生成器，修复口径见 §0.10）；登记 seed 反例 + token 回指断言 7/7；P2 面审计复跑候选 47→14（33 缺陷行差分清零，残留 = 2 弱参与 + 12 工具误报）。修复同时收口 T2 证据规则 7 行过期签名（P40 先例，before/after 见 docs/P42/change-log.md）。

---

## 修复优先级建议（按 P42-1/2/3 分期；2026-10-18 P42-1A 复核后修订）

| 优先级 | 缺陷组 | 理由 |
|---|---|---|
| **P42-1 (立即立项)** | **003-009（复核确认 7 例）** + 026 (真值门禁) + 027 (golden 重算) + 031 (makeByItem 同拼接点新变体，1C 面审计发现) | 001/002、010~018 经复核为审计工具误报（§0.4），移出修复范围、转为 P42-1C 重算器的正确性要求；003-009 根因单点（concept-meaning.js makeByItem 解析拼装），可一处修复+七形态回归；**031 已于 P42-4 修复**（§0.12，纯算式形态守卫）；**027 残余已于 P42-5 闭合**（§0.13，build 写入前真值门） |
| **P42-1 (并行)** | 028 (实例级难度强制) + 029 (解释质量 gate) + 032 (fraction 约分列式假等值，1C 面审计发现) | 复用既有 validator/模板单点修复，仅需提升 required/加入 check-all 或改一处模板；**028/029/032 已于 P42-4 修复/闭合**（§0.12：check-all 第 23 项实例级门禁 + 列式右值=本步商；pipeline required 路径证实空操作） |
| **P42-2** | 019 (apply 模板不一致) + 020-022 (单位超纲) + 024 (开放式答案分类) | 需 Generator 模板改动 + KP 单位白名单映射 + 教学评审；**019、020-022 已于 P42-2A 修复**（§0.8），余 024 待人工 |
| **P42-3** | 023 (prompt 复用指标化) + 025 (apply 非数值验证器) + 030 (CI Chrome) + 033 (跨 KP 错挂家族 33 行，2B 面审计新发现) | 需新指标/新验证器/基建配置，范围较大；**023/025 指标工具已于 P42-2B 交付**（§0.9），**033 已于 P42-2C 提前修复**（§0.10，33 行差分清零）；**阈值治理与 030 已于 P42-3 完成**（§0.11，030 含 Chrome 环境 33/0/0 实测闭合） |

---

## 复现方法汇总

所有样本可用 deterministic seed **`p42|<kp>|<qt>|d3`** 复现（`p42|math-g2-down-u02-k001|fill|d3`）：

```bash
cd /Users/zhanggaozhang/Code/Homework Help
node -e '
require("./dev/_bundle-env.js");
var PS=require("./shared/engine/practice-session.js");
(async()=>{var s=new PS({subject:"math",grade:2,count:1,difficulty:3,knowledgePointId:"math-g2-down-u02-k001",questionType:"fill",seed:"p42|math-g2-down-u02-k001|fill|d3"});await s.start();console.log(JSON.stringify((s.semanticQuestions||[])[0],null,1));})();
'
```

批量重跑：`node /var/folders/x4/q_p8v15x7d3f4chb4b7_wz640000gn/T/opencode/p42/battery.js`（产出 `battery-out.json`）。