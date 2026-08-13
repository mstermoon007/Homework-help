# archive/ — 已归档代码

本目录存放**已被现行架构取代、近期不再使用**的模块。由 `dev/cleanup-scan.js` 的 `keepDirs` 白名单（`/^archive\//`）跳过，不会被清理工具误删。

## 归档内容

| 文件 | 原位置 | 说明 |
|---|---|---|
| `ui-framework.js` | `shared/ui-framework.js` | `PracticeUI`：语文练习页共享 UI 框架（计时/评分/错题重做/打印），重度依赖全局 DOM 与 `PracticeCore`。 |
| `ui-framework-math.js` | `shared/ui-framework-math.js` | `MathUI`：数学练习页共享 UI 框架，同上，依赖 `PracticeCore` + `App`。 |
| `practice-core.js` | `shared/practice-core.js` | `PracticeCore`：上述两框架共享的练习原语（计时器/答案归一化/算分/壳页初始化/标记/打印/错题重做编排）。 |

## 归档原因（2026-08-12）

1. 全仓除三者互相引用 + `dev/check-core-integrity.js` 外，**零引用**——无任何 HTML 或插件加载它们。
2. 它们要求独立的"壳页面"元素 ID，而线上已统一为 `practice.html` 插件宿主 + `generate/render/check` 契约（`plugins/CONTRACT.md`）。
3. 它们大量操作全局 DOM，**违反 `CONTRIBUTING.md` 的"全局 DOM 禁止操作"规则**（唯一例外仅 `math-comprehensive.js`）。
4. 无任何 roadmap / TODO / 计划文档引用它们，属被插件架构取代的备选方案。

## 恢复条件

若未来决定采用框架式练习页（需同步修订 `CONTRIBUTING.md` 放宽 DOM 规则），可将三者移回 `shared/`，并在 `dev/check-core-integrity.js` 的 `coreFiles` 中恢复 `'shared/ui-framework.js'`（其依赖 `practice-core.js` 须先于两个 framework 加载）。
