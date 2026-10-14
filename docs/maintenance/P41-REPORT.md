# P41 稳定性优先战役 — 最终报告

> 状态：机判收口完成（待用户签收）。日期：2026-10-14。分支：`main`。版本：`5.2.0`。
> 基线 HEAD：`57798059804601a1dc9b1c86159bc14a22673bd6`。

## 0. 目标与硬约束

- 目标：按「稳定性优先」推进 P41-0 → A → B → C → D → E → F，修复已确认缺陷、恢复门禁可信度、解决难度锚点权威冲突、离线研究知识关系，产出 GO/NO-GO，**不改架构、不部署服务器**。
- 硬约束（全部遵守）：
  - 保留 12 个职责模块与 9 层单向链 `KBL → KnowledgeContext → POL → Strategy → Generator → Validator → SemanticQuestion → Presentation → SVG`。
  - `shared/` 为唯一汇聚层；不新增顶层源码目录；不建第二套知识图/难度权威；无运行时 Agent。
  - 工作区保护：未执行 `git reset --hard`/`git clean`/批量 `checkout`；未覆盖既有修改文件与未跟踪文档；改动后逐子阶段复核 `git diff`/`git status`。
  - 每个修复 = 反例 + 最小修复 + 回归测试；不放宽校验、不删除/跳过失败测试；不可用环境记为 BLOCKED。

## 1. 阶段状态

| 阶段 | 内容 | 状态 |
|---|---|---|
| P41-0 | 基线快照（git 状态 / 865 测试 / 30 PASS 门禁） | ✅ 完成 |
| P41-A | 三处确认缺陷：A1 语义校验题型字段、A2 生成选择器潜在崩溃、A3 题型谓词审计 | ✅ 完成（A3 仅审计，统一化推迟） |
| P41-B | B1 rootHash 单一权威、B2 知识页漂移真实检测、B3 随机分布测试稳定化 | ✅ 完成 |
| P41-C | 难度锚点权威冲突 → 用户决定 **选项 C（双表并存 + 显式命名）** | ✅ 完成 |
| P41-D | 跨层题型契约回归测试（锁定 7 类 + 别名 + read-aloud 边界） | ✅ 完成 |
| P41-E | 知识关系离线研究（373 边全量画像） | ✅ 完成 |
| P41-F | 最终全量验证 + 汇总报告 + GO/NO-GO | ✅ 本报告 |

## 2. 缺陷、修复与回归测试

### P41-A1 — `checkQuestionType` 字段口径错误（生产恒 no-op）
- 反例：`SemanticQuestion` 工厂写入 `sq.questionType`，但该校验只读 `sq.questionTypeId`，导致生产题目题型越界检查恒不触发。
- 修复：`shared/validator/kp-semantic-validator.js` 改为 `var qt = sq.questionType || sq.questionTypeId || null;`，错误字段改为 `questionType`，并对 `generationCapabilities` 做防御（`|| []`）。与 `checkSemanticEvidence/checkTypeContract/checkIntentAlignment` 同口径。
- 测试：`tests/validator/kp-semantic-validator.test.js` 新增 8 例。
- 联动：该文件被打包进 `presentation-engine.bundle.js` → 已重建 bundle。

### P41-A2 — `attachMeta` 潜在 `ReferenceError`
- 反例：`if (!arr) return sq;` 中 `sq` 未定义（形参为 `sqs`），异常路径会抛 `ReferenceError`。
- 修复：`shared/generator/generator-selector.js` 改为 `return sqs;`。
- 测试：`tests/generation/p41-generator-selector-boundary.test.js` 新增 4 例。
- 联动：该文件被打包进 `strategy-engine.bundle.js` → 已重建 bundle。

### P41-A3 — 题型谓词审计（仅审计）
- 四处谓词：`Schema.isValidQuestionType`（规范 7 ∪ 显式别名）、`QTR.has`（等价）、工厂 `semantic-question.js:67`（规范 7 ∪ {read-aloud}，无别名）、`generator-contract.js:229`（规范 ∪ 别名 ∪ {read-aloud}）。
- 结论：统一化会触及 `shared/` 打包源并需重建 bundle，**推迟**，由 P41-D 契约测试冻结现状。
- 事实：`read-aloud` 是 `answerMode`（schema `ANSWER_MODES`），**非**规范题型；规范题型 = 7：`calc/fill/choice/judge/geometry/classify/apply`。

### P41-B1 — rootHash 单一权威
- 新建 `tools/kbl/root-hash.js`（`DATA_RELS` 13 文件、`sha`、`hashInput`、`computeRootHash`）。
- 接入 `tools/kbl/build.js`、`dev/p30/check-kbl-lineage.js`、`dev/check-kbl-quality.js`；L6a `[3df605b9f42b vs 3df605b9f42b]` PASS，Q9 PASS。
- 两项门禁已加入 `dev/check-all.js`。测试：`tests/source/kbl-root-hash.test.js`（5 例）。

### P41-B2 — 知识页 `--check` 真实漂移检测
- `dev/build-knowledge-pages.js` 重构：导出 `main/runCheck/buildPageHtml/buildSameUnitMap/OUT_DIR`；`runCheck` 返回漂移数组（缺页 / 无 kbgen / 内容漂移 / 索引漂移 / 孤儿页）；`printCheck` 返回退出码；`main` 设 `process.exitCode`；`require.main` 守卫。
- 当前仓库漂移 = 0。测试：`tests/source/build-knowledge-pages-check.test.js`（3 例）。

### P41-B3 — 随机分布测试稳定化
- `tests/source/random-distribution.test.js`：卡方 ±10% 用例改为注入 `mulberry32(42)` 确定性源（实测 13.46 / 101.68 / 1.98%）；新增非阻塞真随机冒烟（范围 + 命中全部桶 + 宽松卡方 < 60）。连续 3 次通过。

### P41-C — 难度锚点权威冲突（用户决定：选项 C）
- 证据：KBL 375 KP `difficultyAnnotation.seedDifficulty` 与 Q6 派生校验包络 375/375（100%）匹配；生产 `GRADE_DIFFICULTY_ANCHORS`（R5）仅 237/375（63.2%）。两者语义不同、曲线上界不同。
- 决定：**双表并存 + 显式命名**，不改难度公式、不改 KBL 数据。
  - `shared/strategy/difficulty-strategy.js`：显式命名「生产难度合成封顶策略锚点」，声明不得与派生校验包络互校。
  - `dev/difficulty-anchor-table.js`：显式命名「派生数据校验包络」。
  - `tests/orchestration/difficulty-anchor.test.js`：competition 断言改为对生产锚点 `DS.difficultyAnchorOf(1)` 校验；新增「两表为有意区分的两套权威」用例。
- 决策记录：`docs/maintenance/P41-C-difficulty-anchor-decision.md`。

### P41-D — 跨层题型契约测试
- `tests/generation/p41-question-type-contract.test.js`（5 例）锁定：7 类规范题型被 Schema/QTR/工厂/Contract 接受；别名被 Schema/QTR/Contract 接受但工厂拒绝（记录边界）；`read-aloud` 作为 questionType 被 Schema 拒绝、被工厂/Contract 接受，作为 answerMode 有效；未知题型被全网拒绝。

### P41-E — 知识关系离线研究
- 报告：`docs/maintenance/P41-E-relations-research.md`。
- 结论：373 边全部 `prerequisite` / `inferred:true` / `reviewStatus:'llm-finalized-dev'`；规则 R-REL-01 277、R-REL-02 58、R-REL-03 38；坏端点 0、环 0（DAG）；335 有后继 / 340 有前置 / 12 孤立；20 条跨年级（螺旋）边。建议不自动生成新边（ALLOW 共现 ≠ 前置）。

## 3. 最终门禁证据

| 门禁 | 结果 |
|---|---|
| `npm test` | **892 / 892 PASS / 0 FAIL**（16 套件 / 93 测试文件） |
| `node dev/check-syntax.js` | 328 文件 / 0 错误 |
| `node dev/lint-check.js` | PASS |
| `npm run check-all` | **32 PASS / 0 FAIL / 1 SKIP / 33 项**（#15 Browser E2E 无 Chrome SKIP） |
| Bundle 确定性 #16 | `source==bundle` PASS（strategy `df049279af45f37f…`、presentation `33ec53d3671f45c0…`） |
| 生成矩阵冻结 / 6a | 1570 ALLOW 真实生成 PASS |
| KBL 血缘 rootHash | `3df605b9f42bf8ef836a1927262a78ef04b7a532e24e5c9c3984aa578806dba5` |
| 文档一致性 #20 | PASS（26 个非 archive 文档；无历史数字） |
| LLM 理解 #19 | PASS（20/20） |
| FINAL-91 只读快照 | PASS（关键目录前后 hash 一致） |

KBL 规模：375 KP / 98 units / 373 relations / 1570 mappings。

## 4. 已知遗留 / 非阻塞

- **Browser E2E（#15）**：本机无 Chrome/Chromium → SKIP（记 BLOCKED）；设 `CHROME_BIN` 或将 chrome 置于 PATH 后可达 33 PASS。
- **题型谓词统一化**：推迟（触及打包源 + bundle 重建决策），现状由 P41-D 契约测试冻结。
- `docs/DESIGN-REPORT.md`（未跟踪）当前态计数已对齐（892/16/93、Syntax 328、门禁 33 项）；历史阶段快照（`docs/P31~P40`）按仓库纪律保留不改（见 `docs/P40/p40-final-closure.md` §立项时点快照不改）。
- 服务器部署/nginx/SSH 不可用，未尝试。

## 5. 文件清单

**新增**
- `tools/kbl/root-hash.js`
- `tests/generation/p41-generator-selector-boundary.test.js`
- `tests/generation/p41-question-type-contract.test.js`
- `tests/source/kbl-root-hash.test.js`
- `tests/source/build-knowledge-pages-check.test.js`
- `docs/maintenance/P41-C-difficulty-anchor-decision.md`
- `docs/maintenance/P41-E-relations-research.md`
- `docs/maintenance/P41-REPORT.md`（本文件）

**修改（P41）**
- `shared/validator/kp-semantic-validator.js`、`shared/generator/generator-selector.js`
- `shared/strategy/difficulty-strategy.js`、`dev/difficulty-anchor-table.js`
- `shared/engine/strategy-engine.bundle.js`、`shared/engine/presentation-engine.bundle.js`（随源重建）
- `tools/kbl/build.js`
- `dev/p30/check-kbl-lineage.js`、`dev/check-kbl-quality.js`、`dev/check-all.js`、`dev/build-knowledge-pages.js`
- `tests/validator/kp-semantic-validator.test.js`、`tests/source/random-distribution.test.js`、`tests/orchestration/difficulty-anchor.test.js`
- `docs/00-BASELINE.md`、`docs/10-TEST-CI.md`（计数对齐 892/93/16/328、门禁 33 项）

**受保护未覆盖（既有修改/未跟踪）**
- `shared/generator/registry-facade.js`、`dev/p28/check-doc-consistency.js`、`docs/09-WEB-AI.md`（既有修改）
- `docs/DESIGN-REPORT.md`、`docs/maintenance/AUDIT-LOG.md`、`docs/maintenance/PROJECT-AUDIT-INSTRUCTIONS.md`（未跟踪）

## 6. 结论：GO

- 全部已确认缺陷闭合，且均有反例 + 最小修复 + 回归测试。
- 门禁恢复可信：check-all 33 项 32 PASS / 0 FAIL（唯一 SKIP 为环境缺失），FINAL-91 只读快照通过，bundle 与源一致。
- 难度权威冲突经用户拍板（选项 C）冻结，生产行为与 KBL 数据零变更。
- 未触碰架构、未部署服务器、未覆盖受保护文件。

**GO / NO-GO：GO**（剩余为人工签收与可选的 Browser E2E 补跑）。
