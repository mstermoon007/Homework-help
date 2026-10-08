# P32 任务书 · 答案系统收口（单一判分权威 + 答案防污染）

> 状态：**P32 战役最终冻结：AS-17、AS-16C/D/E/F/G/H、AS-18、AS-19、AS-20、AS-20-补充、AS-21 全部完成**（2026-10-08；阶段一/二已确认，阶段三于门禁证据复跑核实一致（npm test 735/735、check-all 29/0/1）后经用户指令「核对阶段三的进度细节，继续推进项目」确认过门。证据见 §9 与 change-log：P32-AS-04~09、AS-11/12/13/15、AS-16 58 条 A 桶泄露全闭环（PAREN-RHS 44→0、DBL-EQ 11→0）；延伸两条——**AS-16 延伸** choice 索引约定单一值约定 + enforce 预归一（96 choice 行假答案修正，CHOICEBAD 0）、**AS-14** apply/geometry 长文本说理 85 行 gradeUserAnswer→null 走家长检查（闰年 fill/apply 答案分离、分类 apply 结论句泄露修复）；**AS-17** gradeUserAnswer 单元测试补盲 7 用例（npm test 742/742）；**AS-16C** C 桶裁决落地（用户裁决 2026-10-07：#1~11 白名单固化进 AS-18 门禁、#12 比例判断删「积相等」结论句、#13 geometry 第 0 档弱题干换规范问句；L1 复扫 80 行 = B 17 / P 22 / 数据巧合 2 / C 已闭环 / 新登记 1；npm test 742/742、check-all 29/0/1）。1570 自判 FALSE=0/NULL=85（84 apply+1 geometry，逐条核对为开放题）/LEAK=0；check-all 29/0/1。AS-18 已上线（`dev/p32/check-answer-leak.js` 门禁第 31 项：L1 严格 token 扫描 + 163 条显式白名单注册表（#1~11 + B/P/数据巧合固化）、L2 渲染 SVG text 扫描——修复 AS-02 只扫 q.graphic 漏 data.graphic 的审计盲区，553 渲染全 SUCCESS、L2 首扫 36 条经用户裁决修复 9 行（stats/arithmetic/money segment 图所求段标注改 '?'）+ 白名单 1 行（g3-up-u03-k002 C-UNIT 延伸）、L3 结构断言、L4 hint=0、自判回放 FALSE=0；npm test 742/742、check-all 31 项 30/0/1）两项登记均已销账——质数/合数 apply 答案缺陷由 AS-16D 修复，fill 引号错乱（含同根因 choice 引语未闭合）由 AS-16E 修复（2026-10-07，npm test 742/742、check-all 31 项 30/0/1）；**AS-19** 真实运行时闭环 + D7 WYSIWYG 回归（2026-10-08，纯只读取证无生产代码改动；3 场景 ×7 类断言 = 86 断言全 PASS / FAILS=0：A1 作答前零答案/零解析/零错因 11 子断言、A2 提交后错题显答案 + judge 显解析 + 假命题 wrong 显错因、A3/A4 显示答案开/关每卡 .revealed-answer、A5 打印零答案 DOM 克隆 + 直渲双路径、A6 错题重做轮答案重新隐藏 6 子断言、A7 屏打 WYSIWYG `--grid-cols` 同源；G1-judge `[info]` total=6 wrong=4 right=2 totalJudge=6 judgeWrong=4 judgeWrongFalse=2 假命题 wrong 路径触发 misconception 数据链断言；npm test 742/742、check-all 31 项 **31/0/0**（CHROME_BIN 就位 CI 标尺达成）；证据见 change-log P32-AS-19）；**AS-20** parentCheck 断链修复 + 旧链零引用终验（2026-10-08，用户裁决「修订红线 #2」覆盖 8 字段不变条款，新增 `result.parentCheck` 第 9 字段聚合 `grade===null` 信号——`shared/core/check.js computeResult` L50 `if (grade === null) parentCheck = true;`，`results[i]` 仍按 `grade===true` 计 false 不"非空即对"（红线 #5 不破），UI 既有 `practice.html L1041-1053` 死分支由死转正——「✅ 请家长检查」面板生效；契约重写 2 条 + 新增 3 条断言（null→parentCheck=true、全可判集→false、空集→false）；Node 契约直验 11/11 全过；定向 8/8 PASS、npm test 742/742、check-all 31/0/0；不重建 bundle（check.js 不在 bundle 内联清单）；证据见 change-log P32-AS-20）；**AS-20-补充** 端点 D 断链修复扩展（2026-10-08，用户裁决「扩展 AS-20 修 D 端点」——AS-21 验证暴露 AS-20 漏修的桥接层透传断链：practice-bridge.js submit() emitSubmit 与 practice.html applySessionSubmitFeedback 两处重建反馈对象时均未拷贝 parentCheck 字段，导致 AS-20 在 check.js 落地的 parentCheck 信号被桥接层吞掉、UI 既有 parentCheck 分支仍死分支；最小修改在两端 SSOT 层落地：practice-bridge.js L374 `parentCheck: !!(result && result.parentCheck)` + practice.html L897 `parentCheck: !!fb.parentCheck`；AS-20 risk④ 浏览器 E2E 取证销账 9/9 PASS：G2-apply 4 题长文本说理（math-g2-up-u01-k003~k006，ansLen 60-73 全 >6 汉字）+ 填入非空 dummy「答」字 12 个 input 触发 apply/geometry null 分支（gradeUserAnswer L375 空作答直接返回 false 不到 null 分支，须非空触发）→ resultArea 显示 `<div class="result parent-check"><div class="score parent">✅ 请家长检查</div>` 面板、不含「N 分」分数面板；npm test 742/742、check-all 31/0/0；不重建 bundle；证据见 change-log P32-AS-20-补充）；**AS-21** 最终冻结（2026-10-08，无生产代码改动仅任务书状态行收口；npm test 742/742 PASS / 0 FAIL；check-all 31 PASS / 0 FAIL / 0 SKIP CI 标尺达成；bundle 16/17 确定性 PASS；375/98/373/1570 口径不变；冻结矩阵/档案重冻一致；AS-20 risk④ 销账 9/9 E2E 断言全过；不自动 git commit；证据见 change-log P32-AS-21）；剩余待裁：13 条矩阵数据事实缺口已固化明细并转人工挂账（AS-16H），P32 内无待裁项）
> 日志：`docs/P32/change-log.md`
> 编号：P32-AS-01 … P32-AS-21（AS=Answer System）。阶段过门须用户确认。
> 上游输入：`docs/audit/answer-system-audit-report.md`（2026-10-07 只读审计六项发现）+ 用户《P32-AS 16 任务方案》。
> 本任务书为上述输入经代码核实后的修正版，冲突以本文件为准。
> 规则衔接：本战役在 P28/P30/P31 已冻结架构上做**接通与删改，不重建**；P31 红线在本战役继续有效，
> 本文件 §7 另追加 P32 专属红线。用户尚未发布 `.trae/rules/p32-*.md`，在其发布前以本任务书为执行依据。

---

## 1. 战役目标

1. **判分权威唯一**：运行时批改（用户作答 vs 题目答案）与出题质检（题目答案 vs 题干重算）
   同归 `shared/validator/answer-validator.js` 一个模块；删除 `defaultQCheck` 第二套判定。
2. **答案数据不丢失**：RenderFormat 保留完整 answer 规格，acceptable 白名单在运行时真实生效。
3. **答案不污染练习过程**：作答前题面、选项、图形、DOM、打印文档零答案、零解析；
   acceptable 只判分永不上屏；解题思路（explanation）/错因（misconception）只走提交后通道；
   提示（hint）无正式生产者前全程不展示，内部溯源标记不得污染教学语义字段。
4. **不可自动判有边界**：作图/说理类走既有 parentCheck（家长检查）机制，禁止非空即对。

一句话：**一个判分模块、一份答案规格、一条可见时机规则；生成的练习题不自带答案。**

## 2. 立项前已核实的现状证据（2026-10-07，代码级）

### 2.1 两条不对等的判定链（审计报告发现 1/4，已复核属实）

| 链 | 入口 | 消费数据 | 能力 |
|---|---|---|---|
| 运行时批改 | `PluginUtil.computeResult(q, answers)` → `defaultQCheck`（`shared/core/check.js` L14-26） | legacy `q.answer`（单字符串，RenderFormat 已把 acceptable 降维丢弃） | 去空白/余数记号/小写后整串相等；multi 分字段；**不消费 acceptable/precision/unit** |
| 批量门禁 | `validation-pipeline.js` L38 → `AnswerValidator.validateAnswer(sq)`（`shared/validator/answer-validator.js` L332-390） | 完整 `sq.answer{value,acceptable,precision,...}` | acceptable 白名单、数值精度容差、余数语义、choice 选项归属、judge 格式 |

**关键修正（决定架构）**：`validateAnswer` 的语义是**出题质检**（从题干重算 expected 核对题目自带答案），
与运行时「用户答案 vs 题目答案」方向相反，**不可直接接线**。收口方式 = 在 AnswerValidator 模块内
新增唯一运行时判定函数 `gradeUserAnswer(userRaw, answerSpec, ctx)`，复用模块内
`validateNumericAnswer / validateJudgeAnswer / validateTextAnswer / validateRemainderAnswer` 与归一化工具。

### 2.2 computeResult 的生产调用面（仅 3 处，均不传 checkFn）

| # | 位置 | 时机 |
|---|---|---|
| 1 | `shared/engine/practice-session.js` L184 | 正式提交批改 |
| 2 | `shared/engine/practice-session.js` L219 | toggleReveal 取答案数据 |
| 3 | `practice.html` L1120 | 页面「显示答案」按钮 |

输出契约（三处共同依赖，**名称与结构冻结**）：
`{score, total, correct, message, results[], correctAnswers[], explanations[], misconceptions[]}`。

### 2.3 已确认的死代码/孤儿（删除前仍须三方印证）

- `q.answerParts`：computeResult L39 消费，**全库零生产者**。
- `StorageManager.getWrongList()`：`shared/state/storage.js` L85 定义，**零 UI 消费者**
  （错题本只存不显示；addWrong 存的 questionData 含整题含答案，但无渲染出口）。
- normalizeAns 实际能力（`shared/core/core.js` L161-167）：trim、去全部空白、
  余数记号归一（`…/.../余`→`……`）、小写化。**无中文数字转换**——审计报告该例不成立，不凭空补链。

### 2.4 当前防泄露现状（已干净，作为冻结基线，只加断言不破现状）

- 作答 input 不预填 value、judge/choice 控件不预选、选项无正确标记（html-renderer.js L81-94、L127-157）。
- 打印文档剥离 `.feedback/.reveal/.step-hint/.correct-answer` 等（print.js L154-159、L223-227），作答区留空。
- explanation/misconception 仅提交后由 `markQuestions`（practice.html L995-1034）注入；
  judge 解析提交后可见（答对也显示），非 judge 不展示解析（维持现状，本战役不扩）；
  错因仅错题可见；正确答案仅错题或手动「显示答案」可见。

### 2.5 已发现的真实污染点

- `shared/generator/core/variation-apply.js` L174：把内部变式 key（'说明思路'/'比较解法'/'解释为什么'）
  拼进教学语义字段 `q.hint`；同值另存 `q.data.cognitiveHint`（变式溯源）——q.hint 一侧为重复污染写入。
  全 maker 均 `hint:null`，hint 当前零展示消费者（practice.html/html-renderer 零消费）。

### 2.6 judge hardcode true（审计报告发现 2，属实）

`answer-validator.js` L354-357：judge 分支 `validateJudgeAnswer(answerObj, true)` 默认期望 true，
答案为 false 的题在门禁被假阳性 ERROR 后又压成 INFO warning。正确做法：以题面自带 `answer.value`
为期望做答案自证（格式/二值合法性 + 选项语境一致性），无从题干推断布尔的义务。

## 3. 已锁定决策（用户 2026-10-07 批准/裁决）

1. 批准四阶段计划，先落本任务书与 `docs/P32/change-log.md` 再执行；编号 P32-AS-01…21。
2. **hint 处置**：保持 null 语义；阶段三物理删除 variation-apply 对 `q.hint` 的内部 key 污染写入
   （溯源保留在 data.cognitiveHint）；无正式提示内容前全程不展示，**不新建提示 UI**。
3. **解题思路展示**：维持现状——explanation 数据继续随 computeResult 收集透传，
   judge 提交后可见、非 judge 不上屏；本战役只保证其不被污染、不提前出现，不扩大展示面。
4. **新增答案泄露门禁**：`dev/p32/check-answer-leak.js`，对真实生成跑 L1-L4 规则，
   纳入 check-all（项数口径 30→31，CI 31 PASS / 0 FAIL / 0 SKIP；本地无 Chrome 1 SKIP），
   日志登记，沿用 P30 增设门禁先例。
5. RenderFormat 保数据方式：**显示用 `q.answer` 主答案字符串不动**，新增只读
   `q.answerSpec{value,acceptable,precision,unit,mode}`；批改禁止回读 `q.__semantic`（不跨层取语义对象）。
6. apply/geometry 不可自动判子类 → 复用既有 parentCheck 分支（practice.html L1041-1052），不新建机制。

## 4. 答案相关字段可见时机矩阵（冻结，全战役验收基准）

| 字段 | 内容定性 | 作答前 | 提交后 | 手动「显示答案」 | 打印 |
|---|---|---|---|---|---|
| `answer.value` 主答案 | 判分 + 揭示 | 禁 | 仅错题可见 | 可见 | 禁 |
| `answer.acceptable[]` 等价答案 | **只判分，永不上屏** | 禁 | 禁（反馈文案不得枚举） | 禁 | 禁 |
| `answer.precision/unit` | 判分参数 | 禁 | 禁 | 禁 | 禁 |
| `answer.explanation` 解题思路 | 教学语义 | 禁 | judge 可见；非 judge 维持不展示 | 不展示 | 禁 |
| `data.misconception` 错因 | 教学语义 | 禁 | 仅错题可见 | 不展示 | 禁 |
| `hint` 引导提示 | 无 SSOT 生产者 | 不展示 | 不展示 | 不展示 | 禁 |
| 题面 prompt / 选项 / SVG | 作答材料 | 不得含答案值、结论性表述、结果标注 | — | — | 同屏规则 |

**威胁模型边界**：防题面、选项、图形、DOM、打印文档泄露；答案必须随题下发以支持本地零网络批改，
**不防内存/DevTools 查看**，不做此类伪安全。

## 5. 冻结范围（不允许做）

- KBL（375/98/373/1570）/ KnowledgeContext / POL / Strategy 决策权 / 7 题型集合 / 难度唯一公式 /
  题量决策：一律不动。Generator 对 maker 的修复仅限答案规格完整性与已证实泄露点，不改 KP/题型/难度选择。
- SemanticQuestion 契约的既有字段语义；LayoutPlan 不进 SQ/RenderResult（沿用 P31）。
- SVGSanitizer 安全边界、GraphicDescriptor 结构；SVG 仍只表现 Generator 确定的语义。
- 一/二/三级页面按钮、导航、流程、控件、页面结构（practice.html 仅允许答案/反馈消费相关最小接线）。
- 不新建提示 UI、不建第二判分引擎、不建 shim/adapter/COMPAT。

---

## 6. 任务清单（四阶段）

### 阶段一 · P32-AS-SCAN：只读审计与契约冻结（禁改一切生产代码）

#### P32-AS-01 答案链调用图与 maker 答案契约登记
- 产出：
  1. 生产端 23 generators 逐 maker 答案规格登记表：answer 五字段（value/acceptable/precision/unit/explanation）
     实际产出、answerMode、multi 字段形态、是否带 graphic。
  2. 消费端字段-时机矩阵核实（本任务书 §4 的代码证据补全到行号）。
  3. defaultQCheck / normalizeAns / answerParts / getWrongList 删除面三方印证初稿。

#### P32-AS-02 答案泄露面对真实生成审计（1570 + 定向边界）
- 一次性探针（/tmp，用后即删；沿用 P31-01 取证方式），规则：
  - **L1 题面泄露**：fill/calc/apply 的 prompt 不得包含 value 或 acceptable 任一原文
    （数值题按 token 边界匹配，避免「3」命中「13」误伤；choice 正确项作为选项合法，单独白名单；
    judge 题面不得含结论性表述）。
  - **L2 图形泄露**：SVG 字符串 `<text>`/标注不得含答案值；几何/分数图形不得把所求量化为已知
    （逐 graphic role 建立「允许出现的数字 = 题干已知量」核对规则）。
  - **L3 语义串道**：explanation/misconception 文本不得出现在 prompt/options/SVG；
    内部溯源 key（variation key、cognitiveHint 等）不得出现在 prompt/options/hint/explanation。
  - **L4 hint 清点**：全生成中 hint 非 null 的题逐条登记来源（预期仅 variation-apply cognitive 桶）。
  - **L5 出口核对**：渲染 HTML（screen）作答前无答案/解析节点；print 模式 HTML 无答案/反馈；
    错题重做轮答案重新隐藏。
- 产出：泄露个案清单（题型/KP/seed/字段/证据片段），按「真泄露 / 合法白名单 / 待人工裁决」三向分流。

#### P32-AS-03 三份契约冻结
- 契约 A：answer 五字段语义（含 acceptable「仅格式等价的正确答案」严格定义、precision 口径、unit 准入条件）。
- 契约 B：`gradeUserAnswer(userRaw, answerSpec, ctx)` 分派表
  （answerMode/inputType × 题型 → 归一化与比较规则；multi 的 classify 顺序无关单列）。
- 契约 C：题型自动可判矩阵——calc/fill/choice/judge 自动判；classify 按结构可判；
  apply 数值子问可判、说理子问 parentCheck；geometry 作图 parentCheck；read-aloud/none 不判分。
- **过门判据**：三份证据（登记表/泄露清单/契约表）齐备并经用户确认，才准进阶段二。

### 阶段二 · P32-AS-CORE：单一判分权威收口（validator / render-format / check）

#### P32-AS-04 RenderFormat 保留完整答案规格
- `shared/presentation/render-format.js`：保留 `answer` 显示字符串；新增 `answerSpec` 只读对象
  （value/acceptable/precision/unit/mode + multi 字段形态）；同步 renderer 契约测试。

#### P32-AS-05 gradeUserAnswer 唯一运行时分派
- `shared/validator/answer-validator.js` 新增运行时判定函数（与 validateAnswer 同模块、方向分离）：
  judge 布尔归一（trueSet/falseSet）对期望；choice 选项值精确匹配；multi 分字段；
  numeric/text 走 value+acceptable 白名单（precision 容差、余数记号、去空白/大小写归一）。
  归一化在本模块一处实现。

#### P32-AS-06 computeResult 改走 gradeUserAnswer
- `shared/core/check.js`：内部逐题调 gradeUserAnswer，结果转 boolean results；
  correctAnswers 只取主答案显示值；函数名与 8 字段输出结构一字不改；三调用点零改动。

#### P32-AS-07 judge hardcode true 修复（门禁侧）
- validateAnswer judge 分支以 answer.value 自证期望，删除 hardcode true 与假阳性 INFO。

#### P32-AS-08 旧判定链物理删除
- 三方印证后删除：defaultQCheck（含 global/defaultQCheck 裸挂载与 PluginUtil 挂载）、
  answerParts 死分支、无消费者后的孤儿 normalizeAns；opts.checkFn 轨道同步移除。不留 shim。

#### P32-AS-09 防污染负断言（阶段二批次）
- 新测试：作答前 screen HTML 零答案/零解析；print HTML 零答案/反馈；
  acceptable 不出现在 correctAnswers 与任何反馈字符串；错因/解析只在提交后通道出现。
- **过门判据**：tests/core·validator·presentation 定向全绿 → npm test → check-all
  → 重建 strategy/presentation 两 bundle（16/17 确定性）→ 日志 → 用户确认。

### 阶段三 · P32-AS-GEN：maker 答案语义补全与泄露修复（逐 maker，不扩架构）

#### P32-AS-10 23 generators 答案规格普查与缺口清单
- 以 AS-01 登记表为底，产出「补/改/不动」三类清单；缺口只登记到 maker 代码（确定性产出），不手编教学 JSON。

#### P32-AS-11 acceptable 语义修复
- 只许格式等价正确答案（余数记号、等值小数按 precision、单位书写按 unit 契约）；
- 错误值混入白名单 → 门禁 FAIL；等价缺失 → maker 确定性补齐。

#### P32-AS-12 precision / unit 接通
- precision 进运行时数值判定（AS-05 已留消费口）；unit 仅在确有真实生产者与题干单位语境时接通，
  无生产者不建抽象。

#### P32-AS-13 classify 集合答案
- **【阶段一证据修正】classify 不是 multi 分字段**：25 行（全 stats）answer 为单字符串「类别：项、项；…」，
  结构化数据在 `data.groups/items/sort`，legacy inputType=text。gradeUserAnswer 按 data.groups 做
  「组 → 项集合」顺序无关解析比较（组分隔 `；`、项分隔 `、，,`、名称归一），走 AS-05 分派表，不建题型引擎；
  解析失败 → null（走 parentCheck，禁止整串相等或非空即对）。

#### P32-AS-14 apply / geometry 自动批改边界
- 数值/短答可判子问走 gradeUserAnswer；作图/说理走 parentCheck；现状「非空即过」类发现一律改为显式边界。

#### P32-AS-15 hint 污染治理
- 物理删除 variation-apply.js L174 对 q.hint 的写入；cognitiveHint 溯源保留 data；
- 审计 explanation/misconception 文本无内部 key/机器标记（有则按泄露处理）。

#### P32-AS-16 题面/图形泄露修复
- 按 AS-02 清单逐 maker 修，每点 = 修复前复现 seed + 修复后定向断言；
- 题面文案若变动：重跑 `dev/p27/derive-variation-profiles.js` + `derive-misconceptions.js`，
  `check-generation-matrix-frozen --write` 重冻并重生成矩阵；1570 零 fake/placeholder/empty/fallback。
- **过门判据**：6a/6b/6c/6d/7/8 全绿、泄露清单三向分流全部闭环、check-all、日志、用户确认。

### 阶段四 · P32-AS-CLOSE：测试 · 门禁 · 清理 · 冻结

#### P32-AS-17 单元测试补盲
- gradeUserAnswer 各分支、acceptable 边界（空数组/重复值/错误值）、precision 边界、
  余数各记号、judge 真值、classify 顺序无关、answer 为 null 防御。

#### P32-AS-18 答案泄露门禁正式化
- `dev/p32/check-answer-leak.js`：L1-L4 规则跑真实生成；纳入 `dev/check-all.js` 清单（30→31 项）。
- ✅ 已完成（2026-10-07）：门禁第 31 项（6g）上线；163 条白名单注册表固化；L2 修复 AS-02 审计盲区
  （renderer.js 归一化兜底 data.graphic）并按用户裁决修复 10 条真泄露中的 9 行 + 白名单 1 行；
  L3 结构断言 / L4 hint=0 / 自判回放 FALSE=0；`npm test` 742/742、check-all 31 项 30 PASS / 0 FAIL / 1 SKIP。
  证据见 change-log P32-AS-18。

#### P32-AS-19 真实运行时闭环 + D7 回归（真实 Chrome E2E）
- 作答前零答案/零解析断言 → 提交后错题显答案、judge 显解析、错因显错因 →
  「显示答案」开/关 → 打印文档零答案 → 错题重做轮答案重新隐藏；
- D7：screen/print WYSIWYG 不受判定链改动影响（列数/宽度/页边距同源回归）。

#### P32-AS-20 旧链零引用终验 + parentCheck 断链修复
- 死代码三方印证（全库 grep + 门禁 21/22 + 测试面）物理清除，无 shim/别名/双轨。
- **parentCheck 断链修复**（用户裁决 2026-10-08 列入 AS-20）：
  - 四要素登记：
    - 端点 A（判定端）：`shared/validator/answer-validator.js` `gradeUserAnswer` 对 apply/geometry 长文本说理返回 `null`（AS-14 落地，85 行 eligible）；
    - 端点 B（聚合端/SSOT）：`shared/core/check.js` `computeResult` L42 `var ok = grade === true;` 把 `null → false`，**未设置** `result.parentCheck` 字段；
    - 端点 C（UI 消费端）：`practice.html` L1041-1053 `if (result.parentCheck) { …✅ 请家长检查… }` 既有分支永远死分支；
    - 复现路径：任一 apply/geometry 长文本说理 KP（如 AS-14 登记的 85 行）→ 提交 → `grade=null` → check.js 聚合为 `results[i]=false` → UI 走普通分数面板，"✅ 请家长检查"面板从未生效。
  - 最小修改方案（在 SSOT 层 `shared/core/check.js` 落地，不新建机制不建 adapter）：
    - computeResult 内追加 `null` 等级聚合：任一 `grade === null` → `result.parentCheck = true`；
    - 同时保留 `results[i] = false`（`ok = grade === true`），**不"非空即对"**——红线 #5 不破；
    - `correct` 不变（null 不计为正确），`score` 公式不变；
    - `result` 新增字段不进 SemanticQuestion/RenderResult 契约（P31 红线 #6 不破），仅 PluginUtil.computeResult 返回值字段层。
  - 验证：定向单元测试（apply/geometry 长文本 → `result.parentCheck === true`、`results[i] === false`、`correct` 不含此题）；G2-apply 场景重跑探针 `pc=true`；npm test 742+1/0 FAIL；check-all 31/0/0；两 bundle 重建。
  - 改后动作（按 ai-coding-workflow §9）：定向测试 → npm test → check-all → 重建 `presentation-engine.bundle.js` + `strategy-engine.bundle.js`（如引用方涉及）→ 追加 change-log P32-AS-20。

#### P32-AS-21 最终冻结
- npm test 0 FAIL；check-all：本地 30 PASS / 0 FAIL / 1 SKIP（新增门禁后本地 30、CI 31 / 0 / 0，
  以实际清单为准并日志登记）；bundle 16/17 确定性；375/98/373/1570 口径不变；
- 冻结矩阵/档案重冻一致；change-log 收口。**不自动 git commit**（须用户显式指令）。

---

## 7. P32 红线（在 P31 红线基础上追加；触犯任一：停止→举证→回退→重走流水线）

1. 判分权威只许 AnswerValidator 模块一处（validateAnswer 出题质检 + gradeUserAnswer 运行时判分），
   禁止第二判定引擎、shim、adapter、双轨。
2. computeResult 函数名与既有 8 字段输出结构不变；**AS-20 显式指令覆盖**（用户裁决 2026-10-08）：新增 `parentCheck` 第 9 字段聚合 `grade === null` 信号（任一 null → `true`，`results[i]` 仍按 `grade === true` 计 false，不"非空即对"），UI 既有 parentCheck 分支由死分支转正；三调用点契约不破。
3. acceptable 只用于判分，永不上屏、不入反馈文案、不入错题记录的展示字段。
4. 作答前题面/选项/图形/DOM/打印零答案、零解析、零错因；解题思路只走提交后既有通道，hint 无 SSOT 不展示。
5. 不可自动判 → parentCheck；禁止非空即对、catch→''、降 Validator 标准。
6. 不改 KBL/7 题型/难度公式/题量决策；不为测试 PASS 改测试标准或删失败用例。
7. 题面/答案文案变化必须重跑派生器并重冻矩阵；任何改动必须重建受影响 bundle。
8. 不新建顶层目录/第二套系统；`shared/` 是唯一下沉点；新门禁脚本归 `dev/p32/`。
9. 顺手重构/无限审计/连锁修无关缺陷禁止；任务外发现只登记不顺手修。
10. 每阶段过门须用户确认；不自动 git commit；所有改动按六字段登记 `docs/P32/change-log.md`。

唯一允许偏离：用户显式指令覆盖某条，并在 change-log 的 reason 中留存指令依据。

## 8. 阶段门禁总表

| 阶段 | 编号 | 局部门禁 | 过门判据 |
|---|---|---|---|
| 一 SCAN | AS-01…03 | 只读，无代码门禁 | 登记表 + 泄露清单（A/B/P/C 四向分流）+ 三契约齐备（见 §9，待用户确认） |
| 二 CORE | AS-04…09 | tests/core·validator·presentation；npm test；check-all；16/17 | 判分单权威；输出结构零变化；防污染负断言全绿 |
| 三 GEN | AS-10…16 | 6a/6b/6c/6d/7/8；派生器重跑；矩阵重冻 | 泄露清单全闭环；1570 零 fallback；规格无缺口 |
| 四 CLOSE | AS-17…21 | 新门禁；真实 Chrome E2E；check-all 全量 | 三路径（屏/打/重做）验收；死代码清零；冻结一致 |

---

## 9. 阶段一执行记录（AS-01/02/03 取证，2026-10-07）

> 取证方式：一次性探针（/tmp，用后即删）对 **1570 ALLOW 对全部真实生成**（`PracticeSession` count=1，
> seed=20261007），**1570/1570 成功，0 失败**；未改任何生产代码。

### 9.1 AS-01 生产端答案规格普查结果

1. **value / explanation**：1570 行全部非空（0 缺失）；explanation 100% 覆盖，是判分+教学双通道的既有基线。
2. **acceptable**：1385 行空数组；185 行非空 = **179 行 value 原样复制（冗余、零替代价值，主要
   concept-meaning 149 + semantic-relations 33）+ 6 行真等价答案**。6 行裁定：

   | KP | 题型 | value | acceptable | 裁定 |
   |---|---|---|---|---|
   | g2-down-u02-k005 | fill | `△` | `[["△","□","○"]]` | **缺陷**：嵌套数组且把循环周期整体误作等价答案（「第 25 个」唯一解 △），AS-11 清空 |
   | g3-down-u04-k001 | geometry | `甲` | `甲, 图形甲` | 合法格式等价 |
   | g3-up-u07-k002 | fill | `2` | `2, 两` | 合法中文数字等价 |
   | g4-up-u02-k001 | geometry | `直角` | `90度, 90°` | 合法语义等价 |
   | g4-up-u02-k003 | geometry | `直角` | `90度, 90°` | 合法语义等价 |
   | g5-down-u03-k006 | geometry | `120` | `120立方厘米` | 合法带单位等价 |

3. **precision / unit：1570 行全零生产者**。AS-12 据此收口：gradeUserAnswer 只留 precision 数值容差消费口
   （validator 既有默认 2 位容差），**不建 unit 数据链/不新增抽象**；未来出现真实生产者再经既有任务流程接通。
4. **misconception**：31 行非空，几乎全在 judge 系（money/position/mixed-calc/concept）；其余 1539 行为空。
5. **hint**：0 行非空（单题固定 seed 下 cognitive 变式桶未触发）；variation-apply.js L174 的污染写入
   仍按 AS-15 物理删除（源码事实，不因本次未触发而豁免）。
6. **graphic**：553 行带图形描述符（shape/position/money/stats 系为主）。
7. **inputType/answerMode 现状**（legacy = RenderFormat 归一后）：

   | 题型 | 行数 | legacy inputType | SQ answerMode 备注 |
   |---|---|---|---|
   | fill | 375 | text | 全 input |
   | choice | 375 | choice | 全 choice |
   | judge | 126 | judge | 115 judge + **11 input**（g2-up-u05×2、g3-down-u04×3、g3-up-u03×2、g3-up-u07、g6-up-u02×3；几何/测量系 maker 漏标） |
   | geometry | 105 | text | 全 input |
   | apply | 375 | text | 全 input |
   | calc | 189 | text | 全 input |
   | classify | 25 | text | 全 input；**无任何 multi** |

   judge answer 取值分布 **true 94 / false 32**——32 行 false 正是 L354 hardcode true + INFO 压制的受害者，
   AS-07 修复后门禁须双向校验。RenderFormat L49 已按 questionType 归一 inputType，故 UI 无异常；
   **gradeUserAnswer 分派以 questionType 为唯一判据，不采信 answerMode**。
8. **classify 25 行（全 stats）答案形态**：answer.value 单字符串，形如
   「红色：红圆卡、红方卡、红三角卡；蓝色：蓝圆卡；黄色：黄方卡」；结构化数据在
   `data.groups / data.items / data.sort`（dataKeys: mode,steps,questionType,sort,items,groups,semanticEvidence）。
   当前走 text 整串比较，学生不可能逐字答对——AS-13 已据此修正（见 §6）。
9. 生成器侧 maker 规模表（generator×qt 的 n/acceptable/graphic/mode 全量 76 行组合）已在普查中间产物核验：
   23 generators 注册、18 个 maker 源文件；规格修复面实际集中于 concept-meaning / semantic-relations /
   stats / shape-recognition 四家 maker，AS-10 以此排「补/改/不动」清单。

### 9.2 AS-02 泄露面审计结果（五层）

**L1 题面（114 条 token 命中 → 权威终判四向分流，0 未归类）**：

| 桶 | 数量 | 定性 | 处置阶段 |
|---|---|---|---|
| **A 真泄露** | **58 条 / 32 KP** | 题面直接写出或已算出答案 | AS-16 逐 maker 修（修复前 seed 复现 + 修复后断言） |
| **B 操作数重合** | 22 条 | 答案 token 仅为待解算式操作数/逆运算事实族支架（如 `14 − 7 = ?` v=7、`6×8=48 → 48÷6=?` v=8） | 白名单（门禁显式规则，非黑名单兜底） |
| **P 教学必需** | 12 条 | 答案 token 是任务必需已知量（比较题人名/成绩、规律题颜色名、已知角 90°、「1 瓶次品」等） | 白名单 |
| **C 待人工裁决** | 22 条 | 概念/性质支架（「分 4 份→1/\_\_」「点距 3 格→对称点\_\_格」「1 米分 10 份→1 米=\_\_分米」等），抄写还是推理需教研定 | **AS-18 门禁上线前必须逐条裁决**（修复或登记白名单+理由），不得悬置 |

A 桶五种形态（机械可检测，构成 AS-18 L1 规则主体）：
1. 参考句给结果：`（参考：7 + 1 = 8）` 再问同一结果（concept-meaning 为主）；
2. 括号内完整算式 RHS=答案：`（60 + 8 = 68），写作多少？`；
3. fill 双等号病句：`参考：7 + 1 = 8 = ____`、`48 ÷ 6 = = ____`（**病句共 38 条 fill，随 A 同批修**）；
4. 引导式已算出未知数：`1 × x = 4 × 6 = 24，x = ？`（semantic-relations g6-down-u04×3）；
5. 规则句/陈述直接给结论：`偶数 + 偶数 = 偶数，16 + 8 的和是 ____`；以及文字复述图形应读出的量
   （`另一端对着刻度 8，铅笔长 ____ 厘米`）、叙述已给所求（`8 盒共 48 支…是多少盒`）、
   定义例题自问自答（stats「把红色的 3 个分在第一段…第一段表示 ___」6 条）、
   坐标自陈（`（____，8），它在第 5 列`）。

A 桶分布：concept-meaning 38（calc 14/fill 11/apply 13）、fraction-number 6（全 fill）、
stats 6、shape-recognition 4、semantic-relations 3、position-direction 1。

另登记 1 条**答案规格缺陷**（非泄露）：g5-down-u02-k002 系 g5-down-u02-k004 apply
「21 是奇数还是偶数」但 `answer.value="21"`（应为「奇数」），AS-10/11 修。

**L2 图形**：1570 行 SVG `<text>`/标注含答案值 **0**。
**L3 语义串道**：explanation 与题干同模板高重合，第一轮前缀重合启发式 40 条全误报——
**AS-18 禁止使用文本重合启发式**；防串道改走结构断言（explanation 唯一流道 = computeResult 提交后通道，
html-renderer 零读取 q.explanation，源码层已核）。内部 key 入题面真实 0。
**L4 hint**：非空 0；L174 污染写入照删（AS-15）。
**L5 出口（作答前）**：
- screen 全量 1570：text input 预填 value **0**、checked/selected **0**、非空 `.feedback`/reveal 节点 **0**、
  data-*/title/aria 属性携答案 **0**；`<div class="feedback"></div>` 空占位合法
  （html-renderer.js L244/L297；提交后由 markQuestions 注入；print.js L226-227/L237 CSS 隐藏）。
- print 分层抽样 168 份（每题型 24 份，`Print.buildFromQuestions` Node 直构）：预填/checked/反馈内容/
  reveal/作答区残留输入框 **0 命中**。
- 重做轮答案隐藏属既有 markQuestions 行为，AS-19 真实 Chrome E2E 回归取证。

### 9.3 AS-03 三份契约（冻结）

**契约 A · answer 五字段语义**

| 字段 | 语义 | 运行时 |
|---|---|---|
| `value` | 主答案（显示 + 判分基准）；必须非空、类型 string | 错题/显示答案时上屏 |
| `acceptable[]` | **仅格式/语义等价的正确答案**（余数记号、带单位、90°↔直角、2↔两）；元素必须 string；**禁止 value 复制（179 行冗余 AS-11 清）、禁止嵌套数组、禁止错误值** | **只判分，永不上屏/不入反馈** |
| `precision` | 数值容差（位），缺省走 validator 既有默认 2 | 只判分；当前 0 生产者 |
| `unit` | 单位书写等价（如 厘米/cm）；**当前 0 生产者，不建链不消费，字段经 answerSpec 透传保留** | 只判分 |
| `explanation` | 解题思路；1570 全覆盖 | 仅提交后通道（judge 可见，非 judge 维持不上屏） |

`misconception`（data 侧，31 行）、`hint`（无 SSOT）地位按 §4 矩阵不变。

**契约 B · `gradeUserAnswer(userRaw, answerSpec, ctx)` 分派表**（answer-validator.js 内新增，与 validateAnswer 方向分离）

- 输入：`userRaw`（string；choice/judge 为控件值）、`answerSpec{value,acceptable,precision,unit}`、
  `ctx{questionType, data}`；**分派唯一键 = questionType**（answerMode 不采信）。
- 返回：`true | false | null`（null = 不可自动判 → UI 既有 parentCheck 分支；禁止非空即对、禁止 catch→''）。
- 分派：
  - `judge`：trueSet/falseSet 归一（复用 validateJudgeAnswer L269-270 词表）对 answerSpec.value 期望；非法输入 false。
  - `choice`：归一化后与 value 精确匹配（acceptable 亦须为选项值，由 AS-11 maker 侧保证）。
  - `calc/fill/geometry/apply` 数值或短答：余数答案先匹配 `q……r` 语义（b×q+r=a、0≤r<b，复用
    validateRemainderAnswer 规则）；数值走容差比较（复用 validateNumericAnswer 口径）；
    文本走去全部空白 + 小写 + 余数记号归一后 value/acceptable 白名单（复用 validateTextAnswer）；
    归一化在本模块一处实现，check.js/core.js 不再保留第二套。
  - `classify`：按 `ctx.data.groups` 解析为「组→项集合」，组内顺序无关、组间按组名配对；
    解析失败 null（见 §6 AS-13）。
  - 空作答（trim 后空串）→ false（未作答，不等于错误但本战役 UI 契约 results 为 boolean，维持 false 语义）。
- 判分所用归一化工具与 validateAnswer 共用模块内私有函数；computeResult 只消费 boolean，
  correctAnswers 只取 value 显示字符串。

**契约 C · 七题型自动可判矩阵**

| 题型 | 运行时判定 | 依据 |
|---|---|---|
| calc | 自动判 | 数值/余数/文本白名单 |
| fill | 自动判 | 同上 |
| choice | 自动判 | 选项值精确 |
| judge | 自动判 | 布尔归一 |
| classify | 结构可判（data.groups）；解析失败 → parentCheck | AS-13 |
| geometry | 数值/短答子问自动判（v=直角/甲/120 等现状全部文本可判）；**作图类**（未来出现 draw 子问）→ parentCheck | 现状 105 行均文本答案 |
| apply | 数值/短答可判；说理/开放子问 → parentCheck（practice.html L1041-1052 既有分支，不新建机制） | — |

### 9.4 阶段一门禁结论

- 登记表（§9.1）、泄露清单四向分流（§9.2）、三契约（§9.3）齐备；
- 全程只读，生产代码零改动，基线数字 375/98/373/1570 未触；
- **待用户确认后进入阶段二 CORE（AS-04…09）**。C 桶 22 条的人工裁决可在阶段三 AS-16 前给出，
  不阻塞阶段二。
