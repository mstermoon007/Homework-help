# P33 任务书 · 文档与基线对齐（CLEANUP）

> 状态：**✅ P33 战役最终冻结**（2026-10-08）。四阶段全部过门：①阶段一 DOC（INIT/01/02/03）落地；②阶段一 VERIFY 31/0/0 CI 标尺；③阶段二 SCAN（05/06/07）三份裁决（B1 不动、B2 不落地触红线、B3 不优先）；④阶段四 ACCEPT（11/FINAL）跑 31/0/0 最终复核。check-all 31/0/0 CI 标尺达成，375/98/373/1570 不变，无生产代码改动。阶段三性能执行候选全部不落地。未 git commit。
> 日志：`docs/P33/change-log.md`
> 编号：`P33-01` … `P33-10`（数字；阶段二/三待裁决后启用）。
> 上游输入：2026-10-08 用户指令「全面读取项目代码和资料，做一个完整的可行的、高效的开发文档整理和大扫除方案」+「授权 P33-CLEANUP 并执行阶段一 A1-A4 文档对齐任务」。
> 规则衔接：本战役在 P28/P30/P31/P32 已冻结架构上做**接通与删改，不重建**；P28/P30/P31/P32 红线在本战役继续有效。

---

## 1. 战役目标

1. **文档与基线对齐**：归档 deprecated 历史快照、修正文档与代码漂移、追加缺失版本节。
2. **性能 SCAN 候选裁决**：只读分析 1570 串行 / 375 页生成 / 测试重叠的可并发性，产出裁决报告。
3. **性能执行**（视阶段二裁决）：仅在证实无共享状态/无 hash 顺序敏感时落地并行化。

一句话：**只做接通与删改，不重建；不动 KBL/Generator/Validator/Strategy/POL/难度/题型/SVG/SemanticQuestion 契约。**

---

## 2. 立项前已核实的现状证据（2026-10-08，代码级）

### 2.1 文档漂移点（阶段一候选）

| # | 路径:行号 | 漂移 | 处置 |
|---|---|---|---|
| A1 | docs/FINAL-*.md ×5 + docs/P28-FINAL-FREEZE.md ×1（共 6 文件） | 已加 ⚠️ deprecated 提示但仍在 docs/ 顶层 | 归档至 docs/archive/phases/snapshots/ |
| A2 | docs/00-BASELINE.md L13/L14 | 写 5.0.0 / hw-help-5.0.0，实测 5.1.0 | 改 5.1.0 |
| A3 | docs/CHANGELOG.md L5 | 仍写 v5.0.0，期间经历 P30/P31/P32 无变更日志 | 追加 v5.1.0 节 |
| A4 | docs/CHANGELOG.md L15/L43 | 写 sitemap 381，基线 382 | 在 v5.1.0 节澄清 |

### 2.2 性能候选（阶段二 SCAN）

| # | 路径:行号 | 现状 | SCAN 前置 |
|---|---|---|---|
| B1 | dev/check-all.js L140/L162/L165 | #5 跑全部测试，#10 #11 跑子集（重叠） | 确认 #10 #11 是否有独立断言 |
| B2 | dev/check-allow-generation.js L44-L65 | 1570 串行 await | 确认 PracticeSession RNG/共享状态 |
| B3 | dev/build-knowledge-pages.js | 375 页生成 | 确认 hash 顺序敏感性 |

### 2.3 已确认无候选（不再审）

| 维度 | 状态 | 证据 |
|---|---|---|
| 死代码 | ✅ | #21 dead-code 15 候选全处置 |
| Legacy matrix | ✅ | #22 5 候选全 KEEP |
| SVG renderer 重复 | ✅ | P30-29 已审计 |
| 死 CSS 类 | ✅ | P28-UI-PRINTSTYLE-CLEANUP-01 + P31-10 |
| 重复渲染器 | ✅ | P31-06 已删 |
| dev reports 堆积 | ✅ | .gitignore 已标不提交 |
| docs/archive/ 体量 | ✅ | 历史归档不动 |

---

## 3. 阶段门禁

| 阶段 | 任务 | 局部门禁 | 过门判据 |
|---|---|---|---|
| 一 DOC | P33-01/02/03 | #20 doc-consistency + check-all 30/0/1 | 6 snapshots 归档；BASELINE 版本号对齐；CHANGELOG v5.1.0 节追加 |
| 二 SCAN | P33-05/06/07（待裁决） | 只读无门禁 | 三份 SCAN 裁决报告产出 |
| 三 EXEC | P33-08/09/10（视阶段二） | npm test 742/742 + check-all 30/0/1 + 6b 矩阵冻结 + 16/17 bundle 确定性 | 性能候选落地后门禁全绿，375/98/373/1570 不变 |
| 四 ACCEPT | P33-11 | check-all 30/0/1 + change-log 收口 | 战役最终冻结 |

每阶段结束：输出门禁证据 → **用户确认** → 才允许开启下一阶段任务。

---

## 4. 红线（P33 专属追加）

1. 改 KBL / Generator / Validator / Strategy / POL / 难度 / 7 题型集合 / 题面答案文案 / SVG renderer / SemanticQuestion 契约 / GraphicDescriptor 结构。
2. 借"性能优化"为名触动生产代码逻辑（B2/B3 必须先 SCAN 证实无共享状态才允许落地）。
3. 新建顶层源码目录 / 新引擎 / 新兼容层 / shim / adapter / 双轨开关。
4. 为测试 PASS 删失败用例或改测试标准。
5. 顺手重构、连锁修无关缺陷、无限审计；任务外发现的问题只登记不顺手修。
6. 改完不跑门禁 / 不记日志即交付；跳过阶段门禁或未经用户确认进入下一阶段。

唯一允许偏离：用户**显式**指令覆盖某条，并在 change-log 的 reason 中留存指令依据。

---

## 5. 立项建档记录

- P33-INIT（2026-10-08）：本任务书 + change-log.md + docs/archive/phases/snapshots/ 目录创建。详见 change-log P33-INIT。
- P33-01（2026-10-08）：A1 6 snapshots 归档完成。详见 change-log P33-01。
- P33-02（2026-10-08）：A2 BASELINE 版本号对齐完成。详见 change-log P33-02。
- P33-03（2026-10-08）：A3+A4 CHANGELOG v5.1.0 节追加完成。详见 change-log P33-03。
- P33-VERIFY（2026-10-08）：阶段一门禁复核 31/0/0 CI 标尺达成。详见 change-log P33-VERIFY。
- P33-05（2026-10-08）：B1 check-all #10/#11 与 #5 测试重叠裁决 → 建议不动。详见 change-log P33-05。
- P33-06（2026-10-08）：B2 1570 串行 → 并发可行性 SCAN 裁决 → 不建议落地（触红线 #1/#3）。详见 change-log P33-06。
- P33-07（2026-10-08）：B3 375 页生成并行 SCAN 裁决 → 可并发但不优先。详见 change-log P33-07。
- P33-11（2026-10-08）：阶段四 ACCEPT 收口门禁复核 31/0/0。详见 change-log P33-11。
- P33-FINAL（2026-10-08）：**P33 战役最终冻结**。详见 change-log P33-FINAL。

---

## 6. 战役总结报告（2026-10-08）

### 6.1 战役定性

P33 是在 P28-FINAL / P30-FINAL / P31-FINAL / P32-FINAL 已冻结架构上的**文档与基线对齐 + 性能 SCAN 候选裁决**战役，遵守 [ai-coding-workflow.md](file:///Users/zhanggaozhang/Code/Homework%20Help/.trae/rules/ai-coding-workflow.md) 九步流水线 + [p30-repair-rules.md](file:///Users/zhanggaozhang/Code/Homework%20Help/.trae/rules/p30-repair-rules.md) §0「接通与删改，不重建」红线。**未触任何生产代码**（KBL / Generator / Validator / Strategy / POL / 难度 / 7 题型 / 题面答案文案 / SVG renderer / SemanticQuestion 契约 / GraphicDescriptor 结构全部未改）。

### 6.2 输入与产出

**上游输入**：
1. 2026-10-08 用户指令「全面读取项目代码和资料，做一个完整的可行的、高效的开发文档整理和大扫除方案，提高项目代码运行效率」。
2. 2026-10-08 用户指令「授权 P33-CLEANUP 并执行阶段一 A1-A4 文档对齐任务」。
3. 2026-10-08 用户指令「进入阶段二 SCAN」。
4. 2026-10-08 用户指令「直接进阶段四 ACCEPT 收口」。
5. 2026-10-08 用户指令「请生成 P33 战役总结报告」。

**战役产出**（共 9 条 change-log 记录 + 4 阶段门禁）：

| 编号 | 阶段 | 类型 | 改动 | 风险 |
|---|---|---|---|---|
| P33-INIT | 一 DOC | 立项建档 | 新建 docs/P33/ + snapshots/ 目录 + 本任务书 + change-log | L |
| P33-01 | 一 DOC | A1 归档 | 6 个 deprecated snapshots git mv 至 docs/archive/phases/snapshots/ | L |
| P33-02 | 一 DOC | A2 对齐 | docs/00-BASELINE.md 5.0.0→5.1.0 + hw-help-5.0.0→hw-help-5.1.0 | L |
| P33-03 | 一 DOC | A3+A4 追加 | docs/CHANGELOG.md 追加 v5.1.0 节含 P30/P31/P32 摘要 + sitemap 382 澄清 | L |
| P33-VERIFY | 一 VERIFY | 门禁 | check-all 31/0/0 CI 标尺达成 | L |
| P33-05 | 二 SCAN | B1 裁决 | check-all #10/#11 与 #5 重叠 → **建议不动** | L |
| P33-06 | 二 SCAN | B2 裁决 | 1570 串行 → 并发 → **不建议落地**（触红线 #1/#3） | L（只读） |
| P33-07 | 二 SCAN | B3 裁决 | 375 页并行 → 可并发但**不优先** | L（只读） |
| P33-11 | 四 ACCEPT | 门禁 | check-all 31/0/0 最终复核 | L |
| P33-FINAL | 四 ACCEPT | 冻结 | 战役最终冻结记录 | L |

### 6.3 文档对齐成果

#### A1. 6 个 deprecated snapshots 归档

| 原路径 | 新路径 |
|---|---|
| docs/FINAL-REPAIR-STATUS.md | docs/archive/phases/snapshots/FINAL-REPAIR-STATUS.md |
| docs/FINAL-REPAIR-BASELINE.md | docs/archive/phases/snapshots/FINAL-REPAIR-BASELINE.md |
| docs/FINAL-130-ACCEPTANCE.md | docs/archive/phases/snapshots/FINAL-130-ACCEPTANCE.md |
| docs/FINAL-REPAIR-DEFERRED.md | docs/archive/phases/snapshots/FINAL-REPAIR-DEFERRED.md |
| docs/FINAL-FREEZE.md | docs/archive/phases/snapshots/FINAL-FREEZE.md |
| docs/P28-FINAL-FREEZE.md | docs/archive/phases/snapshots/P28-FINAL-FREEZE.md |

docs/ 顶层瘦身约 82KB；#20 doc-consistency 扫描范围缩小后仍 PASS。

#### A2. BASELINE 版本号对齐

[docs/00-BASELINE.md#L13-L14](file:///Users/zhanggaozhang/Code/Homework%20Help/docs/00-BASELINE.md#L13-L14) 表格 `5.0.0 → 5.1.0`、`hw-help-5.0.0 → hw-help-5.1.0`，对齐实测：[VERSION](file:///Users/zhanggaozhang/Code/Homework%20Help/VERSION) / [package.json](file:///Users/zhanggaozhang/Code/Homework%20Help/package.json) / [shared/catalog/version.js](file:///Users/zhanggaozhang/Code/Homework%20Help/shared/catalog/version.js#L11) / [sw.js](file:///Users/zhanggaozhang/Code/Homework%20Help/sw.js#L26) 全部 5.1.0。门禁 #1 `check:sw-version` 长期 PASS 但只扫源码不扫 docs，漂移被掩盖——本次修复。

#### A3+A4. CHANGELOG v5.1.0 节追加

[docs/CHANGELOG.md](file:///Users/zhanggaozhang/Code/Homework%20Help/docs/CHANGELOG.md) 在 v5.0.0 节之前追加 v5.1.0 节（append-only），含五个子节：①答案系统收口（P32）、②显示层排版收口（P31）、③SVG/图形描述符治理（P30）、④文档与基线对齐（P33-01/02/03）、⑤门禁与测试。子节④澄清 sitemap 382 URL 当前基线（v5.0.0 节历史 381 表述保留不改）。

### 6.4 性能 SCAN 裁决成果

三份 SCAN 报告产出（均基于代码引用，非猜测）：

| 候选 | 路径 | 裁决 | 关键证据 | 落地决策 |
|---|---|---|---|---|
| B1 | [dev/check-all.js#L140/L162/L165](file:///Users/zhanggaozhang/Code/Homework%20Help/dev/check-all.js) | 可合并但建议不动 | #5 跑 `tests/**/*.test.js` 全集，#10 #11 测试文件 100% 被覆盖 | 不落地（清晰度 > 3-6s） |
| B2 | [dev/check-allow-generation.js#L44-L65](file:///Users/zhanggaozhang/Code/Homework%20Help/dev/check-allow-generation.js) | CONDITIONAL → 不建议落地 | [shared/generation/api.js#L35](file:///Users/zhanggaozhang/Code/Homework%20Help/shared/generation/api.js#L35) `_generationSeq=0` 模块级自增、[L474](file:///Users/zhanggaozhang/Code/Homework%20Help/shared/generation/api.js#L474) `++_generationSeq` 并发竞争 | 不落地（触红线 #1 Generator 冻结 / #3 新建架构） |
| B3 | [dev/build-knowledge-pages.js#L295-L310](file:///Users/zhanggaozhang/Code/Homework%20Help/dev/build-knowledge-pages.js) | 可并发但不优先 | [L232/L249](file:///Users/zhanggaozhang/Code/Homework%20Help/dev/build-knowledge-pages.js#L232) index hash 用 `sort()` 顺序无关、每页独立无跨页共享 | 不优先（构建时非运行时，收益/风险比不优） |

### 6.5 门禁证据

**check-all 最终复核**：`node dev/check-all.js`（CHROME_BIN=`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`）**31 PASS / 0 FAIL / 0 SKIP / 31 项**（CI 标尺）。

关键项状态：
- #1 SW 版本一致 5.1.0 ✅
- #5 全链测试 742/742 PASS ✅
- #6a 1570 真实生成 PASS ✅
- #6b 矩阵冻结 PASS ✅
- #6g 答案防泄露 AS-18 PASS ✅
- #12 Security PASS ✅
- #13 Sitemap 382 URL 冻结 PASS ✅
- #15 真实浏览器 9 步 E2E PASS ✅
- #16/#17 bundle 确定性 PASS ✅
- #20 doc-consistency PASS ✅
- #21/#22 dead-code/legacy PASS ✅
- FINAL-91 只读门禁 PASS（docs/P33/ 与 snapshots/ 是 archive 子目录，允许写入）

**375/98/373/1570 口径全程不变**（#6a/#6b 实跑证明）。

### 6.6 改动清单（git status）

```
 M docs/00-BASELINE.md              (5.0.0 → 5.1.0, 2 行)
 M docs/CHANGELOG.md                (追加 v5.1.0 节)
R  docs/FINAL-130-ACCEPTANCE.md    → docs/archive/phases/snapshots/
R  docs/FINAL-FREEZE.md            → docs/archive/phases/snapshots/
R  docs/FINAL-REPAIR-BASELINE.md   → docs/archive/phases/snapshots/
R  docs/FINAL-REPAIR-DEFERRED.md   → docs/archive/phases/snapshots/
R  docs/FINAL-REPAIR-STATUS.md     → docs/archive/phases/snapshots/
R  docs/P28-FINAL-FREEZE.md        → docs/archive/phases/snapshots/
?? docs/P33/                        (change-log.md + P33-TASK-BOOK.md)
```

共 **2 文件修改 + 6 文件 git mv + 1 新建目录（含 2 文件）**。无生产代码改动。**未 git commit**。

### 6.7 关键判断与遗留事项

#### 关键判断

**P33 战役的核心结论：本项目无显著可执行的性能优化候选**。

1. 运行时已是优良区间：npm test 7-8s / 742 用例 / 零运行时依赖 / bundle 预构建。
2. 剩余"性能痛点"全在 CI 构建时（1570 串行 2-4 min、375 页生成、check-all 22 项），但落地均触红线或收益/风险比不优——**不优化是合规选择**，不是"放弃优化"。
3. 冻结架构的纪律性 > 局部性能改进。
4. 文档漂移长期被门禁掩盖（#1 check:sw-version 只扫源码不扫 docs）——这是**潜在门禁扩展候选**（如加 #23 docs-version 一致性门禁），但属"新建架构"，本次不收，留待后续战役裁决。

#### 遗留事项

| 事项 | 状态 | 处置 |
|---|---|---|
| 13 条矩阵数据事实缺口 | P32-AS-21 已登记转人工挂账 | 不属 P33 范围 |
| docs/02-KBL.md Relations=0 / 03-POL-GENERATION.md 31 generators | 已由 P31-FIX-01 修复 | 已闭合 |
| docs-version 一致性门禁扩展候选 | P33 SCAN 发现 | 不收（新建架构），留待后续 |
| B2 worker_threads 重写方案细节 | P33-06 裁决"不建议落地" | 不展开 |
| B3 fs.promises 并发写盘故障模式 | P33-07 裁决"不优先" | 不展开 |

### 6.8 战役红线遵守情况

| 红线 | 是否触犯 | 证据 |
|---|---|---|
| #1 改 KBL/Generator/Validator/Strategy/POL/难度/题型/题面/SVG/SemanticQuestion | ❌ 未触 | git status 无 shared/ 改动 |
| #2 借性能优化触动生产代码逻辑 | ❌ 未触 | B2 裁决不落地，shared/generation/api.js 未改 |
| #3 新建顶层源码目录/新引擎/兼容层 | ❌ 未触 | 仅新建 docs/P33/ 与 docs/archive/phases/snapshots/（archive 子目录，非源码目录） |
| #4 为测试 PASS 删失败用例/改测试标准 | ❌ 未触 | tests/ 零改动 |
| #5 顺手重构/连锁修/无限审计 | ❌ 未触 | 一任务一交付，修完即走 |
| #6 改完不跑门禁/不记日志/跳门禁 | ❌ 未触 | 每阶段过门 + 用户确认才进下一阶段 + 9 条 change-log 记录 |
| 红线 #3 偏离授权 | ✅ 无偏离 | docs/archive/phases/snapshots/ 是归档子目录，非新顶层源码目录（[00-BASELINE.md §Generated File Policy](file:///Users/zhanggaozhang/Code/Homework%20Help/docs/00-BASELINE.md) 明确允许 archive 内归档） |

### 6.9 战役最终冻结声明

**P33 文档与基线对齐（CLEANUP）战役于 2026-10-08 最终冻结。**

四阶段全部过门：①阶段一 DOC（A1-A4 文档对齐）+ VERIFY（31/0/0 CI 标尺）✅；②阶段二 SCAN（B1/B2/B3 三份裁决）✅；③阶段三 EXEC **跳过**（三份 SCAN 均不建议落地，用户裁决直接进阶段四）✅；④阶段四 ACCEPT（11 + FINAL）跑 31/0/0 最终复核 ✅。

**战役产物**：[docs/P33/change-log.md](file:///Users/zhanggaozhang/Code/Homework%20Help/docs/P33/change-log.md)（9 条记录）+ [docs/P33/P33-TASK-BOOK.md](file:///Users/zhanggaozhang/Code/Homework%20Help/docs/P33/P33-TASK-BOOK.md)（本任务书含本总结）+ [docs/archive/phases/snapshots/](file:///Users/zhanggaozhang/Code/Homework%20Help/docs/archive/phases/snapshots/)（6 个 deprecated 历史快照归档）+ [docs/00-BASELINE.md](file:///Users/zhanggaozhang/Code/Homework%20Help/docs/00-BASELINE.md) 与 [docs/CHANGELOG.md](file:///Users/zhanggaozhang/Code/Homework%20Help/docs/CHANGELOG.md) 文档对齐。

**未 git commit**——按工作区规则等用户显式指令。
