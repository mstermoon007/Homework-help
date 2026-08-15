# 插件接口契约（Plugin Contract）

> 本文件描述**当前真实实现**的插件接口，所有插件必须严格遵循。
>
> - **唯一强制点**：运行时加载器 `practice.html` 的 `loadPlugin` 在脚本 `onload` 后校验插件对象必须同时含 `generate` / `render` / `check`，否则报「插件接口不兼容」并拒绝加载。**不存在 `PluginRegistry` 注册类**，也**没有 `version` 字段**（旧文档中的 `PluginRegistry.register/verify`、`create`/`generators` 元数据均已废弃）。
> - **注册索引**：`plugins/registry.js`（`PLUGIN_REGISTRY` 静态数组）。
> - **类型定义**：`shared/plugin-types.js`（`@typedef ExercisePlugin / ExerciseSet / Question / CheckResult`）。
> - **浏览器自检**：`dev/plugin-check.html`（逐插件校验结构与接口）。
> - **骨架模板**：`plugins/_template.js`。
> - **推荐写法**：`shared/common.js` 的 `PluginUtil.createPlugin`（见第七节），自动生成三大接口。

---

## 一、插件对象（插件文件定义）

插件文件（如 `plugins/math-oral.js`）在加载时把自身对象挂到全局 `window.__currentPlugin`（Node 自检环境则 `module.exports`）。该对象由 **元数据 + 三大接口** 组成。

### 必填字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 全局唯一标识，建议 `math-oral`、`pinyin-to-char` 风格 |
| `name` | string | 面向学生 / 家长的中文显示名 |
| `subject` | `'math' \| 'chinese' \| 'english'` | 科目 |
| `grades` | `number[]` | 适用年级（1–6），用于过滤与年级提示 |
| `generate` | function | 生成题目集，见第二节 |
| `render` | function | 渲染题目集 HTML，见第二节 |
| `check` | function | 批改，见第二节 |

> **重复声明约定**：`id` / `name` / `subject` / `grades` / `category` 需同时在**插件对象**和 `registry.js` 条目中各写一份。原因：综合插件（`math-comprehensive`）运行时直接读取子插件对象的 `category`、`grades` 做配比与过滤，而 `registry.js` 另作加载索引。两者必须保持一致。

### 模块归属字段（数学插件必填）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `moduleId` | string | 本插件归属的题型模块 ID，取值见 `shared/module-catalog.js`(`MODULE_CATALOG`)：基础模块 `M0`–`M12`（如 `math-make-ten` → `'M0'`）、竞赛模块 `C1`–`C9`。由 `dev/verify-setup.js` 校验「注册插件均有合法 moduleId 且存在于模块目录」。**占位插件豁免**该约束（仅需 `isPlaceholder` 标记） |

### 可选字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `category` | string | 数学领域：`'number'` / `'geometry'` / `'statistics'` / `'mixed'`（跨领域综合）；非数学插件省略或写 `null`。用于 `math-types.html` 排序 / 图标、`math-comprehensive` 按领域配比 |
| `printConfig` | `{ pageType: string, title?: string }` | 打印配置，见 CONTRIBUTING.md「打印约定」。`pageType` 缺失时容器回退 `'math'` |
| `settings` | `array` | 题型子类别筛选 UI：`[{ key, label?, options: [{label, value}], default? }]`，`practice.html` 据此渲染题型切换 chip（综合插件用它切换组卷方式） |
| `deps` | — | **不写在插件对象上**，而在 `registry.js` 条目中声明，见第三节 |
| `isPlaceholder` | boolean | 占位标记：`generate` 返回空题目集、`render` 返回「题目开发中」提示。综合练习按此过滤，占位插件不参与抽题；覆盖统计排除占位插件（占位不算已实现） |

---

## 二、三大接口

### `generate(options) → ExerciseSet`

- **入参 `options`**：`{ grade: number, count: number, type?: string, difficulty?: number }`
  - `type` 对应 `settings` 中的某个选项值（题型子类别）
  - `difficulty`（1–10）仅数学插件使用，由 `practice.html` 传入
- **返回**：`{ questions: Question[], meta?: object }`
- **可同步也可异步**：可直接返回 `ExerciseSet`，也可返回 `Promise<ExerciseSet>`（异步插件，如 `math-comprehensive` 需先动态加载子插件再生成；`practice.html` 已处理 Promise）。
- 运行时要求 `questions` 为数组；缺失则 `applyExerciseSet` 抛错。

### `render(exerciseSet) → string`

- **入参**：`ExerciseSet`
- **返回**：题目区域 HTML 字符串（不含外层 page 壳，不含 `<html>` / `<body>`）
- 容器负责把返回值注入 `#problemsArea`，并按 A4 竖版宽度做列数自适应、绑定答案收集等。
- 插件未提供 `render` 时，容器用通用降级渲染 `renderGeneric`。
- 推荐返回包裹在 `.questions-grid` / `.q-grid` 容器内的题目卡片。

### `check(exerciseSet, userAnswers) → CheckResult`

- **入参**：
  - `exerciseSet`：`ExerciseSet`
  - `userAnswers`：`object`，键为题目序号字符串（多选 / 多输入题为 `"idx:field"`）
- **返回**：`{ score: number, total: number, correct: number, message: string, results: boolean[], correctAnswers: string[] }`（综合插件额外返回 `domainBreakdown`）
- 运行时校验：缺 `score` 或 `results` 非数组 → 视为不兼容。
- **单题判定优先级**：优先调用 `Question.check(userAnswers, idx)`；缺失则用 `Number(userAnswers[idx]) === q.answer` 兜底。

---

## 三、注册表条目（`plugins/registry.js`）

每个插件在 `PLUGIN_REGISTRY` 中追加一条记录：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 同插件对象 `id` |
| `file` | 是 | 插件脚本路径（相对站点根，如 `plugins/math-oral.js`） |
| `name` | 是 | 同插件对象 `name` |
| `subject` | 是 | `'math' \| 'chinese' \| 'english'` |
| `category` | 否 | 同插件对象 `category` |
| `grades` | 是 | 同插件对象 `grades` |
| `deps` | 否 | 前置依赖脚本数组（如 `['pinyin-bank.js']`），加载器在加载插件前**按顺序**加载 |
| `moduleIds` | 否 | 占位插件声明的模块 ID 数组（竞赛占位如 `['C1',…,'C9']`，四/五年级占位各一条如 `['M1']`），供 `math-types.html` 展开为多个卡片；配合 `isPlaceholder` 使用 |
| `isPlaceholder` | 否 | `true` 表示该插件无实际题目，综合练习与抽题会过滤 |

> `deps` 用于把插件与公共数据（拼音词库等）解耦：插件文件内不硬编码大体积数据，改用 `deps` 由加载器预加载，插件内再引用全局数据即可。

---

## 四、Question 对象规范

`generate()` 产出的每道题目都必须符合以下结构，使综合插件（`math-comprehensive`）与容器能以统一方式渲染 / 判定任意题型（调用 `q.render(idx)` 渲染、`q.check(userAnswers, idx)` 判定、`q.answer` 取标准答案）。

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `answer` | 是 | 标准答案，类型 `string \| number \| Array<string\|number>`，或带 `q`/`r` 的有余数对象 `{q, r}`（如 `{q:9, r:2}` 表示「9……余 2」），非空 |
| `render` | 是 | `function(idx) → string`，渲染单题 HTML。**`this` 绑定到当前题目对象**（可访问 `this.a`、`this.b` 等题内数据）；容器负责拼装外层网格与列数 |
| `check` | 否 | `function(userAnswers, idx) → boolean`，单题自定义判定；缺失时按 `answer` 兜底；`this` 同样绑定到题目对象 |
| `type` | 否 | 题型标识（如 `'oral'` / `'make-ten'` / `'shapes'` / `'word'`） |
| `question` / `text` | 否 | 题干文本（展示用，降级渲染读取） |
| `unit` / `hint` / `options` / `meta` | 否 | 单位、提示、选择题选项、其他元数据 |

- `answer` 必须为可比较的标准值；`check` 可自定义容错比较（如拼音声调、凑十法多输入、有余数除法 `{q, r}`）。
- 复合 / 多空答案应序列化为 `answer` 可比较形式，比较逻辑写在 `check` 中；打印展示由 `print.js` 的 `formatAnswer` 统一处理（支持数字 / 字符串 / 数组 / 有余数对象）。
- 完整 JSDoc 见 `shared/plugin-types.js` 的 `@typedef Question`。

---

## 五、综合插件（Comprehensive Plugin）

综合插件把**同科目多个子插件**混合成一份完整试卷，是理解「标准接口复用」的关键范例。现有：`math-comprehensive`（数学，`category: 'mixed'`，运行时动态加载子插件）、`chinese-comprehensive`（语文，`deps: ['pinyin-bank.js']`）。

### 工作原理

1. **子插件发现**：扫描 `PLUGIN_REGISTRY`，筛选本学科（如 `id` 以 `math-` 开头且非自身）的插件条目；或优先使用容器 `practice.html` 预加载到 `window.__mathSubPlugins` 的实例（避免重复加载）。
2. **异步加载**：`generate()` 返回 `Promise`。子插件脚本经 `document.createElement('script')` + `document.head.appendChild` 动态注入（**5 秒超时保护**），Node 自检环境走 `require`。加载后从 `window.__currentPlugin` 取出实例并恢复综合插件自身。
3. **年级过滤**：仅保留 `grades` 含当前年级的子插件。
4. **题量分配**（四种模式，经 `settings` 的 `type` 切换）：
   - `kb`（默认）：按 `shared/knowledge-bank.js` 中知识点 `weight` 加权分配，核心题型（如乘法）题更多；
   - `weighted`：按领域权重 数与代数 60% / 图形几何 30% / 统计推理 10%（保证三领域均出现）；
   - `average`：每插件均分；
   - `domain`：按领域均分。
   分配用「最大余数法」保证整数且无遗漏，并尽量保证每个出现的领域至少 1 题。
5. **生成与混合**：逐个子插件调用 `p.generate({ grade, count, type: 'mix', difficulty })`，把题目标记 `q.__src = p`（仅元信息，用于渲染徽标与领域统计），全部收集后 `PluginUtil.shuffle` 打乱顺序。
6. **渲染 / 判定一律走标准 Question 接口**：
   - `render`：对每题调用 `q.render(i)`，并附来源徽标（`领域 · 题型名`）；
   - `check`：调用 `q.check(userAnswers, i)` 逐题判定，累加分领域正确率（`domainBreakdown`）。

### 编写要点（给想新增综合插件的开发者）

- **永远复用子插件的 `generate/render/check`**，不要自己重写题目逻辑——综合插件只是「调度器」。
- 子插件对象必须带 `category` / `grades`（综合插件靠它们配比与过滤）。
- 异步加载用约定的动态 `<script>` 注入（**唯一允许触碰 DOM 的例外**，见 CONTRIBUTING.md「全局 DOM 禁止操作」），并设置 5 秒超时。
- 复合 / 多空答案交给各题自身的 `check` 处理，综合层只负责汇总与统计。
- 交互题（如图形选项按钮）的 `__choose` 等方法可原样挂在插件对象上，由容器调用。

---

## 五点五、模块目录与竞赛占位（全年级题型模块化）

### 模块目录（唯一权威数据源）

`shared/module-catalog.js` 导出 `MODULE_CATALOG`（含 `BASIC_MODULES` 与 `COMPETITION_MODULES`，`MODULE_CATALOG = BASIC.concat(COMPETITION)`），每项 `{ id, name, grades, category, level }`：

- 基础模块 `M0`–`M12`（`level: 'basic'`）：`M0` 巧算专项（仅一年级）、`M1` 口算、`M2` 竖式、`M3` 脱式、`M4` 填空、`M5` 连线、`M6` 操作、`M7` 看图列式、`M8` 解决问题、`M9` 分类整理、`M10` 推理广角、`M11` 判断、`M12` 选择。
- 竞赛模块 `C1`–`C9`（`level: 'competition'`，高年级 4–6）：数字谜数阵、数论、组合计数、几何模型、行程、工程浓度、分数巧算、最值与逻辑推理、竞赛综合。

用途：题型选择页（`math-types.html`）按模块顺序渲染卡片、主标题显示模块名；知识库按「年级 → 模块 → 知识点」挂接 `moduleId`；综合练习按知识点 `weight` 抽题。

### 竞赛占位（C1–C9 未实现阶段）

竞赛模块暂未实现具体题目生成逻辑，用**单一占位插件**兜底，避免题型选择页空白或「插件不存在」：

- 插件文件：`plugins/math-competition-placeholder.js`（`id: 'math-competition-placeholder'`，`isPlaceholder: true`，`competitionModuleIds: ['C1'…'C9']`，`grades: [4,5,6]`，`category: 'competition'`）。
- `generate()` 返回**空题目集** `{ questions: [], meta: { placeholder: true } }`；`render()` 返回「🚧 题目开发中，敬请期待」提示（支持 URL `module=Cx` 显示对应模块名）；`check()` 返回空结果。
- `registry.js` 条目以 `moduleIds: ['C1',…,'C9']` + `isPlaceholder: true` 声明，`math-types.html` 据此把占位插件**展开为 9 张竞赛卡片**（灰色 + 「即将上线」角标，点击进入占位提示页）。
- **综合练习过滤**：`math-comprehensive.js` 通过 `isPlaceholderPlugin(p)`（占位标记 + `category === 'competition'` 能力兜底）在加载与抽题阶段剔除占位插件，且对产出空题的插件跳过、整体空集抛错——确保综合练习只有已实现题型、无空白题目。
- `dev/verify-setup.js` 自动校验：竞赛模块 C1–C9 齐全、占位插件已注册且带占位标记、占位插件豁免 `moduleId` 强校验。
- **新增真实竞赛插件**：实现标准接口（含合法 `moduleId`，如 `'C1'`）、在 `registry.js` 注册并去掉占位标记即可自动生效。

### 四、五年级占位（M1–M12 知识库已建、题型待实现）

四年级（70 个）与五年级（80 个）知识点已按全年级题型模块目录完整写入知识库（各 M1–M12 全覆盖，含 weight/type），但各模块题目生成逻辑尚未实现，采用**模块级占位**：

- 知识库：`shared/knowledge-bank.js` 的 `grade: 4 / 5` 条目，知识点 `pluginId` 为预留 id——四年级 `math-g4-oral/vertical/mixed/fill/match/draw/picture/word/stats/reason/judge/choice`、五年级 `math-g5-*` 同名序列，各对应一个模块。
- 占位文件：`plugins/math-g4-placeholder.js`、`plugins/math-g5-placeholder.js`（统一占位实现，`isPlaceholder: true`，与竞赛占位同构，支持 URL `module=Mx` 显示模块名）。
- `registry.js`：各 12 条占位条目，带 `runtimeId`（如 `'math-g5-placeholder'`）+ `moduleIds: ['Mx']` + `isPlaceholder: true`，`file` 均指向各自占位文件；`math-types.html` 依 registry 条目把占位展开为基础模块卡片（M 系列在前、竞赛 C 系列在后）。
- `dev/verify-setup.js` 校验：四/五年级知识库覆盖 M1–M12 全部模块且无空模块、知识点 pluginId 均已注册。（`dev/verify-knowledge-bank.js --g4 --g5`）
- 覆盖统计（`dev/coverage.js`、`PluginUtil.reportCoverage`）**排除占位插件**——四/五年级显示 0/70、0/80（待开发），并给出按插件归组的开发清单。
- **四/五年级不建议参与综合练习**：`math-comprehensive` 的 grades 仍为 `[1,2,3]`，同时占位插件被 `isPlaceholderPlugin` 过滤，双重保证不抽取空题。
- **新增真实四/五年级插件**：实现标准接口 + 合法 `moduleId`（如 `'M2'`）→ 在 `registry.js` 把对应占位条目替换为真实实现（去掉 `isPlaceholder`）→ `node dev/coverage.js` 确认该模块知识点转覆盖。

---

## 六、强制与验证时机

1. **运行时硬闸门（唯一真实强制点）**：`practice.html` 的 `loadPlugin` 在脚本 `onload` 后校验 `p.generate && p.render && p.check`，不全即 `reject('插件接口不兼容（需要 generate/render/check）')`。
2. **浏览器自检**：打开 `dev/plugin-check.html`，选择插件文件，确认结构与接口测试全部通过。
3. **注册完整性**：`dev/verify-setup.js` 校验 `registry.js` 条目与骨架文件（`shared/`、`plugins/`、`plugin-types.js`）是否齐备。

---

## 七、最小示例

```js
// plugins/math-oral.js
const plugin = {
  id: 'math-oral',
  name: '口算练习',
  subject: 'math',
  grades: [1, 2, 3],
  category: 'number',

  generate(options = {}) {
    const count = options.count || 10;
    const questions = [];
    for (let i = 0; i < count; i++) {
      const a = PluginUtil.randInt(1, 10);
      const b = PluginUtil.randInt(1, 10);
      questions.push({
        type: 'math-oral',
        a, b,
        answer: a + b,
        render(idx) {
          return `<div class="question-card" data-index="${idx}">
            <span class="q-num">${idx + 1}.</span>
            <span>${this.a} + ${this.b} = </span>
            <input type="number" class="answer-input" data-index="${idx}">
          </div>`;
        },
        check(userAnswers, idx) {
          return Number(userAnswers[idx]) === this.a + this.b;
        }
      });
    }
    return { questions, meta: { count } };
  },

  render(set) {
    let html = '<div class="questions-grid">';
    set.questions.forEach((q, i) => { html += q.render(i); });
    html += '</div>';
    return html;
  },

  check(set, userAnswers) {
    let correct = 0;
    const results = set.questions.map((q, i) => {
      const ok = q.check ? q.check(userAnswers, i) : (Number(userAnswers[i]) === q.answer);
      if (ok) correct++;
      return ok;
    });
    return {
      score: Math.round((correct / set.questions.length) * 100),
      total: set.questions.length,
      correct,
      message: correct === set.questions.length ? '太棒了！全对！' : '继续加油！',
      results,
      correctAnswers: set.questions.map(q => String(q.answer))
    };
  }
};

// 浏览器环境：挂载到全局；Node 自检环境：导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = plugin;
} else {
  window.__currentPlugin = plugin;
}
```

```js
// plugins/registry.js（追加一条）
{ id: 'math-oral', file: 'plugins/math-oral.js', name: '口算练习',
  subject: 'math', category: 'number', grades: [1, 2, 3] }
```

---

## 八、插件工厂 createPlugin（推荐写法）

`shared/common.js` 的 `PluginUtil.createPlugin(config)` 是推荐的插件编写方式：它自动生成 `generate / render / check`，开发者只需提供 `generateQuestions(opts)`。契约（强制点、Question 规范、registry 条目）完全不变，只是把样板收进工厂。

### config 字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` / `name` / `subject` / `grades` | 是 | 同「插件对象」必填字段 |
| `generateQuestions` | 是 | `function(opts) → Question[]`；工厂据此生成 `generate` |
| `knowledgePoints` | 否 | `string[]`：声明本插件覆盖的知识点（id 或 name），开发期校验/提示用 |
| `category` / `description` / `printConfig` / `settings` / `meta` | 否 | 同「插件对象」对应字段 |
| `columns` | 否 | `render` 网格列数（默认 3） |
| `render` / `check` | 否 | 自定义整组渲染 / 批改，覆盖工厂默认实现 |
| 其他字段 | 否 | 交互方法（如 `__choose`）等原样挂到插件对象 |

### 工厂内置的开发期能力

1. **参数合理性提醒**：`generate` 时对非正整数 `count` 等给出 `console.warn`。
2. **知识点声明校验**：若 `knowledgePoints` 含未在 `shared/knowledge-bank.js` 登记的项，提示缺失清单。
3. **覆盖提示**：浏览器加载插件后（每页一次）或终端 `node dev/coverage.js`，输出「当前年级已覆盖知识点 X/Y，建议下一个开发 Z」；数据来自 `registry.js` 实际插件集合与 `knowledge-bank.js` 基线，方法为 `PluginUtil.reportCoverage(subject, grade)`。

### 最小示例（工厂版，等价于第七节手写版）

```js
const plugin = PluginUtil.createPlugin({
  id: 'math-patterns',
  name: '找规律',
  grades: [1],
  subject: 'math',
  category: 'number',
  knowledgePoints: ['patterns'],
  generateQuestions(options = {}) {
    const diff = PluginUtil.diffLevel(options.difficulty);
    // ... 生成 questions，每题含 answer + render(idx) + 可选 check
    return questions;
  }
});
global.__currentPlugin = plugin;
if (typeof module !== 'undefined' && module.exports) module.exports = plugin;
```
