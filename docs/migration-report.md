# 知识库 ID 迁移审计报告（2026-08-23）

## 一、迁移概述

本次将 `shared/knowledge-bank.js` 全部 356 个知识点的 ID 从旧命名统一迁移为
**三段式新 ID**：`g{grade}-{moduleIdLower}-{baseSlug}`。

- **旧命名问题**：ID 不带模块信息，且部分竞赛模块 ID（如 `c1-vertical`）在 4/5/6 年级间重复，
  无法作为全局唯一标识。
- **新命名**：`g{年级}-{模块小写}-{语义 slug}`，全小写 + 数字 + 连字符；同主题跨年级 baseSlug 保持一致。
- **slug 字典**：`shared/knowledge-slug-map.js`（`KNOWLEDGE_SLUGS`），键为 `{grade}-{baseSlug}`。

## 二、映射示例（旧 → 新）

| 旧 ID | 年级/模块 | 新 ID | 说明 |
| --- | --- | --- | --- |
| `make-ten` | 1 / M0 | `g1-m0-make-ten` | 常规 |
| `addsub-20` | 1 / M1 | `g1-m1-addsub-20` | 常规 |
| `addsub-100` | 2 / M1 | `g2-m1-addsub-100` | 常规 |
| `g4-oral-big` | 4 / M1 | `g4-m1-g4-oral-big` | 常规（高年级带年级前缀） |
| `wp-solve` | 2 / M8 | `g2-m8-solve-problems` | 归一化（解决问题，与 1 年级一致） |
| `compose-4` | 2 / M4 | `g2-m4-compose-digit` | 归一化（数的组成与数位） |
| `g6-fill-unit-convert` | 6 / M4 | `g6-m4-unit-convert` | 归一化（单位换算） |
| `g5-judge-rotate` | 5 / M11 | `g5-m11-motion` | 归一化（图形的运动） |
| `c1-vertical` | 4 / C1 | `g4-c1-c1-vertical` | 竞赛（跨年级共用旧 id，现按年级区分） |
| `c1-vertical` | 5 / C1 | `g5-c1-c1-vertical` | 竞赛 |
| `c1-vertical` | 6 / C1 | `g6-c1-c1-vertical` | 竞赛 |
| `c5-meet` | 4 / C5 | `g4-c5-c5-meet` | 竞赛 |

完整映射见 `archive/migration-20260823/migration-map-final.csv`。

## 三、迁移范围与动作

| 对象 | 动作 |
| --- | --- |
| `shared/knowledge-bank.js` | 全部 356 个知识点 id 替换；新增 `prerequisites` / `related` / `difficulty` / `status` 字段 |
| `knowledge/` 详情页 | 重命名 `{newId}.html`（356 详情 + 76 模块 + 1 索引）；补齐原缺失的 24 个 g5/g6 C4/C6/C7 详情页 |
| 插件 `knowledgePoints` | 49 个插件配置更新为新 id；多年级插件转按年级对象格式 |
| 插件头部注释 | 207 处 g[3-6] 旧 id 注释更新 |
| 文档 | `docs/knowledge-base.md` 改版；`CONTRIBUTING.md` 增加编号规范；`llms.txt` / `seo-monitoring.md` 链接更新 |
| 迁移工具 | 归档至 `archive/migration-20260823/` |

## 四、验证结果

### 4.1 静态校验（全部通过）

| 检查项 | 结果 |
| --- | --- |
| 知识点总数 | 356（映射 356/356，0 缺失） |
| ID 格式 `^g[1-6]-(m[0-9]\|m1[0-2]\|c[1-9])-[a-z0-9-]+$` | 0 违规 |
| ID 全局唯一 | 0 重复 |
| prerequisites / related 引用存在 | 0 悬空 |
| 前置指向更高年级 | 0（高年级前置=错误） |
| 同年级前置 | 211 条（警告，需人工定期复核） |
| status | active 353 / placeholder 3（C9） |
| difficulty | M=1（257）；C：g4=3、g5=4、g6=5（各 33），同主题跨年级不降 |
| 详情页文件一一对应 | 433 文件，0 断链，0 旧命名残留 |
| 插件 knowledgePoints 引用 | 304 处全部有效 |

### 4.2 功能回归（全部通过）

| 测试 | 结果 |
| --- | --- |
| `dev/verify-knowledge-bank.js` / `verify-setup.js` / `check-core-integrity.js` | 全部 exit 0 |
| `dev/coverage.js` | 1–3 年级 100% |
| `dev/regression-check.js` | 118 个插件×年级组合满分回填全部 100% |
| `dev/verify-competition.js` | 8 插件 / 132 组：答案正确、解唯一、题面无重复、键盘等价 |
| 综合练习 grade 4/5/6 | 正常生成，含竞赛模块，**无占位插件内容** |
| `dev/cleanup-scan.js --dry-run` | 仅标记 `.DS_Store`（垃圾文件），无异常 |

### 4.3 已知说明

- `test-difficulty.js` 的 51 项"失败"为**既有测试设计问题**，非迁移回归：占位插件（C9）生成 0 题属预期；
  "5 档×8 题无重复"在低难度小题目池下随机碰撞（重复数随运行变化，已复现确认）。
- C8 竞赛模块在知识库中仅登记于 4 年级（5/6 年级无 C8 知识点，为迁移前既有缺口）。

## 五、归档

迁移脚本、映射表与旧状态备份：

- `archive/migration-20260823/`（迁移脚本 + `migration-map.csv` + `migration-map-final.csv`）
- `archive/knowledge-bank-pre-migrate-20260823.js`（迁移前知识库）
- `archive/knowledge-backup-20260823/`（迁移前 knowledge/ 目录）
- `archive/knowledge-renamed-backup-20260823/`（重命名后、再生成前快照）

## 六、结论

迁移完成、验证通过，旧 ID 仅在归档目录中存在，运行时代码 / 文档 / 页面均使用新 ID。
