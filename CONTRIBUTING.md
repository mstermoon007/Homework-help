# 贡献指南

## 一、公共文件来源（重要）

**`shared/` 是本仓库唯一公共文件来源（single source of truth）。**

- 所有页面（`index.html`、`*-types.html`、`practice.html`）与所有插件，必须引用 `shared/` 下的资源：
  `shared/common.js`、`shared/tokens.css`、`shared/base.css`、`shared/components.css`、`shared/toolbar.css`、`shared/pages.css`、`shared/print.js`、`shared/plugin-types.js`、`shared/knowledge-bank.js` 等。
- 根目录**不再存在**公共版 `common.js` / `common.css` / `print.js`（已于架构统一时删除并迁移到 `shared/`）。**禁止**新建根目录级别的公共脚本或样式文件。
- 样式按使用层级拆分（`@layer` 锁定层叠顺序，顺序在 `shared/tokens.css` 顶部声明）：
  `tokens.css`(设计令牌) → `base.css`(全局重置) → `components.css`(共享组件：题目卡片/按钮/题型卡片/页面控制器…) → `toolbar.css`(练习页工具栏) → `pages.css`(练习页专属)。
  **新增共享样式须归入对应层，禁止在插件内联重复样式**；HTML 加载顺序须为 `tokens → base → components`（练习页再加 `toolbar → pages`）。
- 新增跨插件复用的工具 / 常量 / 类型：一律放进 `shared/`（通用随机与标准化工具通过 `shared/common.js` 的 `PluginUtil` 暴露，类型定义在 `shared/plugin-types.js`）。
- **禁止**插件之间互相 `import` / `require` 对方内部实现；公共能力只能通过 `shared/` 共享。
- **清理保护（防误删）**：`dev/cleanup-scan.js` 的 `keepDirs` / `keepFiles` 白名单已保护 `shared/`、`docs/`、`plugins/`、`dev/`、`archive/` 目录与根级文档（`*.html` / `*.md` / `banner.jpg` / `pinyin-bank.js` 等），不会误删有效代码与文档。新增公共能力务必放进 `shared/`，否则可能被清理工具误判为可删除。

---

## 二、知识库文档

新增或修改知识点、新增数学插件前，请先阅读 `docs/knowledge-base.md`（一年级知识库结构、插件↔知识点映射、高年级扩展方式与 AI 生成检查清单）。

---

## 三、插件开发规则

### 0. 推荐：用 createPlugin 工厂（减少样板）

`shared/common.js` 的 `PluginUtil.createPlugin(config)` 已自动生成 `generate / render / check` 三段式，开发者**只需实现 `generateQuestions(opts)`**（返回标准题目数组，每题含 `answer` + `render(idx)`，可选 `check`）。其余接口与契约（强制点、Question 规范、`registry` 条目）完全不变。

```js
const plugin = PluginUtil.createPlugin({
  id: 'math-patterns',
  name: '找规律',
  grades: [1],
  subject: 'math',
  category: 'number',
  knowledgePoints: ['g1-m4-patterns'],   // 声明本插件覆盖的知识点（开发期自动校验/提示）
  generateQuestions(options) {
    // ... 生成并返回 questions 数组，每题含 answer + render(idx)
    return list.map(p => ({
      answer: String(p.answer),
      render(idx) { return renderCard(this.data, idx); },
      check(userAnswers, idx) { return checkQuestion(this, userAnswers, idx); }
    }));
  }
});
global.__currentPlugin = plugin;
if (typeof module !== 'undefined' && module.exports) module.exports = plugin;
```

工厂自动完成：
- 生成标准 `generate`（包装 `generateQuestions`、参数合理性提醒、`knowledgePoints` 校验）；
- 生成标准 `render`（`.questions-grid` 网格，逐题调用 `q.render(idx)`；可用 `config.render` 覆盖）；
- 生成标准 `check`（逐题调用 `q.check`，缺省按 `answer` 兜底比较，返回标准 `CheckResult`）；
- 把 `settings` / `printConfig` / 自定义方法（如 `__choose`）等非保留字段原样挂到插件对象。

**知识点覆盖（开发期提示）**：
- `config.knowledgePoints` 声明本插件覆盖的知识点（id 或 name）。工厂在 `generate` 时校验这些点是否已登记在 `shared/knowledge-bank.js`，未登记会 `console.warn` 输出「缺失知识点清单」。
- 新增插件后，浏览器控制台（每页一次）或终端 `node dev/coverage.js` 会展示「当前年级已覆盖知识点 X/Y，建议下一个开发 Z」——基于 `plugins/registry.js` 实际插件集合与 `shared/knowledge-bank.js` 基线自动计算。
- 参考范例：`plugins/pinyin-to-char.js`（语文，无知识库覆盖）、`plugins/math-patterns.js`（数学，含 `knowledgePoints` 声明）。

### 1. 接口契约（generate / render / check）

- 每个插件文件最终把自身对象挂载到 `window.__currentPlugin`（见 `shared/plugin-types.js` 的 `ExercisePlugin` 与 `plugins/CONTRACT.md`）。
- **必须实现**三个接口：
  - `generate(options) → { questions, meta }`
  - `render(exerciseSet) → html 字符串`
  - `check(exerciseSet, userAnswers) → CheckResult`
- **必填元数据**：`id` / `name` / `subject` / `grades`；**可选元数据**：`category` / `printConfig` / `settings` / `deps`（其中 `deps` 写在 `registry.js` 条目中，而非插件对象上）。
- 题目对象必须符合 `Question` 规范（`answer` + `render(idx)` 必填，`check` 可选，详见 `CONTRACT.md` 第四节）。

### 2. 全局 DOM 禁止操作（硬性）

> 插件**只能通过 `render()` 返回 HTML 字符串**参与界面，**禁止操作 DOM**（严禁直接触碰实时 DOM）。

明确禁止以下行为：

- ❌ 用 `document.querySelector` / `getElementById` / `getElementsBy*` 读取或修改页面已有节点
- ❌ 直接对 `document.body` / `document.head` / `<html>` 做 `appendChild` / `remove` / `innerHTML` 赋值
- ❌ 往全局 `<style>` 注入样式，或直接修改任何全局 / 容器元素的样式
- ❌ 给 `window` / `document` / 容器元素 `addEventListener`
- ❌ 在模块顶层（加载期）执行任何 DOM 读写

理由：所有 DOM 生命周期（注入 `#problemsArea`、A4 列数自适应、答案收集、批改标记、打印）都由容器 `practice.html` 统一负责。插件只产出数据 + HTML，保证可被屏幕端、打印端、综合插件任意复用。

**唯一例外**：`math-comprehensive.js` 可用 `document.createElement('script')` + `document.head.appendChild` 动态预加载同仓兄弟插件脚本——这是综合练习架构的有意设计，不属于通用插件规则。

### 3. 随机数生成

必须使用 `shared/common.js` 提供的 `PluginUtil.randInt(min, max)` 与 `PluginUtil.shuffle(array)`，**禁止**直接使用 `Math.random()`（以保证可复现与统一熵源）。

### 4. 注册与依赖

- 新增插件：从 `plugins/_template.js` 复制开始编写，保留必需结构。
- 在 `plugins/registry.js` 的 `PLUGIN_REGISTRY` 追加一条：`{ id, file, name, subject, category, grades, deps? }`。
- 需要预置大体积数据（如拼音词库 `pinyin-bank.js`）时，用 `deps` 声明前置脚本，由加载器按顺序预加载；**不要在插件文件内硬编码此类数据**。

### 5. 打印约定

打印能力统一由 `shared/print.js` 提供（全局 `Print`），**仅 `practice.html` 加载该脚本**（首页 / 题型选择页不需要打印，不引用）。

- **插件声明**：在插件对象上提供 `printConfig: { pageType: string }`。
  - `pageType`：选择打印模板分支（A4 边距、列数等），取值见 `shared/print.js` 的 `PRINT_ROUTES`：`math` / `pinyin` / `word` / `makeTen` / `pinyinToChar` / `comprehensive` / `numberSense` / `measurement` / `geometry` / `shapes` / `unitConvert` / `alphabet`。**缺失时容器回退 `'math'`**。
- **标题统一**：所有生成页标题固定为「年级 + 题型（+ 题量）」，例如 `四年级 竖式计算（50题）`。年级取自 URL 参数；题型取自 `plugin.name`（或插件 `generate` 返回的 `meta.title`，容器会自动剥离其中自带的年级前缀）；题量取实际生成题数。屏显主标题（hero `<h1>`）与打印页标题由 `practice.html` 的 `buildTitle()` 统一组装，**`printConfig` 不提供标题覆盖**。`plugin.pageTitle` 为冗余字段，已从全部插件移除；如需副标题描述（如知识点范围）可用 `pageSubtitle`（仅显示在页头描述行，不参与标题）。
- **打印触发**：容器（`practice.html` 的 `printFile()`）读取当前插件的 `printConfig`，再调用 `Print.open(area, title, { pageType, columns })`——`pageType` 取自 `printConfig.pageType`（回退 `'math'`），`columns` 由容器按题目长度自适应（A4 竖版宽度内排版）。`Print.open` 会克隆 `#problemsArea` 实时 DOM、复制原页 `<link>`/`<style>`、套用 A4 竖版、移除按钮 / 控制面板等交互元素，保证打印排版与屏幕预览一致。
- **插件禁止自行打印**：插件只产出数据 + HTML，不得直接调用 `window.print()` 或操作打印窗口。所有打印逻辑集中在 `shared/print.js` + 容器。
- **复合答案展示**：有余数（`q……余 r`）、多空数组等标准答案的打印展示由 `print.js` 的 `formatAnswer` 统一处理，插件无需关心。

---

## 三点五、模块目录与知识库维护

### 模块目录 `shared/module-catalog.js`（唯一权威数据源）

- 题型模块统一登记在 `MODULE_CATALOG`：基础 `M0`–`M12`（`level: 'basic'`，`M0` 巧算专项仅一年级）+ 竞赛 `C1`–`C9`（`level: 'competition'`，高年级 4–6）。
- 新增题型模块：在 `BASIC_MODULES` / `COMPETITION_MODULES` 数组中追加 `{ id, name, grades, category, level }`，保持 `id` 唯一、`grades` 与 `level` 与现有风格一致。
- 该文件由 `dev/cleanup-scan.js` 白名单保护（`shared/module-catalog.js`），不会误删。
- 竞赛模块在未实现具体题型前使用占位插件 `plugins/math-competition-placeholder.js`（`isPlaceholder: true`，见 `plugins/CONTRACT.md` 五点五节）。

### 知识库 `shared/knowledge-bank.js`

- 组织方式：`[{ grade, modules: [{ moduleId, knowledgePoints: [KnowledgePoint] }] }]`，`KnowledgePoint` 字段见下方编号规范。
- 每个 `moduleId` 必须存在于 `shared/module-catalog.js`；`knowledgePoints` 可为空数组（如高年级竞赛模块占位阶段）。
- `weight` 用于综合练习 `kb` 模式的抽题配比（也驱动题型选择页排序）；新增 / 调整知识点请同步 `weight`。
- 修改知识库后运行 `node dev/coverage.js` 确认各年级覆盖基线（1–3 年级 100%）。
- **占位插件**：知识库已建但题型未实现时，用占位插件兜底（`isPlaceholder: true`，见 `plugins/CONTRACT.md`）。四、五年级基础模块 M1–M12（`math-g4-*` / `math-g5-*`）**已全部实现**；当前仅竞赛 C1–C9（`math-competition-placeholder.js`）处于占位阶段。覆盖率统计会自动排除占位插件。
- **前置 / 关联引用（`prerequisites` / `related`）**：知识点可含这两个字段，值为知识点 `id` 数组。
  - **规则：允许低年级前置与同年级前置，禁止高年级前置。** 高年级前置是错误，由 `dev/verify-knowledge-bank.js` 报错阻断。
  - 低年级前置表达「先修基础」；同年级前置用于表达年级内学习顺序（如模块内部递进），添加时需确认逻辑合理、无循环依赖。
  - 校验脚本对同年级前置**仅警告、不阻断**，会单独计数并输出「同年级前置依赖 N 条，请确认是否符合教学顺序」，需定期人工复核。

### 知识点编号规范（ID 命名与字段）

**ID 格式**（全小写 + 数字 + 连字符，无空格 / 下划线）：

```
g{grade}-{moduleIdLower}-{baseSlug}
```

- `grade`：1–6。
- `moduleIdLower`：模块 ID 小写（`m0`–`m12`、`c1`–`c9`）。
- `baseSlug`：语义化片段；**同主题跨年级保持一致**（如 `c1-vertical` 在 4/5/6 年级为
  `g4-c1-c1-vertical` / `g5-c1-c1-vertical` / `g6-c1-c1-vertical`）。

示例：`g1-m1-addsub-20`、`g4-c5-c5-meet`、`g6-m8-g6-app-frac-mult`。

**slug 字典**：已归档至 `archive/dead-code-20260823/knowledge-slug-map.js`（`KNOWLEDGE_SLUGS`，
以 `{grade}-{baseSlug}` 为键）。运行时零引用，仅作历史对照；新增知识点无需维护该文件。

**知识点字段**（KnowledgePoint）：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 全局唯一 ID（命名见上） |
| `name` / `pluginId` / `weight` / `type` | string / string / number / string | 名称、插件、抽题权重、子题型参数 |
| `description` / `example` | string | 说明与典型例题（详情页展示） |
| `prerequisites` / `related` | string[] | 前置 / 关联知识点 ID 数组（规则见上） |
| `difficulty` | number | 基础模块 `1`；竞赛模块按年级 `3`/`4`/`5` |
| `status` | string | `'active'` 或 `'placeholder'` |

**校验**：`node dev/verify-knowledge-bank.js` 自动检查 ID 格式、全局唯一、引用存在且前置不指向更高年级、
竞赛难度跨年级不降、status 与插件占位一致、详情页文件一一对应。

**迁移注意事项**（2026-08-23 已完成整体迁移）：
- 旧 ID（如 `addsub-20`、`g4-fill-line`）已迁移为三段式；旧引用仅存于 `archive/migration-20260823/`。
- 插件 `createPlugin` 的 `knowledgePoints`：单年级用数组、多年级用 `{ grade: [id...] }`（ID 含年级）。
- 详情页文件名 = 知识点 `id`（`knowledge/{id}.html`），修改知识库后运行
  `node scripts/generate-knowledge-pages.js` 再生成。
- 切勿再引入旧 ID 命名。

### 新增数学插件的固定步骤

1. 从 `plugins/_template.js` 复制，实现 `generateQuestions`（推荐用 `PluginUtil.createPlugin` 工厂，`generate` / `render` / `check` 自动生成）。
2. 在插件对象上声明合法 `moduleId`（对应模块目录中的一个 `Mx` 或竞赛模块 `Cx`；占位阶段竞赛插件不加）。
3. 在 `plugins/registry.js` 追加条目（含 `moduleIds` / `isPlaceholder` 字段视情况）。
4. 运行 `node dev/verify-setup.js` 与 `node dev/coverage.js` 校验通过。

---

## 三点六、竞赛插件开发指南（C1–C9）

竞赛模块（`shared/module-catalog.js` 的 `COMPETITION_MODULES`，`level: 'competition'`，四–六年级）在基础模块全部实现后启动填充。开发任一 `Cx` 竞赛插件时，除遵守上文全部通用规则外，还需注意以下竞赛特有约定。

### 1. 特殊数据结构

- **模块归属**：插件对象声明 `moduleId: 'C1'`–`'C9'`（对应模块目录中的竞赛模块），registry 条目同写 `moduleIds: ['Cx']`。与基础插件一致，由 `dev/verify-setup.js` 校验。
- **`category` 按数学领域填，不要填 `'competition'`**：综合练习按 `category`（number / geometry / statistics / mixed）做领域配比。`'competition'` 是历史占位清理用的哨兵值——若确实要用，必须保证 `generate` 能真实出题（综合练习会对该类插件做一次能力探测，空产出仍按占位剔除）。推荐做法：数字谜/数论/计数/行程/工程浓度/分数巧算 → `number`；几何模型 → `geometry`；最值与逻辑推理 → `statistics`；竞赛综合 → `mixed`。
- **`grades` 与模块目录一致**：C1–C5、C8–C9 为 `[4,5,6]`，C6–C7 为 `[5,6]`。插件 `grades` 只能是其子集。
- **难度基线**：竞赛题建议难度 6–10（`difficulty` 数值 1–10，`diffScale` 会放大数值范围）；同一题内可用 `settings` 提供子题型筛选（如 C5 行程：相遇 / 追及 / 火车过桥）。
- **答案结构**：多空题（如 C1 数字谜多位填空）一律用**数组 answer + `inputType: 'multi'` + `inputCount`**，由 `PluginUtil.defaultQCheck` 分字段判定；禁止用"、"拼接字符串答案（单框多空是已清理的历史缺陷）。有余数/复合答案参考 `math-oral`（`{q, r}` 对象）或 `math-g4-vertical`（自定义 `check`）。
- **知识库联动**：每个竞赛插件须在 `shared/knowledge-bank.js` 对应年级模块下登记知识点（含 `weight`，综合练习 `kb` 模式按 weight 抽题）；`knowledgePoints` 声明在 `createPlugin` config 上，工厂会自动校验登记。

### 2. 打印模板

- 竞赛题打印沿用现有 `printConfig: { pageType }` 路由（`shared/print.js` 的 `PRINT_ROUTES`）：计算类竞赛题用 `'math'`（默认回退也是它），几何模型类（含 SVG 图形）用 `'geometry'`，跨模块综合卷用 `'comprehensive'`。不需要新增打印分支。
- 题目渲染统一走 `PluginUtil.renderCard`（类化输出），保证打印输出干净：无按钮、无输入框交互痕迹、无 `onclick` 行为；选项题保留 `.opt` 文本（打印时需可见选项内容）。
- 长题干（行程线段图、逻辑推理表格）渲染时给足 `svg` / 表格宽度，打印模板按 A4 竖版自适应列数，无需插件干预。

### 3. 占位替换流程（实现某个 Cx 时）

1. 从 `plugins/_template.js` 复制创建 `plugins/math-competition-cX-<slug>.js`（推荐 `createPlugin` 工厂）。
2. `plugins/registry.js` 追加真实插件条目（`moduleIds: ['Cx']`，无 `isPlaceholder`）。
3. 从 `math-competition-placeholder` 条目的 `moduleIds` 数组中**移除已实现的 Cx**（占位卡片随之从题型选择页消失）；全部 C1–C9 实现后删除该占位条目与占位文件。
4. 同步 `shared/knowledge-bank.js`（知识点 + weight）与 `shared/module-catalog.js`（`desc` 描述）。
5. 校验：`node dev/verify-setup.js`、`node dev/coverage.js`、`node dev/regression-check.js` 全部通过。

### 4. SVG 生成器使用规范（shared/svg-*.js）

几何/竖式/巧算图解**必须使用共享生成器**，禁止在插件内手写 `<svg>` 拼接（历史遗留的 rawHtml 竖式除外，逐步迁移中）。

| 全局对象 | 文件 | 用途 |
| --- | --- | --- |
| `SVGUtil` | `shared/svg-core.js` | 基础元素 / `computeViewBox` / `svgWrap`；`SVG_DEFAULTS` 统一配色线宽 |
| `SVGGeometry` | `shared/svg-geometry.js` | 长方形/三角形/梯形/圆/扇形等 + 标注（边长、角度弧、直角符号、高线）；立体图；平移旋转对称叠加演示 |
| `SVGCalculation` | `shared/svg-calculation.js` | 加减乘除竖式（进位/借位点自动标注、部分积错位、长除格式），支持 `errorType` 典型错误模式 |
| `SVGMakeTen` | `shared/svg-make-ten.js` | 凑十/平十/破十三行彩色步骤图解；无效组合返回 `null` |

使用要点：

1. **加载顺序**：`svg-core.js` 必须先于其余三者；插件通过 registry `deps` 声明或页面直接引入。
2. **输出即完整 `<svg>`**：自带 xmlns/viewBox/role，赋给题目 `q.svg` 后由 `.scene-box` 渲染；窄屏与打印由 `max-width:100% + height:auto` 规则等比缩放，无需插件干预。
3. **尺寸按单位传参**（如厘米），经 `unitPx` 映射像素；禁止硬编码像素坐标（变换演示的 points 除外）。
4. **颜色只用常量**：轮廓 `#27324a`、填充 `#eef3fb`、错误标记 `#e05252` 等，见 `SVG_DEFAULTS` 与各文件头部约定。
5. **测试义务**：新增/修改生成器须同步扩展 `dev/test-svg-core.js` / `dev/test-svg-geometry.js` / `dev/test-svg-calculation.js` / `dev/test-svg-make-ten.js` 断言，并保证 `node dev/verify-svg.js` 通过；可视化调试用 `dev/svg-test.html`。

---

## 四、提交前检查

- 在浏览器中打开 `dev/plugin-check.html`，加载你的插件文件，确保所有结构与接口测试通过。
- 运行 `node dev/verify-setup.js`，确认注册表与骨架文件齐备。
- 运行 `node dev/coverage.js`，确认知识点覆盖基线正常（数学 1–3 年级均有统计）。
- 运行 `node dev/regression-check.js`，满分回填回归必须 100 分（验证题面空位数与答案结构一致）。
- 确保你的插件在至少两个主流浏览器（Chrome、Firefox）中正常工作。
- 确认没有违反「全局 DOM 禁止操作」「公共文件必须来自 shared/」两条硬性规则。
