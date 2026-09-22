# ARCHITECTURE-OWNERSHIP — 架构层级冻结表（P28-02）

> 状态：FROZEN（只读契约）
> 建立：P28-02（2026-09-20）｜基线：`docs/P28/P28-BASELINE.md`｜AI 规则：`docs/AI-DEVELOPMENT-RULES.md`
> 依据：`docs/01-ARCHITECTURE-FROZEN.md` 冻结执行链细化为**层归责表**。
> 用途：任何改动必须先判归属层 → 唯一责任模块（P28-01 流水线第 ②③ 步）。

## 1. 冻结层表

| 层 | 唯一职责 | 唯一责任模块（SSOT 目录/文件） | 不允许做 |
| --- | --- | --- | --- |
| **KBL** | 知识事实（KP 的定义、字段、映射、关系、ALLOW） | `kbl/`（root/canonical/data/index/teaching；KBL Runtime 派生） | 编造字段/数据；越权改题型、布局、难度；新增第二套事实源；被 SEO/AI/Crawler/LLM 反向修改（P28-33 红线：公开面单向 `KBL→静态页`，写方仅限离线派生白名单 `docs/p28/P28-33-KBL-AI-BOUNDARY.md`） |
| **KnowledgeContext** | KBL Runtime 转换（把 KBL 事实转成运行时上下文，供全链只读消费） | `shared/knowledge/runtime/`（knowledge-runtime.js / knowledge-api.js / knowledge-contract.js 等）+ `shared/orchestration/knowledge-context.js` | 持有业务决策；偏离 KBL 事实；被当作可写数据源 |
| **POL** | 编排（Request → 范围解析 → KP×QT Cell → Quota → 数量分配 → 难度协调 → Generation Plan） | `shared/orchestration/`（practice-orchestrator.js / practice-plan.js / budget-allocation.js / difficulty-orchestrator.js） | 负责 Render/Print/SVG/教育策略决策/Generator 选择；破坏 `requested ≥ planned ≥ generated = final` 不变量 |
| **Difficulty** | 难度定义（唯一难度公式 + 静态七维目录） | `shared/catalog/difficulty.js` + `difficulty-static.js` | 建立第二套难度公式；逐题特调改公式 |
| **Strategy** | 生成策略（策略选择、Plan 结构、约束构造） | `shared/strategy/`（*strategy.js / constraint-builder.js / question-plan.js） | 直接产题；改动 Validator 契约；双轨并行 |
| **Generator** | 生成题目（26 个 Generator + 核心运算语义 + 数量/难度闭环执行） | `shared/generator/`（generators/*.js、generator-registry.js、generator-selector.js、core/*.js、generation/api.js） | 自造 KP 数据；绕过 Selector/Executor；降低质量换取成功率；使用 `Math.random`（须走 `core/rng.js`） |
| **Validator** | 验证题目（答案/语义/难度/查重/覆盖/质量评分） | `shared/validator/`（answer-validator.js、kp-semantic-validator.js、validation-pipeline.js、composite-validator.js 等） | 放宽任何规则；删减/弱化检查换取 PASS |
| **SemanticQuestion** | 统一题目对象（全链唯一的题目数据契约） | `shared/semantic/semantic-question.js` | 第二套题目对象；字段口径漂移 |
| **Presentation** | 页面表达（HTML 渲染/打印/输出格式统一） | `shared/presentation/`（html-renderer.js、renderer.js、print.js、svg-registry.js）+ 页面 `*.html`（render.js 已于 P28-22 删除：唯一渲染链 = PresentationRenderer → HTMLRenderer → RenderResult） | 下沉业务判断/私有题型逻辑；私带 `@media print` |
| **SVG** | 图形表达（题图/图形字符集的生成与渲染） | `shared/svg/` + `plugins/svg-*.js` | 承载文字语义内容；绕过 SVG 注册统一入口 |
| **Learner** | 学习状态基础设施（练习结果事实契约、状态累计与统计、错因 SSOT、持久化；**供数不决策**：难度/螺旋决策在 Strategy 层消费其数据作出） | `shared/learner/`（learner-model.js＝KnowledgePracticeState 载体 P28-31、error-model.js、practice-result.js、result-collector.js、learner-storage.js） | 伪造练习结果；越权影响生成质量判定；新增第二套评分/AI 自适应难度/推荐模型/黑盒评分（P28-31 禁止项）；写 KBL |
| **Crawl** | 外部发现（robots/sitemap/canonical/知识页 SEO/AI 可读/爬虫健康门禁） | `sitemap.xml`、`robots.txt`、`dev/build-knowledge-pages.js`、`scripts/crawl-site.js`、`dev/check-crawl-health.js`、`.github/workflows/` | 为 SEO 注入虚假内容；伪造 author/rating/review（P26 红线） |

## 2. 归属判定规则

1. 一个问题只能归到**一层**；跨层问题拆多个，逐层走 P28-01 流水线。
2. 该层内唯一责任模块缺位时**停手提问**，不得就近改相邻层。
3. 目录 `shared/` 为唯一下沉点；`src/` 不存在，禁止新建顶层源码目录承接本表责任。
4. 冻结层之间禁止建立旧/新双轨兼容层（对应 AI 规则「禁止 2」）。

## 3. 冻结执行链（只读，不可重排、不可双轨）

```text
KBL → KnowledgeContext → KP×QT → Strategy → Generation Plan
→ Executor(generation/api) → Selector → Generator
→ Validator → SemanticQuestion → Presentation → SVG/Print → Practice
（Learner 承接练习结果回写；Crawl 承接公开页发现）
```

## 4. 修改触达规则

| 触达对象 | 规则 |
| --- | --- |
| 本表仅改 docs/ 文本 | 允许（文档修正），但不得借此改层职责 |
| 本表层内模块 | 走 P28-01：唯一责任模块 → 最小修改 → 局部验证 → 全量验证 |
| 跨层改动 | 禁止同步进行；逐层独立提交、独立验证 |
| KBL / POL / Generator / Validator / Difficulty / SemanticQuestion | 冻结核心，任何修改须先说明必要性再动（P28 基线比对） |

## 5. 验证

- 归属判定错误 ⇒ 改动直接回退（P28-01 越界即回退）。
- 每层改动完成后对照 `docs/P28/P28-BASELINE.md` 与 `npm run verify` 全绿。