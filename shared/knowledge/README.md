# shared/knowledge — 知识库（标准重建·唯一数据源）

**状态**：一次迁移完成（2026-09-12）。旧层 `knowledge-*.js` / `ontology-*.map.js` 于 Phase E
删除；本层 `data/ + relations/ + mappings/ + index/ + manifest/ + runtime/` 为唯一知识数据与访问通道。

> Difficulty Authority 不在本层。`difficultyAnnotation` 仅做展示/排序参考；
> 生成难度由 `shared/catalog/difficulty.js`（App.Difficulty）与 `shared/catalog/difficulty-static.js`
> 独占裁决。

## 目录结构

```
shared/knowledge/
├── data/math/curriculum.json        # 课程树（128 单元，含 unitType/status/unitNo 顺序）
├── data/math/g1..g6/knowledge-points.json   # 知识库主体（6 文件，共 598 知识点）
├── relations/math/relations.json    # 知识点关系（1287 行，M6 移除 6 条成环 prereq）
├── mappings/generation-contract/math.json    # 生成契约（639 行，唯一键 知识Id×题型×capability，permission 由注册表自动计算）
├── index/index.json                 # 只读索引（byId/byGrade/byBook/byUnit/...）
├── manifest/manifest.json           # 完整性指纹（per-file sha256 + rootHash）
└── runtime/                         # 唯一数据访问层
```

## 承载要求（数据契约）

- 生成、回填、索引、查询面属于本层职责；并在**策略与生成器**任职时以其名义批准。
- 知识数据一经生成即冻结：
  - **ID 允许变更**：绝不按数组下标推导（`runtimePositionIndependent`）。
  - 全量迁移后 `rootHash` 确定；发布即锁定。

## ID 规则（已固化）

- 知识点：`{subject}-{grade}-{book}-u{unitNo}-k{knowledgeNo}`
  - 例：`math-g4-up-u09-k001`
- 单元：`{subject}-{grade}-{book}-u{unitNo}`，例：`math-g4-up-u09`
- **禁止进入 ID**：family / module / operation / difficulty / cognitive /
  questionType / capability / weight / status / publication。

## 生命周期与发布

- `publication`: `published | draft`
- `status`: `active | draft | deprecated | inactive`
- 约束：`published` + `deprecated` 互斥；`deprecated` 建议名称带前缀。
- 可选状态（selector）：仅 `published + active` 可被选择进入生成。

## 生成映射与权限（只读）

- `mappings/generation-contract/math.json` 的 `permission` 由
  `shared/generator/generator-registry.js` 自动计算，人工不得直接写 ALLOW。
- `allow | forbid | degrade | missing` 四档；当前已全量 `allow`（639，契约去重后）。

## 运行时（唯一入口）

加载顺序：`knowledge-contract → knowledge-loader → knowledge-relation →
knowledge-policy → knowledge-index → knowledge-query → knowledge-api`
（最后一个文件挂 `App.KNOWLEDGE`；内部分层按方案 §19 固化，index/query 为内部实现）。

```html
<!-- 方式 A：浏览器单文件入口（推荐，方案 §23） -->
<script src="shared/knowledge/runtime/knowledge-runtime.js"></script>
<!-- 之后 window.KnowledgeAPI 可直接使用（== window.App.KNOWLEDGE） -->

<!-- 方式 B：分模块加载（等价，顺序必须与上一致） -->
<script src="shared/knowledge/runtime/knowledge-contract.js"></script>
<script src="shared/knowledge/runtime/knowledge-loader.js"></script>
<script src="shared/knowledge/runtime/knowledge-relation.js"></script>
<script src="shared/knowledge/runtime/knowledge-policy.js"></script>
<script src="shared/knowledge/runtime/knowledge-index.js"></script>
<script src="shared/knowledge/runtime/knowledge-query.js"></script>
<script src="shared/knowledge/runtime/knowledge-api.js"></script>
```

`knowledge-runtime.js` 由 `node dev/build-knowledge-runtime.js`（npm `kbl:bundle-runtime`）生成，请勿手改。

公开方法白名单（`knowledge-contract.js#PUBLIC_API`）：
`get / byGrade / byBook / byUnit / selectable / canGenerate / searchByName / unit / relationsFor / stats`。

## 构建与验证（npm）

```bash
node tools/kbl/import-excel.js      # Excel（唯一人工输入）→ migration/excel-raw
node tools/kbl/normalize.js         # Canonical Transformer → kbl/（新 ID 固化；--editorial 读取 Excel）
node tools/kbl/validate.js          # 迁移门禁（Schema/ID/课程树/关系/权限/索引/守恒）
node tools/kbl/build.js             # 镜像 → shared/knowledge/ + 确定性 rootHash
node tools/kbl/publish.js           # 发布快照 → kbl/releases/（rootHash 锁定）+ latest.json
node tools/kbl/verify.js            # 最终门禁：validate→roundtrip→build→runtime→access→publish
node dev/verify-kbl-runtime.js      # Runtime E2E
node dev/check-knowledge-access.js  # 静态访问门禁（KBL ACCESS AUDIT）
```

一键：`npm run kbl:verify`（等效 `npm run verify:kbl`：validate→roundtrip→build→runtime→access→publish）。

## 迁移溯源的处置

- `kbl/`（canonical source）保留 `oldUnitId` 供一次迁移追踪；`build` 分发产物已剔除。
- `migration/raw` 为提取档案（一次性输入源，`id-map.json` 仅供工具内部使用，运行层不存在 old→new 映射）；
  `migration/knowledge-access-expectations.json` 为访问门禁基线，长期保留。
- 一次性提取工具 `tools/kbl/extract-source.js` 已随迁移完成删除（其输入源 `knowledge-math.js` 为 Phase E 删除对象）。

## 下游接线（记录不修复）

既有直接引用旧层的 67 个 `downstream-pending` + 2 个 `pages-pending` 消费者
（capability / capacity / catalog / engine / generation / generator /
orchestration / presentation / strategy / validator / sw.js / scripts / tests）
为预期断链清单，Phase E 收口后逐个接入 `App.KNOWLEDGE`。

## KBL 永久规范（方案 §44）

> **1. Excel 是人工课程事实唯一输入源。**
>
> **2. Canonical KBL 是基础知识唯一权威数据。**
>
> **3. KnowledgeAPI 是 Runtime 唯一公开入口。**
>
> **4. Runtime 禁止直接读取 Catalog、Relation、Mapping 文件。**
>
> **5. 业务层禁止直接访问旧 KnowledgeBank、Ontology 或知识 JSON。**
>
> **6. ID、Index、Relation Index、Manifest、Hash 均由程序生成。**
>
> **7. ID 一经发布不得复用。**
>
> **8. KBL 不计算生成难度，不替代 Difficulty Authority。**
>
> **9. KBL 不生成题目，不决定练习题量，不承担编排。**
>
> **10. Generator、Strategy、POL、Service、UI 不属于 KBL。**

以上规范由静态门禁 `dev/check-knowledge-access.js` 强制（runtime 之外不得直接访问知识数据）。