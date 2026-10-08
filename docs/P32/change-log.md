# P32 · AI 修改审计日志（Change Log）

> 战役：**P32 答案系统收口（单一判分权威 + 答案防污染）**
>
> 目的：记录每一次 AI 修改的 **任务编号 / 改动文件 / 删除文件 / 原因 / 测试 / 风险**，
> 使后续任何 AI（或人）能回答「这个文件/符号为什么存在、为什么被删、当时如何验证」。
>
> 规则（与 P28/P30/P31 日志同口径，另加 P32 约束）：
> 1. 每次 AI 修改代码、配置或文档结构，必须在本文件 **顶部（最新在上）** 追加一条记录。
> 2. 六字段必填；确实没有填「无」，不得留空、不得编造。
> 3. 任务编号：`P32-AS-01` … `P32-AS-21`（四阶段任务书见 `docs/P32/P32-TASK-BOOK.md`）；
>    立项建档本身记 `P32-INIT`。
> 4. 纯对话、只读分析、代码阅读不登记；只有产生文件改动才登记。
> 5. 修改记录是历史档案，写入后不改写数字；如需更正，追加新记录说明。
> 6. 每阶段须门禁通过并经用户确认后，才能开启下一阶段编号的任务。
> 7. 不自动 git commit；提交信息遵循 `.trae/rules/git-commit-message.md`。

## 模板

```
### P32-AS-XX｜标题（YYYY-MM-DD）
- modified:
- deleted:
- reason:
- tests:
- risk:
```

---

## 记录（新 → 旧）

### P32-AS-21｜最终冻结（2026-10-08）
- modified: `docs/P32/P32-TASK-BOOK.md`（状态行更新「P32 战役最终冻结：AS-21 已完成」+ AS-21 范围与验收矩阵；§6 AS-21 范围追加"包含 AS-20 risk④ 销账与 D 端点断链修复扩展"说明）。
- deleted: 无。
- reason: 用户指令「好的，进入 AS-21」（2026-10-08，承接 AS-19/AS-20 已完成成果，执行 P32 战役最终冻结）。AS-21 规格（task book L246-249）：npm test 0 FAIL；check-all 本地 30/0/1 或 CI 31/0/0（以实际清单为准并日志登记）；bundle 16/17 确定性；375/98/373/1570 口径不变；冻结矩阵/档案重冻一致；change-log 收口。**不自动 git commit**。本任务执行过程暴露 AS-20 risk④ 浏览器 E2E 取证时发现 AS-20 漏修的端点 D 断链（practice-bridge.js submit() emitSubmit 与 practice.html applySessionSubmitFeedback 两处重建反馈对象时均未拷贝 parentCheck 字段，导致 AS-20 在 check.js 落地的 parentCheck 信号被桥接层吞掉，UI 既有 parentCheck 分支仍死分支）——**用户裁决 2026-10-08「扩展 AS-20 修 D 端点」**（承接 AS-20 范围的完整化，不视为新任务，按 P30 §4 断链修复规则在 SSOT 层落地，不新建机制不建 adapter）。D 端点修复落地后 AS-20 risk④ 真正销账，AS-21 最终冻结判据达成。详见 P32-AS-20-补充 条目。
- tests: ①`npm test` **742/742 PASS / 0 FAIL**（14.1s）；②`node dev/check-all.js`（CHROME_BIN=`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`）**31 PASS / 0 FAIL / 0 SKIP**（CI 标尺；6a 1570 真实生成、6b 冻结、6g 答案防泄露 AS-18、12 Security、16/17 bundle 确定性全绿；#15 真实浏览器 E2E PASS）；③bundle 16/17 确定性已在 check-all 中验证 PASS（source==bundle hash 一致 + 重跑 hash 不变）；④375/98/373/1570 口径不变（已在 check-all 6a/6b 中验证 PASS）；⑤冻结矩阵/档案重冻一致（无生产代码改 KBL/T1/T2 派生数据，6b 冻结 PASS）；⑥AS-20 risk④ 浏览器 E2E 取证 9/9 PASS（详见 P32-AS-20-补充 tests ①）。
- risk: ①本轮无生产代码改动（仅 docs/P32/P32-TASK-BOOK.md 状态行更新）；②D 端点断链修复已在 P32-AS-20-补充 落地并销账 risk④，本条目为 AS-21 最终冻结收口；③375/98/373/1570 全程未触；④未 git commit（须用户显式指令）。

### P32-AS-20-补充｜端点 D 断链修复扩展（practice-bridge + practice.html 透传 parentCheck）（2026-10-08）
- modified:
  - `shared/bridge/practice-bridge.js`：`submit()` 内 `session.submit().then` 的 `emitSubmit({...})` 反馈对象新增 `parentCheck: !!(result && result.parentCheck)` 字段（L374）；不新建机制不建 adapter，纯字段透传。**断链修复 D1**：聚合端 [shared/core/check.js](file:///Users/zhanggaozhang/Code/Homework%20Help/shared/core/check.js#L51) computeResult L51 `parentCheck=true` ↔ 桥接端 [shared/bridge/practice-bridge.js](file:///Users/zhanggaozhang/Code/Homework%20Help/shared/bridge/practice-bridge.js#L374) submit() emitSubmit L374 重建反馈对象拷贝 parentCheck。
  - `practice.html`：`applySessionSubmitFeedback(fb)` 内 `var result = {...}` 重建 result 对象新增 `parentCheck: !!fb.parentCheck` 字段（L897）；不新建机制不建 adapter，纯字段透传。**断链修复 D2**：桥接端 fb.parentCheck ↔ UI 反馈 result.parentCheck ↔ [practice.html](file:///Users/zhanggaozhang/Code/Homework%20Help/practice.html#L1041) showResult L1041 既有 parentCheck 分支由死分支真正转正。
  - `docs/P32/P32-TASK-BOOK.md`：§6 AS-20 范围追加端点 D1（practice-bridge.js submit() emitSubmit）与端点 D2（practice.html applySessionSubmitFeedback）断链修复四要素与最小修改方案；状态行更新「AS-20 risk④ 销账：D 端点断链修复扩展完成，9/9 E2E 断言全过」。
- deleted: 无（不删既有 applySessionSubmitFeedback 反馈重建逻辑，仅加字段；不删 emitSubmit 既有反馈重建逻辑，仅加字段）。
- reason: 用户裁决「扩展 AS-20 修 D 端点」（2026-10-08，承接 AS-21 验证过程暴露的 AS-20 漏修断链）。按 P30 §4 断链修复规则 + P30 §10 "唯一允许偏离：用户显式指令覆盖某条，并在 change-log 的 reason 中留存指令依据"——本任务是 AS-20 断链修复的完整化（AS-20 任务书 §6 列 A/B/C 三端点遗漏 D），D 端点是 AS-20 任务范围内"UI 消费端"的相邻环节（之前误以为 UI 直接读 computeResult，实际 UI 经 PracticeBridge.submit → applySessionSubmitFeedback 重建 result 对象后才读 parentCheck）。最小修改方案在两端 SSOT 层落地，不新建机制不建 adapter，三调用点契约不破。
- tests: ①AS-20 risk④ 浏览器 E2E 取证探针 `/tmp/p32-as-21-e2e.js`（一次性 /tmp，不落仓库，复用 `dev/e2e/browser-e2e.js` 的 CDP 基础设施模式）；场景：G2-apply 4 题长文本说理（`?subject=math&grade=2&kps=math-g2-up-u01-k003,math-g2-up-u01-k004,math-g2-up-u01-k005,math-g2-up-u01-k006&types=apply&count=4&difficulty=5`，4 题 ansLen 60-73 全 >6 汉字、全 apply 长文本说理）；作答前填入非空 dummy「答」字 12 个 input（gradeUserAnswer L375 空作答直接返回 false 不到 apply/geometry null 分支，须非空触发 null 分支）；9 断言全 PASS / FAILS=0：B1 cards=4 生成完成、B2 作答前 resultArea 隐藏、B3 提交后 resultArea 显示、B4 resultArea 文本含「✅ 请家长检查」、B5 不含「N 分」分数面板（parentCheck 分支独占）、B6 含「重新生成」按钮、B7 不含「答对 X / Y 题」统计行、B8 .score.parent CSS 类节点存在、B9 长文本说理题数=4 >0（parentCheck 触发前提）；resultArea HTML 取证：`<div class="result parent-check"><div class="score parent">✅ 请家长检查</div><div class="detail">操作题由家长核对完成情况（4 题）</div>...`；②`npm test` **742/742 PASS / 0 FAIL**；③`node dev/check-all.js`（CHROME_BIN=`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`）**31 PASS / 0 FAIL / 0 SKIP**（CI 标尺；6a 1570 真实生成、6b 冻结、6g 答案防泄露、12 Security、16/17 bundle 确定性全绿；#15 真实浏览器 E2E PASS）；④bundle 不需重建（practice-bridge.js 经 practice.html L366 `<script src>` 直接加载不在 bundle 内联清单；practice.html 是页面 HTML 不在 bundle）。
- risk: ①本任务是 AS-20 断链修复的完整化（用户裁决"扩展 AS-20 修 D 端点"），按 P30 §10 在 change-log reason 中留存指令依据；②红线 #5 未破——`results[i] = grade === true`（null → false），correct 不变（null 不计正确），score 公式不变，message 不变；③两处字段透传均为纯契约接通（`!!fb.parentCheck` / `!!(result && result.parentCheck)` 双感叹号归一化为布尔），无新逻辑、无 shim、无 adapter、无双轨；④AS-20 risk④ 销账——D 端点修复前 AS-19 浏览器探针在 G2-apply 场景观察到 pc=false 是断链暴露（KP math-g2-down-u02-k001 不产长文本说理 apply，grade 仍可判），AS-20 D 端点修复后用 AS-14 登记的 85 行 eligible 中的 4 个 apply 长文本说理 KP（math-g2-up-u01-k003~k006）触发真实 parentCheck=true 路径，UI「✅ 请家长检查」面板生效；⑤375/98/373/1570 未触；⑥未 git commit。

### P32-AS-20｜parentCheck 断链修复 + 旧链零引用终验（2026-10-08）
- modified:
  - `shared/core/check.js`：`computeResult` 新增 `parentCheck` 字段聚合（任一 `grade === null` → `result.parentCheck = true`）；`results[i]` 仍按 `grade === true` 计 false（null → false，不"非空即对"）；`correct/score/message` 公式不变；函数头注释同步标注 P32-AS-20 落地。**断链修复**：判定端 `grade=null`（AS-14 落地 85 行 eligible）↔ 聚合端 [shared/core/check.js](file:///Users/zhanggaozhang/Code/Homework%20Help/shared/core/check.js#L50) computeResult L50 `if (grade === null) parentCheck = true;` ↔ UI 消费端 [practice.html](file:///Users/zhanggaozhang/Code/Homework%20Help/practice.html#L1041) L1041-1053 既有死分支由死转正——提交后任一 null 题 → "✅ 请家长检查"面板生效，不再走普通分数面板误把开放题记错。
  - `tests/core/compute-result.test.js`：①原「P32-AS-06 输出 8 字段结构冻结」按 AS-20 决策表**重写为「P32-AS-06/20 输出 9 字段结构冻结（AS-20 加 parentCheck）」**（非删除——`Object.keys` 期望加 `parentCheck`，并新增反向断言"全可判集 → parentCheck=false"）；②原「P32-AS-06 null 三态」按 AS-20 决策表**重写为「P32-AS-06/20 null 三态：不可自动判不计正确，parentCheck 聚合为 true（家长检查通道）」**（非删除——加 3 条新断言：null→parentCheck=true、全可判集→false、空集→false）。
  - `docs/P32/P32-TASK-BOOK.md`：§7 红线 #2 由"8 字段不变"修订为"既有 8 字段不变；**AS-20 显式指令覆盖**（用户裁决 2026-10-08）：新增 `parentCheck` 第 9 字段聚合 `grade === null` 信号"；§6 AS-20 范围追加 parentCheck 断链修复四要素与最小修改方案；状态行更新「AS-20 已完成，AS-21 待执行」+ 销账「遗留：parentCheck UI 显式信号挂 AS-19」。
- deleted: 无（不删 UI 既有 parentCheck 分支，让其由死转正；不删 defaultQCheck 轨道，已在 P32-AS-08 物理删除）。
- reason: 用户指令「推进 AS-20」+ 用户裁决「修订红线 #2」（2026-10-08，承接 AS-19 取证暴露的 parentCheck UI 信号断链——AS-14 落地 grade=null 但 check.js 聚合层未同步、UI 既有 parentCheck 分支永远死分支）。按 P30 §4 断链修复规则 + P30 §10 "唯一允许偏离：用户显式指令覆盖某条，并在 change-log 的 reason 中留存指令依据"——本任务**修订红线 #2** 是用户显式指令，**修订红线 #5 不变**（仍禁止非空即对：null → results[i]=false，新增 parentCheck 只是把 null 信号暴露给 UI）。最小修改方案在 SSOT 层 shared/core/check.js 落地，不新建机制不建 adapter，三调用点契约不破。
- tests: ①定向 `node --test tests/core/compute-result.test.js` **8/8 PASS**（含 2 条重写断言 + 3 条 AS-20 新断言：null→parentCheck=true、全可判集→false、空集→false）；②Node 契约直验探针 `/tmp/p32-as-20-node.js`（一次性 /tmp，不落仓库）**11/11 PASS**——B1 apply 长文本说理（>6 汉字）→ gradeUserAnswer 返回 null、B2 apply 数值子问 → grade=true、B3 混合集（含 1 null）→ result.parentCheck=true、B4 数值题 results[0]=true、B5 null 题 results[1]=false（不"非空即对"）、B6 correct=1（null 不计正确）、B7 全可判集 → parentCheck=false、B8 空集 → parentCheck=false、B9 9 字段结构、B10 parentCheck 字段存在；③`npm test` **742/742 PASS / 0 FAIL**；④`node dev/check-all.js`（CHROME_BIN=`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`）**31 PASS / 0 FAIL / 0 SKIP**（CI 标尺；6a 1570 真实生成、6b 冻结、12 Security、16/17 bundle 确定性全绿；#15 真实浏览器 E2E PASS）；⑤bundle 不需重建（check.js 通过 common.js document.write 动态注入加载，不在 strategy-engine/presentation-engine bundle 内联清单）。
- risk: ①红线 #2 修订是用户显式指令覆盖（2026-10-08 裁决"修订红线 #2"），按 P30 §10 在 change-log reason 中留存指令依据；②红线 #5 未破——`results[i] = grade === true`（null → false），correct 不变（null 不计正确），score 公式不变，message 不变；③UI 既有 parentCheck 分支由死转正，practice.html L1041-1053 `result.parentCheck` 读取路径无新逻辑、无 shim、无 adapter，纯契约接通；④**未做浏览器 E2E 取证**——AS-20 取证采用 Node 契约直验（11/11 全过）+ 既有 AS-19 浏览器探针已覆盖 G2-apply/G1-judge/G2-T6 三场景（`pc=false` 当时是断链暴露），AS-20 修复后 AS-19 探针的 G2-apply 场景预期 pc 仍=false（KP math-g2-down-u02-k001 不产长文本说理 apply，grade 仍可判）；要触发 parentCheck=true 需 AS-14 登记的 85 行 eligible 之一（如 math-g3-up-u03-k001 geometry 单位枚举），浏览器 E2E 取证挂 AS-21 阶段（与 AS-21 最终冻结同步验收）；⑤375/98/373/1570 未触；⑥未 git commit。

### P32-AS-19｜真实运行时闭环 + D7 WYSIWYG 回归（真实 Chrome E2E 取证）（2026-10-08）
- modified: `docs/P32/P32-TASK-BOOK.md`（状态行更新「AS-19 已完成，AS-20、AS-21 待执行」+「遗留：parentCheck 的 UI 显式信号挂 AS-19」销账为「用户裁决 2026-10-08 列入 AS-20 修断链」；§6 AS-20 范围追加 parentCheck 断链修复四要素与最小修改方案；不触生产代码、T1/T2 派生数据、bundle）。
- deleted: 无。
- reason: 用户指令「好的，推进 AS-19」（2026-10-08，承接 P32 阶段四任务 AS-19，规格见 `docs/P32/P32-TASK-BOOK.md` L225-228）。验收口径：作答前零答案/零解析 → 提交后错题显答案、judge 显解析、错因显错因 → 「显示答案」开/关 → 打印文档零答案 → 错题重做轮答案重新隐藏；D7：screen/print WYSIWYG 不受判定链改动影响（列数/宽度/页边距同源回归）。本轮**无生产代码改动**——AS-18 落地后答案系统已闭环，本任务为运行时证据收集与契约回归确认。
- tests: ①取证探针 `/tmp/p32-as-19-e2e.js`（一次性 /tmp，不落仓库，复用 `dev/e2e/browser-e2e.js` 的 CDP 基础设施模式：python3 静态服务器 + 本机 Chrome headless + CDP WebSocket，Node ≥22 内置 WebSocket）；3 场景：G2-T6 混合 6 题型 12 题（`?subject=math&grade=2&kps=math-g2-down-u02-k001,math-g2-down-u01-k001&types=calc,fill,choice,judge,geometry,apply&count=12&difficulty=5`）、G1-judge 3 KP 6 题（`?subject=math&grade=1&kps=math-g1-down-u01-k001,math-g1-up-u03-k001,math-g1-up-u03-k002&types=judge&count=6&difficulty=5`）、G2-apply 4 题（`?subject=math&grade=2&kps=math-g2-down-u02-k001&types=apply&count=4&difficulty=5`）；②7 类断言 ×3 场景 = 86 断言全 PASS / FAILS=0；③A1 作答前零答案/零解析/零错因（DOM 文本 + 节点双向断言：11 子断言全过）；A2 提交后错题显答案、judge 显解析（A2.4）、假命题 wrong judge 显错因（A2.5）；A3/A4 显示答案开/关每卡 .revealed-answer 节点 append/remove；A5 打印文档零 .feedback 内容/零解析/零错因/零答案 value（DOM 克隆链 + 直渲链双路径）；A6 错题重做轮 .revealed-answer/.feedback 文本清零、按钮文案复位、resultArea 隐藏（6 子断言全过）；A7 D7 屏打 WYSIWYG：screen `--grid-cols` 与 print 列数同源相等；④G1-judge `[info]` 分布：total=6 wrong=4 right=2 totalJudge=6 judgeWrong=4 judgeWrongFalse=2，假命题 wrong 路径触发 misconception 数据链断言（`sq.data.misconception` → `rf.misconception` → `result.misconceptions[i]`）；⑤门禁 `npm test` 742/742 PASS / 0 FAIL；`node dev/check-all.js`（CHROME_BIN=`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`）**31 PASS / 0 FAIL / 0 SKIP**（CI 标尺，#15 真实浏览器 E2E PASS）。
- risk: ①本轮无生产代码改动，无回归风险；②本任务为 AS-18 落地后的运行时证据收集，与 AS-18 共同形成「答案系统闭环」的取证闭环——但 AS-19 本身不构成 AS-18 的替代验证（AS-18 的 L1-L4 已在 check-all 第 31 项 6g 固化为门禁，二者证据互补不重叠）；③探针为一次性 /tmp，未落仓库、未 commit，下次运行需重写；④AS-19 取证过程暴露 parentCheck UI 信号断链——判定端 `grade=null`（AS-14 落地 85 行 eligible）与 UI 既有分支 `practice.html L1041-1053` 存在，但聚合层 `shared/core/check.js computeResult` 未把 `null` 翻译成 `result.parentCheck`，UI 分支永远死分支——**用户裁决 2026-10-08 列入 AS-20 修断链**（四要素与最小修改方案见 task book §6 AS-20），不属 AS-19 范围；⑤未 git commit。

### P32-AS-16H｜13 条矩阵数据事实缺口明细 KP 清单固化 + 转人工挂账（2026-10-08）
- modified: `docs/P32/P32-TASK-BOOK.md`（"剩余待裁"行更新为"13 条矩阵数据事实缺口已固化明细并转人工挂账，P32 内无待裁项"）。
- deleted: 无。
- reason: 用户指令「按这个方案来」（2026-10-08），承接 P31-09 登记的 13 条矩阵数据事实缺口。处置方案：AI 不编造数据填补（P30 数据铁律），如实固化明细 KP 清单并转人工挂账。本条目固化 13 条缺口的明细取证，**不涉及生产代码、T1/T2 派生数据、bundle 改动**，仅文档登记。
- tests: ①取证探针 `/tmp/p31-gap-kps.js`（一次性 /tmp，不落仓库）按 P31-09 同口径（seed=20261009、Layout.renderLen 分桶、KCV.buildEligibility ALLOW 矩阵）枚举每条缺口的 ALLOW KP 与实际产桶；②结果与 P31-09 任务书 L333 登记的 13 条一致（含 1 条口径修正：G1 judge 在 P31-09 后续 AS 修复后已获 3 个 ALLOW KP，但实际产 mid 桶、short 桶仍缺——从"无 ALLOW KP"修正为"short 桶缺"）；③未触 375/98/373/1570；未跑门禁（纯文档登记）。
- risk: ①13 条缺口全部为 KBL 数据面事实（ALLOW 资格矩阵分布 + 真实生成链长度分布），非代码缺陷、非渲染缺陷；②部分桶（G2/G3/G6 choice long、G2 apply long）库中存在能产该桶的 KP，但 P31-09 前 8 KP 探测策略未命中——属探测策略局限，非数据缺失；③解决方向需人工评审 KBL（是否补充低年级 judge/classify ALLOW、是否调整 Generator 题干长度策略），按 P30 §2 T0 铁律走人工数据请求；④未 git commit。

**13 条缺口明细 KP 清单（取证：/tmp/p31-gap-kps.js，2026-10-08）：**

| # | 缺口 | ALLOW KP 数 | 实际产该桶的 KP | 缺桶原因 |
|---|---|---|---|---|
| 1 | G1 judge「短」桶缺 | 3（down-u01-k001、up-u03-k001、up-u03-k002） | 0（全产 mid） | judge 题面结构恒 ≥26 字符 |
| 2 | G1 classify 无 ALLOW KP | 0 | — | KCV 矩阵未授予 |
| 3 | G6 classify 无 ALLOW KP | 0 | — | KCV 矩阵未授予 |
| 4 | G2 classify「中」桶缺 | 6（up-u01-k001~k006） | 0（全产 long） | classify 题干结构恒长 |
| 5 | G3 classify「中」桶缺 | 4（down-u05-k001~k004） | 0（全产 long） | 同上 |
| 6 | G4 classify「中」桶缺 | 8（down-u08-k001~k004、up-u06-k001~k004） | 0（全产 long） | 同上 |
| 7 | G5 classify「中」桶缺 | 7（down-u07-k001~k003、up-u07-k001~k004） | 0（全产 long） | 同上 |
| 8 | G1 choice「长」桶缺 | 39 | 仅 1（down-u06-k002） | 一年级 choice 题干普遍短 |
| 9 | G2 choice「长」桶缺 | 60 | 9（up-u01-k001~k006、up-u05-k002、u05-k004、u06-k001） | long 分布稀疏，P31-09 前 8 KP 探测未命中 |
| 10 | G3 choice「长」桶缺 | 71 | 11 | 同上 |
| 11 | G6 choice「长」桶缺 | 56 | 11 | 同上 |
| 12 | G1 choice「中」桶缺 | 39 | 仅 2（up-u03-k001、up-u03-k002） | 一年级 choice 题干以 short 为主 |
| 13 | G2 apply「长」桶缺 | 60 | 9（down-u03-k001、down-u04-k004、up-u01-k001~k006、up-u05-k002） | 二年级 apply 题干以 mid 为主 |

### P32-AS-16G｜golden 旧口径 fill 条目重生成替换（用户裁决，2026-10-07）
- modified: `kbl/teaching/golden-questions.json`（math-g5-down-u02-k005 fill 条目替换：旧题面「…1 × 19 = 19。下面哪个数是质数____」value=19 属题面含答案泄露（AS-16 A 桶同形态）；新题面为现行生成器真实产出「在 17、14、6 中，____ 只有 1 和它本身两个因数，是质数。」value=17，三数识别形态、无算式泄露；semanticFamily 保持 number-sense（经 semantic-families.json kpFamilies.primary 修正，非 kp.semanticFamily 的 multiplication-division）；其余 intent/teachingTarget/difficulty/variation 等教学定位元数据保留原值；validator.semanticEvidenceState=pass、errors=0、warnings=0；counts 不变 total=1112、number-sense=117）。
- deleted: 无。
- reason: 用户裁决「重生成替换」（2026-10-07），承接 AS-16F 登记的同 KP fill 同形态泄露残留。脚本复用 dev/p25/build-golden-dataset.js 的 collectOne 口径：PracticeSession 真实生成 → KpSemantic.checkSemanticEvidence 仅收 pass → 12 字段投影 + source:'ai-candidate' + humanReview:'llm-finalized'。首次尝试误用 kp.semanticFamily 导致 semanticFamily 漂移（number-sense→multiplication-division），已修正为 kpFamilies.primary 并重跑归位。
- tests: ①替换后 JSON parse 合法、questions=1112、counts 双向一致；②门禁 8 双模式 PASS（非 strict 错误 0；strict 警告 1 为既有非阻断项）；③新题面无泄露：value=17 不在题面算式中，属识别填空；④`npm test` **742/742 / 0 FAIL**；⑤`node dev/check-all.js` **31 项 = 30 PASS / 0 FAIL / 1 SKIP**（仅改 T2 数据，生成器/题面未动，6b/6e 零漂移、bundle 未重建）。375/98/373/1570 口径未触。
- risk: ①golden fill 条目 acceptable 由旧生成器的 ["19"] 变为现行真实输出的 []（gradeUserAnswer 以 value+acceptable 候选匹配，value 唯一匹配不受影响）；②llm-finalized 标记沿用（新条目为机器真实生成 + KpSemantic pass，非人工复核）；③未 git commit。

### P32-AS-16F｜golden 旧口径漂移治理：删除 math-g5-down-u02-k005 两条 P25 期旧口径金题（2026-10-07）
- modified: `kbl/teaching/golden-questions.json`（删除 2 条漂移条目：①choice（原行 23348-23390）题面「…1 × 7 = 7。下面哪个数是质数？」题面直接含答案 value=7，属 AS-16 A 桶已修「题面含答案」形态；②apply（原行 23391-23430）「糖果数 7（1 × 7 = 7）…它是质数还是合数？」题面残留 AS-16 已删的「（1 × 7 = 7）」、答案 value=7 应为「质数」——正是 AS-16D 已修的生成器缺陷在 P25 冻结快照中的残留。同步 counts：total 1114→1112、byFamily.number-sense 119→117（与实际行数一致））。
- deleted: 上述 2 条 golden 条目（物理删除，文本级精确切除，JSON 合法性复核通过）。
- reason: 用户指令「先处理 golden-questions 旧口径漂移」（2026-10-07），处置方向经用户裁决「删除 2 条漂移条目」（不重新生成替换、不全量重建题集）。背景：golden 为 P25-16 真实生成 + llm-finalized 冻结快照（独立校验数据集），门禁 8（validate-golden-dataset.js）只做结构自洽校验、不比对现行生成，故漂移不阻塞门禁、属质量债务；AS-16D 已修生成器侧（apply 答「质数」），本任务清除快照残留。删除为最小删改：不动 llm-finalized 冻结语义、不引入 AI 新生成数据、题集 15 族覆盖不破（number-sense 117 ≥10，strict 模式仍 PASS）。**另登记一条同形态残留（不扩面）**：同 KP fill 条目（value=19，题面「…1 × 19 = 19。下面哪个数是质数____」）亦为题面含答案形态，不在用户裁决的 2 条范围内，按红线 9 只登记不动手，待裁。
- tests: ①删除后 JSON parse 合法、questions=1112 与 counts.total 一致、number-sense 实际 117 与 byFamily 一致、该 KP 剩 fill value=19 一条；②门禁 8 单跑 PASS（非 strict + strict 双模式，证据状态全 pass、无重复、错误 0）；③golden 无 shared/knowledge 分发副本（tools/kbl/build.js DATA_RELS 不含 golden），无需同步；④`npm test` **742/742 / 0 FAIL**；⑤`node dev/check-all.js` **31 项 = 30 PASS / 0 FAIL / 1 SKIP**（本任务仅改 T2 数据文件，生成器/题面未动，6b/6e 矩阵零漂移未重冻、bundle 未重建）。375/98/373/1570 口径未触。
- risk: ①题集规模 1114→1112（number-sense 117），若未来有「每 KP 三题型齐全」类门禁需重新评估覆盖（当前无此约束）；②同 KP fill（value=19）同形态泄露残留待裁；③未 git commit。

### P32-AS-16E｜阶段三 GEN 延伸：推理说谎题 fill 引号错乱 + choice 引语未闭合修复（AS-16C 登记项②销账）（2026-10-07）
- modified: `shared/generator/generators/reasoning.js`（通用 logic 谜题题型变换：fill/choice 两分支各增「直接引语内含句读」守卫——条件 `/「[^」]*[。，、；！？]/` 精确命中说谎模板（LGV=0，全库题面仅此模板引语内含句读；盒子题「苹果」「橘子」引号内无句读、年龄题无引号，均不命中继续走原路径）。fill 守卫：禁止对该题面机械「splitClauses 拆标点→reverse 倒序」（病因：引语句号与「甲、乙、丙」顿号被当子句边界，倒序后引号截断、人名被顿号拆碎，产出 `」谁说了真话，」丙说：「…，乙，甲，____` 病句），改正序命题换词填空式「有甲、乙、丙三人，其中只有一人说真话。甲称乙撒了谎，乙称丙撒了谎，丙则称甲、乙两人都撒了谎。说真话的是 ____。」；choice 守卫：原 `replace(/[^。！？]*[？?]\s*$/,'')` 删尾问句「」谁说了真话？」时连丙引语的右引号一起吃掉，产出未闭合引语，改引语闭合的换词选择式。两式仅换叙述措辞，三条逻辑命题等价、答案「乙」与 steps=3 不变）；派生重生成 `kbl/teaching/variation-profiles.json` + `misconception-profiles.json`（经 `tools/kbl/build.js` 同步 `shared/knowledge/teaching/misconception-profiles.json` 与 manifest 指纹）；重冻 `docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.{json,md}`（6b --write，恰好 8 处差异）+ `dev/p30/P30-KP-QT-MAKER-MATRIX.{json,md}`（6e --write，计数 target=1228/format=8/target-frozen=334 不变，仅题面样本机器字段漂移）；重建两 bundle。
- deleted: 无。
- reason: 用户指令「先修复 fill 引号错乱问题」（AS-16C 登记待裁项②，2026-10-07）。五步闭环：①freeze 口径探针复现 4 KP（g4-down-u09-k001/k002、g5-down-u10-k001/k004）× fill/choice/apply 真实题面——fill 4 行全为引号错乱病句、apply 正常；同探针发现 **choice 4 行同根因缺陷**（丙的引语缺右引号），经用户裁决（2026-10-07 AskUserQuestion「fill + choice 同批修」）一并修复。②唯一责任链路锁定 reasoning.js 题型变换块（P30-GEN-06 为打散跨题型 3-gram 设计的机械变换对含句读直接引语的题面不安全）。③守卫条件对准病因（引语内含句读），非硬编码 KP/模板号，未来同形态题面自动受保护；seq/年龄/盒子等其余模板路径零改动。
- tests: ①目标 12 行探针：fill/choice 引号全部闭合、语句通顺，答案均为「乙」；②同 maker 邻模板回归（count=3，i=0/1/2）：年龄题、盒子题 fill/choice 仍走原倒序/换词路径且引号完整；③跨题型核心骨架 3-gram sim（6e 门禁同款 coreStem/coreSim 实算）：apply-choice=0.282 / apply-fill=0.263 / choice-fill=0.421，均 < 0.85 阈值；④gradeUserAnswer 自判：三题型答「乙」均 true；⑤6b 漂移恰好 8 行（4 KP × fill/choice）零连带，6c 生成器矩阵 PASS 无需写盘，AS-18 泄露门禁 PASS（L1 136/136——8 行新题面 token=「乙」四元组仍被 P-KNOWN 白名单覆盖、未登记 0；L2 27/27、回放 TRUE 1485/FALSE 0/NULL 85 不变）；⑥`npm test` **742/742 / 0 FAIL**；⑦`node dev/check-all.js` **31 项 = 30 PASS / 0 FAIL / 1 SKIP**（M0 rootHash、6a 1570、12 Security、16/17 bundle 确定性全绿）。题面变化触发：两派生器重跑、build.js 同步、6b/6e 重冻、两 bundle 重建；375/98/373/1570 口径未触。
- risk: ①8 行 fill/choice 题面文本更新（旧病句文本在历史练习记录快照中不再重现，方向为修正病句；答案/题型/难度不变）；②format 债务存量 8 行/4 KP（generator:stats，与本任务无关）计数不变；③剩余待裁：golden-questions.json:23406 旧口径漂移、13 条矩阵数据事实缺口（人工）；④未 git commit。

### P32-AS-18｜阶段四 CLOSE：答案泄露门禁正式化——L1-L4 + 自判回放上线 check-all 第 31 项（2026-10-07）
- modified: `dev/p32/check-answer-leak.js`（新建门禁：freeze 口径 1570 对全枚举；**L1** 题面 token 边界扫描（`(^|[^\d.])token($|[^\d.])`，judge boolean 不扫）+ **163 条显式白名单注册表**（kp+qt+token+layer 四元组，桶标签 B-OPERAND 49 / P-KNOWN 30 / C-OPTIONSET 14 / C-VIEW 11 / C-FRACTION-PART 10 / C-SYMMETRY 6 / C-LCM 5 / C-CONCEPT 4 / C-AREA 4 / C-UNIT 1 / C-POSITION 1 / C-ABACUS 1 + L2 侧 GRAPHIC-DATA 9 / GRAPHIC-COINCIDENCE 15 / GRAPHIC-MATERIAL 1 / C-UNIT 延伸 1 / B-OPERAND 1，逐条附 reason）；**L2** 渲染 SVG 后扫 `<text>`（逐字镜像 renderer.js L52-56 graphic 归一化：`sq.graphic` string-type 优先、兜底 `sq.data.graphic`，553 渲染全 SUCCESS）；**L3** 结构断言（html-renderer 零读 explanation + 内部溯源 key `['说明思路','比较解法','解释为什么','cognitiveHint']` 零入题面/选项/hint/explanation，禁用文本重合启发式）；**L4** hint 非空 0；自判回放（gradeUserAnswer 真值 FALSE=0、null 仅限 apply/geometry）；任一 FAIL exit 1）；`dev/check-all.js`（6f 后插 `6g. Answer-leak (答案防泄露门禁 AS-18)`，30→31 项）；`shared/generator/generators/stats.js`（makeClassifyGeoShape 增 geo(unitPx, mask) 所求段标注遮蔽：fill/choice v0 遮 partLabel、v2 遮 totalLabel；apply v0 遮 totalLabel、v2 遮 partLabel；judge 不遮——标注是判断主张材料）；`shared/generator/generators/arithmetic.js`（makeFractionMultiplyGeometryQuestion：k002 分数乘法分支 partLabel '?'、k003 分配律分支 partLabel '?'——两者所求均为 part；k004 分支 partLabel=18 为中间量、答案 12 未标注，不动）；`shared/generator/generators/money.js`（g2-up-u05-k001 else 分支 totalLabel '?'——原 '100' 为答案唯一来源）；重建 `shared/engine/strategy-engine.bundle.js` + `presentation-engine.bundle.js`。
- deleted: 无。
- reason: 任务书 §6 AS-18「答案泄露门禁正式化」，五层口径按 §9.2 定稿（L5 parentCheck UI 信号挂 AS-19）。首跑暴露 **AS-02 L2 审计盲区（既有缺陷，非本任务引入）**：旧审计只扫 `q.graphic`（1570 行全 null），生产链实际经 renderer.js 归一化兜底 `q.data.graphic`（553 行全漏扫）——门禁修复归一化后 L2 首扫 36 条，逐行 prompt/SVG 取证 = **10 条真泄露**（segment 图 partLabel/totalLabel 直接标注答案值）+ **26 条合法**（图表读数目标 9、数值巧合 15、规律序列材料 1、换算算式可视化操作数 1）；**经用户裁决（2026-10-07「修复 9 行 + 白名单 1 行（Recommended）」）**：9 行按 semantic-relations.js L157 既有 totalLabel '?' 先例做所求量标注遮蔽（问哪段哪段标 '?'，图形不再把所求量化为已知），g3-up-u03-k002（题面已述「平均分成 10 份」，图形未新增信息）登记 C-UNIT #6 延伸白名单。L1 首扫 136 条全部对照 AS-16C #1~#11 裁决家族与 B/P 既定口径逐条登记固化；注册表后复跑：L1 白名单 136/136、L2 27/27、未登记 0。修复作 AS-18 延伸登记（题面/答案文案零变化，仅 graphic params 标注）。
- tests: ①门禁单跑 exit 0：L1 命中 136（白名单 136/未登记 0）、L2 渲染 553（SUCCESS 553/UNSUPPORTED 0/FAILED 0）text 命中 27（登记 27/未登记 0）、L3 双断言 PASS、L4 非空 hint 0、自判回放 TRUE 1485 / FALSE 0 / NULL 85（null 全部 apply/geometry，与 AS-14 口径一致）；②`npm test` **742/742 / 0 FAIL**；③`node dev/check-all.js` **31 项 = 30 PASS / 0 FAIL / 1 SKIP**（第 15 项本机无 Chrome SKIP 属常态；6b/6e 矩阵零漂移——本任务只改 graphic params 标注，题面/答案文案未动，未触发派生器重跑与矩阵重冻）。改 shared/generator 生产代码 → 两 bundle 已重建，16/17 确定性 PASS。375/98/373/1570 口径未触。
- risk: ①9 行线段图不再标注所求段（显示 '?' 占位），属图形教学语义正确化，题型/答案/难度不变；②白名单为显式正登记（四元组精确匹配），freeze 口径、题面或图形标注任何变化都会以 FAIL 暴露须重新裁决，不会静默放行；③既有登记待裁项不变：g4-down-u09/g5-down-u10 fill 变体引号错乱、golden-questions 旧口径漂移、13 条矩阵数据缺口（人工）；④未 git commit。

### P32-AS-16D｜阶段三 GEN 延伸：g5-down-u02-k005 质数/合数 apply 答案规格缺陷修复（2026-10-07）
- modified: `shared/generator/generators/concept-meaning.js`（质数与合数分支补 `applyAnswer: '质数'` + 口径注释——apply 问「质数还是合数」标准答案必须是分类结论而非糖果数数字，calc/choice/fill 仍以数字为答案，与 P32-AS-11 奇偶分支先例同口径）；派生重生成 `kbl/teaching/variation-profiles.json` + `kbl/teaching/misconception-profiles.json`；重冻三矩阵产物（P28-GENERATION-MATRIX-FROZEN / P28-GENERATOR-MATRIX / dev/p30 KP×QT maker 矩阵）；重建 strategy-engine.bundle.js + presentation-engine.bundle.js。
- deleted: 无。
- reason: AS-16C 登记项①经用户指令单独修复（2026-10-07「先单独修复 g5-down-u02-k005 的质数判断缺陷」）。缺陷：apply 题面问「它是质数还是合数？」但标准答案 value=17（糖果数本身，acceptable 空），正确答「质数」会被 gradeUserAnswer 判 false、旧缺陷答案 17 反而判 true——与 AS-16C 当日已修的 k004（value=21→奇数）同家族，根因同为概念分类 apply 未设 applyAnswer 覆盖、回退到 choice/calc 的数字 answer。最小修复镜像 AS-11 机制（[concept-meaning.js:915](shared/generation/api.js) 消费点不变）。登记项②（g4-down-u09 / g5-down-u10 fill 变体引号错乱）不属本任务仍挂待裁。**另登记既有漂移一处（不扩面）**：kbl/teaching/golden-questions.json:23406 存有 P25 期冻结的旧口径金题（题面含 AS-16 已删的「（1 × 7 = 7）」、答案 value=7 同缺陷形态）——golden 为独立校验的数据集（门禁 8 自洽校验，不比对现行生成），其重派生不在当前派生链白名单，留待 golden 数据治理专项。
- tests: ①目标行验证（seed=20261007，math-g5-down-u02-k005 apply）：`answer.value="质数"`，gradeUserAnswer 三态——答「质数」true（修复前 false）、答「17」false（旧缺陷答案不再通过）、答「合数」false；②`npm test` **742/742 / 0 FAIL**；③`node dev/check-all.js` **29 PASS / 0 FAIL / 1 SKIP**（6a 1570 真实生成、8 golden、16/17 确定性全绿）。答案文案变化触发：派生器重跑、三矩阵重冻、两 bundle 重建；375/98/373/1570 口径未触。
- risk: ①apply 行标准答案由「17」变「质数」——此前以 17 作答被判 true 的历史练习记录按新口径回放会变 false（运行时零写入 KBL，仅判分口径变化，方向为修正错误判分）；②golden-questions 既有旧口径金题与现行生成漂移（先于本任务存在，门禁 8 不受阻），待专项治理；③登记项② fill 引号错乱未修；④未 git commit。

### P32-AS-16C｜阶段三 GEN 延伸：C 桶裁决落地——#12 比例判断结论句 + #13 弱题干修题面，#1~11 白名单固化（2026-10-07）
- modified: `shared/generator/generators/semantic-relations.js`（makeRatioCalc 意义分支：题面删「，积相等」结论表述，改「。根据检验结果，填「能」或「不能」。」；检验算式、答案「能」、解析不动）；`shared/generator/generators/shape.js`（makeGeometryQuestion 通用识别 GEOMETRY_PROMPTS 第 0 档弱题干「请观察图形，+KP 名」→「图中显示的是什么图形？」，与辨角分支句式一致；数组长度与 rng 取模不变，仅第 0 档选中行受影响）；派生重生成 `kbl/teaching/variation-profiles.json` + `kbl/teaching/misconception-profiles.json`；重冻三矩阵产物 `docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.{json,md}`、`P28-GENERATOR-MATRIX.{json,md}`、`dev/p30/check-kp-qt-maker-matrix.js` 冻结产物；重建 `shared/engine/strategy-engine.bundle.js` + `presentation-engine.bundle.js`。
- deleted: 无。
- reason: C 桶裁决（用户指令 2026-10-07「请修复 #12 和 #13 的题面，并更新 AS 链」；裁决清单见当日会话记录：L1 命中 80 行 = B 17 / P 22 / 数据巧合 2 / C 待裁决 38 / 新缺陷登记 1，C 桶 13 家族）：**#1~11 裁决为白名单**（分数份数→分母、面积铺格、对称点距离、视图→小正方体、最小倍数=本身、1 米=10 分米、算盘珠值、奇数/质数主语等值、数对→列、奇偶选项集、比较符号选项集——答案词在题面必需已知量/选项集中，考点是概念归类非抄写），固化进 AS-18 门禁白名单；**#12** 比例判断「检验：12 × 12 = 144，16 × 9 = 144，积相等，填能/不能」结论已在题面算完（与 AS-16 A5「陈述直接给结论」同形态）→ 删「积相等」保留检验算式，学生须自行比较两积；**#13** geometry 通用模板第 0 档为弱题干（主题句无问句且含答案词）→ 换「图中显示的是什么图形？」。修复验证：seed=20261007 复跑 4 条目标行（g6-down-u04-k001/k003 calc、g6-up-u04-k001 geometry）新题面生效、答案不变。**另登记两项新发现（不在本任务扩面，待裁）**：①g5-down-u02-k005 apply「糖果数 17…它是质数还是合数？」answer.value=17 应为「质数」（acceptable 空，正确答「质数」会判 false，与已修 k004 value=21 同家族）；②g4-down-u09-k001/k002、g5-down-u10-k001/k004 的 fill 变体题面引号错乱病句（apply 变体正常，fill 模板拼接缺陷候选）。
- tests: ①目标行复跑验证（seed=20261007，3 KP×QT 新题面 + 答案不变）；②`npm test` **742/742 / 0 FAIL**；③`node dev/check-all.js` **29 PASS / 0 FAIL / 1 SKIP**——首跑 6e FAIL 系第三冻结产物（KP×QT Maker 分工矩阵）机器字段漂移（分工计数 target=1228/format=8/target-frozen=334 前后一致，仅题面样本变化），按门禁自身指引 `--write` 重冻后全绿；16/17 bundle 确定性 PASS；6a 1570 真实生成 PASS。题面变化触发：派生器重跑、三矩阵重冻、两 bundle 重建；375/98/373/1570 口径未触。
- risk: ①geometry 第 0 档模板改动波及所有走该模板的 geometry KP 的第 0 档选中行（矩阵已重冻；问法更规范，题型/答案/难度不变）；②「根据检验结果」句式下两个乘积仍显示（检验方法支架，与裁决口径一致），学生须自行比较 144=144 得出结论；③两项新登记缺陷（质数 apply 答案、fill 引号错乱）未修，建议 AS-18 前随 maker 批次处理；④未 git commit。

### P32-AS-17｜阶段四 CLOSE：gradeUserAnswer 单元测试补盲 + 阶段三过门确认登记（2026-10-07）
- modified: `tests/validator/grade-user-answer.test.js`（新增 7 用例：①AS-14 apply/geometry 候选全为长文本说理 → null 的家长检查边界（含「边界只看答案侧不看作答侧」「禁止非空即对/非空即错」负断言与数值/短答候选恢复自动判正断言）；②acceptable 重复值无害（运行时）+ 质检方向 value 错误 → ANSWER_MISMATCH（附口径注释：acceptable 内容合规由生成侧 finish 契约过滤承担，AS-11，运行时不猜测语义等价）；③precision=0 位容差与非法值回落默认 2；④余数记号补全（单省略号/多句点/「余」带空格）+ 题干无除式退回文本等价 + 期望非余数而作答带余数 → false；⑤judge 大小写变体；⑥classify 半角冒号/逗号分隔与组内重复项；⑦防御：value=0 合法非空、ctx 缺 questionType/ctx=null 回退短答路径）；头注释补 AS-17 口径行。
- deleted: 无。
- reason: 任务书 §6 AS-17「单元测试补盲」。进入前提：阶段三门禁证据复跑核实一致（定向全绿、`npm test` 735/735/0 FAIL、`node dev/check-all.js` 29 PASS/0 FAIL/1 SKIP，6a 1570 真实生成/6b 冻结/12 Security/16 17 确定性全绿；一次孤立 ERR_ASSERTION 输出复跑 3 次未复现且计数恒 0 FAIL，判定偶发输出非稳定失败）→ 用户指令「核对阶段三的进度细节，继续推进项目」（2026-10-07）即为阶段三过门确认，依据留存本条。盲区对照任务书七项清单逐项补齐；补写过程中纠正两处初版断言与真实行为的偏差：①validateNumericAnswer 为 candidates.some 匹配，acceptable 错误值不在质检拦截范围（改按真实契约断言并注释责任面）；②precision 边界断言改用无浮点二义性差值（8−7.99≈0.0099<0.01 与 0.26−0.25≈0.0100>0.01 的二进制舍入差异，沿用 AS-05 既有 0.25/0.26 先例口径）。生产代码零改动。
- tests: ①定向 `node --test tests/validator/grade-user-answer.test.js` **19/19 PASS**（12→19，+7）；②`npm test` **742/742 / 0 FAIL**（735→742，净 +7）；③`node dev/check-all.js` **29 PASS / 0 FAIL / 1 SKIP**（无 Chrome 环境；6a 1570 真实生成、6b 冻结、12 Security、16/17 bundle 确定性全绿）。纯测试改动：不触发 bundle 重建、不触发派生器/矩阵重冻，375/98/373/1570 未触。
- risk: ①无生产代码改动，运行时行为零变化；②运行首跑一次孤立 ERR_ASSERTION 输出（连续 3 次全量 735/735 未复现、计数恒 0 FAIL）已按观察登记，如复现须单独定位立项，不在本任务扩面；③未 git commit。

### P32-AS-14｜阶段三 GEN：apply/geometry 说理题自动批改边界（parentCheck）+ 闰年 fill/apply 答案分离 + 分类 apply 结论句泄露（2026-10-07）
- modified:
  - `shared/validator/answer-validator.js`：`gradeUserAnswer` 在 none/read-aloud 分支后新增 apply/geometry 边界——候选答案任一为纯数值（容差可判）或汉字数 ≤6 的短答（如「闰年」「2020年」）则照常自动判分；全部候选均为长文本说理/作图/实操时返回 **null（家长检查 parentCheck）**，禁止「非空即对」也禁止把开放题机械判错；calc/fill/choice/judge/classify 分派零改动。
  - `shared/generator/generators/stats.js`：①`makeStatsQuestion` 闰年分支（g3-down-u06-k002）fill/apply 分离——fill 答案只留可判短答（「闰年」「平年」「366」「2020年」，第 3 题原题两问收敛为「闰年全年有多少天」单问），完整理由写 `answer.explanation`（提交后解析通道，不上屏），acceptable 仅「366天/2020」等价标量；apply 保留完整参考答案（长文本经边界 → null）；answerObj 挂载新增 lyAcceptable/lyExplain（初版漏 var 声明致 26 行生成 ReferenceError，已补声明修复）。②`makeClassifyShape` apply v0 题面删除自问自答的「再回答问题——theme.conclusion」结论句，改「先写出分类结果，再说一说按这个标准分类说明了什么」；参考答案（分类结果+结论）不变，走 parentCheck。
  - 派生与冻结物（题面/答案变化触发）：重跑 `dev/p27/derive-variation-profiles.js`（生成失败行 0）、`dev/p27/derive-misconceptions.js`；`check-generation-matrix-freeze.js --write` 重冻（1570/1570，FAIL 0）；`dev/p30/check-kp-qt-maker-matrix.js --write` 重冻（target=1236/target-frozen=334 总数不变，8 行 stats format 机器字段漂移随重冻收口）；重建 strategy/presentation 两个 bundle。
- deleted: 无文件/符号删除；删除闰年 fill 答案中的完整理由串（迁移至 explanation）、分类 apply 题面中的结论句。
- reason: 任务书 AS-14 原文「数值/短答可判子问走 gradeUserAnswer；作图/说理走 parentCheck；现状『非空即对』类一律改显式边界」。全量扫描 375 apply 行中 82 行模型答案为长文本说理（如「闰年；2024 ÷ 4 = 506…」「3+4>5，两短边之和大于最长边，能围成」「按实际读数，如 15 厘米」），逐字匹配学生不可能答对，旧链必判 false；g3-down-u06-k002 fill 把「闰年；完整理由」混串作答案同病。边界落在判分权威单点（answer-validator），不新增 answerMode/不加 maker 标记、不新建第二轨；题面结论句属 A 桶泄露同口径修复。
- tests: 全量 1570 探针（默认 seed）：标准答案作答 **FALSE=0 / 生成失败=0 / 结构泄露 LEAK=0**；gradeUserAnswer 返回 **NULL=85（apply 84 + geometry 1）**，逐条核对 85 行全部为原 82 行长文本清单 + 分类 apply v0 新改 13 行（题面删结论、答案仍长文本）等说理/枚举开放答案（含 g3-up-u03-k001 geometry「毫米、厘米、分米、米、千米」单位枚举）；闰年 fill 四变式标准答案（闰年/平年/366/2020年）自判 true 且 explanation 仅在提交后通道；`npm test` **735/735**（净 +1：AS-16 延伸重写的 choice 契约断言）；`node dev/check-all.js` **29 PASS / 0 FAIL / 1 SKIP**（6a 1570 真实生成、6b 冻结、12 Security、16/17 bundle 确定性全绿；15 无 Chrome SKIP）。
- risk: ①null 85 行在 computeResult 三调用点（practice-session×2、practice.html×1）当前仍按 false 计入 results——parentCheck 的 UI 显式信号（「待家长检查」而非红叉）按任务书挂 AS-19 Chrome E2E 批次接通，本任务不扩 UI、不改 computeResult 8 字段契约；②「汉字 ≤6」为短答判据的启发式阈值，已用 1570 全量回代（85 行 null 逐条人工核对为开放题、可判行 0 false），AS-18 门禁正式化时固化为断言；③题面变化行已重冻两矩阵+两派生器，375/98/373/1570 未触；④未 git commit。

### P32-AS-16 延伸｜choice 索引约定漏洞：契约层单一值约定 + enforce 预归一收口（2026-10-07）
- modified:
  - `shared/generator/core/type-contract.js`：头注释改述 choice 单约定；`checkAnswerInOptions` 删除「answer.value=String(correctIndex) 即合法」的索引约定分支，check 层只认 `value ∈ options.map(String)`；新增模块函数 `normalizeChoiceIndex(sq)`（判据 value===String(correctIndex) 且 value!==String(options[correctIndex])，原地把 value 改写为选项文本、options 字符串化）；`enforce()` 在裸值归一后、**check 之前**对 qt='choice' 无条件调 normalizeChoiceIndex，归一发生时 pass 分支 trace 记 action='finish'/fixed=['answerInOptions']；`finishChoice` ① 改调 normalizeChoiceIndex 作 finisher 通道同口径兜底（删除旧 indexOf(v)===-1 前置条件）。
  - `tests/generation/p25-07-type-contracts.test.js`：旧用例「choice 索引约定 check 合规」按新决策表**重写为两条**（非删除）——check 层对纯索引串（value='1'∉options）判不合规；enforce 对撞串复现题（options=['6','3','5','4']、correctIndex=3、value='3'）预归一为 '4' 且 action=finish/fixed 含 answerInOptions。
  - `tests/generation/p28-hollow-shape-themed.test.js`：maker 产出契约断言对齐生产链——choice 题先经 `TC.enforce` 预归一（断言保留不 drop、归一后答案非空）再 check，非 choice 路径不变。
  - 重建 strategy/presentation 两个 bundle；两矩阵重冻（与 AS-14 同一次）：choice 96 行 ans 由 "0"~"3" 索引串归一为选项文本（96/96 旧值均为 0-3 索引串），差异共 110 处（choice ans 97 含闰年 fill 1、apply promptLen 13）。
- deleted: check 层索引约定合法分支（双约定 → 单一文本约定）；无文件删除。
- reason: shape/position/money 系 maker 历史写 `answer.value=String(correctIndex)`，而渲染（html-renderer radio value=选项文本）、判分（gradeUserAnswer choice 精确匹配文本）、上屏全是文本约定；旧 check 同时承认两种约定 → 索引串作为「假答案」一路放行，render-format 还会把索引串插进 options。归一必须在 check **之前**：实证 g5-down-u01-k001 撞串（索引串 "3" 恰好是干扰项文本），check 后归一会误判合法。统一在 enforce 单点收口，shape.js/position.js/money.js 各 maker 不逐个改写（单 SSOT 转换点）。
- tests: 6a `check-allow-generation.js` **1570/1570 PASS 0 FAIL 零 drop**；全量探针 CHOICEBAD（answer 不在 options 文本中）**368 旧问题行 → 0**（探针口径修正后；冻结证据确证 96 choice 行 ans 归一）；抽查 shape/position/money 代表行答案均为正确选项文本（三角形周长 12、长方形面积 18、g5-down-u01-k001 撞串行归一为「4」）；`npm test` **735/735**；check-all **29 PASS / 0 FAIL / 1 SKIP**。
- risk: ①96 行 choice 的冻结 ans 变化属判错修正（旧索引串在运行时本来也无法被点选命中，等于死答案），题面文本零变化、仅答案 value 归一；②归一原地改写 sq，生产链 maker→enforce 本就同一对象，无第二路径；③真实 Chrome radio 点选闭环留 AS-19；④未 git commit。

### P32-AS-16｜阶段三 GEN：58 条 A 桶题面真泄露修复（题面去答案，不删算式支架）（2026-10-07）
- modified:
  - `shared/generator/generators/concept-meaning.js`：①fill 兜底分支改 `extractSupport(stem)` 后用正则剥尾等号再拼「= ____」，一处修复 11 条冻结双等号病句行与 38 条病句族；②数数/11-20/1-5/百数表/算盘/计数器/凑十法/负数数轴 8 个 maker 分支删「（参考：…=得数）」「（…=结果）」参考句，得数统一改为「操作数算式 = ？」支架（EXPR_RE 仍字面命中，expressionPresent 教育门禁不破）；③最小倍数删「fn2 × 1 = fn2」首句（×2/×3 仍唯一锚定答案）；④和的奇偶性 stem 改「不计算，判断：pa + pb = ？的得数是奇数还是偶数？」，fill 改「pa + pb 的和是 ____」，apply 删规则句与内嵌结果（patterns.rule 保留供变式）；⑤质数 stem 保留「5 × 6 = 30…是合数」反例支架承载算式，fill 改三选一填空，apply 删「1 × pn = pn」；⑥奇偶 apply 两分支删整除/余数证明句（calc 属 C 桶未动，applyAnswer 保留）；⑦倍数特征删 fref 字面给结论变量，规则句+「仿照 7 ÷ f」支架承载 expressionPresent，apply 同步。
  - `shared/generator/generators/fraction.js`：addsub 减法分支加重抽 guard 排除 hi−lo=lo 巧合（fill RHS=答案，如 2/3−____=1/3），d 一并重抽防 d=3 死循环；fracDiv 分支 guard 排除 n2=d2（v=1 与商相同巧合）。
  - `shared/generator/generators/semantic-relations.js`：makeRatioApply prompt 删「1×x=4×6=24」已算解，改「（a∶b = c∶x）…列比例求 x」；explanation 改符号化推导（提交后通道，不含本数具体得数）。
  - `shared/generator/generators/stats.js`：线段图 maker fill 与 apply（v=0/v=2）删文字直接给 total/part（自问自答），数据改由事物清单 list + 线段图承载；v=1 相差问 part/total 是必需已知量，未动；graphic.partLabel 未动（L2 审计 0 泄露）。
  - `shared/generator/generators/shape.js`：刻度尺 fill/geometry 第 1 项改非 0 起点读数（刻度 2→10，v=8）；画线段 fill/geometry 前两项改从刻度 1/2 画起求终点（v=6/10），shapeTheme 题干/答案字符串/数值三项同步；apply 实操问法未动。
  - `shared/generator/generators/position.js`：makeCoordinateQuestion fill 删「在第 x 列第 y 行」坐标自陈，改「点 A 的位置用数对（x，y）表示…点 A 在第 ____ 列」，答案仍 String(x)。
  - 派生与冻结物（题面文案变化触发）：重跑 `dev/p27/derive-variation-profiles.js`（1323 剖面行）、`dev/p27/derive-misconceptions.js`（313 KP/923 slot）；`check-generation-matrix-freeze.js --write` 重冻 P28-GENERATION-MATRIX-FROZEN.{json,md}（1570/1570，FAIL 0）；`dev/p30/check-kp-qt-maker-matrix.js --write` 重冻 P30-KP-QT-MAKER-MATRIX.json（题面分支变化致机器字段漂移，target=1236/frozen=334 总数不变）；重建两个 bundle。
- deleted: 题面中 58 条/32 KP 的五类答案直给文本（参考句得数、括号算式 RHS、双等号病句、已算解比例、自问自答/规则结论/坐标自陈）；无文件/符号删除。
- reason: 任务书 §9.2 A 桶裁决——这些形态是「题面直接出现标准答案」的真泄露，违反「生成的练习题不自带答案」；B 桶 22 条操作数重合（如 6×8=48→48÷6=?）与 P 桶 12 条教学必需句属合法支架不动，C 桶 22 条概念支架挂账 AS-18 前裁决（本次未动）。calc 的 expressionPresent 门禁要求题面字面含算式，故修复口径定为「得数删除、保留操作数算式 = ？」而非删全部算式。
- tests: 全量 1570 真实生成（seed=20261007）结构复扫：PAREN-RHS（含参考句/已算式）命中 **44→0**、DBL-EQ 双等号 **11→0**；定向验证 stats 线段图 fill×3+apply×3、shape k002/k004 fill+geometry×4、position×1、fraction 6 行新冻结题面（8/9−____=1/9 v=7/9 等）、ratio apply×3 均答案不在题面且算式支架完整；**1570 行标准答案作答 gradeUserAnswer 全 true（false 0 / null 0 / 生成失败 0，classify 25 全 true）**；修复中暴露过一次 10 calc 回归（误删唯一 EXPR_RE 算式）与 fraction d=3 死循环，均已修复并复扫归零；`npm test` **734/734**；`node dev/check-all.js` **29 PASS / 0 FAIL / 1 SKIP**（首次 6e maker 机器字段漂移，按门禁提示 --write 重冻后复核一致；15 无 Chrome 本地 SKIP；6a 1570 真实生成、6b 冻结、16/17 bundle 确定性全绿）。
- risk: ①C 桶 22 条概念/性质支架题仍未裁决，AS-18 泄露门禁上线前必须逐条闭环；②部分 fill 题由「补结果」变「解支架算式」（如 2→10 量长度），教学等价性以任务书 §9.2 逐条裁决为准，未引入新情境/新知识点；③fraction guard 改变了受影响行 rng 抽取序列，矩阵已重冻、1570 自判全绿，但变式三指纹互异由阶段四 6f/门禁 21 持续背书；④真实 Chrome 打印/作答 E2E 待 AS-19；⑤未 git commit。

### P32-AS-11/12/13/15｜阶段三 GEN：acceptable 契约过滤 + judge answerMode 漏标清零 + 变式 hint 污染删除（2026-10-07）
- modified:
  - `shared/generator/generators/semantic-relations.js`：finish() 增加契约 A 过滤（acceptable 仅保留与 value 真等价标量）；makePeriodFill 第二参（acceptable 冗余数组）改 `[]`；makeByItem apply 分支新增 `item.applyAnswer` 优先，buildNumberTheoryItem 奇偶两分支补 `applyAnswer:'偶数'/'奇数'`。
  - `shared/generator/generators/concept-meaning.js`：finish() 同款 acceptable 契约过滤；makeAngleJudge/makeAreaJudge 补 `q.answerMode='judge'`；makeByItem apply 支持 applyAnswer。
  - `shared/generator/core/type-contract.js`：finishJudge 三分支补 `sq.answerMode='judge'`（11 行漏标清零）。
  - `shared/generator/core/variation-apply.js`：applyCognitive 物理删除 `q.hint = ...` 污染写入一行（变式层不得向题目写提示）。
- deleted: `variation-apply.js` 中 q.hint 赋值（L4 hint 污染点消除，q.hint 保持 null）；无文件删除。
- reason: AS-11 acceptable 语义收口（1570 扫描确认非空 acceptable 恰好 5 行真等价，其余冗余/缺陷形态由 finish 过滤，判分只认真等价白名单）；AS-12 judge answerMode 漏标 11→0 使元数据与真实判分一致（判分分派只认 questionType，行为不变）；AS-13 classify 25 行经 gradeUserAnswer data.groups 集合判定全 true；AS-15 落实用户裁决「hint 保 null、不建解题思路 UI」，变式器是唯一 hint 写入点，物理删除。
- tests: 1570 全量真实生成 acceptable 扫描（真等价 5）+ judge answerMode 0 漏标 + classify 25 自判 true（随 AS-16 复跑保持：gradeUserAnswer 1570/1570 true）；`npm test` 734/734；check-all 29 PASS/0 FAIL/1 SKIP（AS-16 条记录同一次全门禁证据）。
- risk: ①answerMode 为元数据补标，7 题型集合与判分行为零变化；②applyAnswer 仅奇偶两分支新增，apply 非自动批改题型 gradeUserAnswer 仍返回 null（家长检查通道），UI 信号待 AS-14/19；③未 git commit。

### P32-AS-04~09｜阶段二 CORE：单一判分权威接通 + 旧轨物理删除 + 防污染测试（2026-10-07）
- modified:
  - `shared/presentation/render-format.js`：新增 `buildAnswerSpec(sq, answerMode)`，legacy 题对象增加只读 `answerSpec{value,acceptable,precision,unit,mode}`；acceptable 只收 string/number 标量打平（嵌套数组等缺陷形态不参与判分）；classify 额外透传 `data.groups`；显示用 `answer` 字段行为不动。
  - `shared/validator/answer-validator.js`：新增并导出运行时判分唯一入口 `gradeUserAnswer(userRaw, answerSpec, ctx) → true|false|null`（questionType 唯一分派：judge 布尔词表/choice 精确/calc·fill·geometry·apply 余数语义→数值容差(默认 precision=2)→归一化文本白名单/classify 组→项集合顺序无关/none·read-aloud→null/空作答→false）；新增模块唯一归一化 `normalizeAnswerText`（去全部空白+余数记号……+小写，口径等价旧 normalizeAns）、`parseJudgeValue`、`answerCandidates`、`gradeClassify`；judge 词表提为模块常量；**AS-07** `validateAnswer` judge 分支改为 answer.value 自证期望并真实消费比对 errors，删除 hardcode `true` 与丢弃比对结果的假阳性 `JUDGE_ANSWER_UNVERIFIED` INFO，非法布尔值判 ANSWER_TYPE_MISMATCH ERROR。
  - `shared/core/check.js`：`computeResult(questions,userAnswers)` 内部逐题委托 `AnswerValidator.gradeUserAnswer`（浏览器经 `global.PresentationEngine.AnswerValidator`、Node require 兜底）；函数名与 8 字段返回结构、三调用点零改动；null 三态在 boolean results 中计 false（不计对，家长检查通道待 AS-14 接 UI 信号）；correctAnswers 只取显示 value。
  - `shared/engine/presentation-engine.js`：require 并导出 `AnswerValidator`（挂 global.PresentationEngine），同步头注释。
  - `shared/core/core.js`：物理删除 `normalizeAns` 定义 + PluginUtil/global/exports 三处挂载。
  - 注释同步（因删除产生的失效交叉引用）：`shared/core/common.js`、`shared/presentation/html-renderer.js`（judge 词表引用）、`shared/generator/core/arithmetic-core.js`、`shared/generator/core/kp-arithmetic-semantics.js`。
  - 重建：`shared/engine/presentation-engine.bundle.js`（25 内联模块，含 AnswerValidator 导出）、`shared/engine/strategy-engine.bundle.js`（57+4）。
  - 新增测试：`tests/validator/grade-user-answer.test.js`（15 用例，七题型+三态+容差+余数+classify+缺陷 acceptable）、`tests/core/compute-result.test.js`（8 用例，8 字段冻结/acceptable 不上屏/通道透传/旧轨消失断言）、`tests/presentation/answer-pollution.test.js`（7 用例，answerSpec 结构 + screen/print 作答前零 value/acceptable/解析/错因/预填/预选，feedback 空占位合法）。
- deleted: `defaultQCheck`（函数+`global.defaultQCheck` 裸挂载+PluginUtil/exports 挂载）、`computeResult` 的 `opts.checkFn` 轨道、`q.answerParts` 消费分支、`core.normalizeAns`（定义+三处挂载）。删除前全库 grep 三方印证：生产仅 check.js 内部自引用，tests/dev/golden 零消费者；无 shim/别名。
- reason: 任务书 §9.3 契约 B/C 落地——判分权威收口 answer-validator 一处（validateAnswer 质检方向 + gradeUserAnswer 运行时方向），修复双判定链不对等与 judge hardcode true（核实：旧分支比对结果被整体丢弃，false 命题仅产生 INFO，真假值都不影响 valid）；RenderFormat 保数据使 acceptable/precision 与 classify data.groups 能到达判分层；答案防污染（acceptable 只判分永不上屏、解析/错因仅提交后数据通道、作答前渲染零答案）由负断言固化。11 行 answerMode 漏标 judge 不受影响（分派只认 questionType，真实会话已验证）。
- tests: 定向 `node --test tests/core/*.test.js tests/validator/*.test.js tests/presentation/*.test.js` 219/219 PASS；`npm test` **734/734 PASS / 0 FAIL**；真实生成端到端：judge false 命题（g3-down-u04-k001）作答 true→false / false→true，classify 真实题（g2-up-u01-k001 stats）规范串/组序打乱→true、错项/缺组/多标签→false、乱答→null；`node dev/check-all.js` **29 PASS / 0 FAIL / 1 SKIP**（6a 1570 真实生成、6b 矩阵冻结、12 Security 含 AnswerValidator、16/17 bundle 确定性全绿；15 无 Chrome 本地 SKIP）。375/98/373/1570 未触，题面/答案文案零改动，未重跑 variation/misconception 派生器、未重冻矩阵。
- risk: ①null（家长检查）当前在 results 落 false，UI 侧 parentCheck 显式信号属阶段三/四 AS-14 范围，本阶段不扩 UI；②浏览器装载链（bundle→global.PresentationEngine.AnswerValidator→check.js）经 bundle 产物与真实会话验证，但真实 Chrome 9 步 E2E 待 CI/有 Chrome 环境补证；③judge answer.acceptable 出现 boolean 元素（如 [false]）与 6 行 acceptable 数据缺陷/179 行冗余按任务书在 AS-11 清理，本阶段判分已稳健忽略非标量；④未 git commit。

### P32-AS-SCAN-01｜阶段一只读取证完成，证据入任务书 §9（2026-10-07）
- modified: `docs/P32/P32-TASK-BOOK.md`（新增 §9 阶段一执行记录：AS-01 生产端答案规格普查、AS-02 五层泄露面审计四向分流、AS-03 三契约；状态行与 §8 门禁表同步；AS-13 按证据修正为 data.groups 集合判定）。
- deleted: 无（/tmp 一次性探针 p32-probe/p32-probe2/p32-probe3/p32-classify/p32-l1-final/p32-l1-final2/p32-judge 及中间 JSON 用后即删，不属仓库文件）。
- reason: 阶段过门要求证据落档。对 1570 ALLOW 对全部真实生成（seed=20261007，1570/1570 成功）：acceptable=1385 空/179 value 复制冗余/6 真等价（含 g2-down-u02-k005「△」嵌套数组缺陷 1 条）；precision/unit 零生产者；judge true94/false32 且 11 行 answerMode 漏标 input；classify 25 行答案为单字符串+data.groups 结构；L1 命中 114 终判 A 真泄露 58（32 KP）/B 操作数 22/P 教学必需 12/C 待裁决 22（含规格缺陷 1）；L2 SVG 0、L3 启发式全误报（门禁禁用）、L4 hint 0（L174 污染写入仍按 AS-15 删）、L5 screen 1570 + print 168 抽样零预填/零预选/零反馈/零揭示；31 行 misconception、553 图形。三契约据此冻结。
- tests: 无（纯只读取证，无生产代码改动；基线 375/98/373/1570 未触，未跑 npm test/check-all 的必要）。
- risk: ①C 桶 22 条概念/性质支架题为教研裁决项，已在任务书挂账，AS-18 门禁上线前必须闭环，不阻塞阶段二；②A 桶 58 条修复集中在 concept-meaning 等四家 maker，阶段三题面文案变动将触发 variation/misconception 派生器重跑与矩阵重冻（任务书 AS-16 已列）；③未 git commit。

### P32-INIT｜P32 战役立项建档：任务书与审计日志创建（2026-10-07）
- modified: 无（首次建档）。
- deleted: 无。
- reason: 用户 2026-10-07 基于 `docs/audit/answer-system-audit-report.md`（答案系统只读审计六项发现）提出 P32-AS 16 任务方案；经代码核实（双判定链不对等、computeResult 三调用点、RenderFormat acceptable 降维、judge hardcode true、variation-apply 污染 q.hint）后细化为四阶段 21 任务，用户批准并裁决四事项：①先落任务书再执行；②hint 保 null 并删除变式 key 污染写入、不建提示 UI；③非 judge 维持不展示解题思路；④新增 dev/p32/check-answer-leak.js 门禁纳入 check-all（口径 30→31）。本文件与任务书为建档动作，阶段一为纯只读取证，均无生产代码改动。
- tests: 无（建档；阶段一 AS-01…03 为只读审计，无代码门禁）。
- risk: ①P32 规则文件 `.trae/rules/p32-*.md` 尚未由用户发布，任务书 §1 已声明在规则发布前以任务书为执行依据，冲突时停手提问；②新增门禁将使 check-all 项数口径由 30 变为 31（用户已预批准，实际纳入时在 AS-18 日志登记）；③未 git commit。
