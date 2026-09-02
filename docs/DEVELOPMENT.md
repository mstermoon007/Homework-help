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
- 知识点四段式 ID：`{subject}-g{grade}-{module}-{slug}`（全小写+数字+连字符，无空格/下划线）。
  - 示例：`math-g1-m1-addsub-20`、`cn-g1-n1-pinyin-basic`、`en-g3-e1-letter-recognition`。
  - slug 跨年级同主题保持一致（竞赛模块如 `g4-c1-c1-vertical` / `g5-c1-c1-vertical` / `g6-c1-c1-vertical`）。
  - 禁止旧式无科目前缀 ID（如 `g1-m4-patterns`）；跨科目引用会被 verify 拦截。
- 覆盖统计 API：`findGrade` / `getEntries` / `getCoverage` / `coverageFromRegistry` / `suggestNext`。
- 知识点字段：`id / name / pluginId / weight / type / description / example / prerequisites / related / difficulty / status`。
- `difficulty` 字段为**静态难度基线**（基础 1；竞赛按年级 g4=3/g5=4/g6=5），与练习页运行时难度（1–10）含义不同。
- 跨插件共享 KP 属设计内（如 `math-g1-m9-classify`）。
- **模块目录** `shared/module-catalog.js`：基础 `M0`–`M12`（level: basic）+ 竞赛 `C1`–`C9`（level: competition，4–6 年级；
  C6/C7 仅 5–6 年级）；语文 `N1`–`N8`、英语 `E1`–`E6`。新增模块在 `BASIC_MODULES` / `COMPETITION_MODULES` 中追加
  `{ id, name, grades, category, level }`，保持 id 唯一。
- **插件 ↔ 知识点声明**：`knowledgePoints` 单年级用数组、多年级必须用按年级对象
  `{ grade: [id...] }`；工厂在 generate 时用 `console.warn` 提示未登记 id。
- 覆盖检查：`node dev/coverage.js`（1–3 年级应 100%，自动排除占位插件）。

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

> 本节的 `shared/` 单一来源、插件契约、随机数、样式、DOM 边界、知识库约定构成了硬性红线，
> 规则细节以其下各小节为准（V4.0.2 起合入，替代原 AI_DEV_GUIDE / PLUGIN_QUICKSTART / CONTRIBUTING 参考文档）。

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

### 5.7 新增插件快速开始（10 分钟）
- **脚手架**：`node scripts/new-plugin.js <id> <name> <grades> --subject math --category number --module M1 --kp <kpId> [--desc "..."] [--dry-run]`
  一次产出 `plugins/<id>.js` 骨架（基于科目工厂 + `generateQuestions`）、`plugins/registry.js` 注册条目，
  （数学）`shared/knowledge-bank.js` 知识点条目。参数速查见表 →
- **实现核心方法**：只需填 `generateQuestions(opts)`，数学默认 `render` 走 `renderCard`、`check` 走数值比较。
  随机一律 `PluginUtil.randInt`（禁止 `Math.random`）；答案建议字符串，多接受答案用 `|` 分隔。
  需要难度随动时读注入的 `opts.difficultyParams`（`{ level, scale, steps, ... }`），不要自己硬编码档位。
- **本地预览**：`python3 -m http.server 8080` → `http://localhost:8080/dev/plugin-check.html`。
- **校验**：`npm run check-lint`（最快反馈）→ `npm run check:registry` → `npm test` 全量。
- **linter 关键规则**（`dev/lint-check.js`）：R1 禁 `Math.random()`；R2 禁硬编码颜色（用 `var(--*)` 令牌，
  SVG `fill`/`stroke`、纯白 `#fff`、阴影色除外）；R3 数学插件必须声明 `moduleId`；R4 知识点 id 必须有科目前缀。

| 脚手架参数 | 含义 | 示例 |
| --- | --- | --- |
| `<id>` | 插件唯一标识 `<subject>-<topic>` | `math-add2` |
| `<name>` | 展示名称 | `"两位数加法"` |
| `<grades>` | 适用年级逗号分隔 | `1` 或 `1,2` |
| `--subject` | `math`/`chinese`/`english`（缺省按 id 前缀推断） | `math` |
| `--category` | `number`/`geometry`/`statistics`/`mixed` | `number` |
| `--module` | 模块 ID（M0–M12，仅数学必填） | `M1` |
| `--kp` | 覆盖的知识点 id | `math-g1-m1-addsub-20` |
| `--dry-run` | 仅预览不写盘 | — |

权威插件契约见 `plugins/CONTRACT.md` 与本文档 §4.1/§5.2。

---

## 6. Frozen Core 保护（M0–M7）

**冻结核心**：已通过 M7 最终验收、生产稳定运行的核心架构层。默认冻结，仅允许 Bug Fix，
**禁止重构/重设计/新增核心能力**。核心层已完整闭环（设计-实现-验收-生产），
冻结范围随每次授权 Bug Fix 后重锚基线。

### 6.1 冻结范围（M0–M7）

| 里程碑 | 模块 | 冻结文件/目录 |
|--------|------|---------------|
| M0 | 基础设施 | `shared/common.js`, `shared/version.js`, `shared/tokens.css`, `shared/base.css`, `shared/states.css`, `shared/components.css`, `shared/pages.css`, `shared/toolbar.css`, `shared/subjects.css` |
| M1 | 本体/知识库 | `shared/knowledge-bank.js`, `shared/knowledge-{math,cn,en}.js`, `shared/knowledge-ontology.js`, `shared/module-catalog.js`, `shared/capability-{model,matrix,resolver}.js`, `shared/question-type-registry.js`, `shared/strategy/strategy-config.js` |
| M2 | 能力/生成器契约 | `shared/generator/generator-{contract,registry,selector,mode}.js`, `shared/generator/retry-loop.js`, `shared/generator/legacy-plugin-adapter.js`, `shared/generator/generators/` |
| M3 | 策略引擎 | `shared/strategy/strategy-engine.js`, `shared/strategy/comprehensive-strategy.js`, `shared/strategy/legacy-adapter.js`, `shared/strategy/strategy-error.js` |
| M4 | 生成器实现 | `shared/generator/core/`, `shared/generator/generators/{arithmetic,selection,complex}.js`, `shared/generator/semantic-question.js`, `shared/generator/question-id.js` |
| M5 | 验证管线 | `shared/validator/*-validator.js`, `shared/validator/validation-pipeline.js`, `shared/validator/quality-scorer.js`, `shared/generator-regression.js`, `shared/check-generator-*.js` |
| M6 | 学习者模型 | `shared/learner/*.js`, `shared/storage.js`, `shared/difficulty.js`, `shared/difficulty-static.js` |
| M7 | 统一渲染/生成/打印 | `shared/presentation/*`, `shared/generation-engine.js`, `shared/print.js`, `shared/practice-session.js`, `shared/check.js`, `shared/svg-*.js` |

### 6.2 禁止事项

- 重构 M0–M7 任一层的核心数据结构/接口/流程。
- 引入 `NewEngine` / `NewStrategy` / `NewGeneratorFramework` / `NewQuestionModel` /
  `NewValidatorFramework` / `NewRendererFramework` 等同级核心抽象。
- 修改已验收的接口签名、数据结构、错误码、错误语义。
- 在页面/插件中绕过核心入口直接调用被冻结层内部实现
  （如直接 `StrategyEngine.plan()`、`Generator.generate()`、`Plugin.generate()`）。
- 让新代码依赖冻结层内部实现细节；在反方向建立依赖（Renderer↔Generator 反向、Validator↔Strategy 反向）。

### 6.3 允许的例外（仅限 Bug Fix）

| 条件 | 要求 |
|------|------|
| 明确 Bug | 有确凿 Bug 报告（Issue/复现/预期 vs 实际） |
| 最小改动 | 仅修该 Bug，无无关改动/重构/功能扩展 |
| 回归测试 | 相关单测 + 集成 + 端到端全通过 |
| 门禁通过 | `npm test` + 相关 `verify:*` Gate 全绿 |
| 变更记录 | 在 `docs/DEV_LOG.md` 记录 Bug 编号、根因、修复点、验证方式 |

### 6.4 扩展机制（在核心之外扩展）

| 扩展类型 | 推荐方式（不改核心） |
|---------|----------------------|
| 新题型/知识点 | `shared/knowledge-*.js` 增 KP + `plugins/` 增插件 |
| 新生成器 | `shared/generator/generators/` 增实现，注册 `GeneratorRegistry` |
| 新验证规则 | `shared/validator/` 增 Validator，注册 Pipeline |
| 新渲染器 | `shared/presentation/` 增 Renderer，注册 `PresentationRenderer` |
| 新打印模板 | `shared/print.js` 增 `PRINT_ROUTES` 配置 |
| 新 SVG 生成器 | `plugins/svg-*.js` 增，注册 `SVGRegistry` |

### 6.5 变更申请流程（仅限 Bug Fix）

```
1. 提交 Issue：标记 [Bug Fix][Frozen Core]，描述 Bug、复现步骤、影响范围
2. 评估：是否真为 Bug、可否在外层解决、影响面
3. 批准：打 [Frozen Core Fix] 标签
4. 实施：最小改动 + 完整测试
5. 验收：`npm test` 全绿 + 相关回归测试通过
6. 合并：记入 docs/DEV_LOG.md；运行 `node dev/check-frozen-core.js --baseline` 重锚基线
```

**红线贯通**：当前 Frozen Core 清单由 `dev/check-frozen-core.js` 自动扫描
（93 文件 + 基线 `dev/frozen-core-baseline.json`），`npm test` / CI 均跑 `--check` 防漂移；授权改动后记得重锚基线。

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

**历史 P0（浏览器运行时 / 冻结适配器契约 / 回归门禁 / 基线锚定）均已关闭**（详见 DEV_LOG V4.0.0），
下方为存留的已知非阻塞债务：

| 项 | 说明 | 优先级 |
|----|------|--------|
| 插件选项高亮/音频交互职责 | 仍有 23 处 `TODO(M4)` 标记（选项高亮、音频播放属交互层，待迁移到 check/render 交互层） | 长期技术债 |
| `strategyFor(pluginId)` 契约脆弱 | `storage.updateDifficulty` 传插件 ID，`strategyFor` 期望 subject；非识别串静默回退 math（当前无害，cn/en 复用 math 规则） | 加固项 |
| R2 颜色白名单被滥用 | `/* allow-color */` 让插件硬编码颜色绕过 token 策略 | 清理项 |
| 生成产物未统一提交策略 | `knowledge/` 600+ 生成页 + `dev/reports/` 等为生成产物 | 流程项 |
| 双轨难度中心（legacy 静态休眠） | `difficulty-static.js` 仍被 practice.html 加载但休眠（`difficultyParams==null` 守卫），策略层为唯一主链 | 已记录 |
| 能力解析器无独立全局 | `capability-resolver` 经 `strategy-engine.bundle.js` 打包可用，无 `window.CapabilityResolver` 全局 | 已记录 |
| 契约合规（legacy 已知行为） | 曾盘点 20 插件「自判难度/全局自适应」Contract/Capability 违规、25 插件 R20 `needs-fix`（DOM/SVG 自渲染）——legacy 已知行为，native 化后收敛 | 观察项 |
| 未迁移 KP（双轨遗留） | 全库 556 KP 中约 **74 个已走 native** 生成器（R24–R27 批次），约 482 个仍走 legacy；单步口算白名单已近耗尽，剩余需 multi-step complex / 专项模板 | 长期主线 |
| 插件下线 | `math-oral` 迁移 blocked（safetyPassed=false），当前 0 可安全下线 | 低 |
| 峰值产物同步 | `shared/strategy-engine.bundle.js` 由 `dev/build-strategy-bundle.js` 重建，需保证「源码已修 → 产物已重建」防静默漂移 | 流程项 |

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

## 10. 工具 API 速查（PluginUtil / App / SVGGenerators）

> 来源：`shared/common.js`。插件内通过 `PluginUtil.*` 调用；dev/ Node 脚本 `require('../shared/common.js')` 复用同一实现。

### 10.1 随机数（运行时禁止直接 `Math.random()`）
| 函数 | 签名 | 说明 |
| --- | --- | --- |
| `randInt` | `(min, max) → int` | 闭区间整数随机；crypto.getRandomValues 优先，Math.random 兜底（唯一豁免位置） |
| `shuffle` | `(arr) → arr'` | Fisher-Yates 洗牌，返回**新数组**不改原数组；禁止 `sort(() => Math.random()-0.5)` |
| `rand` | `(arr) → item` | 从数组等概率取一个元素 |

概率约定：`randInt(0,1)===0`（50%）、`randInt(1,100)<=p`（p%）。

### 10.2 难度系统
| 函数/对象 | 说明 |
| --- | --- |
| `diffLevel(d)` | 归一化 1–10，非法回退 3 |
| `diffScale(level)` | 缩放系数 `1+(level−3)×0.2`（3→1.0、10→2.4） |
| `diffMax(base, level)` | 基准最大数 × scale |
| `App.Difficulty.difficultyToStructure` | 难度→结构五档映射；complexityScore 全档严格单调 |
| `App.Difficulty.createProfile` | 合并用户选择/自适应/插件选项 → profile |
| `App.Difficulty.consumeProfile` | 按插件类型（expression/geometry/application/oral/默认）翻译为生成参数 |
| `App.Difficulty.consume` | 插件统一难度入口：自带 level 分档时 hasOwnLevel=true |
| `App.Difficulty.profileFor / paramsFor / strategyFor` | 科目档案路由（cn/en 归一，未知回落 math） |

### 10.3 渲染与工厂
| 函数 | 说明 |
| --- | --- |
| `renderCard(q, idx, opts?)` | 标准题目卡片；样式走 shared/components.css 类 + tokens 变量 |
| `createPlugin(config)` | 插件工厂：包装 generate/render/check、注册 moduleId、校验 knowledgePoints |
| `createMathPlugin(config)` | 预设 subject='math'、数值比较批改、`math-grid/card` 类、注入 `opts.difficultyParams` |
| `createChinesePlugin(config)` | 预设 'chinese'；标准化批改（空白/全角/尾部句读归一）；难度消费 cn |
| `createEnglishPlugin(config)` | 预设 'english'；拼写批改（大小写不敏感 + `\|` 多答案）；难度消费 en |
| `SUBJECT_FACTORY_DEFAULTS` | 三科目工厂预设表 |

### 10.4 SVGGenerators（shared/svg-*.js）
| 命名空间 | 成员 |
| --- | --- |
| `SVGGenerators.core` | =SVGUtil：基础元素/computeViewBox/svgWrap |
| `SVGGenerators.math.geometry / calculation / makeTen` | 平面立体图形+标注 / 四则竖式 / 凑十三法图解 |
| `SVGGenerators.cn` | `hanziGrid`·`pinyinGrid`·`strokeOrder`·`sentenceLine`（田/米字格、四线三格、笔顺、书写格；非法输入返回 null） |
| `SVGGenerators.en` | `letterWriting`·`wordCard(word, phonetic?)`·`fourLineWriting`（四线三格、单词卡、句子抄写条） |

SVG 统一出口：`App.SVGRenderer.render(graphic, options)`（`shared/presentation/svg-registry.js`），
`graphic` 为结构化描述 `{ type, subtype, params }`；生成器在 boot 阶段挂到 `SVGGenerators` 命名空间并注入 `SVGRenderer`。
插件脚本加载用 `App.PluginLoader.loadSubjectPlugins(subject, grade)`。

### 10.5 SubjectUtils（shared/subject-utils.js）
| 工具 | 代表成员 |
| --- | --- |
| `MathUtil` | `rangeByLevel`·`gcd/lcm/reduce/add/sub/mul/div/format`·`filterOperators/pickOperator`（除零返回 null） |
| `ChineseUtil` | `normPY/normHZ/normalizeHanzi`·`compareGlyph`·`TONE_MAP`（拼音归一、汉字标准化、易混组字形比较） |
| `EnglishUtil` | `normalizeWord/wordCase`·`normalizePhonetic/samePhonetic`（大小写归一、音标剥斜杠等值比较） |

### 10.6 样式令牌要点
- 唯一来源：`shared/tokens.css`（@layer 锁定 tokens → base → components → toolbar → pages）。
- 内联样式颜色必须写 `var(--ink)` 等；SVG 表现属性（`fill=`/`stroke=`）不支持 var()，保持字面量或写在 style 属性上。

---

## 11. 机器可见性与 SEO 运维

### 11.1 已配置的可见性资源
| 资源 | 作用 | 状态 |
|------|------|------|
| robots.txt | 允许 GPTBot / OAI-SearchBot / PerplexityBot / ClaudeBot / Googlebot 全站抓取 + Sitemap 指令 | 已就绪 |
| llms.txt | 站点简介 + 核心页面 + 知识库入口（Markdown，供 LLM 读取） | 已就绪 |
| sitemap.xml | 410 URL（首页/FAQ/题型页/知识库 403 页），由 scripts/generate-sitemap.js 生成 | 已就绪 |
| faq.html / index.html / 题型页 / practice.html / 知识库页 | FAQPage / WebSite+Organization / CollectionPage / LearningResource JSON-LD | 已就绪 |

再生成命令：`node scripts/generate-knowledge-pages.js`（知识库静态页）、`node scripts/inject-schema.js`（核心页 JSON-LD）、
`node scripts/generate-sitemap.js`（sitemap.xml）。

### 11.2 复核要点（上线后）
- 访问性：`curl -s -o /dev/null -w '%{http_code}' https://<域名>/sitemap.xml`（期望 200）。
- JSON-LD：Google Rich Results Test / Schema.org 校验器。
- 定期（每月）在 ChatGPT / Perplexity 搜品牌与知识点问题，检查是否被引用；未出现则增厚对应知识点页 description/example 并重新生成 sitemap。

---

> **核心不变，边界可扩。稳定是最大的功能。**
