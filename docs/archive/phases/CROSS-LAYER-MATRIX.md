# CROSS-LAYER-MATRIX — 跨层禁止调用矩阵（P28-03）

> 状态：FROZEN（只读契约）
> 建立：P28-03（2026-09-20）｜基线：`docs/P28/P28-BASELINE.md`｜归属：`docs/ARCHITECTURE-OWNERSHIP.md`（P28-02）｜AI 规则：`docs/AI-DEVELOPMENT-RULES.md`
> 数据来源：P28-00 依赖矩阵 `docs/P28/P28-DEPENDENCY-MATRIX.json`。
> 规则：**默认禁止跨层调用，除非本表标注 `→`、`R` 或 `◇`。** 新增禁止边 = 违规 = 回退。

## 1. 冻结单向调用链（唯一，不可重排、不可跳层、不可双轨）

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

## 2. 图例

| 符号 | 含义 |
| --- | --- |
| `→` | 正式调用链（允许，唯一方向） |
| `R` | 允许**只读**——**必须通过正式接口**（见 §4），禁止绕过 |
| `◇` | 数据对象契约的产出/消费（非方法调用） |
| `✗` | **禁止**（含读取；硬红线） |
| `·` | 无关 / 自身层 |

## 3. 跨层矩阵（行=调用方，列=被调用方）

| 调用方 \ 被调用方 | KBL | KnowledgeContext | POL | Difficulty | Strategy | Generator | Validator | SemanticQuestion | Presentation | SVG | Learner | Crawl |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
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

> 注 ¹：只读经 registry/contract 正式只读接口（`shared/knowledge/question-type-registry.js`、KBL Runtime）与 GenerationRequirements 注入，禁止直达 `kbl/` 数据文件、禁止绕过注入自行查询。
> 注 ²：Generator 不得计算/改写难度——难度是经 Generation Requirements 下发的**已声明参数**。
> 注 ³：Generator 产出题目载荷，由 Executor 归一化为 SemanticQuestion。
> 注 ⁴：Presentation 判分只允许经 PracticeSession/Checker（内部 AnswerValidator）正式接口，页面不得自行实现答案判定。
> 注 ⁵：对 KBL 的**写入**（mutation）一律禁止；只读按 `R` 走正式接口。

## 4. 正式读接口（"如果必须读取：只允许通过正式接口"）

| 需要读取方 | 唯一正式接口 | 禁止 |
| --- | --- | --- |
| 任意层读取 KBL 事实 | KBL Runtime / KnowledgeContext 只读 API（`shared/knowledge/runtime/knowledge-api.js` 等） | 直接 require `kbl/*` 数据文件 |
| Generator 获取数据 | Generation Requirements（经 Executor/Strategy 注入） | 直达 KBL / POL / Difficulty 计算 / 自造数据 |
| Difficulty 读取 | `shared/catalog/difficulty.js`（唯一公式，只读） | 第二套公式、逐题特调 |
| Validator 判定依据 | SemanticQuestion + 题型契约（question-type-registry）+ Difficulty 公式 | 反向调用 Generator 产题 |
| Presentation 渲染入参 | SemanticQuestion 列表 + RenderOptions | 自行重新生成题目 |
| SVG 绘制意图 | SemanticQuestion 图形字段（经 Presentation 下发） | 调用 Generator / POL / KBL |
| Learner 元数据 | KnowledgeContext / SemanticQuestion 只读字段 | 写入 KBL |
| Crawl/SEO 读取 | KnowledgeContext 只读（build-knowledge-pages） | 写入 KBL、伪造 author/rating/review |

## 5. 硬红线（P28-03 明确禁止）

| # | 禁止边 | 含义 |
| --- | --- | --- |
| 1 | Generator → KBL | 生成器不得直连知识事实源 |
| 2 | Generator → POL | 生成器不得反向编排 |
| 3 | Generator → Difficulty 计算 | 生成器不得计算/改写难度（难度为下发参数） |
| 4 | Presentation → Generator | 页面不得触发/复制生成逻辑 |
| 5 | SVG → Generator | 图形层不得生成题目 |
| 6 | Validator → Generator | 验证器不得依赖生成器 |
| 7 | Learner → KBL mutation | 学习状态不得写 KBL |
| 8 | SEO/Crawl → KBL mutation | 外部发现层不得写 KBL |

## 6. P28-00 实测存量违规（待治理，禁止扩散）

> 以下为 P28-00 依赖矩阵实测到的现有边，违反 §5 冻结规则；**不得新增同类边**，存量处理列为 P28 后续治理任务（人工裁决 → 唯一责任模块收敛 → 全量验证）。

| 禁止边 | 存量位置 → 指向 | 性质 |
| --- | --- | --- |
| Validator → Generator | `shared/validator/kp-semantic-validator.js` → `shared/generator/generator-registry.js` | 语义验证读 registry（已知架构语义复用） |
| Validator → Generator | `shared/validator/kp-semantic-validator.js` → `shared/generator/core/kp-arithmetic-semantics.js` | 语义验证读运算语义解析器 |
| Validator → Generator | `shared/validator/kp-semantic-validator.js` → `shared/generator/core/kp-complex-semantics.js` | 语义验证读复杂运算语义解析器 |
| Validator → Generator | `shared/validator/kp-semantic-validator.js` → `shared/generator/core/type-contract.js` | 语义验证读题型契约 |
| Generator → POL | `shared/generation/api.js`（lazy `getOrchestrator()`） → `shared/orchestration/practice-orchestrator.js` | 执行器可选回读编排器（try/catch 保护） |

治理路径（P28-01）：这些只读复用应上移为"正式接口"（由 SemanticQuestion/contract 承载），迁移到上下层共同依赖的只读契约模块——**不得**因此再造 `COMPAT/BRIDGE` 兼容层（AI 规则禁止 2）。

## 7. 违规判定与处置

1. **新增违规边**：任何新代码引入禁止边（含 import/require/全局变量通路）→ 回退本轮改动，走 P28-01 流水线。
2. **存量违规边**：冻结，禁止继续扩散；由 P28 专项后续裁决（§6 清单为准）。
3. **自动化门禁**：

```bash
node dev/p28/check-cross-layer.js   # 只读；基于 P28-DEPENDENCY-MATRIX.json，NEW 违规边 → 退出码 1
node dev/p28/build-baseline.js      # 改动后可重跑刷新依赖矩阵
```

4. **复现矩阵**：矩阵由 P28-00 依赖矩阵派生；`docs/P28/P28-DEPENDENCY-MATRIX.json` 每次 `build-baseline.js` 重生。