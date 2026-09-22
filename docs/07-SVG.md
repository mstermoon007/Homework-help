# 07-SVG — 图形表达契约

> 状态：FROZEN
> 涵盖：P28-26（SVG 最终契约）/ P28-27（SVG 全量 Contract Test）

## 1. SVG 统一链路

```
GraphicDescriptor
  ↓
GraphicRenderer
  ↓
SVGRenderer（shared/svg/）
```

## 2. 返回契约（P28-26）

每个 SVG 必须返回明确状态：

| 状态 | 含义 |
|---|---|
| `SUCCESS` | 渲染成功，返回 svg 字符串 |
| `UNSUPPORTED` | 不支持该图形描述，返回 reason |
| `FAILED` | 渲染失败，返回 error |

**禁止** `catch → ''` 静默吞错。

SSOT：`shared/presentation/svg-registry.js`（统一入口，状态枚举 + 安全处理）。

## 3. 安全边界

- SVG 经 `SVGSanitizer` 处理；custom/illustration 的 rawSvg 必须经 sanitizer
- 禁止 raw SVG / 未经验证字符串直接进入 DOM
- SVG 不得承载文字语义内容；不得调用 Generator / POL / KBL

## 4. SVG 全量 Contract Test（P28-27）

测试覆盖图形族：

```
geometry / calculation / make-ten / clock / area / fraction
/ dataStats / draw / chart / diagram / currency
```

检查项：viewBox / width / height / XML 安全 / 空参数 / 非法参数。

测试文件：`tests/svg/svg-contract.test.js`、`tests/svg/svg-sanitizer.test.js`、`tests/svg/graphic-renderer.test.js`
