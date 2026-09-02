# 项目开发文档（Development Document）

> 本文档描述 **Homework Help** 项目当前的**最新开发状态**（架构、技术栈、模块、规范、校验门禁）。
> 面向开发者 / AI 助手快速了解项目现状。版本演进历史见 [DEV_LOG.md](DEV_LOG.md)，功能说明见根目录 [README.md](../README.md)。

---

## 1. 项目概览

Homework Help（小学练习本）是一个**零依赖、无构建步骤的纯静态站点**：面向小学 1–6 年级的
数学 / 语文 / 英语练习册生成与打印工具。运行时代码全部以经典 `<script>` 标签加载
（全站无 `type="module"`），Node 仅用于开发期校验与测试。离线能力由 Service Worker（`sw.js`）提供，
随机源统一走 `PluginUtil`（crypto，禁止 `Math.random`）。

当前项目采用 **V1 引擎（Frozen Core）**：知识点驱动的 M0–M7 分层架构
（Ontology → Capability → Strategy → Generator/Selector → Validator → Learner → Presentation）。
此为唯一生成主链，不再引入 V2 引擎。核心层已冻结，仅允许 Bug Fix（见 §6）。

---

## 2. 技术栈

| 类别       | 技术 |
|------------|------|
| 前端       | 原生 HTML/CSS/JavaScript（无第三方依赖，`package.json` 无 dependencies/devDependencies） |
| 加载方式   | 经典 `<script>`；`common.js` 用 `document.write` 顺序注入子模块 |
| 随机源     | `crypto.getRandomValues`（`randInt`/`randFloat`/`shuffle`），禁止 `Math.random` |
| 测试       | Node 内置 `node:test`（`test/plugins`、`test/unit`、`tests/`） |
| CI         | GitHub Actions（`.github/workflows/ci.yml`，Node 20） |
| 离线       | Service Worker（`sw.js`，经典 Worker + `importScripts` 引入 `version.js`） |
| 版本管理   | `shared/version.js` 单一版本源（APP_VERSION），`sw.js` 缓存名经 `sync-sw-version.js` 校验同步 |

---

## 3. 目录结构

```
Homework Help/
├── index.html              # 首页（双海报营销 + JSON-LD SEO，科目/年级选择 + 一键开始）
├── subject-types.html      # 学科总入口 / 统一题型选择页
├── math-types.html         # 数学题型选择页（按知识模块 M0–M13/C1–C9 分组）
├── chinese-types.html      # 语文类型页（重定向桩 → subject-types.html）
├── english-types.html      # 英语类型页（重定向桩 → subject-types.html）
├── faq.html                # FAQ
├── practice.html           # 核心练习页（统一宿主：生成/批改/打印/错题本）
├── sw.js                   # Service Worker 离线缓存
├── pinyin-bank.js          # 拼音词库（~79KB）
├── shared/                 # 唯一公共来源（single source of truth）+ Frozen Core
│   ├── common.js           # 聚合入口 + PluginUtil（随机/标准化/工厂）
│   ├── core.js             # 运行时核心：随机/布局/路由
│   ├── plugin-loader.js    # 插件加载器 + SW 注册
│   ├── render.js           # 渲染工厂 + createPlugin/createMathPlugin/... 
│   ├── check.js / ui-state.js / storage.js
│   ├── difficulty.js / difficulty-static.js  # 难度系统
│   ├── knowledge-bank.js + knowledge-{math,cn,en}.js  # 知识库分片
│   ├── svg-*.js            # SVG 生成器（core/calculation/geometry/make-ten/chinese/english）
│   ├── generation-engine.js + strategy/ + presentation/ + generator/ + learner/  # M4–M7 引擎
│   ├── tokens/base/components/pages/states/subjects/toolbar.css  # 分层样式
│   └── version.js          # 单一版本源
├── plugins/                # 题型插件（约 95 注册条目，108 个文件）
│   ├── registry.js         # 插件注册表
│   ├── competition/        # 竞赛判题子模块
│   └── svg-*.js            # SVG 生成插件
├── knowledge/              # ~600+ 生成的 SEO 静态页（scripts/generate-knowledge-pages.js）
├── dev/                    # 校验/指纹/lint/verify 脚本（质量门禁）
├── scripts/                # 代码生成/同步脚本
├── test/ + tests/          # Node 测试 + 遗留 HTML 测试运行器
├── .github/workflows/ci.yml # CI 工作流
├── docs/                   # 文档（本目录 + DEV_LOG.md + reports）
└── archive/                # 历史归档（死代码/迁移备份）
```

---

## 4. 功能模块

### 4.1 题目生成系统（核心）
- **插件契约**：`{id, name, subject, grades, category, generate, render, check}`（`shared/plugin-types.js`）。
- **插件工厂**：`PluginUtil.createPlugin` / `createMathPlugin` / `createChinesePlugin` / `createEnglishPlugin`（`shared/render.js`）。
- **统一入口**：`GenerationEngine.generate()` → `StrategyEngine.plan()` → `Generator/Retry/Validator` →
  `SemanticQuestion` → `PresentationRenderer.renderAll()`（`shared/generation-engine.js`）。
- **注册表**：`plugins/registry.js` 约 95 条记录，含 `moduleIds`（M0–M13, C1–C9, N1–N8, E1–E6）映射。
- 插件的 `generate` 返回 `{ questions: Question[] }`；每题含 `answer` + `render`（或插件级 `render`）。

### 4.2 知识库系统
- `KnowledgeBank` 按科目分组 `{math, cn, en}`；分片懒加载（`knowledge-{math,cn,en}.js`）。
- 知识点四段式 ID：`{subject}-g{grade}-{module}-{slug}`。
- 覆盖统计 API：`findGrade` / `getEntries` / `getCoverage` / `coverageFromRegistry` / `suggestNext`。
- 知识点字段：`id / name / pluginId / weight / type / description / example / prerequisites / related / difficulty / status`。
- 跨插件共享 KP 属设计内（如 `math-g1-m9-classify`）。

### 4.3 难度系统
- 用户填 1–10 整数 → `DifficultyProfiles`（math/cn/en 三科目差异化映射）。
- 五档结构分档（`TIERS`）：steps / allowBracket / allowMultDiv / nestedBrackets 渐进。
- 自适应：EMA 平滑（`ema=ema*0.6+rate*0.4`）+ 正确率反馈规则（`applyDeltaRule`）。
- 难度解析统一走 `App.Difficulty.consume(options)`（插件唯一入口）。

### 4.4 学习者模型（M6）
- `learner-model.js`：知识点级掌握度（EMA mastery）、置信度、错因分析。
- `result-collector.js` / `learner-storage.js`：批改结果回灌、持久化。
- `error-model.js`：错因类型归一。

### 4.5 渲染与打印系统
- `render.js`：`renderCard` / `renderGrid` + 布局算法（`core.js` 的 `Layout`）。
- SVG 生成器：`svg-core.js` + 按学科拆分，带 `memoize` 缓存 + `clearCache()`（会话切换时释放）。
- `print.js`：打印路由（`PRINT_ROUTES`），预览与打印共用同一 HTML。

### 4.6 用户页面
- `practice.html`（~1474 行）：核心宿主，含快速切换、「装配区」（科目/年级/知识点选择就地生成）、
  题量/难度/题型工具栏、批改/错题本/打印/显示答案、全局错误捕获、生成进度乐观 UI、闭环引导 Toast。
- `math-types.html`：按知识模块分组的题型目录。
- `index.html`：双海报营销首页 + JSON-LD SEO。

---

## 5. 开发与贡献规范

> 权威规范详见根目录旧版 `CONTRIBUTING.md`（V4.0.1 整合归档至 `archive/docs-2026-09/CONTRIBUTING.md`），下方为要点速览。

### 5.1 公共文件来源
- **`shared/` 是唯一公共来源**。所有页面与插件必须引用 `shared/` 下的资源。
- 根目录不再存在公共版 `common.js` / `common.css` / `print.js`。**禁止**新建根目录级公共脚本/样式。
- 样式按层拆分（`@layer` 锁序）：`tokens → base → components → toolbar → pages`。
- 禁止插件之间互相 `import`/`require` 内部实现；公共能力只能通过 `shared/` 共享。

### 5.2 插件开发
- 用科目化工厂减少样板：`createMathPlugin` / `createChinesePlugin` / `createEnglishPlugin` / `createPlugin`。
- 接口契约：`generate(options) → { questions, meta }`、`render(exerciseSet) → html`、`check(exerciseSet, userAnswers) → CheckResult`。
- 必填元数据：`id / name / subject / grades`；可选：`category / printConfig / settings / deps`。
- 插件文件最终把自身挂到 `window.__currentPlugin`。
- 新插件开发从 `plugins/_template.js` 开始，在 `plugins/registry.js` 注册后运行 `npm run check:registry` 与 `check-plugin-interfaces` 验证。

### 5.3 随机数规范
| 需求 | 工具 |
| --- | --- |
| 整数随机 `[min, max]` | `PluginUtil.randInt(min, max)`（crypto） |
| 数组乱序 | `PluginUtil.shuffle(arr)`（Fisher-Yates） |
| 取一个元素 | `PluginUtil.rand(arr)` |
| 概率判断 | `randInt(0,1)===0` 或 `randInt(1,100)<=p` |

禁止 `Math.random()` 直调与 `sort(() => Math.random()-0.5)`。唯一豁免在 `randInt` 内部。

### 5.4 样式与设计令牌
- 颜色/圆角/阴影/渐变一律用 `shared/tokens.css` 变量（`--brand/--ink/--muted/--line/--ok/--bad/...`）。
- 科目三色令牌：`--math/cn/en-primary/secondary/accent`。
- SVG 表现属性（`fill=`/`stroke=`）不支持 `var()`，保留字面量或改写 style 属性。
- `dev/lint-check.js` R2 规则扫描硬编码颜色，`/* allow-color */` 行内白名单豁免特殊场景。

### 5.5 答题交互边界
- 插件**禁止操作 DOM**（只能 `render()` 返回 HTML 字符串）。
- 所有 DOM 生命周期（注入 `#problemsArea`、列数自适应、答案收集、批改标记、打印）由 `practice.html` 统一负责。
- 唯一例外：`math-comprehensive.js` 可动态预加载同仓兄弟插件脚本。

### 5.6 知识库统一约定
- 知识点 ID 四段式 `{subject}-g{grade}-{moduleIdLower}-{baseSlug}`（全小写+数字+连字符）。
- 插件声明 ↔ 知识库双向对齐（`dev/verify-knowledge-bank.js` 第 8 条强制）。
- 前置引用（prerequisites/related）：允许低年级与同年级前置，禁止高年级前置。
- 修改知识库后运行 `node scripts/generate-knowledge-pages.js` 再生成静态页。

---

## 6. Frozen Core 保护（M0–M7）

**冻结核心**：已通过 M7 最终验收、生产稳定运行的核心架构层。默认冻结，仅允许 Bug Fix，
禁止重构/重设计/新增核心能力。

| 里程碑 | 模块 | 冻结文件（示例） |
|--------|------|-----------------|
| M0 | 基础设施 | `shared/common.js`, `version.js`, `tokens.css`, `base.css`, `states.css`, `components.css`, `pages.css`, `toolbar.css`, `subjects.css` |
| M1 | 本体/知识库 | `knowledge-bank.js`, `knowledge-{math,cn,en}.js`, `knowledge-ontology.js`, `module-catalog.js`, `capability-*.js`, `strategy/strategy-config.js` |
| M2 | 能力/生成器契约 | `generator/generator-*.js`, `generator/retry-loop.js`, `generator/legacy-plugin-adapter.js`, `generator/generators/` |
| M3 | 策略引擎 | `strategy/strategy-engine.js`, `comprehensive-strategy.js`, `legacy-adapter.js`, `strategy-error.js` |
| M4 | 生成器实现 | `generator/core/`, `generator/generators/{arithmetic,selection,complex}.js`, `semantic-question.js`, `question-id.js` |
| M5 | 验证管线 | `validator/*-validator.js`, `validation-pipeline.js`, `quality-scorer.js` |
| M6 | 学习者模型 | `learner/*.js`, `storage.js`, `difficulty.js`, `difficulty-static.js` |
| M7 | 统一渲染/生成/打印 | `presentation/*`, `generation-engine.js`, `print.js`, `practice-session.js`, `check.js`, `svg-*.js` |

**扩展机制**（在核心之外）：
- 新题型/知识点：改 `knowledge-*.js` + `plugins/`，不改核心。
- 新生成器/验证器/渲染器/打印模板：在对应目录增加实现并注册，不改 Selector/Contract/Pipeline 结构。

完整规范见 `docs/FROZEN_CORE.md`。当前 Frozen Core 清单由 `dev/check-frozen-core.js` 自动扫描（116 文件）。

---

## 7. 质量保障与校验

### 7.1 npm test 门禁（6 道）
```
npm test = check:sw-version → check:registry → check:contrast →
           verify:setup → check-knowledge → check-regression →
           test-difficulty → test-difficulty-static → verify-svg → check-lint
```

### 7.2 常用命令
```bash
npm test                                    # 硬门禁
npm run check-duplicates                    # 重复率报告（非门禁）
npm run check-fingerprint                   # 插件指纹监控（repeat-rate 基线）
bash scripts/pre-commit.sh                  # 本地手动校验
node scripts/generate-knowledge-pages.js    # 再生成 knowledge/ 页面
node dev/verify-knowledge-bank.js           # 知识库结构/编号/引用校验
node dev/verify-setup.js                    # 项目搭建校验
node dev/check-core-integrity.js            # 核心文件完整性
node dev/check-frozen-core.js --check       # Frozen Core 门禁
```

### 7.3 提交自动化（零依赖）
- 版本化钩子：`scripts/githooks/pre-commit` → `scripts/pre-commit.sh`（跑 `npm test` 同一套）。
- 启用：`git config core.hooksPath scripts/githooks`。
- CI（`.github/workflows/ci.yml`）在 push/PR 上运行完整验证套件（16 道）。

---

## 8. 已知技术债与保留项

| 项 | 说明 | 优先级 |
|----|------|--------|
| 插件选项高亮/音频交互职责 | 仍有 23 处 `TODO(M4)` 标记（选项高亮、音频播放属交互层，待迁移到 check/render 交互层） | 长期技术债 |
| `strategyFor(pluginId)` 契约脆弱 | `storage.updateDifficulty` 传插件 ID，`strategyFor` 期望 subject；非识别串静默回退 math（当前无害，cn/en 复用 math 规则） | 加固项 |
| R2 颜色白名单被滥用 | `/* allow-color */` 让插件硬编码颜色绕过 token 策略 | 清理项 |
| 生成产物未统一提交策略 | `knowledge/` 600+ 生成页 + `dev/reports/` 等为生成产物 | 流程项 |

---

## 9. 用户页面功能（最新状态）

| 页面 | 功能 |
|------|------|
| `index.html` | 双海报首页、科目+年级选择、「一键开始」、问题反馈入口、JSON-LD SEO |
| `subject-types.html` | 学科总入口 / 统一题型选择 |
| `math-types.html` | 数学题型选择（按 M0–M13/C1–C9 模块分组） |
| `chinese-types.html` / `english-types.html` | 语文/英语类型页（重定向桩） |
| `practice.html` | 统一练习页：生成/批改/打印/错题本/显示答案/自动计时 |
| `faq.html` | 常见问题 |
| `knowledge/*.html` | SEO 知识点详情页（600+） |

---

> **核心不变，边界可扩。稳定是最大的功能。**
