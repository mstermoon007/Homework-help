# 06-PRESENTATION — 题目表达链

> 状态：FROZEN
> 涵盖：P28-20（SemanticQuestion 唯一中间对象）/ P28-21（删除重复 Legacy Bridge）/ P28-22（Presentation 双轨收口）

## 1. 生产链（唯一）

```
Generator
  ↓
SemanticQuestion（shared/semantic/semantic-question.js）
  ↓
Validator
  ↓
PresentationRenderer（shared/presentation/renderer.js）
  ↓
HTMLRenderer（shared/presentation/html-renderer.js）
  ↓
RenderResult
```

SemanticQuestion 是全链唯一题目数据契约，禁止第二套题目对象。

## 2. Legacy 兼容边界（唯一）

旧 `LegacyQuestion` 只允许一个兼容边界：

- 唯一 Legacy Adapter = `shared/presentation/render-format.js`（`toRenderableQuestions`）
- 已删除：`semantic-question-bridge.js`、`PracticeSession._sqToLegacyQuestion()`
- 禁止 A→Legacy / B→Legacy / C→Legacy 多桥并存

## 3. Presentation 双轨收口（P28-22）

- 旧 `shared/presentation/render.js`（renderCard/renderGrid）已删除
- 唯一渲染链：PresentationRenderer → HTMLRenderer → RenderResult
- `PluginUtil.renderCard` / `PluginUtil.renderGrid` 无生产调用

## 4. Print 约定（冻结）

- 统一使用 `shared/presentation/print.js`；页面不得私带 `@media print` 块
- A4 纵向；内容宽 190mm
- 打印页输入元素保留原样式（box/border/rounded/bg），仅清空 value/placeholder
- 调用格式：`Print.open('#container', '标题', { pageType: 'type', columns: num })`

## 5. HTML 安全边界（P28-23）

所有 question text / answer / explanation / SVG 必须经明确安全边界。
- print.js 的 `clone.outerHTML`：clone 是经 PresentationRenderer→HTMLRenderer 安全渲染管线产出的 DOM 序列化，非 raw HTML；打印窗口 CSP 禁 script。
- print.js 的 `pvOverlay.innerHTML`：静态 UI 模板，不含题目文本/答案/解析，非 raw HTML 注入。
