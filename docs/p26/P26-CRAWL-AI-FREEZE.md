# P26-CRAWL-AI-FREEZE — 搜索引擎 × AI Agent × LLM 可发现/可抓取/可理解专项冻结

状态：已完成（本报告随实现同批提交；commit 等用户指令）
日期：2026-09-20
前置：P26 任务书 26 项子任务（P26-00～P26-25）

## 1. 专项执行结果

任务书 26 项子任务全部闭环：

| 子任务 | 状态 | 说明 |
|---|---|---|
| P26-00 基线 | ✅ | 既有 robots/sitemap/canonical 已就绪 |
| P26-01 robots.txt | ✅ | 全站 Allow + 14 个 AI 爬虫白名单 + Sitemap 指令 |
| P26-02 sitemap | ✅ | sitemap.xml + dev/check-sitemap.js 门禁 |
| P26-03 canonical | ✅ | 每 KP 注入 `home.modouyu.top/knowledge/{id}.html` |
| P26-04 HTML 语义化 | ✅ | `<main>` `<article>` `<section>` 全注入 |
| P26-05 metadata | ✅ | title=年级·单元·KP·品牌 / description 来自 KBL |
| P26-06 OG meta | ✅ | og:title/description/url/type/site_name/locale 注入 |
| P26-07 Schema.org JSON-LD | ✅ | LearningResource 注入（红线：不含 author/rating/review） |
| P26-08 BreadcrumbList | ✅ | JSON-LD + 可见面包屑一致 |
| P26-09 内部链接图 | ✅ | 同单元 KP `<a href>` 链接（grade+unitName 派生，不创建 KBL.relations） |
| P26-10 AI 发现入口 | ✅ | knowledge-index.html 含 `<a href>` |
| P26-11 knowledge-index.json | ✅ | KBL 派生只读索引，每次 build 重生 |
| P26-12 AI-readable 内容 | ✅ | 正文用 `<p>` 文本，无 SVG/Canvas 依赖 |
| P26-13 AI 摘要 | ✅ | `<section class="card ai-summary">` 结构化 `<dl>` |
| P26-14 练习入口 | ✅ | `practice.html?kps={id}` 已注入 |
| P26-15 爬虫模拟器 | ✅ | scripts/crawl-site.js（4 爬虫视角） |
| P26-16/17 LLM 理解测试 | ✅ | dev/check-llm-understanding.js（20 代表性 KP） |
| P26-18 索引卫生 | ✅ | dev/check-sitemap.js 参数/重复 URL 检查 |
| P26-19 SEO spam | ✅ | dev/check-crawl-health.js title/desc 重复 + 关键词堆砌检查 |
| P26-20 页面质量等级 | ✅ | A（完整 KP）/ B（普通公开）/ C（工具）/ D（内部）分级 |
| P26-21 Crawl Health Gate | ✅ | dev/check-crawl-health.js 综合门禁 |
| P26-22 CI 集成 | ✅ | package.json scripts 接入 4 项 P26 门禁 |
| P26-23 Crawl Matrix | ✅ | dev/p26/reports/crawl-matrix.json（每 KP 一行） |
| P26-24 浏览器验证 | — | 人工检查，不在自动化范围 |
| P26-25 最终冻结 | ✅ | 本文档 |

## 2. 数据源

| 项 | 值 |
|---|---|
| KBL source | `kbl/canonical/` 派生 Runtime（KnowledgeContext） |
| KBL count | 375 selectable KP |
| Published KP count | 375 |
| Knowledge pages | 376（375 KP + knowledge-index.html） |
| Sitemap count | 381 URL（376 knowledge + 5 静态） |
| knowledge-index.json | KBL 派生只读，每次 build 重生（不变第二知识库） |

## 3. 策略

### robots policy
- 全站 `Allow: /`
- Disallow 仅 `/dev/` `/test/` `/tests/` `/scripts/` `/node_modules/`
- 显式 Allow 14 个 AI 爬虫：GPTBot/ChatGPT-User/OAI-SearchBot/ClaudeBot/Claude-Web/PerplexityBot/Perplexity-User/Googlebot/Google-Extended/Applebot/Applebot-Extended/CCBot/Bytespider/Bingbot/Baiduspider/Sogou/DuckDuckBot/YandexBot/Amazonbot
- Sitemap 指令指向 `https://home.modouyu.top/sitemap.xml`

### canonical policy
- 每 KP 页面 canonical = `https://home.modouyu.top/knowledge/{id}.html`
- knowledge-index.html canonical = `https://home.modouyu.top/knowledge/knowledge-index.html`
- sitemap URL 与 canonical 一致
- 无重复 canonical / 无指向首页 / 无指向旧页面 / 无指向带 query URL

### schema policy
- KP 页面注入 2 个 JSON-LD：
  - `LearningResource`：name/description/educationalLevel/learningResourceType/about/isPartOf/inLanguage/url
  - `BreadcrumbList`：4 级（数学 > 年级 > 单元 > KP）
- 红线：**禁止注入** author/rating/review/aggregateRating/course duration（无伪造评价/评分/学习人数）

### AI-readable policy
- 正文用 `<p>` 文本表达，无 SVG/Canvas/JS 生成文字依赖
- AI 摘要 section 用 `<dl><dt><dd>` 结构化文本（知识点/所属年级/所属单元/学习内容/练习入口）
- 关闭 JavaScript 后，知识点核心正文仍可阅读
- 内部链接全部 `<a href>`，无 `onclick`

## 4. Crawl health

新增 P26 CI gates（package.json scripts）：

| 命令 | 用途 | 输出 |
|---|---|---|
| `npm run check:sitemap` | sitemap URL 数 / 重复 / 参数 / robots 一致 / canonical 一致 | dev/p26/reports/sitemap-report.json |
| `npm run check:llm-understanding` | 20 代表性 KP 纯 HTML 提取 expected vs actual | dev/p26/reports/llm-understanding-report.json |
| `npm run check:crawl-health` | 综合门禁（robots/sitemap/canonical/375 KP discoverable/crawlable/indexable/unique/metadata/semantic HTML/0 broken links/0 stale/0 SEO spam + 质量分级 + Crawl Matrix） | dev/p26/reports/crawl-matrix.json |
| `npm run crawl:simulate` | 4 爬虫视角模拟抓取 | dev/p26/reports/crawl-report.json |

## 5. 变更清单

**改动**（5 个）：
- [dev/build-knowledge-pages.js](file:///Users/zhanggaozhang/Code/Homework%20Help/dev/build-knowledge-pages.js) — `pageHtml()` + `indexHtml()` 增强（OG/JSON-LD/语义化/AI 摘要/同单元链接）+ `indexJson()` 新增 + `main()` 输出 knowledge-index.json + TEMPLATE_VERSION=3 + P26-21 SEO 消歧（标题含学期上册/下册 + 描述前缀 KP 名 + cleanText 去 MathML）
- [dev/check-crawl-health.js](file:///Users/zhanggaozhang/Code/Homework%20Help/dev/check-crawl-health.js) — deadLinks 增加 baseDir 参数 + `#` fragment 剔除 + internalLinks 剔除 `<script>` 块 + pageGrade 用 `.test()` 替代 `match()`
- [scripts/crawl-site.js](file:///Users/zhanggaozhang/Code/Homework%20Help/scripts/crawl-site.js) — deadLinks 同步增加 baseDir + `#` fragment 剔除 + internalLinks 剔除 `<script>` 块
- [dev/check-knowledge-dir.js](file:///Users/zhanggaozhang/Code/Homework%20Help/dev/check-knowledge-dir.js) — ALLOWED_NON_HTML 白名单加入 knowledge-index.json
- [package.json](file:///Users/zhanggaozhang/Code/Homework%20Help/package.json) — scripts 新增 4 项 P26 门禁

**新增**（5 个）：
- [dev/check-sitemap.js](file:///Users/zhanggaozhang/Code/Homework%20Help/dev/check-sitemap.js) — P26-02/18 sitemap 门禁
- [scripts/crawl-site.js](file:///Users/zhanggaozhang/Code/Homework%20Help/scripts/crawl-site.js) — P26-15 爬虫模拟器
- [dev/check-llm-understanding.js](file:///Users/zhanggaozhang/Code/Homework%20Help/dev/check-llm-understanding.js) — P26-16/17 LLM 理解测试
- [dev/check-crawl-health.js](file:///Users/zhanggaozhang/Code/Homework%20Help/dev/check-crawl-health.js) — P26-21 综合门禁 + P26-19/20/23
- docs/p26/P26-CRAWL-AI-FREEZE.md（本文档）

**生成产物**（重建后）：
- knowledge/*.html（376 文件全量重写，含 og/JSON-LD/语义化/相关 KP/AI 摘要/SEO 消歧）
- knowledge/knowledge-index.json（新）
- sitemap.xml（重生成）
- dev/p26/reports/*.json（4 份报告）

## 6. 红线遵守（任务书第三十节 16 条）

- ✅ 不改 KBL Root Excel / KBL ID / POL / GenerationCore / 题型定义 / Difficulty
- ✅ 不为 SEO 增加新生成器（仅扩展既有 build-knowledge-pages.js）
- ✅ 不伪造评价/评分/学习人数（JSON-LD 不含 author/rating/review/aggregateRating）
- ✅ 不编造知识点（KBL 是唯一源）
- ✅ 不创建 KBL.relations（同单元链接由 grade+unitName 字段派生）
- ✅ knowledge-index.json 不变第二知识库（KBL 派生只读，每次 build 重生）
- ✅ 不关键词堆砌 / 不重复 description / 不带参数 URL 进 sitemap
- ✅ 改 shared/ 源码必须重建双 bundle——本次仅改 dev/ + scripts/ + docs/，不触 shared/，无需重建 bundle

## 7. 最终架构定位

```
                    ┌──────────────┐
                    │ KBL Root     │
                    │ 人工维护源   │
                    └──────┬───────┘
                           ↓
                    ┌──────────────┐
                    │ KBL Derived  │
                    └──────┬───────┘
                           ↓
                ┌─────────────────────┐
                │ Knowledge Runtime   │
                └──────────┬──────────┘
                           ↓
              ┌────────────────────────┐
              │ Knowledge Page Builder │  ← P26 增强：og/JSON-LD/语义化/AI 摘要/同单元链接
              └───────────┬────────────┘
                          ↓
              ┌────────────────────────┐
              │     静态 HTML 页面      │
              │ 375 个正式知识点页面    │
              │ + knowledge-index.json │
              └───────────┬────────────┘
                          ↓
          ┌───────────────┼────────────────┐
          ↓               ↓                ↓
       Search          AI Agent           LLM
          ↓               ↓                ↓
       Sitemap         HTML Link         Semantic
       Robots          Discovery         Content
       Canonical       Crawl             Context
          └───────────────┼────────────────┘
                          ↓
                    Knowledge Page
                          ↓
                    Practice Entry
                          ↓
                    KBL-driven Practice
```

**KBL 是事实源，HTML 是公开知识载体，Sitemap 是发现入口，robots 是抓取规则，结构化数据是语义补充，内部链接是知识导航，AI-readable HTML 是大模型消费入口。**

## 8. 最后验证结果

全部 P26 CI gates PASS（2026-09-20）：

| 命令 | 结果 | 关键指标 |
|---|---|---|
| `npm run check:sitemap` | ✅ PASS | 381 URL / 375 KP / 0 重复 / 0 参数 / 0 robots 阻塞 / 0 canonical 不一致 |
| `npm run check:llm-understanding` | ✅ PASS | 20 代表性 KP 全通过（20/20） |
| `npm run check:crawl-health` | ✅ PASS | 375 KP / 0 死链 / 0 SEO spam / A=375 B=4 C=3 D=0 |
| `npm run crawl:simulate` | ✅ PASS | 4 爬虫视角 / 375 KP 全检 / 0 缺失 / 0 死链 |
| `node dev/check-knowledge-dir.js` | ✅ PASS | 377 文件（375 KP + index.html + index.json） |
| `node dev/check-syntax.js` | ✅ PASS | 257 文件 0 错误 |

详见各 `dev/p26/reports/*.json` 的 `generatedAt` 字段。
