# 四层架构归类清单（Architecture Layers）

> 本仓库按 **四层功能架构** 归类整件：**UI 层（显示）/ 生成层（题目生成核心引擎）/ 知识点库（基层数据核心）/ 大服务层（信息传递 · 项目控制 · 外围样式 · 打印等外围控制）**。
> 权威机器可读清单见 [`architecture/layers.json`](../architecture/layers.json)；本文档为人类可读映射与规则。
> 分层红线与 Frozen Core 约束以 [DEVELOPMENT.md](DEVELOPMENT.md) 为准；目录物理布局见 [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)。

## 0. 为什么物理目录仍驻留 `shared/`（不拆目录的原因）

深度排查确认 `shared/` 是紧密耦合的公共模块根，**不存在安全可物理拆分的孤立文件**：

- **`common.js` 自推导注入**：浏览器端 `common.js` 依据自身 `document.currentScript.src` 推导同目录 `base`，`document.write` 注入 `core / plugin-loader / render / check / ui-state / storage`（6 个同目录子模块）。拆开后引导即断。
- **预编译 bundle 内嵌模块 id**：`strategy-engine.bundle.js`、`presentation-engine.bundle.js` 内嵌 `shared/...` 模块命名空间，移动源需重编译并保持 id 稳定。
- **硬编码路径面**：`sw.js`（importScripts + 27 条 precache）、全部 `dev/*.js` 门禁、`scripts/*.js`、`tests/`（经 `tests/helpers/project-root.js`）、`package.json` 均硬编 `shared/` 路径。

因此本项目采用「**物理稳定 + 逻辑清单**」：文件留在 `shared/`，**逻辑归属以 `architecture/layers.json` 为唯一权威分类**。新增文件请按本清单归类并在 `layers.json` 登记。

## 1. 四层总览

| 层 | 职责 | 典型路径 | 禁止 |
|----|------|---------|------|
| **UI** | 负责显示：页面壳 / 交互 / 渲染呈现入口 | `*.html`、`feedback/`、`knowledge/*.html` | 不决策题目结构、不直连生成引擎算法（唯一入口 `PracticeBridge.start`） |
| **生成层** | 题目生成核心引擎：题面/答案生成、语义归一、渲染(HTML/SVG)输出 | `shared/generation-engine.js`、`shared/practice-session.js`、`shared/generator/**`、`shared/presentation/**`、`shared/svg-*.js` | Frozen Core，仅授权 Bug Fix(GEN) |
| **知识点库** | 基层数据核心：唯一数据来源、schema、规范映射 | `shared/knowledge-*.js`、`shared/*-ontology*.js`、`shared/hanzi-bank.js`、`knowledge/**` | 不生成题面、不参与 UI 决策 |
| **大服务层** | 信息传递 / 项目控制 / 外围样式 / 打印等外围控制；**除 UI/生成/知识外全归此层** | `shared/practice-bridge.js`、`shared/strategy/**`、`shared/validator/**`、`shared/learner/**`、`shared/common.js`、`*.css`、`shared/print.js` | 不侵入 Frozen Core 算法 |

## 2. 各层归属明细

### 2.1 UI 层（显示）
- 页面：`index.html` · `practice.html` · `select.html` · `faq.html` · `contact.html` · `math-types.html` · `chinese-types.html` · `english-types.html` · `subject-types.html`
- 渲染宿主：`feedback/`、`knowledge/`（SEO 静态页，由知识库数据生成）
- `sw.js`（旁路：离线缓存宿主，属 UI 显示侧基建）

### 2.2 生成层（题目生成核心引擎）
- **引擎壳**：`generation-engine.js`、`practice-session.js`、`presentation-engine.js`（+bundle）
- **语义**：`semantic-question.js`、`schemas/*`
- **生成器**：`generator/**`（contract/mode/registry/selector/retry/legacy-adapter + `generators/` + `core/`）、`generator-capability-registry.js`、`generator-registry.js`
- **服务接口**：`generation/orchestrator.js` + `adapters/` + `services/` + `api.js`/`dto.js`
- **呈现/渲染**：`presentation/**`、`render.js`、`print.js`、`svg-{core,calculation,geometry,make-ten,chinese,english}.js`

### 2.3 知识点库（基层数据核心）
- `knowledge-bank.js`、`knowledge-point.js`
- `knowledge-ontology*.js`（本体 schema / 归一化 / 校验）
- `knowledge-{math,cn,en,error,factual,operation}.js`
- `hanzi-bank.js`、`pinyin-bank.js`（字库/拼音）
- `question-id.js`、`question-type-registry.js`
- `ontology-{error,factual,operation}-map.js`
- `knowledge/` 数据静态页

#### 知识库纯粹存放声明（R3）

知识库文档/数据的「三类纯粹存放位」与守卫规则如下（依据 `docs/AI_REFACTOR_PLAN.html` 阶段 R3）：

| 存放位 | 内容（纯知识库） | 动作 |
|--------|------------------|------|
| `knowledge/`（静态知识页） | 知识点库静态文档/展示页，由 `scripts/generate-knowledge-pages.js` **权威生成** | **守卫**：`dev/check-knowledge-dir.js`（已挂 `npm run verify:kb-dir` → `npm test` 链）。`knowledge/` 只允许 `.html` 且必须携带生成脚本写入的 `kbgen:hash` 标记；**禁止混入非 html / 手工散落文件**。 |
| `shared/knowledge-*.js` + `shared/ontology-*` + `question-type-registry.js` + `schemas/` | 知识点库唯一数据源（逻辑 KNOWLEDGE） | **物理留 `shared/`（硬约束不可移动）**。该文件组为知识库边界：只承载知识库数据/规范/映射，**禁止 UI/服务逻辑混入**（见 §3 硬红线第 3 条）。 |
| `docs/`（现行有效）+ `archive/`（已应用/已废弃） | 知识库文档草案 | 已应用草案 → `archive/`（迁移总表见 R9）。 |

**根目录知识库数据例外 — `pinyin-bank.js`**：
`pinyin-bank.js`（约 80KB）为知识库数据（拼音字库），但物理驻留根目录，被 8 处引用（`plugins/chinese-*`、`plugins/registry.js`、`test/helpers.js`、`shared/strategy-engine.bundle.js` 等）。**登记为「根目录知识库数据例外」：不物理迁移**（迁移需同步 8 处引用，风险>收益），已在 `architecture/layers.json` 的 KNOWLEDGE 层显式文档化。

### 2.4 大服务层（信息传递 / 控制 / 外围）
- **关联/编排（外围控制核心）**：`practice-bridge.js`（`PracticeBridge.start/submit/control` 唯一生成入口）
- **策略**：`strategy/**`、`strategy-config.js`
- **校验**：`validator/**`
- **能力模型**：`capability-*.js`
- **学习者模型**：`learner/**`
- **共享基础（信息传递/注入）**：`common.js`、`core.js`、`check.js`、`plugin-loader.js`、`plugin-types.js`
- **状态/IO/日志**：`ui-state.js`、`storage.js`、`logger.js`、`metrics.js`
- **目录/工具**：`catalog-utils.js`、`module-catalog.js`、`version.js`、`feature-flags.js`、`subject-utils.js`、`difficulty.js`(+`-static`)、`generation-config.js`
- **外围样式**：`base.css`、`tokens.css`、`components.css`、`pages.css`、`states.css`、`subjects.css`、`toolbar.css`

## 3. 分层约束（硬红线）
1. **生成层 = Frozen Core**：禁止修改，仅授权 Bug Fix（编号见 DEVELOPMENT.md §6）。
2. **UI 层唯一生成入口 = `PracticeBridge.start`**（`dev/check-ui-boundary.js`、`dev/check-practice-page.js` 门禁锚定）。
3. **知识库不生成题面、不参与 UI 决策**（`dev/check-architecture-rules.js` R1–R5）。
4. **大服务层只做信息传递 / 控制 / 外围**，不侵入生成算法；批改经 `plugin-loader.js`→`PluginUtil.computeResult`。

## 4. 清单维护
- 新增 `shared/`（或顶层 js/css）文件：**必须**在 `architecture/layers.json` 对应 `sub` 列表登记一次，否则视为未归类。
- 移动/重命名文件：同步更新 `architecture/layers.json` + 所有硬编码路径（见 §0）——建议优先保持 `shared/` 稳定。
- 校验清单与仓库一致性可跑：
  ```bash
  node -e "const m=require('./architecture/layers.json');const f=require('fs');const g=(s,d,fx)=>{for(const k of Object.keys(fx)){...}}" 
  ```
  （或按需编写 dev/check-architecture-layers.js 门禁。）

---

> **核心不变，边界可扩。稳定是最大的功能。** 分层清单位：`architecture/layers.json`。