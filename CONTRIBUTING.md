# 贡献指南

## 一、公共文件来源（重要）

**`shared/` 是本仓库唯一公共文件来源（single source of truth）。**

- 所有页面（`index.html`、`*-types.html`、`practice.html`）与所有插件，必须引用 `shared/` 下的资源：
  `shared/common.js`、`shared/common.css`、`shared/print.js`、`shared/plugin-types.js`、`shared/knowledge-bank.js` 等。
- 根目录**不再存在**公共版 `common.js` / `common.css` / `print.js`（已于架构统一时删除并迁移到 `shared/`）。**禁止**新建根目录级别的公共脚本或样式文件。
- 新增跨插件复用的工具 / 常量 / 类型：一律放进 `shared/`（通用随机与标准化工具通过 `shared/common.js` 的 `PluginUtil` 暴露，类型定义在 `shared/plugin-types.js`）。
- **禁止**插件之间互相 `import` / `require` 对方内部实现；公共能力只能通过 `shared/` 共享。
- **清理保护（防误删）**：`dev/cleanup-scan.js` 的 `keepDirs` / `keepFiles` 白名单已保护 `shared/`、`docs/`、`plugins/`、`agents/`、`dev/`、`archive/` 目录与根级文档（`*.html` / `*.md` / `banner.jpg` / `pinyin-bank.js` 等），不会误删有效代码与文档。新增公共能力务必放进 `shared/`，否则可能被清理工具误判为可删除。

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
  knowledgePoints: ['patterns'],   // 声明本插件覆盖的知识点（开发期自动校验/提示）
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

- **插件声明**：在插件对象上提供 `printConfig: { pageType: string, title?: string }`。
  - `pageType`：选择打印模板分支（A4 边距、列数等），取值见 `shared/print.js` 的 `PRINT_ROUTES`：`math` / `pinyin` / `word` / `makeTen` / `pinyinToChar` / `comprehensive` / `numberSense` / `measurement` / `geometry` / `shapes` / `unitConvert` / `alphabet`。**缺失时容器回退 `'math'`**。
  - `title`：可选；容器实际打印标题由 `plugin.name + 年级` 生成，此字段一般留空。
- **打印触发**：容器（`practice.html` 的 `printFile()`）读取当前插件的 `printConfig`，再调用 `Print.open(area, title, { pageType, columns })`——`pageType` 取自 `printConfig.pageType`（回退 `'math'`），`columns` 由容器按题目长度自适应（A4 竖版宽度内排版）。`Print.open` 会克隆 `#problemsArea` 实时 DOM、复制原页 `<link>`/`<style>`、套用 A4 竖版、移除按钮 / 控制面板等交互元素，保证打印排版与屏幕预览一致。
- **插件禁止自行打印**：插件只产出数据 + HTML，不得直接调用 `window.print()` 或操作打印窗口。所有打印逻辑集中在 `shared/print.js` + 容器。
- **复合答案展示**：有余数（`q……余 r`）、多空数组等标准答案的打印展示由 `print.js` 的 `formatAnswer` 统一处理，插件无需关心。

---

## 四、提交前检查

- 在浏览器中打开 `dev/plugin-check.html`，加载你的插件文件，确保所有结构与接口测试通过。
- 运行 `node dev/verify-setup.js`，确认注册表与骨架文件齐备。
- 运行 `node dev/coverage.js`，确认知识点覆盖基线正常（数学 1–3 年级均有统计）。
- 确保你的插件在至少两个主流浏览器（Chrome、Firefox）中正常工作。
- 确认没有违反「全局 DOM 禁止操作」「公共文件必须来自 shared/」两条硬性规则。
