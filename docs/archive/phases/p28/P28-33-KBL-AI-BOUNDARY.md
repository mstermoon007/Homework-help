# P28-33 · KBL → 页面 → AI 数据边界（FROZEN）

> **定位一句话**：公开知识内容**单向**上游：`KBL → Static Page`；**SEO / AI / Crawler / LLM 一律不得反向修改 KBL**。
>
> 状态：**FROZEN**（改此契约 = 改红线，须人工评审；见文末「变更手续」）。

---

## 1. 单向数据流

```
   KBL（唯一事实源）
     │  唯一可写方：离线派生工具链（人工驱动，见 §3 白名单）
     ▼
   Static Page（公开只读面：knowledge/*.html、knowledge-index.*、sitemap.xml）
     │  仅派生，只读消费 KBL；禁止把页面面内容反向回灌 KBL
     ▼
   SEO / AI / Crawler / LLM 消费方（robots.txt、sitemap.xml、llms.txt、爬行体检、LLM 理解体检）
     │  只读消费；任何消费路径都不得触发 KBL 写入
     ▼
   （无任何外部写回通道——纯静态部署，无服务器、无运行时写接口）
```

## 2. 四条禁令（与 P28-31「供数不决策」同级红线）

| # | 禁令 | 技术落地 |
|---|---|---|
| R1 | **SEO 不得修改 KBL** | sitemap.xml/robots.txt/静态页产出脚本一律只写公开面，不回写 `kbl/` |
| R2 | **AI 不得修改 KBL** | llms.txt / AI 友好面（`@import`-link 消费的 KBL Runtime 局域数据）为只读投影；无任何 AI 写回端点 |
| R3 | **Crawler 不得修改 KBL** | 爬虫触达的路径无写接口（纯静态）；`scripts/crawl-site.js` 等爬行/体检脚本只写 `reports/` 报告 |
| R4 | **LLM 不得修改 KBL** | `check-llm-understanding.js` 等理解体检只读消费 KBL Runtime 与静态页，产出报告不落 `kbl/` |

**KBL 唯一可写方 = 离线派生工具链（§3 白名单）**，且全部为**人工驱动的派生/评审/收口**，
不存在由页面/公开面/外部请求触发的运行时写路径。

## 3. KBL 写方白名单（离线派生/评审/收口工具）

机械扫描（`dev/p28/check-kbl-ai-boundary.js` A 项）判定：凡 `writeFile*`/`appendFile*`/`outputFile*` 等
写调用**路径参数**落在 `kbl/` 的脚本，必须 ∈ 下表白名单；否则门禁报「越界回写」。

| 脚本 | 职责 | 写入目标 |
|---|---|---|
| `tools/kbl/extract-source.js` | Root Excel → 原始抽取 | `kbl/import/` |
| `tools/kbl/derive-kbl.js` | Canonical 派生入口 | `kbl/canonical/` |
| `tools/kbl/emit-canonical.js` | Canonical → 运行时分发 | `kbl/` 运行时分发布局 |
| `tools/kbl/build.js` | 镜像发布 + 完整性指纹 | `kbl/manifest/` 等 |
| `tools/kbl/publish.js` | 快照/发布 | `kbl/releases/` |
| `dev/p25/build-baseline.js` | 基线建档 | `kbl/teaching/kp-matrix/` |
| `dev/p25/derive-qt-intent.js` | 题型意图推导（人工升级确认） | `kbl/teaching/qt-intent.json` |
| `dev/p25/derive-evidence-candidates.js` | 证据候选推导 | `kbl/teaching/` |
| `dev/p25/apply-evidence-candidates.js` | 审后合并证据规则 | `kbl/teaching/evidence-rules.json` |
| `dev/p25/build-golden-dataset.js` | 金题集 | `kbl/teaching/golden-questions.json` |
| `dev/p25/derive-semantic-families.js` | 语义族映射 | `kbl/teaching/semantic-families.json` |
| `dev/p25/draft-semantic-matrix.js` | 评审草稿（回灌走 KBL 另行流程） | `kbl/teaching/semantic-review.json` |
| `dev/p25/import-qt-intent-review.js` | 人工评审抄账 | `kbl/teaching/qt-intent-review.json` |
| `dev/p27/derive-variation-profiles.js` | 变式剖面 | `kbl/teaching/variation-profiles.json` |
| `dev/p27/derive-misconceptions.js` | 迷思剖面（独立 overlay） | `kbl/teaching/misconception-profiles.json` |

公开面/消费方脚本（`scripts/generate-sitemap.js`、`scripts/crawl-site.js`、`dev/build-knowledge-pages.js`、
`dev/check-crawl-health.js`、`dev/check-sitemap.js`、`dev/check-llm-understanding.js`、CI）**一律只读**消费 KBL，
写盘目标仅限 `knowledge/`、`sitemap.xml`、`reports/`。

## 4. 页面 = KBL 的决定性投影（漂移即越界）

- `knowledge/*.html` 与 `knowledge-index.*` 由 `dev/build-knowledge-pages.js` 从 KBL Runtime 单向重建；
  页面文件携带确定性内容哈希 `<!-- kbgen:hash=<sha256> -->`（KBL 投影指纹）。
- **漂移判定**：`node dev/build-knowledge-pages.js --check` 逐页比对「当前文件哈希 vs 当前 KBL 投影哈希」，
  任一不一致 = 页面偏离 KBL = 违反单向边界（页面被手工修改，或 KBL 变更后未单向重建页面）。
- `knowledge-index.json` 含 `generatedAt` 快照时间戳，比对时按结构剔除（避免零漂移误报）。

**修复动作（不动 KBL）**：`npm run build:knowledge` 由 KBL 单向重建静态页，连同重建结果重新提交。

> P28-33 治理实录：审计发现 11 个静态页（g2/g4/g5 部分 KP）的 `kbgen:hash` 落后于当前 KBL 投影一版
> （页面正文一致、仅哈希指纹过期——KBL 描述清理后未联动重建）。已按单向规则重建归零，无任何 KBL 改动。

## 5. 门禁（已接入 run-all-checks.sh 第 6 步 `check:kbl-ai-boundary`）

`node dev/p28/check-kbl-ai-boundary.js`（只读，不修改任何文件）：

- **A 回写白名单**：扫描 `dev/ scripts/ tools/ .github/` 全部 JS/SH，提取每个写调用的**路径参数**
  （支持 `path.join(...,'kbl',...)` 多参与 `path.join(ROOT,'kbl','teaching')` 种子常量引用），
  落在 `kbl/` 的调用其宿主文件必须 ∈ §3 白名单；只引用 `kbl/…` 作报告标签（如 provenance 文案）不算写。
- **B 页面漂移**：调用 `build-knowledge-pages.js --check`，要求 0 漂移。
- **C 公开面驻留**：`robots.txt` / `sitemap.xml` / `llms.txt` 须存在（只读公开物随静态页驻留）。

## 6. 变更手续

- 新增 KBL 写方：必须**先**评审其「离线 + 人工驱动」属性，加入 §3 白名单 + 本表，再碰门禁；禁止公开面路径绕过。
- 结构性改变公开面（改静态页生成方式/属性）：由 KBL 单向重建后提交，禁止直接改 `knowledge/` 产物或回灌。
- 解除 FROZEN：须人工评审（同 P28-31 契约纪律）。