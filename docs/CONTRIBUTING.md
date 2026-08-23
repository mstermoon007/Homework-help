# 贡献指南（已迁移）

贡献规范统一维护在仓库根目录 **[`CONTRIBUTING.md`](../CONTRIBUTING.md)**（单一来源，避免双份漂移）。

其中与本目录相关的核心章节：

- 「3. 随机数使用规范」—— 禁止直接 `Math.random()`，统一 `randInt` / `shuffle` / `rand`
- 「3.5 样式与设计令牌」—— 颜色/圆角/阴影一律走 `shared/tokens.css` 变量，SVG 表现属性例外
- 「三点五、模块目录与知识库维护 → 知识库同步要求」—— 插件声明 ↔ knowledge-bank 双向对齐
- 「四、提交前检查」—— `npm test` 门禁与 pre-commit 钩子启用方式

工具函数 API 速查见 [`API.md`](API.md)。
