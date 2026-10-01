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
- A4 纵向；内容宽 190mm；页边距 12mm 10mm（上下/左右）
- 打印页输入元素保留原样式（box/border/rounded/bg），仅清空 value/placeholder
- 调用格式：`Print.open('#container', '标题', { pageType: 'type', columns: num })`

### 4.1 排版 SSOT 索引（P28-UI-PRINT-WYSIWYG-01）

预览 = 打印结构同源，单一真相分布如下：

| 真相 | 唯一来源 |
|---|---|
| A4 版式常量（210/190mm、12mm 10mm、718px@96dpi） | `Print.LAYOUT`（print.js），practice.html 与 practice-session.js 只读不复制 |
| 打印文档骨架（CSP 禁 script / @page / .print-sheet / .ps-title） | `Print.buildPrintDocument()`（克隆链与直渲链共用） |
| 判断题打印形态（去按钮 /「正确（　）错误（　）」） | `Print.buildJudgePrintCss()`（双链共用） |
| 列数 / 列跨算法与阈值（≥50 通栏、≥26 半宽） | `PluginUtil.layout`（shared/core/core.js）：calcOptimalCols / fitColumns / renderLen / spanForLength / gridColumnsFromDom / applySpanning |
| 屏 / 打密度差异 | 仅 tokens.css 的 `--grid-gap-print`、`--card-padding-print`；print.js 兜底值由契约测试锁定一致 |
| 打印态页面 chrome 隐藏 | 元素打 `data-print-hide` 标记；唯一规则在 shared/styles/components.css |

- 两条打印链：主链 `session.print() → Print.openFromQuestions`（SemanticQuestion 直渲，动态列数+列跨）；降级/反馈重打 `Print.open`（#problemsArea DOM 克隆）。
- 屏显列数计算宽度必须传 `Print.LAYOUT.printableWidthPx`，不得用容器实测宽度。

## 5. HTML 安全边界（P28-23）

所有 question text / answer / explanation / SVG 必须经明确安全边界。
- print.js 的 `clone.outerHTML`：clone 是经 PresentationRenderer→HTMLRenderer 安全渲染管线产出的 DOM 序列化，非 raw HTML；打印窗口 CSP 禁 script。
- 直渲链列跨 `span` 经 html-renderer 白名单（`span [1-4]` / `1 / -1`）校验后才进入 style 属性。

### 5.1 形态契约显式化（P28-FORM-CONTRACT-01）

横向算式作答框内联（题干尾部追加 `= [input]`）由 SemanticQuestion 声明、Executor 归一、HTMLRenderer 只消费显式字段，不再解析题干 `= ?` 字符串。

| 真相 | 唯一来源 |
|---|---|
| `response.layout` 枚举（`'inline-after-equals'` / `'block'`） | `shared/schemas/semantic-question.schema.js`（RESPONSE_LAYOUTS + isValidResponseLayout） |
| 声明方：生成器产出载荷 `response: { layout }` | arithmetic / picture-equation（实际产出 `= ?` 尾缀的生成器） |
| 归一：raw.response 透传到 sq.response | `shared/semantic/semantic-question.js` normalizeSemanticQuestion |
| 消费：`inlineExpression(sq, prompt)` 读 `sq.response.layout==='inline-after-equals'` | `shared/presentation/html-renderer.js`；选择题（optionsOf）一律不内联 |
| Fallback：声明 inline 但题干无 `= ?` 尾缀 | 自动回落 `block`（与旧正则未匹配等价） |

- 删除 html-renderer 旧的 `INLINE_EQ_RE` 字符串检测正则与 `endsWith('= ?')` 调用路径。
- 未声明 `response` 字段的生成器默认回落 block 布局（可见退化，非静默）。
- 多分支生成器（picture-equation）以声明 + fallback 设计，无 `= ?` 尾缀的分支自动回落 block，行为不变。
