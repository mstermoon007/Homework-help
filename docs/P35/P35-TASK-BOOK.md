# P35 任务书：难度执行端消费 + 遗留债务统一收口战役

> 性质：在 P28-FINAL / P30 / P31 / P32 / P33 / P34 已冻结架构上的**收口战役**，不是新架构项目。
> 本文件只登记「已证实、已挂账」的遗留问题及其方案，不开启新的审计面。
> 上位文件效力顺序：用户指令 ＞ `.trae/rules/ai-coding-workflow.md`（九步流水线）＞ `docs/01-ARCHITECTURE.md` ＞ `docs/00-BASELINE.md` ＞ 本文件。冲突时停手提问。
> 状态：**P35-FINAL 已冻结（2026-10-12）**。四阶段全部过门（用户逐次确认：DIFF→FMT→HUMAN→CLOSE），
> DEBT-1…8 全部闭环；最终门禁 `node dev/check-all.js` = 30 PASS / 0 FAIL / 1 SKIP（CI 31/0/0）。
> 日志：`docs/P35/change-log.md`（append-only，六字段）。

## 0. 战役定性

P35 只做三类合法工作：

1. **接通消费**——难度值已传导正确（practice 1–10 → sq.difficulty 1–5），但部分生成器不消费
   `plan.constraints.numberRange`，题目内容不随难度分化。把既有 NumberRangeStrategy 产出的
   区间接通到缺位生成器（P30「补齐语义消费」范式：断言读信号真实发生 + 产出对应分化）。
2. **取证与销账**——对历史挂账项逐一取证：仍在的按最小修改修掉，已消失的取证销账，须人工的打包请求单。
3. **人工请求打包**——把数据/教学/产品决策项整理成人工数据请求（H7 起续号），签批前不动手。

一句话：**接通、取证、打包；不重建、不扩审计、不编数据。**

## 1. 当前基线（2026-10-11，P34-14 收口态）

| 项 | 值 | 依据 |
|---|---|---|
| KP / Units / Relations / ALLOW | **375 / 98 / 373 / 1570**（全程不变） | docs/00-BASELINE.md |
| Canonical 题型 / Generator | 7 类 / 23 | 冻结口径 |
| 测试 / 全量门禁 | 742/742；**31 项 = 30 PASS / 0 FAIL / 1 SKIP**（#15 无 Chrome；CI 31/0/0） | P34-14 |
| 代码库状态 | 全部入库，HEAD = `0dae10a`，工作区干净 | P34 提交 |
| 解析质量 | 1570/1570 真讲解（尾 0 / 式 0 / 空 0） | P34-14 探针 |
| 已销账 | 流程债两项（37 文件 commit + 根目录杂物删除） | 0dae10a |

## 2. 禁改边界

| 对象 | 处置 |
|---|---|
| 难度公式（practice 1–10 → sq.difficulty 1–5 唯一公式） | **禁改**。P35 只接通执行端消费，不动公式、不动 sq.difficulty 语义 |
| KBL / KnowledgeContext / POL / Strategy 决策链 | **禁改**（NumberRangeStrategy 既有产出只消费不重造） |
| 7 题型集合 / 23 Generator 清单 / Validator 标准 | **禁改** |
| SVG renderer / GraphicDescriptor 结构 / Sanitizer | **禁改**（DEBT-2 仅出裁决请求，未签批不动手） |
| T2 教学语义 JSON | 只经既有派生器再生；缺数据挂 needs-review / 人工请求，AI 不手编 |
| 题面/答案文案 | 允许改（难度分档与病句修复必然触及），但每次改动必须走 §6 重冻链 |

## 3. 问题清单与方案（已登记挂账全量，无新增审计项）

### DEBT-1 难度执行端消费审计（最高优先，大任务）

- **证据**：P34-13 risk② / P34-14 risk②——难度值传导正确，但 concept-meaning / stats /
  semantic-relations 等生成器不消费 `plan.constraints.numberRange`，同 KP 不同难度档产出内容趋同。
- **归属层**：Generator 层（各生成器文件为该题型 SSOT；决策仍在 Strategy，生成器不自决难度——红线）。
- **方案**：
  1. 先只读取证：23 生成器 × 消费矩阵（消费 / 缺位 / 结构性无区间可消费三类），产出取证记录；
  2. 逐生成器接通：消费 `plan.constraints.numberRange` 约束取数区间（算术链 NumberRangeStrategy 先例），
     每生成器配套定向断言「读信号发生 + 至少两难度档产出可区分」；
  3. 结构性无区间的（如 judge 恒短题面、classify 恒长题干）登记豁免，转 DEBT-6 人工裁决。
- **门禁**：定向 tests/generation；6a 1570；6b/6c/6e --write 重冻复核；6g；npm test；check-all。

### DEBT-2 图形表达能力缺口（三视图/组合体）——✅ 已销账（H7 签批选 A，2026-10-12）

- **证据**：P34-09 risk——GraphicDescriptor 无三视图/组合体表达，扩属结构变更（红线）。
- **处置**：H7 裁决请求单签批 **A）维持现状**——该类知识点保持纯文字形态（P34-H1 先例），零动作销账。
- **DEBT-3 分流**：DEBT-3 不并入本项，经 H7 另行签批走 P35-CLOSE-01 配套图形实施（见下）。

### DEBT-3 g4-down-u02-k001 组合体 2 条仍配 cube 图——✅ 已销账（P35-CLOSE-01，2026-10-12）

- **证据**：P34-13 risk⑤；H6 请求单明确排除同族（g3-up-u01-k002/k003 一并排除）。
- **处置**：H7 签批配套图形方案「直接建配套使用的图形式生成」——新建 descriptor subtype
  `geometry.view-cards`（题设视图卡片：方格阵列 + 方向中文标注，画题设视图非组合体成品、不泄题）；
  nums 第 2 条改配 view-cards（前面/上面各 1×2 横排方格），第 3 条 cube 去棱长标注（labelSides:false）；
  题面/答案零变化。实施明细见 change-log P35-CLOSE-01。
- **遗留登记**：本 KP judge/apply 行沿用 qMeta 派生 flat 族图（circle/square），与题面语义弱相关，
  系既有形态（H6 口径未含本 KP judge/apply），登记待后续裁决。

### DEBT-4 开放设计类讲解深度（低优先）

- **证据**：P34-14 risk①——code-recognition apply（编码方案设计）、数独/必胜策略讲解为规则结论复述。
- **方案**：阶段二只做取证登记（样例 + 现状口径）；是否做逐步支架由教学评审提出具体要求后另立任务。不编造。

### DEBT-5 stats format 债务 8 行 / 4 KP

- **证据**：P32-AS-16E risk② 登记「generator:stats 8 行 fill/choice 题面病句存量」，后续未见销账。
- **方案**：先取证（是否仍存、精确行清单）；仍在则按 P32-AS-16E 守卫范式修 stats maker 题面（题面文案变化 → 走 §6 重冻链）；已消失则取证销账。

### DEBT-6 P32 遗留 13 条矩阵数据事实缺口（人工裁决）

- **证据**：P32-AS-16H 固化明细并转人工挂账——G1/G2 各年级×题型×题干长度桶覆盖缺口
  （classify 恒长、G1 choice 短/中桶、G2 apply 长桶等，见 P32 change-log §AS-16H 表）。
- **方案**：整理为**人工数据请求单 H8**（附 13 行明细与两个选项：扩题面模板 / 接受现状并登记矩阵豁免白名单），签批前不动手。

### DEBT-7 P28 期人工请求 H1–H5 催办汇总

- **证据**：`docs/archive/phases/human-data-requests/README.md` 汇总表——H1（243 映射缺口 Excel）、
  H2（G1 缺失字段策略）、H3（58 KP 最终产品状态：25 deprecated-draft / 31 active-draft / 2 inactive-draft）、
  H4（F-TYPE-2 Frozen 修复授权）、H5（adaptive/favicon/低容量文案，可选）。均标记非阻塞但长期未决。
- **方案**：阶段三向用户提交一页催办汇总（现状 + 各项阻塞什么 + 建议处置期限），逐项等决策；AI 侧零动作。

### DEBT-8 环境口径项（登记，非债务）

- #15 真实浏览器 E2E 本机 SKIP 属正常口径（CI 设 CHROME_BIN 31/0/0 已有先例）。
- P35 全程不动该项口径，不重复登记。

## 4. 阶段与门禁（过门 + 用户确认才准进下一阶段）

| 阶段 | 内容 | 局部门禁 | 过门判据 |
|---|---|---|---|
| 一 DIFF | DEBT-1 消费矩阵 + 逐生成器接通 | 定向 tests/generation；6a/6b/6c/6e/6g；npm test | 消费矩阵齐备；每个接通生成器有「读信号断言 + 两难度档分化复现题」；结构性豁免清单转 DEBT-6 |
| 二 FMT | DEBT-5 取证/修复 + DEBT-4 取证登记 | 定向 + 6g + §6 重冻链 | stats 8 行清零或取证销账；开放类讲解现状口径登记 |
| 三 HUMAN | DEBT-2/3 裁决请求单 + DEBT-6 请求单 H8 + DEBT-7 催办汇总 | 无代码门禁（纯文档/请求单） | 三份材料提交用户，逐项获得签批或明确维持现状 |
| 四 CLOSE | DEBT-2/3 按签批执行（如有）+ 全量重冻 + 最终冻结 | `node dev/check-all.js` 31 项 30/0/1（CI 31/0/0）；冻结物重冻一致 | 请求单处置闭环或显式维持现状；日志收口 |

## 5. 任务编号与改后动作

- 编号：`P35-INIT`、`P35-DIFF-xx`、`P35-FMT-xx`、`P35-HUMAN-xx`、`P35-CLOSE-xx`。
- 每任务一交付；任务外发现的问题只登记不顺手修（红线 #9）。
- 题面/答案文案改动触发（§6 防漏）：`dev/p27/derive-variation-profiles.js` + `derive-misconceptions.js` →
  golden 两段式（`build-golden-dataset.js` 紧接 `--fill-missing`，至 1114 题/15 族）→
  `check-generation-matrix-freeze.js --write` + `check-generator-matrix.js --write` + `check-kp-qt-maker-matrix.js --write` →
  `npm run verify:allow-gen` + `node dev/p32/check-answer-leak.js` → 改 generator 源码后
  `node dev/build-strategy-bundle.js` 重建 bundle → npm test → check-all → 日志。
- 不自动 git commit；提交信息遵循仓库既有风格（`P35-xxx: 摘要`）。

## 6. P35 红线（沿 P28/P30/P31/P34 口径，另加两条战役专属）

1. Generator 不得自决 KP/题型/数量/难度——难度消费只读 `plan.constraints.numberRange`，禁止在生成器内重新定义难度档。
2. 难度分档不得以牺牲 6b 去重指纹 / 6g 防泄露 / golden 覆盖为代价；任一门禁 FAIL 即停。
3. 沿用 P28/P30/P31/P34 全部红线（不新建层/不双轨/不 catch-''/不编数据/不跳门禁等）。
