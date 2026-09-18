# P16 KBL 成果审计报告

> 审计日期：2026-09-15 ｜ 只读审计（未修改任何业务代码/数据）
> 基线与命令：`npm test` EXIT=0（65 PASS）＋ `kbl:verify` 9 步 ALL PASS，rootHash `18a21dfb…`

---

## 1. KBL 实际结构

```text
kbl/root/小学G1-G6数学知识点.xlsx        ← 唯一人工源（50 KB，375 行）
   ↓ READ ONLY（extract-source.js:19 仅 readFileSync/statSync/sha256，0 写回）
kbl/import/extract-raw.json              ← Extract 产物（含 course/units/knowledge/stats/指纹）
   ↓ derive-kbl.js
kbl/canonical/{capability,mappings}.json ← 程序派生 ✅
kbl/canonical/{course,knowledge,relations}.json ← 历史产物，无写者 ⚠️（见 §2）
   ↓ emit-canonical.js
kbl/data|relations|mappings|index        ← 发布布局（375 KP / 98 单元 / 0 关系 / 1570 映射）
   ↓ build.js（镜像 + sha256 + rootHash）
shared/knowledge/… 10 文件 + manifest     ← 运行时数据（read-only，loader 校验 rootHash）
   ↓ knowledge-runtime → knowledge-context.js（global KnowledgeContext / KC）
POL / orchestration → strategyView（KBL→POL 边界）
```

- 数据单一事实：`kbl/`（catalog）；运行时镜像 `shared/knowledge/`（build 产物）。
- 全仓无 `shared/knowledge/` 之外的知识 JSON 副本（唯一例外 `shared/capacity/capacity-map.json` ＝ POL 容量派生缓存，非知识事实，见 §3）。
- 已删迁移载体：`kbl/input/KBL-Course-Input.xlsx`、`kbl/baseline/`（归档 `migration/archive/baseline-migration/`）、旧发布快照 3 个、`import-excel/export-excel/normalize` 三工具（P16-07）。

## 2. Root → Runtime 数据链审计

| 环节 | 结论 | 证据 |
|---|---|---|
| Root 唯一性 | ✅ 成立 | `kbl/manifest/source-manifest.json` 声明唯一源（P16-01）；superseded 仅记录旧 input |
| Root 只读 | ✅ 成立 | `extract-source.js` 全局仅 1 处 `writeFileSync`（→`extract-raw.json`），对 root 仅 `readFileSync/statSync/sha256`；xlsx 工具无写回 |
| Extract 从 Root 产生 | ✅ 成立 | `SOURCE_FILE = kbl/root/…xlsx`；输出含 root 指纹（fileHash/fileSize/mtime） |
| Canonical 派生 | ⚠️ **部分断裂** | `capability/mappings` 由 `derive-kbl.js` 从 extract-raw 程序派生 ✅；**`course/knowledge/relations` 三个 canonical 文件全仓 0 写入者**（仅 emit/validate 读取）——根因：P16-05 一次性历史产物，源链"可重生性"对这三个文件不成立。extract-raw 已含同名素料（course/knowledge），补写者可行 |
| Runtime 只读 | ✅ 成立 | `knowledge-loader.js` 仅 `readFileSync` 10 个 dist 文件 + manifest 完整性（rootHash）校验；无任何写路径 |
| 旧知识源残留 | ✅ 已清零 | 21 项 LEGACY_FILES 全删；旧输入 Excel 已删；`sw.js`/HTML 无旧文件引用；`shared/knowledge/` 目录树仅 runtime/数据/schema 无旧层 |

**关键结论**：知识事实链（Runtime→POL 全绿）成立；canonical 三文件属"工具链可重生性缺口"，不构成运行时错误，判定为【潜在断链／建议修复】。

## 3. 旧知识数据清理结果

| 项 | 分类 | 说明 |
|---|---|---|
| 21 个 legacy 知识文件（knowledge-bank/math/point/ontology/factual/operation/error + 9 个 ontology-map） | ✅ 已删除 | 仓库 0 残留 |
| `kbl/input/KBL-Course-Input.xlsx` | ✅ 已删除 | 唯一源已为 root |
| 旧发布快照 kbl-math-v1.0.0-{45b9,47ba,5439} | ✅ 已删除 | 保留当前 18a21dfb |
| `import-excel/export-excel/normalize.js` | ✅ 已删除 | 迁移期工具，canonical 链取代 |
| `docs/human-data-requests/f-type-2-affected-kps.csv` | 🔶 迁移／归档 | 旧 598 集受影响清单；F-TYPE-2 已收口且新数据 0/375 错型，作历史书证移入 `migration/archive/` 或保留 |
| `shared/capacity/capacity-map.json` | ✅ 保留 | POL 规划层派生缓存（非知识事实源，`capacity-inventory.js` 生成/读取） |
| `register.knowledgePoints` 内 261 条 legacy KP id | 🔶 迁移（受控保留） | 绑定元数据非知识事实；`generator-selector.js:238` 运行时 `indexOf` 读取但恒不命中 canonical 375 → 行为无影响；M2-R05 判 WARN，登记待 B6 数据清理 |
| 重复 mapping / capability | ✅ 无重复 | mappings 1570 按 (knowledgeId|questionType|capability) 零重复；canonical capability 375 个唯一 |
| knowledge catalog / static knowledge 第二入口 | ✅ 无 | `shared/catalog/*` 均经 KnowledgeContext/Runtime 消费，不直读数据 |

## 4. 冗余验证 / 门禁 / 检验清册（dev 47 脚本 + tools 9 工具）

全仓字符串引用扫描：**孤儿脚本 = 0**。分类如下：

| 类别 | 脚本 | 判定 |
|---|---|---|
| 核心运行保护 | `verify-kbl-runtime`、`check-kbl-quality`（M17）、`verify:f-type-2`、`test:kbl-uniqueness`、`test:pol-kbl-shape` | 保留（每项语义唯一，见 §6） |
| 必要边界保护 | `check-knowledge-access`（单入口）、`check-generator-capability`（M2-R05）、`verify:frozen-core` | 保留 |
| 开发期测试 | `test:pol-generation`、`test:difficulty*`、`verify:m0/m2/m3/m4`、`verify-golden`、`check-comprehensive-pipeline`、SVG/syntax/layers/type-consistency 等 | 保留（npm test 链 65 PASS） |
| 构建期生成 | `build-strategy-bundle`、`build-presentation-bundle`、`build-knowledge-runtime`、`build-knowledge-pages` | 保留 |
| 重复验证 | M17-Q8（运行时一致性）与 verify-kbl-runtime 有重叠；M17-Q9 与 runtime E2E rootHash 重叠 | 保留（成本低、断言角度不同）；**不因"看起来重复"即删** |
| 历史残留 | `check-capability-matrix.js` 注释"549 KP"过时（行为读 `totalKp` 动态，verify-m2 链有效）；`difficulty-anchor-table.js`（被难度门禁引用） | 注释更新即可；无失效门禁 |
| 无效探针 | `dev/audit/`（kp-coverage-probe 已删） | 目录已不存在，无残留 |

**结论**：无"应删除"验证脚本。结论符合原则——保护链 ≈ 最小集，未发现"验证大于核心运行链"。

## 5. 应删除项

1. （可选归档）`docs/human-data-requests/f-type-2-affected-kps.csv` → 移 `migration/archive/`。
2. （工具链，非运行面）暂无其它。孤儿 canonical 三文件**不是删除**，而是补"重建写者"（见 §9 建议）。

## 6. 必须保留的最小边界保护

```text
Root Excel ── READ ONLY + source-manifest 唯一源声明（P16-01）
   ↓
Extractor ── source 缺失/指纹校验、schema validity（SOURCE_001）、canonical ID 完整性（ID_RE/UNIT_RE）
   ↓
KBL Runtime ── loader rootHash 完整性 + manifest.integrity 校验；只读 API；publicApi 白名单
   ↓
KnowledgeContext ── 仅经 App.KNOWLEDGE 单入口（getRuntime），KBL→POL 投影 contract（shape 兜底）
```

反向链全查（§边界）：

| 反向/越界链 | 结果 | 证据 |
|---|---|---|
| POL → 修改 KBL | ✅ 无 | orchestration/presentation 无任何 `writeFileSync/fs.write` |
| Generation → 读取旧 KB | ✅ 无直读 | generator/registry/selector 中 `knowledge-point.js` 由 bundle shim → Compat 委托到 KBL Runtime（受控接线，非直读数据） |
| UI → 直接读 Canonical | ✅ 无 | select.html/practice.html 仅加载 `shared/knowledge/runtime/knowledge-runtime.js`（单入口） |
| Generator → 直接读 KBL 文件 | ✅ 无 | 生产 generator 无 `require(../knowledge/data)` / json 直读；`selector.js:238` 读 registry 绑定表（元数据，见 §3） |
| KBL → 反向调用 Generation | ✅ 无 | `shared/knowledge/runtime/*` 无 generator/orchestration 依赖 |

## 7. KBL → POL 接缝

- 载体：`KnowledgeContext`（`shared/orchestration/knowledge-context.js`）三视图 `adaptKp / strategyView / uiKp` + `strategyViewFor`（合成样本）。
- POL 消费：`practice-orchestrator.js:175` 经 `KC.strategyView(kpIds[i])`；`difficulty-orchestrator` 同源。
- 契约：shape-drift 已固化为 `test:pol-kbl-shape`（14/14，缺省统一 null、spiral={1,1}、cognition 不猜测）。
- 结论：✅ 接缝贯通，无第二入口。

## 8. POL → Generation 接缝

- POL 规划（`pool + capacity`，`capacity-map.json` 封顶）→ Strategy（requested/supported 类型交集）→ `generation-engine` → GeneratorRegistry 选型（`generator-registry`/`generator-selector`）。
- 选型确定性：`verify:golden` 15/15 服务端可复现；`test:pol-generation` 58/58（含容量回收/Scope 守卫）。
- 已知受控：`generator-selector.js:238` 读 registry legacy 绑定（评分恒 0，不影响选择）；compat 桥接线受控。
- 结论：✅ 贯通（F-TYPE-2 数据面错型 0/375 已由 `verify:f-type-2` 锁定）；空 relations 集下无剩余多题型退化面。

## 9. 当前全项目断链图

```text
Root Excel            ✅ 唯一 + 只读
   ↓ Python 无关
Extractor           ✅ extract-source（只读，指纹校验）
   ↓
Canonical KBL       ⚠️ capability/mappings 程序派生 ✅；
                    course/knowledge/relations 无写者（历史产物）
   ↓
KBL Runtime          ✅ loader + rootHash 完整性；只读
   ↓
KnowledgeContext     ✅ 单入口（App.KNOWLEDGE）
   ↓
POL                  ✅ strategyView（practice-orchestrator:175）
   ↓
Generation           ⚠️ registry 内含 261 legacy 绑定（元数据，
                    selector 读取但恒不命中）；生成链路功能无损
   ↓
Validator            ✅ batch/scope 校验（pol-generation 58/58）
   ↓
SemanticQuestion     ✅（golden 15/15 一致）
   ↓
Presentation         ✅（renderer/SVG/sw 缓存 EXIT=0）
```

精确断链定位：
1. **【工具链·非运行时】canonical course/knowledge/relations 无程序化写者** → 若误删文件，`emit-canonical` 直接崩溃且无法从 root 重生。影响：可重生性主张不完整；不影响发布运行时。
2. **【受控·非功能断链】generator-registry 绑定元数据含 261 旧 ID** → functional 无（恒不命中），数据治理残留（M2-R05 WARN）。

## 10. P16 最终冻结判断

- **知识事实链（Root→Runtime KnowledgeContext→POL→Generation→Presentation）**：贯通、只读、单入口、rootHash 可复现（`18a21dfb…`）、`npm test` EXIT=0（65 PASS）＋ `kbl:verify` 9 步 ALL PASS。
- **可冻结**：运行时交付物（dist 10 文件 + loader + context + 边界保护）。冻结基线 = 当前 rootHash + `kbl:verify` 链 + `test:pol-*` 矩阵（`docs/p16-test-matrix.md`）。
- **建议（非阻断，登记 P16-后续）**：
  a) 为 `course/knowledge/relations` 补 derive 写者（从 extract-raw 派生，恢复 canonical 全量可重生；roundtrip 幂等断言扩展至 canonical 5 文件）。
  b) `generator-registry` 绑定数组同步 261 legacy 清理（仅数据，需 B6 授权 + frozen 迁移签字）。
  c) `check-capability-matrix.js` 注释 "549 KP" 更新为动态口径。

报告结束：P16 KBL 收口达成；无运行时断链，2 个工具链/数据治理建议项待后续授权落实。