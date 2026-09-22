# 00-BASELINE — CURRENT BASELINE（唯一当前真实状态）

> **本文档是项目唯一当前基线。**
> 任何关于"项目现在是什么"的判断，只以本文档为准。
> 阶段报告（P13–P28）归档于 `docs/archive/phases/`，仅作历史追溯，不作为当前依据。

---

## Version

| 项 | 值 | SSOT |
|---|---|---|
| 版本号 | **5.0.0** | `VERSION` / `package.json` / `shared/catalog/version.js` |
| SW 缓存名 | `hw-help-5.0.0` | `sw.js` |
| 形态 | 纯前端静态站，零运行时依赖 | — |
| 浏览器 + Node 双环境兼容 | ✓ | — |

三方一致：`VERSION` = `package.json.version` = `shared/catalog/version.js` = `sw.js CACHE`。

---

## KBL

| 项 | 值 | SSOT |
|---|---|---|
| KP（知识点） | **375** | `kbl/canonical/knowledge.json` |
| Canonical ID 格式 | `{subject}-{grade}-{book}-u{nn}-k{nnn}` | KBL Runtime |
| 唯一可写方 | 离线派生白名单（`tools/kbl/*.js` + `dev/p25|p27/*.js`） | 见 `02-KBL.md` §4 |
| 历史数据隔离 | 生产代码 0 命中旧 token（`KnowledgeBank` / `legacy id`） | `check-kbl-uniqueness.js` |
| KBL→页→AI 单向 | 页面 = KBL 决定性投影，禁止回灌 | `check-kbl-ai-boundary.js` |

> 旧基线数字（旧 KP / 旧 Units / 旧 Relations / 旧 Mappings）为历史口径，仅在 archive 中保留。

---

## Units

| 项 | 值 | SSOT |
|---|---|---|
| Units | **98** | `kbl/canonical/course.json` |
| 学科-年级-册条目 | 12（G1-G6 × 人教版数学） | 同上 |

---

## Relations

| 项 | 值 | SSOT |
|---|---|---|
| Relations | **0** | `kbl/canonical/relations.json` |

当前版本不含知识点间关系数据。`relations.json` 结构存在，`relations` 数组为空。

---

## Mappings

| 项 | 值 | SSOT |
|---|---|---|
| ALLOW 映射 | **1570** | `kbl/canonical/mappings.json` |
| 矩阵冻结 | 1570 = 静态行 = 动态能力端点，FAIL=0 | `dev/p28/check-generation-matrix-freeze.js` |
| ALLOW 真实性 | 1570/1570 真实生成 ≥1 题 | `npm run verify:allow-gen` |

---

## Question Types

| 项 | 值 | SSOT |
|---|---|---|
| Canonical 题型 | **7 类**：`calc` / `fill` / `choice` / `judge` / `geometry` / `classify` / `apply` | `shared/knowledge/question-type-registry.js` |
| 旧令牌 | `oral` / `recognize` / `open` 仅存于 `normalizeQuestionType`，不进入生产能力声明 | — |
| 五面审计 | Registry / Strategy / Generator / Validator / Presentation 全部 = canonical 7 | `dev/p28/check-generator-matrix.js` |

---

## Generators

| 项 | 值 | SSOT |
|---|---|---|
| Generator 总数 | **31** | `shared/generator/generator-registry.js` |
| PRODUCTION | **21** | 同上 |
| PRODUCTION-COMBINE-ONLY | **1**（`generator:composite`） | 同上 |
| DORMANT-CONTRACT-CARRIER | **2**（`selection-choice` / `selection-judge`） | 同上 |
| DORMANT-NO-BINDING | **7**（竞赛 C 族 + 预留） | 同上 |
| Generator 文件 | 24（`shared/generator/generators/*.js`） | — |
| 四轴禁令 | Z1 数量 / Z2 题型 / Z3 难度 / Z4 KP — Generator 不得自决 | `dev/p28/check-generator-noninterference.js` |

---

## Tests

| 项 | 值 | SSOT |
|---|---|---|
| 测试文件 | **58** | `tests/**/*.test.js` |
| 测试用例 | **534** | `npm test` |
| PASS | **534** | 同上 |
| FAIL | **0** | 同上 |
| 测试套件数 | 9 | 同上 |

### 测试目录分布

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

---

## Sitemap

| 项 | 值 | SSOT |
|---|---|---|
| URL 总数 | **381** | `sitemap.xml` |
| 组成 | 5 公共页 + 375 KP 页 + 1 索引页 | 同上 |
| 5 公共页 | `index` / `math-types` / `subject-types` / `practice` / `faq` | — |
| 逐 URL 保证 | HTTP 200 / 无 redirect / 文件存在 / canonical 一致 / 无参数 | `dev/p28/check-sitemap-freeze.js` |

---

## Crawler

| 项 | 值 | SSOT |
|---|---|---|
| AI Agent 可发现 | 375/375 KP 页（仅沿静态 `<a href>` BFS） | `dev/p28/check-ai-agent-crawl.js` |
| AI Agent 可读取 | 375/375 页 200 + 服务端正文含名称+释义（无需 JS） | 同上 |
| identity 正确 | 375/375 canonical == sitemap URL / ID 一致 / `<h1>` == KBL 名称 | 同上 |
| → practice 可达 | 每个 KP 页含 `practice.html?kps={id}` 链接 | 同上 |
| 六目录隔离 | `history/` `debug/` `archive/` `admin/` `test/` `staging/` 全部 `noindex, nofollow` | `dev/p28/check-seo-ai-history-isolation.js` |

---

## Security

| 项 | 值 | SSOT |
|---|---|---|
| `eval(` / `new Function(` | 生产代码 **0 命中** | `shared/` 全量扫描 |
| AnswerValidator | Tokenizer → Parser → AST → Safe Evaluator（无动态执行） | `shared/validator/answer-validator.js` |
| HTML 安全边界 | 题目文本/答案/解析/SVG 全部经安全渲染管线 | `shared/presentation/` |
| SVG 安全 | `SVGSanitizer` 处理；禁止 raw SVG 入 DOM | `shared/svg/` |
| KBL 写保护 | 唯一可写方 = 离线派生白名单；运行时只读 | `dev/p28/check-kbl-ai-boundary.js` |

---

## Performance

| 项 | 值 | SSOT |
|---|---|---|
| 零运行时依赖 | 纯前端静态站，无 npm 运行时包 | `package.json`（`private: true`，无 `dependencies`） |
| 静态站构建 | `knowledge/*.html` 由 KBL 单向生成，带 `kbgen:hash` 指纹 | `dev/build-knowledge-pages.js` |
| Bundle 产物 | `strategy-engine.bundle.js` / `presentation-engine.bundle.js`（预构建） | `shared/engine/` |
| `npm test` 耗时 | ~11s（534 用例） | — |
| `npm run verify` 耗时 | ~8s（8 步 M0 门禁） | — |
| `verify:allow-gen` 耗时 | ~2-4 min（1570 串行真实生成） | `scripts/run-all-checks.sh` |

---

## 唯一生产执行链

```text
KBL
→ KnowledgeContext
→ KP × QT
→ Strategy
→ Generation Requirements
→ Generation Plan
→ 唯一 Executor（shared/generation/api.js）
→ 唯一 Selector
→ Generator
→ Validator
→ SemanticQuestion
→ Presentation
→ Practice
```

UI 只是 Request 的输入端；题型/难度/数量决策全部在 POL 及以下层完成。

---

## 门禁链

| # | 命令 | 作用 |
|---|---|---|
| 1 | `npm run check:sw-version` | SW 版本一致性 |
| 2 | `npm run check-lint` | 静态质量 lint |
| 3 | `npm run verify:syntax` | 全项目 JS 语法（286 文件） |
| 4 | `npm test` | 全链测试（534/534） |
| 5 | `npm run verify` | M0 聚合门禁（8 步） |
| 6 | `npm run verify:allow-gen` | 1570 ALLOW 真实生成 |
| 7 | `node dev/p28/check-kbl-ai-boundary.js` | KBL 回写白名单 + 页面漂移 |
| 8 | `node dev/p28/check-seo-ai-history-isolation.js` | 六目录 noindex/nofollow |
| 9 | `node dev/p28/check-sitemap-freeze.js` | 381 URL 逐条保证 |
| 10 | `node dev/p28/check-ai-agent-crawl.js` | 375/375 AI Agent 抓取 |

一键全量：`bash scripts/run-all-checks.sh`（与 CI 等价）。

### M0 聚合门禁明细（`npm run verify`）

| 步 | 结果 |
|---|---|
| kbl-validate | PASS |
| kbl-runtime | PASS |
| kbl-uniqueness | PASS |
| kbl-access | PASS |
| kbl-dir | PASS（377 文件，全部生成脚本产出） |
| edu-gen | PASS |
| coverage | PASS |
| golden | PASS |

> `kbl-uniqueness` 已修复（P28-41：移除已删除的 `SemanticQuestionBridge.toQuestions` 调用）。

---

## 冻结纪律

### 新任务八问（开始前必须回答）

```text
① 当前时间轴在哪一阶段？
② 当前阶段的唯一目标是什么？（禁止"优化/完善/重构"类模糊任务）
③ 哪些内容已经 FROZEN？
④ 本任务修改哪一层？
⑤ 是否存在重复实现？
⑥ 是否可以删除而不是继续兼容？
⑦ 如何证明修改正确？    → bash scripts/run-all-checks.sh 全绿 + 定向验证
⑧ 如何证明没有扩大范围？
```

### 修改强制动作

```text
定位 → 审计 → 判定 → 最小修改 → 定向验证 → 全量验证（bash scripts/run-all-checks.sh）→ 记录 → 冻结
```

### 总则

- 任何修改不得重新设计已冻结架构（见 `01-ARCHITECTURE.md`）。
- 改动沿 AI 规则流水线：归属层 → 唯一责任模块 → 最小修改 → 局部验证 → 全量验证。
- 历史文档一律进 `archive/`，不得作为当前开发依据。

---

## Generated File Policy（P28-44）

> 明确哪些产物**必须提交**、哪些**不提交**。以项目实际构建方式为准。

### 必须提交（git tracked）

| 类别 | 路径 | 来源 | 说明 |
|---|---|---|---|
| 正式知识页面 | `knowledge/*.html`（375 页） | `dev/build-knowledge-pages.js` 由 KBL 生成 | 带有 `kbgen:hash` 指纹，是站点的正式内容 |
| 正式知识索引 | `knowledge/knowledge-index.html` + `.json` | 同上 | 入口与索引 |
| 正式 sitemap | `sitemap.xml` | 构建脚本生成 | 381 URL，正式对外 |
| 正式 bundle | `shared/engine/strategy-engine.bundle.js` | `dev/build-strategy-bundle.js` | 预构建运行时 |
| 正式 bundle | `shared/engine/presentation-engine.bundle.js` | `dev/build-presentation-bundle.js` | 预构建运行时 |
| 正式 KBL canonical | `kbl/canonical/*.json`（5 文件） | `tools/kbl/derive-kbl.js` 派生 | SSOT 数据，冻结 |
| 正式 KBL manifest | `kbl/manifest/manifest.json` | 同上 | KBL 元数据 |
| 正式 KBL data | `kbl/data/math/*/knowledge-points.json`（7 文件） | `tools/kbl/extract-source.js` 提取 | KBL 源数据 |
| 正式 KBL import | `kbl/import/extract-raw.json` | 同上 | 提取中间产物（冻结快照） |
| 正式 shared knowledge | `shared/knowledge/data/*/knowledge-points.json` | KBL 同步 | 运行时只读副本 |
| 正式 shared manifest | `shared/knowledge/manifest/manifest.json` | 同上 | 运行时只读副本 |
| 正式 capability | `kbl/canonical/capability.json` | 构建脚本 | 能力注册表 |

### 不提交（.gitignore）

| 类别 | 路径模式 | 说明 |
|---|---|---|
| 门禁报告 | `dev/reports/` | 各 check 脚本再生 JSON |
| 阶段报告 | `dev/p25/reports/`、`dev/p26/reports/`、`dev/p27/reports/`、`dev/p28/reports/` | 门禁脚本输出，每次执行覆盖 |
| 审计时间戳 | `dev/p28/reports/*-matrix.json` 中的 `generatedAt` | 时间戳随每次生成变化，不具持久价值 |
| 临时报告 | `competition-report.json` | 本地竞品分析，非正式产物 |
| 本地缓存 | `node_modules/`、`.venv/`、`dist/`、`build/` | 依赖与构建缓存 |
| 测试输出 | `*.log`、`*.tmp` | 运行时临时文件 |
| 系统文件 | `.DS_Store`、`._*`、`.Spotlight-V100` 等 | macOS 系统生成 |
| 本地记忆 | `.workbuddy/`、`.trae/` | AI 辅助工具记忆，非源码 |

### 判定规则

```text
文件是门禁/检查脚本的输出产物 → 不提交
文件是构建脚本的正式产物且带冻结指纹 → 必须提交
文件是 KBL canonical 数据 → 必须提交
文件是依赖/缓存 → 不提交
不确定时 → 看是否可由脚本再生：可再生 → 不提交
```
