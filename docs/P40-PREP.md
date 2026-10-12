# P40-PREP — KBL 派生器数据清洗重构 + 项目文件清洗（准备稿）

> **性质：准备稿，非任务书。** 战役编号、立项与否、范围裁剪以用户显式指令为准；立项时本稿内容转入对应 `docs/PXX/PXX-TASK-BOOK.md`，本文件随立项归档或删除。
> 依据：用户 2026-10-12 指令「整理开发文档…并为项目 KBL 层数据清洗重构派生器、项目文件清洗做准备」。
> 数据现状口径：375 KP / 98 Units / 373 Relations / 1570 mappings；npm test 762/762；check-all 31 项（本地 30/0/1）；图形类型白名单 `geometry/chart/diagram/currency` + `custom`。详见 `docs/00-BASELINE.md`。

---

## 一、KBL 派生器数据清洗重构 · 准备清单

### 1.1 现状派生链（唯一链，重构对象是链内脚本的内部组织，禁止新建第二链）

**T1（canonical 事实层）**，一键 `npm run kbl:rebuild`：

```
Root Excel (kbl/root/, T0 只读)
→ tools/kbl/extract-source.js   → kbl/import/extract-raw.json
→ tools/kbl/derive-kbl.js       → kbl/canonical/{course,knowledge,capability,mappings}（relations 先置空集）
→ tools/kbl/derive-relations.js → kbl/canonical/relations.json（R-REL-01/02/03 → 373）
→ tools/kbl/emit-canonical.js   → kbl/data · relations · mappings · index（发射副本）
→ tools/kbl/build.js            → shared/knowledge 镜像 + manifest(rootHash)
→ dev/build-knowledge-runtime.js + build-knowledge-pages.js → runtime bundle + knowledge/*.html
```

**T2（教学语义层）**，`kbl/teaching/*.json` 唯一可写方：

| 产物 | 派生器 |
|---|---|
| qt-intent / qt-intent-review / intent-relations | `dev/p25/derive-qt-intent.js` |
| evidence-rules | `tools/kbl/derive-bc-evidence-rules.js`、`dev/p25/derive-evidence-candidates.js` |
| semantic-families | `dev/p25/derive-semantic-families.js` |
| variation-profiles | `dev/p27/derive-variation-profiles.js` |
| misconception-profiles | `dev/p27/derive-misconceptions.js` |
| type-contracts / golden-questions / semantic-matrix | `dev/p25/build-baseline.js` 等 P25 派生 |

运行时投影：`shared/knowledge/teaching/`（镜像副本）+ `qt-intent-runtime.json`（P38 新增合法投影）。写方白名单规则见 `.trae/rules/ai-coding-workflow.md` §2（T0–T3 分级）。

### 1.2 已知清洗点（均有取证先例，非猜测）

| # | 清洗点 | 证据 | 重构方向 |
|---|---|---|---|
| 1 | `derive-qt-intent.js` 推导规则为逐案扩 regex，非声明式决策表 | P38-08 根因澄清 + P38-GEN-01（needs-review 284→2）+ GEN-02（2→0）；规则可维护性差是 141→284 条挂账的根因 | 规则表收敛为声明式结构（同文件内重组织，行为等价）；新 KP 扩容时只补表不补代码分支 |
| 2 | T2 双源镜像漂移窗口 | `misconception-profiles.json` shared 副本 923 slot vs kbl 源 917，漂移 6 slot 自 P32 期 46490ec 起未重冻（P39-01 修正） | `kbl:rebuild` 链尾自动 diff kbl/teaching ↔ shared/knowledge/teaching，漂移即 FAIL（挂现有 build.js 或 M0，不新建门禁文件则挂 verify-m0 现有步骤内） |
| 3 | `derive-relations.js` R-REL-01/02/03 族表硬编码在代码内 | 277+58+38=373 的 11 概念族为代码内常量（00-BASELINE §Relations 记载） | 族表声明化（同文件内），产出不变（重跑 hash 全等） |
| 4 | T2 三意图文件 SSOT 声明不显式 | qt-intent.json（评审前）/ qt-intent-review.json（评审回流的唯一可写差异面）/ qt-intent-runtime.json（P38 运行时投影）三文件关系散落在派生器代码里 | 在 02-KBL §4 补一张 T2 产物↔派生器↔消费方对账表（文档任务，随重构一并落） |
| 5 | 02-KBL §4 白名单表未列全 P33 后新增派生脚本 | §4 现表止于 P25/P27 六脚本；`derive-bc-evidence-rules.js` 等未入表 | 文档对齐随 P40-04 一并处理 |

### 1.3 重构边界（红线映射）

- T0 Root Excel 不可改；375/98/373/1570 不得变动（除非人工扩容另立项，先例：P38-02 裁决 33 KP 维持剔除）。
- T2 文件必须保持「可由脚本再生」；AI 不手编教学语义 JSON。
- 重构 = 链内脚本内部组织收敛，**不新建顶层目录、不建第二派生链、不加兼容双轨**。
- 派生器改动后必做：`kbl:rebuild` 重放 → 产物 SHA256 与改前全等（确定性红线）→ `build.js` 重建 manifest 指纹 → `emit-canonical.js` 分发同步。

### 1.4 建议任务切分（草案，立项时定案与编号）

| 草案号 | 任务 | 验收口径 |
|---|---|---|
| -01 | derive-qt-intent.js 规则表声明式重构 | 重跑输出与改前逐字节一致；needs-review 保持 0；定向测试通过 |
| -02 | derive-relations.js 族表声明化 | 373 条逐条不变；重放 hash 全等 |
| -03 | T2 副本重冻并入链尾自检 | 人为制造副本漂移可被 kbl:rebuild 拦截 FAIL |
| -04 | 02-KBL §4 白名单/产物对账表补全 | 文档对齐，check-doc-consistency PASS |

### 1.5 局部与全量门禁

- 局部：`npm run verify`（M0 8 步）、`node dev/check-kbl-uniqueness.js`、`node dev/p28/check-kbl-ai-boundary.js`、`node dev/p30/check-kbl-lineage.js`、重放 hash 对账。
- 全量：`node dev/check-all.js` 30 PASS / 0 FAIL / 1 SKIP（CI 31/0/0）；6a 1570、6b/6e 矩阵不受影响（内容零变化则无需重冻矩阵；若产出变化须走 `check-generation-matrix-frozen --write` 重冻）。

---

## 二、项目文件清洗 · 准备清单

### 2.1 方法论（P39 已固化，直接沿用）

三方印证（全库消费者 grep + 门禁 21/22 + 测试面）→ 物理删除不留壳（禁止 shim/COMPAT）→ 断言随证据重写为防双轨负断言 → 重建受影响 bundle + check-all → 记 change-log。扫描范围建议：上次部署节点（c72bb11）→ HEAD 全量 diff + 工作区未提交面（P39-02 首扫后新增改动均需增量覆盖）。

### 2.2 候选清单（✅ 已全部处置完毕 — 2026-10-12，P39-06~08；本节转为处置记录，防后续会话误判存在未处置项）

| 候选 | 处置结果 | 证据（P39 change-log） |
|---|---|---|
| `.DS_Store` 全库 | ✅ 物理删除归零（排除 node_modules/.git） | P39-08 |
| `dev/reports/`、`dev/p2X/reports/` | ✅ 删除；门禁重跑即再生（已实证） | P39-08 |
| `release/`（根，gitignored） | ✅ 整目录删除（9 文件三版打包产物，可再生） | P39-08 |
| `kbl/releases/kbl-math-v1.0.0-18a21dfb/` + latest.json | ✅ git rm 12 tracked 文件；三方印证通过（publish.js 唯一写方、门禁仅排除项、latest.json 零读取方） | P39-08 |
| 根 `archive/`（6 子目录 + 空壳） | ✅ 整目录物理删除（96 文件/1.1M，零 tracked，引用面仅冻结档案） | P39-07 |
| `docs/audit/answer-system-audit-report.md` | ✅ 归档至 `docs/archive/phases/audit/`（git rename），`docs/audit/` 删除 | P39-06 |
| `migration/knowledge-access-expectations.json` | **保留（活文件）**：M0 第 4 步 kbl-access 门禁基线，`dev/check-knowledge-access.js` 消费 | P39-06 复核 PASS |
| P34~P39 临时取证脚本 | 无残留（P38/P39 收口时已清零） | P39-02 六维扫描 |

删除后断链专项核查（四面扫描）结论：活代码/运行时（sw.js 零命中）/SEO 文件（robots+llms 的 archive 隔离声明为 P28-34 门禁断言对象，保留正确）/现行文档链接（零断链）——全部干净；`dev/p28/reports/*.json` 中已删路径条目为门禁纯输出产物（build-baseline.js writeJson），可再生非断链。全量 check-all 30 PASS / 0 FAIL / 1 SKIP（2026-10-12 实测）。

### 2.3 明确不在清洗范围（防误删）

- `kbl/canonical/*.json`、`kbl/import/extract-raw.json`（冻结数据/快照）、`kbl/manifest/`（rootHash 指纹）。
- `docs/archive/phases/`（历史归档，append-only 纪律保护）。
- `dev/p25|p27|p28|p30|p32` 全部脚本（T1/T2 派生白名单 + 正式门禁 = 审计证据链）。
- `shared/engine/*.bundle.js`（预构建运行时，必须提交）。
- `shared/knowledge/teaching/`（T3 运行时只读副本，只能由派生链再生，不是死文件）。

---

## 三、两役依赖关系

1. 先 **KBL 派生器重构**（动 T1/T2 数据与派生链）→ 后 **文件清洗**（避免清洗期与派生器改造期交叉产生假死代码判定）。
2. 文件清洗中 `kbl/releases` 快照裁决独立于派生器重构，可并行或后置。
3. 文件清洗部分**已执行完毕**（2026-10-12，P39-06~08，见 §2.2 处置记录）；KBL 派生器重构部分未立项，仍为准备稿。
