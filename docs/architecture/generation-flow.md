# 题目生成调用链（M0 基线）

> M0-01 产出。描述从 UI 操作到题目的真实调用链，覆盖：
> **UI → options → plugin.generate → difficulty → generateQuestions → normalize → render**，
> 以及后续的 check / print。

## 1. 生成阶段

### 1.1 UI 组装 options（`practice.html:560 generate()`）

```
practice.html generate()
  ├─ options = { grade, count }                       // 年级、题量
  ├─ options.type        = state.type                 // 子题型（来自设置面板）
  ├─ options.subtype     = state.subtype
  ├─ options.difficulty  = state.difficulty           // 仅数学且无自带分档时
  ├─ options.adaptiveDelta = StorageManager.getDifficulty(id).currentDelta  // 跨会话 EMA
  └─ state.plugin.generate(options)                   // 进入插件
```
> UI **只组装参数**，不决定题目结构（结构决策在插件 `generateQuestions` 内）。

### 1.2 插件生成（`shared/render.js` → 插件 `generateQuestions`）

数学插件经 `_wrapDifficultyParams`（`render.js:254`）包装：
```
plugin.generate(opts)
  ├─ 若 opts.knowledgePointMeta 存在 → 调 App.DifficultyStatic.paramsForKnowledgePoint（休眠分支）
  ├─ 否则（线上默认）→ App.Difficulty.paramsFor(subject, level) 注入 opts.difficultyParams
  └─ defaultGenerate(opts)  （render.js:176）
        ├─ questions = config.generateQuestions(opts)   // 插件自行实现
        │     └─ 内部用 PluginUtil.randInt（crypto）生成；可置 q.svg / q.type /
        │        q.knowledgePointId / q.answer / q.unit / q.hint
        ├─ 规范化（render.js:190）：
        │     ├─ 缺 render → 补 renderCard(q,i)
        │     ├─ 缺 check  → 补 defaultQCheck（数学插件补 _mathQCheck 数值比较）
        │     └─ 校验 config.knowledgePoints 是否在 KnowledgeBank 登记（仅警告）
        └─ 返回 { questions, meta }
```
> `difficulty` 在此阶段仅产出 `opts.difficultyParams`（数值缩放/结构复杂度），
> 由 `generateQuestions` 按题型消费；难度引擎本身不生成题目。

### 1.3 综合练习（异步聚合，`plugins/math-comprehensive.js`）

`generate()` 返回 **Promise**：`ensureSubPlugins()` 经 `App.PluginLoader` 加载全部数学子插件 →
`kbEntryPlan()` 按 `KnowledgeBank.getEntries` 的知识点权重（最大余数法）分配题量、按 `type` 指定子题型
→ 逐插件 `p.generate({grade,count,type})` → 每题打 `knowledgePointId` 溯源。

## 2. 渲染阶段

```
practice.html applyExerciseSet(set)   (practice.html:619)
  └─ render(set)  (practice.html:663)
        └─ plugin.render(set)           // defaultRender 遍历 q.render(i) 或 renderCard
              → HTML `.questions-grid` 网格
        └─ PluginUtil.layout.fitColumns(container, set)   // 按题长自适应列数/跨列
```
卡片结构见 `renderCard`（`render.js:11`）：`.question-card[data-index]` 含 `.q-text`、`.qa-row`
（列式/答案输入框）、`.opt`（选择题）、`.scene-box`（SVG）、`.q-hint`、`.feedback`。

## 3. 批改阶段

```
practice.html check()  (practice.html:792)
  ├─ answers = collectAnswers()                 // 从 input[data-index] / input[data-idx][data-field] 收集
  └─ result = plugin.check(set, answers)        // 默认 computeResult（注入 defaultQCheck/_mathQCheck）
        → { score, total, correct, message, results[], correctAnswers[] }
  ├─ markQuestions(result)   // 加 .correct/.wrong，错题写正确答案
  ├─ showResult(result)      // 分数/正确率/用时
  └─ StorageManager.addWrong(...) + updateDifficulty(...)   // 错题本 + 难度 EMA
```

## 4. 打印阶段

```
practice.html printBtn → Print.open(container, title) / Print.preview
  └─ buildPrintHtml：克隆题目 DOM、清空输入框、A4 排版、与预览同源产物
```
> 打印前清空输入（不泄露答案）；答案仅存 JS 闭包，正常不渲染。

## 5. 关键不变量（M0 验证守护）

- `practice.html` 不设置 `knowledgePointMeta` ⇒ Static 难度不激活，Legacy 默认（见 `current-architecture.md §4`）。
- 题目随机性全部经 `PluginUtil.randInt`（crypto），`Math.random` 仅在 `core.js`/`common.js` 豁免。
- 插件 `generate` 返回 `{ questions: Question[] }`；每题含 `answer` + `render`（或插件级 `render`）。
