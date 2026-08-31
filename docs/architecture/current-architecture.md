# 当前题目生成系统架构（M0 基线）

> 本文档为 M0-01「架构只读审计」产出，基于实际代码阅读，描述 `Homework Help` 题目生成系统的
> 当前（M0 冻结时）真实架构。M0 阶段**未修改任何业务生成逻辑**；下文仅记录现状。

## 1. 运行形态

纯前端、无后端、无构建步骤。所有题目在浏览器端由 JS 插件即时生成，按需动态加载；
同一套 JS 模块在 Node（vm 沙箱）下被 `dev/` 工具链加载，用于测试与验证。

核心入口页：`practice.html`（练习/生成/批改/打印）。
知识库静态页：`knowledge/*.html`（由 `scripts/generate-knowledge-pages.js` 生成，仅供浏览/SEO，
不参与运行时出题）。

## 2. 分层与关键文件

| 层 | 文件 | 职责 |
|---|---|---|
| 入口 / 编排 | `practice.html` | 解析 URL、加载插件、组装 options、调度 generate/render/check/print |
| 插件注册表 | `plugins/registry.js` | 每个插件的 id/file/name/subject/category/grades/moduleIds/deps |
| 插件工厂 | `shared/render.js` | `createPlugin` / `createMathPlugin`：把 `generateQuestions(opts)` 标准化为
  generate/render/check；`_wrapDifficultyParams` 注入难度；数值比较兜底 `_mathQCheck` |
| 题目类型契约 | `shared/plugin-types.js` | `Question` / `ExerciseSet` / `CheckResult` / `ExercisePlugin` 的 typedef |
| 运行时核心 | `shared/core.js` | crypto 随机（`randInt`/`shuffle`，禁用 `Math.random`）、`normalizeAns`、
  `diffMax`、布局算法 `Layout`、覆盖统计 |
| 难度（Legacy） | `shared/difficulty.js` | `App.Difficulty.paramsFor(subject, level)`：档位→结构/数值缩放（**当前线上默认引擎**） |
| 难度（Static） | `shared/difficulty-static.js` | `App.DifficultyStatic.paramsForKnowledgePoint(kpMeta, type)`：静态多维计算（**休眠态，见 §4**） |
| 知识库（壳） | `shared/knowledge-bank.js` | `KnowledgeBank` 查询 API（`getEntries`/`ensureKnowledgeData`/`coverageFromRegistry`） |
| 知识库（数据） | `shared/knowledge-{math,cn,en}.js` | 知识点数据分片（math 556 / cn 15 / en 3，共 574 条） |
| 模块目录 | `shared/module-catalog.js` | 模块 ID ↔ 领域/年级/科目 映射 |
| 插件加载器 | `shared/plugin-loader.js` + `dev/plugin-loader.js` | 浏览器 `App.PluginLoader` / Node vm 沙箱加载，捕获导出对象、接口校验 |
| 渲染卡片 | `shared/render.js` `renderCard` | 单题 HTML（text/choice/multi/SVG `.scene-box`） |
| 批改 | `shared/check.js` | `defaultQCheck` / `computeResult` / `pickOpt` |
| 打印 | `shared/print.js` | `Print.open` / `Print.preview`，A4 同源产物 |
| 持久化 | `shared/storage.js` | `StorageManager`：错题本（上限 50）、难度 EMA |
| SVG 生成 | `shared/svg-*.js` + 插件内联 | 几何/竖式/田字格/时钟等（**部分共享模块生产页未引入，见差异记录**） |

## 3. 插件模型

每个插件在 `plugins/*.js` 通过 `createPlugin(config)` / `createMathPlugin(config)` 导出标准
`ExercisePlugin`，只需实现 `generateQuestions(opts)`，工厂补齐 render/check。插件**不互相 import**，
公共能力走 `shared/common.js`；随机数仅用 `PluginUtil.randInt`（crypto）。

## 4. 与任务描述不一致之处（按规则 #10 记录）

- **Static 难度已「接入」UI（休眠）**：`practice.html` 第 237 行 `<script src="shared/difficulty-static.js">`
  引入了该脚本；`shared/render.js` 的 `_wrapDifficultyParams` 在 `opts.knowledgePointMeta` 存在时会消费
  `App.DifficultyStatic`。但 `practice.html` 的 `generate()` **从不设置 `knowledgePointMeta`**，故 Static
  在实际 UI 中为休眠态，Legacy 仍是默认路径。M0 未改动此行为（遵守「不改 Legacy、不接 UI」的精神）。
- **部分 SVG 共享模块生产页未引入**：`svg-chinese.js` / `svg-english.js` / `svg-geometry.js` /
  `svg-calculation.js` / `svg-make-ten.js` 未被 `practice.html` 的 `<script>` 加载，语文/英语书写格在
  线上降级为不渲染（内联 SVG 的插件不受影响）。此属既有缺口，M0 仅记录，不修复。
- **`math-g2-column` 答案/check 技术债**：竖式插件的部分自身答案未通过自身 `check`（如 `"6……6"`
  分隔符归一化），属既有答案/check 不一致，M0 仅记录、不修复（详见 §6 / 已知技术债）。
- **KnowledgeBank ID 漂移（插件 ↔ 知识库不一致）**：`math-unit-convert`、`math-geometry`、
  `chinese-pinyin` 等插件生成的 `knowledgePointId` 在 `KnowledgeBank` 中查不到对应条目
  （如 `math-g2-m4-fill-unit`、`math-g2-m4-unit-convert`、`math-g2-m6-grid`、`cn-g1-n1-basic`），
  属既有 KB/插件不一致，M0 仅记录、不修复（由插件契约 `check-plugin-contract.js` 的「契约异常」WARNING 暴露）。

## 5. M0 新增护栏（独立于 Legacy，不接管线上流程）

- `shared/generation-config.js` — Feature Flag（legacy / strategy-v1，默认 legacy，异常回退）。
- `shared/legacy/legacy-plugin-adapter.js` — `QuestionPlan → Legacy options → Legacy Plugin` 适配层（接口 + 最小实现）。
- `dev/check-{syntax,knowledge-contract,plugin-contract,difficulty-dual,golden,snapshot,architecture-rules}.js`
  — 7 项独立可重复验证。
- `dev/verify-m0.js` — `npm run verify` 统一入口，聚合 7 项并输出 PASS/FAIL。
- `docs/architecture/*.md` — 本文件及 `generation-flow.md` / `module-map.md` / `generation-rules.md`。
