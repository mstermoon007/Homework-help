# KBL v1.0.0 Freeze — 收口冻结声明

> 冻结时间：2026-09-13（M0–M18 全部落地后）
> 权威发布：`kbl-math-v1.0.0-45b9a2f4`（`rootHash 45b9a2f414f468e6…`，`latest.json` 已指向）

## 1. 数据基线（Freeze 锁定）

| 项 | 值 | 冻结点 |
|---|---|---|
| 课程 / 单元 | 19 / 128（含 ghost 5） | Excel 01/02 |
| 知识点 | 598（active 571 / deprecated 25 / inactive 2） | Excel 03 |
| 知识关系 | 1287（prerequisite 594 / related 693，**无环**） | Excel 04（M6 后） |
| 生成映射 | 639（**allow 409 / missing 230**，M7 三重派生） | Excel 05 |
| 扩展 / 数据字典 | 598 / 94 | Excel 06 / 07 |

## 2. Schema / ID（不可变）

- ID 规范：`^(math|chinese|english)-g[1-6]-(up|down|mixed|advance|comprehensive)-u\d{2}-k\d{3}$`（`generatedOnce`，`runtimePositionIndependent`）
- schemaVersion `1.0.0`；ID 生成一次后不再重排（单元序稳定）

## 3. API / Runtime 白名单（单入口封锁）

- 数据只读仅经 `shared/knowledge/runtime/knowledge-runtime.js`（App.KNOWLEDGE，PUBLIC_API=10）
- 访问审计：94 基准点全部在基线内，零新增越权（新增门禁脚本已走同类许可或不访问镜像）

## 4. Layer / 门禁（收口链）

- `npm run kbl:verify` = Validate → Roundtrip → Build → Runtime E2E → Access Audit → Generator-Capability(M2-R05, canonical) → Quality(M17 9 项) → Publish，**ALL PASS**
- Excel 为唯一人工输入源；canonical/kbl 与镜像/发布三方一致 + rootHash 幂等复算
- `check-frozen-core`（79 文件代码层）无变更；既有口径：数据契约变更走 Excel + roundtrip，代码层变更须授权重锚

## 5. 难度边界（不随 KBL 数据改变）

- 生成难度由 `shared/catalog/difficulty.js`（Legacy 表征）+ `difficulty-static.js`（Static，M8 已归一化，`D=1+9·(wsum/0.94)`）决定，KP 数据不携带难度权重
- `difficultyAnnotation` 仅展示/排序参考；难度体系为独立领域（另见难度系统审计）

## 6. 已释出 / 待执行

- **已落地**：M0–M18（含 M6 环修复 `1293→1287`、M8 难度归一化、M17 9 项门禁入链）
- **待执行（不阻塞冻结）**：
  - 难度计划 M16（数据层重建：3 个断链 dev 脚本 `test-difficulty.js / test-difficulty-static.js / check-difficulty-anchor.js`，见 difficulty 审计 §D2）
  - 难度 M5–M14/M17–M20 其余条目（显示层/合成层回归）
  - 教材核准（M2）按用户指示仅作参考，不设门禁
  - 幽灵单元 5 个 KP 补充挂载（WARNING 常驻待办）
  - generator-registry 内 464 条旧层 legacy knowledgePoints 引用（非运行时绑定，KP↔生成器真值以 05 生成映射为准；detail 见 `dev/reports/generator-capability-report.json`）