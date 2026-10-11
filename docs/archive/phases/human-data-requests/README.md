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
