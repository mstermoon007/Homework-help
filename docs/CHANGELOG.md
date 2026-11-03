# CHANGELOG

> 阶段报告全文见 `docs/archive/phases/`；此处为按版本聚合的变更摘要。

## v5.2.1 — P45 单题质量缺陷修复收口（2026-11-03）

### P40 质量深度审计（战役一/二）

- **P40-Q01~Q19 + P40-T07~T14**：34 任务完成，覆盖题目质量全维度（概念正确性、可变性、必要构造、年级适配、迷思干扰项、跨 KP 关系、分数化简、竖式呈现、解析结构、上下文题、定义题等）。
- 概念族模型正式化：`CONCEPT_FAMILIES` 14 主干族 + `EXTRA_FAMILIES` 11 扩展族 + `R-REL-03` 44 条带 `evolution{op}` 的主干链；每 KP 得 `{familyId, stageOrder}` 回填 `capability.json`（375/375）。
- ALLOW 矩阵 1570→1566（P44/H9：源 Excel 改判「数与代数」）；Relations 373→407（P44/H10-A fam_negative +1、H10-B fam_observation +3、H10-C fam_direction +28）。
- 门禁 31→34 项（新增 6g 答案防泄露、23 实例级质量）；测试 762→937 用例。

### P41 Generator/Strategy 边界收口

- 四轴 Z1-Z4 禁令实装；TypeContract 契约化；冻结执行链 Generator→Validator→SemanticQuestion 单入口。

### P42 真值体系（Truth + Participation Gate）

- Truth-Verifier + Participation-Checker 接入 Validator；instance gate 23 覆盖 1566 行；fraction simplify 真值断言；golden-truth gate 接入生产门禁。

### P45 单题质量缺陷修复（16 类硬缺陷 + 挂起项解冻）

**审计来源**：`audit/single-question-quality-20261031/`，1566 道真实生成题，16 类硬缺陷 / 51 行命中，全部根因在 Generator 层。

| 缺陷类 | 修复任务 | 根因 | 修复位置 |
|---|---|---|---|
| A1/A2 图形数量 ≠ 答案（正方形/角） | P45-01 | 计数题图元描述符只有 1 个，答案却是 N | `shape.js::makeCountQuestion` + 描述符构造 |
| B1/B2/B3 条形图设问-答案-选项三口径不一致 | P45-02 | 「多多少」fill 答非所问、choice 无差值选项 | `stats.js` 条形图题族 `BAR_Q` + choice 分支 |
| C1~C5 分数输出未统一既约格式化 | P45-03 | 答案/解析/填空/内部四处格式化口径不一 | `fraction.js` 统一格式化入口（含 div-fill 模板） |
| D1/D3/D4/D5 图文不符（刻度尺配圆、周长配平行四边形、8×5 配 8×3、单位换算挂装饰图） | P45-04/P45-05 | 主题图形题走 flat 随机采样；度量题统一挂固定装饰矩形 | `shape.js::generate` 图形选择入口；`money.js::makeGraphicForMoney` |
| D2 问长方形配正方形 | P45-09 | subtype 由 KP 名首命中派生，题面主问对象被忽略 | `shape.js::themedItemMeta` + apply 分支（题面主问对象优先） |
| E1 判断题题干残留 `____` | P45-06 | judge 机械转换未解消 fill 空位 | `type-contract.js::finishJudge` + `money.js:325` 同源点 |
| X3「以上说法都不对」凑位短语 | P45-10（解冻） | 两处 `finishChoice` 硬编凑位短语 | 新建 `core/distractors.js` 唯一派生点，按答案形态派生真实干扰项 |
| X4 跨 KP 解析模板 | P45-10（解冻） | 已有解析前置悬空桥接句 | `semantic-parameters.js::composeExplanation` 仅空解析兜底 |
| X9 语言格式残留 | P45-10（解冻） | 三处脚手架残留（参考标签/重复列式/标出 Ncm） | `concept-meaning.js`/`percent.js`/`semantic-relations.js`/`stats.js` 清理 |

**Validator 实例级门禁（V-A~V-E）**：P45-07 接入 `answer-validator.js::validateInstanceConsistency`（V-A 图元计数、V-B 答案形态、V-D 描述符-题面同名、V-E judge 空位）+ `quality-scorer.js::checkFractionForm`（V-C 分数既约）；gate 23 对 1566 行零误报。

**派生链同步修复**：P45-08（T2 锚随合法形态更新，变体采样扩单样本）；P45-09（D2 修复后 shape-recognition 43 行锚降级为存在性）；P45-12（`probeVaries` 前缀错位 bug 修复 + 36 条布尔标志 `field`→`fieldPresent` 降级）；P45-13（raw 探针统一经 `PracticeSession({skipValidation:true})` 单一路径）；P45-19（11 行质量族证据规则失效字段纯删除，5 个门禁 FAIL 收敛）；P45-NEXT-01/02/03（质量族规则补全、partial-sample 形态闭合判定、probeAgg 单套化）；P45-NEXT-04（shape.js 双入口收敛）；P45-20（死代码与无效文件清理）。

**新增文件**：
- `shared/generator/core/distractors.js`（唯一干扰项派生点，按答案形态派生真实干扰项）
- `tests/generation/p45-01~10.test.js`、`tests/validator/p45-07-quality-gates.test.js`、`tests/generation/p40-t08-explanation-bridge.test.js`（X4 契约同步）

**全量数据不变**：375 KP / 98 Units / 407 Relations / 1566 ALLOW / 23 Generator / 7 题型。P45 修复 Generator 产出形态，不改变 KBL/POL/Strategy/难度/题型决策链。

### 门禁与测试（当前口径）

- npm test **993/993** PASS（16 套件 / 110 测试文件；P40 +84、P42 +43、P45 +56 新增）。
- check-all **34 项**：本地 33 PASS / 0 FAIL / 1 SKIP（#15 无 Chrome SKIP）；CI 34 PASS / 0 FAIL / 0 SKIP。
- 16 类硬缺陷 51 行清零；X 类挂起项全部解冻修复；P45-NEXT-01~05 全部处置完毕。

---

## v5.2.0 — P34~P39 收口（2026-10-12）

### P34 数据正确性战役（波次 1/2/3）

- 题目语义/表述、图形分类、开放设计讲解、解析质量、变式与算术 calc、难度执行端修复；H6 三视图去图。

### P35 难度执行端消费 + 遗留债务统一收口

- DEBT-1~7 取证销账、图形表达实现、战役最终冻结。

### P36 / P37 遗留活账处置

- P36：judge/apply 配图修复、开放设计讲解深化（规则内重组）、concept 讲解任务登记。
- P37：人工请求 H1–H5 签批处置、F-TYPE-2 rawType 别名收口、practice.html 渲染路径登记项处置。

### P38 107 图形断链清零 + 语义治理

- 33 KP 接入裁决全部销账（维持剔除，基线不变）；107 条图形生成真断链清零（T2 意图运行时投影 `qt-intent-runtime.json` + 六生成器配图 + SVG 渲染器扩族）。
- makeAreaGeometry winner 缺陷修复；role 双轨统一（auxiliary 收紧为必须配图）；141 条 needs-review 意图行经派生器规则改进清账（P38-GEN-01~04，284→2→0）。

### P39 死代码清理 + 文档与文件清洗收口

- rawType 死链全链清零（canonical rootHash 更新）；schema 图形子类型白名单与生产真值对齐（补 9 项 + 删 13 对死条目）；`GRAPHIC_TYPES` 删 `number-line`/`grid` 2 个类型级死条目；FINAL-91 门禁 `.DS_Store` 瞬态误报根治。
- 图形类型白名单收敛 = `geometry/chart/diagram/currency` + `custom`（svg-legacy 透传架构保留项）。
- 文档口径全量对齐（00-BASELINE 门禁链 31 项重写、测试 762/762、sitemap 382、核心路径实证订正）+ 开发文档/文件清洗（P32 审计报告归档、docs-2026-09 快照、根 archive/ 6 目录、release/、dev/reports/、kbl/releases/ 快照、全库 .DS_Store 清扫；删除后四面断链核查零断链）；两役准备稿 `docs/P40-PREP.md` 落盘。

### 门禁与测试（当前口径）

- npm test **762/762** PASS（15 套件 / 71 测试文件）。
- check-all **31 项**：本地 30 PASS / 0 FAIL / 1 SKIP（第 15 项无 Chrome SKIP）；CI 31 PASS / 0 FAIL / 0 SKIP。
- 基线 375/98/373/1570 全程不变。

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

- check-all 31 项：本地 30 PASS / 0 FAIL / 1 SKIP（无 Chrome 时第 15 项 SKIP）；CI 设 CHROME_BIN 为 31 PASS / 0 FAIL / 0 SKIP（v5.1.0 收口时点口径，P32 加入 6g 后定稿）。
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
