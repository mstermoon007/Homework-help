# 生成质量收口工程 实施计划（C1 → C5）

> 依据：外部审计《Homework Help V4.1 生成质量收口工程》（2116 行 txt），已逐条对照当前仓库代码（V4.3.0 / ENGINE 2.1.0）实测核实。
> 原则：**不做泛化重构**；只接线、收口生命周期、修去重、修路由、清死代码、补数据；严格 C1→C5 顺序，每阶段独立提交 + 门禁全绿才进入下一阶段。

---

## 一、仓库调研结论（已实测，附证据）

### C1 生成请求竞态 —— 【确认存在】
- [shared/practice-bridge.js](file:///Users/zhanggaozhang/Code/Homework%20Help/shared/practice-bridge.js) L172 模块级可变 `_session`；L199 `_session = new Ctor(...)` 后，L204-220 的 `.then/.catch` 回调**重新读取全局 `_session`**（L207、L216 `session: _session`）而非闭包局部变量 → 快速连点 A/B 时，A 完成后把结果反馈给 B 的会话。`submit()`（L290-306）同型问题；`newSession()`（L309-315）可中途替换 `_session`。
- 全文件**无** `_generationRequestId` / requestId / latest-wins 守卫。
- **combine 断链（txt 第十二节，确认）**：[shared/practice-session.js](file:///Users/zhanggaozhang/Code/Homework%20Help/shared/practice-session.js) L61-73 `this.config = {...}` **不含 combine**，但 L314 `_buildGenerationRequest()` 读 `if (this.config.combine === true) req.combine = true` → 永远 false。combine 在 PracticeSession 构造处丢失。
- 现状补充：practice.html 当前**没有任何 UI 传 combine**（grep 仅 4 处命中均为无关），即 combine 是 API 级能力（教师合并出题模式预留），链路断了但暂无用户界面触发。
- UI 层：生成中只禁用了 check/reveal/print 按钮（L504-506、L1693-1695），生成按钮本身无禁用/序号保护。
- 「刷新」按钮 = `location.reload()`（L192、L1647-1650）；「重新生成」(redoAllBtn) = 调 `generate()`（L868/885）——两按钮语义已分离，但缺少"新 generation 身份"。

### C2 跨轮去重 —— 【确认缺失】+ 指纹双轨混用
- **无 generationId 铸造**：全 shared/ 搜索 `generationId` 仅命中 `previousGenerationId` 的校验/透传（[strategy-request.js](file:///Users/zhanggaozhang/Code/Homework%20Help/shared/strategy/strategy-request.js) L200-202 校验为字符串、[strategy-engine.js](file:///Users/zhanggaozhang/Code/Homework%20Help/shared/strategy/strategy-engine.js) L593-594 写入 QuestionPlan、dto.js 注释"透传"），**无任何消费方**；`previousGenerationId` 是纯装饰字段。
- 去重作用域：[shared/generation/api.js](file:///Users/zhanggaozhang/Code/Homework%20Help/shared/generation/api.js) L264-278 每次 `generate()` 创建 `globalSeenKeys`，仅覆盖**单次生成内跨 plan**；上一套 → 下一套练习之间无任何指纹传递。
- 已具备的正确机制（保留）：成功才入集（[retry-loop.js](file:///Users/zhanggaozhang/Code/Homework%20Help/shared/generator/retry-loop.js) L273-279，`allValid` 后才 add）；`GENERATION_SPACE_EXHAUSTED` 已存在（L316-340，重复耗尽显式报错，不返回重复题）；种子兜底 `auto-<Date.now base36>-<counter>`（[question-id.js](file:///Users/zhanggaozhang/Code/Homework%20Help/shared/question-id.js) L108-113），**无 Math.random**。
- **指纹双轨混用（确认）**：
  - [duplicate-validator.js](file:///Users/zhanggaozhang/Code/Homework%20Help/shared/validator/duplicate-validator.js) L122-127 把 **canonicalKey**（L90-113：从 **prompt 文本抽数字/运算符**排序）加入 `context.seenKeys`；
  - [retry-loop.js](file:///Users/zhanggaozhang/Code/Homework%20Help/shared/generator/retry-loop.js) L82、L273-279 用 **questionFingerprint**（`v2|KP|type|operators|operands排序|structure|context|format`，L77-88）判定/入集；
  - 两套键空间混装在同一个 `seenKeys` 袋子里，各自只匹配自己那套 → 去重判定不一致；canonicalKey 正是 txt 禁止的"仅比较 prompt 字符串"。
  - [duplicate-integrity-validator.js](file:///Users/zhanggaozhang/Code/Homework%20Help/shared/validator/duplicate-integrity-validator.js) 仅校验 questionFingerprint 存在/格式，不统一判定。

### C3 Composite 路由 —— 【运行时实测确认】
- 实测（native 模式）：`{combine:true, knowledgePointIds:['math-g1-m1-addsub-10','math-g1-m0-make-ten'], calc, diff2}` → 选中 **`generator:arithmetic-addition`**（应为 `generator:composite`）；连选 20 次稳定错误。与 txt 复现完全一致。
- 根因：[generator-selector.js](file:///Users/zhanggaozhang/Code/Homework%20Help/shared/generator/generator-selector.js) L222-223 只有"**非 combine 排除 composite**"一半逻辑；combine=true 时 composite 与 arithmetic 同分（kp=1/semanticOp=1/capability=1/qt=1），L273-285 排序按 version → registry 插入序，arithmetic-addition 先注册抢中。**缺"combine 请求优先筛选 supportsComposite"**。
- [strategy-engine.js](file:///Users/zhanggaozhang/Code/Homework%20Help/shared/strategy/strategy-engine.js) L371-393 只做"composite 必须能覆盖全部 KP 否则显式失败"的可用性校验，**不强制 selector 选 composite**。
- composite 生成器自身契约正确（[composite.js](file:///Users/zhanggaozhang/Code/Homework%20Help/shared/generator/generators/composite.js) L241-252：要求 combine + ≥2 KP + ≥2 类别）。

### C4 死代码/门禁清理 —— 【大部分上轮已完成，剩余少量】
- 已完成（本会话）：`check-duplicates` 死 script 已删；ci.yml 7 个失效步骤已重写；run-all-checks.sh 已重写；23 个过期 docs + 4 个一次性脚本已删；inject-schema/snapshot 等过期描述已清。
- 剩余 STALE（仅注释，非功能）：[check-capability-contract.js](file:///Users/zhanggaozhang/Code/Homework%20Help/dev/check-capability-contract.js) L5/L9、[check-knowledge-point.js](file:///Users/zhanggaozhang/Code/Homework%20Help/dev/check-knowledge-point.js) L3、[check-capability-resolver.js](file:///Users/zhanggaozhang/Code/Homework%20Help/dev/check-capability-resolver.js) L5、[check-factual-content.js](file:///Users/zhanggaozhang/Code/Homework%20Help/dev/check-factual-content.js) L5 注释中 "574 KP" → 实为 549。
- 经查**非重复、不动**：[generation-engine.js](file:///Users/zhanggaozhang/Code/Homework%20Help/shared/generation-engine.js) 是冻结门面，L52-53/L269-271 全部委托 `generation/api.js`（practice-session 只引用 Engine）；presentation-engine 同理为 bundle 产物。
- 保留：DEV_LOG 历史条目（含 574 记载）、设计文档中"88 个 legacy 插件"历史语境、archive/ 归档。

### C5 知识库基础数据 —— 【数字实测准确】
实测 549 math KP：
| 字段 | 缺失 | 空数组 | 非空 | 说明 |
|---|---|---|---|---|
| operations | **503** | 0 | 46 | 与 txt 一致；selector L242 硬阻断读 `kp.operations.length`（有 ArithSem/legacy.category 兜底） |
| prerequisites | 0 | **18** | 531 | 空项清单已取（make-ten、compose-number、solid-shape、position、multiplication-table、time-unit、number-pattern、clock-read、data-tally、g3-time、G4 C9×3、g5-reason-seq、c7-arithmetic-series、g5-c9×3）——多为单元根节点/综合入口，多数合法 |
| related | 0 | **3** | 546 | 空项全为 G4 C9 integrated/misc/mock（综合/模拟入口，合法空） |
| category | **503** | 0 | 46 | 与 operations 同批 KP（canonical 层可推导） |
| applicable_question_types / weight / concept / pluginId | 0 | 0 | 549 | 完整 |

- 消费方：operations → selector 算术域硬阻断 + verify-knowledge-bank 契约；prerequisites → knowledge-chain / spiral（自适应默认关闭）；related → 诊断/推荐。
- 禁止机械填数：503 条多数可由 pluginId/category/ontology 稳定推导 → DERIVED；真无事实依据 → UNRESOLVED 留空。

---

## 二、Frozen Core 与边界约束

- 受影响 frozen 文件（改后必须 `node dev/check-frozen-core.js --baseline` 重建 80 文件基线，且先证明 `--check` 失败仅因本次授权改动）：practice-bridge.js、practice-session.js（M 组核心链）、retry-loop.js、duplicate-validator.js、generation/api.js、generation/dto.js（如改）、generator-selector.js。
- 不得：重写 StrategyEngine/Generator 业务算法/Validator 契约；放宽 duplicate 标准；删失败测试；加大 retry 掩盖；Math.random；UI 层去重；Generator 内跨轮去重；恢复 legacy；改 baseline 迎合；动 archive。
- 核心生成链保持：UI → PracticeBridge → PracticeSession → GenerationEngine(→GenerationAPI) → StrategyEngine → QuestionPlan → GeneratorSelector → Core Generator → RetryLoop → Validator → SemanticQuestion → Presentation。不新增旁路入口。

## 三、文件与改动清单

### C1（竞态收口 + combine 透传）
- `shared/practice-bridge.js`：新增模块级 `_generationRequestId`；`runSingle` 内 `var session = new Ctor(...)` 闭包持有，回调只使用闭包 session；start/submit 回调入口检查 `requestId === _generationRequestId`，旧请求成功/失败均不 emit；`newSession` 纳入同一序号语义。
- `shared/practice-session.js`：L61-73 config 补 `combine: options.combine === true`（仅接线，不加新语义）；核对 ControlService.sessionConfig → constructor 透传。
- 新增 `tests/bridge/generation-concurrency.test.js`：A/B 启动、A 先完成/B 先完成、A 失败 B 成功、A 成功 B 失败 四案 + combine 透传断言。

### C2（跨轮去重 + 指纹权威统一）
- 先做 **Fingerprint Authority Audit**（只读，产出 dev/reports/fingerprint-authority-audit.json）：确认 questionFingerprint 覆盖 canonicalKey 全部查重能力（prompt 数字/运算符判定有无漏网）。
- 新增 `shared/generation/generation-context.js`（仅当现有 dto/api 无法承载）：`{ generationId, previousGenerationId, fingerprints:Set, createdAt }`，只保留当前+上一代。
- `shared/generation/api.js`：generate 入参接受 `previousSeenKeys`；请求结束返回本次 fingerprints 集合供调用方持有；`currentSeenKeys`（batch/plan/retry）与 `previousSeenKeys`（跨练习）双集合在 retry-loop 判定点取并集。
- `shared/practice-bridge.js` 或 `practice-session.js`（编排层，非 UI/非 Generator）：持有上一代 fingerprints，下一次 generate 传入；每次成功生成铸造新 generationId（不用题目 ID）。
- 种子链：generationId → baseSeed 显式派生（不再只靠 Date 兜底），保持 deterministic chain。
- `shared/validator/duplicate-validator.js`：查重键从 canonicalKey **切换为 questionFingerprint**（v2 语义指纹为唯一权威）；canonicalKey 保留为诊断 info 字段，不入 seenKeys。
- 新增 `tests/generator/cross-generation-dedup.test.js`：同批 20 指纹唯一 / 跨 plan 交集 0 / 跨 generation 交集 0 / retry 不回引 / 连续 10 套 0 重复 / 空间耗尽返回 GENERATION_SPACE_EXHAUSTED。

### C3（Composite 路由优先）
- `shared/generator/generator-selector.js`：在 L216 forEach 候选筛选**最前**加 composite 显式路由——`isCompositeRequest`（combine===true && planKnowledgePointIds(plan).length>=2）时，仅 `supportsComposite===true` 且通过 KP/qt/diff 语义兼容的生成器可入候选；非 composite 请求维持现有排除逻辑（L222-223 不删）。composite 不支持组合时返回 GENERATOR_UNSUPPORTED，不 fallback arithmetic。
- 扩展 `tests/generator/generator-selector.test.js`：combine+2KP→composite；combine=false 单 KP→非 composite；combine+1KP 拒绝；不支持组合→UNSUPPORTED；连选 20 次稳定。

### C4（残余清理）
- 4 个 dev 脚本注释 "574" → "549"（check-capability-contract/check-knowledge-point/check-capability-resolver/check-factual-content）。
- C2 审计若发现 STALE/DUPLICATE 项，按 LIVE/TEST/DEV/ARCHIVE/DEAD/STALE/DUPLICATE 分类清单处理，只删 DEAD/STALE。

### C5（KB 数据补齐，最后做）
- `shared/knowledge-math.js`：operations 503 条逐条分类 FILLED（教材事实明确）/ DERIVED（ontology 稳定推导，raw 留空+记录）/ UNRESOLVED（留空禁猜）；prerequisites 18 条分类 FILLED / NO_PREREQUISITE（根节点合法）/ MISSING；related 3 条（G4 C9）核实后 intentionallyEmpty 或补。
- 产出 `dev/reports/kb-data-completion-report.json`（filled/derived/unresolved 统计 + 每 KP 处理记录）。
- 只改数据与数据校验脚本，不动 Strategy/Selector/Generator/Validator/fingerprint。

## 四、执行顺序与门禁

每个阶段固定流程：**先审计 → 再修改 → 最小回归测试 → 针对性 Gate → 全量核心 Gate → 汇报改动/未改动文件 → 确认无架构越界 → 下一阶段**。5 个独立 commit：

1. **C1** → Gate：`node --test tests/bridge/*.test.js` + verify:ui-boundary + verify:practice-page + 全量核心 Gate
2. **C2** → Gate：新增去重测试 + verify:golden（15/15 错误答案 0）+ npm test + frozen-core
3. **C3** → Gate：selector 测试 + verify:m4 + golden
4. **C4** → Gate：verify:setup + 全量
5. **C5** → Gate：verify:kb-change + verify:m1 + verify:m2 + verify:m4 + golden

每阶段全量核心链：`npm run verify:m4 && npm test && npm run verify:golden && npm run verify:syntax && npm run verify && npm run verify:m2 && npm run verify:layers && npm run verify:frozen-core`（改 frozen 文件后先重建基线）；node:test 全套 274+ 用例 0 失败。

## 五、风险与处理

- **指纹统一改变查重粒度**：questionFingerprint 排序操作数视交换律等价为同题（期望）；风险是 canonicalKey 靠 prompt 数字查到的重复 fingerprint 查不到 → 审计阶段先用两键并行跑 golden + 20 题×多批次比对，确认 fingerprint 召回率 ≥ canonicalKey 后再切换；Golden 错误答案必须保持 0。
- **C1 闭包改造误伤反馈链**：emitStart/emitSubmit 对 UI 的签名与字段保持不变，仅加 requestId 守卫；并发测试四案覆盖。
- **combine 无 UI 入口**：C3 行为变化仅影响 API 调用方，靠 selector 测试锁定；不新增 UI。
- **C5 造数据风险**：DERIVED 必须有 ontology 唯一映射证据，UNRESOLVED 宁可留空；report 留痕可追溯。
- **frozen baseline**：任何阶段 shared/ 核心文件改动后重建基线；若 --check 出现非授权文件漂移，立即停手排查，不改 baseline 迎合。

## 六、完成标准（与 txt 对齐）

连续快速点击旧请求不覆盖新请求；最新请求唯一 UI 提交权；重新生成产生新 generation identity；新练习默认排除上一套；同批/跨 plan/跨 generation/retry 均无重复；combine+多 KP 必走 composite、单 KP 不进 composite、不支持组合显式 UNSUPPORTED；所有 package script 指向存在文件；无已删文件引用；KB 缺失字段逐项分类处理；全部核心 Gate PASS；新增回归测试覆盖以上全部。
