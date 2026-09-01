# M4-R26 FROZEN_CORE_CHANGE 报告 — 简便计算（凑整）家族迁移

> 授权变更类型：M4 迁移批次（逐步摒弃双轨）。
> 生效提交：31fe0e7
> 门禁证据：FULL-EQ math-g4-mixed add-law/mul-law 9/9；verify:m4 全 PASS；
> test:regression PASS 1032 / FAIL 0；frozen-core 93/93 重锚。

## 1. 变更原因

单步口算白名单族（R24/R25）已近耗尽后，按既定路线推进到「multi-step 简便计算」轴：

- `math-g4-m3-g4-mix-addlaw`（加法运算律简便）、`math-g4-m3-g4-mix-mullaw`（乘法运算律简便）
  的 legacy 语义均为多步凑整链（`a+b+c`、`p1×p2×rest`），legacy 产出 100% 可被
  SP 纯算术语义解析（probe：24/24 与 24/24），FULL-EQ 对照前提成立。
- 同插件的 `dist-law`/`dec-simple` 分别存在 legacy 括号题面（SP 不支持括号）与 legacy NaN 缺陷，
  迁移会破坏题面前置或无法通过 FULL-EQ 自洽断言 → 保持 legacy（设计外，不切 native）。

## 2. 变更内容（native 轨道扩展，5 个冻结文件）

### 2.1 `shared/generator/core/arithmetic-core.js`
- 新增 `buildAddLaw(rng)`：`a+b+c` 三项加法链，逐 `a+c`（或 `b+c`）凑整十/百（镜像 legacy 交换律/结合律分支）。
- 新增 `buildMulLaw(rng)`：`p1×p2×rest` 三项乘法链，`p1×p2` 为凑整积（25×4 / 125×8 / 25×8 / 125×4 / 50×2 / 20×5，与 legacy 同表），因子随机打乱展示。
- `buildSpecialKind` 新增 `add-law`/`mul-law` 两 kind 分派。

### 2.2 `shared/generator/core/kp-arithmetic-semantics.js`
- `SPECIAL_ORAL_PROFILE` 新增：
  - `add-law`: { operators:['+'], steps:2, kind:'add-law' }
  - `mul-law`: { operators:['×'], steps:2, kind:'mul-law' }
- 两次变更使 `resolveArithmeticSemantics` 对这两个 legacyType 返回可迁移语义，并在引擎注入
  `constraints.exactSteps=2`、`constraints.kind`。

### 2.3 `shared/generator/generator-registry.js`
- `generator:arithmetic-addition` 绑定 `math-g4-m3-g4-mix-addlaw`。
- `generator:arithmetic-multiplication` 绑定 `math-g4-m3-g4-mix-mullaw`。
- （与 R24/R25 同款：KP 级绑定保证 native 选择确定且轨道为 core。）

### 2.4 `shared/generator/generator-mode.js`
- knowledgePoint 覆盖新增两个 KP → `native`。

### 2.5 `shared/generator/migration-switch.js`
- 新增 `R26_LAW_KPS`（2 KP）、并入 `ALL_MIGRATED`、导出。

## 3. 非冻结配套（dev / 产物）

- `dev/test-migration-equiv.js`：步数门禁由 `maxSteps` 改为「exactSteps>=2 时优先 exactSteps」，
  避免低难度档（maxSteps=1）误伤多步 kind 的两侧对照（sing-step 批次不受影响）。
- `shared/strategy-engine.bundle.js`：重建（模块 84，顺含迁移复杂知识）。
- `dev/migration/m1-m4-old-debt-scan.md`：增量记录 R24/R25 与双轨摒弃进度表。

## 4. 影响面与回归

| KP | legacyType | 迁移 | FULL-EQ |
|----|-----------|------|---------|
| math-g4-m3-g4-mix-addlaw | add-law | → native (arithmetic-addition) | 9/9 EQUIVALENT |
| math-g4-m3-g4-mix-mullaw | mul-law | → native (arithmetic-multiplication) | 9/9 EQUIVALENT |
| math-g4-m3-g4-mix-dist | dist-law | 保持 legacy（括号题面，设计外） | N/A |
| math-g4-m3-g4-mix-dec | dec-simple | 保持 legacy（legacy NaN，设计外） | N/A |
| math-g4-m3-g4-mix-order | order | 保持 legacy（未入白名单） | N/A |

- 迁移门禁：`node dev/check-generator-migration.js math-oral,math-g4-oral,math-g5-oral,math-g4-mixed` → PASS
  （g4-mixed: 可迁移=2 设计外=3）。
- verify:m4 全 PASS；verify:m1/m3 PASS；check-core-generators PASS；check-comprehensive-pipeline PASS。
- test:regression: PASS 1032 / FAIL 0 / PLAN_ERROR 774（与基线一致）。
- bundle 重建 + check-strategy-bundle PASS。
- 表示范围：add-law {1,1000}、mul-law {1,1000}（沿用 KB, native 构造内聚）。

## 5. 基线重锚

以上 5 个冻结文件为核心迁移（R26_Law 批）授权改动，基线已重锚（93/93）。