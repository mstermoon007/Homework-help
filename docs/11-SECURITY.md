# 11-SECURITY — 安全边界

> 状态：FROZEN
> 涵盖：P28-23（HTML 安全边界）/ P28-24（删除 new Function/eval）/ P28-25（AnswerValidator 安全测试）/ SVG 安全

## 1. AnswerValidator 无动态执行（P28-24）

`shared/validator/answer-validator.js` 是唯一可执行"表达式"的地方，采用纯静态求值链：

```
输入字符串 → Tokenizer → Parser → AST → Safe Evaluator → 数值结果
```

- 全链**无 `eval` / `new Function` / `Function(...)`**
- 不调用任何运行时对象（window/process/require/document/globalThis）
- 不触发任何 DOM/网络/文件副作用

门禁：`node dev/p28/check-no-eval.js`（全项目禁止 `eval` / `new Function`）

## 2. AnswerValidator 安全测试（P28-25）

### 合法表达式

| 表达式 | 预期 |
|---|---|
| `1 + 2` | `3` |
| `10 / 2` | `5` |
| `(3 + 5) * 2` | `16` |
| `1.5 + 2.5` | `4` |

### 禁止模式（必须拒绝/安全处理）

`constructor` / `window` / `process` / `require` / `Function` / `document` / `globalThis`

## 3. HTML 安全边界（P28-23）

所有进入 DOM 的题目文本（question text / answer / explanation / SVG）必须经明确安全边界。

### print.js 两处已标注

| 位置 | 安全说明 |
|---|---|
| `clone.outerHTML` | clone 是经 PresentationRenderer→HTMLRenderer 安全渲染管线产出的 DOM 序列化，非 raw HTML；打印窗口 CSP 禁 script |
| `pvOverlay.innerHTML` | 静态 UI 模板，不含题目文本/答案/解析，非 raw HTML 注入 |

门禁：`node dev/p28/check-html-safety-boundary.js`

## 4. SVG 安全

- SVG 经 `SVGSanitizer` 处理；custom/illustration 的 rawSvg 必须经 sanitizer
- 禁止 raw SVG / 未经验证字符串直接进入 DOM
- 测试：`tests/presentation/svg-sanitizer.test.js`

## 5. 历史数据安全隔离

- KBL 唯一可写方 = 离线派生白名单（见 `02-KBL.md` §4）
- SEO/AI/Crawler/LLM 一律只读，禁止回灌 KBL（见 `09-WEB-AI.md`）
- 六目录 `noindex, nofollow`，不进 sitemap

## 6. 全项目安全门禁汇总

```bash
node dev/p28/check-no-eval.js                    # 无 eval/new Function
node dev/p28/check-answer-validator-security.js  # 答案验证器安全
node dev/p28/check-html-safety-boundary.js       # HTML 安全边界
node dev/p28/check-kbl-ai-boundary.js            # KBL 回写白名单
node dev/p28/check-seo-ai-history-isolation.js   # 六目录隔离
```
