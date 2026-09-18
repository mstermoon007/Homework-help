# 清单 B：KBL Runtime Bypass List（绕过路径清单）

> 来源：`dev/check-kbl-uniqueness.js`（静态扫描 921 文件，生产面命中 32 处）
> 判定原则：区分 **真实问题 / 受控（frozen·bridge）/ 测试专用 / 构建专用 / Archive / 文档 / 派生数据（非知识事实）**
> 本次新增违规 = 0；已知 FAIL = 3（登记 `docs/pol-kbl-pending.md`，未修复）

## B1. 生产面命中明细（P-production，32 处）

| File | Pattern | Type | Runtime Path | Status |
|---|---|---|---|---|
| `shared/strategy/strategy-engine.js` | legacy-point / legacy-file | 冻结旧接口 require | compat → KC → Runtime | PASS（受控；冻结 pending） |
| `shared/strategy/strategy-resolver.js` | 同上 | 同上 | 同上 | PASS（受控） |
| `shared/strategy/cognitive-strategy.js` | 同上 | 同上 | 同上 | PASS（受控） |
| `shared/strategy/context-strategy.js` | 同上 | 同上 | 同上 | PASS（受控） |
| `shared/strategy/difficulty-strategy.js` | 同上 | 同上 | 同上 | PASS（受控） |
| `shared/strategy/number-range-strategy.js` | 同上 | 同上 | 同上 | PASS（受控） |
| `shared/strategy/question-type-allocation.js` | 同上 | 同上 | 同上 | PASS（受控） |
| `shared/strategy/spiral-strategy.js` | 同上 | 同上 | 同上 | PASS（受控） |
| `shared/strategy/structure-constraints.js` | 同上 | 同上 | 同上 | PASS（受控） |
| `shared/strategy/strategy-validator.js` | 同上 | 同上 | 同上 | PASS（受控） |
| `shared/strategy/target-difficulty.js` | 同上 | 同上 | 同上 | PASS（受控） |
| `shared/strategy/comprehensive-strategy.js` | legacy-bank / legacy-file | 冻结旧接口 require（getKB） | compat → KC → Runtime | PASS（受控） |
| `shared/capability/capability-resolver.js` | legacy-point / legacy-file | 冻结旧接口 require | compat → KC → Runtime | PASS（受控） |
| `shared/generator/generator-registry.js` | legacy-point / legacy-file | 冻结旧接口 require | compat → KC → Runtime | PASS（受控） |
| `shared/generator/generator-selector.js` | legacy-point / legacy-file | 冻结旧接口 require | compat → KC → Runtime | PASS（受控） |
| `shared/presentation/render.js` | legacy-bank | 生产代码旧 `global.KnowledgeBank` 访问（`_kb.getEntries`） | 无（全局未定义，路径不可达） | **FAIL-001（惰性）** |
| `shared/validator/kp-semantic-validator.js` | legacy-point | 迁移残留未定义引用（`KnowledgePoint.get`/`Ontology.normalize`） | 无（触发即 ReferenceError；combine 上游不可达） | **FAIL-002（惰性）** |

## B2. Bundle 审计

| File | Pattern | Type | Runtime Path | Status |
|---|---|---|---|---|
| `shared/engine/strategy-engine.bundle.js` | 旧模块 shim def（bank/point/ontology → compat 全局） | 构建期委托 | compat → KC → Runtime | PASS（Delegation） |
| `shared/engine/strategy-engine.bundle.js` | 内嵌 legacy 绑定表（402 个 legacy ID / 849 次） | Generator 绑定元数据（非知识事实） | 不参与知识查询 | PASS（B6 pending，范围外） |
| `shared/engine/strategy-engine.bundle.js` | canonical KBL ID 字面量 0 | — | — | PASS（无数据内嵌） |
| `shared/engine/presentation-engine.bundle.js` | `__defs[...knowledge-runtime.js]` + `__defs[...knowledge-context.js]` + `global.App.KNOWLEDGE =` | Bundle 内联 Runtime/适配器副本 | 同源（页面序下 Runtime 副本休眠；Context 副本覆盖 global） | **FAIL-003** |

## B3. 非生产面（分类隔离，不计违规）

| 类别 | 命中 | 说明 |
|---|---|---|
| A-runtime | `knowledge-runtime.js` / `knowledge-loader.js` 的 DATA_FILES 引用 | Runtime 内部合法 |
| B-context | `knowledge-context.js` 的 `App.KNOWLEDGE` 委托 | 唯一适配边界（合法） |
| C-bridge | `knowledge-compat.js` / `dev/build-strategy-bundle.js` | 受控兼容桥（合法） |
| E-build（13 处） | `dev/test-difficulty*.js`、`dev/check-difficulty-anchor.js`、`dev/r2-*.js`、`dev/check-g1-quality-matrix.js`、`dev/check-knowledge-access.js`、`tools/kbl/*`、`kbl/*` | 测试/构建/迁移工具（D2/M16 与 G1 pending） |
| D-test | `archive/legacy-tests/*`（已归档） | 旧层测试，归档隔离 |
| F-docs | `docs/*`、`shared/knowledge/README.md` | 文档 |
| G-archive | `archive/*` | 历史代码 |

## B4. 派生数据与元数据（重点复核：非知识事实）

| 对象 | 内容 | 是否知识事实 | 判定 |
|---|---|---|---|
| `shared/capacity/capacity-map.json` | 按 KP 的容量分桶缓存（由生成器扫描派生） | 否（派生缓存；无 KP/Unit/Relation 载荷） | PASS（运行时 Node 侧读取；浏览器缺失回退） |
| `shared/catalog/module-catalog.js` | 模块目录元数据（M0-M13/C1-C9 名称/层级） | 否（分类法元数据；0 个知识事实字段） | PASS |
| `shared/knowledge/question-type-registry.js` | 题型注册表元数据 | 否 | PASS |
| `shared/schemas/*.schema.js` | 结构与字段规则 | 否 | PASS |
| `shared/catalog/difficulty-static.js` | 难度权威权重（Difficulty Authority） | 否（难度域，审计范围外） | PASS |
| `shared/generator/**` 绑定表 | generator → legacy KP ID 引用列表 | 否（绑定元数据；B5/B6 范围外） | PASS |
| `knowledge/*.html`（656 个） | 静态生成内容页（无脚本、无 KP 数据字段） | 否（静态内容） | PASS |

## B5. 扫描口径说明

- 已剥离注释（JS `/* */`、`//`；HTML `<!-- -->` 与 `<script>` 内注释）后再匹配，避免注释误报。
- `Bundle-artifact` 不参与静态生产判定，单独做数据内嵌 / 旧全局 / 副本检查。
- `docs/`、`migration/`、`archive/`、`tests/`、`dev/`、`tools/` 不参与生产判定。
