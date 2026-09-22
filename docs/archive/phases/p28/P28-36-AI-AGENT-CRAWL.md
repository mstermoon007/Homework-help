# P28-36 · AI Agent 抓取最终测试（FROZEN）

> **定位一句话**：不执行 JavaScript 的 AI Agent，能从入口靠**静态链接图**发现并读取全部 375 个知识页，且身份正确、可直达练习。
>
> 状态：**FROZEN**（改入口/链接链/知识页服务端正文条件 = 红线，须人工评审）

## 1. 模拟的抓取链

```
GET index.html
  → 解析 HTML 中 <a href>（不执行任何 JS）
  → link（同站相对链接，逐跳）
  → knowledge（knowledge-index.html → 375 个 KP 页）
  → practice（每个 KP 页 → practice.html?kps={id}）
```

实际静态链：`index.html → select.html → practice.html → knowledge/knowledge-index.html → 375 KP → practice.html`。
所有跳转均为**服务端 HTML 中的静态锚点**，无需 JS 渲染即可被解析。

## 2. 三项 375/375 要求（门禁逐一断言）

| 要求 | 判据 |
|---|---|
| **375/375 可发现** | 从入口 `index.html` 仅沿静态 `<a href>`（站内 .html）BFS，可达官方 375 KP 页全集；且不得发现非官方 KP 页 |
| **375/375 可读取** | 每个 KP 页 GET 200，服务端正文已含**名称 + 释义**（KBL definition 片段），无需 JS 注入 |
| **375/375 identity 正确** | 每页 canonical == 自身 sitemap URL；`知识点 ID：{id}` 与文件名一致；`<h1>` 名称 == KBL 名称 |
| **→ practice 可达** | 入口可达 `practice.html`；且每个 KP 页含 `practice.html?kps={id}` 链接 |

## 3. 门禁（已接入 run-all-checks.sh 第 9 步 `check:ai-crawl`）

`node dev/p28/check-ai-agent-crawl.js`（只读）：

- 本地真实 HTTP 服务（`python3 -m http.server`，与 e2e 同口径）+ 原生 `http` 客户端；
- **从不执行任何 JS**——只做 HTTP GET 与 HTML `href` 正则解析（即 AI Agent/爬虫的无脚本抓取口径）；
- BFS 全量抓取后输出三组 375/375 结论 + 抓取页数；任一违约即整体 FAIL。

## 4. 与既有契约的衔接

- P28-33（KBL→页单向）、P28-34（历史隔离）、P28-35（sitemap 冻结）保证「官方面内容正确且唯一」；
  P28-36 至此保证「官方面在**无 JS** 条件下对 AI Agent 完全可发现、可读取、可核身」。
- 入口可达性依赖 `practice.html` 中静态的「知识库全部 →」锚点与 `knowledge-index.html` 的 375 静态锚点；
  任何将其改为 JS 注入会立刻打破本门禁（这正是本测试要守的回归面）。

## 5. 变更手续

- 新增/删除 KP：走 KBL 单向重建（`npm run build:knowledge`）→ sitemap 重生成（`npm run generate:sitemap`）→ 本门禁复验。
- 任何入口页面改为 JS 驱动导航、或知识页转为客户端渲染：必须先确保静态兜底链接/正文，否则视为破坏 AI 可抓取性。
- 解除 FROZEN：须人工评审（同 P28-31/P28-33/P28-34/P28-35 契约纪律）。