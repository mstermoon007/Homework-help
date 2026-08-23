# Homework Help 项目全面代码审查报告

> 审查日期：2026-08-16  
> 审查范围：全部源码（5 HTML + 8 shared 活跃文件 + 65 插件 JS + dev 工具链 + sw.js + 文档）  
> 审查模式：只读审查，未修改任何项目文件

---

## 一、安全问题（P0/P1）

### 1.1 [P0] XSS 风险：`showNotice` 使用 innerHTML 拼接未转义内容

**文件**：`practice.html` 第 258 行

```javascript
div.innerHTML = '<div class="big">' + title + '</div>' + (sub ? '<div>' + sub + '</div>' : '');
```

`title` 和 `sub` 参数来自 URL 参数（如 `pluginId`）和错误消息，若用户构造恶意 URL（如 `?plugin=<img src=x onerror=alert(1)>`），将直接执行注入代码。

**同样问题存在于**：
- 第 530 行：`showNotice('题型不存在', 'URL 中的 plugin 参数「' + (pluginId || '(空)') + '」未在...')` — `pluginId` 来自 URL 未转义
- `markQuestions` 第 734 行：`fb.textContent = tip` — 这里用的是 textContent，安全；但第 735 行 `fb.style.color` 紧随其后
- `renderGeneric` 第 671 行：`(q.question || q.text || q.q || '')` 直接拼入 innerHTML — 若插件生成的题目文本含 HTML 字符，会破坏渲染

**修正方案**：
```javascript
function esc(s) {
  var d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}
// showNotice 中改为：
div.innerHTML = '<div class="big">' + esc(title) + '</div>' + (sub ? '<div>' + esc(sub) + '</div>' : '');
```

### 1.2 [P1] 打印模块 `document.write` 写入未消毒内容

**文件**：`shared/print.js` 第 187 行

```javascript
pw.document.write(printHtml);
```

`printHtml` 包含克隆的 DOM outerHTML + 原页面所有 `<style>` 标签内容。虽然内容来自当前页面自身（风险较低），但若插件 `render()` 输出含恶意脚本（如某个插件被篡改），打印窗口将执行它。

**修正方案**：在打印 HTML 中注入 CSP meta 标签：
```javascript
'<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'">' +
```

### 1.3 [P1] Service Worker cache-first 策略缺乏版本校验

**文件**：`sw.js` 第 90-106 行

`cache-first` 策略意味着更新代码后，用户可能长期使用旧缓存。虽然 `activate` 时清理旧版本，但用户不会主动触发 `activate`——需等到下次导航且 SW 完成更新。

**修正方案**：对导航请求（HTML）采用 `network-first`，对静态资源（JS/CSS/图片）保持 `cache-first`：
```javascript
if (req.mode === 'navigate') {
  e.respondWith(
    fetch(req).then(function(res) {
      // 回填缓存
      var copy = res.clone();
      caches.open(CACHE).then(function(c) { c.put(req, copy); });
      return res;
    }).catch(function() {
      return caches.match(req).then(function(hit) { return hit || caches.match('index.html'); });
    })
  );
  return;
}
```

---

## 二、架构设计（P1/P2）

### 2.1 [P1] `preloadMathSubPlugins` 串行加载，应并行化

**文件**：`practice.html` 第 286-303 行

```javascript
records.forEach(function (rec) {
  chain = chain.then(function () {
    return App.PluginLoader.loadPlugin(rec).then(...)
  });
});
```

当前用 `chain = chain.then(...)` 串行加载所有数学子插件（~24 个），每个需一次网络请求 + 脚本执行。虽然有 Service Worker 缓存，但首次加载仍串行等待。

**修正方案**：`Promise.all` 并行加载：
```javascript
return Promise.all(records.map(function(rec) {
  return App.PluginLoader.loadPlugin(rec).then(function(p) {
    if (p && p.grades && p.grades.indexOf(grade) !== -1) plugins.push(p);
  }).catch(function() { /* 单个失败不阻塞 */ });
})).then(function() {
  window.__mathSubPlugins = plugins;
  return plugins;
});
```

> 注：`PluginLoader.loadScript` 内部用 `s.async = false` 保证执行顺序，但 `Promise.all` 不保证 `__currentPlugin` 抓取的竞态安全。需确认 `pluginCache` 是否已解决此问题——经查代码，`pluginCache[record.id]` 有缓存，但首次加载时多脚本并行仍可能产生竞态。建议给 `loadScript` 增加按 URL 的 Promise 复用（当前 `scriptCache[src]` 已有），配合 `async=false` 可安全并行。

### 2.2 [P2] `chinese-types.html` 与 `english-types.html` 近乎完全重复

**文件**：`chinese-types.html`（97 行）、`english-types.html`（93 行）

两个文件仅 `SUBJECT` 变量、图标映射、颜色不同，其余逻辑完全一致。

**修正方案**：抽取为 `subject-types.html` 模板，通过 URL 参数 `?subject=chinese` 区分，或提取共享 JS 模块 `shared/subject-types.js`。当前架构已有 `math-types.html` 的动态渲染逻辑可复用。

### 2.3 [P2] `math-comprehensive.js` 的 `MATH_SUB_IDS` 硬编码兜底清单

**文件**：`plugins/math-comprehensive.js` 第 28-39 行

```javascript
var MATH_SUB_IDS = [
  'math-oral', 'math-word-problems', ... // 38 个 ID 硬编码
];
```

这个兜底清单在 registry 不可用时使用，但每次新增插件都需手动同步。当前 registry 可用时不走此路径，但维护两份数据有漂移风险。

**修正方案**：删除兜底清单，registry 不可用时直接 `reject` 并给出明确错误：
```javascript
if (!mathRecs.length) {
  return Promise.reject(new Error('PLUGIN_REGISTRY 不可用，无法加载综合练习子插件'));
}
```

### 2.4 [P2] `renderCard` 双样式系统（内联 + 类化）增加复杂度

**文件**：`shared/common.js` 第 160-224 行

`CARD_INLINE` 对象维护了一套完整的内联样式，与 `shared/components.css` 的类化样式重复（原 common.css 已拆分为 5 个分层文件）。`opts.inline === true` 时走内联，否则走 CSS 类。文档注释说"迁移稳定后逐步移除内联回退"。

**修正方案**：确认所有插件都已使用 `shared/ 分层 CSS`（原 common.css 已拆分为 tokens/base/components/toolbar/pages 五个文件，当前统一引用），移除 `CARD_INLINE` 和 `st()` 函数，简化 `renderCard`。

---

## 三、代码质量（P2/P3）

### 3.1 [P2] `registry.js` 格式不一致

**文件**：`plugins/registry.js` 第 48-49 行

```javascript
{ id: 'math-g4-judge', ... },  // 缺少前导空格
   { id: 'math-g4-choice', ... },  // 多了前导空格
```

g4 条目的缩进不统一，g5/g6 也有类似问题。虽然不影响运行，但影响可读性。

**修正方案**：统一使用 2 空格缩进，对齐各条目。

### 3.2 [P2] ES5/ES6 混用

**现象**：
- `registry.js` 用 `const`，`practice.html` 用 `var`
- `_template.js` 用 `const plugin = _PU.createPlugin(...)`，但 `math-oral.js` 用 `var`
- `shared/common.js` 全部 `var`，`math-comprehensive.js` 部分 `let`

**修正方案**：统一使用 ES5（`var`）或统一升级到 ES6（`const/let`）。考虑到项目要求纯前端兼容老设备，建议统一 ES5 或在构建时用 Babel 降级。

### 3.3 [P3] `practice.html` 内联 `<style>` 块中有嵌套 `<style>`

**文件**：`practice.html` 第 167 行

```html
<style>#customCount::placeholder, #difficultyInput::placeholder { ... }</style>
```

这个 `<style>` 标签嵌套在 `#countGroup` 的 `<div>` 内部，虽然浏览器能解析，但不符合规范。

**修正方案**：移到 `practice.html` 的 `<head>` `<style>` 块中。

### 3.4 [P3] `updateCountTip` 性能开销大

**文件**：`practice.html` 第 863-923 行

每次渲染后都执行：克隆当前所有卡片 → 循环追加到隐藏容器 → 逐个 `getBoundingClientRect()` 测量 → 计算铺满 A4 的题数。对于 50 题的练习，涉及大量 DOM 操作和布局计算。

**修正方案**：
1. 用 `requestAnimationFrame` 延迟到空闲时执行
2. 缓存结果，仅在题型/列数变化时重新计算
3. 或用数学公式估算（单卡平均高度 × 列数），避免 DOM 测量

### 3.5 [P3] `math-oral.js` 的 `MathOralAgent` 仍保留旧页面兼容导出

**文件**：`plugins/math-oral.js` 第 593 行

```javascript
global.MathOralAgent = MathOralAgent;  // 兼容旧页面 math-practice.html
```

项目记忆显示根目录 `math-practice.html` 已不存在（4 HTML 架构），此兼容导出已无用。

**修正方案**：移除 `global.MathOralAgent` 导出，简化插件文件。

---

## 四、用户体验 & 可访问性（P2/P3）

### 4.1 [P2] Chip 按钮缺乏 ARIA 标签

**文件**：`practice.html`、`shared/toolbar.css`

题型/题量 chip 使用 `<button class="chip">` 但无 `role="radio"` / `aria-checked` 语义。屏幕阅读器无法识别这是一组单选控件。

**修正方案**：包裹在 `<div role="radiogroup">` 中，每个 chip 添加 `role="radio" aria-checked="true/false"`。

### 4.2 [P2] 生成题目后无焦点管理

**文件**：`practice.html` `render()` 函数

生成题目后，焦点仍在"生成练习题"按钮上。键盘用户需 Tab 多次才能到达第一个输入框。

**修正方案**：渲染完成后将焦点移到题目区域第一个输入框：
```javascript
var firstInput = area.querySelector('input[data-index], input[data-idx]');
if (firstInput) firstInput.focus();
```

### 4.3 [P3] 打印弹窗可能被浏览器拦截

**文件**：`shared/print.js` 第 182 行

`window.open('', '_blank')` 在非用户直接点击触发的场景（如异步生成完成后点击打印）通常可正常工作，但某些浏览器策略下仍可能被拦截。当前已有 `alert` 提示。

**修正方案**：改为在当前页面用隐藏 iframe 打印，避免弹窗：
```javascript
var iframe = document.createElement('iframe');
iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:0;height:0;border:0;';
document.body.appendChild(iframe);
iframe.contentDocument.write(printHtml);
iframe.contentDocument.close();
setTimeout(function() { iframe.contentWindow.print(); }, 500);
```

### 4.4 [P3] 移动端快速切换菜单无关闭手势

**文件**：`practice.html` `bindQuickSwitch()`

菜单通过点击按钮打开，点击外部关闭。但移动端没有滑动关闭手势，且菜单宽度 `420px` 在小屏上可能溢出。

**修正方案**：添加 `max-width: 86vw`（已有），增加滑动手势关闭或添加显式关闭按钮。

---

## 五、可维护性（P2/P3）

### 5.1 [P2] 无自动化测试

**现状**：`dev/` 下有 `verify-setup.js`、`regression-check.js`、`coverage.js` 等验证脚本，但都是结构/覆盖检查，无单元测试验证题目生成的正确性。

**修正方案**：
1. 为每个插件的 `generate` 添加单元测试：验证返回的 `questions` 数组长度、`answer` 类型、`render()` 输出非空
2. 为 `check` 添加满分回填测试（`regression-check.js` 已部分实现，建议扩展为正式测试套件）
3. 引入简单的测试框架（如 Node `assert` + 自定义 runner，无需外部依赖）

### 5.2 [P2] Service Worker 版本号手动维护

**文件**：`sw.js` 第 13 行

```javascript
const CACHE = 'hw-help-v33';
```

每次修改被 CORE 缓存的文件，开发者必须手动升版本号。遗忘会导致用户使用旧缓存。

**修正方案**：在构建时自动生成版本号（如基于文件 hash 或日期），或在 `dev/verify-setup.js` 中增加检查：对比 `sw.js` 的 CACHE 版本与 CORE 文件的最后修改时间。

### 5.3 [P3] `shared/common.css` 过大且职责混杂（已修复：拆分为 5 个分层 CSS 文件）

**文件**：`shared/{tokens,base,components,toolbar,pages}.css`（原 common.css 680 行已拆分）

包含：基础重置、返回按钮、卡片样式、按钮系统（6 种颜色变体）、题型选择卡片、页面控制器、语文练习专属样式、四线格拼音、评分面板等。

**修正方案**：按功能拆分为：
- `shared/base.css` — 重置 + 变量 + 通用按钮
- `shared/type-selector.css` — 题型选择卡片
- `shared/chinese.css` — 语文专属（四线格、拼音等）
- `shared/question-card.css` — 题目卡片

### 5.4 [P3] 插件缺少错误边界

**现状**：`practice.html` 的 `generate()` 有 `try-catch`，但插件内部的 `generateQuestions` 出错时，错误信息可能不够友好（直接抛出 `err.message`）。

**修正方案**：在 `createPlugin` 的 `defaultGenerate` 中增强错误处理，返回友好的错误信息：
```javascript
catch (e) {
  console.error('[createPlugin:' + id + '] generateQuestions 执行出错：', e);
  throw new Error('题型「' + name + '」生成题目时出错：' + e.message);
}
```

---

## 六、性能优化（P3）

### 6.1 [P3] `fitColumns` 每次 render 都执行 DOM 查询 + 测量

**文件**：`practice.html` 第 634-662 行

`fitColumns` 遍历所有题目卡片，调用 `renderLen`（内部调用 `q.render(i)` + 正则匹配），再设置 `gridColumn`。对于 50 题，涉及 50 次渲染 + 50 次正则 + 50 次样式设置。

**修正方案**：在 `generate` 阶段预计算每题的 `renderLen`，存入 `question._renderLen`，`fitColumns` 直接读取。

### 6.2 [P3] `refreshTypeChips` 在 resize 时频繁触发

**文件**：`practice.html` 第 998-1001 行

已有 120ms 防抖，但 `refreshTypeChips` 内部对每个 chip 做 `offsetLeft` 读取（触发布局），在 chip 数量多时仍有开销。

**修正方案**：使用 `ResizeObserver` 替代 `window.resize`，仅在 chips 容器尺寸变化时触发。

### 6.3 [P3] Service Worker 预缓存所有插件文件

**文件**：`sw.js` 第 62-69 行

`install` 时从 `registry.js` 解析全部插件文件路径并预缓存（~65 个 JS 文件）。首次访问时需下载所有插件，可能拖慢首次加载。

**修正方案**：改为按需缓存 + 后台预热。`install` 时只缓存核心文件，用户访问某年级题型页时缓存该年级插件：
```javascript
// fetch 中按需缓存
if (url.pathname.startsWith('/plugins/')) {
  caches.open(CACHE).then(function(c) { c.put(req, copy); });
}
```

---

## 七、跨浏览器兼容性（P3）

### 7.1 [P3] `backdrop-filter` 无 fallback

**文件**：`shared/components.css` 多处、`practice.html`、`math-types.html`

`backdrop-filter: blur()` 在 Firefox < 103 和所有 IE 中不支持。

**修正方案**：添加 `@supports` 回退：
```css
@supports not (backdrop-filter: blur(12px)) {
  .card { background: rgba(255,255,255,0.92); } /* 更不透明 */
}
```

### 7.2 [P3] `String.prototype.padStart` 兼容性

**文件**：`practice.html` 第 462 行

```javascript
String(Math.floor(t / 60)).padStart(2, '0')
```

`padStart` 在 Safari < 10、Android WebView < 50 不支持。

**修正方案**：用自定义函数替代：
```javascript
function pad2(n) { return n < 10 ? '0' + n : String(n); }
```

---

## 八、数据一致性（P2/P3）

### 8.1 [P2] registry.js 中 g6 插件已注册但项目记忆标注"g6 未实现"

**现象**：`registry.js` 第 65-76 行注册了 `math-g6-*` 共 11 个插件，但项目 MEMORY.md 记忆中写"数学 1-5 年级全部实现"，未提及六年级。

**建议**：核实六年级插件是否真正实现（非占位），若已实现则更新记忆；若为占位应添加 `isPlaceholder` 标记。

### 8.2 [P3] `math-comprehensive.js` 的 `grades` 包含 6 但 `MATH_SUB_IDS` 未含 g6 插件

**文件**：`plugins/math-comprehensive.js` 第 298 行 `grades: [1, 2, 3, 4, 5, 6]`，但第 28-39 行的 `MATH_SUB_IDS` 兜底清单只列到 g5。

**修正方案**：如前述，删除 `MATH_SUB_IDS` 兜底清单（2.3 节），统一走 registry。

---

## 九、优化优先级总结

| 优先级 | 编号 | 问题 | 影响 |
|--------|------|------|------|
| **P0** | 1.1 | XSS：showNotice innerHTML 未转义 | 安全漏洞 |
| **P1** | 1.2 | 打印 document.write 无 CSP | 安全风险 |
| **P1** | 1.3 | SW cache-first 无版本校验 | 用户使用旧版 |
| **P1** | 2.1 | 子插件串行加载 | 首次加载慢 |
| **P2** | 2.2 | chinese/english-types.html 重复 | 维护成本 |
| **P2** | 2.3 | comprehensive 硬编码兜底清单 | 漂移风险 |
| **P2** | 3.1 | registry.js 格式不一致 | 可读性 |
| **P2** | 3.2 | ES5/ES6 混用 | 一致性 |
| **P2** | 4.1 | Chip 无 ARIA 语义 | 可访问性 |
| **P2** | 4.2 | 无焦点管理 | 键盘 UX |
| **P2** | 5.1 | 无自动化测试 | 质量保障 |
| **P2** | 5.2 | SW 版本手动维护 | 人为错误 |
| **P2** | 8.1 | g6 注册状态需核实 | 数据一致性 |
| **P3** | 2.4 | renderCard 双样式系统 | 复杂度 |
| **P3** | 3.3 | 嵌套 style 标签 | 规范性 |
| **P3** | 3.4 | updateCountTip 性能 | 渲染性能 |
| **P3** | 3.5 | 旧兼容导出残留 | 死代码 |
| **P3** | 4.3 | 打印弹窗可能被拦截 | UX |
| **P3** | 5.3 | common.css 过大（已修复：拆分 5 分层） | 可维护性 |
| **P3** | 5.4 | 插件错误边界不足 | 健壮性 |
| **P3** | 6.1-6.3 | 性能优化项 | 性能 |
| **P3** | 7.1-7.2 | 浏览器兼容性 | 兼容性 |
| **P3** | 8.2 | comprehensive g6 兜底缺失 | 数据一致性 |

---

## 十、总体评价

### 优点
1. **架构清晰**：插件化设计（generate/render/check 三接口）+ 注册表 + 知识库驱动的分层架构非常成熟
2. **工程规范完善**：CONTRACT.md 契约文档、CONTRIBUTING.md 贡献指南、dev 验证工具链一应俱全
3. **安全随机**：crypto API 优先 + Math.random 回退，题目随机性有保障
4. **离线支持**：Service Worker 实现完整离线缓存
5. **打印适配**：A4 自适应列数、打印专用路由系统
6. **自适应难度**：基于 localStorage 的学习表现追踪
7. **代码注释充分**：关键逻辑均有详细注释

### 建议优先修复
1. **立即修复** P0 XSS 漏洞（1.1）— 影响安全
2. **近期修复** P1 安全/性能项（1.2、1.3、2.1）
3. **中期改进** P2 架构/可维护性项
4. **长期优化** P3 各项性能/兼容性微调
