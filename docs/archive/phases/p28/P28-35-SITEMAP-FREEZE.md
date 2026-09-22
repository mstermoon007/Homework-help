# P28-35 · Sitemap 最终冻结（FROZEN）

> **定位一句话**：sitemap 集合与逐 URL 可服务性一次性冻结，任何条目=活链接（200/无重定向/canonical 一致）。
>
> 状态：**FROZEN**（改集合或逐 URL 可服务条件 = 红线，须人工评审）

## 1. 冻结集合（精确成立，无遗漏/无多余/无重复/无参）

```
381 条 = 5 官方公共页（index / math-types / subject-types / practice / faq）
       + 375 KP 页（KBL Runtime selectable 精确集合 → knowledge/{id}.html）
       + knowledge-index.html
```

- `select.html`、`contact.html` 为辅助公共页，**不属**冻结集合（既有口径，不收录）。
- 375 KP 由 KBL Runtime 实时投影判定，防止知识面与 sitemap 脱节。
- 六目录（P28-34）绝不入集。

## 2. 每一条 URL 的逐条保证（门禁逐一验证）

| 保证 | 判据 | 验证方式 |
|---|---|---|
| HTTP 200 | 状态码 = 200 | 本地 `python3 -m http.server` 真实 HTTP 请求（与 e2e 同口径） |
| 无 redirect | 响应无 `Location`、无 3xx | 同上（http 客户端不跟随重定向） |
| 实际存在 | 对应静态文件存在且响应体非空 | 文件系统 + HTTP 响应字节数 |
| canonical 正确 | 页面 `<link rel="canonical" href="https://home.modouyu.top/{path}">` 与 sitemap URL 完全一致 | 逐页 HTML 提取比对 |
| 无参数/历史 URL | 集合外一律拒收 | sitemap 解析全量比对 |

> P28-35 治理实录：冻结补齐 `index.html` 缺失的 canonical（首页为 sitemap URL，此前无 canonical 标签）；
> `knowledge-index.html` canonical 已在生成器 `indexHtml()` 内（随 P28-33 单向重建保留）。

## 3. 门禁（已接入 run-all-checks.sh 第 8 步 `check:sitemap-freeze`）

`node dev/p28/check-sitemap-freeze.js`（只读）：

- **组成**：总数 = 5+375+1；官方 KP 不得缺失、冻结集外 URL 不得出现、零重复。
- **逐条**：文件存在 → canonical == sitemap URL → 本地 HTTP 请求断言 200 / 无 redirect / 体非空。
- 381 条全部断言后才 PASS；任一 URL 违约即整体 FAIL（逐 URL 清单输出）。

## 4. 与既有契约的衔接

- P28-33/P28-34 划定「可被 AI 消费的官方面」；P28-35 到此官方面**可服务性**冻结：
  `sitemap ⊆ 官方静态页 ⊆ knowledge/ 投影`，全部活链接、canonical 自指。
- 解除冻结（增删 URL、改 BASE 域名、允许 redirect/非 200）须人工评审后连带更新 sitemap 生成器与门禁。

## 5. 变更手续

- 增删 KP：走 KBL（P28-33 单向重建 `npm run build:knowledge`）→ `npm run generate:sitemap` 重新生成 → 门禁复验。
- 顶层公共页增删：同步 `scripts/generate-sitemap.js` `STATIC_PAGES` 与本门禁 `TOP_OFFICIAL`，且逐页补 canonical。
- 任何 URL 出现 3xx/非 200/缺 canonical：一律视为违约，禁止绕过门禁发布。