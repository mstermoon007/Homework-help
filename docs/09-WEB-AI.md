# 09-WEB-AI — 静态页与 AI 边界

> 状态：FROZEN
> 涵盖：P28-33（KBL→页面→AI 单向）/ P28-34（SEO/AI 历史隔离）/ P28-35（Sitemap 冻结）/ P28-36（AI Agent 抓取）

## 1. 单向边界（P28-33）

```
KBL（唯一事实源）
  │ 唯一可写方 = 离线派生白名单（见 02-KBL §4）
  ▼
Static Page（knowledge/*.html、sitemap.xml）
  │ 仅派生，只读消费；禁止回灌 KBL
  ▼
SEO / AI / Crawler / LLM（只读消费）
```

四条禁令：R1 SEO 不得改 KBL · R2 AI 不得改 KBL · R3 Crawler 不得改 KBL · R4 LLM 不得改 KBL。

页面 = KBL 的决定性投影，带 `kbgen:hash` 指纹；漂移判定 `node dev/build-knowledge-pages.js --check`。

## 2. SEO / AI 历史隔离（P28-34）

### 六目录全部 `noindex, nofollow`

| 目录 | 内容 |
|---|---|
| `history/` | 历史静态页（旧版本、迭代快照） |
| `debug/` | 调试诊断页 |
| `archive/` | 归档资料 |
| `admin/` | 后台/管理页 |
| `test/` | 测试页 |
| `staging/` | 预发布内容 |

`robots.txt`：`Disallow: /history/ /debug/ /archive/ /admin/ /test/ /staging/`

### 三项要求

1. 这些目录**不参与** sitemap
2. `canonical` 不指向它们
3. 页面之间存在**跨站链接**或**外部链接**必须 `rel="nofollow noopener"`

### 验证

- 静态扫描：六目录下所有 HTML 的 `<meta name="robots">` 须为 `noindex, nofollow`
- `rel="nofollow noopener"` 校验
- 不引入虚假 author/rating/review，不塞 keyword

门禁：`node dev/p28/check-seo-ai-history-isolation.js`

## 3. Sitemap 最终冻结（P28-35）

```
381 条 = 5 官方公共页（index / math-types / subject-types / practice / faq）
       + 375 KP 页（knowledge/{id}.html）
       + knowledge-index.html
```

逐 URL 保证：HTTP 200 / 无 redirect / 实际存在 / canonical 与 sitemap URL 一致 / 无参数无历史 URL。

门禁：`node dev/p28/check-sitemap-freeze.js`（第 8 步）

## 4. AI Agent 抓取最终测试（P28-36）

不执行 JS 的 AI Agent 能从入口靠**静态链接图**发现并读取全部 375 个知识页：

```
index.html → select.html → practice.html → knowledge/knowledge-index.html → 375 KP → practice.html
```

三项 375/375：
- 可发现：仅沿静态 `<a href>` BFS 可达官方 375 KP 全集
- 可读取：每页 200，服务端正文含名称+释义（KBL definition），无需 JS
- identity 正确：canonical == sitemap URL；知识点 ID 与文件名一致；`<h1>` == KBL 名称
- → practice 可达：每页含 `practice.html?kps={id}`

门禁：`node dev/p28/check-ai-agent-crawl.js`（第 9 步），从不执行 JS，只做 HTTP GET + HTML href 解析。
