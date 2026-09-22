# P28-34 · SEO/AI 历史数据隔离（FROZEN）

> **定位一句话**：历史/脚手架内容与正式知识面彻底隔离，**AI 只能把正式发布知识页面视为产品知识源**。
>
> 状态：**FROZEN**（与 P28-33 同系红线，改动须人工评审）

## 1. 隔离范围（六目录，进索引=违规）

`archive/`（历史/归档/遗留测试）｜`migration/`（迁移原始数据与基线）｜`audit-results/`（审计快照）｜
`.trae/`（AI 工程辅助）｜`test/`、`tests/`（运行时测试）｜`dev/`（开发/构建/检查脚本与工具页）。

## 2. 隔离铁律（本次核查与落实）

| 铁律 | 现状（修复前） | 落实 |
|---|---|---|
| **不进 sitemap** | ✅ 已达标 | sitemap.xml 共 381 条 = 5 主页面（index/math-types/subject-types/practice/faq）+ 375 KP 页 + knowledge-index.html；不含任何六目录 URL |
| **不进内部公开导航** | ✅ 已达标 | 顶层页面与 knowledge/*.html 全量扫描：无任何 `href/src` 指向六目录 |
| **robots 明确 Disallow** | ⚠️ 缺 4 项 | 已补齐 `/archive/ /migration/ /audit-results/ /.trae/`（dev/test/tests/scripts/node_modules 原有） |
| **必要时 noindex** | ⚠️ 2 个历史 html 可直链 | `archive/legacy-tests/integration/column-consistency-test.html`、`dev/svg-test.html` 已加 `<meta name="robots" content="noindex,nofollow">` |
| **AI 知识源单点** | ⚠️ 未明示 | llms.txt 新增「知识源单一性声明」：知识源仅限 knowledge/ 官方页 + sitemap 主页面；六目录非知识源 |

## 3. 门禁（已接入 run-all-checks.sh 第 7 步 `check:seo-ai-history`）

`node dev/p28/check-seo-ai-history-isolation.js`（只读）：

- **A** sitemap：无六目录 URL；knowledge/* 必须 ⊆ KBL Runtime 官方 375 KP + 索引；顶层 ∈ 官方页面集
- **B** robots.txt：六目录逐一要求 `Disallow: /<dir>/`
- **C** 内部导航：顶层 + knowledge 全部 html 的 href/src（相对路径）不得落入六目录
- **D** llms.txt：不得以路径引用六目录为知识资源
- **E** 隔离目录内任何 *.html 必须带 `noindex`；knowledge/ 不得混入非官方/历史文件

## 4. 与既有契约的衔接

- P28-33 已保证「公开面只读、写方白名单」；P28-34 在此之上划定**可被 AI 消费的公开面范围**
  （官方页白名单），形成完整闭环：`KBL → 官方静态页 = AI 唯一知识源`。
- 判定取消采集（de-index）动作一律走 `npm run build:knowledge`（KBL 单向重建），不手改产物。

## 5. 变更手续

- 新增顶层目录：先判其是否属「正式发布知识面」；非发布面须同六目录处理（不进 sitemap/导航、robots Disallow、html noindex、llms 不引用）。
- 解除 FROZEN：须人工评审（同 P28-31/P28-33 契约纪律）。