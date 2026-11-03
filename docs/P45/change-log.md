# P45 Change Log

> 六字段口径（沿用 P28/P30/P31）：标题行含任务号 + 日期 / modified / deleted / reason / tests / risk。
> 最新在上，append-only，不改写历史记录。

---

## P45-NEXT-04 / P45-NEXT-05 · 2026-11-03 · shape 双入口收敛核实 + stale 锚条件项核对（均零代码改动）

- **modified**：
  - `docs/P45/P45-TASK-BOOK.md`：§4.3 增「下一步待修 5 项」收口行；§4.4-D 两行改为已合并/已收敛结论；§4.5 改为「已全部处置」终态表。
- **deleted**：无。
- **reason**：
  - 用户指令「持续执行任务 P45-NEXT-03、P45-NEXT-04、P45-NEXT-05」。
  - NEXT-04 核实：`shape.js` 的 `stemGraphicPlan` 已被 `resolveShapeDescriptor` 单点包装，两处使用点（L1896 choice/fill/geometry、L2033 apply）均走同一入口，代码内无第二套派生；bundle 内同名函数一致。原 §4.4-D「需统一 `sItem`/`item` 结构」的前提不成立，无需改动。
  - NEXT-05 核实：本轮无任何生成器描述符变更，71 条 stale 锚路径未触发失效（`baseline fail=0`），按登记口径「不主动清理」保持原样。
- **tests**：
  - 代码检索：`stemGraphicPlan` 全库仅定义 1 处 + 调用 1 处（`resolveShapeDescriptor` 内）；`variantAgg` 全库零命中。
  - `node dev/p28/check-generation-matrix-freeze.js` → ALLOW rows=1566、FAIL rows=0；只读复核与冻结产物完全一致（git diff = 0）。
  - `node dev/p30/check-generation-failure-classify.js` → Layer A **1566 PASS / 0 FAIL**；Layer B `FAILED 0 / exception 0`（capacityGap 572 既有记账）。
  - stale 锚现值（断言数）：`steps 559 / labelSides 83 / length 12 / angle 18 / correctIndex 2 / shownAnswer 2`；派生基线 `fail=0`。
  - `npm test` → **993/993 PASS**；`node dev/check-all.js` → **33 PASS / 0 FAIL / 1 SKIP / 34 项**。
- **risk**：无代码/数据改动；仅文档状态收口，零运行时风险。

---

## P45-NEXT-03 · 2026-11-03 · 反面采样单套化（probeAgg 单次遍历承载 variant 计数）

- **modified**：
  - `dev/p25/derive-evidence-candidates.js`：`aggregateProbe(q, asVariant)` 一次 `census` 同时写 `probeAgg.present/values` 与 `variantPresent/variantValues`；变体循环删除二次 `census` 遍历；`probeSamples.forEach` 改为显式 `aggregateProbe(q, false)`（避免 `forEach` 把索引当 `asVariant` 传入）。
  - `dev/p25/reports/evidence-derive-report.json`：全量重跑覆盖（内容与改动前逐项一致）。
- **deleted**：
  - 变体循环内的重复 `census(q.data, flat, '', 3)` 遍历块（约 10 行）。
- **reason**：
  - 用户指令「持续执行任务 P45-NEXT-03、P45-NEXT-04、P45-NEXT-05」；NEXT-03 为 §4.5 登记项。
  - `variantAgg` 在代码层早已并入 `probeAgg`（`variantPresent/variantValues`），剩余问题只是同一份变体样本被 `census` 遍历两次，与注释「共享同一个 census 聚合」不符；改为单次遍历，判定仍为单套。
- **tests**：
  - `node dev/p25/derive-evidence-candidates.js` 重跑 → 1315 行、`partial=325 / saturated=396`、基线 `pass 5248 / fail 0`、`counterDowngraded=149`、`genError=0`。
  - 与改动前快照（`/tmp/report.pre-next03.json`）逐项对比：`summary` 相同、`baselineStates` 相同、1315 行 `flagsDiff=0`、`candidateDiff=0`。
  - `node dev/p25/apply-evidence-candidates.js`（无旗标）→ 0 变更（1562 行）。
  - `npm test` → **993/993 PASS**；`node dev/check-all.js` → **33 PASS / 0 FAIL / 1 SKIP / 34 项**。
- **risk**：
  - 纯派生器内部遍历合并，不改聚合口径；重跑报告逐项相等即证明等价。
  - 顺带修正 `forEach` 回调误传索引的隐患（此前 `probeSamples` 第 2 项起可能被误标为变体）；修正后报告仍与改动前一致，说明该隐患未实际改变历史结果。

---

## P45-NEXT-01 · 2026-11-03 · 质量族证据规则补全（weighing 语义受门禁保护）

- **modified**：
  - `dev/p25/apply-evidence-candidates.js`：新增 `--refresh-incomplete=<gen...>` 通道——既有 `required` 为候选的严格子集（kind+path+value 全等、候选断言更多）、`forbidden` 完全相同、样本充分（非 `partial`/`single`）时整行替换为候选，语义等价于「纯追加断言」。同步更新头部注释、用法行、`note` 与汇总输出（新增「规则补全」计数）。
  - `kbl/teaching/evidence-rules.json`：补全 **20 行**——`math-g3-up-u04-k002/k003` 的 calc/fill/choice/apply 8 行 + `k004` 的 fill/choice/apply 3 行（共 11 行）加 `graphic.subtype="weighing"`、`graphic.role="quantity-correspondence"`、`graphic.params.hint`（并含候选中的 `data.operation`）；`math-g1-down-u07-k001/k002/k003` 的 fill/choice/apply 9 行加 `graphic.subtype="rmb"`、`graphic.role`（k001 fill 另加 `fieldPresent:graphic.params.op`）。
- **deleted**：无。
- **reason**：
  - 用户指令「推进任务：P45-NEXT-01」；本项为 §4.5 登记册条目，P45-NEXT-02 完成后按其前置条件解锁。
  - P45-19 为绕开 `partial-sample` 门控只做了失效字段删除，导致 11 行只剩 4 条断言、P45-05 引入的 `weighing` 语义不受证据门禁保护。NEXT-02 判出 `saturated-sample` 后，这些行恢复「样本充分」资格，遂用纯追加通道补断言。
  - g1 货币族 9 行同样由 `generator:money-measurement` 产出，scope 显式命中，一并补全（只加不删）。
- **tests**：
  - `node dev/p25/apply-evidence-candidates.js --refresh-incomplete=generator:money-measurement` → 规则补全 **20** 行，新增/刷新/降级/剔除均为 0，键冲突跳过 1295，总规则 1562 行。
  - 逐行 diff：20 行**仅追加**断言，`forbidden` 完全不变，`kblAnchor` 不变；无删除、无改写。
  - `node dev/check-educational-generation.js` → **SEMANTIC_FAIL 0 / 936 PASS**。
  - `node dev/p28/check-generation-matrix-freeze.js` → ALLOW rows=1566、FAIL rows=0；只读复核与冻结产物完全一致（**无需重冻**）。
  - `node dev/p30/check-generation-failure-classify.js` → Layer A **1566 PASS / 0 FAIL**；Layer B `FAILED 0 / exception 0`（capacityGap 572 既有记账）。
  - `npm test` → **993/993 PASS**；`node dev/check-all.js` → **33 PASS / 0 FAIL / 1 SKIP / 34 项**。
- **risk**：
  - 新增断言全部来自派生候选（真实生成产出字段稳定性 + KBL 语义事实），无手编语义。
  - `data.operation` 断言随整行替换一并写入，虽超出「三类图形断言」字面范围，但同为候选机械派生且已通过 6b/6f 全量复核。
  - 该通道仅在显式 scope + 严格子集 + forbidden 全等 + 非 lowSample 四重条件下生效，不会改写任何失效/冲突行。

---

## P45-NEXT-02 · 2026-11-03 · 派生器 partial-sample 永久盲区修复（形态闭合判定）

- **modified**：
  - `dev/p25/derive-evidence-candidates.js`：对 `2 ≤ samples < N` 的行，用**同一种子**把 `count` 放大到 `N×2` 复采一次；去重后形态数不再增长即判 `saturated-sample`，不再挂 `partial-sample`。`samples === 1` 维持既有 `partial/single-sample` 门控。同步新增 `summary.partial/saturated` 计数与 `sampling.growthProbe` 元数据。
  - `dev/p25/reports/evidence-derive-report.json`：全量重跑覆盖。
  - `dev/p25/apply-evidence-candidates.js`：仅注释措辞更新（`prune` 通道说明不再写「永远 partial-sample」）。
- **deleted**：无。
- **reason**：
  - 用户指令「好的，执行 P45-NEXT-02」；本项为 §4.5 登记册条目。
  - money 的 fill/choice 确定性产出空间恒为 5（`count=12` 仍 5），`samples < N` 永久成立 → `--refresh-stale-fields` 被 `lowSample` 永久挡住，只能走纯删除通道，规则无法补全。
  - 判定口径：同种子放大复采后形态数不变，说明该 KP×QT 的确定性空间已闭合；异种子窗口另行由 `probeAgg` 覆盖字段稳定性，不用于闭合判定。
- **tests**：
  - `node dev/p25/derive-evidence-candidates.js` → 1315 行，耗时 5m36s；`partial=325`（全部为单样本行）、`saturated=396`；基线 `pass 5248 / warn 0 / skip 0 / fail 0`；`genError=0`、`noSample=0`、`intentConflictRows=0`、`counterDowngraded=149` 不变。
  - money `fill/choice` 6 行（k002/k003/k004）实测 flags = `saturated-sample|existing-rule-kept`（此前为 `partial-sample`）。
  - 无源码/规则变化，门禁随 P45-NEXT-01 一并复核：`npm test 993/993`、`check-all 33/0/1`、6b `1566/0`、6f Layer A `1566/0`。
- **risk**：
  - 放大复采仅多跑 396 次会话（2..5 样本行），派生耗时由约 3.5 分钟升至 5m36s；不影响门禁与运行时。
  - 闭合判定基于同种子确定性，不改变证据内容的生成方式；若将来生成器引入跨种子形态扩容，`probeAgg` 仍会捕获字段差异，闭合判定只影响「是否允许补断言」。
  - 单样本（325 行）仍受 `single-sample` 门控，未被本次放宽。

---

## P45-LOG-01 · 2026-11-02 · P45-14~18 日志追溯补齐 + §4.5 下一步待修清单立项

- **modified**：
  - `docs/P45/P45-TASK-BOOK.md`：§4.3 补 P45-19 / P45-20 两行并更新终态口径为 P45-20；新增「任务号追溯缺口」说明（P45-14~18）；§4.4-C 将「质量族 11 行锚绑定当前产出」改为「已被 P45-19 取代」、将「派生器 raw 探针耦合」改为「已修（P45-13）」；§4.4-D 的 D17/D18 两行指向新立项；新增 **§4.5 P45 下一步待修清单**（P45-NEXT-01~05）。
  - `docs/P45/change-log.md`（本记录）。
- **deleted**：无（任务书非 append-only，过时表述就地改写；change-log 历史记录一字未动）。
- **reason**：
  - 用户指令「补齐日志，将需要解决的问题，立项为 P45 下一步需要修复的问题，不需要修改的不再列入」。
  - 日志缺口：现存 19 条任务记录缺 P45-14 / 15 / 16 / 17 / 18。经全库检索（代码注释、测试、派生报告、P32 日志、任务书）**仅两条可证实**——P45-17（含 `P45-17-FIX`）= `dev/p25/apply-evidence-candidates.js::L193` 的 `lowSample` 门控；P45-18 = `strategy-engine.bundle.js` 重建（P45-19 因果链据此）。P45-14~16 无任何代码/数据/测试/文档痕迹，**内容不可考**，按「不臆造历史」原则只登记缺口。
  - 待修清单只收需要改动的事项；已覆盖、环境限制、既有记账项（k004 双形态、6f capacityGap 572、6g 4 条白名单、门禁 7 固定 seed、E2E 本地 SKIP、变体采样耗时、已修的 raw 探针耦合、407/1566 与 373/1570 历史口径差）明确「不再列入」。
- **tests**：
  - `node dev/check-all.js` → **33 PASS / 0 FAIL / 1 SKIP / 34 项**（#15 无 Chrome SKIP）；#20 Doc（历史数字扫描）与 #3 Lint、#21 Dead Code 均 PASS。
  - 纯文档改动：未触源码、KBL/T2 数据、bundle 与任何冻结产物，16/17 与 6a/6b 不受影响。
- **risk**：
  - 低。§4.5 为登记册，不构成执行授权；其中 NEXT-01（质量族规则偏宽）与 NEXT-02（partial-sample 盲区）属 P45-19 的有意取舍余量，不追加断言的原因已在该记录 risk 中留痕。
  - P45-14~16 若后续从其他渠道取得原始记录，应以原始证据为准、追加更正记录，不得改写本条追溯结论。

---

## P45-20 · 2026-11-02 · P45 死代码与无效文件清理

- **modified**：
  - `docs/P45/change-log.md`（本记录）。无源码、无数据、无测试改动。
- **deleted**：
  - `.trae-html-share-packages/feedback/feedback.html.zip`、`.trae-html-share-packages/audit/single-question-quality-20261031/single-question-quality-audit/single-question-quality-audit.html.zip`：与同目录已存在 HTML 产物 SHA256 完全一致的打包副本（`feedback.html` 校验值 `47f8433e…722`）。
  - `.trae-html-share-packages/` 整棵空壳目录树（`feedback/`、`audit/single-question-quality-20261031/single-question-quality-audit/`）、`.screenshots/.tmp` 与 `.screenshots/`：删净载荷后无任何文件的空目录。
  - `.DS_Store`（多个目录）：macOS 元数据，已被 `.gitignore` 排除且被 FINAL-91 hash 快照跳过；删除后 Finder 会即时重建，属操作系统行为，不列为可持久清理项。
- **reason**：
  - 用户指令「查看整个 P45 修复内产生的死代码和无效文件，进行整理清除」。
  - 源码层死代码为零：P45 全部变更文件一次性词频扫描（`counts[n] <= 1` 判定）无未引用顶层符号；`dev/p28/check-dead-code.js` 15 个候选全 PASS；`shared/generator/core/distractors.js` 经核实有 4 处真实消费者（`concept-meaning.js`、`semantic-relations.js` 各 2 处 + bundle），判定 KEEP，不按死代码处理。
  - 仅清理「同内容重复打包副本」与「零文件空目录」，符合 P30 §5 重复层删除规则：先证零消费者、再物理删除、不留兼容壳。
  - `audit/`（含 `single-question-quality-audit.html`、`_shared`、`assets`、`summary.json`、`hard-defects-16.csv`、`report-brief.json`、`analyze_extended.py`）为一次性单题质量审计的原始证据，**保留不动**。
- **tests**：
  - `node dev/check-all.js` → **33 PASS / 0 FAIL / 1 SKIP / 34 项**（#15 无 Chrome SKIP）；#21 Dead Code 矩阵 PASS；FINAL-91 只读门禁 PASS（关键目录前后 hash 一致）。
  - `.trae-html-share-packages`、`.screenshots` 全库零引用检索（Grep 无命中），确认删除不引入断链。
- **risk**：
  - 无。删除对象均为可再生缓存/重复副本或空目录，不参与构建、门禁、测试与运行时；无源码、无 KBL/T2 数据、无冻结产物变化。
  - `.DS_Store` 会被系统重新生成，后续再出现不视为回归。

---

## P45-19 · 2026-11-02 · 质量族证据规则失效字段纯删除（check-all 5 FAIL 收敛）

- **modified**：
  - `dev/p25/apply-evidence-candidates.js`：新增 `--prune-stale-fields=<gen...>` 纯删除通道——只删除既有 `required` 中「当前候选已完全不存在的字段路径」，不整行替换、不新增任何断言，因此不受 P45-17-FIX 的 lowSample 门控限制（删除不会写入未采样的新断言）。同时更新用法注释、`note` 与汇总输出（新增「失效字段剔除」计数）。
  - `kbl/teaching/evidence-rules.json`：经上述通道刷新 11 行质量族规则（`math-g3-up-u04-k002|calc|fill|choice|apply`、`math-g3-up-u04-k003|calc|fill|choice|apply`、`math-g3-up-u04-k004|fill|choice|apply`），每行删除 2 条失效断言，共 **22 条**；其余 4 条断言（`data.mode`、`data.steps`、`data.kind`、`data.graphic.type`）原样保留。
  - `dev/p25/reports/evidence-derive-report.json`：重跑派生器覆盖（基线 `fail=60` 样本级，仅 11 行承载；`counterDowngraded=149` 不变）。
- **deleted**：
  - 22 条 required 断言：11 行 ×（`field:data.graphic.params.unit`、`field:data.graphic.params.unitPx`）。
- **reason**：
  - 用户指令「按方案 A 立项并执行 P45-19」。
  - 根因：P45-05 把质量族 `kind='mass'` 描述符从「8×3 固定装饰矩形（含 `unit:'cm'`/`unitPx:30`）」改为 `weighing`（`leftLabel/rightLabel/hint`，不写 `unit/unitPx`），`evidence-rules.json` 未同步；P45-18 重建 `strategy-engine.bundle.js` 后门禁改用新描述符，5 个门禁（2 KBL / 5 Unit / 6b / 6f / 7）同时红。
  - 为什么不用 `--refresh-value-drift`：11 行 flags 无 `counter-sample-dowgraded:*`、`absentInSome` 为空；`unit/unitPx` 在候选 `required` 中**完全缺席**，属 stale field 而非 value drift。实测 value-drift 仅会把 `unit` 降级为 `fieldPresent`（字段实际不存在，仍 fail）、`unitPx`（number）不被兜底触及，0 行可修。
  - 为什么不用 `--refresh-stale-fields`：该通道受 lowSample 门控；fill/choice 的确定性产出空间恒为 5（`count=12` 仍 5），`partial-sample` 永久成立 → 6 行被挡。纯删除不引入新断言，故不受该门控限制。
- **tests**：
  - `node dev/p25/derive-evidence-candidates.js --n 6` → 1315 行，基线 `pass 5188 / fail 60`（仅 11 行失败），`genError=0`。
  - `node dev/p25/apply-evidence-candidates.js --prune-stale-fields=generator:money-measurement` → 失效字段剔除 **22** 条，死规则剔除 0，总规则 1562 行。
  - `node dev/check-educational-generation.js` → **SEMANTIC_FAIL 0 / 936 PASS**。
  - `node dev/p28/check-generation-matrix-freeze.js` → **ALLOW rows=1566，FAIL rows=0**；只读复核与冻结产物完全一致（**无需重冻**）。
  - `node dev/p30/check-generation-failure-classify.js` → Layer A **1566 PASS / 0 FAIL**；Layer B `FAILED 0 / exception 0`（capacityGap 572 行为既有已记账）。
  - `npm test` → **993/993 PASS / 0 FAIL**。
  - `node dev/check-all.js` → **33 PASS / 0 FAIL / 1 SKIP / 34 项**（#15 无 Chrome SKIP）。
- **risk**：
  - 仅删除「要求生成器产出其从不产出的字段」的错误断言，不新增断言、不改 `forbidden`、不动其他生成器范围（scope 显式为 `generator:money-measurement`，且只有 11 行的生成器全部命中）。
  - 规则因此比候选略宽（未追加候选中的 `subtype/role/hint` 断言），属有意的保守取舍：宁可不收紧，也不在 partial-sample 行写入未经充分采样的新断言。
  - `--prune-stale-fields` 为离线 T2 派生工具能力扩展，无运行时消费；不触发 bundle 重建。

---

## P45-13 · 2026-11-02 · D16 raw 探针单一路径修复 + D17/D18 并行通道评估

- **modified**：
  - `dev/p25/derive-evidence-candidates.js`：raw 探针块（D2 归因域）删除原 `StrategyEngine.plan` + `GeneratorSelector` + `gen.generate` 并行调用链，改为 `new PracticeSession({..., skipValidation: true})` + `await rawSession.start()` 取 `rawSession.semanticQuestions`，统一经 PracticeSession 单一路径。
  - `shared/engine/practice-session.js`：`config` 新增 `skipValidation: options.skipValidation === true`；`start()` 中 `if (this.config.skipValidation) genOptions.skipValidation = true` 透传给 `GenerationAPI.generate`。
  - `shared/engine/presentation-engine.js`：`generateQuestions` 新增 `skipValidation` 短路——直接 `generator.generate(plan)` 并 `normalizeSemanticQuestion` + 补指纹，不经 `RetryLoop.generateWithRetry` / `Pipeline.runPipelineBatch`（后者含 `kpSemantic` 证据过滤，会把另一合法形态过滤掉）。返回结构与正常路径一致（`questions/semanticQuestions/validationResults/batchResult/qualitySummary/retries/status/generator`）。
  - `shared/orchestration/practice-orchestrator.js`：`orchestrate` 新增 `if (options.skipValidation) return execute(request, options)` 短路——跳过 POL 的 cell 拆分与跨 cell 指纹去重，直连 `executeInline→build→runPlans→generateQuestions(skipValidation)` 单链。`runCells` 内指纹去重也加 `!options.skipValidation` 守卫（生产路径不变）。
  - `shared/engine/presentation-engine.bundle.js`：重建（presentation-engine.js 改动后必须重建，门禁 16/17）。
  - `docs/P45/P45-TASK-BOOK.md`：§4.3 增 P45-13 行（D16 已修 / D17 评估暂保留 / D18 评估不重构）；§4.4-D 更新 D16/D17/D18 状态。
- **deleted**：无源码/数据物理删除。
- **reason**：
  - 用户指令「延续 P45 立项顺序，修复 D16/D17/D18」。
  - D16：raw 探针第二生成路径（`StrategyEngine.plan` + `GeneratorSelector` + `gen.generate`）绕过 PracticeSession，与生产 Pipeline 口径可能漂移。首版改为 `PracticeSession(skipValidation:true)` 后发现 `counterDowngraded` 从 149 降至 122——根因是 `generateQuestions` 虽传 `validatorEnabled:false` 给 RetryLoop，但 RetryLoop 内部无视该标志、恒跑 `Pipeline.runPipelineBatch`（含 `kpSemantic` 证据过滤），把另一合法形态过滤；且编排层 `runCells` 的跨 cell 指纹去重也会折叠同形态重复。两级过滤导致 raw 探针看不到全部合法形态，误判 `data.graphic.*` 为结构恒定量。修复点：`generateQuestions` 直调 generator + `orchestrate` 跳 cell/dedup。
  - D17：评估 probeAgg/variantAgg 并存。probeAgg 已覆盖 variantAgg 的 `varies` 判定（variant 数据经 `aggregateProbe` 注入 probeAgg）；但 variantAgg 的 `absent` 检测（`va.present < variantSamples`）捕获「主样本全出现、变体形态部分缺失」字段，是 probeAgg + `absentInSome`（主样本部分缺失）均无法替代的。合并需在 probeAgg 增 variant-present 计数，非纯合并。**暂保留 variantAgg**，待后续锚点对账再评估。
  - D18：评估 shape.js `stemGraphicPlan` 双入口。双入口（`themedItemMeta` L1881 + apply 分支 L2018）是 P45-09 D2「题面点名图形优先于 KP 名」修复的必要结构，两处调用条件不同（themedItemMeta 处理 choice/fill/geometry 的 item；apply 仅 `!applyGraphic && !sItem.g` 时回退）。合并需统一 `sItem`/`item` 结构并全量图文回归。**本次不重构**，登记待后续。
- **tests**：
  - raw 探针实测 `math-g1-up-u03-k001|fill`：修复前仅 1 题（subtype=cuboid），修复后 6 题（cuboid/cube 混合），证明 `skipValidation` 真正绕过了证据过滤与去重。
  - `node dev/p25/derive-evidence-candidates.js` → counterDowngraded=**149**（与 P45-12 一致，恢复），baseline fail=0，genError=0。
  - `node dev/p25/apply-evidence-candidates.js` → 既有规则保留 1562，新增 0，锚点刷新 0，值漂移降级 0，死规则剔除 0（无新变更）。
  - `npm test` → **993/993 PASS / 0 FAIL**。
  - `node dev/check-all.js` → **33 PASS / 0 FAIL / 1 SKIP / 34 项**（#15 无 Chrome SKIP；门禁 16 Bundle source==bundle PASS、17 Determinism PASS）。
- **risk**：
  - `skipValidation` 短路改变了 `generateQuestions` 和 `orchestrate` 的行为，但仅在 `options.skipValidation === true` 时触发——生产 UI 不传此标志（PracticeSession `config.skipValidation` 仅 dev 派生脚本显式传 true），生产路径零影响。
  - `orchestrate` 短路跳过 cell 拆分意味着 skipValidation 路径不做题型容量分配，但 raw 探针只用于字段稳定性统计，不交付用户，容量分配无关。
  - D17/D18 未做代码改动，仅评估登记，零运行时风险。
  - 重建的 `presentation-engine.bundle.js` 已通过门禁 16（source==bundle hash 一致）与 17（确定性重跑不变）。

---

## P45-12 · 2026-11-02 · C 技术债 probeVaries 前缀错位修复 + 剩余项整理核对

- **modified**：
  - `dev/p25/derive-evidence-candidates.js`：`probeVaries(f)` 中 `probeAgg[f.path]` → `probeAgg[f.path.replace(/^data\./, '')]`。`probeAgg` 键为 `census(q.data)` 产出的无前缀路径（如 `graphic.subtype`），而 `stableFields.path` 带 `data.` 前缀，此前反面采样降级对所有行永不生效。与 `variantStatus` 同口径剥离前缀。
  - `kbl/teaching/evidence-rules.json`：`apply-evidence-candidates.js --refresh-value-drift=generator:money-measurement,generator:shape-recognition,generator:semantic-relations,generator:stats,generator:application-word` → 36 条 `field:data.<bool>=true` 降级为 `fieldPresent:data.<bool>`（barModel / calcForm / choiceForm / sort / gridFigure）。这些布尔标志在反面样本中可缺失，冻成 `=true` 属过度收紧。
  - `dev/p25/reports/evidence-derive-report.json`：派生报告重跑（counterDowngraded 137→149，12 行新增降级）。
  - `docs/P45/P45-TASK-BOOK.md`：§4.3 增 P45-12 行 + 终态更新为 P45-12；§4.4-C 逐项核对（probeVaries 标记已修，其余 9 项核实现状）；§4.4-D 更新 probeAgg/variantAgg 状态（probeAgg 已生效，variantAgg 的 absent 检测暂保留）。
- **deleted**：无源码/数据物理删除。
- **reason**：
  - 用户 2026-11-02 指令「整理解决剩余项」，列出 §4.4-C（9 项技术债）、§4.4-D（3 项并行通道）、§4.4-E（第二套实现核查）。
  - C 项首条 `probeVaries` 前缀错位是确认 bug（`probeAgg` 键无前缀但查询带前缀），属一行修复 + 派生器重跑 + T2 锚点对账，不跨层、不改生成器，可在本任务内闭环。
  - 其余 C/D 项经核实：C10/C11/C12/C13/C15 为已登记正常状态（非缺陷）；C7/C8/C9/C14 为已知技术债，基线 fail=0 暂不触发，改生成器时才需处理；D16/D18 为设计层重构建议，需独立任务 + 全量回归，不在本任务顺手改。
  - 36 条 `field=true`→`fieldPresent` 降级是 probeAgg 修复后派生器实证的结果（反面样本证明这些布尔标志非恒存在），属 T2 证据规则收紧方向的修正（放宽过度断言），不放宽 Validator 生产标准。
- **tests**：
  - `node dev/p25/derive-evidence-candidates.js` → counterDowngraded=149（+12），baseline fail=0，genError=0。
  - `node dev/p25/apply-evidence-candidates.js --refresh-value-drift=...` → 36 条降级，写入成功，无键冲突。
  - `npm test` → **993/993 PASS / 0 FAIL**。
  - `node dev/check-all.js` → **33 PASS / 0 FAIL / 1 SKIP / 34 项**（#15 无 Chrome SKIP）。
- **risk**：
  - 36 条 `field`→`fieldPresent` 放宽了证据规则（从「必须等于 true」到「必须存在」），理论上允许这些标志缺失的题目通过证据校验。但这些标志在反面样本中已实证可缺失，原 `=true` 断言本身就是误收紧，修复方向正确。
  - probeAgg 修复后对所有行生效，未来若新 KP 的反面样本与主样本差异大，会产生更多降级，需及时 apply。
  - D18（shape.js 双入口）未动：该重构风险高（P45-09 D2 修复依赖当前双入口结构），须独立任务 + 图文全量回归。

---

## P45-11 · 2026-11-02 · V-D 图文同名校验实现（§4.4-B 清零）

- **modified**：
  - `shared/validator/answer-validator.js`：V-D 段新增 D2「图文同名」子校验——`SHAPE_NOUNS` / `SHAPE_SUBTYPES` 词表 + `allShapeSubtypes(prompt)`（全量占位扫描）+ `primaryShapeSubtypes(prompt)`（主对象位置：指示词 12 字内或后接「有/的」）。判定：仅当题面全局唯一图形名且处于主对象位置时，比对描述符 subtype；`count` 取 `params.shape`；主题图标（`width`+`size` 同时存在）、复合描述符（view-cards 等非具体 subtype）、judge/true-false 命题文本均跳过。`球` 条目带 `skipPrefix`（乒乓/羽毛/网/足/篮/排/皮/气/地/眼/台/棒/铅/垒/高尔夫），排除运动器材/生活词构词成分。
  - `tests/validator/p45-07-quality-gates.test.js`：新增 7 条 V-D 同名校验用例（命中 D2 复现形态、同名通过、多图形跳过、count 取 `params.shape`、复合描述符跳过、judge 跳过、构词成分跳过），`REAL_ROWS` 增登 `math-g3-down-u08-k006 apply`（6f 复现行）零误报；文件由 22 条增至 29 条。
  - `shared/engine/presentation-engine.bundle.js`：`answer-validator` 已内联于 presentation bundle，按动作清单重建（门禁 16 首跑重建后 PASS）。
  - `docs/P45/P45-TASK-BOOK.md`：§4.3 V-D 行与终态行更新为 P45-11（993/993、33/0/1/34）、§4.4-B 收口结果补 `skipPrefix` 与 7 条定向测试。
  - `dev/p42/out/p42-4-instance-gate.json`：gate 23 证据产物重跑刷新。
- **deleted**：无源码/数据物理删除。
- **reason**：
  - 用户 2026-11-02 显式指令「5. V-D 图文同名校验 — 从未实现，目前仅由 `p45-04-shape-graphic.test.js` 定向捕获。延续 P45，进行修复」。
  - 此前 V-D 只覆盖装饰指纹 / 刻度尺 / 矩形尺寸，D2「问长方形配正方形」仅靠定向测试捕获，未接入 Validator 生产校验；本次把判定接到 `validateInstanceConsistency`（封冻链 Validator 层，唯一 SSOT），不改题、不重算。
  - 零误报收敛过程：首版按「文中出现图形名」判定误报 6 行（命题/情境文本），收窄为主对象位置后余 4 行（多图形比较/拼组题），再以 `allShapeSubtypes().length===1` 前置 + judge 整类跳过，6f 由 5 行 FAILED 收敛到 1 行（`math-g3-down-u08-k006`：题面「乒乓球/羽毛球」中的「球」），最终以 `skipPrefix` 构词过滤清零。
- **tests**：
  - 定向：`node --test tests/validator/p45-07-quality-gates.test.js` → **29/29 PASS**。
  - `node dev/p42/check-instance-gates.js` → 1566 题，V 门禁 instance fail=0、fraction fail=0（A 难度 errors=0，B 解析 fail=0）。
  - `node dev/p30/check-generation-failure-classify.js` → Layer A 1566/1566 PASS；Layer B FAILED=0、failedPlan=0、zeroQuestion=0（capacityGap 572 按 FINAL-142 记账）。
  - `npm test` → **993/993 PASS / 0 FAIL**。
  - `node dev/check-all.js` → **33 PASS / 0 FAIL / 1 SKIP / 34 项**（#15 无 Chrome SKIP）；16/17 bundle 重建后一致。
- **risk**：
  - `SHAPE_NOUNS` 为封闭词表，新增图形名（如「扇形」「棱锥」）须同步扩表；未登记图形名不做同名判定（宁缺不误报）。
  - 「球」依赖 `skipPrefix` 排除构词成分，若出现新的「X球」器材词需补前缀；补词只改词表，不改判定逻辑。
  - 题面同时出现多个图形名一律跳过（比较/拼组/推导题），该类图文错配仍只能由 `p45-04-shape-graphic.test.js` 等定向测试兜住。

---

## P45-10 · 2026-11-02 · §4.4-A 解冻修复（X3/X4/X9/C6）+ 全量重验收口

- **modified**：
  - `shared/generator/core/distractors.js`（**新建**，唯一干扰项派生点）：`deriveDistractors(pool, correct, need)` 按答案形态（整数/负数/万/「N 个十和 M 个一」/「N 和 M」/算式/字母公式/数位/单位）派生真实干扰项；无可派生形态返回空数组（保留 3 项，不凑位、不编短语）。
  - `shared/generator/generators/concept-meaning.js`：`finishChoice` 删除 `FILLERS=['以上说法都不对','以上都对']`，改调 `Distractors.deriveDistractors`；X4 接线改为**仅空解析兜底**（已有本题解析不再前置跨 KP 桥接句）；X9 6 处「（参考：…）」删除标签、保留算式（L838/L850/L865/L955/L962/L988）。
  - `shared/generator/generators/semantic-relations.js`：`finishChoice` 删除 `filler='都不对（N）'` 凑位循环，改调 `Distractors.deriveDistractors`；X9 3 处 `。列式：`/`？列式：` 内层改「算式：」（L471-472/L599-600/L751-752）。
  - `shared/generator/generators/stats.js`：judge 题面删除「（标出 Ncm）」；折线统计图 choice 星期选项由 7 收敛为 4（正确项 + 3 个随机干扰星期）。
  - `shared/generator/generators/percent.js`：X9 4 处重复「列式」→ 内层「算式：」（L196/L302/L333/L374）。
  - `shared/generator/core/semantic-parameters.js`：`composeExplanation` 在 `current` 为空时只返回前序引用句，不再拼接悬空桥接句。
  - `tests/generation/p45-10-a-item.test.js`（**新建**）：X3 35 行零凑位、按形态派生、星期 7→4；X4 已有解析不前置桥接；X9 三类脚手架清零；共 7 用例。
  - `tests/generation/p45-03-fraction-format.test.js`：C6 纳入，`KPS` 新增 `math-g6-up-u03-k001`。
  - `tests/generation/p40-t08-explanation-bridge.test.js`：X4 契约变更后同步断言（已有解析不前置桥接 + 空解析兜底 helper），按用户显式裁决改写，非降标准。
  - `tests/generation/p42-2a-teaching-goal-match.test.js`：X9 删除「参考：」标签后 fill scaffold 正则同步为 `/(\d+) − 1 = ____/`。
  - 重跑派生器：`kbl/teaching/variation-profiles.json`（1315 行，生成失败 0）、`kbl/teaching/misconception-profiles.json`。
  - 重冻矩阵：`docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.{json,md}`（1566 行 0 FAIL）、`docs/archive/phases/p30/P30-KP-QT-MAKER-MATRIX.json`（1566 行；target=1219 / format=13 / target-frozen=334）。
  - 重建 `shared/engine/strategy-engine.bundle.js`（66 modules / 4 shims）、`shared/engine/presentation-engine.bundle.js`（18 inlined / 70 delegated）。
  - `docs/P45/P45-TASK-BOOK.md`：§0 增「后续变更」、§4.3 增 X3/X4/X9/C6 行并更新终态、§4.4-A 标记全部解冻修复、§7 与附录 B 状态同步。
- **deleted**：无源码/数据物理删除；`concept-meaning.js`/`semantic-relations.js` 内的凑位短语常量与循环按唯一复现证据删除。
- **reason**：
  - 用户 2026-11-02 显式指令「解冻修复A项，挂起未执行的任务」，并裁决三项口径：**X3 选项数 4 项为常态 + 3 项例外**、**X4 仅空解析时兜底**、**C6 纳入并先量化**。
  - X3 量化发现凑位短语来自两处 `finishChoice`（任务书原记「唯一生产点 concept-meaning」不完整），故抽出 `core/distractors.js` 作为唯一派生点，两处接通，避免第二套实现。
  - 天然三元域（`>`/`<`/`=`、奇/偶/无法确定、方向三选一、三人真话、三色球）按用户口径合法保留 3 项；11 个选项数异常行中仅折线统计图 3 行为 7 项需修。
  - X9「重复列式」8 行唯一拼接点定位为 `percent.js` 4 处 + `semantic-relations.js` 3 处（合计 7 处源码点覆盖 8 行），原「待定位」事项清零。
  - C6 量化结果 0 行真实复现（倒数题已由 `fraction.js::sfs` 约分），按用户裁决以加入 P45-03 KPS 的方式纳入回归防护。
  - 矩阵重冻与派生器重跑依据：题面/选项/解析文案变化改变 1566 行指纹，属既定动作清单；375/98/407/1566 与 7 题型/23 Generator 口径未变。
- **tests**：
  - 定向：`node --test tests/generation/p45-10-a-item.test.js`（7/7）、`p45-03-fraction-format.test.js`、`p40-t08-explanation-bridge.test.js`、`p42-2a-teaching-goal-match.test.js`（合计 15/15 PASS）。
  - `npm test` → **986/986 PASS / 0 FAIL**。
  - `node dev/check-all.js` → **33 PASS / 0 FAIL / 1 SKIP / 34 项**（#15 无 Chrome SKIP；CI 应 34/0/0）；6a/6b/6c/6d/6e/6f/7/8/9/10/11/12/16/17/21/22/23 全 PASS。
  - 冻结复核：`check-generation-matrix-freeze.js --write` → ALLOW rows=1566、FAIL rows=0；`check-kp-qt-maker-matrix.js --write` → 1566 行冻结。
- **risk**：
  - `distractors.js` 为新增共享模块，后续若要扩展形态须在唯一派生点扩，不得在生成器内再写第二套干扰项逻辑。
  - X3 保留 3 项的天然三元域行依赖 Validator/测试识别「天然三元域」口径；后续新增三元域 KP 时须同步登记，避免被误判为选项数异常。
  - X4 契约已收紧为「仅空解析兜底」；若未来下游依赖前置桥接句，须重新裁决并同步 `p40-t08` 契约测试。
  - 1566 行指纹已重冻；后续任一生成器再改题面/选项/解析，必须同范围重跑派生器与重冻矩阵。

---

## P45-DOC-01 · 2026-11-02 · §4.4 挂起/债务/并行通道登记整理（纯文档）

- **modified**：`docs/P45/P45-TASK-BOOK.md` §4.4 重构为五段并统一顺序——A 挂起未执行（X3/X4/X9/C6）→ B 待立项修复（V-D 图文同名校验）→ C 技术债（原 9 项 + 新增「k004 双形态」）→ D 并行通道/双入口（raw 探针第二生成路径、`probeAgg`/`variantAgg` 双机制、`shape.js` 双入口+三来源）→ E「第二套实现」核查结论（生产层无第二套，`answer-validator` 与 `weighing` 不误判）。
- **deleted**：无源码/数据删除；§4.4 原 C 段中与 A 段重复的 V-D 行合并至 B 段（去重登记，不删结论）。
- **reason**：用户指令「整理以上检查内容，延续 P45 的立项，按先后顺序罗列」。本轮只登记核对结果，不构成执行授权，不改生产代码、数据、bundle 或矩阵。
- **tests**：纯文档变更，不触发定向测试、`npm test`、`node dev/check-all.js`；未改 `shared/**`、`kbl/**`、测试与冻结物。
- **risk**：登记册条目仍须逐项按九步流水线单独立项；`k004` 双形态与 `shape.js` 双入口后续若动，须先收敛到单一入口并重跑派生/门禁。

---

## P45-09 · 2026-11-02 · D2 图文不符（问长方形配正方形）修复 + T2 锚随合法形态更新 + 全量重验收口

- **modified**：
  - `shared/generator/generators/shape.js`（D2 唯一修复位置，用户授权）：`themedItemMeta` 移除「条目未自声明 `item.shape` 即早退」门槛，先按题面主问对象经 `stemGraphicPlan` 派生描述符（题面点名图形优先于 KP 名首命中）；补 `item.shape &&` 空值保护（`typeof null==='object'` 曾致 38 行 gen-error）；`stemLengths` 剔除「周长…」时补排「、」，避免把「周长 24 厘米、长 8 厘米」整段删除导致尺寸失联；apply 分支在无 `applyGraphic`/`sItem.g` 时同样按题面派生图形（此前绕过 `themedItemMeta` 仍配 `square`）。
  - `dev/p25/derive-evidence-candidates.js`：原始形态探针由「仅单样本行 + 仅 subtype 多值」扩为「全部 `generator:shape-recognition` 行 + `data.graphic.*` 全字段」——同时采集「值多值」（`rawVariantPaths`，降级 `fieldPresent`）与「仅部分原始产出存在」（`rawAbsentPaths`，并入 `absentInSome`）；探针走生成器契约 raw 输出（`StrategyEngine.plan` + `GeneratorSelector` + `gen.generate`，冻结 seed `freeze:p28-v1|<kp>|<qt>|d3`），不经 `PracticeSession` 证据过滤。
  - `dev/p25/apply-evidence-candidates.js`：新增两条合并口径——① `absentInSome` 路径删除任何 kind 断言（存在性/取值均不安全，如 ruler 形态无 `params.length`、circle 无 `params.labelSides`）；② 候选对该枚举字段完全无断言、但该路径在全部样本存在时，既有 `field` 值断言降级为 `fieldPresent`（D2 后同一 KP×QT 的 `subtype/shapeName` 合法多形态）。
  - `kbl/teaching/evidence-rules.json`：由派生器两次 apply 写入，累计 **43 行变更**（全部 `generator:shape-recognition`）：**43 条 `field` 值断言降级 `fieldPresent`**（`data.graphic.subtype` 等）、**删除 4 条存在性断言**（`data.graphic.params.length` ×3、`data.graphic.params.labelSides` ×1）；总规则行 1562 / 覆盖 KP 374 / `schemaVersion p26-evidence.3` 不变。
  - `kbl/teaching/variation-profiles.json`：`dev/p27/derive-variation-profiles.js` 随图形描述符变化重跑（1315 行，生成失败 0）。
  - `tests/generation/p45-04-shape-graphic.test.js`：按新口径重写两条断言（不删用例）——k001 `geometry` 由「暂搁置保持 square」改为「按题面主问对象派生 rectangle + 题面含长方形」；k004 `geometry` 由「一律 line-segment」改为「图文一致：线段→line-segment，刻度尺→ruler 且 params.from/to 存在」。
  - 重冻/重生成：`docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.{json,md}`（1566 行 0 FAIL）、`docs/archive/phases/p28/P28-GENERATOR-MATRIX.{json,md}`（23 Generator，FAIL 0）、`docs/archive/phases/p30/P30-KP-QT-MAKER-MATRIX.json`（1566 行冻结）。
  - 重建 `shared/engine/strategy-engine.bundle.js`（65 modules / 4 shims）、`shared/engine/presentation-engine.bundle.js`（18 inlined / 69 delegated）；门禁 16/17 PASS。
- **deleted**：无源码/数据删除；`evidence-rules.json` 内 4 条不安全的 `fieldPresent` 断言按派生证据删除（见上）。
- **reason**：
  - 用户本轮显式指令「授权修复D2」「继续任务」。D2 根因 R5：图形 subtype 由 KP 名称首命中派生（`NAME_TO_SHAPE`/`getShapeMeta` 顺序敏感），题面问长方形（`math-g3-down-u03-k001`「长方形有____个直角」）却配 `subtype:square`。
  - 修复必须在 Generator 层完成（题面主问对象是生成侧已知语义），SVG 不得反推题目；同时 T2 锚不得 AI 手编，故扩既有 `dev/p25/*` 派生链：D2 后同一 KP×QT 出现多种合法图形形态（命名 rectangle/cube、计数/刻度尺/圆），把 subtype/shapeName 冻结为单值锚必在生产 seed 下误报（6f Layer B 曾回归 FAILED 9 行）。
  - `PracticeSession` 是证据过滤后的视图，单看主样本无法发现「被当前锚拒绝的另一合法形态」；故派生器改为读取生成器 raw 契约输出采集图形字段证据，这是 T2 数据可再生的必要条件，不新增第二条派生链。
  - 测试断言改写依据：D2 已从「用户裁决搁置」转为「已授权修复」，旧断言前提失效；按 P30/P31 规则重写为修复后口径（保留用例，不删除失败断言）。
  - 矩阵重冻依据：shape.js 产出形态与描述符变化改变 1566 行指纹，属既定动作清单；375/98/407/1566 与 7 题型/23 Generator 口径未变。
- **tests**：
  - D2 定点复现（`freeze:p28-v1|math-g3-down-u03-k001|<qt>|d3`）：修复前 `geometry` 配 `square`；修复后 `fill`/`geometry` 均 `subtype:rectangle`、题面含「长方形」、`SvgRegistry.renderFor` = **SUCCESS**。
  - `node dev/p25/derive-evidence-candidates.js` → 1315 行，`{"pass":5248,"warn":0,"skip":0,"fail":0}`，生成失败 0、无样本 0、意图矛盾 0；`counter-sample-downgraded` 130→137 行。
  - `node dev/p25/apply-evidence-candidates.js --refresh-value-drift=generator:shape-recognition` → 累计 **43 行变更 / 43 条值降级 / 4 条存在性断言删除**；重复执行幂等（0 变更）。
  - `node dev/p30/check-generation-failure-classify.js`（6f）→ Layer A **1566 PASS / 0 FAIL**；Layer B `{"SUCCESS":994,"PARTIAL":572,"FAILED":0,"exception":0}`，failedPlan 0 / zeroQuestion 0（capacityGap 572 按 FINAL-142 记账不判 FAIL）。
  - `node dev/check-educational-generation.js`（7）→ **SEMANTIC_PASS 936 / FAIL 0**。
  - `node dev/p27/derive-variation-profiles.js` → 1315 行、生成失败 0；`node dev/p27/check-variation-drift.js` → 硬违例 0 / 软报告 0（PASS）。
  - `node dev/p28/check-generation-matrix-freeze.js --write`（6b）→ 重冻后 **1566 行 0 FAIL**；`node dev/p30/check-kp-qt-maker-matrix.js --write`（6e）→ 1566 行冻结；`node dev/p28/check-generator-matrix.js --write`（6c）→ **23 Generator / PRODUCTION 20 / COMBINE-ONLY 1 / DORMANT-CARRIER 2 / FAIL 0**。
  - `npm test` → **978 例 / 978 PASS / 0 FAIL**。
  - `node dev/check-all.js` → **33 PASS / 0 FAIL / 1 SKIP / 34 项**（#15 真实浏览器 E2E 本机无 Chrome SKIP，不计作 PASS；CI 设 `CHROME_BIN` 应为 34/0/0）。
  - 口径对账：`kbl/manifest/manifest.json` → **375 KP / 98 Units / 407 Relations / 1566 mappings**；23 Generator、7 题型不变。
- **risk**：
  - 派生器原始形态探针读取生成器 raw 契约（`Generator.generate` 直出），与「一切以 PracticeSession 真实 Pipeline 为口径」的既有约定存在耦合；探针仅用于「证明非恒定量/非恒存在」，不放宽生产 Validator。**登记技术债**。
  - 探针范围由「单样本行」扩到全部 `generator:shape-recognition` 行（约 265 行 ×1 次 raw 生成），派生器耗时上升；后续该生成器再改产出形态须重跑 derive + 显式 scope 合并。
  - 43 条 `subtype` 值锚降级为存在性锚（`shapeName` 值锚保留）：若生成器再产出新的 `shapeName` 文本形态或新图形字段，仍会重新触发证据误报。
  - V-D 至今**没有**「题面图形名 ≠ 描述符同名」校验（P45-07 为避开 D2 误报未实现该条）；D2 虽已修，该类回归仍只能靠定向测试 `p45-04` 捕获，**登记待立项**（启用须同时补 Validator 代码 + 定向测试 + 全量 1566 验证）。
  - 6f Layer B capacityGap 由 572 行、shape-recognition 268（较上轮 265 有 3 行形态变化），属行为空间计数，不判 FAIL。

---

## P45-08 · 2026-11-01 · T2 锚随计数子类型更新 + 1566 全量重验 + 矩阵重冻收口

- **modified**：
  - `dev/p25/derive-evidence-candidates.js`：① 主采样补确定性 seed（`p25-derive|<kp>|<qt>`）；② 失败行/单样本行追加 10 个固定 seed 的变体采样（`VARIANT_PROBE_SEEDS`），新增 `variantAgg / variantStatus`，产出 `counter-sample-downgraded:<path>`（值非恒定）与 `variant-absent:<path>`（该形态无此字段）两类证据标记。
  - `dev/p25/apply-evidence-candidates.js`：新增 `--refresh-value-drift=<gen...>`——按上述证据把既有规则中「值非恒定」的 `field` 断言**原位降级**为 `fieldPresent`、把「该形态不存在」的 `field` 断言删除，其余断言与 `forbidden` 原样保留（不整行替换）；并修正证据标记前缀拼写（演示实测曾误写为 `counter-sample-dowgraded`，导致分支 0 命中）。
  - `dev/check-educational-generation.js`：门禁 7 的 PracticeSession 补固定 seed（`edu|<kp>|<qt>`）——此前无 seed，同一代码两次运行可得 934/2 FAIL 与 936/0 PASS 交替，门禁不可复现。
  - `kbl/teaching/evidence-rules.json`：由上述两个派生脚本写入，实际变更 **1 行**——`math-g4-up-u02-k001|fill` 的 `field:data.graphic.subtype=angle` 降级为 `fieldPresent:data.graphic.subtype`（`data.graphic.role` 同步），其余 1561 行不变；`note` 追加 P45-08 口径。
  - 重冻/重生成（P45-01～06 产出变化的既定动作）：`docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.{json,md}`、`docs/archive/phases/p28/P28-GENERATOR-MATRIX.{json,md}`、`docs/archive/phases/p30/P30-KP-QT-MAKER-MATRIX.json`。
  - 重建 `shared/engine/presentation-engine.bundle.js`、`shared/engine/strategy-engine.bundle.js`（P45-07 已重建，本轮 16/17 只读复核一致，未再改动）。
- **deleted**：无（无重复层、无死代码；既有 `--refresh-stale-fields` 路径与本轮新参数互不借用）。
- **reason**：
  - 用户本轮裁决：「保留 count 子类型，改 T2 锚」「补固定 seed（推荐）」。P45-01 在 `shape.js::makeCountQuestion` 新增 `subtype:'count'` 描述符后，同一 `KP×QT` 存在两种合法形态（命名 `angle` / 计数 `count`）；T2 锚固化为 `subtype=angle` 必使计数形态误报。
  - 修复位置唯一：T2 数据只允许派生器写入，故在 `dev/p25/*` 扩证据采集与合并口径，不手编 JSON、不改图形子类型、不改题型/答案/难度。
  - 变体采样触发条件从「基线已失败」扩到「基线失败 **或** 主窗口样本 < 2」：单样本恒等于自身，无法证明结构恒定量；`math-g4-up-u02-k001|fill` 主窗口因去重只得到 1 题，故此前无法被挑战。
  - 门禁 7 非确定性属门禁自身缺陷（同一代码两结果），补固定 seed 后与既有报告逐行可对账；未改判定标准。
  - 矩阵重冻依据：P45-01（计数描述符）、P45-01/02/04/05（stats/shape/money 图形）、P45-06（judge 题干消解空位）均改变 1566 行产出指纹，属 `docs/00-BASELINE.md` 外的派生变化，按既定动作清单重冻，不改 ALLOW/KP/题型口径。
- **tests**：
  - `node dev/p25/derive-evidence-candidates.js` → 1315 行，**基线证据 fail = 0**（`pass 5248 / warn 0 / skip 0 / fail 0`），生成失败 0、意图矛盾 0；`counter-sample-downgraded` 标记 103 行（单样本窗口扩采样后新增）。
  - `node dev/p25/apply-evidence-candidates.js --refresh-value-drift=generator:shape-recognition` → 值漂移降级断言 **1 条**（重复执行 0 条，幂等）。
  - `node dev/check-generation-failure-classify.js`（6f）→ Layer A **1566 PASS / 0 FAIL**，Layer B **FAILED 0 / zeroQuestion 0**（capacityGap 572 行为能力记账，按 FINAL-142 不判 FAIL）。
  - `node dev/check-educational-generation.js`（7）→ **SEMANTIC_PASS 936 / FAIL 0**。
  - `node dev/p28/check-generation-matrix-freeze.js`（6b）→ 重冻后 **1566 行 0 FAIL**，只读复核与冻结产物一致（git diff = 0）。
  - `node dev/p30/check-kp-qt-maker-matrix.js`（6e）、`node dev/p28/check-generator-matrix.js`（6c）→ 重冻后 PASS（23 个 Generator / PRODUCTION 20 / COMBINE-ONLY 1 / DORMANT-CARRIER 2）。
  - `npm test` → **978 例 / 978 PASS / 0 FAIL**（此前唯一 FAIL 的 `p25-17-anti-regression` 因 `semanticFail=0` 恢复通过）。
  - `node dev/check-all.js` → **33 PASS / 0 FAIL / 1 SKIP / 34 项**（第 15 项真实浏览器 E2E 因本机无 Chrome SKIP，不计作 PASS；CI 设 `CHROME_BIN` 应为 34/0/0）。
  - 口径对账：`kbl/manifest/manifest.json` → **375 KP / 98 Units / 407 Relations / 1566 mappings**；题型 7 类、Generator 23 个不变。
- **risk**：
  - `derive-evidence-candidates.js` 内既有的 `probeVaries` 前缀错位（`probeAgg` 键无 `data.` 前缀，而断言路径带前缀）仍未修，属历史遗留；本轮以独立 `variantAgg`（键归一化后匹配）绕过，未顺手改动以免大面积锚点漂移。**登记遗留项**，后续如需清理须单独任务 + 全量锚点对账。
  - 变体采样扩到 325 个单样本行，派生器耗时上升（本轮全量派生明显变长）；仅 1 行实际发生锚点变更，其余行的降级标记未被 `--refresh-value-drift` 命中（既有规则本就未断言这些路径或已是 `fieldPresent`）。
  - 门禁 7 报告因固定 seed 与历史非确定窗口不可逐行对账，属口径修正而非标准放宽。
  - 若后续生成器再改变同一 `KP×QT` 的产出形态，须重跑派生 + 显式 scope 合并；否则新形态会再次撞上值断言。
  - P45-07 记录中的 `check-all` 中间态数字（29 PASS / 4 FAIL / 1 SKIP）由本条最终口径（33/0/1/34 项）取代；历史记录不改写。


---

## P45-07 · 2026-11-01 · Validator V-A～V-E 实例一致性门禁（对 1566 全量零误报）

- **modified**：
  - `shared/validator/answer-validator.js`：新增常量 `JUDGE_BLANK_RE / INNER_PAREN_RE`、`stripTrailingJudgeBracket` 与 **`validateInstanceConsistency(sq)`**（V-A 图元计数、V-B 答案形态、V-D 描述符/题面、V-E 判断题空位），在 `validateAnswer` 末尾接入 `errors.push.apply(errors, validateInstanceConsistency(sq))`（Layer 1 → `generationPass=false` 触发重生成），并导出该函数。V-A/V-B 用 `ANSWER_MISMATCH`、V-D 用 `GRAPHIC_INVALID`、V-E 用 `STRUCTURE_INVALID`，均 `SEVERITY.ERROR`。
  - `shared/validator/quality-scorer.js`：新增 `gcd` 与 **`checkFractionForm(sq)`**（V-C：分母 1 恒禁；非互质仅对 `calc`），接入 `scoreQuestion` 的 `details.fractionForm`（不改加权总分），并导出。
  - `dev/p42/check-instance-gates.js`（门禁 23）：`classifyQuestion` 增加 V 门禁两段（`AV.validateInstanceConsistency` + `QS.checkFractionForm`），`stats/vGates` 输出 `instanceFailN / fractionFailN`，纳入 `failTotal` 与证据 JSON。
  - 新增 `tests/validator/p45-07-quality-gates.test.js`（22 例）：V-A~V-E 每条均「缺陷构造 100% 命中 + 通过形态零误报」；`validateAnswer` 接线证据；V-D 作用域守卫（主题图标 `width+size` 归一化参数不按题面尺寸判定）；10 条真实登记行经 PracticeSession（seed `p42|<kp>|<qt>|d3`）零违规。
  - 重建 `shared/engine/presentation-engine.bundle.js`（18 inlined / 69 delegated）、`shared/engine/strategy-engine.bundle.js`（65 modules / 4 shims）——Validator 两文件由 presentation bundle 内联，PracticeSession/门禁 23 走 bundle 口径。
- **deleted**：无。
- **reason**：
  - 任务书 §3 要求五条门禁分别验收（A 类只验图元计数、D 类只验图形语义/尺寸，禁止合并成单一 `fixGraphic()`）。本轮全部落在 Validator 唯一责任模块，未改题面/答案/题型/难度/图形生成。
  - V-A 只消费 Generator 已写出的 `data.figureCount`（P45-01 四值同源），Validator 只比对，不重算图元。
  - V-B 只消费 Generator 已写出的 `data.answerForm`（P45-02 产出、注释即「P45-07 接通」）；不按题干关键词宽扫——避免 `math-g4-up-u06-k001 classify` 六行（分类题干含「多多少」）误报。
  - V-C 收窄为「`answer.value` 为纯分数形态」：分母 1 恒禁；非互质仅 `calc`。`fill/choice` 的 `3/9`（「把单位 1 平均分成 9 份，表示这样 3 份」/分数单位题）是表意本身，约分反而错，不纳入门禁。
  - V-D 只做三类可判定比对：D5 装饰指纹（`rectangle width:8 height:3 labelSides:false`）、ruler `params.from/to` 与题面两处刻度、长方形/正方形尺寸**仅当描述符已是题面同名 subtype** 时校验；后者用于避开 `math-g3-down-u03-k003`（长方形题配 `square` 描述符）这一 R5/D2 用户已裁决搁置议题，否则会误报 24 行。
  - V-E 口径与 P45-06 一致：尾部「（  ）」是判断题标准作答括号，剥离后再判 `____` / 内部空括号；`fill` 的 `____` 不纳入 V-E。
  - 探针口径修正：直连原始生成器拿不到 `TypeContract.enforce` 收口结果，一切零误报证据均以 PracticeSession（真实 Pipeline）为口径。
- **tests**：
  - `node --test tests/validator/p45-07-quality-gates.test.js` → **22/22 PASS**。
  - `node dev/p42/check-instance-gates.js`（门禁 23）→ **1566 行，生成异常 0；A 难度完整性 errors=0 / warnings=0；B 解析质量 pass=1550 / watch=16 / fail=0；V 实例一致性（V-A/V-B/V-D/V-E）fail=0；V-C 分数形态 fail=0；FAIL 合计 0**。证据写 `dev/p42/out/p42-4-instance-gate.json`。
  - `npm test` → **978 例 / 977 PASS / 1 FAIL**，唯一 FAIL 为 `tests/generation/p25-17-anti-regression.test.js`（断言 `educational-generation-report.json` 的 `semanticFail===0`，根因 u02 遗留 1 行，与 P45-05 基线同源、与本轮改动无关）。
  - `node dev/check-all.js` → **29 PASS / 4 FAIL / 1 SKIP**（本次 FAIL 6b/6e/6f/7；6b/6e 属矩阵冻结，按用户指令统一推迟到 P45-08 重冻；6f/7 为 `math-g4-up-u02-k001/k003 fill` R5 遗留）。对比 P45-05 记录 27 PASS / 6 FAIL / 1 SKIP，2（KBL）/5（Unit）已恢复 PASS；12 Security、23 Instance、6a、6g、16/17 全 PASS。
- **risk**：
  - V-B 依赖 Generator 写 `data.answerForm`；未写该字段的旧产出不受门禁保护（当前仅 stats 条形图族使用，已登记）。
  - V-D 刻意不校验「题面图形名 ≠ 描述符同名」形态（R5/D2 搁置），该议题修复前此门禁不覆盖该类；`geometry.parallelogram` 等未登记子类型未做注册集合硬拦截（schema 已有 WARNING）。
  - Validator 代码被 presentation bundle 内联：任何后续 Validator 改动必须重建 bundle，否则生产链/门禁 23 仍跑旧逻辑。
  - 6b/6e 矩阵冻结仍为 FAIL，P45-08 统一重冻；6f/7 在 u02 遗留处置前无法清零。

---

## P45-06 · 2026-11-01 · E 类（E1）：判断题题干消解填空式空位（含 money.js:325 同源生产点核查）

- **modified**：
  - `shared/generator/core/type-contract.js::finishJudge`：拟展示结果 `shownStr` 确定后，先把题干中的 `____` / `()` / `（ ）` 替换为拟展示数值（题干自带单位保留），再进入原有「= ?」/「= 」/「…有人说结果是…」三分支。对错值判定（`shown === an.num`）、`data.shownResult/expectedResult`、解析与错因链路不变。
  - 新增 `tests/generation/p45-06-judge-blank.test.js`：① 全量 judge ALLOW 行（p28-v1 冻结 seed）题干零 `____`；② 单位换算 judge 的题干说法数值 = `data.shownResult`、题干单位 = `data.toUnit`、`answer.value === (shownResult === expectedResult)`；③ 作用域守卫：fill 换算题仍保留作答空位。
  - 重建 `shared/engine/strategy-engine.bundle.js`（65 modules / 4 shims）、`shared/engine/presentation-engine.bundle.js`（18 inlined / 69 delegated）。
- **deleted**：无。
- **reason**：
  - 用户指令：「P45-06 必须核查 money.js:325，不能遗漏同源生产点」。核查结论：`money.js:325` 区段的 judge 分支 `prompt = '判断对错：' + baseValue + fromUnit + ' = ____ ' + toUnit` 是 E1 的唯一同源生产点（6 行单位换算 judge），与 `finishFill` 复用了同一填空句式；`finishJudge` 的数值分支未消解空位，导致题干残留 `____`。
  - 修复位置唯一：判断题形态收口在 `type-contract.js::finishJudge`（题型契约 SSOT），不在 money.js 内改题面（避免各生成器各自消解空位）。未改题型、答案、难度、图形。
  - 「（  ）」为判断题标准作答括号，不属于 E1 的填空式空位，测试口径只判 `____`；两行概念型 judge（面积/角）保留 `（  ）`。
- **tests**：
  - `node --test tests/generation/p45-06-judge-blank.test.js` → **3/3 PASS**（修复前 6 行全部命中 `____`，修复后 0）。
  - `node dev/p32/check-answer-leak.js`（6g）→ **PASS**（L1 135/135、L2 651/651 SUCCESS、text 34 全登记、自判回放 TRUE 1481 / FALSE 0 / NULL 85）——题干新增说法数值未触发新的泄露命中。
  - `node dev/p30/check-generation-failure-classify.js`（6f）→ Layer A **1565 PASS / 1 FAIL**、Layer B **FAILED 2**（与修复前同值，未恶化）。
  - `node dev/check-educational-generation.js`（7）→ **SEMANTIC_FAIL 1**（`math-g4-up-u02-k001 fill`，与本轮无关遗留）。
- **risk**：
  - 判断题题干文案变化 → 6b 矩阵行指纹变化，统一在 **P45-08** 重冻。
  - 真命题题干会显示正确结果数值（判断题固有形态：说法本身即待判内容），6g L1 对布尔答案不按数值判泄露，已验证 PASS。

---

## P45-05 · 2026-11-01 · D5 收口：T2 evidence 锚随派生链更新（收窄刷新，解除 `unit=cm` 占位）

- **modified**：
  - `dev/p25/apply-evidence-candidates.js`：`--refresh-stale-fields` 改为必须显式给出生成器范围（`--refresh-stale-fields=<gen...>`），仅当该行**全部真实生成器**命中范围且旧 `required` 引用候选已不存在的字段路径时才原子替换该行。无范围参数即不刷新（无范围直接报错退出）。收窄原因：上一次无范围刷新 82 行，波及 56 行 `generator:shape-recognition`（样本波动/历史遗留路径），6f Layer B 由 2 FAILED 恶化到 6 FAILED，已回滚。
  - `kbl/teaching/evidence-rules.json`：按 `--refresh-stale-fields=generator:money-measurement` 刷新 **11 行**（`math-g3-up-u04-k002/k003` × calc/fill/choice/apply + `math-g3-up-u04-k004` × fill/choice/apply）。旧锚 `data.graphic.params.unit=cm` / `unitPx=30` 被替换为当前派生的 `data.graphic.subtype=weighing` / `data.graphic.role=quantity-correspondence` / `data.graphic.params.hint`（apply=`相差 ? 千克`、其余=`单位换算`）。其余 71 行 stale 路径（`labelSides`/`length`/`angle`/`steps`/`correctIndex`/`shownAnswer` 等）**本轮不动**。
  - `shared/generator/generators/money.js`：质量族 `massParams` 去掉占位 `unit:'cm'/unitPx:30`，单位只写进 `leftLabel/rightLabel` 文案（与题面单位同源）。
  - `tests/generation/p45-05-money-graphic.test.js`：不变量 #3 与两处断言由「必须含 `unit=cm/unitPx=30`」改为「不得含固定 `unit/unitPx`」。
  - `kbl/teaching/variation-profiles.json`：按去占位后的产出重跑 `dev/p27/derive-variation-profiles.js` 再生（1315 行 / 生成失败 0）。
- **deleted**：无。
- **reason**：
  - 用户指令：「根据我的具体指令推进。SVG根据需求新增。T2锚进行更新修改，重冻矩阵根据修复完成再冻结。」——解除上一轮「不改锚、只登记」裁决：质量族锚不再用 `unit=cm` 占位迁就旧锚，而是随派生链更新到与题面同源的 `weighing` 语义。
  - 仍遵守 T2 铁律：未手编 JSON，写入路径只有既有派生器 `derive-evidence-candidates.js` → `apply-evidence-candidates.js`；刷新条件按真实生成器收窄，避免连锁改无关生成器锚（红线「禁止无限审计/连锁修复」）。
  - 矩阵重冻（6b/6e）按指令继续推迟到 **P45-08** 全部修复完成后统一执行。
- **tests**：
  - `node dev/p25/derive-evidence-candidates.js` → 质量 12 行候选为 `weighing` 语义（无 `unit/unitPx`）；`node dev/p25/apply-evidence-candidates.js --refresh-stale-fields=generator:money-measurement` → 字段锚刷新 11 行、死规则剔除 0、键冲突跳过 1304。
  - `node dev/check-educational-generation.js`（7）→ **SEMANTIC_PASS 935 / SEMANTIC_FAIL 1**（仅剩 `math-g4-up-u02-k001 fill`，与 P45 立项基线同源遗留）。
  - `node dev/p30/check-generation-failure-classify.js`（6f）→ Layer A **1565 PASS / 1 FAIL**、Layer B **FAILED 2**（`math-g4-up-u02-k001/k003 fill`），与回滚基线一致（刷新前同值）。
  - `node dev/p27/derive-variation-profiles.js` → 1315 行 / 0 失败；`node dev/p27/check-variation-drift.js` → **PASS**（硬违例 0 / 软报告 0）；`node --test tests/generation/p27-variation-profile.test.js` → **9/9 PASS**。
  - `node dev/p32/check-answer-leak.js`（6g）→ **PASS**（L1 135/135 白名单、L2 651/651 SUCCESS、text 34 全登记、自判回放 TRUE 1481 / FALSE 0）。
  - `node --test tests/generation/p45-05-money-graphic.test.js` → **4/4 PASS**。
  - `npm test` → **952 / 953**，唯一 FAIL 为 `tests/generation/p25-17-anti-regression.test.js`（读取 `educational-generation-report.json` 断言 `semanticFail === 0`），根因是 u02 遗留 1 行，与本轮改动无关。
  - `node dev/check-all.js` → **27 PASS / 6 FAIL / 1 SKIP**：2 KBL / 5 Unit / 7（同 u02 遗留）、6b / 6e（待 P45-08 重冻）、6f（同 u02 遗留）；6a/6c/6d/6g/8/16/17 全 PASS。
- **risk**：
  - `evidence-rules.json` 质量 11 行锚已按当前产出固定；P45-06/07 若再改质量族描述符，必须重跑 `derive-evidence-candidates.js` + 同范围 `--refresh-stale-fields`，否则 7/6f 会重新 fail。
  - `--refresh-stale-fields` 现为严格模式（无范围即报错），历史调用方式（无范围）不再可用；该脚本仅开发期使用，无运行时消费者。
  - 6f/7 仍有 `math-g4-up-u02-k001/k003 fill` 1 行遗留（shape-recognition 同 KP 下「认图/计数」随机分支与单一 `subtype=anchor` 冲突，属生成分支确定性议题 R5，此前用户裁决搁置）；3 项门禁（2/5/7）在该行修复前无法清零，需在 P45-06/07 阶段确认处置口径。

---

## P45-05 · 2026-11-01 · D 类（D4/D5）：money 图形与题面同源（面积参数化 / 人民币·面积·称重必配图）

- **modified**：
  - `shared/generator/generators/money.js`：
    - `makeMeasurementConversionQuestion` 写入 `data.value`（与题面同一 RNG 源的原值），供换算类图形标注；不改题面/答案。
    - `makeWordProblemQuestion` 长度 apply 写入 `data.total/part`、质量 apply 写入 `data.m1/m2`；面积 apply 保留 `width/height`。
    - `makeGraphicForMoney` 重写为按度量种类派生「与题面同源」图形：`rmb → calculation/rmb`（与题干金额同源）；`area` 乘法 → `geometry/rectangle` + `width/height` + `labelSides:true`；`area` 换算 → `rectangle` + `width=value/height=1` + 仅标宽；`mass` → `geometry/weighing`（左盘 `value+fromUnit` / 右盘 `? toUnit` 或 `大米 m1 千克 / 面粉 m2 千克`）；`length` → `geometry/ruler`（`to` 取 `total` 或换算原值）。容量/时间族无绑定 KP，保持不挂图。
  - `shared/svg/svg-geometry.js`：按用户显式指令「若无现成SVG，需要根据需求新建」新增 `weighing(o)` 天平示意图渲染（两盘标题干已知重量 + `hint`，不给出差值），导出对象登记 `weighing`。既有 `SVGDiagram.balance` 语义为「左已知右未知补偿」，不适用于质量换算/比较题，未复用。
  - `shared/schemas/semantic-question.schema.js`：`GRAPHIC_SUBTYPES.geometry` 登记在产子类型 `weighing`。
  - `tests/generation/p45-05-money-graphic.test.js` 重写：D4 面积 apply 断言图形长宽=题面长宽、`labelSides:true`、渲染 SUCCESS、SVG 含 `Xcm/Ycm`；D5 遍历 9 个度量 KP × fill/choice/judge/calc/apply × d1/d3 × 3 题，断言无固定装饰图（`rectangle width:8 height:3 labelSides:false`）、每行必有可渲染图形、换算/比较/长度数值与题面同源、质量族保留 T2 锚字段。
  - `dev/p32/check-answer-leak.js`：登记 4 条 P45-05 首产 L2 命中（3 条 `GRAPHIC-TICK` 刻度尺刻度编号巧合 + 1 条 `GRAPHIC-COINCIDENCE` 称重图已知重量与答案巧合）。
  - 重建 `shared/engine/strategy-engine.bundle.js`、`shared/engine/presentation-engine.bundle.js`。
  - `kbl/teaching/variation-profiles.json`：按改后产出重跑 `dev/p27/derive-variation-profiles.js` 再生（representation 轴随图形描述符同步；1315 行、0 生成失败）。
- **deleted**：无（未留兼容壳/别名）。
- **reason**：
  - 用户裁决：「D4直接进行修复。D5人民币、面积必须配图。称重实践必须配图，若无现成SVG，需要根据需求新建。若有规则冲突，罗列表格。完全修复后再改6g。」
  - D4 根因：面积 apply 曾挂固定装饰矩形（`width:8,height:3,labelSides:false`），与题面长宽不符；现按题面参数化。复现→修复证据：`math-g3-down-u04-k004 apply`「长 10 厘米、宽 7 厘米」→ `rectangle params.width=10,height=7,labelSides=true`，渲染 SUCCESS 并标 `10cm/7cm`；`k002 apply` 同口径（11/3）。
  - D5 根因：9 个度量 KP 的非 geometry 行在 T2 `qt-intent.json` 为 `graphicRole=auxiliary`，`kp-semantic-validator` 强制必须含图；此前这些行无图形 → 33 行生成失败（6g GEN-FAIL「该配置下没有可生成的题目」）。修复后按 kind 派生同源图形，**GEN-FAIL 33 → 0**，未改 T2 数据、未降 Validator 标准。
  - 6g 处置顺序按用户指令：先完成产品侧修复，再登记剩余 4 条已逐行复现确认为「题干已知量/刻度固有编号与答案数值巧合」的 L2 命中，不以前置白名单掩盖生成断裂。
- **规则冲突表**：

  | # | 冲突点 | 规则依据 | 本轮处置 |
  |---|---|---|---|
  | 1 | 质量族 evidence 锚强制 `data.graphic.params.unit=cm` / `unitPx=30`，与质量单位（克/千克/吨）语义不符 | T2 `evidence-rules.json` 锚（只可由派生器/人工评审写入）；用户既有裁决「不改锚」 | 为满足锚写入 `unit:'cm'/unitPx:30`，`weighing` 渲染不消费；登记为待派生刷新项，不改 T2 |
  | 2 | 审计建议「换算题不挂装饰图（graphic=null）」与 T2 `graphicRole=auxiliary` 强制配图直接冲突 | `kp-semantic-validator.checkIntentAlignment` ERROR；用户指令「D5 必须配图」 | 以 T2 数据层为准：按 kind 派生同源有意义图形，不置 null、不靠白名单绕过 |
  | 3 | P30/P31 红线「SVG renderer 禁改」 | `.trae/rules/p31-layout-rules.md` §7.5 | 用户显式指令覆盖（红线唯一允许偏离项）：在既有 `svg-geometry.js` 内新增 `weighing` 子类型，未新建渲染系统/顶层目录 |
  | 4 | 「1570 行任一行产出变化 → 立即重冻矩阵」与 P45 分阶段收口 | `.trae/rules/p30-repair-rules.md` §9 | 与 P45-02/04 同口径，矩阵重冻统一在 **P45-08** 执行，本轮不分散收口 |
  | 5 | 6g「未登记命中 = FAIL」与「完全修复后再改6g」 | `dev/p32/check-answer-leak.js` 头注释 | 先清零 GEN-FAIL，再对 4 条已确认巧合命中登记；未改判定规则/边界匹配/自判回放 |

- **tests**：
  - `node --test tests/generation/p45-05-money-graphic.test.js tests/presentation/svg-contract-full.test.js tests/presentation/graphic-renderer.test.js` → **20/20 PASS**（P45-05 4 项 + SVG 契约/渲染 16 项）。
  - `node dev/p28/check-generator-noninterference.js`（6d）→ **PASS**（fail=0 static=0）。
  - `node dev/p27/derive-variation-profiles.js` → 1315 行、生成失败 0；`node dev/p27/check-variation-drift.js` → **PASS**（硬违例 0）。
  - `node dev/p32/check-answer-leak.js`（6g）→ **PASS**：L1 135 命中全部白名单、L2 渲染 651/651 SUCCESS 且 text 命中 34 全部登记、L3/L4 PASS、自判回放 TRUE 1481 / FALSE 0 / NULL 85。
  - `npm test` → **953 / 953 PASS / 0 FAIL**。
  - `node dev/check-all.js` → **27 PASS / 6 FAIL / 1 SKIP**：2 KBL(M0，edu-gen 退出码 1)、5 Unit（同源反回归读 report）、6b 矩阵冻结（19 处差异，含本任务度量行）、6e Maker 分工矩阵（待重冻）、6f（`math-g4-up-u02-k001/k003 fill` 锚遗留）、7 Education（同锚遗留）；**6g 由 FAIL 转 PASS**。
- **risk**：
  - 度量族图形描述符结构变化 → 6b/6e 漂移，统一在 **P45-08** 重冻（`check-generation-matrix-frozen --write` + 重生成 GENERATOR-MATRIX + `check-kp-qt-maker-matrix --write`）。
  - `variation-profiles.json` 已按改后产出再生；P45-06/07 若再改产出，须在 P45-08 前再跑一次派生器。
  - 质量族 `unit:'cm'` 为满足 T2 锚的占位（渲染不消费），存在语义冗余；修复方式只能是更新 evidence 派生锚，因用户裁决「不改锚」本轮仅登记。
  - 刻度尺显示全部刻度编号属读数结构，任何 0..总长 的整数答案都会与某刻度编号同值 → 6g L2 命中为结构性巧合，已按 `GRAPHIC-TICK` 登记，后续扩展度量 KP 时需沿用同口径。
  - 遗留不变：D2 搁置；P45-01 evidence 锚遗留继续使 2/5/6f/7 在「匹配锚/不匹配」间波动。

---

## P45-02 · 2026-11-01 · B 类（B1/B2/B3）：条形图设问—答案—选项三口径一致

- **modified**：
  - `shared/generator/generators/stats.js::makeStatsQuestion` 条形图题族（`bar-chart` / `chart-read` 分支）：
    - 新增 `barDiff = hiBar.value − loBar.value`，`BAR_Q` 三项改为设问与答案同源——`哪个年级的人数最多？比人数最少的年级多多少人？` → `最多年级，差值人`；`哪个年级的人数最少？比人数最多的年级少多少人？` → `最少年级，差值人`；`人数最多的年级比最少的年级多多少人？` → `差值人`。
    - choice 分支：差值题选项 `[diff, diff+1, diff+2, diff+3]人`；组合题选项 `[正确(年级，diff人), 另一极端年级（diff人）, 正确年级+错误差值 ×2]`，4 项互异且必含正确答案，不再全为「年级+人数」。
    - 新增题内形态声明 `data.answerForm`（`difference` / `label-difference` / `boolean`），供 P45-07 V-B 门禁消费；不进入 SemanticQuestion/RenderResult 契约。
    - choice `nativeExpl` 同步写明「比最少的 X 多 N 人 / 比最多的 X 少 N 人」；judge/calc 语义不变（calc 列式仍为 `max − min`，答案取 `barDiff`）。
  - 新增 `tests/generation/p45-02-bar-intent.test.js`：`math-g4-up-u07-k001` × fill/apply/choice × d1..4 × 3 seed × count=9 全形态面，断言答案含差值且指向图形真实极值柱、choice 选项 ≥4/互异/含正确项/`correctIndex` 正确、judge 保持布尔且题面无空位、calc 列式与答案同源。
  - 重建 `shared/engine/strategy-engine.bundle.js`、`shared/engine/presentation-engine.bundle.js`（generator 生产代码变更；16/17 确定性门禁 PASS）。
- **deleted**：无。
- **reason**：
  - 用户裁决：`P45-02 B 类`（前三类修复按新任务书顺序推进）。
  - B1–B3 根因聚合 R2（条形图设问/答案/选项三口径不一致），唯一修复位置按任务书 §2 为 `stats.js` 条形图题族（`BAR_Q` + choice 分支）；未改 KP/题型/数量/难度（Z1–Z4），未改图形描述符与 SVG。
  - 验收口径按任务书 §4：「『多多少』答案与选项均含差值」——fill/apply 答案含差值、choice 选项集含差值项且正确答案在选项中。
- **tests**：
  - `node --test tests/generation/p45-02-bar-intent.test.js` → **3/3 PASS**。
  - `node dev/p28/check-generator-noninterference.js`（6d 四轴不夺权）→ **PASS**（fail=0 static=0）。
  - `node dev/check-educational-generation.js`（门禁 7）→ 935 SEMANTIC_PASS / **1 SEMANTIC_FAIL**（`math-g4-up-u02-k001 fill — evidence=fail`，P45-01 锚遗留，用户裁决不修，本任务未触碰该 KP）。
  - `npm test` → 949 例 / **948 pass / 1 fail**（`tests/generation/p25-17-anti-regression.test.js` 第 6 项 `educational-generation-report.json semanticFail = 0`，与上条同源锚遗留）。
  - `node dev/check-all.js` → **28 PASS / 5 FAIL / 1 SKIP**：FAIL 明细为 2 KBL(M0，edu-gen 退出码 1)、5 Unit（同源反回归）、6b 矩阵冻结（25 处差异，本任务贡献 `math-g4-up-u07-k001` fill/choice/apply 3 行，其余为 P45-01/03/04 既有差异）、6e Maker 分工矩阵（同批待重冻）、6f 失败分类（`math-g4-up-u02-k001/k003 fill` 锚遗留）；6g 答案防泄露 PASS（无新增命中，无需追加白名单）。
- **risk**：
  - 条形图题面/答案/选项文案变化 → `docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.json` 该 KP 3 行指纹漂移，与 P45-01/03/04 差异一并于 **P45-08** 统一重冻（`check-generation-matrix-frozen --write` + 重生成 GENERATOR-MATRIX + `check-kp-qt-maker-matrix --write`）；本任务不重冻，避免把 P45-08 收口拆散。
  - 按 `.trae/rules/p30-repair-rules.md` §9「改题面/答案文案」须重跑 `dev/p27/derive-variation-profiles.js` + `derive-misconceptions.js`；与 P45-03/04 同口径，**统一在 P45-08 收口**执行，本任务不单独派生，避免派生时间戳与多任务改动混叠。
  - `data.answerForm` 为新增题内字段，当前无生产消费者（P45-07 V-B 接通）；若 P45-07 未消费须按红线回退，不留无消费字段。
  - choice 选项由 `series.map`（6 项）收敛为 4 项标准集：属 B3 修复范围内的必要收敛（原 6 项无正确差值项），与审计 X3「选项数 3/6/7 非标准」观测口径同向改善，未改题型/选项渲染。
  - 遗留不变：D2（用户裁决搁置）、P45-01 evidence 锚失配（只登记不改锚）继续使 2/5/6f 与门禁 7 在「匹配锚/不匹配」间波动，本轮 2/5 转红、7 转绿属同一锚遗留，非本任务引入。

---

## P45-04 · 2026-11-01 · D 类（D1/D3）：图形语义—题干对象—尺寸参数—实际渲染一致

- **modified**：
  - `shared/generator/generators/shape.js`：新增 4 个题面派生 helper `STEM_SHAPE_WORDS` / `stemShapeType` / `stemLengths` / `stemGraphicPlan`；`themedItemMeta(item, qMeta, plan, rng, flatSampled)` 新增 `flatSampled` 分支——仅当 KP 名为泛称（`shapeMeta.legacyType === 'flat'`）且条目未自声明图形时，按题面主问对象派生 `geometry/<subtype>` 描述符（刻度尺题 → `ruler` + `params.from/to` 取自题面两处刻度读数；长方形题 → `rectangle` + `params.width/height` 取自题面「长 X 厘米、宽 Y 厘米」；正方形题 → `square` + `params.size`）；`makeThemedShapeQuestion` 签名增第 7 参 `flatSampled`，唯一调用点同步传入。未改 `data.shapeName`（保持 KP 级名，避开 k001 锚）。
  - `shared/svg/svg-geometry.js`：新增 `ruler(o)` 渲染（按 `from/to/unit/unitPx` 画刻度尺，标出起止刻度），导出对象新增 `ruler`，注册表自动注册 `geometry.ruler`。
  - `shared/schemas/semantic-question.schema.js`：`GRAPHIC_SUBTYPES.geometry` 登记 P45-01/P45-04 新增在产子类型 `count`、`ruler`（均有真实渲染器）。
  - 新增 `tests/generation/p45-04-shape-graphic.test.js`：D1 `math-g2-up-u05-k002`（fill/geometry）断言 `subtype=ruler`、`params.from/to` 与题面两处刻度逐一相同、渲染 SUCCESS、SVG 含读数；D3 `math-g3-down-u08-k003`（fill/choice/geometry）断言长方形/正方形按题面尺寸参数化并标注边长；作用域守卫 k001 仍 `square`、k004 仍 `line-segment`；`geometry/ruler` 渲染契约。
  - `dev/p32/check-answer-leak.js` + `docs/P32/change-log.md`：按用户裁决「登记白名单（推荐）」完成 AS-18 白名单登记 6 行——`GRAPHIC-TICK`（刻度尺 0–11 刻度编号，k002 fill/choice/geometry 各 1）、`GRAPHIC-COINCIDENCE`（k004 choice 边长 2cm 与答案巧合）、`C-FRACTION-PART`（`math-g5-down-u06-k002 fill` token 由 `5/6` 收敛为 `5`）、`B-OPERAND`（`math-g6-up-u03-k001 calc` token `1`）；未改 L1–L4 判定规则、token 边界匹配与自判回放。
  - 重建 `shared/engine/strategy-engine.bundle.js`、`shared/engine/presentation-engine.bundle.js`（generator / presentation 生产代码变更）。
- **deleted**：无。
- **reason**：
  - 用户指令：`好的，按新任务书开始修复分数格式化和图形一致性问题`。
  - D1/D3 根因聚合 R4（主题图形题走 `FLAT_FAMILY` 随机采样，与题面对象脱钩）；唯一修复位置按任务书 §2 为 `shape.js::generate` 的图形选择入口。
  - 用户裁决：`暂不改锚，D2 先搁置` —— D2（`math-g3-down-u03-k001` 问长方形配正方形）修复需同步改 `evidence-rules.json` 三行锚，未获授权，故**本任务不修 D2**；实现上用 `flatSampled` 门槛使 k001（`qMeta=square`）天然不进入题面派生路径，保证作用域不外溢。
  - 用户裁决：`不改锚，只登记遗留项` —— P45-01 使 `math-g4-up-u02-k001 fill` 产出 `geometry/count`，与 evidence 锚 `subtype=angle` 失配（门禁 7 报 `evidence=fail`）。按裁决保留 FAIL 并登记，**未修改锚、未改测试标准/未删用例**（P45 红线 7）。
- **tests**：
  - `node --test tests/generation/p45-04-shape-graphic.test.js` → 5/5 PASS。
  - `node --test tests/generation/p28-hollow-shape-themed.test.js tests/generation/p40-q08-graphic-alignment.test.js tests/generation/p25-07-type-contracts.test.js tests/generation/p28-geometry-native-makers.test.js tests/generation/p45-01-count-figure.test.js tests/generation/p45-03-fraction-format.test.js tests/presentation/svg-contract.test.js tests/presentation/svg-contract-full.test.js` → 100/100 PASS。
  - `npm run verify:education` → 935 SEMANTIC_PASS / **1 SEMANTIC_FAIL**（`math-g4-up-u02-k001 fill — evidence=fail`，P45-01 锚遗留，用户裁决不修）。
  - `npm test` → **1 FAIL**（`tests/generation/p25-17-anti-regression.test.js` 第 6 项 `educational-generation-report.json semanticFail = 0`，与上条同源遗留）。
  - `node dev/check-all.js` → 白名单登记前 **26 PASS / 7 FAIL / 1 SKIP**；登记后 **29 PASS / 4 FAIL / 1 SKIP**（FAIL 明细：6b 矩阵冻结、6e Maker 分工矩阵待 P45-08 统一重冻；6f 2 行 FAILED、门禁 7 1 行 SEMANTIC_FAIL 为 evidence 锚遗留；6g 已由 FAIL 转 PASS；第 15 项浏览器 SKIP 不计作 PASS）。
- **risk**：
  - D3 类 KP（flat 族且题面点名图形）矩阵行指纹将变化 → P45-08 统一重冻（`check-generation-matrix-frozen --write` + 重生成 GENERATOR-MATRIX）。
  - `ruler` / `count` 为新增在产子类型：V-D（P45-07）须把两者纳入图形族允许集合；旧断言若限定 `geometry/<形状>` 需随复现证据重写（不许只删）。
  - **遗留未修**：① D2 图形 subtype 与题干对象不符（用户裁决搁置）；② P45-01 引起的 `math-g4-up-u02-k001/k003 fill` evidence 锚失配（用户裁决只登记不改锚），使 6f 出现 2 行 FAILED、门禁 7 出现 1 行 SEMANTIC_FAIL；该两行由 `check-educational-generation.js`/6f 以**无 freeze seed** 的 PracticeSession 采样，产出在「匹配锚」与「不匹配」间波动，故 KBL(2)/Unit(5) 偶发转绿而门禁 7 仍红，属同一锚遗留的波动表现，须在 P45-08 前由用户决定处置。
  - **白名单可复现性**：AS-18 登记键为 `(kp,qt,token,layer)` + freeze seed `p28-v1`/d3，后续任务若再改这些行的答案/题面口径，须重新裁决并追加 `docs/P32/change-log.md`，不得默认沿用。
  - 观测登记（不修）：`math-g2-up-u05-k004` line-segment 的 `params.length` 为随机 1–2cm，与题面 5/8cm 不符，不属 16 类范围。

---

## P45-01 · 2026-11-01 · A 类：计数题图元数量 = 答案

- **modified**：
  - `shared/generator/generators/shape.js::makeCountQuestion`：新增 `geometry/count` 描述符（`params.shape/count/size/angle/unit/unitPx/gap`），`params.count` 与 `answer`、`data.targetCount`、新增 `data.figureCount` 四值同源；题干问法、题型、答案数值均不变。
  - `shared/svg/svg-geometry.js`：新增 `countShapes` 渲染（P45-01 用户显式授权「根据需求全面扩大 SVG」）；按 `count` 在网格中画 N 个同类图元（square/rectangle/triangle/circle/parallelogram/trapezoid/angle/line-segment），不标注边长与直角符号，保证一个可数图元对应一个答案单位；注册为 `geometry.count`。
  - 新增 `tests/generation/p45-01-count-figure.test.js`：A1 `math-g1-down-u01-k001` + A2 `math-g4-up-u02-k001` × fill × d1..4 × v0..3 全 seed 面，断言题干图形族 = `params.shape`、四值同源、渲染 SUCCESS、实渲染图元数 = 答案。
  - 重建 `shared/engine/strategy-engine.bundle.js`、`shared/engine/presentation-engine.bundle.js`（generator 生产代码变更）。
- **deleted**：无。
- **reason**：A1/A2 根因聚合 R1：图元数量与答案脱钩；唯一修复位置为 `makeCountQuestion` 及其图元构造。用户选择「根据需求全面扩大 SVG」以允许最小新增计数渲染能力；只改图元数量，不改图形语义/题型/题干问法（D 类仍分离在 P45-04）。
- **tests**：
  - `node --test tests/generation/p45-01-count-figure.test.js` → 2/2 PASS。
  - `node --test tests/generation/p28-hollow-shape-themed.test.js tests/generation/p25-07-type-contracts.test.js tests/generation/p28-geometry-native-makers.test.js tests/generation/p45-03-fraction-format.test.js` → 55/55 PASS。
- **risk**：计数题描述符由 `geometry/<形状>` 变为 `geometry/count`，1566 矩阵中计数行指纹会变化 → P45-08 统一重冻；V-D 门禁（P45-07）需把 `count` 纳入题干图形族允许集合。

---

## P45-03 · 2026-11-01 · C 类分数格式化：四处同源一致

- **modified**：
  - `shared/generator/generators/fraction.js`：新增唯一用户可见分数出口 `sfs(n,d)=fstr(simp(n,d))`；`fstr(f)` 分母 1 折叠为整数。全部结果分支（calc / choiceExpr / apply / word fill·choice·apply / addsub fill / addsub-diff fill·choice·apply / mix fill / div fill·div-int / meaning calc·choice / nature calc·apply·choice / compare calc / relation / proper choice·apply / reciprocal）的标准答案、解析、填空答案、选项统一改走 `fstr`/`sfs`；addsub-diff fill 答案由「分子/lcm」改为只填分子 `String(c1)`；`tongfen` 约分句 `fs(da)` → `fstr(da)`。
  - `tests/generation/p40-q07-fraction.test.js`：约分句断言由只接受 `n/d` 扩为 `\d+(?:\/\d+)?`（分母 1 折叠后出现整数形态），未删用例、未降标准。
  - 新增 `tests/generation/p45-03-fraction-format.test.js`：5 个登记 KP × calc/fill/choice/apply × d1..4 × v0..3 全 seed 面，断言答案既约、分母 1 折叠、解析含最终答案、choice 分数选项既约、calc 不出现 `1/1`。
- **deleted**：无（`fs` 保留为内部强制分数形态的唯一使用点，不作为用户可见出口）。
- **reason**：用户裁决「`fs → fstr` 不应只解决最终显示问题，必须确保标准答案、解析、填空答案和内部数学值一致，避免显示为 1、解析却为 1/1」。C1–C5 根因聚合 R3 的唯一修复位置为 `fraction.js` 输出格式化入口；未改题型、题面问法、数值生成与难度。
- **tests**：
  - `node --test tests/generation/p45-03-fraction-format.test.js` → 2/2 PASS。
  - `node --test tests/generation/p40-q07-fraction.test.js tests/generation/p42-4-fraction-simplify-truth.test.js tests/generation/p40-q18-fraction-times-integer-simplify.test.js` → 10/10 PASS。
- **risk**：题面文案（含约分句/解析）发生变化 → 需按 §9 重跑 `dev/p27/derive-variation-profiles.js` + `derive-misconceptions.js`，重建 `strategy-engine.bundle.js`，1570/1566 行产出变化须重冻矩阵；以上统一在 P45-08 收口，本任务仅完成局部修复与定向测试。

---

## P45-DOC-01 · 2026-11-01 · 任务书验收口径收紧（用户裁决）

- **modified**：
  - `docs/P45/P45-TASK-BOOK.md` §0 增加首批范围：仅 16 类；X3、X4 暂不纳入，X9 保留待定位。
  - 新增 §2.2「C 类修复口径：四处必须同源一致」：标准答案 / 解析 / 填空答案与选项 / 内部数学值逐题比对，`fs → fstr` 不得作为验收终点。
  - 新增 §2.3「A 类与 D 类：验收分离」：A 类只验 `figureCount === answer`；D 类只验图形语义 / 题干对象 / 尺寸参数 / 实际渲染一致；禁止单一 `fixGraphic()` 合并两类。
  - 更新 §4 任务过门判据：P45-01 仅验 A 类、P45-03 验四处一致、P45-04 仅验 D 类。
  - 新增 §4.2「最终验收标准 G1–G8」：16 类复现并修复；34 项门禁达预期且 SKIP 不计作 PASS；V-A～V-E 通过；1566 全量重验；375/98/407/23/7 口径保持；无新增题型/重复链路/静默题型改变；四类改动分别核对；提交干净可追溯。
  - 更新 §7：P45-06 必须核查 `money.js:325`；X9 保留待定位；X3/X4 标注暂不纳入。
- **deleted**：无。
- **reason**：用户显式裁决——`fs → fstr 不应只解决最终显示问题`；`A 类与 D 类虽然都涉及图形，但应分别验收`；`X3、X4 暂不纳入；X9 保留为待定位事项；P45-06 必须核查 money.js:325`；总体架构与首批范围不变。
- **tests**：仅文档修订，未改生产代码，未运行测试。
- **risk**：C 类若只改 `answer` 格式化而不改解析/填空/内部值，仍会复现「显示 1、解析 1/1」；P45-03 验收须逐题比对四处字符串。A/D 若合并修复，会模糊计数一致性与语义一致性两类证据，验收不可追溯。

---

## P45-INIT · 2026-11-01 · 单题质量缺陷修复立项建档

- **modified**：
  - 新增 `docs/P45/P45-TASK-BOOK.md`：16 类硬缺陷（A1–A2 / B1–B3 / C1–C5 / D1–D5 / E1）→ 生产文件 / 生成器 / 模板函数 / 描述符来源 / Validator 现状 / 唯一修复位置映射；根因聚合 R1–R8；Validator 新增门禁 V-A~V-E；任务拆分 P45-01~08 与阶段门禁；附录 B 登记 X3/X4/X9 WATCH 项。
  - 新增 `docs/P45/change-log.md`（本文件）。
- **deleted**：无。
- **reason**：
  - 用户指令：`建立 16 条缺陷与实际生成文件、生成器、模板、描述符、Validator 的对应关系，确认每类根因的唯一修复位置。建立P45的修复立项。`
  - 定位结论：16 类根因全部归 Generator 层（`shared/generator/`）；Validator 仅新增拦截门禁，不替代修复；SVG / Presentation 不改。
  - 唯一修复位置锚点：`shape.js::makeCountQuestion`（A）、`stats.js` 条形图题族（B）、`fraction.js` 输出格式化入口（C）、`shape.js::generate` + `getShapeMeta`（D1–D3）、`money.js::makeGraphicForMoney`（D4–D5）、`type-contract.js::finishJudge`（E1）。
- **tests**：本任务仅建档，未改生产代码，未运行测试；基线核对依据 `docs/00-BASELINE.md`（375/98/407/1566；34 项门禁本地 33 PASS / 1 SKIP）。
- **risk**：
  - 行号为立项当日定位结果，执行任务时需以最新源码复核；行号漂移不改变层归属。
  - `money.js:325` 为 E1 同源潜在第二生产点，须在 P45-06 内核实是否可达，禁止另立任务或双轨修复。
  - X9「重复列式」8 行尚未定位到唯一源码拼接点，已登记为未决项，不纳入本战役首批任务。
  - 本建档未获生产代码修改授权；后续每个任务仍须按九步流水线单独执行并在本文件追加记录。
