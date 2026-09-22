# 02-KBL — 知识库事实源

> 状态：FROZEN
> 涵盖：P28-04（源数据收口）/ P28-05（Deterministic Build）/ P28-06（历史数据隔离）/ P28-33（KBL→页面→AI 单向边界）

## 1. KBL 事实（冻结）

| 项 | 值 | SSOT |
|---|---|---|
| KP | **375** | `kbl/canonical/knowledge.json` |
| Units | **98** | `kbl/canonical/course.json` |
| Relations | **0** | `kbl/canonical/relations.json` |
| ALLOW 映射 | **1570** | `kbl/canonical/mappings.json` |
| Canonical ID | `{subject}-{grade}-{book}-u{nn}-k{nnn}` | KBL Runtime |
| Root Excel | `kbl/root/小学G1-G6数学知识点.xlsx` | 人工维护，AI 不得修改 |

## 2. 构建链（KBL 派生）

```
Root Excel（kbl/root/）
  → tools/kbl/extract-source.js      → kbl/import/
  → tools/kbl/derive-kbl.js          → kbl/canonical/
  → tools/kbl/emit-canonical.js      → kbl/ 运行时分发
  → tools/kbl/build.js               → kbl/manifest/（完整性指纹）
```

## 3. Deterministic Build（P28-05）

同一 Excel 多次 derive 产出 SHA256 完全一致。禁止进入 canonical 数据：
- `generatedAt`
- random ID
- random ordering
- environment-specific path

`kbl/canonical/` 下无 `generatedAt` / `random` 关键字；`manifest.rootHash` 锁定。

## 4. KBL 写方白名单（唯一可写方 = 离线派生工具链）

KBL 唯一可写方为离线派生/评审/收口工具，全部人工驱动，不存在运行时写路径：

| 脚本 | 职责 | 写入目标 |
|---|---|---|
| `tools/kbl/extract-source.js` | Root Excel → 原始抽取 | `kbl/import/` |
| `tools/kbl/derive-kbl.js` | Canonical 派生入口 | `kbl/canonical/` |
| `tools/kbl/emit-canonical.js` | Canonical → 运行时分发 | `kbl/` |
| `tools/kbl/build.js` | 镜像发布 + 完整性指纹 | `kbl/manifest/` |
| `tools/kbl/publish.js` | 快照/发布 | `kbl/releases/` |
| `dev/p25/build-baseline.js` 等 P25 教学语义派生 | 基线/意图/证据/金题/语义族 | `kbl/teaching/` |
| `dev/p27/derive-variation-profiles.js` | 变式剖面 | `kbl/teaching/` |
| `dev/p27/derive-misconceptions.js` | 迷思剖面 | `kbl/teaching/` |

公开面/消费方脚本（sitemap/crawl/build-knowledge-pages/check-*）**一律只读**消费 KBL。

## 5. KBL → 页面 → AI 单向边界（P28-33）

```
KBL（唯一事实源）
  │ 唯一可写方 = 离线派生白名单
  ▼
Static Page（knowledge/*.html、sitemap.xml）
  │ 仅派生，只读消费；禁止回灌 KBL
  ▼
SEO / AI / Crawler / LLM（只读消费）
```

四条禁令：
- R1 SEO 不得修改 KBL
- R2 AI 不得修改 KBL
- R3 Crawler 不得修改 KBL
- R4 LLM 不得修改 KBL

页面 = KBL 的决定性投影：`knowledge/*.html` 由 `dev/build-knowledge-pages.js` 从 KBL 单向重建，携带 `kbgen:hash` 指纹。漂移判定：`node dev/build-knowledge-pages.js --check`。

## 6. 历史数据隔离（P28-06）

### 审计 Token

| Token | 含义 | 生产代码判定 |
|---|---|---|
| 旧 KP 计数 / 旧 legacy 计数 / 旧 relations 计数 / 旧 mappings 计数 | 旧数据集计数 | 必须 0 |
| `KnowledgeBank` | 旧知识库系统名 | 必须 0 |
| `legacy knowledge` / `legacy id` | 旧知识引用 | 必须 0 |

### 隔离结论

- **当前生产代码**（shared/tools/plugins/页面/scripts/）= **0 命中**
- 历史内容（archive/migration/冻结文档/历史报告）隔离保留
- 兼容桥：`KnowledgeBankCompat` → `KnowledgeCompat`（行为保持，纯接线符号）
- 模块键 `shared/knowledge/knowledge-bank.js` 保留为冻结 Strategy require 标识（结构性接线）

### 门禁

```bash
node dev/check-kbl-uniqueness.js   # 旧词再出现即违规
node dev/p28/check-kbl-ai-boundary.js   # 回写白名单 + 页面漂移 + 公开面驻留
```
