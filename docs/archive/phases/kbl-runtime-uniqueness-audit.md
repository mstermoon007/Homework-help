# KBL Runtime 唯一性审计报告（KBL Runtime Uniqueness Audit）

> 审计时间：2026-09-13
> 审计性质：**只读专项审计**（不改业务代码；发现问题仅登记 pending）
> 审计命题：**整个运行时知识数据链，是否真的只有 KBL Runtime 一个事实入口**
> 方法：静态调用审计（921 文件分类扫描）+ Bundle 审计 + 动态 E2E 插桩
> 配套：`docs/kbl-runtime-access-map.md`（清单 A）｜`docs/kbl-runtime-bypass-list.md`（清单 B）｜`docs/kbl-runtime-uniqueness-result.md`（清单 C/D）
> 门禁：`dev/check-kbl-uniqueness.js`（`npm run test:kbl-uniqueness`）；报告 `dev/reports/kbl-uniqueness-report.json`

---

## 0. 结论先行

```text
KBL Runtime Uniqueness = FAIL
  ├─ 生产知识事实源        = KBL Runtime（唯一；无第二生产知识源）
  ├─ POL 适配边界          = KnowledgeContext（唯一）
  ├─ 兼容桥                = knowledge-compat → Runtime 纯委托（Delegation）
  ├─ Browser Runtime       = 1 个 App.KNOWLEDGE 实例；旧知识全局未定义
  ├─ 生产绕过路径（活跃）  = 0
  └─ FAIL 项               = 3（均非"第二知识源"，属残留/重复/惰性路径，已登记 pending）
```

**不存在第二条生产知识事实链**：所有生产知识查询（KP/Unit/Relation/能力/可生成性）
在运行时最终都到达 `App.KNOWLEDGE`；无生产文件直读 KBL 数据 JSON；无第二套 KP/Unit/Relation 数据。

FAIL 三项：

| ID | 文件 | 类型 | 现状 |
|---|---|---|---|
| FAIL-001 | `shared/presentation/render.js:148,201-202` | 生产代码保留旧 `global.KnowledgeBank` 访问路径 | 惰性（全局未定义 + 工厂无调用方） |
| FAIL-002 | `shared/validator/kp-semantic-validator.js:247,249` | 迁移残留未定义引用 `KnowledgePoint.get`/`Ontology.normalize` | 惰性（combine 上游不可达，触发即 ReferenceError） |
| FAIL-003 | `shared/engine/presentation-engine.bundle.js` | Bundle 内联第二份 KnowledgeContext + KBL Runtime 副本 | Runtime 副本休眠；Context 副本覆盖 `global.KnowledgeContext`（同源委托） |

> 三项均不构成"第二条知识事实链"；但按本次严格判定规则（生产代码出现旧 KnowledgeBank 调用 /
> 唯一适配边界出现第二副本）计为 FAIL，已登记 `docs/pol-kbl-pending.md`，**本次不修复**。

---

## 1. 冻结架构基线（审计目标链）

```text
KBL Data → KBL Runtime → POL KnowledgeContext → Practice Context
        → Strategy → Generator → Validator → SemanticQuestion → Presentation / SVG
```

| 角色 | 唯一性要求 | 审计结论 |
|---|---|---|
| 知识事实入口 | 仅 KBL Runtime | PASS |
| 运行时知识适配边界 | 仅 `shared/orchestration/knowledge-context.js` | PASS（另见 FAIL-003 副本） |
| 兼容桥 | 仅 `shared/engine/knowledge-compat.js`，且只允许"旧接口名 → Runtime 委托" | PASS（Delegation） |

---

## 2. 审计执行（STEP 1–16 摘要）

| STEP | 内容 | 结果 |
|---|---|---|
| 1–2 | 全项目扫描（921 文件）+ 知识访问分类（A–K） | 生产面命中 32 处，全部归类 |
| 3 | KBL Runtime 本身审计（入口/模块/API/数据源/内部依赖） | 见 §3 |
| 4 | Runtime 数据来源唯一性反向追踪 | 仅 11 个 DATA_FILES；无第二数据源 |
| 5 | 运行时调用反向追踪（UI/API/POL/Strategy/Generator/Validator/Presentation） | 见清单 A |
| 6 | KnowledgeContext 专项审计（唯一适配边界 / 不复制数据 / 不实现 Runtime） | PASS（委托+投影，无数据副本） |
| 7 | knowledge-compat 专项审计 | **Bridge Type = Delegation** → PASS |
| 8–9 | 绕过路径扫描 + Production/Test/Build/Archive 区分 | 见清单 B；无新增违规 |
| 10 | Browser Bundle 审计 | 无内嵌 KBL 数据、无旧知识全局；发现 FAIL-003 副本 |
| 11 | 动态 E2E 插桩 | mounts=1；旧全局 undefined；Runtime 调用链贯通 |
| 12–15 | 四张清单 + 判定 | 本报告 + 清单 A/B/C/D |
| 16 | `test:kbl-uniqueness` 审计门禁 | 已接入（standalone；当前红，见 §6） |

---

## 3. KBL Runtime 事实（以当前代码为准）

- **Entry**：`shared/knowledge/runtime/knowledge-runtime.js`（单文件浏览器入口；由 `dev/build-knowledge-runtime.js` 生成）
- **Modules**（生成顺序）：`knowledge-contract.js → knowledge-loader.js → knowledge-relation.js → knowledge-policy.js → knowledge-index.js → knowledge-query.js → knowledge-api.js`
- **Public API（PUBLIC_API 冻结白名单）**：`get / byGrade / byBook / byUnit / selectable / canGenerate / searchByName / unit / relationsFor / stats`
- **Data Sources**（仅 11 个）：`data/math/curriculum.json`、`data/math/g1..g6/knowledge-points.json`、`relations/math/relations.json`、`mappings/generation-contract/math.json`、`index/index.json`、`manifest/manifest.json`
- **Internal deps**：Node `fs/path/crypto`；Browser `XMLHttpRequest`（base=`App.KBL_CONFIG.base || 'shared/knowledge'`）；`global.App` 挂载
- **反向追踪结论**：Runtime 内部无第二套 JSON / KP Map / Unit Map / Relation Map / 旧 KnowledgeBank / catalog 知识数据；仅 `module-catalog`（模块目录元数据，0 知识事实字段）与 `question-type-registry`（题型注册表元数据）为相邻元数据，不承担知识事实。

---

## 4. 动态 E2E 插桩结果（生产路径）

装载序：`common → difficulty → difficulty-static → knowledge-runtime → knowledge-context → knowledge-compat → strategy bundle → presentation bundle`；执行：POL 池展开 → `StrategyEngine.plan` → `GeneratorSelector` → `Generator` → `SemanticQuestionBridge`。

```text
App.KNOWLEDGE 挂载次数        1          （无重复挂载）
global.KnowledgeBank          undefined  （从未定义）
global.KnowledgePoint         undefined
global.KnowledgeOntology      undefined
Runtime API 调用              get:5  byGrade:1（其余 0，未被本链路需要）
兼容桥委托                    KnowledgePointCompat.get ×5（旧接口 → KC → Runtime）
E2E                           poolKpIds=112 → plans=1 → semanticQuestions=3
```

> `KB.getEntries` 计数 0：显式 KP 链路走 `plan()` 核心路径，池展开已由 POL 经 KC 完成，Frozen `poolEntries` 未被触发。

---

## 5. 判定维度（清单 D 摘要）

| 维度 | 判定 | 依据 |
|---|---|---|
| Production Runtime | PASS | 无生产文件直读 KBL 数据；无第二生产知识源 |
| POL KnowledgeContext | PASS | 委托 Runtime + 形状投影；无数据副本/无查询重实现 |
| Compatibility Bridge | PASS | Delegation（get→strategyView / getEntries→poolContext / normalize→恒等） |
| Browser Runtime | FAIL（实例唯一性） | FAIL-003：presentation bundle 内联 Runtime/Context 副本（Runtime 副本休眠，Context 副本覆盖 global） |
| Generator Boundary | PASS | 可变生成器零知识访问；Frozen registry/selector 经 compat 委托 |
| Test Boundary | PASS | 测试/构建/归档均归类隔离，不参与生产判定 |
| Second Knowledge Source | NO | 唯一生产知识事实源 = KBL Runtime |
| Bypass Path（活跃） | NO | 生产路径无绕过；仅 FAIL-001 惰性残留 |

完整清单见 `docs/kbl-runtime-uniqueness-result.md`。

---

## 6. 审计门禁

- 脚本：`dev/check-kbl-uniqueness.js`（只扫描/分类/报告，**禁止自动修复**）
- 命令：`npm run test:kbl-uniqueness`（当前 exit=1，对应 3 项 known findings）
- 说明：为避免把已知 pending 混入主链，**暂未并入 `npm test`**；待 FAIL-001/002/003 处理后可并入。

## 7. 本次审计未做（范围外）

- 未修改任何业务代码 / Frozen Core / Generator / SVG / 难度公式 / KBL 标准
- 未迁移 B5/B6/B7、未处理 Composite、未处理 D2/M16、未处理 G1 Matrix
- FAIL-001/002/003 仅登记 `docs/pol-kbl-pending.md`，等待后续授权处理
