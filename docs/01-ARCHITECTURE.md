# 01-ARCHITECTURE — 架构层级与 AI 编程规则

> 状态：FROZEN（只读契约）
> 建立：P28-02（架构层级冻结表）+ P28-03（跨层禁止调用矩阵）+ P28-01（AI 编程规则）
> 用途：任何改动必须先判归属层 → 唯一责任模块；跨层调用须经正式接口。

## 1. 冻结单向执行链（唯一，不可重排、不可跳层、不可双轨）

```text
KBL
↓ KnowledgeContext
↓ POL
↓ Strategy
↓ Generator
↓ Validator
↓ SemanticQuestion
↓ Presentation
↓ SVG
```

## 2. 架构层级冻结表

| 层 | 唯一职责 | 唯一责任模块（SSOT） | 不允许做 |
|---|---|---|---|
| **KBL** | 知识事实（KP 定义/字段/映射/关系/ALLOW） | `kbl/`（root/canonical/data/index/teaching） | 编造数据；越权改题型/布局/难度；新增第二事实源；被 SEO/AI/Crawler/LLM 反向修改 |
| **KnowledgeContext** | KBL Runtime 转换（运行时上下文，全链只读消费） | `shared/knowledge/runtime/` + `shared/orchestration/knowledge-context.js` | 持有业务决策；偏离 KBL 事实；被当作可写数据源 |
| **POL** | 编排（Request → 范围解析 → KP×QT Cell → Quota → 数量分配 → 难度协调 → Generation Plan） | `shared/orchestration/`（practice-orchestrator / practice-plan / budget-allocation / difficulty-orchestrator） | Render/Print/SVG/教育策略决策/Generator 选择；破坏 `requested ≥ planned ≥ generated = final` |
| **Difficulty** | 难度定义（唯一公式 + 静态七维目录） | `shared/catalog/difficulty.js` + `difficulty-static.js` | 第二套公式；逐题特调 |
| **Strategy** | 生成策略（策略选择/Plan 结构/约束构造） | `shared/strategy/` | 直接产题；改 Validator 契约；双轨 |
| **Generator** | 生成题目 | `shared/generator/`（generators / registry / selector / core / api） | 自造 KP 数据；绕过 Selector/Executor；降质量换成功；用 `Math.random`（须走 `core/rng.js`） |
| **Validator** | 验证题目（答案/语义/难度/查重/覆盖/质量） | `shared/validator/` | 放宽规则；删减检查换 PASS |
| **SemanticQuestion** | 统一题目对象（全链唯一题目数据契约） | `shared/semantic/semantic-question.js` | 第二套题目对象；字段口径漂移 |
| **Presentation** | 页面表达（HTML 渲染/打印/输出格式） | `shared/presentation/`（html-renderer / renderer / print / svg-registry） | 下沉业务判断/私有题型；私带 `@media print` |
| **SVG** | 图形表达 | `shared/svg/` + `plugins/svg-*.js` | 承载文字语义；绕过 SVG 注册统一入口 |
| **Learner** | 学习状态基础设施（供数不决策） | `shared/learner/` | 伪造结果；越权影响生成质量；新增评分/AI 自适应/推荐/黑盒模型；写 KBL |
| **Crawl** | 外部发现（robots/sitemap/canonical/SEO/AI 可读/爬虫健康） | `sitemap.xml` / `robots.txt` / `dev/build-knowledge-pages.js` | 为 SEO 注入虚假内容；伪造 author/rating/review |

### 归属判定规则

1. 一个问题只能归到**一层**；跨层问题拆多个，逐层走 AI 规则流水线。
2. 该层内唯一责任模块缺位时**停手提问**，不得就近改相邻层。
3. `shared/` 为唯一下沉点；禁止新建顶层源码目录承接本表责任。
4. 冻结层之间禁止建立旧/新双轨兼容层。

## 3. 跨层禁止调用矩阵

### 图例

| 符号 | 含义 |
|---|---|
| `→` | 正式调用链（允许，唯一方向） |
| `R` | 允许只读——必须通过正式接口 |
| `◇` | 数据对象契约的产出/消费 |
| `✗` | 禁止（含读取；硬红线） |

### 矩阵（行=调用方，列=被调用方）

| 调用方 \ 被调用方 | KBL | KnowledgeContext | POL | Difficulty | Strategy | Generator | Validator | SemanticQuestion | Presentation | SVG | Learner | Crawl |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **KBL** | · | ↓ | · | · | · | · | · | · | · | · | · | · |
| **KnowledgeContext** | R | · | → | · | · | · | · | · | · | · | · | · |
| **POL** | · | R | · | R | → | · | · | · | · | · | · | · |
| **Difficulty** | · | · | · | · | · | · | · | · | · | · | · | · |
| **Strategy** | · | R | · | R | · | → | · | · | · | · | · | · |
| **Generator** | ✗ | R¹ | ✗ | ✗² | · | · | → | ◇³ | · | · | · | · |
| **Validator** | · | R¹ | · | R | · | ✗ | · | ◇ | · | · | · | · |
| **SemanticQuestion** | · | · | · | · | · | · | · | · | · | · | · | · |
| **Presentation** | · | R¹ | · | · | · | ✗ | R⁴ | R | · | → | · | · |
| **SVG** | · | · | · | · | · | ✗ | · | R | · | · | · | · |
| **Learner** | ✗⁵ | R¹ | · | · | · | · | · | R | · | · | · | · |
| **Crawl** | ✗⁵ | R¹ | · | · | · | · | · | R | · | · | · | · |

> 注 ¹：只读经 registry/contract 正式接口（KBL Runtime），禁止直达 `kbl/` 数据文件。
> 注 ²：Generator 不得计算/改写难度——难度是下发参数。
> 注 ³：Generator 产出题目载荷，由 Executor 归一化为 SemanticQuestion。
> 注 ⁴：Presentation 判分只允许经 PracticeSession/Checker 正式接口。
> 注 ⁵：对 KBL 的写入一律禁止；只读按 `R` 走正式接口。

### 硬红线（8 条禁止边）

| # | 禁止边 |
|---|---|
| 1 | Generator → KBL |
| 2 | Generator → POL |
| 3 | Generator → Difficulty 计算 |
| 4 | Presentation → Generator |
| 5 | SVG → Generator |
| 6 | Validator → Generator |
| 7 | Learner → KBL mutation |
| 8 | SEO/Crawl → KBL mutation |

### 门禁

```bash
node dev/p28/check-cross-layer.js   # 基于 P28-DEPENDENCY-MATRIX.json，新增违规边 → 退出码 1
node dev/p28/build-baseline.js      # 改动后可重跑刷新依赖矩阵
```

## 4. AI 编程规则（禁止乱跑）

### 修改原则流水线

```
问题 → 归属层 → 唯一责任模块 → 最小修改 → 局部验证 → 全量验证
```

1. **问题可复现**：动手前先写复现路径，改完用它证明已解决。
2. **归属层唯一**：一个问题只归一层；跨层拆多个逐个处理。
3. **唯一责任模块**：该层内只有 1 个模块负责；找不到就问，不猜不扩。
4. **最小修改**：diff 仅含解决问题的必要行；同文件其他问题另开任务。
5. **局部验证**：先模块级，再全量；全量失败回看局部，不跳过。
6. **改造成本 > 重跑成本**则放弃改动，重走流水线。

### 十条禁止

| # | 禁止行为 |
|---|---|
| 1 | 为通过测试改变测试标准 |
| 2 | 为兼容旧代码增加新的兼容层（COMPAT/BRIDGE/适配壳） |
| 3 | 发现错误就增加 fallback/兜底/吞错 |
| 4 | 发现 API 不一致就复制一套 API |
| 5 | 发现数据缺失就 AI 自己编数据 |
| 6 | 发现文档错误直接修改代码 |
| 7 | 发现代码复杂就直接重构整个模块 |
| 8 | 为 SEO 增加虚假内容 |
| 9 | 为生成成功降低 Validator 标准 |
| 10 | 为测试 PASS 删除失败用例 |

### 越界即回退

AI 触犯任意一条：立即停止 → 说明触犯条款与证据 → 回退本轮改动 → 重走流水线。
唯一允许偏离：用户**显式**指令覆盖某条规则，并留存指令依据。
