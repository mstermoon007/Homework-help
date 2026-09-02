# 贡献指南（已迁移）

贡献规范自 **V4.0.1** 起统一维护在 **[`DEVELOPMENT.md`](DEVELOPMENT.md)**（项目中「开发与贡献规范」章节，
单一来源）。

其中与本目录相关的核心章节：

- 「5.3 随机数规范」—— 禁止直接 `Math.random()`，统一 `randInt` / `shuffle` / `rand`
- 「5.4 样式与设计令牌」—— 颜色/圆角/阴影一律走 `shared/tokens.css` 变量，SVG 表现属性例外
- 「5.5 答题交互边界」—— 插件禁止操作 DOM，仅 `math-comprehensive.js` 例外
- 「5.6 知识库统一约定」—— 插件声明 ↔ knowledge-bank 双向对齐
- 「7. 质量保障与校验」—— `npm test` 门禁与 pre-commit 钩子启用方式

工具函数 API 速查见 [`API.md`](API.md)。

> 历史权威版（V4.0.1 前）归档于 `archive/docs-2026-09/CONTRIBUTING.md`。