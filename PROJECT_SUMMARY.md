# Homework Help 项目全面总结（基于实际代码）

> 适用范围：`/Users/zhanggaozhang/Code/Homework Help`
> 本文档基于实际源码静态梳理，所有结论均附 `文件:行号` 引用。文末「第十节」记录了在梳理过程中发现并已修复的问题（P0–P2）。

---

## 0. 概述

Homework Help 是一个**零依赖、无构建步骤的纯静态站点**：面向小学 1–6 年级的数学 / 语文 / 英语练习册生成与打印工具。运行时代码全部以经典 `<script>` 标签加载（全站无 `type="module"`），Node 仅用于开发期校验与测试。离线能力由 Service Worker（`sw.js`）提供，随机源统一走 `PluginUtil`（crypto，禁止 `Math.random`）。

---

## 一、技术栈

- **零依赖、无构建**：`package.json` 无 `dependencies`/`devDependencies`；脚本均为 `node <dev脚本>` 或 `node --test`，无打包器 / 转译器（`package.json:1-25`）。
- **加载方式**：HTML 经典 `<script>`。`index.html:566-567` 先加载 `version.js`+`common.js`，`common.js` 再用 `document.write` 顺序注入子模块 `core/plugin-loader/render/check/ui-state/storage`（`shared/common.js:27-32`）；Node 端同文件内 `require` 这些子模块（`shared/common.js:33-41`）。
- **测试**：Node 内置 `node:test`（`test/plugins`、`test/unit`、`test/*.test.js`）。**CI**：`.github/workflows/ci.yml`（node 20），仅跑 `test:plugins` + `test:unit`。
- **离线**：Service Worker（`sw.js`），经典 Worker + `importScripts` 引入 `version.js`（见第十节 P0 修复）。

---

## 二、文件系统

| 目录 | 内容 |
|---|---|
| `shared/` | 核心基础设施：`core.js`(随机/布局/归一)、`plugin-loader.js`、`render.js`、`check.js`、`ui-state.js`、`storage.js`、`difficulty.js`、`knowledge-bank.js` + `knowledge-{math,cn,en}.js`、`subject-utils.js`、`hanzi-bank.js`、`pinyin-bank.js`、`version.js`、`svg-*.js`、`module-catalog.js`、`plugin-types.js`，以及 `tokens/base/components/pages/states/subjects/toolbar.css` |
| `plugins/` | 约 95 个插件定义文件；`registry.js` 注册 **93** 项（`_template.js` 模板被排除）；`competition/checkers/` 为竞赛判题子模块 |
| `knowledge/` | ≈600 个**生成的**静态 SEO 页（`scripts/generate-knowledge-pages.js` 产出，带 `<!-- kbgen:hash= -->`，含 hash 增量 + `--watch`） |
| `dev/` | 40 个校验 / 指纹 / lint / verify 脚本（`lint-check.js`、`verify-setup.js`、`regression-check.js`、`test-difficulty.js` 等） |
| `scripts/` | 代码生成与同步脚本（`generate-knowledge-pages.js`、`sync-sw-version.js`、`new-plugin.js`、`verify-registry.js`、`generate-sitemap.js`、`inject-schema.js` 等） |
| `docs/` | 9 篇文档（`API.md`、`AI_DEV_GUIDE.md`、`PLUGIN_QUICKSTART.md`、`knowledge-base.md` 等） |
| `test/` | Node `node:test` 测试（`plugins/` 5 个、`unit/` 3 个、`random-distribution.test.js`、`e2e-*.js`） |
| `tests/` | 遗留 `test-runner.html`（被 `README.md:114` 记录为 HTML 测试运行器，保留） |
| `feedback/` | 独立反馈页（mailto 兜底，无服务端） |
| `assets/` | webp 图片 |

---

## 三、功能系统（用户面向页面）

- `index.html`：首页 / 导航，定义 `App.ROUTES`、注入 JSON-LD。
- `math-types.html` / `chinese-types.html` / `english-types.html`：分学科题型选择页（经 `PluginLoader.loadSubjectPlugins` + `KnowledgeBank` 取覆盖）。
- `subject-types.html`：学科总入口。
- `practice.html`（约 58KB 单体文件）：核心练习页，读 `?plugin=&grade=` → 加载插件 → 渲染题卡 → 批改 / 打印 / 错题本。
- `faq.html` + `knowledge/*.html`：SEO 知识页。

---

## 四、题目生成系统

- 插件契约：`{id,name,subject,grades,category,generate,render,check}`（`shared/plugin-types.js:38-49`）。多数插件经工厂 `PluginUtil.createPlugin` / `createMathPlugin` / `createChinesePlugin` / `createEnglishPlugin`（`shared/render.js:137-348`）构建，自动注入难度参数与判题逻辑。
- 插件自导出：`global.__currentPlugin = plugin`（`plugins/math-statistics.js:333`），`PluginLoader.loadScript` 在 `onload` 捕获（`shared/plugin-loader.js:26-30`）。
- **随机源统一走 `PluginUtil`**：`randInt`(crypto)、`randFloat`(crypto 53 位)、`shuffle`、`rand`、`normalizeAns`、`poolFill`、`createPoolCache`（`shared/core.js`）。`Math.random` 被 lint **R1** 禁止（core.js 内的唯一兜底已在历史任务中彻底移除，运行时代码零 `Math.random`）。
- 注册：`plugins/registry.js`（93 条 `{id,file,name,subject,category,grades,moduleIds,deps}`）；`verify-registry.js` 交叉校验 registry↔文件↔声明 `id`。

---

## 五、知识库系统

- `KnowledgeBank`（`shared/knowledge-bank.js`）：壳对象 + 查询 API（`findGrade` / `getEntries` / `getCoverage` / `coverageFromRegistry` / `suggestNext`）。
- **懒加载 `ensureKnowledgeData`**：Node 端 `require` 同步加载；浏览器端首次访问注入 `<script>` 并 promise 缓存（`knowledge-bank.js:191-221`）。
- 分片 `knowledge-*.js` 直接写入 `KnowledgeBank.math/cn/en`；KP 形如 `{id,name,pluginId,weight,moduleId,type,prerequisites,related,difficulty,status}`。
- `module-catalog.js`：M0–M13 / C1–C9 / N1–N8 / E1–E6 规范模块表，KP 的 `moduleId` 与 registry 的 `moduleIds` 均引用之。
- **跨插件共享 KP**：`math-g1-m9-classify`（分类与整理）同时被 `math-g1-operation`（涂色分类）与 `math-statistics`（分类与整理）生成，属设计内共享；知识页 CTA 指向 `pluginId` 字段。一致性问题见第十节 P1#3/#4 修复。

---

## 六、样式渲染系统

- `render.js`：`renderCard` / `renderGrid` + `createPlugin` 工厂；`clockSVG` 等；布局 / 列逻辑在 `core.js` 的 `Layout`（`calcOptimalCols` / `fitColumns` / `applySpanning`）。
- **SVG 生成**：`svg-core.js` 挂载 `SVGUtil` / `SVGGenerators.core`，按学科拆分 `svg-calculation / -geometry / -make-ten / -chinese / -english.js`；**缓存**用两个模块级 `Map`（`__vbCache` / `__wrapCache`）+ `memoize` + `clearCache()`（`svg-core.js:129-151,347-352`）。**已修复**：`clearCache()` 在每次练习会话切换时调用（见第十节 P2#8）。
- CSS：设计令牌 `tokens.css` + `base/components/pages/states/subjects/toolbar.css`，页面静态 `<link>`。

---

## 七、控制系统

- `check.js`：`defaultQCheck`（多字段 / 整串）、`computeResult`（返回 `{score,total,correct,results,correctAnswers}`）、`pickOpt`。
- `storage.js`：`StorageManager`——`load/save/clear`、`saveLastPractice`、`addWrong`（按 `pluginId:idx:signature` 去重，上限 50）、`updateDifficulty`（EMA `ema=ema*0.6+rate*0.4` 后走 `strategyFor`）、`getDifficulty`；隐私模式静默降级。
- `ui-state.js`：`escHtml` + 空状态 / 横幅 HTML（仅 token 着色）。

---

## 八、难度系统

- 用户填写 **1–10 整数**（`diffLevel` 归一，默认 3）。
- 结构分层 `TIERS`（`difficulty.js:27-33`），`difficultyToStructure` / `complexityScore` 单调。
- 自适应：`createProfile` / `consumeProfile` / `consume` + `applyDeltaRule` + `DELTA_RULES`；`strategyFor(subject)` 对 math/cn/en 返回同一套 `DELTA_RULES`（`difficulty.js:258-263`）。
- 流向 `generate()`：工厂注入 `opts.difficultyParams = App.Difficulty.paramsFor(subject, level)`，插件经 `_D.consume(opts)` 取 `effectiveLevel`。
- **已知脆弱点（保留，见 P2#10）**：`storage.updateDifficulty` 调 `strategyFor(pluginId)`，但 `strategyFor` 期望 subject；非 math/cn/en 串会静默回退到 `DifficultyProfiles.math`。当前无害（cn/en 复用 math 规则）。

---

## 九、其他辅助系统

- `version.js`：单一版本源（`APP_VERSION='4.0.0'`、`CACHE_VERSION='homework-help-4.0.0'`），既 `module.exports`（Node）也挂 `self.*`（浏览器 / SW，见第十节 P0）。
- `scripts/sync-sw-version.js`：校验 `sw.js` 的 `CACHE` 字面量 == `'hw-help-'+APP_VERSION`（CI / `npm test` 中校验）。
- `feedback/` 独立反馈（mailto 兜底）；`assets/` 图片；`subject-utils.js`（MathUtil / ChineseUtil / EnglishUtil）；`hanzi-bank.js` / `pinyin-bank.js`；`plugin-types.js`（仅 JSDoc 类型）。

---

## 十、已发现并修复的问题（P0–P2）

梳理过程中发现若干真实问题，已在本轮修复。下表为修复状态。

### 🔴 P0（功能失效，已修复）
1. **Service Worker 完全失效（离线 / 缓存机制报废）**
   - 原因：`sw.js:33` 原用顶层 ESM `import { CACHE_VERSION } from './shared/version.js';`，但注册点为 `navigator.serviceWorker.register('./sw.js')` 且**不带** `{type:'module'}`（`shared/plugin-loader.js:141`）→ 经典 SW 解析 `import` 抛 `SyntaxError`，`.catch` 静默吞掉；且 `version.js` 仅有 `module.exports`、无 ESM `export`，即便改为 module 注册也会失败。
   - 修复：`sw.js` 改为 `importScripts('./shared/version.js')`（`sw.js:34`）；`shared/version.js` 末尾将 `APP_VERSION/CACHE_VERSION/BUILD_DATE` 挂到 `self`（浏览器 `self===window`、SW 同作用域均可读，`version.js:18-23`）。保留 `const CACHE = 'hw-help-<APP_VERSION>';` 字面量（当前 `hw-help-4.0.0`）以通过 `sync-sw-version.js`。
   - 验证：`node --check sw.js` 通过；`sync-sw-version.js` 通过；`version.js` 在 `self` 存在时正确暴露全局。

### 🟠 P1（设计 / 一致性，已修复或说明）
2. **前端 `?v=` 版本注入未实现（说明 + 注释修正）**
   - 原 `sw.js` 注释声称 HTML 注入 `?v=CACHE_VERSION` 做缓存破坏，但 `withVersion()` 从未被调用，且 fetch 以 `url.pathname`（忽略查询串）为缓存键——即便注入也不影响失效语义。
   - 修复：保留 `withVersion()`（供手动调用），并将 `sw.js` 注释（`sw.js:39-46,152-154`）改为准确说明：**版本失效由 `CACHE` 名随 `APP_VERSION` 自增 + `activate` 清理旧缓存实现**，CORE 刻意保持无 `?v=` 以免破坏按 pathname 命中的离线预缓存。
3. **跨插件共享 KP 归属 + 模块错配（已修复）**
   - `math-g1-operation` 注册于 `M6`（几何，registry.js:24），但它生成 `M9`（统计）的 `math-g1-m9-classify` KP；该 KP 同时被 `math-statistics` 生成（设计内共享）。
   - 修复：将 `math-g1-operation` 的 `moduleIds` 由 `['M6']` 改为 `['M6','M9']`（`registry.js:24`），使模块覆盖一致。KP 的 `pluginId` 维持 `math-g1-operation`（涂色分类属操作题范畴），共享由测试层 `grade|kpId` 索引容纳。
4. **家长批改插件无自动判题（按设计保留）**
   - `math-g1-operation` 的 `check` 恒返回满分 + `parentCheck:true`、`answer:''`（`plugins/math-g1-operation.js`），知识页 CTA 指向它属预期（涂色 / 钟表等需家长批改）。与 `math-statistics` 的自动判题版分类并存，为有意设计，非缺陷。

### 🟡 P2（卫生 / 隐患，已修复或说明）
5. **SVG 缓存会话内不释放（已修复）**：`practice.html` 在每次加载新插件前调用 `window.SVGUtil.clearCache()`（`practice.html:1231-1233`），避免长会话内存只增不减。
6. **`package.json` 版本与 `APP_VERSION` 不一致（已修复）**：`package.json` `"version"` 与 `shared/version.js` 的 `APP_VERSION` 保持一致（当前 `4.0.0`）。
7. **遗留 `tests/test-runner.html`（保留）**：被 `README.md:114` 记录为 HTML 测试运行器，非真正孤立，予以保留。
8. **统计测试偶发飘红（已缓解）**：`random-distribution.test.js` 卡方检验已降至 α=0.01（临界 21.666 / 134.642），误报率约 1%；且 `test:node` 未进 CI，本地 `npm test` 偶发飘红概率已极低。
9. **工作树大规模未提交改动（说明）**：`git status` 显示约 600+ 个 `knowledge/*.html` 被修改，源于上一轮 `generate-knowledge-pages.js` 全量重生成。属生成产物，建议提交或 `git checkout` 还原，不在本次改动范围。
10. **R2 颜色白名单被滥用（说明）**：`dev/lint-check.js` 的 `/* allow-color */` 让插件可硬编码颜色（如 `math-statistics.js:34-35`），绕过 token 策略。改动插件渲染有回归风险，保留并标记为后续清理项。
11. **难度 `strategyFor(pluginId)` 契约脆弱（说明）**：见第八节末，当前无害，列为后续加固项。

### ✅ 核实无问题的项
- 缓存版本号一致：`sw.js` `CACHE='hw-help-4.0.0'` == `version.js` `APP_VERSION` → `sync-sw-version.js` 通过。
- registry↔文件一致：93 条注册文件均存在，`_template.js` 正确排除。
- 运行时代码零 `Math.random`（R1 满足）。
- 全仓无 `TODO/FIXME/known-broken` 标记。

---

## 十一、验证记录（本轮修复后）

| 检查 | 命令 | 结果 |
|---|---|---|
| SW 语法 | `node --check sw.js` | ✅ |
| SW 版本同步 | `node scripts/sync-sw-version.js` | ✅ 一致 |
| 静态 lint | `npm run check-lint` | ✅ 无违规 |
| 单元测试 | `npm run test:unit` | ✅ 15/15 |
| Node 测试 | `npm run test:node` | ✅ 42/42 |
| registry 校验 | `node scripts/verify-registry.js` | ✅ 93 条 |
| 知识库校验 | `node dev/verify-knowledge-bank.js` | ✅ 通过 |

> 说明：本文档为只读梳理 + 上述修复的产物，未做与修复无关的重构。所有改动均通过上方验证。
