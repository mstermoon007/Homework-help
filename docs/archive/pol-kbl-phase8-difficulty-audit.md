# POL–KBL Phase 8-0：Difficulty 全项目权威链审计（只读）

> 审计时间：2026-09-13
> 性质：**只审计，不修改生产代码**；不新增 Service/Manager/Controller/Adapter；不修改 KBL/POL/Generator/SVG/UI/难度公式
> 关联：`docs/difficulty-system-audit.md`（M0 冻结资产与 D2/D3 记录）、`docs/pol-kbl-pending.md`（P2/DRIFT-11）、`docs/pol-contract.md` §8
> 产出：实施清单 §8（待授权后进入编码）

---

## 1. 结论先行

1. **公式唯一性成立**：`D = 1 + 9 × (wsum / WSUM_MAX=0.94)` 仅存在于 `shared/catalog/difficulty-static.js:151-153`；全仓无第二处复制（`comprehensive-strategy`/`strategy-engine` 的 `wsum` 是配额权重和，非难度公式）。**公式本身无问题，不得修改。**
2. **D2 根因 = 数据源断链，不是公式问题**：3 个 dev 脚本硬 require 已删除的旧 bank；M16 需基于 KBL 数据（`difficultyAnnotation.seedDifficulty`）重建测试矩阵。
3. **DRIFT-11 根因 = POL 访问器缺全局兜底**：`getTargetDifficulty()` 仅 `require`，浏览器下恒 null；bundle 已挂 `global.TargetDifficulty`，可最小接线。
4. **附加发现（3 项）**：`difficulty-orchestrator.js` 未在 practice.html 加载 → POL DifficultyContext 走内联回退（W9 仍存活）；难度双 validator 层重叠；默认值多处（UI 1 / normalize 6 / POL 3 / session 3）。
5. **必须删除**：`render.js` 死工厂难度消费（`_wrapDifficultyParams`+`createMathPlugin` 无调用方）、`dev/r2-difficulty-anchor-apply.js`（一次性）、`difficulty-orchestrator.validateConstraints`（0 消费）；D2 三脚本重建（M16）后替换。

---

## 2. 权威边界（现状）

| 层级 | 文件 | 角色 | 冻结 |
|---|---|---|---|
| Difficulty Core | `shared/catalog/difficulty.js` | 1–10 → TIERS/scale/paramsFor/consume（结构分档权威） | ❌ |
| Difficulty Static | `shared/catalog/difficulty-static.js` | 8 维静态公式唯一计算处（**唯一公式**） | ❌（授权可改） |
| Strategy Static 适配 | `shared/strategy/static-difficulty.js` | canonical → legacy meta → DifficultyStatic | ✅ |
| Strategy Target | `shared/strategy/target-difficulty.js` | 用户 override / static / adaptive delta / composed | ✅ |
| Strategy Effective | `shared/strategy/difficulty-strategy.js` | applyEffective / resolveComposedDifficulty | ✅ |
| Adaptive | `shared/strategy/adaptive-strategy.js` | Learner → adaptiveDelta | ✅ |
| Strategy 串联 | `shared/strategy/strategy-engine.js` | static → target → adaptive → composed → constraints | ✅ |
| POL 协调 | `shared/orchestration/difficulty-orchestrator.js` | 归一 / Context（不算） | ❌ |
| POL 容量对齐 | `shared/orchestration/practice-orchestrator.js` `predictDifficulty` | 容量分桶维度（不改 genReq） | ❌ |
| Validator | `shared/validator/difficulty-validator.js` | M5-R09 难度符合性 | ✅ |
| Validator | `shared/validator/difficulty-integrity-validator.js` | M8-R03 难度完整性 | ❌ |
| UI | `practice.html` | 用户输入 1–10（默认 1） | ❌ |
| Normalize | `shared/request/request-normalize.js` | easy/normal/hard → 4/6/9；缺省 6 | ❌ |

---

## 3. 实际生产调用链

### 3.1 浏览器生成链（practice.html，实测代码路径）

```text
UI difficulty（URL 默认 1；input min=1 max=10）
  → state.difficulty
  → PracticeBridge.start → profile.difficulty
  → PracticeSession.config.difficulty
  → GenerationAPI.generate → POL.orchestrate
      → POL.plan:
          DO = getDifficultyOrchestrator()
             ← practice.html 未加载 difficulty-orchestrator.js → null（附加发现 A）
          → 内联回退归一 {requested:Number(req.difficulty), source:'auto'}
          → userDifficulty != null → difficulty = clamp(1..10)
          → difficultyContext = 内联回退对象
          → capacityByType(kpIds, capMap, difficulty)（仅容量分桶）
      → cellReq.difficulty = genReq.difficulty
      → executeInline → StrategyEngine.plan
          → StaticDifficulty.resolveStaticDifficulty(kp, qt)      [✅冻结]
              → DifficultyStatic.paramsForKnowledgePoint(...)      [唯一公式]
          → TargetDifficulty.resolveTargetDifficulty({difficulty, adaptive, ...}) [✅冻结]
          → AdaptiveStrategy.resolve(...)（adaptive 时）           [✅冻结]
          → DifficultyStrategy.applyEffective / resolveComposedDifficulty [✅冻结]
          → StructureConstraints → StaticDifficulty / Difficulty.paramsFor [✅冻结]
      → Generator（消费 plan.difficulty，不重算）
      → Validator（difficulty-validator + difficulty-integrity-validator）
      → Presentation（渲染，零难度计算）
```

### 3.2 POL 容量维度预测（DRIFT-11 路径）

```text
predictDifficulty(kpIds, qts, mode)
  → getTargetDifficulty()  ← require-only（浏览器 null）   ← DRIFT-11 根因
  → Target 不可达 → 返回 null
  → POL 回落 difficulty = 3（容量桶/账本维度失真）
```

### 3.3 D2 断链脚本（Node）

```text
dev/test-difficulty.js:49        → require knowledge-bank.js（已删）→ MODULE_NOT_FOUND
dev/test-difficulty-static.js:17 → require knowledge-bank.js（已删）→ MODULE_NOT_FOUND
dev/check-difficulty-anchor.js:17→ require knowledge-bank.js（已删）→ MODULE_NOT_FOUND
dev/r2-difficulty-anchor-apply.js → 一次性 apply（写旧 bank）→ 死代码
```

---

## 4. 实现分类

| 文件 | 分类 | 说明 |
|---|---|---|
| `catalog/difficulty.js` | **权威（Legacy）** | TIERS/paramsFor/consume；structure-constraints（冻结）消费 |
| `catalog/difficulty-static.js` | **权威（Static，唯一公式）** | 8 维公式；static-difficulty 消费 |
| `strategy/static-difficulty.js` | **协调（adapter）** | canonical→legacy meta；冻结 |
| `strategy/target-difficulty.js` | **权威（目标合成）** | override/adaptive/composed；冻结 |
| `strategy/difficulty-strategy.js` | **权威（effective/composed）** | 冻结 |
| `strategy/adaptive-strategy.js` | **权威（自适应）** | 冻结；仅 strategy-engine 消费 |
| `strategy/strategy-engine.js` | **协调（串联）** | 冻结 |
| `orchestration/difficulty-orchestrator.js` | **协调（POL）** | 归一/Context；`validateConstraints` 0 消费（死导出） |
| `practice-orchestrator.predictDifficulty` | **协调（容量维度）** | DRIFT-11；不改 genReq.difficulty |
| `validator/difficulty-validator.js` | **校验** | 冻结；layer2 |
| `validator/difficulty-integrity-validator.js` | **校验** | layer3；与 layer2 部分重叠 |
| `practice.html` | **消费（UI 输入）** | 只读 1–10；含 difficulty/difficulty-static script（bundle shim 依赖，非 UI 计算） |
| `request/request-normalize.js` | **协调（请求归一）** | 缺省 6（与 UI 默认 1 不一致，D3） |
| `render.js _wrapDifficultyParams` | **死代码** | 仅被无调用方的 `createMathPlugin` 使用 |
| `dev/check-difficulty-dual.js` | **校验（门禁）** | Legacy 表征锁定 + Static 独立；PASS |
| `dev/check-difficulty-anchor.js` | **校验（D2 断链）** | 依赖旧 bank；M16 重建 |
| `dev/test-difficulty.js` / `test-difficulty-static.js` | **校验（D2 断链）** | M16 重建 |
| `dev/test-difficulty-structure.js` | **校验（有效）** | 34 断言 PASS，已接入 npm test |
| `dev/difficulty-anchor-table.js` | **数据（锚点表）** | 独立数据；重建可复用 |
| `dev/r2-difficulty-anchor-apply.js` | **死代码** | 一次性 apply |

---

## 5. 重复清单

### 5.1 重复默认值（difficulty）

| 位置 | 默认 | 性质 |
|---|---|---|
| `practice.html:352/373-374` | **1** | UI 缺省 |
| `request-normalize.js:50-54` | **6** | 请求归一缺省（D3 不对齐） |
| `practice-session.js:65` | **3** | frozen 会话兜底 |
| `practice-orchestrator.js:220` | **3** | POL 预测失败回落 |
| `static-difficulty.js:31-32` | **3** | frozen legacy.difficulty 缺失回落 |
| `strategy-engine.js:132` | **gradeMid** | frozen 池评分回落 |

### 5.2 重复 clamp

`difficulty.js clamp10` ／ `difficulty-strategy.applyEffective` ／ `target-difficulty.clampUserDifficulty` ／ `POL Math.min(10,…)` ／ `difficulty-orchestrator.toLevel` ／ `practice.html input min/max`（6 处；frozen 占 3 处）。

### 5.3 重复门禁

- `difficulty-validator`（layer2，M5-R09）与 `difficulty-integrity-validator`（layer3，M8-R03）检查面部分重叠（难度/结构/数值一致性）。
- `check-difficulty-dual`（双引擎表征锁定）与 `check-difficulty-anchor`（数据锚点）职责不同，但后者断链。
- `difficulty-orchestrator.validateConstraints` 无消费者（死导出）。

### 5.4 重复实现（同一职责多路径）

- 静态难度消费两处：`static-difficulty`（策略链，live）与 `render.js _wrapDifficultyParams`（死工厂）。
- 结构分档两入口：`DifficultyStatic` 产出的 steps/allowBracket 与 `Difficulty.paramsFor` 重取（structure-constraints 冻结逻辑，合规但需保持语义一致）。

---

## 6. 根因定位

### 6.1 D2 / M16

- **根因**：3 个 dev 脚本以旧 bank 为数据源（`knowledge-bank.js` 已随 KBL 删除）→ Node 侧 MODULE_NOT_FOUND；与公式无关。
- **M16 目标**：以 `shared/knowledge/data/math/*` 为源重建难度测试矩阵（`tests/difficulty/` + 脚本）。
- **可用数据**：canonical `difficultyAnnotation.seedDifficulty`（567/598 有值，31 缺失 → 需定义缺失策略：跳过/WARN/按锚点推导）。

### 6.2 DRIFT-11

- **根因**：`practice-orchestrator.getTargetDifficulty()` 只 `require('../strategy/target-difficulty.js')`，无 `global.TargetDifficulty` 兜底；浏览器（脚本模式）`require` 不可用 → null → `predictDifficulty` 恒 null → 容量桶回落 3。
- **最小修复**：与同文件其他访问器一致，加 `global.TargetDifficulty` 兜底（bundle 已挂载）。

### 6.3 附加发现

- **A（W9 存活）**：`practice.html` 未加载 `difficulty-orchestrator.js` → POL `DO=null` → 内联回退（normalize/Context 退化）。修复：页面加一行 script（或 POL 内联逻辑移除）。
- **B（双 validator）**：难度校验两层部分重叠；需确认是否保留双层（frozen layer2 + mutable layer3）。
- **C（D3 默认不对齐）**：normalize 6 vs UI 1；两条路径独立，需统一口径（建议 UI 显式默认值，normalize 仅在缺省时兜底）。
- **D（bundle shim 依赖）**：practice.html 的 difficulty/difficulty-static script 是 bundle shim 的全局提供者，**不是死引用**。

---

## 7. 必须删除清单（Phase 8 执行，待授权）

| # | 对象 | 依据 |
|---|---|---|
| D-1 | `render.js` `_wrapDifficultyParams` + `createMathPlugin` 难度消费（含 `_wrapDifficultyParams` 导出） | 0 调用方（Phase 4 已确认 createMathPlugin 无调用方） |
| D-2 | `dev/r2-difficulty-anchor-apply.js` | 一次性 apply（旧 bank），归档/删除 |
| D-3 | `difficulty-orchestrator.validateConstraints` | 全仓 0 消费者（死导出） |
| D-4 | D2 三脚本（`test-difficulty.js` / `test-difficulty-static.js` / `check-difficulty-anchor.js`） | M16 重建后删除（先建后删） |

> 不删除：`difficulty.js` / `difficulty-static.js`（权威）、`static-difficulty.js` / `target-difficulty.js` / `difficulty-strategy.js` / `adaptive-strategy.js`（冻结权威）、`check-difficulty-dual.js`（有效门禁）、`difficulty-anchor-table.js`（数据）、practice.html 的 difficulty script（bundle shim 依赖）。

---

## 8. Phase 8 实施清单（待授权编码）

### P8-1 DRIFT-11 最小修复（P0，1 行级）
- `practice-orchestrator.getTargetDifficulty()` 增 `global.TargetDifficulty` 兜底（与 getKnowledgeContext 等同模式）。
- 验收：浏览器等价环境（`_bundle-env`）下 `predictDifficulty` 返回非 null；容量桶维度与生成维度对齐。

### P8-2 POL DifficultyContext 接线（P0，1 行级）
- `practice.html` 加载 `shared/orchestration/difficulty-orchestrator.js`（位于 practice-orchestrator 之前）。
- 验收：POL `DO` 可用 → `difficultyContext` 由 `resolveContext` 产出（非内联回退）；`requested/min/max/tolerance/source` 正确。

### P8-3 D2/M16 测试矩阵重建（P1，先建后删）
- 新建 `tests/difficulty/`（5 文件，按 `docs/difficulty-system-audit.md` M16 清单）：
  `difficulty-static-weights` / `difficulty-context-flow` / `difficulty-orchestrator-normalize` / `difficulty-structure-fetch` / `difficulty-distribution-regression`。
- 数据源改为 `KnowledgeContext`（canonical `seedDifficulty`）；31 个缺失值策略：跳过并 WARN（不伪造）。
- 重建 `check-difficulty-anchor`：以 KBL 数据校验年级锚点（复用 `dev/difficulty-anchor-table.js`）。
- `npm test` 接入新脚本；D2 三脚本按 D-4 删除。

### P8-4 默认值/口径统一（P2，最小）
- D3：统一 UI 与 normalize 的缺省口径（UI 显式默认值；normalize 兜底 6 仅在 `difficulty == null` 且无 UI 值时生效）。
- 其余多处默认（session 3 / static 3 / pool gradeMid）为 frozen 兜底 → 契约文档记录，不改。

### P8-5 死代码清理（P2）
- D-1/D-2/D-3 删除（render.js 死工厂、r2 apply、validateConstraints 死导出）。

### P8-6 双 validator 决策（P2，先审计后决）
- 评估 layer2（M5-R09）与 layer3（M8-R03）重叠面：保留双层（各司其职）或合并检查项；不改 frozen layer2 本体，只决定 layer3 是否保留。

### P8-7 文档与验证（P2）
- 更新 `docs/difficulty-system-audit.md`（D2 → RESOLVED、M16 → 完成）、`docs/pol-kbl-pending.md`（P2 重排）、Baseline/DEV_LOG。
- 全量 `npm test` + KBL VERIFY + Golden + Strategy 598/598 + Browser E2E。

### 反膨胀台账（预期）
```text
Runtime Core Delta    = +2（POL 兜底 1 行 + 页面 script 1 行；D-1/D-3 删除为负）
Runtime Support Delta = 0（无新 Service/Adapter）
新增文件              = tests/difficulty/*（测试）+ 可能 1 个重建门禁（替换 D2 脚本）
```

---

## 9. 本阶段不做

- 不改难度公式 / `difficulty-static.js` 计算 / `difficulty.js` 分档
- 不改 frozen `static-difficulty` / `target-difficulty` / `difficulty-strategy` / `adaptive-strategy` / layer2 validator
- 不改 KBL / POL 主结构 / Generator / SVG / UI 结构
- 不新增 Service/Manager/Controller/Adapter

> 待授权后从 **P8-1 / P8-2**（两项一行级修复）开始编码，再进入 P8-3 测试矩阵重建。
