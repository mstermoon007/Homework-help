# KBL 迁移报告（标准重建 + 全量迁移 + 旧层删除 + 单入口封锁）

日期：2026-09-12　分支：01page-report
命令验证：`npm run verify:kbl`（= `tools/kbl/verify.js`：validate → roundtrip → build →
runtime E2E → access audit → publish）全通过；`bash scripts/pre-commit.sh` 通过。

## 0. 执行范围（用户确认口径）

- 迁移数据源：**外部 KBL 工程** `~/Code/Homework-Knowledge-Base`（非旧层 `knowledge-math.js` 566）。
- 一次性 ID 迁移；旧 ID→新 ID 映射只存在于 `migration/raw/id-map.json`（收口后删除）。
- Phase E：仅删旧层 + 封入口，69 个下游断链**记录不修复**（用户确认）。

## 1. 数据与数量

| 项 | 迁移源（外部 KBL） | 迁移后（shared/knowledge） |
| --- | --- | --- |
| 知识点 KP | 598（G1 57 / G2 112 / G3 21 / G4 104 / G5 160 / G6 144） | 598（守恒） |
| 单元 | 128 | 128（课程树，逐册重排 unitNo u01…） |
| 关系 | 1293（0 自环 0 重复 100% 解析） | 1293 |
| 生成映射 | 660 | 639（同一 知识Id×题型×capability 的 pluginId 冗余行按《生成契约》去重，permission 全部 allow） |
| 完整性 | — | rootHash `47ba582ea236a467b80a330a7265eff750f8e3feb379079d4b3b965218ca2c7d`（仅数据 10 文件，**确定性**） |

**数量差异说明**：方案文本以旧层 566 为基线；实际迁移源为外部 KBL 598，差异 +32 来自外部库建设
（含端到端演练保留的新 KP `不确定事件的定性判断`，迁移后新 ID `math-g4-up-u09-k001`，
其 related 关系与 2 条 mapping 一并迁移，用户明确保留）。

**rootHash 确定性（本次修正）**：`build.js` 剥离分布数据顶层 `generatedAt`
（时间戳仅保留在源 manifest 溯源），因此 rootHash 仅随内容变化——重跑 normalize/build 不再漂移，
满足「ID/Index/Manifest/Hash 均为可复现产物」；`kbl:verify` 每次发布前重算审计一致。

**Excel 唯一人工输入（O 语义）**：`kbl/input/KBL-Course-Input.xlsx`（7 Sheet，由
`tools/kbl/export-excel.js` 从 canonical 导出）。人工负责课程事实列（grade/book/unitNo/name/module/
family/concept/operations/…），程序化列（knowledgeId/unitId/knowledgeNo/subject/hash/updatedAt/
permission/source）填 `O`；必填列填 O → `import-excel.js` 直接报错。可选/自动值在
`normalize --editorial` 阶段确定性生成并固化。`tools/kbl/roundtrip.js` 门禁保证
Excel↔Canonical 双向一致 + 重建幂等（fix 598 / 128 / 1293 / 639）。

## 2. ID 方案（已固化）

- 知识点：`{subject}-{grade}-{book}-u{unitNo}-k{knowledgeNo}` → 例 `math-g4-up-u09-k001`
- 单元：`{subject}-{grade}-{book}-u{unitNo}` → 例 `math-g4-up-u09`
- family/module/operation/difficulty/cognitive/questionType/capability/weight/status/publication **禁止进入 ID**
- 课程树重排规则：教材顺序（课程线文件顺序）→ 无 KP 的实践/占位单元置尾 → 逐册顺序编号；
  原 X 代码（X01…）与重复 unitNo（G1-up-94…97 同为第 1 单元）经重排消解。

## 3. 交付物

| 位置 | 说明 |
| --- | --- |
| `kbl/input/KBL-Course-Input.xlsx` | **唯一人工输入源**（7 Sheet；程序化列=O，必填列 O 直接报错） |
| `tools/kbl/import-excel.js` | Excel → `migration/excel-raw/`（O 归一 + 门禁：守恒/枚举/重复/去重） |
| `tools/kbl/export-excel.js` | canonical → Excel（自动列回写 O） |
| `tools/kbl/xlsx.js` | 零依赖 xlsx 读写（Node ≥20.15，zlib.crc32） |
| `tools/kbl/normalize.js` | Canonical Transformer（课程树/新 ID/关系/权限/索引/manifest → `kbl/`；`--editorial` 读 Excel） |
| `tools/kbl/validate.js` | 迁移门禁（Schema/ID/课程树/语义/关系/权限/索引/数量守恒） |
| `tools/kbl/build.js` | 镜像 `kbl/` → `shared/knowledge/` + per-file sha256 + **确定性** rootHash |
| `tools/kbl/publish.js` | 发布快照 → `kbl/releases/kbl-math-v1.0.0-<hash8>/`（rootHash 锁定）+ `latest.json`（重算审计） |
| `tools/kbl/verify.js` | 最终门禁：validate→roundtrip→build→runtime→access→publish |
| `tools/kbl/roundtrip.js` | Excel↔Canonical 一致性 + 双重建幂等回归 |
| `shared/knowledge/schema/` | knowledge/curriculum/relation/generation-contract/manifest 五模块 Schema（validate 消费） |
| `shared/knowledge/runtime/` | contract/loader/relation/policy/index/query/api + 浏览器单文件 `knowledge-runtime.js` |
| `dev/verify-kbl-runtime.js` | Runtime E2E（完整性/白名单/查询/权限/索引/关系闭包） |
| `dev/check-knowledge-access.js` | KBL ACCESS AUDIT 静态门禁（new 访问 → FAIL） |
| `dev/build-knowledge-runtime.js` | 生成 `knowledge-runtime.js`（方案 §23 单入口） |
| `migration/knowledge-access-expectations.json` | 访问基线（94 项：tools 11 / legacy-layer 14 / downstream-pending 67 / pages-pending 2） |
| `shared/knowledge/README.md` | 知识库承载说明、契约、ID、权限/难度边界、构建命令、§44 永久规范 |
| `migration/legacy-baseline.json` | 旧层冻结基线（566、关系/映射计数） |
| `shared/knowledge/data|relations|mappings|index|manifest` | 运行时数据面（rootHash 锁定） |

npm scripts：`kbl:import / kbl:export / kbl:normalize / kbl:validate / kbl:build /
kbl:publish / kbl:roundtrip / kbl:bundle-runtime / kbl:verify（= verify:kbl）`。
一次性提取脚本 `kbl:extract` 已停用（`extract-source.js` 删除，见 §Phase E）。

## 4. Phase E（旧层销毁，用户确认范围）

**已删除 14 项**：
`knowledge-bank.js knowledge-math.js knowledge-point.js knowledge-ontology.js
knowledge-ontology-normalizer.js knowledge-ontology-validator.js knowledge-factual.js
knowledge-operation.js knowledge-error.js ontology-book-map.js ontology-category-map.js
ontology-error-map.js ontology-factual-map.js ontology-operation-map.js`

**保留**：`question-type-registry.js`（判定为生成能力域权威，capability/generator/strategy 全链消费，
不在删除清单）；`question-id.js`（下题 ID 运行工具，非知识数据，方案未列）。

**✅ 一次性迁移代码删除（方案 §35）**：`tools/kbl/extract-source.js` 已删除（其输入源
`shared/knowledge/knowledge-math.js` 属本阶段删除对象，工具已失去运行源头）；npm `kbl:extract`
改为提示停用。最终日常工具 = `import-excel / export-excel / xlsx / normalize / validate / build /
publish / roundtrip / verify`。

**✅ 重复产物清理（本次）**：根目录 `shared/strategy-engine.bundle.js` 与
`shared/presentation-engine.bundle.js` 为陈旧重复产物（无任何代码/页面引用，页面与
`check-strategy-bundle` 均走 `shared/engine/`）→ 已删除；`dev/build-strategy-bundle.js`、 
`dev/build-presentation-bundle.js` 写入路径改为 `shared/engine/`（与读者对齐，杜绝再次漂移）。

**pre-commit 重挂**：`scripts/pre-commit.sh` = lint-check → verify:kbl → check-syntax
（原 [2]verify:m4 / [3]verify:m0 / [4]check-knowledge / [5]verify:golden 依赖已删旧层，断链下线）。

## 5. 下游断链清单（记录不修复）

- **verify 链**：`verify:m0`、`verify:m4`、`verify:golden`、`check-knowledge`、`verify:kb*`、
  `check-strategy-bundle` 等因 `require shared/knowledge/knowledge-bank.js` 崩溃（Module not found）。
- **bundle**：`npm run build:strategy / build:presentation` 可执行，但对已删模块写入
  `module.exports = null` 占位；`KnowledgeBank` 仍为浏览器全局 shim。已对齐唯一产物路径
  `shared/engine/strategy-engine.bundle.js` / `shared/engine/presentation-engine.bundle.js`
  （旧根目录重复副本已清理）；*.bundle.js 内嵌旧知识层实现 = 预期保留（方案 §29/§30 标记，
  待 Generator 接入 KBL API 时随重建清除，本阶段只记录）。
- **页面**：`select.html:563`、`practice.html:277` 引用 `shared/knowledge/knowledge-bank.js` → 404；
  策略引擎在取 `KnowledgeBank` 处失败（期望断链）。
- **sw.js**：静态缓存清单仍含 `knowledge-math.js / knowledge-bank.js`（陈旧引用）。
- **数据消费者**：69 个 downstream-pending 文件（capability/capacity/catalog/engine/generation/
  generator/orchestration/presentation/strategy/validator/scripts/tests/e2e）——待接入 `App.KNOWLEDGE`。
- **文档**：archive/ 下各旧方案文档保留不改。

## 6. 难度边界（既定结论，无改动）

KBL 不持难度权威；`difficultyAnnotation`（seedDifficulty/cognitiveLevel/maxSteps/numberRange）仅
标注/排序参考，生成难度由 `shared/catalog/difficulty.js` + `difficulty-static.js` 独占。
独立遗留问题未决：`difficulty-static.js:151` 八维权重和 0.94 → 静态难度天花板 9（level 10 不可达）。

## 7. 未决项 / 下一步

1. 下游接线：strategy-engine / capability / generator / 页面 / tests 逐步接入 `App.KNOWLEDGE`
   （67+2 项），随后恢复 m0/m4/golden 校验列。
2. 收口清理：`migration/raw/id-map.json` 仅为一次性迁移工具内部数据、运行层无 old→new 映射
   （方案 §三 成立）；待下游接线完成后随 `migration/raw/` 一并删除，更新 access 基线。
3. `knowledge/*.html`（656 页，由 `scripts/generate-knowledge-pages.js` 生成）本阶段保留。
4. 难度权重修复（`difficulty-static.js:151` 权重和 0.94）待用户定夺。