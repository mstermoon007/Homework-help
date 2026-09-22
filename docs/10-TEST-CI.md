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
| `tests/generator/` | 生成器契约、教育语义、金题集、覆盖率、变式/迷思剖面 |
| `tests/orchestration/` | POL 编排、题型、难度、数量、配额、查重 |
| `tests/difficulty/` | 难度权威链、静态权重、编排器归一 |
| `tests/validator/` | 答案验证器（含安全） |
| `tests/presentation/` | 渲染、SVG 契约、SVG 安全 |
| `tests/learner/` | 学习状态、数据链、存储 |
| `tests/strategy/` | 策略可解释性 |
| `tests/adaptive/` | 自适应策略 |
| `tests/unit/` | 基础工具、语义族、教学语义剖面 |
| `tests/bridge/` | 并发契约 |
| `tests/generator-registry/` | Generator Registry |
| `tests/request/` | 请求契约 |
| `tests/shape/` | 图形 KBL 形状 |

## 2. 唯一全量检查入口（CI 与本地完全一致）

```bash
npm run check-all
```

CI（`.github/workflows/ci.yml`）与本地使用**同一入口、同一脚本、同一环境要求**（Node 20+）。
`scripts/run-all-checks.sh` 也委托到 `npm run check-all`。

### 检查域清单（24 项）

| # | 域 | 命令 | 作用 |
|---|---|---|---|
| 1 | Version | `check:sw-version` | SW 版本与 package.json 一致 |
| 2 | KBL | `verify` (M0) + `check-kbl-ai-boundary` | KBL 校验 + AI 边界 |
| 3 | Lint | `check-lint` | 静态质量 |
| 4 | Syntax | `verify:syntax` | 全项目 JS 语法（286 文件） |
| 5 | Unit | `npm test` | 全链测试（534/534） |
| 6 | Generation | `verify:allow-gen` + 矩阵冻结 + Registry + 四轴 | 1570 真实生成 + Generator 收口 |
| 7 | Education | `verify:education` | 教育语义生成 |
| 8 | Coverage | `verify:coverage` | 覆盖率报告 |
| 9 | Golden | `verify:golden` | 金题集校验 |
| 10 | Difficulty | 权威链 + 溯源 | 难度唯一公式 |
| 11 | Presentation | `renderer.test.js` | 渲染 + Legacy 隔离 |
| 12 | SVG | 契约 + Sanitizer | SVG 返回状态 + 安全 |
| 13 | Security | `check-security.js` | eval/Function + AnswerValidator + HTML + KBL 写保护 |
| 14 | Sitemap | `check-sitemap-freeze.js` | 381 URL 逐条保证 |
| 15 | Crawl | `check-ai-agent-crawl` + `check-crawl-health` | AI Agent 375/375 + 爬虫健康 |
| 16 | LLM | `check:llm-understanding` | AI 可读体检 |
| 17 | Browser/E2E | `generation-concurrency.test.js` | 并发契约 + 生成链 |
| 18 | Doc | `check-doc-consistency.js` | 历史数字扫描 |

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

包含全部 24 项检查域（见 §2 清单）。CI 与本地使用同一入口。

### 何时跑 Full Gate

- CI 自动触发（push / PR）
- 发版前
- 修改 KBL / Generator / Validator / Presentation 冻结层后
- 怀疑回归时
