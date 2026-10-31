# 人工数据需求汇总（Human Data Requests）

> 一次性汇总当前全部需要人工提供/决策的事项。每项均给出：需要什么、为什么、影响面、交付格式、完成后系统侧动作。
> 配套数据文件位于 `docs/human-data-requests/`。

---

## H1｜P13-05：243 个生成映射缺口（需原始 Excel sheet 4）

| 项 | 内容 |
|---|---|
| **需要** | 原始生成映射资料（Excel sheet 4 或等价权威源）：canonical KP → capability → generator 绑定 |
| **为什么** | 243/598 KP 无 allow 绑定（170 有行但 permission=missing；73 无映射行）→ 这些 KP 无法生成或退化 |
| **影响** | 生成覆盖率、知识页「可练题型」真实性、F-TYPE-2 修复后的类型分布 |
| **数据文件** | `mapping-gap-243.csv`（kp_id, grade, category, rows, allow_rows, declared_types） |
| **格式** | 每行：kp_id, capability, generator_id（或明确标注「合法无绑定」） |
| **禁止** | AI 猜 generator、批量默认绑定、改 Generator 逻辑、绕过 Scope Contract |
| **完成后动作** | `kbl:import` → rootHash 变更 → 重新验证（KBL VERIFY / Strategy / Binding / Scope / Golden） |

## H2｜P13-06：G1 基础数据缺失（32 KP，需业务确认策略）

| 项 | 内容 |
|---|---|
| **需要** | 对确实缺失字段给出策略：① 合法为空（生成侧跳过并 WARN）② 提供原始值 ③ 保持缺失 |
| **为什么** | seedDifficulty 31 / cognitiveLevel 31 / type 32 / maxSteps 32 / numberRange 11 缺失；经对照原始迁移数据 **全部确实缺失**（raw 亦为 null） |
| **影响** | 难度标注展示、能力推导、生成参数（当前由 Difficulty Authority/默认逻辑兜底，未阻塞生成） |
| **数据文件** | `g1-missing-fields.csv`（kp_id, grade, missing_fields） |
| **禁止** | 缺失 → 默认值；用最终难度公式反向写入基础数据 |
| **完成后动作** | 若补齐：KBL 数据变更 + rootHash 更新 + 重新验证；若保持缺失：在生成侧登记 WARN 策略 |

## H3｜P13-07：58 个非发布 KP 最终产品状态（需产品决策）

| 项 | 内容 |
|---|---|
| **需要** | 每个 KP 的最终状态：`published` / `knowledge-only` / `hidden` / `pending-data` |
| **为什么** | 当前 58 个 KP 为 draft 且不可选（25 deprecated-draft / 31 active-draft / 2 inactive-draft），状态未最终定义 |
| **影响** | 知识页是否生成、是否进入 selectable（当前已隔离，不影响主路径） |
| **数据文件** | `non-publishable-58.csv`（kp_id, grade, status, publication, unit, name） |
| **完成后动作** | 更新 KBL status/publication → 重建知识页（`build:knowledge-pages`）→ 验证 540/598 计数 |

## H4｜F-TYPE-2：Frozen 归一化表修复授权（需授权决策）

| 项 | 内容 |
|---|---|
| **需要** | 授权修复 Frozen Core 题型归一化：① `RECOGNIZE_KEYWORDS` 不再返回 geometry（返回 null/calc）；② 删除 `factor-multiple/factor/all → geometry` 错别名；③ `capability-model` 改为 `type` 优先（rawType 仅补充） |
| **为什么** | 76~79/598 KP（13%）capability supported 与声明题型不一致 → 多题型请求单题型产出（F-TYPE-2）、越界丢弃（F-TYPE-1） |
| **影响面** | 题型分布、生成覆盖率、知识页可练题型；修复后需全量回归（Golden/Strategy/598 KP/E2E） |
| **数据文件** | `f-type-2-affected-kps.csv`（kp_id, grade, declared, raw_type, supported） |
| **备选** | 若暂不授权 Frozen 修复：随 H1 的映射数据修复 + POL 侧仅按 ALLOW 分配（降噪不治本） |
| **禁止** | POL/UI 层伪造题型多样性；绕过 Scope 守卫 |

## H5｜可选产品决策（低优先）

| # | 项 | 说明 |
|---|---|---|
| 1 | adaptive/learnerProfile UI 启用 | 学习画像能力已在 API 层打通（cell 上下文 P10-3/P11-00），UI 未提供 profile；启用需产品定义数据来源 |
| 2 | favicon.ico | 当前 404（cosmetic）；如需品牌图标请提供 favicon 资源 |
| 3 | 低容量 KP 产品策略 | 95 个 KP 容量 ≤2（GENERATOR_LIMITED 46 / EXPECTED_LIMITED 49）；PARTIAL 为正确语义，是否需 UI 提示文案产品确认 |

---

## H6｜P34-H1：三视图/搭建立体 15 行证据规则图形锚定删除授权（需教学评审 + 授权决策）

> **状态：已签批并执行完成（2026-10-08，用户「批准，按请求单执行」）。check-all 30/0/1。**

| 项 | 内容 |
|---|---|
| **需要** | 授权对 3 个 KP × 5 题型共 **15 行** evidence-rules 的 `required` 删除全部 `data.graphic.*` 锚定（type/subtype/params.labelSides/params.unit/params.unitPx），保留 `data.mode`、`data.steps`、`data.shapeName=立体图形`。**执行时配套发现（2026-10-08 已执行）**：同一图形强制还存在于 `qt-intent.json` 3 行 geometry 的 `assessment`（graphicRole=carrier 且 allowedRepresentations=["graphic"]，KpSemantic checkIntentAlignment 对 carrier 强制有图）——已按同一签批意图改为 graphicRole=null、allowedRepresentations=["numeric"]；其余 12 行 graphicRole=auxiliary（图可选，与无图不冲突）保持不动 |
| **涉及 KP** | `math-g4-down-u02-k002`（由平面到立体）、`math-g5-down-u01-k001`（从不同角度观察立体图形）、`math-g5-down-u01-k002`（根据平面视图搭建立体图形） |
| **为什么** | 这 15 行题目全部由文字自含视图数据（「从正面看是 3 个正方形、从上面看是 4 个正方形……」），现行锚定强制配 `cuboid` 长方体盒子图——既非题设的小正方体组合体，也不承载任何解题信息，属图文错配；且**不能改为画组合体**（学生数方块即得「至少几个」答案，摧毁空间推理考点），画三视图则与文字完全重复。标准练习册形态即「文字三视图 + 无图」 |
| **契约可行性** | 已核实：仅 geometry 题型受 `graphicOrInstruction` 约束，该不变式在有 `data.shapeName` 时即通过；choice/judge/fill/apply 契约不要求图。去图后 shapeName 保留，契约全满足 |
| **不涉及的 3 个同族 KP** | g3-up-u01-k002（反推观察角，无图形锚定，单体观察配图正确）、g3-up-u01-k003（观察正方体，cube 锚定且配图正确）、g4-down-u02-k001（无图形锚定；其 2 条组合体条目的去图属生成器侧改动，不涉及 T2，另立任务） |
| **数据文件** | `p34-h1-view-graphic-anchor-removal-15.csv`（kp_id, kp_name, question_type, current_graphic_required_fields, requested_change, kept_fields, rationale, sample_prompt） |
| **禁止** | AI 自行手编 T2 证据规则；新增 cube-assembly/three-view 渲染器（教学上泄题/冗余，已否决）；改题面/答案文案（本请求只动证据锚定，题面零变化） |
| **评审后动作（须评审通过方启动）** | ① 按签批定稿改 `kbl/teaching/evidence-rules.json` 15 行并同步 T3 运行时副本；② shape.js 对这 3 KP 的 themed 分支去 `data.graphic` 输出、geometry 引导语由「观察下图（长方体），想一想——」改为纯文字形态（题面设问本体不动）；③ 重建 bundle → 重跑 variation/misconception 派生器 → 金题集两段式重建 → 三矩阵 --write 重冻 → npm test/6a/6g/check-all（30/0/1）→ 追加 `docs/P34/change-log.md` |
| **风险** | 低：题面/答案零变化，6b/6a 生成指纹预期不变；变化的仅是 KpSemantic 对 graphic 字段的要求与 SVG 渲染数（553 → 减少 15 个图形），6g L2 图形扫描面同步缩小 |

---

## H7｜P35-DEBT-2/3：三视图/组合体图形表达能力缺口裁决请求（需教学评审 + 授权决策）

> 来源：P35 任务书 DEBT-2（P34-09 risk 挂账）+ DEBT-3（P34-13 risk⑤）。2026-10-12 提交，签批前 AI 零动作。
> **状态（2026-10-12 用户签批）**：DEBT-2 选 **A**——维持纯文字形态销账（H6 先例），零动作；DEBT-3 用户指令「知识点若需要配图考察，直接建配套使用的图形式生成」——方向为建配套组合体图形（结构变更），另立任务取证设计后执行。

| 项 | 内容 |
|---|---|
| **需要** | 对下列两项逐条裁决：**A）维持现状**（纯文字形态销账，H6 先例）；或 **B）扩 GraphicDescriptor 表达**（属结构变更，须显式授权，含门禁扩展与全量重冻，另立任务） |
| **DEBT-2 证据** | g5-down-u01-k001（从不同角度观察立体图形）等题面设问「多少个小正方体三视图」，现行 GraphicDescriptor 无三视图/组合体表达，只能配 cuboid 单盒图——非该教学模型的完整表达；T2 证据规则锚定 subtype 不可换图，扩表达属结构变更（红线） |
| **DEBT-3 证据** | g4-down-u02-k001（观察物体）2 条组合体条目仍配 cube 图（无 T2 锚定，生成器侧历史遗留）。H6 请求单已明确排除同族：g3-up-u01-k002（单体观察配图正确）、g3-up-u01-k003（cube 锚定且配图正确）**不在本请求范围** |
| **选项** | DEBT-2：A 维持纯文字（H6 已证明契约可行）/ B 扩 descriptor 三视图·组合体表达（注意 H6 已论证「组合体配图泄题、三视图配图与文字重复」，B 须先回应此论证）；DEBT-3：A 去图（2 条组合体条目去 cube 图，生成器侧改动，按 P34-H1 流程）/ B 改图（依赖 DEBT-2 选 B）/ C 维持现状登记 |
| **禁止** | AI 自行扩 GraphicDescriptor 结构、改 SVG renderer/Sanitizer；顺手修 H6 已排除的同族 KP |
| **签批后动作** | 按所选逐项走 P34-H1 既有流程：T2/生成器改动 → 重建 bundle → 派生器重跑 → 矩阵重冻 → npm test/6a/6g/check-all → 追加 change-log |

## H8｜P35-DEBT-6：13 条矩阵数据事实缺口人工数据请求（需 KBL 评审决策）

> 来源：P32-AS-16H 固化明细（P31-09 登记，取证口径：seed=20261009、Layout.renderLen 分桶、KCV ALLOW 矩阵）。2026-10-12 提交，签批前 AI 零动作。
> **状态（2026-10-12 用户签批）**：选 **B**——接受现状并登记矩阵豁免白名单销账。13 条缺口为 KBL 数据面事实（非代码/渲染缺陷），豁免口径登记于 `docs/P31/P31-TASK-BOOK.md` P31-09 缺口登记处；后续验收不再视为缺口。

| 项 | 内容 |
|---|---|
| **需要** | 对 13 条「年级×题型×题干长度桶」覆盖缺口逐类决策：**A）扩题面模板/补 ALLOW 授权**（KBL 数据面变更，走 T0/T1 流程）；或 **B）接受现状并登记矩阵豁免白名单**（销账） |
| **性质** | 全部为 KBL 数据面事实（ALLOW 资格矩阵分布 + 真实生成链长度分布），**非代码缺陷、非渲染缺陷**；部分桶（#9/10/11/13）库中存在能产该桶的 KP，属探测策略局限而非数据缺失 |
| **明细** | 见下表（13 行，与 P32 change-log §AS-16H 一致） |
| **禁止** | AI 编造数据填补（P30 §2 T0 铁律）；为凑桶降题干质量标准 |

| # | 缺口 | ALLOW KP 数 | 实际产该桶 KP | 缺桶原因 |
|---|---|---|---|---|
| 1 | G1 judge「短」桶缺 | 3 | 0（全产 mid） | judge 题面结构恒 ≥26 字符 |
| 2 | G1 classify 无 ALLOW KP | 0 | — | KCV 矩阵未授予 |
| 3 | G6 classify 无 ALLOW KP | 0 | — | KCV 矩阵未授予 |
| 4 | G2 classify「中」桶缺 | 6 | 0（全产 long） | classify 题干结构恒长 |
| 5 | G3 classify「中」桶缺 | 4 | 0（全产 long） | 同上 |
| 6 | G4 classify「中」桶缺 | 8 | 0（全产 long） | 同上 |
| 7 | G5 classify「中」桶缺 | 7 | 0（全产 long） | 同上 |
| 8 | G1 choice「长」桶缺 | 39 | 仅 1 | 一年级 choice 题干普遍短 |
| 9 | G2 choice「长」桶缺 | 60 | 9 | long 分布稀疏，探测未命中 |
| 10 | G3 choice「长」桶缺 | 71 | 11 | 同上 |
| 11 | G6 choice「长」桶缺 | 56 | 11 | 同上 |
| 12 | G1 choice「中」桶缺 | 39 | 仅 2 | 一年级 choice 题干以 short 为主 |
| 13 | G2 apply「长」桶缺 | 60 | 9 | 二年级 apply 题干以 mid 为主 |

## H1–H5 催办汇总（P35-DEBT-7，2026-10-12 提交）

> 均为 P28 期登记、非阻塞但长期未决事项。AI 侧零动作，逐项等决策。

| # | 事项 | 现状 | 阻塞什么 | 建议处置 |
|---|---|---|---|---|
| H1 | 243 映射缺口 Excel（sheet 4） | 未提供；243/598 KP 无 allow 绑定（170 permission=missing + 73 无映射行） | 生成覆盖率上限、知识页「可练题型」真实性 | 提供映射数据或明确标注「合法无绑定」；无期限压力但越拖漂移越大 |
| H2 | G1 缺失字段策略（32 KP） | 未决；seedDifficulty/cognitiveLevel/type/maxSteps/numberRange 确实缺失（raw 亦 null） | 无（Difficulty Authority 兜底，未阻塞生成） | 三选一：合法为空 / 提供原始值 / 保持缺失登记 WARN |
| H3 | 58 非发布 KP 最终状态 | 未决；25 deprecated-draft / 31 active-draft / 2 inactive-draft | 无（已隔离，不进 selectable） | 逐 KP 定 published/knowledge-only/hidden/pending-data |
| H4 | F-TYPE-2 Frozen 修复授权 | 未授权；76~79/598 KP（13%）capability 与声明题型不一致 | 题型分布真实性（POL 侧仅按 ALLOW 分配可降噪不治本） | 授权修复 或 明确随 H1 数据修复时一并处理 |
| H5 | adaptive UI / favicon / 低容量文案 | 未决（可选） | 无 | 可继续挂起；任一启用时单独提需求 |

### H1–H5 签批处置结果（P37，2026-10-12）

> 用户 2026-10-12 指令「按照P36的序列，根据方案，逐项解决」，逐项取证（只读）+ AskUserQuestion 签批。
> 核心发现：H1/H2/H3 数字口径均为 P13 期 598-KP 旧体系，按当前基线（canonical 375 / 1570 ALLOW）重新对账后大部分已随体系重建消解。

| # | 处置 | 取证结论 |
|---|---|---|
| H1 | **取证销账（旧口径污染）** | 源 Excel 实际仅 2 sheet：Sheet1 375 行（字段：年级/版本/册/数学分类/单元/单元名称/知识点/知识点释义，无映射列）+「知识点」空表——**无 sheet 4 可派生**。且当前 375 KP **100% 有 allow 绑定**（mappings unique=375，缺口 0），6b 1570 行全 PASS。「243/598 缺口」已随 P25+ 体系重建消解。未来提升每 KP 题型行数属增强，非债务 |
| H2 | **取证销账（旧口径污染）** | seedDifficulty/cognitiveLevel/type/maxSteps/numberRange 为 P13 期字段体系，当前 canonical 结构已不含；语义由 T2 派生（qt-intent/variation-profiles）+ Difficulty Authority + `plan.constraints.numberRange`（P35-DEBT-1 接通 23 生成器）替代。G1 样本正常生成（g1-down-u01-k001 5 行 / g1-down-u02-k002 4 行 ALLOW） |
| H3 | **销账（25 已接入 + 33 维持剔除）** | 58 = 25 个已在当前 375 且 active+有绑定（可练）；33 个（7 deprecated / 25 active-draft / 1 inactive）源 Excel 已无行（Sheet1=375 行）。用户签批**维持剔除**，基线 375 不动。未来接入须 root Excel 补行 + 基线扩容（375→408）+ 全链重冻，另立项 |
| H4 | **已授权 Frozen 修复 → P37-02 执行** | 用户 2026-10-12 签批「授权 Frozen 修复」。执行前须按当前 375 口径重新取证：① RECOGNIZE_KEYWORDS ② factor 族→geometry 别名 ③ capability-model 三修复点是否仍存在于当前代码（76~79/598 为旧口径），并处置 P36-03 登记的 question-type-registry `'winning'` 键可达性 |
| H5 | **销账（维持现状）** | 用户签批「查阅源excel，若是旧数据污染，直接清理」——三项均非 Excel 数据问题：favicon 404 维持、adaptive UI 挂起（启用需产品定义数据来源）、低容量 KP 不加提示文案。登记维持现状销账 |

---

## 汇总表

| # | 事项 | 类型 | 阻塞发布 | 提供方 |
|---|---|---|---|---|
| H1 | 243 映射缺口 Excel | 数据 | 否（不阻塞，阻塞生成质量） | 内容/数据 |
| H2 | G1 缺失字段策略 | 业务确认 | 否 | 业务 |
| H3 | 58 KP 状态 | 产品决策 | 否 | 产品 |
| H4 | F-TYPE-2 Frozen 修复授权 | 授权 | 否 | 项目负责人 |
| H5 | adaptive/favicon/低容量文案 | 可选 | 否 | 产品 |
| H6 | P34-H1 三视图 15 行图形锚定删除 | 教学评审+授权 | 否（已签批执行完成 2026-10-08） | 项目负责人/教研 |
| H7 | P35-DEBT-2/3 三视图/组合体图形表达裁决 | 教学评审+授权 | 否（阻塞 P35 阶段四 CLOSE 收口） | 项目负责人/教研 |
| H8 | P35-DEBT-6 13 条矩阵数据事实缺口 | 数据/业务确认 | 否（阻塞 P35 阶段四 CLOSE 收口） | 内容/数据/教研 |
| H9 | G6 分数乘法 4 KP 域误判（源 Excel 数学分类错误） | 数据（T0 Excel） | 否（不阻塞生成，但域错导致题型声明与题面形态偏误） | 内容/数据 |
| H10 | 前置关系三条链评审（负数 / 观察物体 / 方向与位置） | 教学评审 | 否（不阻塞运行；影响组合题校验与知识图谱完整性） | 教研 |

---

## H9｜2026-10 年级审计：G6「分数乘法」4 KP 域误判（源 Excel）

> 来源：2026-10-29 只读年级适配审计（G1–G6 知识范围 / 前置知识 / 题型声明 / 难度边界）。
> 当前状态：**仅登记，零写入，375/98/373/1570 基线不变**。AI 不改 Excel、不手编 canonical。

| 项 | 内容 |
|---|---|
| **需要** | Root Excel 行 324–327「数学分类」字段由 `图形与几何` 改为 `数与代数`；或人工确认该处分类确属几何（若属后者本请求即销账） |
| **受影响 KP** | `math-g6-up-u02-k001` 分数乘整数、`k002` 一个数乘分数、`k003` 分数、小数混合运算及运算律、`k004` 解决问题（共 4 个 KP，单元「分数乘法」） |
| **证据** | 源抽取 `kbl/import/extract-raw.json` 行 324–327：`数学分类=图形与几何`；同册「分数除法」「百分数」「确定位置」分别为 `数与代数`/`数与代数`/`图形与几何`（正常）；全库 12 个含「分数/小数/运算」关键词的单元仅此单元为 geometry |
| **当前后果** | ① `derive-kbl.js` 按 `DOMAIN_TYPES.geometry = [geometry, fill, apply, judge, choice]` 派生 allowedTypes——**4 个 KP 没有 calc**，只能生成「看图列式计算…」线段图形态题（实测 `geometry` 渲染 SUCCESS，带 `data.graphic.subtype=segment`），而非口算/列式计算题；② 域标记与教材实际内容偏离，可能影响后续语义族归类与统计视图 |
| **评审后动作（须 Excel 改值方启动）** | `npm run kbl:rebuild`（`derive-kbl` → `derive-relations` → `emit-canonical` → `build`）→ 同步 `shared/knowledge` 运行时镜像 → 重跑 `dev/check-allow-generation.js` 1570→1566 回归（4 个 KP allowedTypes 由 5→4，geometry 被替换为 calc）→ 6a/6b 矩阵 `--write` 重冻 → 更新 `docs/00-BASELINE.md` → `node dev/check-all.js` → 追加 P43 或后续战役 change-log |
| **禁止** | 绕过 T0 人工源、直接在 `kbl/canonical/knowledge.json` 改 domain；在派生器内对这 4 个 KP 硬编码特判；运行时修改 allowedTypes |
| **影响面** | 仅 4 个 KP；ALLOW 映射总数 **1570 → 1566**（域从 geometry 改 algebra：`DOMAIN_TYPES.geometry` 5 条 `[geometry,fill,apply,judge,choice]` → `DOMAIN_TYPES.algebra` 4 条 `[calc,fill,apply,choice]`，共同 3 条保留，几何独有 geometry/judge 两条消失，代数独有 calc 一条新增，净减 1 条 per KP，4×1 = 4 条）；**relations 373 不受影响**（relations 仅取决于 familyId + CONCEPT_FAMILIES，与 domain 无关）；运行时 bundle 重建 |
| **选项** | A）改正 Excel 并重派生（推荐）；B）确认该处分类合理，销账；C）维持现状登记 needs-review |

### H9 执行步骤（待签批；签批前 AI 零动作）

> 执行前提：用户在 Root Excel 行 324–327 把「数学分类」由 `图形与几何` 改为 `数与代数` 并保存。
> 唯一允许改 Excel 的是人（T0）；AI 只执行 T1 重派生与代码/文档同步。

| 步 | 动作 | 命令 / 改动点 | 预期结果 |
|---|---|---|---|
| 0 | 执行前取证（只读） | 记录 `kbl/canonical/*.json`、两个 `manifest.json` 的 SHA256；`git status --short` 须干净 | 可回滚基线 |
| 1 | T0 人工改 Excel | 行 324–327「数学分类」→ `数与代数`；记录新 Excel SHA256 | — |
| 2 | T1 重派生 | `npm run kbl:rebuild`（extract → derive-kbl → derive-relations → emit-canonical → build → build:knowledge） | 4 KP `domain` 改 `algebra`；`allowedTypes` 5→4（去 geometry/judge、加 calc）；`capacity` 68→66；mappings/生成矩阵 **1570→1566**；relations **373 不变** |
| 3 | 校验派生数值 | `node tools/kbl/validate.js`（先改 106 行断言 1566） | 映射数 1566、permission 全 allow |
| 4 | T2 顺延（不手编） | 改 `dev/p25/derive-qt-intent.js` 2 处断言 `1570`→`1566` 后重跑 | `qt-intent.json` 1570→1566 行（4 KP 的 geometry/judge 消失、calc 新增）；`requiredRelations` 投影仍 = 373 |
| 5 | T2 孤儿行处置 | 只读核查 `evidence-rules.json`：4 KP 的 geometry/judge 共 8 行将无 ALLOW 承载（A 类人工定稿，AI **不删不补**） | 登记 needs-review（H9-T2-01）走人工评审；不阻塞主链 |
| 6 | 矩阵重冻 | 先改硬编码：`check-generation-matrix-freeze.js` 3 处（83/84/85）+ md 文案 7 处、`check-kp-qt-maker-matrix.js` 55 行、`check-answer-leak.js` 340 行 `1570`→`1566`；再 `--write` 重冻 6b/6c/6e | 1566 行 0 FAIL；6g 泄露门禁按新 ALLOW 面实跑并登记，不绕过 |
| 7 | 基线断言同步 | `dev/verify-kbl-runtime.js` 39–40、`dev/check-kbl-quality.js` 33、`dev/p25/build-baseline.js` 76、`dev/p30/check-kbl-lineage.js` 120（文案） | 全部 1566 / relations 373 |
| 8 | 派生快照 | `node dev/p25/build-baseline.js` | `kbl/teaching/kp-matrix.json` allow 分布更新；`docs/archive/phases/p25/P25-BASELINE.md` 派生快照随之更新（change-log 记明） |
| 9 | 当前口径文档 | `docs/00-BASELINE.md`（61–63）、`docs/02-KBL.md`（13）、`docs/DESIGN-REPORT.md`（17）、`README.md`（71）、`llms.txt`（38） | 1570→1566；`docs/03-POL-GENERATION.md` 为 P28-08 FROZEN 历史快照，不重写数字，仅加注「当前口径见 00-BASELINE」 |
| 10 | 门禁 | 定向 `node --test tests/semantic tests/generation` → `npm test` → `npm run verify:allow-gen`（1566/1566）→ `npm run verify:coverage` → `node dev/check-all.js` | 34 项 33 PASS / 0 FAIL / 1 SKIP（CI 34/0/0）；6a/6b/6c/6e/6g/7/8 全 PASS |
| 11 | 日志 | 追加新战役 `docs/P44/change-log.md` 六字段 | modified/deleted/reason/tests/risk |

- **回滚**：Excel 还原 → `npm run kbl:rebuild` → 反向改回断言 → 重冻 6b/6c/6e；数据类禁止手改 `kbl/canonical/`。
- **风险**：①4 KP 由「看图列式」变为「口算/列式」，4×4=16 行产出变化 → 6b/6e/6g 必重冻；②evidence-rules 8 行孤儿；③capacity 68→66 影响覆盖率报告；④若评审认定原分类确为几何，本请求销账，不执行任何步骤。

---

## H10｜2026-10 年级审计：前置关系三条链评审请求

> 来源：2026-10-29 年级适配审计 → 继续只读取证（用户签批「继续只读取证」）。
> 当前状态：**仅登记，零写入，373 基线不变**。不改派生器、不补边、不移动 `isExcluded`。

### 根因（规则声明边界）

`tools/kbl/derive-relations.js` 明确把概念分两组：
- **主干概念族**（11 个，`CONCEPT_FAMILIES`）：R-REL-03 为其生成跨册概念链（带 `evolution{familyId,fromStageOrder,toStageOrder,op}`），如 `fam_integer / fam_addsub / fam_fraction / fam_decimal / fam_shape / fam_measure …`
- **非主干族**（`EXTRA_FAMILIES`）：注释「仅 regex 归类，无跨册概念链」，包括 `fam_negative / fam_observation / fam_direction / fam_statistics / fam_time / fam_review …`

缺口即后者的设计边界——**不是数据丢失**，也**不阻断运行时生成**；唯一影响点是 `shared/validator/composite-validator.js` 的组合题合法性校验（需 prerequisite 边可达）。

### 特别强调的三个边界

1. 不因图谱追求完整而人为制造前置关系。
2. 不因某个 KP 名称包含「方向」「位置」就自动改变概念族。
3. 不把图谱关系缺失直接等同于运行时题目生成错误。

### 候选 1：负数链（优先评审）

| 项 | 内容 |
|---|---|
| **族归属** | 单元 `g6-up-u07`（综合实践——生活中的负数，3 KP）+ `g6-down-u01`（负数，5 KP）→ 全部 regex 命中 `/负数/` → `fam_negative`（EXTRA，stageOrder 1–8） |
| **断点** | 两单元之间：`g6-up-u07-k003 应用负数` → `g6-down-u01-k001 负数的意义` 完全无连边 |
| **候选补边（按 R-REL-03 机制）** | 段端点取「单元内 knowledgeNo 最小 KP」：`math-g6-up-u07-k001 寻找负数 → math-g6-down-u01-k001 负数的意义`（G6 上下册同一明确概念；教学上「综合实践中初步认识负数」→「正式学习负数意义与应用」构成自然前置）。需把 `fam_negative` 由 `EXTRA_FAMILIES` 移入 `CONCEPT_FAMILIES`（stages=`[['g6','up','负数'],['g6','down','负数']]`，ops=`['abstract_up']`），否则 R-REL-03 不遍历该族；本行修正了原 `k003 → k001` 与机制不符的写法 |
| **族归属调整** | 无 |
| **组合题校验影响** | 补边前两单元 KP 不能跨单元组合；补边后组合题新增合法路径 1 条 |
| **派生基线影响** | relations 373 → 374（+1 条 R-REL-03 evolution 边）；R-REL-03 38 → 39；族表 11 主干 / 14 扩展 → 12 / 13；`fam_negative` 成员 `stageOrder` 按 `computeStageOrders` 重算（预期仍为 1–8，需派生后实测核对） |
| **教学依据** | 六年级上 `负数` 为综合实践，下册为正式单元；教材编排天然是后者的前置 |

### 候选 2：观察物体链（优先评审，含族归属分裂）

| 项 | 内容 |
|---|---|
| **族归属分裂** | `g4-down-u02-k001 从不同方向观察物体` regex 命中 `/方向/`（FAMILY_RULES 第 88 行优先级高于第 91 行 `/观察/`）→ `fam_direction`；同单元 k002/k003 仍属 `fam_observation`；`g5-up-u01-k001 从不同方向观察组合体` 同理被分到 `fam_direction` |
| **断点** | ① `g3-up-u01-k003 观察正方体` → `g4-down-u02-k001 从不同方向观察物体`；② `g4-down-u02-k003` → `g5-up-u01-k001`；③ `g5-up-u01-k003` → `g5-down-u01-k001`（共 3 处，且第一处为跨族） |
| **候选补边（两步）** | **第一步（纠正分裂）**：把 `fam_observation` 由 `EXTRA_FAMILIES` 移入 `CONCEPT_FAMILIES`，stages=`[['g3','up','观察物体'],['g4','down','观察物体'],['g5','up','观察简单组合体'],['g5','down','观察物体']]`，ops 3 个；`familyMembership` 对命中阶段的单元优先采用链族（`chainFamiliesForUnit`），**无需改 `FAMILY_RULES`** 即自动消除「方向/观察」分裂。**第二步（R-REL-03 单元首 KP 端点）**：① `math-g3-up-u01-k001 观察原则 → math-g4-down-u02-k001 从不同方向观察物体`；② `math-g4-down-u02-k001 → math-g5-up-u01-k001 从不同方向观察组合体`；③ `math-g5-up-u01-k001 → math-g5-down-u01-k001 从不同角度观察立体图形` |
| **族归属调整** | 是：升级为主干族后，`math-g4-down-u02-k001`、`math-g5-up-u01-k001` 自动由 `fam_direction` 纠正为 `fam_observation`（不改 `FAMILY_RULES`、不改正则优先级） |
| **组合题校验影响** | 三处断点打通后组合题跨册合法范围扩大 |
| **派生基线影响** | relations 373 → 376（+3）；R-REL-03 38 → 41（单独实施本链时；与负数链同批为 42）；族表 11/14 → 12/13（两条链同批为 13/12）；4 个观察单元内 KP 的 `familyId/stageOrder` 重算，`semantic.conceptFamily` 发射副本随 `emit-canonical` 变化 |
| **教学依据** | G3 观察单物体 → G4 观察物体（二）三方向 → G5 组合体三视图 → G5 搭建立体，是教材完整螺旋链 |

### 已裁决并执行：方向与位置链 + 取消综合实践与复习单元排除（2026-10-31）

| 项 | 内容 |
|---|---|
| **暂缓理由（历史记录）** | `fam_direction` 跨越 G2→G3→G4→G5→G6 共 7 单元，其中 G5 无「位置」对应单元（仅数学广角）、G4→G6 跳 G5 是否构成直接前置关系需教学评审确认；不能仅凭名称相似建立关系 |
| **维持排除（已被覆盖）** | > **2026-10-31 用户显式指令覆盖**：Q1/Q2/Q3/Q4 全部成立，「不做排除，按照册、单元做综合总结」；`isExcluded` 已物理删除，12 个复习/综合课 KP 参与 R-REL-02 递进。执行见下方「H10-C 裁决与执行」。 |

### 评审后动作（须逐项签批方启动）

| 优先级 | 动作 | 门禁 |
|---|---|---|
| 高 | 先对负数链族升级 + 1 条补边做教学评审 | 评审通过后按「H10-A 执行步骤」：`fam_negative` 移入 `CONCEPT_FAMILIES`（同步从 EXTRA 删除）→ 重跑 `derive-relations` → `emit-canonical` → `build.js` → 373→374 / R-REL-03 38→39 → 全量门禁 |
| 高 | 对观察物体链族升级 + 3 条补边做教学评审 | 评审通过后按「H10-B 执行步骤」：`fam_observation` 移入 `CONCEPT_FAMILIES`（不改 `FAMILY_RULES`，链族优先自动纠正分裂）→ 373→376 / R-REL-03 38→41 → 全量门禁 |
| 暂缓 | 方向与位置链评审挂起 | — |
| 不动 | 综合实践与复习单元维持排除 | — |

### H10-A 执行步骤（负数链 · 待签批；签批前 AI 零动作）

> 前提：教学评审通过「G6 上·综合实践（生活中的负数）→ G6 下·负数」构成自然前置。
> 一任务一链：本步骤只做负数链，不夹带观察物体链与方向链。

| 步 | 动作 | 命令 / 改动点 | 预期结果 |
|---|---|---|---|
| 0 | 只读取证 | 记录 `canonical/relations.json` SHA256、`grep -c fam_negative` 现有边数、`kbl/manifest` counts | 可回滚基线 |
| 1 | 改派生器（唯一改动点） | `tools/kbl/derive-relations.js`：`CONCEPT_FAMILIES` 追加 `{familyId:'fam_negative', name:'负数', ops:['abstract_up'], stages:[['g6','up','负数'],['g6','down','负数']]}`；`EXTRA_FAMILIES` 删除 `fam_negative`；**不改 `FAMILY_RULES`** | `validateFamilyTable()` 通过（ops 1 = stages 2−1） |
| 2 | 重派生 | `npm run kbl:derive && npm run build:knowledge`（Excel 未变，不跑 extract） | relations **373→374**；R-REL-03 **38→39**；族表 **12 主干 / 13 扩展**；新边 `math-g6-up-u07-k001 寻找负数 → math-g6-down-u01-k001 负数的意义`，带 `evolution{fam_negative, abstract_up}` |
| 3 | 校验 | 核对新边端点、`evolution.fromStageOrder < toStageOrder`、无重复边/无环；`fam_negative` 成员 stageOrder 实测仍 1–8 | 不符合 → 停手排查，不手改 canonical |
| 4 | T2 顺延 | `node dev/p25/derive-qt-intent.js`（`requiredRelations` 断言为动态，随 +1 自动成立；ALLOW 仍 1570 不需改数字） | `qt-intent.json` 对应 KP 前置集 +1；**不重跑** variation/misconception（题面/答案零变化） |
| 5 | 测试断言同步 | `tests/semantic/p40-t02-t07-foundation.test.js`：11→12、14→13、38→39；`tests/generation/p40-t11-family-contract.test.js`：38→39；`dev/p40/t12-regression-baseline.js`：38→39 及 `/38` 文案；61（族间边）/54（倒挂）**派生后实测回填** | 定向测试全过 |
| 6 | 基线/文档同步 | `dev/verify-kbl-runtime.js` 39（relations 374）、`dev/check-kbl-quality.js` 33、`dev/p30/check-kbl-lineage.js` 120（文案）；`docs/00-BASELINE.md`（373→374、38→39、11/14、54 实测）、`docs/02-KBL.md`、`docs/DESIGN-REPORT.md`、`README.md`、`llms.txt`；`docs/maintenance/P41-E-relations-research.md` 加注「H10-A 后 374」 | 当前口径一致；历史 change-log/任务书不改 |
| 7 | 审计快照 | `node dev/p40/t07-family-difficulty-scan.js` | `dev/p40/out/t07-family-difficulty.json` 更新（倒挂数实测） |
| 8 | 门禁 | 定向 `node --test tests/semantic tests/generation tests/validator` → `npm test` → `npm run verify` → `node dev/p40/t12-regression-baseline.js` → `node dev/check-all.js` | 34 项 33 PASS / 0 FAIL / 1 SKIP（CI 34/0/0）；6a/6b/6e 复跑证明题目产出零变化 |
| 9 | 日志 | 追加 `docs/P44/change-log.md` 六字段 | — |

- **回滚**：还原 `derive-relations.js` 族表 → `npm run kbl:derive && npm run build:knowledge` → 断言/文档反向还原 → 重跑门禁。禁止手改 `kbl/canonical/relations.json`。
- **风险**：低——题面/答案零变化；组合题合法路径 +1（`shared/validator/composite-validator.js` 无需改代码，需定向测试证明）；若评审驳回，本步骤整体作废。

### H10-B 执行步骤（观察物体链 · 待签批；签批前 AI 零动作）

> 前提：教学评审通过「先纠正族归属分裂，再补跨册 3 条边」。
> 与 H10-A 分开签批、分开门禁；若同批执行，按 A→门禁→B→门禁 顺序，不得同时改两族。

| 步 | 动作 | 命令 / 改动点 | 预期结果 |
|---|---|---|---|
| 0 | 只读取证 | 记录 4 个观察单元精确名（`g3-up 观察物体`、`g4-down 观察物体（二）`、`g5-up 观察简单组合体`、`g5-down 观察物体（三）`）与各单元首 KP | 端点确认 |
| 1 | 改派生器 | `tools/kbl/derive-relations.js`：`CONCEPT_FAMILIES` 追加 `{familyId:'fam_observation', name:'观察物体', ops:['abstract_up','increase_complexity','increase_complexity'], stages:[['g3','up','观察物体'],['g4','down','观察物体'],['g5','up','观察简单组合体'],['g5','down','观察物体']]}`；`EXTRA_FAMILIES` 删除 `fam_observation`；**不改 `FAMILY_RULES`**（`chainFamiliesForUnit` 链族优先自动纠正分裂） | `validateFamilyTable()` 通过（ops 3 = stages 4−1） |
| 2 | 重派生 | `npm run kbl:derive && npm run build:knowledge` | relations **373→376**；R-REL-03 **38→41**；族表 **12 主干 / 13 扩展**（单独实施）；3 条新边：`g3-up-u01-k001 观察原则 → g4-down-u02-k001 从不同方向观察物体`、`g4-down-u02-k001 → g5-up-u01-k001 从不同方向观察组合体`、`g5-up-u01-k001 → g5-down-u01-k001 从不同角度观察立体图形` |
| 3 | 校验归属纠正 | 核对 `math-g4-down-u02-k001`、`math-g5-up-u01-k001` 等 KP 的 `capability.familyId` 由 `fam_direction` 纠正为 `fam_observation`；`fam_direction` 成员相应减少；`fam_observation` / `fam_direction` stageOrder 重算 | 若新边 <376（去重命中）→ 停手核对，不强行补 |
| 4 | T2 顺延 | `node dev/p25/derive-qt-intent.js`（`requiredRelations` 动态断言随 +3 成立；ALLOW 仍 1570） | 前置集 +3；**不重跑** variation/misconception |
| 5 | 测试断言同步 | 同 H10-A，但数字为 **376 / 41**；`tests/semantic/p40-t02-t07-foundation.test.js` 的 61（族间边）/54（倒挂）**派生后实测回填**（族归属变化会改变两族排序，不得沿用旧值） | 定向测试全过 |
| 6 | 基线/文档同步 | `dev/verify-kbl-runtime.js`（relations 376）、`dev/check-kbl-quality.js`、`dev/p30/check-kbl-lineage.js`；`docs/00-BASELINE.md`（373→376、38→41、11/14、54 实测）、`docs/02-KBL.md`、`docs/DESIGN-REPORT.md`、`README.md`、`llms.txt`、`P41-E` 加注 | 当前口径一致 |
| 7 | 审计快照 | `node dev/p40/t07-family-difficulty-scan.js` | 倒挂/族内递进实测留档 |
| 8 | 门禁 | 同 H10-A：定向测试 → `npm test` → `npm run verify` → `node dev/p40/t12-regression-baseline.js` → `node dev/check-all.js` | 34 项 33 PASS / 0 FAIL / 1 SKIP（CI 34/0/0）；6a/6b/6e 题目产出零变化 |
| 9 | 日志 | 追加 `docs/P44/change-log.md` 六字段 | — |

- **回滚**：还原族表 → `npm run kbl:derive && npm run build:knowledge` → 断言/文档反向还原。
- **风险**：中低——题面/答案零变化，但**族归属与 stageOrder 重算面大于 A**（4 个观察单元全部 KP），且 `fam_direction` 成员缩减；组合题合法跨册路径 +3；`p40-t02` 的 61/54 必须实测，不得估算。
- **与 A 的合并口径**：两链同批时 relations **377**、R-REL-03 **42**、族表 **13 主干 / 12 扩展**；`61/54` 仍以派生后实测为准。

### H10-C 方向与位置链：取证、裁决与执行（2026-10-31）

> 来源：用户 2026-10-31 指令「好的，执行吧」（接续本档案「暂缓：方向与位置链」），以及对 Q1–Q4 的裁决原话：
> 「G2 方向实践课构成 G4「方向+位置」的自然前置。跨 G3、G5 直连 G4→G6 成立，每一个综合实践均为前一阶段的总结和回顾。不做排除，按照册、单元做综合总结。」
> 性质：**已执行**。改动唯一文件 `tools/kbl/derive-relations.js`（族表 + `isExcluded` 删除），canonical 由派生器重生，未手改。

（以下取证表为执行前只读实测，保留作证据）

| 单元（实测全名） | 类型 | KP | 首 KP | isExcluded |
|---|---|---|---|---|
| g2 上 `math-g2-up-u04` 综合实践——方向 | 综合实践 | 4（辨认方向 / 地图上的方向 / 描述物体所在方向 / 描述行走路线） | `math-g2-up-u04-k001` | 是 |
| g3 下 `math-g3-down-u08` 复习与关联 | 复习 | 1（图形的认识与测量、位置与运动） | `math-g3-down-u08-k003` | 是 |
| g4 上 `math-g4-up-u08` 综合实践——方向、位置 | 综合实践 | 3（认识方向与位置 / 描述位置 / 读图与绘图） | `math-g4-up-u08-k001` | 是 |
| g5 下 `math-g5-down-u09` 综合实践——探索图形 | 综合实践 | 1（各类涂色小正方体的位置特征，**内容不属方向定位**） | `math-g5-down-u09-k002` | 是 |
| g6 上 `math-g6-up-u01` 确定位置 | **常规单元** | 3（用有序数对确定位置 / 用方向和距离确定位置 / 两种定位方法适用场景） | `math-g6-up-u01-k001` | 否 |

> 说明：`g4-down-u02-k001`（从不同方向观察物体）、`g5-up-u01-k001`（从不同方向观察组合体）名称含「方向」，但**已随 H10-B 归 `fam_observation`**，不属本链，不得回拉到 `fam_direction`。

**取证结论（四条硬事实）**

1. **G1–G5 无常规「位置/方向」教学单元**；唯一常规单元是 G6 上「确定位置」。G2/G4 可作锚点的单元均为**综合实践**，G3 命中项是复习、G5 命中项是「涂色小正方体位置特征」（语义不连贯）。
2. 现网 `fam_direction` 共 **12 KP / 7 条族内前置边**，全部为单元内链（`k001→k002→k003…`），**零跨册边**。
3. 两处跨册首 KP 端点边**缺失**：`g2-up-u04-k001 → g4-up-u08-k001`、`g4-up-u08-k001 → g6-up-u01-k001`。
4. 若按三阶段升主干族（g2 上 → g4 上 → g6 上）：relations **377→379**、R-REL-03 **42→44**、族表 **14 主干 / 11 扩展**，跨度 G2→G4→G6（跳 G3、G5）；若只连 G4→G6：**377→378 / 43**，锚点仍为综合实践单元。

**评审问题（须教研逐条裁决；任一否决即维持现状）**

| # | 问题 | 依据/背景 |
|---|---|---|
| Q1 | G2「综合实践——方向」（辨认方向/地图方向/行走路线）是否构成 G4「综合实践——方向、位置」的自然前置？ | 两者均为实践课，G2 为方向辨认，G4 为方向+位置描述，存在语义递进但非教材常规单元顺序 |
| Q2 | 跨 G3、G5 直连 G4→G6 是否成立？ | G3 无方向单元，G5 无位置单元；G6 才引入数对与「方向+距离」的坐标化定位，属抽象升级（`abstract_up` 可解释） |
| Q3 | 是否接受以「综合实践」单元作为 R-REL-03 链锚点？ | 先例：H10-A 已用「综合实践——生活中的负数」作锚点（`isExcluded` 仅约束 R-REL-02，不约束 R-REL-03） |
| Q4 | 综合实践/复习单元是否继续 `isExcluded` 排除？ | 现设计维持排除；若为连边纳入将改动 `isExcluded`，属红线，须显式授权 |

**裁决后动作（签批才启动，按 H10-A 同流程）**

1. 唯一改动点 `tools/kbl/derive-relations.js`：`CONCEPT_FAMILIES` 追加 `fam_direction`（stages 按裁决结果 3 段或 2 段），`EXTRA_FAMILIES` 同步删除；**不改 `FAMILY_RULES`**；`isExcluded` 按 Q4 裁决物理删除（用户 2026-10-31 显式授权）。
2. `npm run kbl:derive && npm run build:knowledge` → `node tools/kbl/build.js` 重冻 rootHash → `node dev/p25/derive-qt-intent.js`。
3. 断言/文档同步（实测 377→407、42→44、族表 14/11）→ t07 快照 → `npm test` → `npm run verify` → t12 → `node dev/check-all.js` → 追加 `docs/P44/change-log.md`。
4. **禁止**：手改 canonical 边、因名称含「方向/位置」自动改族、为图谱完整强行连边。

**裁决结论（用户 2026-10-31 显式指令，覆盖原「暂缓/维持排除」）**

| # | 问题 | 裁决 |
|---|---|---|
| Q1 | G2「综合实践——方向」是否为 G4「方向+位置」自然前置 | **成立**（用户原话：「G2 方向实践课构成 G4「方向+位置」的自然前置」） |
| Q2 | 跨 G3、G5 直连 G4→G6 是否成立 | **成立**（用户原话：「跨 G3、G5 直连 G4→G6 成立」） |
| Q3 | 是否接受综合实践单元作 R-REL-03 锚点 | **接受**（用户原话：「每一个综合实践均为前一阶段的总结和回顾」） |
| Q4 | 综合实践/复习单元是否继续 `isExcluded` 排除 | **取消排除**（用户原话：「不做排除，按照册、单元做综合总结」）——显式授权覆盖「改 isExcluded 属红线」 |

**执行结果（实测）**

1. `CONCEPT_FAMILIES` 追加 `fam_direction`（3 段：g2 上「综合实践——方向」→ g4 上「综合实践——方向、位置」→ g6 上「确定位置」；ops：`increase_complexity` → `abstract_up`）；`EXTRA_FAMILIES` 同步删除该族。
2. `isExcluded` 函数与 R-REL-02 排除判断**物理删除**（全库零残留）。
3. 重派生实测：Relations **377→407**（R-REL-01 277 / R-REL-02 **58→86** / R-REL-03 **42→44**）；族表 **13/12 → 14/11**；新增链边 `g2-up-u04-k001 → g4-up-u08-k001`（1→6，`increase_complexity`）、`g4-up-u08-k001 → g6-up-u01-k001`（6→10，`abstract_up`）；新增 R-REL-02 28 条（综合实践/复习单元进出）。T-06 族间边 **60→82**（族投影环为既有 primary-family 折叠观察项）；T-07 倒挂仍 **53**。KP/Units/ALLOW 375/98/1566 不变。

**当前状态**：已执行并过门禁。

### 禁止

- 不因图谱追求完整而人为制造前置关系。
- 不因某个 KP 名称包含「方向」「位置」就自动改变概念族。
- 不把图谱关系缺失直接等同于运行时题目生成错误（当前运行时零阻塞，唯一影响点为 `composite-validator` 组合题校验）。
- 跳过评审直接改 `derive-relations.js` 或在 canonical 中手插边。
- ~~改 `isExcluded` 规则强行纳入复习/实践单元。~~ **已被用户 2026-10-31 显式指令覆盖**（H10-C Q4「不做排除」），`isExcluded` 已物理删除；此禁令仅对未获显式授权的场景有效。
