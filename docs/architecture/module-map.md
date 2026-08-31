# 模块地图（M0 基线）

> M0-01 产出。便于后续 AI 编程快速定位：题目生成相关「谁在哪、负责什么」。

## 入口与编排
- `practice.html` — 练习页；generate/render/check/print 编排，设置面板，错题本 UI。
- `math-types.html` / `chinese-types.html` / `english-types.html` / `subject-types.html` — 题型选择页。

## 插件层 `plugins/`
- `registry.js` — 插件注册表（id/file/name/subject/category/grades/moduleIds/deps）。
- `math-*.js`（~94 个数学插件，G1–G6）、`chinese-*.js`、`english-alphabet.js` — 各题型实现。
- `math-comprehensive.js` — 综合/期末聚合器（异步，按知识点权重组卷）。
- `_template.js` — 插件样板（含「禁止 Math.random」约束说明）。

## 共享层 `shared/`
- `render.js` — `createPlugin` / `createMathPlugin` / `renderCard` / `clockSVG` / `_wrapDifficultyParams`。
- `core.js` — crypto 随机、标准化、`Layout` 布局、覆盖统计。
- `check.js` — 批改核心 `defaultQCheck` / `computeResult` / `pickOpt`。
- `difficulty.js` — Legacy 难度引擎 `App.Difficulty`。
- `difficulty-static.js` — Static 难度引擎 `App.DifficultyStatic`（休眠）。
- `knowledge-bank.js` + `knowledge-{math,cn,en}.js` — 知识库壳 + 数据分片。
- `module-catalog.js` — 模块目录。
- `plugin-loader.js` — 浏览器 `App.PluginLoader`（含 vm 兼容的 Node require 回退）。
- `print.js` — 打印/预览。
- `storage.js` — `StorageManager`（错题本、难度 EMA）。
- `plugin-types.js` — 题目/集合/批改/插件 类型契约（typedef）。
- `svg-core.js` / `svg-geometry.js` / `svg-calculation.js` / `svg-make-ten.js` / `svg-chinese.js` / `svg-english.js` — SVG 生成（部分生产页未引入）。
- `common.js` / `subject-utils.js` / `hanzi-bank.js` / `pinyin-bank.js`(根) — 聚合与科目工具。

## M0 新增护栏
- `shared/generation-config.js` — Feature Flag（legacy/strategy-v1）。
- `shared/legacy/legacy-plugin-adapter.js` — QuestionPlan→Legacy 适配层。
- `dev/check-syntax.js` — 语法检查。
- `dev/check-knowledge-contract.js` — 知识库 Schema/Contract。
- `dev/check-plugin-contract.js` — 插件契约。
- `dev/check-difficulty-dual.js` — 难度双轨测试。
- `dev/check-golden.js` — Golden Path 生成测试。
- `dev/check-snapshot.js` — 题目结构 Snapshot 基线。
- `dev/check-architecture-rules.js` — 架构护栏静态检查。
- `dev/verify-m0.js` — 统一验证入口（npm run verify）。
- `tests/golden/`、`tests/snapshot/snapshot.json` — 测试产物（golden 运行时输出；snapshot 基线）。

## 数据/页面生成 `scripts/`
- `generate-knowledge-pages.js` — 由知识库数据生成 `knowledge/*.html` 静态页。
- `verify-registry.js` / `sync-sw-version.js` 等 — 注册表/资源校验。

## 验证工具 `dev/`
- `plugin-loader.js` / `plugin-registry.js` — Node vm 插件加载与注册表读取（M0 验证复用）。
- `verify-setup.js` / `verify-knowledge-bank.js` / `check-plugin-interfaces.js` / `lint-check.js` 等 — 既有验证。
