# 监测与验证记录 · Homework Help

本文件记录爬虫可见性与 AI 引用监测的配置与验证结果，供定期复核参考。

## 一、已完成的机器可见性配置

| 资源 | 作用 | 状态 |
|------|------|------|
| robots.txt | 允许 GPTBot / OAI-SearchBot / PerplexityBot / ClaudeBot / Googlebot 全站抓取；含 Sitemap 指令 | 已就绪 |
| llms.txt | 站点简介 + 核心页面 + 知识库入口（Markdown 格式，供 LLM 直接读取） | 已就绪 |
| sitemap.xml | 410 个 URL（首页/FAQ/题型页/知识库 403 页），由 scripts/generate-sitemap.js 生成 | 已就绪 |
| faq.html | FAQPage JSON-LD（15 条问答） | 已就绪 |
| index.html | WebSite + Organization JSON-LD | 已就绪 |
| 题型页 | CollectionPage JSON-LD + noscript 静态题型列表 | 已就绪 |
| practice.html | 默认 LearningResource JSON-LD + 静态说明文本 | 已就绪 |
| 知识库页 | 每页标题/描述/面包屑/知识点说明/例题，结构化内容可被抓取 | 已就绪 |

生成/更新命令：

    node scripts/generate-knowledge-pages.js   # 知识库静态页
    node scripts/enrich-knowledge-bank.js      # 知识点 description/example（数据来源）
    node scripts/inject-schema.js              # 核心页 JSON-LD
    node scripts/generate-sitemap.js          # sitemap.xml

## 二、本地验证记录（填写日期与结果）

### 1. 可访问性检查（替换为真实域名）

    curl -s -o /dev/null -w 'sitemap.xml: %{http_code}' https://你的域名/sitemap.xml
    curl -s -o /dev/null -w 'llms.txt: %{http_code}' https://你的域名/llms.txt
    curl -s -o /dev/null -w 'robots.txt: %{http_code}' https://你的域名/robots.txt

期望：三者均返回 200。

### 2. 爬虫抓取可见性（以 GPTBot 为例）

    curl -s -A 'GPTBot' https://你的域名/knowledge/g4-m1-g4-oral-big.html

期望：返回 200，且正文含知识点文字（如「大数加减口算」「知识点说明」「典型例题」）。

### 3. JSON-LD 校验

使用 Google Rich Results Test 或 Schema.org 校验器粘贴页面 URL，确认 FAQPage / WebSite / Organization / CollectionPage / LearningResource 均无误。

## 三、Search Console / Bing 提交清单

1. 在真实域名上线后，于 Google Search Console 提交 sitemap.xml 地址。
2. 于 Bing Webmaster Tools 提交同一 sitemap。
3. 在 llms.txt 与 robots.txt 均指向同一域名。

## 四、定期抽查 AI 引用（每月一次）

- 在 ChatGPT / Perplexity 中搜索品牌关键词「Homework Help 小学家庭作业生成器」或典型知识点问题（如「凑十法 怎么算」「鸡兔同笼 假设法」）。
- 记录是否被引用、引用来源是否指向本站。
- 若未出现，检查对应知识点页的内容厚度与内部链接，必要时补充 description/example 并重新生成 sitemap。
