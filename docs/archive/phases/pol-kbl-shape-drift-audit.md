# POL–KBL Phase 3 · Frozen Shape Drift 审计报告

> 审计时间：2026-09-13（Stable Baseline 之后）
> 范围：`shared/orchestration/`、`shared/engine/`、`shared/generation/`、`shared/strategy/`、`shared/validator/`、`tests/`
> 方法：源码逐行 + 全量 598 KP 字段完整性实测 + 消费者字段读取扫描 + 默认值对照
> 原则：先审计后定义再最小修复；不修改 KBL Runtime / Frozen Core / Generator 核心 / SVG / Difficulty 公式 / UI
> 关联：`docs/pol-kbl-pending.md`（P0）、`docs/pol-kbl-stable-baseline.md`

---

## 1. 形状链与转换边界核验

```text
KBL canonical（knowledge-runtime.js，11 数据文件）
        ↓  KnowledgeContext（唯一转换边界）
Practice Context 三视图：
  · adaptKp / poolContext   —— 池条目视图（POL / frozen pool）
  · strategyView            —— 冻结 Strategy/Capability 期望形状
  · uiKp / uiListForGrade   —— 页面 UI 视图
        ↓
Strategy（frozen，经 compat → strategyView）
Generator（消费 Strategy Plan；零 KBL 访问）
```

转换唯一性核验（grep 全仓）：

| 转换 | 出现位置 | 结论 |
|---|---|---|
| `knowledgeId → id` | 仅 `knowledge-context.js`（adaptKp/uiKp/strategyView） | PASS |
| `module → moduleId` | 仅 `knowledge-context.js` | PASS |
| `gN → N`（toN） | 仅 `knowledge-context.js` | PASS |
| `N → gN`（toG） | 仅 `knowledge-context.js` | PASS |
| 其他 gN 拼接（`'g'+grade`） | `practice-session.js:362`、`practice.html:774`（练习上下文 ID 键，非知识访问） | 非转换 |

## 2. Canonical 字段完整性（598 KP 实测）

| 字段 | 缺失数 | 影响 |
|---|---|---|
| `assessment.questionTypes` | 0 | — |
| `semantic.category` | 0 | — |
| `generation` / `semantic` / `content` / `unitId` / `unitName` / `book` / `weight` / `status` | 0 | — |
| `difficultyAnnotation.seedDifficulty` | **31** | `strategyView.legacy.difficulty=null` → frozen static-difficulty 默认 3 |
| `difficultyAnnotation.cognitiveLevel` | **31** | `cognition.raw=null`、`cognition.level=0` |
| `type` | **32** | `source.legacyType=null`、UI `type=null` |
| `generation.maxSteps` | **32** | `structure.maxSteps=1`（与 frozen 默认一致） |
| `generation.numberRange` | **11** | `numeric.range={min:null,max:null}` → 策略按年级默认推导 |

## 3. 默认值总表（实际代码读取，非猜测）

| 字段 | KBL canonical | Context（KC） | Strategy（frozen） | Generator |
|---|---|---|---|---|
| `grade` | `"gN"` | `toN → N`（number） | `kp.grade`（number） | 不读取（plan 无 grade 字段） |
| `subject` | `"math"` | 原样 | `kp.subject`；`subjectOfKpId` 兜底 | 不读取 |
| `type` | string \| 缺失（32） | `adaptKp.type=null`；`strategyView.source.legacyType=null` | `kp.source.legacyType`（null 即跳过语义判定） | 不读取 |
| `difficulty` | `difficultyAnnotation.seedDifficulty` \| 缺失（31） | `legacy.difficulty`（null） | static-difficulty 默认 **3**；pool scoring 默认 gradeMid | `plan.difficulty`（Strategy 产出） |
| `spiral` | 无该数据 | **边界默认 `{level:1,maxLevel:1}`** | maxSpiral 默认 **1**（pool）/**6**（gradeMid 路径） | `plan.spiralLevel`（默认 1） |
| `structure` | `generation.maxSteps` | `{minSteps:1, maxSteps, allowBracket:false, allowMultDiv:false}` | `kp.structure.*` | `plan.constraints` |
| `numeric` | `generation.numberRange` | `{range:{min,max}, integerOnly:true, decimalPlaces:0}` | `kp.numeric.range` → null | `plan.constraints` |
| `context` | `assessment.contextDefault` | `{defaults, allowPure:true, allowContextual}` | `kp.context.defaults[0]` → `kp.context_default` → `legacy.context_default` → **'standard'** | `plan.contextType`（默认 'standard'） |
| `cognition` | `difficultyAnnotation.cognitiveLevel` | `{level(0/0.33/1/0.67), targets:[], raw}` | `cognition.level` 主源、`raw` 兜底 | `plan.cognitiveLevel` |
| `weight` | number | `metadata.weight = Number \|\| 1` | `kp.metadata.weight \|\| 1` | 不读取 |
| `semantic` | `{family,concept,operations,representations,category}` | `knowledge.{concept,operations,factualContent}` + `category` | `kp.operations`（顶层，见 DRIFT-04） | 不读取 |
| `generation` | `{pluginId,capabilities,numberRange,maxSteps}` | `{capabilities}` + `source.pluginId` | `generation.capabilities`（能力矩阵） | 不读取 |
| `assessment` | `{questionTypes,contextDefault,errors}` | `presentation.questionTypes`、`context.defaults`、`errors` | `kp.presentation.questionTypes` | 不读取 |

## 4. Drift 登记与处置

| ID | 位置 | 问题 | 严重度 | 处置 |
|---|---|---|---|---|
| **DRIFT-01** | `knowledge-context.js:67` | `adaptKp.no: kp.no` 映射不存在的 canonical 字段（实为 `knowledgeNo`）；全仓无 `.no` 消费者 | 低（死字段） | **修复**：删除 |
| **DRIFT-02** | `practice-orchestrator.js:156` | `predictDifficulty` 把 canonical（`KC.get`）传给 frozen `static-difficulty`（期望 strategyView）→ `legacy.difficulty/spiral/cognition/structure/numeric/context/presentation` 全落默认 → 难度预测失真 | **高** | **修复**：改 `KC.strategyView` |
| **DRIFT-03** | `kp-semantic-validator.js:27` | `getKpConstraints` 用 canonical 读 `presentation/numeric/structure/cognition/source.legacyType/legacy` → `presentationQuestionTypes` 恒空、numeric 恒 null → 验证器大量误判 | **高** | **修复**：改 `KC.strategyView` |
| **DRIFT-04** | `strategyView` | frozen `generator-selector` 读顶层 `kp.pluginId` / `kp.graphicType` / `kp.operations`，视图未提供 → `has*Semantics` 家族失效（B5 同根） | **高** | **修复**：补顶层派生字段 |
| **DRIFT-05** | `adaptKp` | frozen pool 条目消费 `entry.category` / `entry.pluginId`，视图未提供 → 降级到 moduleId | 中 | **修复**：补字段 |
| **DRIFT-06** | `knowledge-context.js:117` | `mapCognitiveLevel` 未知值回落 `0.67`（无数据依据的猜测值） | 中 | **修复**：未知 → 0（与缺失一致）并文档化 |
| **DRIFT-07** | `strategyView` | 死占位字段（无任何消费者）：`gradeOverride`、`cognition.targets`、`knowledge.prerequisites`、`legacy.{prerequisites,related,bankRef,exerciseTypes}`、`metadata.version`、`numeric.{integerOnly,decimalPlaces}`、`structure.minSteps` | 中（形状噪音） | **修复**：删除 |
| **DRIFT-08** | `adaptKp` / `uiKp` | 值可能为 `undefined`（`type`/`name`/`weight`/`status` 等），契约不稳定 | 中 | **修复**：统一 `null` 归一 |
| **DRIFT-09** | frozen strategy | 同字段多默认值：`maxSpiral`（1 vs 6）、`difficulty`（3 vs gradeMid） | 低（frozen 不可改） | **登记**：Context 保证字段常驻；`legacy.difficulty` 对 31 个缺失 KP 仍为 null（frozen 默认 3 生效） |
| **DRIFT-10** | canonical 无数据 | `spiral` / `allowBracket` / `allowMultDiv` 边界默认 | 中（P0） | **固化**：显式写入 Shape Contract（P0 部分 RESOLVED，语义恢复仍留 P0 待 Schema 扩展） |

## 5. 隐式默认值审计（非 frozen 面）

| 位置 | 默认 | 判定 |
|---|---|---|
| `practice-session.js:62-65`（frozen） | `subject 'math'` / `grade 1` / `difficulty 3` | 合法业务默认（会话兜底），保留 |
| `knowledge-context.js` pool subject 归一 | `chinese/english → math` | 合法（Core Domain 收缩），保留 |
| `kpsForGrade` subject 过滤 | `(k.subject \|\| 'math')` | 合法（canonical subject 恒有；兜底防御），保留 |
| Generator `plan.* \|\| 默认`（spiralLevel 1 / context 'standard' / count 1 / constraints {}） | 合法业务默认（Strategy 恒产出这些字段），保留 |
| frozen strategy `kp.* \|\| 默认` | 见 DRIFT-09，Context 常驻后仅剩 31 KP difficulty | 登记 |
| `budget-allocation` / validator `context = context \|\| {}` | 参数防御，保留 |

## 6. Strategy 七维契约（STEP 6 核验）

| 维度 | 来源 | 结论 |
|---|---|---|
| `questionType` | `request.questionTypes` → capability 矩阵 | 稳定（Strategy 内部决策，不读 KBL） |
| `cognition` | `strategyView.cognition` | 稳定（DRIFT-06 修复后未知值显式 0） |
| `difficulty` | 用户/静态（difficulty-static 唯一公式） | 稳定；POL 只传递 |
| `structure` | `strategyView.structure` | 稳定（maxSteps 默认 1） |
| `spiral` | 边界默认 `{1,1}` | 稳定（语义恢复属 P0 后续） |
| `context` | `strategyView.context` | 稳定（defaults/allowPure/allowContextual） |
| `count` | POL 预算 → plan.count | 稳定（Strategy 不重算总预算） |

## 7. Generator 输入契约（STEP 7 核验）

- 生成器读取面：`plan.{questionTypeId, difficulty, knowledgePointIds, seed, spiralLevel, contextType, count, constraints}`（均为 Strategy 产出）。
- 零 KBL 访问（可变生成器无 `knowledge*` require）；无 canonical 对象流入 Generator。
- 缺失兜底均为合法业务默认；**无需在 Generator 内改动**。

## 8. 处置计划

1. DRIFT-01/04/05/06/07/08：`knowledge-context.js` 边界最小修复（不重构视图结构）。
2. DRIFT-02/03：消费方改用 `KC.strategyView`（选择正确的 Practice Context 视图）。
3. DRIFT-09/10：Shape Contract 文档化 + Pending 更新。
4. 新增 `test:pol-kbl-shape` 固化契约（598 KP 全量 + 缺省样本 + 视图一致性 + 稳定性）。

---

## 9. 处置结果（Phase 3 执行，2026-09-13）

| ID | 处置 | 状态 |
|---|---|---|
| DRIFT-01 | 删除 `adaptKp.no`（映射不存在的 canonical 字段） | **RESOLVED** |
| DRIFT-02 | `practice-orchestrator.predictDifficulty` 改 `KC.strategyView` | **RESOLVED** |
| DRIFT-03 | `kp-semantic-validator.getKpConstraints` 改 `KC.strategyView`（factualContent 取 `knowledge.factualContent`） | **RESOLVED** |
| DRIFT-04 | `strategyView` 补顶层别名 `pluginId` / `graphicType` / `operations`（与嵌套字段一致） | **RESOLVED** |
| DRIFT-05 | `adaptKp` 补 `category` / `pluginId` | **RESOLVED** |
| DRIFT-06 | `mapCognitiveLevel` 未知值 → 0（与缺失一致，不猜测） | **RESOLVED** |
| DRIFT-07 | 删除死占位字段：`gradeOverride`、`cognition.targets`、`knowledge.prerequisites`、`legacy.{prerequisites,related,bankRef,exerciseTypes}`、`metadata.version`、`numeric.{integerOnly,decimalPlaces}`、`structure.minSteps` | **RESOLVED** |
| DRIFT-08 | `adaptKp` / `uiKp` 值统一 null 归一（全量 598 KP 无 undefined） | **RESOLVED** |
| DRIFT-09 | frozen 多默认值：Context 字段常驻；仅 `legacy.difficulty` 对 31 个缺失 KP 为 null（frozen 默认 3 生效） | **登记**（frozen 不可改） |
| DRIFT-10 | `spiral` / `allowBracket` / `allowMultDiv` 固化为边界显式默认（`{1,1}` / false / false） | **RESOLVED（契约）**；真实螺旋语义恢复需 KBL Schema 扩展（非阻塞增强） |

### 验证

- `npm run test:pol-kbl-shape`：14/14 PASS（三视图契约 / 缺省默认 / 边界 / 多 KP / 只读稳定性）。
- 关键门禁回归：Golden 15/15、Strategy Bundle PASS、Comprehensive PASS、Presentation E2E PASS、Strategy 管道 598/598。
- 全量 `npm test`：见 Phase 3 收口记录。

---

## 10. 追加发现（STEP 5 Difficulty 契约检查，只登记不修复）

| ID | 位置 | 问题 | 处置 |
|---|---|---|---|
| **DRIFT-11** | `practice-orchestrator.js getTargetDifficulty()` | 仅 `require('../strategy/target-difficulty.js')`，无 `global.TargetDifficulty` 兜底；浏览器（脚本模式）`require` 不可用 → 恒 null → `predictDifficulty` 恒回落 3（难度预测/容量维度对齐静默失效）。bundle 已挂 `global.TargetDifficulty`，可经全局兜底接入 | **登记 P2**（Difficulty 域，STEP 5 限定只登记；不扩 M16） |

> 说明：Phase 3 已将 `predictDifficulty` 的 KP 形状修正为 `strategyView`（DRIFT-02）；
> 但 Target 可达性属难度编排接线问题，按指令登记至 P2，与 D2/M16 一并处理。
