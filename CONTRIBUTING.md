# 贡献指南

## 一、公共文件来源（重要）

**`shared/` 是本仓库唯一公共文件来源（single source of truth）。**

- 所有页面（`index.html`、`*-types.html`、`practice.html`）与所有插件，必须引用 `shared/` 下的资源：
  `shared/common.js`、`shared/tokens.css`、`shared/base.css`、`shared/components.css`、`shared/toolbar.css`、`shared/pages.css`、`shared/print.js`、`shared/plugin-types.js`、`shared/knowledge-bank.js`（入口壳）及其按科目数据分片 `knowledge-math/cn/en.js` 等。
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

### 0. 推荐：用科目化工厂（减少样板）

`shared/common.js` 提供四级工厂，按需选用：

| 工厂 | 预设 | 适用 |
| --- | --- | --- |
| `PluginUtil.createMathPlugin(cfg)` | subject='math' · 数值比较批改 · `math-grid` 网格类 · 难度消费 math | 数学题型 |
| `PluginUtil.createChinesePlugin(cfg)` | subject='chinese' · 标准化批改（去空白/全角归一/尾部句读）· `cn-grid` · 难度消费 cn | 语文题型 |
| `PluginUtil.createEnglishPlugin(cfg)` | subject='english' · 拼写批改（忽略大小写，`answer` 可用 `\|` 分隔多接受答案）· `en-grid` · 难度消费 en | 英语题型 |
| `PluginUtil.createPlugin(cfg)` | 无预设（完全手写行为），旧插件兼容路径 | 特殊需求 |

科目工厂自动完成：
- 生成标准 `generate`（包装 `generateQuestions`、参数提醒、知识点校验），并在调用前注入
  **`opts.difficultyParams = App.Difficulty.paramsFor(科目, 难度)`**——generateQuestions 里
  直接读 `opts.difficultyParams.steps / vocabTier / wordLengthMax …` 即完成难度消费；
- 单输入题缺省批改走科目比较器（multi/数组答案仍走 defaultQCheck 分字段判定）；
- 默认 render 网格带科目修饰类（`.math-grid/.cn-grid/.en-grid`），并暴露
  `plugin.cardClass / plugin.gridClass`；
- 生成标准 `render` / `check`、把 settings/printConfig 等非保留字段原样挂载。

纯函数示例：

```js
var plugin = PluginUtil.createMathPlugin({
  id: 'my-math-drill',
  name: '我的数学练习',
  grades: [1],
  moduleId: 'M1',
  knowledgePoints: ['math-g1-m1-addsub-20'],
  generateQuestions(opts) {
    var p = opts.difficultyParams;           // {level,scale,steps,allowBracket,allowMultDiv}
    return [{ q: '1 + 1 =', answer: 2, inputType: 'text' }];
  }
});
```

通用工厂 `createPlugin(config)` 的完整契约见第七节与 `plugins/CONTRACT.md`；
旧插件无需迁移，两条路径长期并存。

通用工厂 `createPlugin(config)` 的完整契约见第七节与 `plugins/CONTRACT.md`；
旧插件无需迁移，两条路径长期并存。通用工厂示例：

```js
const plugin = PluginUtil.createPlugin({
  id: 'math-patterns',
  name: '找规律',
  grades: [1],
  subject: 'math',
  category: 'number',
  knowledgePoints: ['math-g1-m4-patterns'],   // 科目前缀三段式 ID（开发期自动校验/提示）
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

工厂自动完成（通用与科目工厂共有）：
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

### 3. 随机数使用规范

必须使用 `shared/common.js` 提供的统一随机工具，**禁止**在运行时代码中直接调用 `Math.random()`
（以保证可复现与统一熵源；全仓审计已达成零直调，唯一豁免是 `randInt` 内部的 crypto 兜底）：

| 需求 | 工具 |
| --- | --- |
| 整数随机 `[min, max]`（含两端，crypto 优先） | `PluginUtil.randInt(min, max)` |
| 数组乱序（Fisher-Yates，返回新数组不改原数组） | `PluginUtil.shuffle(arr)` |
| 从数组取一个元素 | `PluginUtil.rand(arr)` |
| 概率判断（如 50% 走某分支） | `randInt(0, 1) === 0` 或 `randInt(1, 100) <= p` |

- ⚠️ 禁止 `arr.sort(() => Math.random() - 0.5)`——该写法有统计偏差且违反规范。
- dev/ 下 Node 脚本可直接 `require('../shared/common.js')` 复用同一套工具（regression-check 即如此）。
- 唯一允许的字面量位置：`shared/common.js` 的 `randInt` 实现内部。

### 3.5 样式与设计令牌

所有颜色、圆角、阴影、渐变必须使用 `shared/tokens.css` 中定义的 CSS 变量（单一来源：
`--brand/--brand-d/--brand-bg/--ink/--muted/--line/--line-strong/--card/--bg/--soft-bg/
--ok/--bad/--warn/…
及对应浅底 `--*-bg`、`--radius-card`、`--grad-*`），修改令牌即全局生效：

**科目三色令牌（任务13）**：`--math-primary/secondary/accent`、`--cn-primary/secondary/accent`、
`--en-primary/secondary/accent`。旧名 `--math/--chinese/--english` 已别名化指向对应 primary——
改 primary 值即该科目全站元素联动。书写格变量：`--grid-tianzige-frame/aux`（田字格）、
`--grid-fourline-line/baseline`（四线三格横线/基线）、`--paper-fourline-bg/rule`
（拼音纸组件），svg-chinese/svg-english 生成器已实际消费。

- 插件渲染题目优先用 `PluginUtil.renderCard()` / 类名（样式集中在 shared/components.css），
  避免内联样式；确需内联时颜色写 `var(--xxx)`，禁止硬编码十六进制值。
- 新增 UI 组件：样式提取到 `shared/components.css`（或页面级 `<style>` 仅限单页特有），
  类名遵循现有简洁前缀风格（`.q-*` / `.toolbar-*` / `.sheet-*` 等），不引入新体系。
- **SVG 表现属性例外**：`fill="#27324a"` 这类表现属性不支持 `var()`，保持字面量；
  需要主题色的 SVG 请改写在 `style="fill:var(--ink)"` 上。
- 打印安全：打印窗口会复制原页 `<link>`/`<style>`（见 `shared/print.js`），令牌正常解析。

### 3.6 难度系统使用规范（v2）

难度解析统一走 `shared/difficulty.js`（`App.Difficulty`），禁止各插件自造难度逻辑：

1. **插件必须用 `App.Difficulty.consume(options)` 解析难度**：在 `generateQuestions(opts)`
   开头调用，取 `profile.effectiveLevel / scale / structure / typePreference` 消费；
   数值范围缩放用 `profile.scale`（替代直调 `diffScale/diffMax`），运算步数/括号/乘除
   用 `profile.structure.steps / allowBracket / allowMultDiv`。
2. **题目对象可携带可选字段** `knowledgePointId`（对应 knowledge-bank.js 的知识点 ID）
   与 `difficulty`（该题相对难度 1–10），便于知识点关联与难度说明；两者均为可选，
   不提供时不影响练习生成与批改。
3. **禁止直接使用 `Math.random()` 控制难度参数**（随机数规范见 §3）；
   难度相关随机一律基于 `randInt` 系工具。
4. **自带难度分档的插件**（settings 中存在 `level` 分档 chip）：跳过通用消费——
   `consume()` 检测到 `options.level` 会置 `hasOwnLevel=true` 并回落默认档；
   此类插件不要读取 `options.difficulty` 自行叠加。
5. 结构分档参考：1–2 单步；3–4 两步连加连减；5–6 三步含括号乘除；
   7–8 四步符号交替；9–10 五步多层括号（详见 `App.Difficulty.TIERS`，
   断言见 `dev/test-difficulty-structure.js`）。
6. **迁移现状（步骤7，2026-08-24）**：一~三年级基础插件已全部走 `consume()`
   并标注 `q.difficulty` 与 `knowledgePointId`（子题型→知识点映射，仅标注本插件
   在知识库登记的 KP）；自带 `level` 分档插件（如 math-word-problems）跳过通用
   消费、仅补 KP 标注；竞赛类保留自身难度基线（6–10）。新增基础插件须遵循同一模式。

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

- 题型模块统一登记在 `MODULE_CATALOG`，按科目三系列组织：
  - 数学基础 `M0`–`M12`（`subject:'math'`, `level:'basic'`）+ 竞赛 `C1`–`C9`（`level:'competition'`）
  - 语文 `N1`–`N8`（`subject:'cn'`；拼音基础 N1 为 active，其余 placeholder 待激活）
  - 英语 `E1`–`E6`（`subject:'en'`；字母与发音 E1 为 active，其余 placeholder 待激活）
- **每个模块对象必含 `subject` 字段**（`math|cn|en`），且前缀与科目强对应：
  M/C→math、N→cn、E→en（verify-setup 强制校验）。新增模块 ID 必须全局唯一。
- 新增题型模块：在对应科目数组中追加 `{ id, name, subject, grades, category, level?, status? }`，
  保持 `id` 唯一、`grades` 与现有风格一致。语文/英语 category 用
  language-basic / language-advanced / literature / reading / writing / comprehensive。
- 该文件由 `dev/cleanup-scan.js` 白名单保护（`shared/module-catalog.js`），不会误删。
- 竞赛模块在未实现具体题型前使用占位插件 `plugins/math-competition-placeholder.js`
  （`isPlaceholder: true`，见 `plugins/CONTRACT.md` 五点五节）；语文/英语未激活模块以
  模块级 `status:'placeholder'` 标记。

### 知识库 `shared/knowledge-bank.js`

- 组织方式（任务3 起按科目分组对象）：`KnowledgeBank = { math: [...], cn: [...], en: [...] }`，
  每科目的值为年级条目数组 `[{ grade, modules: [{ moduleId, knowledgePoints: [KnowledgePoint] }] }]`。
  `cn`/`en` 初始为空数组或少量已填充年级（当前 cn 含一年级 N1/N2 共 5 条，
  en 含三年级 E1/E2 共 3 条）。
- 查询 API 均以 `(subject, grade)` 双参调用：`findGrade/getEntries/getCoverage/
  coverageFromRegistry/suggestNext`；`getCoverage(subject)` 省略年级时聚合该科目全部年级。
  科目代号兼容注册表全称（chinese/english 自动归一为 cn/en）。
- 每个 `moduleId` 必须存在于 `shared/module-catalog.js`；`knowledgePoints` 可为空数组（如高年级竞赛模块占位阶段）。
- `weight` 用于综合练习 `kb` 模式的抽题配比（也驱动题型选择页排序）；新增 / 调整知识点请同步 `weight`。
- 修改知识库后运行 `node dev/coverage.js` 确认各年级覆盖基线（1–3 年级 100%）。
- **占位插件**：知识库已建但题型未实现时，用占位插件兜底（`isPlaceholder: true`，见 `plugins/CONTRACT.md`）。四、五年级基础模块 M1–M12（`math-g4-*` / `math-g5-*`）**已全部实现**；当前仅竞赛 C1–C9（`math-competition-placeholder.js`）处于占位阶段。覆盖率统计会自动排除占位插件。
- **前置 / 关联引用（`prerequisites` / `related`）**：知识点可含这两个字段，值为知识点 `id` 数组。
  - **规则：允许低年级前置与同年级前置，禁止高年级前置。** 高年级前置是错误，由 `dev/verify-knowledge-bank.js` 报错阻断。
  - 低年级前置表达「先修基础」；同年级前置用于表达年级内学习顺序（如模块内部递进），添加时需确认逻辑合理、无循环依赖。
  - 校验脚本对同年级前置**仅警告、不阻断**，会单独计数并输出「同年级前置依赖 N 条，请确认是否符合教学顺序」，需定期人工复核。

### 知识点编号规范（ID 命名与字段）

**ID 格式**（全小写 + 数字 + 连字符，无空格 / 下划线；任务2 起强制科目前缀）：

```
{subject}-g{grade}-{moduleIdLower}-{baseSlug}
```

- `subject`：科目前缀，`math` | `cn` | `en`（与 module-catalog 的 SUBJECTS 一致）。
- `grade`：1–6。
- `moduleIdLower`：模块 ID 小写（math：`m0`–`m12`、`c1`–`c9`；cn：`n1`–`n8`；en：`e1`–`e6`）。
- `baseSlug`：语义化片段；**同主题跨年级保持一致**（如 math-g4/g5/g6-c1-c1-vertical）。

示例：`math-g1-m1-addsub-20`、`math-g4-c5-c5-meet`、`cn-g1-n1-pinyin-basic`、
`en-g3-e1-letter-recognition`。

**slug 字典**：已归档至 `archive/dead-code-20260823/knowledge-slug-map.js`（键已同步为
`math-{grade}-{baseSlug}`）。运行时零引用，仅作历史对照；新增知识点无需维护该文件。

**知识点字段**（KnowledgePoint）：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 全局唯一 ID（命名见上） |
| `name` / `pluginId` / `weight` / `type` | string / string / number / string | 名称、插件、抽题权重、子题型参数 |
| `description` / `example` | string | 说明与典型例题（详情页展示） |
| `prerequisites` / `related` | string[] | 前置 / 关联知识点 ID 数组（规则见上） |
| `difficulty` | number | 基础模块 `1`；竞赛模块按年级 `3`/`4`/`5` |
| `status` | string | `'active'` 或 `'placeholder'` |
| `moduleId?` / `category?` / `exerciseTypes?` / `bankRef?` | 语文等科目扩展（任务：数据结构扩展） | `moduleId` 所属模块小写（如 n1）；`category` 内容域（pinyin/hanzi…）；`exerciseTypes` 可服务的题型生成器（插件 ID）数组；`bankRef` 数据源银行名（pinyinBank 现存，hanziBank 预留）。数学知识点不使用这些字段 |

**校验**：`node dev/verify-knowledge-bank.js` 自动检查 ID 格式（强制科目前缀）、全局唯一、引用存在且前置不指向更高年级、
**跨科目引用非法**（prerequisites/related 不得指向其他科目知识点）、**ID 科目前缀与所在科目组/模块目录 subject 一致**、
竞赛难度跨年级不降、status 与插件占位一致、详情页文件一一对应。

**知识库同步要求**（插件 ↔ knowledge-bank 双向对齐，校验脚本第 8 条强制）：

1. **新增插件并声明 `knowledgePoints` 时，必须同步在 `shared/knowledge-bank.js` 中添加对应模块和知识点**；
   反之，知识库条目的 `pluginId` 必须是注册表中的有效插件 ID。
2. 知识点 ID 遵循 `g{grade}-{moduleId}-{slug}` 三段式规范；插件声明的知识点 ID 必须登记在
   与声明年级键一致的年级下（如 `knowledgePoints: { 6: ['g6-c2-…'] }` 对应知识库六年级条目）。
3. 知识库条目的 `pluginId` 必须与实现该知识点的插件 ID 一致；占位期指向
   `math-competition-placeholder` 并将知识点 `status` 置为 `'placeholder'`。
4. **修改或删除插件时同步维护**：插件收缩年级 / 退役时，移除其不再服务年级的
   `knowledgePoints` 声明与对应知识库条目；改 ID 时同步更新知识库引用。
5. 违反上述任一条，`node dev/verify-knowledge-bank.js` 将以非零退出并列出
   插件名、年级与缺失/多余的知识点 ID。

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

**科目化命名空间（任务7 起）**：所有生成器同时挂载到 `SVGGenerators` 命名空间——
`core`（=SVGUtil）、`math.geometry / math.calculation / math.makeTen`、
`cn`（svg-chinese）、`en`（svg-english）。全局旧名保留兼容。
practice.html 经 `App.PluginLoader.ensureSubjectSvg(subject)` 按科目预载：
math → core+geometry+calculation+makeTen；cn → core+svg-chinese；en → core+svg-english。

| 全局对象 | 文件 | 用途 |
| --- | --- | --- |
| `SVGUtil`（=`SVGGenerators.core`） | `shared/svg-core.js` | 基础元素 / `computeViewBox` / `svgWrap`；`SVG_DEFAULTS` 统一配色线宽 |
| `SVGGeometry`（=`…math.geometry`） | `shared/svg-geometry.js` | 长方形/三角形/梯形/圆/扇形等 + 标注（边长、角度弧、直角符号、高线）；立体图；平移旋转对称叠加演示 |
| `SVGCalculation`（=`…math.calculation`） | `shared/svg-calculation.js` | 加减乘除竖式（进位/借位点自动标注、部分积错位、长除格式），支持 `errorType` 典型错误模式 |
| `SVGMakeTen`（=`…math.makeTen`） | `shared/svg-make-ten.js` | 凑十/平十/破十三行彩色步骤图解；无效组合返回 `null` |
| `SVGChinese`（=`SVGGenerators.cn`） | `shared/svg-chinese.js` | 田字格/米字格汉字 `hanziGrid` · 四线三格拼音 `pinyinGrid` · 笔顺演示 `strokeOrder`（内置 10 字）· 书写格 `sentenceLine` |
| `SVGEnglish`（=`SVGGenerators.en`） | `shared/svg-english.js` | 单字母四线三格 `letterWriting` · 单词卡片 `wordCard` · 句子抄写条 `fourLineWriting` |

使用要点：

1. **加载顺序**：`svg-core.js` 必须先于其余三者；插件通过 registry `deps` 声明或页面直接引入；按科目的整组预载由 PluginLoader 自动完成，无需插件干预。
2. **输出即完整 `<svg>`**：自带 xmlns/viewBox/role，赋给题目 `q.svg` 后由 `.scene-box` 渲染；窄屏与打印由 `max-width:100% + height:auto` 规则等比缩放，无需插件干预。
3. **尺寸按单位传参**（如厘米），经 `unitPx` 映射像素；禁止硬编码像素坐标（变换演示的 points 除外）。
4. **颜色只用常量**：轮廓 `#27324a`、填充 `#eef3fb`、错误标记 `#e05252` 等，见 `SVG_DEFAULTS` 与各文件头部约定；语文/英语书写格辅助线经 style 属性消费 tokens.css 的 `--grid-tianzige-*` / `--grid-fourline-*` 变量（SVG 表现属性不支持 var() 的规范解法）。
5. **测试义务**：新增/修改生成器须同步扩展 `dev/test-svg-core.js` / `dev/test-svg-geometry.js` / `dev/test-svg-calculation.js` / `dev/test-svg-make-ten.js` 断言与 `dev/verify-svg.js` 用例（已含语文/英语段），并保证 `node dev/verify-svg.js` 通过；可视化调试用 `dev/svg-test.html`。

---

## 三点七、语文插件开发规范（N/E 系列）

### 科目工厂与数据银行

| 项目 | 语文（cn） | 英语（en） |
|------|-----------|-----------|
| 工厂 | `PluginUtil.createChinesePlugin(cfg)` | `PluginUtil.createEnglishPlugin(cfg)` |
| 缺省批改 | 标准化比较（去空白/全角归一/尾部句读） | 拼写比较（大小写不敏感 + `\|` 多答案） |
| 网格类 | `cn-grid` / `cn-card` | `en-grid` / `en-card` |
| 难度消费 | opts.difficultyParams（vocabTier/sentenceLength…） | （wordLengthMax/grammarTier/sentencePattern…） |
| 数据银行 | PINYIN_BANK（拼音）/ HanziBank（汉字·含笔顺部首） | 待建 |
| deps 声明 | `['pinyin-bank.js']` 或 `['hanzi-bank.js']` | 按需 |

### 生成器编写规则（参照 chinese-hanzi.js）

1. **数据驱动**：从 Bank 结构化字段出题（如 strokeOrder 数组→笔顺排序），禁止硬编码题目文本。
2. **choice 题选项约束**：≥2 个、无重复、**必须包含 answer**（由 verify-language-banks 与单元测试双重把关）。
3. **对/错判断题**：options 必须经 `_PU.shuffle(['对','错'])` 打乱，防止首项恒为「对」的规律泄露。
4. **KP 标注**：每题携带 `knowledgePointId`（cn-g{grade}-n{module}-{slug}），用于知识库知识点关联。
5. **难度参数消费**：从 `opts.difficultyParams` 取科目映射参数控制干扰项数量/题干长度。

### 专项验证

```bash
node dev/verify-language-banks.js       # 10 项检查（ID 格式/词库引用/循环依赖/难度递进/状态合法）
node dev/test-language-generators.js    # 29 生成器 × ≥12 题 × 四断言
```

---

## 三点八、题目池机制（小池题型通用去重方案）

小池题型（连线/操作/判断/选择等固定模板题）必须接入 `PluginUtil.createPoolCache`，
避免各自为政的临时去重逻辑。

**用法**（完整示例见 `plugins/math-g6-judge.js`）：

```javascript
// ① 确定性枚举完整题目池（数字/情境参数化；唯一签名 = 题干 + 答案 + svg）
function poolCircle() { /* 返回完整题目数组：{ q, answer, options?, svg?, hint } */ }

// ② 创建公共池缓存：首次取题构建并洗牌，之后跨 generate 调用连续发牌，用尽自动重洗
var pools = {};
function poolOf(type) {
  if (!pools[type]) {
    pools[type] = _PU.createPoolCache('math-g6-judge:' + type, function () {
      return type === 'mix' ? mixPool() : POOL_BUILDERS[type]();
    });
  }
  return pools[type];
}

// ③ generate 中从牌堆取题
'circle': function () { return poolOf('circle').take(1)[0]; }

// ④ 挂到插件对象，供 dev/check-duplicates.js 读取池大小
plugin.poolCache = poolOf('mix');
```

**API**：`take(n)` 取 n 题（池内不重复；用尽自动重洗并在控制台提示「题目池有限/已用尽」）、
`size()` 池大小、`reset()` 清空缓存。

**扩容规范**（新插件预设足够大的题池）：

- 池大小 ≥ 5 轮 × 20 题 = **100 个唯一签名**（`check-duplicates` 默认请求量）。
  不足时脚本自动豁免并提示「题目池有限，无法完全避免重复」——豁免不是免死金牌，应持续扩池。
- 每个知识点 ≥5 个题干模板，从不同角度表述（正确 / 错误 / 条件缺失）。
- 含数字的题干做参数化变体（如「半径扩大 k 倍」k∈2..5、「占 N% 圆心角」N 取档位枚举）。
- 选择/连线类干扰项必须来自常见错误（计算错误、单位混淆、概念混淆），禁止随机数凑数。
- 验收：`node dev/check-duplicates.js` 中本插件重复率 ≤ 阈值（六年级 15%，小池目标 10%）。

## 四、提交前检查

**自动化（6 道门禁，任一失败即阻断提交）**：启用版本化钩子后，`git commit` 会自动跑
`npm test` = verify-setup → verify-knowledge-bank → regression-check（含 255 项边界用例
与分科目报告）→ test-difficulty → verify-svg → **check-lint**：

```bash
git config core.hooksPath scripts/githooks   # 本地一次性启用（零依赖，无需 Husky）
```

- `pre-commit.sh` 按四步执行（lint 置于首位快速失败）：lint-check → verify-setup →
  verify-knowledge-bank → regression-check。
- 手动执行同一套：`bash scripts/pre-commit.sh` 或 `npm test`。
- GitHub Actions（`.github/workflows/ci.yml`）在每次 push / PR 重复上述门禁，
  并附「题目重复率报告」（非阻断）。

**lint-check 规则速览**（详见 `dev/lint-check.js` 头注）：运行时直调 `Math.random()`、
内联样式硬编码颜色（SVG 表现属性与 MEMORY 记录的插画豁免清单除外）、math 插件缺
moduleId、知识点 ID 缺科目前缀——均报错阻断；新增公共样式请先入 components.css/tokens.css。

人工检查项：

- 在浏览器中打开 `dev/plugin-check.html`，加载你的插件文件，确保所有结构与接口测试通过。
- 运行 `node dev/coverage.js`，确认分科目覆盖基线正常（cn/en 有数据自动纳入报告）。
- 确保你的插件在至少两个主流浏览器（Chrome、Firefox）中正常工作。
- 确认没有违反「全局 DOM 禁止操作」「公共文件必须来自 shared/」两条硬性规则。
- 语文/英语数据改动后，额外运行 `node dev/verify-language-banks.js`（10 项专项检查：ID 格式、依赖完整性、题型映射、词库引用、汉字/拼音库完整性、关系引用、循环依赖、难度递进、状态合法）。
- 新手/AI 助手建议先读 `docs/AI_DEV_GUIDE.md`（架构摘要、修改禁区、标准流程）。
