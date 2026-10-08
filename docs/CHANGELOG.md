# CHANGELOG

> 阶段报告全文见 `docs/archive/phases/`；此处为按版本聚合的变更摘要。

## v5.1.0 — P30/P31/P32 收口（2026-10-08）

### 答案系统收口（P32）

- 单一判分权威：`shared/validator/answer-validator.js` 同归运行时批改与出题质检；删除 `defaultQCheck` 第二套判定（P32-AS-08）。
- 答案数据不丢失：RenderFormat 保留完整 answer 规格，acceptable 白名单运行时真实生效。
- parentCheck 通道：`shared/core/check.js computeResult` 聚合 `grade===null` 信号（apply/geometry 长文本说理 85 行 eligible），UI 既有「✅ 请家长检查」面板由死转正；红线 #5 不破（null → results[i]=false，不"非空即对"）。
- 答案防泄露门禁（AS-18，check-all 第 31 项 6g）：L1 严格 token 扫描 + 163 条显式白名单注册表、L2 渲染 SVG text 扫描（修复 AS-02 只扫 q.graphic 漏 data.graphic 的审计盲区）、L3 结构断言、L4 hint=0、自判回放 FALSE=0。
- 真实运行时闭环取证（AS-19）：3 场景 ×7 类断言 = 86 断言全 PASS，屏打 WYSIWYG `--grid-cols` 同源验证。
- P32 战役最终冻结（2026-10-08 AS-21）：npm test 742/742、check-all 31/0/0（CI 标尺）。

### 显示层排版收口（P31）

- 排版决策收口：`shared/presentation/layout.js` 唯一排版决策中心（纯函数、无 DOM）；`shared/core/core.js` Layout 物理迁出，无 `PluginUtil.layout` 别名。
- screen/print 2 模式 + 1 emergency 渲染器；题目编号统一「1.」纯文本。
- 第二渲染器（`practice.html renderGeneric`）物理删除；二次度量清除。
- P31 战役五阶段（SCAN/CORE/WIRE/VISUAL/ACCEPT）10 任务全部完成。

### SVG / 图形描述符治理（P30）

- 数据权限分级（T0-T3）+ 语义消费规则（接通 T2 已有教学语义到既有消费方，不新造语义）。
- 断链修复四要素登记；同族 NO-DESC 断链逐题型核实教学意图后三向分流。
- 死代码三方印证（全库 grep + 门禁 21/22 + 测试面）后物理删除不留壳。
- P30 战役最终冻结（2026-10-04）：4 阶段门禁全部过门。

### 文档与基线对齐（P33-01/02/03）

- 6 个 deprecated 历史快照（FINAL-REPAIR-STATUS / FINAL-REPAIR-BASELINE / FINAL-130-ACCEPTANCE / FINAL-REPAIR-DEFERRED / FINAL-FREEZE / P28-FINAL-FREEZE）归档至 `docs/archive/phases/snapshots/`。
- `docs/00-BASELINE.md` 版本号 5.0.0 → 5.1.0、SW 缓存名 `hw-help-5.0.0` → `hw-help-5.1.0`（对齐 VERSION/package.json/sw.js 实测）。
- 本节追加澄清 v5.0.0 期间 Sitemap 381 URL 为当时口径；当前基线 Sitemap **382 URL**（6 公共页 + 375 KP + 1 索引页）。

### 门禁与测试

- check-all 30 项：本地 29 PASS / 0 FAIL / 1 SKIP（无 Chrome 时第 15 项 SKIP；CI 设 CHROME_BIN 为 31 PASS / 0 FAIL / 0 SKIP）。
- npm test 742/742 PASS / 0 FAIL（14 测试套件）。
- 375/98/373/1570 口径全程不变。

## v5.0.0 — FROZEN（2026-09-19 起进入维护模式）

### 架构基线（T10 最终冻结）

- 全链唯一执行链冻结：KBL→KnowledgeContext→KP×QT→Strategy→Requirements→Plan→Executor→Selector→Generator→Validator→Presentation→Practice
- 冻结范围：KBL / QuestionType / Difficulty / POL / Requirements / Plan / Executor / Selector / Generator / Validator / Presentation / Practice / Print / UI
- 门禁：verify 5/5 + syntax + npm test + lint + E2E

### 产品化一致性收口（T11 / P24）

- 知识页 + sitemap 重建：375 KP 页 = sitemap 375；sitemap 381 URL（5 公共 + 375 KP + 索引）
- ALLOW 真实性：1570 个 KBL ALLOW 映射逐条真实生成；修复 15 个 calc 对 0 题（重绑 arithmetic-division/arithmetic-multiplication，新增 generator:percent-calc）
- Capacity Map 重建：375 keys / 1570 ALLOW 全重叠 / 0 stale / 0 missing
- UI bug 修复：select.html 分类键 sort→classify；教师模式取消选择索引错位；request-normalize.js 浏览器裸 require 断链
- 版本统一 5.0.0（VERSION / package.json / version.js / SW CACHE / index.html）

### 教学语义（P25）

- 金题集 / 语义证据 / 题型契约 / KP×QT 意图
- 覆盖率门禁（A 类 KP）
- 教育语义生成门禁

### 变式与迷思（P27）

- 5 段 Misconception 链：Misconception → Trigger → QuestionVariation → ExpectedError → Feedback
- Variation/Misconception 剖面

### 工程治理全链冻结（P28）

- KBL：源收口 / Deterministic Build / 历史数据隔离（生产代码 0 命中旧 token）
- 架构：12 层归责表 / 跨层禁止调用矩阵（8 条硬红线）/ AI 编程规则（10 条禁止）
- 题型：7 canonical 类收口；旧令牌仅存 normalizeQuestionType
- 生成：1570 矩阵冻结 / 31 Generator Registry / Generator 四轴不夺权
- 难度：唯一权威链（Static Difficulty → DifficultyOrchestrator → Difficulty → Parameters → Strategy → Generator）
- 验证：固定 Seed 语义确定性 / Semantic PASS-WARN-FAIL 显式分离 / A 类 KP 语义
- Presentation：SemanticQuestion 唯一中间对象 / 删除重复 Legacy Bridge / 唯一渲染链（render.js 删除）
- SVG：返回 SUCCESS/UNSUPPORTED/FAILED；SVGSanitizer；全量 Contract Test
- Learner：供数不决策；唯一评分入口（EMA mastery + confidence）
- Web/AI：KBL→页→AI 单向 / 六目录 noindex / Sitemap 381 冻结 / AI Agent 375/375 抓取
- 安全：无 eval/new Function；AnswerValidator Tokenizer→Parser→AST→Safe Evaluator；HTML 安全边界
- 文档系统：按主题域重组（00-BASELINE ~ 11-SECURITY + CHANGELOG），阶段报告归档至 `docs/archive/phases/`

## 历史阶段（ARCHIVED）

| 阶段 | 主题 | 归档位置 |
|---|---|---|
| T0 | 基础架构 | `docs/archive/phases/` |
| T1 | KBL 数据治理（旧口径） | 同上 |
| T2 | 难度系统收口 | 同上 |
| T3 | POL 编排层 | 同上 |
| T4 | 七类题型统一 | 同上 |
| T5 | GAP-4 + P0-05 FINAL | 同上 |
| T6 | P0-09 全链唯一决策验证 | 同上 |
| T7 | P0-11-B 产品回归 | 同上 |
| T8 | P0-12 二级/三级 UI 控制审计 | 同上 |
| T9 | P0-13 项目清理 | 同上 |
| T10 | 最终冻结 Clean Product Baseline | 同上 |
| T11 | P24 产品化一致性收口 | 同上 |
| P25 | 教学语义 | 同上 |
| P26 | （归档） | 同上 |
| P27 | 变式与迷思 | 同上 |
| P28 | 工程治理全链冻结 | 同上 |
