# 受控生成链路改进 · AI 编程执行计划（设计文档）

> 目标：解决「快速/教师模式 → 题目类型/知识点选项 → 生成页 → 受控生成对应数量与对应知识点题目」链路的五个断点（P1–P5），遵循**知识点驱动—螺旋上升**宗旨。
> 范围：仅设计，不执行。本文档按项目实际（Frozen Core 冻结矩阵 / 门禁 / 四大架构）给出**AI 编程可逐条执行**的步骤。
> 姊妹文档：`docs/SPIRAL_IMPROVEMENT_PLAN.md`（螺旋能力建设）——分工见 §5，二者互引、不重复实现。

---

## 0. 链路断点回顾（五断点）

| # | 断点 | 根因位置 |
|---|---|---|
| P1 | **直发 multi-kp 数量爆炸**：每 KP 用总 count 独立规划、合并无裁剪 → 总题量 = KPs×count | generation-engine.js L128-148 / api.js L116-126（**双实现**） |
| P2 | **必选知识点静默吞题**：单 KP plan 失败进 failedPlans，不报错 → 必选 KP 可能 0 题落地 | runPlans L260-262 / api.js L168-176 |
| P3 | **螺旋上升缺失**：全链无 prerequisites 消费，无前置门、无同链跨年级递进 | 全链路 |
| P4 | **编排低效**：N 个 KP = N 次完整 new PracticeSession + start()，无共享计划/缓存 | practice-bridge.js runOrchestrated |
| P5 | **必选不强约束**：无逐题 KP 命中校验、失败无归因 | 生成层/结果层 |

---

## 1. 项目实际：冻结矩阵（决定改动路径）

已对照 `dev/frozen-core-baseline.json` 逐一核实：

| 目标文件 | 冻结？ | 所属层（layers.json） | 改动路径 |
|---|---|---|---|
| `shared/practice-bridge.js` | **否** | SERVICE/ASSOCIATION | ✅ 可直接改 |
| `shared/generation/dto.js` | **否** | GENERATION/SERVICE_IFACE | ✅ 可直接改 |
| `shared/generation/api.js` | **否** | GENERATION/SERVICE_IFACE | ✅ 可直接改 |
| `shared/generation-config.js` | **否** | SERVICE/CATALOG | ✅ 可直接改 |
| `practice.html` / `select.html` | **否** | UI | ✅ 可直接改 |
| `shared/generation-engine.js` | **是**（M7） | GENERATION/CORE_ENGINE | 需 §6.5 授权 |
| `shared/practice-session.js` | **是**（M7） | GENERATION/CORE_ENGINE | 需授权 |
| `shared/strategy/strategy-engine.js` | **是**（M3） | GENERATION/…（跨层登记） | 需授权 |
| `shared/validator/validation-pipeline.js` | **是**（M5） | SERVICE/VALIDATOR | 需授权（本次可不改） |
| `shared/learner/learner-model.js` | **是**（M6） | SERVICE/LEARNER | 只读（get() 查询），不改 |
| `shared/knowledge-bank.js` 等 | **是**（M1） | KNOWLEDGE | 不改（新增数据文件走新文件） |
| **新增文件** `shared/curriculum-planner.js` 等 | **否**（新文件） | 需登记 layers.json | ✅ 可直接新增 |

**关键结论**：约 **80% 改进可在 FREE 层完成**（practice-bridge / dto / api / 页面 / 新增文件），仅 P1 的彻底修复（generation-engine 配额消费）与 spiral 策略收敛需 Frozen Core 授权。执行顺序按「先 free 后 frozen」编排。

**双实现发现**：multi-kp 数量逻辑在 `generation-engine.js` 与 `generation/api.js` 各有一份（均用总 count）——**两处必须同改**，漏一处仍有爆炸路径。

---

## 2. 总体阶段

```
SP0 前置门：Frozen Core 变更申请（只卡 SP3，不阻塞 SP1/SP2/SP4）
 ├→ SP1 受控兜底（全 free）      ：数量爆炸拦截 + 编排结果硬校验 + KP 命中校验
 ├→ SP2 必选硬约束（全 free）    ：UI 必选锁定 + 题量守恒审计 + 失败归因展示
 ├→ SP3 生成层配额下沉（冻结授权）：dto 配额字段 + engine/api 消费配额 + 不再静默
 ├→ SP4 螺旋接入（全 free+新增） ：前置门 + 同链上升档位（依赖 SPIRAL P0/P1）
 └→ SP5 收尾                     ：全量门禁 + 文档 + 浏览器验收
```

**硬约束**：SP0 未批准时不做 SP3（SP1 free 层兜底已覆盖主路径，可先行）；SP4 若 SPIRAL P1 已完成桥接层接入则跳过重复项（见 §5 分工表）。

---

## 3. 详细步骤

### SP1 受控兜底（全 free，先做）

**SP1.1 practice-bridge.js：直发 multi-kp 强制带配额**（消除数量爆炸主路径）
- 位置：`ControlService.plan` L152（`orchestrated = hasPerKpAllocation(kp) && !profile.adaptive`）。
- 改动：当 `mode==='multi-kp'`、`knowledgePoints.length>=2`、无配额且非 adaptive 时，**先按 KP 均分构造 kpAllocation**（`total=count`，每 KP `floor+余数分配`，复用 kpRatio 同款最大剩余法），再走编排。
- 效果：多 KP 生成从"直发爆炸"收敛为"编排受控"，**不依赖冻结层修复即可堵住主路径**。

**SP1.2 编排结果硬校验 + 归因**（practice-bridge.js `runOrchestrated`）
- 每个 partition `start()` 完成后校验 `实际返回题数 === part.count`；不足 → 在反馈中报 `{ code:'E_KP_SHORT', kp:part.kp, name, expected, actual }`，不再静默合并。
- 提示文案含 KP 名称与原因（生成器缺失/超限/验证不过）。

**SP1.3 KP 命中校验钩子**（practice-bridge.js 新增函数）
- 对合并后每题断言 `sq.knowledgePoint (或 knowledgePointId) ∈ 用户所选集`；不命中即拦截并归因。
- 作用：落实"必选知识点必须有具体题例落地、且可逐题验证"。

**SP1.4 generation/api.js multi-kp 分支修复**（free 文件）
- 位置：api.js L116-126（`count: request.count`）。
- 改动：与 SP3.2 同策略——消费 `request.kpAllocation`；无配额时按 KP 数均分 count（API 层先落地，engine 层待授权）。

**门禁**：`npm run verify:layers` · `verify-pages` · `verify:practice-page` · `node dev/check-p6-render-print.js` · `npm run test:node`。
**验收**：教师模式多 KP 各配额题数精确；无配额多 KP 不再出现 KPs×count。

### SP2 必选硬约束（全 free）

**SP2.1 practice.html：教师模式必选锁定**
- 知识点数量填空旁加"必选🔒"切换（默认选中即必选）；必选 KP 失败时按 SP1.2 报错展示，不静默。

**SP2.2 practice.html：生成结果题量守恒审计展示**
- 生成后展示"各知识点实际题数"（源自每题 knowledgePoint），与配额/期望对照；缺口高亮。

**SP2.3 select.html：快速模式知识点粒度开关**（可选增强）
- 快速模式题型卡下增加"展开知识点"折叠，允许从题型下精确勾选 KP（复用教师模式右栏 kp-chip 组件逻辑）。

**门禁**：`verify-pages` · `verify:practice-page` · `test:node`。
**验收**：必选 KP 0 题场景有明确报错与归因；快速模式可精确到知识点。

### SP3 生成层配额下沉（冻结授权，需 SP0 批准）

**SP3.1 dto.js（free）：request 增配额字段**
- `GenerationRequest` 增 `kpAllocation?: { total:number, strategy:string, kps:[{id,name,count,weight}] }`（语义对齐 bridge 的 state.kpAllocation）。

**SP3.2 generation-engine.js（FROZEN）：build() 消费配额**
- multi-kp 分支（L128-148）：有 `request.kpAllocation` → 按配额拆 plan（每 plan `count=配额`）；无配额 → 按 KP 均分（与 SP1.4 对齐）。
- `runPlans`（L237-267）：合并前做**总题量守恒校验**（Σ plan.count === 期望）；`failedPlans` 改为**结构化返回**（含 kpId/name/error），由调用方决定失败语义（不再静默吞）。

**SP3.3 practice-session.js（FROZEN）：透传配额**
- `_buildGenerationRequest`（L298-308）增 `req.kpAllocation = this.config.kpAllocation`。

**SP3.4 api.js（free）与 engine 对齐**：API 层与 engine 层共用同一配额解析函数（可抽到 dto/api 层，避免第三次双实现）。

**门禁**：`npm run build:strategy` · `verify:m3` · `verify:m4` · `verify:frozen-core` · `verify:golden` · `verify:snapshot` · `npm test` · **重锚基线** `node dev/check-frozen-core.js --baseline`。
**验收**：多 KP 生成走一次 build（多 plan）而非 N 次会话；失败 KP 有明确归因；golden/snapshot 通过。

### SP4 螺旋接入（全 free + 新增，对接 SPIRAL）

> 依赖：SPIRAL P0（knowledge-chain 链映射）、SPIRAL P1（CurriculumPlanner + 桥接层接入）。**若 SPIRAL P1 已完成桥接层接入，本计划 SP4.1/SP4.2 跳过，只做 SP4.3/SP4.4 补缺。**

**SP4.1 新增 shared/curriculum-planner.js**（若 SPIRAL 未建）
- 职责：链解析 + **前置门**（读 `learner-model.get(state, kpId).mastery`，未达标 KP → 标记"需先练前置"）+ 路径规划。
- 只读 learner-model（不改 M6）；登记 `architecture/layers.json` → SERVICE 新组（如 `SERVICE/CURRICULUM`）。

**SP4.2 practice-bridge.js：plan() 前插前置门**
- 生成前对所选 KP 调用 curriculum-planner：存在未达标前置 → 反馈 `{ code:'E_PREREQ', kps:[...] }`，UI 提示"建议先练 X"（可一键纳入前置 KP）。

**SP4.3 select.html：教师模式"同链上升"档位**
- 消费 knowledge-chain：所选 KP 所在链的更高年级节点，提供"上升档位"按钮（练完当前节点解锁下一档），体现 g1→g2→g4→g5→g6 同技能链递进。

**SP4.4 practice.html：前置门提示 UI**
- 接收 SP4.2 反馈，展示"该知识点前置未达标"横幅 + "先练前置 / 仍要生成"二选一。

**登记与门禁**：新增文件登记 layers.json（curriculum-planner → SERVICE；knowledge-chain 若由 SPIRAL 建则归 KNOWLEDGE）→ `verify:layers` · `verify:m1:kb`（若不动知识库则跳过）· `verify-pages` · `test:node`。
**验收**：前置未达标有提示与一键纳入；同链上升档位可选；无学习数据时行为不变（前置门空转）。

### SP5 收尾

| 步骤 | 动作 |
|---|---|
| SP5.1 | 全量门禁：`npm test` + `verify:layers` + `verify:frozen-core` + `verify:m3` + `verify:m4` + `verify-pages` + `verify:practice-page` 全绿 |
| SP5.2 | 文档：`docs/DEV_LOG.md` 记录（Bug 编号/根因/修复点/验证）；必要时更新 `docs/ARCHITECTURE_LAYERS.md`（新增文件/组） |
| SP5.3 | 浏览器验收：快速/教师模式全流程；必选 KP 失败场景（报错+归因）；前置门提示场景；同链上升档位 |
| SP5.4 | 回滚预案复核：SP1–SP4 各自独立 commit，可逐阶段 revert |

---

## 4. 与 SPIRAL_IMPROVEMENT_PLAN 的分工（避免重复实现）

| 能力 | 归属计划 | 说明 |
|---|---|---|
| knowledge-chain 链映射建模 | SPIRAL P0 | 本计划只消费，不重复建 |
| CurriculumPlanner 路径规划 | SPIRAL P1 | 本计划 SP4.1 仅当 SPIRAL 未建才补建 |
| 桥接层等价接入 | SPIRAL P1 | 本计划 SP4.2 与其是同一接入点，已完成则跳过 |
| spiral-mode 策略单源/年级锚点 | SPIRAL P2 | 本计划不涉及 |
| 效率优化（KP 索引/增量 IO） | SPIRAL P3 | 本计划不涉及 |
| **受控数量（配额兜底+下沉）** | **本计划 SP1/SP3** | SPIRAL 不覆盖 |
| **必选硬约束/失败归因** | **本计划 SP2/SP1.2** | SPIRAL 不覆盖 |
| **前置门 UI/同链上升档位** | **本计划 SP4.3/SP4.4** | SPIRAL 未覆盖的 UI 补缺 |

---

## 5. 风险登记

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| R1 | multi-kp 双实现（engine+api）漏改其一仍有爆炸 | 高 | SP1.4 先修 api（free），SP3.2 修 engine，SP3.4 抽公共函数消除第三份 |
| R2 | 强制编排改变现有单次直发行为 | 中 | SP1.1 仅对「≥2 KP 无配额」生效，单 KP/adaptive 路径不变；golden/snapshot 兜底 |
| R3 | 必选硬校验使生成器缺失的 KP 直接报错（用户可见变化） | 中 | 报错文案含 KP 名+原因+可选「忽略继续」；属预期行为（不再静默） |
| R4 | SP4 与 SPIRAL 重复实现 | 中 | 按 §4 分工表互引，SP4.1/SP4.2 条件式跳过 |
| R5 | 冻结授权未获批 | 低 | SP3 延后；SP1 free 层兜底已堵住主爆炸路径 |
| R6 | 新增文件未登记 layers.json → verify:layers 红 | 低 | 新增即登记（SP4.1/新增文件步骤内含登记项） |

---

## 6. 门禁速查（package.json 实测）

| 命令 | 用途 | 阶段 |
|---|---|---|
| `npm run verify:layers` | 分层登记门禁（新增文件必跑） | SP1/SP4 |
| `npm run verify:practice-page` / `verify-pages` | 页面职责门禁 | SP1/SP2 |
| `node dev/check-p6-render-print.js` | P6 渲染/打印统一门禁 | SP1 |
| `npm run verify:frozen-core` | 冻结哈希对比（SP3 改动后未重锚前预期红） | SP3 |
| `npm run verify:m3` / `verify:m4` | 策略/生成器门禁（build:strategy + bundle） | SP3 |
| `npm run verify:golden` / `verify:snapshot` | 行为回归（多 KP 行为变化兜底） | SP3 |
| `npm run test:node` | node --test（presentation 等） | SP1/SP2/SP4 |
| `npm test` | 全量门禁（含 check-frozen-core --check） | SP5 |
| `node dev/check-frozen-core.js --baseline` | 授权改动后重锚基线 | SP3 后 |

---

## 7. 工作纪律

1. **四大架构不动**：UI / 核心策略引擎 / 知识库 / 大服务层边界不变；冻结层改动仅在 SP0 批准后按最小面进行。
2. **先 free 后 frozen**：SP1/SP2/SP4 全 free 可先行，SP3 等授权；free 层能兜底的绝不等冻结层。
3. **双实现同改**：multi-kp 数量逻辑（engine+api）必须同步，禁止只改一处。
4. **每阶段独立 commit**：SP1–SP5 各一个提交，禁止跨阶段合并；SP3 前备份 `dev/frozen-core-baseline.json`。
5. **只改点名范围**：不携带无关重构；learner-model 只读不写。
6. **物理不移动文件**：新增文件放 `shared/` 并在 layers.json 登记，不移动既有文件。
