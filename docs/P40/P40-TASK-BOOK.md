# P40 任务书 — 单题内容质量深度提升 + 子父知识点包含深化

> **性质：战役任务书（依据用户 2026-10-12 显式指令立项）**
> 指令原文：「创建一个完整的P40维护方案，包含单题内容质量、子父知识点包含深化两大战役。特别是单题质量需要深度提升，达到大模型产出的水准含图文配合、图片使用、竖式、分数等。」
> 上位规则：`.trae/rules/ai-coding-workflow.md`（P28 九步流水线）＞ `docs/01-ARCHITECTURE.md` ＞ `docs/00-BASELINE.md` ＞ P30/P31/P32 运行规则 ＞ 本任务书。冲突时停手提问。
> 准备稿处置：`docs/P40-PREP.md` §一（KBL 派生器声明化重构）折入本战役二阶段一；§二（文件清洗）已由 P39-06~08 执行完毕，无遗留。P40-PREP.md 随本立项归档至 `docs/archive/phases/`。
> **执行状态（更新 2026-10-13，已签收关闭）**：**✅ P40 两战役 + FINAL 全部签收关闭**（依据用户 2026-10-13 指令「签收收口」）。战役一（P40-Q）机判面七项全过（Q-14 §0，清单 `dev/p40/out/q01-review.md` 163 题）；战役二（P40-T）S0-S3 全 14 任务执行完毕，机判全过（`npm test` 864/864、`check-all` 30 PASS / 0 FAIL / 1 SKIP）；P40-FINAL 两役收口完成（`00-BASELINE.md` 数字对齐 + change-log 日志收口 + 地基验收测试补齐 + 陈旧口径统一 + 无效旧记忆清理）。**收口记录 `docs/P40/p40-final-closure.md`（已签收）。**
>
> 已完成（战役一）：①立项与维度（P40-INIT / INIT-A 23 维 / INIT-B 战役二 14 任务 + 8 字段裁决表 §2.2）；②前置 P40-Q-15（R22 无障碍：SVG `<title>` + 对比度 + 6g L2 口径）/ P40-Q-16（死令牌清理 8 个）；③Q-SCAN（P40-Q-01/02）→ Q-SEM（Q-03/04/05/05B）→ Q-GRAPHIC（Q-06/07/08）→ Q-EXPLAIN（Q-09/10/11）→ Q-CONTEXT（Q-12/13）→ Q-ACCEPT（P40-Q-14 验收报告）；④验证工具订正 P40-Q-17（R9 口径）；⑤验收后债务修复 P40-Q-18（D10 分数乘整数约分）/ P40-Q-19（D18 小数尾式竖式）。分阶段证据见 `docs/P40/change-log.md`。
>
> 已完成（战役二）：①S0 地基 T-01（qt-intent 推导声明化，重放逐字节一致）/ T-02（族表 + 排序五规则声明化）/ T-03（T2 副本漂移自检）；②S1 存储 T-04（R-REL-03 38 边 evolution）/ T-05（capability 加 `familyId`/`stageOrder`，rootHash 重算）/ T-06（跨族前置派生投影）；③S2 消费 T-07（族内难度递进校验）/ T-08（解释承上启下三段模板）/ T-09（策略感知 stageOrder 排序）/ T-10（跨族组合校验）/ T-11（族数据就绪透出）；④S3 验收 T-12（回归基线七项快照）/ T-13（docs/02-KBL §4 对账 + 冻结声明 R-FAM-01..04）/ T-14（三主线全链抽查）。证据见 change-log 与 `dev/p40/out/`。
>
> **编号勘误（P40-NUM-FIX）**：Q-18/Q-19 为早期误用 Q-15/Q-16 号的两条债务修复新号，详见 change-log 头部勘误块。
>
> **needs-review 挂账处置（随签收收口，维持现状存档、不自动改数）**：①战役一 Q-14 复现题集 163 题（`dev/p40/out/q01-review.md`）；②战役二 T-07 族内难度倒挂 54 处（`dev/p40/out/t07-family-difficulty.json`，三主线含 13 处）；③T-06 族间投影环（primary-family 折叠产物）；④T-08 解释抽样 20 题（`dev/p40/out/t08-explanation-samples.md`）。详见 `docs/P40/p40-final-closure.md` §6。

---

## 0. 基线口径（立项当日，全程不变）

| 项 | 值 |
|---|---|
| KP / Units / Relations / ALLOW | **375 / 98 / 373 / 1570** |
| Canonical 题型 | 7 类（calc/fill/choice/judge/geometry/classify/apply） |
| Generator | 23（PRODUCTION 20 / COMBINE-ONLY 1 / DORMANT-CARRIER 2） |
| npm test | 762/762 |
| check-all | 31 项：本地 30 PASS / 0 FAIL / 1 SKIP；CI（CHROME_BIN）31/0/0 |
| 泄露门禁 | 6g（AS-18 白名单注册表）继续生效 |
| 图形链 | P38 已清零 107 断链；graphicRole carrier/auxiliary 双轨裁决已定 |

**规模数字冻结铁律**：本战役两线均不得改变 375/98/373/1570。战役二采用**加字段不增边**设计（见 §2.2）保证 Relations 计数不变；战役一不改 mappings/capability 结构。

---

## 1. 战役一 P40-Q · 单题内容质量深度提升

### 1.1 战役定性

**「大模型产出水准」的操作性定义**（确定性可验收，非主观印象）：题目在**五层 23 维**（R1-R23）达到可检验基准。每维标注承载方——已有门禁（存量）、P40 任务（增量）、待裁决（须用户显式指令才开工）：

| 层 | 代号 | 维度 | 达标口径（可检验） | 承载 |
|---|---|---|---|---|
| L1 内容正确 | R7 | 数学正确性 | 答案与算式复算一致 | **已有门禁**（answer-validator/6a 逐题校验）；Q-01 量化基线 |
| L1 | R8 | 单位一致性 | 题面/答案/图形 params 单位一致 | 部分已有（graphic params.unit 字面量 'cm' 裁决）；Q-01 测缺口，缺口>0 立修补任务顺延编号 |
| L1 | R9 | 数值合理性 | 数域不超 capability.numberRange；生活数值合常理 | 已有（numberRange 硬约束）＋ R17 情境真实联动（Q-12） |
| L2 结构完整 | R10 | 可解性 | 条件充分、可解 | **已有门禁**（question-validator structure） |
| L2 | R11 | 答案唯一性 | 闭式答案唯一、无歧义 | 部分已有（answer-validator）；Q-01 量化，缺口>0 立修补任务 |
| L2 | R12 | 干扰项诊断性 | 干扰项来自真实迷思而非随机 | **P40-Q-05** |
| L3 表达规范 | R1 | 语义对齐 | 题目结构体现 requiredConstructs，driftRisk 风险不出现 | **P40-Q-03** |
| L3 | R3 | 图文配合 | 应配图 100% SUCCESS＋数字/单位一致（6g）＋图形承载教学功能非装饰 | **P40-Q-06/07/08** |
| L3 | R4 | 竖式规范 | 课标年级配竖式；进/借位点、小数点对齐、商余数正确；judge 错误竖式 | **P40-Q-06** |
| L3 | R5 | 分数表达 | part-whole/线段图示；分数竖式用于异分母；解析含通分约分 | **P40-Q-07** |
| L3 | R13 | 语言规范性 | 术语/标点/句式合规，题面表述统一 | **P40-Q-09**（用语规范校验规则） |
| L3 | R14 | 表征多样性 | numeric/graphic/段图表征按 KP representations 轮换 | 部分已有（representations 字段）；**P40-Q-08** 验收增列 |
| L4 教学适切 | R2 | 认知匹配 | cognitiveLevel 与题型形态、设问方式匹配 | **P40-Q-04** |
| L4 | R6 | 解析质量 | 四步结构；无素材诚实 null；非题面复述 | **P40-Q-09/10** |
| L4 | R15 | 诊断价值 | 题目能暴露特定错误类型（迷思溯源） | **P40-Q-05**（迷思驱动干扰项即诊断价值） |
| L4 | R16 | 脚手架质量 | 分步支架由解析承载（hint 维持 6g L4 hint=0 红线不变） | **P40-Q-09** |
| L4 | R17 | 情境真实性 | 情境符合生活常识（价格/时间/里程合理） | **P40-Q-12**（语料评审标准增列） |
| L4 | R18 | 年级适配 | 题面字数/词汇按 grade 分档 | **P40-Q-04**（题面模板年级化规则） |
| L5 工程可用 | R19 | 可复现性 | 同输入同输出，byte 级一致 | **已有红线**（P28-05 确定性/16/17/6b/6e 矩阵）；零改动，验收复证 |
| L5 | R20 | 可评分性 | 答案格式机判可评（gradeUserAnswer 可判） | 部分已有（answer-validator＋parentCheck 链）；**P40-Q-09** 增机判格式断言 |
| L5 | R21 | 可编辑性 | 数据可维护、可再生成 | 映射为 T 层数据治理（**P40-T-01/02/04** 声明化承载）；题目级编辑不适用（冻结运行时） |
| L5 | R22 | 无障碍性 | 对比度/读屏兼容 | **P40-Q-15**（用户 2026-10-12 显式指令开工，已实施：SVG `<title>` 可访问名单点注入＋`--toolbar-btn-ghost-ink` 对比度 4.50→5.19 修正；`<title>` 经 6g L2 枚举校验防绕过） |
| L5 | R23 | 跨题一致性 | 同 KP 题面术语/口径一致 | 部分已有（duplicate-validator＋variation 剖面同 KP 不漂移）；Q-14 验收抽查 |

**维度承载纪律**：L1/L2 是门禁属性（binary），目标为**零 FAIL＋抽样 100%**；L3/L4 是质量属性，目标 ≥85%/维；L5 是工程属性，验收复证存量门禁。R8/R11 缺口修补属「待实测裁决项」，未经用户显式指令不得开工（防顺手扩维）；R22 已由用户指令转正为 P40-Q-15 实施。

**实现路径红线**：运行时零 LLM。「大模型水准」通过 **①接通 KBL/T2 已派生语义信号 → ②生成器模板深化 → ③开发期 LLM 辅助语料经人工评审冻结为 T2**（qt-intent-sample.xlsx 回流先例）达成。禁止运行时调用任何生成 API。

**明确的消费缺口**（立项前已诊断，SCAN 阶段逐条取证）：

| # | 缺口 | 现状证据 |
|---|---|---|
| G1 | `qt-intent.assessment.requiredConstructs` 已派生、生成器未消费 | semantic-parameters.js 仅投影 subTopic/numberRange |
| G2 | `cognitiveLevel` 仅作难度加分，不驱动题型形态 | strategy 仅 difficulty 加分路径引用 |
| G3 | `misconception-profiles` 仅 judge 消费，choice/calc 干扰项纯随机 | derive-misconceptions 917 slot vs 消费面 |
| G4 | `svg-calculation.js` 竖式能力（加减乘除/小数/分数竖式）消费覆盖未证实 | 文件头自注「任务：SVG 细化」；生产消费方待盘点 |
| G5 | 解析多为模板化复述，缺分步推理与 KBL definition 引用 | P37-38 修复后仍有概念指认 null 面 |
| G6 | 应用题情境单一（contextDefault: ['standard']） | qt-intent assessment 投影 |

### 1.2 阶段与任务

#### 前置任务（用户指令先于 Q-SCAN 执行）

| 任务 | 内容 | 验收口径 |
|---|---|---|
| **P40-Q-15** | R22 无障碍最小实现：①SVG 可访问名——`svg-registry.render()` 单点注入 `<title>`（role 优先/type 回退的固定枚举映射，不含数值语义；Sanitizer 白名单已放行 title/aria-label 零边界改动）；②对比度 token 核对——22 组实测，修正 `--toolbar-btn-ghost-ink`（4.50→5.19）；③6g L2 口径——`<title>` 从可见文本扫描剥离但逐一校验 ∈ 注册枚举（防绕过，门禁不放松） | 30/0/1 全量门禁；npm test 765/765；6g PASS（649 图渲染）；svg-contract 3 条 P40-Q-15 断言 |

**附带登记**（不顺手修）：`--en-primary/secondary/accent` 令牌族全库零消费者（4.36:1 失败对为死令牌，不影响真实渲染），列入后续死代码清理候选。**→ 已由 P40-Q-16 销账**：用户指令按方案 B 执行，连同同块新证实的零消费令牌共 8 个（cn 色板 3 + en 色板 3 + math-secondary/accent 2）物理删除，注释订正；三方印证（全库 grep 零消费 + JS 零字符串拼接 + 门禁 21/22 PASS）与全量门禁（npm test 765/765、check-all 30/0/1）证据见 change-log P40-Q-16。

#### 阶段 Q-SCAN（只读，无代码改动）

| 任务 | 内容 | 交付物 |
|---|---|---|
| **P40-Q-01** | 质量基线抽样：G1-G6 × 7 题型 × 4 domain 分层抽样 ≥120 题（6a 真实生成），按 §1.1 五层 23 维（R1-R23）逐维评分——可脚本化维度脚本评（R7-R11/R19/R20），其余人工评（R1-R6/R12-R18/R22/R23），产出基线报告 + 复现题集（L3/L4 每维 ≥10 例未达标）+ R8/R11 缺口量化（缺口>0 时列修补任务建议） | `docs/P40/p40-q-baseline.md` + 复现题清单（登记于本任务书附录，不入 docs/ 冗余文件） |
| **P40-Q-02** | 竖式/分数/图文消费盘点：①svg-calculation 全 API 的生产调用图（谁在什么条件下 emit）；②calc 多位数题竖式命中率（应配未配清单）；③分数题图示覆盖率；④graphic 各 subtype 在 1570 行上的分布 | 盘点报告（含 G4 缺口定量结论） |

**过门判据**：23 维基线分数出齐（L1/L2 缺口量化、L3/L4 复现题集、L5 复证结论）；每维有可复现未达标题；G4 消费现状有调用图证据。**用户确认后进阶段二。**

#### 阶段 Q-SEM（接通三信号，纯消费方改动）

| 任务 | 内容 | 验收口径 |
|---|---|---|
| **P40-Q-03** | requiredConstructs 接通：semantic-parameters 投影 `constructs` → plan.semanticParams → 生成器按构念约束题目结构（除法→平均分/包含除语义；fraction→整体/部分表述） | 定向测试断言「读信号发生 + 产出对应变化」双证据；R1 维复现题修复 ≥80% |
| **P40-Q-04** | cognitiveLevel 驱动题型形态：recognize→识别判断类题面（「下列哪个…」），understand→操作理解类，apply/analyze→情境/多步类；改 strategy 题型选择权重与生成器题面模板；题面字数/词汇按 grade 分档（R18 年级适配：G1-G2 短句常用词、G5-G6 复句术语） | R2/R18 复现题修复 ≥80%；1570 零 fake/empty/fallback；题型集合不动 |
| **P40-Q-05** | misconception 驱动干扰项：choice 干扰项从迷思剖面派生（如分数「分子分母各加」迷思），calc/judge 共用迷思素材；每干扰项带迷思溯源（R12 诊断性/R15 诊断价值一体承载） | 干扰项有 misconception 溯源字段；R12/R15 复现题修复 |

#### 阶段 Q-GRAPHIC（竖式/分数/图文深化）

| 任务 | 内容 | 验收口径 |
|---|---|---|
| **P40-Q-06** | 竖式接线：按课标年级规则（G2 起笔算加减、G3 乘除、G4 小数）为 calc 多位数/小数题接通竖式图（graphic descriptor 由 Generator 依 Intent 派生，走既有 graphic-renderer 派发）；judge 错误竖式（errorType 既有能力）作判断材料 | Q-02 盘出的「应配未配」清单清零；描述符 100% SUCCESS；6g 不泄题（竖式不直接显示答案行——所求行按 segment 同款遮蔽口径标 `?`） |
| **P40-Q-07** | 分数表达深化：part-whole/线段图覆盖分数意义类；分数竖式（既有 L347 实现）用于异分母加减；解析补通分/约分步骤 | R5 维复现题修复 ≥80%；同族 NO-DESC 三向分流先例沿用（逐题型核实教学意图，不机械扩修） |
| **P40-Q-08** | 图文配合打磨：图形标注/尺寸/单位与题面呼应；应用题段图（quantity-correspondence）扩覆盖；表征轮换（R14：同 KP 在 representations 允许面内 numeric/graphic 交替）；无图题复核（完全文本题做无图处理，不硬配） | R3/R14 复现题修复 ≥80%；无 `catch → ''`；UNSUPPORTED 有显式 reason + graphicOrInstruction 兜底 |

#### 阶段 Q-EXPLAIN（解析升级）

| 任务 | 内容 | 验收口径 |
|---|---|---|
| **P40-Q-09** | 四步解析模板：apply「题意→列式→计算→答」、geometry「图形特征→公式→代入」、judge「判断依据引用 KP definition」；calc 保持逐步演算；无素材诚实 null 不放宽；题面/解析用语规范校验（R13：术语/标点/句式规则表）；答案机判格式断言（R20：gradeUserAnswer 可判定）；分步支架由解析承载（R16；hint 维持 6g L4 hint=0 红线不变） | 各题型抽样 20 题人工评审通过率 ≥90%；禁题面复述（相似度门禁）；R13/R20 规则有测试断言 |
| **P40-Q-10** | quality-scorer 增 `explanationQuality` 维（权重 0.10，六维权重等比下调）：非空 + 非复述 + 含分步标记 + 答案一致 | 新维度有测试断言；npm test 全绿；评分分布进 P40-Q-14 验收对比 |
| **P40-Q-11** | 解析引用 KBL definition：explanation 可引用 KP canonical definition（经 intentFor/knowledge 只读口），建立「知识点定义→本题应用」连接 | 引用文本与 definition 逐字一致（防编造）；无新增数据写入 |

#### 阶段 Q-CONTEXT（情境语料，开发期 LLM 辅助）

| 任务 | 内容 | 验收口径 |
|---|---|---|
| **P40-Q-12** | 情境语料库 T2 化：`kbl/teaching/context-library.json`——按 domain×grade 的情境模板（购物/行程/工程/植树/统计），**开发期 LLM 辅助起草 → 人工评审 → 冻结 JSON**（qt-intent-sample.xlsx 回流先例）；评审标准含情境真实性（R17：价格/时间/里程符合生活常识，与 R9 数值合理性联动）；派生器挂现有链（禁第二派生链） | 每条语料有溯源标记（reviewStatus）；可由脚本再生；needs-review 缺口有账；R17 评审记录留档 |
| **P40-Q-13** | 生成器消费：application/money 等按 KP capability×grade 选取情境模板，数量关系与情境类型匹配校验（行程题必须是路程语义） | 情境多样性可量化（模板命中率）；6g 白名单按新增 token 增补后通过 |

#### 阶段 Q-ACCEPT

| 任务 | 内容 | 验收口径 |
|---|---|---|
| **P40-Q-14** | 质量验收：①复现题集全量重评 vs Q-01 基线（23 维逐维提升量化）；②G1-G6×7题型 抽样 140 题人工评审（L1/L2 抽样 100%；L3/L4 达标率 ≥85% 每维）；③R23 跨题一致性抽查（同 KP 术语/口径）；④check-all 30/0/1；⑤6a 1570 重跑零 fake；⑥6g 通过；⑦受影响矩阵按 §3 重冻 | 23 维提升对比表 + 人工评审记录 + 全量门禁证据。**用户签收后战役一关闭。** |

### 1.3 战役一局部门禁

- 定向：`node --test tests/generation/ tests/orchestration/ tests/presentation/`（按改动域选取）
- 图形：`tests/presentation/svg-contract*.test.js`、`graphic-renderer.test.js`、6g（`dev/p32/check-answer-leak.js`）
- 生成：`check-allow-generation.js`（6a）、`check-educational-generation.js`（7）、golden（8）
- 全量：`npm test` → `node dev/check-all.js`（30/0/1）
- 任何题面/答案文案变化 → `derive-variation-profiles.js` + `derive-misconceptions.js` 重跑 + 6b/6e 矩阵重冻（§3）

---

## 2. 战役二 P40-T · 子父知识点包含深化

### 2.1 问题定义

G1→G6 同一概念的低年级节点到高年级节点存在**包含深化**关系（5以内加法 ⊂ 20以内加法 ⊂ … ⊂ 分数加法），但现状：
- `derive-relations.js` R-REL-03（38 条跨册/跨年级概念主干链边）与 R-REL-01/02（335 条册内顺序边）**统一标为 prerequisite**，「同一概念深化」语义丢失；
- 消费方（requiredRelations、难度、解释）无法区分「不同概念的前置」与「同一概念的深化阶段」；
- 深化链无显式概念族归属（Concept 层缺位）。

### 2.2 设计裁决：加字段、不增边、不换类型（保基线核心）

**核心决策**：不把 R-REL-03 边改标为 `extension`（会改变 prerequisite 集合 → qt-intent requiredRules 全线变动 → 1570 重冻），而是：

1. **R-REL-03 的 38 条边追加 `evolution` 属性**：`{ familyId, stageOrder, op }`——op 取 `extend_number/increase_complexity/abstract_up/inverse`（机械判定规则在派生器内声明化），边数不变 373，prerequisite 语义保留，下游零破坏；
2. **capability.json 每行追加 `familyId`**（稳定族 ID，如 `fam_add/fam_fraction/fam_area`；族显示名只存声明化族表，不做第二 SSOT）——Concept 层以字段形式落地，不新建文件/表；
3. `knowledge-contract.js` 的 `RELATION_TYPES` 已含 `extension/parent/child` 枚举（**无需改契约**）；`evolution` 属性与 `familyId` 随 `relationsFor`/capability 既有返回自然透出（**无需扩 PUBLIC_API**）。

**字段裁决表**（对外部评审提案 8 字段的收编结论——T1 纪律：派生数据不落盘、一个语义一个 SSOT）：

| 提案字段 | 裁决 | 理由 |
|---|---|---|
| `familyId` | **采纳** | 稳定键；族显示名（familyName）只存声明化族表，逐边冗余违反单 SSOT |
| `stageOrder` / `op` | **采纳**（原案） | 深化语义核心 |
| `stageKey` | 不采纳 | 冗余标识——kid 即稳定键，第二标识必漂移 |
| `gradeFrom/gradeTo` | 不落盘 | 派生数据：源/目标 capability.grade 现算，落盘必与 capability 漂移 |
| `difficultyDelta` | 不落盘 | 派生数据：seedDifficulty 差值由 T-07 校验器现算 |
| `prereqFamily[]` | 不落盘 | 派生数据：跨族前置 = 既有 373 prerequisite 边中 source.familyId≠target.familyId 的聚合投影（T-06 派生校验），零新增存储 |
| `confidence` | 不采纳 | 本链为确定性规则派生（非 LLM 生成），无置信度语义；LLM 先例仅限开发期挂账场景 |
| `evidence`（独立字段） | 不落盘 | 派生数据：规则 ID（R-REL-03）+ canonical 既有 book/volume/unit 字段即完整证据链 |
| `frozen` | 不采纳 | T1 全量冻结语义由 manifest rootHash 承载；无「未冻结可写」状态 |

**红线映射**：不新建五层演化图系统（P38 会话已裁决该方案违反「不新建架构」红线，本战役只吸收其概念主线的最小可用子集）；图算法（环检测/年级递增校验）以派生器内联断言实现，不引入 NetworkX/Python；族内序为**确定性规则派生**（排序五规则决策表），不引入 AI 排序提示词（保确定性，禁第二事实源）。

### 2.3 阶段与任务（S0-S3，14 任务，每阶段带出口判据）

结构维度 E1-E8 映射：E1 族定义完备性→T-02；E2 stageOrder 全序性→T-02/T-04；E3 跨族前置无环→T-04/T-06；E4 evolution 字段完整性→T-04；E5 消费面覆盖度→S2（六面见下）；E6 回归基线→T-12；E7 版本迁移→T-13（挂账）；E8 冻结边界→T-13。

#### S0 地基（派生器声明化 + 族/序规则 = P40-PREP §一折入）

| 任务 | 内容 | 出口判据 |
|---|---|---|
| **P40-T-01** | `derive-qt-intent.js` 推导规则收敛为声明式决策表（同文件内重组织，行为等价） | 重跑输出与改前**逐字节一致**；needs-review 保持 0 |
| **P40-T-02** | `derive-relations.js` R-REL-01/02/03 族表声明化 + **族定义三规则**（E1：①同运算/概念主线归族；②族内 stageOrder 全序无并列；③一 KP 一主族——副族 secondaryFamilies 挂账待 SCAN 证实需要，不预设）+ **stageOrder 排序五规则**（E2 决策表：grade → volume(up<down) → unit_no → 教材行序(knowledgeNo)；选学/拓展排核心之后，允许小数序）固化（同文件内，产出不变） | 373 条逐条不变；重放 hash 全等；族表/排序规则以命名常量存在（可独立审计） |
| **P40-T-03** | T2 副本重冻自检：`kbl:rebuild` 链尾 diff `kbl/teaching` ↔ `shared/knowledge/teaching`，漂移即 FAIL（挂现有 build.js 步骤内，不新建门禁文件） | 人为制造副本漂移可被拦截 FAIL；恢复正常后 PASS |

#### S1 存储（evolution 落边 + 族回填 + 跨族投影）

| 任务 | 内容 | 出口判据 |
|---|---|---|
| **P40-T-04** | R-REL-03 38 边追加 `evolution{familyId, stageOrder, op}`：op 机械判定（数域关键词→extend_number；步骤/括号→increase_complexity；认数→计算→abstract_up；加减/乘除对→inverse）；派生器内联校验：同族 stageOrder 严格递增（无重复 E2/无倒挂）、年级不倒挂、跨族前置无环（E3，按 §2.2 字段裁决表） | 边数仍 373；evolution 字段完整率 38/38（E4）；同族全序断言通过；重跑确定性 hash 一致 |
| **P40-T-05** | capability 加 `familyId`（375/375 回填）+ 全链重建：`kbl:derive` → `emit-canonical` → `build` → `build:knowledge`；rootHash 重算回填 | 375/98/**373**/1570 四数不变；familyId 覆盖率 100%；manifest rootHash 合法新值且重放稳定；T3 镜像同步 |
| **P40-T-06** | 跨族前置派生投影（**纯校验不落盘**）：从既有 373 prerequisite 边聚合族间关系（source.familyId≠target.familyId），校验族间无环 + 年级不倒挂 | 族间关系图 + 无环/倒挂校验报告（违规挂 needs-review 人工，不自动改数）；零新增产物文件 |

#### S2 消费（三面扩六面，双证据原则）

| 任务 | 内容 | 出口判据 |
|---|---|---|
| **P40-T-07** | 消费① 难度递进校验：difficulty-integrity-validator 增断言——同 familyId 内 stageOrder 靠后的 KP，seedDifficulty ≥ 前序（difficultyDelta 校验时现算，不落盘）；倒挂登记 needs-review 挂人工，不自动改数 | 校验器上线 + 现网 375 行扫描报告 |
| **P40-T-08** | 消费② 解释承上启下：采纳三段模板——`upstream`「我们之前学过〈前序名〉…」/ `bridge`「把〈前序名〉和〈本课名〉结合起来…」/ `current`；引用文本**逐字来自 canonical**（前序 KP name + definition 要点），禁编造；无前序不硬加 | 引用逐字比对通过；抽样 20 题人工评审；6g 复跑通过 |
| **P40-T-09** | 消费③ 策略感知（含「防跳阶出题」）：learner 模式巩固/拓展序列按 stageOrder 排序（只读消费；KP/题型/数量/难度决策权仍归 Strategy 既有链，Z1-Z4 不夺权） | 定向测试断言读信号 + 序列有序；Z1-Z4 不夺权复核 |
| **P40-T-10** | 消费④ 跨族组合校验：composite 生成器组合 KP 时校验族间前置已满足（用既有 prerequisite 边 + T-06 投影口径，零新数据） | 定向测试：含未满足跨族前置的组合被拒；现网组合题扫描报告 |
| **P40-T-11** | 消费⑤⑥ 数据就绪透出：familyId/stageOrder 经 knowledge-contract 既有口（capability/relationsFor 返回）只读可及——为掌握度按族聚合（⑤）与错答族归因（⑦）提供数据通道；**UI 展示不实施挂账**（P31 冻结二级页面） | 契约测试：既有公开口返回含 familyId/evolution；无新 PUBLIC_API；UI 挂账登记 |

#### S3 验收（回归基线 + 冻结边界）

| 任务 | 内容 | 出口判据 |
|---|---|---|
| **P40-T-12** | 回归基线快照（E6）：①38 边 evolution 覆盖率 100%；②同族 stageOrder 无重复无倒挂；③familyId 375/375；④跨族前置无环；⑤qt-intent 重放逐字节一致（1570 零重冻证明）；⑥6a 复跑零 fake；⑦快照归档为本战役验收证据 | 七项全过 + 快照留档；**基线即验收标准**（非仅当前量） |
| **P40-T-13** | 冻结边界与文档对账（E7/E8）：①`docs/02-KBL.md` §4 白名单/产物↔派生器↔消费方对账表补全（含 P33 后新增脚本）；②族表/排序规则/evolution 口径冻结声明（规则 ID 固化，变更须走派生器重跑+重冻流程）；③版本迁移挂账说明（E7：多版本 Excel 共存属基线扩容另立项，本战役不做） | check-doc-consistency PASS；与 check-kbl-ai-boundary 白名单对账一致；冻结声明入档 |
| **P40-T-14** | 验收：①加法/分数/面积三条主线 G1-G6 全链抽查（familyId 一致、stageOrder 递增、难度不倒挂、解释衔接、组合合规）；②全量门禁 | 三主线链路图 + 全量证据。**用户签收后战役二关闭。** |

### 2.4 战役二局部门禁

- `npm run verify`（M0 8 步）、`node dev/check-kbl-uniqueness.js`、`node dev/p28/check-kbl-ai-boundary.js`、`node dev/p30/check-kbl-lineage.js`
- 重放确定性：`kbl:rebuild` 前后产物 SHA256 对账（T-DECL 要求全等；T-EDGE 后为合法新 hash，二次重跑须稳定）
- 6a/6b/6e：T-EDGE 后实跑证明 1570 行产出不变（capability 加字段不改生成输入语义——semanticParams 消费面核对）
- composite/组合：`tests/generation/` composite 相关定向测试（T-10 跨族组合校验）
- 全量：`npm test` → `node dev/check-all.js`（30/0/1）

---

## 3. 受影响资产与改后动作（两战役通用）

| 触发 | 必做 |
|---|---|
| 改 `shared/generator|strategy|presentation` 生产代码 | 重建对应 bundle（strategy/presentation），过 16/17 确定性；practice.html 脚本清单同步 |
| 改题面/答案/解析文案 | 重跑 `derive-variation-profiles.js` + `derive-misconceptions.js`；6b/6e 矩阵若行产出变化 → `check-generation-matrix-frozen --write` 重冻 + GENERATOR-MATRIX 重生成 |
| 改 T1 派生数据/映射 | `kbl:derive` 全链 + `build:knowledge` + 两 manifest 同步；375/98/373/1570 对账 |
| 改 T2 文件 | 证明可由派生器再生；T-03 链尾自检通过 |
| SVG 消费面扩展（竖式/分数） | `tests/presentation/svg-contract*.test.js` 契约断言补充；**不改 GraphicDescriptor 结构、不改 Sanitizer 边界** |
| 任何修改 | 定向测试 → `npm test` → `node dev/check-all.js` → `docs/P40/change-log.md` 追加六字段 |

---

## 4. 执行顺序与依赖

```
P40-INIT（编号启用 + P40-PREP 归档 + 基线对账）
   ↓
战役一：Q-SCAN（01,02）─门禁+用户确认─→ Q-SEM（03-05）→ Q-GRAPHIC（06-08）
   → Q-EXPLAIN（09-11）→ Q-CONTEXT（12,13）→ Q-ACCEPT（14）─用户签收─
   ↓
战役二：S0 地基（T-01~03，声明化+族/序规则）─门禁─→ S1 存储（T-04~06，evolution/族回填/跨族投影）─门禁─→ S2 消费（T-07~11，六面）→ S3 验收（T-12~14，回归基线/冻结边界）─用户签收─
   ↓
P40-FINAL（两役收口 + 00-BASELINE 更新 + 日志收口 + 全量 30/0/1）
```

- 战役一/二相互独立，可经用户指令调序或穿插（如 T-DECL 先行做地基）；默认按上序。
- 每阶段结束：输出门禁证据 → **用户确认** → 才开下一阶段（P28 §8 / P31 §4 既有纪律）。
- 一任务一交付：修完即走门禁，禁止借任务展开全项目扫描（反模式禁令继续生效）。

## 5. P40 红线（追加于 P28/P30/P31/P32 全部既有红线之上）

1. 运行时引入 LLM/网络生成；「大模型水准」必须以确定性产出达成（开发期 LLM 辅助语料须经人工评审冻结，留 reviewStatus 溯源）。
2. 新建五层演化图/Concept-Stage-Combo 独立表/第二知识系统/新顶层目录；P38 会话已裁决的五层方案仅吸收其「概念主线」最小子集。
3. 改变 375/98/373/1570 规模数字（T-EDGE 加字段设计保证；若执行中发现必须变数 → 停手，挂人工扩容立项）。
4. 把 R-REL-03 边改标/删除导致 prerequisite 集合变化（禁止 1570 连带重冻；深化语义只经 `evolution` 附加属性表达）。
5. 竖式/分数走新渲染器或第二 SVG 系统（必须复用 svg-calculation 既有实现 + 既有注册派发机制）。
6. 竖式/图示直接或间接泄露答案（所求行/所求段按既有 `?` 遮蔽口径；6g 逐 token 把关）。
7. 解析编造：无素材必须诚实 null；引用 KBL definition 必须逐字；禁题面复述假冒解析。
8. 为通过门禁放宽 Validator/6g 标准；为测试 PASS 删用例或改标准。
9. AI 手编 T2 教学语义 JSON（情境语料库必须走派生链 + 人工评审回流）。
10. 跳过阶段门禁或未经用户确认进入下一阶段；改完不重建 bundle/不重冻/不记日志即交付。

唯一允许偏离：用户显式指令覆盖某条，并在 change-log 的 reason 中留存指令依据。

## 6. 验收矩阵（P40-FINAL 总口径）

| 验收面 | 口径 |
|---|---|
| 五层 23 维质量 | Q-01 基线 vs Q-14 复评：R1-R23 逐维提升量化。L1/L2（R7-R11）零 FAIL＋抽样 100%；L3/L4（R1-R6/R12-R18）达标率 ≥85%/维；L5（R19-R23）工程复证（R19 确定性 hash、R20 机判断言、R21 由 T-DECL 交付、R23 一致性抽查） |
| 图文 | 应配图 100% SUCCESS；竖式应配清单清零；6g 全程 PASS |
| 主线深化 | 加法/分数/面积三链：familyId 一致、stageOrder 递增、难度不倒挂、解释可衔接 |
| 族结构 E1-E8 | E1 族定义三规则入档；E2 全序无重复倒挂；E3 跨族无环；E4 evolution 38/38；E5 消费六面接通（①~④生产消费＋⑤⑥数据就绪）；E6 回归基线七项全过；E7 版本迁移挂账入档；E8 冻结边界声明入档 |
| 基线 | 375/98/373/1570 不变；manifest rootHash 合法更新且重放稳定 |
| 门禁 | npm test 762+（新增用例全绿）；check-all 30/0/1（CI 31/0/0）；6a 1570 零 fake |
| 纪律 | change-log 六字段完整；阶段门禁逐级用户确认记录 |

---

## 附录 A · P40-Q-01 复现题登记（2026-10-12 基线）

> 编号 #i 指 `dev/p40/out/q01-evidence.json` 数组下标（含 kp/qt/prompt/答案/解析/图形全量证据，seed 可复跑）。完整分析见 `docs/P40/p40-q-baseline.md`。

| 维度 | #i | 缺陷一句话 |
|---|---|---|
| R1/R2 | #8、#85、#143、#161 | choice 空壳题干「下面哪个选项正确？（ ）」不承载设问，干扰项失去诊断性 |
| R1/R11 | #88 | fill 模板分支错位：问「80 + 2 = ____」（应答 82），答案给「十位」→ **已裁决并入 Q-SEM** |
| R1 | #110 | calc 问 2×6 得数，教学构念是因数对，答案语义偏移 |
| R3 | #66 | 题问长方形面积，配图 geometry/triangle——图文错配 |
| R3 | #125 | 同 KP（视图推算）geometry 题型无图，fill/choice 有 view-cards |
| R3 | #90、#96 | 轴对称补全/对应点格数题配素长方形（无格网、对称轴表达） |
| R3 | #120、#126 | 旋转设计题配静态平行四边形/长方形，不表达旋转过程 |
| R4 | Q-02 §5.1 | 竖式应配 61 行命中 0 行（g2 1/g3 9/g4 18/g5 17/g6 16）；6 API 零生产消费 |
| R5 | #151 | 2/4 × 3 答 6/4 未化简；分数题 127 行配图率 12.6% |
| R6 | #2、#5、#24、#107、#110、#116、#137、#140、#146、#162 | 题面复述类解析（模板固定句式「…，答案是 X」） |
| R6 | #142 | 解析截断：「等于乘这个分数的倒数：」后缺 5/3×4/3=20/9 演算 |
| R8 | #19 | 5角−5角 单位口径混用（题面角、答案「0分」）→ **已裁决并入 Q-09** |
| R9 | #1 | G1 应用题 91+26=117 超 numMax=100（真实结果域越界）→ **已裁决并入 Q-SEM** |
| R9 | #138、#141、#144、#147 | ~~G6 百分数基数 1000–1500 与 max=100 矛盾~~ **伪影销账（P40-Q-17）**：max 为难度等级非数值上限（P30-14 双轨），numMax=null 即无约束，基数 1500 合法；R9 脚本判定口径已按方案 A 订正 |
| R13 | #162 | 分类 fill 题语序完全错乱（「才能保证有2个球颜色相同，…绿），蓝，黄，有4种颜色的球（红，____」） |
| R13 | #131 | 天平找次品 fill 条件后置语序错乱 |
| R13 | #140 | 「0 − 5 = ，」悬垂标点 |
| R15 | #7、#28 | 干扰项为邻近数/运算混淆雏形，非迷思剖面驱动（G3 实证） |
| R18 | #17 | G1 judge 用「对角线相等」考长方形特征（超纲术语） |
| R23 | #121/123 vs #125 | 同 KP 图形配置不一致（有图/无图反例） |
