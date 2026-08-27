# 贡献指南（已迁移）

贡献规范统一维护在仓库根目录 **[`CONTRIBUTING.md`](../CONTRIBUTING.md)**（单一来源，避免双份漂移）。

其中与本目录相关的核心章节：

- 「3. 随机数使用规范」—— 禁止直接 `Math.random()`，统一 `randInt` / `shuffle` / `rand`
- 「3.5 样式与设计令牌」—— 颜色/圆角/阴影一律走 `shared/tokens.css` 变量，SVG 表现属性例外
- 「3.6 样式与打印一致性」——
  - 所有 CSS 变量（卡片填充、间距、字体尺寸）统一在 `shared/tokens.css` 定义，前后端同步
  - 打印样式在 `shared/print.js` 的 `@media print` 块中通过 `var(--card-padding-print)` 等变量覆写
  - 列数计算由 `shared/common.js` 的单一算法 (`calcOptimalCols`/`gridColumnsFromDom`) 统一，屏幕与打印结果一致
  - SVG 打印通过 `print-color-adjust: exact` 保留图形颜色，`.scene-box svg` 使用 `max-width: 100%; height: auto` 等比缩放
  - 响应式断点：移动端(<480px)强制单列，其他宽度由 JS 通过 `--grid-cols` 变量决定，避免硬编码媒体查冲突


- 「三点五、模块目录与知识库维护 → 知识库同步要求」—— 插件声明 ↔ knowledge-bank 双向对齐
- 「四、提交前检查」—— `npm test` 门禁与 pre-commit 钩子启用方式

工具函数 API 速查见 [`API.md`](API.md)。
