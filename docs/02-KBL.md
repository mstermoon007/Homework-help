# 02-KBL — 知识库事实源

> 状态：FROZEN
> 涵盖：P28-04（源数据收口）/ P28-05（Deterministic Build）/ P28-06（历史数据隔离）/ P28-33（KBL→页面→AI 单向边界）

## 1. KBL 事实（冻结）

| 项 | 值 | SSOT |
|---|---|---|
| KP | **375** | `kbl/canonical/knowledge.json` |
| Units | **98** | `kbl/canonical/course.json` |
| Relations | **373**（全 `inferred:true` / `prerequisite` / `llm-finalized-dev`：R-REL-01 277 + R-REL-02 58 + R-REL-03 38） | `kbl/canonical/relations.json`（唯一派生真源） |
| ALLOW 映射 | **1570** | `kbl/canonical/mappings.json` |
| Canonical ID | `{subject}-{grade}-{book}-u{nn}-k{nnn}` | KBL Runtime |
| Root Excel | `kbl/root/小学G1-G6数学知识点.xlsx` | 人工维护，AI 不得修改 |

## 2. 唯一构建链（KBL 派生；P30-02 锁定）

```
Root Excel（kbl/root/，T0 人工事实源，只读）
  → tools/kbl/extract-source.js      → kbl/import/extract-raw.json
  → tools/kbl/derive-kbl.js          → kbl/canonical/{course,knowledge,capability,mappings,relations(空集)}
  → tools/kbl/derive-relations.js    → kbl/canonical/relations.json（373 inferred，覆盖空集）
  → tools/kbl/emit-canonical.js      → kbl/data · kbl/relations · kbl/mappings · kbl/index（发射副本）
  → tools/kbl/build.js               → shared/knowledge 运行时镜像 + manifest（rootHash）
  → dev/build-knowledge-runtime.js + dev/build-knowledge-pages.js → runtime bundle + knowledge/*.html
```

一键有序重建（顺序固定，禁止单跑 derive-kbl 后跳过 derive-relations，否则 relations 被空集覆盖）：

```bash
npm run kbl:rebuild   # = kbl:extract → kbl:derive（derive-kbl→derive-relations→emit→build）→ build:knowledge
```

### 真源 vs 发射副本（禁止双写）

| 数据 | 唯一派生真源（仅白名单脚本可写） | 发射副本（只读，只能由发射链再生） |
|---|---|---|
| Relations | `kbl/canonical/relations.json`（`derive-relations.js` 专责） | `kbl/relations/math/relations.json`、`shared/knowledge/relations/math/relations.json` |
| Mappings | `kbl/canonical/mappings.json`（`derive-kbl.js`） | `kbl/mappings/generation-contract/math.json`、`shared/knowledge/mappings/generation-contract/math.json`（emit 剥离 `derivation` 字段） |
| KP / 课程树 / index | `kbl/canonical/{knowledge,course}.json` | `kbl/data/**`、`shared/knowledge/data/**`、两 `index/index.json` |

血缘门禁：`node dev/p30/check-kbl-lineage.js`（L1 Excel 指纹→L6 rootHash 全等；副本漂移即 FAIL）。

## 3. Deterministic Build（P28-05）

同一 Excel 多次 derive 产出 SHA256 完全一致。禁止进入 canonical 数据：
- `generatedAt`
- random ID
- random ordering
- environment-specific path

`kbl/canonical/` 下无 `generatedAt` / `random` 关键字；`manifest.rootHash` 锁定。

## 4. KBL 写方白名单（唯一可写方 = 离线派生工具链）

KBL 唯一可写方为离线派生/评审/收口工具，全部人工驱动，不存在运行时写路径。**下表与门禁白名单 `dev/p28/check-kbl-ai-boundary.js` 的 `KBL_WRITER_WHITELIST` 一一对账**（P40-T-13：补全 P33 后新增脚本，二者必须同增同改）：

| 脚本 | 职责 | 写入目标 |
|---|---|---|
| `tools/kbl/extract-source.js` | Root Excel → 原始抽取 | `kbl/import/` |
| `tools/kbl/derive-kbl.js` | Canonical 派生入口（relations 先置空集；P40-T-05：capability 加 `familyId`/`stageOrder`） | `kbl/canonical/` |
| `tools/kbl/derive-relations.js` | 前置关系唯一派生（必须紧随 derive-kbl；P40-T-02/T-04：族表声明化 + R-REL-03 evolution） | `kbl/canonical/relations.json` |
| `tools/kbl/derive-bc-evidence-rules.js` | B/C 通用算法 KP evidence 规则 | `kbl/teaching/evidence-rules.json` |
| `tools/kbl/emit-canonical.js` | Canonical → 运行时分发（发射副本，禁止手改；P40-T-05：透出 `semantic.conceptFamily`） | `kbl/data`、`kbl/relations`、`kbl/mappings`、`kbl/index` |
| `tools/kbl/build.js` | 镜像发布 + 完整性指纹（P40-T-03：T2 副本漂移自检） | `kbl/manifest/` |
| `tools/kbl/publish.js` | 快照/发布 | `kbl/releases/` |
| `dev/p25/build-baseline.js` | 基线建档（kp-matrix / generation-matrix 派生） | `kbl/teaching/` |
| `dev/p25/derive-qt-intent.js` | 意图矩阵（人工评审升级 confirmed；P40-T-01：推导表声明化） | `kbl/teaching/qt-intent.json` |
| `dev/p25/derive-evidence-candidates.js` | 候选草稿 | `kbl/teaching/` |
| `dev/p25/apply-evidence-candidates.js` | 审后合并 evidence 规则 | `kbl/teaching/evidence-rules.json` |
| `dev/p25/build-golden-dataset.js` | 金题集 | `kbl/teaching/golden-questions.json` |
| `dev/p25/derive-semantic-families.js` | 语义族映射 | `kbl/teaching/semantic-families.json` |
| `dev/p25/draft-semantic-matrix.js` | 评审草稿（回灌走 KBL） | `kbl/teaching/semantic-review.json` |
| `dev/p25/import-qt-intent-review.js` | 人工评审抄账 | `kbl/teaching/qt-intent-review.json` |
| `dev/p27/derive-variation-profiles.js` | 变式剖面 | `kbl/teaching/variation-profiles.json` |
| `dev/p27/derive-misconceptions.js` | 迷思剖面 | `kbl/teaching/misconception-profiles.json` |

公开面/消费方脚本（sitemap/crawl/build-knowledge-pages/check-*）**一律只读**消费 KBL。

### 产物 ↔ 派生器 ↔ 消费方 对账表（P40-T-13：只读消费链单一入口）

| 产物 | 唯一派生器（唯一可写） | 只读消费方 |
|---|---|---|
| `kbl/canonical/{course,knowledge,capability,mappings}.json` | `tools/kbl/derive-kbl.js` | `emit-canonical.js` → 发射副本；`dev/p30/check-kbl-lineage.js` |
| `kbl/canonical/relations.json`（含 evolution） | `tools/kbl/derive-relations.js` | `emit-canonical.js` → `kbl/relations`；运行时 `relationsFor` |
| `kbl/data/**`（发射副本，含 `semantic.conceptFamily`） | `tools/kbl/emit-canonical.js` | `tools/kbl/build.js` → `shared/knowledge` 镜像；静态页 |
| `kbl/teaching/qt-intent.json` | `dev/p25/derive-qt-intent.js` | `tools/kbl/build.js` → `qt-intent-runtime`；`semantic-parameters.resolve`（只读透出） |
| `kbl/teaching/context-library.json` | `tools/kbl/derive-*`（P40-Q-13 冻结，评审 confirmed） | `build.js` → 运行时；`semantic-parameters.getContextData` |
| `kbl/manifest/manifest.json`（`rootHash`） | `tools/kbl/build.js` | `dev/p30/check-kbl-lineage.js`（L1 Excel→L6 rootHash 全等） |
| `shared/knowledge/**`（运行时镜像） | `tools/kbl/build.js` + `dev/build-knowledge-runtime.js` | KnowledgeContext / KnowledgeRuntime（只读） |
| `knowledge/*.html`、`sitemap.xml`、`llms.txt` | `dev/build-knowledge-pages.js`、`scripts/generate-sitemap.js`、`scripts/*` | SEO / AI / Crawler / LLM（只读） |

> 单一入口纪律：任何消费方（含生成器、策略、展示、EI）只经 `shared/knowledge/runtime/*` 或 `KnowledgeContext` 读 KBL，**不得直读 `kbl/`**；新增写方必须先入 `KBL_WRITER_WHITELIST` 并同步本表。

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
- 冻结文档/历史报告隔离保留于 `docs/archive/`；`migration/` 一次性提取档案已随 P28-CLEANUP-02 清除，仅余访问门禁基线 `migration/knowledge-access-expectations.json`
- 兼容桥 `KnowledgeBankCompat` → `KnowledgeCompat` 与旧模块键 `shared/knowledge/knowledge-bank.js` 已随 FINAL-22 物理删除（无消费者，不保留兼容层）

### 门禁

```bash
node dev/check-kbl-uniqueness.js   # 旧词再出现即违规
node dev/p28/check-kbl-ai-boundary.js   # 回写白名单 + 页面漂移 + 公开面驻留
```

## 7. 概念族 / 序规则 / evolution 口径（P40-T-13 冻结声明，E8）

> 口径自 P40 战役二起冻结。以下规则以**命名常量**固化在派生器内（可独立审计）；**变更须走「改常量 → `npm run kbl:derive` 派生器重跑 → `build:knowledge` → 重冻基线快照」流程**，禁止手改产物或绕过派生器。

| 规则 ID | 口径 | SSOT（命名常量） | 门禁/证据 |
|---|---|---|---|
| **R-FAM-01** 族定义三规则 | ①同运算/概念主线归族；②族内 `stageOrder` 全序无并列；③一 KP 一主族（副族 `secondaryFamilies` 不落盘，挂账待需） | `derive-relations.js` `CONCEPT_FAMILIES`（11 主干族）/ `EXTRA_FAMILIES`（14 非主干族）/ `FAMILY_RULES` | `validateFamilyTable()`（同名多族/同族多名/阶段数不符/op 非法即抛错）；T-12 ②③ |
| **R-FAM-02** stageOrder 排序五规则 | `grade → volume(up<down) → unit_no → 教材行序(knowledgeNo)`；选学/拓展排核心之后，允许小数序 | `derive-relations.js` `computeStageOrders()` | T-12 ②（族内无重复、按序年级非递减） |
| **R-FAM-03** evolution 落边口径 | R-REL-03 的 38 边携带 `evolution{familyId,fromStageOrder,toStageOrder,op}`；`op` 机械判定（数域关键词→`extend_number`；步骤/括号→`increase_complexity`；认数→计算→`abstract_up`；加减/乘除对→`inverse`） | `derive-relations.js` 内联判定 + `CONCEPT_FAMILIES[].ops` | `validateEvolution()`（同族严格递增/年级不倒挂/跨族图无环）；T-12 ①④ |
| **R-FAM-04** 口径边界 | evolution 只加属性、**不增边**（边数 373 不变）；`familyId`/`stageOrder` 经 `emit-canonical` 透出 `semantic.conceptFamily`；跨族前置族投影（T-06）为纯校验不落盘 | `derive-relations.js` `reportCrossFamily()` | T-12 快照；`dev/p40/out/t06`、`t12-regression-baseline.json` |

- **公开契约冻结**：`knowledge-contract.js` `PUBLIC_API` 保持既有 13 项，**不新增族相关方法**；`familyId`/`stageOrder` 仅经既有 `capability` / `relationsFor` 口只读可及（T-11 契约测试）。
- **已知观察项（needs-review，非数据违规）**：T-06 族投影存在族间环（`fam_multiply ⇄ fam_divide` 等），根因为共享单元（如「7～9的表内乘、除法」）多族归属被 primary-family 折叠所致；KP 级 canonical 373 前置边为无环 DAG（T-12 ④ 权威判据），故登记观察不自动改数。

## 8. 版本迁移挂账（P40-T-13，E7）

**多版本 Excel 共存属基线扩容，本战役不做**：当前 Root Excel 为单版本（`kbl/root/小学G1-G6数学知识点.xlsx`），唯一构建链假定单 T0 真源。多版本共存（如多教材版本 lineage 并行）涉及指纹体系、`rootHash` 语义、族表跨版本映射与 6b/6c/6e 多矩阵并存，属独立立项范围，**未经用户显式指令不开工**。挂账登记见 `docs/P40/P40-TASK-BOOK.md` §2.3 T-13 与 `docs/P40/change-log.md`。
