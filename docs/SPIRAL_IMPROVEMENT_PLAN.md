# 知识点驱动 × 螺旋贯穿 1–6 年级・AI 编程修复提升实施方案

> 本文档把「知识点驱动题目生成 + 能力螺旋上升贯穿 1–6 年级」从建议落成
>
> **可执行的 AI 编程步骤**
>
> 。
> 前置分析见会话结论：螺旋链建模（P0）→ 路径规划（P1）→ 策略收敛 / 前置门（P2，GEN）→ 提效（P3）→ 治理（P4）。
> 权威四层清单：
>
> `architecture/layers.json`
>
> （
>
> `npm run verify:layers`
>
> ）；Frozen Core 约束：
>
> `docs/DEVELOPMENT.md`
>
>  §6。
> **本文档本身不修改任何代码**
>
> ；以下每步由 AI 编程按「改一处 → 跑对应门禁 → 提交」执行。



***

## 0. 总则与工作纪律（每步必须遵守）



| 纪律          | 内容                                                                              |
| ----------- | ------------------------------------------------------------------------------- |
| 四大层边界       | UI（显示）/ 核心策略引擎层 = 生成核心（Frozen Core）/ 知识库（数据）/ 大服务层（控制・IO・编排・样式）。**不越层写逻辑**      |
| 最小改动        | 每步只改点名文件；新增文件一律在 `architecture/layers.json` 登记，否则 `verify:layers` 红             |
| 只读增强 = 行为等价 | 索引 / 缓存 / 增量 IO 属于优化，**必须保持原行为**（同一输入→同一输出），用既有测试回归证明                           |
| GEN 授权      | 触碰生成核心（P2）前，先在 `DEVELOPMENT.md` 登记 GEN 变更编号，并快照 `dev/frozen-core-baseline.json` |
| 物理不移动       | 所有文件留在 `shared/`，只改逻辑归属（分类≠移动），规避 bundle 重编译与硬编码路径面                             |
| 独立提交        | 每步一个 commit；出问题可单步 revert；基线快照先行                                                |
| 命令真源        | 所有 npm 命令以 `package.json` scripts 为准（见附录速查）                                     |



***

## 总览路线



| 阶段 | 层    | 目标                           | 触碰 Frozen Core | 风险             |
| -- | ---- | ---------------------------- | -------------- | -------------- |
| P0 | 知识库  | 螺旋链建模 + prerequisites DAG 校验 | 否              | 低（纯新增只读）       |
| P1 | 大服务  | CurriculumPlanner 路径规划接管编排   | 否              | 低 - 中（编排语义需等价） |
| P2 | 策略引擎 | 统一变体单源 + 前置门 + 年级锚点          | **是（GEN）**     | 高（需重编 bundle）  |
| P3 | 共享   | KP 索引 / 增量 IO / 计划缓存         | 否              | 中（须行为等价）       |
| P4 | 治理   | 文档 / 全量门禁 / 回滚预案             | 否              | 低              |



***

## P0 知识库层・螺旋链建模（不碰 Frozen Core）

### P0.1 审计 prerequisites DAG



* **目标**：确认现有 546/556 前置关系的健康度，作为链建模的数据底座。

* **改动**：新增 `dev/check-chain-dag.js`（只读审计脚本，不改库）。

* **校验规则**：

1. 所有 `prerequisites` 引用必须指向存在的 KP id；

2. 跨年级边满足 `grade(前置) ≤ grade(当前)`；

3. 无环（拓扑排序通过）、无自环、无孤儿节点；

4. 输出覆盖率报告（按年级：前置覆盖率 / 孤儿数 / 环数）。

* **验证**：



```
node dev/check-chain-dag.js

npm run verify:m1:kb          # 知识库既有契约不回归
```



* **验收**：0 环、0 孤儿；报告落盘 `dev/chain-audit-report.json`（供 P0.2 选链）。

### P0.2 新增 `shared/knowledge-chain.js`（只读映射，不动 knowledge-\*.js）



* **目标**：把「跨年级同技能」建模为螺旋链。

* **改动**：新增 `shared/knowledge-chain.js`。

* **关键逻辑**：


  * 声明式映射：`{ chainId, skillFamily, subject, steps: [{ kpId, grade, chainIndex, anchorMode }] }`；

  * API：`getChain(chainId)` / `chainsForGrade(subject, grade)` / `resolveKpChain(kpId)` / `allChains(subject)`；

  * **试点范围**：首批 3–5 条链、覆盖约 50 KP，优先「加法 / 运算」族（G1 凑十法 → G2 百内加法 → G3 万以内竖式 → G4 运算律 → G5 加法原理 → G6 复杂分类）；

  * 链上 `anchorMode` 给出该步建议的螺旋档（S1–S6），供 P2 消费。

* **验证**：



```
node -e "const c=require('./shared/knowledge-chain.js'); console.log(c.allChains('math').length);"

npm run verify:layers        # 先登记再跑
```



* **验收**：每条链内 KP id 全部存在、年级单调递增、覆盖报告无孤儿。

### P0.3 登记与文档



* `architecture/layers.json`：`KNOWLEDGE` 层 files 增加 `shared/knowledge-chain.js`；

* `docs/ARCHITECTURE_LAYERS.md` §2.3 增补「螺旋链映射」说明；

* `package.json`：新增脚本 `"verify:chain": "node dev/check-chain-dag.js"`。

### P0.4 P0 验收



```
npm run verify:chain && npm run verify:layers && npm run verify:m1:kb
```



***

## P1 大服务层・CurriculumPlanner 路径规划（不碰 Frozen Core）

### P1.1 新增 `shared/curriculum-planner.js`



* **目标**：把「该练哪条链 / 哪些前置、各多少配额、目标螺旋档」的决策收敛为单一服务，**接替桥接层手工 kpAllocation 编排**。

* **改动**：新增 `shared/curriculum-planner.js`（大服务层，登记 `SERVICE/ASSOCIATION` 或新组 `PATH`）。

* **关键逻辑**：


  * 输入：`{ subject, grade, skillFamily?, learnerState }`；

  * 流程：链解析 → 前置掌握度门槛（<0.7 回练前置）→ 沿链选目标 KP → 分配每 KP 配额 → 输出 `{ partitions:[{kp, count, spiralLevel, reasonCode}], mode }`；

  * 只消费 `knowledge-chain.js` + `LearnerModel`，**不触碰生成层**。

* **验证**：单测 `tests/planner/*.test.js`（`node --test tests/planner/*.test.js`）。

### P1.2 LearnerModel 增加链级掌握度



* **改动**：`shared/learner/learner-model.js` 增加只读方法 `chainMastery(state, chainId)`（链上 KP 掌握度按 attempts 加权）。

* **约束**：不改现有字段 / 语义，纯新增只读 API（R11 规则不变：策略只能经本 API 读，禁止直读 Storage）。

### P1.3 桥接层接入（编排语义等价）



* **改动**：`shared/practice-bridge.js` `ControlService.plan()` 的 kpAllocation 分支改为：调用 `CurriculumPlanner.plan(...)` 得到 partitions，**复用现有&#x20;**`runOrchestrated`**&#x20;合并路径**；单 KP 直发路径不动。

* **验证**：`npm run verify-pages`（practice.html 职责门禁）+ `npm run verify:practice-page` + 既有回归。

### P1.4 登记



* `architecture/layers.json`：`SERVICE` 层登记 `shared/curriculum-planner.js`；`docs/ARCHITECTURE_LAYERS.md` §2.4 增补。

### P1.5 P1 验收



```
node --test tests/planner/\*.test.js

npm run verify:layers && npm run verify-pages && npm run verify:practice-page

npm run test                 # 全量回归，证明编排行为等价
```



***

## P2 核心策略引擎层・螺旋收敛 + 前置门（GEN 变更，最高风险）

### P2.0 授权前置（必做）



* 在 `docs/DEVELOPMENT.md` 登记 **GEN 变更申请**（编号、范围、理由）；

* 快照：`cp dev/frozen-core-baseline.json dev/frozen-core-baseline.json.bak`。

### P2.1 统一 SpiralMode 单源



* **改动**：新增 `shared/spiral-mode.js`（6 档：`{ id:'prototype'|…|'transfer', label:'基础'|…|'迁移', aliases }`）。

* **收敛**：`shared/strategy/spiral-strategy.js` 的 `MODES` 与 `shared/strategy/adaptive-strategy.js` 的 `VARIANTS` 改为引用该单源，**删除各自的重复常量定义**。

* **验证**：`npm run verify:m3`（含 `build:strategy` 与 `check-strategy-plumbing`）。

### P2.2 前置门（prerequisite gate）



* **改动**：`shared/strategy/strategy-engine.js` 第 2 步（KP resolve + Capability inject）之后插入：


  * 从 `request.learnerProfile` 读取目标 KP 前置链掌握度；任一前置 < 0.7 → 计划降级（目标螺旋档回退，或标记 `consolidation:true`，或把部分 count 让给前置 KP）。

* **约束**：仅当 `request.learnerProfile` 存在时生效；无画像时行为与现状完全一致（保证无画像回归安全）。

### P2.3 年级锚点（grade → 最大螺旋档）



* **改动**：新增 `gradeAnchor(grade)` 约束表（建议 G1≤2 / G2≤3 / G3≤4 / G4≤5 / G5–G6=6），在 `adaptive-strategy.resolve` 与 `spiral-strategy.resolveSpiral` 输出处限幅。

* **说明**：防止「跨级跳变」；数值为**默认建议**，落地时按教学口径复核。

### P2.4 bundle 重编 + 基线更新



```
npm run build:strategy                        # 重编 strategy-engine.bundle.js

npm run verify:m3                             # 策略全套门禁

npm run verify:frozen-core -- --update        # 按门禁实际用法更新基线（若 check-frozen-core 支持 --update）

\# 若不支持 --update，手工核对并更新 dev/frozen-core-baseline.json 后再跑 verify:frozen-core
```

### P2.5 P2 验收



```
npm run verify:m3 && npm run verify:frozen-core

npm run check-golden && npm run check-snapshot   # 行为等价/按预期变化

npm run test                                     # 全量
```



***

## P3 共享层提效（只读增强，保持行为等价）

### P3.1 KnowledgePoint 索引



* **改动**：`shared/knowledge-point.js` 惰性构建 `id→canonical` Map（首次 `get()` 前一次扫库），`get(id)` 变 O (1)；`findLegacy` 保留兼容。

* **约束**：缺失 / 异常行为与现状逐位一致（先写单测覆盖 缺失 id / 空库 / 多科目 场景，再改实现）。

### P3.2 learner-storage 增量 IO



* **改动**：`shared/learner/learner-storage.js` 增加内存态 + 单 KP 更新路径 + 防抖落盘（默认 300ms 或提交后一次性 flush）；保留 `load/save/getKnowledgePoint/updateKnowledgePoint/clear` 原接口签名。

* **目标**：一次练习提交由「N× 全量 load+normalize+save」降为「O (1) 写 + 1 次落盘」。

### P3.3 路径计划 session 级缓存



* **改动**：`shared/curriculum-planner.js` 按 `(subject, grade, skillFamily, learnerSnapshotHash)` memo 计划结果；learnerState 变化时失效。

### P3.4 性能冒烟 + 验证



* **改动**：新增 `dev/bench-kp-lookup.js`（get 耗时前后对比）、`dev/bench-learner-io.js`（提交 IO 前后对比），输出 ms 差值。

* **验收**：`get` 提速可量化（O (N)→O (1)）；单次提交 IO 次数显著下降；`npm run verify:layers && npm run test` 全绿。



***

## P4 收敛与治理

### P4.1 双轨收敛（建议独立任务，不并入最小集）



* `practice.html` 逐步加载 `shared/generation/api.js`，把唯一入口收敛到 `GenerationEngine/GenerationAPI`，消除「旧路径直连 PracticeSession / 新路径声明内部构成」并存。

### P4.2 文档



* `docs/ARCHITECTURE_LAYERS.md` §2.4：登记 `knowledge-chain.js` / `curriculum-planner.js` / `spiral-mode.js` 归属；

* `docs/PROJECT_STRUCTURE.md` §2 增补新文件索引。

### P4.3 全量门禁（收尾必跑）



```
npm test

npm run verify:layers

npm run verify:frozen-core

npm run verify:m3

npm run verify:chain
```

### P4.4 回滚预案



* 每步独立 commit；异常时 `git revert <step>` 单步回退；

* P2 前保留 `frozen-core-baseline.json.bak`，回滚后恢复基线；

* P3 改实现前先提交「行为等价」单测，回滚时测试仍在。



***

## 风险登记表



| 风险                   | 影响 | 缓解                                     |
| -------------------- | -- | -------------------------------------- |
| P2 bundle 重编导致策略行为漂移 | 高  | golden/snapshot 双回归 + 基线快照 + GEN 授权    |
| P1 编排语义不等价           | 中  | 复用既有 runOrchestrated 合并路径，全量 test 证明等价 |
| P3 索引 / 缓存改变异常行为     | 中  | 先写等价单测再改实现                             |
| 链映射数据遗漏（孤儿 / 错年级）    | 中  | P0.1 DAG 审计 + verify:chain 门禁前置        |
| 跨级跳变（年级锚点不当）         | 低  | 默认约束表 + 教学口径复核                         |



***

## 附录：真实门禁命令速查（来自 package.json）



| 用途                | 命令                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------- |
| 四层归类门禁            | `npm run verify:layers`                                                                |
| Frozen Core 漂移门禁  | `npm run verify:frozen-core`                                                           |
| 策略全套（含 bundle 重编） | `npm run verify:m3`                                                                    |
| 策略 bundle 单独重编    | `npm run build:strategy`                                                               |
| 知识库契约             | `npm run verify:kb` / `npm run verify:m1:kb`                                           |
| 页面职责门禁            | `npm run verify-pages` / `npm run verify:practice-page` / `npm run verify:ui-boundary` |
| 全量测试              | `npm test`                                                                             |
| 黄金 / 快照回归         | `npm run verify:golden` / `npm run verify:snapshot`                                    |



***

> 顺序建议：
>
> **P0 → P1 → P3 先做**
>
> （不碰 Frozen Core，风险可控，快速见效）；
>
> **P2 单独排期**
>
> （GEN 授权 + 双回归）。每一步完成即跑对应门禁再提交，禁止跨步合并提交。