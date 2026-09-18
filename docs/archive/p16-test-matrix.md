# P16 测试矩阵与 KBL-GATE（Clean Product Baseline 收口快照）

> 更新时间：2026-09-15 ｜ P16-07 冗余清理 / P16-08 Runtime Cutover 完成后基线
> canonical：375 KP（g1:39 / g2:60 / g3:71 / g4:69 / g5:80 / g6:56）、98 单元、12 册、
> relations 0（释义派生、无迁移关系集）、mappings 1570 全 allow、rootHash `18a21dfb…`

## 1. 数据基线（唯一权威源：`kbl/root/小学G1-G6数学知识点.xlsx`）

| 项 | 值 | 校验门禁 |
|---|---|---|
| 知识点数 | 375 | `kbl:validate`（V1-V5）、M17 Q1/Q8、Runtime E2E |
| 单元数 | 98 | M17 Q1、Runtime E2E |
| 关系数 | 0 | M17 Q2/Q5、Runtime E2E（空语义） |
| 映射数 | 1570（全 allow） | M17 Q6、Runtime E2E |
| rootHash | 18a21dfba5ce…（可复现） | `kbl:roundtrip`（幂等）、M17 Q9、Runtime E2E |
| F-TYPE-2 错型 | 0/375 | `verify:f-type-2`（F1-F5） |

## 2. KBL 管道命令（Package Scripts）

| 命令 | 工具 | 作用 |
|---|---|---|
| `npm run kbl:extract` | tools/kbl/extract-source.js | root Excel → source 提取（只读） |
| `npm run kbl:validate` | tools/kbl/validate.js | canonical 门禁 V1-V5（含 dist 指纹/rootHash） |
| `npm run kbl:build` | tools/kbl/build.js | canonical → shared/knowledge 运行时镜像 + rootHash 回填 |
| `npm run kbl:roundtrip` | tools/kbl/roundtrip.js | root Excel → 双跑重建幂等 + 产物一致 |
| `npm run kbl:publish` | tools/kbl/publish.js | 不可变快照 + latest.json（rootHash 审计） |
| `npm run kbl:verify` | tools/kbl/verify.js | **KBL-GATE 全链**（下节） |

派生链（canonical 重建）：`derive-kbl.js` → `emit-canonical.js`（roundtrip 内触发）。

## 3. KBL-GATE 全链（`node tools/kbl/verify.js`，任一失败即退出 1）

| # | 门禁 | 状态 |
|---|---|---|
| 1 | KBL Validate（Schema/ID/Curriculum/Semantic/Relation/Capability/Lifecycle/Count） | PASS |
| 2 | KBL Roundtrip（Source 往返重建 + 幂等） | PASS |
| 3 | KBL Build（Canonical → Runtime 镜像，rootHash 复现） | PASS |
| 4 | KBL Runtime E2E（Loader/Query/Policy/Index/Hash/白名单） | PASS |
| 5 | KBL Access Audit（单入口封锁，无新增越权访问） | PASS |
| 6 | KBL Generator-Capability Gate（M2-R05 canonical 语义） | PASS |
| 7 | KBL Quality Gate（M17 数据质量 9/9） | PASS |
| 8 | KBL F-Type-2 回归门禁（题型归一零错型 F1-F5） | PASS |
| 9 | KBL Publish（Snapshot + latest.json + rootHash 审计） | PASS |

## 4. 相关独立门禁（npm test 内置）

| 门禁 | 命令 | 覆盖 | 状态 |
|---|---|---|---|
| Golden 15 例 | `verify:golden` | 生成器服务端可复现性 | 15/15 PASS |
| POL 生成 | `test:pol-generation` | 编排全链（容量/回收/Scope） | 58/58 PASS |
| Shape 契约 | `test:pol-kbl-shape` | 三视图缺省/兜底形状 | 14/14 PASS |
| 难度 | `test:difficulty` | 锚点/分布 | 23/23 PASS |
| 难度结构 | `test:difficulty-structure` | 结构约束 | 34/34 PASS |
| 生成器矩阵 | `verify:m4` | core generators / composite / bundle | PASS |
| 唯一性 | `test:kbl-uniqueness` | KBL Runtime 单一事实链 | PASS |
| 冻结核心 | `verify:frozen-core` | baseline 漂移 | PASS |

> 全量 `npm test` EXIT=0，65 项 `[PASS]`＋全链门禁（2026-09-15 canonical 基线）。

## 5. 治理文档（关联）

- `docs/f-type-2-root-cause.md` — 根因 + P16-14 收口状态
- `docs/pol-kbl-pending.md` — POL 待办/受控项登记
- `docs/issue-register.md` — 问题注册表（已收口/受控/待授权/待人工）
- `docs/human-data-requests/README.md` — 人工数据需求汇总（H1-H5）
- `migration/archive/baseline-migration/` — 迁移基线归档（P16-07 移入）