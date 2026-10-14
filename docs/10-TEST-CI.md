# 10-TEST-CI — 测试体系与门禁链

> 状态：FROZEN
> 本文档回答：有哪些测试、有哪些门禁、CI 怎么跑。

## 1. 测试体系

### 1.1 Node 单元/集成测试

```bash
npm test   # node --test tests/**/*.test.js
```

测试目录分布：

| 目录 | 覆盖领域 |
|---|---|
| `tests/generation/` | 生成器契约、注册表、教育语义、金题集、覆盖率、变式/迷思剖面、图形渲染（44 文件） |
| `tests/orchestration/` | POL 编排、题型、难度、数量、配额、查重、KBL 边界（23 文件） |
| `tests/presentation/` | 渲染、排版 plan、SVG 契约与安全、页面契约（8 文件） |
| `tests/adaptive/` | 自适应策略（4 文件） |
| `tests/source/` | 随机源 / 权重分配 / 随机分布 / KBL rootHash / 知识页漂移（6 文件） |
| `tests/validator/` | 答案验证器（含安全）（4 文件） |
| `tests/core/` | core 基础（1 文件） |
| `tests/semantic/` | 语义治理（KBL 文档对齐、概念族地基）（3 文件） |

## 2. 唯一全量检查入口（CI 与本地完全一致）

```bash
npm run check-all
```

CI（`.github/workflows/ci.yml`）与本地使用**同一入口、同一脚本**。环境要求：Node 22+（`dev/e2e/browser-e2e.js` 依赖 Node ≥22 内置全局 `WebSocket`；Node 20+ 仅满足非浏览器检查域）。
`scripts/run-all-checks.sh` 也委托到 `npm run check-all`。

### Browser E2E 语义（FINAL-12）

| 环境 | 浏览器 | #15 行为 |
|---|---|---|
| 本地开发 | 不可用 | **SKIPPED**（不阻塞，不得冒充 PASS） |
| 本地开发 | 可用（`CHROME_BIN` 指向 Chrome） | 真实执行 9 步路径 |
| CI / 正式发布 | `CHROME_BIN=google-chrome` + `REQUIRE_BROWSER_E2E=1` | **必须真实执行**；不可用即 FAIL |

9 步路径：首页 index.html → 快速练习 mode=quick → 教师模式 mode=teacher → 知识点入口（知识页 CTA 深链）→ 7 类题型（calc/fill/choice/judge/geometry/classify/apply）→ 生成 → 重新生成 → 刷新 → 打印。
退出码约定：`0`=PASS / `1`=FAIL / `2`=SKIPPED。`check-all` 的 `run()` 据此将 exit 2 标记为 SKIPPED，不计入 FAIL。

### 检查域清单（33 项 = 17 项核心 + KBL 血缘/质量 2 项 + 附加门禁 + FINAL-91）

> 与 `dev/check-all.js` 逐一对应。合计口径：本地 32 PASS / 0 FAIL / 1 SKIP（#15 无 Chrome SKIP）；CI 33 PASS / 0 FAIL / 0 SKIP。

| # | 域 | 命令 | 作用 |
|---|---|---|---|
| 1 | Version | `scripts/sync-sw-version.js` | SW 版本一致 |
| 2 | KBL | `dev/verify-m0.js` + `dev/p28/check-kbl-ai-boundary.js` | KBL M0 校验 + AI 边界 |
| 2 | KBL | `dev/p30/check-kbl-lineage.js` | KBL 血缘门禁（Excel→canonical→runtime，含 rootHash 可复算） |
| 2 | KBL | `dev/check-kbl-quality.js` | KBL 数据质量门禁（含释放包 rootHash 复算） |
| 3 | Lint | `dev/lint-check.js` | 静态质量 |
| 4 | Syntax | `dev/check-syntax.js` | 全项目 JS 语法（328 文件） |
| 5 | Unit | `npm test` | 全链测试（894/894） |
| 6a | Generation | `dev/check-allow-generation.js` | 1570 真实生成 |
| 6b | Generation | `dev/p28/check-generation-matrix-freeze.js` | 矩阵冻结 |
| 6c | Generation | `dev/p28/check-generator-matrix.js` | Generator Registry |
| 6d | Generation | `dev/p28/check-generator-noninterference.js` | 四轴不夺权 |
| 6e | Generation | `dev/p30/check-kp-qt-maker-matrix.js` | KP×QT Maker 分工矩阵 |
| 6f | Generation | `dev/p30/check-generation-failure-classify.js` | 失败分类 count=6 深观测 |
| 6g | Answer-leak | `dev/p32/check-answer-leak.js` | 答案防泄露门禁（AS-18） |
| 7 | Education | `dev/check-educational-generation.js` | 教育语义生成 |
| 8 | Golden | `dev/p25/validate-golden-dataset.js` | 金题集校验 |
| 9a | Difficulty | `dev/p28/check-difficulty-authority-gate.js` | 难度权威链唯一 |
| 9b | Difficulty | `dev/p28/check-difficulty-provenance-gate.js` | 难度溯源 |
| 10 | Presentation | `tests/presentation/renderer.test.js` | 渲染 + Legacy 隔离 |
| 11 | SVG | `tests/presentation/svg-contract*.test.js` + `tests/presentation/svg-sanitizer.test.js` | SVG 返回状态 + 安全 |
| 12 | Security | `dev/p28/check-security.js` | eval/Function + AnswerValidator + HTML + KBL 写保护 |
| 13 | Sitemap | `dev/p28/check-sitemap-freeze.js` | 382 URL 逐条保证 |
| 14a | Crawl | `dev/p28/check-ai-agent-crawl.js` | AI Agent 375/375 |
| 14b | Crawl | `dev/check-crawl-health.js` | 爬虫健康 |
| 15 | Browser/E2E | `dev/p28/check-browser-e2e.js` | 真实浏览器 9 步路径（首页→快速→教师→KP→7类→生成→重生成→刷新→打印）；不可用→SKIPPED，发布强制 |
| 16 | Bundle | `dev/p28/check-bundle-determinism.js --mode bundle` | source==bundle，hash 一致 |
| 17 | Determinism | `dev/p28/check-bundle-determinism.js --mode determinism` | 构建确定性（重跑 hash 不变） |
| 18 | Coverage | `dev/p25/build-coverage-report.js --strict` | 覆盖率报告 |
| 19 | LLM | `dev/check-llm-understanding.js` | AI 可读体检 |
| 20 | Doc | `dev/p28/check-doc-consistency.js` | 历史数字扫描 |
| 21 | Dead Code | `dev/p28/check-dead-code.js` | 死代码矩阵 |
| 22 | Legacy | `dev/p28/check-legacy-matrix.js` | Legacy 治理矩阵 |
| FINAL-91 | Readonly | `dev/check-all.js` 内建 | 运行前后 hash 快照，CI 不得修改源码/测试/冻结文件 |

## 3. 专项门禁脚本（`dev/p28/`）

| 脚本 | 检查 |
|---|---|
| `check-baseline.js` / `build-baseline.js` | 基线指纹 |
| `check-cross-layer.js` | 跨层禁止调用矩阵 |
| `check-kbl-source-closure.js` | KBL 源收口 |
| `check-deterministic-build.js` | Deterministic Build |
| `check-legacy-isolation.js` | 历史数据隔离 |
| `check-question-type-closure.js` | 7 题型收口 |
| `check-generation-matrix-freeze.js` | 1570 生成矩阵 |
| `check-generator-matrix.js` | Generator Registry |
| `check-generator-noninterference.js` | Generator 四轴不夺权 |
| `check-variation-entry-gate.js` | Variation 进入门禁 |
| `check-misconception-chain-gate.js` | Misconception 5 段链 |
| `check-semantic-determinism-gate.js` | 语义确定性（5 连跑） |
| `check-difficulty-authority-gate.js` | 难度权威唯一 |
| `check-difficulty-provenance-gate.js` | 难度溯源 |
| `check-semantic-question-closure.js` | SemanticQuestion 唯一中间对象 |
| `check-legacy-bridge-deletion.js` | 重复 Legacy Bridge 删除 |
| `check-presentation-dual-track-closure.js` | Presentation 双轨收口 |
| `check-html-safety-boundary.js` | HTML 安全边界 |
| `check-no-eval.js` | 无 eval/new Function |
| `check-answer-validator-security.js` | 答案验证器安全 |
| `check-svg-contract.js` | SVG 返回契约 |
| `check-learner-position.js` | Learner 定位 |
| `check-kbl-ai-boundary.js` | KBL→页→AI 单向 |
| `check-seo-ai-history-isolation.js` | 六目录隔离 |
| `check-sitemap-freeze.js` | Sitemap 冻结 |
| `check-ai-agent-crawl.js` | AI Agent 抓取 |

## 4. Pre-commit 与 Full Gate 分层

### Pre-commit（快速，开发时每次提交）

`scripts/pre-commit.sh`（启用：`git config core.hooksPath scripts/githooks`）

| 步 | 检查 | 范围 |
|---|---|---|
| 1 | Lint | 全量 regex 扫描（快速） |
| 2 | Syntax | 仅 staged `.js` 文件（`node --check`） |

不包含：M0 门禁、测试套件、1570 生成、crawler、SVG、security 等。

### Full Gate（CI + 发版前）

```bash
npm run check-all
```

包含全部 33 项检查域（见 §2 清单）。CI 与本地使用同一入口。

### 何时跑 Full Gate

- CI 自动触发（push / PR）
- 发版前
- 修改 KBL / Generator / Validator / Presentation 冻结层后
- 怀疑回归时
