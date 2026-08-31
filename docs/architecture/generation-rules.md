# 题目生成架构规则（M0-09）

> M0-09 产出。定义题目生成系统的架构护栏（职责边界）。M0 仅记录与静态检查，不强制重构。
> 静态检查实现：`dev/check-architecture-rules.js`（由 `npm run verify` 执行）。

## 1. 职责边界（强制约定）

1. **UI 不负责题目结构决策**
   UI（`practice.html` 及各题型页）只组装 `options`（grade/count/type/difficulty/...），
   不决定具体题目的数值、题型组合或知识点选取——这些由插件 `generateQuestions` 负责。

2. **KnowledgeBank 不负责生成**
   知识库只存储/查询知识点元数据（`shared/knowledge-bank.js`），不调用任何插件 `generate`，
   不产出题目。生成由插件消费知识库元数据驱动。

3. **Strategy（策略）不负责渲染**
   后续 Strategy Engine（M1+）只产出结构化生成计划（QuestionPlan），不直接生成 HTML/SVG。
   渲染交由 Renderer / `renderCard`。

4. **Generator（生成器）不负责 DOM / SVG 视觉**
   插件 `generateQuestions` 只产出数据化 `Question`（含 `q.svg` 字符串，由 SVG 生成模块产出），
   不操作 `document`、不绑定事件。渲染时由 `render`/`renderCard` 注入 DOM。

5. **Renderer 不负责难度**
   渲染层只消费题目数据，不计算数值缩放/结构复杂度（难度由 Difficulty 引擎在 generate 前产出）。

6. **Learner Model 不修改 KnowledgeBank**
   难度自适应/学习者模型只读取知识点与表现，不回写/改写 `KnowledgeBank` 数据。

7. **新代码禁止新增 `Math.random`**
   所有随机性必须走 `PluginUtil.randInt` / `shuffle`（crypto）。唯一合法随机源为
   `shared/core.js` / `shared/common.js`。既有注释性提及不计入（静态检查已剥离注释）。

8. **Legacy Difficulty 不得被新 Strategy 直接修改**
   M0 阶段 Static 难度仅独立测试，不接管线上；新 Strategy 不得改写 `difficulty.js` 的计算规则。
   Feature Flag 默认 `legacy`，任何异常自动回退（`shared/generation-config.js`）。

## 2. 静态检查项（`check-architecture-rules.js`）

| 编号 | 规则 | 级别 | 判定 |
|---|---|---|---|
| R1 | Static 不得成为激活生成路径（practice.html 不得设置 `knowledgePointMeta`） | 硬 | 违规 → ERROR；仅静态引入脚本 → WARNING（记录差异） |
| R2 | 插件不得 `require` / 依赖 `difficulty-static` | 硬 | 违规 → ERROR |
| R3 | `GenerationConfig` 默认模式为 `legacy`，且支持 `legacy`/`strategy-v1` | 校验 | 不符 → ERROR |
| R4 | 新代码禁止直调 `Math.random`（豁免 core/common） | 技术债 | 命中 → WARNING（既有债，不阻断） |
| R5 | `LegacyPluginAdapter` 接口完整（`toLegacyOptions`/`runPlan`） | 校验 | 不符 → ERROR |

## 3. 与后续阶段的关系

- M1 引入 Knowledge Ontology → Strategy Engine 时，应满足上述职责边界；
  新增生成器经 `LegacyPluginAdapter` 或 Strategy 引擎产出，均受本规则约束。
- 任何违反 R1–R3/R5 的代码变更会被 `npm run verify` 拦截（FAIL）。
